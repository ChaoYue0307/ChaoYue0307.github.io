# 科幻创意图谱 · Sci-Fi Atlas

一份可搜索、筛选、收藏和追踪来源的跨媒介科幻创意目录。网站使用原生 HTML、CSS 和 JavaScript，数据随站点提供，无运行时第三方依赖，已生成的 HTML 可直接部署到 GitHub Pages。修改数据后，运行零依赖生成器同步独立阅读页与 sitemap。

站点地址：<https://chaoyue0307.github.io/scifi-atlas/>

## 目录范围与统计口径

当前数据版本为 **2026-11-21**，包含 **240 条代表性创意、20 个主题领域、14 种主要媒介**。主要来源 URL 去重后为 **219 个**，连同补充资料、题名资料及边界说明资料共 **230 个来源 URL**。

**240 是创意条目数。** 同一作品可以包含多个机制，同一母题也可以在不同作品与媒介中形成不同的实现或后果。此目录不声称穷尽科幻作品，不把每条记录当作一部独立作品，也不把代表作品认定为相应创意的首次出处。

| 主要媒介 | 条目数 |
| --- | ---: |
| 文学 | 120 |
| 影视系列 | 10 |
| 电视剧 | 16 |
| 电影 | 14 |
| 动画电影 | 4 |
| 动画剧集 | 25 |
| 漫画 | 11 |
| 电子游戏 | 30 |
| 舞台剧 | 4 |
| 广播剧 | 1 |
| 音频剧 | 2 |
| 桌面角色扮演 | 1 |
| 互动文字作品 | 1 |
| 桌游 | 1 |

每条记录按本版采用的主要媒介计数一次。具体形式、跨媒介改编及版本差异保留在 `form`、`media_detail` 与 `adaptation_note` 中。子类型标签可以重叠，不能将各子类型数量相加后当作条目总数。

## 怎样阅读证据与设定

目录把作品设定、来源支持程度和现实可行性分开记录：

- **机制**描述设定如何在作品中运作。
- **启发与后果**属于整理分析，不自动构成原作者的观点或经过验证的研究结论。
- **关键假设与边界**说明虚构前提、版本限制或仍需解决的问题。
- **直接支持**表示所列资料明确涉及该设定。来源可能是原作、官方说明、创作者访谈或明确的剧情资料，不表示全部来源均出自原作者。
- **主题支持／细节待进一步核对**表示来源支持主题或概要，对具体机制的佐证较弱。正式引用前需要回到原作及相关资料核对。

当前有 230 条“直接支持”和 10 条“主题支持／细节待进一步核对”。这里的 **230 条证据记录**与 **230 个来源 URL**是两个不同的统计口径。

证据标签不是科学可信度、技术成熟度或现实实现程度的评分。科幻中的“发现”“发明”、现实研究成果、制度思想实验与游戏互动规则分别说明；科学幻想、超自然和寓言边界作品保留相应标签。目录涉及部分关键设定和剧情。

## 本地运行

需要 Python 3 提供静态服务器。运行生成器和单元测试需要 Node.js 22 或更新版本；浏览器验证依赖只用于开发和 CI，不进入公开页面。

在项目目录执行：

```bash
python3 -m http.server 4173
```

然后打开 <http://localhost:4173/#/explore>。不要依靠双击 `index.html` 后的 `file://` 访问方式运行搜索：浏览器需要通过 HTTP 加载 ES module 和 JSON 数据。

运行公开页面和纯函数测试不需要执行 `npm install`。`package.json` 提供 `npm run serve`、`npm test`、`npm run build` 和 `npm run check:build`；后两项生成并检查提交到仓库的静态阅读页。浏览器检查另用 `npm run test:browser`。

### 运行测试

```bash
node --test tests/*.test.mjs
```

测试覆盖文字规范化、多关键词 AND 搜索、SF 编号精确定位、组合筛选、收藏集合、统计、来源 URL 去重及双向关联推荐，并对随站点提供的实际数据做回归验证。

