# 17 · i18n 边界（引擎 / 组件库 / 应用各管什么）

## 一句话原则

**引擎不做 i18n，只做「让 i18n 显示正确」的排版与输入基础设施；词条、语言切换与格式化属于应用层。**

理由：

1. 引擎里没有「文案」，只有字形 —— 所有可见文字都来自 `state.text`（图元属性）或 `props`；
2. 引擎层一旦持有 locale，就会引入**模块级全局状态**：同页两个应用不能各用各的语言、切语言要重建组件
   （`ice-web-components` 早期版本正是这个形态，见本文「现状」）；
3. 引擎层的 locale 依赖只会制造**不可复现的数据**：`Serializer` 曾用 `new Date().toLocaleString()`，
   同一份工程在 zh-CN 机器上写 `2026/9/13 12:12:33`、在 en-US 机器上写 `9/13/2026, 12:12:33 PM`
   （已于 2.0.1 改为 ISO 8601 UTC）。

## 三层职责

| 层 | 该管 | 不该管 |
|---|---|---|
| **引擎（ice-render）** | 排版与渲染：字形度量、断行、省略、离屏缓存；**文字方向**（BiDi 基线方向、`start/end` 对齐语义）；**输入法**（IME composition 宿主）；可访问性文本通道（`ariaLabel` / `text`）；**稳定错误码**；中立性（不规范化、不做 locale 格式化） | 词条表、语言切换、复数规则、日期/数字/货币格式化、任何全局或实例级 locale 状态 |
| **组件库（ice-web-components / ice-chart …）** | 它自己内部会渲染的文案（空态、确定/取消、分页「共 N 条」、a11y 标签）：**必须可配置**，且**不持全局状态** | 业务文案（业务自己传）、格式化规则、语言切换策略 |
| **应用 / Agent** | 词条、复数、日期/数字/货币格式化、语言切换、RTL 布局决策；把**最终字符串**交给引擎 | 断行规则、字形度量（那是引擎的活） |

业界同构：Konva / Fabric 不碰 i18n；ECharts 的 `locale`、antd 的 `ConfigProvider.locale` 管的是
**组件层内置文案**；复数与格式化交给 `Intl` / ICU；Mapbox 的 `setRTLTextPlugin` 处理的是**排版**而非翻译。

## 引擎必须负责的三件事（「只负责渲染」的三个例外）

### 1. 断行策略

应用层给的是翻译后的字符串，但**按哪种规则断行**是排版：

- 拉丁词不能被硬拆 —— `wordBreak: 'normal'`（默认）下 `hello world` 在窄行里断成 `hello` / `world`，
  整行放不下时才硬拆（等价 CSS `overflow-wrap: break-word`）；
- CJK 逐字断，并做**禁则**：行首不能是闭标点（`、。，）」`…），行尾不能是开标点（`（「`…）；
- 需要等宽硬断的场景（代码、艺术字）用 `wordBreak: 'break-all'` 回到旧的逐 grapheme 贪心。

实现：`src/graphic/text/text-wrap.ts`（纯函数）+ `ICEText.state.wordBreak`；回归 `tests/graphic/text-wrap.test.ts`。

### 2. 文字方向

canvas 不做 BiDi 重排，必须由引擎把**基线方向**传下去，并让 `textAlign` 支持语言相关的 `start` / `end`：

```js
new ICEText({
  text: 'שלום עולם',
  direction: 'auto',        // 'ltr' | 'rtl' | 'auto'（默认按首个强方向字符判定）
  style: { textAlign: 'start' }, // rtl 下 start = 右（阅读起点），不是物理左边
});
```

- 解析：`resolveTextDirection()` / `resolveTextAlign()`，见 `src/graphic/text/text-direction.ts`；
- 落地：渲染时把解析结果写进 `ctx.direction`（**特性检测**：运行时没有该成员就跳过、退化为 LTR），
  渲染结束归位 `inherit` —— 遵循「组件渲染自包含」铁律，不影响脏矩形/离屏缓存的像素契约；
- SVG 导出保持同口径：输出 `direction="rtl"`，并按方向映射 `text-anchor`（RTL 下 `start` 是右边）；
- 回归：`tests/graphic/text-direction.test.ts`、`tests/graphic/text-i18n.test.ts`、`tests/export/svg-export.test.ts`。

### 3. 输入法（IME）

