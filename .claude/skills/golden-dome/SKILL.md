---
name: golden-dome
description: Use when working on Golden Dome gameplay — rules, threats, batteries, waves, economy, balance numbers, "what counters X", "why did Y not take damage", or designing a new threat/battery/upgrade.
---

# Golden Dome — premise and rules

Ballistic-missile-defense tower defense named after the real Golden Dome program.
A genre translation of Bloons TD: layered enemy ladder, tower ladder, between-wave
economy — but balloons are missiles and the fixed path is open sky. Side-on view:
missiles enter along the top edge, fly a real parabola (gravity `0.002`/tick²),
land on one of **two cities** (x 230–308 and 318–398, 100 HP each). Lose both →
`over`. Survive wave 30 → `win`.

**Height = time.** Twelve build pads on three tiers; a peak battery kills things
*earlier* in the arc, not just farther. Range × `tier`: peak 1.25, ridge 1.0,
valley 0.85. Pads (index: x/y/tier): `0–3` peaks (30,78 left · 546,594 right),
`4–7` ridges (122,150 · 478,506), `8–11` valley (184,212 · 416,444). Pads are the
scarce resource — placement is constrained before the missiles show up.

**Triage is the tension.** Leaks damage the city they hit; per-wave income is
`surviving cities × (35 + 4·wave)`, so a dead city compounds. Between waves:
build, upgrade (L2 ×0.8 cost, L3 ×1.6), pick a path at L3 (×2.0), sell (70 % of
paid), repair a WASP-broken battery (40 % of cost — what stops gun-hunters from
being a death spiral).

**Variance control.** Each wave rolls a launch bias (`nextBias`, shown on the HUD
as "heavy from the LEFT/CENTER/RIGHT"); launch x is drawn around it, width grows
with wave. Launch gap shrinks `48 − 2.5·wave` (min 9 ticks); from wave 10 salvos
of 2–3 with chance `0.25 + 0.01·wave`. **Pure phase from wave 21** (`wave.pureFrom`):
mk1 fodder stops launching (`to: 20`) and the gap becomes `pureGap − pureGapPerWave·(wave − 21)`
(40 → 31 ticks) — fewer, tougher bodies at a sane rate; gap-per-launch is why cutting
fodder without widening the gap compresses the heavies into a burst. **The only per-wave difficulty ramp is headcount**:
non-elite counts × `1 + 0.14·(wave − 6)` past wave 6; hp/speed never change.

## Damage rules (`sim/game.js` `hit` / `pickTarget`)

| Rule | Effect |
|---|---|
| ANVIL family + kinetic | bounces (spark) unless the source is THAAD |
| WASP family + blast | bounces — too small for flak |
| GHOST | dies to any hit, pays $0; THAAD, DEW and any L2+ battery ignore it |
| NEEDLE vs PAC | PAC shots fizzle at r+12 unless PAC has path A SEEKER; THAAD/FLAK/DEW fine |
| HIVE at `deployY` 112 (or warden-shed hive at spawn y+70) | auto-splits into `pips` — whether or not you shot it |
| WARDEN | weaves, sheds a hive every 140 ticks, no armour; `flash` on hit |
| Family match | `isa(f,'anvil')` — `anvil2`/`anvil3` inherit `anvil` rules; same for every mk2/mk3 |
| Targeting | lowest-y first (closest to landing) with bonuses: hive above deploy +80, wasp +40; THAAD: +40·hp, needle +400, already-locked −500 |
| Damage per level | dmg ×(1 + 0.25·min(lvl,2)), range ×(1 + 0.10·min(lvl,2)); THAAD cool ×(1 − 0.25·min(lvl,2)) |

Ticks are 60/s at 1× speed. `T` below is flight time in ticks (×0.9–1.1).

## Bestiary (`sim/cfg.js` `CFG.threats`)

