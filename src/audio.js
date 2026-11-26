// All sound is synthesized with WebAudio at runtime.
export class Audio {
  constructor() {
    this.ctx = null;
    this.volume = 0.6;
    this.lastStep = new Map();
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 4;
    this.master.connect(comp);
    comp.connect(this.ctx.destination);
    // shared white noise buffer
    const len = this.ctx.sampleRate * 2;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  setListener(pos, fwd) {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    const t = this.ctx.currentTime;
    if (l.positionX) {
      l.positionX.setValueAtTime(pos.x, t); l.positionY.setValueAtTime(pos.y, t); l.positionZ.setValueAtTime(pos.z, t);
      l.forwardX.setValueAtTime(fwd.x, t); l.forwardY.setValueAtTime(fwd.y, t); l.forwardZ.setValueAtTime(fwd.z, t);
      l.upX.setValueAtTime(0, t); l.upY.setValueAtTime(1, t); l.upZ.setValueAtTime(0, t);
    } else {
      l.setPosition(pos.x, pos.y, pos.z);
      l.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0);
    }
  }

  out(pos) {
    if (!pos) return this.master;
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = 4;
    p.rolloffFactor = 1.1;
    p.maxDistance = 200;
    const t = this.ctx.currentTime;
    if (p.positionX) {
      p.positionX.setValueAtTime(pos.x, t); p.positionY.setValueAtTime(pos.y, t); p.positionZ.setValueAtTime(pos.z, t);
    } else p.setPosition(pos.x, pos.y, pos.z);
    p.connect(this.master);
    return p;
  }

