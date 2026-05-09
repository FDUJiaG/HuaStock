# 华研究 · HuaStock

基于华研究体系的 AI 研究平台，覆盖 A 股、美股、港股的券商级研究报告。

🌐 **GitHub Pages**: `https://FDUJiaG.github.io/HuaStock/`

---

## 📂 目录结构

```
HuaStock/
├── index.html            ← 研究报告门户（由 build.js 自动生成）
├── build.js              ← 构建脚本（扫描 Stocks/ 生成 index.html）
├── config.json           ← 站点配置
├── favicon.jpg           ← 网站图标 / 页面 Logo
├── package.json          ← npm 构建命令
├── Stocks/               ← 研究报告目录
│   ├── A-Shares/         ← A 股研究报告
│   │   ├── 海螺水泥六维投资分析报告.html
│   │   ├── 三大白酒股综合对比分析_20260508.html
│   │   └── 磷化工四标的对比分析与投资意见_20260508.html
│   ├── HK-Stocks/        ← 港股研究报告
│   │   └── 大新金融与大新银行集团_综合评分报告.html
│   └── US-Stocks/        ← 美股研究报告
│       ├── CME_Group_深度分析报告_20260429.html
│       └── lululemon-LULU-深度研究报告.html
└── .github/workflows/
    └── pages.yml         ← GitHub Actions 自动构建部署
```

---

## 🚀 使用流程

### 1️⃣ 添加研究报告

将新写的 HTML 报告放入对应分类文件夹：

```
Stocks/A-Shares/   ← A 股报告放这里
Stocks/HK-Stocks/  ← 港股报告放这里
Stocks/US-Stocks/  ← 美股报告放这里
```

### 2️⃣ 构建索引页（本地预览）

```bash
node build.js
```

脚本会自动：
- 递归扫描 `Stocks/` 下所有 `.html` 文件
- 提取每份报告的 `<title>` 标签作为显示标题，自动去除尾部日期修饰
- 提取每份报告的**实际报告日期**（分析日期 / 报告日期 / 生成时间）
- 按分类分组（A 股 / 港股 / 美股），按报告日期倒序排列
- 读取 `favicon.jpg` 作为页面图标和左上角 Logo
- 生成带交互过滤、搜索、分类统计的专业 `index.html`

打开 `index.html` 即可本地预览。

### 3️⃣ 推送到 GitHub（自动部署）

```bash
git add .
git commit -m "添加 [报告名称]"
git push
```

GitHub Actions 会自动执行 `node build.js` 并将结果部署到 **GitHub Pages**。

> 💡 首次推送后需在 GitHub 仓库 Settings → Pages 中确认部署源为 **GitHub Actions**。
> 之后每次 push 都会自动构建并更新页面。

---

## 📐 文件命名规范

> ⚠️ **已有文件不会被重命名**，以下仅针对新增文件。

**推荐格式：**

```
{公司名或品牌}-{股票代码}-{报告类型}.html
```

| 分类 | 推荐示例 | 说明 |
|------|----------|------|
| **A 股** | `宁德时代-300750-深度研究.html` | 中文公司名 + 六位代码 |
| **港股** | `Tencent-0700-财报点评.html` | 英文品牌名 + 四位代码 |
| **美股** | `Nvidia-NVDA-行业分析.html` | 英文品牌名 + 美股 Ticker |

**报告类型后缀：**

| 类型 | 适用场景 |
|------|----------|
| `深度研究` | 全面深入的公司基本面分析 |
| `财报点评` | 季报/年报业绩点评 |
| `行业分析` | 行业赛道研究 |
| `业绩点评` | 业绩快报点评 |
| `估值模型` | DCF / 估值建模 |
| `专题报告` | 特定主题研究 |

> 💡 文件名和 `<title>` 标签中均**无需包含日期**，日期只需写在报告正文中（如 `分析日期：2026-05-09`），构建脚本会自动提取并展示在卡片上。

---

## ⚙️ 构建原理

`build.js` 是一个纯 Node.js 脚本（零外部依赖），工作原理：

1. **递归扫描** `Stocks/` 下的所有 HTML 文件
2. **提取标题** — 读取 `<title>` 标签，并自动去除末尾的时间尾缀（如 `— 2026年4月`）
3. **提取报告日期** — 智能识别正文中的日期标签，按优先级匹配：
   - `<div class="date">` 标签内的日期
   - `分析日期：` / `报告日期：` / `生成时间：` / `发布日期：` 等关键词
   - 支持 `YYYY年M月D日`、`YYYY-MM-DD`、`YYYY.M.D` 等多种格式
4. **提取简介** — 尝试从 `<meta description>` 或首个 `<h1>/<h2>` 获取摘要
5. **按分类分组** — 根据 `A-Shares / HK-Stocks / US-Stocks` 子文件夹名归类
6. **排序** — 按报告日期倒序（最新在前），无日期文件按修改时间兜底
7. **渲染** — 生成 Tailwind CSS 美化的 `index.html`（含搜索、过滤、卡片动画）

生成的 `index.html` 内置完整的交互功能：分类过滤、实时搜索、报告日期展示、分类统计计数，完全自包含，无需服务器。

---

## 🧩 技术栈

| 组件 | 方案 |
|------|------|
| 静态站点生成 | 自研 `build.js`（零依赖） |
| CSS 框架 | Tailwind CSS（CDN） |
| 字体 | Inter + Noto Serif SC |
| 自动部署 | GitHub Actions → GitHub Pages |
| 交互 | 原生 Vanilla JS（过滤/搜索/动画） |
