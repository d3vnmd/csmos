// Weapon definitions. All names and models are original to Browser Strike.
// Units: damage (hp), rate (seconds between shots), spread (radians), recoil (radians per shot).

export const WEAPONS = {
  knife: {
    id: 'knife', name: 'Talon Knife', slot: 'knife', type: 'knife', model: 'knife',
    price: 0, damage: 34, damageAlt: 62, rate: 0.42, rateAlt: 1.0, range: 1.9,
    speed: 1.0, kill: 1500, armorPen: 0.85,
  },

  // ---- Pistols ----
  sparrow: {
    id: 'sparrow', name: 'Sparrow K18', slot: 'secondary', type: 'pistol', model: 'pistol_a', team: 'R',
    price: 200, damage: 30, armorPen: 0.47, rate: 0.15, mag: 20, reserve: 100, reload: 2.2,
    spread: { base: 0.006, move: 0.045, air: 0.15, crouch: 0.8 }, recoil: { v: 0.022, h: 0.006, climb: 3, recover: 9 },
    range: 0.82, speed: 0.96, auto: false, kill: 300, sound: { f: 2600, d: 0.13, t: 160, v: 0.7 },
  },
  wren: {
    id: 'wren', name: 'Wren P9', slot: 'secondary', type: 'pistol', model: 'pistol_b', team: 'G',
    price: 200, damage: 35, armorPen: 0.5, rate: 0.17, mag: 13, reserve: 52, reload: 2.2,
    spread: { base: 0.005, move: 0.045, air: 0.15, crouch: 0.8 }, recoil: { v: 0.026, h: 0.006, climb: 3, recover: 9 },
    range: 0.84, speed: 0.96, auto: false, kill: 300, sound: { f: 2300, d: 0.14, t: 150, v: 0.7 },
  },
  thunder: {
    id: 'thunder', name: 'Thunder D50', slot: 'secondary', type: 'pistol', model: 'pistol_heavy',
    price: 700, damage: 62, armorPen: 0.92, rate: 0.27, mag: 7, reserve: 35, reload: 2.2,
    spread: { base: 0.007, move: 0.08, air: 0.25, crouch: 0.75 }, recoil: { v: 0.075, h: 0.012, climb: 2, recover: 6 },
    range: 0.81, speed: 0.95, auto: false, kill: 300, sound: { f: 1500, d: 0.3, t: 90, v: 1.0 },
  },

  // ---- SMG / Shotgun ----
  hornet: {
    id: 'hornet', name: 'Hornet MX', slot: 'primary', type: 'smg', model: 'smg',
    price: 1250, damage: 27, armorPen: 0.6, rate: 0.075, mag: 30, reserve: 120, reload: 2.4,
    spread: { base: 0.009, move: 0.03, air: 0.12, crouch: 0.85 }, recoil: { v: 0.014, h: 0.008, climb: 7, recover: 8 },
    range: 0.8, speed: 0.95, auto: true, kill: 600, sound: { f: 3200, d: 0.1, t: 140, v: 0.6 },
  },
  breacher: {
    id: 'breacher', name: 'Breacher 12', slot: 'primary', type: 'shotgun', model: 'shotgun',
    price: 1100, damage: 23, pellets: 9, armorPen: 0.6, rate: 0.88, mag: 7, reserve: 28, reload: 3.0,
    spread: { base: 0.06, move: 0.02, air: 0.08, crouch: 1.0 }, recoil: { v: 0.07, h: 0.01, climb: 1, recover: 5 },
    range: 0.45, speed: 0.9, auto: false, kill: 900, sound: { f: 900, d: 0.4, t: 70, v: 1.1 },
  },

  // ---- Rifles ----
  ranger: {
    id: 'ranger', name: 'Ranger 556', slot: 'primary', type: 'rifle', model: 'rifle_c',
    price: 2050, damage: 30, armorPen: 0.72, rate: 0.09, mag: 25, reserve: 75, reload: 2.5,
    spread: { base: 0.004, move: 0.09, air: 0.25, crouch: 0.8 }, recoil: { v: 0.016, h: 0.009, climb: 8, recover: 7 },
    range: 0.95, speed: 0.88, auto: true, kill: 300, sound: { f: 2100, d: 0.16, t: 110, v: 0.8 },
  },
  vanguard: {
    id: 'vanguard', name: 'Vanguard AR', slot: 'primary', type: 'rifle', model: 'rifle_a', team: 'R',
    price: 2700, damage: 36, armorPen: 0.78, rate: 0.1, mag: 30, reserve: 90, reload: 2.4,
    spread: { base: 0.0035, move: 0.11, air: 0.3, crouch: 0.75 }, recoil: { v: 0.02, h: 0.011, climb: 9, recover: 7 },
    range: 0.98, speed: 0.86, auto: true, kill: 300, sound: { f: 1800, d: 0.18, t: 100, v: 0.9 },
  },
  sentinel: {
    id: 'sentinel', name: 'Sentinel R4', slot: 'primary', type: 'rifle', model: 'rifle_b', team: 'G',
    price: 3000, damage: 33, armorPen: 0.7, rate: 0.09, mag: 30, reserve: 90, reload: 3.0,
    spread: { base: 0.003, move: 0.1, air: 0.3, crouch: 0.75 }, recoil: { v: 0.017, h: 0.009, climb: 9, recover: 8 },
    range: 0.97, speed: 0.87, auto: true, kill: 300, sound: { f: 2000, d: 0.15, t: 110, v: 0.85 },
  },
  longbow: {
    id: 'longbow', name: 'Longbow .338', slot: 'primary', type: 'sniper', model: 'sniper',
    price: 4750, damage: 115, armorPen: 0.97, rate: 1.45, mag: 5, reserve: 30, reload: 3.6,
    spread: { base: 0.002, move: 0.2, air: 0.4, crouch: 0.9, unscoped: 0.09 }, recoil: { v: 0.08, h: 0.01, climb: 1, recover: 4 },
    range: 0.99, speed: 0.8, auto: false, kill: 100, scope: [40, 15], sound: { f: 1200, d: 0.55, t: 60, v: 1.3 },
  },

  // ---- Grenades & objective ----
  frag: {
    id: 'frag', name: 'Frag Grenade', slot: 'grenade', type: 'grenade', model: 'frag',
    price: 300, damage: 98, radius: 8, fuse: 1.6, speed: 1.0, kill: 300,
  },
  smoke: {
    id: 'smoke', name: 'Smoke Grenade', slot: 'grenade', type: 'grenade', model: 'smokegren',
    price: 300, radius: 4, duration: 16, speed: 1.0, kill: 300,
  },
  charge: {
    id: 'charge', name: 'Demo Charge', slot: 'bomb', type: 'bomb', model: 'bomb', speed: 1.0,
  },
};

export const GEAR = {
  kevlar: { id: 'kevlar', name: 'Kevlar Vest', price: 650 },
  helmet: { id: 'helmet', name: 'Kevlar + Helmet', price: 1000 },
  kit: { id: 'kit', name: 'Defuse Kit', price: 400, team: 'G' },
};

// Buy menu layout
export const BUY_MENU = [
  { title: 'Pistols', items: ['sparrow', 'wren', 'thunder'] },
  { title: 'Heavy / SMG', items: ['hornet', 'breacher'] },
  { title: 'Rifles', items: ['ranger', 'vanguard', 'sentinel', 'longbow'] },
  { title: 'Gear', items: ['kevlar', 'helmet', 'kit'] },
  { title: 'Grenades', items: ['frag', 'smoke'] },
];

export function makeWeapon(id) {
  const def = WEAPONS[id];
  return {
    def,
    mag: def.mag || 0,
    reserve: def.reserve || 0,
    nextFire: 0,
    reloadLeft: 0,
    shots: 0,
  };
}

export const DEFAULT_PISTOL = { R: 'sparrow', G: 'wren' };
