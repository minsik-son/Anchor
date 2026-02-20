/**
 * Background Alarm Service
 * Standalone service (no React hooks) that plays alarm sound + vibration
 * directly from TaskManager background callback.
 *
 * This enables alarm to ring even when the screen is locked,
 * just like the iOS built-in alarm.
 */

import { Audio } from 'expo-av';
import { Vibration } from 'react-native';
import { ALARM_SOUNDS, AlarmSoundKey, AlertType } from '../../stores/alarmSettingsStore';

const VIBRATION_PATTERN = [0, 500, 200, 500];

let currentSound: Audio.Sound | null = null;
let isAlarmActive = false;

/**
 * Start alarm sound and/or vibration based on user's alertType setting.
 * Safe to call from background TaskManager callback.
 *
 * - alertType='sound'     → sound only
 * - alertType='vibration' → vibration only
 * - alertType='both'      → sound + vibration
 */
export async function startBackgroundAlarm(
    alertType: AlertType,
    soundKey: AlarmSoundKey,
): Promise<void> {
    if (isAlarmActive) return;
    isAlarmActive = true;

    const shouldPlaySound = alertType === 'both' || alertType === 'sound';
    const shouldVibrate = alertType === 'both' || alertType === 'vibration';

    // Start sound playback
    if (shouldPlaySound) {
        try {
            await Audio.setAudioModeAsync({
                playsInSilentModeIOS: true,
                staysActiveInBackground: true,
            });

            const { sound } = await Audio.Sound.createAsync(
                ALARM_SOUNDS[soundKey].asset,
                { isLooping: true, shouldPlay: true },
            );
            currentSound = sound;
        } catch (err) {
            console.warn('[BackgroundAlarm] Failed to start sound:', err);
        }
    }

    // Start vibration loop
    if (shouldVibrate) {
        try {
            Vibration.vibrate(VIBRATION_PATTERN, true);
        } catch (err) {
            console.warn('[BackgroundAlarm] Failed to start vibration:', err);
        }
    }

    console.log('[BackgroundAlarm] Started:', { alertType, soundKey });
}

/**
 * Stop all alarm sound and vibration.
 * Called from alarm-trigger dismiss handler.
 */
export async function stopBackgroundAlarm(): Promise<void> {
    if (currentSound) {
        try {
            await currentSound.stopAsync();
            await currentSound.unloadAsync();
        } catch {
            // Sound may already be unloaded
        }
        currentSound = null;
    }

    Vibration.cancel();
    isAlarmActive = false;

    console.log('[BackgroundAlarm] Stopped');
}

/** Check if background alarm is currently active */
export function isBackgroundAlarmActive(): boolean {
    return isAlarmActive;
}
