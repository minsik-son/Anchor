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
import { router } from 'expo-router';
import { useLocationStore, TrackingPhase } from '../../stores/locationStore';
import {
    PHASE_BOUNDARIES,
    ADAPTIVE_POLLING_CONFIG,
    ACTIVE_TRACKING_CONFIG,
    GEOFENCING_ROUTE_CONFIG,
    TASK_NAMES,
} from '../../constants/trackingConfig';
import { processLocationUpdate as processChallengeLocation } from './dwellTracker';
import { useChallengeStore } from '../../stores/challengeStore';
import { useAlarmStore } from '../../stores/alarmStore';
import { useAlarmSettingsStore } from '../../stores/alarmSettingsStore';
import { sendArrivalNotification, isAppInForeground, sendTrackingNotification, clearTrackingNotification } from '../notification/notificationService';
import {
    startTrackingActivity,
    updateTrackingActivity,
    stopTrackingActivity,
    hasActiveActivity,
} from '../liveActivity/liveActivityService';

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

// Callback for routine evaluation on background location ticks
let onLocationTickCallback: (() => void) | null = null;

export function registerLocationTickCallback(cb: () => void): void {
    onLocationTickCallback = cb;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Calculate dynamic cooldown for ADAPTIVE_POLLING based on distance & speed.
 * Returns cooldown in milliseconds clamped to [MIN, MAX].
 * For long-range distances (>50km), uses a much longer max cooldown to save battery.
 */
function calculateDynamicCooldown(distanceMeters: number, speedKmh: number): number {
    const effectiveSpeed = Math.max(speedKmh, ADAPTIVE_POLLING_CONFIG.MIN_ASSUMED_SPEED_KMH);
    const speedMs = (effectiveSpeed * 1000) / 3600;
    const etaSeconds = distanceMeters / speedMs;
    let cooldownMs = (etaSeconds / 2) * 1000;

    if (speedKmh > ADAPTIVE_POLLING_CONFIG.HIGH_SPEED_THRESHOLD_KMH) {
        cooldownMs *= ADAPTIVE_POLLING_CONFIG.HIGH_SPEED_COOLDOWN_MULTIPLIER;
    }

    // Use longer max cooldown for long-range distances to save battery
    const maxCooldown = distanceMeters > PHASE_BOUNDARIES.LONG_RANGE_POLLING_THRESHOLD
        ? ADAPTIVE_POLLING_CONFIG.LONG_RANGE_MAX_COOLDOWN_MS
        : ADAPTIVE_POLLING_CONFIG.MAX_COOLDOWN_MS;

    return Math.max(
        ADAPTIVE_POLLING_CONFIG.MIN_COOLDOWN_MS,
        Math.min(maxCooldown, cooldownMs),
    );
}

/**
 * Should we transition into ACTIVE_TRACKING?
 * True when distance < 1.5km OR estimated time of arrival < 3 min.
 */
function shouldEnterActiveTracking(distanceMeters: number, speedKmh: number): boolean {
    if (distanceMeters < PHASE_BOUNDARIES.ADAPTIVE_POLLING_MIN) return true;

    const effectiveSpeed = Math.max(speedKmh, ADAPTIVE_POLLING_CONFIG.MIN_ASSUMED_SPEED_KMH);
    const speedMs = (effectiveSpeed * 1000) / 3600;
    const etaMinutes = (distanceMeters / speedMs) / 60;
    return etaMinutes < ADAPTIVE_POLLING_CONFIG.ETA_TRANSITION_MINUTES;
}

/**
 * Determine the ideal tracking phase, applying hysteresis to prevent flapping.
 * If geofence setup previously failed, stays in ADAPTIVE_POLLING instead of
 * transitioning back to GEOFENCING (prevents infinite fallback loops).
 */
function determinePhase(
    distanceMeters: number,
    speedKmh: number,
    fromPhase: TrackingPhase,
): TrackingPhase {
    // Forward: enter ACTIVE_TRACKING when close or ETA is short
    if (shouldEnterActiveTracking(distanceMeters, speedKmh)) {
        return 'ACTIVE_TRACKING';
    }

    // Reverse: leave ACTIVE_TRACKING only beyond hysteresis buffer
    if (fromPhase === 'ACTIVE_TRACKING') {
        return distanceMeters > PHASE_BOUNDARIES.ACTIVE_EXIT_BUFFER
            ? 'ADAPTIVE_POLLING'
            : 'ACTIVE_TRACKING';
    }

    // Forward: enter ADAPTIVE_POLLING within geofencing radius
    if (distanceMeters <= PHASE_BOUNDARIES.GEOFENCING_RADIUS) {
        return 'ADAPTIVE_POLLING';
    }

    // Reverse: leave ADAPTIVE_POLLING only beyond hysteresis buffer
    // BUT if geofence setup previously failed, stay in ADAPTIVE_POLLING
    // to prevent infinite GEOFENCING → fail → ADAPTIVE_POLLING → GEOFENCING loop
    if (fromPhase === 'ADAPTIVE_POLLING') {
        if (geofenceSetupFailed) {
            return 'ADAPTIVE_POLLING';
        }
        return distanceMeters > PHASE_BOUNDARIES.GEOFENCING_EXIT_BUFFER
            ? 'GEOFENCING'
            : 'ADAPTIVE_POLLING';
    }

    return 'GEOFENCING';
}

// ---------------------------------------------------------------------------
// TaskManager task definitions (must be at module scope)
// ---------------------------------------------------------------------------

TaskManager.defineTask(TASK_NAMES.GEOFENCE, async ({ data, error }) => {
    if (error) {
        if (error.message?.includes('kCLErrorDomain Code=0')) {
            console.warn('[LocationService] Geofence task: Location unknown (possibly simulator set to None)');
        } else {
            console.error('[LocationService] Geofence task error:', error);
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
            console.error('[LocationService] Background task error:', error);
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
    }

    // Check alarm trigger (user within target radius)
    if (store.checkGeofence()) {
        const alarmStore = useAlarmStore.getState();

        // Guard: skip if alarm was already dismissed or no active alarm
        if (!alarmStore.activeAlarm || alarmStore.dismissedAlarmId === alarmStore.activeAlarm.id) {
            console.log('[LocationService] Geofence triggered but alarm already dismissed, skipping');
            return;
        }

        console.log('[LocationService] User arrived! Distance:', store.distanceToTarget);

        // Always send a local notification (works in both foreground & background)
        const alarmTitle = alarmStore.activeAlarm.title ?? '';
        const alarmId = alarmStore.activeAlarm.id;
        const alarmSettings = useAlarmSettingsStore.getState();
        sendArrivalNotification(alarmTitle, alarmId, alarmSettings.selectedSound).catch(err =>
            console.warn('[LocationService] Failed to send notification:', err),
        );

        stopTrackingActivity().catch(err =>
            console.warn('[LocationService] Failed to stop Live Activity:', err),
        );
        clearTrackingNotification().catch(err =>
            console.warn('[LocationService] Failed to clear tracking notification:', err),
        );

        // If app is in foreground, navigate to alarm screen
        // Use replace instead of push to prevent stacking multiple modal instances
        if (isAppInForeground()) {
            router.navigate('/alarm-trigger');
        }
        return;
    }

    // Evaluate phase transition
    const distance = store.distanceToTarget;
    const speed = store.speed ?? 0;
    if (distance !== null) {
        const desiredPhase = determinePhase(distance, speed, currentServicePhase);
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
        console.warn('[LocationService] Teardown error:', err);
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
            console.warn('[LocationService] Failed to start route collection during geofencing:', routeErr);
        }
    } catch (err) {
        console.warn('[LocationService] Geofencing failed, falling back to ADAPTIVE_POLLING:', err);
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

    currentTarget = target;
    currentRadius = radius;

    const distance = initialDistanceMeters ?? Infinity;
    const initialPhase = determinePhase(distance, 0, 'IDLE');

    await transitionToPhase(initialPhase);

    if (distance !== Infinity) {
        // Try Live Activity first (Dynamic Island), fall back to notification
        const alarmStore = useAlarmStore.getState();
        const locationStore = useLocationStore.getState();
        if (alarmStore.activeAlarm && locationStore.trackingStartedAt) {
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
    await teardownPhase(currentServicePhase);
    currentServicePhase = 'IDLE';
    currentTarget = null;
    lastProcessedAt = 0;
    geofenceSetupFailed = false;
    lastTrackingNotificationAt = 0;
    useLocationStore.getState().clearRouteHistory();
    stopTrackingActivity().catch(() => {});
    clearTrackingNotification().catch(() => {});
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
