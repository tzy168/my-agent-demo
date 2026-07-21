# TH.AGENT Design System

> 编辑型极简（Editorial Minimal）风格。基于当前产品结构记录美学方向、字体、色彩、布局、交互、动效、组件与响应式决策。实现见 `app/globals.css`（`@utility`）。

## 设计基调

页面采用「编辑型极简」风格：杂志排版的精致感与工具型产品的实用性交汇。核心手法是大量留白、克制用色、高品位字体搭配、精确的间距节奏。刻意回避三类常见陷阱：紫色渐变白底的 AI 套路配色、Inter/Roboto/Arial 等通用无衬线字体、千篇一律的卡片堆砌布局。单一赭红强调色贯穿全局，只出现在激活态、链接、进度、关键标点等少量高价值位置，让每一次着色都有分量。

| 项 | 值 |
| --- | --- |
| 产品名 | **TH.AGENT**（短标 **TH**） |
| 气质 | 编辑型极简；暖纸面 + 赭红点缀；衬线展示 / 几何正文 / 等宽元信息 |
| 首屏 | Home 以品牌大字为唯一视觉锚点，不做卡片墙 / 数据条 |

## 字体系统

三字体协作是这套设计语言的地基，每种字体承担明确的语义角色。

| 字体 | 角色 | 使用规范 |
|------|------|----------|
| Fraunces | 展示与标题 | 可变衬线体，启用 opsz 光学尺寸轴与 SOFT 软度轴；斜体用于强调与点缀，着强调色；标题尺寸用 `clamp()` 响应式缩放，最大约 112px / Hero `text-8xl` |
| Outfit | 正文 | 几何无衬线，字重 300–400，行高 1.6；导航、输入、气泡正文 |
| JetBrains Mono | 等宽元信息 | 代码块、标签、时间戳、章节编号；字号 10–13px，配 `letter-spacing` 0.12–0.18em + `text-transform: uppercase` |

Fraunces 标题通过 `font-variation-settings: 'opsz' 144, 'SOFT' 50` 获得大字号下更舒展的字形；斜体强调切换到 `'SOFT' 100`，配合赭红着色形成视觉焦点。Outfit 的几何无衬线与 Fraunces 的有机衬线形成理性与感性的对话；JetBrains Mono 的等宽 uppercase 标签在两者之间提供技术化的节奏停顿。

| 角色（落地） | 字体 | 用法 |
| --- | --- | --- |
| 品牌短标 | Fraunces / bold | 顶栏 `TH` |
| 品牌 Hero | Fraunces / bold | Home `TH.AGENT` |
| 控件正文 | Outfit `text-sm` | Tab、气泡、占位提示 |
| 代码 / 元信息 | JetBrains Mono | 预留代码块、标签 |

## 色彩系统

全站以 CSS 自定义属性驱动，支持浅 / 深双主题（可通过 `data-theme` 作用于根元素；`localStorage` 持久化）。主题切换时颜色变量整体替换，body 配约 0.35s 过渡实现平滑切换。

### 浅色主题

| 变量 | 值 | 用途 |
|------|------|------|
| `--bg` | `#F6F3EC` | 暖米纸背景（`app-shell`） |
| `--surface` | `#FEFCF6` | 卡片 / 面板面 |
| `--surface-2` | `#EFE9DA` | 次级面（表头、卡片头） |
| `--accent` | `#B0431B` | 赭红强调色 |
| `--accent-soft` | `rgba(176,67,27,.08)` | 强调色 8% 透明底 |

### 深色主题

| 变量 | 值 | 用途 |
|------|------|------|
| `--bg` | `#14110C` | 深墨棕背景 |
| `--surface` | `#1D1913` | 卡片 / 面板面 |
| `--surface-2` | `#252017` | 次级面 |
| `--accent` | `#E07A48` | 暖橙强调色 |
| `--accent-soft` | `rgba(224,122,72,.10)` | 强调色 10% 透明底 |

### 文字与边框层级

