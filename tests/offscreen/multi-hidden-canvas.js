//在隐藏的 canvas 中进行绘制，然后把图像数据拷贝给主显示 canvas 。
const canvas = document.querySelector('#canvas-1');
const ctx = canvas.getContext('2d');

let startTime = Date.now();
for (let i = 0; i < 100; i++) {
  const hiddenCanvas = document.createElement('canvas');
  hiddenCanvas.width = 1024;
  hiddenCanvas.height = 768;
  const hiddenCtx = hiddenCanvas.getContext('2d');
  hiddenCtx.strokeStyle = '#ff0000';
  hiddenCtx.fillStyle = '#0000ff';
  hiddenCtx.rect(Math.random() * 1000, Math.random() * 1000, 50, 50);
  hiddenCtx.stroke();
  hiddenCtx.fill();
  //FIXME:合并 ImageData
  const hiddenImageData = hiddenCtx.getImageData(0, 0, 1024, 768);
  ctx.putImageData(hiddenImageData, 0, 0);
}

let endTime = Date.now();
console.log(`Time> ${endTime - startTime} ms.`);
