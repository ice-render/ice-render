/**
 * 跨线程镜像协议（`src/worker/mirror-protocol.ts`）的门禁。
 *
 * 这一层最怕两种事故，都不是"抛异常"而是**静默变味**：
 * ① 消息里混进结构化克隆带不走的值（函数 / DOM 节点 / `CanvasGradient`）→ `postMessage` 直接抛
 *   `DataCloneError`，整帧消息发不出去，症状是"画面卡住不动"；
 * ② 版本/形状不校验 → 新旧两端字段语义错位，谁也不知道哪边变了。
 * 所以这里逐条钉：能过的照过、过不去的**丢并记录路径**、版本不匹配明确拒绝。
 */
import {
  MIRROR_PROTOCOL_VERSION,
  isMirrorCommand,
  isMirrorEvent,
  isValidOp,
  sanitizeTransferable,
} from '../../src/worker/mirror-protocol';

describe('sanitizeTransferable', () => {
  it('基础类型与嵌套结构原样通过（不打散数组、不丢键）', () => {
    const input = {
      n: 1.5,
      s: 'text',
      b: false,
      nil: null,
      arr: [1, 'two', [3, { deep: true }]],
      obj: { a: { b: 2 } },
    };
    expect(sanitizeTransferable(input)).toEqual(input);
  });

  it('克隆不了的值（函数 / Symbol / 宿主对象）被丢弃并记录路径', () => {
    const dropped: string[] = [];
    class FakeGradient {} // 模拟 CanvasGradient 这类宿主对象
    const out = sanitizeTransferable(
      {
        width: 100,
        onClick: () => {},
        style: { fillStyle: new FakeGradient(), lineWidth: 2 },
      },
      dropped
    );

    expect(out).toEqual({ width: 100, style: { lineWidth: 2 } });
    expect(dropped).toContain('onClick');
    expect(dropped).toContain('style.fillStyle (FakeGradient)');
  });

  it('undefined 的键不进结果（与 JSON.stringify / setState 的 merge 同口径）', () => {
    expect(sanitizeTransferable({ a: 1, b: undefined })).toEqual({ a: 1 });
  });

  it('数组里的不可克隆值退化成 null（保持长度，不产生稀疏数组）', () => {
    const dropped: string[] = [];
    const out = sanitizeTransferable({ dots: [[0, 0], () => {}, [2, 2]] }, dropped);
    expect(out).toEqual({ dots: [[0, 0], null, [2, 2]] });
    expect(dropped).toContain('dots[1]');
  });

  it('循环引用被截断并记录（不能让 postMessage 抛 DataCloneError）', () => {
    const dropped: string[] = [];
    const cyclic: any = { name: 'a' };
    cyclic.self = cyclic;
    const out = sanitizeTransferable(cyclic, dropped);
    expect(out).toEqual({ name: 'a' });
    expect(dropped.some((p) => p.indexOf('循环引用') >= 0)).toBe(true);
  });

  it('Date / TypedArray 这类"克隆语义明确"的值原样保留', () => {
    const date = new Date('2026-09-20T00:00:00.000Z');
    const typed = new Float64Array([1, 2]);
    const out = sanitizeTransferable({ at: date, matrix: typed });
    expect(out.at).toBe(date);
    expect(out.matrix).toBe(typed);
  });
});

describe('消息校验', () => {
  it('版本不匹配一律拒绝（不去猜老格式）', () => {
    expect(isMirrorCommand({ t: 'frame', v: MIRROR_PROTOCOL_VERSION, seq: 1, time: 1 })).toBe(true);
    expect(isMirrorCommand({ t: 'frame', v: 0, seq: 1, time: 1 })).toBe(false);
    expect(isMirrorEvent({ t: 'ready', v: MIRROR_PROTOCOL_VERSION, caps: {} })).toBe(true);
    expect(isMirrorEvent({ t: 'ready', v: 999, caps: {} })).toBe(false);
  });

  it('形状不对的指令拒绝：scene 要带 doc、ops 要带数组、resize 要有宽高', () => {
    expect(isMirrorCommand({ t: 'scene', v: 1, doc: { childNodes: [] } })).toBe(true);
    expect(isMirrorCommand({ t: 'scene', v: 1 })).toBe(false);
    expect(isMirrorCommand({ t: 'ops', v: 1, ops: [] })).toBe(true);
    expect(isMirrorCommand({ t: 'ops', v: 1 })).toBe(false);
    expect(isMirrorCommand({ t: 'resize', v: 1, width: 10, height: 20 })).toBe(true);
    expect(isMirrorCommand({ t: 'resize', v: 1, width: 10 })).toBe(false);
    expect(isMirrorCommand({ t: 'nope', v: 1 })).toBe(false);
    // frame 必须带 seq：宿主靠它对齐"手上这张位图是哪一帧"（少了它就只能靠猜）
    expect(isMirrorCommand({ t: 'frame', v: 1, time: 1 })).toBe(false);
    expect(isMirrorCommand({ t: 'frame', v: 1, seq: 1, time: 1 })).toBe(true);
  });

  it('op 形状：只有 state 补丁；id 必须是非空字符串、补丁必须是对象', () => {
    expect(isValidOp(['state', 'ICE_1', { left: 5 }])).toBe(true);
    expect(isValidOp(['state', '', { left: 5 }])).toBe(false);
    expect(isValidOp(['state', 'ICE_1', [1, 2]])).toBe(false);
    expect(isValidOp(['add', 'ICE_1', 0, {}])).toBe(false); // v1 不支持结构增量
    expect(isValidOp(null)).toBe(false);
  });
});
