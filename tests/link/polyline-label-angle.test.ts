/**
 * 连线标签的**旋转入口**（`style.label.angle`，弧度，绕标签中心）。
 *
 * 为什么需要它：竖线上的长标注横排时，盒子宽度就是**字宽**（十几到上百像素）——
 * 无论往左还是往右挪都可能仍然压着线（实测一条 `DN1000 污水` 的盒子 79px 宽，
 * 往右挪 12px 之后左边还有 28px 盖在线上）。转 90°（`-Math.PI / 2`，自下而上读）
 * 之后盒子在横向只剩**字高**，挪一点点就完全离开线条，而且文字顺着管子读 ——
 * 这是制图惯例（竖向标注自下而上）。
 *
 * 三个消费者必须同时跟着走（与 `offset` 同一条纪律）：
 *   ① `__labelMetrics()` —— 画布（`drawLabel` 绕中心 `rotate`）；它返回的是**旋转后的 AABB**，
 *      因为 ② 要用它：包围盒（`__localBox()` → 上屏快照盒 / 脏区擦除盒 / 离屏缓存位图范围）
 *      只有按 AABB 算，转 90° 之后才不会留下残影；
 *   ③ `getLabelRenderInfo()` —— SVG 导出（带 `angle` 与未旋转的 `w / h`）。
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

/**
 * 两点直线，中点在 (50, 0)；标签 5 字符 × fontSize 20 → 降级估算
 * `w = 5×20 + 8 = 108`、`h = 20 + 8 = 28`（padding 4 在两侧）。
 */
function makeLine(angle?: any) {
  const style: any = { strokeStyle: '#333333', lineWidth: 2, label: { fontSize: 20 } };
  if (angle !== undefined) {
    style.label.angle = angle;
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

describe('连线标签旋转', () => {
  it('不给 angle 时行为不变（AABB 就是盒子本身）', () => {
    const line = makeLine();
    expect(line.__labelMetrics()).toMatchObject({ x: 50, y: 0, halfW: 54, halfH: 14, w: 108, h: 28, angle: 0 });
    expect(line.getLabelRenderInfo()).toMatchObject({ halfW: 54, halfH: 14, w: 108, h: 28, angle: 0 });
  });

  it('★ 转 90°：AABB 横向只剩字高、纵向变成字宽（脏区 / 离屏缓存按它算）', () => {
    const line = makeLine(-Math.PI / 2);
    expect(line.__labelMetrics()).toMatchObject({ w: 108, h: 28, angle: -Math.PI / 2 });
    expect(line.__labelMetrics().halfW).toBeCloseTo(14);
    expect(line.__labelMetrics().halfH).toBeCloseTo(54);

    // 包围盒必须真的盖住旋转之后那一块（拿引擎自己的最小包围盒反证）
    const mm = line.getMinBoundingBox(true).getMinAndMaxPoint();
    expect(mm.minX).toBeLessThanOrEqual(50 - 14 + 0.001);
    expect(mm.maxX).toBeGreaterThanOrEqual(50 + 14 - 0.001);
    expect(mm.minY).toBeLessThanOrEqual(-54 + 0.001);
    expect(mm.maxY).toBeGreaterThanOrEqual(54 - 0.001);
  });

  it('45°：AABB = (w + h) / √2 的一半（不是简单取大）', () => {
    const line = makeLine(Math.PI / 4);
    const half = ((108 + 28) * Math.SQRT1_2) / 2;
    expect(line.__labelMetrics().halfW).toBeCloseTo(half, 6);
    expect(line.__labelMetrics().halfH).toBeCloseTo(half, 6);
  });

  it('非法 angle（NaN / Infinity / 字符串 / null）一律当 0，不抛错', () => {
    [Number.NaN, Number.POSITIVE_INFINITY, '90deg', null, {}].forEach((angle) => {
      const line = makeLine(angle);
      expect({ input: angle, ...line.__labelMetrics() }).toMatchObject({ halfW: 54, halfH: 14, angle: 0 });
    });
  });

  it('运行时改角度生效；给 0 就回到不转（setState 是深合并，省略键不删键）', () => {
    const line = makeLine();
    expect(line.__labelMetrics().angle).toBe(0);
    line.setState({ style: { label: { fontSize: 20, angle: -Math.PI / 2 } } });
    expect(line.__labelMetrics().halfW).toBeCloseTo(14);
    line.setState({ style: { label: { fontSize: 20, angle: 0 } } });
    expect(line.__labelMetrics()).toMatchObject({ halfW: 54, halfH: 14, angle: 0 });
  });

  it('★ 画布那一侧：先平移到标签中心、再绕中心 rotate，底块与文字都在旋转坐标系里画', () => {
    const calls: string[] = [];
    const ctx: any = {
      save: () => calls.push('save'),
      restore: () => calls.push('restore'),
      translate: (x: number, y: number) => calls.push(`translate(${x},${y})`),
      rotate: (a: number) => calls.push(`rotate(${a})`),
      fillRect: (x: number, y: number, w: number, h: number) => calls.push(`fillRect(${x},${y},${w},${h})`),
      fillText: (t: string, x: number, y: number) => calls.push(`fillText(${t},${x},${y})`),
    };
    const line = makeLine(-Math.PI / 2);
    line.ctx = ctx;
    line.themeOf = () => ({}); // 节点环境没有 ICE 实例，主题在这里不是断言对象
    line.drawLabel();

    expect(calls[0]).toBe('save');
    expect(calls[1]).toBe('translate(50,0)');
    expect(calls[2]).toBe(`rotate(${-Math.PI / 2})`);
    // 旋转坐标系里以 (0,0) 为中心画**未旋转**的盒子（w=108、h=28）
    expect(calls).toContain('fillRect(-54,-14,108,28)');
    expect(calls).toContain('fillText(1 : N,0,0)');
    expect(calls[calls.length - 1]).toBe('restore');
  });

  it('不转时画布调用序列不变（没有多余的 translate / rotate）', () => {
    const calls: string[] = [];
    const ctx: any = {
      save: () => calls.push('save'),
      restore: () => calls.push('restore'),
      translate: () => calls.push('translate'),
      rotate: () => calls.push('rotate'),
      fillRect: () => calls.push('fillRect'),
      fillText: () => calls.push('fillText'),
    };
    const line = makeLine();
    line.ctx = ctx;
    line.themeOf = () => ({});
    line.drawLabel();
    expect(calls).toEqual(['save', 'fillRect', 'fillText', 'restore']);
  });
});
