# Health Atlas · Global Edition 3.0

Published at https://chaoyue0307.github.io/health-atlas/. Snapshot retrieved **2026-10-05**.

## What this release actually covers

The directory contains **250 countries and territories** (249 ISO entries plus Kosovo); it is not a count of sovereign states. **219** have at least one of the selected international series. There are **12 statistical series** and **51,842 country–year–indicator observations**, not 12 independent diseases or 51,842 distinct patients. Every missing value remains missing.

| Series | Last data year in the retrieved API | Locations with that year's value |
|---|---:|---:|
| Diabetes, IDF age-standardized, ages 20–79 | 2024 | 209 |
| Diabetes, WHO, ages 18+, standardized and crude separately | 2022 | 199 |
| Hypertension, ages 30–79, standardized and crude separately | 2019 | 194 |
| Obesity, BMI ≥30, ages 18+, standardized and crude separately | 2024 | 199 |
| Anemia, women ages 15–49 | 2023 | 192 |
| HIV prevalence, ages 15–49 | 2024 | 148 |
| Tuberculosis annual incidence, per 100,000 | 2024 | 208 |
| Life expectancy at birth | 2024 | 216 |
| Population | 2025 | 216 |

**This is not a complete all-disease database.** The latest year in a particular API is not necessarily the latest estimate published by that organization elsewhere. In particular, the retrieved hypertension series ends in 2019 even though newer reports exist. Source update dates, measurement definitions, raw uncertainty bounds and API provenance are retained. “Same source and year” improves comparability but does not establish identical input-study quality across countries.

## Multilingual interface and design

Eight hand-authored interface languages: Chinese, English, Spanish, French, Portuguese, German, Japanese, Arabic. Country names use browser `Intl.DisplayNames`, with source names and ISO codes also searchable. Arabic layout uses right-to-left document flow; numerical plots retain a consistent left-to-right coordinate system. Source titles and original metadata remain in their original language. The preserved v2 research application and its 203 detailed records remain Chinese, explicitly disclosed in every language.

New world explorer: Equal Earth SVG map, fixed-across-year single-indicator color scale, explicit missing-data hatching, search and tabular alternative for small territories, zoom/reset controls, timeline and sparse historical observations. Population uses proportional symbols (area encodes population), never an absolute-count choropleth. Administrative boundaries are contextual and do not express sovereignty claims. Original Natural Earth/world-atlas attribution and vendor licenses accompany the assets.

Country comparisons use up to four locations, the same indicator and selected year, visible data gaps, uncertainty whiskers where reported, and historical points without fabricated interpolation. No overall country health score is generated.

Light/dark themes, desktop/mobile layouts, keyboard operation, reduced-motion styles, local scenario saving, URL-deep-linked state, CSV export, standalone SVG chart export, and print styles are included. No runtime third-party CDN, API secret, analytics tracker or personal health record is used.

## Country-specific population experiments

**199** locations have both 2022 WHO crude diabetes and crude obesity estimates for adults aged 18+ and both sexes. Only those two conditions are included in the new country cohort. The mean is their probability sum. A Gaussian-copula dependence parameter supplies hypothetical joint distributions; it is not calibrated to national comorbidity data. Input uncertainty is displayed in the explorer but **not propagated** through this sensitivity model. Zero selected conditions is not absolute health.

The original Singapore five-indicator and China twelve-condition cohorts are also available. Their different ages, years and criteria are not made comparable by the UI. Original `engine.js`, source data, comments and research application code are unchanged.

`research.html` is a byte-for-byte copy of the former `index.html`. Old `#overview`, `#library`, `#lab`, `#coverage`, and `#methods` links are forwarded to it. No root personal homepage files are changed.

## Files and regeneration

- `v3/global.js`, `v3/charts.js`, `v3/global.css`, `v3/i18n.js`: new interface, chart renderers, theme, translations.
- `v3/data/global.json`: reviewed country-series snapshot.
- `v3/data/observations.csv`: full-precision source observations, one row per country-year-series.
- `v3/data/provenance.json`: requested URLs, response checksums, source metadata and exclusions.
- `scripts/build_global.py`: reproducible ingestion from the saved World Bank/WHO public API artifacts. It validates pagination, codes, sex, age, duplicates, units and uncertainty bounds.
- `tests/global-data.test.cjs`: validates all observations, translations and 199 cohorts across four dependence settings.
- `tests/browser-global.py`: checks four new views in eight languages at desktop/mobile sizes, search, years, map controls, comparisons, source dialogs, missingness, scenarios, persistence and exports.

```bash
# Serve the existing personal-site repository root, or adjust URL to the subsite root.
python -m http.server 8000
node health-atlas/tests/engine.test.cjs
node health-atlas/tests/global-data.test.cjs
python health-atlas/tests/browser-global.py --url http://localhost:8000/health-atlas/ --out /tmp/atlas-qa
```

Snapshots update only when the ingestion is explicitly rerun and reviewed; no recurring background update has been scheduled. The invalid/archived World Bank malaria endpoint was excluded. The combined World Bank Channel Islands entity was not assigned to Jersey or Guernsey. Unmapped values do not become synthetic country observations.

## Verification and remaining scope

Local Chromium URL navigation was restricted in this environment. Initial visual checks therefore rendered the exact local assets inline, without changing browser security policy. Real HTTP/asset, origin storage, download and deployed-site checks run separately in GitHub Actions with Playwright Chromium. The native Browser plugin was not available. Test output states which path was exercised; an inline test does not stand in for an HTTP test.

Remaining work includes additional disease series, age/sex breakdowns, full GBD-compatible country-level prevalence extraction, calibrated joint data, uncertainty propagation and reviewed translation of the legacy research annotations. No claim is made that eight localized interface languages mean every linked scientific document is translated.

Source data remain subject to the original WHO, World Bank, IDF, UNAIDS and IHME terms. Code licensing does not grant new rights to the upstream data. No font files or full scientific articles are redistributed.
