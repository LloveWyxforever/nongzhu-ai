import * as THREE from 'three';
const rand=(a,b)=>a+Math.random()*(b-a);
export function buildTextures(){
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  draw(x, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 4;
  return t;
}

// 切面土：分层的壤土、碎石与孔洞
const soilSideTex = canvasTex(512, 512, (x, w, h) => {
  x.fillStyle = '#66452c';
  x.fillRect(0, 0, w, h);
  const bands = [
    [0.05, 0.09, '#553a25'], [0.16, 0.05, '#7a5637'], [0.24, 0.11, '#5c3f28'],
    [0.40, 0.06, '#714d31'], [0.49, 0.12, '#543824'], [0.64, 0.07, '#7b5838'],
    [0.73, 0.10, '#5a3d26'], [0.86, 0.06, '#704c30']
  ];
  bands.forEach(([y, hh, col]) => {
    x.fillStyle = col;
    x.beginPath();
    x.moveTo(0, y * h);
    for (let i = 0; i <= 8; i++) x.lineTo(i * w / 8, y * h + Math.sin(i * 1.6 + y * 9) * 6);
    x.lineTo(w, (y + hh) * h);
    for (let i = 8; i >= 0; i--) x.lineTo(i * w / 8, (y + hh) * h + Math.sin(i * 2.1 + y * 7) * 5);
    x.closePath();
    x.fill();
  });
  for (let i = 0; i < 2600; i++) {
    const px = Math.random() * w, py = Math.random() * h;
    const a = Math.random() * 0.13;
    x.fillStyle = Math.random() > 0.5 ? `rgba(255,235,200,${a})` : `rgba(24,14,6,${a})`;
    x.fillRect(px, py, Math.random() * 2.2 + 0.6, Math.random() * 2.2 + 0.6);
  }
  for (let i = 0; i < 170; i++) {
    const px = Math.random() * w, py = Math.random() * h;
    const r = rand(1.6, 5.2);
    x.fillStyle = ['#8d6c4b', '#4a3221', '#a08060', '#593b26'][i % 4];
    x.beginPath();
    x.ellipse(px, py, r, r * rand(0.6, 0.95), rand(0, 3.14), 0, 6.283);
    x.fill();
    x.fillStyle = 'rgba(255,240,215,.18)';
    x.beginPath();
    x.ellipse(px - r * 0.3, py - r * 0.35, r * 0.35, r * 0.25, 0, 0, 6.283);
    x.fill();
  }
}, [1, 1]);

// 草皮：被修剪过的草地，深浅斑驳
const grassTex = canvasTex(512, 512, (x, w, h) => {
  x.fillStyle = '#7b9450';
  x.fillRect(0, 0, w, h);
  const tones = ['#8ca75e', '#6f8947', '#94ab66', '#637c3f', '#86a05a'];
  for (let i = 0; i < 240; i++) {
    x.fillStyle = tones[i % tones.length];
    x.globalAlpha = rand(0.12, 0.4);
    x.beginPath();
    x.ellipse(rand(0, w), rand(0, h), rand(8, 46), rand(6, 32), rand(0, 3.1), 0, 6.283);
    x.fill();
  }
  x.globalAlpha = 1;
  for (let i = 0; i < 5200; i++) {
    const px = Math.random() * w, py = Math.random() * h;
    x.strokeStyle = Math.random() > 0.55 ? 'rgba(214,226,160,.34)' : 'rgba(52,66,30,.28)';
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(px, py);
    x.lineTo(px + rand(-1.4, 1.4), py - rand(2, 6));
    x.stroke();
  }
}, [3, 3]);

// 犁过的田面：垄沟 + 干土色（湿了靠材质颜色压深）
const tilledTex = canvasTex(512, 512, (x, w, h) => {
  x.fillStyle = '#82633f';
  x.fillRect(0, 0, w, h);
  const tones = ['#8f7048', '#755835', '#997a53', '#6d5131', '#87673f'];
  for (let i = 0; i < 260; i++) {
    x.globalAlpha = rand(0.1, 0.34);
    x.fillStyle = tones[i % tones.length];
    x.beginPath();
    x.ellipse(rand(0, w), rand(0, h), rand(8, 46), rand(5, 22), rand(0, 3.1), 0, 6.283);
    x.fill();
  }
  x.globalAlpha = 1;
  for (let i = 0; i < 4200; i++) {
    x.fillStyle = Math.random() > 0.5 ? `rgba(226,198,160,${rand(0.04, 0.2)})` : `rgba(58,38,22,${rand(0.05, 0.22)})`;
    x.fillRect(Math.random() * w, Math.random() * h, rand(1, 3.4), rand(1, 3.4));
  }
  for (let i = 0; i < 240; i++) {
    const px = Math.random() * w, py = Math.random() * h, r = rand(1.6, 4.6);
    x.fillStyle = ['#a2865f', '#5f4629', '#8d7048'][i % 3];
    x.globalAlpha = rand(0.3, 0.8);
    x.beginPath();
    x.ellipse(px, py, r, r * 0.75, rand(0, 3.1), 0, 6.283);
    x.fill();
  }
  x.globalAlpha = 1;
  for (let i = 0; i < 90; i++) {
    x.strokeStyle = `rgba(52,34,18,${rand(0.1, 0.3)})`;
    x.lineWidth = rand(0.8, 1.8);
    const px = Math.random() * w, py = Math.random() * h;
    x.beginPath();
    x.moveTo(px, py);
    x.lineTo(px + rand(-22, 22), py + rand(-6, 6));
    x.stroke();
  }
}, [1, 1]);

// 木头：篱笆、木桶、水壶把手
const woodTex = canvasTex(128, 256, (x, w, h) => {
  x.fillStyle = '#9b7043';
  x.fillRect(0, 0, w, h);
  for (let i = 0; i < 46; i++) {
    x.strokeStyle = `rgba(${60 + Math.random() * 40},${40 + Math.random() * 30},${20 + Math.random() * 20},${rand(0.18, 0.5)})`;
    x.lineWidth = rand(0.7, 2.6);
    x.beginPath();
    const px = Math.random() * w;
    x.moveTo(px, 0);
    x.bezierCurveTo(px + rand(-9, 9), h * 0.35, px + rand(-9, 9), h * 0.7, px + rand(-6, 6), h);
    x.stroke();
  }
  x.strokeStyle = 'rgba(255,228,180,.16)';
  for (let i = 0; i < 14; i++) {
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(Math.random() * w, 0);
    x.lineTo(Math.random() * w, h);
    x.stroke();
  }
}, [1, 1]);


return {soil:soilSideTex,grass:grassTex,tilled:tilledTex,wood:woodTex};
}