| type | hp | T | city dmg | $ | waves | count(n) | note |
|---|---|---|---|---|---|---|---|
| lug | 1 | 380 | 20 | 8 | 1–20 | `n<=2 ? 2+2n : 3+⌊1.5n⌋` | the red balloon |
| lug2 | 15 | 340 | 25 | 40 | 13 | `1+⌊(n−12)/2⌋` | soaks a PAC burst |
| lug3 | 72 | 310 | 30 | 80 | 22 | `1+⌊(n−21)/3⌋` | flying bunker |
| needle | 1 | 150 | 15 | 12 | 5–20 | `2+⌊(n−5)/2⌋` elite | outruns PAC |
| needle2 | 15 | 135 | 20 | 70 | 16 | `1+⌊(n−16)/3⌋` elite | |
| needle3 | 72 | 120 | 25 | 140 | 24 | `1+⌊(n−24)/3⌋` elite | |
| hive | 3 | 280 | 30 | 18 | 10–20 | `1+⌊(n−9)/1.5⌋` | 5 pips |
| hive2 | 30 | 260 | 35 | 90 | 20 | `1+⌊(n−19)/3⌋` | 8 pips |
| hive3 | 150 | 240 | 40 | 180 | 27 | `1+⌊(n−27)/3⌋` | 12 pips |
| pip | 1 | — | 10 | 4 | never launched | born from hives | |
| anvil | 6 | 500 | 40 | 30 | 8–20 | `⌊(n−5)/1.4⌋` | kinetic bounces |
| anvil2 | 45 | 460 | 50 | 140 | 17 | `1+⌊(n−16)/3⌋` | |
| anvil3 | 210 | 420 | 60 | 280 | 25 | `1+⌊(n−24)/4⌋` | THAAD or AP flak |
| wasp | 2 | 260 | 0 | 25 | 11–20 | `(n−8)>>1` | hunts batteries, breaks one on impact |
| wasp2 | 30 | 240 | 0 | 120 | 21 | `⌊(n−18)/3⌋` | |
| wasp3 | 150 | 220 | 0 | 240 | 27 | `⌊(n−24)/3⌋` | |
| ghost | 1 | 170 | 0 | 0 | 3 | `5+⌊(n−3)/2⌋` | decoy, wastes PAC/FLAK shots |
| warden | 240 | 800 | 50 | 500 | 19 | `[(n−19)%3==0] + [n≥25] + [n≥29]` elite | boss, sheds hives |
| warden2 | 400 | 750 | 60 | 1000 | 27 | `[n%3==0]` elite | sheds hive2 |
| warden3 | 700 | 700 | 75 | 2000 | 30 | 1 elite | final boss, sheds hive3 |

"elite" = exact count, exempt from the headcount ramp. A threat's `info` string is
shown once as a toast the first time it launches (`seen`).

## Armory (`CFG.batteries`)

| battery | cost | dmg | type | range | cool | spd | notes | path A | path B |
|---|---|---|---|---|---|---|---|---|---|
| PAC | 200 | 1 | kinetic | 140 | 90 | 5 | 6-shot magazine, 9 ticks apart, homing | SEEKER: can hit needles, dmg ×1.2 | QUAD-PACK: mag 12, cool 45 |
| THAAD | 900 | 8 | kinetic | 270 | 120 | 10 | pierces anvil, ignores ghost, snipes needles first | EXO-KILL: range ×1.5, dmg ×1.5 | SALVO: 2 rounds/cycle, dmg ×0.8 |
| FLAK | 400 | 1.5 | blast r18 | 160 | 70 | 6 | swivels, sticky target, 6-round stream, proximity fuse | PROXIMITY: r30, 8-round stream | AP: dmg ×2.5, r12 |
| DEW | 1200 | 6 | energy | 230 | 80 | — | charges 40 ticks then instant beams through everything on the line; beams 1/2/3 by level | PULSE: cool 25, charge 15, dmg ×0.5 | LANCE: dmg ×2, charge 60 |

Effect colours identify the gun without looking at it: gold kinetic trails
(PAC/THAAD), orange flak bursts, cyan DEW beams.

## Balance workflow

Numbers live only in `sim/cfg.js`; never hard-code one elsewhere. To evaluate a
change: `deno task bench --games 50 --loadout thaad,thaad,dew,flak --cash 5000 --upgrade 2`
(see `golden-dome-sim`). Rules tests in `sim/game_test.ts` pin the table above —
`deno task test` after any edit; the pre-commit hook runs it anyway.

## Adding a threat or variant — checklist

1. `CFG.threats.<name>` with `hp, T, dmg, $, r, from, count, info` (+`to`, `pips`,
   `shedEvery`). A mk-variant name must be `<family><digit>` so `isa()` inherits
   rules. `count` must return ≥1 by `from`.
2. Sprite: base rows in `SPR`, or a recolour in `MK` (`golden-dome-art`).
3. `index.html` `SFX` matches by family (`k.replace(/\d$/, '')`) — a new family needs a sound row.
4. Flash states: hives get `_hot`, wardens `_hot`, wasps `_lock` — the loops in
   `index.html` build them for every `MK` key by family prefix.
5. `deno task test` — the "every scheduled type has stats and a sprite" test catches a missing sprite.
