/**
 * 动画时间轴：把「谁、在什么时刻、动什么」组织成一条可播放/暂停/重播的轨道集合。
 *
 * 为什么要它：`props.animations` 是**每条属性各自为政**的（各自 duration / easing / 自己的 startTime），
 * 表达"卡片 A 入场 → 200ms 后卡片 B 跟上 → 一起停住"这类编排时，应用只能手算 delay —— 这正是
 * Agent / 低代码最不擅长的部分（算时间）。
 *
 * 设计取向（与 18 §3.1 的"不引入新时间模型"一致）：时间轴**不是新的求值器**，它只是调度器 ——
 * `play()` 时把每条轨道折算成 `delay` 写进组件的 `props.animations`，剩下的推进仍由 `AnimationManager`
 * 按帧/按时间完成。因此它与既有的缓动、关键帧、量化、缓存复用、空闲停帧完全兼容。
 *
 * ```js
 * const timeline = ice.animationManager.timeline();
 * timeline
 *   .add(cardA, { 'transform.translate': { from: [-40, 0], to: [0, 0], duration: 400 } }, { at: 0 })
 *   .add(cardB, { 'transform.translate': { from: [-40, 0], to: [0, 0], duration: 400 } }, { at: '+=120' })
 *   .stagger(rows, { 'style.globalAlpha': { from: 0, to: 1, duration: 240 } }, { each: 60, at: 300 });
 * timeline.play();
 * // 点击重播：
 * timeline.restart();
 * ```
 */
import AnimationManager from './AnimationManager';

export type TimelineOptions = {
  /** 起始时刻：绝对毫秒，或 `'+=N'`（相对**上一条轨道**的时间） */
  at?: number | string;
  /** `stagger` 用：每条之间的间隔毫秒 */
  each?: number;
};

type TimelineTrack = {
  component: any;
  /** 本次写进 `props.animations` 的键（stop/restart 时要还原/重置） */
  keys: string[];
  /** 轨道起始时刻（毫秒，相对时间轴 0） */
  at: number;
  /** 每条键的原始配置片段（delay 与 onComplete）——重复 play 不叠加 delay，stop 时还原回调 */
  originals: Record<string, { onComplete?: any; delay?: any }>;
};

export default class AnimationTimeline {
  private manager: AnimationManager;
  private tracks: TimelineTrack[] = [];
  private cursor = 0; // "上一条轨道"的时间，供 '+=N' 用
  private playing = false;
  private paused = false;
  private pending = 0; // 还没跑完的轨道数
  private finishedPromise: Promise<void> | null = null;
  private resolveFinished: (() => void) | null = null;

  constructor(manager: AnimationManager) {
    this.manager = manager;
  }

  /** 时间轴总时长（最后一条轨道的起始 + 它自己的时长；用于排版/展示）。 */
  public get duration(): number {
    let max = 0;
    this.tracks.forEach((track) => {
      const animations = track.component.props.animations || {};
      let longest = 0;
      track.keys.forEach((key) => {
        const animation = animations[key];
        if (!animation) {
          return;
        }
        // duration 可能是 motion token（字符串）——此时按 0 计，宁可少算也不抛
        const value = Number(animation.duration);
        const delay = Number(animation.delay) || 0;
        longest = Math.max(longest, (Number.isFinite(value) ? value : 0) + delay);
      });
      max = Math.max(max, track.at + longest);
    });
    return max;
  }

  public isPlaying(): boolean {
    return this.playing && !this.paused;
  }

  /** 全部轨道跑完时 resolve（`play()` 之前拿到的是同一个 Promise）。 */
  public get finished(): Promise<void> {
    if (!this.finishedPromise) {
      this.finishedPromise = new Promise((resolve) => {
        this.resolveFinished = resolve;
      });
    }
    return this.finishedPromise;
  }

  /**
   * 加一条轨道：把 `config`（`{属性路径: 动画配置}`）合并进组件的 `props.animations`，
   * 并记录这条轨道的起始时刻。
   */
  public add(component: any, config: Record<string, any>, options: TimelineOptions = {}): this {
    if (!component || !config) {
      return this;
    }
    const at = this.__resolveAt(options.at);
    this.cursor = Math.max(this.cursor, at);
    const keys: string[] = [];
    const originals: Record<string, { onComplete?: any; delay?: any }> = {};
    for (const key in config) {
      // 用组件的运行时 API：内部做**写时复制**（没声明过 animations 的组件继承的是冻结的共享默认对象，
      // 直接写会抛 object is not extensible），并顺手把组件纳入 AnimationManager。
      const current = component.props.animations && component.props.animations[key];
      const merged = { ...(current || {}), ...config[key] };
      originals[key] = { onComplete: merged.onComplete, delay: current && current.delay };
      if (typeof component.setAnimation === 'function') {
        component.setAnimation(key, merged);
      } else {
        if (!component.props.animations) {
          component.props.animations = {};
        }
        component.props.animations[key] = merged;
      }
      keys.push(key);
    }
    this.tracks.push({ component, keys, at, originals });
    return this;
  }

