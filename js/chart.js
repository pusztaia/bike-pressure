// Expected outside pressure across outdoor temperatures for the same
// garage inflation, drawn as a small inline SVG.

import { convertGaugePressure, clamp, MIN_PRESSURE_PSI } from './model.js';

export const CHART_TEMPS = Array.from({ length: 51 }, (_, i) => i - 10); // -10 to 40 °C
const SVG_NS = 'http://www.w3.org/2000/svg';

let chartSvg = null;
let chartTooltip = null;
let chartState = null;

function svgEl(name, attrs, text) {
    const el = document.createElementNS(SVG_NS, name);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
    if (text !== undefined) el.textContent = text;
    return el;
}

export function initChart(svg = document.getElementById('pressureChart'), tooltip = document.getElementById('chartTooltip')) {
    chartSvg = svg;
    chartTooltip = tooltip;

    if (chartSvg) {
        chartSvg.addEventListener('pointermove', showChartTooltip, { passive: true });
        chartSvg.addEventListener('pointerdown', showChartTooltip, { passive: true });
        chartSvg.addEventListener('pointerleave', hideChartTooltip, { passive: true });
        new ResizeObserver(drawChart).observe(chartSvg);
    }
}

export function updateChart(garageFront, garageRear, garageTemp, outsideTemp, maxLim) {
    const curve = garagePSI => CHART_TEMPS.map(t => convertGaugePressure(garagePSI, garageTemp, t));
    chartState = { front: curve(garageFront), rear: curve(garageRear), outsideTemp, maxLim };
    drawChart();
}

export function drawChart() {
    const svg = chartSvg || document.getElementById('pressureChart');
    if (!chartState || !svg || !svg.clientWidth) return;
    const { front, rear, outsideTemp, maxLim } = chartState;
    const width = svg.clientWidth;
    const height = svg.clientHeight;
    const small = width < 340;
    const pad = { left: 44, right: 10, top: 10, bottom: 34 };

    const values = front.concat(rear);
    const yMin = Math.floor(Math.min(MIN_PRESSURE_PSI, ...values) / 10) * 10;
    const yMax = Math.ceil(Math.max(maxLim + 10, ...values) / 10) * 10;
    const tMin = CHART_TEMPS[0];
    const tMax = CHART_TEMPS[CHART_TEMPS.length - 1];
    const x = t => pad.left + (t - tMin) / (tMax - tMin) * (width - pad.left - pad.right);
    const y = p => pad.top + (yMax - p) / (yMax - yMin) * (height - pad.top - pad.bottom);

    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.replaceChildren();

    const yStep = (yMax - yMin) / 10 > (small ? 4 : 6) ? 20 : 10;
    for (let p = yMin; p <= yMax; p += yStep) {
        svg.append(svgEl('line', { class: 'chart-grid', x1: pad.left, x2: width - pad.right, y1: y(p), y2: y(p) }));
        svg.append(svgEl('text', { class: 'chart-tick', x: pad.left - 6, y: y(p) + 3, 'text-anchor': 'end' }, p));
    }
    const tStep = small ? 20 : 10;
    for (let t = tMin; t <= tMax; t += tStep) {
        svg.append(svgEl('line', { class: 'chart-grid', x1: x(t), x2: x(t), y1: pad.top, y2: height - pad.bottom }));
        svg.append(svgEl('text', { class: 'chart-tick', x: x(t), y: height - pad.bottom + 13, 'text-anchor': 'middle' }, t));
    }
    svg.append(svgEl('text', { class: 'chart-title', x: (pad.left + width - pad.right) / 2, y: height - 4, 'text-anchor': 'middle' }, 'Outside temperature (°C)'));
    svg.append(svgEl('text', { class: 'chart-title', transform: `translate(11 ${(pad.top + height - pad.bottom) / 2}) rotate(-90)`, 'text-anchor': 'middle' }, 'Expected outside pressure (PSI)'));

    if (outsideTemp >= tMin && outsideTemp <= tMax) {
        svg.append(svgEl('line', { class: 'chart-now', x1: x(outsideTemp), x2: x(outsideTemp), y1: pad.top, y2: height - pad.bottom }));
    }

    const points = data => data.map((p, i) => `${x(CHART_TEMPS[i]).toFixed(1)},${y(p).toFixed(1)}`).join(' ');
    svg.append(svgEl('polyline', { class: 'chart-line front', points: points(front) }));
    svg.append(svgEl('polyline', { class: 'chart-line rear', points: points(rear) }));

    const cursor = svgEl('line', { class: 'chart-cursor', y1: pad.top, y2: height - pad.bottom, visibility: 'hidden' });
    svg.append(cursor);
    chartState.hover = { x, cursor, pad, width };
}

// Tooltip: nearest temperature under the finger/pointer.
export function showChartTooltip(event) {
    if (!chartState?.hover) return;
    const svg = chartSvg || document.getElementById('pressureChart');
    const tooltip = chartTooltip || document.getElementById('chartTooltip');
    const { x, cursor, pad, width } = chartState.hover;
    const px = event.clientX - svg.getBoundingClientRect().left;
    const tMin = CHART_TEMPS[0];
    const tMax = CHART_TEMPS[CHART_TEMPS.length - 1];
    const t = Math.round(tMin + clamp((px - pad.left) / (width - pad.left - pad.right), 0, 1) * (tMax - tMin));
    const i = t - tMin;

    cursor.setAttribute('x1', x(t));
    cursor.setAttribute('x2', x(t));
    cursor.setAttribute('visibility', 'visible');
    tooltip.innerHTML = `<strong>${t} °C</strong><br>Front ${chartState.front[i].toFixed(1)} PSI<br>Rear ${chartState.rear[i].toFixed(1)} PSI`;
    tooltip.hidden = false;
    // Keep the tooltip beside the cursor, flipping left near the right edge.
    const fitsRight = x(t) + 10 + tooltip.offsetWidth <= width;
    tooltip.style.left = (fitsRight ? x(t) + 10 : x(t) - 10 - tooltip.offsetWidth) + 'px';
}

export function hideChartTooltip() {
    const tooltip = chartTooltip || document.getElementById('chartTooltip');
    if (tooltip) tooltip.hidden = true;
    chartState?.hover?.cursor.setAttribute('visibility', 'hidden');
}
