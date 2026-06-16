# ChaoYue0307.github.io

Static GitHub Pages personal research site for `https://chaoyue0307.github.io/`.

The site is intentionally zero-build: plain HTML, CSS, vanilla JavaScript, and local assets only. GitHub Pages can publish the repository directly from the repository root.

## Structure

- `index.html` - homepage, profile sidebar, positioning, and recent highlights.
- `publications.html` - accepted work, preprints/submissions, earlier work, paper figures, and lightboxes.
- `research.html` - research map across sustainability and ESG AI, evaluation, agents, RecSys, mobility, and embodied AI.
- `experience.html` - roles, education, selected capabilities, and toolkit.
- `projects.html` - public repositories, private prototypes, and agent/MCP tooling.
- `thoughts.html` - placeholder for future research notes.
- `styles.css` - shared visual system and responsive layout.
- `site.js` - publication figure lightbox hydration and keyboard behavior.
- `assets/` - profile photo, icons, paper thumbnails, and source figures.

## Updating Content

For publications, add a new `article` in `publications.html` under the correct section:

- `Selected / Accepted` for accepted or forthcoming work.
- `Preprints & Under Review` for submissions, preprints, and review-stage work.
- `Earlier Work` for older work.

Use clear status labels such as `Accepted`, `Oral`, `Dataset Track`, `Preprint`, `Under review`, or `Submitted`. Do not mark a paper accepted until that status is confirmed.

For projects, add repository cards in `projects.html` under the appropriate group:

- `Public repositories`
- `Selected systems / private prototypes`
- `Agent tooling and MCP security`

Keep repository descriptions concise and avoid adding stars, dates, or metrics unless they are verified and intentionally maintained.

## Local Testing

From the repository root:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/`.

Before pushing, check:

- Internal navigation and section anchors work.
- Profile links are correct.
- Publication figure lightboxes open, load the full image, close with `Escape`, and return focus.
- Mobile layout keeps the intro before contact links and focus-area chips.
- No broken CV link is shown unless a CV file is committed and wired into the HTML.

## Deployment

Push changes to the default branch of `ChaoYue0307/ChaoYue0307.github.io`. GitHub Pages serves the static files directly.
