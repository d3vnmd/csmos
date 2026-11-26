// Procedural models: weapons (extruded side profiles with bevels), agents and the demo charge.
// Everything here is an original design built from code; no external meshes.
import * as THREE from 'three';

const matCache = new Map();
export function mat(color, rough = 0.6, metal = 0.2, extra = {}) {
  const key = `${color}|${rough}|${metal}|${JSON.stringify(extra)}`;
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra }));
  }
  return matCache.get(key);
}

// ---------------------------------------------------------------------------
// Weapon construction helpers.
// Profiles are drawn in (u, v): u = forward along the barrel, v = up.
// The finished mesh maps u -> -Z (barrel points down -Z), v -> Y, width -> X.
// ---------------------------------------------------------------------------
function shapeFrom(pts) {
  const s = new THREE.Shape();
  let first = true;
  for (const p of pts) {
    if (p[0] === 'q') s.quadraticCurveTo(p[1], p[2], p[3], p[4]);
    else if (p[0] === 'c') s.bezierCurveTo(p[1], p[2], p[3], p[4], p[5], p[6]);
    else if (first) { s.moveTo(p[0], p[1]); first = false; }
    else s.lineTo(p[0], p[1]);
  }
  return s;
}

function prof(g, pts, width, m, opts = {}) {
  const shape = shapeFrom(pts);
  for (const h of opts.holes || []) {
    const path = new THREE.Path();
    h.forEach((p, i) => (i ? path.lineTo(p[0], p[1]) : path.moveTo(p[0], p[1])));
    shape.holes.push(path);
  }
  const bev = opts.bevel !== undefined ? opts.bevel : Math.min(0.003, width * 0.22);
  const depth = Math.max(0.0005, width - bev * 2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, curveSegments: 10,
  });
  geo.translate(0, 0, -depth / 2);
  geo.rotateY(Math.PI / 2);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.x = opts.x || 0;
  g.add(mesh);
  return mesh;
}

// Cylinder along the barrel axis from u0 to u1 at height v.
function tube(g, u0, u1, v, r0, m, opts = {}) {
  const r1 = opts.r1 !== undefined ? opts.r1 : r0;
  const geo = new THREE.CylinderGeometry(r1, r0, Math.abs(u1 - u0), opts.seg || 18, 1, !!opts.open);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(opts.x || 0, v, -(u0 + u1) / 2);
  if (opts.rot) mesh.rotation.z = opts.rot;
  g.add(mesh);
  return mesh;
}

// Axis-aligned box in (u, v) space.
function blk(g, u0, u1, v0, v1, w, m, x = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, v1 - v0, u1 - u0), m);
  mesh.position.set(x, (v0 + v1) / 2, -(u0 + u1) / 2);
  g.add(mesh);
  return mesh;
}

function rail(g, u0, u1, v, w, m) {
  blk(g, u0, u1, v, v + 0.006, w, m);
  for (let u = u0 + 0.004; u < u1 - 0.004; u += 0.01) blk(g, u, u + 0.005, v + 0.006, v + 0.011, w * 1.15, m);
}

function screw(g, u, v, x, m, r = 0.003) {
  const s = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.002, 10), m);
  s.rotation.z = Math.PI / 2;
  s.position.set(x, v, -u);
  g.add(s);
}

// Hand anchors carry how the hand holds that spot:
//   grip  - fist around a (near) vertical grip, slant = grip rake in radians
//   wrap  - fingers wrapped under a horizontal handguard of radius r, centered dy above the anchor
function anchor(g, name, u, v, x = 0, hold = null) {
  const o = new THREE.Object3D();
  o.name = name;
  o.position.set(x, v, -u);
  o.userData = hold || (name === 'handR' ? { type: 'grip', slant: 0.27 } : name === 'handL' ? { type: 'wrap', r: 0.033, dy: 0.032 } : {});
  g.add(o);
  return o;
}

function lens(g, u, v, r, faceBack = false) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 24),
    new THREE.MeshStandardMaterial({ color: 0x0a1a2a, roughness: 0.05, metalness: 1, emissive: 0x06121e }));
  m.position.set(0, v, -u);
  if (!faceBack) m.rotation.y = Math.PI;
  g.add(m);
}

// Palette
const M = {
  park: mat(0x24272b, 0.38, 0.75),          // parkerized steel
  black: mat(0x17191c, 0.5, 0.45),
  poly: mat(0x1f2124, 0.82, 0.04),          // polymer
  polyTan: mat(0xa8916a, 0.8, 0.03),
  polyOd: mat(0x4a5139, 0.78, 0.05),
  steel: mat(0xb9bec4, 0.22, 0.95),
  steelDark: mat(0x5d6268, 0.3, 0.9),
  blued: mat(0x2c3138, 0.28, 0.85),
  wood: mat(0x7b4524, 0.55, 0.02),
  woodLight: mat(0x9a5d30, 0.5, 0.02),
  bakelite: mat(0x8a3a17, 0.4, 0.05),
  rubber: mat(0x111214, 0.95, 0),
  brass: mat(0xc49a45, 0.3, 0.9),
  red: mat(0xb3261e, 0.5, 0.1),
  glass: new THREE.MeshStandardMaterial({ color: 0x88bbdd, roughness: 0.02, metalness: 0.2, transparent: true, opacity: 0.25 }),
  dot: new THREE.MeshBasicMaterial({ color: 0xff2a1a }),
  hole: mat(0x050505, 1, 0),
};

