// sim/maps.js — playable maps: terrain flats, battery pads, city spans. Pure data + groundY.
import { W } from './cfg.js';

/** @param {number} v @param {number} a @param {number} z */
const cl = (v, a, z) => v < a ? a : v > z ? z : v;

/**
 * @typedef {{x0: number, x1: number, y: number}} Flat
 * @typedef {{key: string, name: string, blurb: string, flats: Flat[], slots: [number, number, 'peak'|'ridge'|'valley'][], cities: {a: number, z: number}[], river?: number}} GameMap
 */

/** Build a per-x ground lookup from a flats profile. @param {Flat[]} flats */
export function makeGroundY(flats) {
  const top = new Int16Array(W);
  for (let x = 0; x < W; x++) {
    let y = 250;
    for (const f of flats) if (x >= f.x0 && x < f.x1) y = f.y;
    top[x] = y;
  }
  return /** @param {number} x */ (x) => top[cl(x | 0, 0, W - 1)];
}

/** @type {Record<string, GameMap>} */
export const MAPS = {
  valley: {
    key: 'valley',
    name: 'THE VALLEY',
    blurb: 'Twin cities share one floor. Peaks both sides.',
    flats: [
      { x0: -4, x1: 104, y: 142 },
      { x0: 104, x1: 166, y: 200 },
      { x0: 166, x1: 228, y: 252 },
      { x0: 228, x1: 400, y: 252 },
      { x0: 400, x1: 462, y: 252 },
      { x0: 462, x1: 520, y: 194 },
      { x0: 520, x1: 628, y: 152 },
    ],
    slots: [
      [30, 142, 'peak'],
      [78, 142, 'peak'],
      [546, 152, 'peak'],
      [594, 152, 'peak'],
      [122, 200, 'ridge'],
      [150, 200, 'ridge'],
      [478, 194, 'ridge'],
      [506, 194, 'ridge'],
      [184, 252, 'valley'],
      [212, 252, 'valley'],
      [416, 252, 'valley'],
      [444, 252, 'valley'],
    ],
    cities: [{ a: 230, z: 308 }, { a: 318, z: 398 }],
    river: 312,
  },
  divide: {
    key: 'divide',
    name: 'THE DIVIDE',
    blurb: 'A mountain between the cities. Hold the summit.',
    flats: [
      { x0: -4, x1: 52, y: 200 },
      { x0: 52, x1: 184, y: 252 },
      { x0: 184, x1: 232, y: 200 },
      { x0: 232, x1: 392, y: 140 },
      { x0: 392, x1: 440, y: 200 },
      { x0: 440, x1: 572, y: 252 },
      { x0: 572, x1: 628, y: 200 },
    ],
    slots: [
      [260, 140, 'peak'],
      [292, 140, 'peak'],
      [332, 140, 'peak'],
      [364, 140, 'peak'],
      [24, 200, 'ridge'],
      [208, 200, 'ridge'],
      [416, 200, 'ridge'],
      [600, 200, 'ridge'],
      [64, 252, 'valley'],
      [176, 252, 'valley'],
      [448, 252, 'valley'],
      [560, 252, 'valley'],
    ],
    cities: [{ a: 82, z: 158 }, { a: 466, z: 542 }],
  },
  highlands: {
    key: 'highlands',
    name: 'THE HIGHLANDS',
    blurb: 'Cities at ground level, a low dome of rock between.',
    flats: [
      { x0: -4, x1: 128, y: 252 },
      { x0: 128, x1: 192, y: 222 },
      { x0: 192, x1: 432, y: 192 },
      { x0: 432, x1: 496, y: 222 },
      { x0: 496, x1: 628, y: 252 },
    ],
    slots: [
      [216, 192, 'peak'],
      [248, 192, 'peak'],
      [376, 192, 'peak'],
      [408, 192, 'peak'],
      [146, 222, 'ridge'],
      [174, 222, 'ridge'],
      [450, 222, 'ridge'],
      [478, 222, 'ridge'],
      [8, 252, 'valley'],
      [116, 252, 'valley'],
      [508, 252, 'valley'],
      [616, 252, 'valley'],
    ],
    cities: [{ a: 26, z: 100 }, { a: 524, z: 598 }],
  },
  terraces: {
    key: 'terraces',
    name: 'THE TERRACES',
    blurb: 'Stepped ground. One city low, one on a shelf.',
    flats: [
      { x0: -4, x1: 80, y: 142 },
      { x0: 80, x1: 160, y: 194 },
      { x0: 160, x1: 304, y: 252 },
      { x0: 304, x1: 368, y: 200 },
      { x0: 368, x1: 500, y: 232 },
      { x0: 500, x1: 628, y: 152 },
    ],
    slots: [
      [24, 142, 'peak'],
      [56, 142, 'peak'],
      [524, 152, 'peak'],
      [556, 152, 'peak'],
      [98, 194, 'ridge'],
      [130, 194, 'ridge'],
      [322, 200, 'ridge'],
      [350, 200, 'ridge'],
      [178, 252, 'valley'],
      [288, 252, 'valley'],
      [380, 232, 'valley'],
      [488, 232, 'valley'],
    ],
    cities: [{ a: 194, z: 274 }, { a: 394, z: 474 }],
  },
  plains: {
    key: 'plains',
    name: 'THE PLAINS',
    blurb: 'Flat ground, no high pads. Pure range and spacing.',
    flats: [{ x0: -4, x1: 628, y: 252 }],
    slots: [
      [250, 252, 'peak'],
      [282, 252, 'peak'],
      [342, 252, 'peak'],
      [374, 252, 'peak'],
      [24, 252, 'ridge'],
      [52, 252, 'ridge'],
      [572, 252, 'ridge'],
      [600, 252, 'ridge'],
      [196, 252, 'valley'],
      [224, 252, 'valley'],
      [400, 252, 'valley'],
      [428, 252, 'valley'],
    ],
    cities: [{ a: 100, z: 180 }, { a: 444, z: 524 }],
  },
};
