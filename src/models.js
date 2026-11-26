// Procedural low-poly models: weapons, agents and the demo charge.
// Every model is built from primitives here; no external meshes.
import * as THREE from 'three';

const matCache = new Map();
export function mat(color, rough = 0.6, metal = 0.2, extra = {}) {
  const key = `${color}|${rough}|${metal}|${JSON.stringify(extra)}`;
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra }));
  }
  return matCache.get(key);
}

function box(w, h, d, m, x = 0, y = 0, z = 0, parent) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  if (parent) parent.add(mesh);
  return mesh;
}
function cyl(rt, rb, h, m, x = 0, y = 0, z = 0, parent, axis = 'z', seg = 12) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  if (axis === 'z') mesh.rotation.x = Math.PI / 2;
  if (axis === 'x') mesh.rotation.z = Math.PI / 2;
  mesh.position.set(x, y, z);
  if (parent) parent.add(mesh);
  return mesh;
}
function anchor(name, x, y, z, parent) {
  const o = new THREE.Object3D();
  o.name = name;
  o.position.set(x, y, z);
  parent.add(o);
  return o;
}

// Palette
const C = {
  black: mat(0x1d1f22, 0.45, 0.6),
  gun: mat(0x2b2e33, 0.4, 0.7),
  gunLight: mat(0x464b52, 0.45, 0.6),
  polymer: mat(0x26282b, 0.75, 0.05),
  tan: mat(0xb39a6b, 0.7, 0.05),
  wood: mat(0x7a4a26, 0.6, 0.05),
  olive: mat(0x56603f, 0.65, 0.15),
  od: mat(0x3d4532, 0.6, 0.2),
  steel: mat(0xb8bcc2, 0.25, 0.95),
  brass: mat(0xb08a3a, 0.35, 0.8),
  orange: mat(0xd86a1c, 0.5, 0.1),
  red: mat(0xc0281e, 0.5, 0.1),
  glass: mat(0x203040, 0.1, 0.9, { emissive: 0x0a1520 }),
};