数据测试默认读取 `data/catalog.json`。需要核验另一份候选数据时，可以显式指定文件：

```bash
SCIFI_CATALOG_TEST_PATH=/absolute/path/to/catalog.json node --test tests/*.test.mjs
```

## 导航与使用

交互浏览保留 URL hash 路由。每条创意同时有真实静态路径，分享按钮复制独立阅读页地址；两种入口均不需要服务器重写规则。

| 页面 | 路由 |
| --- | --- |
| 探索目录 | `#/explore` |
| 主题索引 | `#/topics` |
| 我的收藏 | `#/saved` |
| 关于、收录方法与证据说明 | `#/about` |
| 指定创意详情 | `#/idea/SF001` |

例如，第一条创意的公开阅读链接是 <https://chaoyue0307.github.io/scifi-atlas/ideas/SF001/>，旧的 `#/idea/SF001` 链接继续可用。

搜索覆盖创意名称、作品、作者、机制、后果、边界说明等字段。空格分隔的多个关键词按 AND 匹配，中文和英文可以混合使用，英文大小写不影响结果。编号与关键词混合查询时也精确约束当前记录；`SF019`、`sf019`、`SF19`、`SF 019` 与全角形式均表示同一编号，不会因为其他记录提到这个编号而混入搜索结果。1–3 字母的拉丁词按词边界匹配，`AI` 不会误中 `D-Mail` 或其他英文标题内部的字母。

主题、媒介、子类型和证据筛选可以组合。候选数量保留其他已选条件、暂不限制当前维度；没有结果的选项禁用，已选项仍可移除。主题索引页的数量描述完整目录，不受交互筛选影响。显式 `related_ids` 的正向与反向关系优先展示，其后才是同主题或同子类型推荐；这些关联不表示已经证实的首次出处或历史影响关系。

### 收藏、导入与导出

收藏保存在当前浏览器的本地存储中，不需要账号，不会上传到本站服务器。收藏页提供阅读清单导出与导入，导入会合并有效编号并允许撤销本次新增。支持本站导出的 JSON 对象或编号数组，例如 `["SF001", "SF019"]`。单个导入文件上限为 2 MiB；不会采用文件内的作品文字、链接或脚本，未知编号、重复编号和格式不符的项分别报告。无效文件不覆盖现有收藏。浏览器、设备和站点来源不同，收藏也可能不同；清理浏览器存储可能删除收藏。

本站代码不包含访问分析脚本，也不上传检索词。点击来源链接后会访问相应第三方网站。完整目录另提供 `data/catalog.json` 和 `downloads/SF_Ideas_All_Media.xlsx` 下载；完整目录下载与个人收藏导出用途不同。

## 文件组织

| 文件或目录 | 职责 |
| --- | --- |
| `index.html` | 页面结构、导航、说明、元数据与下载入口 |
| `assets/styles.css` | 响应式布局、视觉样式与交互状态 |
| `assets/app.js` | 数据加载、hash 路由、交互状态、分页、详情与本地收藏 |
| `assets/ui.js` | HTML 转义、安全来源链接、证据识别与图标辅助函数 |
| `assets/catalog-core.js` | 无 DOM、零依赖的索引、查询、统计与相关推荐模块 |
| `assets/favicon.svg` | 站点图标 |
| `data/catalog.json` | 原始目录结构、整理说明、统计元数据与 240 条记录 |
| `downloads/SF_Ideas_All_Media.xlsx` | 可下载的完整 Excel 目录 |
| `tests/*.test.mjs` | 使用 Node.js 内置测试器的验证 |
| `design-spec.md` | 设计目标与页面规范 |

### 数据结构

`catalog.json` 保留顶层 `title`、`version`、`scope`、`notes`、`method`、`stats` 和 `entries`。界面使用 `entries` 重新计算实际数量，不依靠顶层汇总替代筛选后的统计。

