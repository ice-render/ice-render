/**
 * 几何签名的**指纹口径**（2026-09-21）。
 *
 * 背景：签名数组（10 万图元实测 11.7MB）改成「长度 + 双 32 位哈希」后，判定语义必须与改造前的
 * **逐项 `!==` 比较**逐条等价 —— 判重了只是多重建一次（有共享路径缓存兜底），判轻了就是"几何变了
 * 却贴旧图"的显示错误。这个文件把口径钉在这里：
 *
 * - 数字：`-0` 与 `0` 相同（`-0 === 0`）；`NaN` 永远判"过期"（旧实现里 `NaN !== NaN`）
 * - 字符串 / 布尔 / `undefined`：按值比较
 * - 对象 / 数组 / 函数：按引用身份比较（`===` 的语义）—— 同引用不算变化，换引用必须判变化
 * - 类型不混淆：数字 `1` 与字符串 `'1'` 必须是不同的指纹
 * - 不同签名不碰撞：穷举一批相邻几何，指纹对不能重复
 */
import ICEPath from '../../src/graphic/ICEPath';
import root from '../../src/cross-platform/root';

class FakePath2D {
  moveTo(..._a: any[]) {}
  lineTo(..._a: any[]) {}
  closePath() {}
}

/**
 * 探针图元：签名内容完全由 `sig` 注入，`createPathObject()` 也做成签名的纯函数
 * （满足"同签名 → 同路径"的契约，不影响被测的判定逻辑）。
 */
class ProbePath extends ICEPath {
  public sig: any[] = [];

  protected __pathSignature(out: any[]): any[] | null {
    for (let i = 0; i < this.sig.length; i++) out.push(this.sig[i]);
    return out;
  }

  protected createPathObject(): any {
    this.path2D = root.createPath2D();
    this.path2D.moveTo(0, 0);
    this.path2D.lineTo(this.sig.length, 0);
    return this.path2D;
  }
}

/** 把某个签名记成"上次建流时的那一组"（等价于建完命令流之后的采样）。 */
function capture(component: any, sig: any[]): void {
  component.sig = sig.slice();
  (component as any).__capturePathSignature();
}

/** 采一组新签名，问渲染器："这一帧该判成过期吗"。 */
function stale(component: any, sig: any[]): boolean {
  component.sig = sig.slice();
  return (component as any).__pathStale();
}

function makeProbe(): any {
  return new ProbePath({ left: 0, top: 0 });
}

describe('几何签名指纹的口径', () => {
  beforeEach(() => {
    (global as any).Path2D = FakePath2D;
    root.createPath2D = () => new FakePath2D();
  });

  it('同一组标量：判定为未过期', () => {
    const p = makeProbe();
    capture(p, [10, 20, 'straight', true, undefined]);
    expect(stale(p, [10, 20, 'straight', true, undefined])).toBe(false);
  });

  it('-0 与 0 视为相同；NaN 一律判过期（旧口径 NaN !== NaN）', () => {
    const p = makeProbe();
    capture(p, [0, 1]);
    expect(stale(p, [-0, 1])).toBe(false); // -0 === 0

    const q = makeProbe();
    capture(q, [NaN, 1]);
    expect(stale(q, [NaN, 1])).toBe(true); // 每帧重建
  });

  it('非原始值按引用身份：同引用不重建，换引用必重建', () => {
    const shared = { x: 1 };
    const p = makeProbe();
    capture(p, [shared]);
    expect(stale(p, [shared])).toBe(false); // 同一个引用

    expect(stale(p, [{ x: 1 }])).toBe(true); // 内容相同但不是同一个引用
  });

  it('类型标签生效：数字 1 与字符串 1 不是同一个指纹', () => {
    const p = makeProbe();
    capture(p, [1]);
    expect(stale(p, ['1'])).toBe(true);
  });

  it('长度变化必判过期', () => {
    const p = makeProbe();
    capture(p, [1, 2, 3]);
    expect(stale(p, [1, 2])).toBe(true);
  });

  it('穷举相邻几何不碰撞（含浮点小数）', () => {
    const seen = new Map<string, string>();
    let collisions = 0;
    for (let w = 1; w <= 120; w++) {
      for (let h = 1; h <= 120; h++) {
        for (const r of [0, 0.5, 3, 7.25]) {
          const p = makeProbe();
          (p as any).sig = [w, h, r, true];
          (p as any).__capturePathSignature();
          const key = `${(p as any).__pathSigH1}:${(p as any).__pathSigH2}:${(p as any).__pathSigLen}`;
          const sigText = `${w}|${h}|${r}|true`;
          const prev = seen.get(key);
          if (prev !== undefined && prev !== sigText) collisions++;
          else seen.set(key, sigText);
        }
      }
    }
    expect(collisions).toBe(0);
  });
});
