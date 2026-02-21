/**
 * Favorite Places Store
 * Manages frequently visited locations for quick access
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@locaalert:favorite_places';

export interface FavoriteSchedule {
    enabled: boolean;
    days: number[];      // 0(일)~6(토), 빈 배열이면 매일
    startTime: string;   // "HH:mm"
    endTime: string;     // "HH:mm"
}

export interface FavoritePlace {
    id: string;
    label: string; // '집', '회사', etc.
    icon: string; // ionicon name
    latitude: number;
    longitude: number;
    radius: number;
    schedule?: FavoriteSchedule;
    isActive: boolean;
}

interface FavoritePlaceStore {
    favorites: FavoritePlace[];
    isLoaded: boolean;

    // Actions
    loadFavorites: () => Promise<void>;
    addFavorite: (place: Omit<FavoritePlace, 'id'>) => Promise<void>;
    updateFavorite: (id: string, updates: Partial<Omit<FavoritePlace, 'id'>>) => Promise<void>;
    deleteFavorite: (id: string) => Promise<void>;
    toggleActive: (id: string) => Promise<void>;
}

export const useFavoritePlaceStore = create<FavoritePlaceStore>((set, get) => ({
    favorites: [],
    isLoaded: false,

    loadFavorites: async () => {
        try {
            const stored = await AsyncStorage.getItem(STORAGE_KEY);
            if (stored) {
                const raw = JSON.parse(stored);
                // 마이그레이션: isActive 없으면 true로 기본값
                const favorites = raw.map((fav: any) => ({
                    ...fav,
                    isActive: fav.isActive !== undefined ? fav.isActive : true,
                }));
                set({ favorites, isLoaded: true });
            } else {
                set({ isLoaded: true });
            }
        } catch (error) {
            console.error('[FavoritePlaceStore] Load error:', error);
            set({ isLoaded: true });
        }
    },

    addFavorite: async (place) => {
        const { favorites } = get();

        // Max 10 favorites
        if (favorites.length >= 10) {
            throw new Error('Maximum 10 favorite places allowed');
        }

        const newPlace: FavoritePlace = {
            ...place,
            id: Date.now().toString(),
            isActive: place.isActive !== undefined ? place.isActive : true,
        };

        const updated = [...favorites, newPlace];

        try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            set({ favorites: updated });
        } catch (error) {
            console.error('[FavoritePlaceStore] Add error:', error);
            throw error;
        }
    },

    updateFavorite: async (id, updates) => {
        const { favorites } = get();
        const updated = favorites.map(fav =>
            fav.id === id ? { ...fav, ...updates } : fav
        );

        try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            set({ favorites: updated });
        } catch (error) {
            console.error('[FavoritePlaceStore] Update error:', error);
            throw error;
        }
    },

    deleteFavorite: async (id) => {
        const { favorites } = get();
        const updated = favorites.filter(fav => fav.id !== id);

        try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            set({ favorites: updated });
        } catch (error) {
            console.error('[FavoritePlaceStore] Delete error:', error);
            throw error;
        }
    },

    toggleActive: async (id) => {
        const { favorites } = get();
        const updated = favorites.map(fav =>
            fav.id === id ? { ...fav, isActive: !fav.isActive } : fav
        );
        try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            set({ favorites: updated });
        } catch (error) {
            console.error('[FavoritePlaceStore] Toggle error:', error);
            throw error;
        }
    },
}));
