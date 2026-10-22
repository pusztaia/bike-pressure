import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from './js/model.js';

function baseInput(overrides = {}) {
    return {
        riderWeight: 78,
        bikeWeight: 11,
        gearWeight: 0,
        bottleCount: 0,
        bottleWeight: 0,
        outsideTemp: 20,
        garageTemp: 20,
        tireType: 'conti_gp5000str',
        tireWidth: 28,
        wheel: 'dtc1800',
        rimWidth: 22.4,
        surface: 1,
        preference: 0,
        frontRatio: 0.5,
        ...overrides
    };
}

function assertNear(actual, expected, tolerance, message) {
    const diff = Math.abs(actual - expected);
    assert.ok(
        diff <= tolerance,
        `${message ? message + ': ' : ''}got ${Number(actual).toFixed(2)}, expected ${expected} ±${tolerance} (diff: ${diff.toFixed(4)})`
    );
}

test('Giant hookless calibration reference points', () => {
    const giant = [
        [25, 19.4, 83], [25, 22.4, 79], [28, 19.4, 65], [28, 22.4, 61], [28, 25, 53],
        [30, 22.4, 56], [30, 25, 50], [32, 19.4, 55], [32, 22.4, 51], [32, 25, 47]
    ];
    giant.forEach(([tireWidth, rimWidth, psi]) => {
        const r = M.computePressure(baseInput({ tireWidth, rimWidth }));
        assertNear(r.front.outside, psi, 2.05, `Giant ${tireWidth}c / ${rimWidth} mm`);
    });
});

test('Giant rider weight scaling', () => {
    const riders = [[60, 56], [100, 66], [110, 68]];
    riders.forEach(([rider, psi]) => {
        const r = M.computePressure(baseInput({ riderWeight: rider }));
        assertNear(r.front.outside, psi, 1.5, `Giant 28c / 22.4 mm, ${rider} kg rider`);
    });
});

test('Temperature correction (absolute pressure ideal gas law)', () => {
    const warm = M.computePressure(baseInput({ garageTemp: 24, outsideTemp: 15 }));
    const expectedGarage = (61 + 14.7) * (297.15 / 288.15) - 14.7;
    assertNear(warm.front.garage, expectedGarage, 0.6, 'Garage 24 °C -> outside 15 °C needs more pressure');
    assertNear(warm.front.outside, warm.front.target, 0.01, 'Pumped garage pressure cools to outside target');

    const zero = M.computePressure(baseInput({ garageTemp: 24, outsideTemp: 0 }));
    assert.ok(zero.front.garage > warm.front.garage + 1, '0 °C outside is not treated as missing');

    const same = M.computePressure(baseInput());
    assertNear(same.front.garage, same.front.outside, 0.01, 'Equal temperatures: garage equals outside');
});

test('Weight distribution split', () => {
    const split = M.computePressure(baseInput({ frontRatio: 0.47 }));
    const totalTarget = split.front.target + split.rear.target;
    assertNear(split.front.target / totalTarget, 0.47, 0.001, 'Front ratio 0.47 splits 47/53');
});

test('Safety limits and clamping', () => {
    const heavy = M.computePressure(baseInput({
        riderWeight: 140,
        wheel: 'slr0',
        tireType: 'cadex_race',
        garageTemp: 24,
        outsideTemp: 5
    }));
    assert.ok(heavy.rear.garage <= M.HOOKLESS_MAX_PSI + 1e-9, `Hookless caps garage pressure at ${M.HOOKLESS_MAX_PSI} PSI`);
    assert.equal(heavy.rear.hitLimit, true, 'Hookless cap is flagged');
    assert.equal(heavy.safeMax, 73, 'Safe max is min(rim, tire)');

    const gravel = M.computePressure(baseInput({ tireType: 'panaracer_gravelking_slick', riderWeight: 140 }));
    assert.equal(gravel.safeMax, 75, 'Safe max respects tire rating 75');
    assert.ok(gravel.rear.garage <= 75, 'Tire rated max caps hooked rim');

    const light = M.computePressure(baseInput({ riderWeight: 40, tireWidth: 32, rimWidth: 30, surface: 4, preference: -1 }));
    assert.ok(light.front.outside >= M.MIN_PRESSURE_PSI, `Pressure never drops below ${M.MIN_PRESSURE_PSI} PSI`);

    assert.equal(M.computePressure(baseInput({ tireType: 'nope' })).tireMaxKnown, false, 'Unknown tire is reported');
});
