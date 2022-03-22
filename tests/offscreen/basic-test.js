const canvas = document.querySelector('#canvas-1');
const ctx = canvas.getContext('2d');

ctx.strokeStyle = '#ff0000';
ctx.fillStyle = '#0000ff';

let startTime = Date.now();
for (let i = 0; i < 10000; i++) {
  ctx.rect(Math.random() * 1024, Math.random() * 768, 50, 50);
}
ctx.stroke();
ctx.fill();

let endTime = Date.now();
console.log(`Time> ${endTime - startTime} ms.`);
