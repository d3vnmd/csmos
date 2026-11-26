// Procedurally generated canvas textures (no external image assets).
import * as THREE from 'three';

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')];
}

function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function speckle(ctx, size, rnd, count, minA, maxA, light, dark, maxR = 2) {
  for (let i = 0; i < count; i++) {
    const x = rnd() * size, y = rnd() * size, r = 0.5 + rnd() * maxR;
    const a = minA + rnd() * (maxA - minA);
    ctx.fillStyle = rnd() < 0.5 ? `rgba(${light},${a})` : `rgba(${dark},${a})`;
    ctx.fillRect(x, y, r, r);
  }
}

function blotches(ctx, size, rnd, count, color, alpha, minR, maxR) {
  for (let i = 0; i < count; i++) {
    const x = rnd() * size, y = rnd() * size, r = minR + rnd() * (maxR - minR);
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
      const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      g.addColorStop(0, `rgba(${color},${alpha})`);
      g.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    }
  }
}

function toTexture(c, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function sandTexture() {
  const size = 512;
  const [c, ctx] = canvas(size);
  const rnd = seededRandom(11);
  ctx.fillStyle = '#c9ad7f';
  ctx.fillRect(0, 0, size, size);
  blotches(ctx, size, rnd, 40, '150,118,74', 0.18, 30, 110);
  blotches(ctx, size, rnd, 30, '235,214,170', 0.15, 20, 80);
  speckle(ctx, size, rnd, 9000, 0.05, 0.25, '255,240,210', '90,70,40', 2.2);
  // faint paving stones
  ctx.strokeStyle = 'rgba(90,70,45,0.10)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath(); ctx.moveTo(0, i * 128); ctx.lineTo(size, i * 128); ctx.stroke();
    for (let j = 0; j < 4; j++) {
      const off = (i % 2) * 64;
      ctx.beginPath(); ctx.moveTo(j * 128 + off, i * 128); ctx.lineTo(j * 128 + off, i * 128 + 128); ctx.stroke();
    }
  }
  return toTexture(c);
}

export function plasterTexture(base = '#d8c39a', seed = 3) {
  const size = 512;
  const [c, ctx] = canvas(size);
  const rnd = seededRandom(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  blotches(ctx, size, rnd, 30, '120,95,60', 0.12, 40, 140);
  blotches(ctx, size, rnd, 25, '255,245,220', 0.12, 30, 90);
  speckle(ctx, size, rnd, 6000, 0.04, 0.16, '255,250,235', '80,60,35', 1.6);
  // exposed brick patches
  for (let p = 0; p < 4; p++) {
    const px = rnd() * size, py = rnd() * size;
    const bw = 34, bh = 16;
    for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) {
      if (rnd() < 0.3) continue;
      const x = px + k * bw + (r % 2) * bw * 0.5, y = py + r * bh;
      ctx.fillStyle = `rgba(${150 + rnd() * 30},${90 + rnd() * 20},${60 + rnd() * 15},0.55)`;
      ctx.fillRect(x % size, y % size, bw - 3, bh - 3);
    }
  }
  // grime at the bottom (v = 0 at floor in our UVs maps to canvas bottom)
  const g = ctx.createLinearGradient(0, size * 0.75, 0, size);
  g.addColorStop(0, 'rgba(70,50,30,0)');
  g.addColorStop(1, 'rgba(70,50,30,0.35)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return toTexture(c);
}

export function crateTexture() {
  const size = 256;
  const [c, ctx] = canvas(size);
  const rnd = seededRandom(7);
  ctx.fillStyle = '#9a6b3c';
  ctx.fillRect(0, 0, size, size);
  // planks
  for (let i = 0; i < 6; i++) {
    const y = i * (size / 6);
    ctx.fillStyle = `rgb(${140 + rnd() * 30},${95 + rnd() * 20},${55 + rnd() * 15})`;
    ctx.fillRect(0, y + 2, size, size / 6 - 4);
    ctx.strokeStyle = 'rgba(60,35,15,0.25)';
    for (let k = 0; k < 6; k++) {
      ctx.beginPath();
      const yy = y + 4 + rnd() * (size / 6 - 8);
      ctx.moveTo(0, yy);
      ctx.bezierCurveTo(size * 0.3, yy + rnd() * 4 - 2, size * 0.6, yy + rnd() * 4 - 2, size, yy);
      ctx.stroke();
    }
  }
  // frame
  ctx.fillStyle = '#6e4622';
  const f = 22;
  ctx.fillRect(0, 0, size, f); ctx.fillRect(0, size - f, size, f);
  ctx.fillRect(0, 0, f, size); ctx.fillRect(size - f, 0, f, size);
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-size * 0.7, -f / 2, size * 1.4, f);
  ctx.restore();
  // nails
  ctx.fillStyle = '#3b3b3b';
  for (const [x, y] of [[11, 11], [size - 11, 11], [11, size - 11], [size - 11, size - 11]]) {
    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
  }
  speckle(ctx, size, rnd, 1500, 0.05, 0.2, '255,230,190', '40,20,5', 1.5);
  return toTexture(c, false);
}