// ---------------------------------------------------------------------------
// Weapons. Convention: barrel points to -Z, origin roughly at the trigger.
// Anchors: muzzle, handR (grip), handL (support hand).
// ---------------------------------------------------------------------------
export function buildWeaponModel(model) {
  const g = new THREE.Group();
  switch (model) {
    case 'knife': {
      box(0.028, 0.034, 0.12, C.polymer, 0, 0, 0.02, g);              // handle
      box(0.03, 0.036, 0.02, C.black, 0, 0, 0.085, g);                 // pommel
      box(0.06, 0.014, 0.014, C.steel, 0, 0, -0.045, g);               // guard
      const blade = box(0.006, 0.034, 0.16, C.steel, 0, 0.004, -0.13, g);
      blade.scale.set(1, 1, 1);
      const tip = box(0.006, 0.024, 0.05, C.steel, 0, 0.012, -0.215, g);
      tip.rotation.x = -0.45;
      box(0.0065, 0.006, 0.15, C.black, 0, 0.018, -0.13, g);           // spine
      anchor('handR', 0, 0, 0.02, g);
      anchor('muzzle', 0, 0, -0.25, g);
      break;
    }
    case 'pistol_a':
    case 'pistol_b':
    case 'pistol_heavy': {
      const heavy = model === 'pistol_heavy';
      const L = heavy ? 0.26 : 0.19;
      const slideM = model === 'pistol_a' ? C.gunLight : model === 'pistol_heavy' ? C.steel : C.black;
      box(0.032, 0.036, L, slideM, 0, 0.045, -L / 2 + 0.04, g);       // slide
      box(0.028, 0.02, L * 0.85, C.polymer, 0, 0.018, -L / 2 + 0.05, g); // frame
      const grip = box(0.03, 0.11, 0.045, model === 'pistol_a' ? C.tan : C.polymer, 0, -0.04, 0.03, g);
      grip.rotation.x = 0.22;
      box(0.004, 0.025, 0.035, C.black, 0, -0.003, -0.01, g);          // trigger guard
      box(0.006, 0.01, 0.01, C.black, 0, 0.068, -L + 0.06, g);         // front sight
      box(0.02, 0.01, 0.01, C.black, 0, 0.068, 0.05, g);               // rear sight
      if (heavy) cyl(0.012, 0.012, 0.03, C.black, 0, 0.045, -L + 0.03, g);
      anchor('handR', 0, -0.035, 0.035, g);
      anchor('handL', 0.0, -0.05, 0.02, g);
      anchor('muzzle', 0, 0.045, -L + 0.03, g);
      break;
    }
    case 'smg': {
      box(0.045, 0.07, 0.3, C.polymer, 0, 0.03, -0.08, g);           // body
      box(0.035, 0.03, 0.12, C.gun, 0, 0.075, -0.1, g);              // top rail
      cyl(0.013, 0.013, 0.1, C.black, 0, 0.04, -0.27, g);            // barrel
      box(0.03, 0.15, 0.035, C.black, 0, -0.07, -0.08, g);           // straight mag
      const grip = box(0.032, 0.1, 0.04, C.polymer, 0, -0.04, 0.04, g);
      grip.rotation.x = 0.25;
      box(0.025, 0.05, 0.16, C.gun, 0, 0.02, 0.15, g);               // folded stock
      box(0.04, 0.03, 0.04, C.olive, 0, 0.1, -0.03, g);              // red-dot body
      anchor('handR', 0, -0.03, 0.045, g);
      anchor('handL', 0, -0.06, -0.08, g);
      anchor('muzzle', 0, 0.04, -0.32, g);
      break;
    }
    case 'shotgun': {
      cyl(0.017, 0.017, 0.55, C.gun, 0, 0.05, -0.32, g);             // barrel
      cyl(0.015, 0.015, 0.42, C.black, 0, 0.018, -0.26, g);          // mag tube
      box(0.05, 0.075, 0.24, C.gun, 0, 0.035, -0.01, g);             // receiver
      box(0.055, 0.05, 0.14, C.wood, 0, 0.018, -0.3, g);             // pump
      const stock = box(0.045, 0.08, 0.28, C.wood, 0, -0.005, 0.24, g);
      stock.rotation.x = 0.12;
      const grip = box(0.035, 0.09, 0.04, C.wood, 0, -0.04, 0.08, g);
      grip.rotation.x = 0.35;
      anchor('handR', 0, -0.035, 0.08, g);
      anchor('handL', 0, -0.01, -0.3, g);
      anchor('muzzle', 0, 0.05, -0.6, g);
      break;
    }
    case 'rifle_a': { // Vanguard: wood furniture, curved mag
      box(0.048, 0.07, 0.36, C.gun, 0, 0.03, -0.05, g);              // receiver
      box(0.052, 0.06, 0.22, C.wood, 0, 0.03, -0.32, g);             // handguard
      cyl(0.012, 0.012, 0.28, C.black, 0, 0.05, -0.53, g);           // barrel
      box(0.012, 0.04, 0.012, C.black, 0, 0.08, -0.6, g);            // front sight
      cyl(0.02, 0.02, 0.05, C.black, 0, 0.05, -0.68, g);             // brake
      const m1 = box(0.03, 0.1, 0.05, C.orange, 0, -0.04, -0.12, g);
      m1.rotation.x = -0.1;
      const m2 = box(0.03, 0.1, 0.05, C.orange, 0, -0.12, -0.15, g);
      m2.rotation.x = -0.35;
      const grip = box(0.034, 0.1, 0.04, C.wood, 0, -0.045, 0.07, g);
      grip.rotation.x = 0.3;
      const stock = box(0.04, 0.08, 0.3, C.wood, 0, 0.005, 0.27, g);
      stock.rotation.x = 0.1;
      box(0.03, 0.02, 0.2, C.gunLight, 0, 0.075, -0.02, g);         // dust cover
      anchor('handR', 0, -0.04, 0.07, g);
      anchor('handL', 0, 0.0, -0.32, g);
      anchor('muzzle', 0, 0.05, -0.71, g);
      break;
    }
    case 'rifle_b': { // Sentinel: black, rail handguard, carry rail
      box(0.046, 0.07, 0.34, C.black, 0, 0.03, -0.04, g);
      box(0.05, 0.062, 0.26, C.gun, 0, 0.032, -0.33, g);             // rail handguard
      for (let i = 0; i < 6; i++) box(0.055, 0.006, 0.02, C.black, 0, 0.064, -0.22 - i * 0.04, g);
      cyl(0.011, 0.011, 0.24, C.black, 0, 0.04, -0.57, g);
      box(0.03, 0.03, 0.06, C.black, 0, 0.04, -0.69, g);             // suppressor-ish brake
      box(0.026, 0.13, 0.045, C.black, 0, -0.06, -0.1, g);           // mag
      box(0.03, 0.03, 0.22, C.gunLight, 0, 0.08, -0.06, g);          // top rail
      cyl(0.018, 0.018, 0.09, C.black, 0, 0.11, -0.05, g);           // optic tube
      const grip = box(0.032, 0.1, 0.04, C.polymer, 0, -0.045, 0.07, g);
      grip.rotation.x = 0.3;
      box(0.012, 0.012, 0.16, C.black, 0, 0.03, 0.2, g);             // buffer tube
      box(0.04, 0.09, 0.12, C.polymer, 0, 0.0, 0.3, g);              // stock
      anchor('handR', 0, -0.04, 0.07, g);
      anchor('handL', 0, 0.0, -0.33, g);
      anchor('muzzle', 0, 0.04, -0.72, g);
      break;
    }
    case 'rifle_c': { // Ranger: tan polymer bullpup-ish
      box(0.05, 0.09, 0.5, C.tan, 0, 0.02, 0.0, g);
      cyl(0.012, 0.012, 0.22, C.black, 0, 0.04, -0.35, g);
      box(0.028, 0.11, 0.045, C.black, 0, -0.06, 0.14, g);          // mag behind grip
      const grip = box(0.032, 0.1, 0.04, C.polymer, 0, -0.06, -0.06, g);
      grip.rotation.x = 0.25;
      box(0.03, 0.04, 0.14, C.black, 0, 0.09, -0.04, g);             // carry optic
      anchor('handR', 0, -0.055, -0.06, g);
      anchor('handL', 0, -0.01, -0.2, g);
      anchor('muzzle', 0, 0.04, -0.47, g);
      break;
    }
    case 'sniper': {
      box(0.05, 0.075, 0.38, C.od, 0, 0.02, -0.08, g);               // chassis
      cyl(0.016, 0.014, 0.6, C.black, 0, 0.045, -0.56, g);           // barrel
      cyl(0.024, 0.024, 0.06, C.black, 0, 0.045, -0.88, g);          // brake
      cyl(0.03, 0.03, 0.3, C.black, 0, 0.12, -0.07, g);              // scope body
      cyl(0.038, 0.03, 0.06, C.black, 0, 0.12, -0.24, g);            // objective
      cyl(0.034, 0.03, 0.05, C.black, 0, 0.12, 0.1, g);              // ocular
      cyl(0.016, 0.016, 0.03, C.black, 0, 0.16, -0.07, g, 'y');      // turret
      box(0.02, 0.04, 0.02, C.black, 0, 0.08, -0.15, g);             // rings
      box(0.02, 0.04, 0.02, C.black, 0, 0.08, 0.0, g);
      const bolt = cyl(0.008, 0.008, 0.07, C.steel, 0.045, 0.04, 0.05, g, 'x');
      bolt.rotation.y = 0.3;
      const grip = box(0.034, 0.1, 0.045, C.od, 0, -0.05, 0.12, g);
      grip.rotation.x = 0.35;
      box(0.045, 0.1, 0.3, C.od, 0, -0.005, 0.34, g);                // thumbhole stock
      box(0.05, 0.03, 0.12, C.black, 0, 0.055, 0.38, g);             // cheek rest
      box(0.026, 0.07, 0.05, C.black, 0, -0.04, -0.05, g);           // mag
      anchor('handR', 0, -0.045, 0.12, g);
      anchor('handL', 0, -0.02, -0.28, g);
      anchor('muzzle', 0, 0.045, -0.91, g);
      break;
    }
    case 'frag': {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 10), C.od);
      body.scale.set(1, 1.2, 1);
      g.add(body);
      cyl(0.014, 0.014, 0.03, C.gunLight, 0, 0.045, 0, g, 'y');
      const lever = box(0.012, 0.07, 0.008, C.gunLight, 0.022, 0.02, 0, g);
      lever.rotation.z = -0.25;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.003, 6, 12), C.steel);
      ring.position.set(-0.015, 0.06, 0);
      g.add(ring);
      anchor('handR', 0, 0, 0, g);
      anchor('muzzle', 0, 0, 0, g);
      break;
    }
    case 'smokegren': {
      cyl(0.03, 0.03, 0.11, mat(0x6f7478, 0.6, 0.3), 0, 0, 0, g, 'y');
      cyl(0.031, 0.031, 0.02, mat(0xd8d8d0, 0.5, 0.1), 0, 0.02, 0, g, 'y');
      cyl(0.012, 0.012, 0.025, C.gunLight, 0, 0.065, 0, g, 'y');
      const lever = box(0.012, 0.08, 0.008, C.gunLight, 0.032, 0.02, 0, g);
      lever.rotation.z = -0.1;
      anchor('handR', 0, 0, 0, g);
      anchor('muzzle', 0, 0, 0, g);
      break;
    }
    case 'bomb': {
      const b = buildCharge();
      b.scale.setScalar(0.85);
      b.rotation.y = Math.PI / 2;
      g.add(b);
      anchor('handR', 0.0, -0.02, 0.06, g);
      anchor('handL', 0.0, -0.02, -0.06, g);
      anchor('muzzle', 0, 0, 0, g);
      break;
    }
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// Demo charge: battery pack + keypad + LED.
export function buildCharge() {
  const g = new THREE.Group();
  const pack = mat(0x9b8a60, 0.7, 0.05);
  for (let i = 0; i < 3; i++) box(0.07, 0.07, 0.22, pack, -0.07 + i * 0.07, 0.035, 0, g);
  box(0.22, 0.012, 0.18, C.black, 0, 0.076, 0, g);
  box(0.1, 0.02, 0.11, mat(0x2a2d30, 0.5, 0.4), 0.02, 0.09, -0.01, g);
  const screen = box(0.07, 0.004, 0.03, mat(0x103010, 0.3, 0, { emissive: 0x22aa33, emissiveIntensity: 0.6 }), 0.02, 0.101, -0.04, g);
  screen.name = 'screen';
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    box(0.014, 0.006, 0.014, mat(0x888888, 0.5, 0.3), 0.0 + i * 0.02, 0.102, 0.0 + j * 0.02, g);
  }
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff0000, emissiveIntensity: 1 }));
  led.position.set(-0.07, 0.1, 0.05);
  led.name = 'led';
  g.add(led);
  // wires
  const wireM = [mat(0xcc2222, 0.5), mat(0x2244cc, 0.5), mat(0xddcc22, 0.5)];
  wireM.forEach((m, i) => {
    const w = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.004, 4, 12, Math.PI), m);
    w.position.set(-0.05 + i * 0.03, 0.08, 0.09);
    w.rotation.y = Math.PI / 2;
    g.add(w);
  });
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------
const TEAM_STYLE = {
  R: { // Raiders: desert irregulars
    shirt: 0x8b7a55, pants: 0x5a4a35, vest: 0x4d4a3a, skin: 0xc49a74,
    head: 'wrap', headColor: 0x7a2a22, glove: 0x2b2420, boot: 0x3a2a1c, accent: 0xb5452a,
  },
  G: { // Guardians: response unit
    shirt: 0x2c3b52, pants: 0x3a4150, vest: 0x1f2a38, skin: 0xd2a98a,
    head: 'helmet', headColor: 0x1e2630, glove: 0x1a1a1a, boot: 0x1b1b1b, accent: 0x3a8ad8,
  },
};

