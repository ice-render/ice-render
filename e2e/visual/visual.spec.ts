import { test, expect } from '@playwright/test';

/**
 * 引擎渲染可视化回归（golden-image）。
 *
 * 原理：对一组「确定性渲染」的示例页截图，与已提交的基准图（__snapshots__）做像素级对比，
 * 捕获 jest 单测抓不到的「光栅层」回归（例如某次改动导致矩形渲染错位、嵌套坐标算错但矩阵值仍有限）。
 *
 * 注意：只收录「静态确定渲染」的示例，排除含 rAF 动画/随机坐标的示例（如 marching-ant、animation-basic）。
 */

const demos: Array<{ name: string; path: string }> = [
  { name: 'group-nested', path: '/examples/group/group-nested.html' },
  { name: 'group-and-children', path: '/examples/group/group-and-children.html' },
  { name: 'line-basic', path: '/examples/line-and-link/line-basic.html' },
  { name: 'line-visio', path: '/examples/line-and-link/line-visio.html' },
  { name: 'text-in-group', path: '/examples/text/text-in-group.html' },
  { name: 'text-padding', path: '/examples/text/text-padding.html' },
  { name: 'text-multiline', path: '/examples/text/text-multiline.html' },
  { name: 'text-edit', path: '/examples/text/text-edit.html' },
  { name: 'origin-custom', path: '/examples/transform/origin-custom.html' },
  { name: 'link-label', path: '/examples/line-and-link/link-label.html' },
  { name: 'shapes-style-effects', path: '/examples/shapes/shapes-style-effects.html' },
  { name: 'image-clip', path: '/examples/image/image-clip.html' },
  { name: 'line-curve', path: '/examples/line-and-link/line-curve.html' },
  {
    name: 'marching-ants',
    path: '/examples/line-and-link/marching-ants.html',
    extra: async (page) => {
      // 断言：蚂蚁线动画在跑（两次截图虚线位置不同 → 流动）
      const buf1 = await page.screenshot({ type: 'png' });
      await page.waitForTimeout(250);
      const buf2 = await page.screenshot({ type: 'png' });
      // 字节差异：流动动画会让两帧 PNG 字节不同
      if (buf1.equals(buf2)) {
        throw new Error('蚂蚁线未流动（两帧字节完全相同）');
      }
    },
  },
  { name: 'image-sprite', path: '/examples/image/image-sprite.html' },
  { name: 'flow-layout', path: '/examples/layout/flow-layout.html' },
  { name: 'grid-layout', path: '/examples/layout/grid-layout.html' },
  { name: 'border-layout', path: '/examples/layout/border-layout.html' },
  { name: 'box-layout', path: '/examples/layout/box-layout.html' },
  { name: 'card-layout', path: '/examples/layout/card-layout.html' },
  { name: 'card-deal', path: '/examples/layout/card-deal.html' },
  {
    name: 'card-deal-dealt',
    path: '/examples/layout/card-deal.html',
    extra: async (page) => {
      // 点击发牌，等动画完成，验证 13 张牌摊开（left 递增且分散）
      await page.click('#deal');
      await page.waitForTimeout(2500);
      const positions = await page.evaluate(() => {
        const table = (window as any).__ice.childNodes[0];
        return table.childNodes.map((c: any) => ({ left: c.state.left, tl: c.getMinBoundingBox(true).tl }));
      });
      // 13 张牌全部摊开（left 单调递增）
      for (let i = 1; i < positions.length; i++) {
        if (positions[i].left <= positions[i - 1].left) {
          throw new Error(`牌 ${i} 未摊开: ${JSON.stringify(positions)}`);
        }
      }
      // 全部在 canvas 内
      for (const p of positions) {
        if (p.tl[0] < 0 || p.tl[0] > 960) {
          throw new Error(`牌超出 canvas: ${JSON.stringify(p)}`);
        }
      }
    },
  },
  { name: 'overlay-layout', path: '/examples/layout/overlay-layout.html' },
  { name: 'layered-layout', path: '/examples/layout/layered-layout.html' },
  { name: 'git-commit-graph', path: '/examples/layout/git-commit-graph.html' },
  { name: 'dashboard', path: '/examples/layout/dashboard.html' },
  { name: 'logo', path: '/examples/layout/logo.html' },
  { name: 'layer-burst-init', path: '/examples/layout/layer-burst.html' },
  {
    name: 'layered-layout-lines',
    path: '/examples/layout/layered-layout.html',
    extra: async (page) => {
      // 断言：分层布局后，每条连线的全局 tl 接近源节点右边中点
      //（即连线视觉上正确连接到源节点，而非重叠在同一点）
      const r = await page.evaluate(() => {
        const group = (window as any).__ice.childNodes[0];
        const edges = group.childNodes.filter((c: any) => c.isLine);
        const nodes = group.childNodes.filter((c: any) => !c.isLine);
        const nodeBox: any = {};
        for (const n of nodes) nodeBox[n.props.id] = n.getMinBoundingBox(true);
        return edges.map((e: any) => {
          const eb = e.getMinBoundingBox(true);
          return { from: e.getLinkFromId(), to: e.getLinkToId(), lineTl: eb.tl, srcRc: nodeBox[e.getLinkFromId()]?.rc };
        });
      });
      for (const e of r) {
        if (Math.abs(e.lineTl[0] - e.srcRc[0]) >= 2 || Math.abs(e.lineTl[1] - e.srcRc[1]) >= 2) {
          throw new Error(`连线 ${e.from}->${e.to} 视觉未对齐源节点：lineTl=${e.lineTl} vs srcRc=${e.srcRc}`);
        }
      }
    },
  },
];

for (const d of demos) {
  test(d.name, async ({ page }) => {
    await page.goto(d.path);
    // 等待首帧渲染完成（引擎由 rAF 驱动）
    await page.waitForTimeout(600);
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveScreenshot(`${d.name}.png`);
  });
}
