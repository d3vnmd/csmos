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
      [40, 6, 'C'], [41, 6, 'c'], [40, 7, 'c'], [36, 11, 'c'], [38, 12, 'C'], [45, 10, 'c'],
      [24, 9, 'b'], [36, 8, 'b'], [9, 12, 'b'], [16, 18, 'b'], [29, 22, 'b'], [4, 26, 'b'],
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
    // raised platforms with stairs; dir = the way you walk to climb the stairs
    platforms: [
      { rect: [2, 11, 4, 13], h: 1.2, stairs: [5, 11, 5, 13], dir: [-1, 0] },
      { rect: [43, 2, 45, 4], h: 1.2, stairs: [42, 2, 42, 4], dir: [1, 0] },
    ],
    // arches over openings: [c0, r0, c1, r1] (one cell thick)
    arches: [[11, 14, 13, 14], [22, 6, 25, 6], [40, 15, 42, 15], [14, 2, 14, 4], [33, 2, 33, 4], [2, 15, 5, 15], [34, 15, 36, 15], [21, 31, 26, 31]],
    paved: [[21, 10, 26, 31], [17, 32, 30, 38], [18, 1, 29, 5], [8, 2, 17, 4], [30, 2, 33, 4]],
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
    platforms: [],
    arches: [],
    paved: [],
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
  // Arbitrary oriented quad: center c, half-extent vectors u and v (unit UVs).
  quadAt(c, u, v, flip = false) {
    const p = (a, b) => [c.x + u.x * a + v.x * b, c.y + u.y * a + v.y * b, c.z + u.z * a + v.z * b];
    const n = new THREE.Vector3().crossVectors(u, v).normalize();
    if (flip) n.negate();
    const pts = [p(-1, -1), p(1, -1), p(1, 1), p(-1, 1)];
    const uvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
    if (flip) { pts.reverse(); uvs.reverse(); }
    this.quad(pts[0], pts[1], pts[2], pts[3], [n.x, n.y, n.z], uvs);
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
function hash(a, b, c = 0) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

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
    this.stairDirs = new Map();
    for (const p of def.platforms || []) {
      this.fill(...p.rect, 'p');
      this.fill(...p.stairs, 's');
      const [c0, r0, c1, r1] = p.stairs;
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) this.stairDirs.set(`${c},${r}`, p.dir);
    }
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
  charAt(c, r) {
    if (r < 0 || r >= this.H || c < 0 || c >= this.W) return '#';
    return this.grid[r][c];
  }
  walkable(c, r) {
    const ch = this.charAt(c, r);
    return ch === '.' || ch === 'a' || ch === 'b' || ch === 'G' || ch === 'R' || ch === 'p' || ch === 's';
  }
  // 0 = ground, 1 = stairs, 2 = platform
  level(c, r) {
    const ch = this.charAt(c, r);
    return ch === 'p' ? 2 : ch === 's' ? 1 : 0;
  }
  // Can a walker go from cell (c, r) to the neighbouring cell (c+dc, r+dr)?
  canStep(c, r, dc, dr) {
    const to = this.charAt(c + dc, r + dr);
    const fromUp = this.level(c, r) > 0;
    if (to === 'p' && !fromUp) return false;
    if (to === 's' && !fromUp) {
      const d = this.stairDirs.get(`${c + dc},${r + dr}`);
      return !!d && d[0] === dc && d[1] === dr;
    }
    return true;
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
      if (this.walkable(c, r) && this.level(c, r) !== 1) out.push({ c, r });
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
    const wallTex2 = blocks ? null : TEX.plasterTexture('#cdb592', 8);
    const floorTex = blocks ? TEX.tileTexture('#3a5fd0') : TEX.sandTexture();
    const propTex = blocks ? TEX.blockTexture('#ffffff', 64, 64) : null;
    const crateTex = TEX.crateTexture();
    const metalTex = TEX.metalTexture();
    const stoneTex = TEX.concreteTexture();

    // Floor
    const fw = this.W * CELL + 200, fh = this.H * CELL + 200;
    const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: blocks ? 0.6 : 0.95 });
    floorTex.repeat.set(fw / (blocks ? 4 : 10), fh / (blocks ? 4 : 10));
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.group.add(floor);

    // Walls: merge '#' cells into blocks of at most 4x4 cells, each with its own height.
    const used = [];
    this.wallH = [];
    for (let r = 0; r < this.H; r++) { used.push(new Array(this.W).fill(false)); this.wallH.push(new Array(this.W).fill(0)); }
    const wallGeo = [new GeoBuilder(), new GeoBuilder()];
    const trim = new GeoBuilder();
    const H0 = def.wallHeight;
    const MAXB = blocks ? 64 : 4;
    const touchesFloor = (c0, r0, c1, r1) => {
      for (let r = r0 - 1; r <= r1 + 1; r++) for (let c = c0 - 1; c <= c1 + 1; c++) {
        if (r >= r0 && r <= r1 && c >= c0 && c <= c1) continue;
        if (this.charAt(c, r) !== '#' && r >= 0 && r < this.H && c >= 0 && c < this.W) return true;
      }
      return false;
    };
    for (let r = 0; r < this.H; r++) {
      for (let c = 0; c < this.W; c++) {
        if (used[r][c] || this.grid[r][c] !== '#') continue;
        let c1 = c;
        while (c1 + 1 < this.W && c1 - c + 1 < MAXB && this.grid[r][c1 + 1] === '#' && !used[r][c1 + 1]) c1++;
        let r1 = r;
        outer: while (r1 + 1 < this.H && r1 - r + 1 < MAXB) {
          for (let k = c; k <= c1; k++) if (this.grid[r1 + 1][k] !== '#' || used[r1 + 1][k]) break outer;
          r1++;
        }
        const hv = hash(c, r, 7);
        const H = blocks ? H0 : H0 + Math.floor(hv * 4) * 0.85;
        for (let rr = r; rr <= r1; rr++) for (let k = c; k <= c1; k++) { used[rr][k] = true; this.wallH[rr][k] = H; }
        const a = this.cellToWorld(c, r), b = this.cellToWorld(c1, r1);
        const x0 = a.x - CELL / 2, z0 = a.z - CELL / 2, x1 = b.x + CELL / 2, z1 = b.z + CELL / 2;
        wallGeo[hv < 0.5 || blocks ? 0 : 1].box(x0, 0, z0, x1, H, z1, 0.25);
        if (!blocks) trim.box(x0 - 0.1, H, z0 - 0.1, x1 + 0.1, H + 0.22, z1 + 0.1, 0.5);
        if (touchesFloor(c, r, c1, r1)) {
          this.colliders.push({ minX: x0, minY: -1, minZ: z0, maxX: x1, maxY: H + 30, maxZ: z1, kind: 'wall' });
        }
      }
    }
    [wallTex, wallTex2].forEach((tex, i) => {
      if (!tex || !wallGeo[i].pos.length) return;
      const m = new THREE.Mesh(wallGeo[i].build(), new THREE.MeshStandardMaterial({ map: tex, roughness: blocks ? 0.7 : 0.93 }));
      m.castShadow = m.receiveShadow = true;
      this.group.add(m);
    });
    if (!blocks) {
      const trimMesh = new THREE.Mesh(trim.build(), new THREE.MeshStandardMaterial({ color: 0xb79c74, roughness: 0.9 }));
      trimMesh.castShadow = trimMesh.receiveShadow = true;
      this.group.add(trimMesh);
      this.buildFacades();
      this.buildSkyline(wallTex);
    }

    // Paved ground (cobbles)
    if (def.paved.length) {
      const cob = TEX.cobbleTexture();
      const pg = new GeoBuilder();
      for (const [c0, r0, c1, r1] of def.paved) {
        const a = this.cellToWorld(c0, r0), b = this.cellToWorld(c1, r1);
        const x0 = a.x - CELL / 2, z0 = a.z - CELL / 2, x1 = b.x + CELL / 2, z1 = b.z + CELL / 2;
        const s = 1 / 6;
        pg.quad([x0, 0.012, z1], [x1, 0.012, z1], [x1, 0.012, z0], [x0, 0.012, z0], [0, 1, 0],
          [[x0 * s, z1 * s], [x1 * s, z1 * s], [x1 * s, z0 * s], [x0 * s, z0 * s]]);
      }
      const pm = new THREE.Mesh(pg.build(), new THREE.MeshStandardMaterial({ map: cob, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1 }));
      pm.receiveShadow = true;
      this.group.add(pm);
      // soft sand drifts over the paving edges and dirt patches
      const drift = new THREE.MeshBasicMaterial({ map: TEX.softCircleTexture(), color: 0xc6a878, transparent: true, opacity: 0.55, depthWrite: false });
      const dirt = new THREE.MeshBasicMaterial({ map: TEX.softCircleTexture(), color: 0x6e5636, transparent: true, opacity: 0.25, depthWrite: false });
      let n = 0;
      for (let r = 0; r < this.H; r++) for (let c = 0; c < this.W; c++) {
        if (!this.walkable(c, r) || this.level(c, r) > 0) continue;
        const h = hash(c, r, 3);
        if (h > 0.2) continue;
        const w = this.cellToWorld(c, r);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), h < 0.12 ? drift : dirt);
        m.rotation.x = -Math.PI / 2;
        m.rotation.z = h * 40;
        const sc = 1.5 + hash(c, r, 9) * 3;
        m.scale.set(sc, sc * 0.6, 1);
        m.position.set(w.x + (hash(r, c, 1) - 0.5) * 1.5, 0.016 + (n++ % 10) * 0.0004, w.z + (hash(r, c, 2) - 0.5) * 1.5);
        m.renderOrder = 1;
        this.group.add(m);
      }
    }

    // Props
    const crateGeo = new GeoBuilder();
    const blockColors = [0xf2c230, 0xe0442f, 0x2fb35a, 0xf08a24];
    const blockGeos = blockColors.map(() => new GeoBuilder());
    const barrels = [], bags = [];
    let bi = 0;
    for (const [c, r, t] of def.props) {
      const w = this.cellToWorld(c, r);
      if (t === 'o') {
        barrels.push(w);
        this.colliders.push({ minX: w.x - 0.45, minY: 0, minZ: w.z - 0.45, maxX: w.x + 0.45, maxY: 1.2, maxZ: w.z + 0.45, kind: 'prop' });
        continue;
      }
      if (t === 'b') {
        // sandbag wall oriented across the longer free axis
        const ns = this.walkable(c, r - 1) && this.walkable(c, r + 1);
        bags.push({ w, alongX: ns });
        const hx = ns ? 0.95 : 0.45, hz = ns ? 0.45 : 0.95;
        this.colliders.push({ minX: w.x - hx, minY: 0, minZ: w.z - hz, maxX: w.x + hx, maxY: 0.95, maxZ: w.z + hz, kind: 'prop' });
        continue;
      }
      const h = t === 'C' ? 2.1 : 0.95;
      const s = 0.96;
      const x0 = w.x - s, x1 = w.x + s, z0 = w.z - s, z1 = w.z + s;
      if (blocks) {
        blockGeos[bi++ % blockGeos.length].box(x0, 0, z0, x1, h, z1, 0.5);
      } else if (t === 'C') {
        crateGeo.unitBox(x0, 0, z0, x1, 1.05, z1);
        const sh = (hash(c, r) - 0.5) * 0.3;
        crateGeo.unitBox(x0 + 0.15 + sh, 1.05, z0 + 0.12, x1 - 0.12 + sh, h, z1 - 0.15);
      } else {
        crateGeo.unitBox(x0, 0, z0, x1, h, z1);
      }
      this.colliders.push({ minX: x0, minY: 0, minZ: z0, maxX: x1, maxY: h, maxZ: z1, kind: 'prop' });
    }
    if (!blocks) {
      const crates = new THREE.Mesh(crateGeo.build(), new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.85 }));
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
      const bGeo = new THREE.CylinderGeometry(0.42, 0.42, 1.2, 20);
      const bMat = new THREE.MeshStandardMaterial({ map: metalTex, roughness: 0.6, metalness: 0.3, color: 0x7a8f6a });
      const ringMat = new THREE.MeshStandardMaterial({ color: 0x3e4a38, roughness: 0.5, metalness: 0.4 });
      const ringGeo = new THREE.TorusGeometry(0.43, 0.025, 6, 24);
      for (const w of barrels) {
        const b = new THREE.Mesh(bGeo, bMat);
        b.position.set(w.x, 0.6, w.z);
        b.rotation.y = hash(w.x | 0, w.z | 0) * 6;
        b.castShadow = b.receiveShadow = true;
        this.group.add(b);
        for (const y of [0.3, 0.9]) {
          const ring = new THREE.Mesh(ringGeo, ringMat);
          ring.rotation.x = Math.PI / 2;
          ring.position.set(w.x, y, w.z);
          this.group.add(ring);
        }
      }
    }
    if (bags.length) {
      const bagGeo = new THREE.CapsuleGeometry(0.16, 0.42, 4, 10);
      bagGeo.rotateZ(Math.PI / 2);
      bagGeo.scale(1, 0.62, 1);
      const bagMat = new THREE.MeshStandardMaterial({ map: TEX.sandbagTexture(), roughness: 0.95 });
      const count = bags.length * 15;
      const inst = new THREE.InstancedMesh(bagGeo, bagMat, count);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
      let i = 0;
      for (const { w, alongX } of bags) {
        for (let row = 0; row < 3; row++) {
          const n = 5 - (row === 2 ? 1 : 0);
          for (let k = 0; k < n; k++) {
            const off = (k - (n - 1) / 2) * 0.38 + (row % 2) * 0.1;
            const jitter = hash(i, row) - 0.5;
            e.set(0, (alongX ? 0 : Math.PI / 2) + jitter * 0.3, jitter * 0.08);
            q.setFromEuler(e);
            m4.compose(new THREE.Vector3(w.x + (alongX ? off : jitter * 0.1), 0.12 + row * 0.24, w.z + (alongX ? jitter * 0.1 : off)), q, new THREE.Vector3(1, 1, 1));
            if (i < count) inst.setMatrixAt(i++, m4);
          }
        }
      }
      inst.count = i;
      inst.castShadow = inst.receiveShadow = true;
      this.group.add(inst);
    }

    // Platforms + stairs
    if ((def.platforms || []).length) {
      const pgeo = new GeoBuilder();
      const edge = new GeoBuilder();
      for (const p of def.platforms) {
        const [c0, r0, c1, r1] = p.rect;
        const a = this.cellToWorld(c0, r0), b = this.cellToWorld(c1, r1);
        const x0 = a.x - CELL / 2, z0 = a.z - CELL / 2, x1 = b.x + CELL / 2, z1 = b.z + CELL / 2;
        pgeo.box(x0, 0, z0, x1, p.h, z1, 0.5);
        edge.box(x0 - 0.04, p.h - 0.12, z0 - 0.04, x1 + 0.04, p.h + 0.02, z1 + 0.04, 1);
        this.colliders.push({ minX: x0, minY: 0, minZ: z0, maxX: x1, maxY: p.h, maxZ: z1, kind: 'prop' });
        // stairs: 4 steps across the stairs cell, rising along dir
        const [s0, t0, s1, t1] = p.stairs;
        const sa = this.cellToWorld(s0, t0), sb = this.cellToWorld(s1, t1);
        const sx0 = sa.x - CELL / 2, sz0 = sa.z - CELL / 2, sx1 = sb.x + CELL / 2, sz1 = sb.z + CELL / 2;
        const steps = 4;
        for (let i = 0; i < steps; i++) {
          const hgt = p.h * (i + 1) / (steps + 1) + 0.02;
          let bx0 = sx0, bx1 = sx1, bz0 = sz0, bz1 = sz1;
          const f0 = i / steps, f1 = 1;
          // dir points uphill; the first step sits at the downhill end
          if (p.dir[0] === 1) { bx0 = sx0 + (sx1 - sx0) * f0; bx1 = sx1; }
          if (p.dir[0] === -1) { bx1 = sx1 - (sx1 - sx0) * f0; bx0 = sx0; }
          if (p.dir[1] === 1) { bz0 = sz0 + (sz1 - sz0) * f0; bz1 = sz1; }
          if (p.dir[1] === -1) { bz1 = sz1 - (sz1 - sz0) * f0; bz0 = sz0; }
          void f1;
          pgeo.box(bx0, 0, bz0, bx1, hgt, bz1, 0.5);
          this.colliders.push({ minX: bx0, minY: 0, minZ: bz0, maxX: bx1, maxY: hgt, maxZ: bz1, kind: 'prop' });
        }
      }
      const pm = new THREE.Mesh(pgeo.build(), new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.9, color: 0xd8c8a8 }));
      pm.castShadow = pm.receiveShadow = true;
      this.group.add(pm);
      const em = new THREE.Mesh(edge.build(), new THREE.MeshStandardMaterial({ color: 0x9a8668, roughness: 0.85 }));
      em.castShadow = true;
      this.group.add(em);
    }

    // Roofs (tunnels)
    if (def.roofs.length) {
      const roofGeo = new GeoBuilder();
      for (const [c0, r0, c1, r1, h] of def.roofs) {
        const a = this.cellToWorld(c0, r0), b = this.cellToWorld(c1, r1);
        const x0 = a.x - CELL / 2 - 0.5, z0 = a.z - CELL / 2, x1 = b.x + CELL / 2 + 0.5, z1 = b.z + CELL / 2;
        roofGeo.box(x0, h, z0, x1, h + 0.5, z1, 0.25, false);
        this.colliders.push({ minX: x0, minY: h, minZ: z0, maxX: x1, maxY: h + 0.5, maxZ: z1, kind: 'roof' });
        for (let z = z0 + 1; z < z1; z += 4) roofGeo.box(x0 + 0.5, h - 0.3, z - 0.15, x1 - 0.5, h, z + 0.15, 0.5);
      }
      const roof = new THREE.Mesh(roofGeo.build(), new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.95 }));
      roof.castShadow = roof.receiveShadow = true;
      this.group.add(roof);
    }

    if ((def.arches || []).length) this.buildArches(wallTex);
    if (!blocks) this.buildCables();

    // Site decals
    for (const [letter, zone] of Object.entries(def.sites)) {
      const zr = def.zones[zone];
      const a = this.cellToWorld(zr[0], zr[1]), b = this.cellToWorld(zr[2], zr[3]);
      const w = b.x - a.x + CELL, d = b.z - a.z + CELL;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
        new THREE.MeshBasicMaterial({ map: TEX.siteDecalTexture(letter), transparent: true, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.position.set((a.x + b.x) / 2, 0.025, (a.z + b.z) / 2);
      m.renderOrder = 2;
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

  // Windows, shutters, doors, sills, drain pipes and a stone skirting on every wall face that meets the street.
  buildFacades() {
    const frame = new GeoBuilder(), glass = new GeoBuilder(), shutters = new GeoBuilder(), doors = new GeoBuilder();
    const skirt = new GeoBuilder(), pipes = new GeoBuilder(), awnings = [new GeoBuilder(), new GeoBuilder(), new GeoBuilder()];
    const lamps = [];
    const archCells = new Set();
    for (const [c0, r0, c1, r1] of this.def.arches || []) {
      for (let r = r0 - 1; r <= r1 + 1; r++) for (let c = c0 - 1; c <= c1 + 1; c++) archCells.add(`${c},${r}`);
    }
    const V = THREE.Vector3;
    for (let r = 0; r < this.H; r++) for (let c = 0; c < this.W; c++) {
      if (this.grid[r][c] !== '#') continue;
      const H = this.wallH[r][c];
      DIRS.forEach(([dc, dr], di) => {
        const nc = c + dc, nr = r + dr;
        if (nr < 0 || nr >= this.H || nc < 0 || nc >= this.W) return;
        const ch = this.grid[nr][nc];
        if (ch === '#') return;
        const w = this.cellToWorld(c, r);
        const n = new V(dc, 0, dr);
        const t = new V(-dr, 0, dc);           // along the face
        const fc = new V(w.x + dc * CELL / 2, 0, w.z + dr * CELL / 2);
        // skirting
        const sk0 = fc.clone().addScaledVector(t, -CELL / 2), sk1 = fc.clone().addScaledVector(t, CELL / 2).addScaledVector(n, 0.07);
        skirt.box(Math.min(sk0.x, sk1.x), 0, Math.min(sk0.z, sk1.z), Math.max(sk0.x, sk1.x), 0.42, Math.max(sk0.z, sk1.z), 0.5);
        const covered = this.level(nc, nr) > 0 || archCells.has(`${c},${r}`) || ch === 'C' || ch === 'c' || ch === 'o' || ch === 'b';
        const h = hash(c, r, di + 11);
        const boxAt = (center, halfT, y0, y1, out) => {
          const p0 = center.clone().addScaledVector(t, -halfT), p1 = center.clone().addScaledVector(t, halfT).addScaledVector(n, out);
          return [Math.min(p0.x, p1.x), y0, Math.min(p0.z, p1.z), Math.max(p0.x, p1.x), y1, Math.max(p0.z, p1.z)];
        };
        if (H >= 5.3 && h < 0.3 && !covered) {
          // upper-floor window
          const y0 = 3.1, y1 = 4.4, hw = 0.52;
          frame.box(...boxAt(fc, hw + 0.08, y1, y1 + 0.12, 0.08), 1);
          frame.box(...boxAt(fc, hw + 0.14, y0 - 0.1, y0, 0.16), 1);     // sill
          frame.box(...boxAt(fc.clone().addScaledVector(t, -hw - 0.04), 0.04, y0, y1, 0.07), 1);
          frame.box(...boxAt(fc.clone().addScaledVector(t, hw + 0.04), 0.04, y0, y1, 0.07), 1);
          frame.box(...boxAt(fc, 0.025, y0, y1, 0.04), 1);
          glass.quadAt(new V(fc.x + n.x * 0.01, (y0 + y1) / 2, fc.z + n.z * 0.01), t.clone().multiplyScalar(hw), new V(0, (y1 - y0) / 2, 0));
          // shutters, swung open at different angles
          for (const s of [-1, 1]) {
            const ang = 0.4 + hash(c, r, di + s + 20) * 1.1;
            const hinge = fc.clone().addScaledVector(t, s * (hw + 0.08)).addScaledVector(n, 0.03);
            const dir = t.clone().multiplyScalar(s * Math.cos(ang)).addScaledVector(n, Math.sin(ang));
            const center = hinge.clone().addScaledVector(dir, hw * 0.5);
            center.y = (y0 + y1) / 2;
            shutters.quadAt(center, dir.clone().multiplyScalar(hw * 0.5), new V(0, (y1 - y0) / 2, 0));
            shutters.quadAt(center, dir.clone().multiplyScalar(hw * 0.5), new V(0, (y1 - y0) / 2, 0), true);
          }
        } else if (h >= 0.3 && h < 0.38 && !covered) {
          // door with frame, lintel and awning
          const hw = 0.65, top = 2.35;
          doors.quadAt(new V(fc.x + n.x * 0.02, top / 2, fc.z + n.z * 0.02), t.clone().multiplyScalar(hw), new V(0, top / 2, 0));
          frame.box(...boxAt(fc, hw + 0.15, top, top + 0.18, 0.1), 1);
          frame.box(...boxAt(fc.clone().addScaledVector(t, -hw - 0.07), 0.07, 0, top, 0.08), 1);
          frame.box(...boxAt(fc.clone().addScaledVector(t, hw + 0.07), 0.07, 0, top, 0.08), 1);
          const aw = awnings[Math.floor(hash(c, r, 99) * 3)];
          const ac = new V(fc.x + n.x * 0.55, top + 0.55, fc.z + n.z * 0.55);
          const slope = new V(n.x * 0.55, -0.25, n.z * 0.55);
          aw.quadAt(ac, t.clone().multiplyScalar(hw + 0.35), slope);
          aw.quadAt(ac, t.clone().multiplyScalar(hw + 0.35), slope, true);
        } else if (h >= 0.38 && h < 0.43) {
          pipes.box(...boxAt(fc.clone().addScaledVector(t, 0.7), 0.05, 0, H, 0.12), 1);
        } else if (h >= 0.43 && h < 0.47 && !covered) {
          lamps.push({ p: new V(fc.x + n.x * 0.25, 3.0, fc.z + n.z * 0.25), n });
        }
      });
    }
    const add = (geo, m, shadow = true) => {
      if (!geo.pos.length) return;
      const mesh = new THREE.Mesh(geo.build(), m);
      mesh.castShadow = shadow;
      mesh.receiveShadow = true;
      this.group.add(mesh);
    };
    add(skirt, new THREE.MeshStandardMaterial({ map: TEX.concreteTexture(), color: 0xbfae90, roughness: 0.95 }), false);
    add(frame, new THREE.MeshStandardMaterial({ color: 0xa88f68, roughness: 0.85 }));
    add(glass, new THREE.MeshStandardMaterial({ color: 0x1c2228, roughness: 0.15, metalness: 0.6 }), false);
    add(shutters, new THREE.MeshStandardMaterial({ map: TEX.shutterTexture('#3d6b74'), roughness: 0.8, side: THREE.DoubleSide }));
    add(doors, new THREE.MeshStandardMaterial({ map: TEX.doorTexture(), roughness: 0.85 }), false);
    add(pipes, new THREE.MeshStandardMaterial({ color: 0x6b6f70, roughness: 0.5, metalness: 0.6 }));
    const awCols = [0xb8432e, 0x2f6e8f, 0xcf9b3a];
    awnings.forEach((g, i) => add(g, new THREE.MeshStandardMaterial({ color: awCols[i], roughness: 0.9, side: THREE.DoubleSide })));
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff1c8, emissive: 0xffd27a, emissiveIntensity: 1.6 });
    const bracketMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.5, metalness: 0.6 });
    for (const { p, n } of lamps) {
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), lampMat);
      bulb.position.copy(p).addScaledVector(n, 0.05);
      bulb.position.y -= 0.12;
      this.group.add(bulb);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.35), bracketMat);
      arm.position.copy(p).addScaledVector(n, -0.1);
      arm.lookAt(arm.position.clone().add(n));
      this.group.add(arm);
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.12, 12, 1, true), bracketMat);
      shade.position.copy(bulb.position);
      shade.position.y += 0.08;
      this.group.add(shade);
    }
  }

  buildArches(wallTex) {
    const tex = wallTex.clone();
    tex.needsUpdate = true;
    tex.repeat.set(0.25, 0.25);
    const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.93 });
    const keyM = new THREE.MeshStandardMaterial({ color: 0xb59b72, roughness: 0.9 });
    for (const [c0, r0, c1, r1] of this.def.arches) {
      const a = this.cellToWorld(c0, r0), b = this.cellToWorld(c1, r1);
      const spanX = r0 === r1;
      const w = spanX ? (c1 - c0 + 1) * CELL : (r1 - r0 + 1) * CELL;
      const H = Math.max(this.def.wallHeight, Math.min(this.wallH[r0 - (spanX ? 0 : 0)]?.[c0 - (spanX ? 1 : 0)] || 0, 9));
      const spring = 2.7;
      const yR = Math.min(w / 2, H - 0.7 - spring);
      const s = new THREE.Shape();
      s.moveTo(-w / 2, spring);
      s.lineTo(-w / 2, H);
      s.lineTo(w / 2, H);
      s.lineTo(w / 2, spring);
      s.absellipse(0, spring, w / 2, yR, 0, Math.PI, false);
      const depth = 0.9;
      const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 20 });
      geo.translate(0, 0, -depth / 2);
      const mesh = new THREE.Mesh(geo, m);
      const cx = (a.x + b.x) / 2, cz = (a.z + b.z) / 2;
      mesh.position.set(cx, 0, cz);
      if (!spanX) mesh.rotation.y = Math.PI / 2;
      mesh.castShadow = mesh.receiveShadow = true;
      this.group.add(mesh);
      const key = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.6, depth + 0.1), keyM);
      key.position.set(0, spring + yR + 0.1, 0);
      mesh.add(key);
      for (const sx of [-1, 1]) {
        const imp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, depth + 0.12), keyM);
        imp.position.set(sx * (w / 2 - 0.1), spring, 0);
        mesh.add(imp);
      }
      const top = spring + yR * 0.75;
      const hw = spanX ? w / 2 : depth / 2, hd = spanX ? depth / 2 : w / 2;
      this.colliders.push({ minX: cx - hw, minY: top, minZ: cz - hd, maxX: cx + hw, maxY: H, maxZ: cz + hd, kind: 'wall' });
    }
  }

  // Sagging power / laundry cables across streets.
  buildCables() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.6 });
    let made = 0;
    for (let r = 1; r < this.H - 1 && made < 14; r++) for (let c = 1; c < this.W - 1 && made < 14; c++) {
      if (this.grid[r][c] !== '#' || hash(c, r, 55) > 0.08) continue;
      for (const [dc, dr] of DIRS) {
        let k = 1;
        while (k < 7 && this.charAt(c + dc * k, r + dr * k) !== '#') k++;
        if (k < 3 || k >= 7 || this.charAt(c + dc * k, r + dr * k) !== '#') continue;
        const a = this.cellToWorld(c, r), b = this.cellToWorld(c + dc * k, r + dr * k);
        const y = 4.2 + hash(c, r, 56) * 0.8;
        const p0 = new THREE.Vector3(a.x + dc * CELL / 2, y, a.z + dr * CELL / 2);
        const p1 = new THREE.Vector3(b.x - dc * CELL / 2, y + 0.2, b.z - dr * CELL / 2);
        const mid = p0.clone().lerp(p1, 0.5);
        mid.y -= 0.6 + k * 0.08;
        const curve = new THREE.QuadraticBezierCurve3(p0, mid, p1);
        const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.015, 5), mat);
        tube.castShadow = true;
        this.group.add(tube);
        made++;
        break;
      }
    }
  }

  // Buildings beyond the playable area for a sense of place.
  buildSkyline(wallTex) {
    const geo = new GeoBuilder();
    const roofs = new GeoBuilder();
    const hw = this.W * CELL / 2, hh = this.H * CELL / 2;
    const domes = [];
    let i = 0;
    const place = (x, z, w, d) => {
      const h = 8 + hash(i, 3) * 9;
      geo.box(x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2, 0.25);
      roofs.box(x - w / 2 - 0.15, h, z - d / 2 - 0.15, x + w / 2 + 0.15, h + 0.3, z + d / 2 + 0.15, 0.5);
      if (hash(i, 9) < 0.12) domes.push([x, h + 0.3, z, Math.min(w, d) * 0.38]);
      i++;
    };
    for (let x = -hw - 10; x < hw + 10; x += 9) {
      place(x + hash(i, 1) * 3, -hh - 6 - hash(i, 2) * 6, 7 + hash(i, 4) * 4, 7 + hash(i, 5) * 4);
      place(x + hash(i, 1) * 3, hh + 6 + hash(i, 2) * 6, 7 + hash(i, 4) * 4, 7 + hash(i, 5) * 4);
    }
    for (let z = -hh; z < hh; z += 9) {
      place(-hw - 6 - hash(i, 2) * 6, z + hash(i, 1) * 3, 7 + hash(i, 4) * 4, 7 + hash(i, 5) * 4);
      place(hw + 6 + hash(i, 2) * 6, z + hash(i, 1) * 3, 7 + hash(i, 4) * 4, 7 + hash(i, 5) * 4);
    }
    const m = new THREE.Mesh(geo.build(), new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95, color: 0xe6dccb }));
    m.receiveShadow = true;
    this.group.add(m);
    this.group.add(new THREE.Mesh(roofs.build(), new THREE.MeshStandardMaterial({ color: 0xa89070, roughness: 0.9 })));
    const domeM = new THREE.MeshStandardMaterial({ color: 0x3f8a8a, roughness: 0.4, metalness: 0.3 });
    for (const [x, y, z, r] of domes) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), domeM);
      d.position.set(x, y, z);
      this.group.add(d);
    }
    // a slim tower with a lantern top
    const tower = new THREE.Group();
    const tm = new THREE.MeshStandardMaterial({ map: wallTex, color: 0xf0e6d4, roughness: 0.9 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.7, 26, 12), tm);
    body.position.y = 13;
    tower.add(body);
    const bal = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.5, 16), tm);
    bal.position.y = 21;
    tower.add(bal);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.3, 3.5, 12), domeM);
    cone.position.y = 27.7;
    tower.add(cone);
    tower.position.set(hw + 14, 0, -hh * 0.4);
    this.group.add(tower);
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
