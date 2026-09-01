# 原 Toolora UI 像素级拆解

Status: reference analysis
Date: 2026-09-01
素材来源：`docs/research/project/toolora/`（完整源码快照）与 https://toolora.tools/keyword-ranking 实测 DOM。

本文以像素级还原为目标，逐一拆解原 Toolora 的每个界面、组件与交互元素，并总结其 CSS 实现逻辑、设计规范与可复用样式体系。落地时的边界与 [`decision.md`](./decision.md) 一致：参考结构与视觉，不复制其 Key 列、导出 + Key、语言切换等产品行为。

---

## 1. 全局基础层

### 1.1 文档骨架

```tsx
// app/layout.tsx
<html className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
  <body className="mx-auto flex min-h-full max-w-7xl px-4">
```

- 根布局即锁定内容宽度：`max-w-7xl`（1280px）+ `mx-auto`，移动端 `px-4`（16px）。
- `[locale]/layout.tsx` 内再包一层 `<main className="... flex min-h-screen w-full flex-col font-sans">`，页头与页面内容纵向排列。

### 1.2 页面容器（工具页）

```tsx
// keyword-ranker-view.tsx
<div className="relative mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-0">
  <div className="space-y-8"> {/* 各区块以 32px 垂直节律堆叠 */}
```

- 断点内边距：`px-4`（<640）→ `sm:px-6`（24px）→ `lg:px-0`（≥1024 时卡片直接贴 max-w-7xl 边缘）。
- `py-8`：页面上下各 32px 呼吸。
- 区块间距唯一值：`space-y-8` = 32px。整个工具页只有这一种区块级垂直间距。

### 1.3 字体系统

- 拉丁字符：Geist（`--font-geist-sans`）+ Geist Mono（`--font-geist-mono`），均 `next/font/google`、`subsets: ["latin"]`。
- 中文字符：**未加载任何中文 webfont**，Geist 不含 CJK，中文回落系统字体（实测解析为 Noto Sans SC / 系统默认黑体）。字体家族不是设计差异点，字号才是。
- `font-sans` = `--font-sans`，`font-mono` = Geist Mono；mono 在 UI 中承担"微标签"角色（见 §3 排版标尺）。

### 1.4 字号标尺（全站实测汇总）

| 级别 | class | 像素 | 字重 | 字距 | 使用位置 |
| --- | --- | --- | --- | --- | --- |
| 页面主标题 | `text-4xl tracking-tighter` | 36 | bold(700) | -0.05em | Hero H1 |
| 首页栏目标题 | `text-3xl tracking-tight` | 30 | bold | -0.025em | 工具网格 H1 |
| 区块标题 | `text-2xl tracking-tight` | 24 | bold | -0.025em | 工作区/结果/抽屉标题 |
| 卡片标题 | `text-xl tracking-tight` | 20 | bold | -0.025em | 首页工具卡标题 |
| 强调行 | `text-lg font-bold tracking-tight` | 18 | bold | -0.025em | 搜索区命令提示 |
| 正文/输入 | （无 class，继承） | **16** | 400 | — | 输入框、textarea、表格关键词/排名列 |
| 标签/正文辅助 | `text-sm` | 14 | 表单标签 bold(700)、正文 400 | — | 表单标签、按钮、描述文字、URL 列 |
| 辅助小字 | `text-xs` | 12 | medium/bold | — | Key 列、分页文字、抽屉动作按钮 |
| 微标签 | `font-mono text-[10px] tracking-widest uppercase` | 10 | 400/500 | +0.1em | 表头、指标标签、RUN HINT、徽章、胶囊 |

核心节奏：**16 / 14 / 10** 三级文字尺寸覆盖 95% 的界面；标题另起 36/24/20 一族，全部 `tracking-tight(er)` 收紧。

> 关键结论：原站的表单输入、textarea、表格主体文字都是 **16px**（控件无 text-* class，继承 body）。这是它"看起来舒展"的最大单一因素。

---

## 2. 设计令牌

### 2.1 颜色（与我们的实现几乎同源）

浅色 `:root`：

| 令牌 | 值 | 说明 |
| --- | --- | --- |
| `--background` / `--card` / `--popover` | `oklch(1 0 0)` | 纯白三面同色 |
| `--foreground` | `oklch(0.145 0 0)` | 近黑 |
| `--primary` | `oklch(0.205 0 0)` | 主按钮 = 近黑（黑白极简） |
| `--primary-foreground` | `oklch(0.985 0 0)` | |
| `--muted` / `--secondary` / `--accent` | `oklch(0.97 0 0)` | 三者同值的浅灰 |
| `--muted-foreground` | `oklch(0.556 0 0)` | 中灰文字 |
| `--border` / `--input` | `oklch(0.922 0 0)` | 1px 细边框灰 |
| `--destructive` | `oklch(0.577 0.245 27.325)` | |
| `--ring` | `oklch(0.708 0 0)` | |

深色 `.dark`：`--background: oklch(0.145)`、`--card: oklch(0.205)`、`--primary: oklch(0.922)`（**primary 反转为亮色**）、`--border: 白 10%`、`--input: 白 15%`、`--muted/--secondary/--accent: oklch(0.269)`。

与我们令牌的可忽略差异：深色 `--primary`（ref 0.922 vs 我们 0.87）、`--destructive` 色域微差。计算出的圆角刻度完全一致（见下）。

### 2.2 圆角体系（比例式换算，`--radius: 0.625rem` = 10px）