export function buildAgent(team, variant = 0) {
  const s = TEAM_STYLE[team];
  const root = new THREE.Group();
  const body = new THREE.Group(); // everything that bends with crouch
  root.add(body);
  const shirt = mat(s.shirt, 0.85), pants = mat(s.pants, 0.85), vest = mat(s.vest, 0.7, 0.1);
  const skin = mat(s.skin, 0.7), glove = mat(s.glove, 0.8), boot = mat(s.boot, 0.8);
  const accent = mat(s.accent, 0.6);

  const parts = {};
  // hips
  const hips = new THREE.Group();
  hips.position.y = 0.92;
  body.add(hips);
  parts.hips = hips;
  box(0.36, 0.16, 0.22, pants, 0, 0, 0, hips);
  box(0.38, 0.05, 0.24, mat(0x2a2218, 0.7), 0, 0.07, 0, hips); // belt
  // torso
  const torso = new THREE.Group();
  torso.position.y = 0.08;
  hips.add(torso);
  parts.torso = torso;
  box(0.4, 0.5, 0.24, shirt, 0, 0.26, 0, torso);
  box(0.42, 0.36, 0.28, vest, 0, 0.3, 0, torso);          // plate carrier
  for (let i = 0; i < 3; i++) box(0.08, 0.1, 0.05, vest, -0.12 + i * 0.12, 0.2, -0.16, torso); // pouches
  box(0.1, 0.03, 0.01, accent, 0.12, 0.42, -0.145, torso);  // team patch
  // head
  const neck = new THREE.Group();
  neck.position.y = 0.52;
  torso.add(neck);
  parts.neck = neck;
  box(0.1, 0.08, 0.1, skin, 0, 0.03, 0, neck);
  const head = new THREE.Group();
  head.position.y = 0.16;
  neck.add(head);
  parts.head = head;
  box(0.2, 0.24, 0.22, skin, 0, 0, 0, head);
  if (s.head === 'helmet') {
    box(0.24, 0.12, 0.26, mat(s.headColor, 0.5, 0.2), 0, 0.1, 0.01, head);
    box(0.25, 0.04, 0.27, mat(s.headColor, 0.5, 0.2), 0, 0.05, 0.01, head);
    box(0.2, 0.07, 0.02, mat(0x101418, 0.1, 0.8, { emissive: 0x0b1a2a }), 0, 0.02, -0.115, head); // visor
    box(0.18, 0.1, 0.03, mat(0x2a2f36, 0.7), 0, -0.07, -0.11, head); // face guard
    box(0.04, 0.05, 0.04, mat(0x3a3a3a, 0.5, 0.5), 0.13, 0.08, -0.02, head); // headset
  } else {
    box(0.22, 0.14, 0.24, mat(s.headColor, 0.9), 0, -0.05, 0, head); // face wrap
    box(0.22, 0.1, 0.24, mat(0x3b352b, 0.9), 0, 0.09, 0, head);      // cap
    box(0.22, 0.03, 0.1, mat(0x3b352b, 0.9), 0, 0.05, -0.15, head);  // brim
    box(0.18, 0.05, 0.02, mat(0x0d0d0d, 0.2, 0.6), 0, 0.02, -0.115, head); // goggles
  }
  // arms (pivot at shoulder)
  function arm(side) {
    const sh = new THREE.Group();
    sh.position.set(side * 0.25, 0.46, 0);
    torso.add(sh);
    box(0.11, 0.3, 0.12, shirt, 0, -0.14, 0, sh);
    const el = new THREE.Group();
    el.position.y = -0.29;
    sh.add(el);
    box(0.1, 0.28, 0.1, shirt, 0, -0.13, 0, el);
    box(0.09, 0.1, 0.1, glove, 0, -0.3, 0, el);
    return { sh, el };
  }
  parts.armR = arm(1);
  parts.armL = arm(-1);
  // legs (pivot at hip)
  function leg(side) {
    const hp = new THREE.Group();
    hp.position.set(side * 0.1, -0.05, 0);
    hips.add(hp);
    box(0.15, 0.44, 0.17, pants, 0, -0.22, 0, hp);
    box(0.16, 0.08, 0.06, mat(0x2a2a2a, 0.6), 0, -0.36, -0.09, hp); // knee pad
    const kn = new THREE.Group();
    kn.position.y = -0.44;
    hp.add(kn);
    box(0.13, 0.4, 0.15, pants, 0, -0.2, 0, kn);
    box(0.14, 0.1, 0.24, boot, 0, -0.4, -0.04, kn);
    return { hp, kn };
  }
  parts.legR = leg(1);
  parts.legL = leg(-1);
  // weapon mount: in front of chest
  const mount = new THREE.Group();
  mount.position.set(0.08, 0.32, -0.28);
  torso.add(mount);
  parts.mount = mount;

  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  root.userData.parts = parts;
  return root;
}

