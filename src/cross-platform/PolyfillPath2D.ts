/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import Path2DRecorder from './Path2DRecorder';

/**
 * @class PolyfillPath2D
 *
 * 「没有原生 Path2D」时的路径实现 —— 现在只是 `Path2DRecorder` 的别名：
 * 记录器本身就是「无原生时退化为纯命令记录」的那个实现，两者再各写一份必然会漂移
 * （历史上这里就少了 `arc`，导致小程序低版本 / Node 里画事件圆直接抛错）。
 *
 * 保留类名是为了不破坏既有 import 与测试里对它的引用。
 *
 * @deprecated 新代码请直接用 `Path2DRecorder`（或 `root.createPath2D()`）。
 */
export default class PolyfillPath2D extends Path2DRecorder {}
