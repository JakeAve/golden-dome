// deno-lint-ignore-file no-explicit-any
import { assert, assertEquals, assertNotEquals, assertStrictEquals } from '@std/assert';
import { createGame } from './game.js';
import { CFG, SPR } from './cfg.js';

const TT = CFG.threats, BT = CFG.batteries;
const g0 = () => createGame({ seed: 1 });

// ---- composeWave
Deno.test('wave 19 has warden and lug', () => {
  const w = g0().composeWave(19);
  assert(w.includes('warden') && w.includes('lug'));
});
Deno.test('ghost debuts wave 3', () => {
  const g = g0();
  assert(g.composeWave(3).includes('ghost'));
  assert(!g.composeWave(2).includes('ghost'));
});
Deno.test('hive debuts wave 10', () => {
  const g = g0();
  assert(g.composeWave(10).includes('hive'));
  assert(!g.composeWave(9).includes('hive'));
});
Deno.test('needles are elite: exactly 9 at wave 20', () => assertEquals(g0().composeWave(20).filter((t) => t === 'needle').length, 9));
Deno.test('mk2 debuts: lug2 @13, warden2 @30', () => {
  const g = g0();
  assert(g.composeWave(13).includes('lug2'));
  assert(!g.composeWave(12).includes('lug2'));
  assert(g.composeWave(30).includes('warden2'));
});
Deno.test('mk3 debuts: lug3 @22, warden3 @30', () => {
  const g = g0();
  assert(g.composeWave(22).includes('lug3'));
  assert(!g.composeWave(21).includes('lug3'));
  assert(g.composeWave(30).includes('warden3'));
});
Deno.test('every scheduled type has stats and a sprite', () => {
  for (const t of new Set(g0().composeWave(30))) {
    assert((TT as any)[t], t);
    assert((SPR as any)[t] || (SPR as any)[t.replace(/\d$/, '')], t);
  }
});
Deno.test('dew beams per level are 1,2,3', () => assertEquals(BT.dew.beams.join(), '1,2,3'));
Deno.test('composeWave is seeded', () => assertEquals(createGame({ seed: 9 }).composeWave(15).join(), createGame({ seed: 9 }).composeWave(15).join()));
Deno.test('waveTypes matches composeWave as a set, and is rng-free', () => {
  const g = g0();
  assertEquals(new Set(g.waveTypes(19)), new Set(g.composeWave(19)));
  assertEquals(g.waveTypes(19).join(), g.waveTypes(19).join());
});

// ---- targeting
const fake = (g: ReturnType<typeof createGame>, k: string, lvl = 0) => g.pickTarget({ def: (BT as any)[k], kind: k, lvl, path: null, slot: { tier: 'valley' } } as any, { x: 100, y: 110 });
const ghost = () => ({ type: 'ghost', x: 100, y: 100, hp: 1, r: 7, trail: [], born: 0, vx: 0, vy: 0 });

Deno.test('PAC/FLAK chase ghosts, THAAD/DEW ignore them', () => {
  const g = g0();
  g.foes.push(ghost());
  assert(fake(g, 'pac') && fake(g, 'flak'));
  assert(!fake(g, 'thaad') && !fake(g, 'dew'));
});
Deno.test('max-level PAC/FLAK ignore ghosts', () => {
  const g = g0();
  g.foes.push(ghost());
  assert(!fake(g, 'pac', 2) && !fake(g, 'flak', 2));
});
Deno.test('THAAD engages anvil+needle, snipes needle first; PAC cannot', () => {
  const g = g0();
  g.foes.push({ ...ghost(), type: 'anvil', hp: 6, r: 8 }, { ...ghost(), type: 'needle', y: 104, hp: 1, r: 6 });
  assert(fake(g, 'thaad'));
  assert(!fake(g, 'pac'));
  assertEquals(fake(g, 'thaad')!.type, 'needle');
});
Deno.test('mk2 inherits family targeting', () => {
  const g = g0();
  g.foes.push({ ...ghost(), type: 'anvil2', hp: 15, r: 8 });
  assert(!fake(g, 'pac'));
  assert(fake(g, 'thaad'));
});
Deno.test('dew volley temp-mark yields distinct targets', () => {
  const g = g0();
  g.foes.push({ ...ghost(), type: 'lug' }, { ...ghost(), type: 'lug', y: 120 });
  const p1 = fake(g, 'dew');
  p1!.dead = 2;
  const p2 = fake(g, 'dew');
  p1!.dead = 0;
  assert(p1 && p2);
  assertNotEquals(p1, p2);
});

