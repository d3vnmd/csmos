// Core match simulation: agents, weapons, rounds, economy, bomb, items.
import * as THREE from 'three';
import { GameMap, MAPS } from './map.js';
import { Nav } from './nav.js';
import { WEAPONS, GEAR, makeWeapon, DEFAULT_PISTOL } from './weapons.js';
import { buildAgent, poseAgent, buildWeaponModel, buildCharge } from './models.js';
import { Effects } from './effects.js';
import { ViewModel } from './viewmodel.js';
import { moveAgent, raycastWorld, lineClear, agentHeight, canStand, fitsAt, RUN_SPEED } from './physics.js';
import { updateBot, botBuy, initBotRound } from './bot.js';
import { clamp, rand, pick, shuffle, dirFromAngles, raySphere, rayAABB, angleDiff } from './util.js';
import * as TEX from './textures.js';

export const MODES = {
  defusal: {
    id: 'defusal', name: 'Bomb Defusal', map: 'sandfort', teamSize: 5, bomb: true, buy: true,
    freeze: 10, buyTime: 25, roundTime: 115, bombTime: 40, plantTime: 3.2, startMoney: 800, post: 5,
  },
  duel: {
    id: 'duel', name: 'Sniper Duel', map: 'arena', teamSize: 1, bomb: false, buy: false,
    freeze: 3, buyTime: 0, roundTime: 60, post: 3, half: 0, winsNeeded: 8,
    loadout: ['longbow'],
  },
};

const LENGTHS = { short: { half: 8, winsNeeded: 9 }, long: { half: 12, winsNeeded: 13 } };

const BOT_NAMES = ['Falcon', 'Bishop', 'Nomad', 'Rook', 'Ghost', 'Kestrel', 'Mako', 'Tundra', 'Sable', 'Onyx',
  'Drift', 'Cinder', 'Vesper', 'Jackal', 'Orca', 'Pike', 'Quill', 'Raven', 'Slate', 'Ember'];

const MAX_MONEY = 16000;
const LOSS_BONUS = [1400, 1900, 2400, 2900, 3400];
const HITGROUP_MULT = { head: 4, chest: 1, stomach: 1.25, legs: 0.75 };

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _dir = { x: 0, y: 0, z: 0 };

export class Game {
  constructor(renderer, audio, settings) {
    this.renderer = renderer;
    this.audio = audio;
    this.settings = settings;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(settings.fov || 74, 1, 0.05, 400);
    this.vm = new ViewModel();
    this.listeners = {};
    this.time = 0;
  }

