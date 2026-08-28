# GOLDEN DOME

Side-on missile-defense tower defense (BTD-style ladder, open sky instead of a path). Canvas 2D, no deps, no build. `index.html` is the map menu; `play.html` is a thin renderer over a headless, seeded
sim in `sim/`.

- `index.html` — map menu (links to `play.html?map=K&seed=N`). `play.html` — terrain painter (data-driven from the map), sprite raster, `draw()`, HUD, input, audio. Imports `sim/`.
- `sim/cfg.js` — every tuning number, sprite row. `sim/maps.js` — `MAPS` (flats, pads, city spans per map), `makeGroundY`. `sim/game.js` — `createGame({seed,cfg,map})`. `sim/rng.js` — mulberry32.
- `sim/game_test.ts`, `sim/bench.ts` — rules + full-gameplay tests, balance runner.
- `docs/` (gitignored) — `armory.html`, `bestiary.html` sprite references; `superpowers/` specs and plans.

Commands: `deno task setup` (once: git hooks) · `deno task test` · `deno task sw-check` · `deno task bench` · `deno task serve` → http://localhost:4507/ (menu) or /play.html?map=valley&seed=N

Load the skill for the job before reading code:

- `golden-dome` — premise, rules, threats, batteries, economy, balance numbers.
- `golden-dome-art` — pixel style, palette, sprite format and variants, HUD conventions.
- `golden-dome-sim` — headless testing, bench, reproducing a seed, playing via `window.GD`, invariants.
- `golden-dome-pwa` — sw.js/manifest, offline cache, VERSION bump rule, `deno task sw-check`.

Pre-commit/pre-push hooks run `deno fmt --check`, `deno lint`, `deno check`, and the tests. `index.html`/`play.html` are excluded from fmt on purpose.
