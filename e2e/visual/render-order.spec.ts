/**
 * **渲染顺序（树序 + 兄弟按 zIndex）的真机判据**，配套 `examples/render-order/tree-order.html`。
 *
 * 修的是这个真实 bug：渲染队列过去是"展平后**全局**按 zIndex 排序" → 父容器的 zIndex 只要比
 * 子组件大，就会盖住自己的整棵子树（画出来一片空白、不报错）。
 * 光看队列不够，这里读**画布像素**：子组件那块该是什么色就得是什么色。
 */
import { test, expect } from '@playwright/test';

/** 读画布上某点的颜色（十六进制小写）。 */
async function pixelAt(page: any, x: number, y: number): Promise<string> {
  return page.evaluate(
    ({ px, py }) => {
      const c = document.querySelector('#canvas-1') as HTMLCanvasElement;
      const rect = c.getBoundingClientRect();
      const sx = c.width / rect.width;
      const sy = c.height / rect.height;
      const d = c.getContext('2d')!.getImageData(Math.round(px * sx), Math.round(py * sy), 1, 1).data;
      return `#${[d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    },
    { px: x, py: y }
  );
}

test.describe('渲染顺序', () => {
  test('父容器晚于子组件构造时，子组件仍然画在父之上（像素可见）', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

    await page.goto('/examples/render-order/tree-order.html');
    await page.waitForFunction(() => !!(window as any).__renderOrder);
    await page.waitForTimeout(400);

    // 子矩形在父的分组盒内部（父 20,40 + 子 40,60 → 世界盒 60,100 起、120×80）：
    // 取它的**正中心**，避免踩到抗锯齿边缘。
    const childCenter = await pixelAt(page, 120, 140);
    expect(childCenter, '子组件被父容器盖住了（渲染顺序又退回全局 zIndex 排序）').toBe('#dc3545');
    // 父的底色在子矩形之外可见
    const parentOnly = await pixelAt(page, 30, 60);
    expect(parentOnly).toBe('#0d6efd');

    // 兄弟按 zIndex：重叠区（380..440）由 zIndex 更大的黄色压住
    const overlap = await pixelAt(page, 410, 100);
    expect(overlap).toBe('#ffc107');
    // 只有绿色那一侧仍是绿
    const greenOnly = await pixelAt(page, 320, 100);
    expect(greenOnly).toBe('#198754');

    expect(errors).toEqual([]);
  });

  /**
   * **容器的派生部件先于内容**（2026-09-19 补）的真机判据。
   *
   * 页面里三层容器（池 → 泳道 → 任务）刻意写成"底 zIndex 9、任务 zIndex -9"的最坏情况：
   * 光看队列不够，这里读像素 —— 任务那块该是绿的就得是绿的。
   */
  test('容器的底 zIndex 更大也先画：三层嵌套的内容都可见（像素）', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

    await page.goto('/examples/render-order/tree-order.html');
    await page.waitForFunction(() => !!(window as any).__renderOrder);
    await page.waitForTimeout(400);

    // 池 40,260 420×220；泳道（池内 8,8 300×204）；任务（泳道内 20,40 200×120）
    const taskCenter = await pixelAt(page, 168, 368);
    expect(taskCenter, '任务被自己所在泳道/池的底色盖住了（派生部件不再先画）').toBe('#198754');
    expect(await pixelAt(page, 320, 400)).toBe('#6610f2'); // 任务之外、泳道之内 → 泳道底
    expect(await pixelAt(page, 400, 400)).toBe('#0d6efd'); // 泳道之外、池之内 → 池底

    // 重排 API 只作用于真实子节点：把任务"压到最下"之后仍然可见，派生部件的 zIndex 也没被改写
    const zAfterReorder = await page.evaluate(() => {
      const { task, lane } = (window as any).__renderOrder;
      task.sendToBack();
      return { taskZ: task.state.zIndex, laneBackgroundZ: lane.background.state.zIndex };
    });
    await page.waitForTimeout(300);
    expect(await pixelAt(page, 168, 368)).toBe('#198754');
    expect(zAfterReorder.taskZ, '重排 API 应当作用于真实子节点（任务被压到最下）').not.toBe(-9);
    expect(zAfterReorder.laneBackgroundZ, '派生部件（泳道底）的 zIndex 不该被重排改写').toBe(9);

    expect(errors).toEqual([]);
  });
});