  on(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); }
  emit(ev, ...args) { for (const fn of this.listeners[ev] || []) fn(...args); }

  // -------------------------------------------------------------------------
  start(opts) {
    const mode = { ...MODES[opts.mode] };
    if (mode.id === 'defusal') Object.assign(mode, LENGTHS[opts.length || 'short']);
    this.mode = mode;
    this.difficulty = opts.difficulty || 'normal';
    const def = MAPS[mode.map];

    // scene setup
    const sc = this.scene;
    sc.background = def.theme === 'blocks' ? new THREE.Color(0xcfe0f0) : TEX.skyTexture();
    sc.fog = new THREE.Fog(def.theme === 'blocks' ? 0xcfe0f0 : 0xd9cfb8, 70, 220);
    const hemi = new THREE.HemisphereLight(0xe4ecff, 0x8a7350, 1.25);
    sc.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff0d6, 2.6);
    sun.position.set(-35, 70, 25);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    const ext = Math.max(def.W, def.H) * 1.15;
    Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 1, far: 200 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    sc.add(sun);
    sc.add(sun.target);

    this.map = new GameMap(def);
    this.map.build(sc);
    this.nav = new Nav(this.map);
    this.colliders = this.map.colliders;
    this.effects = new Effects(sc);

    // bomb model (shared)
    this.bombMesh = buildCharge();
    this.bombMesh.visible = false;
    sc.add(this.bombMesh);
    this.bomb = { state: 'none', carrier: null, pos: new THREE.Vector3(), timer: 0, defuser: null, beepT: 0, site: null };

    this.items = [];
    this.projectiles = [];
    this.killfeed = [];
    this.messages = [];
    this.agents = [];
    this.scoreR = 0; this.scoreG = 0;
    this.lossStreak = { R: 0, G: 0 };
    this.round = 0;
    this.history = [];

    // agents
    const pTeam = opts.team === 'auto' ? pick(['R', 'G']) : opts.team;
    const names = shuffle(BOT_NAMES.slice());
    this.player = this.createAgent(opts.playerName || 'You', pTeam, true);
    for (let i = 1; i < mode.teamSize; i++) this.createAgent(names.pop(), pTeam, false);
    for (let i = 0; i < mode.teamSize; i++) this.createAgent(names.pop(), pTeam === 'R' ? 'G' : 'R', false);
    for (const a of this.agents) a.money = mode.startMoney || 0;
    this.spectating = null;
    this.vm.setTeam(pTeam);
    this.phase = 'freeze';
    this.startRound(true);
  }

  dispose() {
    this.map.dispose(this.scene);
    while (this.scene.children.length) this.scene.remove(this.scene.children[0]);
  }

  createAgent(name, team, isPlayer) {
    const a = {
      id: this.agents.length, name, team, isPlayer,
      alive: true, hp: 100, armor: 0, helmet: false, kit: false, money: 0,
      pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: 0, crouch: 0,
      onGround: true, landed: false,
      inv: { primary: null, secondary: null, knife: makeWeapon('knife'), grenade: [], bomb: null },
      cur: 'knife', prev: 'knife', switchT: 0, scoped: 0, rescope: 0,
      recoil: { p: 0, y: 0 }, lastShot: -10, seed: Math.random() * 10,
      kills: 0, deaths: 0, assists: 0, damage: 0, mvps: 0,
      model: null, modelWeapon: null, walkPhase: 0, deadT: 0, stepT: 0,
      planting: 0, defusing: 0, lastHurt: -10, hurtFrom: null,
      ctrl: { mx: 0, mz: 0, jump: false, crouch: false, walk: false, fire: false, firePressed: false, alt: false, use: false },
      bot: isPlayer ? null : {},
      spottedT: -10, roundDamage: new Map(),
    };
    this.agents.push(a);
    this.rebuildModel(a);
    return a;
  }

  rebuildModel(a) {
    if (a.model) this.scene.remove(a.model);
    a.model = buildAgent(a.team);
    a.modelWeapon = null;
    a.wcache = {};
    this.scene.add(a.model);
  }

  // -------------------------------------------------------------------------
  // Inventory
  cur(a) {
    if (a.cur === 'grenade') return a.inv.grenade[0] || null;
    return a.inv[a.cur] || null;
  }

  has(a, slot) {
    return slot === 'grenade' ? a.inv.grenade.length > 0 : !!a.inv[slot];
  }

  switchTo(a, slot, force = false) {
    if (!this.has(a, slot)) return false;
    if (a.cur === slot && !force) {
      if (slot === 'grenade' && a.inv.grenade.length > 1) {
        a.inv.grenade.push(a.inv.grenade.shift());
        a.switchT = 0.35;
        if (a.isPlayer) { this.vm.setWeapon(this.cur(a).def); this.audio.draw(); }
      }
      return false;
    }
    const w = this.cur(a);
    if (w) w.reloadLeft = 0;
    a.prev = a.cur;
    a.cur = slot;
    a.scoped = 0; a.rescope = 0;
    a.planting = 0;
    const nw = this.cur(a);
    a.switchT = nw.def.type === 'knife' ? 0.3 : nw.def.type === 'sniper' ? 0.8 : 0.55;
    if (a.isPlayer) { this.vm.setWeapon(nw.def); this.vm.draw(); this.audio.draw(); }
    return true;
  }

  bestSlot(a) {
    if (a.inv.primary) return 'primary';
    if (a.inv.secondary) return 'secondary';
    return 'knife';
  }

  give(a, id) {
    const def = WEAPONS[id];
    if (def.slot === 'grenade') {
      if (a.inv.grenade.some((g) => g.def.id === id)) return false;
      a.inv.grenade.push(makeWeapon(id));
      return true;
    }
    if (def.slot === 'bomb') { a.inv.bomb = makeWeapon(id); return true; }
    a.inv[def.slot] = makeWeapon(id);
    return true;
  }

  // Buy something. Returns true on success.
  buy(a, id) {
    if (!this.canBuy(a)) return false;
    const gear = GEAR[id];
    if (gear) {
      if (gear.team && gear.team !== a.team) return false;
      if (id === 'kevlar') {
        if (a.armor >= 100 || a.money < gear.price) return false;
        a.money -= gear.price; a.armor = 100;
      } else if (id === 'helmet') {
        if (a.armor >= 100 && a.helmet) return false;
        const price = a.armor >= 100 ? 350 : gear.price;
        if (a.money < price) return false;
        a.money -= price; a.armor = 100; a.helmet = true;
      } else if (id === 'kit') {
        if (a.kit || a.money < gear.price) return false;
        a.money -= gear.price; a.kit = true;
      }
      return true;
    }
    const def = WEAPONS[id];
    if (!def || (def.team && def.team !== a.team) || a.money < def.price) return false;
    if (def.slot === 'grenade') {
      if (a.inv.grenade.some((g) => g.def.id === id)) return false;
    } else {
      const old = a.inv[def.slot];
      if (old && old.def.id === id) return false;
      if (old) this.dropWeapon(a, def.slot, true);
    }
    a.money -= def.price;
    this.give(a, id);
    if (def.slot !== 'grenade') this.switchTo(a, def.slot, true);
    return true;
  }

  canBuy(a) {
    if (!this.mode.buy || !a.alive) return false;
    if (this.phase !== 'freeze' && !(this.phase === 'live' && this.roundElapsed < this.mode.buyTime - this.mode.freeze)) return false;
    return this.map.inZone(a.team === 'R' ? 'spawnR' : 'spawnG', a.pos.x, a.pos.z);
  }

  // -------------------------------------------------------------------------
  // Items on the ground
  dropWeapon(a, slot, silent = false) {
    const inst = a.inv[slot];
    if (!inst || slot === 'knife') return;
    a.inv[slot] = null;
    const mesh = buildWeaponModel(inst.def.model);
    mesh.rotation.set(0, a.yaw + Math.PI / 2, Math.PI / 2);
    this.scene.add(mesh);
    const fwd = dirFromAngles(a.yaw, 0, { x: 0, y: 0, z: 0 });
    const item = {
      inst, mesh,
      pos: new THREE.Vector3(a.pos.x, a.pos.y + 1.2, a.pos.z),
      vel: new THREE.Vector3(fwd.x * (silent ? 1 : 3.5), 1.5, fwd.z * (silent ? 1 : 3.5)),
      dropper: a, dropT: this.time, rest: false,
    };
    this.items.push(item);
    if (a.cur === slot) {
      a.cur = 'knife';
      this.switchTo(a, this.bestSlot(a), true);
    }
  }

  dropBomb(a) {
    if (!a.inv.bomb) return;
    a.inv.bomb = null;
    a.planting = 0;
    if (a.cur === 'bomb') this.switchTo(a, this.bestSlot(a), true);
    this.bomb.state = 'dropped';
    this.bomb.carrier = null;
    this.bomb.pos.set(a.pos.x, a.pos.y, a.pos.z);
    this.bomb.dropY = a.pos.y + 1;
    this.bomb.vy = 1;
    this.bomb.dropT = this.time;
    this.bomb.dropper = a;
    this.emitMsg(a.team === this.player.team && a.team === 'R' ? 'The charge has been dropped' : null);
  }

  updateItems(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (!it.rest) {
        it.vel.y -= 18 * dt;
        const nx = it.pos.x + it.vel.x * dt, nz = it.pos.z + it.vel.z * dt;
        const blockedH = raycastWorld(this.colliders, it.pos.x, it.pos.y, it.pos.z, it.vel.x, 0, it.vel.z, Math.hypot(it.vel.x, it.vel.z) * dt + 0.15);
        if (blockedH && blockedH.kind !== 'floor') { it.vel.x *= -0.3; it.vel.z *= -0.3; }
        else { it.pos.x = nx; it.pos.z = nz; }
        const down = raycastWorld(this.colliders, it.pos.x, it.pos.y, it.pos.z, 0, -1, 0, 50);
        const ground = down ? it.pos.y - down.t : 0;
        it.pos.y += it.vel.y * dt;
        if (it.pos.y <= ground + 0.04) { it.pos.y = ground + 0.04; it.rest = true; }
      }
      it.mesh.position.copy(it.pos);
      // pickups
      for (const a of this.agents) {
        if (!a.alive) continue;
        if (a === it.dropper && this.time - it.dropT < 1.2) continue;
        const slot = it.inst.def.slot;
        if (a.inv[slot]) continue;
        if (Math.hypot(a.pos.x - it.pos.x, a.pos.z - it.pos.z) < 1.1 && Math.abs(a.pos.y - it.pos.y) < 1.5) {
          this.pickup(a, it);
          break;
        }
      }
    }
    // bomb
    const b = this.bomb;
    if (b.state === 'dropped') {
      if (b.vy !== 0) {
        b.vy -= 18 * dt;
        const down = raycastWorld(this.colliders, b.pos.x, b.dropY, b.pos.z, 0, -1, 0, 50);
        const ground = down ? b.dropY - down.t : 0;
        b.dropY += b.vy * dt;
        if (b.dropY <= ground) { b.dropY = ground; b.vy = 0; }
        b.pos.y = b.dropY;
      }
      for (const a of this.agents) {
        if (!a.alive || a.team !== 'R') continue;
        if (a === b.dropper && this.time - b.dropT < 1.5) continue;
        if (Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z) < 1.1 && Math.abs(a.pos.y - b.pos.y) < 1.5) {
          a.inv.bomb = makeWeapon('charge');
          b.state = 'carried';
          b.carrier = a;
          if (a.isPlayer) this.emitMsg('You picked up the charge');
          break;
        }
      }
    }
  }

  pickup(a, it) {
    const slot = it.inst.def.slot;
    a.inv[slot] = it.inst;
    it.inst.reloadLeft = 0;
    this.scene.remove(it.mesh);
    this.items.splice(this.items.indexOf(it), 1);
    if (a.isPlayer) this.audio.draw();
    if (slot === 'primary' && (a.cur === 'secondary' || a.cur === 'knife')) this.switchTo(a, 'primary', true);
  }

  nearestItem(a, maxD = 1.8) {
    let best = null, bd = maxD;
    for (const it of this.items) {
      const d = Math.hypot(a.pos.x - it.pos.x, a.pos.z - it.pos.z);
      if (d < bd && Math.abs(a.pos.y - it.pos.y) < 1.6) { bd = d; best = it; }
    }
    return best;
  }

  swapPickup(a) {
    const it = this.nearestItem(a);
    if (!it) return false;
    const slot = it.inst.def.slot;
    if (a.inv[slot]) this.dropWeapon(a, slot, true);
    this.pickup(a, it);
    this.switchTo(a, slot, true);
    return true;
  }

  // -------------------------------------------------------------------------
  // Rounds
  startRound(first = false) {
    this.round++;
    this.phase = 'freeze';
    this.phaseTimer = this.mode.freeze;
    this.roundElapsed = 0;
    this.roundStartTime = this.time;
    this.effects.clear();
    for (const it of this.items) this.scene.remove(it.mesh);
    this.items = [];
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    this.projectiles = [];
    this.bomb.state = 'none';
    this.bomb.carrier = null;
    this.bomb.defuser = null;
    this.bombMesh.visible = false;
    this.spectating = null;

    const spawnCells = {
      R: shuffle(this.map.zoneCells('spawnR')),
      G: shuffle(this.map.zoneCells('spawnG')),
    };
    const center = { R: this.map.zoneCenter('spawnR'), G: this.map.zoneCenter('spawnG') };
    const enemyCenter = { R: center.G, G: center.R };

    for (const a of this.agents) {
      const survived = a.alive && !first;
      if (!survived || this.mode.loadout) {
        a.inv.primary = null;
        a.inv.secondary = null;
        a.inv.grenade = [];
        if (!survived) { a.armor = 0; a.helmet = false; a.kit = false; }
      }
      if (a.team !== 'G') a.kit = false;
      a.inv.bomb = null;
      if (!a.inv.secondary) a.inv.secondary = makeWeapon(DEFAULT_PISTOL[a.team]);
      if (this.mode.loadout) {
        for (const id of this.mode.loadout) this.give(a, id);
        a.armor = 100; a.helmet = true;
      }
      // refill ammo
      for (const s of ['primary', 'secondary']) {
        const w = a.inv[s];
        if (w) { w.mag = w.def.mag; w.reserve = w.def.reserve; w.reloadLeft = 0; w.shots = 0; }
      }
      a.alive = true;
      a.hp = 100;
      a.deadT = 0;
      a.planting = 0; a.defusing = 0;
      a.vel.set(0, 0, 0);
      a.crouch = 0;
      a.recoil.p = 0; a.recoil.y = 0;
      a.scoped = 0;
      a.roundDamage = new Map();
      a.roundKills = 0;
      const cell = spawnCells[a.team].pop();
      const w = this.map.cellToWorld(cell.c, cell.r);
      a.pos.set(w.x + rand(-0.3, 0.3), 0, w.z + rand(-0.3, 0.3));
      const ec = enemyCenter[a.team];
      a.yaw = Math.atan2(-(ec.x - a.pos.x), -(ec.z - a.pos.z));
      a.pitch = 0;
      a.model.rotation.set(0, 0, 0);
      a.model.position.y = 0;
      a.cur = 'knife';
      this.switchTo(a, this.bestSlot(a), true);
      a.switchT = 0;
      a.model.visible = !a.isPlayer;
    }

    if (this.mode.bomb) {
      const raiders = this.agents.filter((a) => a.team === 'R');
      const carrier = pick(raiders);
      carrier.inv.bomb = makeWeapon('charge');
      this.bomb.state = 'carried';
      this.bomb.carrier = carrier;
    }
    for (const a of this.agents) if (a.bot) initBotRound(this, a);
    for (const a of this.agents) if (a.bot) botBuy(this, a);
    this.emit('roundStart', this.round);
  }

  aliveCount(team) {
    let n = 0;
    for (const a of this.agents) if (a.alive && a.team === team) n++;
    return n;
  }

  updateRound(dt) {
    if (this.phase === 'matchEnd') return;
    this.phaseTimer -= dt;
    if (this.phase !== 'freeze') this.roundElapsed += dt;
    if (this.phase === 'freeze') {
      if (this.phaseTimer <= 0) {
        this.phase = 'live';
        this.phaseTimer = this.mode.roundTime;
        this.audio.jingle('start');
        this.emit('live');
      }
    } else if (this.phase === 'live') {
      const b = this.bomb;
      if (b.state === 'planted') {
        b.timer -= dt;
        b.beepT -= dt;
        if (b.beepT <= 0) {
          const frac = clamp(b.timer / this.mode.bombTime, 0, 1);
          b.beepT = 0.12 + 0.88 * frac;
          this.audio.beep(b.pos, frac < 0.25);
          const led = this.bombMesh.getObjectByName('led');
          if (led) { led.material.emissiveIntensity = 3; setTimeout(() => { led.material.emissiveIntensity = 0.2; }, 80); }
        }
        if (b.timer <= 0) this.explodeBomb();
      } else if (this.phaseTimer <= 0) {
        if (this.mode.bomb) this.endRound('G', 'time');
        else this.endRound(null, 'time');
      }
    } else if (this.phase === 'post') {
      if (this.bomb.state === 'planted') {
        this.bomb.timer -= dt;
        if (this.bomb.timer <= 0) this.explodeBomb(true);
      }
      if (this.phaseTimer <= 0) {
        if (this.pendingMatchEnd) {
          this.phase = 'matchEnd';
          this.emit('matchEnd', this.pendingMatchEnd);
          return;
        }
        if (this.pendingSwap) this.swapSides();
        this.startRound();
      }
    }
  }

  checkElimination() {
    if (this.phase !== 'live' && this.phase !== 'freeze') return;
    const r = this.aliveCount('R'), g = this.aliveCount('G');
    if (this.bomb.state === 'planted') {
      if (g === 0) this.endRound('R', 'elim');
    } else {
      if (r === 0 && g === 0) this.endRound(null, 'draw');
      else if (r === 0) this.endRound('G', 'elim');
      else if (g === 0) this.endRound('R', 'elim');
    }
  }

  endRound(winner, reason) {
    if (this.phase === 'post' || this.phase === 'matchEnd') return;
    this.phase = 'post';
    this.phaseTimer = this.mode.post;
    if (winner === 'R') this.scoreR++;
    if (winner === 'G') this.scoreG++;
    const loser = winner === 'R' ? 'G' : winner === 'G' ? 'R' : null;

    // economy
    if (this.mode.buy && winner) {
      const winReward = reason === 'bomb' || reason === 'defuse' ? 3500 : 3250;
      const streak = this.lossStreak[loser];
      const lossReward = LOSS_BONUS[Math.min(streak, LOSS_BONUS.length - 1)];
      this.lossStreak[loser] = Math.min(streak + 1, LOSS_BONUS.length - 1);
      this.lossStreak[winner] = Math.max(0, this.lossStreak[winner] - 1);
      for (const a of this.agents) {
        if (a.team === winner) a.money += winReward;
        else {
          let r = lossReward;
          if (reason === 'time' && a.team === 'R' && a.alive) r = 0;
          if (a.team === 'R' && this.bomb.planted) r += 800;
          a.money += r;
        }
        a.money = Math.min(MAX_MONEY, a.money);
      }
    }
    // MVP: most kills on winning team
    let mvp = null;
    if (winner) {
      for (const a of this.agents) if (a.team === winner && (!mvp || a.roundKills > mvp.roundKills)) mvp = a;
      if (reason === 'bomb' && this.bomb.planter) mvp = this.bomb.planter;
      if (reason === 'defuse' && this.bomb.defuser) mvp = this.bomb.defuser;
      if (mvp) mvp.mvps++;
    }
    this.history.push({ winner, reason, round: this.round });
    this.bomb.planted = false;

    const playerWon = winner === this.player.team;
    if (winner) this.audio.jingle(playerWon ? 'win' : 'lose');

    // half / match end
    const played = this.scoreR + this.scoreG + this.history.filter((h) => !h.winner).length;
    this.pendingSwap = false;
    this.pendingMatchEnd = null;
    const need = this.mode.winsNeeded;
    if (this.scoreR >= need || this.scoreG >= need) {
      this.pendingMatchEnd = { winner: this.scoreR >= need ? 'R' : 'G' };
    } else if (this.mode.half && played === this.mode.half * 2) {
      this.pendingMatchEnd = { winner: null };
    } else if (this.mode.half && played === this.mode.half) {
      this.pendingSwap = true;
    }
    this.emit('roundEnd', { winner, reason, mvp, swap: this.pendingSwap });
  }

  swapSides() {
    const s = this.scoreR; this.scoreR = this.scoreG; this.scoreG = s;
    this.lossStreak = { R: 0, G: 0 };
    for (const a of this.agents) {
      a.team = a.team === 'R' ? 'G' : 'R';
      a.money = this.mode.startMoney;
      a.inv.primary = null; a.inv.secondary = null; a.inv.grenade = []; a.inv.bomb = null;
      a.armor = 0; a.helmet = false; a.kit = false;
      a.alive = false; // forces default loadout
      this.rebuildModel(a);
    }
    this.vm.setTeam(this.player.team);
    this.emit('halftime');
  }

  // -------------------------------------------------------------------------
  // Bomb
  updateUse(a, dt) {
    const b = this.bomb;
    const c = a.ctrl;
    // defuse
    if (a.team === 'G' && b.state === 'planted' && c.use && a.onGround &&
        a.pos.distanceTo(b.pos) < 1.8 && (b.defuser === null || b.defuser === a)) {
      if (a.defusing === 0) {
        b.defuser = a;
        if (a.isPlayer || a.team === this.player.team) this.emitMsg(`${a.isPlayer ? 'You are' : a.name + ' is'} defusing the charge`);
      }
      a.defusing += dt;
      if (a.isPlayer && Math.floor(a.defusing * 4) !== Math.floor((a.defusing - dt) * 4)) this.audio.defuseTick();
      if (a.defusing >= (a.kit ? 5 : 10)) this.defuseBomb(a);
      return;
    } else if (a.defusing > 0) {
      a.defusing = 0;
      if (b.defuser === a) b.defuser = null;
    }
    // plant
    const wantPlant = c.use || (a.cur === 'bomb' && c.fire);
    if (a.team === 'R' && a.inv.bomb && wantPlant && a.onGround && this.phase === 'live' &&
        this.map.siteAt(a.pos.x, a.pos.z)) {
      if (a.cur !== 'bomb') this.switchTo(a, 'bomb', true);
      a.planting += dt;
      if (a.isPlayer && Math.floor(a.planting * 3) !== Math.floor((a.planting - dt) * 3)) this.audio.plantTick();
      if (a.planting >= this.mode.plantTime) this.plantBomb(a);
    } else {
      a.planting = 0;
    }
  }

  plantBomb(a) {
    const b = this.bomb;
    a.inv.bomb = null;
    a.planting = 0;
    this.switchTo(a, this.bestSlot(a), true);
    b.state = 'planted';
    b.planted = true;
    b.planter = a;
    b.carrier = null;
    b.pos.set(a.pos.x, a.pos.y, a.pos.z);
    b.timer = this.mode.bombTime;
    b.beepT = 0;
    b.site = this.map.siteAt(a.pos.x, a.pos.z);
    this.bombMesh.position.copy(b.pos);
    this.bombMesh.rotation.y = a.yaw;
    this.bombMesh.visible = true;
    a.money = Math.min(MAX_MONEY, a.money + 300);
    this.audio.jingle('planted');
    this.emit('planted', b.site);
    this.emitMsg(`The charge has been planted at site ${b.site}`, 'warn');
  }

  defuseBomb(a) {
    const b = this.bomb;
    b.state = 'defused';
    b.defuser = a;
    a.defusing = 0;
    a.money = Math.min(MAX_MONEY, a.money + 300);
    this.emitMsg('The charge has been defused', 'good');
    this.endRound('G', 'defuse');
  }

  explodeBomb(afterRound = false) {
    const b = this.bomb;
    b.state = 'exploded';
    this.bombMesh.visible = false;
    const p = b.pos.clone().add(new THREE.Vector3(0, 0.5, 0));
    this.effects.explosion(p, 2.5);
    this.audio.explosion(p);
    this.shake = 1.2;
    for (const a of this.agents) {
      if (!a.alive) continue;
      const d = a.pos.distanceTo(b.pos);
      let dmg = d < 8 ? 500 : Math.max(0, 140 * (1 - (d - 8) / 18));
      if (a.armor > 0) dmg *= 0.75;
      if (dmg > 0) this.damage(a, null, dmg, 'chest', WEAPONS.charge, null, true);
    }
    if (!afterRound) this.endRound('R', 'bomb');
  }

  // -------------------------------------------------------------------------
  // Combat
  eyePos(a, out) {
    return out.set(a.pos.x, a.pos.y + agentHeight(a) - 0.14, a.pos.z);
  }

  spreadFor(a, w) {
    const s = w.def.spread;
    if (!s) return 0;
    const speed = Math.hypot(a.vel.x, a.vel.z);
    const maxSp = RUN_SPEED * w.def.speed;
    const moveFrac = clamp((speed - 1.4) / (maxSp - 1.4), 0, 1);
    let v = s.base + s.move * moveFrac + (a.onGround ? 0 : s.air);
    if (a.crouch > 0.6) v *= s.crouch;
    if (w.def.type === 'sniper' && !a.scoped) v += s.unscoped;
    if (w.def.auto) v += Math.min(w.shots, 12) * 0.0011;
    return v;
  }

  tryFire(a) {
    const w = this.cur(a);
    if (!w || a.switchT > 0 || w.reloadLeft > 0) return;
    if (this.time < w.nextFire) return;
    const def = w.def;
    if (def.type === 'knife') return this.knifeAttack(a, false);
    if (def.type === 'grenade') return this.throwGrenade(a);
    if (def.type === 'bomb') return;
    if (!def.auto && a.isPlayer && !a.ctrl.firePressed) return;
    if (w.mag <= 0) {
      w.nextFire = this.time + 0.25;
      if (a.isPlayer) this.audio.click();
      this.reload(a);
      return;
    }
    w.mag--;
    w.nextFire = this.time + def.rate;
    if (this.time - a.lastShot > def.rate * 2.2) w.shots = 0;
    a.lastShot = this.time;

    const spread = this.spreadFor(a, w);
    const eye = this.eyePos(a, _v1);
    const pellets = def.pellets || 1;
    const baseYaw = a.yaw + a.recoil.y;
    const basePitch = a.pitch + a.recoil.p;
    let muzzle = null;
    if (a.isPlayer && !a.scoped) muzzle = this.vm.muzzleWorld(this.camera, new THREE.Vector3());
    if (!muzzle) {
      muzzle = eye.clone();
      if (!a.isPlayer) {
        const f = dirFromAngles(a.yaw, a.pitch, {});
        muzzle.x += f.x * 0.7 + Math.cos(a.yaw) * 0.12; muzzle.y += -0.2; muzzle.z += f.z * 0.7 - Math.sin(a.yaw) * 0.12;
      } else muzzle.y -= 0.1;
    }
    for (let i = 0; i < pellets; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r = spread * Math.sqrt(Math.random());
      dirFromAngles(baseYaw + Math.cos(ang) * r, basePitch + Math.sin(ang) * r, _dir);
      this.hitscan(a, eye, _dir, def, i === 0 || pellets < 4 ? muzzle : null);
    }
    // recoil kick
    const rc = def.recoil;
    const climb = w.shots < rc.climb ? 1 : 0.3;
    a.recoil.p += rc.v * climb * rand(0.85, 1.15);
    const side = w.shots < 3 ? rand(-0.5, 0.5) : Math.sin(w.shots * 0.55 + a.seed) * 1.3;
    a.recoil.y += rc.h * side;
    w.shots++;

    this.effects.muzzle(muzzle, def.type === 'sniper' || def.type === 'shotgun' ? 1.5 : 1);
    this.audio.shot(def, a.isPlayer ? null : a.pos);
    this.alertBots(a, 35);
    if (a.isPlayer) {
      this.vm.fire(def.type === 'sniper' ? 2.5 : def.type === 'shotgun' ? 2 : def.type === 'pistol' ? 1.2 : 0.8);
      this.shake = Math.max(this.shake || 0, def.type === 'sniper' ? 0.25 : 0.06);
    }
    if (def.type === 'sniper' && a.scoped) { a.rescope = a.scoped; a.scoped = 0; }
    if (w.mag === 0 && w.reserve > 0) {
      // auto reload after the last shot
      setTimeout(() => { if (this.cur(a) === w && w.mag === 0) this.reload(a); }, def.rate * 1000);
    }
  }

  hitscan(a, eye, dir, def, muzzle) {
    const maxD = 220;
    const wh = raycastWorld(this.colliders, eye.x, eye.y, eye.z, dir.x, dir.y, dir.z, maxD);
    let best = wh ? wh.t : maxD;
    let victim = null, group = null;
    for (const b of this.agents) {
      if (b === a || !b.alive) continue;
      const res = this.rayAgent(b, eye, dir, best);
      if (res) { best = res.t; victim = b; group = res.group; }
    }
    const end = _v2.set(eye.x + dir.x * best, eye.y + dir.y * best, eye.z + dir.z * best);
    if (muzzle) this.effects.tracer(muzzle, end.clone());
    if (victim) {
      if (victim.team !== a.team || this.settings.friendlyFire) {
        const dmg = def.damage * Math.pow(def.range, best / 12);
        this.damage(victim, a, dmg, group, def, dir);
      }
      this.effects.blood(end.clone(), { x: dir.x * 2, y: 0.5, z: dir.z * 2 });
      if (Math.random() < 0.5) {
        const back = raycastWorld(this.colliders, end.x, end.y, end.z, dir.x, dir.y, dir.z, 3);
        if (back) {
          const p = new THREE.Vector3(end.x + dir.x * back.t, end.y + dir.y * back.t, end.z + dir.z * back.t);
          this.effects.decal(p, { x: back.nx, y: back.ny, z: back.nz }, true);
        }
      }
    } else if (wh) {
      this.effects.impact(end.clone(), { x: wh.nx, y: wh.ny, z: wh.nz }, wh.kind);
    }
  }

  // Ray against an agent's hitboxes. Returns {t, group} or null.
  rayAgent(b, o, d, maxT) {
    const h = agentHeight(b);
    const x = b.pos.x, y = b.pos.y, z = b.pos.z;
    // broad phase
    const bt = raySphere(o.x, o.y, o.z, d.x, d.y, d.z, x, y + h / 2, z, h * 0.75);
    if (bt < 0 || bt > maxT) return null;
    let best = maxT, group = null;
    const fx = -Math.sin(b.yaw) * 0.05, fz = -Math.cos(b.yaw) * 0.05;
    const ht = raySphere(o.x, o.y, o.z, d.x, d.y, d.z, x + fx, y + h - 0.15, z + fz, 0.145);
    if (ht >= 0 && ht < best) { best = ht; group = 'head'; }
    const boxes = [
      ['chest', 0.24, h * 0.56, h - 0.29],
      ['stomach', 0.22, h * 0.44, h * 0.56],
      ['legs', 0.2, 0, h * 0.44],
    ];
    for (const [g, hw, y0, y1] of boxes) {
      const t = rayAABB(o.x, o.y, o.z, d.x, d.y, d.z,
        { minX: x - hw, maxX: x + hw, minY: y + y0, maxY: y + y1, minZ: z - hw, maxZ: z + hw }, best);
      if (t >= 0 && t < best) { best = t; group = g; }
    }
    return group ? { t: best, group } : null;
  }

  damage(victim, attacker, amount, group, def, dir, isBomb = false) {
    if (!victim.alive) return;
    let dmg = amount * (HITGROUP_MULT[group] || 1);
    const armored = victim.armor > 0 && group !== 'legs' && (group !== 'head' || victim.helmet);
    if (armored && !isBomb && def.armorPen !== undefined) {
      const pen = def.armorPen;
      const absorbed = dmg * (1 - pen);
      victim.armor = Math.max(0, victim.armor - Math.round(absorbed * 0.5));
      dmg = dmg * pen;
    }
    dmg = Math.max(1, Math.round(dmg));
    const dealt = Math.min(victim.hp, dmg);
    victim.hp -= dmg;
    victim.lastHurt = this.time;
    if (attacker && attacker !== victim) {
      victim.hurtFrom = attacker;
      attacker.damage += dealt;
      victim.roundDamage.set(attacker, (victim.roundDamage.get(attacker) || 0) + dealt);
      // slow down on hit (tagging)
      victim.vel.x *= 0.5; victim.vel.z *= 0.5;
      // aim punch
      victim.recoil.p += 0.02;
      if (attacker.isPlayer) {
        this.emit('hitmarker', group === 'head', victim.hp <= 0);
        this.audio.hitmarker();
      }
      if (victim.isPlayer) this.emit('hurt', attacker.pos.clone(), dealt);
      if (victim.bot) victim.bot.alertFrom = attacker;
    }
    if (group === 'head' && !isBomb) this.audio.hit(this.eyePos(victim, new THREE.Vector3()), true, victim.helmet && victim.armor > 0);
    else if (!isBomb && attacker && !attacker.isPlayer) this.audio.hit(victim.isPlayer ? null : victim.pos, false);
    if (victim.hp <= 0) this.kill(victim, attacker, def, group === 'head');
  }

  kill(victim, attacker, def, headshot) {
    victim.alive = false;
    victim.hp = 0;
    victim.deaths++;
    victim.deadT = 0;
    victim.planting = 0;
    victim.defusing = 0;
    victim.scoped = 0;
    victim.model.visible = true;
    victim.deathYaw = victim.yaw;
    if (this.bomb.defuser === victim) this.bomb.defuser = null;
    if (attacker && attacker !== victim) {
      if (attacker.team !== victim.team) {
        attacker.kills++;
        attacker.roundKills++;
        if (this.mode.buy) attacker.money = Math.min(MAX_MONEY, attacker.money + (def.kill || 300));
      } else {
        attacker.kills--;
      }
    }
    // assists
    for (const [who, dmg] of victim.roundDamage) {
      if (who !== attacker && dmg >= 40 && who.team !== victim.team) who.assists++;
    }
    // drops
    if (victim.inv.primary) this.dropWeapon(victim, 'primary');
    else if (victim.inv.secondary) this.dropWeapon(victim, 'secondary');
    if (victim.inv.bomb) this.dropBomb(victim);
    victim.inv.grenade = [];
    this.killfeed.push({
      killer: attacker ? attacker.name : null, killerTeam: attacker ? attacker.team : null,
      victim: victim.name, victimTeam: victim.team, weapon: def ? def.name : '', headshot,
      t: this.time, involvesPlayer: victim.isPlayer || (attacker && attacker.isPlayer),
    });
    if (this.killfeed.length > 6) this.killfeed.shift();
    if (victim.isPlayer) {
      this.spectating = null;
      this.emit('playerDied', attacker);
    }
    this.checkElimination();
  }

  knifeAttack(a, alt) {
    const w = a.inv.knife;
    const def = w.def;
    w.nextFire = this.time + (alt ? def.rateAlt : def.rate);
    const eye = this.eyePos(a, _v1);
    dirFromAngles(a.yaw, a.pitch, _dir);
    const wh = raycastWorld(this.colliders, eye.x, eye.y, eye.z, _dir.x, _dir.y, _dir.z, def.range);
    let best = wh ? wh.t : def.range, victim = null, group = null;
    for (const b of this.agents) {
      if (b === a || !b.alive) continue;
      // generous melee: test a few rays
      for (const dy of [0, -0.25, -0.5]) {
        dirFromAngles(a.yaw, a.pitch + dy, _dir);
        const res = this.rayAgent(b, eye, _dir, best);
        if (res) { best = res.t; victim = b; group = res.group === 'head' ? 'head' : 'chest'; }
      }
    }
    if (a.isPlayer) this.vm.slash(alt);
    this.audio.knife(a.isPlayer ? null : a.pos, !!victim);
    if (victim && victim.team !== a.team) {
      // backstab
      const toA = Math.atan2(-(a.pos.x - victim.pos.x), -(a.pos.z - victim.pos.z));
      const behind = Math.abs(angleDiff(victim.yaw, toA)) > 2.2;
      let dmg = alt ? def.damageAlt : def.damage;
      if (behind) dmg = alt ? 200 : 90;
      this.damage(victim, a, dmg, 'chest', def, _dir);
      this.effects.blood(eye.clone().addScaledVector(new THREE.Vector3(_dir.x, _dir.y, _dir.z), best), { x: 0, y: 0, z: 0 });
    } else if (wh && !victim) {
      const p = new THREE.Vector3(eye.x + _dir.x * wh.t, eye.y + _dir.y * wh.t, eye.z + _dir.z * wh.t);
      this.effects.impact(p, { x: wh.nx, y: wh.ny, z: wh.nz }, wh.kind);
    }
  }

  altFire(a) {
    const w = this.cur(a);
    if (!w || a.switchT > 0) return;
    if (w.def.type === 'knife' && this.time >= w.nextFire) this.knifeAttack(a, true);
    else if (w.def.scope && w.reloadLeft <= 0) {
      a.scoped = (a.scoped + 1) % (w.def.scope.length + 1);
      a.rescope = 0;
      if (a.isPlayer) this.audio.click();
    }
  }

  reload(a) {
    const w = this.cur(a);
    if (!w || !w.def.mag || w.reloadLeft > 0 || w.mag >= w.def.mag || w.reserve <= 0) return;
    w.reloadLeft = w.def.reload;
    a.scoped = 0; a.rescope = 0;
    w.shots = 0;
    if (a.isPlayer) this.vm.reload(w.def.reload);
    this.audio.reload(w.def, a.isPlayer ? null : a.pos);
  }

  throwGrenade(a) {
    const w = this.cur(a);
    if (!w || this.phase === 'freeze') return;
    const def = w.def;
    a.inv.grenade.shift();
    w.nextFire = this.time + 1;
    const eye = this.eyePos(a, new THREE.Vector3());
    const d = dirFromAngles(a.yaw, a.pitch + 0.08, {});
    const speed = a.ctrl.walk ? 9 : 16;
    const mesh = buildWeaponModel(def.model);
    mesh.scale.setScalar(1.6);
    this.scene.add(mesh);
    this.projectiles.push({
      def, owner: a, mesh, t: 0,
      pos: eye.clone().add(new THREE.Vector3(d.x * 0.4, d.y * 0.4 - 0.1, d.z * 0.4)),
      vel: new THREE.Vector3(d.x * speed + a.vel.x * 0.5, d.y * speed + 1.5, d.z * speed + a.vel.z * 0.5),
      popped: false, still: 0,
    });
    if (a.isPlayer) this.vm.throwAnim();
    this.audio.knife(a.isPlayer ? null : a.pos, false);
    setTimeout(() => {
      if (!a.alive) return;
      if (a.cur === 'grenade' && !a.inv.grenade.length) { a.cur = 'knife'; this.switchTo(a, this.bestSlot(a), true); }
      else if (a.cur === 'grenade' && a.isPlayer) this.vm.setWeapon(this.cur(a).def);
    }, 350);
  }

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.t += dt;
      if (!p.popped) {
        p.vel.y -= 18 * dt;
        const sub = 3;
        for (let s = 0; s < sub; s++) {
          const h = dt / sub;
          for (const ax of ['x', 'y', 'z']) {
            const step = p.vel[ax] * h;
            p.pos[ax] += step;
            let hit = p.pos.y < 0.05;
            if (!hit) {
              for (const c of this.colliders) {
                if (p.pos.x > c.minX - 0.05 && p.pos.x < c.maxX + 0.05 && p.pos.y > c.minY - 0.05 &&
                    p.pos.y < c.maxY + 0.05 && p.pos.z > c.minZ - 0.05 && p.pos.z < c.maxZ + 0.05) { hit = true; break; }
              }
            }
            if (hit) {
              p.pos[ax] -= step;
              if (Math.abs(p.vel[ax]) > 2) this.audio.bounce(p.pos);
              p.vel[ax] *= -0.42;
              const other = ax === 'y' ? ['x', 'z'] : ['y'];
              for (const o of other) if (o !== 'y') p.vel[o] *= 0.75;
            }
          }
        }
        p.mesh.position.copy(p.pos);
        p.mesh.rotation.x += dt * 8;
        const speed = p.vel.length();
        if (speed < 0.6) p.still += dt;
        if (p.def.id === 'frag' && p.t >= p.def.fuse) {
          this.explodeFrag(p);
          this.scene.remove(p.mesh);
          this.projectiles.splice(i, 1);
          continue;
        }
        if (p.def.id === 'smoke' && (p.still > 0.4 || p.t > 3)) {
          p.popped = true;
          p.vel.set(0, 0, 0);
          p.smoke = this.effects.smoke(p.pos.clone(), p.def.duration);
          this.audio.smokePop(p.pos);
        }
      } else if (p.t > p.def.duration + 4) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  explodeFrag(p) {
    const pos = p.pos.clone().add(new THREE.Vector3(0, 0.2, 0));
    this.effects.explosion(pos, 1);
    this.audio.explosion(pos);
    const me = this.player;
    if (me.alive && me.pos.distanceTo(pos) < 12) this.shake = Math.max(this.shake || 0, 0.6);
    for (const a of this.agents) {
      if (!a.alive) continue;
      if (a.team === p.owner.team && a !== p.owner && !this.settings.friendlyFire) continue;
      const chest = new THREE.Vector3(a.pos.x, a.pos.y + 1, a.pos.z);
      const d = chest.distanceTo(pos);
      if (d > p.def.radius) continue;
      if (!lineClear(this.colliders, pos, chest)) continue;
      let dmg = p.def.damage * Math.pow(1 - d / p.def.radius, 1.3);
      if (a.armor > 0) { dmg *= 0.55; a.armor = Math.max(0, a.armor - Math.round(dmg * 0.4)); }
      this.damage(a, p.owner, dmg, 'chest', p.def, null, true);
    }
    this.alertBots(p.owner, 30, pos);
  }

  alertBots(src, radius, at = null) {
    const pos = at || src.pos;
    for (const b of this.agents) {
      if (!b.bot || !b.alive || b.team === src.team) continue;
      if (b.pos.distanceTo(pos) < radius) { b.bot.heard = pos.clone(); b.bot.heardT = this.time; }
    }
  }

  emitMsg(text, kind = 'info') {
    if (!text) return;
    this.emit('message', text, kind);
  }

  // -------------------------------------------------------------------------
  // Per-frame update
  update(dt, input) {
    this.time += dt;
    this.updateRound(dt);
    if (this.phase === 'matchEnd') { this.updateVisuals(dt, input); return; }
    // player control
    if (input) input.apply(this, this.player, dt);
    for (const a of this.agents) {
      if (!a.alive) continue;
      if (a.bot) updateBot(this, a, dt);
      this.simAgent(a, dt);
    }
    this.separate();
    this.updateItems(dt);
    this.updateProjectiles(dt);
    this.updateSpotting();
    this.updateVisuals(dt, input);
  }

  simAgent(a, dt) {
    const c = a.ctrl;
    const w = this.cur(a);
    if (a.switchT > 0) a.switchT -= dt;
    if (w && w.reloadLeft > 0) {
      w.reloadLeft -= dt;
      if (w.reloadLeft <= 0) {
        const need = w.def.mag - w.mag;
        const take = Math.min(need, w.reserve);
        w.mag += take; w.reserve -= take;
        w.reloadLeft = 0;
      }
    }
    if (a.rescope && w && this.time >= w.nextFire) { a.scoped = a.rescope; a.rescope = 0; }
    // crouch
    const wantC = c.crouch ? 1 : 0;
    if (wantC > a.crouch) a.crouch = Math.min(1, a.crouch + dt * 7);
    else if (wantC < a.crouch) {
      const prev = a.crouch;
      a.crouch = Math.max(0, a.crouch - dt * 7);
      if (!canStand(a, this.colliders) && a.onGround) a.crouch = prev;
    }
    // movement
    let sp = RUN_SPEED * (w ? w.def.speed : 1);
    if (c.walk) sp *= 0.52;
    if (a.crouch > 0.5) sp *= 0.36;
    if (a.scoped) sp *= 0.65;
    const frozen = this.phase === 'freeze' || a.planting > 0 || a.defusing > 0;
    if (frozen) sp = 0;
    const prevGround = a.onGround;
    const vy = a.vel.y;
    moveAgent(a, c.mx, c.mz, sp, c.jump && !frozen, dt, this.colliders);
    if (a.landed && vy < -7) {
      this.audio.land(a.isPlayer ? null : a.pos);
      if (vy < -13) this.damage(a, null, Math.round((-vy - 13) * 9), 'legs', { name: 'fall' }, null, true);
    }
    // footsteps
    const speed = Math.hypot(a.vel.x, a.vel.z);
    if (a.onGround && speed > 3.4) {
      a.stepT -= dt * speed / 6;
      if (a.stepT <= 0) {
        a.stepT = 0.36;
        if (a.isPlayer) this.audio.step(null);
        else if (a.pos.distanceTo(this.player.pos) < 35) this.audio.step(a.pos);
        if (!a.isPlayer) this.alertBots(a, 14);
        else this.alertBots(a, 18);
      }
    }
    a.walkPhase += speed * dt * 1.5;
    // shooting
    if (this.phase !== 'freeze') {
      if (c.fire) this.tryFire(a);
      if (c.alt) this.altFire(a);
    }
    c.alt = false;
    c.firePressed = false;
    // plant / defuse
    if (this.mode.bomb) this.updateUse(a, dt);
    // recoil recovery
    if (w && w.def.recoil) {
      if (this.time - a.lastShot > w.def.rate * 1.1) {
        const k = Math.exp(-w.def.recoil.recover * dt);
        a.recoil.p *= k; a.recoil.y *= k;
      }
    } else {
      const k = Math.exp(-8 * dt);
      a.recoil.p *= k; a.recoil.y *= k;
    }
  }

  separate() {
    const as = this.agents;
    for (let i = 0; i < as.length; i++) {
      const a = as[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < as.length; j++) {
        const b = as[j];
        if (!b.alive) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.72 && d > 0.0001 && Math.abs(a.pos.y - b.pos.y) < 1.6) {
          const push = (0.72 - d) / 2;
          const nx = dx / d, nz = dz / d;
          const pa = { x: a.pos.x - nx * push, z: a.pos.z - nz * push };
          const pb = { x: b.pos.x + nx * push, z: b.pos.z + nz * push };
          if (fitsAt(a, pa.x, pa.z, this.colliders)) { a.pos.x = pa.x; a.pos.z = pa.z; }
          if (fitsAt(b, pb.x, pb.z, this.colliders)) { b.pos.x = pb.x; b.pos.z = pb.z; }
        }
      }
    }
  }

  // Which enemies are visible to the player's team (for radar)
  updateSpotting() {
    this.spotT = (this.spotT || 0) - 1;
    if (this.spotT > 0) return;
    this.spotT = 6;
    const pt = this.player.team;
    const eyeA = new THREE.Vector3(), eyeB = new THREE.Vector3();
    for (const e of this.agents) {
      if (!e.alive || e.team === pt) continue;
      for (const f of this.agents) {
        if (!f.alive || f.team !== pt) continue;
        this.eyePos(f, eyeA); this.eyePos(e, eyeB);
        const dx = eyeB.x - eyeA.x, dz = eyeB.z - eyeA.z;
        const ang = Math.abs(angleDiff(f.yaw, Math.atan2(-dx, -dz)));
        if (ang > 1.2) continue;
        if (lineClear(this.colliders, eyeA, eyeB) && !this.effects.smokeBlocks(eyeA, eyeB)) { e.spottedT = this.time; break; }
      }
    }
  }

  // -------------------------------------------------------------------------
  updateVisuals(dt, input) {
    this.effects.update(dt);
    // agents
    for (const a of this.agents) {
      const m = a.model;
      m.position.set(a.pos.x, a.pos.y, a.pos.z);
      if (a.alive) {
        m.rotation.set(0, a.yaw, 0);
        poseAgent(m, { walkPhase: a.walkPhase, speed: Math.hypot(a.vel.x, a.vel.z), crouch: a.crouch, pitch: a.pitch + a.recoil.p * 0.5 });
        // weapon in hand
        const w = this.cur(a);
        const id = w ? w.def.model : null;
        if (a.modelWeapon !== id) {
          const mount = m.userData.parts.mount;
          while (mount.children.length) mount.remove(mount.children[0]);
          if (id) {
            if (!a.wcache[id]) a.wcache[id] = buildWeaponModel(id);
            mount.add(a.wcache[id]);
          }
          a.modelWeapon = id;
        }
      } else {
        a.deadT += dt;
        const k = Math.min(1, a.deadT * 2.5);
        m.rotation.set(-k * Math.PI / 2 * 0.98, a.deathYaw || a.yaw, 0, 'YXZ');
        m.position.y = a.pos.y + k * 0.12;
      }
    }
    // dropped/planted charge
    const b = this.bomb;
    if (b.state === 'dropped' || b.state === 'planted') {
      this.bombMesh.visible = true;
      this.bombMesh.position.copy(b.pos);
    } else this.bombMesh.visible = false;
    for (const it of this.items) it.mesh.rotation.y += 0;

    this.updateCamera(dt, input);
  }

  updateCamera(dt, input) {
    const p = this.player;
    const cam = this.camera;
    this.shake = Math.max(0, (this.shake || 0) - dt * 2.5);
    const sh = this.shake * this.shake * 0.04;
    let fov = this.settings.fov || 74;
    if (p.alive) {
      this.eyePos(p, cam.position);
      cam.rotation.set(p.pitch + p.recoil.p * 0.6 + rand(-sh, sh), p.yaw + p.recoil.y * 0.6 + rand(-sh, sh), 0, 'YXZ');
      const w = this.cur(p);
      if (p.scoped && w && w.def.scope) fov = w.def.scope[p.scoped - 1];
      this.vm.visible = true;
      this.vm.update(dt, {
        dx: input ? input.lastDX : 0, dy: input ? input.lastDY : 0,
        speed: Math.hypot(p.vel.x, p.vel.z), onGround: p.onGround, crouch: p.crouch, scoped: p.scoped > 0,
      });
    } else {
      this.vm.visible = false;
      this.vm.root.visible = false;
      // spectate a living teammate (or anyone)
      let t = this.spectating;
      if (!t || !t.alive) {
        t = this.agents.find((a) => a.alive && a.team === p.team) || this.agents.find((a) => a.alive) || null;
        this.spectating = t;
      }
      const target = t || p;
      const head = this.eyePos(target, new THREE.Vector3());
      if (!t) head.y += 2;
      const yaw = t ? t.yaw : p.yaw, pitch = t ? t.pitch : -0.4;
      const back = dirFromAngles(yaw, pitch, {});
      let dist = 2.8;
      const hit = raycastWorld(this.colliders, head.x, head.y + 0.3, head.z, -back.x, -back.y, -back.z, dist);
      if (hit) dist = Math.max(0.3, hit.t - 0.2);
      cam.position.set(head.x - back.x * dist, head.y + 0.3 - back.y * dist, head.z - back.z * dist);
      cam.rotation.set(pitch, yaw, 0, 'YXZ');
    }
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
    const fwd = dirFromAngles(p.alive ? p.yaw : cam.rotation.y, 0, {});
    this.audio.setListener(cam.position, fwd);
  }

  cycleSpectate() {
    const p = this.player;
    const alive = this.agents.filter((a) => a.alive && (a.team === p.team || !this.agents.some((b) => b.alive && b.team === p.team)));
    if (!alive.length) return;
    const i = alive.indexOf(this.spectating);
    this.spectating = alive[(i + 1) % alive.length];
  }
}