| class | 计算 | 像素 | 用途 |
| --- | --- | --- | --- |
| `rounded-lg` | 1.0× | **10** | 按钮基线、分页按钮、分类图标座 |
| `rounded-xl` | 1.4× | **14** | 表单控件（input/select）、CTA、Run Hint 盒、关闭钮 |
| `rounded-2xl` | 1.8× | **18** | 状态横幅、内嵌表格容器、策略选择卡、抽屉 textarea、空状态 |
| `rounded-3xl` | 2.2× | **22** | 指标卡、首页工具卡 |
| `rounded-4xl` | 2.6× | 26 | 仅 Badge |
| `rounded-[2rem]` | — | **32** | 一级区块卡（Hero/工作区/结果/搜索区） |
| `rounded-[2.5rem]` | — | **40** | 抽屉内的二级分区卡 |
| `rounded-full` | — | — | 状态胶囊、主题切换钮 |

层级逻辑清晰：**区块 32 → 分区 40（浮层内）→ 卡 22 → 面板 18 → 控件 14 → 按钮 10**。圆角随面积增大而增大，随交互层级下移而减小。

### 2.3 阴影与描边策略

- 卡片平时**无阴影**：`border border-border`（1px oklch 0.922）承担边界；ref 的 Card 原语用 `ring-1 ring-foreground/10` 替代边框，同样是 1px 无投影。
- 阴影只出现在"抬升时刻"：工具卡悬停 `hover:shadow-2xl hover:shadow-primary/5`、激活分类 `shadow-lg shadow-primary/20`、抽屉主按钮 `shadow-lg shadow-primary/20`。
- 阴影永远带主色染色（`shadow-primary/N`），不是黑色投影。

### 2.4 交互过渡

- 通用 `transition-all` / `transition-colors`（150ms 默认时长）。
- 抽屉滑入：`transition-transform duration-200 ease-out` + backdrop `transition-opacity duration-200`。
- 主题切换：View Transitions API 圆形揭示 0.7s（`clip-path: circle()` 从点击坐标扩散），`prefers-reduced-motion` 不适用时才生效。

---

## 3. 模块拆解

### 3.1 全局页头（Header）

```tsx
<header className="border-border flex items-center justify-between px-4 py-6 sm:px-6 lg:px-0">
  <span className="text-2xl font-bold tracking-tighter">Toolora</span>
  {/* 右侧：语言切换（我们不采用）+ ThemeToggle */}
```

- 结构：单行 `justify-between`；左词标 24px bold tighter；右侧按钮组 `gap-2`。
- 内边距与页面容器同步（`px-4 sm:px-6 lg:px-0`），`py-6` = 24px。
- 主题切换钮：`rounded-full p-2`（36px 命中区）+ `active:scale-90` 按压反馈，图标 `h-5 w-5`（20px），无 边框无背景。

### 3.2 Hero 卡（工具页头）

```tsx
<div className="border-border bg-card/50 relative overflow-hidden rounded-[2rem] border p-8">
  <h1 className="mb-4 text-4xl font-bold tracking-tighter">…</h1>
  <p className="text-muted-foreground max-w-3xl leading-relaxed">…</p>
```

- `rounded-[2rem]`(32) + 1px 边框 + `bg-card/50`（在白背景上=白，但深色下比 card 略暗，制造层次）+ `p-8`(32)。
- H1 36px bold tighter，`mb-4`(16)；描述 16px muted，`max-w-3xl`(768px) 限宽 + `leading-relaxed`(1.625)。

### 3.3 查询工作区卡（表单容器）

```tsx
<section className="border-border bg-card relative overflow-hidden rounded-[2rem] border p-8">
  <div className="mb-8 flex items-start justify-between">
    <h3 className="mb-2 text-2xl font-bold tracking-tight">查询工作区</h3>
    <Button variant="outline" className="gap-2"><Settings size={16}/>打开设置</Button>
  </div>
  <div className="space-y-6"> …字段组… </div>
```

- 区块卡基准：`rounded-[2rem] border p-8`，标题行 `mb-8`(32)。
- 卡头：左 24px bold 标题 + 右 outline 按钮（h-8、`gap-2`、16px 图标）。
- **表单直接铺在卡上**（无嵌套面板/无底色分组）；字段间 `space-y-6`(24)。

### 3.4 表单控件规范（原站为裸 HTML + utility，不用 Input 原语）

所有控件共享一个"字段配方"：

```tsx
<div className="space-y-2">              {/* 字段组：标签与控件间距 8px */}
  <label className="text-sm font-bold">域名或 URL</label>   {/* 14px bold */}
  <input className="… mt-2 h-12 w-full rounded-xl border border-border
      bg-background/50 px-4 transition-all outline-none
      focus:border-primary focus:ring-4 focus:ring-primary/20" />
</div>
```

| 控件 | 尺寸 | 圆角 | 内边距 | 焦点态 |
| --- | --- | --- | --- | --- |
| 域名 input | `h-12`(48) 全宽 | 14 | `px-4`(16) | `border-primary` + `ring-4 ring-primary/20` |
| 关键词 textarea | `rows=5`（约 144px）固定，`resize-none` | 14 | `px-4 py-3` | 同上 |
| 国家/语言/深度 select | `h-12` 全宽 | 14 | `px-4` | 仅 `outline-none`（原生焦点） |
| 抽屉 Key textarea | `rows=6` | **18** | `px-5 py-4` + `font-mono text-sm` | `ring-primary/10`（更淡） |

- 控件底色 `bg-background/50`：浅色下即白，深色下比 card 暗 50%，形成"内凹输入面"。
- 标签→控件实际间距 16px（`space-y-2` 的 8px + 控件自身 `mt-2` 的 8px）。
- 三联设置（国家/语言/深度）：`grid grid-cols-1 gap-4 md:grid-cols-3`——**768px 以下纵向堆叠，gap 16px**。
- 全部为 `<select>` 下拉，选项为英文名（国家 202 项、语言 44 项，码表在 `lib/search-config.ts`）。

