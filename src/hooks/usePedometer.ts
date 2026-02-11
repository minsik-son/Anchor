/**
 * usePedometer Hook
 * Manages Pedometer subscription lifecycle and AppState sync
 */

import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Pedometer } from 'expo-sensors';
import { Subscription } from 'expo-sensors/build/Pedometer';
import { useActivityStore } from '../stores/activityStore';

export function usePedometer() {
    const {
        todaySteps,
        todayDistance,
        todayCalories,
        isPedometerAvailable,
        isLoading,
        initializePedometer,
        resetDailyIfNeeded,
        loadTodayFromPedometer,
        updateTodaySteps,
    } = useActivityStore();

    const baseStepsRef = useRef(0);
    const subscriptionRef = useRef<Subscription | null>(null);

    useEffect(() => {
        let isMounted = true;

        async function setup() {
            await initializePedometer();

            const available = useActivityStore.getState().isPedometerAvailable;
            if (!available || !isMounted) return;

            resetDailyIfNeeded();
            await loadTodayFromPedometer();

            baseStepsRef.current = useActivityStore.getState().todaySteps;

            subscriptionRef.current = Pedometer.watchStepCount((result) => {
                if (!isMounted) return;
                const newTotal = baseStepsRef.current + result.steps;
                updateTodaySteps(newTotal);
            });
        }

        setup();

        const appStateListener = AppState.addEventListener('change', async (state: AppStateStatus) => {
            if (state === 'active' && isMounted) {
                const available = useActivityStore.getState().isPedometerAvailable;
                if (!available) return;

                resetDailyIfNeeded();
                await loadTodayFromPedometer();
                baseStepsRef.current = useActivityStore.getState().todaySteps;

                // Restart subscription with new base
                subscriptionRef.current?.remove();
                subscriptionRef.current = Pedometer.watchStepCount((result) => {
                    if (!isMounted) return;
                    const newTotal = baseStepsRef.current + result.steps;
                    updateTodaySteps(newTotal);
                });
            }
        });

        return () => {
            isMounted = false;
            subscriptionRef.current?.remove();
            appStateListener.remove();
        };
    }, []);

    return { todaySteps, todayDistance, todayCalories, isPedometerAvailable, isLoading };
}
