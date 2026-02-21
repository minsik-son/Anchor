/**
 * LocaAlert Location Service
 * 3-Phase Hybrid Trigger System (Onion Layers Strategy)
 *
 * Phases:
 *   GEOFENCING       (>5km)   — OS-native geofence, zero GPS battery drain
 *   ADAPTIVE_POLLING  (1.5–5km) — velocity-based dynamic cooldown
 *   ACTIVE_TRACKING   (<1.5km or ETA<3min) — high-precision real-time GPS
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { useLocationStore, TrackingPhase } from '../../stores/locationStore';
import { maybeCheckpoint, resetCheckpoint, finalizeCheckpoint } from '../checkpoint/checkpointService';
import { logEvent, startTelemetrySession, endTelemetrySession } from '../telemetry/telemetryService';
import {
    PHASE_BOUNDARIES,
    ACTIVE_TRACKING_CONFIG,
    GEOFENCING_ROUTE_CONFIG,
    TASK_NAMES,
} from '../../constants/trackingConfig';
import { processLocationUpdate as processChallengeLocation } from './dwellTracker';
import { useChallengeStore } from '../../stores/challengeStore';
import { useAlarmStore } from '../../stores/alarmStore';
import { useAlarmSettingsStore } from '../../stores/alarmSettingsStore';
import { sendArrivalNotification, isAppInForeground, sendTrackingNotification, clearTrackingNotification, clearAllAlarmNotifications } from '../notification/notificationService';
import { sendAndroidFullScreenNotification } from '../notification/androidFullScreenModule';
import { startBackgroundAlarm } from '../alarm/backgroundAlarmService';
import {
    startTrackingActivity,
    updateTrackingActivity,
    stopTrackingActivity,
    hasActiveActivity,
} from '../liveActivity/liveActivityService';
import { captureError, addBreadcrumb } from '../../utils/errorReporting';
import { calculateDynamicCooldown, determinePhase } from './phaseCalculator';

// ---------------------------------------------------------------------------
// Module-level state (the service is the "brain")
// ---------------------------------------------------------------------------

let currentServicePhase: TrackingPhase = 'IDLE';
let currentTarget: { latitude: number; longitude: number } | null = null;
let currentRadius: number = 500;
let lastProcessedAt: number = 0;
/** Tracks consecutive geofence setup failures to prevent infinite fallback loops */
let geofenceSetupFailed: boolean = false;
let lastTrackingNotificationAt: number = 0;
const TRACKING_NOTIFICATION_INTERVAL_MS = 30_000;
/** Prevents repeated arrival notifications — set true after first trigger */
let arrivalTriggered: boolean = false;

// Callback for routine evaluation on background location ticks
let onLocationTickCallback: (() => void) | null = null;

export function registerLocationTickCallback(cb: () => void): void {
    onLocationTickCallback = cb;
}

// ---------------------------------------------------------------------------
// TaskManager task definitions (must be at module scope)
// ---------------------------------------------------------------------------

TaskManager.defineTask(TASK_NAMES.GEOFENCE, async ({ data, error }) => {
    if (error) {
        if (error.message?.includes('kCLErrorDomain Code=0')) {
            console.warn('[LocationService] Geofence task: Location unknown (possibly simulator set to None)');
        } else {
            captureError(error, { module: 'LocationService', action: 'geofenceTask' });
        }
        return;
    }
    if (!data) return;

    const { eventType } = data as { eventType: Location.GeofencingEventType };
    if (eventType === Location.GeofencingEventType.Enter) {
        console.log('[LocationService] Geofence ENTER — transitioning to ADAPTIVE_POLLING');
        if (currentTarget) {
            await transitionToPhase('ADAPTIVE_POLLING');
        }
    }
});