// ---------------------------------------------------------------------------
// Weapons
// ---------------------------------------------------------------------------
function buildPistol(g, o) {
  const L = o.len;               // slide front u
  const B = -0.058;              // slide back
  // slide
  prof(g, [[B, 0.016], [L, 0.016], [L, 0.043], [L - 0.012, 0.053], [B + 0.006, 0.053], [B, 0.047]], 0.028, o.slide);
  for (let i = 0; i < 7; i++) {
    const u = B + 0.006 + i * 0.005;
    blk(g, u, u + 0.0022, 0.022, 0.05, 0.0295, o.slideDark || M.black);
  }
  blk(g, 0.02, 0.06, 0.04, 0.0535, 0.012, M.hole, 0.004);                 // ejection port
  blk(g, L - 0.014, L - 0.007, 0.053, 0.061, 0.004, M.black);              // front sight
  blk(g, B + 0.003, B + 0.012, 0.053, 0.06, 0.006, M.black, -0.007);        // rear sight
  blk(g, B + 0.003, B + 0.012, 0.053, 0.06, 0.006, M.black, 0.007);
  tube(g, L - 0.001, L + 0.001, 0.034, 0.0075, M.hole);
  // frame + dust cover rail
  prof(g, [[B + 0.004, 0.017], [L - 0.008, 0.017], [L - 0.008, 0.004], [0.05, 0.002], [0.03, 0.0], [-0.012, 0.0], [B + 0.004, 0.006]], 0.026, o.frame);
  for (let i = 0; i < 3; i++) blk(g, 0.07 + i * 0.012, 0.076 + i * 0.012, 0.0, 0.004, 0.027, M.black);
  // grip
  prof(g, [[0.004, 0.001], [-0.022, -0.1], [-0.063, -0.097], [-0.054, 0.004], [-0.067, 0.014], [-0.056, 0.02], [-0.03, 0.016]], 0.031, o.grip);
  prof(g, [[-0.012, -0.012], [-0.03, -0.085], [-0.055, -0.083], [-0.048, -0.01]], 0.0335, o.gripPanel || M.poly, { bevel: 0.001 });
  blk(g, -0.064, -0.02, -0.106, -0.096, 0.03, M.black);                     // mag base
  // trigger guard + trigger
  prof(g, [[0.0, 0.002], [0.05, 0.002], [0.052, -0.012], [0.042, -0.028], [0.006, -0.03], [-0.008, -0.02]], 0.012, o.frame,
    { holes: [[[0.004, -0.004], [0.04, -0.004], [0.036, -0.022], [0.008, -0.023], [0.0, -0.016]]], bevel: 0.0015 });
  prof(g, [[0.016, 0.0], [0.022, 0.0], [0.02, -0.012], [0.012, -0.02], [0.012, -0.016], [0.016, -0.008]], 0.006, M.black, { bevel: 0.001 });
  // slide stop + takedown
  blk(g, -0.02, 0.02, 0.012, 0.018, 0.004, M.black, -0.0145);
  if (o.heavy) {
    tube(g, L - 0.04, L + 0.004, 0.034, 0.0105, M.steelDark);
    for (let i = 0; i < 3; i++) blk(g, L - 0.035 + i * 0.01, L - 0.03 + i * 0.01, 0.045, 0.054, 0.016, M.hole);
  }
  anchor(g, 'handR', -0.032, -0.048);
  anchor(g, 'handL', -0.03, -0.07, -0.014, { type: 'grip', slant: 0.27, side: -1, support: true });
  anchor(g, 'muzzle', L + 0.01, 0.034);
  anchor(g, 'eject', 0.04, 0.05, 0.01);
}

function buildVanguard(g) {
  // stamped receiver
  prof(g, [[-0.1, 0.0], [0.2, 0.0], [0.2, 0.058], [0.186, 0.07], [-0.082, 0.07], [-0.1, 0.056]], 0.044, M.park);
  prof(g, [[-0.08, 0.068], [0.17, 0.068], [0.18, 0.076], [0.17, 0.083], [-0.06, 0.083], [-0.085, 0.076]], 0.04, M.blued, { bevel: 0.004 });
  for (let i = 0; i < 5; i++) blk(g, -0.04 + i * 0.045, -0.034 + i * 0.045, 0.082, 0.085, 0.03, M.park);
  for (const [u, v] of [[-0.07, 0.02], [0.17, 0.02], [0.17, 0.05], [-0.07, 0.05], [0.04, 0.01]]) { screw(g, u, v, 0.0225, M.steelDark); screw(g, u, v, -0.0225, M.steelDark); }
  blk(g, 0.09, 0.14, 0.038, 0.058, 0.004, M.hole, 0.022);                  // ejection port
  tube(g, 0.13, 0.135, 0.05, 0.006, M.steel, { x: 0.036, rot: Math.PI / 2 });
  blk(g, 0.12, 0.16, 0.045, 0.055, 0.012, M.steel, 0.028);                 // charging handle
  prof(g, [[-0.04, 0.03], [0.06, 0.022], [0.06, 0.03], [-0.04, 0.038]], 0.003, M.steelDark, { x: 0.0235, bevel: 0.0005 }); // selector
  // rear sight
  prof(g, [[0.2, 0.07], [0.235, 0.07], [0.235, 0.083], [0.2, 0.09]], 0.026, M.park);
  // handguards
  prof(g, [[0.2, 0.004], [0.41, 0.01], [0.425, 0.03], [0.415, 0.058], [0.2, 0.06]], 0.05, M.wood, { bevel: 0.006 });
  for (let i = 0; i < 3; i++) blk(g, 0.26 + i * 0.04, 0.275 + i * 0.04, 0.012, 0.04, 0.051, M.hole);
  prof(g, [[0.23, 0.06], [0.39, 0.062], [0.4, 0.074], [0.39, 0.088], [0.235, 0.088], [0.225, 0.074]], 0.034, M.woodLight, { bevel: 0.006 });
  tube(g, 0.2, 0.47, 0.075, 0.009, M.park);                                 // gas tube
  tube(g, 0.2, 0.67, 0.04, 0.0085, M.blued);                                // barrel
  prof(g, [[0.43, 0.03], [0.47, 0.03], [0.47, 0.088], [0.445, 0.088], [0.43, 0.07]], 0.03, M.park);  // gas block
  prof(g, [[0.57, 0.03], [0.61, 0.03], [0.605, 0.1], [0.595, 0.11], [0.585, 0.1], [0.575, 0.06]], 0.024, M.park);
  tube(g, 0.592, 0.6, 0.103, 0.011, M.park, { rot: Math.PI / 2 });
  tube(g, 0.64, 0.71, 0.04, 0.014, M.park, { seg: 12 });                   // brake
  blk(g, 0.66, 0.7, 0.05, 0.055, 0.03, M.hole);
  tube(g, 0.709, 0.712, 0.04, 0.007, M.hole);
  // magazine (curved)
  prof(g, [[0.058, 0.004], [0.135, 0.004], ['q', 0.152, -0.11, 0.218, -0.196], [0.158, -0.218], ['q', 0.09, -0.12, 0.058, 0.004]], 0.03, M.bakelite, { bevel: 0.004 });
  for (let i = 0; i < 4; i++) {
    const t = 0.25 + i * 0.18;
    const u = 0.098 + t * t * 0.08, v = -0.215 * t;
    const r = blk(g, u - 0.002, u + 0.002, v - 0.025, v + 0.025, 0.0315, mat(0x6e2c10, 0.45, 0.05));
    r.rotation.x = -0.25 - t * 0.7;
  }
  // grip
  prof(g, [[-0.002, 0.0], [-0.026, -0.098], [-0.068, -0.098], [-0.058, -0.004], [-0.042, 0.002]], 0.032, M.poly, { bevel: 0.005 });
  for (let i = 0; i < 4; i++) blk(g, -0.012 - i * 0.006, -0.008 - i * 0.006, -0.02 - i * 0.02, -0.012 - i * 0.02, 0.033, M.black);
  // trigger guard + trigger
  prof(g, [[-0.003, 0.002], [0.06, 0.002], [0.06, -0.006], [0.045, -0.03], [0.004, -0.03]], 0.012, M.park,
    { holes: [[[0.003, -0.004], [0.052, -0.004], [0.04, -0.024], [0.008, -0.024]]], bevel: 0.001 });
  prof(g, [[0.02, 0.0], [0.026, 0.0], [0.024, -0.012], [0.016, -0.02], [0.017, -0.015]], 0.006, M.black, { bevel: 0.001 });
  // stock
  prof(g, [[-0.1, 0.064], [-0.1, 0.002], [-0.14, -0.012], [-0.47, -0.085], [-0.49, -0.085], [-0.49, 0.042], [-0.47, 0.048], [-0.13, 0.068]], 0.044, M.wood, { bevel: 0.007 });
  prof(g, [[-0.49, -0.086], [-0.502, -0.086], [-0.502, 0.044], [-0.49, 0.044]], 0.046, M.park, { bevel: 0.002 });
  tube(g, -0.32, -0.315, -0.045, 0.012, M.steel, { x: -0.022, rot: Math.PI / 2 });
  anchor(g, 'handR', -0.034, -0.046);
  anchor(g, 'handL', 0.31, -0.002, 0, { type: 'wrap', r: 0.033, dy: 0.034 });
  anchor(g, 'muzzle', 0.72, 0.04);
  anchor(g, 'eject', 0.12, 0.05, 0.02);
}

