# Bicycle Tire Pressure Calculator

A single-file, mobile-first bicycle tire pressure calculator designed for iPhone use. The calculator answers one practical question:

**How much should I pump the tires in the garage so that the pressure is correct outside at the riding temperature?**

## Main Purpose

A floor pump shows gauge pressure: the pressure relative to atmospheric pressure. The tire, however, may be pumped in a warmer or colder garage and then ridden outside at a different temperature.

For that reason, the calculator first estimates the desired **outside goal** pressure, then converts that target into the required **pump garage** pressure.

Temperature correction is calculated using absolute pressure:

```js
garagePSI = (outsideTargetPSI + 14.7) * (garageKelvin / outsideKelvin) - 14.7
```

This matters because the ideal gas law relates absolute pressure and absolute temperature, while a bicycle pump displays gauge pressure. The `14.7 PSI` offset approximates atmospheric pressure at sea level.

## How to Use

1. Open `index.html` in Safari or another modern browser.
2. Select the bike profile.
3. Check the tire model, tire width, wheelset, rim type, and rider/gear weight.
4. Enter:
   - **Rider (kg)**, **Gear (kg)**: rider and gear weight.
   - **Bottles (count)** and **kg / bottle**: number of water bottles carried and the weight of each (default 0.65 kg per bottle), added to total weight.
   - **Outside °C**: expected outdoor riding temperature.
   - **Garage °C**: temperature where you inflate the tires.
5. Read the **Pressure Result** section:
   - **Pump garage**: set your pump to this pressure indoors.
   - **Outside goal**: expected/desired pressure outside.

## Default Bike Profiles

| Bike | Weight | Wheelset | Rim | Tire | Size | Weight distribution |
|---|---:|---|---|---|---:|---|
| Giant TCR Adv 0 Di2 2025 (default) | 7.6 kg | Giant/CADEX SLR 0 | Hookless, 22.4 mm | CADEX Race GC | 28c | Road Race, 47/53 |
| BMC Alpenchallenge 01 THREE | 9.6 kg | DT SWISS C 1800 SPLINE 23 DB | Hooked, 22 mm | Panaracer Gravelking Slick TLC | 32c | Fitness, 46/54 |
| TCR Advanced 2022 | 8.4 kg | DT Swiss PR 1600 32 | Hooked, 18 mm | Giant Gavia Course | 28c | Road Race, 47/53 |

## What the Calculator Considers

- Rider weight
- Bike weight
- Gear weight
- Water bottle count and weight per bottle
- Front/rear weight distribution
- Tire width
- Tire model maximum pressure
- Rim type: hooked or hookless
- Inner rim width
- Surface type
- Comfort/speed preference
- Garage temperature
- Outside temperature

## Pressure Model

