// Map layouts are authored on a grid (2m cells) by carving floor out of solid walls.
// Each map produces: render meshes, AABB colliders, a nav grid and named zones.
import * as THREE from 'three';
import * as TEX from './textures.js';

export const CELL = 2;

// ---------------------------------------------------------------------------
// Map definitions (original layouts)
// ---------------------------------------------------------------------------
export const MAPS = {
  sandfort: {
    id: 'sandfort',
    name: 'Sandfort',
    subtitle: 'Bomb Defusal · 5v5',
    W: 48, H: 40,
    wallHeight: 5.5,
    theme: 'desert',
    carves: [
      // [c0, r0, c1, r1, char]
      [18, 1, 29, 5, 'G'],          // Guardian spawn
      [8, 2, 17, 4, '.'],           // spawn -> A corridor
      [2, 2, 13, 14, '.'],          // Site A courtyard
      [4, 4, 10, 9, 'a'],           // A plant zone
      [30, 2, 37, 4, '.'],          // spawn -> B corridor
      [34, 2, 45, 14, '.'],         // Site B yard
      [37, 4, 43, 9, 'b'],          // B plant zone
      [22, 6, 25, 10, '.'],         // mid top
      [21, 10, 26, 30, '.'],        // mid
      [12, 17, 20, 19, '.'],        // A short
      [11, 14, 13, 19, '.'],        // A short -> A
      [2, 15, 5, 34, '.'],          // A long
      [6, 31, 16, 34, '.'],         // A long -> spawn
      [6, 21, 8, 25, '.'],          // A long pit
      [17, 32, 30, 38, 'R'],        // Raider spawn
      [21, 31, 26, 31, '.'],        // mid bottom
      [31, 33, 42, 35, '.'],        // B lane bottom
      [40, 15, 42, 35, '.'],        // B lane / tunnel
      [27, 21, 35, 23, '.'],        // mid -> B connector
      [34, 15, 36, 23, '.'],        // connector -> B
    ],
    props: [
      // [col, row, type]  c = low crate, C = tall crate, o = barrel
      [7, 6, 'C'], [8, 6, 'c'], [7, 7, 'c'], [3, 3, 'C'], [12, 9, 'c'], [10, 12, 'C'], [2, 10, 'c'],
      [40, 6, 'C'], [41, 6, 'c'], [40, 7, 'c'], [44, 3, 'C'], [36, 11, 'c'], [38, 12, 'C'], [45, 10, 'c'],
      [23, 14, 'C'], [25, 20, 'c'], [22, 26, 'C'], [21, 11, 'c'],
      [3, 24, 'c'], [4, 29, 'C'], [41, 26, 'c'],
      [20, 34, 'c'], [27, 35, 'c'], [19, 2, 'c'], [28, 2, 'c'],
      [13, 2, 'o'], [31, 2, 'o'], [16, 31, 'o'], [5, 20, 'o'], [35, 21, 'o'], [42, 16, 'o'], [17, 19, 'o'],
    ],
    roofs: [
      // [c0, r0, c1, r1, height] — tunnel ceilings
      [40, 20, 42, 29, 3.4],
      [12, 17, 15, 19, 3.6],
    ],
    signs: [
      // [col, row, side, text, arrow]  side = wall direction the sign is mounted on
      [22, 7, 'w', 'A', 'left'], [25, 7, 'e', 'B', 'right'],
      [21, 29, 'w', 'A', 'up'], [26, 29, 'e', 'MID', 'up'],
      [40, 33, 'n', 'B', 'up'], [5, 33, 'w', 'A', 'up'],
    ],
    zones: {
      siteA: [4, 4, 10, 9],
      siteB: [37, 4, 43, 9],
      holdA: [2, 2, 13, 14],
      holdB: [34, 2, 45, 14],
      mid: [21, 11, 26, 22],
      spawnG: [18, 1, 29, 5],
      spawnR: [17, 32, 30, 38],
      aLong: [2, 15, 5, 30],
      bLane: [40, 15, 42, 30],
    },
    sites: { A: 'siteA', B: 'siteB' },
  },

  arena: {
    id: 'arena',
    name: 'Blockyard',
    subtitle: 'Sniper Duel · 1v1',
    W: 26, H: 18,
    wallHeight: 4,
    theme: 'blocks',
    carves: [
      [1, 1, 24, 16, '.'],
      [1, 6, 3, 11, 'G'],
      [22, 6, 24, 11, 'R'],
    ],
    walls: [
      // interior walls [c0, r0, c1, r1]
      [8, 3, 8, 6], [8, 11, 8, 14],
      [17, 3, 17, 6], [17, 11, 17, 14],
      [12, 8, 13, 9],
    ],
    props: [
      [5, 4, 'c'], [5, 13, 'c'], [20, 4, 'c'], [20, 13, 'c'],
      [11, 3, 'C'], [14, 14, 'C'], [12, 12, 'c'], [13, 5, 'c'],
      [10, 8, 'c'], [15, 9, 'c'],
    ],
    roofs: [],
    signs: [],
    zones: {
      spawnG: [1, 6, 3, 11],
      spawnR: [22, 6, 24, 11],
      mid: [9, 2, 16, 15],
      holdA: [4, 1, 11, 16],
      holdB: [14, 1, 21, 16],
    },
    sites: {},
  },
};