### 3.5 Run Hint + CTA 行

```tsx
<div className="flex flex-col gap-4 md:flex-row md:items-stretch">
  <div className="bg-muted/50 border-border flex-1 rounded-xl border p-4">   {/* 提示盒 */}
    <p className="… font-mono text-[10px] tracking-widest uppercase">RUN HINT</p>
    <p className="text-muted-foreground text-xs">…规则说明…</p>
    <p className="mt-2 font-mono text-xs">预计 SerpAPI 尝试次数：36</p>     {/* 数字用 mono */}
  </div>
  <div className="flex flex-col gap-2 sm:flex-row md:min-w-64">              {/* 按钮组 */}
    <Button className="min-h-14 flex-1 gap-2 rounded-xl px-8 md:h-auto">开始查询 <ArrowUpRight size={18}/></Button>
```

- 提示盒：`bg-muted/50` + 1px 边框 + `rounded-xl`(14) + `p-4`(16)；内部三层：微标签(10px mono) → 说明(12px muted) → 预估数(12px mono，间距 8px)。
- CTA：`min-h-14`(56px，移动端整行高) / `md:h-auto` 由 padding 决定，`rounded-xl`、`px-8`(32)、`gap-2`、图标 18px；运行中变暂停（按钮内嵌 `processed/total` 进度文字）。
- 布局：移动端提示盒与按钮纵向堆叠（`gap-4`），≥768 横排（`items-stretch` 等高，按钮组 `md:min-w-64`=256px）。

### 3.6 状态横幅（RankerStatus）

```tsx
<div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-4 text-sm font-medium
     text-green-600 dark:text-green-400">
  <span className="mr-2 font-mono font-bold">STATUS / SUCCESS</span> 查询完成。… 
```

- 配方：`rounded-2xl`(18) + `border-{c}-500/20`(10% 描边) + `bg-{c}-500/10`(10% 底) + `p-4` + `text-sm font-medium` + `text-{c}-600 dark:text-{c}-400`。
- 三色语义：成功 green、暂停/部分 yellow、失败/错误 red。
- 前缀为英文 mono 粗体状态码（我们落地时保留横幅配方、前缀文案中文化决策见 §7）。

### 3.7 指标卡（RankerMetrics）

```tsx
<div className="grid w-full grid-cols-2 gap-4 lg:grid-cols-4">
  <div className="border-border bg-card flex flex-col rounded-3xl border p-6">
    <p className="text-muted-foreground mb-2 font-mono text-[10px] tracking-widest uppercase">已找到</p>
    <p className="text-4xl font-bold tracking-tighter">15</p>
```

- 卡：`rounded-3xl`(22) + 1px 边框 + **纯 bg-card 无彩色底** + `p-6`(24)。
- 标签：微标签配方（10px mono uppercase widest muted），`mb-2`。
- 数值：**36px bold tighter**——大数字是这一区的视觉主角。
- 响应式：2 列（<1024）→ 4 列；间距 16px。
- 无图标、无色块、无分隔线——克制到只剩排版。

### 3.8 结果卡（RankerResults）

```tsx
<section className="border-border bg-card overflow-hidden rounded-[2rem] border p-8">
  <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
    <h3 className="text-2xl font-bold tracking-tight">最近一次结果快照</h3>
    <div className="flex gap-2">导出按钮组（h-8 outline + default）</div>
```

容器与工作区卡同配方；表头行同 `mb-8`。

表格（外层 `overflow-x-auto`，移动端横向滚动）：

| 元素 | class 细节 |
| --- | --- |
| `<table>` | `w-full border-collapse text-left`（无 text-sm → 关键词/排名列 16px） |
| `<thead><tr>` | `border-b`（1px 分隔线，无底色） |
| `<th>` | `px-4 py-4 font-mono text-[10px] tracking-widest uppercase text-muted-foreground` |
| 关键词列 | `px-4 py-4 font-medium`（16px medium） |
| 排名列 | `px-4 py-4 font-mono`（16px mono） |
| URL 列 | `max-w-50 truncate px-4 py-4 text-sm text-muted-foreground`（200px 截断） |
| Key 列 | `font-mono text-xs text-muted-foreground`（**我们不采用**） |
| 行 `<tr>` | `hover:bg-accent/30 transition-colors`；行间 `divide-y`（1px） |
| 行高 | `py-4`×2 + 24 行高 ≈ **56px/行** |
| 状态胶囊 | `rounded-full px-2 py-1 text-[10px] font-bold uppercase`（设置表内多一个 `tracking-wider`） |

胶囊配色矩阵（唯一引入色相的地方）：

| 状态 | 底 | 浅色文字 | 深色文字 |
| --- | --- | --- | --- |
| 已找到 | `bg-green-500/10` | `text-green-600` | `text-green-400` |
| 未找到 | `bg-yellow-500/10` | `text-yellow-600` | `text-yellow-400` |
| 失败/耗尽 | `bg-red-500/10` | `text-red-600` | `text-red-400` |
| 限频 | `bg-yellow-500/10` | `text-yellow-600` | `text-yellow-400` |

### 3.9 分页器