The base pressure is an average front/rear value calibrated against [Giant's hookless tire pressure calculator](https://www.giant-bicycles.com/global/tire-pressure) (queried October 2026). It matches Giant's results within about ±2 PSI (Giant rounds to whole PSI) for 25–32c tires on 19.4–25 mm inner rims; `tests.html` checks this.

- Reference: 28c tire, 22.4 mm inner rim, ~89 kg system weight (78 kg rider) → 61 PSI
- Weight: +0.25 PSI per kg of system weight
- Rim width: −1.33 PSI/mm below 22.4 mm, −2.3 PSI/mm above
- Tire width: 25c +18, 30c −5, 32c −10 PSI relative to 28c
- Surface and ride preference adjust the average directly

The average is then split by the weight distribution profile: `front = 2 × avg × ratio`, `rear = 2 × avg × (1 − ratio)`. Giant gives one value for both wheels; the profiles here put the front at roughly 85–89% of the rear.

Rims narrower than 19.4 mm (e.g. the 18 mm DT Swiss PR 1600) are extrapolated beyond Giant's data.

## Safety Limits

The calculator always applies a safety ceiling:

```js
safeMax = Math.min(rimLimit, tireRatedMax)
```

For hookless wheels, the current configuration uses a 73 PSI maximum limit. For hooked rims, the rim allows higher pressure, but the tire's own rated maximum pressure still applies.

Always obey the lower limit between the tire and rim manufacturer specifications.

## Pressure Result Display

The result section is intentionally simple:

- **Front** and **Rear** are shown separately.
- Each wheel shows two main values:
  - **Pump garage**: pressure to set on the pump indoors.
  - **Outside goal**: target/expected pressure outside.
- PSI is shown as the primary value.
- Bar is shown as a smaller secondary value.
- A short temperature-correction note explains the adjustment.

## Chart

A small inline SVG chart (no library) shows how the expected outside pressure changes across outdoor temperatures from −10 to 40 °C, starting from the same garage inflation pressure. A dashed line marks the current outside temperature; touch or hover shows the front/rear values at that temperature.

## iPhone Optimization

The page is optimized for both iPhone 16 Pro Max and iPhone 13 mini:

- `viewport-fit=cover`
- Safe area inset handling for Dynamic Island, notch, and home indicator
- Input font size of 16 px or larger to avoid automatic iOS zoom
- Decimal inputs accept both `,` and `.` (needed for locales like Hungarian, where the iOS numeric keypad only shows a comma)
- Larger touch targets
- Simplified mobile pressure result layout
- Fewer chart ticks on narrow screens
- Chart redraws on resize and orientation changes
- Pinch zoom stays enabled for accessibility

## Technology

- HTML
- CSS
- JavaScript
- Inline SVG chart, no third-party JavaScript
- No build step
- No backend
- No installation required

## Project Structure

This is a static single-file web app. There is no Python package, build pipeline, or server component; `tests.html` is only for development.

```text
bike-pressure/
├── index.html  # Complete calculator app: HTML, CSS, and JavaScript
├── tests.html  # Browser tests for the pressure model and the UI
├── README.md   # Project documentation and customization notes
└── .git/       # Git metadata
```

Inside `index.html`, the app is organized into five broad sections:

- `<head>` metadata for iOS/mobile behavior, app title, icon, and font loading.
- Embedded CSS for the dark mobile-first interface, safe-area handling, controls, results, and chart layout.
- HTML markup for bike, wheel, tire, rider, temperature, result, chart, and safety panels.
- `<script id="pressure-model">`: bike/wheel/tire data and the pure pressure calculation (`computePressure`), with no DOM access. Exposed as `window.PressureModel`.
- The UI script: reads the form, renders results and the SVG chart, and wires up event listeners.

## Tests

`tests.html` loads `index.html` in an iframe and checks the pressure model against Giant's calculator values, the temperature correction, the safety limits, and the main UI flows (defaults, tire widths, validation, manual ratio, reset, chart).

Browsers block iframe access on `file://`, so serve the folder locally:

```sh
python -m http.server
# open http://localhost:8000/tests.html
```

Or run it headless (Edge or Chrome); the page title becomes `PASS n/n` or `FAIL x/n`:

```sh
msedge --headless=new --allow-file-access-from-files --virtual-time-budget=10000 --dump-dom file:///path/to/bike-pressure/tests.html
```

## Customization

Bike, wheelset, tire, and pressure-limit data can be edited directly in the `<script id="pressure-model">` block of `index.html`.

### Bikes

```js
const bikes = {
  'bmc_ac01': {
    name: 'BMC Alpenchallenge 01 THREE',
    weight: 9.6,
    defaultWheel: 'dtc1800',
    distroProfile: 'fitness',
    defaultTire: 'panaracer_gravelking_slick',
    defaultTireWidth: 32
  }
};
```

### Wheelsets

```js
const wheelsets = {
  'dtc1800': { type: 'hooked', limit: 110, name: 'Hooked Rim', w: 22 },
  'slr0': { type: 'hookless', limit: 73, name: 'Hookless', w: 22.4 }
};
```

### Tire Maximum Pressures

```js
const tireMaxPressure = {
  panaracer_gravelking_slick: 75,
  cadex_race: 95,
  giant_gavia_course: 105
};
```

### Tire Widths

Tire models made only in certain widths are listed in `tireWidths`; the width dropdown then offers only those. Models not listed allow every width.

```js
const tireWidths = {
  cadex_race: [28, 30],
  cadex_classics: [28, 30]
};
```

## Important Note

This calculator provides an estimate. It does not replace official safety instructions from tire and rim manufacturers.

Always check the official maximum pressure for both the tire and the rim. Use the lower of the two. For hookless systems, also confirm that the tire is approved for hookless use.

## Background / References

- WebKit: `viewport-fit=cover` and safe area inset handling for modern iPhone displays.
- Apple Safari Web Content Guide: viewport configuration for iOS Safari.
- OpenStax College Physics: ideal gas law and pressure-temperature relationship examples.
- Arden tire pressure calculator explanation: gauge pressure to absolute pressure conversion using an atmospheric pressure offset.
- SRAM/Zipp tire pressure guidance: common inputs for modern bicycle tire pressure calculators, including rider/bike/gear weight, tire width, rim type, and inner rim width.

## Files

- `index.html` - the complete calculator application.
- `tests.html` - browser tests.
- `README.md` - this documentation.
