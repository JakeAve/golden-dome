import { assert, assertEquals, assertNotEquals, assertStrictEquals } from 'jsr:@std/assert';
import { createGame } from './game.js';
import { CFG, SPR } from './cfg.js';

const TT = CFG.threats, BT = CFG.batteries;
const g0 = () => createGame({ seed: 1 });

// ---- composeWave (v4 check lines 1005–1009, 1032–1034)
Deno.test('wave 19 has warden and lug', () => { const w = g0().composeWave(19); assert(w.includes('warden') && w.includes('lug')); });
Deno.test('ghost debuts wave 3', () => { const g = g0(); assert(g.composeWave(3).includes('ghost')); assert(!g.composeWave(2).includes('ghost')); });
Deno.test('hive debuts wave 10', () => { const g = g0(); assert(g.composeWave(10).includes('hive')); assert(!g.composeWave(9).includes('hive')); });
Deno.test('needles are elite: exactly 9 at wave 20', () => assertEquals(g0().composeWave(20).filter(t => t === 'needle').length, 9));
Deno.test('mk2 debuts: lug2 @13, warden2 @30', () => { const g = g0(); assert(g.composeWave(13).includes('lug2')); assert(!g.composeWave(12).includes('lug2')); assert(g.composeWave(30).includes('warden2')); });
Deno.test('mk3 debuts: lug3 @22, warden3 @30', () => { const g = g0(); assert(g.composeWave(22).includes('lug3')); assert(!g.composeWave(21).includes('lug3')); assert(g.composeWave(30).includes('warden3')); });
Deno.test('every scheduled type has stats and a sprite', () => { for (const t of new Set(g0().composeWave(30))) { assert((TT as any)[t], t); assert((SPR as any)[t] || (SPR as any)[t.replace(/\d$/, '')], t); } });
Deno.test('dew beams per level are 1,2,3', () => assertEquals(BT.dew.beams.join(), '1,2,3'));
Deno.test('composeWave is seeded', () => assertEquals(createGame({ seed: 9 }).composeWave(15).join(), createGame({ seed: 9 }).composeWave(15).join()));

// ---- targeting (v4 check lines 1011–1031)
const fake = (g: ReturnType<typeof createGame>, k: string, lvl = 0) => g.pickTarget({ def: (BT as any)[k], kind: k, lvl, path: null, slot: { tier: 'valley' } } as any, { x: 100, y: 110 });
const ghost = () => ({ type: 'ghost', x: 100, y: 100, hp: 1, r: 7, trail: [], born: 0, vx: 0, vy: 0 });

Deno.test('PAC/FLAK chase ghosts, THAAD/DEW ignore them', () => {
  const g = g0(); g.foes.push(ghost());
  assert(fake(g, 'pac') && fake(g, 'flak')); assert(!fake(g, 'thaad') && !fake(g, 'dew'));
});
Deno.test('max-level PAC/FLAK ignore ghosts', () => { const g = g0(); g.foes.push(ghost()); assert(!fake(g, 'pac', 2) && !fake(g, 'flak', 2)); });
Deno.test('THAAD engages anvil+needle, snipes needle first; PAC cannot', () => {
  const g = g0(); g.foes.push({ ...ghost(), type: 'anvil', hp: 6, r: 8 }, { ...ghost(), type: 'needle', y: 104, hp: 1, r: 6 });
  assert(fake(g, 'thaad')); assert(!fake(g, 'pac')); assertEquals(fake(g, 'thaad')!.type, 'needle');
});
Deno.test('mk2 inherits family targeting', () => { const g = g0(); g.foes.push({ ...ghost(), type: 'anvil2', hp: 15, r: 8 }); assert(!fake(g, 'pac')); assert(fake(g, 'thaad')); });
Deno.test('dew volley temp-mark yields distinct targets', () => {
  const g = g0(); g.foes.push({ ...ghost(), type: 'lug' }, { ...ghost(), type: 'lug', y: 120 });
  const p1 = fake(g, 'dew'); p1!.dead = 2; const p2 = fake(g, 'dew'); p1!.dead = 0;
  assert(p1 && p2); assertNotEquals(p1, p2);
});

// ---- damage (v4 check lines 1019–1023, 1036–1037)
Deno.test('THAAD pierces anvil armour', () => {
  const g = g0(); const f = { ...ghost(), type: 'anvil', hp: 6, r: 8 }; g.foes.push(f);
  g.hit(f, 5, 'kinetic', { kind: 'thaad', dmg: 0, kills: 0 } as any); assertEquals(f.hp, 1);
});
Deno.test('anvil: kinetic bounces, blast lands', () => {
  const g = g0(); const f = { ...ghost(), type: 'anvil', hp: 6 };
  g.hit(f, 5, 'kinetic'); assertEquals(f.hp, 6); g.hit(f, 5, 'blast'); assertEquals(f.hp, 1);
});
Deno.test('anvil2 inherits family armour', () => {
  const g = g0(); const f = { ...ghost(), type: 'anvil2', hp: 15 };
  g.hit(f, 5, 'kinetic'); assertEquals(f.hp, 15); g.hit(f, 5, 'blast'); assertEquals(f.hp, 10);
});
Deno.test('ghosts pay nothing', () => { const g = g0(); const c0 = g.cash, f = ghost(); g.hit(f, 5, 'kinetic'); assert((f as any).dead); assertEquals(g.cash, c0); });
Deno.test('warden has no armour', () => { const g = g0(); const f = { ...ghost(), type: 'warden', hp: 120 }; g.hit(f, 1, 'kinetic'); g.hit(f, 6, 'energy'); assertEquals(f.hp, 113); });
Deno.test('kill pays bounty and emits sfx event', () => {
  const g = g0(); const f = { ...ghost(), type: 'lug' }; const c0 = g.cash;
  g.hit(f, 1, 'kinetic'); assert((f as any).dead); assertEquals(g.cash, c0 + TT.lug.$);
  assert(g.events.some(e => e.t === 'sfx' && e.k === 'kill'));
});

// ---- build
Deno.test('build deducts cost and fills slot', () => {
  const g = g0(); assert(g.build(8, 'pac')); assertEquals(g.cash, CFG.startCash - BT.pac.cost);
  assertStrictEquals(g.slots[8].b!.slot, g.slots[8]); assertEquals(g.batteries().length, 1);
});
Deno.test('build refuses occupied slot and insufficient cash', () => {
  const g = g0(); g.build(8, 'pac'); assert(!g.build(8, 'pac')); assert(!g.build(9, 'dew'));
  assertEquals(g.cash, CFG.startCash - BT.pac.cost);
});
Deno.test('cfg override', () => assertEquals(createGame({ seed: 1, cfg: { startCash: 5 } }).cash, 5));

Deno.test('game.js is DOM-free', async () => {
  const src = await Deno.readTextFile(new URL('game.js', import.meta.url));
  for (const bad of ['window', 'document', 'Math.random', 'AudioContext', 'performance.', 'Date.']) assert(!src.includes(bad), bad);
});