```tsx
<div className="border-border mt-8 flex flex-col gap-4 border-t pt-8 md:flex-row md:items-center md:justify-between">
  <div className="flex items-center gap-4">
    <span className="text-muted-foreground text-xs font-medium">每页展示</span>
    <select className="border-input bg-background h-9 rounded-lg border px-3 text-xs font-bold outline-none">…10/20/30/40/50…</select>
  </div>
  <div className="flex items-center gap-2">
    <Button variant="outline" className="h-9 px-4 text-xs font-bold">上一页</Button>
    {/* 页码按钮组：`h-9 w-9 rounded-lg text-xs font-bold`，
        当前页 `bg-primary text-primary-foreground`，其余 `border border-input bg-background hover:bg-accent`，
        >7 页时两侧省略号（`h-9 w-9` 占位） */}
    <Button variant="outline" className="h-9 px-4 text-xs font-bold">下一页</Button>
```

- 与表格以 `mt-8 pt-8 border-t` 分隔（32px 间距 + 1px 细线，和表头行呼应）。
- 控件统一 **h-9(36px)**、`rounded-lg`(10)、`text-xs font-bold`；页码为 36×36 方块。
- 页码窗口算法：≤7 页全显；否则 `[1] … [c-1,c,c+1] … [N]`。

### 3.10 设置抽屉（RankerSettings）

```tsx
<div className="bg-background/80 fixed inset-0 z-50 backdrop-blur-sm transition-opacity duration-200" />   {/* 背板 */}
<div className="bg-card border-border fixed top-0 right-0 z-50 h-full w-full max-w-4xl
     overflow-y-auto border-l p-8 transition-transform duration-200 ease-out
     translate-x-full | translate-x-0">                                                                      {/* 抽屉 */}
```

- 背板：`bg-background/80` + `backdrop-blur-sm`，200ms 淡入；点击关闭。
- 抽屉：右侧全高、`max-w-4xl`(896px)、`border-l`、`p-8`；200ms `ease-out` 平移入场；Escape 关闭。
- 内容列：`mx-auto max-w-3xl space-y-12 pb-12`——**分区间距 48px**，比页面区块(32)更松，底部 48 留白。
- 头行：24px bold 标题 + 关闭钮 `h-10 w-10 rounded-xl border border-input hover:bg-accent`（40×40，图标 18px）。
- 二级分区卡（Key 池/策略/健康）统一配方：`rounded-[2.5rem] border border-border bg-accent/30 p-8` + 三行头部（微标签 10px mono → 24px bold 标题 `mb-3` → 14px muted 描述 `max-w-xl leading-relaxed`）。
- 动作按钮：`flex-1 rounded-xl py-4 text-xs font-bold tracking-widest uppercase`（高由 py-4 撑起 ≈48px，主按钮带 `shadow-lg shadow-primary/20`）。
- 策略选择卡（单选）：`rounded-2xl p-5 text-left transition-all`；选中 `border-2 border-primary bg-primary/5 shadow-sm`，未选 `border hover:border-primary/50`——**用 2px 主色描边表达选中**。
- Key 健康表：容器 `rounded-2xl border bg-card/50`，表头 `bg-muted/30 border-b` + 微标签配方，数据列 `font-mono text-xs`，行 `hover:bg-accent/20`。

### 3.11 首页目录

- 搜索区：外卡 `rounded-[2rem] border bg-card/50 p-6 sm:p-8`，`mb-12`(48) 与目录区隔；内部 `grid-cols-1 md:grid-cols-[200px_1fr_140px] gap-4`。
  - 命令提示块（`hidden md:flex`）：`rounded-2xl border bg-background/50 px-6 py-3`，18px bold 标题 + 10px mono 副注。
  - 搜索输入：`min-h-13`(52px) `rounded-2xl bg-background/80 pl-12 text-lg font-medium`，左内嵌 Search 图标 20px（`group-focus-within:text-primary` 联动变色），焦点 `ring-4 ring-primary/10 + border-primary + bg-background`。
  - 搜索按钮：`min-h-13 rounded-2xl gap-2` + 18px 图标。
- 分类导航：左栏 `lg:grid 280px` 固定，`lg:sticky lg:top-8`；按钮 `rounded-xl p-3`，选中 `bg-primary text-primary-foreground shadow-lg shadow-primary/20`，未选 `text-muted-foreground hover:bg-accent`；左侧 32×32 图标座（`rounded-lg bg-muted`），右侧 10px mono 计数（`99+`、`padStart(2,"0")`）。
- 工具网格：`gap-4 md:grid-cols-2 xl:grid-cols-3`；栏目标题 30px bold `mb-6`。
- 工具卡：`rounded-3xl border bg-card p-5 transition-all duration-300`；悬停四件套 `hover:bg-accent/50 hover:border-primary/20 hover:shadow-2xl hover:shadow-primary/5`，标题 `group-hover:text-primary`；内部 20px bold 标题 `mb-2` → 14px muted 描述 `mb-6 grow` → Badge 标签行（`h-5 rounded-4xl font-mono text-[10px]` outline 变体）`mb-6` → 全宽 h-8 主按钮（14px ArrowUpRight）。
- 空状态：`min-h-60 rounded-2xl border border-dashed p-8` 居中 14px muted 文案。

---

## 4. 按钮体系（cva 完整解析）

基线（所有变体共享）：

```
inline-flex shrink-0 items-center justify-center rounded-lg(10px) border border-transparent
text-sm(14px) font-medium whitespace-nowrap transition-all outline-none select-none
focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50
active:not-aria-[haspopup]:translate-y-px           ← 按压下移 1px
disabled:pointer-events-none disabled:opacity-50    ← 禁用 50% 透明
[&_svg]:size-4                                      ← 图标默认 16px
```

变体：`default`（bg-primary 白字）/ `outline`（border+bg-background，hover bg-muted，dark 下 bg-input/30）/ `secondary` / `ghost` / `destructive`（10% 红底+红字）/ `link`。

