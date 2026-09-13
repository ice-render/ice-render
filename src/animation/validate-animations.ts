/**
 * 动画配置的**结构化校验**（引擎侧的"可校验"原语）。
 *
 * 为什么放在引擎里：Agent / DSL / 应用层都需要在**运行之前**知道一份 `animations` 配置能不能按预期跑，
 * 而"什么算合法"只有引擎说了算（数值可插值、关键帧形状、时长语义、缓动名、motion token…）。
 * 校验器是**纯函数**：不依赖 ICE 实例、不改传入对象、不 console —— 调用方拿到结构化诊断后自己决定
 * 怎么展示（Agent 用它自修复，DSL 把它并入 `diagnostics`，应用层用它做开发期断言）。
 *
 * 诊断与运行时判定同源：`AnimationManager` 拒绝/回退一份配置时记的也是这些码（`getDiagnostics()`），
 * 因此"跑起来才发现被跳过了"与"编译期就报出来"说的是同一件事。
 */
import { EasingProgress } from './Easing';
import { DEFAULT_THEME } from '../theme/ICETheme';

export const ICE_ANIMATION_DIAGNOSTIC_CODES = {
  /** 键不是合法的属性路径（空串 / 非字符串）。 */
  KEY_INVALID: 'ICE_ANIM_KEY_INVALID',
  /** `duration` 缺失 / 非正数 / 超上限 / 不是已注册的 motion token。 */
  DURATION_INVALID: 'ICE_ANIM_DURATION_INVALID',
  /** `delay` 不是非负有限数。 */
  DELAY_INVALID: 'ICE_ANIM_DELAY_INVALID',
  /** `iterationCount` 不是 ≥1 的整数。 */
  ITERATION_INVALID: 'ICE_ANIM_ITERATION_INVALID',
  /** 缓动名既不是内置缓动，也不是主题 motion.easing 里的语义名（运行时会回退 linear）。 */
  EASING_UNKNOWN: 'ICE_ANIM_EASING_UNKNOWN',
  /** `from` / `to` 不是可插值的同型数值（数值或等长数字数组）。 */
  VALUE_NOT_INTERPOLATABLE: 'ICE_ANIM_VALUE_NOT_INTERPOLATABLE',
  /** `keyframes` 形状非法（少于 2 帧 / offset 非有限数 / 各帧取值不同型或不等长）。 */
  KEYFRAMES_INVALID: 'ICE_ANIM_KEYFRAMES_INVALID',
  /** 无限循环（`loop: true`）：Agent 生成的界面里要谨慎，建议给 `iterationCount` 或可中断入口。 */
  INFINITE_LOOP: 'ICE_ANIM_INFINITE_LOOP',
  /** 该属性会改变派生参数（尺寸 / 点集 / 文本量测）→ 每帧都要重量测，性能上不划算。 */
  KEY_AFFECTS_MEASUREMENT: 'ICE_ANIM_KEY_AFFECTS_MEASUREMENT',
  /** 运行期告知：用户开启了「减少动态效果」，这条动画被折叠成终态（未播放过程）。 */
  REDUCED_MOTION: 'ICE_ANIM_REDUCED_MOTION',
} as const;

export type ICEAnimationDiagnosticCode =
  (typeof ICE_ANIMATION_DIAGNOSTIC_CODES)[keyof typeof ICE_ANIMATION_DIAGNOSTIC_CODES];

export interface ICEAnimationDiagnostic {
  severity: 'error' | 'warning';
  code: ICEAnimationDiagnosticCode;
  message: string;
  /** 出问题的位置：属性动画键（如 `transform.translate`），便于 Agent 精确改一处。 */
  path: string;
}

export type ValidateAnimationsOptions = {
  /** 主题 motion token（缺省用内置默认主题）——`duration: 'normal'` / `easing: 'out'` 这类语义名靠它解析。 */
  motionTokens?: { duration?: Record<string, any>; easing?: Record<string, any> } | null;
  /** 判断某个属性键是否"动画安全"（不影响派生参数）；给了就会对不安全的键出性能警告。 */
  isSafeKey?: ((path: string) => boolean) | null;
  /** 单条动画的时长上限（ms），默认 60s；Agent 生成的长动画多半是写错了。 */
  maxDuration?: number;
};