文字分四级，从主到次逐级降低对比度：`--ink` 主文、`--ink-soft` 次文、`--secondary` 辅助、`--muted` 弱化。边框设三档：`--border` 常规分隔、`--border-strong` 卡片与输入框边界、`--accent-soft` 充当强调色底纹。深色主题下阴影从暖棕半透明改为纯黑半透明。文字选区（`::selection`）使用 accent-soft 底 + accent 文字。

| Token / 用法 | Light | Dark |
| --- | --- | --- |
| 页面底 | `--bg` `#F6F3EC` | `--bg` `#14110C` |
| 前景主文 | `--ink` | `--ink` |
| 顶栏毛玻璃 | `surface` 半透明 + blur | 同左，加深墨棕 |
| 顶栏分割线 | `--border` | `--border` |
| 主操作 / Human 气泡 | `--accent` 底 + 浅字，或 ink 高对比 | 同左 |
| AI 气泡 | `--surface-2` + `--ink-soft` | 同左 |
| 次要文案 | `--secondary` / `--muted` | 同左 |
| 输入边框 | `--border` → hover `--border-strong` → focus `--accent` | 同左 |

原则：强调色只出现在高价值交互点；交互态优先用明度与 accent 透明度，避免紫 / 青霓虹或渐变字。

## 布局与空间

