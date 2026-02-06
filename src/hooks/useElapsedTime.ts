/**
 * useElapsedTime - Reusable hook for tracking elapsed time
 * Returns a formatted string (MM:SS or HH:MM:SS) that ticks every second
 */

import { useState, useEffect } from 'react';

function formatElapsed(diffMs: number): string {
    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');

    if (hours > 0) {
        const hh = String(hours).padStart(2, '0');
        return `${hh}:${mm}:${ss}`;
    }
    return `${mm}:${ss}`;
}

export function useElapsedTime(startedAt: string | null): string {
    const [elapsed, setElapsed] = useState('--:--');

    useEffect(() => {
        if (!startedAt) {
            setElapsed('--:--');
            return;
        }

        const startTime = new Date(startedAt).getTime();

        const update = () => {
            const now = Date.now();
            setElapsed(formatElapsed(now - startTime));
        };

        update();
        const interval = setInterval(update, 1000);

        return () => clearInterval(interval);
    }, [startedAt]);

    return elapsed;
}
