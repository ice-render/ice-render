# ICERender 架构设计文档

> 一份关于 ICERender Canvas 2D 渲染引擎的系统性架构说明，作为该引擎的**单一事实来源**（single source of truth），与代码库同仓、随版本演进。
>
> 目标读者：需要二次开发、维护或评审该引擎的工程师。

## 引擎定位

ICERender 是一款 **Canvas 2D 交互图形渲染引擎**（MIT 协议，作者 大漠穷秋）。它借鉴 React 的 `props`/`state` 概念构建组件模型，借鉴 W3C `EventTarget`/jQuery 风格构建事件系统，提供嵌套坐标系、序列化、动画、连接线（Visio 风格）等能力。

**核心设计约束**（贯穿所有子系统的铁律）：

1. **运行时依赖极简** —— 仅 `gl-matrix` 一个库，无其它依赖。
2. **多运行时兼容** —— 同一套代码同时面向 **Web 浏览器**与**各类小程序**（WeChat/Alipay 等），因此不能依赖浏览器专有 API。
3. **高性能** —— 脏标记 + 脏矩形局部重绘（默认，条件回退全量重绘）的渲染模型，配合渲染队列缓存与矩阵零分配，保证数千图元的交互流畅度。

## 文档地图

| 章节 | 内容 |
|---|---|
| [01 · 运行时链路](01-runtime.md) | `FrameManager` → `EventBus` → 各 Manager → `CanvasRenderer` 的调度管道与启动顺序 |
| [02 · 组件模型](02-component-model.md) | `props`/`state` 分离、类继承体系、容器与 zIndex |
| [03 · 坐标系与矩阵](03-coordinate-system.md) | 列向量约定、`composedMatrix` 组合、原点语义、嵌套坐标（最容易出错的部分） |
| [04 · 渲染与性能](04-rendering-performance.md) | 脏标记 + 脏矩形局部重绘（默认）与条件回退、渲染队列缓存、矩阵零分配 |
| [05 · 事件系统](05-event-system.md) | `ICEEventTarget`、`EventBus`、DOM 事件桥接 |
| [06 · 序列化](06-serialization.md) | `Serializer`/`Deserializer`、类型映射、`registerType` |
| [07 · 交互与动画](07-interaction-animation.md) | 控制面板、拖拽/变换、连接线、动画 |
| [08 · 多运行时兼容](08-compatibility.md) | `cross-platform/root`、rAF 封装、Path2D 与小程序适配 |
| [09 · 路线图](09-roadmap.md) | 引擎原语 vs 应用层边界、原语现状（已落地 / 仍未做） |
| [10 · Worker/OffscreenCanvas](10-worker-offscreen.md) | Web-only 的 worker 渲染设计 + 最小可行性原型 |
| [11 · 视口缩放](11-viewport-zoom.md) | 视图缩放/平移原语：视口矩阵、渲染与命中的坐标换算 |
| [12 · 对齐吸附](12-alignment-guide.md) | 拖拽对齐/磁吸 + 提示线：边缘/中心/等间距，可配置、默认禁用 |
| [13 · 能力缺口分析](13-gap-analysis.md) | 对标主流引擎的「应该做而没做」清单：P0/P1/P2 分级 + 代码/外链证据索引 + 范围边界。**滚动更新**：§1 带「评估时 vs 当前」双列对照，§8 为逐条进展 |
| [14 · 无障碍原语](14-accessibility.md) | a11y 边界（引擎给原语、应用层做 DOM 镜像）、`getAccessibilityTree` / `setFocusedComponent` 契约 |
| [15 · 应用驱动的评估](15-app-driven-review.md) | 用两个真实案例（六页后台 + 全屏 Windows XP 桌面）反推：引擎扛住了什么、在哪里把人卡住、每条短板的归属与优先级 |

## 运行时全景（一图概览）

```mermaid
graph TD
    subgraph 全局单例
        FM[FrameManager<br/>rAF 封装]
    end
    FM -- "ICE_FRAME_EVENT" --> EB[EventBus<br/>每 ICE 实例一条]
    EB --> AM[AnimationManager<br/>动画补间]
    EB --> CR[CanvasRenderer<br/>脏检查 + 重绘]
    EB --> ED[DOMEventDispatcher<br/>DOM→ICE 事件]
    EB --> CP[ICEControlPanelManager<br/>选中/变换工具]
    EB --> LS[ICELinkSlotManager<br/>连接线插槽]
    CR -- "渲染完成后" --> EB
    CR --> CTX[CanvasRenderingContext2D]
```

- `FrameManager` 是**跨 ICE 实例共享**的全局单例，只负责把 rAF 回调转成 `ICE_FRAME_EVENT` 广播，不直接渲染。
- 每个 `ICE` 实例持有一条独立的 `EventBus`，各 Manager 通过订阅这条总线协作。
- 渲染由 `CanvasRenderer` 完成，它只在 `ice.dirty` 为真时工作。

## 阅读建议

- 想快速理解"一张图怎么画出来"→ 先读 [01 运行时](01-runtime.md) 和 [04 渲染](04-rendering-performance.md)。
- 想搞清楚"坐标为什么/怎么算"→ 精读 [03 坐标系与矩阵](03-coordinate-system.md)（引擎最核心、最易错的部分）。
- 想扩展自定义组件或接入持久化 → 看 [02 组件模型](02-component-model.md) + [06 序列化](06-serialization.md)。
