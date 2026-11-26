// Entry point: renderer, lobby, menus and the main loop.
import * as THREE from 'three';
import { Game } from './game.js';
import { HUD } from './hud.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { Lobby } from './lobby.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';

const SETTINGS_KEY = 'browserstrike.settings';
const defaults = { sensitivity: 1.0, fov: 74, volume: 0.6, difficulty: 'normal', length: 'short', team: 'auto', name: 'You', friendlyFire: false, quality: 'high' };
const settings = { ...defaults, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
const saveSettings = () => localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, settings.quality === 'low' ? 1 : 1.5));
renderer.shadowMap.enabled = settings.quality !== 'low';
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.autoClear = false;

// Post-processing: world -> ambient occlusion -> first-person weapon on top -> tone map -> SMAA.
function makeComposer(scene, camera, overlay) {
  if (settings.quality === 'low') return null;
  const w = window.innerWidth, h = window.innerHeight;
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  if (settings.quality === 'high') {
    const ao = new GTAOPass(scene, camera, w, h);
    ao.updateGtaoMaterial({ radius: 0.7, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: 12 });
    ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    ao.blendIntensity = 0.9;
    composer.addPass(ao);
  }
  if (overlay) {
    const vmPass = new RenderPass(overlay.scene, overlay.camera);
    vmPass.clear = false;
    vmPass.clearDepth = true;
    composer.addPass(vmPass);
  }
  composer.addPass(new OutputPass());
  composer.addPass(new SMAAPass(w * renderer.getPixelRatio(), h * renderer.getPixelRatio()));
  return composer;
}
let composer = null;
let lobbyComposer = null;

const audio = new Audio();
audio.setVolume(settings.volume);
const input = new Input(canvas, settings);
const hud = new HUD(document.getElementById('hud'));
const lobby = new Lobby();
let game = null;
let state = 'menu'; // menu | playing | paused | over

const ui = {
  menu: document.getElementById('menu'),
  pause: document.getElementById('pause'),
  over: document.getElementById('over'),
  hud: document.getElementById('hud'),
  click: document.getElementById('clickplay'),
};

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  lobby.resize(w / h);
  if (game) { game.camera.aspect = w / h; game.camera.updateProjectionMatrix(); game.vm.resize(w / h); }
  if (composer) composer.setSize(w, h);
  if (lobbyComposer) lobbyComposer.setSize(w, h);
}
window.addEventListener('resize', resize);

// ---------------------------------------------------------------------------
// Menu wiring
function bindSetting(id, key, parse = (v) => v, after) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.type === 'checkbox') el.checked = !!settings[key]; else el.value = settings[key];
  const out = document.getElementById(`${id}-val`);
  if (out) out.textContent = settings[key];
  el.addEventListener('input', () => {
    settings[key] = el.type === 'checkbox' ? el.checked : parse(el.value);
    if (out) out.textContent = settings[key];
    saveSettings();
    if (after) after();
  });
}
bindSetting('set-sens', 'sensitivity', parseFloat);
bindSetting('set-fov', 'fov', (v) => parseInt(v, 10));
bindSetting('set-vol', 'volume', parseFloat, () => audio.setVolume(settings.volume));
bindSetting('set-diff', 'difficulty');
bindSetting('set-len', 'length');
bindSetting('set-team', 'team', (v) => v, () => lobby.setTeam(settings.team === 'R' ? 'R' : 'G'));
bindSetting('set-name', 'name', (v) => v.slice(0, 16) || 'You');
bindSetting('set-ff', 'friendlyFire');
bindSetting('set-quality', 'quality');
bindSetting('p-sens', 'sensitivity', parseFloat);
bindSetting('p-vol', 'volume', parseFloat, () => audio.setVolume(settings.volume));
lobby.setTeam(settings.team === 'R' ? 'R' : 'G');
lobby.setEnvironment(renderer);
lobbyComposer = makeComposer(lobby.scene, lobby.camera, null);

document.querySelectorAll('[data-mode]').forEach((card) => {
  card.addEventListener('click', () => startMatch(card.dataset.mode));
});
document.querySelectorAll('[data-tab]').forEach((t) => {
  t.addEventListener('click', () => {
    document.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('active', x === t));
    document.querySelectorAll('.tabpage').forEach((p) => p.classList.toggle('hidden', p.id !== t.dataset.tab));
  });
});
document.getElementById('btn-resume').addEventListener('click', () => resume());
document.getElementById('btn-quit').addEventListener('click', () => quitToMenu());
document.getElementById('btn-over-menu').addEventListener('click', () => quitToMenu());
document.getElementById('btn-over-again').addEventListener('click', () => { const m = game.mode.id; quitToMenu(); startMatch(m); });
document.getElementById('btn-fullscreen').addEventListener('click', () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
  else document.exitFullscreen();
});
ui.click.addEventListener('click', () => resume());
canvas.addEventListener('click', () => { if (state === 'playing' && !input.locked && !hud.buyOpen) input.lock(); });