| 字段 | 用途 |
| --- | --- |
| `id` | 稳定编号，例如 `SF001`；用于详情链接、收藏与关联 |
| `category_no`、`category` | 主题编号与名称 |
| `idea`、`kind`、`premise` | 创意名称、类型和核心假设 |
| `mechanism`、`implication`、`constraint` | 具体机制、整理分析和边界说明 |
| `work_zh`、`work_en`、`author` | 作品题名与创作者信息 |
| `media`、`form`、`media_detail` | 主要媒介与具体形式 |
| `subgenre`、`subgenre_tags` | 原始子类型说明与可筛选标签 |
| `evidence`、`evidence_level` | 来源支持说明与规范化筛选等级 |
| `source_url`、`source_title` | 主要来源及其标题 |
| `additional_source_url`、`title_source_url`、`constraint_source_url` | 可选的补充来源，支持字符串或 URL 数组 |
| `related_ids`、`shared_motif`、`variant_of` | 显式关联、共同母题与变体说明 |
| `adaptation_note`、`idea_layer` | 改编版本与条目层次说明 |

查询模块另兼容 `medium` 和补充 `fulltext` 字段，但当前目录保留既有 `media` 等原文字段。`getStats().totalWorks` 仅统计规范化作品标题标签；标签可能指单作、系列、分集或多本书，不能直接用作独立作品总数。

## 更新目录

1. 在 `data/catalog.json` 中修订或追加记录，保留已有字段及其证据限制。已有 `id` 不重新编号、不移作其他创意，以免破坏外部链接与收藏。
2. 为新增记录分配唯一 ID，填写实际作品版本、明确机制和可追溯来源。保留主题支持标签，不用来源概要代替尚未核实的细节。
3. 使用规范化 `subgenre_tags` 与 `evidence_level`，保留原始说明字段。`related_ids` 指向现存 ID；正反向都可被检索，不必为了显示双向关系重复添加。
4. 核对必需字段、ID 唯一性及关联目标。更新数据版本、顶层统计、首页静态数字、说明页、页面描述和本文统计，使它们与实际记录一致。
5. 同步更新下载用 Excel，保留文本换行和冻结表头。不要让页面数据与下载目录长期处于不同版本。
6. 运行 `node --test tests/*.test.mjs`，再检查组合筛选、空结果、收藏导出、详情直达、浏览器前进后退、键盘导航及手机布局。条目数或来源数发生合理变更时，同步更新实际目录回归测试中的版本基线。

调整搜索逻辑时，保持纯模块与页面控制器分离。数据中包含的文字在进入 HTML 时须经过转义；来源链接使用 `ui.js` 中的 HTTP(S) 协议检查。

## 部署到 GitHub Pages 的 `/scifi-atlas/`

将本项目的全部静态文件放到 GitHub Pages 发布根目录下的 **`scifi-atlas/` 子目录**，保持 `index.html`、`assets/`、`data/` 和 `downloads/` 之间的相对结构。发布后的入口为：

```text
https://<account>.github.io/scifi-atlas/
```

项目资源使用 `./assets/...`、`./data/...`、`./downloads/...` 等相对路径。不要改成从域名根目录开始的 `/assets/...`，否则部署在子目录时会丢失资源。ES module 内部导入同样保持相对路径。

将文件放入实际发布目录后，可以在该发布根目录运行 `python3 -m http.server 4173`，访问 <http://localhost:4173/scifi-atlas/#/explore>，验证子目录部署。详情地址的 hash 不会发送给服务器，因此刷新 `#/idea/SF001` 仍加载同一份 `index.html`。

部署前确认数据和 Excel 均已随文件提交，并核对 `index.html` 中的 canonical URL、Open Graph URL 与 GitHub 项目链接。如果发布到其他账号或仓库，应将这些地址一并修改。部署由目标仓库现有的 GitHub Pages 发布流程完成，不需要额外构建命令。

## 内容权利与更正