// ---- damage
Deno.test('THAAD pierces anvil armour', () => {
  const g = g0();
  const f = { ...ghost(), type: 'anvil', hp: 6, r: 8 };
  g.foes.push(f);
  g.hit(f, 5, 'kinetic', { kind: 'thaad', dmg: 0, kills: 0 } as any);
  assertEquals(f.hp, 1);
});
Deno.test('anvil: kinetic bounces, blast lands', () => {
  const g = g0();
  const f = { ...ghost(), type: 'anvil', hp: 6 };
  g.hit(f, 5, 'kinetic');
  assertEquals(f.hp, 6);
  g.hit(f, 5, 'blast');
  assertEquals(f.hp, 1);
});
Deno.test('anvil2 inherits family armour', () => {
  const g = g0();
  const f = { ...ghost(), type: 'anvil2', hp: 15 };
  g.hit(f, 5, 'kinetic');
  assertEquals(f.hp, 15);
  g.hit(f, 5, 'blast');
  assertEquals(f.hp, 10);
});
Deno.test('ghosts pay nothing', () => {
  const g = g0();
  const c0 = g.cash, f = ghost();
  g.hit(f, 5, 'kinetic');
  assert((f as any).dead);
  assertEquals(g.cash, c0);
});
Deno.test('warden has no armour', () => {
  const g = g0();
  const f = { ...ghost(), type: 'warden', hp: 120 };
  g.hit(f, 1, 'kinetic');
  g.hit(f, 6, 'energy');
  assertEquals(f.hp, 113);
});
Deno.test('kill pays bounty and emits sfx event', () => {
  const g = g0();
  const f = { ...ghost(), type: 'lug' };
  const c0 = g.cash;
  g.hit(f, 1, 'kinetic');
  assert((f as any).dead);
  assertEquals(g.cash, c0 + TT.lug.$);
  assert(g.events.some((e) => e.t === 'sfx' && e.k === 'kill'));
});

// ---- build
Deno.test('build deducts cost and fills slot', () => {
  const g = g0();
  assert(g.build(8, 'pac'));
  assertEquals(g.cash, CFG.startCash - BT.pac.cost);
  assertStrictEquals(g.slots[8].b!.slot, g.slots[8]);
  assertEquals(g.batteries().length, 1);
});
Deno.test('build refuses occupied slot and insufficient cash', () => {
  const g = g0();
  g.build(8, 'pac');
  assert(!g.build(8, 'pac'));
  assert(!g.build(9, 'dew'));
  assertEquals(g.cash, CFG.startCash - BT.pac.cost);
});
Deno.test('cfg override', () => assertEquals(createGame({ seed: 1, cfg: { startCash: 5 } }).cash, 5));

Deno.test('game.js is DOM-free', async () => {
  const src = await Deno.readTextFile(new URL('game.js', import.meta.url));
  for (const bad of ['window', 'document', 'Math.random', 'AudioContext', 'performance.', 'Date.', 'canvas', 'requestAnimationFrame']) assert(!src.includes(bad), bad);
});

// ---- wave flow & gameplay
Deno.test('startWave only from build; increments wave, sets queue', () => {
  const g = g0();
  assert(g.nextBias);
  assert(g.startWave());
  assertEquals(g.wave, 1);
  assertEquals(g.phase, 'wave');
  assert(g.queue.length > 0);
  assert(!g.startWave());
  assertEquals(g.wave, 1);
});

Deno.test('step is a no-op outside build/wave', () => {
  const g = g0();
  g.phase = 'over';
  const t = g.tick;
  g.step();
  assertEquals(g.tick, t);
});

Deno.test('no defence: wave 1 leaks and city takes damage', () => {
  const g = g0();
  g.run({ untilPhase: 'build', maxTicks: 5000 });
  assertEquals(g.wave, 1);
  assert(g.stats.leaks > 0);
  assert(g.cities.some((c) => c.hp < CFG.cityHP));
  assert(g.foes.length === 0 && g.queue.length === 0);
});

Deno.test('no defence: game is lost well before max wave', () => {
  const g = g0();
  g.run({ untilPhase: 'over' });
  assertEquals(g.phase, 'over');
  assert(g.wave < CFG.maxWave, `lost at wave ${g.wave}`);
  assert(g.cities.every((c) => c.hp === 0));
});

Deno.test('surviving wave pays income per living city', () => {
  const noBounty = Object.fromEntries(Object.entries(CFG.threats).map(([k, d]) => [k, { ...d, $: 0 }]));
  const g = createGame({ seed: 1, cfg: { startCash: 0, cityHP: 100000, threats: noBounty } });
  g.run({ untilPhase: 'build', maxTicks: 5000 });
  assertEquals(g.cash, 2 * (CFG.econ.waveIncome + 1 * CFG.econ.waveIncomePerWave));
});

