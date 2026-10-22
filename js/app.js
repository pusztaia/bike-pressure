// UI: reads the form, renders results and the chart.

import {
    bikes,
    wheelsets,
    tireWidths,
    weightDistributionRatios,
    HOOKLESS_MAX_PSI,
    PSI_PER_BAR,
    clamp,
    computePressure
} from './model.js';

import { initChart, updateChart } from './chart.js';

// iOS keyboards in comma-decimal locales (e.g. Hungarian) only offer ",".
// Accept both separators when reading decimal input fields.
export function toFloat(value) {
    return parseFloat(String(value).replace(',', '.'));
}

// Reads a numeric field, clamped to its min/max attributes (type="text"
// ignores them natively). Empty/invalid input falls back to the field's
// HTML default. Out-of-range or invalid values are highlighted.
export function readNumber(id) {
    const el = document.getElementById(id);
    if (!el) return 0;
    const fallback = toFloat(el.defaultValue);
    const raw = toFloat(el.value);
    const min = el.hasAttribute('min') ? Number(el.min) : -Infinity;
    const max = el.hasAttribute('max') ? Number(el.max) : Infinity;
    const valid = Number.isFinite(raw) && raw >= min && raw <= max;
    el.classList.toggle('input-invalid', el.value.trim() !== '' && !valid);
    if (!Number.isFinite(raw)) return fallback;
    return clamp(raw, min, max);
}

export function readFrontRatio() {
    const profile = document.getElementById('weightDistroProfile').value;
    return profile === 'manual' ? readNumber('customFRatio') / 100 : weightDistributionRatios[profile];
}

export function readInputs() {
    return {
        riderWeight: readNumber('riderWeight'),
        bikeWeight: readNumber('bikeWeight'),
        gearWeight: readNumber('gearWeight'),
        bottleCount: readNumber('bottleCount'),
        bottleWeight: readNumber('bottleWeight'),
        outsideTemp: readNumber('ambientTemp'),
        garageTemp: readNumber('inflationTemp'),
        tireType: document.getElementById('tireType').value,
        tireWidth: parseInt(document.getElementById('tireWidth').value),
        wheel: document.getElementById('wheelSelect').value,
        rimWidth: readNumber('rimWidth'),
        surface: parseInt(document.getElementById('surfaceSlider').value),
        preference: parseFloat(document.getElementById('ridePreference').value),
        frontRatio: readFrontRatio()
    };
}

export function updateWeightDistro() {
    const manual = document.getElementById('weightDistroProfile').value === 'manual';
    document.getElementById('customFRatioWrapper').style.display = manual ? 'block' : 'none';
    calculatePressure();
}

export function updateBike() {
    const bikeKey = document.getElementById('bikeSelect').value;
    const bikeData = bikes[bikeKey];
    if (!bikeData) return;
    document.getElementById('bikeWeight').value = bikeData.weight;
    document.getElementById('bikeTitle').textContent = bikeData.name;
    document.getElementById('frameBadge').textContent = ' Size ' + bikeData.frameSize;
    document.getElementById('setupBadge').textContent = ' ' + bikeData.tireSetup;
    document.getElementById('wheelSelect').value = bikeData.defaultWheel;
    document.getElementById('weightDistroProfile').value = bikeData.distroProfile;
    document.getElementById('tireType').value = bikeData.defaultTire;
    document.getElementById('tireWidth').value = String(bikeData.defaultTireWidth);
    updateTireWidths();
    updateWheel();
}

// Only offer the widths the selected tire model is made in.
export function updateTireWidths() {
    const allowed = tireWidths[document.getElementById('tireType').value];
    const widthSelect = document.getElementById('tireWidth');
    Array.from(widthSelect.options).forEach(option => {
        const ok = !allowed || allowed.includes(Number(option.value));
        option.disabled = !ok;
        option.hidden = !ok;
    });
    if (widthSelect.selectedOptions[0]?.disabled) {
        widthSelect.value = String(allowed.includes(28) ? 28 : allowed[0]);
    }
}

