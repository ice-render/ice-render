/**
 * 模拟器级端到端：用官方 `miniprogram-automator` 驱动微信开发者工具，跑真实的 mini program 运行时。
 *
 * 这一层比 `tests/mini-program/`（Node 里的「小程序形状」环境）更接近真实：真的
 * `wx.createSelectorQuery`、真的 `wx.createOffscreenCanvas`、真实的事件 payload 形状。
 * 但它**仍不是真机**（字体、GPU、低端机、基础库版本差异覆盖不到）。
 *
 * 前置：
 *   1. 装了微信开发者工具，并已登录；
 *   2. 工具 → 设置 → 安全设置 → 打开「服务端口」；
 *   3. 在本目录执行过 `npm install`，并在工具里「构建 npm」（产物 miniprogram_npm/ice-render）。
 *
 * 用法：
 *   node e2e/smoke.js [--keep-open]
 */
const fs = require('fs');
const path = require('path');
const automator = require('miniprogram-automator');

const CLI_PATH = process.env.WX_DEVTOOLS_CLI || '/Applications/wechatwebdevtools.app/Contents/MacOS/cli';
const PROJECT_PATH = path.resolve(__dirname, '..');
const ARTIFACT_DIR = path.join(__dirname, 'artifacts');
const KEEP_OPEN = process.argv.indexOf('--keep-open') !== -1;

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
}
function assert(cond, message) {
  if (!cond) throw new Error(message);
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 准备 `miniprogram_npm/ice-render`。
 *
 * 正常路径是：本目录 `npm install` 后在开发者工具里「构建 npm」。
 * 但**游客模式（touristappid）下 CLI 的 `build-npm` 会被 AppID 校验挡住**，
 * 所以这里直接按 DevTools 的产物形状放一份（内容就是引擎产物，等价于构建 npm 的结果）：
 *   miniprogram_npm/ice-render/index.js  ← dist/index.umd.js
 *   miniprogram_npm/ice-render/package.json
 */
function prepareMiniprogramNpm() {
  const bundle = path.resolve(PROJECT_PATH, '..', '..', 'dist', 'index.umd.js');
  if (!fs.existsSync(bundle)) {
    throw new Error(`找不到引擎产物：${bundle}（先在引擎仓执行 npm run build）`);
  }
  const target = path.join(PROJECT_PATH, 'miniprogram_npm', 'ice-render');
  fs.mkdirSync(target, { recursive: true });
  fs.copyFileSync(bundle, path.join(target, 'index.js'));
  fs.writeFileSync(
    path.join(target, 'package.json'),
    JSON.stringify({ name: 'ice-render', version: 'local-bundle', main: 'index.js' }, null, 2) + '\n'
  );
}

/** 从页面状态文案里解析方块位置：「… 方块位置 (40, 40)」 */
function parsePosition(status) {
  const match = /方块位置 \((\d+), (\d+)\)/.exec(String(status || ''));
  return match ? { left: Number(match[1]), top: Number(match[2]) } : null;
}

(async () => {
  let miniProgram = null;
  try {
    prepareMiniprogramNpm();
    record('准备 miniprogram_npm/ice-render', true, '（游客模式下用引擎产物等价替代「构建 npm」）');

    console.log(`启动开发者工具（项目：${PROJECT_PATH}）…`);
    miniProgram = await automator.launch({ cliPath: CLI_PATH, projectPath: PROJECT_PATH });

    const page = await miniProgram.reLaunch('/pages/ice-canvas/index');
    await page.waitFor(1500);

    // 1) 页面里的引擎初始化成功（status 文案由页面在 init 成功后写入）
    const data = await page.data();
    const status = data && data.status ? String(data.status) : '';
    assert(status.indexOf('拖一下') >= 0 || status.indexOf('触摸') >= 0, `页面状态异常：${status}`);
    record('页面加载 + ICE.init 成功', true, status);

    // 2) 引擎确实建了图元（真实的 wx canvas 节点 + 真实渲染循环）
    const before = parsePosition(status);
    assert(before, `页面里没有取到引擎图元位置：${status}`);
    record('真实运行时里引擎建图成功', true, `left=${before.left}, top=${before.top}`);

    // 3) 触摸拖拽：走真实的 bindtouch* → 引擎输入归一化
    const canvas = await page.$('#ice-canvas');
    assert(canvas, '找不到 #ice-canvas');
    const offset = await canvas.offset();
    const canvasLeft = Number(offset.left) || 0;
    const canvasTop = Number(offset.top) || 0;
    const start = { identifier: 1, clientX: canvasLeft + 120, clientY: canvasTop + 80 };
    const move = { identifier: 1, clientX: canvasLeft + 320, clientY: canvasTop + 260 };

    await canvas.touchstart({ touches: [start] });
    await page.waitFor(100);
    await canvas.touchmove({ touches: [move] });
    await page.waitFor(100);
    await canvas.touchend({ touches: [], changeTouches: [move] });
    await page.waitFor(400);

    const afterStatus = (await page.data()).status;
    const after = parsePosition(afterStatus);
    assert(after && after.left > before.left, `拖拽后面板没有移动：${JSON.stringify({ before, afterStatus })}`);
    record('触摸拖拽驱动了引擎图元', true, `left ${before.left} → ${after.left}，top ${before.top} → ${after.top}`);

    // 4) 截图存档
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
    const shot = path.join(ARTIFACT_DIR, 'mini-program-smoke.png');
    await miniProgram.screenshot({ path: shot });
    record('截图存档', fs.existsSync(shot), shot);
  } catch (err) {
    record('执行失败', false, (err && err.message) || String(err));
  } finally {
    if (miniProgram && !KEEP_OPEN) {
      try {
        await miniProgram.close();
      } catch (err) {
        /* 关闭失败不影响结论 */
      }
    }
  }

  const failed = results.filter((item) => !item.ok);
  console.log(`\n合计 ${results.length} 项：通过 ${results.length - failed.length}，失败 ${failed.length}`);
  process.exit(failed.length === 0 ? 0 : 1);
})();
