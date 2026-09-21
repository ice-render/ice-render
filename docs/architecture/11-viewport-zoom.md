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
| `ice.setViewport(scale, tx, ty)` | 设置视口，请求**本帧整屏重画**（`markViewportChanged()`），不改组件 state、**不清**渲染队列与上屏快照 |
| `ice.screenToWorld(sx, sy)` | 屏幕像素 → 世界坐标（命中检测用） |
| `ice.worldToScreen(wx, wy)` | 世界坐标 → 屏幕像素 |

## 三条链路

1. **渲染**：组件 `render()` 在主 ctx 应用视口，最终 CTM = `viewport · composedMatrix`。
   `renderTo()`（离屏缓存）不应用视口——缓存位图永远是「世界坐标下的组件外观」。
2. **命中**：`DOMEventDispatcher` 先把 `offsetX/offsetY`（屏幕像素）经 `screenToWorld()` 转成世界坐标，
   再 `component.containsPoint()`。视口缩放后命中无需改组件命中逻辑。
3. **脏矩形**：视口非单位时，世界盒与屏幕 `clearRect/clip` 不一致 —— 这个不一致由 `mapBoxToRender()`
   一处换算解决（不再回退全量）；**视口变化那一帧则必须整屏重画**（屏幕每处落墨都错位了，
   局部重绘会在裁剪区外留旧视图的像素），但**不清**渲染队列、上屏快照与静态层。

## 视口变化不是结构变更（2026-09-21 修正）

`setViewport()` 以前调 `markQueueDirty()`（结构变更用的路径）：队列重建 + **清空上屏快照** + 丢静态层。
而这三样都不随视口失效 —— 队列成员没变、快照存的是**世界坐标盒**、静态层自带 `(rs, ox, oy)` 栅格
对齐校验（纯平移还能整体贴回）。清掉它们是复合损失：每帧从零重建，**而且没有快照就没有视口裁剪**，
10 万图元里屏外的那批也要逐个走一遍。

真机 Chrome + CDP（100,000 图元、每帧平移 3px、3 秒真实 rAF）：

| 平移写法 | fps | p50 | 长任务 |
|---|---|---|---|
| 改前：`setViewport()` → `markQueueDirty()` | 9.9 | 103.4ms | 28 个 / 2,895ms |
| 改后：`setViewport()` → `markViewportChanged()` | **116.6** | **8.4ms** | **0** |
| 直改 `ice.viewport.tx`（旧写法绕开这条路） | 119.9 → 115.6 | 8.3ms | 0 |

口径：① 视口值没变时**什么都不做**（`平移驱动里重复下发同值很常见：钳制边界、视口跟随同步`）；
② 视口变化帧跳过局部重绘、照走"静态层 → 全量"；③ 快照保留 ⇒ 当帧就按**新可见区**裁剪。
回归：`tests/renderer/viewport-repaint.test.ts`、`tests/renderer/CanvasRenderer.culling.test.ts`、
`e2e/visual/viewport.spec.ts`。

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
