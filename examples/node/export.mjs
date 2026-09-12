/**
 * Node 侧出图：把一份场景导出成 SVG（矢量），可选再栅格化成 PNG。
 *
 * 用法：
 *   npm run build                                   # 先构建 dist
 *   node examples/node/export.mjs out/scene          # 产出 out/scene.svg
 *   node examples/node/export.mjs out/scene --png    # 装了 @resvg/resvg-js 时再产出 PNG
 *
 * 为什么能做到：路径对象是 Path2DRecorder —— 命令流不依赖 canvas，所以 Node 里没有
 * `document` / `CanvasRenderingContext2D` 也能把同一份组件树重新描述成矢量。
 * PNG/PDF 不需要引擎内置依赖：SVG 是通用中间格式，交给任意栅格化/转换工具即可
 * （`@resvg/resvg-js`、`sharp`、`rsvg-convert`、`inkscape`、headless Chrome 打印成 PDF 都行）。
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ICE = require(path.resolve(process.cwd(), 'dist', 'index.cjs'));

const outBase = process.argv[2] || path.join('out', 'scene');
const wantPng = process.argv.includes('--png');

/** 构造一份小场景：容器 + 圆角 + 渐变 + 虚线 + 文本（与浏览器示例同构） */
function buildScene() {
  // headless()：不 init canvas 也能建树 + 出图（服务端没有 document / canvas）
  const ice = ICE.ICE.headless();

  const card = new ICE.ICEGroup({
    left: 40,
    top: 40,
    width: 260,
    height: 140,
    radius: 12,
    fill: true,
    stroke: true,
    style: { fillStyle: '#ffffff', strokeStyle: '#cbd5e1', lineWidth: 1, shadow: 'md' },
  });
  card.addChild(
    new ICE.ICEText({
      left: 0,
      top: 50,
      width: 260,
      height: 40,
      text: 'Node 服务端出图',
      stroke: false,
      style: { fontSize: 22, fillStyle: '#0f172a', textAlign: 'center', textBaseline: 'middle', fontWeight: 'bold' },
    })
  );
  ice.addChild(card);

  const bar = new ICE.ICERect({
    left: 340,
    top: 40,
    width: 260,
    height: 140,
    radius: 12,
    fill: true,
    stroke: false,
    style: {
      fillGradient: { type: 'linear', from: [0, 0], to: [0, 140], stops: [[0, '#38bdf8'], [1, '#1d4ed8']] },
    },
  });
  ice.addChild(bar);

  const dashed = new ICE.ICEPolyLine({
    // 折线的公开入参是 points（dots 是派生 state，由 refreshParams 按 points 重算）
    points: [
      [120, 260],
      [300, 260],
      [380, 210],
      [520, 210],
    ],
    fill: false,
    stroke: true,
    lineDash: [8, 6],
    style: { strokeStyle: '#ef4444', lineWidth: 2 },
  });
  ice.addChild(dashed);

  return ice;
}

const ice = buildScene();
const { svg, width, height } = ice.toSvgResult({ padding: 16, background: '#f8fafc' });

fs.mkdirSync(path.dirname(path.resolve(outBase)), { recursive: true });
fs.writeFileSync(`${outBase}.svg`, svg);
console.log(`[export] ${outBase}.svg  ${Math.round(width)}×${Math.round(height)}  ${svg.length} 字节`);

if (!wantPng) {
  process.exit(0);
}

// 可选依赖：装了栅格化库就把同一份 SVG 转成 PNG（引擎自身保持零运行时依赖）
let resvg = null;
try {
  resvg = require('@resvg/resvg-js');
} catch (err) {
  resvg = null;
}
if (!resvg) {
  console.log('[export] 未安装 @resvg/resvg-js：跳过 PNG。');
  console.log('         SVG 已是通用中间格式，可用 resvg / sharp / rsvg-convert / headless Chrome 转 PNG 或 PDF。');
  process.exit(0);
}

const renderer = new resvg.Resvg(svg, {
  fitTo: { mode: 'width', value: Math.round(width * 2) }, // 2x 输出，SVG 是矢量、放大不掉墨
});
fs.writeFileSync(`${outBase}.png`, renderer.render().asPng());
console.log(`[export] ${outBase}.png  ${Math.round(width) * 2}px 宽`);
