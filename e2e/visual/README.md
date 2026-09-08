# 可视化回归测试（golden-image）

对引擎「光栅层」输出做像素级回归，补上 jest 单测抓不到的部分（单测只验证矩阵/事件等纯逻辑，抓不到 `ctx.fill/stroke` 的实际渲染结果）。

## 原理

用 Playwright 打开一组**确定性渲染**的示例页（`examples/**/*.html`），截图后与已提交的基准图（`e2e/visual/__snapshots__/`）做像素对比。任一改动导致渲染错位/颜色偏差即失败。

## 首次运行（生成基准图）

```bash
npm run build                        # 生成 dist/index.umd.js
npm i -D @playwright/test http-server # 安装依赖
npx playwright install chromium      # 下载 Chromium（一次性，较大）
npx playwright test --update-snapshots # 生成基准图，人工确认无误后提交
```

## 日常回归

```bash
npm run test:visual                  # 与基准图对比，全绿即无光栅层回归
```

## 已收录示例（均无 Math.random/rAF，确定性渲染）

`group-nested`、`group-and-children`、`line-basic`、`line-visio`、`text-in-group`、`text-padding`。

> 含 `requestAnimationFrame` 动画或 `Math.random` 随机坐标的示例（如 `marching-ant`、`animation-basic`、`shapes-basic`、`group-basic`、`bounding-box`）因输出非确定，刻意排除。

## 说明

- 需要本机有网络下载 Chromium（大陆环境可设置 `PLAYWRIGHT_DOWNLOAD_HOST` 镜像）。
- 跨平台/不同 GPU 抗锯齿可能造成细微差异，`maxDiffPixelRatio` 已在 `playwright.config.ts` 设为 0.01，必要时调大。
- 基准图按平台命名（如 `*-darwin.png`）；在其它 OS 上首次需重新 `--update-snapshots` 生成对应平台的基准图。
