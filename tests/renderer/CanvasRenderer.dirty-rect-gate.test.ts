/**
 * dirty-rect 门控：从「整场景」放宽到「相交级」的契约。
 *
 * 旧行为：场景里只要有任一「不可缓存的 risky 组件」（文本/点集路径/非不透明落墨），
 * 整帧一律回退全量 —— 编辑器里控制面板必然存在，导致局部重绘形同虚设（实测富场景 0 次）。
 *
 * 新契约：
 * - 干净的 risky 组件：仅当盒与本次脏区域相交才回退
 * - 刚变脏的 risky 组件：一律回退（墨迹可能超出几何盒，clip 下无法保证逐像素一致）
 * - 干净的已缓存 risky 组件：主画布只是 drawImage 不透明位图，不阻塞
 * - 干净但无上屏快照：无法判定 → 保守回退
 */
import CanvasRenderer from '../../src/renderer/CanvasRenderer';
import ICE from '../../src/ICE';
import ICERect from '../../src/graphic/shape/ICERect';
import ICEGroup from '../../src/graphic/container/ICEGroup';
import ICEText from '../../src/graphic/text/ICEText';
import ICEPolyLine from '../../src/graphic/link/ICEPolyLine';
import ICEStar from '../../src/graphic/shape/ICEStar';
import EventBus from '../../src/event/EventBus';
import root from '../../src/cross-platform/root';

class FakePath2D {
  _isPolyfill = true;
  _commands: any[] = [];
  _closed = false;
  moveTo(...a: any[]) {
    this._commands.push(['moveTo', ...a]);
  }
  lineTo(...a: any[]) {
    this._commands.push(['lineTo', ...a]);
  }
  rect(...a: any[]) {
    this._commands.push(['rect', ...a]);
  }
  arcTo(...a: any[]) {
    this._commands.push(['arcTo', ...a]);
  }
  closePath() {
    this._closed = true;
  }
}

const noop = () => {};
function makeCtx() {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    clearRect: noop,
    clip: noop,
    save: noop,
    restore: noop,
    beginPath: noop,
    rect: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    arc: noop,
    ellipse: noop,
    stroke: noop,
    fill: noop,
    setTransform: noop,
    setLineDash: noop,
    drawImage: noop,
    scale: noop,
    // ICEText 渲染需要：量测返回带 actualBoundingBox* 的对象（与真实 ctx 一致）
    fillText: noop,
    strokeText: noop,
    measureText: (t: string) => ({
      width: String(t || '').length * 8,
      actualBoundingBoxAscent: 8,
      actualBoundingBoxDescent: 2,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: String(t || '').length * 8,
    }),
  };
}

function makeHarness() {
  (global as any).Path2D = FakePath2D;
  root.createPath2D = () => new FakePath2D();
  root.createOffscreenCanvas = () => ({ canvas: {}, ctx: makeCtx() });
  root.devicePixelRatio = 1;

  const ice: any = new ICE();
  ice.childNodes = [];
  ice.toolNodes = [];
  ice.root = root;
  ice.ctx = makeCtx();
  ice.canvasWidth = 800;
  ice.canvasHeight = 600;
  ice.evtBus = new EventBus();
  ice.dirty = true;
  const renderer: any = new CanvasRenderer(ice, { renderMode: 'dirty-rect' });
  renderer.start();
  ice.renderer = renderer;
  return { ice, renderer };
}

