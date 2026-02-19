/**
 * Network Status Hook
 * Monitors internet connectivity for offline mode handling.
 */

import { useState, useEffect } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export function useNetworkStatus() {
    const [isConnected, setIsConnected] = useState(true);
    const [connectionType, setConnectionType] = useState<string | null>(null);

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
            setIsConnected(state.isConnected ?? true);
            setConnectionType(state.type ?? null);
        });
        return unsubscribe;
    }, []);

    return { isConnected, connectionType };
}
