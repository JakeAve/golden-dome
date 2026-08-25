import { assert, assertEquals } from 'jsr:@std/assert';
import { CFG, FLATS, groundY, MK, SLOT_DEFS, SPR, W } from './cfg.js';

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
  assertEquals(groundY(50), 142);
  assertEquals(groundY(300), 252);
  assertEquals(groundY(-100), groundY(0));
  assertEquals(groundY(W + 100), groundY(W - 1));
  assertEquals(FLATS.length, 7);
});

Deno.test('12 slots, every slot sits on its flat', () => {
  assertEquals(SLOT_DEFS.length, 12);
  for (const [x, y] of SLOT_DEFS) assertEquals(y, groundY(x));
});

Deno.test('sim sources are DOM-free', async () => {
  for (const f of ['cfg.js', 'rng.js']) {
    const src = await Deno.readTextFile(new URL(f, import.meta.url));
    for (const bad of ['window', 'document', 'Math.random', 'AudioContext', 'performance.', 'Date.', 'canvas', 'requestAnimationFrame'])
      assert(!src.includes(bad), `${f} contains ${bad}`);
  }
});
