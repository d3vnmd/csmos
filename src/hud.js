// DOM-based HUD: radar, score, health, ammo, kill feed, buy menu, scoreboard.
import * as THREE from 'three';
import { WEAPONS, GEAR, BUY_MENU } from './weapons.js';
import { fmtTime, clamp } from './util.js';
import { agentHeight } from './physics.js';

const TEAM_NAME = { R: 'Raiders', G: 'Guardians' };
const REASON = {
  elim: (w) => `${TEAM_NAME[w]} eliminated the enemy`,
  time: () => 'Time ran out — Guardians hold',
  bomb: () => 'The charge detonated',
  defuse: () => 'The charge was defused',
  draw: () => 'Round draw',
};
const SLOT_KEYS = { primary: 1, secondary: 2, knife: 3, grenade: 4, bomb: 5 };

const $ = (sel, root = document) => root.querySelector(sel);

export class HUD {
  constructor(root) {
    this.root = root;
    root.innerHTML = `
      <div id="radar"><canvas width="220" height="220"></canvas></div>
      <div id="score">
        <div class="side left"><div class="tname"></div><div class="pts"></div><div class="alive"></div></div>
        <div class="mid"><div class="timer">0:00</div><div class="phase"></div></div>
        <div class="side right"><div class="tname"></div><div class="pts"></div><div class="alive"></div></div>
      </div>
      <div id="killfeed"></div>
      <div id="money"><span class="cash">$0</span><span class="buyhint">[B] Buy</span></div>
      <div id="vitals">
        <div class="hp"><svg viewBox="0 0 24 24"><path d="M10 2h4v8h8v4h-8v8h-4v-8H2v-4h8z"/></svg><b>100</b></div>
        <div class="bar hpbar"><i></i></div>
        <div class="ar"><svg viewBox="0 0 24 24"><path d="M12 2l8 3v6c0 5-3.5 9.5-8 11-4.5-1.5-8-6-8-11V5z"/></svg><b>0</b></div>
        <div class="extras"></div>
      </div>
      <div id="ammo"><b class="mag">--</b><span class="res">/ --</span><div class="wname"></div></div>
      <div id="weapons"></div>
      <div id="crosshair"><i class="t"></i><i class="b"></i><i class="l"></i><i class="r"></i><i class="dot"></i></div>
      <div id="hitmarker"></div>
      <div id="dmgdirs"></div>
      <div id="names"></div>
      <div id="scope"><div class="ring"></div><div class="lh"></div><div class="lv"></div></div>
      <div id="progress"><div class="label"></div><div class="track"><i></i></div></div>
      <div id="prompt"></div>
      <div id="messages"></div>
      <div id="banner"><div class="title"></div><div class="sub"></div></div>
      <div id="bombicon">CHARGE</div>
      <div id="spec"></div>
      <div id="buymenu" class="overlay hidden"></div>
      <div id="scoreboard" class="overlay hidden"></div>
      <div id="flash"></div>
    `;
    this.radar = $('#radar canvas', root);
    this.rctx = this.radar.getContext('2d');
    this.cache = {};
    this.dmgDirs = [];
    this.messages = [];
    this.banner = null;
    this.buyOpen = false;
    this.projV = new THREE.Vector3();
  }

  set(key, el, val, prop = 'textContent') {
    if (this.cache[key] === val) return;
    this.cache[key] = val;
    el[prop] = val;
  }

  attach(game) {
    this.game = game;
    this.buildRadarImage();
    game.on('message', (t, kind) => this.message(t, kind));
    game.on('hitmarker', (head, kill) => this.hitmarker(head, kill));
    game.on('hurt', (from, dmg) => this.hurt(from, dmg));
    game.on('roundEnd', (r) => {
      const me = game.player.team;
      const title = r.winner ? `${TEAM_NAME[r.winner]} win` : 'Draw';
      let sub = (REASON[r.reason] || (() => ''))(r.winner);
      if (r.mvp) sub += ` · MVP: ${r.mvp.name}`;
      if (r.swap) sub += ' · Switching sides';
      this.showBanner(title, sub, r.winner === me ? 'win' : r.winner ? 'lose' : '');
    });
    game.on('roundStart', (n) => {
      this.closeBuy();
      this.showBanner(`Round ${n}`, game.mode.buy ? 'Buy time — press B' : 'Get ready', 'neutral', 2.5);
    });
    game.on('live', () => this.message('Go go go!', 'good'));
    game.on('halftime', () => this.message('Halftime — teams switched sides', 'warn'));
    game.on('planted', (site) => this.showBanner('Charge planted', `Site ${site}`, 'warn', 2.5));
    game.on('playerDied', (by) => this.message(by && by !== game.player ? `Killed by ${by.name}` : 'You died', 'bad'));
  }

