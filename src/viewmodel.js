// First-person weapon + arms, rendered in its own scene on top of the world.
import * as THREE from 'three';
import { buildWeaponModel, mat } from './models.js';
import { clamp } from './util.js';

const PLACEMENT = {
  knife: { pos: [0.17, -0.17, -0.38], rot: [0.15, 0.25, -0.35] },
  pistol: { pos: [0.15, -0.16, -0.46], rot: [0, 0.04, 0] },
  smg: { pos: [0.18, -0.19, -0.5], rot: [0, 0.04, 0] },
  shotgun: { pos: [0.2, -0.21, -0.55], rot: [0, 0.04, 0] },
  rifle: { pos: [0.2, -0.21, -0.58], rot: [0, 0.04, 0] },
  sniper: { pos: [0.21, -0.23, -0.6], rot: [0, 0.04, 0] },
  grenade: { pos: [0.16, -0.16, -0.38], rot: [0, 0, 0] },
  bomb: { pos: [0.02, -0.24, -0.45], rot: [0.5, 0, 0] },
};

export class ViewModel {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.01, 10);
    this.scene.add(new THREE.HemisphereLight(0xfff4e0, 0x8a7a60, 2.6));
    const d = new THREE.DirectionalLight(0xffffff, 2.6);
    d.position.set(0.5, 1, 0.3);
    this.scene.add(d);
    const fill = new THREE.DirectionalLight(0xc8d8ff, 1.2);
    fill.position.set(-1, 0.3, 1);
    this.scene.add(fill);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.holder = new THREE.Group();
    this.root.add(this.holder);
    this.gun = null;
    this.defId = null;
    this.team = 'G';
    this.kick = 0; this.kickScale = 1;
    this.drawT = 0;
    this.reloadT = 0; this.reloadDur = 1;
    this.slashT = 0; this.slashAlt = false;
    this.throwT = 0;
    this.swayX = 0; this.swayY = 0;
    this.bobPhase = 0; this.bobAmt = 0;
    this.visible = true;
  }

  resize(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  setTeam(team) {
    if (team !== this.team) { this.team = team; const id = this.defId; this.defId = null; if (id) this.setWeapon(this._def); }
  }

  setWeapon(def) {
    if (!def) { if (this.gun) this.holder.remove(this.gun); this.gun = null; this.defId = null; return; }
    if (this.defId === def.id) return;
    this._def = def;
    if (this.gun) this.holder.remove(this.gun);
    this.defId = def.id;
    const g = buildWeaponModel(def.model);
    this.addArms(g);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
    this.gun = g;
    this.holder.add(g);
    const p = PLACEMENT[def.type] || PLACEMENT.rifle;
    this.place = p;
    this.drawT = 1;
    this.reloadT = 0;
  }

  addArms(g) {
    const sleeve = mat(this.team === 'R' ? 0x8b7a55 : 0x2c3b52, 0.85);
    const glove = mat(this.team === 'R' ? 0x2b2420 : 0x1a1a1a, 0.8);
    const mk = (name, elbow) => {
      const a = g.getObjectByName(name);
      if (!a) return;
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.085, 0.1), glove);
      hand.position.copy(a.position);
      g.add(hand);
      const from = a.position.clone();
      const to = from.clone().add(new THREE.Vector3(...elbow));
      const len = from.distanceTo(to);
      const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.048, len, 8), sleeve);
      fore.position.copy(from).add(to).multiplyScalar(0.5);
      fore.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
      g.add(fore);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 8), glove);
      cuff.position.copy(from).lerp(to, 0.12);
      cuff.quaternion.copy(fore.quaternion);
      g.add(cuff);
    };
    mk('handR', [0.1, -0.22, 0.42]);
    mk('handL', [-0.2, -0.2, 0.32]);
  }

  fire(scale = 1) { this.kick = 1; this.kickScale = scale; }
  reload(dur) { this.reloadT = 1e-4; this.reloadDur = dur; }
  cancelReload() { this.reloadT = 0; }
  draw() { this.drawT = 1; }
  slash(alt) { this.slashT = 1e-4; this.slashAlt = alt; }
  throwAnim() { this.throwT = 1e-4; }

  update(dt, st) {
    if (!this.gun) return;
    this.root.visible = this.visible && !st.scoped;
    const p = this.place;
    // decay timers
    this.kick = Math.max(0, this.kick - dt * 9);
    this.drawT = Math.max(0, this.drawT - dt / 0.45);
    if (this.reloadT > 0) { this.reloadT += dt / this.reloadDur; if (this.reloadT >= 1) this.reloadT = 0; }
    if (this.slashT > 0) { this.slashT += dt / (this.slashAlt ? 0.55 : 0.32); if (this.slashT >= 1) this.slashT = 0; }
    if (this.throwT > 0) { this.throwT += dt / 0.4; if (this.throwT >= 1) this.throwT = 0; }
    // sway
    this.swayX = clamp(this.swayX * Math.pow(0.002, dt) - st.dx * 0.00025, -0.05, 0.05);
    this.swayY = clamp(this.swayY * Math.pow(0.002, dt) + st.dy * 0.00025, -0.05, 0.05);
    // bob
    const moving = st.onGround ? clamp(st.speed / 6, 0, 1) : 0;
    this.bobAmt += (moving - this.bobAmt) * Math.min(1, dt * 8);
    this.bobPhase += dt * (4 + st.speed * 1.4);
    const bx = Math.sin(this.bobPhase) * 0.012 * this.bobAmt;
    const by = -Math.abs(Math.cos(this.bobPhase)) * 0.012 * this.bobAmt;

    let x = p.pos[0] + bx + this.swayX, y = p.pos[1] + by + this.swayY - st.crouch * 0.01, z = p.pos[2];
    let rx = p.rot[0], ry = p.rot[1], rz = p.rot[2];
    // landing / air
    if (!st.onGround) y += 0.015;
    // kick
    const k = this.kick * this.kick;
    z += 0.05 * k * this.kickScale;
    rx += 0.09 * k * this.kickScale;
    // draw
    const d = this.drawT * this.drawT;
    y -= 0.25 * d; rx -= 0.8 * d;
    // reload
    if (this.reloadT > 0) {
      const s = Math.sin(Math.PI * this.reloadT);
      y -= 0.09 * s; rz += 0.55 * s; rx += 0.25 * s; x -= 0.03 * s;
    }
    // knife slash
    if (this.slashT > 0) {
      const t = this.slashT;
      const s = Math.sin(Math.PI * t);
      if (this.slashAlt) { rx -= 1.1 * s; z -= 0.12 * s; y += 0.06 * s; }
      else { ry += (1.4 * t - 0.7) * s * 1.4; x -= 0.12 * s; z -= 0.08 * s; rz -= 0.6 * s; }
    }
    if (this.throwT > 0) {
      const s = Math.sin(Math.PI * this.throwT);
      z -= 0.25 * s; y += 0.12 * s; rx -= 0.8 * s;
    }
    this.holder.position.set(x, y, z);
    this.holder.rotation.set(rx, ry, rz);
  }

  muzzleWorld(mainCamera, out) {
    const m = this.gun && this.gun.getObjectByName('muzzle');
    if (!m) return null;
    this.root.updateMatrixWorld(true);
    m.getWorldPosition(out);
    // vm camera sits at origin looking down -Z: treat out as camera-space position.
    out.multiplyScalar(1);
    return mainCamera.localToWorld(out);
  }
}
