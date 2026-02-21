/**
 * Expo Config Plugin: withFullScreenNotification
 *
 * Adds Android full-screen intent support for alarm notifications.
 * When the phone is locked and user arrives at destination,
 * the alarm-trigger screen appears directly over the lock screen.
 *
 * What this plugin does:
 * 1. Adds USE_FULL_SCREEN_INTENT and WAKE_LOCK permissions to AndroidManifest.xml
 * 2. Adds showWhenLocked/turnScreenOn flags to MainActivity
 */

const { withAndroidManifest, withMainActivity } = require('expo/config-plugins');

/**
 * Add full-screen intent permissions to AndroidManifest.xml
 */
function withFullScreenPermissions(config) {
    return withAndroidManifest(config, (config) => {
        const manifest = config.modResults.manifest;

        // Ensure uses-permission array exists
        if (!manifest['uses-permission']) {
            manifest['uses-permission'] = [];
        }

        const permissions = manifest['uses-permission'];

        // Add USE_FULL_SCREEN_INTENT permission
        const hasFullScreen = permissions.some(
            (p) => p.$?.['android:name'] === 'android.permission.USE_FULL_SCREEN_INTENT'
        );
        if (!hasFullScreen) {
            permissions.push({
                $: { 'android:name': 'android.permission.USE_FULL_SCREEN_INTENT' },
            });
        }

        // Add WAKE_LOCK permission
        const hasWakeLock = permissions.some(
            (p) => p.$?.['android:name'] === 'android.permission.WAKE_LOCK'
        );
        if (!hasWakeLock) {
            permissions.push({
                $: { 'android:name': 'android.permission.WAKE_LOCK' },
            });
        }

        return config;
    });
}

/**
 * Add showWhenLocked and turnScreenOn attributes to MainActivity
 */
function withLockScreenActivity(config) {
    return withMainActivity(config, (config) => {
        const mainActivity = config.modResults;

        // Add imports for lock screen flags
        if (!mainActivity.contents.includes('android.view.WindowManager')) {
            mainActivity.contents = mainActivity.contents.replace(
                'import android.os.Bundle',
                'import android.os.Bundle\nimport android.view.WindowManager\nimport android.os.Build'
            );

            // If there's no Bundle import, try adding at top of imports
            if (!mainActivity.contents.includes('android.view.WindowManager')) {
                mainActivity.contents = mainActivity.contents.replace(
                    'package ',
                    'package '
                );
            }
        }

        // Add onCreate override to set lock screen flags
        if (!mainActivity.contents.includes('FLAG_SHOW_WHEN_LOCKED')) {
            // Find the onCreate method and add flags after super.onCreate
            const onCreateRegex = /super\.onCreate\(.*?\)/;
            if (onCreateRegex.test(mainActivity.contents)) {
                mainActivity.contents = mainActivity.contents.replace(
                    onCreateRegex,
                    `$&

        // LocaAlert: Allow alarm screen to show over lock screen
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            )
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)`
                );
            }
        }

        return config;
    });
}

/**
 * Main plugin entry point
 */
module.exports = function withFullScreenNotification(config) {
    config = withFullScreenPermissions(config);
    config = withLockScreenActivity(config);
    return config;
};
