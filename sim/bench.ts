// sim/bench.ts — run N seeded games with a loadout, print outcome stats. Numbers only, no assertions.
import { parseArgs } from 'jsr:@std/cli/parse-args';
import { createGame } from './game.js';
import { CFG } from './cfg.js';

const a = parseArgs(Deno.args, { string: ['loadout', 'seeds'], default: { games: 20, loadout: 'pac,pac,flak', cash: CFG.startCash, upgrade: 0 } });
const ORDER = [8, 9, 10, 11, 4, 5, 6, 7, 0, 1, 2, 3];
const kinds = String(a.loadout).split(',').filter(Boolean);
const [s0, s1] = a.seeds ? String(a.seeds).split('-').map(Number) : [1, Number(a.games)];

type Row = { seed: number; phase: string; wave: number; leaks: number; shots: number; hits: number; cash10: number; cash20: number; cash30: number; ticks: number };
const rows: Row[] = [];
for (let seed = s0; seed <= s1; seed++) {
  const g = createGame({ seed, cfg: { startCash: Number(a.cash) } }) as any;
  kinds.forEach((k, i) => g.build(ORDER[i], k));
  for (let n = 0; n < Number(a.upgrade); n++) for (const i of ORDER) g.upgrade(i);
  if (Number(a.upgrade) >= 2) for (const i of ORDER) g.choosePath(i, 'A');
  const cashAt: Record<number, number> = {};
  for (const w of [10, 20, 30]) { g.run({ untilWave: w }); cashAt[w] = g.phase === 'over' ? NaN : g.cash; if (g.phase !== 'build') break; }
  g.run({ untilPhase: 'win' });
  rows.push({ seed, phase: g.phase, wave: g.wave, leaks: g.stats.leaks, shots: g.stats.shots, hits: g.stats.hits, cash10: cashAt[10], cash20: cashAt[20], cash30: cashAt[30], ticks: g.tick });
}
const avg = (f: (r: Row) => number) => { const v = rows.map(f).filter(Number.isFinite); return v.length ? (v.reduce((x, y) => x + y, 0) / v.length).toFixed(1) : '-'; };
console.log(`loadout=${kinds.join(',')} cash=${a.cash} upgrade=${a.upgrade} games=${rows.length}`);
console.log(`win rate     ${(100 * rows.filter(r => r.phase === 'win').length / rows.length).toFixed(0)}%`);
console.log(`avg wave     ${avg(r => r.wave)}   min ${Math.min(...rows.map(r => r.wave))}`);
console.log(`avg leaks    ${avg(r => r.leaks)}`);
console.log(`hit rate     ${avg(r => r.shots ? 100 * r.hits / r.shots : NaN)}%`);
console.log(`cash @10/20/30  ${avg(r => r.cash10)} / ${avg(r => r.cash20)} / ${avg(r => r.cash30)}`);
console.log(`avg ticks    ${avg(r => r.ticks)}`);
console.table(rows);
