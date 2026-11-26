// Keyboard / mouse input for the local player.
import { clamp } from './util.js';

export class Input {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = [false, false, false];
    this.mousePressed = [false, false, false];
    this.dx = 0; this.dy = 0;
    this.lastDX = 0; this.lastDY = 0;
    this.wheel = 0;
    this.locked = false;
    this.enabled = false;

    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (['Tab', 'Space', 'ControlLeft', 'KeyB'].includes(e.code) || e.code.startsWith('Digit')) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); });
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse = [false, false, false]; });
    window.addEventListener('mousedown', (e) => {
      if (!this.enabled || !this.locked) return;
      this.mouse[e.button] = true;
      this.mousePressed[e.button] = true;
    });
    window.addEventListener('mouseup', (e) => { this.mouse[e.button] = false; });
    window.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.dx += e.movementX;
      this.dy += e.movementY;
    });
    window.addEventListener('wheel', (e) => { if (this.locked) this.wheel += Math.sign(e.deltaY); }, { passive: true });
    window.addEventListener('contextmenu', (e) => { if (this.enabled) e.preventDefault(); });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) { this.mouse = [false, false, false]; }
      if (this.onLockChange) this.onLockChange(this.locked);
    });
  }

  lock() {
    try {
      const p = this.canvas.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) {
        p.catch(() => {
          try { const q = this.canvas.requestPointerLock(); if (q && q.catch) q.catch(() => {}); } catch (e) { /* ignore */ }
        });
      }
    } catch (e) {
      try { this.canvas.requestPointerLock(); } catch (e2) { /* ignore */ }
    }
  }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }

  wasPressed(code) { return this.pressed.has(code); }

  endFrame() {
    this.pressed.clear();
    this.mousePressed = [false, false, false];
    this.wheel = 0;
  }

  // Translate input into the player's control state. Called by the game each frame.
  apply(game, p, dt) {
    const c = p.ctrl;
    const s = this.settings;
    this.lastDX = this.dx; this.lastDY = this.dy;
    if (this.uiBlocked) { this.dx = this.dy = 0; c.mx = c.mz = 0; c.fire = false; c.use = false; return; }
    if (!p.alive) {
      if (this.mousePressed[0]) game.cycleSpectate();
      this.dx = this.dy = 0;
      return;
    }
    // look
    const w = game.cur(p);
    let zoom = 1;
    if (p.scoped && w && w.def.scope) zoom = w.def.scope[p.scoped - 1] / (s.fov || 74) * (s.zoomSens || 1);
    const k = 0.0022 * s.sensitivity * zoom;
    p.yaw -= this.dx * k;
    p.pitch -= this.dy * k * (s.invertY ? -1 : 1);
    p.pitch = clamp(p.pitch, -1.5, 1.5);
    this.dx = this.dy = 0;

    // movement
    let f = 0, r = 0;
    if (this.keys.has('KeyW')) f += 1;
    if (this.keys.has('KeyS')) f -= 1;
    if (this.keys.has('KeyD')) r += 1;
    if (this.keys.has('KeyA')) r -= 1;
    const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
    c.mx = -sy * f + cy * r;
    c.mz = -cy * f - sy * r;
    const l = Math.hypot(c.mx, c.mz);
    if (l > 1) { c.mx /= l; c.mz /= l; }
    c.jump = this.keys.has('Space');
    c.crouch = this.keys.has('ControlLeft') || this.keys.has('KeyC');
    c.walk = this.keys.has('ShiftLeft');
    c.fire = this.mouse[0];
    c.firePressed = this.mousePressed[0];
    c.alt = this.mousePressed[2];
    c.use = this.keys.has('KeyE');

    // actions
    if (this.wasPressed('KeyR')) game.reload(p);
    if (this.wasPressed('Digit1')) game.switchTo(p, 'primary');
    if (this.wasPressed('Digit2')) game.switchTo(p, 'secondary');
    if (this.wasPressed('Digit3')) game.switchTo(p, 'knife');
    if (this.wasPressed('Digit4')) game.switchTo(p, 'grenade');
    if (this.wasPressed('Digit5')) game.switchTo(p, 'bomb');
    if (this.wasPressed('KeyQ')) game.switchTo(p, game.has(p, p.prev) ? p.prev : game.bestSlot(p));
    if (this.wasPressed('KeyG')) {
      if (p.cur === 'bomb') game.dropBomb(p);
      else if (p.cur === 'primary' || p.cur === 'secondary') game.dropWeapon(p, p.cur);
    }
    if (this.wasPressed('KeyE')) {
      const nearBomb = game.bomb.state === 'planted' && p.team === 'G' && p.pos.distanceTo(game.bomb.pos) < 1.8;
      const canPlant = p.inv.bomb && game.map.siteAt(p.pos.x, p.pos.z);
      if (!nearBomb && !canPlant) game.swapPickup(p);
    }
    if (this.wheel) {
      const order = ['primary', 'secondary', 'knife', 'grenade', 'bomb'].filter((sl) => game.has(p, sl));
      const i = order.indexOf(p.cur);
      const n = order[(i + (this.wheel > 0 ? 1 : -1) + order.length) % order.length];
      game.switchTo(p, n);
    }
  }
}