function startMatch(mode) {
  audio.init();
  if (game) { game.dispose(); game = null; }
  game = new Game(renderer, audio, settings);
  game.start({ mode, team: settings.team, difficulty: settings.difficulty, length: settings.length, playerName: settings.name });
  hud.attach(game);
  if (composer) composer.dispose();
  composer = makeComposer(game.scene, game.camera, game.vm);
  game.on('matchEnd', (r) => showMatchEnd(r));
  hud.onBuyClose = () => { if (state === 'playing') input.lock(); };
  resize();
  ui.menu.classList.add('hidden');
  ui.hud.classList.remove('hidden');
  ui.over.classList.add('hidden');
  ui.pause.classList.add('hidden');
  state = 'playing';
  input.enabled = true;
  input.lock();
  ui.click.classList.remove('hidden');
}

function resume() {
  if (!game) return;
  audio.init();
  ui.pause.classList.add('hidden');
  state = 'playing';
  input.lock();
}

function pause() {
  if (state !== 'playing') return;
  state = 'paused';
  ui.pause.classList.remove('hidden');
}

function quitToMenu() {
  input.unlock();
  input.enabled = false;
  if (game) { game.dispose(); game = null; }
  hud.closeBuy();
  ui.pause.classList.add('hidden');
  ui.over.classList.add('hidden');
  ui.hud.classList.add('hidden');
  ui.click.classList.add('hidden');
  ui.menu.classList.remove('hidden');
  state = 'menu';
}

function showMatchEnd(r) {
  state = 'over';
  input.unlock();
  const me = game.player.team;
  const title = !r.winner ? 'Match drawn' : r.winner === me ? 'Victory' : 'Defeat';
  const p = game.player;
  document.getElementById('over-title').textContent = title;
  document.getElementById('over-title').className = !r.winner ? '' : r.winner === me ? 'win' : 'lose';
  const myScore = me === 'R' ? game.scoreR : game.scoreG;
  const theirScore = me === 'R' ? game.scoreG : game.scoreR;
  document.getElementById('over-score').textContent = `${myScore} : ${theirScore}`;
  document.getElementById('over-stats').innerHTML =
    `<div><b>${p.kills}</b>Kills</div><div><b>${p.deaths}</b>Deaths</div><div><b>${p.assists}</b>Assists</div>` +
    `<div><b>${p.mvps}</b>MVPs</div><div><b>${p.damage}</b>Damage</div>`;
  ui.over.classList.remove('hidden');
}

input.onLockChange = (locked) => {
  ui.click.classList.toggle('hidden', locked || state !== 'playing');
  if (!locked && state === 'playing' && !hud.buyOpen) pause();
};

window.addEventListener('keydown', (e) => {
  if (!game || state === 'menu' || state === 'over') return;
  if (e.code === 'KeyB' && state === 'playing') {
    if (hud.buyOpen) { hud.closeBuy(); }
    else if (hud.toggleBuy(true)) { input.unlock(); }
  } else if (e.code === 'Escape' && hud.buyOpen) {
    hud.closeBuy();
  } else if (e.code === 'Escape' && state === 'paused') {
    resume();
  }
});

// ---------------------------------------------------------------------------
// Main loop
let last = performance.now();
let fpsAcc = 0, fpsN = 0;
const fpsEl = document.getElementById('fps');
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 0.5) { fpsEl.textContent = `${Math.round(fpsN / fpsAcc)} FPS`; fpsAcc = 0; fpsN = 0; }

  if (state === 'menu' || !game) {
    lobby.update(dt);
    if (lobbyComposer) lobbyComposer.render(dt);
    else { renderer.clear(); renderer.render(lobby.scene, lobby.camera); }
    return;
  }
  input.uiBlocked = hud.buyOpen;
  if (state === 'playing' || state === 'over') {
    game.update(dt, state === 'playing' ? input : null);
  }
  input.endFrame();
  game.vm.root.visible = game.vm.root.visible && game.player.alive && game.vm.visible;
  if (composer) composer.render(dt);
  else {
    renderer.clear();
    renderer.render(game.scene, game.camera);
    if (game.player.alive && game.vm.visible) {
      renderer.clearDepth();
      renderer.render(game.vm.scene, game.vm.camera);
    }
  }
  hud.update(dt, game.camera, input.keys.has('Tab') || state === 'over');
}
resize();
requestAnimationFrame(frame);

// Debug / automation hook
window.BS = {
  get game() { return game; },
  startMatch, settings,
  simulate(seconds, step = 1 / 60) {
    for (let t = 0; t < seconds; t += step) game.update(step, null);
  },
};
