// Visual effects: tracers, impact decals, particles, muzzle flashes, smoke, explosions.
import * as THREE from 'three';
import * as TEX from './textures.js';
import { rand } from './util.js';

const MAX_PARTICLES = 900;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);

    // Tracers
    this.tracers = [];
    const trGeo = new THREE.BoxGeometry(0.012, 0.012, 1);
    trGeo.translate(0, 0, -0.5);
    this.trMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < 40; i++) {
      const m = new THREE.Mesh(trGeo, this.trMat.clone());
      m.visible = false;
      this.group.add(m);
      this.tracers.push({ mesh: m, life: 0 });
    }
    this.trIdx = 0;

    // Decals
    this.decalGeo = new THREE.PlaneGeometry(0.12, 0.12);
    this.decalMat = new THREE.MeshBasicMaterial({ map: TEX.decalTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    this.decals = [];
    this.decalIdx = 0;
    for (let i = 0; i < 150; i++) {
      const m = new THREE.Mesh(this.decalGeo, this.decalMat);
      m.visible = false;
      this.group.add(m);
      this.decals.push(m);
    }
    // blood decals
    this.bloodMat = new THREE.MeshBasicMaterial({ color: 0x5a0a08, map: TEX.softCircleTexture(), transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });

    // Particles
    this.pPos = new Float32Array(MAX_PARTICLES * 3);
    this.pCol = new Float32Array(MAX_PARTICLES * 3);
    this.pVel = new Float32Array(MAX_PARTICLES * 3);
    this.pLife = new Float32Array(MAX_PARTICLES);
    this.pGrav = new Float32Array(MAX_PARTICLES);
    this.pIdx = 0;
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    pg.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3));
    this.points = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.06, vertexColors: true, map: TEX.softCircleTexture(), transparent: true, depthWrite: false }));
    this.points.frustumCulled = false;
    this.group.add(this.points);
    for (let i = 0; i < MAX_PARTICLES; i++) this.pPos[i * 3 + 1] = -1000;

    // Flashes
    this.flashTex = TEX.flashTexture();
    this.flashes = [];
    for (let i = 0; i < 12; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.flashTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      s.visible = false;
      this.group.add(s);
      this.flashes.push({ s, life: 0 });
    }
    this.flashIdx = 0;
    this.light = new THREE.PointLight(0xffc070, 0, 12, 2);
    this.group.add(this.light);
    this.lightLife = 0;

    // Smokes / explosions
    this.smokeTex = TEX.softCircleTexture();
    this.smokes = [];
    this.blasts = [];
  }

  clear() {
    for (const d of this.decals) d.visible = false;
    for (const s of this.smokes) this.group.remove(s.group);
    this.smokes = [];
    for (const b of this.blasts) this.group.remove(b.s);
    this.blasts = [];
    for (let i = 0; i < MAX_PARTICLES; i++) { this.pLife[i] = 0; this.pPos[i * 3 + 1] = -1000; }
    this.points.geometry.attributes.position.needsUpdate = true;
  }

  tracer(from, to) {
    const t = this.tracers[this.trIdx++ % this.tracers.length];
    const len = from.distanceTo(to);
    if (len < 1) return;
    t.mesh.position.copy(from);
    t.mesh.lookAt(to);
    t.mesh.scale.set(1, 1, Math.min(len, 6));
    t.speed = 220;
    t.dir = to.clone().sub(from).normalize();
    t.remain = len;
    t.mesh.visible = true;
    t.life = len / 220 + 0.02;
    t.mesh.material.opacity = 0.75;
  }

  decal(point, normal, blood = false) {
    const m = this.decals[this.decalIdx++ % this.decals.length];
    m.material = blood ? this.bloodMat : this.decalMat;
    m.position.set(point.x + normal.x * 0.01, point.y + normal.y * 0.01, point.z + normal.z * 0.01);
    m.lookAt(point.x + normal.x, point.y + normal.y, point.z + normal.z);
    m.rotateZ(Math.random() * Math.PI * 2);
    const sc = blood ? rand(3, 6) : rand(0.8, 1.2);
    m.scale.set(sc, sc, sc);
    m.visible = true;
  }

  particles(pos, count, color, speed, life, grav = 9, spread = 1, dir = null) {
    for (let k = 0; k < count; k++) {
      const i = this.pIdx++ % MAX_PARTICLES;
      this.pPos[i * 3] = pos.x; this.pPos[i * 3 + 1] = pos.y; this.pPos[i * 3 + 2] = pos.z;
      let vx = rand(-1, 1) * spread, vy = rand(-0.2, 1) * spread, vz = rand(-1, 1) * spread;
      if (dir) { vx += dir.x; vy += dir.y; vz += dir.z; }
      const sp = speed * rand(0.4, 1);
      this.pVel[i * 3] = vx * sp; this.pVel[i * 3 + 1] = vy * sp; this.pVel[i * 3 + 2] = vz * sp;
      const cv = rand(0.8, 1.1);
      this.pCol[i * 3] = color[0] * cv; this.pCol[i * 3 + 1] = color[1] * cv; this.pCol[i * 3 + 2] = color[2] * cv;
      this.pLife[i] = life * rand(0.6, 1.2);
      this.pGrav[i] = grav;
    }
  }

  impact(point, normal, material = 'wall') {
    this.decal(point, normal);
    const col = material === 'prop' ? [0.55, 0.38, 0.2] : [0.78, 0.68, 0.5];
    this.particles(point, 8, col, 3, 0.45, 9, 0.6, normal);
    this.particles(point, 2, [1, 0.85, 0.5], 5, 0.12, 0, 0.8, normal);
  }

  blood(point, dir) {
    this.particles(point, 14, [0.55, 0.03, 0.03], 2.5, 0.5, 9, 0.7, dir);
  }

  muzzle(pos, big = 1) {
    const f = this.flashes[this.flashIdx++ % this.flashes.length];
    f.s.position.copy(pos);
    f.s.scale.setScalar(0.35 * big);
    f.s.material.rotation = Math.random() * Math.PI;
    f.s.visible = true;
    f.life = 0.05;
    this.light.position.copy(pos);
    this.light.intensity = 6 * big;
    this.lightLife = 0.06;
  }

  smoke(pos, duration) {
    const group = new THREE.Group();
    group.position.copy(pos);
    const puffs = [];
    for (let i = 0; i < 26; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.smokeTex, color: new THREE.Color().setHSL(0, 0, rand(0.62, 0.78)), transparent: true, opacity: 0, depthWrite: false }));
      const off = new THREE.Vector3(rand(-1, 1), rand(0, 1), rand(-1, 1)).normalize().multiplyScalar(rand(0.4, 2.6));
      off.y = Math.abs(off.y) * 0.8 + 0.6;
      s.userData.off = off;
      s.userData.size = rand(2.4, 3.6);
      group.add(s);
      puffs.push(s);
    }
    this.group.add(group);
    const smoke = { group, puffs, pos: pos.clone().add(new THREE.Vector3(0, 1.4, 0)), t: 0, duration, radius: 0 };
    this.smokes.push(smoke);
    return smoke;
  }

  explosion(pos, scale = 1) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.flashTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: 0xffb060 }));
    s.position.copy(pos);
    this.group.add(s);
    this.blasts.push({ s, t: 0, scale });
    this.particles(pos, 60 * scale, [1, 0.6, 0.2], 9 * scale, 0.7, 4, 1);
    this.particles(pos, 40 * scale, [0.25, 0.22, 0.2], 4 * scale, 1.6, -0.5, 1);
    this.light.position.copy(pos);
    this.light.intensity = 40 * scale;
    this.light.distance = 25 * scale;
    this.lightLife = 0.35;
  }

  // Is the segment a->b blocked by any smoke cloud?
  smokeBlocks(a, b) {
    for (const s of this.smokes) {
      if (s.radius < 1) continue;
      const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
      const len2 = abx * abx + aby * aby + abz * abz;
      let t = ((s.pos.x - a.x) * abx + (s.pos.y - a.y) * aby + (s.pos.z - a.z) * abz) / len2;
      t = Math.max(0, Math.min(1, t));
      const dx = a.x + abx * t - s.pos.x, dy = a.y + aby * t - s.pos.y, dz = a.z + abz * t - s.pos.z;
      if (dx * dx + dy * dy * 2 + dz * dz < s.radius * s.radius) return true;
    }
    return false;
  }

  update(dt) {
    for (const t of this.tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      const adv = t.speed * dt;
      t.mesh.position.addScaledVector(t.dir, adv);
      t.remain -= adv;
      if (t.life <= 0 || t.remain <= 0) t.mesh.visible = false;
      else t.mesh.scale.z = Math.min(6, t.remain);
    }
    for (const f of this.flashes) {
      if (f.life <= 0) continue;
      f.life -= dt;
      if (f.life <= 0) f.s.visible = false;
    }
    if (this.lightLife > 0) {
      this.lightLife -= dt;
      this.light.intensity *= Math.pow(0.0005, dt);
      if (this.lightLife <= 0) { this.light.intensity = 0; this.light.distance = 12; }
    }
    // particles
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.pLife[i] <= 0) continue;
      this.pLife[i] -= dt;
      if (this.pLife[i] <= 0) { this.pPos[i * 3 + 1] = -1000; continue; }
      this.pVel[i * 3 + 1] -= this.pGrav[i] * dt;
      this.pPos[i * 3] += this.pVel[i * 3] * dt;
      this.pPos[i * 3 + 1] += this.pVel[i * 3 + 1] * dt;
      this.pPos[i * 3 + 2] += this.pVel[i * 3 + 2] * dt;
      if (this.pPos[i * 3 + 1] < 0.01) { this.pPos[i * 3 + 1] = 0.01; this.pVel[i * 3 + 1] *= -0.3; this.pVel[i * 3] *= 0.6; this.pVel[i * 3 + 2] *= 0.6; }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
    // smokes
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const s = this.smokes[i];
      s.t += dt;
      const grow = Math.min(1, s.t / 1.6);
      const fade = s.t > s.duration - 2.5 ? Math.max(0, (s.duration - s.t) / 2.5) : 1;
      s.radius = 4.2 * grow * (fade > 0.3 ? 1 : fade / 0.3);
      for (const p of s.puffs) {
        p.position.copy(p.userData.off).multiplyScalar(0.3 + grow * 0.9);
        p.position.y += Math.sin(s.t * 0.5 + p.userData.size) * 0.1;
        const sz = p.userData.size * (0.4 + grow * 0.8);
        p.scale.set(sz, sz, sz);
        p.material.opacity = 0.92 * grow * fade;
        p.material.rotation += dt * 0.05;
      }
      if (s.t >= s.duration) { this.group.remove(s.group); this.smokes.splice(i, 1); }
    }
    for (let i = this.blasts.length - 1; i >= 0; i--) {
      const b = this.blasts[i];
      b.t += dt;
      const k = b.t / 0.45;
      b.s.scale.setScalar((2 + k * 8) * b.scale);
      b.s.material.opacity = Math.max(0, 1 - k);
      if (k >= 1) { this.group.remove(b.s); this.blasts.splice(i, 1); }
    }
  }
}