本项目提供设定的简要概括、整理分析与来源链接，不提供原作品全文。作品名称、角色、原作内容和第三方资料的权利归相应权利人。

**原始数据、汇总文本和被引用作品并不因此全部成为公有领域内容。** 仓库公开可读、文件可下载或附有来源链接，不代表本项目为所有相关材料提供统一授权，也不代表原作已经进入公有领域。引用或再利用具体内容时，应区分本站整理文本与第三方材料及其适用条款。

提出更正时，建议注明条目 ID、涉及的作品版本、需要修订的具体字段，以及可核对的来源。对于首创、影响关系或现实技术能力的判断，需要单独的证据，不能由本目录中的代表作品或相关链接直接推定。

## 静态阅读、预渲染与信息架构

网站现已增加独立静态阅读层，原有 hash 交互入口继续兼容。已提交的 HTML 可以直接由 GitHub Pages 托管；维护者修改数据后，需要先运行下面的本地生成器，再发布更新后的静态文件。托管服务本身不需要执行新的构建流程。

| 入口 | 用途 |
| --- | --- |
| `/scifi-atlas/` | 交互首页；初始 HTML 含 4 条精选预览和完整目录链接 |
| `/scifi-atlas/catalog/` | 无需 JavaScript 的语义目录，包含全部 20 个主题锚点和每条记录的标题、作品与设想 |
| `/scifi-atlas/ideas/SF019/` | 一条创意的独立阅读页，具有真实 HTML 文件及自身的 canonical URL |
| `/scifi-atlas/#/idea/SF019` | 保留的交互详情入口，与独立阅读页使用同一份目录数据 |
| `/scifi-atlas/sitemap.xml` | 首页、静态目录和独立详情页的 canonical URL 清单 |

独立详情页保留作品题名、作者或主创、机制、分析、边界、版本说明、证据限制、全部来源及相关条目。它加载轻量的 `assets/entry.js`，不加载 `assets/app.js` 或全量 `data/catalog.json`。收藏与复制链接按钮在增强脚本初始化成功后出现；禁用 JavaScript 时，正文、来源、相关条目及返回目录链接仍然可用。完整静态目录本身不加载 JavaScript。

首页的预览由生成器维护，当前选用 `SF001`、`SF008`、`SF135`、`SF201`。预览使用实体详情链接，因此模块加载失败时也可以继续阅读。生成器只替换 `index.html` 中 `<!-- ATLAS_PREVIEW_START -->` 与 `<!-- ATLAS_PREVIEW_END -->` 之间的内容；两个标记和其余文件内容逐字保留。编辑首页时应保留这一对唯一且有序的标记。

### 生成与核对

```bash
node scripts/build-static.mjs
node scripts/build-static.mjs --check
node --test tests/static-build.test.mjs
```

生成器只依赖 Node.js 内置模块及站点已有的纯函数模块，不需要安装额外包。输入是 `data/catalog.json`，输出是 `catalog/index.html`、`ideas/SFxxx/index.html`、`sitemap.xml` 和首页的受控预览区域。数据文件、下载的 Excel、首页预览区域外的内容及仓库根配置均不由生成器修改。

相同输入产生相同输出。正常构建只写入实际变化的文件；`--check` 只比较，不写入文件，并在文件缺失、内容过期或存在已失效的生成页时以非零状态结束。删除条目后，正常构建只清理带有本生成器标记的过期详情页，不会删除同目录中的手工文件。

公开部署地址默认是 `https://chaoyue0307.github.io/scifi-atlas/`。部署地址变化时，生成与核对都应传入同一个站点目录 URL，并同步核对主入口的元数据：

```bash
node scripts/build-static.mjs --base-url https://example.github.io/scifi-atlas/
node scripts/build-static.mjs --check --base-url https://example.github.io/scifi-atlas/
```

