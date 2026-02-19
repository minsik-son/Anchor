import { formatDistance, formatRadius, formatSpeed, getRadiusLabels } from '../src/utils/distanceFormatter';

describe('formatDistance', () => {
    describe('metric units', () => {
        test('null 값은 "--" 반환', () => {
            expect(formatDistance(null, 'metric')).toBe('--');
        });

        test('1km 미만은 m 단위', () => {
            expect(formatDistance(500, 'metric')).toBe('500m');
            expect(formatDistance(999, 'metric')).toBe('999m');
        });

        test('1km 이상은 km 단위', () => {
            expect(formatDistance(1000, 'metric')).toBe('1.0km');
            expect(formatDistance(2500, 'metric')).toBe('2.5km');
            expect(formatDistance(10000, 'metric')).toBe('10.0km');
        });

        test('소수점 1자리로 표시', () => {
            expect(formatDistance(1550, 'metric')).toBe('1.6km');
            expect(formatDistance(1549, 'metric')).toBe('1.5km');
        });
    });

    describe('imperial units', () => {
        test('1마일 미만은 ft 단위', () => {
            expect(formatDistance(500, 'imperial')).toMatch(/\d+ft/);
            expect(formatDistance(1000, 'imperial')).toMatch(/\d+ft/);
        });

        test('1마일 이상은 mi 단위', () => {
            expect(formatDistance(1609, 'imperial')).toMatch(/\d+\.\d+mi/);
            expect(formatDistance(3218, 'imperial')).toMatch(/\d+\.\d+mi/);
        });
    });

    describe('showUnit 옵션', () => {
        test('showUnit false일 때 단위 미포함', () => {
            const result = formatDistance(500, 'metric', { showUnit: false });
            expect(result).toBe('500');
            expect(result).not.toMatch(/m|km/);
        });

        test('showUnit true일 때 단위 포함 (기본값)', () => {
            const result = formatDistance(500, 'metric', { showUnit: true });
            expect(result).toMatch(/m|km/);
        });
    });

    describe('decimals 옵션', () => {
        test('decimals 2일 때 소수점 2자리', () => {
            const result = formatDistance(1234, 'metric', { decimals: 2 });
            expect(result).toBe('1.23km');
        });

        test('decimals 0일 때 정수만 표시', () => {
            const result = formatDistance(1234, 'metric', { decimals: 0 });
            expect(result).toBe('1km');
        });
    });
});

describe('formatRadius', () => {
    test('metric 단위로 포맷팅', () => {
        const result = formatRadius(500, 'metric');
        expect(result).toBe('500m');
        expect(result).toMatch(/m/);
    });

    test('imperial 단위로 포맷팅', () => {
        const result = formatRadius(500, 'imperial');
        expect(result).toMatch(/ft|mi/);
    });
});

describe('formatSpeed', () => {
    test('null 값 처리', () => {
        const result = formatSpeed(null, 'metric');
        expect(result.value).toBe('--');
        expect(result.unit).toBe('km/h');
    });

    test('음수 값 처리', () => {
        const result = formatSpeed(-5, 'metric');
        expect(result.value).toBe('--');
        expect(result.unit).toBe('km/h');
    });

    test('metric 단위 (km/h)', () => {
        const result = formatSpeed(50, 'metric');
        expect(result.value).toBe('50');
        expect(result.unit).toBe('km/h');
    });

    test('imperial 단위 (mph)', () => {
        const result = formatSpeed(80, 'imperial');
        expect(result.value).toBe('50');
        expect(result.unit).toBe('mph');
    });

    test('반올림 처리', () => {
        const result = formatSpeed(50.7, 'metric');
        expect(result.value).toBe('51');
    });
});

describe('getRadiusLabels', () => {
    test('metric 라벨', () => {
        const labels = getRadiusLabels('metric');
        expect(labels.min).toBe('50m');
        expect(labels.max).toBe('1km');
    });

    test('imperial 라벨', () => {
        const labels = getRadiusLabels('imperial');
        expect(labels.min).toBe('164ft');
        expect(labels.max).toBe('0.6mi');
    });
});