function buildSentinel(g) {
  // lower receiver
  prof(g, [[-0.09, 0.0], [0.15, 0.0], [0.15, 0.046], [-0.09, 0.046]], 0.04, M.black, { bevel: 0.003 });
  prof(g, [[0.048, 0.002], [0.135, 0.002], [0.14, -0.04], [0.045, -0.04]], 0.044, M.black, { bevel: 0.003 });  // magwell
  // upper receiver
  prof(g, [[-0.09, 0.045], [0.17, 0.045], [0.17, 0.08], [-0.09, 0.08]], 0.038, M.park, { bevel: 0.003 });
  rail(g, -0.085, 0.17, 0.08, 0.022, M.park);
  blk(g, 0.04, 0.1, 0.055, 0.072, 0.004, M.hole, 0.019);                   // ejection port
  blk(g, 0.04, 0.1, 0.055, 0.072, 0.002, M.blued, 0.021);
  tube(g, -0.03, 0.0, 0.065, 0.007, M.black, { x: 0.024, rot: Math.PI / 2 });  // forward assist
  prof(g, [[-0.1, 0.077], [-0.082, 0.077], [-0.082, 0.084], [-0.1, 0.084]], 0.05, M.black, { bevel: 0.002 }); // charging handle
  prof(g, [[-0.03, 0.03], [0.01, 0.03], [0.01, 0.034], [-0.03, 0.038]], 0.003, M.steelDark, { x: -0.0215, bevel: 0.0005 });
  // handguard: octagonal free-float with top rail and slots
  tube(g, 0.17, 0.45, 0.062, 0.028, M.park, { seg: 8, rot: Math.PI / 8 });
  rail(g, 0.17, 0.45, 0.083, 0.022, M.park);
  for (let i = 0; i < 5; i++) {
    for (const x of [-0.0262, 0.0262]) blk(g, 0.2 + i * 0.05, 0.225 + i * 0.05, 0.055, 0.064, 0.002, M.hole, x);
    blk(g, 0.2 + i * 0.05, 0.225 + i * 0.05, 0.035, 0.037, 0.01, M.hole);
  }
  tube(g, 0.45, 0.58, 0.062, 0.0095, M.blued);
  tube(g, 0.58, 0.64, 0.062, 0.0125, M.black, { seg: 10 });               // flash hider
  for (let i = 0; i < 4; i++) {
    const s = blk(g, 0.6, 0.64, 0.071, 0.075, 0.004, M.hole);
    s.position.applyAxisAngle(new THREE.Vector3(0, 0, 1), 0);
    s.rotation.z = (i * Math.PI) / 2;
    const ang = (i * Math.PI) / 2;
    s.position.set(Math.sin(ang) * 0.011, 0.062 + Math.cos(ang) * 0.011, s.position.z);
  }
  tube(g, 0.639, 0.641, 0.062, 0.008, M.hole);
  // magazine
  prof(g, [[0.052, -0.038], [0.128, -0.038], ['q', 0.135, -0.12, 0.152, -0.2], [0.092, -0.206], ['q', 0.07, -0.12, 0.052, -0.038]], 0.03, M.poly, { bevel: 0.004 });
  blk(g, 0.09, 0.155, -0.214, -0.2, 0.034, M.black).rotation.x = -0.1;
  // grip
  prof(g, [[0.0, 0.0], [-0.016, -0.04], [-0.024, -0.1], [-0.066, -0.1], [-0.058, -0.01], [-0.046, 0.002]], 0.03, M.poly, { bevel: 0.005 });
  prof(g, [[-0.003, 0.002], [0.05, 0.002], [0.05, -0.006], [0.042, -0.026], [0.0, -0.026]], 0.012, M.black,
    { holes: [[[0.002, -0.004], [0.044, -0.004], [0.036, -0.02], [0.004, -0.02]]], bevel: 0.001 });
  prof(g, [[0.016, 0.0], [0.022, 0.0], [0.02, -0.012], [0.012, -0.018], [0.013, -0.013]], 0.006, M.steelDark, { bevel: 0.001 });
  // buffer tube + stock
  tube(g, -0.3, -0.09, 0.06, 0.016, M.black);
  prof(g, [[-0.215, 0.085], [-0.35, 0.085], [-0.36, 0.07], [-0.36, -0.03], [-0.34, -0.035], [-0.3, 0.02], [-0.215, 0.035]], 0.042, M.poly, { bevel: 0.006 });
  prof(g, [[-0.355, -0.035], [-0.368, -0.035], [-0.368, 0.087], [-0.355, 0.087]], 0.044, M.rubber, { bevel: 0.003 });
  // holographic sight
  blk(g, -0.03, 0.065, 0.091, 0.102, 0.03, M.black);
  blk(g, -0.03, 0.065, 0.102, 0.108, 0.036, M.black);
  blk(g, 0.02, 0.07, 0.108, 0.145, 0.004, M.black, 0.017);
  blk(g, 0.02, 0.07, 0.108, 0.145, 0.004, M.black, -0.017);
  blk(g, 0.02, 0.07, 0.141, 0.148, 0.038, M.black);
  blk(g, -0.03, 0.0, 0.108, 0.13, 0.03, M.black);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.033), M.glass);
  glass.position.set(0, 0.125, -0.045);
  g.add(glass);
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.0012, 10), M.dot);
  dot.position.set(0, 0.125, -0.044);
  dot.name = 'reticle';
  g.add(dot);
  anchor(g, 'handR', -0.032, -0.046);
  anchor(g, 'handL', 0.3, 0.03, 0, { type: 'wrap', r: 0.034, dy: 0.032 });
  anchor(g, 'muzzle', 0.645, 0.062);
  anchor(g, 'eject', 0.07, 0.065, 0.02);
}

