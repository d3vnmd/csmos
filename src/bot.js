// Bot AI: buying, objective play, navigation and gunfights.
import * as THREE from 'three';
import { WEAPONS } from './weapons.js';
import { agentHeight } from './physics.js';
import { lineClear } from './physics.js';
import { clamp, rand, pick, angleDiff, approachAngle, dirFromAngles } from './util.js';

export const DIFFICULTY = {
  easy: { react: 0.6, turn: 4.5, err: 0.42, settle: 0.9, head: 0.12, comp: 0.3, fov: 1.0, burst: 3 },
  normal: { react: 0.34, turn: 7.5, err: 0.24, settle: 0.6, head: 0.3, comp: 0.6, fov: 1.2, burst: 4 },
  hard: { react: 0.2, turn: 12, err: 0.1, settle: 0.38, head: 0.55, comp: 0.85, fov: 1.45, burst: 6 },
};

const _eye = new THREE.Vector3();
const _tgt = new THREE.Vector3();

function diff(game) { return DIFFICULTY[game.difficulty] || DIFFICULTY.normal; }

export function initBotRound(game, a) {
  const b = a.bot;
  const map = game.map;
  Object.assign(b, {
    path: null, pathIdx: 0, goal: null, via: null, repathT: 0, thinkT: Math.random() * 0.1,
    target: null, lastSeenT: -10, lastSeenPos: null, acquireT: 0, reactT: 0, aimHead: false,
    errVec: new THREE.Vector3(), errT: 0, burstLeft: 0, pauseUntil: 0, strafeDir: 1, strafeT: 0,
    heard: null, heardT: -10, alertFrom: null, stuckT: 0, lastPos: a.pos.clone(), holdLook: a.yaw,
    holdT: 0, crouchHold: false, nade: null, smokeUsed: false, nadeTried: false,
  });
  if (!game.mode.bomb) {
    b.role = 'hunt';
    b.goal = map.randomPointInZone('mid');
    return;
  }
  if (game.planRound !== game.round) {
    game.planRound = game.round;
    game.raiderPlan = pick(['A', 'B']);
  }
  const site = game.raiderPlan;
  if (a.team === 'R') {
    b.role = 'attack';
    b.site = site;
    const viaOptions = site === 'A' ? ['aLong', 'aLong', 'mid'] : ['bLane', 'bLane', 'mid'];
    b.via = map.randomPointInZone(pick(viaOptions));
    b.goal = map.randomPointInZone(site === 'A' ? 'holdA' : 'holdB');
  } else {
    const gs = game.agents.filter((x) => x.team === 'G' && x.bot);
    const idx = gs.indexOf(a);
    const roles = ['A', 'B', 'mid', 'A', 'B'];
    b.role = 'defend';
    b.site = roles[idx % roles.length];
    const zone = b.site === 'A' ? 'holdA' : b.site === 'B' ? 'holdB' : 'mid';
    b.goal = map.randomPointInZone(zone);
    const looks = b.site === 'A' ? ['aLong', 'mid'] : b.site === 'B' ? ['bLane', 'mid'] : ['spawnR'];
    b.lookZones = looks;
  }
}

export function botBuy(game, a) {
  if (!game.mode.buy) return;
  const d = game.difficulty;
  const pistolRound = game.round === 1 || game.history.length === game.mode.half;
  const rifle = a.team === 'R' ? 'vanguard' : 'sentinel';
  const rp = WEAPONS[rifle].price;
  const tryBuy = (id) => game.buy(a, id);
  if (pistolRound) {
    if (Math.random() < 0.5) tryBuy('kevlar');
    else if (Math.random() < 0.5) tryBuy('thunder');
    else tryBuy('smoke');
    if (a.team === 'G' && Math.random() < 0.3) tryBuy('kit');
    return;
  }
  if (!a.inv.primary) {
    const m = a.money;
    if (m >= 5750 && Math.random() < (d === 'hard' ? 0.25 : 0.12)) tryBuy('longbow');
    else if (m >= rp + 650) tryBuy(rifle);
    else if (m >= 2050 + 650 && Math.random() < 0.6) tryBuy('ranger');
    else if (m >= 1250 + 650 && Math.random() < 0.5) tryBuy(Math.random() < 0.75 ? 'hornet' : 'breacher');
  }
  if (a.money >= 1000) tryBuy('helmet');
  else if (a.money >= 650) tryBuy('kevlar');
  if (a.team === 'G' && a.money >= 400) tryBuy('kit');
  if (a.money >= 300 && Math.random() < 0.7) tryBuy(Math.random() < 0.5 ? 'frag' : 'smoke');
  if (a.money >= 300 && Math.random() < 0.4) tryBuy(Math.random() < 0.5 ? 'frag' : 'smoke');
}