/** 不透明组件：作为「制造脏区域」的驱动，不触发 risky 门控。 */
function opaque(left: number, top: number, z: number) {
  return new ICERect({
    left,
    top,
    width: 30,
    height: 20,
    zIndex: z,
    style: { fillStyle: '#3388FF', strokeStyle: '#111827', lineWidth: 1 },
  });
}
/** 半透明组件：risky（非不透明落墨），但会被离屏缓存。 */
function alpha(left: number, top: number, z: number) {
  return new ICERect({
    left,
    top,
    width: 30,
    height: 20,
    zIndex: z,
    style: { fillStyle: 'rgba(59,130,246,0.5)', strokeStyle: '#111827', lineWidth: 1 },
  });
}
/** 小尺寸星形：risky（点集路径）且**不可缓存**（面积 < 40000），是最严格的阻塞源。 */
function smallStar(left: number, top: number, z: number) {
  return new ICEStar({
    left,
    top,
    outerRadius: 10,
    innerRadius: 4,
    spikes: 5,
    zIndex: z,
    style: { fillStyle: '#EC4899', strokeStyle: '#111827', lineWidth: 1 },
  });
}

function prime(renderer: any, ice: any) {
  renderer.__snap = new WeakMap();
  renderer.__primed = false;
  ice.dirty = true;
  renderer.frameEvtHandler();
}

