// Main-menu 3D backdrop: an original agent standing in a sunlit street.
import * as THREE from 'three';
import { buildAgent, poseAgent, buildWeaponModel } from './models.js';
import * as TEX from './textures.js';

export class Lobby {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
    const sc = this.scene;
    sc.background = TEX.cloudySkyTexture(0.9, 0.18);
    sc.fog = new THREE.Fog(0xe6dcc6, 12, 55);
    sc.add(new THREE.HemisphereLight(0xeef2ff, 0x8a7350, 1.3));
    const sun = new THREE.DirectionalLight(0xfff0d6, 2.8);
    sun.position.set(-6, 12, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
    sc.add(sun);

    // street
    const sand = TEX.sandTexture();
    sand.repeat.set(6, 10);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 60), new THREE.MeshStandardMaterial({ map: sand, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    sc.add(floor);
    const plaster = TEX.plasterTexture('#e3d2ae', 9);
    const plaster2 = TEX.plasterTexture('#cdb48a', 5);
    const mkWall = (x, z, w, h, d, tex) => {
      const t = tex.clone();
      t.needsUpdate = true;
      t.repeat.set(w / 4, h / 4);
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }));
      m.position.set(x, h / 2, z);
      m.castShadow = m.receiveShadow = true;
      sc.add(m);
      return m;
    };
    mkWall(-7, -10, 4, 9, 16, plaster);
    mkWall(7.5, -12, 4, 11, 20, plaster2);
    mkWall(-6.5, -26, 6, 7, 10, plaster2);
    mkWall(6, -30, 6, 9, 10, plaster);
    mkWall(0, -40, 30, 10, 2, plaster);
    // awning + crates
    const crate = TEX.crateTexture();
    for (const [x, z, s] of [[-3.6, -3, 1.1], [-3.6, -4.2, 1.1], [-3.6, -3.6, 0]]) {
      if (!s) continue;
      const c = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), new THREE.MeshStandardMaterial({ map: crate }));
      c.position.set(x, s / 2, z);
      c.rotation.y = 0.2;
      c.castShadow = c.receiveShadow = true;
      sc.add(c);
    }
    const sign = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 0.1), new THREE.MeshStandardMaterial({ color: 0xe08a2a, roughness: 0.5 }));
    sign.position.set(5.4, 3.4, -4);
    sign.rotation.y = -Math.PI / 2;
    sc.add(sign);

    this.agent = null;
    this.team = 'G';
    this.setTeam('G');
    this.t = 0;
  }

  setEnvironment(renderer) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.scene.environment = pmrem.fromEquirectangular(this.scene.background).texture;
    this.scene.environmentIntensity = 0.4;
    pmrem.dispose();
  }

  setTeam(team) {
    if (this.agent) this.scene.remove(this.agent);
    this.team = team;
    const a = buildAgent(team);
    a.position.set(0, 0, 0);
    a.rotation.y = Math.PI + 0.35;
    const gun = buildWeaponModel(team === 'R' ? 'rifle_a' : 'rifle_b');
    a.userData.parts.mount.add(gun);
    this.scene.add(a);
    this.agent = a;
  }

  resize(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    this.t += dt;
    poseAgent(this.agent, { walkPhase: 0, speed: 0, crouch: 0, pitch: -0.25 + Math.sin(this.t * 0.8) * 0.02 });
    const p = this.agent.userData.parts;
    p.torso.rotation.y = Math.sin(this.t * 0.6) * 0.04;
    p.head.rotation.y = Math.sin(this.t * 0.35) * 0.25;
    p.hips.position.y += Math.sin(this.t * 1.6) * 0.006;
    const ang = Math.sin(this.t * 0.12) * 0.12;
    this.camera.position.set(Math.sin(ang) * 6.2 + 0.4, 1.35, Math.cos(ang) * 6.2);
    this.camera.lookAt(0.4, 1.05, 0);
  }
}
