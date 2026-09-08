import { defineConfig } from '@playwright/test';

/**
 * 可视化回归测试配置。
 *
 * 前置：npm run build（生成 dist/index.umd.js）+ npm install（含 http-server）
 * 首次运行需生成基准图：npx playwright test --update-snapshots
 * 之后运行：npm run test:visual
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
    reuseExistingServer: true,
    timeout: 30_000,
  },
  use: {
    baseURL: 'http://localhost:8090',
    viewport: { width: 1024, height: 768 },
    deviceScaleFactor: 1,
  },
});