TaskManager.defineTask(TASK_NAMES.LOCATION, async ({ data, error }) => {
    if (error) {
        if (error.message?.includes('kCLErrorDomain Code=0')) {
            // kCLErrorLocationUnknown: Common in simulator or when hardware can't get a lock
            console.warn('[LocationService] Background update: Location unknown. Check simulator "Features > Location" settings.');
        } else {
            captureError(error, { module: 'LocationService', action: 'backgroundLocationTask' });
        }
        return;
    }
    if (!data) return;

    const { locations } = data as { locations: Location.LocationObject[] };
    const location = locations[0];
    if (!location) return;

    const store = useLocationStore.getState();

    // In ADAPTIVE_POLLING: apply dynamic cooldown — skip update if too soon
    if (currentServicePhase === 'ADAPTIVE_POLLING') {
        const now = Date.now();
        const distance = store.distanceToTarget ?? Infinity;
        const speed = store.speed ?? 0;
        const cooldown = calculateDynamicCooldown(distance, speed);

        if (now - lastProcessedAt < cooldown) {
            // Cooldown skip, but still collect route points for polyline continuity
            if (store.isTracking) {
                store.addRoutePoint({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    timestamp: location.timestamp || Date.now(),
                });
                // Checkpoint route data periodically
                const alarmStoreCheckpoint = useAlarmStore.getState();
                if (alarmStoreCheckpoint.activeAlarm) {
                    maybeCheckpoint(
                        alarmStoreCheckpoint.activeAlarm.id,
                        store.routeHistory,
                        store.traveledDistance,
                    ).catch(() => {});  // Fire-and-forget
                }
            }
            return;
        }
        lastProcessedAt = now;
    }

    // Update store (recalculates distance, speed)
    store.updateLocation(location);

    // Append to route history for tracking detail
    if (store.isTracking) {
        store.addRoutePoint({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            timestamp: location.timestamp || Date.now(),
        });
        // Checkpoint route data periodically
        const alarmStoreForCheckpoint = useAlarmStore.getState();
        if (alarmStoreForCheckpoint.activeAlarm) {
            maybeCheckpoint(
                alarmStoreForCheckpoint.activeAlarm.id,
                store.routeHistory,
                store.traveledDistance,
            ).catch(() => {});  // Fire-and-forget
        }
        // Log route milestone events
        if (store.routeHistory.length % 100 === 0 && store.routeHistory.length > 0) {
            logEvent('route_milestone', {
                totalPoints: store.routeHistory.length,
                traveledDistance: store.traveledDistance,
            }).catch(() => {});
        }
    }

    // Check alarm trigger (user within target radius)
    if (store.checkGeofence()) {
        const alarmStore = useAlarmStore.getState();

        // Guard: skip if alarm was already dismissed, no active alarm, or already triggered
        if (!alarmStore.activeAlarm || alarmStore.dismissedAlarmId === alarmStore.activeAlarm.id) {
            console.log('[LocationService] Geofence triggered but alarm already dismissed, skipping');
            return;
        }
        if (arrivalTriggered) {
            console.log('[LocationService] Arrival already triggered, ignoring duplicate');
            return;
        }

        // CRITICAL: Set flag IMMEDIATELY to prevent any further arrival processing
        arrivalTriggered = true;

        console.log('[LocationService] User arrived! Distance:', store.distanceToTarget);

        // Log alarm trigger event
        logEvent('alarm_triggered', {
            distance: store.distanceToTarget,
            routePoints: store.routeHistory.length,
            traveledDistance: store.traveledDistance,
        }).catch(() => {});

        // Stop Live Activity and clear any tracking notifications
        stopTrackingActivity().catch(err =>
            console.warn('[LocationService] Failed to stop Live Activity:', err),
        );
        clearTrackingNotification().catch(err =>
            console.warn('[LocationService] Failed to clear tracking notification:', err),
        );

        // 1) Start alarm sound + vibration IMMEDIATELY (works in background/lock screen)
        // Must happen BEFORE teardown so iOS audio session is established
        // while the background task is still alive
        const alarmSettings = useAlarmSettingsStore.getState();
        try {
            await startBackgroundAlarm(alarmSettings.alertType, alarmSettings.selectedSound);
        } catch (err) {
            console.warn('[LocationService] Failed to start background alarm:', err);
        }

        // 2) Navigate or send notification
        if (isAppInForeground()) {
            router.navigate('/alarm-trigger');
        } else {
            const alarmTitle = alarmStore.activeAlarm.title ?? '';
            const alarmId = alarmStore.activeAlarm.id;
            try {
                if (Platform.OS === 'android') {
                    // Android: Full-screen intent notification (shows alarm over lock screen)
                    await sendAndroidFullScreenNotification(alarmTitle, alarmId, alarmSettings.selectedSound);
                } else {
                    // iOS: Critical notification with action buttons (dismiss from lock screen)
                    await sendArrivalNotification(alarmTitle, alarmId, alarmSettings.selectedSound);
                }
            } catch (err) {
                console.warn('[LocationService] Failed to send notification:', err);
            }
        }

        // 3) Stop GPS tracking LAST — audio session already established above
        await teardownPhase(currentServicePhase);
        currentServicePhase = 'IDLE';
        return;
    }

    // Evaluate phase transition
    const distance = store.distanceToTarget;
    const speed = store.speed ?? 0;
    if (distance !== null) {
        const desiredPhase = determinePhase(distance, speed, currentServicePhase, geofenceSetupFailed);
        if (desiredPhase !== currentServicePhase) {
            await transitionToPhase(desiredPhase);
        }
    }

    // Send tracking update (Live Activity or notification fallback)
    if (currentServicePhase === 'ADAPTIVE_POLLING' || currentServicePhase === 'ACTIVE_TRACKING') {
        const now2 = Date.now();
        if (now2 - lastTrackingNotificationAt >= TRACKING_NOTIFICATION_INTERVAL_MS) {
            const alarmStore2 = useAlarmStore.getState();
            const locationStore = useLocationStore.getState();
            if (alarmStore2.activeAlarm && locationStore.trackingStartedAt && store.distanceToTarget) {
                if (hasActiveActivity()) {
                    // Live Activity: only update distance (timer is automatic)
                    updateTrackingActivity(
                        alarmStore2.activeAlarm.title ?? '',
                        store.distanceToTarget,
                    ).catch(err => console.warn('[LocationService] Live Activity update failed:', err));
                } else {
                    // Fallback: regular notification
                    const elapsedSec = Math.floor((now2 - new Date(locationStore.trackingStartedAt).getTime()) / 1000);
                    sendTrackingNotification(
                        store.distanceToTarget,
                        elapsedSec,
                        alarmStore2.activeAlarm.id,
                        alarmStore2.activeAlarm.title ?? '',
                    ).catch(err => console.warn('[LocationService] Tracking notification failed:', err));
                }
                lastTrackingNotificationAt = now2;
            }
        }
    }

    // Challenge geofence check — process location for dwell tracking
    const challengeStore = useChallengeStore.getState();
    if (challengeStore.activeChallenges.length > 0) {
        processChallengeLocation(
            {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                accuracy: location.coords.accuracy ?? undefined,
            },
            challengeStore.activeChallenges,
        );
    }

    // Notify callback of location tick
    onLocationTickCallback?.();

    console.log('[LocationService] Update:', {
        phase: currentServicePhase,
        distance: store.distanceToTarget,
        speed: store.speed,
    });
});