function buildRanger(g) {
  prof(g, [[-0.27, -0.07], [-0.27, 0.055], [-0.2, 0.07], [0.2, 0.07], [0.24, 0.05], [0.24, 0.0], [0.08, 0.0], [0.07, -0.02], [-0.13, -0.02], [-0.16, -0.07]], 0.05, M.polyTan, { bevel: 0.008 });
  prof(g, [[-0.27, -0.072], [-0.282, -0.072], [-0.282, 0.057], [-0.27, 0.057]], 0.052, M.rubber, { bevel: 0.003 });
  blk(g, -0.15, -0.08, 0.02, 0.05, 0.002, M.hole, 0.026);                    // ejection port
  // handle + optic
  prof(g, [[-0.1, 0.07], [0.14, 0.07], [0.14, 0.095], [0.1, 0.11], [-0.08, 0.11], [-0.1, 0.09]], 0.032, M.black, { bevel: 0.004, holes: [[[-0.07, 0.074], [0.1, 0.074], [0.08, 0.09], [-0.06, 0.09]]] });
  tube(g, -0.07, 0.1, 0.123, 0.016, M.black);
  tube(g, 0.1, 0.12, 0.123, 0.016, M.black, { r1: 0.02 });
  lens(g, 0.12, 0.123, 0.018); lens(g, -0.07, 0.123, 0.014, true);
  tube(g, 0.24, 0.4, 0.035, 0.0095, M.blued);
  tube(g, 0.38, 0.42, 0.035, 0.0135, M.black, { seg: 10 });
  tube(g, 0.24, 0.3, 0.035, 0.03, M.polyTan, { seg: 14 });
  // grip with enclosed guard
  prof(g, [[0.08, 0.002], [0.1, -0.06], [0.08, -0.105], [0.04, -0.105], [0.05, -0.04], [-0.03, -0.035], [-0.04, -0.02], [-0.03, 0.002]], 0.032, M.polyTan,
    { holes: [[[0.03, -0.01], [0.06, -0.01], [0.055, -0.03], [0.02, -0.03]]], bevel: 0.004 });
  prof(g, [[0.04, -0.012], [0.045, -0.012], [0.043, -0.024], [0.036, -0.028]], 0.006, M.black, { bevel: 0.001 });
  // magazine behind grip
  prof(g, [[-0.14, -0.02], [-0.075, -0.02], [-0.07, -0.16], [-0.125, -0.165]], 0.028, M.black, { bevel: 0.003 });
  anchor(g, 'handR', 0.06, -0.06, 0, { type: 'grip', slant: -0.3 });
  anchor(g, 'handL', 0.2, -0.01, 0, { type: 'wrap', r: 0.04, dy: 0.045 });
  anchor(g, 'muzzle', 0.425, 0.035);
  anchor(g, 'eject', -0.11, 0.04, 0.02);
}

function buildHornet(g) {
  prof(g, [[-0.07, 0.0], [0.2, 0.0], [0.21, 0.015], [0.21, 0.058], [0.195, 0.068], [-0.06, 0.068], [-0.07, 0.055]], 0.046, M.black, { bevel: 0.005 });
  for (let i = 0; i < 4; i++) for (const x of [-0.0232, 0.0232]) tube(g, 0.13 + i * 0.018, 0.133 + i * 0.018, 0.034, 0.006, M.hole, { x, rot: Math.PI / 2 });
  rail(g, -0.05, 0.19, 0.068, 0.022, M.park);
  tube(g, 0.21, 0.27, 0.034, 0.012, M.park);
  for (let i = 0; i < 5; i++) tube(g, 0.215 + i * 0.01, 0.219 + i * 0.01, 0.034, 0.0135, M.black);
  blk(g, 0.03, 0.08, 0.04, 0.06, 0.003, M.hole, 0.0235);
  prof(g, [[-0.07, 0.056], [-0.03, 0.056], [-0.03, 0.065], [-0.07, 0.07]], 0.05, M.park, { bevel: 0.002 });
  // red dot
  blk(g, 0.0, 0.07, 0.079, 0.088, 0.03, M.black);
  tube(g, 0.005, 0.065, 0.104, 0.016, M.black, { open: true });
  tube(g, 0.005, 0.065, 0.104, 0.0145, M.black, { open: true });
  const g2 = new THREE.Mesh(new THREE.CircleGeometry(0.0145, 20), M.glass);
  g2.position.set(0, 0.104, -0.035);
  g.add(g2);
  const d = new THREE.Mesh(new THREE.CircleGeometry(0.0012, 10), M.dot);
  d.position.set(0, 0.104, -0.034); d.name = 'reticle';
  g.add(d);
  // vertical mag
  prof(g, [[0.03, 0.002], [0.075, 0.002], [0.08, -0.16], [0.035, -0.165]], 0.026, M.poly, { bevel: 0.003 });
  blk(g, 0.03, 0.085, -0.172, -0.162, 0.03, M.black);
  // foregrip
  prof(g, [[0.135, 0.0], [0.175, 0.0], [0.17, -0.085], [0.145, -0.09], [0.14, -0.04]], 0.026, M.poly, { bevel: 0.005 });
  // grip + guard
  prof(g, [[0.0, 0.0], [-0.024, -0.095], [-0.062, -0.095], [-0.052, 0.0]], 0.03, M.poly, { bevel: 0.005 });
  prof(g, [[0.0, 0.002], [0.025, 0.002], [0.022, -0.026], [-0.004, -0.026]], 0.012, M.black, { holes: [[[0.002, -0.004], [0.02, -0.004], [0.017, -0.02], [0.0, -0.02]]], bevel: 0.001 });
  // folding stock (folded along the right side)
  for (const v of [0.012, 0.05]) tube(g, -0.07, 0.15, v, 0.004, M.park, { x: 0.03 });
  prof(g, [[0.14, 0.005], [0.16, 0.005], [0.16, 0.058], [0.14, 0.058]], 0.008, M.rubber, { x: 0.03, bevel: 0.002 });
  anchor(g, 'handR', -0.03, -0.042);
  anchor(g, 'handL', 0.155, -0.045, 0, { type: 'grip', slant: 0.1, side: -1 });
  anchor(g, 'muzzle', 0.27, 0.034);
  anchor(g, 'eject', 0.05, 0.05, 0.02);
}