// ---------------------------------------------------------------------------
// Geometry helpers: boxes with world-scaled UVs, merged into one geometry.
// ---------------------------------------------------------------------------
class GeoBuilder {
  constructor() { this.pos = []; this.nor = []; this.uv = []; }
  quad(p0, p1, p2, p3, n, uvs) {
    const P = [p0, p1, p2, p0, p2, p3];
    const U = [uvs[0], uvs[1], uvs[2], uvs[0], uvs[2], uvs[3]];
    for (let i = 0; i < 6; i++) {
      this.pos.push(P[i][0], P[i][1], P[i][2]);
      this.nor.push(n[0], n[1], n[2]);
      this.uv.push(U[i][0], U[i][1]);
    }
  }
  box(x0, y0, z0, x1, y1, z1, s = 0.25, skipBottom = true) {
    // +X
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0],
      [[z1 * s, y0 * s], [z0 * s, y0 * s], [z0 * s, y1 * s], [z1 * s, y1 * s]].map(([u, v]) => [-u, v]));
    // -X
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0],
      [[z0 * s, y0 * s], [z1 * s, y0 * s], [z1 * s, y1 * s], [z0 * s, y1 * s]]);
    // +Z
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1],
      [[x0 * s, y0 * s], [x1 * s, y0 * s], [x1 * s, y1 * s], [x0 * s, y1 * s]]);
    // -Z
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1],
      [[-x1 * s, y0 * s], [-x0 * s, y0 * s], [-x0 * s, y1 * s], [-x1 * s, y1 * s]]);
    // +Y
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0],
      [[x0 * s, z1 * s], [x1 * s, z1 * s], [x1 * s, z0 * s], [x0 * s, z0 * s]]);
    if (!skipBottom) {
      this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0],
        [[x0 * s, z0 * s], [x1 * s, z0 * s], [x1 * s, z1 * s], [x0 * s, z1 * s]]);
    }
  }
  // box whose every face maps the full texture once (crates)
  unitBox(x0, y0, z0, x1, y1, z1, vRepeat = 1) {
    const u = [[0, 0], [1, 0], [1, vRepeat], [0, vRepeat]];
    const t = [[0, 0], [1, 0], [1, 1], [0, 1]];
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], u);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], u);
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], u);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], u);
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], t);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeBoundingSphere();
    return g;
  }
}