export function updateWheel() {
    const wheelKey = document.getElementById('wheelSelect').value;
    const wData = wheelsets[wheelKey];
    if (!wData) return;
    const badge = document.getElementById('rimBadge');
    const box = document.getElementById('safetyBox');
    const header = document.getElementById('warningHeader');
    const list = document.getElementById('warningList');

    document.getElementById('rimWidth').value = wData.w;

    if (wData.type === 'hookless') {
        badge.innerHTML = ' Hookless';
        badge.className = 'badge danger-tech';
        document.getElementById('safetyLabelName').textContent = "Hookless Limit";
        document.getElementById('safetyLabelVal').textContent = `MAX ${wData.limit} PSI`;
        document.getElementById('safetyLabelVal').style.color = "#ff0080";
        box.className = "warning-box";
        header.innerHTML = ' Safety Protocols (Strict)';
        list.innerHTML = `<li><strong>ETRTO:</strong> Never exceed ${wData.limit} PSI (${(wData.limit / PSI_PER_BAR).toFixed(1)} bar) on hookless rims.</li><li><strong>Check:</strong> Ensure tire is "Hookless Certified".</li>`;
    } else {
        badge.innerHTML = ' Hooked Rim';
        badge.className = 'badge safe-tech';
        document.getElementById('safetyLabelName').textContent = "Rim Max Limit";
        document.getElementById('safetyLabelVal').textContent = "High Pressure OK";
        document.getElementById('safetyLabelVal').style.color = "#00ff9d";
        box.className = "warning-box safe-mode";
        header.innerHTML = ' Tubeless Protocols';
        list.innerHTML = `<li><strong>Hooked Rim:</strong> ${HOOKLESS_MAX_PSI} PSI hookless limit does NOT apply here.</li><li><strong>Tubeless:</strong> Lower pressure is still recommended.</li>`;
    }
    updateWeightDistro();
}

let calcFrame = null;
export function calculatePressure() {
    if (calcFrame) cancelAnimationFrame(calcFrame);
    calcFrame = requestAnimationFrame(runPressureCalculation);
}

export function runPressureCalculation() {
    const input = readInputs();
    const result = computePressure(input);
    const round1 = value => Math.round(value * 10) / 10;
    const formatSigned = value => (value > 0 ? '+' : '') + value.toFixed(1);
    const deltas = {};

    [['Front', result.front], ['Rear', result.rear]].forEach(([side, wheel]) => {
        const outside = round1(wheel.outside);
        const garage = round1(wheel.garage);
        const outsideElem = document.getElementById(side.toLowerCase() + 'PSI');
        outsideElem.textContent = outside.toFixed(1);
        outsideElem.classList.toggle('limit-warning', wheel.hitLimit);
        document.getElementById(side.toLowerCase() + 'Bar').textContent = 'PSI / ' + (outside / PSI_PER_BAR).toFixed(2) + ' bar';
        document.getElementById('inflation' + side + 'PSI').textContent = garage.toFixed(1);
        document.getElementById('inflation' + side + 'Bar').textContent = 'PSI / ' + (garage / PSI_PER_BAR).toFixed(2) + ' bar';
        deltas[side] = garage - outside;
    });

    document.getElementById('temperatureDeltaNote').innerHTML = '<strong>Garage</strong>: this is what the pump should show. <strong>Outside goal</strong>: this is the expected outdoor pressure. Temperature correction: front ' + formatSigned(deltas.Front) + ' PSI, rear ' + formatSigned(deltas.Rear) + ' PSI.';
    document.getElementById('totalWeight').textContent = result.totalWeight.toFixed(1) + ' kg';
    document.getElementById('utilization').textContent = Math.round((Math.max(result.front.outside, result.rear.outside) / result.safeMax) * 100) + '%';

    updateChart(result.front.garage, result.rear.garage, input.garageTemp, input.outsideTemp, result.safeMax);
}

// Restores every field to its HTML default, then reapplies the default bike.
export function resetForm() {
    document.querySelectorAll('.container input').forEach(el => {
        el.value = el.defaultValue;
        el.classList.remove('input-invalid');
    });
    document.getElementById('bikeSelect').value = 'tcr2025';
    updateBike();
}

export function initApp() {
    const inputs = ['riderWeight', 'bikeWeight', 'gearWeight', 'bottleCount', 'bottleWeight', 'surfaceSlider', 'ridePreference', 'ambientTemp', 'inflationTemp', 'tireType', 'tireWidth', 'rimWidth', 'customFRatio'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', calculatePressure, { passive: true });
            el.addEventListener('change', calculatePressure, { passive: true });
        }
    });

    document.getElementById('bikeSelect')?.addEventListener('change', updateBike);
    document.getElementById('wheelSelect')?.addEventListener('change', updateWheel);
    document.getElementById('weightDistroProfile')?.addEventListener('change', updateWeightDistro);
    document.getElementById('tireType')?.addEventListener('change', updateTireWidths, { passive: true });
    document.getElementById('resetButton')?.addEventListener('click', resetForm);

    // Normalize "," to "." in the field itself once the user leaves it.
    document.querySelectorAll('input[inputmode="decimal"]').forEach(el => {
        el.addEventListener('blur', () => {
            if (el.value.includes(',')) el.value = el.value.replace(',', '.');
        });
    });

    initChart();
    updateBike();
}

// Expose on window for tests / backwards compatibility
if (typeof window !== 'undefined') {
    window.runPressureCalculation = runPressureCalculation;
    window.calculatePressure = calculatePressure;
    window.updateBike = updateBike;
    window.updateWheel = updateWheel;
    window.resetForm = resetForm;
}

// Auto-run if loaded in document
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }
}
