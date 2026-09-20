/**
 * Worker 镜像渲染（阶段二：状态/命令协议 + 输入留在主线程）的真机验收。
 *
 * 判据一：**worker 按协议同步出来的画面，必须与主线程用同一棵树直绘的画面逐像素一致**。
 * 这条比"画面动起来了"强得多 —— 它同时钉住了：
 * ① 全量场景（`scene`）能把树完整搬过去（类型注册、派生参数、主题都在内）；
 * ② 状态增量（`ops`）与原树逐点等价（含点集这类派生参数、嵌套 `style` 深合并）；
 * ③ 结构变更（加/删子节点）走**结构增量 op** 之后，镜像依旧与原树一致 —— 且**不重发整份文档**。
 *
 * 判据二：**交互仍然全部发生在主线程**，且镜像里能看到同样的反馈：
 *  - 命中检测按**可见画布**的矩形换算（夹具把画布刻意偏离页面左上角，坐标错了就点不中）；
 *  - 选中状态推给 worker 之后，**worker 侧自己的控制面板**画出手柄（工具层不序列化）；
 *  - 拖动组件 → 主线程改状态 → 镜像跟上 → 画面与参考仍然逐像素一致（含手柄跟随）。
 *
 * 场景刻意**不含文本**：worker 内拿不到主画布的 `lang`，CJK 字形选择可能与主线程分叉
 * （见 docs/architecture/10-worker-offscreen.md §2 的边界表）。几何场景应当严格 0 差异。
 */
import { test, expect } from '@playwright/test';

interface MirrorCmp {
  diff: number;
  alphaDiff: number;
  maxChannel: number;
  maxPremult: number;
  firstPixel: number;
  total: number;
}

test('worker 镜像：状态与结构增量之后，画面与主线程参考逐像素一致', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 200));
  });

  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/examples/worker/mirror-render.html', { waitUntil: 'load' });
  await page.waitForFunction(() => (window as any).__ready(), undefined, { timeout: 20_000 });

  // 夹具里的 __step：0 初始 / 1 位移换色 / 2 半径 / 3 加子节点 / 4 删子节点
  const steps = 5;
  for (let i = 0; i < steps; i++) {
    // 帧号必须在 `__step` **之前**采样：step 内部会立刻要一帧（`host.paint()`），
    // 采样晚了就会等一个不会再来的一帧（空闲门控下静止时不再空发节拍）
    const before: any = await page.evaluate(() => (window as any).__stats().frames);
    const ok = await page.evaluate((s: number) => (window as any).__step(s), i);
    expect(ok, `step ${i} 应当存在`).toBe(true);
    const frame: any = await page.evaluate((since: number) => (window as any).__waitFrame(since), before);
    // `renderMs` 只用于报告（小场景常常 <0.1ms，量到 0 不代表没渲染）；用帧计数确认"真的画了一帧"
    expect(frame.frames).toBeGreaterThan(0);
    expect(frame.renderMs).toBeGreaterThanOrEqual(0);
    const cmp: MirrorCmp = await page.evaluate(() => (window as any).__compare());
    expect(cmp.alphaDiff, `step ${i} alpha 差异（覆盖率错位）：${JSON.stringify(cmp)}`).toBe(0);
    expect(cmp.maxPremult, `step ${i} 预乘通道差：${JSON.stringify(cmp)}`).toBeLessThanOrEqual(2);
    // 几何场景（无文本）钉严格 0：任何结构性错位都不该被容差放过
    expect(cmp.diff, `step ${i} 差异像素：${JSON.stringify(cmp)}`).toBe(0);
  }

  const stats: any = await page.evaluate(() => (window as any).__stats());
  expect(stats.last.appliedOps, '镜像应当真的应用过状态补丁').toBeGreaterThan(0);
  /**
   * 五步里第 3 步"加子节点"、第 4 步"删子节点"走的是**结构增量 op**（v2 起）——
   * 整轮只应当在启动时有过 1 次全量场景。这条是护栏：结构增量一退化回"重发整份文档"，
   * 这里立刻红（此前每加/删一个节点都要重发整份文档 + worker 冷启动全量重绘）。
   */
  expect(stats.last.appliedScenes, `结构变更不应触发全量重同步：${JSON.stringify(stats.last)}`).toBe(1);
  expect(stats.last.appliedAdds, '加子节点应当走 add op').toBeGreaterThan(0);
  expect(stats.last.appliedRemoves, '删子节点应当走 remove op').toBeGreaterThan(0);
  expect(errors, '不应有页面/console 错误').toEqual([]);

  const line =
    `mirror 帧=${stats.frames} 消息=${stats.sent} 组件=${stats.last.components} ` +
    `已应用 op=${stats.last.appliedOps} 最后一帧 ${stats.last.renderMs.toFixed(2)}ms`;
  console.log(`[worker-mirror] ${line}`);
  test.info().annotations.push({ type: 'worker-mirror', description: line });
});

