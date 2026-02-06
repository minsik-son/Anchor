import { useEffect, useRef } from 'react';
import { Accelerometer } from 'expo-sensors';

const SHAKE_THRESHOLD = 2.5;
const SHAKE_COUNT_REQUIRED = 3;
const SHAKE_WINDOW_MS = 1000;

interface UseShakeDetectionOptions {
    enabled: boolean;
    onShake: () => void;
}

export function useShakeDetection({ enabled, onShake }: UseShakeDetectionOptions): void {
    const onShakeRef = useRef(onShake);
    const hasTriggeredRef = useRef(false);
    const shakeTimestampsRef = useRef<number[]>([]);

    useEffect(() => {
        onShakeRef.current = onShake;
    }, [onShake]);

    useEffect(() => {
        if (!enabled) return;

        hasTriggeredRef.current = false;
        shakeTimestampsRef.current = [];

        Accelerometer.setUpdateInterval(100);

        const subscription = Accelerometer.addListener(({ x, y, z }) => {
            if (hasTriggeredRef.current) return;

            const magnitude = Math.sqrt(x * x + y * y + z * z);

            if (magnitude > SHAKE_THRESHOLD) {
                const now = Date.now();
                const timestamps = shakeTimestampsRef.current;

                timestamps.push(now);

                // Keep only timestamps within the time window
                const cutoff = now - SHAKE_WINDOW_MS;
                shakeTimestampsRef.current = timestamps.filter((t) => t > cutoff);

                if (shakeTimestampsRef.current.length >= SHAKE_COUNT_REQUIRED) {
                    hasTriggeredRef.current = true;
                    onShakeRef.current();
                }
            }
        });

        return () => {
            subscription.remove();
        };
    }, [enabled]);
}
