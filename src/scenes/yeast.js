// Baker's yeast, Saccharomyces cerevisiae. The same textbook mitochondrion as
// the human cell (a noted simplification: real baker's yeast has no
// proton-pumping Complex I), plus what makes a yeast cell a yeast cell: a
// wall outside the plasma membrane, a nucleus, and a bud that shares the
// mother's cytoplasm through a neck. Ethanol fermentation is pyruvate
// decarboxylase then alcohol dehydrogenase, in the cytosol.

import { buildCell } from './cell.js';

const base = buildCell({
  id: 'yeast',
  organism: 'yeast',
  ferment: 'ethanol',
  // A yeast cell can drink glucose fast enough, once ATP runs low, that
  // fermentation meets its demand. Glycolysis itself runs quicker here so
  // the port, not the enzymes, is what limits a human cell.
  params: {
    minSpacing: 24,
    spacingFloor: 1.7,
    enzymeRate: 2.4,
    // Oxidative phosphorylation meets this easily. Fermentation does too,
    // just, because the port can open faster than the human one.
    demand: 0.1,
    fermentDemand: 0.1,
    backlog: 3,
    prime: { nadc: [['nad', 8]] },
  },
});

const cell = base.cell.shape;
const bud = { type: 'ellipse', cx: 1885, cy: 380, rx: 145, ry: 118 };
const WALL = 18;

export const yeastScene = {
  ...base,
  bounds: { x: -36, y: -36, w: 2120, h: cell.h + 72 },
  wall: { type: 'roundRect', x: cell.x - WALL, y: cell.y - WALL, w: cell.w + WALL * 2, h: cell.h + WALL * 2, r: cell.r + WALL },
  bud,
  budWall: { type: 'ellipse', cx: bud.cx, cy: bud.cy, rx: bud.rx + WALL, ry: bud.ry + WALL },
  labels: [
    ...base.labels,
    { text: 'Cell wall', x: 1500, y: cell.h + WALL / 2, kind: 'compartment' },
    { text: 'Bud', x: bud.cx + 20, y: bud.cy, kind: 'compartment' },
  ],
};
