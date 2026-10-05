# Global Edition v3.0 — now live

The current homepage is the multilingual global explorer. See [GLOBAL_EDITION.md](GLOBAL_EDITION.md) for the new coverage, methods, limitations and tests. The complete v2 application remains at [research.html](research.html). Original v2 documentation is preserved below.

---

# Health Atlas · 人类健康图谱

全球、中国、新加坡的疾病证据库与多病共存情景实验。研究版 **2.0.0**，来源复核截止 **2026-10-05**。

## 首先明确完成范围

这是可运行的静态网站，**不是已经完整填齐的全疾病、全人口、统一年度数据库**。

当前有203条证据记录（其中171条本轮复核、4条历史版本、28条待复核），以及IHME官方GBD2023 `Results by Measure` 工作簿的381个有效Cause目录行，其中370行标有患病率指标。目录包含父类、子类和汇总，381不是381种独立疾病。逐项覆盖矩阵会显示每个地区尚未填入的数据。数据没有被默认为零。

原始181条记录全部保留，旧估计有历史标记；本轮补入22条资料。三地同口径完整GBD患病人数导出尚未取得，因此不能计算真实的“绝对健康人数”。官方目录完整导入，**不等于**全部患病数据完成更新。

## 网站功能

- 全球/中国/新加坡总览；各自清单与分母独立说明。
- 疾病关键词、系统、年份、地区、证据状态、指标和排序筛选。
- 逐条来源抽屉：原始值、数据年份、核验日、适用人群、不确定性区间、病例口径。
- 共病模拟：清单开关、潜变量相关参数ρ、指标相对降低、基线对照、项数分布和1,000点人口示意。
- 同源三地对照：IDF2024糖尿病、GLOBOCAN2024癌症5年患病人数。
- 官方目录的逐地区覆盖矩阵和版本更新记录。
- URL保存筛选/模拟参数；本机localStorage保存和恢复一个情景。
- 本地CSV/JSON导出；打印；键盘导航；移动端布局；减少动态效果偏好。
- 浏览器内GBD CSV导入（仅公共聚合数据），先进入待审核队列，不自动进入模型、不上传。

## 运行

无需Node构建、API密钥、付费服务或前端CDN：

```bash
python -m http.server 8000
# 打开 http://localhost:8000/
```

将整个目录放在GitHub Pages站点的 `health-atlas/` 子目录即可。所有资产用相对路径，散列路由不依赖服务器重写；不会覆盖根目录的个人主页。

## 数据文件

`data/evidence.json` 是证据主档；`data/catalogue.json` 是官方目录映射；`data/panels.json` 是单独审核过的模型输入；`data/atlas.json` 包含完整快照和160节点积分参数；`data.js` 是浏览器运行快照。修改主档后执行：

```bash
python scripts/build_data.py
node tests/engine.test.cjs
```

新证据并不会自动修改模型概率。模型输入必须独立审查人群、年度、指标和重复分类。

### GBD导入

浏览器“方法与来源”页面可以读取不超过10MB/25,000行的CSV；刷新后会清除本次导入。也可运行：

```bash
python scripts/import_gbd.py official-export.csv --output pending.json
```

需要英文列名：`measure_name, metric_name, location_name, sex_name, age_name, cause_id, year, val`。仅接收 `Prevalence / Number / Both / All ages / Global|China|Singapore`。不把年龄标准化率乘总人口，不自动合计父类和子类，不把导入等同审核。脚本不会覆盖发布文件。

## 模型与限制

若每个指标为二元变量，则 `K=ΣXi`，`E[K]=Σpi`。均值不依赖独立假设，但要求同一人群/时期/清单的边际率。

相关情景使用 `Zi=√ρ·Z+√(1−ρ)·εi` 和 `Xi=1[Zi<Φ⁻¹(pi)]`，条件Poisson-binomial动态规划加160节点Gauss–Hermite积分。ρ是潜变量相关，不是实测疾病相关系数。模型数值正确不代表假设真实。

- 全球26项：混合来源年、年龄窗和疾病大类，按82亿虚拟尺度转换。**不是当前全球真实人均疾病数**。清单没有包括所有疾病。
- 中国12项：2018年全国≥18岁调查；四舍五入边际率均值1.6610。原文零项26.50%、至少两项46.50%。不等于中国2026年现状。
- 新加坡5项：NPHS2023–2024体检，18–74岁居民，均值1.0100。只有边际率，不能确定真实零项比例。2025年新发布报告为访谈，不替代旧体检波次。
- 癌症5年患病不等于当前活动性肿瘤；心理困扰筛查不等于抑郁症；单次肾功能指标不等于已证实持续3个月的CKD。
- 删除指标/降低边际率是静态敏感性操作，不是治疗因果效应、疾病消灭预测或公共卫生建议。
- 未建模年龄/性别联合分层、严重程度、死亡、动态病程、治疗、功能与主观健康；不能进行国家健康排名或个人诊断。

## 本轮新增/更新举例

头痛2023约29亿、主要口腔疾病2023约37.3亿、全球MASLD2023约13亿；中国2023骨关节炎161,742,448、腰痛95,323,956、类风湿关节炎4,985,071、痛风17,672,308。全球肌肉骨骼总类2023为1,724,263,000，仅参考，不与子类相加。原始来源及区间均保存在逐行数据中。“已复核”不等于已证明全网绝对最新。

## 测试

```bash
node tests/engine.test.cjs
python -m pip install playwright
python -m playwright install chromium
python tests/browser.py
```

数学测试涵盖各面板、多ρ、归一性、非负性、均值保持、Fréchet界、1,000点配额、边界输入、来源关联。浏览器测试覆盖桌面/手机六视图、筛选、详情、参数、保存恢复、导出与CSV隔离导入。页面内也有数值自检按钮。

## 隐私与许可

没有追踪器、后台或登录。公共资料可以随GitHub Pages公开；不要将个人医疗记录放入公开仓库。CSV导入在浏览器内处理。原始科学资料的许可属于原提供者，IHME相关数据使用应遵守其条款，不因本项目代码为MIT而获得新的商业数据授权。仓库不重新分发全文论文或字体文件。
