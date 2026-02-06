/** Phase boundary distances (meters) */
export const PHASE_BOUNDARIES = {
    GEOFENCING_RADIUS: 5000,
    ADAPTIVE_POLLING_MIN: 1500,
    // Hysteresis thresholds (for reverse transitions)
    GEOFENCING_EXIT_BUFFER: 6000,
    ACTIVE_EXIT_BUFFER: 2000,
} as const;

/** Adaptive polling configuration */
export const ADAPTIVE_POLLING_CONFIG = {
    MIN_ASSUMED_SPEED_KMH: 5,
    HIGH_SPEED_THRESHOLD_KMH: 80,
    HIGH_SPEED_COOLDOWN_MULTIPLIER: 0.3,
    MIN_COOLDOWN_MS: 10_000,
    MAX_COOLDOWN_MS: 30_000,
    ETA_TRANSITION_MINUTES: 3,
} as const;

/** Active tracking configuration */
export const ACTIVE_TRACKING_CONFIG = {
    DISTANCE_FILTER_METERS: 10,
} as const;

/** TaskManager task names */
export const TASK_NAMES = {
    LOCATION: 'background-location-task',
    GEOFENCE: 'background-geofence-task',
} as const;
