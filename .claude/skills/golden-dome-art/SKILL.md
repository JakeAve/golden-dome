---
name: golden-dome-art
description: Use when changing how Golden Dome looks — sprites, recolour variants, palette, terrain, clouds, explosions, trails, HUD/buttons/toasts, canvas sizing, or judging whether new pixel art fits the game's style.
---

# Golden Dome — visual style

**Register: characterful hardware, GBA-era pixel art, bright daylight.** Not
realism. Every gun and missile is a distinct icon at tiny size (Duck Game):
chunky proportions, oversized fins, bold colour blocking, one hue per type so a
heavy salvo stays readable. Shared motif of glowing lights (Lug's amber eye,
Hive's belly ports, Wasp's twin red seekers, Warden's orange seams) gives each
sprite its animation hook.

## Canvas rules (`play.html`)

- World grid **624×288** (2.167:1, iPhone landscape edge to edge); HUD strip is
  the bottom 26 px (`HUD`, ground area ends at `GY = 262`). Backing canvas is
  **2× (`FINE = 2`)**: terrain paints at world scale onto a prerendered `bg`
  canvas; sprites, trails, discs and text draw on the fine grid via `fx(v) = v*2|0`.
- Integer scaling only (`fit()`), `imageSmoothingEnabled = false`, CSS
  `image-rendering: pixelated`.
- **No anti-aliasing, no alpha fades.** Trails fade by dropping pixels (trail
  arrays shrink); explosions are filled discs with hot cores from a palette ramp
  (`BOOM_PAL`, `disc()` with edge dither). 8×8 Bayer (`B8`, `dith()`) for texture.
- Warm/cool split: sun is the warm key from upper-right (`lit` from slope sign),
  sky-bounce the cool fill. Distance layers desaturate toward pale blue.
- Patterned surfaces, not gradients: cliff strata + ribs, grass caps with drips,
  pines on ledges, stonework in the city.

## Palette (named ramps, dark → light)

`SKY` 7 blues · `CLOUD` 5 whites · `FAR`/`MID` haze ranges · `MIDG` green ·
`GRS` 8 greens · `ROCK` 9 browns · `RIV` 6 river blues · `STL` 8 steels (UI) ·
`CY` 4 cyans (DEW) · `OR` 3 oranges (FLAK) · `YOU` 5 golds (player kinetic) ·
`THEM` 5 reds (enemy) · `RED` 3. ~47 colours total; pick from a ramp with
`pick(ramp, i)` rather than inventing hex. Effect colours are semantic:
**gold = your kinetic, cyan = DEW, orange = flak, red = them.**

## Sprites

Sprites are palette-indexed string rows — no PNGs, no fetch, no build.

```js
// sim/cfg.js SPR — one char per pixel, '.' transparent, rectangular
wasp: ['......k......', '.....klk.....', /* … */ '...kjjjjjk...'],
```

- Threat rows use palette `TP`, battery rows use `BP` (letter → hex, `k` is the
  outline black in both). Rows live in `sim/cfg.js` because sprite height feeds
  muzzle geometry (`bMuzzle`); rasterising them (`render(rows, pal, overrides)`
  → offscreen canvas → `IMG[key]`) happens only in `play.html`.
- **Recolour variants** — `MK` in `cfg.js`: `wasp2: ['wasp', { j:'#c25a10', l:'#ff8a2b', m:'#8e1420' }]`
  (base sprite, per-letter override). Convention: mk2 = red, mk3 = black/orange.
  `play.html` builds `IMG[k]` for every `MK` key, plus family flash states:
  `hive*_hot`, `warden*_hot`, `wasp*_lock` (override the light letters to white).
- Battery states: `<kind>_dead` (grey), `pac_empty`, `thaad_empty`, `dew_chg`,
  `dew_hot` — picked in `draw()` from battery fields.
- Draw a sprite with `sprite(img, x, y, angle, flame, scale)` — rotates to
  velocity, `flame` adds a flickering exhaust; flying things face their arc.
- Author new art in `docs/bestiary.html` / `docs/armory.html` (gitignored
  workbenches that animate the rows), then paste the rows into `cfg.js`.

## HUD conventions

Bottom strip: cash, wave `n/30`, city bars, battery buttons with cost, START /
NEXT ▶, speed toggle (0.5/1/2/4×), seed badge `#N`. Selected battery opens a
panel with UPGRADE/path A|B/SELL/REPAIR buttons (`UI.btns`, hit-tested in the
pointer handler). Toasts (`toast`) show a threat's `info` once; the build-phase
banner shows next wave's bias. Text is `bold ui-monospace`. Screen shake and
toast timers decay by `speed` per frame.

## Checking a change

`deno task serve` → http://localhost:4507/play.html?map=valley&seed=1, screenshot with Playwright at
1× and at 4× speed mid-wave; compare against the previous build. Nothing in
`sim/` should change for a visual edit (`deno task test` stays green).