function buildBreacher(g) {
  prof(g, [[-0.07, -0.005], [0.15, -0.005], [0.15, 0.06], [0.13, 0.072], [-0.05, 0.072], [-0.07, 0.06]], 0.046, M.blued, { bevel: 0.006 });
  blk(g, 0.02, 0.1, 0.035, 0.06, 0.003, M.hole, 0.0235);
  tube(g, 0.15, 0.62, 0.052, 0.012, M.blued);
  tube(g, 0.15, 0.5, 0.022, 0.0125, M.blued);
  tube(g, 0.497, 0.52, 0.022, 0.0135, M.steelDark);
  tube(g, 0.618, 0.621, 0.052, 0.008, M.hole);
  const bead = new THREE.Mesh(new THREE.SphereGeometry(0.003, 8, 6), M.brass);
  bead.position.set(0, 0.066, -0.61);
  g.add(bead);
  // pump with grooves
  tube(g, 0.24, 0.37, 0.026, 0.024, M.poly, { seg: 16 });
  for (let i = 0; i < 7; i++) tube(g, 0.25 + i * 0.016, 0.256 + i * 0.016, 0.026, 0.0255, M.black, { seg: 16 });
  // side saddle shells
  for (let i = 0; i < 4; i++) {
    tube(g, 0.0 + i * 0.024, 0.0 + i * 0.024 + 0.001, 0.035, 0.009, M.red, { x: -0.03, rot: Math.PI / 2 });
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.05, 12), M.red);
    sh.position.set(-0.028, 0.03, -(0.01 + i * 0.024));
    g.add(sh);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0095, 0.012, 12), M.brass);
    cap.position.set(-0.028, 0.002, -(0.01 + i * 0.024));
    g.add(cap);
  }
  blk(g, -0.01, 0.09, 0.0, 0.06, 0.006, M.poly, -0.026);
  // stock with integrated grip
  prof(g, [[-0.07, 0.066], [-0.07, -0.004], [-0.06, -0.02], [-0.085, -0.1], [-0.12, -0.1], [-0.115, -0.03], [-0.4, -0.08], [-0.4, 0.04], [-0.13, 0.068]], 0.044, M.wood, { bevel: 0.007 });
  prof(g, [[-0.4, -0.082], [-0.425, -0.082], [-0.425, 0.042], [-0.4, 0.042]], 0.046, M.rubber, { bevel: 0.004 });
  prof(g, [[0.0, -0.004], [0.07, -0.004], [0.065, -0.03], [0.005, -0.03]], 0.012, M.blued, { holes: [[[0.004, -0.008], [0.062, -0.008], [0.058, -0.025], [0.008, -0.025]]], bevel: 0.001 });
  prof(g, [[0.03, -0.004], [0.036, -0.004], [0.034, -0.016], [0.026, -0.022]], 0.006, M.black, { bevel: 0.001 });
  anchor(g, 'handR', -0.085, -0.05, 0, { type: 'grip', slant: 0.45 });
  anchor(g, 'handL', 0.3, -0.004, 0, { type: 'wrap', r: 0.03, dy: 0.03 });
  anchor(g, 'muzzle', 0.63, 0.052);
  anchor(g, 'eject', 0.06, 0.05, 0.02);
}

function buildLongbow(g) {
  // chassis
  prof(g, [[-0.12, -0.01], [0.33, -0.01], [0.35, 0.01], [0.35, 0.05], [-0.12, 0.06]], 0.05, M.polyOd, { bevel: 0.008 });
  for (let i = 0; i < 4; i++) blk(g, 0.15 + i * 0.045, 0.175 + i * 0.045, 0.012, 0.03, 0.051, M.black);
  blk(g, -0.11, 0.14, 0.04, 0.07, 0.036, M.blued);                       // action
  rail(g, -0.1, 0.14, 0.07, 0.02, M.black);
  // fluted barrel
  tube(g, 0.33, 0.86, 0.04, 0.0125, M.blued, { r1: 0.0105 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    blk(g, 0.4, 0.78, 0.04 + Math.cos(a) * 0.0115, 0.04 + Math.cos(a) * 0.0115 + 0.002, 0.003, M.hole, Math.sin(a) * 0.0115);
  }
  prof(g, [[0.86, 0.022], [0.93, 0.022], [0.935, 0.03], [0.935, 0.05], [0.93, 0.058], [0.86, 0.058]], 0.032, M.black, { bevel: 0.003 });
  for (let i = 0; i < 3; i++) blk(g, 0.872 + i * 0.02, 0.882 + i * 0.02, 0.028, 0.052, 0.034, M.hole);
  tube(g, 0.934, 0.936, 0.04, 0.007, M.hole);
  // bolt
  tube(g, -0.05, -0.04, 0.055, 0.004, M.steel, { x: 0.04, rot: Math.PI / 2 });
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.009, 14, 10), M.black);
  knob.position.set(0.07, 0.05, 0.045);
  g.add(knob);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.05, 8), M.steel);
  shaft.rotation.z = Math.PI / 2 - 0.25;
  shaft.position.set(0.045, 0.053, 0.045);
  g.add(shaft);
  // scope
  const sv = 0.118;
  for (const u of [-0.03, 0.09]) {
    blk(g, u, u + 0.022, 0.07, 0.1, 0.022, M.black);
    tube(g, u, u + 0.022, sv, 0.022, M.black);
  }
  tube(g, -0.1, 0.2, sv, 0.0175, M.black);
  tube(g, 0.2, 0.26, sv, 0.0175, M.black, { r1: 0.028 });
  tube(g, 0.26, 0.33, sv, 0.028, M.black);
  tube(g, 0.325, 0.33, sv, 0.029, M.blued);
  tube(g, -0.15, -0.1, sv, 0.022, M.black, { r1: 0.0175 });
  tube(g, -0.21, -0.15, sv, 0.022, M.black);
  tube(g, -0.2, -0.19, sv, 0.0225, M.rubber);
  lens(g, 0.331, sv, 0.025); lens(g, -0.211, sv, 0.019, true);
  const tur = (x, y, axis) => {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.022, 16), M.black);
    t.position.set(x, y, -0.04);
    if (axis === 'x') t.rotation.z = Math.PI / 2;
    g.add(t);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.006, 16), M.steelDark);
    cap.position.copy(t.position);
    if (axis === 'x') { cap.rotation.z = Math.PI / 2; cap.position.x += Math.sign(x) * 0.012; } else cap.position.y += 0.012;
    g.add(cap);
  };
  tur(0, sv + 0.026, 'y');
  tur(0.026, sv, 'x');
  tube(g, -0.05, -0.03, sv, 0.0195, M.steelDark);
  // magazine
  prof(g, [[-0.04, -0.01], [0.04, -0.01], [0.038, -0.06], [-0.038, -0.06]], 0.032, M.black, { bevel: 0.003 });
  // thumbhole stock
  prof(g, [[-0.12, 0.06], [-0.12, -0.012], [-0.06, -0.012], [-0.07, -0.1], [-0.115, -0.105], [-0.16, -0.05], [-0.5, -0.075], [-0.5, 0.07], [-0.3, 0.07], [-0.27, 0.085], [-0.14, 0.085]], 0.046, M.polyOd,
    { holes: [[[-0.125, -0.02], [-0.165, -0.035], [-0.2, -0.03], [-0.2, 0.0], [-0.13, 0.02]]], bevel: 0.007 });
  prof(g, [[-0.5, -0.077], [-0.52, -0.077], [-0.52, 0.072], [-0.5, 0.072]], 0.048, M.rubber, { bevel: 0.004 });
  prof(g, [[-0.32, 0.07], [-0.18, 0.07], [-0.18, 0.09], [-0.32, 0.095]], 0.03, M.black, { bevel: 0.004 });
  prof(g, [[-0.04, -0.012], [0.02, -0.012], [0.018, -0.035], [-0.035, -0.035]], 0.012, M.black, { holes: [[[-0.035, -0.015], [0.015, -0.015], [0.012, -0.03], [-0.03, -0.03]]], bevel: 0.001 });
  prof(g, [[-0.015, -0.012], [-0.01, -0.012], [-0.012, -0.024], [-0.02, -0.028]], 0.006, M.steelDark, { bevel: 0.001 });
  // folded bipod
  for (const x of [-0.012, 0.012]) tube(g, 0.2, 0.34, -0.02, 0.004, M.black, { x });
  blk(g, 0.32, 0.345, -0.02, -0.005, 0.034, M.black);
  anchor(g, 'handR', -0.09, -0.06, 0, { type: 'grip', slant: 0.45 });
  anchor(g, 'handL', 0.2, -0.018, 0, { type: 'wrap', r: 0.033, dy: 0.036 });
  anchor(g, 'muzzle', 0.94, 0.04);
  anchor(g, 'eject', 0.05, 0.06, 0.02);
}