Deno.test('determinism: same seed + same commands ⇒ identical outcome', () => {
  const play = () => {
    const g = createGame({ seed: 123 });
    g.build(8, 'pac');
    g.build(9, 'pac');
    g.build(4, 'flak');
    g.run({ untilWave: 6 });
    return g;
  };
  const a = play(), b = play();
  assertEquals(a.tick, b.tick);
  assertEquals(a.stats, b.stats);
  assertEquals(a.cash, b.cash);
  assertEquals(a.cities.map((c) => c.hp), b.cities.map((c) => c.hp));
});

Deno.test('different seeds diverge', () => {
  const play = (s: number) => {
    const g = createGame({ seed: s });
    g.build(8, 'pac');
    g.run({ untilWave: 4 });
    return g.stats.shots + ':' + g.cash;
  };
  assertNotEquals(play(1), play(2));
});

Deno.test('sanity across seeds: cash finite and non-negative, phases progress', () => {
  for (let s = 1; s <= 5; s++) {
    const g = createGame({ seed: s });
    g.build(8, 'pac');
    g.build(9, 'pac');
    g.build(4, 'flak');
    g.run({ untilWave: 12, maxTicks: 100000 });
    assert(Number.isFinite(g.cash) && g.cash >= 0, `seed ${s} cash ${g.cash}`);
    assert(g.wave >= 12 || g.phase === 'over', `seed ${s} stuck at wave ${g.wave} phase ${g.phase}`);
    for (const c of g.cities) assert(c.hp >= 0 && c.hp <= CFG.cityHP);
  }
});

Deno.test('reference loadout holds the dome to max wave', () => {
  // ponytail: single seed, single loadout — bench.ts covers the distribution
  const g = createGame({ seed: 7, cfg: { startCash: 20000 } });
  g.build(8, 'thaad');
  g.build(9, 'thaad');
  g.build(10, 'thaad');
  g.build(11, 'thaad');
  g.build(4, 'dew');
  g.build(6, 'dew');
  g.build(5, 'flak');
  g.build(7, 'flak');
  for (let i = 0; i < 12; i++) {
    if (g.slots[i].b) {
      g.upgrade(i);
      g.upgrade(i);
      g.choosePath(i, 'A');
    }
  }
  g.run({ untilPhase: 'win' });
  assertEquals(g.phase, 'win', `ended ${g.phase} at wave ${g.wave}`);
});

Deno.test('upgrade / path / sell / repair rules', () => {
  const g = createGame({ seed: 1, cfg: { startCash: 5000 } });
  g.build(8, 'pac');
  const b = g.slots[8].b!;
  assert(!g.choosePath(8, 'A')); // needs lvl 2 first
  assert(g.upgrade(8));
  assert(g.upgrade(8));
  assert(!g.upgrade(8));
  assertEquals(b.lvl, 2);
  assert(!g.choosePath(8, 'C'));
  assert(g.choosePath(8, 'A'));
  assertEquals(b.lvl, 3);
  assert(!g.choosePath(8, 'B'));
  assertEquals(b.paid, BT.pac.cost + Math.round(BT.pac.cost * 0.8) + Math.round(BT.pac.cost * 1.6) + Math.round(BT.pac.cost * 2));
  assert(!g.repair(8));
  b.broken = 1;
  const c = g.cash;
  assert(g.repair(8));
  assertEquals(g.cash, c - Math.round(BT.pac.cost * 0.4));
  assertEquals(b.broken, 0);
  const c2 = g.cash;
  assert(g.sell(8));
  assertEquals(g.cash, c2 + Math.round(b.paid * 0.7));
  assertEquals(g.slots[8].b, null);
  assert(!g.sell(8));
});

Deno.test('retryWave restores the pre-wave snapshot', () => {
  const g = g0();
  g.build(8, 'pac');
  g.run({ untilPhase: 'over' });
  const w = g.snap.wave, c = g.snap.cash;
  g.cash = -1;
  g.wave = -1;
  assert(g.retryWave());
  assertEquals(g.phase, 'build');
  assertEquals(g.wave, w);
  assertEquals(g.cash, c);
  assertEquals(g.slots[8].b!.kind, 'pac');
  assertEquals(g.foes.length, 0);
  assert(g.nextBias);
});

Deno.test('first sighting of a threat emits a toast event, once', () => {
  const g = g0();
  g.run({ untilPhase: 'build', maxTicks: 5000 });
  const toasts = g.events.filter((e) => e.t === 'toast' && e.txt === TT.lug.info);
  assertEquals(toasts.length, 1);
  assert(g.seen.lug);
});