  // ---------------------------------------------------------------------------
  buildRadarImage() {
    const m = this.game.map;
    const c = document.createElement('canvas');
    const s = 8;
    c.width = m.W * s; c.height = m.H * s;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, c.width, c.height);
    for (let r = 0; r < m.H; r++) for (let col = 0; col < m.W; col++) {
      const ch = m.grid[r][col];
      if (ch === '#') continue;
      ctx.fillStyle = ch === 'a' || ch === 'b' ? 'rgba(200,170,70,0.85)' : ch === 'c' || ch === 'C' || ch === 'o' ? 'rgba(110,100,80,0.9)' : 'rgba(170,160,135,0.75)';
      if (ch === 'G') ctx.fillStyle = 'rgba(80,120,170,0.75)';
      if (ch === 'R') ctx.fillStyle = 'rgba(170,110,70,0.75)';
      ctx.fillRect(col * s, r * s, s, s);
    }
    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const [letter, zone] of Object.entries(m.def.sites)) {
      const z = m.def.zones[zone];
      ctx.fillText(letter, ((z[0] + z[2]) / 2 + 0.5) * s, ((z[1] + z[3]) / 2 + 0.5) * s);
    }
    this.radarImg = c;
    this.radarScale = s / 2; // px per meter
  }

  drawRadar() {
    const g = this.game, p = g.player, ctx = this.rctx;
    const W = this.radar.width, H = this.radar.height;
    const zoom = g.mode.teamSize === 1 ? 1.8 : 1.15;
    const focus = p.alive ? p : g.spectating || p;
    const yaw = focus.yaw;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(20,24,28,0.55)';
    ctx.fill();
    ctx.clip();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(yaw);
    ctx.scale(zoom, zoom);
    const m = g.map;
    const s = this.radarScale;
    // world -> radar: x * s, z * s (relative to focus)
    ctx.translate(-focus.pos.x * s, -focus.pos.z * s);
    ctx.drawImage(this.radarImg, -m.W / 2 * 2 * s, -m.H / 2 * 2 * s, m.W * 2 * s, m.H * 2 * s);
    const dot = (x, z, color, r = 4, ring = false) => {
      ctx.beginPath();
      ctx.arc(x * s, z * s, r / zoom, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      if (ring) { ctx.lineWidth = 1.5 / zoom; ctx.strokeStyle = '#fff'; ctx.stroke(); }
    };
    for (const a of g.agents) {
      if (a === p) continue;
      if (a.team === p.team) {
        if (a.alive) dot(a.pos.x, a.pos.z, '#5fd0ff', 4.5, a.inv.bomb);
        else { ctx.fillStyle = '#5fd0ff'; ctx.font = `${12 / zoom}px sans-serif`; ctx.fillText('×', a.pos.x * s - 3 / zoom, a.pos.z * s + 4 / zoom); }
      } else if (a.alive && g.time - a.spottedT < 1.5) dot(a.pos.x, a.pos.z, '#ff4a3a', 4.5);
    }
    const b = g.bomb;
    if ((b.state === 'dropped' && p.team === 'R') || b.state === 'planted') {
      const blink = b.state === 'planted' ? (Math.sin(g.time * 10) > 0 ? '#ff3030' : '#ffd040') : '#ffd040';
      ctx.fillStyle = blink;
      ctx.fillRect(b.pos.x * s - 4 / zoom, b.pos.z * s - 3 / zoom, 8 / zoom, 6 / zoom);
    }
    ctx.restore();
    // player arrow
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.beginPath();
    ctx.moveTo(0, -8); ctx.lineTo(6, 6); ctx.lineTo(0, 3); ctx.lineTo(-6, 6); ctx.closePath();
    ctx.fillStyle = p.alive ? '#ffffff' : '#888';
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2);
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.stroke();
  }

  // ---------------------------------------------------------------------------
  message(text, kind = 'info') {
    const box = $('#messages', this.root);
    const el = document.createElement('div');
    el.className = `msg ${kind}`;
    el.textContent = text;
    box.appendChild(el);
    setTimeout(() => el.classList.add('out'), 2600);
    setTimeout(() => el.remove(), 3200);
    while (box.children.length > 4) box.firstChild.remove();
  }

  showBanner(title, sub, kind = '', dur = 4.5) {
    const el = $('#banner', this.root);
    el.className = `show ${kind}`;
    $('.title', el).textContent = title;
    $('.sub', el).textContent = sub;
    clearTimeout(this.bannerTO);
    this.bannerTO = setTimeout(() => { el.className = ''; }, dur * 1000);
  }

  hitmarker(head, kill) {
    const el = $('#hitmarker', this.root);
    el.className = '';
    void el.offsetWidth;
    el.className = `show ${head ? 'head' : ''} ${kill ? 'kill' : ''}`;
  }

  hurt(from, dmg) {
    this.dmgDirs.push({ from, t: 1.2 });
    const f = $('#flash', this.root);
    f.style.opacity = Math.min(0.5, dmg / 80);
    clearTimeout(this.flashTO);
    this.flashTO = setTimeout(() => { f.style.opacity = 0; }, 120);
  }

  // ---------------------------------------------------------------------------
  toggleBuy(force) {
    const g = this.game;
    const open = force !== undefined ? force : !this.buyOpen;
    if (open && !g.canBuy(g.player)) {
      if (g.mode.buy) this.message(g.player.alive ? 'You can only buy in your spawn during buy time' : 'You are dead', 'bad');
      return false;
    }
    this.buyOpen = open;
    const el = $('#buymenu', this.root);
    el.classList.toggle('hidden', !open);
    if (open) this.renderBuy();
    return true;
  }
  closeBuy() { if (this.buyOpen) { this.buyOpen = false; $('#buymenu', this.root).classList.add('hidden'); if (this.onBuyClose) this.onBuyClose(); } }

  renderBuy() {
    const g = this.game, p = g.player;
    const el = $('#buymenu', this.root);
    const owned = (id) => {
      if (GEAR[id]) return id === 'kevlar' ? p.armor >= 100 : id === 'helmet' ? p.armor >= 100 && p.helmet : p.kit;
      const def = WEAPONS[id];
      if (def.slot === 'grenade') return p.inv.grenade.some((x) => x.def.id === id);
      return p.inv[def.slot] && p.inv[def.slot].def.id === id;
    };
    let html = `<div class="buyhead"><h2>Buy Menu</h2><div class="cash">$${p.money}</div>
      <div class="buytime">Buy time: ${fmtTime(Math.max(0, g.phase === 'freeze' ? g.phaseTimer + g.mode.buyTime - g.mode.freeze : g.mode.buyTime - g.mode.freeze - g.roundElapsed))}</div></div><div class="cols">`;
    for (const cat of BUY_MENU) {
      html += `<div class="col"><h3>${cat.title}</h3>`;
      for (const id of cat.items) {
        const it = WEAPONS[id] || GEAR[id];
        if (it.team && it.team !== p.team) continue;
        let price = it.price;
        if (id === 'helmet' && p.armor >= 100 && !p.helmet) price = 350;
        const has = owned(id);
        const cant = p.money < price;
        html += `<button class="item ${has ? 'owned' : ''} ${cant ? 'cant' : ''}" data-id="${id}">
          <span class="nm">${it.name}</span><span class="pr">${has ? 'OWNED' : '$' + price}</span>
          ${it.damage ? `<span class="st">DMG ${it.damage}${it.pellets ? '×' + it.pellets : ''} · ${it.mag ? it.mag + ' rds' : ''}</span>` : ''}
        </button>`;
      }
      html += '</div>';
    }
    html += '</div><div class="buyfoot">Click to buy · B / Esc to close</div>';
    el.innerHTML = html;
    el.querySelectorAll('.item').forEach((b) => {
      b.onclick = () => {
        if (g.buy(p, b.dataset.id)) g.audio.buy(); else g.audio.deny();
        this.renderBuy();
      };
    });
  }

  renderScoreboard(show) {
    const el = $('#scoreboard', this.root);
    el.classList.toggle('hidden', !show);
    if (!show) return;
    const g = this.game;
    const rows = (team) => g.agents.filter((a) => a.team === team)
      .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths)
      .map((a) => `<tr class="${a.alive ? '' : 'dead'} ${a.isPlayer ? 'me' : ''}">
        <td>${a.name}${a.inv.bomb ? ' <em>●</em>' : ''}</td>
        <td>${a.team === g.player.team && g.mode.buy ? '$' + a.money : ''}</td>
        <td>${a.kills}</td><td>${a.assists}</td><td>${a.deaths}</td><td>${a.mvps ? '★' + a.mvps : ''}</td></tr>`).join('');
    const block = (team) => `<div class="sbteam ${team}"><div class="sbhead"><span>${TEAM_NAME[team]}</span>
      <b>${team === 'R' ? g.scoreR : g.scoreG}</b></div>
      <table><tr><th>Player</th><th>Money</th><th>K</th><th>A</th><th>D</th><th>MVP</th></tr>${rows(team)}</table></div>`;
    const me = g.player.team, other = me === 'R' ? 'G' : 'R';
    el.innerHTML = `<div class="sbtitle">${g.map.def.name} · ${g.mode.name} · Round ${g.round}</div>${block(me)}${block(other)}`;
  }

  // ---------------------------------------------------------------------------
  update(dt, camera, showScores) {
    const g = this.game, p = g.player, R = this.root;
    if (!g) return;
    // score bar
    const me = p.team, other = me === 'R' ? 'G' : 'R';
    const sc = { R: g.scoreR, G: g.scoreG };
    this.set('tnL', $('#score .left .tname', R), TEAM_NAME[me]);
    this.set('tnR', $('#score .right .tname', R), TEAM_NAME[other]);
    this.set('ptsL', $('#score .left .pts', R), String(sc[me]));
    this.set('ptsR', $('#score .right .pts', R), String(sc[other]));
    $('#score .left', R).dataset.team = me;
    $('#score .right', R).dataset.team = other;
    const aliveHtml = (team) => g.agents.filter((a) => a.team === team).map((a) => `<i class="${a.alive ? '' : 'd'}"></i>`).join('');
    this.set('alL', $('#score .left .alive', R), aliveHtml(me), 'innerHTML');
    this.set('alR', $('#score .right .alive', R), aliveHtml(other), 'innerHTML');
    let timer = g.phaseTimer, phase = '';
    if (g.phase === 'freeze') phase = g.mode.buy ? 'BUY TIME' : 'GET READY';
    if (g.phase === 'live' && g.bomb.state === 'planted') { timer = g.bomb.timer; phase = 'CHARGE PLANTED'; }
    if (g.phase === 'post') phase = 'ROUND OVER';
    this.set('timer', $('#score .timer', R), g.phase === 'live' && g.bomb.state === 'planted' ? '' : fmtTime(timer));
    $('#score .mid', R).classList.toggle('planted', g.bomb.state === 'planted' && g.phase === 'live');
    this.set('phase', $('#score .phase', R), phase);

    // money
    $('#money', R).style.display = g.mode.buy ? '' : 'none';
    this.set('cash', $('#money .cash', R), `$${p.money}`);
    $('#money .buyhint', R).style.visibility = g.canBuy(p) ? 'visible' : 'hidden';

    // vitals
    const hpEl = $('#vitals .hp b', R);
    this.set('hp', hpEl, String(Math.max(0, p.hp)));
    $('#vitals', R).classList.toggle('low', p.hp <= 25);
    $('#vitals .hpbar i', R).style.width = `${Math.max(0, p.hp)}%`;
    this.set('ar', $('#vitals .ar b', R), String(p.armor));
    this.set('ex', $('#vitals .extras', R), `${p.helmet ? '<span>HELMET</span>' : ''}${p.kit ? '<span>KIT</span>' : ''}`, 'innerHTML');

    // ammo
    const w = g.cur(p);
    if (w && w.def.mag) {
      this.set('mag', $('#ammo .mag', R), w.reloadLeft > 0 ? '··' : String(w.mag));
      this.set('res', $('#ammo .res', R), `/ ${w.reserve}`);
      $('#ammo', R).classList.toggle('low', w.mag <= Math.ceil(w.def.mag * 0.2));
    } else {
      this.set('mag', $('#ammo .mag', R), '');
      this.set('res', $('#ammo .res', R), '');
    }
    this.set('wn', $('#ammo .wname', R), w ? w.def.name : '');

    // weapon list
    const list = [];
    for (const slot of ['primary', 'secondary', 'knife', 'grenade', 'bomb']) {
      if (slot === 'grenade') { for (const gr of p.inv.grenade) list.push([slot, gr.def.name, p.cur === slot && p.inv.grenade[0] === gr]); continue; }
      const it = p.inv[slot];
      if (it) list.push([slot, it.def.name, p.cur === slot]);
    }
    const wl = list.map(([s, n, on]) => `<div class="${on ? 'on' : ''}"><span>${n}</span><em>${SLOT_KEYS[s]}</em></div>`).join('');
    this.set('wl', $('#weapons', R), p.alive ? wl : '', 'innerHTML');

    // crosshair
    const ch = $('#crosshair', R);
    const scoped = p.alive && p.scoped > 0;
    const showCross = p.alive && !scoped && !(w && w.def.type === 'sniper');
    ch.style.display = showCross ? '' : 'none';
    if (showCross && w) {
      const sp = g.spreadFor(p, w) + Math.abs(p.recoil.p) * 0.4;
      const gap = 4 + sp * 900 * (74 / (g.settings.fov || 74));
      ch.style.setProperty('--gap', `${clamp(gap, 4, 60).toFixed(1)}px`);
    }
    $('#scope', R).style.display = scoped ? 'block' : 'none';

    // progress bar (plant/defuse)
    const prog = $('#progress', R);
    if (p.planting > 0 || p.defusing > 0) {
      prog.style.display = 'block';
      const total = p.planting > 0 ? g.mode.plantTime : p.kit ? 5 : 10;
      const v = p.planting > 0 ? p.planting : p.defusing;
      $('.label', prog).textContent = p.planting > 0 ? 'Planting charge…' : `Defusing${p.kit ? ' (kit)' : ''}…`;
      $('.track i', prog).style.width = `${(v / total) * 100}%`;
    } else prog.style.display = 'none';

    // prompts
    let prompt = '';
    if (p.alive) {
      if (p.inv.bomb && g.map.siteAt(p.pos.x, p.pos.z) && g.phase === 'live' && p.planting === 0) prompt = 'Hold [E] to plant the charge';
      else if (p.team === 'G' && g.bomb.state === 'planted' && p.pos.distanceTo(g.bomb.pos) < 1.8 && p.defusing === 0) prompt = 'Hold [E] to defuse';
      else {
        const it = g.nearestItem(p);
        if (it) prompt = `[E] Pick up ${it.inst.def.name}`;
      }
    }
    this.set('prompt', $('#prompt', R), prompt);
    $('#bombicon', R).style.display = p.alive && p.inv.bomb ? 'block' : 'none';
    $('#bombicon', R).classList.toggle('insite', !!(p.inv.bomb && g.map.siteAt(p.pos.x, p.pos.z)));

    // spectator
    const spec = $('#spec', R);
    if (!p.alive && g.phase !== 'matchEnd') {
      spec.style.display = 'block';
      this.set('spec', spec, g.spectating ? `Spectating ${g.spectating.name} · ${g.spectating.hp} HP · Click to switch` : 'You are dead');
    } else spec.style.display = 'none';

    // killfeed
    const kf = g.killfeed.filter((k) => g.time - k.t < 7);
    const kfHtml = kf.map((k) => `<div class="${k.involvesPlayer ? 'me' : ''}">
      ${k.killer ? `<span class="t${k.killerTeam}">${k.killer}</span>` : ''}
      <em>${k.weapon}${k.headshot ? ' ⌖' : ''}</em>
      <span class="t${k.victimTeam}">${k.victim}</span></div>`).join('');
    this.set('kf', $('#killfeed', R), kfHtml, 'innerHTML');

    // damage direction indicators
    const dd = $('#dmgdirs', R);
    this.dmgDirs = this.dmgDirs.filter((d) => (d.t -= dt) > 0);
    dd.innerHTML = this.dmgDirs.map((d) => {
      const ang = Math.atan2(-(d.from.x - p.pos.x), -(d.from.z - p.pos.z)) - p.yaw;
      return `<i style="transform: rotate(${(-ang * 180 / Math.PI).toFixed(1)}deg); opacity:${Math.min(1, d.t)}"></i>`;
    }).join('');

    // teammate names
    const names = $('#names', R);
    let nh = '';
    const vw = window.innerWidth, vh = window.innerHeight;
    for (const a of g.agents) {
      if (a.isPlayer || !a.alive || a.team !== p.team) continue;
      this.projV.set(a.pos.x, a.pos.y + agentHeight(a) + 0.35, a.pos.z).project(camera);
      if (this.projV.z > 1) continue;
      const x = (this.projV.x + 1) / 2 * vw, y = (1 - this.projV.y) / 2 * vh;
      if (x < 0 || x > vw || y < 0 || y > vh) continue;
      nh += `<span style="left:${x | 0}px;top:${y | 0}px">${a.name}</span>`;
    }
    names.innerHTML = nh;

    this.drawRadar();
    this.renderScoreboard(showScores);
    if (this.buyOpen) {
      if (!g.canBuy(p)) this.closeBuy();
      else {
        this.buyRefresh = (this.buyRefresh || 0) - dt;
        if (this.buyRefresh <= 0) { this.buyRefresh = 1; const c = $('#buymenu .buytime', R); if (c) c.textContent = `Buy time: ${fmtTime(Math.max(0, g.phase === 'freeze' ? g.phaseTimer + g.mode.buyTime - g.mode.freeze : g.mode.buyTime - g.mode.freeze - g.roundElapsed))}`; }
      }
    }
  }
}
