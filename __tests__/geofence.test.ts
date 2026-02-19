import { calculateDistance, isWithinRadius, formatDistance, calculateBearing } from '../src/services/location/geofence';

// Mock i18n to avoid initialization issues in tests
jest.mock('../src/i18n', () => ({
    t: (key: string) => key,
    language: 'ko',
}));

jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'ko' } }),
}));

// Mock i18next for geofence.ts which imports i18n directly
jest.mock('i18next', () => ({
    t: (key: string) => key,
    language: 'ko',
    changeLanguage: jest.fn(),
    use: jest.fn().mockReturnThis(),
    init: jest.fn(),
}));

describe('calculateDistance (Haversine)', () => {
    test('같은 좌표면 거리 0', () => {
        const d = calculateDistance(
            { latitude: 37.5665, longitude: 126.9780 },
            { latitude: 37.5665, longitude: 126.9780 }
        );
        expect(d).toBe(0);
    });

    test('서울시청 → 강남역 약 8.9km', () => {
        const d = calculateDistance(
            { latitude: 37.5665, longitude: 126.9780 },
            { latitude: 37.4979, longitude: 127.0276 }
        );
        expect(d).toBeGreaterThan(8000);
        expect(d).toBeLessThan(10000);
    });

    test('서울 → 부산 약 325km', () => {
        const d = calculateDistance(
            { latitude: 37.5665, longitude: 126.9780 },
            { latitude: 35.1796, longitude: 129.0756 }
        );
        expect(d).toBeGreaterThan(300_000);
        expect(d).toBeLessThan(350_000);
    });

    test('적도 위 경도 1도 약 111km', () => {
        const d = calculateDistance(
            { latitude: 0, longitude: 0 },
            { latitude: 0, longitude: 1 }
        );
        expect(d).toBeGreaterThan(110_000);
        expect(d).toBeLessThan(112_000);
    });
});

describe('isWithinRadius', () => {
    test('반경 500m 내에 있으면 true', () => {
        // 약 44m 거리
        expect(isWithinRadius(
            { latitude: 37.5665, longitude: 126.9780 },
            { latitude: 37.5665, longitude: 126.9785 },
            500
        )).toBe(true);
    });

    test('반경 500m 밖이면 false', () => {
        // 강남역 → 서울시청 약 8.9km
        expect(isWithinRadius(
            { latitude: 37.5665, longitude: 126.9780 },
            { latitude: 37.4979, longitude: 127.0276 },
            500
        )).toBe(false);
    });

    test('반경 경계선 정확하게', () => {
        const from = { latitude: 37.5665, longitude: 126.9780 };
        const to = { latitude: 37.5665, longitude: 126.9780 };
        expect(isWithinRadius(from, to, 0)).toBe(true); // distance is 0
    });
});

describe('formatDistance', () => {
    test('1km 미만은 m 단위', () => {
        expect(formatDistance(500)).toBe('500m');
        expect(formatDistance(999)).toBe('999m');
    });

    test('1km 이상은 km 단위', () => {
        expect(formatDistance(1000)).toBe('1.0km');
        expect(formatDistance(2500)).toBe('2.5km');
        expect(formatDistance(10000)).toBe('10.0km');
    });

    test('소수점 반올림', () => {
        expect(formatDistance(350)).toBe('350m');
        expect(formatDistance(1550)).toBe('1.6km');
    });
});

describe('calculateBearing', () => {
    test('같은 좌표면 0도', () => {
        const b = calculateBearing(
            { latitude: 37.5665, longitude: 126.9780 },
            { latitude: 37.5665, longitude: 126.9780 }
        );
        expect(b).toBe(0);
    });

    test('정북쪽 약 0도', () => {
        const b = calculateBearing(
            { latitude: 37.0, longitude: 127.0 },
            { latitude: 38.0, longitude: 127.0 }
        );
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThan(5);
    });

    test('정동쪽 약 90도', () => {
        const b = calculateBearing(
            { latitude: 37.0, longitude: 126.0 },
            { latitude: 37.0, longitude: 127.0 }
        );
        expect(b).toBeGreaterThan(85);
        expect(b).toBeLessThan(95);
    });
});
