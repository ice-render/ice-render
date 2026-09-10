# 12 · 对齐吸附（AlignmentGuideManager）

## 目标与边界

拖拽组件时，把被拖组件的关键坐标与其他组件做最近匹配，命中阈值内自动吸附，并在工具层显示提示线。
默认**禁用**，应用层显式启用后才会生效：

```ts
ice.alignmentGuide.enable({
  threshold: 3,       // 磁吸像素
  hysteresis: 1,      // 脱离余量
  edge: true,
  center: true,
  spacing: true,
  guideStyle: { fillStyle: '#EC4899' },  // 提示线样式（透传 canvas ctx）
  guideWidth: 1,      // 提示线宽（屏幕像素）
  guideZIndex: 10000010,
});
ice.alignmentGuide.disable();
```

未启用时零开销、零副作用，因此不改变既有拖拽行为。

提示线外观通过 `guideStyle` / `guideWidth` / `guideZIndex` 参数化，应用层可自由定制颜色、线宽、层级等。

## 关键坐标

- X：`left`(minX)、`centerX`、`right`(maxX)
- Y：`top`(minY)、`centerY`、`bottom`(maxY)

## 三类对齐

1. **边缘**：source 的 left/right/top/bottom 对齐 target 的同/异侧边缘。
2. **中心**：source 的 centerX/centerY 对齐 target 的中心。
3. **等间距**：source 中心位于两个目标中心的中点（source 需位于两者之间）。

## 两条铁律

- **X/Y 两轴分别计算**：`computeSnap` 返回 `{ x, y }`，各自取最小 delta 并分别吸附；
  不能只返回单轴，否则「本已对齐的轴」会以 delta=0 抢占另一轴的吸附。
- **阈值是屏幕像素**：计算时按 `1 / viewport.scale` 换算成世界坐标，保证缩放视口下磁吸视觉距离一致。

## 挂载与提示线

- 监听 `evtBus` 的 `mousedown` 记录被拖组件，监听其 `AFTER_MOVE` 做吸附修正 + 画线；
  `mouseup` 解除监听并清线。
- 提示线用 `toolNodes` 的 `ICERect`（细线），不参与序列化；拖拽结束清除。

## 验收

- 单测：`tests/control-panel/AlignmentGuideManager.test.ts`
- 交互：`e2e/visual/alignment.spec.ts`
- 示例：`examples/alignment/alignment-snap.html`
