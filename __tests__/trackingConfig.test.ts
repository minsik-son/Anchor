import { calculateDynamicCooldown, shouldEnterActiveTracking, determinePhase } from '../src/services/location/phaseCalculator';

describe('calculateDynamicCooldown', () => {
    test('가까운 거리(2km) + 빠른 속도(80km/h)일 때 짧은 쿨다운', () => {
        const cooldown = calculateDynamicCooldown(2000, 80);
        expect(cooldown).toBeGreaterThanOrEqual(10_000);
        expect(cooldown).toBeLessThanOrEqual(30_000);
    });

    test('먼 거리(60km)일 때 장거리 쿨다운 적용', () => {
        const cooldown = calculateDynamicCooldown(60_000, 30);
        expect(cooldown).toBeLessThanOrEqual(300_000);
    });

    test('정지 상태(0km/h)에서 최소 속도 가정 적용', () => {
        const cooldown = calculateDynamicCooldown(3000, 0);
        expect(cooldown).toBeGreaterThan(0);
        expect(cooldown).toBeGreaterThanOrEqual(10_000);
    });

    test('고속(100km/h)일 때 멀티플라이어 적용', () => {
        const normalCooldown = calculateDynamicCooldown(5000, 60);
        const highSpeedCooldown = calculateDynamicCooldown(5000, 100);
        expect(highSpeedCooldown).toBeLessThan(normalCooldown);
    });

    test('최소 쿨다운 보장', () => {
        const cooldown = calculateDynamicCooldown(100, 100);
        expect(cooldown).toBeGreaterThanOrEqual(10_000);
    });
});

describe('shouldEnterActiveTracking', () => {
    test('1.5km 미만이면 true', () => {
        expect(shouldEnterActiveTracking(1000, 30)).toBe(true);
        expect(shouldEnterActiveTracking(1499, 0)).toBe(true);
    });

    test('1.5km 이상이면 ETA에 따라 결정', () => {
        expect(shouldEnterActiveTracking(1500, 0)).toBe(false);
        expect(shouldEnterActiveTracking(5000, 10)).toBe(false);
    });

    test('ETA 3분 미만이면 거리 무관 true', () => {
        // 4km at 120km/h → ETA ≈ 2min
        expect(shouldEnterActiveTracking(4000, 120)).toBe(true);
    });
});

describe('determinePhase', () => {
    test('5km 이상이면 GEOFENCING', () => {
        expect(determinePhase(6000, 0, 'IDLE')).toBe('GEOFENCING');
    });

    test('1.5km ~ 5km이면 ADAPTIVE_POLLING', () => {
        expect(determinePhase(3000, 30, 'GEOFENCING')).toBe('ADAPTIVE_POLLING');
    });

    test('1.5km 미만이면 ACTIVE_TRACKING', () => {
        expect(determinePhase(1000, 30, 'ADAPTIVE_POLLING')).toBe('ACTIVE_TRACKING');
    });

    test('ACTIVE_TRACKING에서 2km 이하면 유지 (히스테리시스)', () => {
        expect(determinePhase(1800, 30, 'ACTIVE_TRACKING')).toBe('ACTIVE_TRACKING');
    });

    test('ACTIVE_TRACKING에서 2km 초과하면 ADAPTIVE_POLLING 전환', () => {
        expect(determinePhase(2500, 30, 'ACTIVE_TRACKING')).toBe('ADAPTIVE_POLLING');
    });

    test('ETA 3분 미만이면 거리 상관없이 ACTIVE_TRACKING', () => {
        expect(determinePhase(4000, 120, 'ADAPTIVE_POLLING')).toBe('ACTIVE_TRACKING');
    });

    test('ADAPTIVE_POLLING에서 geofence 실패 시 GEOFENCING으로 안 감', () => {
        expect(determinePhase(7000, 30, 'ADAPTIVE_POLLING', true)).toBe('ADAPTIVE_POLLING');
    });

    test('ADAPTIVE_POLLING에서 6km 초과하면 GEOFENCING', () => {
        expect(determinePhase(7000, 30, 'ADAPTIVE_POLLING', false)).toBe('GEOFENCING');
    });
});
