# ice-render superpowers 工作流脚手架 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在核心引擎仓库 `ice-render/` 内落地 superpowers 工作流脚手架——建立 `AGENTS.md`、打通 `npm test`(jest 基线 + 首批纯逻辑单测)、建立 `docs/superpowers/specs/` 与 `plans/` 目录约定。

**Architecture:** 仅新增配置与文档,不改动任何既有业务代码。jest 走 babel(`@babel/preset-typescript`)编译 TS/JS,不经过 `tsc`,因此 `tsconfig` 的 `allowJs:false` 不影响测试运行。首批单测只覆盖纯逻辑模块(`GeoUtil` / `data-util.js` / `ICEBoundingBox`),刻意避开 `ICE` 实例、`canvas`、`FrameManager` 与 `.js` 桥接模块的 `tsc` 类型链问题。

**Tech Stack:** jest 29.7.0(已装) + babel-jest 29.7.0(已装) + `@babel/preset-env` + `@babel/preset-typescript`(`.babelrc` 已含)。

## Global Constraints

- 作用仓库:仅 `ice-render/`(核心引擎,有 git)。禁止改动 `ice-entity-designer` / `ice-flow` / *-demo / `ice-render-doc` / `ice-render-lesson`。
- 分支:直接在 `dev` 分支提交;不为此脚手架新建分支。
- `src/` 业务代码零改动(仅允许在 `src/` 下**新增** `*.test.ts` 测试文件);技术债修复不在本次范围。
- 测试环境:`node`(首批纯逻辑,不碰 DOM,不引入 jsdom)。
- 既有 `husky`/`lint-staged` 钩子不动;本次不添加 pre-commit test hook。

---

### Task 1: 搭建 jest + babel 配置

**Files:**
- Create: `ice-render/jest.config.js`
- Create: `ice-render/babel.config.js`
- Modify: `ice-render/package.json`(新增 `"test": "jest"` script)

**Interfaces:**
- Produces: `npm test` 可运行;`src/**/*.test.ts` 被 babel-jest 编译。

- [ ] **Step 1: 创建 `jest.config.js`**

```javascript
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/src/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.(ts|js)$': 'babel-jest',
  },
};
```

- [ ] **Step 2: 创建 `babel.config.js`**(显式声明,babel 7 兼容语法,供 jest 稳定读取)

```javascript
module.exports = {
  presets: [
    '@babel/preset-env',
    '@babel/preset-typescript',
  ],
};
```

- [ ] **Step 3: 修改 `ice-render/package.json` 的 `scripts`,新增 test**

在 `scripts` 对象中加入一行(其余 scripts 保持不变):

```json
"test": "jest"
```

- [ ] **Step 4: 运行 jest 验证可启动(空跑,暂无测试文件应报 no tests found,退出码 1 属正常)**

Run: `cd ice-render && npx jest --listTests`
Expected: 输出空或 "No tests found",不报 babel/配置错误。

- [ ] **Step 5: Commit**

```bash
cd ice-render
git add jest.config.js babel.config.js package.json
git commit -m "chore: add jest+babel config and test script (superpowers scaffold)"
```

---

### Task 2: GeoUtil 纯逻辑测试

**Files:**
- Create: `ice-render/src/geometry/GeoUtil.test.ts`

**Interfaces:**
- Consumes: `GeoUtil.calcRotateAngle`、`GeoUtil.calcRotateAngleFromMatrix`、`GeoUtil.calcScaleFromMatrix`(均来自现有 `src/geometry/GeoUtil.ts`,纯静态方法,无 DOM 依赖)。
- Produces: 验证几何计算正确性的回归基线。

- [ ] **Step 1: 写测试**

```typescript
import GeoUtil from './GeoUtil';

describe('GeoUtil.calcRotateAngle', () => {
  it('沿 +X 轴返回 0 度', () => {
    expect(GeoUtil.calcRotateAngle(1, 0, 0, 0)).toBe(0);
  });
  it('沿 +Y 轴返回 90 度', () => {
    expect(GeoUtil.calcRotateAngle(0, 1, 0, 0)).toBe(90);
  });
  it('沿 -X 轴返回 180 度', () => {
    expect(GeoUtil.calcRotateAngle(-1, 0, 0, 0)).toBe(180);
  });
});

describe('GeoUtil.calcRotateAngleFromMatrix', () => {
  it('单位矩阵返回 0 度', () => {
    expect(GeoUtil.calcRotateAngleFromMatrix([1, 0, 0, 1])).toBe(0);
  });
  it('90 度旋转矩阵返回 90 度', () => {
    expect(GeoUtil.calcRotateAngleFromMatrix([0, 1, -1, 0])).toBe(90);
  });
});

describe('GeoUtil.calcScaleFromMatrix', () => {
  it('缩放矩阵返回对应缩放', () => {
    expect(GeoUtil.calcScaleFromMatrix([2, 0, 0, 3])).toEqual([2, 3]);
  });
});
```