function buildKnife(g) {
  prof(g, [[0.0, 0.013], [0.14, 0.013], ['q', 0.185, 0.01, 0.21, -0.004], ['q', 0.17, -0.022, 0.12, -0.025], [0.0, -0.023]], 0.0055, M.steel, { bevel: 0.0018 });
  blk(g, 0.02, 0.13, 0.002, 0.006, 0.0058, M.steelDark);                    // fuller
  blk(g, 0.0, 0.14, 0.011, 0.0135, 0.006, M.blued);                         // spine
  for (let i = 0; i < 6; i++) blk(g, 0.004 + i * 0.006, 0.007 + i * 0.006, 0.013, 0.016, 0.004, M.blued);
  prof(g, [[-0.006, -0.032], [0.006, -0.032], [0.006, 0.02], [-0.006, 0.02]], 0.026, M.blued, { bevel: 0.003 });
  prof(g, [[-0.11, -0.018], [-0.006, -0.021], [-0.006, 0.014], [-0.11, 0.013], [-0.122, 0.0]], 0.024, M.poly, { bevel: 0.006 });
  for (let i = 0; i < 5; i++) blk(g, -0.095 + i * 0.018, -0.09 + i * 0.018, -0.022, 0.016, 0.025, M.black);
  tube(g, -0.135, -0.11, -0.002, 0.012, M.steelDark, { seg: 8 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.008, 0.0025, 6, 14), M.steelDark);
  ring.position.set(0, -0.002, 0.14);
  g.add(ring);
  anchor(g, 'handR', -0.06, -0.002, 0, { type: 'wrap', r: 0.02, dy: 0, fist: true });
  anchor(g, 'muzzle', 0.21, 0);
}

function buildFrag(g) {
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const y = -0.04 + t * 0.085;
    const r = Math.sin(Math.PI * Math.min(1, t * 1.08)) * 0.034 + (i % 2 ? 0.0015 : 0);
    pts.push(new THREE.Vector2(Math.max(0.006, r), y));
  }
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 20), M.polyOd);
  g.add(body);
  const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.022, 14), M.steelDark);
  fuse.position.y = 0.05;
  g.add(fuse);
  const lever = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.085, 0.006), M.steelDark);
  lever.position.set(0.0, 0.02, -0.034);
  lever.rotation.x = 0.18;
  g.add(lever);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.0025, 6, 16), M.steel);
  ring.position.set(0.018, 0.058, 0);
  ring.rotation.y = Math.PI / 2;
  g.add(ring);
  anchor(g, 'handR', 0, -0.005, 0, { type: 'grip', slant: 0, small: true });
  anchor(g, 'muzzle', 0, 0);
}

function buildSmoke(g) {
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.11, 20), mat(0x6c7277, 0.55, 0.4));
  g.add(can);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0305, 0.0305, 0.025, 20), mat(0xd9d4c2, 0.7, 0.05));
  band.position.y = 0.012;
  g.add(band);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const h = new THREE.Mesh(new THREE.CircleGeometry(0.004, 8), M.hole);
    h.position.set(Math.sin(a) * 0.018, 0.0551, Math.cos(a) * 0.018);
    h.rotation.x = -Math.PI / 2;
    g.add(h);
  }
  const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.013, 0.02, 14), M.steelDark);
  fuse.position.y = 0.065;
  g.add(fuse);
  const lever = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.1, 0.005), M.steelDark);
  lever.position.set(0, 0.02, -0.033);
  g.add(lever);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.013, 0.0025, 6, 16), M.steel);
  ring.position.set(0.017, 0.072, 0);
  ring.rotation.y = Math.PI / 2;
  g.add(ring);
  anchor(g, 'handR', 0, -0.005, 0, { type: 'grip', slant: 0, small: true });
  anchor(g, 'muzzle', 0, 0);
}