静态构建测试覆盖实际记录的页面与链接完整性、JSON-LD 与正文一致性、CSP 哈希、恶意文本和危险来源 URL、无效 ID 与关联引用、首页受控区域保护，以及构建确定性和只读核对行为。数据原文不会因预渲染而被重新解释或改写。

### 可索引页面与安全边界

独立页以 `WebPage` 描述本站的创意条目，原作品仅作为 `about` 引用对象；不会把原作者误署为本站文章作者。目录使用 `CollectionPage` 和 `ItemList`，页面提供 `BreadcrumbList`。结构化数据反映可见内容，不新增未经核实的发表日期、修改日期、许可证、首创判断或独立作品数量。JSON-LD 的存在不保证搜索排名或富结果展示。

每页的 canonical、Open Graph URL 和 sitemap 使用真实的独立路径，不将 hash 状态当作独立可索引页面。Google 的 [JavaScript SEO 指南](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)说明了 fragment 路由的发现限制与预渲染的作用；[结构化数据指南](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)要求标记与用户可见内容相符。

生成页面使用早置的 meta CSP，允许同源资源，并为页内 JSON-LD 的确切内容计算 SHA-256；不启用 `unsafe-inline`。引用来源仅接受 HTTP(S)，新窗口外链保留 `noopener noreferrer`，页面提供 `strict-origin-when-cross-origin` referrer 策略。meta CSP 不支持 `frame-ancestors`、报告模式等部分响应头能力，不能将其当成已配置服务器响应头；详见 [CSP 规范的 meta 交付说明](https://www.w3.org/TR/CSP3/#meta-element)。

网站文件位于 `scifi-atlas/`；仓库另增加仅针对本目录的 `.github/workflows/scifi-atlas.yml` 质量检查。不创建子目录级 `robots.txt`，因为有效的 robots 文件必须位于站点主机根目录；参见 [Google robots.txt 文档](https://developers.google.com/crawling/docs/robots-txt/create-robots-txt)。本项目的 sitemap 可由站点所有者在 Search Console 提交，无需为此修改仓库根目录配置。静态页引用 `manifest.webmanifest`，目前不引用尚不存在的 Open Graph 图片。


## 维护与自动验证

运行时保持原生模块和同源静态资源，不依赖 CDN、第三方字体、分析 SDK 或后端账号。页面的可访问状态、浏览器历史、输入法组合输入、减少动画偏好和手机触控尺寸在主控制器与样式中维护。独立页脚本与主应用共用收藏存储模块，正常写入前重读最新集合；存储写入失败时保留本页会话内的更改，并给出准确的临时保存提示。

代码职责补充：`assets/reading-list.js` 负责可信编号的导入解析，`assets/bookmark-store.js` 处理持久存储和失败回退，`assets/downloads.js` 生成浏览器下载，`assets/entry.js` 为静态详情提供渐进增强。所有生成页面都来自同一份目录文件。

GitHub Actions 只在本项目或其工作流变更时运行，权限为 `contents: read`。检查包括 Node 单元测试、静态页面是否过期、Chromium 与 WebKit 的关键用户流程、多个视口的布局、axe 自动可访问性扫描，以及可供人工复核的截图。它不负责发布，也不替代人工读屏测试、全部浏览器测试或来源内容的学术核查。站点发布继续沿用仓库的 GitHub Pages 流程。

浏览器检查先在仓库根目录启动 HTTP 服务，使测试路径与线上 `/scifi-atlas/` 一致：

```bash
# 仓库根目录，一个终端
python3 -m http.server 4173 --bind 127.0.0.1

# scifi-atlas 目录，另一个终端
npm ci
npx playwright install --with-deps chromium webkit
npm run test:browser
```

可用 `ATLAS_TEST_URL` 显式指定站点入口。测试仅针对项目本身，不批量请求第三方来源。报告和截图写入 `qa-output/`，不会随网站文件提交。完整 JSON 使用原始顶层数据结构；下载按钮只能确认文件已交给浏览器处理，实际保存位置由浏览器与用户设置决定。
