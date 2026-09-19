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
});
