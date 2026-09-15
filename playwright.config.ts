import { defineConfig } from '@playwright/test';

/**
 * 可视化回归测试配置。
 *
 * 前置：npm run build（生成 dist/index.umd.js）+ npm install（含 http-server）
 * 首次运行需生成基准图：npx playwright test --update-snapshots
 * 之后运行：npm run test:visual
 *
 * 家族端口分配（同一台机器上可同时跑，见 AGENTS.md「家族 e2e 端口分配」）：
 * ice-render 8090 / ice-entity-designer 8091 / ice-smart-water 8092 /
 * ice-web-components 8093 / ice-render-dsl 8094 / react-demo 8095 / ice-chart 5177。
 *
 * `reuseExistingServer: false`：端口被**别的仓的服务**占着时直接响亮失败。
 * 曾经因为 true + 端口串号，e2e 静默复用了另一个仓的服务目录 —— 全红（页面 404），
 * 看起来却像代码坏了（排查成本远高于这里少一次复用）。
 */
export default defineConfig({
  testDir: './e2e/visual',
  snapshotDir: './e2e/visual/__snapshots__',
  timeout: 30_000,
  expect: {
    toHaveScreenshot: {
      // 跨平台/抗锯齿阈值；若 CI 与本地渲染器差异大可调大
      maxDiffPixelRatio: 0.01,
    },
  },
  webServer: {
    command: 'npx http-server . -p 8090 -c-1',
    port: 8090,
    reuseExistingServer: false,
    timeout: 30_000,
  },
  use: {
    baseURL: 'http://localhost:8090',
    viewport: { width: 1024, height: 768 },
    deviceScaleFactor: 1,
  },
});
