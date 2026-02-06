import { useCallback, useEffect, useRef } from 'react';
import { Vibration } from 'react-native';

interface UseAlarmVibrationReturn {
    startLoop: () => void;
    stopLoop: () => void;
}

const VIBRATION_PATTERN = [0, 500, 200, 500];

export function useAlarmVibration(): UseAlarmVibrationReturn {
    const isRunningRef = useRef(false);

    const startLoop = useCallback(() => {
        if (isRunningRef.current) return;
        isRunningRef.current = true;
        Vibration.vibrate(VIBRATION_PATTERN, true);
    }, []);

    const stopLoop = useCallback(() => {
        if (!isRunningRef.current) return;
        isRunningRef.current = false;
        Vibration.cancel();
    }, []);

    useEffect(() => {
        return () => {
            if (isRunningRef.current) {
                Vibration.cancel();
            }
        };
    }, []);

    return { startLoop, stopLoop };
}