export function metalTexture() {
  const size = 256;
  const [c, ctx] = canvas(size);
  const rnd = seededRandom(19);
  ctx.fillStyle = '#5b6b5a';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.05)';
    ctx.fillRect(i * 32, 0, 32, size);
  }
  blotches(ctx, size, rnd, 20, '120,70,30', 0.25, 8, 30); // rust
  speckle(ctx, size, rnd, 2000, 0.05, 0.2, '220,230,220', '20,20,20', 1.5);
  return toTexture(c);
}

export function concreteTexture() {
  const size = 256;
  const [c, ctx] = canvas(size);
  const rnd = seededRandom(23);
  ctx.fillStyle = '#8d8a82';
  ctx.fillRect(0, 0, size, size);
  blotches(ctx, size, rnd, 25, '60,58,55', 0.15, 20, 60);
  speckle(ctx, size, rnd, 4000, 0.05, 0.2, '230,230,225', '30,30,30', 1.5);
  return toTexture(c);
}

export function siteDecalTexture(letter, color = '#e8d36a') {
  const size = 512;
  const [c, ctx] = canvas(size);
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 18;
  ctx.strokeRect(14, 14, size - 28, size - 28);
  // hazard stripes along border
  ctx.save();
  ctx.beginPath();
  ctx.rect(30, 30, size - 60, size - 60);
  ctx.rect(70, 70, size - 140, size - 140);
  ctx.clip('evenodd');
  ctx.fillStyle = color;
  for (let i = -size; i < size * 2; i += 46) {
    ctx.beginPath();
    ctx.moveTo(i, 0); ctx.lineTo(i + 22, 0); ctx.lineTo(i + 22 - size, size); ctx.lineTo(i - size, size);
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = color;
  ctx.font = 'bold 300px Impact, Arial Black, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, size / 2, size / 2 + 12);
  const t = toTexture(c, false);
  return t;
}

export function wallSignTexture(text, arrow) {
  const w = 512, h = 256;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(30,30,30,0.75)';
  ctx.font = 'bold 150px Impact, Arial Black, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2 - (arrow ? 60 : 0), h / 2);
  if (arrow) {
    ctx.save();
    ctx.translate(w - 110, h / 2);
    ctx.rotate(arrow === 'left' ? Math.PI : arrow === 'up' ? -Math.PI / 2 : arrow === 'down' ? Math.PI / 2 : 0);
    ctx.beginPath();
    ctx.moveTo(-60, -20); ctx.lineTo(10, -20); ctx.lineTo(10, -50); ctx.lineTo(70, 0);
    ctx.lineTo(10, 50); ctx.lineTo(10, 20); ctx.lineTo(-60, 20); ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  return toTexture(c, false);
}

export function softCircleTexture() {
  const size = 128;
  const [c, ctx] = canvas(size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  return t;
}

export function flashTexture() {
  const size = 128;
  const [c, ctx] = canvas(size);
  ctx.translate(size / 2, size / 2);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, size / 2);
  g.addColorStop(0, 'rgba(255,255,230,1)');
  g.addColorStop(0.25, 'rgba(255,210,120,0.9)');
  g.addColorStop(1, 'rgba(255,120,20,0)');
  ctx.fillStyle = g;
  for (let i = 0; i < 6; i++) {
    ctx.rotate(Math.PI / 3);
    ctx.beginPath();
    ctx.moveTo(0, -6); ctx.lineTo(size / 2, 0); ctx.lineTo(0, 6); ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath(); ctx.arc(0, 0, size * 0.22, 0, Math.PI * 2); ctx.fill();
  return new THREE.CanvasTexture(c);
}

export function decalTexture() {
  const size = 64;
  const [c, ctx] = canvas(size);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
  g.addColorStop(0, 'rgba(10,8,6,1)');
  g.addColorStop(0.35, 'rgba(30,25,20,0.9)');
  g.addColorStop(1, 'rgba(40,30,20,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

export function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 512;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#3d74b8');
  g.addColorStop(0.45, '#8fb8e0');
  g.addColorStop(0.5, '#e8dcc0');
  g.addColorStop(1, '#c8b48c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 16, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.mapping = THREE.EquirectangularReflectionMapping;
  return t;
}

// Toy-block style brick texture (bevelled rectangles), tinted by material color.
export function blockTexture(base = '#ffffff', w = 64, h = 32) {
  const size = 256;
  const [c, ctx] = canvas(size);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += h) {
    const off = (y / h) % 2 ? w / 2 : 0;
    for (let x = -w; x < size + w; x += w) {
      const bx = x + off;
      const g = ctx.createLinearGradient(bx, y, bx, y + h);
      g.addColorStop(0, 'rgba(255,255,255,0.35)');
      g.addColorStop(0.15, 'rgba(255,255,255,0.05)');
      g.addColorStop(0.85, 'rgba(0,0,0,0.05)');
      g.addColorStop(1, 'rgba(0,0,0,0.3)');
      ctx.fillStyle = g;
      ctx.fillRect(bx + 1, y + 1, w - 2, h - 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx + 1, y + 1, w - 2, h - 2);
    }
  }
  return toTexture(c);
}

export function tileTexture(base = '#3a5fd0') {
  const size = 256;
  const [c, ctx] = canvas(size);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const n = 4, t = size / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const g = ctx.createLinearGradient(i * t, j * t, i * t + t, j * t + t);
    g.addColorStop(0, 'rgba(255,255,255,0.18)');
    g.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = g;
    ctx.fillRect(i * t + 3, j * t + 3, t - 6, t - 6);
  }
  return toTexture(c);
}

export function cobbleTexture() {
  const size = 512;
  const [c, ctx] = canvas(size);
  const rnd = seededRandom(31);
  ctx.fillStyle = '#8a7a60';
  ctx.fillRect(0, 0, size, size);
  const rows = 10, h = size / rows;
  for (let r = 0; r < rows; r++) {
    let x = (r % 2) * -20;
    while (x < size) {
      const w = 34 + rnd() * 30;
      const shade = 140 + rnd() * 50;
      ctx.fillStyle = `rgb(${shade},${shade * 0.9},${shade * 0.72})`;
      ctx.beginPath();
      const rr = 8;
      const x0 = x + 2, y0 = r * h + 2, x1 = x + w - 2, y1 = (r + 1) * h - 2;
      ctx.moveTo(x0 + rr, y0); ctx.lineTo(x1 - rr, y0); ctx.quadraticCurveTo(x1, y0, x1, y0 + rr);
      ctx.lineTo(x1, y1 - rr); ctx.quadraticCurveTo(x1, y1, x1 - rr, y1); ctx.lineTo(x0 + rr, y1);
      ctx.quadraticCurveTo(x0, y1, x0, y1 - rr); ctx.lineTo(x0, y0 + rr); ctx.quadraticCurveTo(x0, y0, x0 + rr, y0);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(x0 + 3, y0 + 2, w - 10, 4);
      x += w;
    }
  }
  speckle(ctx, size, rnd, 4000, 0.05, 0.2, '255,240,210', '60,45,30', 1.6);
  blotches(ctx, size, rnd, 20, '200,170,120', 0.25, 30, 90);
  return toTexture(c);
}

export function doorTexture() {
  const w = 128, h = 256;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const rnd = seededRandom(41);
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = `rgb(${95 + rnd() * 25},${60 + rnd() * 15},${35 + rnd() * 10})`;
    ctx.fillRect(i * (w / 5), 0, w / 5 - 2, h);
  }
  ctx.fillStyle = 'rgba(30,18,8,0.6)';
  for (let i = 0; i < 5; i++) ctx.fillRect(i * (w / 5) + w / 5 - 2, 0, 2, h);
  ctx.fillStyle = '#3a2a1c';
  ctx.fillRect(0, 30, w, 14); ctx.fillRect(0, h - 44, w, 14);
  ctx.fillStyle = '#222';
  for (const y of [37, h - 37]) for (let x = 8; x < w; x += 20) { ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#5b5040';
  ctx.beginPath(); ctx.arc(w - 22, h / 2, 6, 0, Math.PI * 2); ctx.fill();
  speckle(ctx, w, rnd, 800, 0.05, 0.25, '255,230,200', '20,10,0', 1.5);
  return toTexture(c, false);
}

export function shutterTexture(color = '#3f6f7a') {
  const w = 64, h = 128;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  for (let y = 6; y < h - 6; y += 8) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(4, y + 5, w - 8, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(4, y, w - 8, 2);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, w - 4, h - 4);
  const rnd = seededRandom(5);
  speckle(ctx, w, rnd, 400, 0.05, 0.3, '240,230,210', '30,20,10', 1.5);
  return toTexture(c, false);
}

export function sandbagTexture() {
  const size = 128;
  const [c, ctx] = canvas(size);
  const rnd = seededRandom(51);
  ctx.fillStyle = '#a89470';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < size; i += 3) { ctx.fillStyle = `rgba(80,60,40,${0.05 + rnd() * 0.08})`; ctx.fillRect(0, i, size, 1); ctx.fillRect(i, 0, 1, size); }
  speckle(ctx, size, rnd, 600, 0.05, 0.2, '230,215,180', '60,45,30', 1.5);
  return toTexture(c);
}

// Equirectangular sky with a warm horizon haze, a sun and soft clouds.
export function cloudySkyTexture(sunU = 0.3, sunV = 0.3) {
  const W = 2048, H = 1024;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#2f66ad');
  g.addColorStop(0.3, '#5f93cf');
  g.addColorStop(0.47, '#b9d2e6');
  g.addColorStop(0.5, '#ead9b8');
  g.addColorStop(0.56, '#cdb68c');
  g.addColorStop(1, '#a88e62');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // sun glow
  const sx = sunU * W, sy = sunV * H;
  const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 300);
  sg.addColorStop(0, 'rgba(255,250,230,1)');
  sg.addColorStop(0.05, 'rgba(255,245,210,0.95)');
  sg.addColorStop(0.2, 'rgba(255,230,180,0.35)');
  sg.addColorStop(1, 'rgba(255,220,170,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, W, H);
  // clouds: clusters of soft blobs, flattened near the horizon
  const rnd = seededRandom(77);
  for (let k = 0; k < 38; k++) {
    const cx = rnd() * W, cy = H * (0.12 + rnd() * 0.33);
    const flat = 0.35 + (cy / H) * 0.6;
    const n = 6 + Math.floor(rnd() * 10);
    for (let i = 0; i < n; i++) {
      const x = cx + (rnd() - 0.5) * 220, y = cy + (rnd() - 0.5) * 40 * flat;
      const r = 30 + rnd() * 70;
      for (const ox of [-W, 0, W]) {
        const cg = ctx.createRadialGradient(x + ox, y, 0, x + ox, y, r);
        cg.addColorStop(0, 'rgba(255,255,255,0.55)');
        cg.addColorStop(0.6, 'rgba(250,250,252,0.25)');
        cg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = cg;
        ctx.save();
        ctx.translate(x + ox, y); ctx.scale(1, flat); ctx.translate(-(x + ox), -y);
        ctx.fillRect(x + ox - r, y - r, r * 2, r * 2);
        ctx.restore();
      }
    }
  }
  // distant hills on the horizon
  ctx.fillStyle = 'rgba(160,140,110,0.7)';
  ctx.beginPath();
  ctx.moveTo(0, H * 0.5);
  for (let x = 0; x <= W; x += 16) ctx.lineTo(x, H * 0.5 - 14 - Math.abs(Math.sin(x * 0.004) * 30 + Math.sin(x * 0.013) * 10));
  ctx.lineTo(W, H * 0.5); ctx.closePath(); ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.mapping = THREE.EquirectangularReflectionMapping;
  return t;
}
