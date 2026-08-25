// sim/game.js — headless Golden Dome simulation. No DOM, no wall clock, no native RNG.
import { CFG as BASE_CFG, CITY_DEFS, SLOT_DEFS, SPR, W, GY, groundY } from './cfg.js';
import { mulberry32 } from './rng.js';

const cl = (/** @type {number} */ v, /** @type {number} */ a, /** @type {number} */ z) => v < a ? a : v > z ? z : v;
/** @param {any} f @param {string} t */
const isa = (f, t) => f.type.startsWith(t);   // family match: 'anvil2' shares 'anvil' rules
/** @param {any} b @param {string} k @param {any} [d] */
const P = (b, k, d) => { const m = b.path && b.def.paths[b.path]; return m && k in m ? m[k] : d; };   // path modifier lookup

/**
 * @typedef {Object} Foe
 * @property {string} type
 * @property {number} x
 * @property {number} y
 * @property {number} vx
 * @property {number} vy
 * @property {number} hp
 * @property {number} [hpMax]
 * @property {number} r
 * @property {any} [tgt]
 * @property {number[]} trail
 * @property {number} [dy]
 * @property {number} [shed]
 * @property {number} born
 * @property {number} [dead]
 * @property {number} [flash]
 * @property {number} [lock]
 */

/**
 * @typedef {Object} Battery
 * @property {string} kind
 * @property {any} def
 * @property {any} slot
 * @property {number} lvl
 * @property {number} t
 * @property {number} broken
 * @property {number} charge
 * @property {number} burst
 * @property {number} burstT
 * @property {number} aim
 * @property {number} kills
 * @property {number} dmg
 * @property {number} mag
 * @property {number} magT
 * @property {number} paid
 * @property {string|null} path
 * @property {Foe|null} [tgt]
 */

/**
 * @typedef {Object} Game
 * @property {number} seed
 * @property {any} cfg
 * @property {() => number} _rnd
 * @property {number} cash
 * @property {number} wave
 * @property {string} phase
 * @property {number} tick
 * @property {any[]} cities
 * @property {{x: number, y: number, tier: string, b: Battery|null}[]} slots
 * @property {Foe[]} foes
 * @property {any[]} shots
 * @property {any[]} beams
 * @property {any[]} booms
 * @property {any[]} craters
 * @property {any[]} queue
 * @property {{x: number, w: number}} bias
 * @property {any} nextBias
 * @property {any} snap
 * @property {any} seen
 * @property {{shots: number, hits: number, leaks: number}} stats
 * @property {any[]} events
 * @property {(b: Battery) => number} bDmg
 * @property {(b: Battery) => number} bRange
 * @property {(b: Battery) => number} bCool
 * @property {(b: Battery) => {x: number, y: number}} bMuzzle
 * @property {(b: Battery) => number} upCost
 * @property {(b: Battery) => number} sellVal
 * @property {(b: Battery) => number} repCost
 * @property {() => Battery[]} batteries
 * @property {(n: number) => string[]} composeWave
 * @property {(f: Foe, dmg: number, type: string, src?: any) => void} hit
 * @property {(x: number, y: number, dmg: number, src?: any) => void} blast
 * @property {(sx: number, sy: number, f: Foe, sp: number) => number} aimLead
 * @property {(b: Battery, m: {x: number, y: number}) => Foe|null} pickTarget
 * @property {(i: number, kind: string) => boolean} build
 */

/**
 * @param {{seed?: number, cfg?: object}} [opts]
 * @returns {Game}
 */