function setGoal(game, a, goal) {
  const b = a.bot;
  if (b.goal && goal && b.goal.distanceToSquared(goal) < 1) return;
  b.goal = goal;
  b.path = null;
}

function followPath(game, a, dt) {
  const b = a.bot;
  const c = a.ctrl;
  const dest = b.via || b.goal;
  if (!dest) { c.mx = c.mz = 0; return false; }
  const dx = dest.x - a.pos.x, dz = dest.z - a.pos.z;
  if (Math.hypot(dx, dz) < 0.7) {
    if (b.via) { b.via = null; b.path = null; return true; }
    c.mx = c.mz = 0;
    return false;
  }
  if (!b.path || game.time > b.repathT) {
    b.path = game.nav.findPath(a.pos, dest) || [];
    b.pathIdx = 0;
    b.repathT = game.time + 4;
  }
  let wp = b.path[b.pathIdx];
  while (wp && Math.hypot(wp.x - a.pos.x, wp.z - a.pos.z) < 0.6) {
    b.pathIdx++;
    wp = b.path[b.pathIdx];
  }
  if (!wp) { b.path = null; c.mx = c.mz = 0; return false; }
  const mx = wp.x - a.pos.x, mz = wp.z - a.pos.z;
  const l = Math.hypot(mx, mz);
  c.mx = mx / l; c.mz = mz / l;
  // stuck detection
  b.stuckT += dt;
  if (b.stuckT > 1) {
    if (a.pos.distanceTo(b.lastPos) < 0.35) {
      b.path = null;
      c.jump = true;
      // sidestep randomly
      c.mx += rand(-1, 1); c.mz += rand(-1, 1);
    }
    b.lastPos.copy(a.pos);
    b.stuckT = 0;
  }
  return true;
}

