# Health Atlas · Explorer 4.0

Application release: **4.0.0**, 6 October 2026. Statistical snapshot remains **3.0.0**, retrieved **5 October 2026**. This release improves exploration and analytical safeguards; it does **not** claim new all-disease statistics, refreshed observations, or an identified absolute-health rate.

## Open the new views

- Globe: `./#world?lang=zh&view=globe`
- Insights: `./#insights?lang=zh&x=obesity&z=diabetes_who&ay=2022`
- Sensitivity and overlap: `./#simulator?lang=zh&panel=country&c=SGP`
- Observation-date audit: `./#data?lang=zh`

## Rendering architecture

**Three.js 0.186.0** owns one interactive 3D globe with OrbitControls. It uses the existing Natural Earth/world-atlas geometry, an explicitly aligned longitude/latitude texture, a fixed-across-year indicator scale, and country raycasting. Missing values are hatched, not zero. Country selection, indicator/year controls and the original 2D details are linked. Absolute population uses proportional-area tangent symbols instead of an absolute-count choropleth. The globe is geographical context, not a gain in statistical precision; 2D maps and tables remain the comparison alternatives.

**Apache ECharts 6.0.0** owns the scatterplot, paired-change chart and assumption-sensitivity curves. **D3 7.9.0** continues to own exact geographic geometry, the 2D map and existing distribution/trend charts. An additional engine is not installed simply for visual novelty. The two new libraries are bundled separately with **esbuild 0.25.9**, loaded only when their view needs them, and served from this repository rather than a runtime CDN. Vendor entrypoints, package lock and notices are included under `v4/vendor/`.

The globe renders on demand, limits device pixel ratio to 1.5, pauses when hidden/offscreen, and disposes geometry/materials/textures/controls and its context on navigation. Rotation is opt-in and disabled under reduced-motion preference. Mouse dragging and keyboard arrows change orientation; touch users have a two-finger gesture, buttons, search and a table. Ordinary page scrolling is not captured by wheel zoom. WebGL failure or context loss returns to the operational 2D map. One focal renderer is shown at a time. Quantitative overlays are DOM text and remain accessible without the globe.

## Insights workbench

The new view joins two indicators for the **same exact year**, with optional region filtering. A point represents a country or territory, not a person. Points have equal size; color denotes region. No missing values are replaced by zero, and no nearest-year borrowing occurs. The matching count and exclusions are displayed.

Pearson correlation and Spearman rank correlation are computed over the matched locations without population weighting. Ties receive average ranks; fewer than three observations or a constant axis produce an undefined value, not zero. These are descriptive ecological associations: they are not individual risk, causal effects or inferential evidence that countries are independent samples. Population/measure mismatches are explicitly flagged. Identical metadata cannot guarantee identical quality of the underlying national input studies.

The paired-change view includes only locations observed at both endpoints. For percentage indicators, differences are percentage points. The figure shows the six largest and six smallest observed changes; the full matched table is available. Neither sign is presented as a universal health improvement, nor is this an overall country health ranking. A reproducibility export retains the snapshot version, source URLs, definitions, selected indicators, region, years, matched observations and changes. PNG export embeds source codes and a caution footer.

## Distinguish three forms of uncertainty

1. **Sharp mathematical bounds.** Given marginal probabilities only, the zero-condition proportion is in `[max(0, 1 − sum(p)), 1 − max(p)]`. These are feasible bounds, not confidence intervals.
2. **Dependence sensitivity.** Curves vary the existing Gaussian latent-correlation parameter from 0 to 0.8, keeping marginal prevalences fixed. They cover selected nonnegative-dependence assumptions, not all possible joint distributions. The mean remains the sum of the selected probabilities.
3. **Source-interval endpoint stress tests.** Where every selected input has compatible lower/upper bounds, using all lower or all upper marginal endpoints produces a deterministic stress envelope at each dependence value. This is **not** a 95% joint interval or full posterior uncertainty propagation. Joint posterior draws and cross-disease estimation correlations have not been obtained. Missing input intervals do not produce a fabricated envelope.

For exactly two selected conditions, a separate overlap explorer allows all mathematically feasible joint prevalences `max(0,p+q−1) ≤ P(A∩B) ≤ min(p,q)`, including dependence outside the positive-Gaussian curve. The four disjoint groups preserve the input marginals and sum to 100%. This illustrative overlap explorer does not silently recalibrate the main simulation.

## Scenario notebook

Up to six scenarios can be pinned in localStorage with cohort, country, year, condition list, parameters, results and data version. They can be restored, removed or exported as JSON. Country, age, year and disease definitions must match before differences are interpreted directly. Fixed Singapore/China study panels retain their actual population labels. No server, account or personal health data is used.

## Observation-date audit

Every series shows its latest observation year, provider update date and snapshot retrieval date separately. The calendar-year gap is an elapsed-year quantity, **not a quality score**. Older observations may be the latest available in a particular API; a new download does not make them current. This release does not rerun the data-ingestion pipeline or schedule unattended updates.

## Compatibility and provenance

The original research interface, original engine and original datasets remain intact. Only `index.html` and narrow routing/extension hooks in `v3/global.js` are changed, plus a README addition. Existing comments are retained verbatim; originals are included in the repository history. Original v2 and v3 tests are retained. All new UI strings are supplied in the same eight languages; source metadata and legacy research annotations remain in their original languages.

## Verification

Run the original engines plus `node tests/analysis-v4.test.cjs`. The new numerical suite checks probability conservation, sharp endpoints, tied ranks, undefined correlations, exact-year joins, paired changes, source-date semantics, interval endpoints, eight-language key parity, globe coordinate round-trips and export provenance.

`python tests/browser-v4.py --url http://localhost:8000/health-atlas/ --out /tmp/atlas-v4-qa` is the real-HTTP release gate. It requires actual Three.js rendering, checks country picking, zoom, context-loss fallback, reduced motion, eight-language desktop/mobile layouts, linked analysis, scenarios, storage and actual downloads. `--inline` is a separate, narrower layout-only mode for environments with administrative network/WebGL restrictions; it does not establish that WebGL, HTTP delivery or origin storage works.

The native Browser plugin is absent in this environment, so verification uses Playwright. Local HTTP navigation and WebGL are administratively restricted; complete rendering and public-URL checks are run separately in GitHub Actions. Screenshots and QA reports are artifacts, not part of the published site. Chromium verification is not a claim of exhaustive Safari/Firefox/device or clinical validation.
