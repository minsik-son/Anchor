/**
 * Routine Utilities
 * Helper functions for routine display
 */

/**
 * Format repeat days as a readable string
 */
export function formatRepeatDays(days: number[], t: (key: string) => string): string {
    if (days.length === 7) {
        return t('days.everyday');
    }
    if (days.length === 5 && days.every(d => d >= 1 && d <= 5)) {
        return t('days.weekdays');
    }
    if (days.length === 2 && days.includes(0) && days.includes(6)) {
        return t('days.weekend');
    }

    const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    return days.map(d => t(`days.${dayKeys[d]}`)).join(', ');
}