// ---------------------------------------------------------------------------
// Phase setup / teardown
// ---------------------------------------------------------------------------

async function teardownPhase(phase: TrackingPhase): Promise<void> {
    try {
        if (phase === 'GEOFENCING') {
            const hasGeo = await Location.hasStartedGeofencingAsync(TASK_NAMES.GEOFENCE);
            if (hasGeo) await Location.stopGeofencingAsync(TASK_NAMES.GEOFENCE);
            // Also stop location updates used for route collection during GEOFENCING
            const hasLoc = await Location.hasStartedLocationUpdatesAsync(TASK_NAMES.LOCATION);
            if (hasLoc) await Location.stopLocationUpdatesAsync(TASK_NAMES.LOCATION);
        }
        if (phase === 'ADAPTIVE_POLLING' || phase === 'ACTIVE_TRACKING') {
            const has = await Location.hasStartedLocationUpdatesAsync(TASK_NAMES.LOCATION);
            if (has) await Location.stopLocationUpdatesAsync(TASK_NAMES.LOCATION);
        }
    } catch (err) {
        captureError(err, { module: 'LocationService', action: 'teardownPhase', phase });
    }
}

async function setupGeofencing(): Promise<void> {
    if (!currentTarget) return;
    try {
        await Location.startGeofencingAsync(TASK_NAMES.GEOFENCE, [{
            identifier: 'target-approach-zone',
            latitude: currentTarget.latitude,
            longitude: currentTarget.longitude,
            radius: PHASE_BOUNDARIES.GEOFENCING_RADIUS,
            notifyOnEnter: true,
            notifyOnExit: false,
        }]);
        geofenceSetupFailed = false;
        console.log('[LocationService] Geofencing started (5km radius)');

        // Start low-power location updates alongside geofencing for route collection
        try {
            await Location.startLocationUpdatesAsync(TASK_NAMES.LOCATION, {
                accuracy: Location.Accuracy.Balanced,
                distanceInterval: GEOFENCING_ROUTE_CONFIG.DISTANCE_INTERVAL,
                timeInterval: GEOFENCING_ROUTE_CONFIG.TIME_INTERVAL,
                foregroundService: {
                    notificationTitle: 'LocaAlert 실행 중',
                    notificationBody: '목적지 도착을 알려드릴게요',
                    notificationColor: '#3182F6',
                },
                activityType: Location.ActivityType.OtherNavigation,
                pausesUpdatesAutomatically: false,
                showsBackgroundLocationIndicator: true,
            });
            console.log('[LocationService] Geofencing route collection started (low-power)');
        } catch (routeErr) {
            captureError(routeErr, { module: 'LocationService', action: 'geofencingRouteCollection' });
        }
    } catch (err) {
        captureError(err, { module: 'LocationService', action: 'setupGeofencing', target: currentTarget });
        geofenceSetupFailed = true;
        await transitionToPhase('ADAPTIVE_POLLING');
    }
}