「应用层给字符串」在**输入**场景不成立：用户要打中文/日文，编辑态必须有 composition 宿主。
引擎用透明 `<input>` 承接输入、`compositionend` 回写（`ICEText` 编辑态），无 DOM 运行时降级为 keydown。

## 两条硬约束

### A. 引擎对文本保持中立

- 不做 Unicode 规范化、不做大小写折叠（会破坏应用层词条比对）；
- 不做任何 locale 相关的默认格式化（时间戳统一 ISO 8601 UTC，见 [06 · 序列化](06-serialization.md)）；
- 序列化**逐字节保留**用户文本（`state.text` 原样往返；派生量 `lines` 不进快照）。

### B. 引擎错误带稳定错误码

引擎不翻译错误，但错误常常被应用直接展示给用户 —— 只给中文 message 会迫使应用匹配字符串
（改一个字就失效）。因此引擎给出 `code`，应用拿它映射自己的词条：

```js
import { getICEErrorCode, ICE_ERROR_CODES } from 'ice-render';

try {
  ice.registerType('Badge', Badge);
} catch (err) {
  if (getICEErrorCode(err) === ICE_ERROR_CODES.TYPE_ID_INVALID) {
    toast(t('error.typeIdFormat'));   // 应用层词条
  }
}
```

错误码表见 `src/util/errors.ts`（`TYPE_ID_INVALID` / `TYPE_ID_CONFLICT` / `TYPE_CTOR_CONFLICT` /
`TYPE_CTOR_INVALID` / `INIT_TARGET_REQUIRED` / `INIT_ALREADY_BOUND` / `PLUGIN_NAME_REQUIRED` /
`PLUGIN_COMPONENT_REGISTER_FAILED` / `DESERIALIZE_VERSION_UNSUPPORTED` / `IMAGE_CONSTRUCTOR_MISSING` /
`OFFSCREEN_*`）。`message` 仍是默认中文，但**不是契约**；`details` 提供结构化补充（typeId、插件名、版本号…）。
回归：`tests/util/errors.test.ts`。

## 组件层的规则（同样重要）

组件库**确实**需要内置文案（它自己渲染空态、按钮、分页……），但必须满足：

1. **可配置**：调用方能覆盖（props 优先于内置文案）；
2. **不持全局状态**：locale 应当能按实例指定，而不是模块级 `let currentLocale` ——
   否则同页两个面板不能各用各的语言（antd 的 `ConfigProvider` 就是这个问题的标准解）；
3. **格式化交给应用**：组件只决定「说什么」，不决定「数字怎么分组、日期怎么排」。

## 现状与缺口

| 项 | 现状 |
|---|---|
| 引擎词条 / locale 状态 | ✅ 没有（本契约要求保持） |
| 引擎断行策略 | ✅ `wordBreak: 'normal' \| 'break-all'` + CJK 禁则（2026-09-13） |
| 引擎文字方向 | ✅ `direction` + `textAlign: 'start' \| 'end'`（2026-09-13，含 SVG 口径） |
| 输入法 | ✅ 透明 `<input>` + `compositionend` |
| 错误码 | ✅ `ICE_*` 稳定码（2026-09-13） |
| 引擎中立性 | ✅ 无规范化 / 无 locale 格式化 / 文本原样往返 |
| 组件库 locale 作用域 | ⚠️ `ice-web-components` 仍是模块级 `setICELocale()`；已在计划内改为「props 可覆盖 + 无全局状态」 |
| 组件库内置文案覆盖率 | ⚠️ 日历/日期选择器/分页/表单校验/上传错误仍硬编码（计划内接线） |
| 图表包内置文案 | ⚠️ a11y 标签与交互提示默认中文，需要可覆盖入口 |
| DSL 诊断 | ⚠️ 中文字符串，面向 Agent 的诊断同样需要稳定码 |

## A2UI 场景下为什么这条边界更重要

Catalog 化之后会同时出现三类文案：**Agent 生成的**（自带 locale）、**组件内置的**（需要语言包）、
**系统诊断的**（校验/错误，Agent 要读懂）。因此：

- locale 必须由**宿主传入**、库内不持全局状态 —— 否则同页两个不同语言的 Agent 面板会互相串；
- 诊断必须带**稳定码**，Agent 才能可靠地转述/纠正，而不是匹配自然语言。
