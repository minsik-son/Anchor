/**
 * Error Reporting Utility
 * Centralized error handling — currently logs to console,
 * ready for Sentry integration when available.
 *
 * Usage:
 *   import { captureError, captureMessage } from '../utils/errorReporting';
 *
 *   try {
 *       await someOperation();
 *   } catch (error) {
 *       captureError(error, { module: 'LocationService', action: 'setupGeofencing' });
 *   }
 */

type ErrorLevel = 'info' | 'warning' | 'error' | 'fatal';

interface ErrorContext {
    module?: string;
    action?: string;
    [key: string]: any;
}

/**
 * Capture and report an error with optional context.
 * Currently logs to console; will integrate with Sentry when available.
 */
export function captureError(error: unknown, context?: ErrorContext): void {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    const prefix = context?.module ? `[${context.module}]` : '[App]';
    const action = context?.action ? ` ${context.action}:` : '';

    console.error(`${prefix}${action}`, errorObj.message);

    if (__DEV__ && context) {
        console.debug(`${prefix} Error context:`, JSON.stringify(context, null, 2));
    }

    // TODO: Sentry integration
    // Sentry.captureException(errorObj, { extra: context });
}

/**
 * Capture a message with a specified severity level.
 */
export function captureMessage(message: string, level: ErrorLevel = 'warning', context?: ErrorContext): void {
    const prefix = context?.module ? `[${context.module}]` : '[App]';

    switch (level) {
        case 'info':
            console.log(`${prefix} ${message}`);
            break;
        case 'warning':
            console.warn(`${prefix} ${message}`);
            break;
        case 'error':
        case 'fatal':
            console.error(`${prefix} ${message}`);
            break;
    }

    // TODO: Sentry integration
    // Sentry.captureMessage(message, level);
}

/**
 * Set user context for error reports.
 * Call when user identity is established (e.g., device ID).
 */
export function setUserContext(userId: string): void {
    console.log('[ErrorReporting] User context set:', userId);
    // TODO: Sentry integration
    // Sentry.setUser({ id: userId });
}

/**
 * Add breadcrumb for debugging trail.
 */
export function addBreadcrumb(category: string, message: string, data?: Record<string, any>): void {
    if (__DEV__) {
        console.debug(`[Breadcrumb:${category}] ${message}`, data || '');
    }
    // TODO: Sentry integration
    // Sentry.addBreadcrumb({ category, message, data, level: 'info' });
}