async function setupAdaptivePolling(): Promise<void> {
    lastProcessedAt = 0;
    await Location.startLocationUpdatesAsync(TASK_NAMES.LOCATION, {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 50,
        timeInterval: 15_000,
        foregroundService: {
            notificationTitle: 'LocaAlert 실행 중',
            notificationBody: '목적지 도착을 알려드릴게요',
            notificationColor: '#3182F6',
        },
        activityType: Location.ActivityType.OtherNavigation,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
    });
    console.log('[LocationService] Adaptive polling started');
}

async function setupActiveTracking(): Promise<void> {
    await Location.startLocationUpdatesAsync(TASK_NAMES.LOCATION, {
        accuracy: Location.Accuracy.High,
        distanceInterval: ACTIVE_TRACKING_CONFIG.DISTANCE_FILTER_METERS,
        timeInterval: 5_000,
        foregroundService: {
            notificationTitle: 'LocaAlert 실행 중',
            notificationBody: '곧 목적지에 도착합니다',
            notificationColor: '#3182F6',
        },
        activityType: Location.ActivityType.OtherNavigation,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
    });
    console.log('[LocationService] Active tracking started (high accuracy)');
}

// ---------------------------------------------------------------------------
// Phase transition orchestrator
// ---------------------------------------------------------------------------

