/**
 * SVG 导出的结构与口径回归。
 *
 * 钉死的重点（都是「导出与画布必须一致」的地方）：
 * - 路径命令流 → `d`（矩形 / 圆角矩形 / 圆弧 / 折线）；
 * - 每个组件一层 `<g transform="matrix(...)">`，嵌套容器用 `composeMatrix()` 的**世界矩阵**
 *   （所以导出的是绝对坐标，不依赖 SVG 的嵌套 group 语义）；
 * - 文本按 `getRenderLines()` 的行与基线输出，居中/右对齐用 `text-anchor` 表达；
 * - 填充/描边/线宽/虚线/透明度与 `state` + `style` 的合并口径一致；
 * - 内容模式下的画布尺寸 = 内容包围盒（含描边余量）+ 留白。
 */
jest.mock('../../src/cross-platform/root', () => {
  const PolyfillPath2D = jest.requireActual('../../src/cross-platform/PolyfillPath2D').default;
  return { __esModule: true, default: { createPath2D: () => new PolyfillPath2D() } };
});

import root from '../../src/cross-platform/root';
import ICEPath from '../../src/graphic/ICEPath';
import ICEGroup from '../../src/graphic/container/ICEGroup';
import ICERect from '../../src/graphic/shape/ICERect';
import ICECircle from '../../src/graphic/shape/ICECircle';
import ICEText from '../../src/graphic/text/ICEText';
import { exportSvg, exportSvgResult } from '../../src/export/SvgExporter';

