---
name: golden-dome-sim
description: Use when testing, balancing, debugging or playing Golden Dome — writing a rules or gameplay test, reproducing a bug from a seed, running the balance bench, driving the game in a browser via window.GD, or touching sim/game.js.
---

# Golden Dome — sim engine

`sim/` is a headless, deterministic simulation. `index.html` only draws it.

## Invariants (tests enforce them)

- `sim/*.js` never references `window`, `document`, canvas, `AudioContext`,
  `requestAnimationFrame`, `Math.random`, `Date`, `performance`. Randomness only
  via the injected `mulberry32(seed)` (`g._rnd`).
- The renderer reads state freely but mutates it **only through commands**, and
  never calls anything that consumes `rnd` (`composeWave`, `rollBias`). Use the
  rng-free `waveTypes(n)` for previews.
- Same seed + same command sequence ⇒ identical `stats`, `cash`, `cities`,
  headless and in-browser. If they diverge, the renderer is leaking.
- Presentation side-effects are events, not calls: `game.events` holds
  `{t:'sfx',k}`, `{t:'shake',n}`, `{t:'toast',txt}`; the renderer drains it each frame.

## API (`createGame({ seed, cfg })`)

```js
import { createGame } from './sim/game.js';
const g = createGame({ seed: 42, cfg: { startCash: 5000 } });   // cfg shallow-merges over CFG
g.build(8, 'pac');            // slot index 0–11, kind pac|thaad|flak|dew → boolean
g.upgrade(8); g.upgrade(8); g.choosePath(8, 'A');   // path needs lvl 2
g.sell(8); g.repair(8); g.startWave(); g.retryWave();          // all boolean
g.run({ untilWave: 12 });     // or { untilPhase: 'over' | 'win' | 'build' }, maxTicks (200k default)
g.step();                     // one tick (no-op unless phase is build|wave)
g.phase  g.wave  g.cash  g.tick  g.cities[i].hp  g.stats /* {shots,hits,leaks} */
g.foes g.shots g.beams g.booms g.craters g.queue g.bias g.nextBias g.snap g.seen g.events
g.composeWave(n) g.waveTypes(n) g.hit(f,dmg,type,src) g.pickTarget(b,m) g.upCost(b) …
```

`run()` auto-starts waves while in `build`. Phases: `build → wave → build … →
win` at wave 30, or `over` when both cities hit 0 (`retryWave` restores the
pre-wave snapshot).

## Reproduce a seed headlessly

```bash
deno eval "import('./sim/game.js').then(({createGame}) => {
  const g = createGame({ seed: 8813 }); g.build(8,'pac'); g.build(9,'pac'); g.build(4,'thaad');
  g.run({ untilPhase: 'over' }); console.log(g.phase, g.wave, g.cash, JSON.stringify(g.stats)); })"
```

A 30-wave game takes well under a second. Step wave by wave with
`g.run({ untilWave: n })` in a loop to get per-wave leaks.

## Tests (`deno task test`, ~1 s)

- Rules test: build minimal foes/batteries directly and call `hit` /
  `pickTarget` — see the "THAAD pierces anvil armour" tests in `sim/game_test.ts`.
- Gameplay test: `createGame` with a seed, `build(...)`, `run(...)`, assert on
  `phase`/`stats`/`cash`. Zero bounties with `cfg: { threats: …$: 0 }` when
  asserting exact cash.
- Determinism test already exists; don't add rng-order-dependent assertions
  without a seed.
- Tests are `.ts`; sim objects are JSDoc-typed JS, so cast with `as any` where
  needed (file has `deno-lint-ignore-file no-explicit-any`).

## Balance bench

```bash
deno task bench --games 50 --loadout thaad,thaad,dew,flak --cash 5000 --upgrade 2 --seeds 1-50
```

Loadout fills slots in order `8,9,10,11,4,5,6,7,0,1,2,3` (valley → ridge →
peak); unaffordable builds are skipped silently. `--upgrade N` applies N upgrades
then path A. Output: win rate, avg/min wave, avg leaks, `hits/shot` (a ratio —
AoE and beam hits count against non-flak shots, so >1 is normal), cash at waves
10/20/30, per-seed table. Numbers only; it never asserts.

## Play / debug in the browser

```bash
deno task serve          # module scripts don't load over file://
```

Open http://localhost:4507/?seed=N (the HUD shows `#N`; a bug seen in play is a
seed + build order). With Playwright (`browser_navigate`, `browser_evaluate`,
`browser_take_screenshot`), `window.GD` **is** the game object:
`GD.cash = 5000; GD.build(8,'pac'); GD.startWave(); GD.speed = 4;` then poll
`GD.phase`. The same commands headless must give identical `GD.stats`.

## Hooks and layout

`deno task setup` once per clone installs `.githooks` (pre-commit and pre-push
run `deno fmt --check && deno lint && deno check` + tests). `index.html` and
`docs/` are excluded from fmt/lint. Balance numbers live only in `sim/cfg.js`.
