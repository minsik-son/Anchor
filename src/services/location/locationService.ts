/**
 * LocaAlert Location Service
 * Background location tracking with smart interval algorithm
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { router } from 'expo-router';
import { useLocationStore } from '../../stores/locationStore';
import { smartInterval } from '../../styles/theme';

const LOCATION_TASK_NAME = 'background-location-task';

// Define the background task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error) {
        console.error('[LocationService] Background task error:', error);
        return;
    }

    if (data) {
        const { locations } = data as any;
        const location = locations[0] as Location.LocationObject;

        if (!location) return;

        // Update location store
        const store = useLocationStore.getState();
        store.updateLocation(location);

        // Check if user has arrived
        if (store.distanceToTarget !== null && store.targetRadius !== undefined) {
            if (store.distanceToTarget <= store.targetRadius) {
                // Trigger alarm
                console.log('[LocationService] User arrived at destination!');

                // Navigate to alarm trigger screen
                router.push('/alarm-trigger');

                // Stop tracking temporarily (alarm screen will handle deactivation)
            }
        }

        console.log('[LocationService] Location updated:', {
            coords: location.coords,
            distance: store.distanceToTarget,
            phase: store.currentPhase,
        });
    }
});

/**
 * Start background location tracking
 */
export async function startBackgroundLocation(
    target: { latitude: number; longitude: number },
    radius: number
): Promise<void> {
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
        throw new Error('Foreground location permission not granted');
    }

    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') {
        console.warn('[LocationService] Background permission not granted, using foreground only');
    }

    // Check if already running
    const isTaskDefined = await TaskManager.isTaskDefined(LOCATION_TASK_NAME);
    if (!isTaskDefined) {
        console.error('[LocationService] Task not defined');
        return;
    }

    const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (hasStarted) {
        console.log('[LocationService] Background tracking already started');
        return;
    }

    // Start location updates
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.High,
        distanceInterval: smartInterval.targetPhase.distanceFilter,
        timeInterval: smartInterval.preparePhase.interval,
        deferredUpdatesInterval: smartInterval.approachPhase.interval,
        foregroundService: {
            notificationTitle: 'LocaAlert 실행 중',
            notificationBody: '목적지 도착을 알려드릴게요',
            notificationColor: '#3182F6',
        },
        activityType: Location.ActivityType.OtherNavigation,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
    });

    console.log('[LocationService] Background location tracking started');
}

/**
 * Stop background location tracking
 */
export async function stopBackgroundLocation(): Promise<void> {
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);

    if (hasStarted) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        console.log('[LocationService] Background location tracking stopped');
    }
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
    callback: (location: Location.LocationObject) => void
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
        callback
    );
}