async function transitionToPhase(newPhase: TrackingPhase): Promise<void> {
    if (newPhase === currentServicePhase) return;

    const prev = currentServicePhase;
    console.log(`[LocationService] Phase: ${prev} → ${newPhase}`);
    addBreadcrumb('tracking', `Phase: ${prev} → ${newPhase}`);

    // Log phase transition event
    logEvent('phase_transition', {
        from: prev,
        to: newPhase,
        distance: useLocationStore.getState().distanceToTarget,
        speed: useLocationStore.getState().speed,
    }).catch(() => {});

    await teardownPhase(prev);
    currentServicePhase = newPhase;

    switch (newPhase) {
        case 'GEOFENCING': await setupGeofencing(); break;
        case 'ADAPTIVE_POLLING': await setupAdaptivePolling(); break;
        case 'ACTIVE_TRACKING': await setupActiveTracking(); break;
        case 'IDLE': break;
    }

    useLocationStore.getState().setPhase(newPhase);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start the 3-phase tracking state machine.
 * Called from alarm-setup after the store's startTracking() sets up state.
 */
export async function startTracking(
    target: { latitude: number; longitude: number },
    radius: number,
    initialDistanceMeters?: number,
): Promise<void> {
    const { status: fg } = await Location.requestForegroundPermissionsAsync();
    if (fg !== 'granted') throw new Error('Foreground location permission not granted');

    const { status: bg } = await Location.requestBackgroundPermissionsAsync();
    if (bg !== 'granted') {
        console.warn('[LocationService] Background permission not granted');
    }

    const locationTaskDefined = await TaskManager.isTaskDefined(TASK_NAMES.LOCATION);
    const geofenceTaskDefined = await TaskManager.isTaskDefined(TASK_NAMES.GEOFENCE);
    if (!locationTaskDefined || !geofenceTaskDefined) {
        console.error('[LocationService] Tasks not defined');
        return;
    }

    // Start telemetry session and reset checkpoint
    startTelemetrySession();
    resetCheckpoint();

    currentTarget = target;
    currentRadius = radius;
    arrivalTriggered = false; // Reset for new tracking session

    const distance = initialDistanceMeters ?? Infinity;
    const initialPhase = determinePhase(distance, 0, 'IDLE', false);

    await transitionToPhase(initialPhase);

    if (distance !== Infinity) {
        // Only start Live Activity / notification for close-range phases.
        // During GEOFENCING (>5km), do NOTHING — no Live Activity, no notification.
        // The regular tracking loop will start Live Activity when user gets closer
        // and the phase transitions to ADAPTIVE_POLLING or ACTIVE_TRACKING.
        const alarmStore = useAlarmStore.getState();
        const locationStore = useLocationStore.getState();
        if (alarmStore.activeAlarm && locationStore.trackingStartedAt && initialPhase !== 'GEOFENCING') {
            const started = await startTrackingActivity(
                alarmStore.activeAlarm.title ?? '',
                distance,
                locationStore.trackingStartedAt,
            );
            if (!started) {
                sendTrackingNotification(distance, 0, alarmStore.activeAlarm.id, alarmStore.activeAlarm.title ?? '').catch(() => {});
            }
        }
        lastTrackingNotificationAt = Date.now();
    }
}

/**
 * Stop all tracking — tears down whichever phase is active.
 */
export async function stopAllTracking(): Promise<void> {
    // Finalize checkpoint and end telemetry
    const alarmStore = useAlarmStore.getState();
    if (alarmStore.activeAlarm) {
        await finalizeCheckpoint(alarmStore.activeAlarm.id);
    }
    endTelemetrySession();

    await teardownPhase(currentServicePhase);
    currentServicePhase = 'IDLE';
    currentTarget = null;
    lastProcessedAt = 0;
    geofenceSetupFailed = false;
    lastTrackingNotificationAt = 0;
    arrivalTriggered = false;
    // NOTE: Do NOT call clearRouteHistory() here.
    // Route data must persist until completeAlarm/deactivateAlarm saves it to DB.
    // The store's stopTracking() action handles clearing after DB save.
    stopTrackingActivity().catch(() => {});
    clearAllAlarmNotifications().catch(() => {});
    console.log('[LocationService] All tracking stopped');
}

/**
 * Get current location once
 */
export async function getCurrentLocation(): Promise<Location.LocationObject> {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
        throw new Error('Location permission not granted');
    }

    return await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
    });
}

/**
 * Watch location in foreground
 */
export async function watchLocation(
    callback: (location: Location.LocationObject) => void,
): Promise<{ remove: () => void }> {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
        throw new Error('Location permission not granted');
    }

    return await Location.watchPositionAsync(
        {
            accuracy: Location.Accuracy.High,
            distanceInterval: 10,
            timeInterval: 5000,
        },
        callback,
    );
}
