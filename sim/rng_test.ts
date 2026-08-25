import { assert, assertEquals, assertNotEquals } from '@std/assert';
import { mulberry32 } from './rng.js';

Deno.test('same seed gives same sequence', () => {
  const a = mulberry32(42), b = mulberry32(42);
  for (let i = 0; i < 100; i++) assertEquals(a(), b());
});

Deno.test('different seeds differ', () => {
  assertNotEquals(mulberry32(1)(), mulberry32(2)());
});

Deno.test('values in [0,1)', () => {
  const r = mulberry32(7);
  for (let i = 0; i < 10000; i++) {
    const v = r();
    assert(v >= 0 && v < 1, `${v}`);
  }
});