- [ ] **Step 2: 运行测试验证通过**

Run: `cd ice-render && npx jest src/geometry/GeoUtil.test.ts`
Expected: PASS(3 个 describe 共 5 个用例全绿)。

- [ ] **Step 3: Commit**

```bash
cd ice-render
git add src/geometry/GeoUtil.test.ts
git commit -m "test: add GeoUtil pure-logic unit tests"
```

---

### Task 3: data-util.js 纯逻辑测试

**Files:**
- Create: `ice-render/src/util/data-util.test.ts`

**Interfaces:**
- Consumes: `flattenTree(result, childNodes, level, pid)` 与 `getVal(object, path)`(来自现有 `src/util/data-util.js`,纯函数;jest 走 babel 直接编译 `.js`)。
- Produces: 验证组件树展平与属性取值的回归基线。

- [ ] **Step 1: 写测试**

```typescript
import { flattenTree, getVal } from './data-util';

describe('flattenTree', () => {
  it('展平单层节点并标注 _level/_pid', () => {
    const tree = [{ id: 'a', childNodes: [] }, { id: 'b', childNodes: [] }];
    const result = flattenTree([], tree);
    expect(result).toHaveLength(2);
    expect(result[0]._level).toBe(1);
    expect(result[0]._pid).toBeNull();
  });

  it('递归展平嵌套子节点并保留父子关系', () => {
    const tree = [
      { id: 'p', childNodes: [{ id: 'c', childNodes: [] }] },
    ];
    const result = flattenTree([], tree);
    expect(result.map((n) => n.id)).toEqual(['p', 'c']);
    expect(result[1]._level).toBe(2);
    expect(result[1]._pid).toBe('p');
  });
});

describe('getVal', () => {
  it('按点路径取值', () => {
    const obj = { a: { b: { c: 42 } } };
    expect(getVal(obj, 'a.b.c')).toBe(42);
  });
  it('路径不存在时抛出', () => {
    const obj = { a: 1 };
    expect(() => getVal(obj, 'a.b.c')).toThrow();
  });
});
```

- [ ] **Step 2: 运行测试验证通过**

Run: `cd ice-render && npx jest src/util/data-util.test.ts`
Expected: PASS(2 个 describe 共 4 个用例全绿)。

- [ ] **Step 3: Commit**

```bash
cd ice-render
git add src/util/data-util.test.ts
git commit -m "test: add data-util flattenTree/getVal unit tests"
```

---

### Task 4: ICEBoundingBox 纯几何测试

**Files:**
- Create: `ice-render/src/geometry/ICEBoundingBox.test.ts`

**Interfaces:**
- Consumes: `ICEBoundingBox.fromDimension(left, top, width, height)` 与实例方法 `getMinAndMaxPoint()`(来自现有 `src/geometry/ICEBoundingBox.ts`,纯几何计算,无 DOM 依赖)。
- Produces: 验证包围盒几何计算的回归基线。

- [ ] **Step 1: 写测试**

```typescript
import ICEBoundingBox from './ICEBoundingBox';

describe('ICEBoundingBox.fromDimension', () => {
  it('根据 left/top/width/height 计算四角与中心', () => {
    const box = ICEBoundingBox.fromDimension(10, 20, 100, 50);
    expect(box.tl).toEqual([10, 20]);
    expect(box.tr).toEqual([110, 20]);
    expect(box.bl).toEqual([10, 70]);
    expect(box.br).toEqual([110, 70]);
    expect(box.center).toEqual([60, 45]);
  });
});

describe('ICEBoundingBox.getMinAndMaxPoint', () => {
  it('返回坐标极值', () => {
    const box = ICEBoundingBox.fromDimension(10, 20, 100, 50);
    expect(box.getMinAndMaxPoint()).toEqual({
      minX: 10,
      minY: 20,
      maxX: 110,
      maxY: 70,
    });
  });
});
```

- [ ] **Step 2: 运行测试验证通过**

Run: `cd ice-render && npx jest src/geometry/ICEBoundingBox.test.ts`
Expected: PASS(2 个 describe 共 2 个用例全绿)。

- [ ] **Step 3: Commit**

```bash
cd ice-render
git add src/geometry/ICEBoundingBox.test.ts
git commit -m "test: add ICEBoundingBox geometry unit tests"
```

---

### Task 5: AGENTS.md 与目录约定

**Files:**
- Create: `ice-render/AGENTS.md`
- Create: `ice-render/plans/.gitkeep`
- (已存在) `ice-render/docs/superpowers/specs/2026-09-08-ice-render-superpowers-scaffold-design.md`(本计划对应的 spec,Task 1-4 已使其所在目录非空)