function findTarget(game, a, D) {
  const b = a.bot;
  game.eyePos(a, _eye);
  let best = null, bd = Infinity;
  for (const e of game.agents) {
    if (!e.alive || e.team === a.team) continue;
    const d = a.pos.distanceTo(e.pos);
    if (d > 95) continue;
    const dx = e.pos.x - a.pos.x, dz = e.pos.z - a.pos.z;
    const ang = Math.abs(angleDiff(a.yaw, Math.atan2(-dx, -dz)));
    const aware = b.target === e || b.alertFrom === e || (b.heard && game.time - b.heardT < 1.5 && e.pos.distanceTo(b.heard) < 6) || d < 4;
    if (ang > D.fov && !aware) continue;
    const h = agentHeight(e);
    let seen = false;
    for (const fy of [h - 0.15, h * 0.6]) {
      _tgt.set(e.pos.x, e.pos.y + fy, e.pos.z);
      if (lineClear(game.colliders, _eye, _tgt) && !game.effects.smokeBlocks(_eye, _tgt)) { seen = true; break; }
    }
    if (!seen) continue;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

function aimAt(a, point, D, dt, comp) {
  const eye = _eye;
  const dx = point.x - eye.x, dy = point.y - eye.y, dz = point.z - eye.z;
  const yaw = Math.atan2(-dx, -dz);
  const pitch = Math.atan2(dy, Math.hypot(dx, dz)) - a.recoil.p * comp;
  const yawT = yaw - a.recoil.y * comp;
  a.yaw = approachAngle(a.yaw, yawT, D.turn * dt * (1 + Math.abs(angleDiff(a.yaw, yawT))));
  a.pitch = approachAngle(a.pitch, pitch, D.turn * dt * 0.8);
  a.pitch = clamp(a.pitch, -1.4, 1.4);
  return Math.abs(angleDiff(a.yaw, yawT)) + Math.abs(a.pitch - pitch);
}

function lookToward(a, x, z, D, dt, pitch = 0) {
  const yaw = Math.atan2(-(x - a.pos.x), -(z - a.pos.z));
  a.yaw = approachAngle(a.yaw, yaw, D.turn * 0.5 * dt);
  a.pitch = approachAngle(a.pitch, pitch, 2 * dt);
}

export function updateBot(game, a, dt) {
  const b = a.bot;
  const c = a.ctrl;
  const D = diff(game);
  c.fire = false; c.jump = false; c.use = false; c.walk = false; c.alt = false;
  if (game.phase === 'freeze' || game.phase === 'matchEnd') { c.mx = c.mz = 0; return; }

  // ---- perception (10 Hz)
  b.thinkT -= dt;
  if (b.thinkT <= 0) {
    b.thinkT = 0.1;
    const t = findTarget(game, a, D);
    if (t) {
      if (b.target !== t || game.time - b.lastSeenT > 1.2) {
        b.acquireT = game.time;
        b.reactT = game.time + D.react * rand(0.8, 1.3);
        b.aimHead = Math.random() < D.head;
        b.burstLeft = 0;
      }
      b.target = t;
      b.lastSeenT = game.time;
      b.lastSeenPos = t.pos.clone();
      b.nadeTried = false;
    } else if (b.target && (!b.target.alive || game.time - b.lastSeenT > 4)) {
      b.target = null;
    }
    if (b.alertFrom && !b.alertFrom.alive) b.alertFrom = null;
    objective(game, a, D);
  }

  const w = game.cur(a);
  const visible = b.target && b.target.alive && game.time - b.lastSeenT < 0.25;

  // ---- grenade plan
  if (b.nade && !visible) {
    const nd = b.nade;
    const gi = a.inv.grenade.findIndex((g) => g.def.id === nd.id);
    if (gi < 0 || game.time > nd.until) { b.nade = null; }
    else {
      if (a.cur !== 'grenade' || a.inv.grenade[0].def.id !== nd.id) {
        while (a.inv.grenade[0].def.id !== nd.id) a.inv.grenade.push(a.inv.grenade.shift());
        game.switchTo(a, 'grenade', true);
      }
      game.eyePos(a, _eye);
      const dist = Math.hypot(nd.pos.x - a.pos.x, nd.pos.z - a.pos.z);
      const yaw = Math.atan2(-(nd.pos.x - a.pos.x), -(nd.pos.z - a.pos.z));
      a.yaw = approachAngle(a.yaw, yaw, D.turn * dt);
      a.pitch = approachAngle(a.pitch, clamp(0.05 + dist * 0.012, 0.05, 0.5), 3 * dt);
      c.mx = c.mz = 0;
      if (a.switchT <= 0 && Math.abs(angleDiff(a.yaw, yaw)) < 0.08) {
        c.fire = true;
        b.nade = null;
      }
      return;
    }
  }

  // ---- combat
  if (visible) {
    const t = b.target;
    const dist = a.pos.distanceTo(t.pos);
    // make sure we hold a gun with ammo
    if (!w || w.def.type === 'grenade' || w.def.type === 'bomb' || (w.def.type === 'knife' && (a.inv.primary || a.inv.secondary))) {
      game.switchTo(a, game.bestSlot(a), true);
    } else if (w.mag === 0 && w.reserve === 0 && a.cur === 'primary' && a.inv.secondary) {
      game.switchTo(a, 'secondary', true);
    } else if (w.mag === 0 && w.reloadLeft <= 0) {
      game.reload(a);
    }
    // aim point with settling error
    const h = agentHeight(t);
    const since = game.time - b.acquireT;
    if (game.time > b.errT) {
      b.errT = game.time + 0.22;
      const tm = Math.hypot(t.vel.x, t.vel.z) > 2 ? 1.4 : 1;
      const e = D.err * (1 + 2.5 * Math.exp(-since / D.settle)) * tm * clamp(dist / 15, 0.5, 2);
      b.errVec.set(rand(-1, 1), rand(-0.6, 0.6), rand(-1, 1)).multiplyScalar(e);
    }
    _tgt.set(t.pos.x, t.pos.y + (b.aimHead ? h - 0.15 : h * 0.66), t.pos.z).add(b.errVec);
    game.eyePos(a, _eye);
    const angErr = aimAt(a, _tgt, D, dt, D.comp);
    const tol = Math.max(0.03, Math.atan2(0.4, dist));
    const cw = game.cur(a);
    // scope
    if (cw && cw.def.scope && !a.scoped && !a.rescope && dist > 6 && cw.reloadLeft <= 0) a.scoped = 1;
    // fire
    if (cw && game.time >= b.reactT && angErr < tol * 1.6 && cw.reloadLeft <= 0) {
      if (cw.def.auto) {
        if (game.time >= b.pauseUntil) {
          if (b.burstLeft <= 0) b.burstLeft = dist > 22 ? rand(2, 4) | 0 : dist > 12 ? D.burst + 2 : 30;
          c.fire = true;
          if (game.time >= cw.nextFire) {
            b.burstLeft--;
            if (b.burstLeft <= 0) b.pauseUntil = game.time + rand(0.25, 0.5) + cw.def.rate;
          }
        }
      } else if (game.time >= cw.nextFire + rand(0.02, 0.18)) {
        c.fire = true;
      }
    }
    // movement during fight
    const type = cw ? cw.def.type : 'rifle';
    if (type === 'knife') {
      const l = Math.max(0.01, dist);
      c.mx = (t.pos.x - a.pos.x) / l; c.mz = (t.pos.z - a.pos.z) / l;
    } else if (type === 'pistol' || type === 'smg' || type === 'shotgun') {
      b.strafeT -= dt;
      if (b.strafeT <= 0) { b.strafeT = rand(0.35, 0.8); b.strafeDir = -b.strafeDir; }
      const sx = Math.cos(a.yaw), sz = -Math.sin(a.yaw);
      const moving = !c.fire || type === 'smg';
      c.mx = moving ? sx * b.strafeDir : 0; c.mz = moving ? sz * b.strafeDir : 0;
      if (type === 'shotgun' && dist > 8) { const l = dist; c.mx += (t.pos.x - a.pos.x) / l; c.mz += (t.pos.z - a.pos.z) / l; }
    } else {
      // rifles / snipers: counter-strafe and shoot, peek between bursts
      if (c.fire || game.time < b.reactT + 0.1) { c.mx = c.mz = 0; }
      else {
        b.strafeT -= dt;
        if (b.strafeT <= 0) { b.strafeT = rand(0.3, 0.6); b.strafeDir = -b.strafeDir; }
        c.mx = Math.cos(a.yaw) * b.strafeDir * 0.6; c.mz = -Math.sin(a.yaw) * b.strafeDir * 0.6;
      }
      c.crouch = game.difficulty !== 'easy' && dist > 18 && b.crouchHold;
    }
    // keep planting/defusing if committed and close to finishing
    if (a.defusing > 0 && (a.kit ? 5 : 10) - a.defusing < 1.5) { c.use = true; c.fire = false; c.mx = c.mz = 0; }
    return;
  }

  // ---- no visible enemy
  c.crouch = false;
  if (w && w.def.mag && w.mag < w.def.mag * 0.4 && w.reserve > 0 && game.time - b.lastSeenT > 1.5) game.reload(a);
  if (w && (w.def.type === 'grenade' || w.def.type === 'bomb') && !b.nade && a.planting === 0) game.switchTo(a, game.bestSlot(a), true);
  if (w && w.def.type === 'knife' && (a.inv.primary || a.inv.secondary)) game.switchTo(a, game.bestSlot(a), true);
  if (a.scoped && game.time - b.lastSeenT > 2) a.scoped = 0;

  // frag at the last known position
  if (b.lastSeenPos && !b.nadeTried && game.time - b.lastSeenT > 0.5 && game.time - b.lastSeenT < 2.5) {
    b.nadeTried = true;
    const d = a.pos.distanceTo(b.lastSeenPos);
    if (d > 7 && d < 26 && a.inv.grenade.some((g) => g.def.id === 'frag') && Math.random() < 0.5) {
      b.nade = { id: 'frag', pos: b.lastSeenPos.clone(), until: game.time + 2 };
      return;
    }
  }

  const moving = followPath(game, a, dt);
  if (b.useTarget) {
    // planting / defusing
    if (a.pos.distanceTo(b.useTarget) < (a.team === 'G' ? 1.4 : 1.0) || (a.team === 'R' && game.map.siteAt(a.pos.x, a.pos.z) && !b.goal)) {
      c.use = true;
      c.mx = c.mz = 0;
    }
  }
  if (b.target && b.lastSeenPos && game.time - b.lastSeenT < 3) {
    game.eyePos(a, _eye);
    lookToward(a, b.lastSeenPos.x, b.lastSeenPos.z, D, dt * 2);
  } else if (b.heard && game.time - b.heardT < 2) {
    lookToward(a, b.heard.x, b.heard.z, D, dt * 2);
  } else if (b.alertFrom && b.alertFrom.alive && game.time - a.lastHurt < 2) {
    lookToward(a, b.alertFrom.pos.x, b.alertFrom.pos.z, D, dt * 3);
  } else if (moving && (c.mx || c.mz)) {
    lookToward(a, a.pos.x + c.mx, a.pos.z + c.mz, D, dt);
  } else {
    b.holdT -= dt;
    if (b.holdT <= 0) {
      b.holdT = rand(2, 4);
      if (b.lookZones) {
        const p = game.map.zoneCenter(pick(b.lookZones));
        b.holdLook = Math.atan2(-(p.x - a.pos.x), -(p.z - a.pos.z)) + rand(-0.4, 0.4);
      } else b.holdLook = a.yaw + rand(-1.2, 1.2);
      b.crouchHold = Math.random() < 0.3;
    }
    a.yaw = approachAngle(a.yaw, b.holdLook, 2.5 * dt);
    a.pitch = approachAngle(a.pitch, 0, 2 * dt);
    if (b.role === 'defend' && b.crouchHold && game.difficulty !== 'easy') c.crouch = true;
  }
}

// Decide what to do strategically. Runs at 10 Hz.
function objective(game, a, D) {
  const b = a.bot;
  const bomb = game.bomb;
  const map = game.map;
  b.useTarget = null;

  if (!game.mode.bomb) {
    // duel: roam and hunt
    if (!b.goal || a.pos.distanceTo(b.goal) < 1.5) {
      const enemy = game.agents.find((e) => e.alive && e.team !== a.team);
      if (enemy && Math.random() < 0.5) setGoal(game, a, enemy.pos.clone());
      else setGoal(game, a, map.randomPointInZone(pick(['mid', 'holdA', 'holdB'])));
    }
    return;
  }

  if (a.team === 'R') {
    if (bomb.state === 'dropped') {
      // closest raider goes for it
      let closest = null, cd = Infinity;
      for (const r of game.agents) {
        if (!r.alive || r.team !== 'R' || !r.bot) continue;
        const d = r.pos.distanceTo(bomb.pos);
        if (d < cd) { cd = d; closest = r; }
      }
      if (closest === a) { b.via = null; setGoal(game, a, bomb.pos.clone()); return; }
    }
    if (a.inv.bomb) {
      const zone = b.site === 'A' ? 'siteA' : 'siteB';
      if (map.siteAt(a.pos.x, a.pos.z)) {
        if (!b.plantSpot || !map.siteAt(b.plantSpot.x, b.plantSpot.z)) b.plantSpot = a.pos.clone();
        b.useTarget = b.plantSpot;
        b.goal = null; b.via = null;
        return;
      }
      if (!b.goal || !map.inZone(zone, b.goal.x, b.goal.z)) setGoal(game, a, map.randomPointInZone(zone));
      return;
    }
    if (bomb.state === 'planted') {
      if (!b.goal || b.goal.distanceTo(bomb.pos) > 9) {
        b.via = null;
        const off = new THREE.Vector3(rand(-6, 6), 0, rand(-6, 6)).add(bomb.pos);
        const cell = map.worldToCell(off.x, off.z);
        setGoal(game, a, map.walkable(cell.c, cell.r) ? off : bomb.pos.clone());
      }
      b.lookZones = null;
      return;
    }
    // throw a smoke when approaching the site
    if (!b.smokeUsed && a.inv.grenade.some((g) => g.def.id === 'smoke')) {
      const sc = map.zoneCenter(b.site === 'A' ? 'siteA' : 'siteB');
      const d = a.pos.distanceTo(sc);
      if (d < 24 && d > 10) {
        b.smokeUsed = true;
        b.nade = { id: 'smoke', pos: sc.add(new THREE.Vector3(rand(-3, 3), 0, rand(-3, 3))), until: game.time + 2.5 };
      }
    }
    // late round: everyone heads for the site
    if (game.phase === 'live' && game.phaseTimer < 45 && b.via) b.via = null;
    return;
  }

  // Guardians
  if (bomb.state === 'planted') {
    b.lookZones = null;
    const defuser = bomb.defuser && bomb.defuser.alive && bomb.defuser !== a ? bomb.defuser : null;
    if (!b.goal || b.goal.distanceTo(bomb.pos) > 2) setGoal(game, a, bomb.pos.clone());
    if (!defuser) b.useTarget = bomb.pos;
    return;
  }
  // rotate towards spotted raiders when a site is under attack
  const seen = game.agents.filter((e) => e.alive && e.team === 'R' && game.time - e.spottedT < 2 && game.player.team === 'G');
  if (bomb.state === 'carried' && bomb.carrier && game.time - (b.rotT || 0) > 8) {
    const site = map.siteAt(bomb.carrier.pos.x, bomb.carrier.pos.z);
    if (site && site !== b.site && Math.random() < 0.5) {
      b.rotT = game.time;
      b.site = site;
      setGoal(game, a, map.randomPointInZone(site === 'A' ? 'holdA' : 'holdB'));
      b.lookZones = site === 'A' ? ['aLong', 'mid'] : ['bLane', 'mid'];
    }
  }
  void seen;
}
