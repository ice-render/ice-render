/**
 * 连线标签的**偏移入口**（`style.label.offset = [dx, dy]`）。
 *
 * 为什么需要它：标签位置由 `getLabelPosition()` 钉死在折线上（2 点取中点、多点取中间折点），
 * 而折点是**路由器为了避开符号折出来的** —— 于是"多条平行管线共用一个汇流点"时
 * 它们的标签逐像素重合，且**放大图元间距消不掉**（折点与符号的相对位置是尺度不变的）。
 * 应用层能改的只有数据，一旦图是自动布局 / 用户拖出来的，就再也无从下手。
 *
 * 这一条是 ice-agent-console 的《上游缺口清单》第 16 条，也是那份清单里**唯一**
 * "应用层无论怎么努力都留一点瑕疵"的地方。
 *
 * 三个消费者必须同时跟着走，所以断言覆盖三处而不是只看画布：
 *   ① `__labelMetrics()` —— 画布（`drawLabel`）；
 *   ② 包围盒（`__localBox()` → 上屏快照盒 / 脏区擦除盒 / 离屏缓存位图范围）；
 *   ③ `getLabelRenderInfo()` —— SVG 导出。
 */
import ICEPolyLine from '../../src/graphic/link/ICEPolyLine';

jest.mock('../../src/cross-platform/root', () => {
  const Path2DRecorder = jest.requireActual('../../src/cross-platform/Path2DRecorder').default;
  return { __esModule: true, default: { createPath2D: () => new Path2DRecorder() } };
});
global.Path2D = class {
  rect() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  arc() {}
  ellipse() {}
};

/** 两点直线，中点在 (50, 0)；标签 5 字符 × fontSize 20 → 降级估算 halfW = 54、halfH = 14 */
function makeLine(offset?: any) {
  const style: any = { strokeStyle: '#333333', lineWidth: 2, label: { fontSize: 20 } };
  if (offset !== undefined) {
    style.label.offset = offset;
  }
  return new ICEPolyLine({
    points: [
      [0, 0],
      [100, 0],
    ],
    label: '1 : N',
    style,
  }) as any;
}

describe('连线标签偏移', () => {
  it('没给 offset 时行为不变（标签仍在折线中点）', () => {
    const line = makeLine();
    expect(line.__labelMetrics()).toMatchObject({ x: 50, y: 0 });
  });

  it('offset 平移到标签位置，画布 / 包围盒 / 导出三处同源', () => {
    const line = makeLine([10, -20]);

    // ① 画布（drawLabel 读的就是这份度量）
    expect(line.__labelMetrics()).toMatchObject({ x: 60, y: -20 });
    // ③ SVG 导出
    expect(line.getLabelRenderInfo()).toMatchObject({ x: 60, y: -20 });
    // ② 包围盒：必须盖住**偏移之后**的那个标签矩形
    const mm = line.getMinBoundingBox(true).getMinAndMaxPoint();
    expect(mm.minX).toBeLessThanOrEqual(60 - 54);
    expect(mm.maxX).toBeGreaterThanOrEqual(60 + 54);
    expect(mm.minY).toBeLessThanOrEqual(-20 - 14);
    expect(mm.maxY).toBeGreaterThanOrEqual(-20 + 14);
  });

  it('offset 只吃两个有限数：长度不对 / 非数字 / NaN 一律当没写', () => {
    const cases: any[] = [[10], [10, 20, 30], '10,20', [10, Number.NaN], [Number.POSITIVE_INFINITY, 0], [null, 0]];
    cases.forEach((offset) => {
      const line = makeLine(offset);
      expect({ offset, ...line.__labelMetrics() }).toMatchObject({ offset, x: 50, y: 0 });
    });
  });

  it('[0, 0] 与不写等价（显式零偏移不该被当成非法值）', () => {
    const line = makeLine([0, 0]);
    expect(line.__labelMetrics()).toMatchObject({ x: 50, y: 0 });
  });

  it('运行时改 offset 生效；清掉偏移要显式给 [0, 0]（setState 是深合并，省略键不删键）', () => {
    const line = makeLine();
    expect(line.__labelMetrics()).toMatchObject({ x: 50, y: 0 });
    line.setState({ style: { label: { fontSize: 20, offset: [-8, 6] } } });
    expect(line.__labelMetrics()).toMatchObject({ x: 42, y: 6 });
    // 深合并：不写 offset 时上一条还在（与引擎其余 style 键同口径），别指望"省略即重置"
    line.setState({ style: { label: { fontSize: 20 } } });
    expect(line.__labelMetrics()).toMatchObject({ x: 42, y: 6 });
    line.setState({ style: { label: { fontSize: 20, offset: [0, 0] } } });
    expect(line.__labelMetrics()).toMatchObject({ x: 50, y: 0 });
  });
});