  noiseBurst(dest, { start = 0, dur = 0.1, f0 = 3000, f1 = 300, type = 'lowpass', vol = 1, q = 0.7, attack = 0.002 }) {
    const c = this.ctx, t = c.currentTime + start;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const filt = c.createBiquadFilter();
    filt.type = type;
    filt.Q.value = q;
    filt.frequency.setValueAtTime(f0, t);
    filt.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt); filt.connect(g); g.connect(dest);
    src.start(t, Math.random() * 1.5, dur + 0.05);
  }

  tone(dest, { start = 0, dur = 0.1, f0 = 440, f1 = null, type = 'sine', vol = 0.3, attack = 0.005 }) {
    const c = this.ctx, t = c.currentTime + start;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // --- game sounds -------------------------------------------------------
  shot(def, pos) {
    if (!this.ctx || !def.sound) return;
    const s = def.sound;
    const d = this.out(pos);
    const v = s.v * (pos ? 1.0 : 0.55);
    this.noiseBurst(d, { dur: s.d, f0: s.f * 2.2, f1: s.f * 0.25, vol: v, attack: 0.001 });
    this.noiseBurst(d, { dur: s.d * 2.2, f0: 900, f1: 120, vol: v * 0.35, start: 0.01 });
    this.tone(d, { dur: 0.09 + s.d * 0.3, f0: s.t, f1: 35, vol: v * 0.8, type: 'sine', attack: 0.001 });
  }

  knife(pos, hit) {
    if (!this.ctx) return;
    const d = this.out(pos);
    this.noiseBurst(d, { dur: 0.18, f0: 1500, f1: 5000, type: 'bandpass', vol: 0.35, q: 2 });
    if (hit) this.noiseBurst(d, { start: 0.05, dur: 0.1, f0: 600, f1: 120, vol: 0.6 });
  }

  step(pos, key) {
    if (!this.ctx) return;
    const d = this.out(pos);
    this.noiseBurst(d, { dur: 0.07, f0: 1200, f1: 250, type: 'bandpass', vol: pos ? 0.45 : 0.12, q: 1.2 });
  }

  land(pos) {
    if (!this.ctx) return;
    this.noiseBurst(this.out(pos), { dur: 0.12, f0: 700, f1: 100, vol: pos ? 0.5 : 0.18 });
  }

  click() {
    if (!this.ctx) return;
    this.tone(this.master, { dur: 0.03, f0: 1800, type: 'square', vol: 0.08 });
  }

  reload(def, pos) {
    if (!this.ctx) return;
    const d = this.out(pos);
    const r = def.reload || 2;
    this.noiseBurst(d, { start: 0.15, dur: 0.06, f0: 3500, f1: 1500, type: 'bandpass', vol: 0.4, q: 3 });
    this.noiseBurst(d, { start: r * 0.55, dur: 0.07, f0: 2500, f1: 900, type: 'bandpass', vol: 0.5, q: 3 });
    this.noiseBurst(d, { start: r * 0.85, dur: 0.05, f0: 4000, f1: 2000, type: 'bandpass', vol: 0.5, q: 4 });
  }

  draw() {
    if (!this.ctx) return;
    this.noiseBurst(this.master, { dur: 0.08, f0: 3000, f1: 1200, type: 'bandpass', vol: 0.18, q: 3 });
  }

  hit(pos, head, helmet) {
    if (!this.ctx) return;
    const d = this.out(pos);
    if (head && helmet) this.tone(d, { dur: 0.25, f0: 2400, f1: 1800, type: 'triangle', vol: 0.35 });
    else if (head) this.noiseBurst(d, { dur: 0.15, f0: 900, f1: 200, vol: 0.9 });
    else this.noiseBurst(d, { dur: 0.1, f0: 500, f1: 120, vol: 0.6 });
  }

  hitmarker() {
    if (!this.ctx) return;
    this.tone(this.master, { dur: 0.05, f0: 2200, type: 'triangle', vol: 0.06 });
  }

  bounce(pos) {
    if (!this.ctx) return;
    this.tone(this.out(pos), { dur: 0.06, f0: 900, f1: 500, type: 'triangle', vol: 0.3 });
  }

  explosion(pos) {
    if (!this.ctx) return;
    const d = this.out(pos);
    this.noiseBurst(d, { dur: 1.6, f0: 2500, f1: 60, vol: 1.4, attack: 0.002 });
    this.tone(d, { dur: 0.9, f0: 90, f1: 25, vol: 1.2, attack: 0.002 });
  }

  smokePop(pos) {
    if (!this.ctx) return;
    this.noiseBurst(this.out(pos), { dur: 2.5, f0: 3000, f1: 500, type: 'highpass', vol: 0.35, attack: 0.05 });
  }

  beep(pos, hi = false) {
    if (!this.ctx) return;
    this.tone(this.out(pos), { dur: 0.09, f0: hi ? 3200 : 2600, type: 'sine', vol: 0.5 });
  }

  plantTick() {
    if (!this.ctx) return;
    this.tone(this.master, { dur: 0.05, f0: 1400, type: 'square', vol: 0.06 });
  }

  defuseTick() {
    if (!this.ctx) return;
    this.noiseBurst(this.master, { dur: 0.04, f0: 5000, f1: 3000, type: 'bandpass', vol: 0.15, q: 5 });
  }

  buy() {
    if (!this.ctx) return;
    this.tone(this.master, { dur: 0.08, f0: 900, type: 'triangle', vol: 0.15 });
    this.tone(this.master, { start: 0.06, dur: 0.1, f0: 1350, type: 'triangle', vol: 0.15 });
  }

  deny() {
    if (!this.ctx) return;
    this.tone(this.master, { dur: 0.15, f0: 220, type: 'square', vol: 0.08 });
  }

  // short original stingers
  jingle(kind) {
    if (!this.ctx) return;
    const seq = {
      start: [[523, 0], [659, 0.12], [784, 0.24]],
      win: [[392, 0], [523, 0.15], [659, 0.3], [784, 0.45], [1046, 0.6]],
      lose: [[440, 0], [392, 0.18], [330, 0.36], [262, 0.6]],
      planted: [[880, 0], [660, 0.2], [880, 0.4]],
    }[kind];
    if (!seq) return;
    for (const [f, t] of seq) {
      this.tone(this.master, { start: t, dur: 0.35, f0: f, type: 'triangle', vol: 0.12 });
      this.tone(this.master, { start: t, dur: 0.35, f0: f / 2, type: 'sine', vol: 0.08 });
    }
  }
}
