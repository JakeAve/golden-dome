import { assert, assertEquals } from '@std/assert';
import { CFG, MK, SPR, W } from './cfg.js';
import { makeGroundY, MAPS } from './maps.js';

Deno.test('sprite rows are rectangular', () => {
  for (const [n, rows] of Object.entries(SPR)) for (const r of rows) assertEquals(r.length, rows[0].length, n);
});

Deno.test('variant recolours point at real base sprites', () => {
  for (const [k, [base]] of Object.entries(MK)) assert(base in SPR, k);
});

Deno.test('every launchable threat has from + count', () => {
  for (const [k, d] of Object.entries(CFG.threats)) {
    if (k === 'pip') continue;
    assert(typeof d.from === 'number' && typeof d.count === 'function', k);
  }
});

Deno.test('groundY follows the flats and clamps', () => {
  const groundY = makeGroundY(MAPS.valley.flats);
  assertEquals(groundY(50), 142);
  assertEquals(groundY(300), 252);
  assertEquals(groundY(-100), groundY(0));
  assertEquals(groundY(W + 100), groundY(W - 1));
  assertEquals(MAPS.valley.flats.length, 7);
});

Deno.test('every map: 12 pads (4 per tier) on the ground, 2 cities each inside one flat, key matches', () => {
  for (const [key, m] of Object.entries(MAPS)) {
    assertEquals(m.key, key);
    const groundY = makeGroundY(m.flats);
    assertEquals(m.slots.length, 12, key);
    for (const t of ['peak', 'ridge', 'valley']) assertEquals(m.slots.filter((s) => s[2] === t).length, 4, `${key} ${t}`);
    for (const [x, y] of m.slots) assertEquals(y, groundY(x), `${key} pad ${x}`);
    assertEquals(m.cities.length, 2, key);
    for (const c of m.cities) {
      assert(c.z - c.a >= 70, `${key} city width`);
      assert(m.flats.some((f) => c.a >= f.x0 && c.z <= f.x1), `${key} city ${c.a} inside a flat`);
      for (const [x] of m.slots) assert(x < c.a - 10 || x > c.z + 10, `${key} pad ${x} clear of city`);
    }
  }
});