**Interfaces:**
- Produces: 仓库级共享约定,供后续 superpowers 闭环(任何新功能/修债先 brainstorm→spec→plan→TDD→review)读取。

- [ ] **Step 1: 创建 `ice-render/AGENTS.md`**

内容至少包含以下章节(从 `.workbuddy/memory/MEMORY.md` 提炼,但作为仓库级共享文档写入):

```markdown
# AGENTS.md — ice-render

## 项目定位
Canvas 2D 交互图形渲染引擎(MIT,作者 大漠穷秋)。运行时依赖仅 `lodash` 与 `gl-matrix`。
本文件是仓库级共享约定,agent 与人类协作者都应遵循。

## 引擎架构铁律(改动前必读)
- 运行时链路:`FrameManager`(全局单例,包装 rAF)→ `EventBus`(每 ICE 实例一条)→ 各 Manager 订阅 → `CanvasRenderer`。
- `ICE.init()` 中 Manager 启动有严格顺序:`EventBus` 最先;`linkSlotManager` 必须在 `renderer` 之后(它监听 renderer 事件)。
- 渲染策略:脏标记 `ICE.dirty` + 全量重绘,无局部重绘/脏矩形。每帧 `flattenTree` 展平组件树并按 `zIndex` 排序。
- 组件模型:`props`(构造入参,`lodash.merge`)与 `state`(`cloneDeep(props)`,动画改 state)分离,概念借鉴 React。
- 类继承:`ICEEventTarget → ICEComponent(abstract) → ICEPath(abstract) → ICEDotPath(abstract) → 图元`;`ICEGroup extends ICERect`;`ICEControlPanel extends ICEGroup`;`ICELinkSlot/ICELinkHook/RotateControl extends ICECircle`。
- 变换基于 `gl-matrix` 的 `mat2d`,自带 `gl-matrix-skew.js` 补 skew。
- 序列化:`Serializer`/`Deserializer` + `COMPONENT_TYPE_MAPPING` 做类名→构造函数映射;自定义组件需 `ice.registerType()` 后才能反序列化。

## 已知技术债(严重度)
- P0:零单元测试(已装 jest 29 但无 `.test.ts`,`package.json` 无 test script)。
- P1:`ice-flow` 声明 `"ice-render": "^0.0.47"`,引擎已 `1.0.4`,caret 跨主版本无法解析。
- P1:README 称"纯 TypeScript",但残留 7 个未迁移 `.js`(`cross-platform/root.js`、`event/DOMEventInterceptor.js`、`geometry/GeoLine.js`、`geometry/GeoPoint.js`、`util/data-util.js`、`util/gl-matrix-skew.js`、`util/uuid.js`);且 `tsconfig` 设 `allowJs: false`,`index.ts` 无扩展名导出这些模块,类型链断裂。
- P2:下游 `ice-entity-designer`/`ice-flow` 的 devDeps 冻在 2022(rollup 2 / TS 4.6 / eslint 6),与引擎(rollup 3 / TS 5.9 / eslint 8)工具链分叉。
- P2:`CanvasRenderer.doRender()` 有未使用 `startTime` 死代码;`ICE.init()` 留 `//FIXME:防止 init 方法被调用多次`。

## superpowers 协作约定
本工程使用 superpowers 闭环开发:
1. 任何新功能 / 修债 → 先 `brainstorm` 出 spec,写入 `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`。
2. 用 `writing-plans` 生成实现计划,写入 `plans/`。
3. TDD 实现:测试先行,`npm test` 必须全绿。
4. 用 `requesting-code-review` 做代码审查。
5. 用 `finishing-a-development-branch` 收尾。

## git 约定
- 核心引擎在 `dev` 分支开发,远程 `origin/dev`。
- 提交信息遵循 `@commitlint/config-conventional`(已在 devDeps)。
```

- [ ] **Step 2: 创建 `ice-render/plans/.gitkeep`(保证目录进 git)**

空文件即可。

- [ ] **Step 3: 运行全部测试做最终验证**

Run: `cd ice-render && npm test`
Expected: PASS,首批 3 个测试文件共 11 个用例全绿(5 + 4 + 2)。

- [ ] **Step 4: Commit**

```bash
cd ice-render
git add AGENTS.md plans/.gitkeep
git commit -m "docs: add AGENTS.md and plans/ dir for superpowers workflow"
```

---

## 收尾验证(所有 Task 完成后)

Run: `cd ice-render && npm test`
Expected: 退出码 0,3 个测试套件、11 个用例全绿;`git status` 显示 `src/` 仅新增 `*.test.ts`、`AGENTS.md`/`jest.config.js`/`babel.config.js`/`plans/.gitkeep` 新增、`package.json` 仅多了 `test` script——无任何既有业务代码被改动。
