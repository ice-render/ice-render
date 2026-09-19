# 05 · 事件系统

## 设计目标

Canvas 标签内部没有事件机制。引擎借鉴 W3C `EventTarget` 接口 + jQuery 风格 API，在 canvas 内部实现一套事件机制，并把原生 DOM 事件（mouse/keyboard/touch）桥接进组件。

## 类关系

```mermaid
graph TD
    E[ICEEvent<br/>事件对象] 
    T[ICEEventTarget<br/>抽象：监听器管理] --> B[EventBus<br/>实现类：事件总线]
    C[ICEComponent] --> T
    E --> T
```

- `ICEEventTarget` 是**抽象基类**，提供事件监听能力；`EventBus` 与所有组件（`ICEComponent extends ICEEventTarget`）都是它的子类。
- `ICEEvent` 是事件对象，实现 W3C `Event` 接口。

## ICEEventTarget 的 API

| 方法 | 作用 |
|---|---|
| `on(name, fn, scope)` | 注册监听（`(fn, scope)` 去重） |
| `off(name, fn, scope)` | 移除监听 |
| `trigger(name, originalEvent, param)` | 触发事件，回调拿到 `ICEEvent` |
| `once(name, fn, scope)` | 触发一次后自动移除 |
| `suspend(name)` / `resume(name)` | 挂起/恢复某事件（挂起后 `trigger` 直接返回 false） |
| `purgeEvents()` | 清空所有监听 |
| `hasListener(name, fn, scope)` | 查询是否已监听 |

**W3C 别名（2026-09-19 起是真方法，不再是挂过去的同一函数）**：
`addEventListener(type, fn, { once })` / `removeEventListener(type, fn)` / `dispatchEvent(event)`。
旧实现把 `on/off/trigger` 直接挂到这三个名字上，签名全不对 —— `addEventListener` 的第三参
（`{ once: true }` / `true` 捕获标志）会被当成 `scope`，`dispatchEvent` 期望收**事件对象**
却被当成了事件名；按 W3C 写法接进来的代码因此"看着能用、行为不是那回事"。

**监听器结构**（`listeners`）：

```javascript
{ "click": [ { callback, scope }, ... ], "mousemove": [...] }
```

**语义要点**：

- `on` 会先 `off` 同 `(fn, scope)` 再 push，**天然去重**。
- `trigger` 若 `originalEvent` 非空，会把它包成 `ICEEvent` 并保留 `originalEvent` 引用；否则新建一个只含 `type/timeStamp/param` 的轻量事件。
- **已经是 `ICEEvent` 就不再包一层**（2026-09-19）：包一层会换掉事件对象，于是上一个监听器里
  打的 `stopPropagation()` / `preventDefault()` 标记落在副本上（冒泡与取消永不生效），
  `param` 也会被后包的那层覆盖成 `{}`。
- `scope` 决定回调里 `this` 的指向，默认是 `root`（跨平台根对象）。
- **`on` / `once` / `off` / `suspend` / `resume` / `purgeEvents` 都返回 `this`**（可链式）；
  `off(name)`（不传回调）＝ 清空该事件的**全部**监听。

## 事件传播：沿组件树冒泡（2026-09-19 新增）

一次输入事件的传播路径：

```
命中组件（AT_TARGET=2） → 父容器 → 祖父 ……（BUBBLING_PHASE=3） → 事件总线（最后收一次）
```

- 组件树就是 DOM 树的对应物，"子组件上的点击父容器也能知道"是**容器型组件**
  （面板 / 卡片 / 抽屉 / 巡览）唯一能用的组合方式；旧实现只把事件投给命中组件，
  于是下游出现了"在面板自己身上再挂一次 `click` 去 `stopPropagation`"这类写法 ——
  既无效（根本没有冒泡可阻止），又危险（见下）。
- `evt.target` 始终是**命中组件**；`evt.currentTarget` 是当前正在处理的节点；
  `evt.composedPath()` 给出"命中组件 → 各级父容器"。
- `stopPropagation()`：**不再向祖先冒泡**（同层其他监听器照常执行）；
  `stopImmediatePropagation()`：连当前目标上剩下的监听器也跳过。
- ⚠️ **总线一定会收到一次**，不受 `stopPropagation()` 影响：总线是引擎内部通道
  （控制面板选中、连线插槽、悬停、键盘作用域都挂在上面），让组件里的一次
  `stopPropagation()` 把它整条掐掉，会变成"看着只是阻止冒泡，实际引擎失灵"。

## `ICEEvent`：W3C 方法真实现（2026-09-19 改）

旧实现的 `preventDefault` / `stopPropagation` / `stopImmediatePropagation` / `composedPath` /
`initEvent` **全是 `throw new Error('Method not implemented.')`**：应用里一调用，异常就从监听器里
冒出去 —— 后面的监听器与总线都收不到事件。`ice-chart` 因此专门写了"只对原始 DOM 事件调用
`preventDefault`"的绕过代码，`ice-web-components` 里则留下若干"看着防了、其实一调用就炸"的写法。