  /**
   * 错峰：同一份配置按 `each` 毫秒依次加到一组组件上（"卡片依次滑入"）。
   * 返回 this 以便链式继续 `add`。
   */
  public stagger(components: any[], config: Record<string, any>, options: TimelineOptions = {}): this {
    const each = Number(options.each) > 0 ? Number(options.each) : 0;
    const start = this.__resolveAt(options.at);
    const list = Array.isArray(components) ? components : [];
    list.forEach((component, index) => {
      // 注意：这里**不能**用 '+=N' 的游标语义，要给每条一个显式的绝对时刻
      this.add(component, config, { at: start + index * each });
    });
    this.cursor = Math.max(this.cursor, start + Math.max(0, list.length - 1) * each);
    return this;
  }

  /**
   * 播放：把每条轨道注册进 `AnimationManager`（按 `at` 折算 delay）并唤醒帧循环。
   * 重复调用是幂等的（已在播放则什么都不做）。
   */
  public play(): this {
    if (this.playing && !this.paused) {
      return this;
    }
    this.paused = false;
    if (this.playing) {
      // 从暂停恢复：进度接着走（由 AnimationManager 的全局 resume 处理）
      this.manager.resume();
      return this;
    }
    // 从头播放：**必须重置每条动画的运行时状态**。
    // 否则 stop 之后再 play 会沿用上一次的 `startTime`，elapsed 一夜之间变成"已经跑了很久"，
    // 编排会被压缩甚至直接跳到终点（真实浏览器 e2e 抓到的缺陷）。
    this.finishedPromise = null;
    this.resolveFinished = null;
    let keys = 0;
    this.tracks.forEach((track) => {
      track.keys.forEach((key) => {
        const animation = track.component.props.animations[key];
        if (!animation) {
          return;
        }
        const original = track.originals[key] || {};
        // delay 用**介入前**的原始值重算，避免重复 play 叠加
        animation.delay = track.at + (Number(original.delay) || 0);
        animation.startTime = undefined;
        animation.finished = false;
        animation.__iteration = 0;
        animation.__lastTick = undefined;
        // 包一层 onComplete 做完成计数（原回调照旧调用）
        animation.onComplete = () => {
          if (typeof original.onComplete === 'function') {
            original.onComplete();
          }
          this.__onTrackKeyDone();
        };
        keys += 1;
      });
      this.manager.add(track.component);
    });
    // 完成计数按**键**（一条轨道可能挂多个属性），否则 promise 会提前 resolve
    this.pending = keys;
    this.playing = true;
    this.__resolveIfDone();
    return this;
  }

  /** 暂停整条时间轴（等价于 `AnimationManager.pause()`）。 */
  public pause(): this {
    if (this.playing && !this.paused) {
      this.manager.pause();
      this.paused = true;
    }
    return this;
  }

  /** 继续（从暂停处接上）。 */
  public resume(): this {
    if (this.playing && this.paused) {
      this.manager.resume();
      this.paused = false;
    }
    return this;
  }

  /**
   * 停止：把本时间轴注册的动画从管理器里摘掉（还原 onComplete 包装），组件停在当前值。
   */
  public stop(): this {
    this.tracks.forEach((track) => {
      track.keys.forEach((key) => {
        const animation = track.component.props.animations[key];
        if (!animation) {
          return;
        }
        const original = track.originals[key] && track.originals[key].onComplete;
        animation.onComplete = original;
      });
      this.manager.remove(track.component);
    });
    this.playing = false;
    this.paused = false;
    this.pending = 0;
    return this;
  }

  /**
   * 重播：重置每条动画的运行时状态（startTime / finished / 轮次 / 降频节拍）后重新播放。
   * 这是"点击重播"的直接入口。
   */
  public restart(): this {
    // play() 已经负责"重置运行时状态 + 重建 finished Promise"，这里只需要回到未播放态
    this.playing = false;
    this.paused = false;
    this.pending = 0;
    return this.play();
  }

  /** `'+=N'` → 游标 + N；数字 → 原值；非法 → 当前游标。 */
  private __resolveAt(value: number | string | undefined): number {
    if (typeof value === 'string') {
      const matched = /^\+=?\s*(\d+(?:\.\d+)?)$/.exec(value.trim());
      if (matched) {
        return this.cursor + Number(matched[1]);
      }
      return this.cursor;
    }
    const at = Number(value);
    return Number.isFinite(at) && at >= 0 ? at : this.cursor;
  }

  private __onTrackKeyDone(): void {
    if (this.pending > 0) {
      this.pending -= 1;
    }
    this.__resolveIfDone();
  }

  private __resolveIfDone(): void {
    if (this.pending <= 0 && this.playing && this.resolveFinished) {
      const resolve = this.resolveFinished;
      this.resolveFinished = null;
      resolve();
    }
  }
}