export function buildWeaponModel(model) {
  const g = new THREE.Group();
  switch (model) {
    case 'knife': buildKnife(g); break;
    case 'pistol_a': buildPistol(g, { len: 0.135, slide: M.steelDark, frame: M.poly, grip: M.polyTan, gripPanel: mat(0x8a7552, 0.9, 0.02) }); break;
    case 'pistol_b': buildPistol(g, { len: 0.13, slide: M.black, frame: M.poly, grip: M.poly }); break;
    case 'pistol_heavy': buildPistol(g, { len: 0.19, slide: M.steel, slideDark: M.steelDark, frame: M.steelDark, grip: M.wood, gripPanel: M.woodLight, heavy: true }); break;
    case 'smg': buildHornet(g); break;
    case 'shotgun': buildBreacher(g); break;
    case 'rifle_a': buildVanguard(g); break;
    case 'rifle_b': buildSentinel(g); break;
    case 'rifle_c': buildRanger(g); break;
    case 'sniper': buildLongbow(g); break;
    case 'frag': buildFrag(g); break;
    case 'smokegren': buildSmoke(g); break;
    case 'bomb': {
      const b = buildCharge();
      b.scale.setScalar(0.85);
      b.rotation.y = Math.PI / 2;
      g.add(b);
      anchor(g, 'handR', 0.0, -0.01, 0.075, { type: 'grip', slant: 0 });
      anchor(g, 'handL', 0.0, -0.01, -0.075, { type: 'grip', slant: 0, side: -1 });
      anchor(g, 'muzzle', 0, 0);
      break;
    }
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// Demo charge: taped explosive blocks, controller box with keypad and screen.
export function buildCharge() {
  const g = new THREE.Group();
  const pack = mat(0xb7a47a, 0.85, 0.02);
  const tape = mat(0x2c2f33, 0.6, 0.05);
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.07, 0.22), pack);
    b.position.set(-0.07 + i * 0.07, 0.035, 0);
    g.add(b);
  }
  for (const z of [-0.075, 0.075]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.215, 0.074, 0.025), tape);
    t.position.set(0, 0.035, z);
    g.add(t);
  }
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.12), mat(0x30343a, 0.5, 0.5));
  box.position.set(0.015, 0.085, -0.01);
  g.add(box);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.004, 0.032),
    new THREE.MeshStandardMaterial({ color: 0x0b2a10, roughness: 0.3, emissive: 0x2bd148, emissiveIntensity: 0.7 }));
  screen.position.set(0.015, 0.101, -0.045);
  screen.name = 'screen';
  g.add(screen);
  const keyM = mat(0xb5b8bc, 0.5, 0.2);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) {
    const k = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.006, 0.012), keyM);
    k.position.set(-0.008 + i * 0.022, 0.102, -0.012 + j * 0.016);
    g.add(k);
  }
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.006, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff0000, emissiveIntensity: 0.3 }));
  led.position.set(0.06, 0.104, 0.035);
  led.name = 'led';
  g.add(led);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.09, 6), M.black);
  ant.position.set(0.065, 0.14, -0.06);
  g.add(ant);
  const wireM = [mat(0xc62222, 0.5), mat(0x2244cc, 0.5), mat(0xd8c628, 0.5)];
  wireM.forEach((m, i) => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.03 + i * 0.012, 0.085, 0.05),
      new THREE.Vector3(-0.05 + i * 0.03, 0.11, 0.09),
      new THREE.Vector3(-0.07 + i * 0.07, 0.072, 0.1),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.003, 5), m));
  });
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ---------------------------------------------------------------------------
// Agents (rounded limbs, plate carriers, helmets / head wraps)
// ---------------------------------------------------------------------------
const TEAM_STYLE = {
  R: [
    { shirt: 0x8b7a55, pants: 0x5d4d36, vest: 0x5b5540, skin: 0xc49a74, head: 'wrap', wrap: 0x7a2a22, cap: 0x3b352b, glove: 0x2b2420, boot: 0x3a2a1c, accent: 0xb5452a, pack: true },
    { shirt: 0x6b6a4e, pants: 0x4a4636, vest: 0x3e3d30, skin: 0xa77a58, head: 'wrap', wrap: 0xcdbf9b, cap: 0x2a2a26, glove: 0x1f1c18, boot: 0x2f2418, accent: 0xb5452a, pack: false },
  ],
  G: [
    { shirt: 0x2c3b52, pants: 0x384152, vest: 0x1f2a38, skin: 0xd2a98a, head: 'helmet', helm: 0x1e2630, glove: 0x161616, boot: 0x181818, accent: 0x3a8ad8, pack: false },
    { shirt: 0x3a4a3e, pants: 0x46504a, vest: 0x262e28, skin: 0xb88b6a, head: 'helmet', helm: 0x2b3329, glove: 0x161616, boot: 0x1d1d1d, accent: 0x3a8ad8, pack: true },
  ],
};

function cap(r, len, m, segs = 10) {
  return new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, segs), m);
}

function roundedBox(w, h, d, r, m) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const b = Math.min(r, d / 2 - 0.001);
  const geo = new THREE.ExtrudeGeometry(s, { depth: d - b * 2, bevelEnabled: true, bevelThickness: b, bevelSize: b * 0.8, bevelSegments: 3, curveSegments: 6 });
  geo.translate(0, 0, -(d - b * 2) / 2);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, m);
}

function put(parent, mesh, x, y, z, rx = 0, ry = 0, rz = 0) {
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  parent.add(mesh);
  return mesh;
}

