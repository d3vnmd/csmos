// First-person weapon + gloved hands, rendered in its own scene on top of the world.
import * as THREE from 'three';
import { buildWeaponModel, mat } from './models.js';
import { clamp } from './util.js';

const PLACEMENT = {
  knife: { pos: [0.16, -0.16, -0.34], rot: [0.12, 0.3, -0.45] },
  pistol: { pos: [0.13, -0.15, -0.42], rot: [0, 0.05, 0] },
  smg: { pos: [0.16, -0.18, -0.45], rot: [0, 0.05, 0] },
  shotgun: { pos: [0.17, -0.19, -0.5], rot: [0, 0.05, 0] },
  rifle: { pos: [0.17, -0.19, -0.52], rot: [0, 0.05, 0] },
  sniper: { pos: [0.18, -0.2, -0.52], rot: [0, 0.05, 0] },
  grenade: { pos: [0.15, -0.15, -0.34], rot: [0.1, 0, 0] },
  bomb: { pos: [0.0, -0.22, -0.42], rot: [0.55, 0, 0] },
};

const tmpA = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);

function limb(from, to, r, m) {
  const len = from.distanceTo(to);
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, len), 4, 10), m);
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(Y, tmpA.copy(to).sub(from).normalize());
  return mesh;
}

export class ViewModel {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.01, 10);
    this.scene.add(new THREE.HemisphereLight(0xfff4e0, 0x6e604a, 2.2));
    const key = new THREE.DirectionalLight(0xfff2dc, 3.0);
    key.position.set(0.6, 1, 0.4);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xbcd4ff, 1.4);
    rim.position.set(-1, 0.4, -0.6);
    this.scene.add(rim);
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
    this.inspectT = 0;
    this.swayX = 0; this.swayY = 0;
    this.bobPhase = 0; this.bobAmt = 0;
    this.visible = true;
  }

  resize(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  setTeam(team) {
    if (team !== this.team) {
      this.team = team;
      const def = this._def;
      this.defId = null;
      if (def) this.setWeapon(def);
    }
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
    this.place = PLACEMENT[def.type] || PLACEMENT.rifle;
    this.drawT = 1;
    this.reloadT = 0;
    this.inspectT = 0;
  }

  addArms(g) {
    const R = this.team === 'R';
    const sleeve = mat(R ? 0x7e7050 : 0x2b3a50, 0.9);
    const cuffM = mat(R ? 0x5a5040 : 0x1d2735, 0.9);
    const glove = mat(R ? 0x3a3128 : 0x2e3034, 0.78);
    const knuckle = mat(R ? 0x2a231c : 0x101112, 0.6);
    const watch = mat(0x15171a, 0.35, 0.6);

    const build = (name, elbow) => {
      const a = g.getObjectByName(name);
      if (!a) return;
      const hold = a.userData || {};
      const side = hold.side || (name === 'handL' ? -1 : 1);
      const hand = new THREE.Group();
      hand.position.copy(a.position);
      g.add(hand);
      const sz = hold.small ? 0.85 : 1;
      if (hold.type === 'wrap') {
        // fingers curl under a horizontal tube (handguard / pump / knife handle)
        const r = hold.r || 0.033;
        const cy = hold.dy || 0;
        for (let i = 0; i < 4; i++) {
          const f = new THREE.Mesh(new THREE.TorusGeometry(r + 0.004, 0.0095 * sz, 6, 12, Math.PI * 1.05), glove);
          f.rotation.z = name === 'handL' ? Math.PI * 0.95 : -Math.PI * 0.05;
          f.position.set(0, cy, -0.03 + i * 0.021);
          hand.add(f);
          const k = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), knuckle);
          k.position.set(side * -(r + 0.004), cy, -0.03 + i * 0.021);
          hand.add(k);
        }
        const palm = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.07, 0.09), glove);
        palm.position.set(side * (r + 0.01), cy - 0.005, 0.0);
        palm.rotation.z = side * 0.3;
        hand.add(palm);
        const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.0095, 0.04, 4, 8), glove);
        thumb.rotation.x = Math.PI / 2;
        thumb.position.set(side * (r * 0.6), cy + r * 0.8, -0.02);
        hand.add(thumb);
      } else {
        // fist around a vertical grip, raked back by `slant`
        hand.rotation.x = -(hold.slant || 0);
        const gx = 0.017 * sz;
        for (let i = 0; i < 4; i++) {
          const f = new THREE.Mesh(new THREE.TorusGeometry(0.021 * sz, 0.0095 * sz, 6, 12, Math.PI * 1.1), glove);
          f.rotation.x = -Math.PI / 2;
          f.rotation.z = side > 0 ? -0.05 : Math.PI + 0.05;
          f.position.set(0, (0.018 - i * 0.022) * sz, 0.002);
          hand.add(f);
        }
        const palm = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.09 * sz, 0.07 * sz), glove);
        palm.position.set(side * (gx + 0.012), -0.01, 0.012);
        hand.add(palm);
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.07 * sz, 0.012), knuckle);
        back.position.set(side * (gx + 0.024), -0.005, 0.014);
        hand.add(back);
        if (!hold.support) {
          const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.0095, 0.038, 4, 8), glove);
          thumb.rotation.x = Math.PI / 2 - 0.3;
          thumb.position.set(-side * 0.014, 0.03, -0.006);
          hand.add(thumb);
        }
      }
      // forearm: wrist -> elbow (in weapon space)
      const wrist = a.position.clone().add(new THREE.Vector3(side * 0.03, -0.012, 0.04));
      const el = wrist.clone().add(new THREE.Vector3(...elbow));
      g.add(limb(wrist, el, 0.036, sleeve));
      g.add(limb(wrist, wrist.clone().lerp(el, 0.12), 0.039, cuffM));
      g.add(limb(a.position.clone().add(new THREE.Vector3(side * 0.025, -0.006, 0.015)), wrist, 0.034, glove));
      if (name === 'handL') g.add(limb(wrist.clone().lerp(el, 0.06), wrist.clone().lerp(el, 0.1), 0.044, watch));
    };
    build('handR', [0.07, -0.26, 0.36]);
    build('handL', [-0.1, -0.3, 0.2]);
  }

  fire(scale = 1) { this.kick = 1; this.kickScale = scale; this.inspectT = 0; }
  reload(dur) { this.reloadT = 1e-4; this.reloadDur = dur; this.inspectT = 0; }
  cancelReload() { this.reloadT = 0; }
  draw() { this.drawT = 1; this.inspectT = 0; }
  slash(alt) { this.slashT = 1e-4; this.slashAlt = alt; this.inspectT = 0; }
  throwAnim() { this.throwT = 1e-4; }
  inspect() { if (this.drawT <= 0 && this.reloadT <= 0) this.inspectT = 1e-4; }

  update(dt, st) {
    if (!this.gun) return;
    this.root.visible = this.visible && !st.scoped;
    const p = this.place;
    this.kick = Math.max(0, this.kick - dt * 9);
    this.drawT = Math.max(0, this.drawT - dt / 0.5);
    if (this.reloadT > 0) { this.reloadT += dt / this.reloadDur; if (this.reloadT >= 1) this.reloadT = 0; }
    if (this.slashT > 0) { this.slashT += dt / (this.slashAlt ? 0.55 : 0.32); if (this.slashT >= 1) this.slashT = 0; }
    if (this.throwT > 0) { this.throwT += dt / 0.4; if (this.throwT >= 1) this.throwT = 0; }
    if (this.inspectT > 0) { this.inspectT += dt / 4.2; if (this.inspectT >= 1 || st.speed > 5.5) this.inspectT = 0; }
    this.swayX = clamp(this.swayX * Math.pow(0.0015, dt) - st.dx * 0.00022, -0.04, 0.04);
    this.swayY = clamp(this.swayY * Math.pow(0.0015, dt) + st.dy * 0.00022, -0.04, 0.04);
    const moving = st.onGround ? clamp(st.speed / 6, 0, 1) : 0;
    this.bobAmt += (moving - this.bobAmt) * Math.min(1, dt * 8);
    this.bobPhase += dt * (3 + st.speed * 1.25);
    const bx = Math.sin(this.bobPhase) * 0.01 * this.bobAmt;
    const by = -Math.abs(Math.cos(this.bobPhase)) * 0.009 * this.bobAmt;

    let x = p.pos[0] + bx + this.swayX, y = p.pos[1] + by + this.swayY - st.crouch * 0.008, z = p.pos[2];
    let rx = p.rot[0], ry = p.rot[1] + this.swayX * 0.6, rz = p.rot[2] + bx * 1.5;
    if (!st.onGround) { y += 0.012; rx += 0.03; }
    const k = this.kick * this.kick;
    z += 0.045 * k * this.kickScale;
    rx += 0.08 * k * this.kickScale;
    const d = this.drawT * this.drawT;
    y -= 0.22 * d; rx -= 0.7 * d; rz += 0.3 * d;
    if (this.reloadT > 0) {
      const t = this.reloadT;
      const s = Math.sin(Math.PI * t);
      const tilt = Math.sin(Math.PI * Math.min(1, t * 1.4));
      y -= 0.07 * s; rz += 0.6 * tilt; rx += 0.22 * s; x -= 0.04 * s;
      if (t > 0.55 && t < 0.62) y += 0.012;
    }
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
    if (this.inspectT > 0) {
      const t = this.inspectT;
      const ease = (a) => a * a * (3 - 2 * a);
      const inA = ease(clamp(t / 0.2, 0, 1));
      const flip = ease(clamp((t - 0.45) / 0.2, 0, 1));
      const out = ease(clamp((t - 0.85) / 0.15, 0, 1));
      const amt = inA * (1 - out);
      ry += amt * (0.9 - flip * 1.6);
      rz += amt * (0.5 - flip * 0.9);
      rx += amt * 0.15;
      x -= amt * 0.08;
      y += amt * 0.03;
      z += amt * 0.05;
    }
    this.holder.position.set(x, y, z);
    this.holder.rotation.set(rx, ry, rz);
  }

  anchorWorld(name, mainCamera, out) {
    const m = this.gun && this.gun.getObjectByName(name);
    if (!m) return null;
    this.root.updateMatrixWorld(true);
    m.getWorldPosition(out);
    return mainCamera.localToWorld(out);
  }

  muzzleWorld(mainCamera, out) { return this.anchorWorld('muzzle', mainCamera, out); }
}