// ---------------------------------------------------------------------------
// GameMap
// ---------------------------------------------------------------------------
export class GameMap {
  constructor(def) {
    this.def = def;
    this.W = def.W;
    this.H = def.H;
    this.colliders = [];
    this.group = new THREE.Group();
    this.grid = [];
    for (let r = 0; r < this.H; r++) this.grid.push(new Array(this.W).fill('#'));
    for (const [c0, r0, c1, r1, ch] of def.carves) this.fill(c0, r0, c1, r1, ch);
    for (const w of def.walls || []) this.fill(w[0], w[1], w[2], w[3], '#');
    for (const [c, r, t] of def.props) this.grid[r][c] = t;
    this.buildNav();
  }

  fill(c0, r0, c1, r1, ch) {
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      if (r >= 0 && r < this.H && c >= 0 && c < this.W) this.grid[r][c] = ch;
    }
  }

  cellToWorld(c, r) {
    return { x: (c - this.W / 2 + 0.5) * CELL, z: (r - this.H / 2 + 0.5) * CELL };
  }
  worldToCell(x, z) {
    return { c: Math.floor(x / CELL + this.W / 2), r: Math.floor(z / CELL + this.H / 2) };
  }
  cellAt(x, z) {
    const { c, r } = this.worldToCell(x, z);
    if (r < 0 || r >= this.H || c < 0 || c >= this.W) return '#';
    return this.grid[r][c];
  }
  walkable(c, r) {
    if (r < 0 || r >= this.H || c < 0 || c >= this.W) return false;
    const ch = this.grid[r][c];
    return ch === '.' || ch === 'a' || ch === 'b' || ch === 'G' || ch === 'R';
  }
  inZone(name, x, z) {
    const zr = this.def.zones[name];
    if (!zr) return false;
    const { c, r } = this.worldToCell(x, z);
    return c >= zr[0] && c <= zr[2] && r >= zr[1] && r <= zr[3];
  }
  zoneCells(name) {
    const zr = this.def.zones[name];
    const out = [];
    if (!zr) return out;
    for (let r = zr[1]; r <= zr[3]; r++) for (let c = zr[0]; c <= zr[2]; c++) {
      if (this.walkable(c, r)) out.push({ c, r });
    }
    return out;
  }
  randomPointInZone(name) {
    const cells = this.zoneCells(name);
    const cell = cells[Math.floor(Math.random() * cells.length)];
    const w = this.cellToWorld(cell.c, cell.r);
    return new THREE.Vector3(w.x + (Math.random() - 0.5) * 0.8, 0, w.z + (Math.random() - 0.5) * 0.8);
  }
  zoneCenter(name) {
    const zr = this.def.zones[name];
    const a = this.cellToWorld(zr[0], zr[1]);
    const b = this.cellToWorld(zr[2], zr[3]);
    return new THREE.Vector3((a.x + b.x) / 2, 0, (a.z + b.z) / 2);
  }
  siteAt(x, z) {
    for (const [letter, zone] of Object.entries(this.def.sites)) {
      if (this.inZone(zone, x, z)) return letter;
    }
    return null;
  }

  buildNav() {
    this.nav = [];
    for (let r = 0; r < this.H; r++) {
      const row = [];
      for (let c = 0; c < this.W; c++) row.push(this.walkable(c, r));
      this.nav.push(row);
    }
  }

  // -------------------------------------------------------------------------
  build(scene) {
    const def = this.def;
    const blocks = def.theme === 'blocks';
    const wallTex = blocks ? TEX.blockTexture('#ffffff') : TEX.plasterTexture('#d9c49c', 3);
    const floorTex = blocks ? TEX.tileTexture('#3a5fd0') : TEX.sandTexture();
    const propTex = blocks ? TEX.blockTexture('#ffffff', 64, 64) : null;
    const crateTex = TEX.crateTexture();
    const metalTex = TEX.metalTexture();

    // Floor
    const fw = this.W * CELL, fh = this.H * CELL;
    const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: blocks ? 0.6 : 0.95 });
    floorTex.repeat.set(fw / (blocks ? 4 : 10), fh / (blocks ? 4 : 10));
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.group.add(floor);

    // Walls: greedy-merge '#' cells into rectangles.
    const used = [];
    for (let r = 0; r < this.H; r++) used.push(new Array(this.W).fill(false));
    const wallGeo = new GeoBuilder();
    const H = def.wallHeight;
    for (let r = 0; r < this.H; r++) {
      for (let c = 0; c < this.W; c++) {
        if (used[r][c] || this.grid[r][c] !== '#') continue;
        let c1 = c;
        while (c1 + 1 < this.W && this.grid[r][c1 + 1] === '#' && !used[r][c1 + 1]) c1++;
        let r1 = r;
        outer: while (r1 + 1 < this.H) {
          for (let k = c; k <= c1; k++) if (this.grid[r1 + 1][k] !== '#' || used[r1 + 1][k]) break outer;
          r1++;
        }
        for (let rr = r; rr <= r1; rr++) for (let k = c; k <= c1; k++) used[rr][k] = true;
        const a = this.cellToWorld(c, r), b = this.cellToWorld(c1, r1);
        const x0 = a.x - CELL / 2, z0 = a.z - CELL / 2, x1 = b.x + CELL / 2, z1 = b.z + CELL / 2;
        // Only interior-facing walls need height variety; keep it simple.
        wallGeo.box(x0, 0, z0, x1, H, z1, 0.25);
        this.colliders.push({ minX: x0, minY: -1, minZ: z0, maxX: x1, maxY: H + 20, maxZ: z1, kind: 'wall' });
      }
    }
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: blocks ? 0.7 : 0.92 });
    const walls = new THREE.Mesh(wallGeo.build(), wallMat);
    walls.castShadow = true;
    walls.receiveShadow = true;
    this.group.add(walls);

    // Wall trim at the top (desert) for silhouette
    if (!blocks) {
      const trim = new GeoBuilder();
      for (const col of this.colliders) {
        trim.box(col.minX - 0.12, H, col.minZ - 0.12, col.maxX + 0.12, H + 0.25, col.maxZ + 0.12, 0.5);
      }
      const trimMesh = new THREE.Mesh(trim.build(),
        new THREE.MeshStandardMaterial({ color: 0xb59b72, roughness: 0.9 }));
      trimMesh.castShadow = true;
      this.group.add(trimMesh);
    }

    // Props
    const crateGeo = new GeoBuilder();
    const blockColors = [0xf2c230, 0xe0442f, 0x2fb35a, 0xf08a24];
    const blockGeos = blockColors.map(() => new GeoBuilder());
    const barrels = [];
    let bi = 0;
    for (const [c, r, t] of def.props) {
      const w = this.cellToWorld(c, r);
      if (t === 'o') {
        barrels.push(w);
        this.colliders.push({ minX: w.x - 0.45, minY: 0, minZ: w.z - 0.45, maxX: w.x + 0.45, maxY: 1.2, maxZ: w.z + 0.45, kind: 'prop' });
        continue;
      }
      const h = t === 'C' ? 2.1 : 0.95;
      const s = 0.96;
      const x0 = w.x - s, x1 = w.x + s, z0 = w.z - s, z1 = w.z + s;
      if (blocks) {
        blockGeos[bi++ % blockGeos.length].box(x0, 0, z0, x1, h, z1, 0.5);
      } else if (t === 'C') {
        crateGeo.unitBox(x0, 0, z0, x1, 1.05, z1);
        crateGeo.unitBox(x0 + 0.03, 1.05, z0 + 0.03, x1 - 0.03, h, z1 - 0.03);
      } else {
        crateGeo.unitBox(x0, 0, z0, x1, h, z1);
      }
      this.colliders.push({ minX: x0, minY: 0, minZ: z0, maxX: x1, maxY: h, maxZ: z1, kind: 'prop' });
    }
    if (!blocks) {
      const crates = new THREE.Mesh(crateGeo.build(),
        new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.85 }));
      crates.castShadow = crates.receiveShadow = true;
      this.group.add(crates);
    } else {
      blockGeos.forEach((g, i) => {
        if (!g.pos.length) return;
        const m = new THREE.Mesh(g.build(), new THREE.MeshStandardMaterial({ color: blockColors[i], map: propTex, roughness: 0.5 }));
        m.castShadow = m.receiveShadow = true;
        this.group.add(m);
      });
    }
    if (barrels.length) {
      const bGeo = new THREE.CylinderGeometry(0.42, 0.42, 1.2, 16);
      const bMat = new THREE.MeshStandardMaterial({ map: metalTex, roughness: 0.6, metalness: 0.3, color: 0x7a8f6a });
      const ringMat = new THREE.MeshStandardMaterial({ color: 0x3e4a38, roughness: 0.5, metalness: 0.4 });
      for (const w of barrels) {
        const b = new THREE.Mesh(bGeo, bMat);
        b.position.set(w.x, 0.6, w.z);
        b.castShadow = b.receiveShadow = true;
        this.group.add(b);
        for (const y of [0.3, 0.9]) {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.025, 6, 20), ringMat);
          ring.rotation.x = Math.PI / 2;
          ring.position.set(w.x, y, w.z);
          this.group.add(ring);
        }
      }
    }

    // Roofs (tunnels)
    if (def.roofs.length) {
      const roofGeo = new GeoBuilder();
      for (const [c0, r0, c1, r1, h] of def.roofs) {
        const a = this.cellToWorld(c0, r0), b = this.cellToWorld(c1, r1);
        const x0 = a.x - CELL / 2 - 0.5, z0 = a.z - CELL / 2, x1 = b.x + CELL / 2 + 0.5, z1 = b.z + CELL / 2;
        roofGeo.box(x0, h, z0, x1, h + 0.5, z1, 0.25, false);
        this.colliders.push({ minX: x0, minY: h, minZ: z0, maxX: x1, maxY: h + 0.5, maxZ: z1, kind: 'roof' });
        // support beams
        for (let z = z0 + 1; z < z1; z += 4) roofGeo.box(x0 + 0.5, h - 0.3, z - 0.15, x1 - 0.5, h, z + 0.15, 0.5);
      }
      const roof = new THREE.Mesh(roofGeo.build(), new THREE.MeshStandardMaterial({ map: TEX.concreteTexture(), roughness: 0.95 }));
      roof.castShadow = roof.receiveShadow = true;
      this.group.add(roof);
    }

    // Site decals
    for (const [letter, zone] of Object.entries(def.sites)) {
      const zr = def.zones[zone];
      const a = this.cellToWorld(zr[0], zr[1]), b = this.cellToWorld(zr[2], zr[3]);
      const w = b.x - a.x + CELL, d = b.z - a.z + CELL;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
        new THREE.MeshBasicMaterial({ map: TEX.siteDecalTexture(letter), transparent: true, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.position.set((a.x + b.x) / 2, 0.02, (a.z + b.z) / 2);
      m.renderOrder = 1;
      this.group.add(m);
    }

    // Wall signs
    for (const [c, r, side, text, arrow] of def.signs) {
      const w = this.cellToWorld(c, r);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.1),
        new THREE.MeshBasicMaterial({ map: TEX.wallSignTexture(text, arrow), transparent: true, depthWrite: false }));
      const off = CELL / 2 - 0.02;
      if (side === 'w') { m.position.set(w.x - off, 2.2, w.z); m.rotation.y = Math.PI / 2; }
      if (side === 'e') { m.position.set(w.x + off, 2.2, w.z); m.rotation.y = -Math.PI / 2; }
      if (side === 'n') { m.position.set(w.x, 2.2, w.z - off); }
      if (side === 's') { m.position.set(w.x, 2.2, w.z + off); m.rotation.y = Math.PI; }
      this.group.add(m);
    }

    scene.add(this.group);
  }

  dispose(scene) {
    scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) { if (m.map) m.map.dispose(); m.dispose(); }
      }
    });
  }
}