| 尺寸 | 高度 | 内边距 | 图标 | 备注 |
| --- | --- | --- | --- | --- |
| xs | 24 | px-2 | 12 | 圆角收敛 `min(radius-md,10px)` |
| sm | 28 | px-2.5 | 14 | 文字 `0.8rem` |
| **default** | **32** | **px-2.5** | 16 | 全站默认 |
| lg | 36 | px-2.5 | 16 | |
| CTA（工具页） | **56**（min-h-14） | **px-8** | 18 | `rounded-xl`(14) 盖写圆角 |
| 分页 | 36（h-9 盖写） | px-4 | — | `text-xs font-bold` |
| 抽屉动作 | ~48（py-4 撑） | flex-1 | — | `text-xs font-bold uppercase tracking-widest` |

焦点环统一 `ring-3`（3px），比我们 Button 原语的 ring-1 更醒目。

---

## 5. 状态变化矩阵

| 状态 | 实现 | 出现位置 |
| --- | --- | --- |
| hover 行 | `bg-accent/30` | 结果表、健康表 |
| hover 卡 | `bg-accent/50` + `border-primary/20` + `shadow-2xl(primary/5)` | 工具卡 |
| hover 按钮 outline | `bg-muted` | 全站 |
| hover 按钮 ghost | `bg-muted`（dark `muted/50`） | |
| hover 策略卡（未选） | `border-primary/50` | 抽屉 |
| focus 控件 | `border-primary` + `ring-4 ring-primary/20`（搜索区 /10） | 输入类 |
| focus 按钮 | `border-ring` + `ring-3 ring-ring/50` | 全站 |
| active 按钮 | `translate-y-px` | 全站 |
| active 主题钮 | `scale-90` | 页头 |
| disabled | `opacity-50` + `pointer-events-none` | 全站 |
| aria-invalid | 红边 + `ring-destructive/20` | 输入类 |
| 选中策略 | `border-2 border-primary bg-primary/5 shadow-sm` | 抽屉 |
| 激活分类 | `bg-primary text-primary-foreground shadow-lg(primary/20)` | 首页 |
| 当前页码 | `bg-primary text-primary-foreground` | 分页 |
| 加载中 | 按钮文字替换为 `...`（无 spinner） | 抽屉检测 |
| 运行中 | CTA 文字嵌 `processed/total` + Pause 图标 | 工作区 |

---

## 6. 响应式规则汇总

| 断点 | 变化 |
| --- | --- |
| 基线 (<640) | 页面 `px-4`；三联设置纵向；Run Hint 与 CTA 纵向；CTA `min-h-14` 全宽；结果头/分页纵向；指标 2 列；工具网格 1 列；抽屉全宽 |
| sm (≥640) | 页面 `px-6`；CTA 行内横排 |
| md (≥768) | 三联设置 `grid-cols-3`；Run Hint 行横排（按钮组 min-w-64）；结果头横排；分页两端对齐；首页搜索三栏（200/1fr/140）；工具网格 2 列 |
| lg (≥1024) | 页面 `px-0`（贴 max-w-7xl）；指标 4 列；首页左栏 280px + sticky |
| xl (≥1280) | 工具网格 3 列 |

表格永不压缩列：外层 `overflow-x-auto` 横向滚动。

---

## 7. CSS 实现逻辑与设计规范总结

1. **utility 组合术，无组件 CSS**：所有视觉由 Tailwind utility + 少量 CSS 变量完成；工具页表单甚至绕过 Input 原语用裸元素换取完全控制。
2. **三层表面体系**：`bg-background`（页面）→ `bg-card`（区块卡）→ `bg-background/50` / `bg-muted/50` / `bg-accent/30`（输入面/提示面/抽屉分区）。浅色下全白系，深色下层次立刻显现——半透明表面是深色模式的层次引擎。
3. **色相纪律**：全站灰阶（oklch 无彩度），色相只允许出现在状态叠加层，且永远是 `500/10 底 + 600 文字 + dark:400 文字` 的固定配方；阴影只允许 `primary/N` 染色。品牌感来自"黑白 + 单色微标签"，不来自彩色。
4. **mono 微标签母题**：`font-mono text-[10px] tracking-widest uppercase` 贯穿表头、指标标签、徽章、胶囊计数、RUN HINT——是全站最强的"工程感"签名。
5. **圆角层级语法**：面积越大圆角越大（区块 32 → 卡 22 → 面 18 → 控件 14 → 钮 10），全站无一处例外。
6. **间距仅四档**：区块 32 / 字段 24 / 控件组与卡片内元素 16 / 行内 8（另有抽屉分区 48、首页搜索区后 48 两个特例）。没有其它中间值。
7. **1px 边框代替阴影**，阴影只在悬停/浮层/激活出现且必带主色染色。
8. **焦点可见性**：输入 `ring-4 primary/20`、按钮 `ring-3 ring/50`——焦点环是设计元素而非附属品。

### 可复用样式配方（原子 class 串）

