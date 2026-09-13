import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
page.on('console', (m) => console.log('[page]', m.type(), m.text()));
page.on('pageerror', (e) => console.log('[err]', String(e)));
await page.goto('http://localhost:8105/e2e/visual/fixtures/nested-interaction.html');
await page.waitForTimeout(400);

const countFrames = (ms = 500) => page.evaluate(async (ms) => {
  const ice = window.__ice;
  let frames = 0;
  const h = () => { frames++; };
  ice.evtBus.on('ICE_FRAME_EVENT', h);
  await new Promise((r) => setTimeout(r, ms));
  ice.evtBus.off('ICE_FRAME_EVENT', h);
  return frames;
}, ms);

console.log('静止 500ms 帧数 =', await countFrames());
const info = await page.evaluate(() => {
  const ice = window.__ice;
  const rect = new ICE.ICERect({ left: 20, top: 20, width: 20, height: 20, style: { fillStyle: '#ef4444' },
    animations: { 'transform.translate': { from: [0, 0], to: [40, 0], duration: 600, loop: true } } });
  ice.addChild(rect);
  ice.dirty = true;
  ice.renderer.frameEvtHandler();
  return { animMapSize: ice.animationManager.animationMap.size, hasActive: ice.animationManager.hasActiveAnimations(), dirty: ice.dirty };
});
console.log('加入动画后:', JSON.stringify(info));
await page.waitForTimeout(200);
console.log('加入后 500ms 帧数 =', await countFrames());
console.log('再查状态:', JSON.stringify(await page.evaluate(() => ({
  animMapSize: window.__ice.animationManager.animationMap.size,
  hasActive: window.__ice.animationManager.hasActiveAnimations(),
  dirty: window.__ice.dirty,
  left: window.__ice.childNodes[window.__ice.childNodes.length - 1].state.left,
}))));
await browser.close();