test('worker 镜像：输入留在主线程 —— 命中/选择/拖拽在镜像里都有同样的反馈', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 200));
  });

  await page.setViewportSize({ width: 1500, height: 950 });
  await page.goto('/examples/worker/mirror-render.html', { waitUntil: 'load' });
  await page.waitForFunction(() => (window as any).__ready(), undefined, { timeout: 20_000 });

  const frames = () => page.evaluate(() => (window as any).__stats().frames);
  const waitFrame = async (before: number) => {
    await page.evaluate((since: number) => (window as any).__waitFrame(since), before);
    await page.waitForTimeout(150);
  };

  // 未选中：worker 画面里不该有控制面板
  expect(await page.evaluate(() => (window as any).__panelPixels())).toBe(0);

  // ① 在**偏离页面左上角**的可见画布上点中矩形：主线程命中 → 选中 → 推给 worker
  const center: any = await page.evaluate(() => (window as any).__centerOf('rect'));
  const beforeClick = await frames();
  await page.mouse.click(center.x, center.y);
  await waitFrame(beforeClick);
  const selected: any = await page.evaluate(() => ({
    ids: (window as any).__selection(),
    rectId: (window as any).__nodes.rect.props.id,
  }));
  expect(selected.ids, '主线程应当选中被点中的矩形（坐标按可见画布算）').toEqual([selected.rectId]);
  // ② worker 侧用**自己的**控制面板画出了手柄
  const panelPixels = await page.evaluate(() => (window as any).__panelPixels());
  expect(panelPixels, 'worker 画面里应当出现选择手柄').toBeGreaterThan(0);
  const afterSelect: MirrorCmp = await page.evaluate(() => (window as any).__compare());
  expect(afterSelect.diff, `选中态逐像素一致：${JSON.stringify(afterSelect)}`).toBe(0);

  // ③ 拖拽：主线程改状态 → 镜像跟上（含手柄跟随），画面依旧逐像素一致
  const beforeDrag: any = await page.evaluate(() => ({
    left: (window as any).__nodes.rect.state.left,
    top: (window as any).__nodes.rect.state.top,
  }));
  const beforeDragFrame = await frames();
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(center.x + 30, center.y + 20, { steps: 5 });
  await page.mouse.move(center.x + 60, center.y + 40, { steps: 5 });
  await page.mouse.up();
  await waitFrame(beforeDragFrame);
  const afterDrag: any = await page.evaluate(() => ({
    left: (window as any).__nodes.rect.state.left,
    top: (window as any).__nodes.rect.state.top,
  }));
  expect(afterDrag.left - beforeDrag.left).toBeCloseTo(60, 0);
  expect(afterDrag.top - beforeDrag.top).toBeCloseTo(40, 0);
  const afterDragCmp: MirrorCmp = await page.evaluate(() => (window as any).__compare());
  expect(afterDragCmp.diff, `拖拽后逐像素一致（含面板跟随）：${JSON.stringify(afterDragCmp)}`).toBe(0);

  // ④ 点空白处（画布右下角，离所有图形都远）→ 主线程隐藏面板 → worker 的手柄也必须消失
  //    注意引擎语义：点空白**只隐藏面板**，不清空 `selectionList`（选中列表是应用自己管的状态），
  //    所以这里断言的是"两边的手柄都不见了"，而不是"选中被清空"
  const empty: any = await page.evaluate(() => {
    const rect = document.getElementById('view').getBoundingClientRect();
    return { x: rect.left + 600, y: rect.top + 370 };
  });
  const beforeEmpty = await frames();
  await page.mouse.click(empty.x, empty.y);
  await waitFrame(beforeEmpty);
  expect(await page.evaluate(() => (window as any).__panelPixels()), '空点之后 worker 的手柄应当消失').toBe(0);
  const afterEmptyCmp: MirrorCmp = await page.evaluate(() => (window as any).__compare());
  expect(afterEmptyCmp.diff, `空点后逐像素一致：${JSON.stringify(afterEmptyCmp)}`).toBe(0);

  expect(errors, '不应有页面/console 错误').toEqual([]);
  const stats: any = await page.evaluate(() => (window as any).__stats());
  const line = `mirror 交互：手柄像素=${panelPixels} 拖拽后差异=${afterDragCmp.diff} 已应用选择=${stats.last.appliedSelections}`;
  console.log(`[worker-mirror] ${line}`);
  test.info().annotations.push({ type: 'worker-mirror', description: line });
});