| 配方名 | class 串 |
| --- | --- |
| 区块卡 | `rounded-[2rem] border border-border bg-card p-8` |
| 浮层分区卡 | `rounded-[2.5rem] border border-border bg-accent/30 p-8` |
| 内嵌表面 | `rounded-2xl border bg-card/50`（表格）/ `bg-muted/50`（提示盒） |
| 字段组 | `div.space-y-2` + `label.text-sm.font-bold` + 控件 `mt-2` |
| 输入控件 | `h-12 w-full rounded-xl border border-border bg-background/50 px-4 transition-all outline-none focus:border-primary focus:ring-4 focus:ring-primary/20` |
| 微标签 | `font-mono text-[10px] tracking-widest uppercase text-muted-foreground` |
| 状态胶囊 | `rounded-full px-2 py-1 text-[10px] font-bold` + `bg-{c}-500/10 text-{c}-600 dark:text-{c}-400` |
| 状态横幅 | `rounded-2xl border border-{c}-500/20 bg-{c}-500/10 p-4 text-sm font-medium text-{c}-600 dark:text-{c}-400` |
| 指标卡 | `rounded-3xl border border-border bg-card p-6` + 微标签 + `text-4xl font-bold tracking-tighter` |
| 表头格 | `px-4 py-4 font-mono text-[10px] tracking-widest uppercase text-muted-foreground` |
| 表行 | `divide-y` + `hover:bg-accent/30 transition-colors` + 单元格 `px-4 py-4` |
| 分页控件 | `h-9 rounded-lg text-xs font-bold`（页码 `w-9` 方块，当前页 primary 底） |
| CTA | `min-h-14 rounded-xl px-8 text-sm font-medium gap-2` + 18px 图标 |
| 选中卡（单选） | `rounded-2xl p-5 text-left`；选中 `border-2 border-primary bg-primary/5 shadow-sm`，未选 `border hover:border-primary/50` |

---

## 8. 与我们当前实现的差异对照（落地清单）

按用户指示，国家/语言/深度下拉**暂缓实施**，此处先记录约束。以下按优先级排序：

| # | 差异点 | 原站 | 我们现状 | 落地决策 |
| --- | --- | --- | --- | --- |
| 1 | 输入文字 16px | 控件继承 16px | `text-sm`(14) | **改**：输入/textarea/表格主体列升到 16px |
| 2 | 焦点环 | `border-primary`+`ring-4 primary/20` | 原语 `ring-1 ring` | **改**：本页控件局部盖写 |
| 3 | 控件底色 | `bg-background/50` | `bg-background` | **改**（深色层次） |
| 4 | 标签→控件间距 16px | `space-y-2`+`mt-2` | `gap-2`(8) | **改** |
| 5 | 按钮基线 | `rounded-lg` 32px 高 `text-sm`，焦点 ring-3 | 原语 rounded-none/text-xs，页内 rounded-xl 盖写 | **改**：动作钮 `rounded-lg text-sm`，CTA 维持 56px `rounded-xl px-8` |
| 6 | 表头 | mono 10px widest uppercase | 11px wider 非 mono | **改** |
| 7 | 胶囊 | 10px bold；未找到=yellow | 11px；未找到=灰 | **改**：10px；未找到色需定夺（yellow 偏警示，语义上 Not Found 是成功结果；建议保留灰或用 yellow，见下） |
| 8 | 指标卡 | 纯白卡+mono 微标签+36px 数值 | 彩色底+圆点+24px | **改**：按原站配方（保留 3 卡布局， ours 无"总数"卡是产品差异） |
| 9 | 结果容器 | 独立 `rounded-[2rem] border p-8` 卡 | 开放区块 | **改**：在我们的壳卡内做 inset 同配方卡 |
| 10 | 分页 | 每页条数 select + 页码方块 + border-t 分隔 | 上一页/下一页+文字 | **改**：补 border-t/pt-8/h-9 配方；页码方块与每页条数可选 |
| 11 | Run Hint 盒 | mono 微标签+预估请求次数 | 无 | **可选**：预估次数已有 pre-run 弹窗承担，避免重复 |
| 12 | 表格列 | 关键词/排名 16px、URL 14px max-w-50 | 全 14px、URL max-w-56 | **改** |
| 13 | 下拉（国家/语言/深度） | 全 `<select>`，国家 202 项英文、语言 44 项 | 文本输入（限 2 字符） | **暂缓（用户指示）**。已确认约束：我们契约 `^[a-z]{2}$` 仅两位小写码——国家码需转小写；语言表 `zh-CN/zh-TW` 不合法须剔除或映射为 `zh`；不得改服务端 |
| 14 | 表单底色 | 字段直接铺在 bg-card 上 | `bg-muted/30` 面板 | **改**：去面板，字段直铺（壳卡即工作区卡） |
| 15 | 三联设置断点 | `md:grid-cols-3` | `sm:grid-cols-3` | **改**：对齐 md |
| 16 | 页面内边距 | `px-4 py-8 sm:px-6 lg:px-0` | `px-6 py-4` | **可选**：`lg:px-0` 贴边风格激进，涉及共享壳，暂保持 px-6、补 py-8 可议 |

**永久排除项**（产品边界，非风格差异）：Key 列 / Key 脱敏串、导出 + Key、语言切换按钮、英文 STATUS 前缀与 RUN HINT 英文文案（中文 UI 原则；如需微标签母题，用中文文案套同款 class）。

### 未找到胶囊配色建议

原站 yellow 的语义是"miss=警示"。我们的 spec 将 Not Found 定义为**成功的查询结果**（不进失败队列）。两个选项：

- A（随原站）：`bg-yellow-500/10 text-yellow-600 dark:text-yellow-400`——视觉与参考一致；
- B（随语义）：维持中性 `bg-muted text-muted-foreground`——与"已找到=绿、失败=红"形成 绿/灰/红 的正确语义梯度。

建议 B：色相纪律里灰=正常结果，红=异常，信息层级更诚实；如用户坚持像素级一致性再切 A。

> 2026-09-01 用户拍板：**采用 B**。

---

## 9. 落地记录与实现陷阱

### 实现陷阱：Card 原语的 text-xs 继承