/** 取值种类：`number` / `array`（非空且全为数字）/ `null`（不可插值）。 */
export function classifyAnimationValue(value: any): 'number' | 'array' | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? 'number' : null;
  }
  if (Array.isArray(value) && value.length > 0) {
    for (let i = 0; i < value.length; i++) {
      if (typeof value[i] !== 'number' || !Number.isFinite(value[i])) {
        return null;
      }
    }
    return 'array';
  }
  return null;
}

/** 两个取值能否互相插值（同型；数组还要等长）。 */
export function isInterpolatablePair(from: any, to: any): boolean {
  const kind = classifyAnimationValue(from);
  if (kind === null || kind !== classifyAnimationValue(to)) {
    return false;
  }
  return kind === 'number' || from.length === to.length;
}

function describeValue(value: any): string {
  if (Array.isArray(value)) {
    return `数组[${value.length}]`;
  }
  return typeof value;
}

/** 校验一份 `animations` 配置（键 → 单段/关键帧配置），返回按 `path` 排序的诊断列表（无问题 = 空数组）。 */
export function validateAnimations(animations: any, options: ValidateAnimationsOptions = {}): ICEAnimationDiagnostic[] {
  const list: ICEAnimationDiagnostic[] = [];
  if (animations === undefined || animations === null) {
    return list;
  }
  if (typeof animations !== 'object' || Array.isArray(animations)) {
    return [
      {
        severity: 'error',
        code: ICE_ANIMATION_DIAGNOSTIC_CODES.KEY_INVALID,
        message: 'animations 必须是「属性键 → 动画配置」的对象',
        path: '',
      },
    ];
  }

  const motion: any = options.motionTokens || (DEFAULT_THEME as any).semantic.motion;
  const durationTokens: Record<string, any> = (motion && motion.duration) || {};
  const easingTokens: Record<string, any> = (motion && motion.easing) || {};
  const maxDuration = Number(options.maxDuration) > 0 ? Number(options.maxDuration) : 60000;

  const push = (
    severity: 'error' | 'warning',
    code: ICEAnimationDiagnosticCode,
    message: string,
    path: string
  ): void => {
    list.push({ severity, code, message, path });
  };

  for (const key in animations) {
    const animation: any = animations[key];
    if (!key || typeof key !== 'string') {
      push('error', ICE_ANIMATION_DIAGNOSTIC_CODES.KEY_INVALID, '动画属性键不能为空', String(key));
      continue;
    }
    if (!animation || typeof animation !== 'object') {
      push('error', ICE_ANIMATION_DIAGNOSTIC_CODES.KEYFRAMES_INVALID, '动画配置必须是对象', key);
      continue;
    }

    // duration：数字 / motion token 语义名
    const durationToken = typeof animation.duration === 'string' && durationTokens[animation.duration] !== undefined;
    if (durationToken) {
      const resolved = Number(durationTokens[animation.duration]);
      if (!(resolved > 0) || resolved > maxDuration) {
        push(
          'error',
          ICE_ANIMATION_DIAGNOSTIC_CODES.DURATION_INVALID,
          `motion token「${animation.duration}」解析出的时长 ${resolved} 不在 (0, ${maxDuration}] 内`,
          key
        );
      }
    } else {
      const duration = Number(animation.duration);
      const okToken = typeof animation.duration === 'string' ? undefined : durationTokens[animation.duration as any];
      if (typeof animation.duration === 'string' && okToken === undefined) {
        push(
          'error',
          ICE_ANIMATION_DIAGNOSTIC_CODES.DURATION_INVALID,
          `duration 既不是正数，也不是已注册的 motion token（可用：${Object.keys(durationTokens).join(' / ') || '无'}）`,
          key
        );
      } else if (!Number.isFinite(duration) || duration <= 0 || duration > maxDuration) {
        push(
          'error',
          ICE_ANIMATION_DIAGNOSTIC_CODES.DURATION_INVALID,
          `duration 必须是 (0, ${maxDuration}] 内的数值，当前为 ${String(animation.duration)}`,
          key
        );
      }
    }

    // delay：非负有限数
    if (animation.delay !== undefined) {
      const delay = Number(animation.delay);
      if (!Number.isFinite(delay) || delay < 0) {
        push(
          'error',
          ICE_ANIMATION_DIAGNOSTIC_CODES.DELAY_INVALID,
          `delay 必须是非负数值，当前为 ${String(animation.delay)}`,
          key
        );
      }
    }

    // iterationCount：≥1 的整数
    if (animation.iterationCount !== undefined) {
      const count = Number(animation.iterationCount);
      if (!Number.isInteger(count) || count < 1) {
        push(
          'error',
          ICE_ANIMATION_DIAGNOSTIC_CODES.ITERATION_INVALID,
          `iterationCount 必须是 ≥1 的整数，当前为 ${String(animation.iterationCount)}`,
          key
        );
      }
    }
    if (animation.loop === true && animation.iterationCount === undefined) {
      push(
        'warning',
        ICE_ANIMATION_DIAGNOSTIC_CODES.INFINITE_LOOP,
        '无限循环（loop: true）在界面里要谨慎：建议给 iterationCount，或确保有可中断的入口',
        key
      );
    }

    // easing：内置缓动名或 motion.easing 语义名
    if (animation.easing !== undefined && animation.easing !== null) {
      const name = String(animation.easing);
      const known = EasingProgress[name] !== undefined || easingTokens[name] !== undefined;
      if (!known) {
        push(
          'error',
          ICE_ANIMATION_DIAGNOSTIC_CODES.EASING_UNKNOWN,
          `未知缓动「${name}」（运行时会回退 linear）。可用：${Object.keys(EasingProgress).join(' / ')}` +
            (Object.keys(easingTokens).length ? ` + 主题 token：${Object.keys(easingTokens).join(' / ')}` : ''),
          key
        );
      }
    }

    // 取值：关键帧形态 vs 单段形态
    if (Array.isArray(animation.keyframes)) {
      const frames = animation.keyframes;
      let reason = '';
      if (frames.length < 2) {
        reason = '至少需要 2 帧';
      } else {
        const firstKind = classifyAnimationValue(frames[0] && frames[0].value);
        const firstLen = firstKind === 'array' ? frames[0].value.length : 0;
        for (let i = 0; i < frames.length && !reason; i++) {
          const frame: any = frames[i] || {};
          if (frame.offset !== undefined && !Number.isFinite(Number(frame.offset))) {
            reason = `第 ${i} 帧的 offset 不是有限数`;
            break;
          }
          const kind = classifyAnimationValue(frame.value);
          if (kind === null) {
            reason = `第 ${i} 帧的取值必须是数字或全数字数组（当前 ${describeValue(frame.value)}）`;
            break;
          }
          if (kind !== firstKind) {
            reason = `第 ${i} 帧的取值类型与首帧不一致`;
            break;
          }
          if (kind === 'array' && frame.value.length !== firstLen) {
            reason = `第 ${i} 帧的数组长度与首帧不一致（${frame.value.length} ≠ ${firstLen}）`;
            break;
          }
        }
      }
      if (reason) {
        push('error', ICE_ANIMATION_DIAGNOSTIC_CODES.KEYFRAMES_INVALID, `keyframes 非法：${reason}`, key);
      }
    } else if (!isInterpolatablePair(animation.from, animation.to)) {
      push(
        'error',
        ICE_ANIMATION_DIAGNOSTIC_CODES.VALUE_NOT_INTERPOLATABLE,
        `from/to 必须都是数字或等长的全数字数组（当前 ${describeValue(animation.from)} → ${describeValue(
          animation.to
        )}）`,
        key
      );
    }

    // 性能提示：动画"派生参数相关"的属性 → 每帧重量测 / 位图重建
    if (typeof options.isSafeKey === 'function' && options.isSafeKey(key) === false) {
      push(
        'warning',
        ICE_ANIMATION_DIAGNOSTIC_CODES.KEY_AFFECTS_MEASUREMENT,
        `「${key}」会影响派生参数（尺寸 / 点集 / 文本量测），每帧都要重量测 —— 动画位置/透明度/颜色更划算`,
        key
      );
    }
  }

  list.sort((a, b) => (a.path === b.path ? a.code.localeCompare(b.code) : a.path.localeCompare(b.path)));
  return list;
}
