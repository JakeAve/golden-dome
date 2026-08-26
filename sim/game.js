// sim/game.js — headless Golden Dome simulation. No DOM, no wall clock, no native RNG.
import { CFG as BASE_CFG, CITY_DEFS, groundY, GY, SLOT_DEFS, SPR, W } from './cfg.js';
import { mulberry32 } from './rng.js';

const cl = (/** @type {number} */ v, /** @type {number} */ a, /** @type {number} */ z) => v < a ? a : v > z ? z : v;
/** @param {any} f @param {string} t */
const isa = (f, t) => f.type.startsWith(t); // family match: 'anvil2' shares 'anvil' rules
/** @param {any} b @param {string} k @param {any} [d] */
const P = (b, k, d) => {
  const m = b.path && b.def.paths[b.path];
  return m && k in m ? m[k] : d;
}; // path modifier lookup

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
 * @property {(n: number) => string[]} waveTypes
 * @property {(f: Foe, dmg: number, type: string, src?: any) => void} hit
 * @property {(x: number, y: number, dmg: number, src?: any) => void} blast
 * @property {(sx: number, sy: number, f: Foe, sp: number) => number} aimLead
 * @property {(b: Battery, m: {x: number, y: number}) => Foe|null} pickTarget
 * @property {(i: number, kind: string) => boolean} build
 * @property {() => boolean} startWave
 * @property {() => boolean} retryWave
 * @property {(i: number) => boolean} upgrade
 * @property {(i: number, path: string) => boolean} choosePath
 * @property {(i: number) => boolean} sell
 * @property {(i: number) => boolean} repair
 * @property {() => void} step
 * @property {(opts?: {untilPhase?: string, untilWave?: number, maxTicks?: number}) => Game} run
 * @property {() => void} rollBias
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
    seed,
    cfg: CFG,
    _rnd: rnd,
    cash: CFG.startCash,
    wave: 0,
    phase: 'build',
    tick: 0,
    cities: CITY_DEFS.map((ct) => ({ ...ct, hp: CFG.cityHP })),
    /** @type {{x: number, y: number, tier: string, b: Battery|null}[]} */
    slots: SLOT_DEFS.map(([x, y, tier]) => ({ x, y, tier, b: null })),
    /** @type {Foe[]} */
    foes: [],
    shots: /** @type {any[]} */ ([]),
    beams: /** @type {any[]} */ ([]),
    booms: /** @type {any[]} */ ([]),
    craters: /** @type {any[]} */ ([]),
    queue: /** @type {any[]} */ ([]),
    bias: { x: 312, w: 300 },
    nextBias: /** @type {{x: number, w: number}|null} */ (null),
    snap: /** @type {any} */ (null),
    seen: /** @type {any} */ ({}),
    stats: { shots: 0, hits: 0, leaks: 0 },
    /** presentation side-effects: {t:'sfx',k} | {t:'toast',txt} | {t:'shake',n}. Renderer drains. */
    events: /** @type {any[]} */ ([]),
  };
  /** @param {string} k */
  const sfx = (k) => g.events.push({ t: 'sfx', k });
  /** @param {number} n */
  const shake = (n) => g.events.push({ t: 'shake', n });
  /** @param {number} x @param {number} y @param {string} k */
  const boom = (x, y, k) => {
    g.booms.push({ x, y, a: 0, k });
    if (k === 'city') shake(12);
  };

  // ---- battery helpers
  /** @param {Battery} b */
  const bDmg = (b) => b.def.dmg * (1 + CFG.lvl.dmg * Math.min(b.lvl, 2)) * P(b, 'dmg', 1);
  /** @param {Battery} b */
  const bRange = (b) => b.def.range * /** @type {any} */ (TIER)[b.slot.tier] * (1 + CFG.lvl.range * Math.min(b.lvl, 2)) * P(b, 'range', 1);
  /** @param {Battery} b */
  const bCool = (b) => Math.round(P(b, 'cool', b.def.cool) * (b.kind === 'thaad' ? 1 - CFG.lvl.thaadReload * Math.min(b.lvl, 2) : 1));
  /** @param {Battery} b */
  const bMuzzle = (b) =>
    b.kind === 'flak' ? { x: b.slot.x - 3 + Math.cos(b.aim) * 14, y: b.slot.y - 9 + Math.sin(b.aim) * 14 } : ({ x: b.slot.x, y: b.slot.y - /** @type {any} */ (SPR)[b.kind].length + 4 });
  /** @param {Battery} b */
  const upCost = (b) => Math.round(b.def.cost * CFG.econ.upgradeMult[Math.min(b.lvl, 2)]);
  /** @param {Battery} b */
  const sellVal = (b) => Math.round(b.paid * CFG.econ.sellRefund);
  /** @param {Battery} b */
  const repCost = (b) => Math.round(b.def.cost * CFG.econ.repairCost);
  /** @returns {Battery[]} */
  const batteries = () => g.slots.filter((s) => s.b).map((s) => /** @type {Battery} */ (s.b));

  // ---- waves
  /** rng-free type queue for wave n (unshuffled). @param {number} n @returns {string[]} */
  function waveTypes(n) {
    const q = /** @type {string[]} */ ([]), late = 1 + Math.max(0, n - CFG.wave.lateFrom) * CFG.wave.lateMult;
    for (const [t, d] of Object.entries(TT)) {
      if (!d.from || n < d.from || (d.to && n > d.to)) continue;
      const k = /** @type {(n: number) => number} */ (d.count)(n) * (d.elite ? 1 : late);
      for (let i = 0; i < k; i++) q.push(t);
    }
    return q;
  }
  /** @param {number} n @returns {string[]} */
  function composeWave(n) {
    const q = waveTypes(n);
    for (let i = q.length - 1; i > 0; i--) {
      const j = (rnd() * (i + 1)) | 0;
      [q[i], q[j]] = [q[j], q[i]];
    }
    return q;
  }

  // ---- damage
  /** @param {Foe} f @param {number} dmg @param {string} type @param {any} [src] */
  function hit(f, dmg, type, src) {
    if (f.dead) return;
    g.stats.hits++;
    if (isa(f, 'anvil') && type === 'kinetic' && !(src && src.kind === 'thaad')) {
      boom(f.x, f.y - 4, 'spark');
      return;
    }
    if (isa(f, 'wasp') && type === 'blast') {
      boom(f.x, f.y - 4, 'spark');
      return;
    }
    if (isa(f, 'warden')) f.flash = 6;
    if (f.type === 'ghost') {
      f.dead = 1;
      boom(f.x, f.y, 'ghost');
      return;
    }
    dmg = Math.min(dmg, f.hp);
    f.hp -= dmg;
    if (src) src.dmg += dmg;
    if (f.hp <= 0) {
      f.dead = 1;
      g.cash += /** @type {any} */ (TT)[f.type].$;
      boom(f.x, f.y, type);
      sfx('kill');
      if (src) src.kills++;
    }
  }
  /** @param {number} x @param {number} y @param {number} dmg @param {any} [src] */
  function blast(x, y, dmg, src) {
    boom(x, y, 'blast');
    const r = src ? P(src, 'radius', CFG.blastRadius) : CFG.blastRadius;
    for (const f of g.foes) if (!f.dead && Math.hypot(f.x - x, f.y - y) < r) hit(f, dmg, 'blast', src);
  }

  // ---- targeting
  /** @param {number} sx @param {number} sy @param {Foe} f @param {number} sp */
  function aimLead(sx, sy, f, sp) {
    const eta = Math.hypot(f.x - sx, f.y - sy) / sp;
    return Math.atan2(f.y + f.vy * eta + 0.5 * G * eta * eta - sy, f.x + f.vx * eta - sx);
  }
  /** @param {Battery} b @param {{x: number, y: number}} m @returns {Foe|null} */
  function pickTarget(b, m) {
    const rg = bRange(b);
    let best = /** @type {Foe|null} */ (null), bp = -1e9;
    for (const f of g.foes) {
      if (f.dead) continue;
      if (b.def.type === 'kinetic' && b.kind !== 'thaad' && (isa(f, 'anvil') || (isa(f, 'needle') && !P(b, 'seeker')))) continue;
      if (b.def.type === 'blast' && isa(f, 'wasp')) continue;
      if ((b.kind === 'thaad' || b.def.type === 'energy' || b.lvl >= 2) && f.type === 'ghost') continue;
      const d = Math.hypot(f.x - m.x, f.y - m.y);
      if (d > rg) continue;
      let p = f.y;
      if (isa(f, 'hive') && f.y < /** @type {number} */ (f.dy)) p += 80;
      if (isa(f, 'wasp')) p += 40;
      if (b.kind === 'thaad') {
        p += f.hp * 40;
        if (isa(f, 'needle')) p += 400;
        if (f.lock) p -= 500;
      }
      if (p > bp) {
        bp = p;
        best = f;
      }
    }
    return best;
  }

  // ---- commands
  /** @param {number} i @param {string} kind @returns {boolean} */
  function build(i, kind) {
    const s = g.slots[i], d = /** @type {any} */ (BT)[kind];
    if (!s || s.b || !d || g.cash < d.cost) return false;
    g.cash -= d.cost;
    s.b = { kind, def: d, slot: s, lvl: 0, t: 20, broken: 0, charge: 0, burst: 0, burstT: 0, aim: -1.1, kills: 0, dmg: 0, mag: 0, magT: 0, paid: d.cost, path: null, tgt: null };
    return true;
  }

  // ---- wave flow
  let gap = 60, nextLaunch = 0;
  const rollBias = () => g.nextBias = { x: 80 + rnd() * (W - 160), w: 140 + Math.min(340, (g.wave + 1) * 14) };
  /** @returns {boolean} */
  function startWave() {
    if (g.phase !== 'build') return false;
    g.snap = {
      cash: g.cash,
      wave: g.wave,
      cities: g.cities.map((c) => c.hp),
      bats: g.slots.map((s) => s.b && { kind: s.b.kind, lvl: s.b.lvl, broken: s.b.broken, kills: s.b.kills, dmg: s.b.dmg, aim: s.b.aim, paid: s.b.paid, path: s.b.path }),
      seen: { ...g.seen },
    };
    g.wave++;
    g.phase = 'wave';
    g.queue = composeWave(g.wave);
    g.bias = /** @type {{x: number, w: number}} */ (g.nextBias);
    gap = g.wave >= CFG.wave.pureFrom ? CFG.wave.pureGap - (g.wave - CFG.wave.pureFrom) * CFG.wave.pureGapPerWave : Math.max(CFG.wave.gapMin, CFG.wave.gapBase - g.wave * CFG.wave.gapPerWave);
    nextLaunch = 30;
    return true;
  }
  /** @param {string} type */
  function launch(type) {
    const d = /** @type {any} */ (TT)[type];
    if (d.info && !g.seen[type]) {
      g.seen[type] = 1;
      g.events.push({ t: 'toast', txt: d.info });
    }
    let tx, ty, tgt = null;
    if (type.startsWith('wasp') && batteries().some((b) => !b.broken)) {
      const bs = batteries().filter((b) => !b.broken);
      tgt = bs[(rnd() * bs.length) | 0];
      tx = tgt.slot.x;
      ty = tgt.slot.y;
    } else {
      const alive = g.cities.filter((ct) => ct.hp > 0);
      const ct = alive.length ? alive[(rnd() * alive.length) | 0] : g.cities[0];
      tx = (ct.a + ct.z) / 2 + (rnd() - 0.5) * (ct.z - ct.a) * 1.3;
      ty = groundY(tx);
    }
    const x0 = cl(g.bias.x + (rnd() - 0.5) * g.bias.w, 6, W - 6), y0 = -14, T = d.T * (0.9 + rnd() * 0.2);
    sfx(type);
    g.foes.push({ type, x: x0, y: y0, vx: (tx - x0) / T, vy: ((ty - y0) - 0.5 * G * T * T) / T, hp: d.hp, hpMax: d.hp, r: d.r, tgt, trail: [], dy: DEPLOY_Y, shed: 0, born: g.tick });
  }
  /** @param {Foe} f */
  function spawnPips(f) {
    const n = /** @type {any} */ (TT)[f.type].pips;
    for (let i = 0; i < n; i++) g.foes.push({ type: 'pip', x: f.x, y: f.y, vx: f.vx + (i - (n - 1) / 2) * 0.4, vy: f.vy * 0.9, hp: TT.pip.hp, r: TT.pip.r, trail: [], born: g.tick });
    boom(f.x, f.y, 'deploy');
  }
  /** @returns {boolean} */
  function retryWave() {
    const snap = g.snap;
    if (g.phase !== 'over' || !snap) return false;
    g.cash = snap.cash;
    g.wave = snap.wave;
    g.seen = { ...snap.seen };
    g.cities.forEach((c, i) => c.hp = snap.cities[i]);
    g.craters.length = 0;
    g.slots.forEach((s, i) => {
      const b = snap.bats[i];
      s.b = b ? { ...b, def: /** @type {any} */ (BT)[b.kind], slot: s, t: 20, charge: 0, burst: 0, burstT: 0, mag: 0, magT: 0, tgt: null } : null;
    });
    g.foes = [];
    g.shots = [];
    g.beams = [];
    g.booms = [];
    g.queue = [];
    g.phase = 'build';
    rollBias();
    return true;
  }

  // ---- remaining commands
  /** @param {number} i */
  const bat = (i) => g.slots[i] && g.slots[i].b;
  /** @param {number} i @returns {boolean} */
  function upgrade(i) {
    const b = bat(i);
    if (!b || b.lvl >= 2 || g.cash < upCost(b)) return false;
    const c = upCost(b);
    g.cash -= c;
    b.paid += c;
    b.lvl++;
    return true;
  }
  /** @param {number} i @param {string} path @returns {boolean} */
  function choosePath(i, path) {
    const b = bat(i);
    if (!b || b.lvl !== 2 || b.path || !(path in b.def.paths) || g.cash < upCost(b)) return false;
    const c = upCost(b);
    g.cash -= c;
    b.paid += c;
    b.path = path;
    b.lvl = 3;
    return true;
  }
  /** @param {number} i @returns {boolean} */
  function sell(i) {
    const b = bat(i);
    if (!b) return false;
    g.cash += sellVal(b);
    g.slots[i].b = null;
    return true;
  }
  /** @param {number} i @returns {boolean} */
  function repair(i) {
    const b = bat(i);
    if (!b || !b.broken || g.cash < repCost(b)) return false;
    g.cash -= repCost(b);
    b.broken = 0;
    return true;
  }

  // ---- step
  /** @param {Battery} b @param {{x: number, y: number}} m @param {Foe} f */
  function firePac(b, m, f) {
    const sp = b.def.spd, a = aimLead(m.x, m.y, f, sp);
    g.stats.shots++;
    g.shots.push({ x: m.x, y: m.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, tgt: f, dmg: bDmg(b), kind: 'pac', src: b, trail: [] });
    boom(m.x, m.y + 4, 'launch');
    sfx('pac');
  }
  /** @param {Battery} b @param {{x: number, y: number}} m */
  function fireFlak(b, m) {
    const f = b.tgt;
    if (!f || f.dead) return;
    m = bMuzzle(b);
    const sp = b.def.spd, a = b.aim + (rnd() - 0.5) * 0.08, eta = Math.hypot(f.x - m.x, f.y - m.y) / sp;
    g.shots.push({ x: m.x, y: m.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, fuse: (eta + 4) | 0, dmg: bDmg(b), kind: 'flak', src: b, trail: [] });
    boom(m.x, m.y, 'spark');
    sfx('flak');
  }
  function step() {
    if (g.phase !== 'wave' && g.phase !== 'build') return;
    g.tick++;
    const tick = g.tick;
    if (g.phase === 'wave') {
      if (g.queue.length && --nextLaunch <= 0) {
        const salvo = g.wave >= 10 && rnd() < CFG.wave.salvoBase + g.wave * CFG.wave.salvoPerWave ? 2 + (g.wave >= 20 && rnd() < 0.5 ? 1 : 0) : 1;
        for (let i = 0; i < salvo && g.queue.length; i++) launch(/** @type {string} */ (g.queue.shift()));
        nextLaunch = gap * (0.5 + rnd()) * (salvo > 1 ? 1.6 : 1);
      }
      if (!g.queue.length && !g.foes.length) {
        g.phase = 'build';
        rollBias();
        const alive = g.cities.filter((ct) => ct.hp > 0).length;
        g.cash += alive * (CFG.econ.waveIncome + g.wave * CFG.econ.waveIncomePerWave);
        if (g.wave >= MAXWAVE) g.phase = 'win';
      }
    }
    for (const f of g.foes) {
      f.trail.push(f.x | 0, f.y | 0);
      if (f.trail.length > 70) f.trail.splice(0, 2);
      if (isa(f, 'warden')) {
        f.x += Math.sin(tick / 22) * 1.3;
        f.vy += G * 0.35;
        const ht = f.type.replace('warden', 'hive');
        if (++/** @type {{shed: number}} */ (f).shed > /** @type {any} */ (TT)[f.type].shedEvery) {
          f.shed = 0;
          g.foes.push({
            type: ht,
            x: f.x,
            y: f.y,
            vx: f.vx + (rnd() - 0.5) * 1.2,
            vy: f.vy * 0.5,
            hp: /** @type {any} */ (TT)[ht].hp,
            r: /** @type {any} */ (TT)[ht].r,
            trail: [],
            dy: f.y + 70,
            born: tick,
          });
        }
      } else f.vy += G;
      f.x += f.vx;
      f.y += f.vy;
      if (isa(f, 'hive') && f.y >= /** @type {number} */ (f.dy)) {
        f.dead = 1;
        spawnPips(f);
        continue;
      }
      if (f.y >= groundY(f.x)) {
        f.dead = 1;
        const gy = groundY(f.x);
        const d = /** @type {any} */ (TT)[f.type].dmg;
        if (f.type === 'ghost') {
          boom(f.x, gy - 2, 'ghost');
          continue;
        }
        if (f.tgt) {
          if (!f.tgt.broken && Math.abs(f.x - f.tgt.slot.x) < 12) {
            f.tgt.broken = 1;
            f.tgt.charge = 0;
            shake(9);
          }
          boom(f.x, gy - 2, 'ground');
          continue;
        }
        const ct = g.cities.find((ct) => f.x >= ct.a - 4 && f.x <= ct.z + 4);
        if (ct && ct.hp > 0) {
          g.stats.leaks++;
          ct.hp = Math.max(0, ct.hp - d);
          g.craters.push({ x: f.x | 0, y: gy, born: tick });
          boom(f.x, gy - 3, 'city');
          sfx('city');
        } else boom(f.x, gy - 2, 'ground');
      }
      if (f.x < -30 || f.x > W + 30) f.dead = 1;
      if (f.flash) f.flash--;
    }
    for (const b of batteries()) {
      if (b.broken) continue;
      const m = bMuzzle(b);
      if (b.kind === 'dew' && b.charge > 0) {
        if (--b.charge === 0) {
          const N = b.def.beams[Math.min(b.lvl, 2)], picked = /** @type {Foe[]} */ ([]);
          while (picked.length < N) {
            const f = pickTarget(b, m);
            if (!f) break;
            picked.push(f);
            f.dead = 2;
          }
          for (const f of picked) f.dead = 0;
          if (picked.length) {
            const oy = m.y - 4, rg = bRange(b) * 1.1;
            for (let i = 0; i < N; i++) {
              const f = picked[i % picked.length], ox = m.x + (i - (N - 1) / 2) * 3;
              const an = Math.atan2(f.y - oy, f.x - ox), dx = Math.cos(an) * rg, dy = Math.sin(an) * rg;
              g.beams.push({ x0: ox, y0: oy, x1: ox + dx, y1: oy + dy, a: 0 });
              for (const t of g.foes) {
                if (t.dead || t.type === 'ghost') continue;
                const u = cl(((t.x - ox) * dx + (t.y - oy) * dy) / (rg * rg), 0, 1);
                if (Math.hypot(t.x - ox - dx * u, t.y - oy - dy * u) < t.r + 2) hit(t, bDmg(b), 'energy', b);
              }
            }
            b.t = P(b, 'cool', b.def.cool);
            sfx('dew');
          } else b.t = 10;
        }
        continue;
      }
      if (b.kind === 'flak') {
        const pv = { x: b.slot.x - 3, y: b.slot.y - 9 };
        if (!b.tgt || b.tgt.dead || Math.hypot(b.tgt.x - pv.x, b.tgt.y - pv.y) > bRange(b)) b.tgt = pickTarget(b, m);
        if (b.tgt) {
          const want = aimLead(pv.x, pv.y, b.tgt, b.def.spd);
          let d = want - b.aim;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          b.aim += cl(d * 0.3, -0.14, 0.14);
        }
      }
      if (b.burst > 0 && --b.burstT <= 0) {
        b.burst--;
        b.burstT = 4;
        if (b.kind === 'flak') fireFlak(b, m);
        else {
          const f = pickTarget(b, m);
          if (f) {
            const a = aimLead(m.x, m.y, f, b.def.spd);
            g.stats.shots++;
            g.shots.push({ x: m.x, y: m.y, vx: Math.cos(a) * b.def.spd, vy: Math.sin(a) * b.def.spd, tgt: f, dmg: bDmg(b), kind: 'thaad', src: b, trail: [] });
            boom(m.x, m.y + 4, 'launch');
            sfx('thaad');
          }
        }
      }
      if (b.kind === 'pac' && b.mag > 0 && --b.magT <= 0) {
        const f = pickTarget(b, m);
        if (f) {
          b.mag--;
          b.magT = 9;
          firePac(b, m, f);
        }
        continue;
      }
      if (--b.t > 0) continue;
      const f = pickTarget(b, m);
      if (!f) continue;
      if (b.kind === 'dew') {
        b.charge = P(b, 'charge', 40);
        continue;
      }
      b.t = bCool(b);
      if (b.kind === 'flak') {
        b.burst = P(b, 'stream', 6) - 1;
        b.burstT = 4;
        fireFlak(b, m);
        continue;
      }
      if (b.kind === 'pac') {
        b.mag = P(b, 'mag', b.def.mag) - 1;
        b.magT = 9;
        firePac(b, m, f);
        continue;
      }
      if (b.kind === 'thaad' && P(b, 'burst', 1) > 1) {
        b.burst = 1;
        b.burstT = 12;
      }
      const sp = b.def.spd, a = aimLead(m.x, m.y, f, sp);
      g.stats.shots++;
      g.shots.push({ x: m.x, y: m.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, tgt: f, dmg: bDmg(b), kind: b.kind, src: b, trail: [] });
      boom(m.x, m.y + 4, 'launch');
      sfx(b.kind);
      if (b.kind === 'thaad') f.lock = 1;
    }
    for (const s of g.shots) {
      s.trail.push(s.x | 0, s.y | 0);
      if (s.trail.length > (s.kind === 'pac' ? 24 : s.kind === 'flak' ? 6 : 130)) s.trail.splice(0, 2);
      s.x += s.vx;
      s.y += s.vy;
      if (s.kind === 'flak') {
        let near = null;
        for (const f of g.foes) {
          if (!f.dead && Math.hypot(f.x - s.x, f.y - s.y) < 9) {
            near = f;
            break;
          }
        }
        if (near || --s.fuse <= 0) {
          s.dead = 1;
          blast(s.x, s.y, s.dmg, s.src);
          if (!near) sfx('fizzle');
        }
      } else {
        if (!s.tgt.dead) {
          const sp = Math.hypot(s.vx, s.vy), want = aimLead(s.x, s.y, s.tgt, sp), have = Math.atan2(s.vy, s.vx);
          let d = want - have;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          const rate = s.kind === 'pac' ? 0.14 : 0.12;
          const a = have + cl(d, -rate, rate);
          s.vx = Math.cos(a) * sp;
          s.vy = Math.sin(a) * sp;
        }
        if (s.tgt.dead) {
          s.dead = 1;
          const f = pickTarget(/** @type {any} */ ({ def: /** @type {any} */ (BT)[s.kind], kind: s.kind, lvl: s.src ? s.src.lvl : 0, path: s.src && s.src.path, slot: { tier: 'valley' } }), s);
          if (f) {
            s.dead = 0;
            s.tgt = f;
          } else {
            boom(s.x, s.y, 'spark');
            sfx('fizzle');
          }
        } else if (Math.hypot(s.tgt.x - s.x, s.tgt.y - s.y) < s.tgt.r + 3) {
          s.dead = 1;
          hit(s.tgt, s.dmg, 'kinetic', s.src);
        } else if (isa(s.tgt, 'needle') && s.kind !== 'thaad' && !(s.src && P(s.src, 'seeker')) && Math.hypot(s.tgt.x - s.x, s.tgt.y - s.y) < s.tgt.r + 12) {
          s.dead = 1;
          boom(s.x, s.y, 'spark');
          sfx('fizzle');
        } else if (s.kind === 'pac' && (s.y < -5 || s.x < 0 || s.x > W)) {
          s.dead = 1;
          sfx('fizzle');
        }
      }
      if (s.y < -40 || s.x < -40 || s.x > W + 40 || s.y > GY) s.dead = 1;
    }
    for (const e of g.booms) if (++e.a > (e.k === 'blast' ? 14 : e.k === 'ghost' ? 26 : 16)) e.dead = 1;
    for (const e of g.beams) if (++e.a > 6) e.dead = 1;
    g.foes = g.foes.filter((f) => !f.dead);
    g.shots = g.shots.filter((s) => !s.dead);
    g.booms = g.booms.filter((e) => !e.dead);
    g.beams = g.beams.filter((e) => !e.dead);
    if (g.craters.length > 40) g.craters.splice(0, g.craters.length - 40);
    if (g.phase !== 'over' && g.cities.every((ct) => ct.hp <= 0)) g.phase = 'over';
  }

  /** Step until a condition. Auto-starts waves while in 'build'. @param {{untilPhase?: string, untilWave?: number, maxTicks?: number}} [opts] */
  function run({ untilPhase, untilWave, maxTicks = 200000 } = {}) {
    for (let i = 0; i < maxTicks; i++) {
      // wave 0: a fresh game already sits in 'build', so untilPhase:'build' means "until the *next* build phase" — don't return immediately.
      if (untilPhase && g.phase === untilPhase && !(untilPhase === 'build' && g.wave === 0)) return g;
      if (untilWave && g.wave >= untilWave && g.phase === 'build') return g;
      if (g.phase === 'over' || g.phase === 'win') return g;
      if (g.phase === 'build') startWave();
      step();
    }
    return g;
  }

  rollBias();
  Object.assign(g, { startWave, retryWave, upgrade, choosePath, sell, repair, step, run, rollBias });

  Object.assign(g, { bDmg, bRange, bCool, bMuzzle, upCost, sellVal, repCost, batteries, composeWave, waveTypes, hit, blast, aimLead, pickTarget, build });
  return /** @type {Game} */ (/** @type {any} */ (g));
}
