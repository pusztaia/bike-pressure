// Pressure model: data and pure calculations, no DOM access.

// Tire models limited to specific widths; unlisted models allow every width.
export const tireWidths = {
    cadex_race: [28, 30],
    cadex_classics: [28, 30]
};

export const tireMaxPressure = {
    cadex_race: 95, cadex_classics: 95, giant_gavia_course: 105, giant_gavia_fondo: 105, giant_gavia_ac: 105,
    conti_gp5000str: 109, conti_gp5000astr: 109, schwalbe_proone: 95, schwalbe_one: 95,
    pirelli_pzero: 101, pirelli_pzero_rs: 101, pirelli_cinturato: 87, vittoria_corsapro: 95, vittoria_next: 95,
    michelin_power: 95, goodyear_eagle: 95, panaracer_agilest: 95, panaracer_gravelking_slick: 75
};

export const DEFAULT_TIRE_MAX_PSI = 95;

export const bikes = {
    'bmc_ac01': {
        name: 'BMC Alpenchallenge 01 THREE',
        weight: 9.6,
        defaultWheel: 'dtc1800',
        distroProfile: 'fitness',
        defaultTire: 'panaracer_gravelking_slick',
        defaultTireWidth: 32,
        frameSize: 'L',
        tireSetup: 'Tubeless'
    },
    'tcr2025': {
        name: 'Giant TCR Adv 0 Di2 2025',
        weight: 7.6,
        defaultWheel: 'slr0',
        distroProfile: 'road_race',
        defaultTire: 'cadex_race',
        defaultTireWidth: 28,
        frameSize: 'L',
        tireSetup: 'Tubeless'
    },
    'tcr2022': {
        name: 'TCR Advanced 2022',
        weight: 8.4,
        defaultWheel: 'dtswiss',
        distroProfile: 'road_race',
        defaultTire: 'giant_gavia_course',
        defaultTireWidth: 28,
        frameSize: 'L',
        tireSetup: 'Tubeless'
    }
};

// ETRTO maximum for hookless rims: 5 bar.
export const HOOKLESS_MAX_PSI = 73;

export const wheelsets = {
    'dtc1800': { type: 'hooked', limit: 110, name: 'Hooked Rim', w: 22 },
    'slr0': { type: 'hookless', limit: HOOKLESS_MAX_PSI, name: 'Hookless', w: 22.4 },
    'dtswiss': { type: 'hooked', limit: 110, name: 'Hooked Rim', w: 18.0 }
};

// Front share of front+rear pressure, so 0.5 means equal.
export const weightDistributionRatios = {
    'road_race': 0.47,
    'fitness': 0.46
};

export const ATMOSPHERIC_PSI = 14.7;
export const PSI_PER_BAR = 14.5038;
export const MIN_PRESSURE_PSI = 30;

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const toKelvin = celsius => celsius + 273.15;

// Ideal gas law on absolute pressure; pumps show gauge pressure.
export function convertGaugePressure(gaugePSI, fromCelsius, toCelsius) {
    return (gaugePSI + ATMOSPHERIC_PSI) * (toKelvin(toCelsius) / toKelvin(fromCelsius)) - ATMOSPHERIC_PSI;
}

// Surface slider: 1 smooth, 2 mixed, 3 wet, 4 rough.
export function surfaceAdjustment(level) {
    return { 1: 0, 2: -2, 3: -3, 4: -4 }[level] ?? 0;
}

// Preference slider: -1 comfort ... +1 speed.
export function preferenceAdjustment(preference) {
    return preference < 0 ? preference * 4 : preference * 2;
}

// Average (front/rear) pressure, calibrated against Giant's hookless
// calculator (giant-bicycles.com/global/tire-pressure, queried 2026-10).
// Reference: 28c on 22.4 mm inner rim, 78 kg rider ≈ 89 kg system -> 61 PSI.
// Giant takes rider weight only; we use system weight with the offset above.
export function averagePressure({ totalWeight, rimWidth, tireWidth, surface, preference }) {
    let avgPSI = 61;

    // Giant: ~56 PSI at 60 kg, ~66 PSI at 100 kg -> 0.25 PSI per kg.
    avgPSI += (totalWeight - 89) * 0.25;

    // Giant: wider rims need less pressure, more so above 22.4 mm.
    const rimDiff = rimWidth - 22.4;
    avgPSI -= rimDiff * (rimDiff < 0 ? 1.33 : 2.3);

    const tireWidthOffset = { 25: 18, 28: 0, 30: -5, 32: -10 };
    avgPSI += tireWidthOffset[tireWidth] ?? 0;

    avgPSI += surfaceAdjustment(surface);
    avgPSI += preferenceAdjustment(preference);
    return avgPSI;
}

// First calculates the desired OUTSIDE pressure from the bike setup,
// then works backwards to the GARAGE pump value. If the garage value has
// to be capped for safety, `outside` is the safe achievable pressure.
export function computePressure(input) {
    const totalWeight = input.riderWeight + input.bikeWeight + input.gearWeight
        + input.bottleCount * input.bottleWeight;
    const avgPSI = averagePressure({ ...input, totalWeight });

    const wheel = wheelsets[input.wheel];
    const tireMax = tireMaxPressure[input.tireType] ?? DEFAULT_TIRE_MAX_PSI;
    const safeMax = Math.min(wheel.limit, tireMax);

    const wheelResult = share => {
        const target = clamp(2 * avgPSI * share, MIN_PRESSURE_PSI, safeMax);
        const requiredGarage = convertGaugePressure(target, input.outsideTemp, input.garageTemp);
        const garage = clamp(requiredGarage, MIN_PRESSURE_PSI, safeMax);
        const outside = clamp(convertGaugePressure(garage, input.garageTemp, input.outsideTemp), MIN_PRESSURE_PSI, safeMax);
        const hitLimit = requiredGarage > safeMax || target >= safeMax - 0.5;
        return { target, garage, outside, hitLimit };
    };

    return {
        totalWeight,
        safeMax,
        tireMaxKnown: input.tireType in tireMaxPressure,
        front: wheelResult(input.frontRatio),
        rear: wheelResult(1 - input.frontRatio)
    };
}

const PressureModel = {
    tireWidths,
    tireMaxPressure,
    DEFAULT_TIRE_MAX_PSI,
    bikes,
    HOOKLESS_MAX_PSI,
    wheelsets,
    weightDistributionRatios,
    ATMOSPHERIC_PSI,
    PSI_PER_BAR,
    MIN_PRESSURE_PSI,
    clamp,
    toKelvin,
    convertGaugePressure,
    surfaceAdjustment,
    preferenceAdjustment,
    averagePressure,
    computePressure
};

if (typeof window !== 'undefined') {
    window.PressureModel = PressureModel;
}

export default PressureModel;
