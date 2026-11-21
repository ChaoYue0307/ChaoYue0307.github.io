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