我们的 `packages/ui` Card 原语基类是 `text-xs/relaxed`（ref 的 Card 是 `text-sm`，且原站表格根本不在 Card 内、直接继承 body 16px）。后果：**凡在 ToolPageShell 壳卡内不写显式字号的文本，都会被静默压到 12px**——首版结果表的关键词列即因此实测 12px。规则：壳卡内的表格必须显式 `text-base`，正文文本必须显式 `text-sm`，此陷阱同样会影响后续 Keyword Clustering 的表格与行文本。

同理陷阱：`Input`/`Textarea` 原语带 `md:text-xs`，页内传 `text-sm` 会在桌面端被覆盖回 12px；要得到 16px 必须同时传 `text-base md:text-base`。

### 已落地（2026-09-01）

§8 清单第 1、2、3、4、5、6、7（B 方案）、8、9、10、12、14、15 项已实施；第 11 项（Run Hint 盒）确认不加；第 13 项（国家/语言/深度下拉）用户指示暂缓；第 16 项维持共享壳 px-6 不变。第 10 项分页后续升级为完整原站形态：每页条数 select（h-9 rounded-lg text-xs font-bold，10/20/30/40/50）+ 页码方块（36×36 rounded-lg text-xs font-bold，当前页 `bg-primary text-primary-foreground`，其余 `border border-input bg-background hover:bg-accent`）+ `getPageNumbers` 窗口算法（≤7 页全显，否则 `[1] … [c-1..c+1] … [N]`），并补 `aria-current="page"`。

分页补充修正（2026-09-01 第二轮）：默认每页条数对齐原站 **10**（此前 20 导致 18 条结果单页、分页整块消失）；分页底栏改为**常驻**——只要有结果就渲染（原站无 `totalPages > 1` 条件），单页时上一页/下一页置灰；新增 `safePage` 越界钳制，防止删除关键词或切换每页条数后停留在不存在的页码。

---

## 10. 布局架构差异：嵌套工作区卡 vs 平级区块卡（2026-09-01 分析）

### 原站的页面骨架（实测 DOM）

```
body.mx-auto.flex.max-w-7xl.px-4
└─ main.bg-background.flex.flex-col.min-h-screen
   ├─ Header（词标 + 主题钮）
   └─ div.relative.mx-auto.max-w-7xl.px-4.py-8.sm:px-6.lg:px-0
      └─ div.space-y-8                          ← 唯一节律：32px
         ├─ Hero 卡        rounded-[2rem] border bg-card/50 p-8   （H1 + 描述）
         ├─ 查询工作区卡   rounded-[2rem] border bg-card p-8      （标题 + 打开设置 + 表单）
         ├─ 状态横幅       rounded-2xl（无卡，独立区块）
         ├─ 指标卡 ×4      rounded-3xl border bg-card p-6（独立卡，直接铺在 background 上）
         └─ 结果快照卡     rounded-[2rem] border bg-card p-8      （标题 + 导出 + 表格 + 分页）
```

**每张卡都是平级兄弟，直接坐在页面 background 上**。没有任何"包裹卡"。卡与卡的层级信号 = background→card 的明暗差 + 32px 间距 + 各自完整的 1px 边框与圆角。

### 我们当前的骨架

```
div.grid.min-h-svh
├─ Header
└─ main（ToolPageShell）
   ├─ Hero 卡（页面标题，结构与原站一致 ✓）
   └─ Card「工作区」rounded-[2rem] p-8          ← 包裹卡
      ├─ CardHeader：工作区 + 打开设置
      └─ CardContent
         ├─ 表单（铺在卡上，等价于原站"查询工作区卡"的内部 ✓）
         ├─ 横幅
         └─ 结果卡 rounded-[2rem] border p-5/p-8  ← 嵌套在"工作区"卡内 ✗
```

### 差异的视觉后果

1. **白上白/同色叠同色**：结果卡 bg-card 坐在"工作区"卡 bg-card 之上，浅色下白上白、深色下 card(0.205) 叠 card(0.205)，层级只剩 1px 边框一个信号——这正是 §7-2"半透明表面是深色层次引擎"被绕过后的结果。原站结果卡坐在 background 上，明暗差天然分层。
2. **双份内边距**：壳卡 p-8 + 结果卡 p-5/p-8，移动端 375px 下内容区被两层 padding + 壳 px-6 连续挤压；原站每卡自带一份 p-8，互不叠加。
3. **节律丢失**：原站表单→结果之间是 32px 卡间距（space-y-8）；我们是嵌套内部间距，卡片边界感与呼吸感都弱一档。
4. **指标卡位置**：原站指标是介于两卡之间的独立区块；我们嵌在结果卡内。
5. **语义偏差**：原站"查询工作区"卡只承载输入，结果快照是独立语义单元（标题就叫"最近一次结果快照"）；我们把两者包在一个"工作区"里，信息层级与原站的设计意图（输入/输出分区）不一致。

### 根因与影响面

根因是 `ToolPageShell` 的单 children 槽位 + 固定"工作区"包裹卡（Phase 3 的共享模板）。影响面核查：**keyword-clustering 页面当前未传 children（占位态），真正使用壳内工作区的只有 keyword-ranking**——重构壳结构当前零波及，是低风险窗口；clustering 接入业务时应直接按平级区块卡结构编写。

### 平级化方案（待用户确认后实施）

