# 实施计划：连线标签旋转 `style.label.angle`

spec：`docs/superpowers/specs/2026-09-26-edge-label-angle-design.md`

1. **测试先行**：`tests/link/polyline-label-angle.test.ts` —— AABB（90° / 45°）、非法值当 0、
   运行时改角度、画布调用序列（`translate → rotate → 未旋转盒`）、不转时序列不变。
2. `ICEPolyLine`：`__labelAngle()`（非法当 0）+ `__labelMetrics()` 返回 AABB 与未旋转 `w / h`
   + `drawLabel()` 绕中心转 + `getLabelRenderInfo()` 带 `angle / w / h`；样式表注释登记新键。
3. `SvgExporter`：有角度时套 `<g transform="rotate(deg x y)">`，rect 用未旋转尺寸。
4. `npm run verify`（lint / types / build / jest / bench / pkg:check）。
5. `npm run regression:family`（`src/` 核心渲染改动 → 全家族 e2e），发版前跑。
6. 发版：CHANGELOG → merge `dev` 进 `master` → 4.3.1 + tag → `npm publish` → 两远端都推。
7. 下游：`ice-agent-console` 跟 pin，按"竖段 + 装得下"算 `angle = -π/2` 与偏移，并把
   "竖线长段的标注是转过的"写成可断言判据。
