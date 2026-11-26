// Character movement against axis-aligned colliders, and world raycasts.
import { rayAABB, rayHitNormal } from './util.js';

export const GRAVITY = 18;
export const JUMP_V = 6.1;
export const RADIUS = 0.38;
export const STAND_H = 1.8;
export const CROUCH_H = 1.25;
export const RUN_SPEED = 6.0;

const tmpBox = { minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0 };

function agentBox(a, h) {
  tmpBox.minX = a.pos.x - RADIUS; tmpBox.maxX = a.pos.x + RADIUS;
  tmpBox.minY = a.pos.y; tmpBox.maxY = a.pos.y + h;
  tmpBox.minZ = a.pos.z - RADIUS; tmpBox.maxZ = a.pos.z + RADIUS;
  return tmpBox;
}

function overlaps(b, c) {
  return b.minX < c.maxX && b.maxX > c.minX && b.minY < c.maxY && b.maxY > c.minY && b.minZ < c.maxZ && b.maxZ > c.minZ;
}

export function agentHeight(a) {
  return STAND_H + (CROUCH_H - STAND_H) * a.crouch;
}

// Would an agent fit at (x, z) without overlapping level geometry?
export function fitsAt(a, x, z, colliders) {
  const h = agentHeight(a);
  const b = { minX: x - RADIUS, maxX: x + RADIUS, minY: a.pos.y + 0.01, maxY: a.pos.y + h, minZ: z - RADIUS, maxZ: z + RADIUS };
  for (const c of colliders) if (overlaps(b, c)) return false;
  return true;
}

export function canStand(a, colliders) {
  const b = agentBox(a, STAND_H);
  for (const c of colliders) if (overlaps(b, c)) return false;
  return true;
}

// wishX/wishZ: desired horizontal direction (length 0..1). maxSpeed in m/s.
export function moveAgent(a, wishX, wishZ, maxSpeed, wantJump, dt, colliders) {
  const v = a.vel;
  const onGround = a.onGround;
  // friction
  if (onGround) {
    const sp = Math.hypot(v.x, v.z);
    if (sp > 0.001) {
      const control = Math.max(sp, 2.5);
      const drop = control * 7.5 * dt;
      const ns = Math.max(0, sp - drop) / sp;
      v.x *= ns; v.z *= ns;
    }
  }
  // acceleration
  const wl = Math.hypot(wishX, wishZ);
  if (wl > 0.001) {
    const dx = wishX / wl, dz = wishZ / wl;
    let wishSpeed = maxSpeed * Math.min(1, wl);
    const accel = onGround ? 11 : 2.2;
    if (!onGround) wishSpeed = Math.min(wishSpeed, 1.2);
    const cur = v.x * dx + v.z * dz;
    const add = wishSpeed - cur;
    if (add > 0) {
      const acc = Math.min(accel * maxSpeed * dt, add);
      v.x += acc * dx; v.z += acc * dz;
    }
  }
  if (onGround && wantJump) {
    v.y = JUMP_V;
    a.onGround = false;
    a.jumped = true;
  }
  v.y -= GRAVITY * dt;

  const h = agentHeight(a);
  // X axis
  a.pos.x += v.x * dt;
  let b = agentBox(a, h);
  for (const c of colliders) {
    if (overlaps(b, c)) {
      if (v.x > 0) a.pos.x = c.minX - RADIUS - 0.001; else if (v.x < 0) a.pos.x = c.maxX + RADIUS + 0.001;
      v.x = 0;
      b = agentBox(a, h);
    }
  }
  // Z axis
  a.pos.z += v.z * dt;
  b = agentBox(a, h);
  for (const c of colliders) {
    if (overlaps(b, c)) {
      if (v.z > 0) a.pos.z = c.minZ - RADIUS - 0.001; else if (v.z < 0) a.pos.z = c.maxZ + RADIUS + 0.001;
      v.z = 0;
      b = agentBox(a, h);
    }
  }
  // Y axis
  const wasGround = a.onGround;
  a.onGround = false;
  a.pos.y += v.y * dt;
  b = agentBox(a, h);
  for (const c of colliders) {
    if (overlaps(b, c)) {
      if (v.y <= 0) { a.pos.y = c.maxY; a.onGround = true; }
      else { a.pos.y = c.minY - h - 0.001; }
      v.y = 0;
      b = agentBox(a, h);
    }
  }
  if (a.pos.y <= 0) {
    a.pos.y = 0;
    if (v.y < 0) v.y = 0;
    a.onGround = true;
  }
  a.landed = !wasGround && a.onGround;
}

// Raycast against level geometry. Returns {t, nx, ny, nz, kind} or null.
export function raycastWorld(colliders, ox, oy, oz, dx, dy, dz, maxT) {
  let best = maxT, hit = null;
  for (const c of colliders) {
    const t = rayAABB(ox, oy, oz, dx, dy, dz, c, best);
    if (t >= 0 && t < best) {
      best = t;
      hit = { t, nx: rayHitNormal.x, ny: rayHitNormal.y, nz: rayHitNormal.z, kind: c.kind };
    }
  }
  // floor plane
  if (dy < 0) {
    const t = -oy / dy;
    if (t >= 0 && t < best) {
      best = t;
      hit = { t, nx: 0, ny: 1, nz: 0, kind: 'floor' };
    }
  }
  return hit;
}

export function lineClear(colliders, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  const len = Math.hypot(dx, dy, dz);
  if (len < 0.001) return true;
  const h = raycastWorld(colliders, a.x, a.y, a.z, dx / len, dy / len, dz / len, len);
  return !h;
}
