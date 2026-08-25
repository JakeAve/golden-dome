# GOLDEN DOME

Side-on missile-defense tower defense (BTD-style ladder, open sky instead of a path). Canvas 2D, no deps, no build. One version: `index.html` is a thin renderer over a headless, seeded sim in `sim/`.

- `index.html` — terrain painter, sprite raster, `draw()`, HUD, input, audio. Imports `sim/`.
- `sim/cfg.js` — every tuning number, sprite row, terrain point. `sim/game.js` — `createGame({seed,cfg})`. `sim/rng.js` — mulberry32.
- `sim/game_test.ts`, `sim/bench.ts` — rules + full-gameplay tests, balance runner.
- `docs/` (gitignored) — `armory.html`, `bestiary.html` sprite references; `superpowers/` specs and plans.

Commands: `deno task setup` (once: git hooks) · `deno task test` · `deno task bench` · `deno task serve` → http://localhost:4507/?seed=N

Load the skill for the job before reading code:

- `golden-dome` — premise, rules, threats, batteries, economy, balance numbers.
- `golden-dome-art` — pixel style, palette, sprite format and variants, HUD conventions.
- `golden-dome-sim` — headless testing, bench, reproducing a seed, playing via `window.GD`, invariants.

Pre-commit/pre-push hooks run `deno fmt --check`, `deno lint`, `deno check`, and the tests. `index.html` is excluded from fmt/lint on purpose.
