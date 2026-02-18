/**
 * Live Activity Service - iOS Dynamic Island + Lock Screen widget
 * Wraps expo-live-activity with runtime support check and fallback flag.
 *
 * expo-live-activity ProgressBar supports:
 *   - date: epoch ms (countdown timer to end date)
 *   - progress: 0-1 (progress bar fill)
 * We use `progress` to show trip completion percentage.
 */

import {
    startActivity,
    updateActivity,
    stopActivity,
} from 'expo-live-activity';
import { Platform } from 'react-native';

let currentActivityId: string | null = null;
let initialDistance: number = 0; // meters, set on start

/**
 * Check if Live Activity is supported on this device.
 * Requires iOS 16+ and expo-live-activity native module.
 */
export function isLiveActivitySupported(): boolean {
    if (Platform.OS !== 'ios') return false;
    const version = parseInt(Platform.Version as string, 10);
    return version >= 16;
}

function formatDist(meters: number): string {
    return meters < 1000
        ? `${Math.round(meters)}m 남음`
        : `${(meters / 1000).toFixed(1)}km 남음`;
}

function calcProgress(currentDistance: number): number {
    if (initialDistance <= 0) return 0;
    const p = 1 - currentDistance / initialDistance;
    return Math.max(0, Math.min(1, p));
}

/**
 * Start a Live Activity for tracking.
 * @returns true if started successfully, false if not supported (caller should use notification fallback)
 */
export async function startTrackingActivity(
    alarmTitle: string,
    distanceMeters: number,
    _trackingStartedAt: string,
): Promise<boolean> {
    if (!isLiveActivitySupported()) return false;

    try {
        initialDistance = distanceMeters;

        const id = await startActivity(
            {
                title: alarmTitle,
                subtitle: formatDist(distanceMeters),
                progressBar: {
                    progress: 0,
                },
            },
            {
                backgroundColor: '#101012',
                titleColor: '#FFFFFF',
                subtitleColor: '#B0B0B0',
                progressViewTint: '#3182F6',
                progressViewLabelColor: '#FFFFFF',
                timerType: 'digital',
            },
        );

        if (id) {
            currentActivityId = id;
            console.log('[LiveActivity] Started:', id);
            return true;
        }
        return false;
    } catch (err) {
        console.warn('[LiveActivity] Failed to start:', err);
        return false;
    }
}

/**
 * Update the Live Activity with new distance data + progress.
 */
export async function updateTrackingActivity(
    alarmTitle: string,
    distanceMeters: number,
): Promise<void> {
    if (!currentActivityId) return;

    try {
        await updateActivity(currentActivityId, {
            title: alarmTitle,
            subtitle: formatDist(distanceMeters),
            progressBar: {
                progress: calcProgress(distanceMeters),
            },
        });
    } catch (err) {
        console.warn('[LiveActivity] Failed to update:', err);
    }
}

/**
 * Stop the Live Activity (on arrival or cancellation).
 */
export async function stopTrackingActivity(): Promise<void> {
    if (!currentActivityId) return;

    try {
        await stopActivity(currentActivityId, {
            title: '도착 완료',
            subtitle: '목적지에 도착했습니다',
            progressBar: {
                progress: 1,
            },
        });
        console.log('[LiveActivity] Stopped:', currentActivityId);
    } catch (err) {
        console.warn('[LiveActivity] Failed to stop:', err);
    } finally {
        currentActivityId = null;
        initialDistance = 0;
    }
}

/**
 * Check if a Live Activity is currently active.
 */
export function hasActiveActivity(): boolean {
    return currentActivityId !== null;
}