export function createGame({ seed = 1, cfg = {} } = {}) {
  const CFG = { ...BASE_CFG, ...cfg };
  const TIER = CFG.tier, BT = CFG.batteries, TT = CFG.threats, G = CFG.gravity, DEPLOY_Y = CFG.deployY, MAXWAVE = CFG.maxWave;
  const rnd = mulberry32(seed);

  const g = {
    seed, cfg: CFG, _rnd: rnd,
    cash: CFG.startCash, wave: 0, phase: 'build', tick: 0,
    cities: CITY_DEFS.map(ct => ({ ...ct, hp: CFG.cityHP })),
    /** @type {{x: number, y: number, tier: string, b: Battery|null}[]} */
    slots: SLOT_DEFS.map(([x, y, tier]) => ({ x, y, tier, b: null })),
    /** @type {Foe[]} */
    foes: [], shots: /** @type {any[]} */ ([]), beams: /** @type {any[]} */ ([]), booms: /** @type {any[]} */ ([]), craters: /** @type {any[]} */ ([]), queue: /** @type {any[]} */ ([]),
    bias: { x: 312, w: 300 }, nextBias: null, snap: null, seen: {},
    stats: { shots: 0, hits: 0, leaks: 0 },
    /** presentation side-effects: {t:'sfx',k} | {t:'toast',txt} | {t:'shake',n}. Renderer drains. */
    events: /** @type {any[]} */ ([]),
  };
  /** @param {string} k */
  const sfx = k => g.events.push({ t: 'sfx', k });
  /** @param {number} n */
  const shake = n => g.events.push({ t: 'shake', n });
  /** @param {number} x @param {number} y @param {string} k */
  const boom = (x, y, k) => { g.booms.push({ x, y, a: 0, k }); if (k === 'city') shake(12); };

  // ---- battery helpers (v4 557–561)
  /** @param {Battery} b */
  const bDmg = b => b.def.dmg * (1 + CFG.lvl.dmg * Math.min(b.lvl, 2)) * P(b, 'dmg', 1);
  /** @param {Battery} b */
  const bRange = b => b.def.range * /** @type {any} */ (TIER)[b.slot.tier] * (1 + CFG.lvl.range * Math.min(b.lvl, 2)) * P(b, 'range', 1);
  /** @param {Battery} b */
  const bCool = b => Math.round(P(b, 'cool', b.def.cool) * (b.kind === 'thaad' ? 1 - CFG.lvl.thaadReload * Math.min(b.lvl, 2) : 1));
  /** @param {Battery} b */
  const bMuzzle = b => b.kind === 'flak' ? { x: b.slot.x - 3 + Math.cos(b.aim) * 14, y: b.slot.y - 9 + Math.sin(b.aim) * 14 } : ({ x: b.slot.x, y: b.slot.y - /** @type {any} */ (SPR)[b.kind].length + 4 });
  /** @param {Battery} b */
  const upCost = b => Math.round(b.def.cost * CFG.econ.upgradeMult[Math.min(b.lvl, 2)]);
  /** @param {Battery} b */
  const sellVal = b => Math.round(b.paid * CFG.econ.sellRefund);
  /** @param {Battery} b */
  const repCost = b => Math.round(b.def.cost * CFG.econ.repairCost);
  /** @returns {Battery[]} */
  const batteries = () => g.slots.filter(s => s.b).map(s => /** @type {Battery} */ (s.b));

  // ---- waves (v4 564–574)
  /** @param {number} n @returns {string[]} */
  function composeWave(n) {
    const q = /** @type {string[]} */ ([]), late = 1 + Math.max(0, n - CFG.wave.lateFrom) * CFG.wave.lateMult;
    for (const [t, d] of Object.entries(TT)) {
      if (!d.from || n < d.from) continue;
      const k = /** @type {(n: number) => number} */ (d.count)(n) * (d.elite ? 1 : late);
      for (let i = 0; i < k; i++) q.push(t);
    }
    for (let i = q.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [q[i], q[j]] = [q[j], q[i]]; }
    return q;
  }

  // ---- damage (v4 635–649)
  /** @param {Foe} f @param {number} dmg @param {string} type @param {any} [src] */
  function hit(f, dmg, type, src) {
    if (f.dead) return; g.stats.hits++;
    if (isa(f, 'anvil') && type === 'kinetic' && !(src && src.kind === 'thaad')) { boom(f.x, f.y - 4, 'spark'); return; }
    if (isa(f, 'wasp') && type === 'blast') { boom(f.x, f.y - 4, 'spark'); return; }
    if (isa(f, 'warden')) f.flash = 6;
    if (f.type === 'ghost') { f.dead = 1; boom(f.x, f.y, 'ghost'); return; }
    dmg = Math.min(dmg, f.hp); f.hp -= dmg; if (src) src.dmg += dmg;
    if (f.hp <= 0) { f.dead = 1; g.cash += /** @type {any} */ (TT)[f.type].$; boom(f.x, f.y, type); sfx('kill'); if (src) src.kills++; }
  }
  /** @param {number} x @param {number} y @param {number} dmg @param {any} [src] */
  function blast(x, y, dmg, src) {
    boom(x, y, 'blast');
    const r = src ? P(src, 'radius', CFG.blastRadius) : CFG.blastRadius;
    for (const f of g.foes) if (!f.dead && Math.hypot(f.x - x, f.y - y) < r) hit(f, dmg, 'blast', src);
  }

  // ---- targeting (v4 651–667)
  /** @param {number} sx @param {number} sy @param {Foe} f @param {number} sp */
  function aimLead(sx, sy, f, sp) {
    const eta = Math.hypot(f.x - sx, f.y - sy) / sp;
    return Math.atan2(f.y + f.vy * eta + 0.5 * G * eta * eta - sy, f.x + f.vx * eta - sx);
  }
  /** @param {Battery} b @param {{x: number, y: number}} m @returns {Foe|null} */
  function pickTarget(b, m) {
    const rg = bRange(b); let best = /** @type {Foe|null} */ (null), bp = -1e9;
    for (const f of g.foes) {
      if (f.dead) continue;
      if (b.def.type === 'kinetic' && b.kind !== 'thaad' && (isa(f, 'anvil') || (isa(f, 'needle') && !P(b, 'seeker')))) continue;
      if (b.def.type === 'blast' && isa(f, 'wasp')) continue;
      if ((b.kind === 'thaad' || b.def.type === 'energy' || b.lvl >= 2) && f.type === 'ghost') continue;
      const d = Math.hypot(f.x - m.x, f.y - m.y); if (d > rg) continue;
      let p = f.y; if (isa(f, 'hive') && f.y < /** @type {number} */ (f.dy)) p += 80; if (isa(f, 'wasp')) p += 40;
      if (b.kind === 'thaad') { p += f.hp * 40; if (isa(f, 'needle')) p += 400; if (f.lock) p -= 500; }
      if (p > bp) { bp = p; best = f; }
    }
    return best;
  }

  // ---- commands
  /** @param {number} i @param {string} kind @returns {boolean} */
  function build(i, kind) {
    const s = g.slots[i], d = /** @type {any} */ (BT)[kind]; if (!s || s.b || !d || g.cash < d.cost) return false;
    g.cash -= d.cost;
    s.b = { kind, def: d, slot: s, lvl: 0, t: 20, broken: 0, charge: 0, burst: 0, burstT: 0, aim: -1.1, kills: 0, dmg: 0, mag: 0, magT: 0, paid: d.cost, path: null, tgt: null };
    return true;
  }

  // TASK 4 INSERTS HERE

  Object.assign(g, { bDmg, bRange, bCool, bMuzzle, upCost, sellVal, repCost, batteries, composeWave, hit, blast, aimLead, pickTarget, build });
  return /** @type {Game} */ (/** @type {any} */ (g));
}
