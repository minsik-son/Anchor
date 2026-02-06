/**
 * Time utilities
 */

export interface ParsedTime {
    hours: number;
    minutes: number;
}

export function parseTime(timeStr: string): ParsedTime {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return { hours, minutes };
}

export function toMinutes(t: ParsedTime): number {
    return t.hours * 60 + t.minutes;
}

export function isWithinTimeWindow(nowMin: number, startMin: number, endMin: number): boolean {
    if (startMin <= endMin) {
        return nowMin >= startMin && nowMin < endMin;
    }
    // Cross-midnight window (e.g., 23:00 → 01:00)
    return nowMin >= startMin || nowMin < endMin;
}