```
┌─────────────────────────────────────┐
│  nav-glass（fixed, ~64px 高）        │
│  TH  +  tabs                         │
├─────────────────────────────────────┤
│  page-content（pt-[64px] + 内边距）  │
│  ┌───────────────────────────────┐  │
│  │  子页自管滚动（整页不滚）      │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

| 规则 | 说明 |
| --- | --- |
| 视口壳 | `100vw × 100vh`，`overflow-hidden`，禁止整页滚动 |
| 内容宽 | 文档类最大约 1400px；Chat 列 `720px` / `max-w-full` 居中 |
| 主区内边距 | 桌面约 56px；窄屏收至 24px |
| 顶栏占位 | 内容区 `pt-[64px]`，避免被 fixed 栏遮挡 |
| 圆角 | 输入 / 气泡 `rounded-2xl`；发送钮 `rounded-xl`；胶囊控件可用 `999px`；气泡贴边角 `rounded-br-md` / `rounded-bl-md` |
| 栏间距（双栏页） | 侧栏约 220px sticky + 主区，栏间距约 72px |

## 交互设计

从微反馈到导航逐级递进；产品内优先落地下列模式。

### 导航激活

激活态宜有多重反馈：强调色竖线或下划线生长、文字变 `--accent`、背景填 `--accent-soft`。监听阈值偏严（如 rootMargin 负值），确保真正进入阅读区再切换。

### 搜索 / 过滤（若有）

输入即时过滤；无结果用 Fraunces 斜体空状态。快捷键：`/` 聚焦搜索，`Esc` 清空并失焦；已在输入框内时不抢快捷键。

### 一键复制（若有）

Hover 浮现 COPY；成功后短暂 copied 态（accent 实底 + 浅字）+ Toast 滑入，约 2s 恢复。

### 阅读进度 / 返回顶部（长文页）

顶部 2px accent 进度条；滚过约 600px 后右下角返回按钮浮现，hover 上浮并着强调色。

### 主题切换

圆形按钮，hover 可轻微旋转；图标在日 / 月间切换；写入 `localStorage`，首屏读取避免闪烁。

### Chat / 输入

- 上：可滚消息列表（隐藏滚动条）
- 下：固定输入条（发送钮绝对贴右）
- Human / AI 气泡左右对齐；Markdown 在泡内渲染
- 输入 focus 用 accent / 强边框，禁用态降透明度并锁死缩放

## 动效规范

| 项 | 值 |
| --- | --- |
| 缓动 | `cubic-bezier(0.2, 0.8, 0.2, 1)` |
| 通用过渡 | `0.35s` |
| 淡入类 | `0.7s` |
| 入场 | 初始 `opacity: 0` + `translateY(24px)`，进视口 fade-up |
| Header 序列 | `animation-delay` 0 / 0.08 / 0.16 / 0.24 / 0.32s 逐级淡入 |
| 呼吸点（live） | 约 1.8s，`opacity` 1↔0.4、`scale` 1↔0.85 |

`@media (prefers-reduced-motion: reduce)` 下降级为近 0 时长，reveal 直接显示。

| 元素（落地） | 行为 |
| --- | --- |
| Tab | 颜色 / 背景过渡；激活可带 accent |
| 输入框 | 300–350ms 边框 / 阴影 / 背景 |
| 发送钮 | 背景 / scale / 阴影；hover 微抬升；active 微压；disabled 锁死 |

## 组件细节

| 区域 | 规范 |
| --- | --- |
| 顶栏 | 半透明 surface + `backdrop-blur`；短标 Fraunces；Tab 闲置次要色，激活 ink/accent 或 accent-soft 底 |
| Home | 垂直居中单一品牌字；可用 `mix-blend-difference` 等手段相对动态底取负色，保持首屏极简 |
| Chat | Human 高对比 / accent 泡；AI surface-2 泡；空态 muted / 斜体 |
| 卡片头（若有） | surface-2 底 + 底部分隔；左 Outfit 中文标签 + 右 Mono 英文小标签 |
| 代码块 | 米色 / surface-2 底 + 小圆角 + Mono；行内代码 accent 字 + accent-soft 底 |
| 引用 | 左侧 2px accent 竖线，正文斜体 + secondary |
| 表格 | 表头 surface-2；行 hover accent-soft |

## 响应式

断点参考约 `920px`：双栏变单栏；粘性侧栏可改为横向换行导航；分栏卡片改上下堆叠；内边距 56px → 24px；悬浮控件边距收紧。Chat 列始终 `max-w-full` 适配窄屏。

## 可复用工具类一览

在 JSX 中优先使用下列类名，避免重复长串 utility。新视觉 token 落地时，优先改 `@utility` 内部实现，保持类名稳定。

### Layout

| Class | 用途 |
| --- | --- |
| `app-shell` | 根视口壳（应对齐 `--bg`） |
| `page-stack` | 顶栏 + 内容的纵向 flex 栈 |
| `page-content` | 顶栏下方内容区 |
| `page-fill` | 子页占满剩余高度 |
| `page-center` | 子页水平垂直居中（Home） |

### Nav

| Class | 用途 |
| --- | --- |
| `nav-glass` | 毛玻璃顶栏 |
| `nav-brand` | 顶栏短标 |
| `nav-tabs` | Tab 行容器 |
| `nav-tab` | Tab 按钮基础 |
| `nav-tab-active` / `nav-tab-idle` | 激活 / 闲置 |

### Brand

| Class | 用途 |
| --- | --- |
| `brand-hero` | Home 大标题（Fraunces） |

### Chat

| Class | 用途 |
| --- | --- |
| `chat-panel` | 对话页列布局 |
| `chat-column` | 720 宽列 |
| `chat-list` | 消息滚动区 |
| `chat-empty` | 空态提示 |
| `chat-form` | 输入表单壳 |
| `chat-input` | 文本输入 |
| `chat-send` | 发送按钮 |
| `chat-typing` |「思考中」气泡 |

### Message

| Class | 用途 |
| --- | --- |
| `msg-row` / `msg-row-end` / `msg-row-start` | 气泡行对齐 |
| `msg-bubble` | 气泡 + Markdown 排版基础 |
| `msg-bubble-human` / `msg-bubble-ai` | 角色色与圆角 |

## 使用约定

1. **新 UI 先查本表**：有对应 utility 则直接用；没有再补 `@utility` 并更新本文件。
2. **条件样式用组合**：如 `nav-tab` + `nav-tab-active`，不要复制整段原子类。
3. **不改语义 DOM**：样式封装不得改变父组件依赖的节点结构。
4. **强调色克制**：新增着色前先问是否必须用 `--accent`；能用明度 / 字重表达则不用色。
5. **字体角色不混用**：展示用 Fraunces，正文用 Outfit，元信息用 JetBrains Mono。
