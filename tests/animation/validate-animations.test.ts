/**
 * 动画配置校验器（`validateAnimations`）的回归。
 *
 * 它是 Agent / DSL / 应用层在**运行之前**拿到反馈的通道：稳定码 + 精确 path + 人话 message。
 * 纯函数（不依赖 ICE 实例、不改传入对象、不打印）。
 */
import { ICE_ANIMATION_DIAGNOSTIC_CODES as CODES, validateAnimations } from '../../src/animation/validate-animations';

const codesOf = (diagnostics: any[], severity?: 'error' | 'warning') =>
  diagnostics.filter((d) => !severity || d.severity === severity).map((d) => d.code);

describe('动画配置校验：合法配置', () => {
  it('单段 / 关键帧 / motion token / 数组位移 都通过', () => {
    const diagnostics = validateAnimations({
      left: { from: 0, to: 100, duration: 300, easing: 'out', delay: 100 },
      'transform.translate': { from: [0, 0], to: [10, 10], duration: 'normal', easing: 'spring' },
      // 关键帧形态（这里用数值取值 —— 颜色不是可插值类型，见下面的错误用例）
      backgroundAlpha: {
        keyframes: [
          { offset: 0, value: 0 },
          { offset: 1, value: 1 },
        ],
        duration: 500,
      },
      opacity: { from: 0, to: 1, duration: 200, iterationCount: 3 },
    });
    expect(diagnostics).toEqual([]);
  });
});

describe('动画配置校验：错误（error）', () => {
  it('duration 非法 / 未知 token', () => {
    expect(codesOf(validateAnimations({ left: { from: 0, to: 1 } }))).toContain(CODES.DURATION_INVALID);
    expect(codesOf(validateAnimations({ left: { from: 0, to: 1, duration: 0 } }))).toContain(CODES.DURATION_INVALID);
    expect(codesOf(validateAnimations({ left: { from: 0, to: 1, duration: 999999 } }))).toContain(
      CODES.DURATION_INVALID
    );
    expect(codesOf(validateAnimations({ left: { from: 0, to: 1, duration: 'blazing' } }))).toContain(
      CODES.DURATION_INVALID
    );
  });

  it('from/to 不可插值（字符串颜色、长度不等的数组）', () => {
    const single = validateAnimations({ left: { from: 0, to: 1, duration: 100 } });
    expect(single).toEqual([]);
    const bad1 = validateAnimations({ 'style.fillStyle': { from: '#fff', to: '#000', duration: 100 } });
    expect(codesOf(bad1)).toContain(CODES.VALUE_NOT_INTERPOLATABLE);
    expect(bad1[0].path).toBe('style.fillStyle');
    const bad2 = validateAnimations({ 'transform.scale': { from: [1, 1], to: [2, 2, 2], duration: 100 } });
    expect(codesOf(bad2)).toContain(CODES.VALUE_NOT_INTERPOLATABLE);
  });

  it('keyframes 形状非法（少于 2 帧 / offset 非有限 / 长度不一致）', () => {
    expect(codesOf(validateAnimations({ left: { keyframes: [{ value: 1 }], duration: 100 } }))).toContain(
      CODES.KEYFRAMES_INVALID
    );
    expect(
      codesOf(
        validateAnimations({
          'transform.scale': { keyframes: [{ offset: 'x', value: [1, 1] }, { value: [2, 2] }], duration: 100 },
        })
      )
    ).toContain(CODES.KEYFRAMES_INVALID);
    expect(
      codesOf(
        validateAnimations({
          'transform.scale': { keyframes: [{ value: [1, 1] }, { value: [2, 2, 3] }], duration: 100 },
        })
      )
    ).toContain(CODES.KEYFRAMES_INVALID);
  });

  it('delay / iterationCount 非法', () => {
    expect(codesOf(validateAnimations({ left: { from: 0, to: 1, duration: 100, delay: -5 } }))).toContain(
      CODES.DELAY_INVALID
    );
    expect(codesOf(validateAnimations({ left: { from: 0, to: 1, duration: 100, iterationCount: 0 } }))).toContain(
      CODES.ITERATION_INVALID
    );
    expect(codesOf(validateAnimations({ left: { from: 0, to: 1, duration: 100, iterationCount: 1.5 } }))).toContain(
      CODES.ITERATION_INVALID
    );
  });

  it('未知缓动：报错并列出可用集合（运行时只 warn + 回退 linear，所以更该在编译期拦住）', () => {
    const diagnostics = validateAnimations({ left: { from: 0, to: 1, duration: 100, easing: 'easeOutBack' } });
    expect(codesOf(diagnostics)).toContain(CODES.EASING_UNKNOWN);
    expect(diagnostics[0].message).toContain('linear');
  });

  it('animations 本身不是对象', () => {
    expect(codesOf(validateAnimations([] as any))).toEqual([CODES.KEY_INVALID]);
    expect(codesOf(validateAnimations('nope' as any))).toEqual([CODES.KEY_INVALID]);
  });
});

describe('动画配置校验：警告（warning）', () => {
  it('无限循环提示（loop: true 且没给 iterationCount）', () => {
    const diagnostics = validateAnimations({ left: { from: 0, to: 1, duration: 100, loop: true } });
    expect(codesOf(diagnostics, 'warning')).toContain(CODES.INFINITE_LOOP);
    // 给了次数就不提示
    expect(
      codesOf(validateAnimations({ left: { from: 0, to: 1, duration: 100, loop: true, iterationCount: 3 } }))
    ).toEqual([]);
  });

  it('动画"派生参数相关"的属性 → 性能警告（走 isSafeKey 回调，与 AGENTS 的安全键白名单同源）', () => {
    const isSafeKey = (path: string) => path === 'left' || path === 'opacity';
    const diagnostics = validateAnimations(
      {
        left: { from: 0, to: 10, duration: 100 },
        width: { from: 10, to: 100, duration: 100 },
        text: { from: 0, to: 1, duration: 100 },
      },
      { isSafeKey }
    );
    expect(codesOf(diagnostics, 'warning')).toEqual([CODES.KEY_AFFECTS_MEASUREMENT, CODES.KEY_AFFECTS_MEASUREMENT]);
    expect(diagnostics.map((d) => d.path)).toEqual(['text', 'width']);
  });
});

describe('动画配置校验：诊断形状', () => {
  it('每条诊断带 severity / code / message / path，并按 path 排序', () => {
    const diagnostics = validateAnimations({
      width: { from: 10, to: 100, duration: 0 },
      zzz: { from: 'a', to: 'b', duration: 100 },
    });
    expect(diagnostics.length).toBeGreaterThanOrEqual(2);
    for (const d of diagnostics) {
      expect(['error', 'warning']).toContain(d.severity);
      expect(typeof d.code).toBe('string');
      expect(d.code.startsWith('ICE_ANIM_')).toBe(true);
      expect(d.message.length).toBeGreaterThan(0);
      expect(typeof d.path).toBe('string');
    }
    expect(diagnostics.map((d) => d.path)).toEqual(['width', 'zzz']);
  });
});
