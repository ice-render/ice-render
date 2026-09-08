# 03 · 坐标系与矩阵组合

> 这是整个引擎**最核心、也最容易出错**的部分。嵌套坐标系下的矩阵运算曾导致一个重大 bug（坐标在多层嵌套 + 线性变换时经常算错），其根因与修复方式都在本章说明。

## 三个坐标系

| 坐标系 | 原点 | 说明 |
|---|---|---|
| **本地坐标系** | 组件自身左上角 `(0,0)` | 组件内部绘制使用的坐标 |
| **父坐标系** | 父组件左上角 | `left`/`top` 相对父组件偏移 |
| **全局坐标系** | canvas 左上角 `(0,0)` | 最终落点，`localToGlobal` 的目标 |

每个组件维护三个关键原点量：

- `origin`：原点位置描述（默认 `'localCenter'`，即几何中心）。
- `localOrigin`：相对本地坐标系的**原点坐标**（`localCenter` 时 = `[width/2, height/2]`）。
- `absoluteOrigin`：相对全局坐标系的原点坐标（叠加了所有父层的平移与变换）。

## 矩阵约定（列向量）

采用 `gl-matrix` 的 `mat2d`（2×3 仿射矩阵，列向量约定）。一个组件的最终变换由两步合成：

```mermaid
graph LR
    T[平移矩阵<br/>T(absoluteOrigin)] --> C[composedMatrix]
    L[绝对线性矩阵<br/>absoluteLinearMatrix] --> C
```

$$
composedMatrix = T(absoluteOrigin) \cdot absoluteLinearMatrix
$$

其中线性矩阵的**组合顺序**（列向量下越靠近根越外层、在乘法里越靠左）：

$$
absoluteLinearMatrix = 祖先① \cdot 祖先② \cdot \dots \cdot 自身
$$

自身线性矩阵 `calcLinearMatrix()` 的构造顺序为：**skew → rotate → scale**（符合自然理解：先错切、再旋转、最后缩放）。

## 关键方法

| 方法 | 作用 |
|---|---|
| `calcLocalOrigin()` | 计算 `localOrigin` |
| `calcAbsoluteOrigin()` | 计算 `absoluteOrigin`（叠加父层） |
| `calcLinearMatrix()` | 计算自身线性矩阵（不含平移） |
| `calcAbsoluteLinearMatrix()` | 复合所有祖先线性矩阵 |
| `composeMatrix()` | 计算 `composedMatrix = T(origin)·absoluteLinearMatrix` |
| `localToGlobal(x,y)` | 本地 → 全局（用 `composedMatrix`） |
| `globalToLocal(x,y)` | 全局 → 本地（用 `composedMatrix` 的逆） |

## 嵌套坐标的坑（历史 bug 与铁律）

**曾经的问题**：`calcAbsoluteLinearMatrix()` 与 `composeMatrix()` 直接读取祖先缓存的 `state.linearMatrix` / `state.composedMatrix` / `state.absoluteLinearMatrix`。但这些缓存：

1. 默认是空数组 `[]`（尚未计算）；
2. 可能是上一帧的**脏值**（祖先变换已变、缓存未刷新）。

导致子组件组合时拿到非法/过期数据，坐标算错甚至出现 `NaN`。

**修复后的铁律**：

- `calcAbsoluteLinearMatrix()` 必须**实时重新计算每一层祖先的线性矩阵**，严禁依赖祖先缓存。
- `composeMatrix()` 在组合子节点前，先确保祖先已完成 `composeMatrix()`（仅当祖先 `dirty` 或其 `composedMatrix` 为空时重算），保证 `calcAbsoluteOrigin` 读到的父 `composedMatrix` 永远新鲜。
- `moveGlobalPosition` / `setGlobalPosition` / `setGlobalRotate` 同样必须调用 `parentNode.calcAbsoluteLinearMatrix()` 取新鲜值。

回归用例见 `tests/graphic/ICEComponent.nested-coordinate.test.ts`。

## 嵌套坐标下的"全局位移/旋转"

在父组件有缩放/旋转/错切时，"在全局空间移动/旋转"不能直接累加 `left/top`，必须**先抵消父层变换**：

```javascript
// moveGlobalPosition(tx, ty)：用父层线性矩阵的逆，把全局位移转回本地位移
let matrix = mat2d.invert([], this.parentNode.calcAbsoluteLinearMatrix());
let point  = vec2.transformMat2d([], [tx, ty], matrix);
this.setPosition(this.state.left + point[0], this.state.top + point[1]);
```

`setGlobalRotate(angle)` 同理：从父层线性矩阵反解出父层旋转角，减去后再作为自身旋转角。

## 边界盒

- `getMinBoundingBox()`：随组件一起旋转/错切的最小包围盒（4 角用 `composedMatrix` 变换）。
- `getMaxBoundingBox()`：保持水平竖直的 AABB（4 边在全局 X/Y 轴上的投影范围）。
- 二者用于碰撞检测（连接线插槽）与选择高亮。旋转 90° 时 AABB 宽高会互换，回归用例见 `tests/graphic/transform-edge.test.ts`。
