/**
 * Expo Config Plugin: withCxx20
 *
 * Automatically sets CLANG_CXX_LANGUAGE_STANDARD = 'c++20' in the Podfile
 * post_install hook. This fixes C++ template/header compatibility issues
 * with folly, lottie-react-native, react-native-slider, etc.
 *
 * Survives `npx expo prebuild --clean` because it's injected via config plugin.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withCxx20(config) {
    return withDangerousMod(config, [
        'ios',
        async (config) => {
            const podfilePath = path.join(
                config.modRequest.platformProjectRoot,
                'Podfile',
            );

            let podfile = fs.readFileSync(podfilePath, 'utf8');

            // Only inject if not already present
            if (podfile.includes('CLANG_CXX_LANGUAGE_STANDARD')) {
                console.log('[withCxx20] C++20 setting already present in Podfile');
                return config;
            }

            // Find the `post_install do |installer|` block and inject
            // the C++20 snippet right before the block's closing `end`.
            //
            // Podfile structure:
            //   post_install do |installer|
            //     react_native_post_install(...)
            //     <-- INSERT HERE -->
            //   end
            // end
            const snippet = [
                '',
                '    # [withCxx20 plugin] Fix C++ compatibility for folly/lottie/slider',
                '    installer.pods_project.targets.each do |target|',
                '      target.build_configurations.each do |bc|',
                "        bc.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++20'",
                '      end',
                '    end',
            ].join('\n');

            // Match: "  end\nend" at the very end of the file (post_install's end + target's end)
            const endPattern = /(\s+end\s*\nend\s*)$/;
            if (endPattern.test(podfile)) {
                podfile = podfile.replace(endPattern, `\n${snippet}\n  end\nend\n`);
                fs.writeFileSync(podfilePath, podfile, 'utf8');
                console.log('[withCxx20] Injected C++20 setting into Podfile');
            } else {
                console.warn('[withCxx20] Could not find insertion point in Podfile');
            }

            return config;
        },
    ]);
}

module.exports = withCxx20;