// Pose the agent model. state: {walkPhase, speed, crouch, pitch, dead, deadT}
export function poseAgent(model, st) {
  const p = model.userData.parts;
  const swing = Math.sin(st.walkPhase) * Math.min(1, st.speed / 4) * 0.6;
  const c = st.crouch;
  p.hips.position.y = 0.92 - c * 0.38;
  p.legR.hp.rotation.x = swing - c * 1.1;
  p.legL.hp.rotation.x = -swing - c * 1.1;
  p.legR.kn.rotation.x = Math.max(0, -swing) * 0.8 + c * 1.9;
  p.legL.kn.rotation.x = Math.max(0, swing) * 0.8 + c * 1.9;
  p.torso.rotation.x = c * 0.35;
  // arms hold the weapon forward and follow aim pitch
  const aim = st.pitch * 0.8;
  p.armR.sh.rotation.x = 1.25 + aim;
  p.armR.sh.rotation.z = -0.12;
  p.armR.el.rotation.x = 0.35;
  p.armL.sh.rotation.x = 1.35 + aim;
  p.armL.sh.rotation.z = 0.55;
  p.armL.sh.rotation.y = 0.2;
  p.armL.el.rotation.x = 0.25;
  p.mount.rotation.x = aim;
  p.mount.position.y = 0.32 + aim * 0.12;
  p.neck.rotation.x = -st.pitch * 0.6;
}