describe('dirty-rect 相交级门控', () => {
  test('不可缓存的 risky 组件远离脏区域 → 允许局部重绘（旧实现会整场景回退）', () => {
    const { ice, renderer } = makeHarness();
    const group: any[] = [];
    for (let i = 0; i < 6; i++) {
      const r = opaque(20 + i * 40, 20, i);
      ice.addChild(r);
      group.push(r);
    }
    const farStar = smallStar(600, 500, 50); // 不可缓存的 risky，但离脏区域很远
    ice.addChild(farStar);

    prime(renderer, ice);
    group[0].setState({ left: 22 }); // 只脏一个不透明组件
    ice.dirty = true;

    expect(renderer.__preCount(renderer.componentQueue).dirty).toBe(1);
    expect(renderer.__collect()).not.toBeNull();
  });

  test('干净但不可缓存的 risky 组件与脏区域相交 → 回退全量（clip 会切断其抗锯齿边缘）', () => {
    const { ice, renderer } = makeHarness();
    const group: any[] = [];
    for (let i = 0; i < 6; i++) {
      const r = opaque(20 + i * 40, 20, i);
      ice.addChild(r);
      group.push(r);
    }
    const nearStar = smallStar(30, 30, 50); // 与 group[0] 的脏区域相交，且不可缓存
    ice.addChild(nearStar);

    prime(renderer, ice);
    expect(renderer.cache.isCachable(nearStar)).toBe(false);
    expect(renderer.cache.has(nearStar)).toBe(false);

    group[0].setState({ left: 22 });
    ice.dirty = true;

    expect(renderer.__collect()).toBeNull();
  });

  test('刚变脏的 risky 组件一律回退（即使离脏区域很远、墨迹可能超出几何盒）', () => {
    const { ice, renderer } = makeHarness();
    const group: any[] = [];
    for (let i = 0; i < 6; i++) {
      const r = opaque(20 + i * 40, 20, i);
      ice.addChild(r);
      group.push(r);
    }
    const farStar = smallStar(600, 500, 50);
    ice.addChild(farStar);

    prime(renderer, ice);
    group[0].setState({ left: 22 });
    farStar.setState({ outerRadius: 11 }); // risky、不可缓存，且脏
    ice.dirty = true;

    expect(renderer.__collect()).toBeNull();
  });

  test('干净且已缓存的半透明组件即使与区域相交也不阻塞（主画布只是不透明位图贴图）', () => {
    const { ice, renderer } = makeHarness();
    const group: any[] = [];
    for (let i = 0; i < 6; i++) {
      const r = opaque(20 + i * 40, 20, i);
      ice.addChild(r);
      group.push(r);
    }
    const cachedAlpha = alpha(30, 30, 50); // 与脏区域相交，但会被离屏缓存
    ice.addChild(cachedAlpha);

    prime(renderer, ice);
    // 先让它进入离屏缓存（需要一次 dirty 渲染）
    cachedAlpha.setState({ style: { fillStyle: 'rgba(59,130,246,0.55)' } });
    ice.dirty = true;
    renderer.frameEvtHandler();
    expect(renderer.cache.has(cachedAlpha)).toBe(true);

    group[0].setState({ left: 24 });
    ice.dirty = true;
    expect(renderer.__collect()).not.toBeNull();
  });

  test('risky 组件干净但无上屏快照 → 保守回退全量', () => {
    const { ice, renderer } = makeHarness();
    const group: any[] = [];
    for (let i = 0; i < 6; i++) {
      const r = opaque(20 + i * 40, 20, i);
      ice.addChild(r);
      group.push(r);
    }
    const ghost = smallStar(300, 300, 50); // 不可缓存
    ice.addChild(ghost);

    prime(renderer, ice);
    renderer.__snap.delete(ghost); // 模拟「干净但没有可信盒子」
    group[0].setState({ left: 26 });
    ice.dirty = true;

    expect(renderer.__collect()).toBeNull();
  });

  test('拖拽容器时：子组件「仅位置变化 + 已缓存」不再阻塞（富场景终于能局部重绘）', () => {
    const { ice, renderer } = makeHarness();
    // 足够多的静止组件，把「脏组件占比」压到 20% 阈值以下（否则会先被那条门拦掉）
    for (let i = 0; i < 24; i++) {
      ice.addChild(opaque(20 + (i % 12) * 40, 20 + Math.floor(i / 12) * 30, i));
    }

    // 容器里放一个 risky 子组件（半透明 → 非不透明落墨），首帧会被离屏缓存
    const box = new ICEGroup({
      left: 300,
      top: 300,
      width: 120,
      height: 80,
      style: { fillStyle: '#ffffff', strokeStyle: '#111827', lineWidth: 1 },
    });
    const inner = alpha(20, 20, 10);
    box.addChild(inner);
    ice.addChild(box);
    prime(renderer, ice);
    expect(renderer.cache.has(inner)).toBe(true);

    // 只移动容器：后代只被标 dirty，**不**重量测参数（dirty / paramsDirty 拆级的语义）
    box.setState({ left: 330 });
    ice.dirty = true;
    expect(inner.dirty).toBe(true);
    expect(inner.paramsDirty).toBe(false);

    // 仅位置变化 + 已缓存 → 主画布只是把位图平移贴回，clip 只作用整像素采样，与全量逐像素一致
    expect(renderer.__collect()).not.toBeNull();
  });

  test('非文本 risky 的「几何变化」也放行：盒 = 几何 + paint pad，且 old∪new 已进脏区', () => {
    const { ice, renderer } = makeHarness();
    for (let i = 0; i < 24; i++) {
      ice.addChild(opaque(20 + (i % 12) * 40, 20 + Math.floor(i / 12) * 30, i));
    }
    const star = smallStar(300, 300, 50); // 不可缓存的 risky（点集路径）
    ice.addChild(star);
    prime(renderer, ice);

    star.setState({ outerRadius: 11 }); // 几何变了 → paramsDirty
    ice.dirty = true;
    expect(star.paramsDirty).toBe(true);
    // 非文本组件的墨迹 = 几何 + paint pad，且脏区已并进它的旧盒∪新盒 → clip 切不到墨迹
    expect(renderer.__collect()).not.toBeNull();
  });

  test('文本的「内容变化」仍一律回退：字形墨迹会超出几何盒（这条是原始实测的来源）', () => {
    const { ice, renderer } = makeHarness();
    for (let i = 0; i < 24; i++) {
      ice.addChild(opaque(20 + (i % 12) * 40, 20 + Math.floor(i / 12) * 30, i));
    }
    const label: any = new ICEText({ left: 300, top: 300, width: 10, height: 10, text: 'hi' });
    ice.addChild(label);
    prime(renderer, ice);

    label.setState({ text: 'changed' }); // 内容变了 → paramsDirty
    ice.dirty = true;
    expect(renderer.__collect()).toBeNull();
  });

  test('平移不变的非文本 risky（点集路径、不可缓存）也不阻塞：盒 + paint pad 已覆盖墨迹', () => {
    const { ice, renderer } = makeHarness();
    for (let i = 0; i < 24; i++) {
      ice.addChild(opaque(20 + (i % 12) * 40, 20 + Math.floor(i / 12) * 30, i));
    }

    // 容器里的不可缓存 risky（小星形：点集路径 + 面积小 → 不走离屏缓存）
    const box = new ICEGroup({
      left: 300,
      top: 300,
      width: 120,
      height: 80,
      style: { fillStyle: '#ffffff', strokeStyle: '#111827', lineWidth: 1 },
    });
    const star = smallStar(20, 20, 10);
    box.addChild(star);
    ice.addChild(box);
    prime(renderer, ice);
    expect(renderer.cache.isCachable(star)).toBe(false);

    box.setState({ left: 330 }); // 只平移：星形自身只被标 dirty，几何没变
    ice.dirty = true;
    expect(star.dirty).toBe(true);
    expect(star.paramsDirty).toBe(false);

    // 脏组件的 old∪new 盒（含 paint pad）本来就会并进脏区 → clip 切不到它的墨迹
    expect(renderer.__collect()).not.toBeNull();
  });

  test('平移不变的文本必须命中缓存才放行（字形墨迹会超出几何盒）', () => {
    const { ice, renderer } = makeHarness();
    for (let i = 0; i < 24; i++) {
      ice.addChild(opaque(20 + (i % 12) * 40, 20 + Math.floor(i / 12) * 30, i));
    }

    const box = new ICEGroup({
      left: 300,
      top: 300,
      width: 120,
      height: 80,
      style: { fillStyle: '#ffffff', strokeStyle: '#111827', lineWidth: 1 },
    });
    const label: any = new ICEText({ left: 10, top: 10, width: 10, height: 10, text: 'hi' });
    box.addChild(label);
    ice.addChild(box);

    // ① 未走缓存（编辑态）→ 平移不变也要回退
    label.setState({ editing: true });
    prime(renderer, ice);
    expect(renderer.cache.isCachable(label)).toBe(false);
    box.setState({ left: 330 });
    ice.dirty = true;
    expect(renderer.__collect()).toBeNull();

    // ② 回到非编辑态并被缓存 → 放行（主画布只是 drawImage 平移贴回）
    label.setState({ editing: false });
    prime(renderer, ice);
    expect(renderer.cache.has(label)).toBe(true);
    box.setState({ left: 340 });
    ice.dirty = true;
    expect(renderer.__collect()).not.toBeNull();
  });

  test('干净且已缓存的连线与脏区相交 → 不阻塞（编辑器里最常见的阻塞源）', () => {
    const { ice, renderer } = makeHarness();
    for (let i = 0; i < 24; i++) {
      ice.addChild(opaque(20 + (i % 12) * 40, 20 + Math.floor(i / 12) * 30, i));
    }
    // 连线横跨画布：任何脏区都会与它相交 —— 这正是编辑器里局部重绘一直失效的原因
    const line = new ICEPolyLine({
      points: [
        [0, 0],
        [780, 580],
      ],
      style: { strokeStyle: '#334155', lineWidth: 2 },
    });
    ice.addChild(line);
    prime(renderer, ice);
    // 再走一帧让状态安定（真实使用中 rAF 连续跑；首帧还处在「刚挂载」的脏状态）
    ice.dirty = true;
    renderer.frameEvtHandler();
    expect(renderer.cache.isCachable(line)).toBe(true);
    expect(renderer.cache.has(line)).toBe(true);
    expect(line.dirty).toBe(false);

    const mover = ice.childNodes[0];
    mover.setState({ left: 26 });
    ice.dirty = true;
    expect(renderer.__collect()).not.toBeNull();
  });
});
