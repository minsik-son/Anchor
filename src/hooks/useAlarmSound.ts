import { useRef, useCallback, useEffect, useState } from 'react';
import { Audio } from 'expo-av';
import { ALARM_SOUNDS, AlarmSoundKey } from '../stores/alarmSettingsStore';

interface UseAlarmSoundOptions {
    loop?: boolean;
}

interface UseAlarmSoundReturn {
    play: (soundKey: AlarmSoundKey) => Promise<void>;
    stop: () => Promise<void>;
    isPlaying: boolean;
}

export function useAlarmSound(options?: UseAlarmSoundOptions): UseAlarmSoundReturn {
    const soundRef = useRef<Audio.Sound | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    const stop = useCallback(async () => {
        if (soundRef.current) {
            try {
                await soundRef.current.stopAsync();
                await soundRef.current.unloadAsync();
            } catch {
                // Sound may already be unloaded
            }
            soundRef.current = null;
        }
        setIsPlaying(false);
    }, []);

    const play = useCallback(async (soundKey: AlarmSoundKey) => {
        await stop();

        await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: true,
        });

        const { sound } = await Audio.Sound.createAsync(
            ALARM_SOUNDS[soundKey].asset,
            { isLooping: options?.loop ?? false, shouldPlay: true }
        );

        soundRef.current = sound;
        setIsPlaying(true);
    }, [stop, options?.loop]);

    useEffect(() => {
        return () => {
            if (soundRef.current) {
                soundRef.current.stopAsync().then(() => {
                    soundRef.current?.unloadAsync();
                }).catch(() => {});
            }
        };
    }, []);

    return { play, stop, isPlaying };
}
