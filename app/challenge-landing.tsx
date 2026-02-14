/**
 * Challenge Landing Redirect
 * Redirects to the challenge tab for backward compatibility
 */

import { Redirect } from 'expo-router';

export default function ChallengeLanding() {
    return <Redirect href="/(tabs)/challenge" />;
}
