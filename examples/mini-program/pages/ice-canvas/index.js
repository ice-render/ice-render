/**
 * 一个最小可用的小程序页面：在 `<canvas type="2d">` 上跑 ice-render。
 *
 * 三个关键点（缺一个就跑不起来）：
 *   1. `wx.createSelectorQuery().fields({ node: true, size: true })` 拿 **canvas 节点**（不是旧接口的 canvasId）；
 *   2. `canvas.getContext('2d')` 后直接 `ICE.init(ctx)` —— 引擎不依赖 DOM；
 *   3. 按 `dpr` 传入像素比，并把触摸事件交给宿主适配层换算坐标。
 */
const { ICE, ICERect, ICEText, ICEPolyLine } = require('ice-render');
const { createHostAdapter } = require('../../host-adapter');

Page({
  data: {
    status: '初始化中…',
  },

  onReady() {
    this.initCanvas();
  },

  onUnload() {
    if (this.host) this.host.dispose();
    if (this.ice) this.ice.destroy(); // 停掉帧循环，避免页面销毁后定时器继续跑
  },

  initCanvas() {
    wx.createSelectorQuery()
      .in(this)
      .select('#ice-canvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        const info = res && res[0];
        if (!info || !info.node) {
          this.setData({ status: '没有拿到 canvas 节点' });
          return;
        }
        const canvas = info.node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getSystemInfoSync().pixelRatio || 1;

        // 画布尺寸：小程序里 canvas 节点不会自动跟随 CSS 尺寸，必须显式设置
        canvas.width = info.width * dpr;
        canvas.height = info.height * dpr;

        // 引擎直接吃 canvas 2d 上下文：没有 document / window / Path2D / requestAnimationFrame 也能跑
        const ice = new ICE();
        ice.init(ctx, { dpr });
        this.ice = ice;

        this.buildScene(ice);

        this.host = createHostAdapter({ ice, component: this, canvasId: 'ice-canvas' });
        this.setData({ status: '拖一下方块试试（触摸已接入）' });
      });
  },

  buildScene(ice) {
    ice.addChild(
      new ICERect({
        left: 40,
        top: 40,
        width: 200,
        height: 90,
        radius: 12,
        draggable: true,
        style: { fillStyle: '#dbeafe', strokeStyle: '#2563eb', lineWidth: 2 },
      })
    );
    ice.addChild(
      new ICEText({
        left: 64,
        top: 76,
        text: '在小程序里渲染',
        style: { fillStyle: '#1e3a8a', fontSize: 16, fontWeight: 'bold' },
      })
    );
    ice.addChild(
      new ICERect({
        left: 320,
        top: 150,
        width: 160,
        height: 80,
        radius: 10,
        draggable: true,
        style: { fillStyle: '#dcfce7', strokeStyle: '#16a34a', lineWidth: 2 },
      })
    );
    ice.addChild(
      new ICEPolyLine({
        startPoint: [240, 85],
        endPoint: [320, 190],
        arrow: 'end',
        style: { strokeStyle: '#64748b', lineWidth: 2 },
      })
    );
  },

  onTouchStart(evt) {
    this.host && this.host.onTouchStart(evt);
  },
  onTouchMove(evt) {
    this.host && this.host.onTouchMove(evt);
  },
  onTouchEnd(evt) {
    this.host && this.host.onTouchEnd(evt);
  },
  onTouchCancel(evt) {
    this.host && this.host.onTouchCancel(evt);
  },
});
