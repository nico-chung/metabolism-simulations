// A leaf, from the outside in (M6 plan §5.1): outside air, the upper
// epidermis with one stoma, an air space, then a mesophyll cell with its
// wall, vacuole, nucleus and a chloroplast blown up. Inside the chloroplast
// one thylakoid sac runs across the top of the stroma: its floor is the
// strip of thylakoid membrane, its inside the lumen, the proton reservoir.
// The band between the chloroplast's two envelope membranes is cytosol, not
// a reservoir (D14). Shared by C3, C4 and CAM.

import { inEllipse, inRoundRect } from './geometry.js';
import { STRIP_HALF, STRIP_Y } from './parts.js';

export { STRIP_HALF, STRIP_Y };

export const LEAF = {
  // Room above the epidermis keeps the CO₂ tray and the stoma clear of the
  // ledger chips at Fit (M6 plan L10).
  // M6.5 P4: the cell ends a little right of ATP synthase and a little below
  // hexose assembly, with a flatter vacuole and a smaller nucleus.
  bounds: { x: -100, y: -500, w: 1580, h: 1990 },
  epidermis: { y1: -200, y2: -150 },
  stoma: { x: 150, pore: 24, closed: 4 },
  cell: { type: 'roundRect', x: -20, y: 40, w: 1400, h: 1340, r: 150 },
  wall: { type: 'roundRect', x: -34, y: 26, w: 1428, h: 1368, r: 164 },
  chloroplast: {
    outer: { type: 'roundRect', x: 160, y: 140, w: 1140, h: 920, r: 160 },
    inner: { type: 'roundRect', x: 172, y: 152, w: 1116, h: 896, r: 148 },
  },
  // The thylakoid sac: roof, then the strip (its floor), closed at both ends.
  sac: { x1: 220, x2: 1240, roof: 168 },
  // Faint stacked discs for the other thylakoids, in the stroma's free corner.
  grana: [[1170, 570], [1225, 690], [1120, 800], [360, 990]],
  vacuole: { type: 'roundRect', x: 910, y: 1110, w: 440, h: 240, r: 100 },
  nucleus: { type: 'ellipse', cx: 220, cy: 1230, rx: 92, ry: 64 },
};

export function sacShape() {
  const { x1, x2, roof } = LEAF.sac;
  return { type: 'roundRect', x: x1, y: roof, w: x2 - x1, h: STRIP_Y + STRIP_HALF - roof, r: 22 };
}

// The lumen's proton cloud: inside the sac, above the strip.
export function lumenReservoir() {
  const { x1, x2, roof } = LEAF.sac;
  return {
    name: 'thylakoid lumen',
    x1: x1 + 14,
    x2: x2 - 14,
    y1: roof + 8,
    y2: STRIP_Y - STRIP_HALF - 6,
    within: { type: 'roundRect', x: x1 + 6, y: roof + 6, w: x2 - x1 - 12, h: STRIP_Y - STRIP_HALF - roof - 8, r: 16 },
  };
}

// The inspector's words for where a point is.
export function leafPlace(x, y) {
  if (y < LEAF.epidermis.y1) return 'in the air outside the leaf';
  if (y <= LEAF.epidermis.y2) return Math.abs(x - LEAF.stoma.x) < 20 ? 'in the stoma' : 'in the epidermis';
  if (!inRoundRect(LEAF.wall, x, y)) return 'in the air space inside the leaf';
  if (!inRoundRect(LEAF.cell, x, y)) return 'in the cell wall';
  if (inEllipse(LEAF.nucleus, x, y)) return 'in the nucleus';
  if (inRoundRect(LEAF.vacuole, x, y)) return 'in the vacuole';
  const { outer, inner } = LEAF.chloroplast;
  if (inRoundRect(inner, x, y)) {
    if (inRoundRect(sacShape(), x, y)) {
      if (y < STRIP_Y - STRIP_HALF) return 'in the thylakoid lumen';
      return 'in the thylakoid membrane';
    }
    return 'in the stroma';
  }
  if (inRoundRect(outer, x, y)) return 'crossing the chloroplast envelope';
  return 'in the cytosol';
}