1. `ToolPageShell` 去掉"工作区"包裹卡：壳只保留 Hero + 页面容器（容器内 `space-y-8` 节律 + 占位空态），children 直接平铺。
2. 「打开设置」入口随原站移入**各工具自己的工作区卡头**（keyword-ranking 的表单卡头持有 `SerpApiSettingsSheet` 触发按钮），壳不再持有；对无 children 的占位工具，壳保留一个设置入口在 Hero 右侧或占位卡头，避免功能丢失。
3. keyword-ranking 拆为两张平级卡：查询工作区卡（标题 + 设置按钮 + 表单）、结果卡（标题 + 动作 + 表格 + 分页）；error/unsaved 横幅与进度条作为两卡之间的独立区块（原站状态横幅的位置）；指标卡可顺带升为独立区块（原站位置）或保留在结果卡内，实施时二选一。
4. 细节一并对齐：结果卡 padding 无条件 p-8（去 p-5 移动端特例，因不再叠加）、容器 py-8（现 py-4）、`lg:px-0` 贴边问题维持 §8-16 决议不动。

### 平级化落地记录（2026-09-01，用户确认后实施）

- `ToolPageShell`：去掉「工作区」包裹卡；有 children 时直接渲染（工具自管区块卡），无 children 的占位工具保留原「工作区」卡 + 打开设置入口 + 虚线占位（keyword-clustering 当前形态不变）；容器 py-4 → py-8。
- keyword-ranking：表单包进独立「查询工作区」卡（`relative overflow-hidden rounded-[2rem] border bg-card p-8` + 卡头 24px 标题 + `SerpApiSettingsSheet`）；指标卡升为两卡之间的独立区块（原站位置）；结果卡 `p-8` 无条件；error/unsaved 横幅自然成为卡间兄弟区块；进度条保留在结果卡头下（运行状态属于结果语义）。
- 验证：桌面浅/深双主题下三区块平级、卡坐 background 分层清晰（深色 card 0.205 浮于 background 0.145）；移动端 375px 无横向溢出（scrollWidth == clientWidth，卡 24px 内缩 327px 宽）；clustering 占位页结构不变。

---

## 11. 关键词聚类样式契约（后续开发依据）

聚类的排版统一 = **自动继承的共享层 + 复用 §7 配方表 + 两个工具以上的配方抽取**。原站没有聚类实现，本节是配方表在聚类上的应用契约，开发时对照执行。

### 11.1 零成本继承（已统一，直接用）

- `ToolPageShell`：Hero + 容器已就绪，聚类页只需传 children；占位分支届时删除。
- `SerpApiSettingsSheet`：共享设置入口，放在聚类自己的「查询工作区」卡头（decision.md：两工具打开同一面板）。
- 设计令牌（globals.css 的圆角/颜色/字号刻度）与 §9 陷阱规避（卡内文本显式字号、`md:text-xs` 覆盖）。

### 11.2 页面结构模板（对照 keyword-clustering spec 的结果呈现）

```
Hero（壳提供）
├─ 查询工作区卡      §3.3 配方；字段：关键词、位置、语言、聚类精度(1–10)、可选目标域名；CTA h-14
├─ 横幅              错误 / 未保存（§3.6 配方）
├─ 分析摘要（窄）    指标卡配方 §3.7：Cluster 数 / 已覆盖关键词 / No Evidence / Failed
└─ 聚类结果卡（宽）  rounded-[2rem] border bg-card p-8
   ├─ 卡头：标题 text-2xl bold tight + 筛选 + 导出 CSV（动作钮 h-8 rounded-lg text-sm）
   ├─ Cluster Cards / 紧凑表格视图
   ├─ No Evidence 区、Failed 区（独立分区）
   └─ 如分页：常驻分页底栏配方（默认每页 10）
```

区块间距一律 32px（组件根 `flex flex-col gap-8`），与排名页同节律。

### 11.3 聚类特有组件的配方

- **Cluster Card（可展开组）**：`rounded-2xl border bg-card/50`，头行 = 主关键词（16px font-medium）+ 成员数（mono 计数或胶囊）+ 展开箭头；展开区为轻行列表（`divide-y`，行 `py-2.5 px-4`，hover `bg-accent/30`）。选中/激活态用 2px primary 描边语言（同策略选择卡 §3.10）。
- **状态语义映射**（沿用排名页 B 方案梯度）：成簇=默认态无胶囊；No Evidence=灰（成功请求但零有效 URL，同"未找到"）；Failed=红；Possible Cannibalization=黄（warning 语义，非确诊——spec 明确）。
- 表头格、微标签、空状态、横幅、分页控件：直接套 §7 配方，不新造。

### 11.4 统一机制（防两个工具样式漂移）

放置规则沿 `docs/agents/tool-development.md`：`packages/ui` 只放通用原语与令牌，**不放工具形态**；跨工具共享配方放 `apps/web/src/components/`（class 配方常量或薄组件）。

- **抽取时机**：聚类开发时，把届时已有两个使用点的配方抽共享——SectionCard（区块卡壳）、Field/FieldLabel（字段组）、Microlabel、StatusPill（参数化语义色）、DataTableHead、Banner、Pagination。这是被推迟的样式抽取的自然时机（两个使用者即抽，单点不抽）。
- **抽取形态**：优先 class 配方常量（零抽象成本），交互复杂再升级薄组件；不改 `packages/ui` 原语基类。
- **留在聚类 feature 内**：Cluster Card、Evidence 钻取视图等单点组件。

### 11.5 完成验收清单

1. 三区块平级结构 + 32px 节律与排名页并排对比无差异。
2. 表单控件与排名页逐项一致（h-12 / 16px / focus ring-4 / 标签 bold gap-4 / md:grid-cols-3 / CTA h-14）。
3. 卡内所有文本有显式字号（§9 陷阱）。
4. 浅/深/窄屏/空态/错误态/运行态浏览器证据。
5. 无 Key 信息出现在任何结果呈现或 CSV。