export function buildAgent(team, variant = 0) {
  const s = TEAM_STYLE[team][variant % TEAM_STYLE[team].length];
  const root = new THREE.Group();
  const shirt = mat(s.shirt, 0.88), pants = mat(s.pants, 0.88), vest = mat(s.vest, 0.75, 0.05);
  const skin = mat(s.skin, 0.65), glove = mat(s.glove, 0.8), boot = mat(s.boot, 0.75);
  const accent = mat(s.accent, 0.6), webbing = mat(0x23221e, 0.85), buckle = mat(0x1a1a1a, 0.4, 0.4);
  const parts = {};

  const hips = new THREE.Group();
  hips.position.y = 0.94;
  root.add(hips);
  parts.hips = hips;
  put(hips, roundedBox(0.34, 0.18, 0.22, 0.05, pants), 0, 0, 0);
  put(hips, roundedBox(0.36, 0.05, 0.24, 0.015, webbing), 0, 0.075, 0);
  put(hips, new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.02), buckle), 0, 0.075, -0.125);
  // thigh holster + dump pouch
  put(hips, roundedBox(0.06, 0.16, 0.09, 0.02, webbing), 0.2, -0.1, 0.0);
  put(hips, roundedBox(0.1, 0.12, 0.08, 0.03, vest), -0.15, -0.02, 0.1);

  const torso = new THREE.Group();
  torso.position.y = 0.09;
  hips.add(torso);
  parts.torso = torso;
  put(torso, roundedBox(0.38, 0.5, 0.22, 0.08, shirt), 0, 0.27, 0);
  // plate carrier
  put(torso, roundedBox(0.36, 0.34, 0.07, 0.03, vest), 0, 0.3, -0.1);
  put(torso, roundedBox(0.36, 0.36, 0.06, 0.03, vest), 0, 0.31, 0.1);
  put(torso, roundedBox(0.06, 0.08, 0.2, 0.02, vest), 0.16, 0.48, 0, 0, 0, 0.1);
  put(torso, roundedBox(0.06, 0.08, 0.2, 0.02, vest), -0.16, 0.48, 0, 0, 0, -0.1);
  put(torso, roundedBox(0.43, 0.1, 0.25, 0.03, vest), 0, 0.17, 0);          // cummerbund
  for (let i = 0; i < 3; i++) {
    put(torso, roundedBox(0.085, 0.12, 0.05, 0.015, vest), -0.1 + i * 0.1, 0.22, -0.155);
    put(torso, new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.03, 0.055), webbing), -0.1 + i * 0.1, 0.29, -0.155);
  }
  put(torso, roundedBox(0.07, 0.11, 0.05, 0.015, webbing), -0.12, 0.4, -0.15);   // radio
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.25, 5), buckle);
  put(torso, antenna, -0.14, 0.55, -0.13, 0.15, 0, 0.1);
  put(torso, new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.035, 0.008), accent), 0.09, 0.42, -0.137);  // patch
  if (s.pack) {
    put(torso, roundedBox(0.3, 0.36, 0.14, 0.05, mat(s.vest === 0x1f2a38 ? 0x26303d : 0x4f4a38, 0.85)), 0, 0.28, 0.19);
    put(torso, roundedBox(0.2, 0.12, 0.06, 0.03, webbing), 0, 0.14, 0.27);
  }

  // head
  const neck = new THREE.Group();
  neck.position.y = 0.52;
  torso.add(neck);
  parts.neck = neck;
  put(neck, cap(0.055, 0.04, skin), 0, 0.03, 0);
  const head = new THREE.Group();
  head.position.y = 0.17;
  neck.add(head);
  parts.head = head;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 16), skin);
  skull.scale.set(0.95, 1.12, 1.02);
  head.add(skull);
  put(head, new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), skin), 0, -0.02, -0.105, 0.6); // nose
  for (const x of [-0.105, 0.105]) put(head, new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), skin), x, 0.0, 0.0);
  if (s.head === 'helmet') {
    const helm = mat(s.helm, 0.55, 0.15);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.135, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), helm);
    shell.scale.set(1, 0.95, 1.05);
    put(head, shell, 0, 0.03, 0.005);
    put(head, new THREE.Mesh(new THREE.TorusGeometry(0.128, 0.008, 6, 28), helm), 0, 0.006, 0.005, Math.PI / 2);
    for (const x of [-0.12, 0.12]) {
      put(head, new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 16), mat(0x2a2d30, 0.6, 0.2)), x, -0.01, 0.0, 0, 0, Math.PI / 2);
      put(head, roundedBox(0.012, 0.03, 0.12, 0.005, buckle), x * 1.02, 0.06, 0.0);
    }
    put(head, roundedBox(0.05, 0.04, 0.03, 0.01, buckle), 0, 0.12, -0.12);    // NVG mount
    put(head, roundedBox(0.2, 0.065, 0.06, 0.02, mat(0x0d1116, 0.15, 0.7, { emissive: 0x081420 })), 0, 0.01, -0.095); // goggles
    const bala = new THREE.Mesh(new THREE.SphereGeometry(0.112, 16, 10, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), mat(0x1a1c20, 0.95));
    bala.scale.set(0.97, 1.1, 1.04);
    put(head, bala, 0, -0.005, 0);
  } else {
    const wrap = mat(s.wrap, 0.95);
    const scarf = new THREE.Mesh(new THREE.SphereGeometry(0.116, 18, 12, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), wrap);
    scarf.scale.set(0.98, 1.1, 1.05);
    put(head, scarf, 0, 0, 0);
    put(head, new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 8, 20), wrap), 0, -0.1, 0, Math.PI / 2);
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.118, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), mat(s.cap, 0.9));
    c.scale.set(1, 1.05, 1.05);
    put(head, c, 0, 0.02, 0);
    put(head, roundedBox(0.16, 0.012, 0.09, 0.005, mat(s.cap, 0.9)), 0, 0.045, -0.13, -0.15);
    put(head, roundedBox(0.19, 0.045, 0.03, 0.012, mat(0x0a0a0a, 0.1, 0.8, { emissive: 0x050505 })), 0, 0.015, -0.103);
  }

  // arms
  function arm(side) {
    const sh = new THREE.Group();
    sh.position.set(side * 0.245, 0.47, 0);
    torso.add(sh);
    put(sh, new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 10), shirt), 0, 0, 0);
    put(sh, cap(0.057, 0.2, shirt), 0, -0.14, 0);
    const el = new THREE.Group();
    el.position.y = -0.29;
    sh.add(el);
    put(el, cap(0.05, 0.19, shirt), 0, -0.12, 0);
    put(el, cap(0.052, 0.04, mat(0x2a2a2a, 0.7)), 0, -0.02, 0.0);     // elbow pad
    put(el, roundedBox(0.085, 0.1, 0.1, 0.03, glove), 0, -0.29, -0.01);
    return { sh, el };
  }
  parts.armR = arm(1);
  parts.armL = arm(-1);

  function leg(side) {
    const hp = new THREE.Group();
    hp.position.set(side * 0.095, -0.06, 0);
    hips.add(hp);
    put(hp, cap(0.075, 0.3, pants), 0, -0.21, 0);
    put(hp, roundedBox(0.06, 0.1, 0.1, 0.02, pants), side * 0.07, -0.2, 0);   // cargo pocket
    const kn = new THREE.Group();
    kn.position.y = -0.43;
    hp.add(kn);
    put(kn, roundedBox(0.12, 0.11, 0.06, 0.03, mat(0x262626, 0.6)), 0, -0.02, -0.065);   // knee pad
    put(kn, cap(0.062, 0.3, pants), 0, -0.2, 0);
    put(kn, roundedBox(0.12, 0.12, 0.13, 0.03, boot), 0, -0.39, 0.0);
    put(kn, roundedBox(0.12, 0.07, 0.25, 0.03, boot), 0, -0.43, -0.05);
    return { hp, kn };
  }
  parts.legR = leg(1);
  parts.legL = leg(-1);

  const mount = new THREE.Group();
  mount.position.set(0.1, 0.33, -0.22);
  torso.add(mount);
  parts.mount = mount;

  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  root.userData.parts = parts;
  return root;
}

// Pose the agent model. st: {walkPhase, speed, crouch, pitch}
export function poseAgent(model, st) {
  const p = model.userData.parts;
  const amt = Math.min(1, st.speed / 4);
  const swing = Math.sin(st.walkPhase) * amt * 0.55;
  const c = st.crouch;
  p.hips.position.y = 0.94 - c * 0.36 + Math.abs(Math.cos(st.walkPhase)) * amt * 0.03;
  p.legR.hp.rotation.x = swing - c * 1.15;
  p.legL.hp.rotation.x = -swing - c * 1.15;
  p.legR.kn.rotation.x = Math.max(0, -Math.sin(st.walkPhase)) * amt * 0.9 + c * 1.95;
  p.legL.kn.rotation.x = Math.max(0, Math.sin(st.walkPhase)) * amt * 0.9 + c * 1.95;
  p.torso.rotation.x = c * 0.32 + amt * 0.08;
  p.torso.rotation.y = 0.25;
  const aim = st.pitch * 0.85;
  p.armR.sh.rotation.set(1.2 + aim, -0.25, -0.2);
  p.armR.el.rotation.x = 0.55;
  p.armL.sh.rotation.set(1.42 + aim, 0.45, 0.62);
  p.armL.el.rotation.x = 0.2;
  p.mount.rotation.set(aim, -0.25, 0);
  p.mount.position.y = 0.33 + aim * 0.12;
  p.neck.rotation.set(-st.pitch * 0.6, -0.22, 0);
}
