# Sci-Fi Atlas design specification

The generated editorial concept uses an ivory surface, midnight-navy typography and vermilion selection accents. The implementation is a static, dependency-free GitHub Pages application.

## Locked design system

- Surface: `#f5f3ec`; text: `#172a38`; secondary: `#69747b`; accent: `#c95137`; rules: `#b9b0a5`.
- Chinese editorial headings: Noto Serif CJK SC / Songti SC / STSong / serif. UI and body: Noto Sans CJK SC / PingFang SC / Microsoft YaHei / sans-serif. Numeric marks: Georgia / serif. IDs: monospace.
- Wide page shell, thin horizontal rules, open editorial rows, narrow topic rail. No enclosing result cards or decorative marketing panels.
- Main heading: “想象中的世界，靠什么运转？”; supporting copy: “从小说、电影到游戏，探索科幻中的发现、发明与社会创造。”
- Header: 科幻创意图谱 / SCI-FI ATLAS; 探索目录 / 主题索引 / 我的收藏 / 关于 / GitHub.
- Hero actions: 开始探索 / 随机发现. Statistics: 240 创意条目 / 20 主题领域 / 14 媒介类型 / 230 来源链接.
- Orbital index is code-native topic navigation, not a claim about measured distances or historical influence.
- Controls use restrained rectangular outlines; bookmark and direction icons use consistent 1.5px strokes. Hover and selected states are functional, not decorative.

## Required responsive and functional extensions

- On phones the rail becomes a labelled topic select; the orbital index reduces in size or hides at narrow widths to prioritize reading. Header navigation remains reachable without a hamburger dependency.
- Full entry details use a native accessible dialog, becoming a full-screen reading surface on small devices.
- Deep links, bookmarks, source expansion, pagination, topic index, about page and download links are actual functional UI.
- Bookmarks are local only, with an export and undo interaction. All text and controls remain native HTML.

## Intentional corrections to concept text

- The concept image invents category names after the first five and alters some source text. The actual 20 category names, all record text, creators and counts come from the checked JSON instead.
- The orbit's “20” destination uses the real identity/family/social-values theme, rather than a fictional “other” category.
- Pagination reflects the real 240 entries at 24 per page. Four representative records open the unfiltered directory, then all other IDs remain available.
- No generated mockup image is shipped as interface or factual content.

## Verification targets

Desktop layout, 390px/320px reading width, all 240 records, exact ID lookup, combined filters, 10 theme-evidence records, empty results, related records, dialog keyboard behavior, deep-link refresh, back navigation, local bookmark persistence, copy-link fallback and download paths.

## Refinement after review of the published site

The desktop, catalogue and detail screenshots were reviewed against the accepted concept. The visual identity, open archive rows, serif titles, restrained palette and source hierarchy remain in place. Changes address reading and interaction problems observed in the shipped stylesheet rather than introducing a new visual direction.

### Reading and responsive behaviour

- Archive premises and detail prose use a 16px reading size, work information uses 14px, and IDs, medium labels and evidence annotations remain at least 12px. The original narrow-screen rules reduced several useful labels to 9–11px; those reductions are superseded. Brand lettering remains a decorative exception.
- The topic rail uses 13px labels and 44px-high rows. At widths up to 900px it becomes the visible topic selector, preserving room for the archive text instead of compressing the 768px layout into three narrow columns.
- On phones, ID and medium share the first row with a separate 44px bookmark. The evidence label follows the prose in normal grid flow. It no longer relies on absolute coordinates beside variable-length medium names.
- At widths up to 420px each labelled filter occupies a full row. Select text uses 16px; the evidence selector spans the available width on compact layouts. The arrow is positioned relative to the bottom of the select control so adding a visible label does not misalign it.
- Mobile pagination keeps 44px numeric controls on its first line and places the previous/next controls on a second line. Ellipses remain noninteractive. The same page sequence can be used at every viewport width.

### Keyboard, touch and scrolling

- Buttons, page controls, bookmark controls, filter chips and topic controls have a minimum 44px target. The icon drawing may remain 18–20px inside that target.
- Focus uses a high-contrast 3px navy outline; the search field has an equivalent container outline. Focus outlines inside the scrolling topic rail are inset so they are not clipped by its edge.
- Dialog scroll padding and target scroll margins leave room for the sticky toolbar and transient feedback. The document and dialog reserve scrollbar space to reduce layout movement when the modal opens.
- Reduced-motion and forced-colour rules remain. `[hidden]` continues to override component display rules. The detail toolbar recognises both the renderer's `is-saved` state and its accessible `aria-pressed` state.
- The compact back-to-filters action provides a route back to the controls after a long result list. On phones it moves above a visible toast rather than occupying the same space.

### Component interfaces added in the refinement

- Search and filters: `.filter-label`, `.search-hint`, `.icon-button` / `#search-clear`, `.saved-actions`, `.back-to-filters`.
- Pagination: optional text spans inside `.page-previous` and `.page-next` appear on phones.
- Static pages: `body.static-page[data-page="entry"|"catalog"]`, `.static-main`, `.static-breadcrumb`, `.static-entry-toolbar`, `.static-index-heading`, `.static-topic-nav`, `.static-topic-section`, `.static-entry-list`, `.static-index-item`, `.static-index-meta`, `.static-index-work`, `.static-index-premise`, `.static-footer`.
- Static entry pages reuse the detail typography, metadata, source lists and related-entry styles. They are ordinary document pages and do not inherit modal height or overflow constraints.

### Refinement verification targets

Review 320px, 390px, 768px and 1024px widths using actual rendered pages. Check the longest medium and evidence selections, long Chinese and English titles, the middle page sequence with both ellipses, imported collection messages, keyboard focus near a sticky toolbar, source-domain wrapping, the static entry page, and the static 240-entry index. No source text or catalogue classification is changed by these style refinements.
