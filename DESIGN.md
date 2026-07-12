# TH.AGENT Design System

基于当前 UI 提炼的设计规范与可复用 Tailwind 工具类。实现见 `app/globals.css`（`@utility`）。

## 品牌与气质

| 项 | 值 |
| --- | --- |
| 产品名 | **TH.AGENT**（短标 **TH**） |
| 气质 | 极简、高对比、工具向；黑白灰为主，无彩色强调 |
| 首屏 | Home 以品牌大字为唯一视觉锚点，不做卡片墙/数据条 |

## 色彩

| Token / 用法 | Light | Dark |
| --- | --- | --- |
| 页面底 `app-shell` | `zinc-50` | `black` |
| 前景 / 背景 CSS 变量 | `#171717` / `#ffffff` | `#ededed` / `#0a0a0a` |
| 顶栏毛玻璃 | `white/65` + blur | `black/55` + blur |
| 顶栏分割线 | `black/[.08]` | `white/[.145]` |
| 主操作 / Human 气泡 | `black` 底 + 白字 | 同左（高对比优先） |
| AI 气泡 / 思考中 | `zinc-100` + `zinc-800` | — |
| 次要文案 | `zinc-400` ~ `zinc-600` | `zinc-400` |
| 输入边框 | `black/25` → hover `55` → focus 实黑 | — |

原则：保持单色体系；交互态用明度变化，不引入紫/青霓虹或渐变字。

## 字体

| 角色 | 字体 | 用法 |
| --- | --- | --- |
| Sans | Geist (`--font-geist-sans`) | 正文、导航、输入 |
| Mono | Geist Mono | 预留代码块 |
| 品牌短标 | `text-2xl font-bold` | 顶栏 `TH` |
| 品牌 Hero | `text-8xl font-bold` | Home `TH.AGENT` |
| 控件正文 | `text-sm` | Tab、气泡、占位提示 |

## 布局与空间

```
┌─────────────────────────────────────┐
│  nav-glass（fixed, ~64px 高）        │
│  TH  +  pill tabs                    │
├─────────────────────────────────────┤
│  page-content（pt-[64px] + p-4）     │
│  ┌───────────────────────────────┐  │
│  │  子页自管滚动（整页不滚）      │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

| 规则 | 说明 |
| --- | --- |
| 视口壳 | `100vw × 100vh`，`overflow-hidden`，禁止整页滚动 |
| 内容宽 | Chat 列 `720px` / `max-w-full` 居中 |
| 顶栏占位 | 内容区 `pt-[64px]`，避免被 fixed 栏遮挡 |
| 圆角 | 胶囊 Tab `rounded-full`；输入/气泡 `rounded-2xl`；发送钮 `rounded-xl`；气泡贴边角 `rounded-br-md` / `rounded-bl-md` |

## 组件模式

### 顶栏导航

- 毛玻璃：半透明 + `backdrop-blur-md` + `backdrop-saturate-150`
- Tab：胶囊形；激活 = `bg-foreground text-background`；闲置 = 次要色 + 轻 hover 底

### Chat

- 上：可滚消息列表（隐藏滚动条）
- 下：固定输入条（相对定位，发送钮绝对贴右）
- Human 右对齐黑泡；AI 左对齐灰泡；Markdown 在泡内渲染

### Home

- 垂直居中单一品牌字，无其它营销模块

## 动效

| 元素 | 行为 |
| --- | --- |
| Tab | `transition-colors` |
| 输入框 | 300ms 边框 / 阴影 / 背景 |
| 发送钮 | 300ms 背景 / scale / 阴影；hover `scale-[1.03]`；active `0.98`；disabled 锁死缩放 |

## 可复用工具类一览

在 JSX 中优先使用下列类名，避免重复长串 utility。

### Layout

| Class | 用途 |
| --- | --- |
| `app-shell` | 根视口壳 |
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
| `brand-hero` | Home 大标题 |

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
4. **保持单色**：新增状态色前先评估是否可用黑白灰明度表达。
