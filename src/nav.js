// Grid A* pathfinding with string-pulling for the bots.
import * as THREE from 'three';
import { CELL } from './map.js';

class Heap {
  constructor() { this.a = []; }
  push(n) {
    const a = this.a; a.push(n);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]]; i = p;
    }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
  get size() { return this.a.length; }
}

export class Nav {
  constructor(map) {
    this.map = map;
  }

  nearestWalkable(c, r) {
    const m = this.map;
    if (m.nav[r] && m.nav[r][c]) return { c, r };
    for (let rad = 1; rad < 6; rad++) {
      for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) {
        const rr = r + dr, cc = c + dc;
        if (m.nav[rr] && m.nav[rr][cc]) return { c: cc, r: rr };
      }
    }
    return { c, r };
  }

  findPath(from, to) {
    const m = this.map;
    const W = m.W, H = m.H;
    let s = m.worldToCell(from.x, from.z);
    let g = m.worldToCell(to.x, to.z);
    s = this.nearestWalkable(s.c, s.r);
    g = this.nearestWalkable(g.c, g.r);
    const N = W * H;
    const gScore = new Float32Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const si = s.r * W + s.c, gi = g.r * W + g.c;
    gScore[si] = 0;
    const open = new Heap();
    const h = (c, r) => {
      const dx = Math.abs(c - g.c), dy = Math.abs(r - g.r);
      return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
    };
    open.push({ i: si, f: h(s.c, s.r) });
    let found = false, iter = 0;
    while (open.size && iter++ < 4000) {
      const cur = open.pop();
      if (closed[cur.i]) continue;
      if (cur.i === gi) { found = true; break; }
      closed[cur.i] = 1;
      const cr = Math.floor(cur.i / W), cc = cur.i % W;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nr = cr + dr, nc = cc + dc;
        if (nr < 0 || nr >= H || nc < 0 || nc >= W || !m.nav[nr][nc]) continue;
        if (dr && dc && (!m.nav[cr][nc] || !m.nav[nr][cc])) continue; // no corner cutting
        if (!m.canStep(cc, cr, dc, dr)) continue;                    // platforms only via stairs
        const ni = nr * W + nc;
        if (closed[ni]) continue;
        const cost = gScore[cur.i] + (dr && dc ? 1.414 : 1);
        if (cost < gScore[ni]) {
          gScore[ni] = cost;
          came[ni] = cur.i;
          open.push({ i: ni, f: cost + h(nc, nr) });
        }
      }
    }
    if (!found) return null;
    const cells = [];
    let i = gi;
    while (i !== -1) { cells.push(i); i = came[i]; }
    cells.reverse();
    const pts = cells.map((ci) => {
      const w = m.cellToWorld(ci % W, Math.floor(ci / W));
      return new THREE.Vector3(w.x, 0, w.z);
    });
    pts[pts.length - 1] = new THREE.Vector3(to.x, 0, to.z);
    return this.smooth(from, pts);
  }

  // Is the straight walk from a to b clear for a body of radius ~0.45?
  clearLine(a, b) {
    const m = this.map;
    const dx = b.x - a.x, dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.01) return true;
    const nx = -dz / len, nz = dx / len;
    const steps = Math.ceil(len / 0.5);
    const sc = m.worldToCell(a.x, a.z);
    const lvl = m.level(sc.c, sc.r);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = a.x + dx * t, z = a.z + dz * t;
      for (const o of [-0.5, 0, 0.5]) {
        const { c, r } = m.worldToCell(x + nx * o, z + nz * o);
        if (!m.nav[r] || !m.nav[r][c] || m.level(c, r) !== lvl) return false;
      }
    }
    return true;
  }

  smooth(from, pts) {
    const out = [];
    let cur = new THREE.Vector3(from.x, 0, from.z);
    let i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !this.clearLine(cur, pts[j])) j--;
      out.push(pts[j]);
      cur = pts[j];
      i = j + 1;
    }
    return out;
  }
}

export { CELL };