describe('SVG 导出', () => {
  it('导出矩形：命令流变成 d，填充/描边/线宽按 state + style 合并口径', () => {
    const rect = new ICERect({
      left: 10,
      top: 20,
      width: 100,
      height: 50,
      fill: true,
      stroke: true,
      style: { fillStyle: '#ff0000', strokeStyle: '#0000ff', lineWidth: 3 },
    });

    const svg = exportSvg(rect);

    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox="0 0 100 50"');
    // 引擎的路径是**以原点为中心**构建的（ICERect 默认 origin: center），世界定位交给 transform：
    // w=100 h=50 的矩形路径是 -50..50 / -25..25，left/top=(10,20) 时世界中心 = (60,45)
    expect(svg).toMatch(/<path d="M-50,-25h100v50h-100z"/);
    expect(svg).toContain('fill="#ff0000"');
    expect(svg).toContain('stroke="#0000ff"');
    expect(svg).toContain('stroke-width="3"');
    // 组件的平移进 transform 矩阵，而不是写进 d 的坐标
    expect(svg).toContain('transform="matrix(1 0 0 1 60 45)"');
  });

  it('多段子路径各闭各的：闭合矩形 + 名称带分隔线不会被收成一条斜线', () => {
    // 复刻池/泳道的画法：先画一个闭合矩形，再单独画一条带线。
    // 回归：曾经的 closePath 只记「末尾标志」，导出时把带线收到了矩形起点 ——
    // 表现为池缺一条边 + 多一条对角斜线。
    class BandShape extends ICEPath {
      protected createPathObject(): any {
        this.path2D = (this.constructor as any).__recorder();
        this.path2D.moveTo(0, 0);
        this.path2D.lineTo(100, 0);
        this.path2D.lineTo(100, 50);
        this.path2D.lineTo(0, 50);
        this.path2D.closePath();
        this.path2D.moveTo(20, 0);
        this.path2D.lineTo(20, 50);
        this.path2D.closePath();
        return this.path2D;
      }
    }
    (BandShape as any).__recorder = () => root.createPath2D();

    const shape = new BandShape({ width: 100, height: 50, fill: true, stroke: true });
    const svg = exportSvg(shape);
    const d = (svg.match(/<path d="([^"]+)"/) || [])[1] || '';

    expect(d).toBe('M0,0 L100,0 L100,50 L0,50 Z M20,0 L20,50 Z');
  });

  it('整圆拆成两段 A 命令，未显式描边时不输出 stroke', () => {
    const circle = new ICECircle({ left: 0, top: 0, radius: 20, fill: true, stroke: false });
    const svg = exportSvg(circle);
    const d = (svg.match(/<path d="([^"]+)"/) || [])[1] || '';
    expect(d.split('A').length - 1).toBeGreaterThanOrEqual(2);
    expect(svg).not.toContain(' stroke=');
  });

  it('圆角矩形：四个角都是小弧（SVG 的大弧标志必须为 0，方向一致）', () => {
    const rect = new ICERect({ width: 260, height: 120, radius: 12, fill: true, stroke: true });
    const svg = exportSvg(rect);
    const d = (svg.match(/<path d="([^"]+)"/) || [])[1] || '';

    // 每个角一条弧，共 4 条；都应是「小弧 + 同一方向」，
    // 不能出现 `0 1 1`（大弧）—— 那是跨 ±π 未归一化的典型症状（角上鼓出半圆）
    const arcs = d.match(/A[^A]+/g) || [];
    expect(arcs).toHaveLength(4);
    arcs.forEach((arc) => {
      expect(arc).toContain(' 0 0 1 ');
    });
  });

  it('虚线、透明度都进 SVG', () => {
    const rect = new ICERect({
      width: 40,
      height: 40,
      lineDash: [4, 2],
      lineDashOffset: 3,
      opacity: 0.5,
      style: { fillStyle: 'none', strokeStyle: '#333333', lineWidth: 2 },
    });

    const svg = exportSvg(rect);

    expect(svg).toContain('stroke-dasharray="4 2"');
    expect(svg).toContain('stroke-dashoffset="3"');
    expect(svg).toContain('opacity="0.5"');
  });

  it('文本按渲染行输出，居中用 text-anchor，字体用粒度键而不是 canvas 简写', () => {
    const text = new ICEText({
      text: '第一行\n第二行',
      width: 200,
      height: 60,
      style: {
        fontSize: 20,
        fontFamily: 'Arial',
        fontWeight: 'bold',
        textAlign: 'center',
        textBaseline: 'middle',
        fillStyle: '#123456',
      },
    });

    const svg = exportSvg(text);

    expect(svg).toContain('font-family="Arial"');
    expect(svg).toContain('font-size="20"');
    expect(svg).toContain('font-weight="bold"');
    expect(svg).toContain('text-anchor="middle"');
    expect(svg).toContain('dominant-baseline="central"');
    expect(svg).toContain('>第一行</tspan>');
    expect(svg).toContain('>第二行</tspan>');
    // 居中时不写死测出来的行宽（那是 canvas 的算法），锚点固定在本地原点
    expect(svg).toContain('<tspan x="0"');
  });

  it('嵌套容器：子组件用世界矩阵（绝对坐标），父容器自身背景也导出', () => {
    const outer = new ICEGroup({
      left: 100,
      top: 50,
      width: 200,
      height: 100,
      fill: true,
      stroke: false,
      style: { fillStyle: '#f0f0f0' },
    });
    const inner = new ICERect({
      left: 10,
      top: 10,
      width: 30,
      height: 30,
      fill: true,
      stroke: false,
      style: { fillStyle: '#ff0000' },
    });
    outer.addChild(inner);

    const svg = exportSvg(outer);

    // 父容器：世界中心 = (100+200/2, 50+100/2)
    expect(svg).toContain('transform="matrix(1 0 0 1 200 100)"');
    // 子组件：父中心 (200,100) + 本地 (10,10) 换算后，世界中心 = (125,75)
    expect(svg).toContain('transform="matrix(1 0 0 1 125 75)"');
  });

  it('内容模式：画布尺寸 = 内容包围盒 + 留白，且与 scale 相乘', () => {
    const group = new ICEGroup({ width: 100, height: 100, fill: false, stroke: false });
    group.addChild(new ICERect({ left: 0, top: 0, width: 20, height: 10, fill: true, stroke: false }));
    group.addChild(new ICERect({ left: 80, top: 90, width: 20, height: 10, fill: true, stroke: false }));

    const result = exportSvgResult(group, { padding: 5, scale: 2 });

    // 内容 100x100 → +2*5 留白 = 110x110 → ×2 = 220x220
    expect(Math.round(result.width)).toBe(220);
    expect(Math.round(result.height)).toBe(220);
    expect(result.svg).toContain('viewBox="0 0 220 220"');
  });

  it('内容模式尊重组件坐标（未渲染过的组件也要先刷新世界矩阵）', () => {
    // 回归：__paintWorldBox() 读的是 state.composedMatrix 缓存，从未上过屏的组件那是空值，
    // 不先 composeMatrix() 就会把内容包围盒算到 (0,0)，导出整体偏移。
    const rect = new ICERect({
      left: 500,
      top: 300,
      width: 100,
      height: 50,
      fill: true,
      stroke: false,
      style: { fillStyle: '#ff0000' },
    });

    const result = exportSvgResult(rect);

    expect(Math.round(result.width)).toBe(100);
    expect(Math.round(result.height)).toBe(50);
    // 世界 (500,300) → 视图 (0,0)
    expect(result.svg).toContain('matrix(1 0 0 1 -500 -300)');
  });

  it('隐藏组件不进导出（display:false 是整棵子树的语义）', () => {
    const group = new ICEGroup({ width: 100, height: 100, fill: false, stroke: false });
    group.addChild(
      new ICERect({
        left: 0,
        top: 0,
        width: 10,
        height: 10,
        fill: true,
        stroke: false,
        display: false,
        style: { fillStyle: '#00ff00' },
      })
    );
    group.addChild(
      new ICERect({
        left: 50,
        top: 50,
        width: 10,
        height: 10,
        fill: true,
        stroke: false,
        style: { fillStyle: '#000000' },
      })
    );

    const svg = exportSvg(group);

    expect(svg).not.toContain('#00ff00');
    expect(svg).toContain('#000000');
  });
});
