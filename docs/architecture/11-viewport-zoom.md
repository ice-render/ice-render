# 11 · 视口缩放（view zoom / pan）

## 目标与边界

「画布缩放」指**视图缩放**（zoom in/out 查看画布 + 平移），不改变任何图元的世界尺寸与 state。
它是编辑器类应用（实体设计器、流程图）的基础能力，由引擎提供**视口原语**，交互 UX 由应用层拼装。

## 视口模型

```text
屏幕坐标 = 世界坐标 * scale + translate
```

`ICE.viewport` 只存三个标量：

```ts
{ scale: number; tx: number; ty: number }
```

对应的视口矩阵（列向量，mat2d）为：

```text
viewportMatrix = [scale, 0, 0, scale, tx, ty]
```

默认 `{ scale: 1, tx: 0, ty: 0 }`，即单位视口，与既有行为完全一致。

## 关键 API

| API | 作用 |
|---|---|
| `ice.setViewport(scale, tx, ty)` | 设置视口，触发一次全量重绘（`markQueueDirty`），不改组件 state |
| `ice.screenToWorld(sx, sy)` | 屏幕像素 → 世界坐标（命中检测用） |
| `ice.worldToScreen(wx, wy)` | 世界坐标 → 屏幕像素 |

## 三条链路

1. **渲染**：组件 `render()` 在主 ctx 应用视口，最终 CTM = `viewport · composedMatrix`。
   `renderTo()`（离屏缓存）不应用视口——缓存位图永远是「世界坐标下的组件外观」。
2. **命中**：`DOMEventDispatcher` 先把 `offsetX/offsetY`（屏幕像素）经 `screenToWorld()` 转成世界坐标，
   再 `component.containsPoint()`。视口缩放后命中无需改组件命中逻辑。
3. **脏矩形**：视口非单位时，世界盒与屏幕 `clearRect/clip` 不一致，`__collect()` 直接回退全量重绘；
   视口变化本身经 `markQueueDirty` 回退一次全量并重建快照。

## 离屏缓存与视口

`ObjectCache.draw()` 把世界坐标的缓存位图按视口缩放/平移到屏幕。缩放会拉伸缓存位图，
极致缩放比例下可能有模糊；后续可按「当前视口分辨率重建缓存」优化。

## 与图元缩放的区分

- 图元 `transform.scale`：改变组件自身 `state`，所有图元尺寸/线宽/字号一起变。
- 视口 `ice.viewport.scale`：不改 state，只改屏幕显示；线宽/字号仍按世界尺寸绘制后再整体缩放。

## 验收

- 单测：`tests/ICE.viewport.test.ts`（坐标换算 + CTM = viewport·composed）
- 交互：`e2e/visual/viewport.spec.ts`（滚轮缩放 + 中键平移 + 缩放后命中）
- 示例：`examples/viewport/viewport-zoom.html`
