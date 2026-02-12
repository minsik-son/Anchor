import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type DistanceUnit = 'metric' | 'imperial';

interface UnitState {
    distanceUnit: DistanceUnit;
    setDistanceUnit: (unit: DistanceUnit) => void;
}

export const useUnitStore = create<UnitState>()(
    persist(
        (set) => ({
            distanceUnit: 'metric',
            setDistanceUnit: (unit) => set({ distanceUnit: unit }),
        }),
        {
            name: 'unit-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