现在的语义：

- `preventDefault()`：只有 `cancelable === true` 才生效（与 W3C 一致），置 `defaultPrevented = true`，
  并**顺手调用原始 DOM 事件的 `preventDefault()`**（"我在 canvas 里处理了这个手势，别让浏览器再滚一屏"）。
- 字段有确定默认值：引擎自造事件上 `bubbles / cancelable / defaultPrevented / eventPhase`
  不再是 `undefined`。
- ⚠️ 构造函数的字段平铺**不会覆盖本类自己的方法**（`NON_COPYABLE_KEYS`）：
  普通对象做的事件桩（测试夹具、业务里手搓的 `{ type, preventDefault(){} }`）上的
  `preventDefault` 是**可枚举 own 属性**，一旦被拷进来就会盖掉我们的实现，
  于是"默认行为已阻止"永远是假、调用方还以为生效了（真实 DOM 事件的这些方法在原型上、不可枚举，
  所以旧实现没暴露这个坑）。

回归：`tests/event/bubbling-and-w3c.test.ts`（W3C 方法 / 冒泡顺序 / stop* 语义 / 总线不受影响 /
composedPath / 别名与链式 / `off(name)` 全清）。

## EventBus：协作通道

`EventBus` 是 `ICEEventTarget` 的**实现类**（无额外逻辑），每 ICE 实例一条。它是引擎内部 Manager 之间的协作通道：

- `FrameManager` 通过它广播 `ICE_FRAME_EVENT`；
- 各 Manager 通过 `on/off` 订阅感兴趣的事件（见 [01 运行时](01-runtime.md)）。

## DOM 事件桥接

原生 DOM 事件 → 引擎内部事件的链路：

```mermaid
graph LR
    DOM[浏览器 DOM 事件] --> DI[DOMEventInterceptor<br/>文档级拦截]
    DI --> DD[DOMEventDispatcher<br/>转成 ICEEvent]
    DD --> EB[EventBus]
    EB --> C[命中组件 target]
```

- `DOMEventInterceptor` 在文档层做统一拦截/预处理（全局，跨 ICE）。
- `DOMEventDispatcher` 把原生事件转成 `ICEEvent`（保留 `originalEvent`、`target` 指向命中组件），再注入 `EventBus` 分发。
- 组件通过 `initEvents()` 注册默认事件（`mousedown`/`keydown`/`keyup`），子类可覆盖。

### 指针坐标：移动类事件**每帧重读** canvas 矩形

命中检测要把 `clientX/clientY` 换算到画布坐标，靠的是 `getBoundingClientRect()`。
**移动类事件必须每帧重读一次**（`ICE.refreshInputRect()`），不能缓存、也不能做"一帧一次"的节流：

- 页面滚动、画布**上方插入内容**（提示条 / 错误信息 / 广告位）都会让缓存的矩形整体过期；
  而移动事件是唯一高频入口 —— 不刷新就没人来纠正它，过期期间 `clientX - rect.left` 恒定偏移，
  命中、悬停、拖拽会**整体错位**，直到用户点一下或滚一格（`ice-chart` 的示例页真实撞到过：
  图表创建后插入状态行把画布下推 26px，悬停直接落空）；
- 实测一次 rect 读 **0.22µs**（每次读之前改样式、强制重排的最坏情况 2.8µs），相对每帧渲染可忽略；
- 尺寸没变时只把已缓存的**内容盒**跟着平移（省掉 `computedStyle` 读取），所以"每帧重读"不等于"每帧重算";
- 做位移增量必须用**值快照**，不能拿上一次的 rect 对象引用做差 —— 某些运行时（测试桩 / 小程序）
  返回同一个可变对象，增量会恒为 0，内容盒再也不跟着走。

回归：`tests/ICE.input-rect.test.ts`、`tests/event/DOMEventDispatcher.input.test.ts`、
`e2e/visual/input-rect-shift.spec.ts`。

## 常见事件名

引擎定义了一批事件常量（`ICE_EVENT_NAME_CONSTS`），例如：

- 生命周期：`BEFORE_ADD` / `AFTER_ADD` / `BEFORE_REMOVE` / `BEFORE_RENDER` / `AFTER_RENDER`
- 交互：`BEFORE_MOVE` / `AFTER_MOVE` / `BEFORE_ROTATE` / `AFTER_ROTATE` / `BEFORE_RESIZE` / `AFTER_RESIZE`
- 框架：`ICE_FRAME_EVENT` / `ROUND_FINISH`
- 连线钩子：`HOOK_MOUSEDOWN` / `HOOK_MOUSEMOVE` / `HOOK_MOUSEUP`

回归用例见 `tests/event/EventBus.test.ts`。
