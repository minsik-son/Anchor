/**
 * LocationPickerStore
 * Transient (non-persisted) store for passing picked location back
 * from location-picker screen to favorite-place-setup screen
 */

import { create } from 'zustand';

export interface PickedLocation {
    latitude: number;
    longitude: number;
    address: string;
    radius: number;
}

interface LocationPickerStore {
    pickedLocation: PickedLocation | null;
    setPickedLocation: (location: PickedLocation) => void;
    clearPickedLocation: () => void;
}

export const useLocationPickerStore = create<LocationPickerStore>((set) => ({
    pickedLocation: null,
    setPickedLocation: (location) => set({ pickedLocation: location }),
    clearPickedLocation: () => set({ pickedLocation: null }),
}));
