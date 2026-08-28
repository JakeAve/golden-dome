---
name: golden-dome-pwa
description: Use when touching Golden Dome's PWA layer — sw.js, manifest.json, icons, offline caching, "why is the deployed game stale", or when a commit is rejected by sw-check.
---

# Golden Dome PWA

Site: https://jakeave.github.io/golden-dome/ (GitHub Pages, static). `manifest.json` (`display: fullscreen`, scope `./`), `sw.js`, `icon-512.png`, `apple-touch-icon.png`. Both pages register `sw.js` and carry `apple-mobile-web-app-capable` for iOS fullscreen.

## How sw.js works

- `VERSION` names the cache. `ASSETS` is the precache list (pages, `sim/*.js`, icons, manifest).
- Fetch: cache-first, refresh in background, `ignoreSearch` so every `play.html?map=..&seed=..` maps to the one cached page.
- `activate` deletes every cache whose name isn't `VERSION`.

## The rule

**Any change to a file in `ASSETS` needs a `VERSION` bump** (`gd-v1` → `gd-v2`). Otherwise installed clients keep the old build until the background refresh happens to win. `deno task sw-check` (in pre-commit) enforces this: it fails when a precached file is staged and `VERSION` equals HEAD's. It also fails if an `ASSETS` entry doesn't exist on disk.

New asset the game loads at runtime? Add it to `ASSETS` and bump `VERSION`.

## Verify locally

```
deno task serve
```
Open http://localhost:4507/, DevTools → Application → Service Workers (should be activated) → Cache Storage `gd-vN` should list every `ASSETS` entry. Toggle Offline, reload `/play.html?map=valley&seed=1` — canvas must render. Headless: navigate, then `await navigator.serviceWorker.ready; (await (await caches.open('gd-vN')).keys()).length`.

Stale SW while developing: DevTools → Application → Service Workers → "Update on reload" / Unregister.
