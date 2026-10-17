// The human cell: the shared respiring cell (cell.js) with lactate
// dehydrogenase as its fermentation branch.

import { STRIP_HALF, STRIP_Y, buildCell } from './cell.js';

export { STRIP_HALF, STRIP_Y };

export const humanScene = buildCell({
  id: 'human',
  organism: 'human',
  ferment: 'lactic',
  // Demand is the aerobic rate. The glucose port will not open fast enough
  // for 2 ATP per glucose to meet it, so fermentation cannot keep this cell
  // alive at that demand.
  params: {
    minSpacing: 24,
    spacingFloor: 14,
    enzymeRate: 1,
    demand: 30 / 32,
    // Two ATP per glucose, and the port will not open faster than every
    // few tens of seconds. This is slow enough to live on that.
    fermentDemand: 0.025,
    fermentStarve: 45,
    prime: { nadc: [['nad', 4]] },
  },
});
