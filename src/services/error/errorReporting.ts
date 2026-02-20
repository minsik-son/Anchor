/**
 * Error Reporting Service
 * Centralized error capture using Sentry.
 * In development mode, errors are only logged to console.
 */

import * as Sentry from '@sentry/react-native';

/**
 * Capture an exception and send to Sentry (production only).
 * Always logs to console regardless of environment.
 */
export function captureError(
    error: unknown,
    context?: Record<string, unknown>,
): void {
    if (error instanceof Error) {
        console.error(`[Error] ${error.message}`, context);
    } else {
        console.error('[Error]', error, context);
    }

    if (!__DEV__) {
        Sentry.captureException(error, {
            extra: context,
        });
    }
}

/**
 * Capture a message (non-error event) and send to Sentry.
 */
export function captureMessage(
    message: string,
    level: Sentry.SeverityLevel = 'info',
    context?: Record<string, unknown>,
): void {
    console.log(`[${level}] ${message}`, context);

    if (!__DEV__) {
        Sentry.captureMessage(message, {
            level,
            extra: context,
        });
    }
}

/**
 * Set user context for Sentry (e.g., after identifying user).
 */
export function setUserContext(userId: string): void {
    if (!__DEV__) {
        Sentry.setUser({ id: userId });
    }
}

/**
 * Add breadcrumb for debugging context.
 */
export function addBreadcrumb(
    category: string,
    message: string,
    data?: Record<string, unknown>,
): void {
    if (!__DEV__) {
        Sentry.addBreadcrumb({
            category,
            message,
            data,
            level: 'info',
        });
    }
}
