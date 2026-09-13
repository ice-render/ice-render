import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
await page.goto('http://localhost:8105/e2e/visual/fixtures/nested-interaction.html');
await page.waitForTimeout(300);

const measure = async (label) => page.evaluate(async (label) => {
  const ice = window.__ice;
  let frames = 0;
  const handler = () => { frames++; };
  ice.evtBus.on('ICE_FRAME_EVENT', handler);
  await new Promise((r) => setTimeout(r, 500));
  ice.evtBus.off('ICE_FRAME_EVENT', handler);
  return { label, framesIn500ms: frames, dirty: ice.dirty, hasActiveAnimations: ice.animationManager.hasActiveAnimations() };
}, label);

console.log(JSON.stringify(await measure('静止场景（无动画、无脏）')));
// 加一个循环动画 → 应该恢复帧
await page.evaluate(() => {
  const ice = window.__ice;
  const rect = new ICE.ICERect({ left: 10, top: 10, width: 20, height: 20, style: { fillStyle: '#f00' },
    animations: { 'transform.translate': { from: [0, 0], to: [40, 0], duration: 600, loop: true } } });
  ice.addChild(rect);
  ice.dirty = true;
  ice.renderer.frameEvtHandler();
});
await page.waitForTimeout(200);
console.log(JSON.stringify(await measure('加入循环动画后（应持续跑帧）')));
// 移除动画 + 静置 → 应该又停
await page.evaluate(() => {
  const ice = window.__ice;
  ice.animationManager.animationMap.clear();
  ice.dirty = false;
});
await page.waitForTimeout(300);
console.log(JSON.stringify(await measure('移除动画并静置后（应再次停帧）')));
await browser.close();
