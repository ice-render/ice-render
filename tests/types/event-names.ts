/**
 * **事件名的类型级回归**（只由 `tsc --noEmit` 检查；文件名不含 `.test.`，jest 不会执行）。
 *
 * 目的：`on / once / trigger` 对**引擎认识的事件名**给出强类型（`evt.param` 有形状、
 * DOM 语义事件能读到归一化输入字段），对**应用自定义事件名**回退成 `any`（不限制扩展）。
 * 这里用类型断言把这三条钉住 —— 类型退化了，`npm run types:check` 就会红。
 */
import ICEEventTarget from '../../src/event/ICEEventTarget';
import ICE_EVENT_NAME_CONSTS from '../../src/consts/ICE_EVENT_NAME_CONSTS';
import type { ICEEventOf } from '../../src/event/event-types';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

class Fixture extends ICEEventTarget {}
const target: any = new Fixture();

// ① 内置事件：evt.param 有类型（写错属性编译器会拦）
target.on(ICE_EVENT_NAME_CONSTS.AFTER_ADD, (evt: ICEEventOf<'AFTER_ADD'>) => {
  const component: any = evt.param.component;
  return component;
});

target.on(ICE_EVENT_NAME_CONSTS.THEME_CHANGE, (evt: ICEEventOf<'THEME_CHANGE'>) => {
  const kind: 'theme' | 'chrome' | 'patch' = evt.param.kind;
  return kind;
});

// ② DOM 语义事件：归一化后的输入字段能直接读（以前类上没声明，只能写 any）
target.on('mousedown', (evt: ICEEventOf<'mousedown'>) => {
  const x: number | undefined = evt.offsetX;
  const dx: number | undefined = evt.movementX;
  return [x, dx];
});

// ③ 应用自定义事件名仍然允许，回退成 any（不限制扩展）
target.on('itemclick', (evt: any) => evt.whatever);

// ④ 类型映射本身：内置事件名 → param 形状
type AddParam = ICEEventOf<'AFTER_ADD'>['param'];
type ThemeParam = ICEEventOf<'THEME_CHANGE'>['param'];
type _add = Expect<Equal<AddParam, { component: any }>>;
type _theme = Expect<Equal<ThemeParam['kind'], 'theme' | 'chrome' | 'patch'>>;
type _custom = Expect<Equal<ICEEventOf<'whatever-app-event'>['param'], any>>;

// 让上面的类型别名"被使用"，避免 noUnusedLocals 之类的规则误判
export type __typeChecks = [_add, _theme, _custom];
