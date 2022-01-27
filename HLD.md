# HLD

- 整体基于 TS
- 只支持 canvas ，不支持其它引擎
- 分模块构建
- 工程切分：core/BPMN/Entity/PageDesigner?
- 自动化测试：用例、覆盖率、不同运行时环境

## event

1、事件总线（需要兼容 WEB、小程序、NodeJS 三种运行时环境）

## core

1、帧频控制（需要兼容 WEB、小程序、NodeJS 三种运行时环境）
2、事件总线（需要兼容 WEB、小程序、NodeJS 三种运行时环境）

## graphic

## animation

1、Tweens（使用 CSS 的 keyframes 定义规则）

## transformation

1、笛卡尔坐标系变换算法
2、仿射变换的矩阵算法

## util

1、各种数据格式化工具函数

## CSS

1、使用 CSSProperties 规范
