// Open-chain glucose. Bond length is 1. The backbone is a horizontal zigzag
// with C-1 at the left. World y grows downward, so a negative local y is up
// on the screen. No wedges: above and below is layout, not a stereo claim.

const C = [
  [0, 0],
  [0.866, -0.5],
  [1.732, 0],
  [2.598, -0.5],
  [3.464, 0],
  [4.33, -0.5],
];

const up = [0, -1];
const down = [0, 1];

export default {
  id: 'glucose',
  name: 'glucose',
  short: 'glucose',
  label: 'Glucose',
  formula: 'C6H12O6',
  charge: 0,
  family: 'sugar',
  atoms: {
    C1: { el: 'C', x: C[0][0], y: C[0][1], n: 1, role: 'aldehyde carbon' },
    O1: { el: 'O', x: -0.866, y: -0.5, role: 'carbonyl oxygen' },
    H1: { el: 'H', x: 0, y: 1, role: 'aldehyde hydrogen' },

    C2: { el: 'C', x: C[1][0], y: C[1][1], n: 2, role: 'carbon 2' },
    O2: { el: 'O', x: C[1][0] + up[0], y: C[1][1] + up[1], role: 'hydroxyl oxygen on carbon 2' },
    HO2: { el: 'H', x: C[1][0] - 0.766, y: C[1][1] - 1 - 0.643, role: 'hydroxyl hydrogen on carbon 2' },
    H2: { el: 'H', x: C[1][0] + down[0], y: C[1][1] + down[1], role: 'hydrogen on carbon 2' },

    C3: { el: 'C', x: C[2][0], y: C[2][1], n: 3, role: 'carbon 3' },
    O3: { el: 'O', x: C[2][0] + down[0], y: C[2][1] + down[1], role: 'hydroxyl oxygen on carbon 3' },
    HO3: { el: 'H', x: C[2][0] - 0.766, y: C[2][1] + 1 + 0.643, role: 'hydroxyl hydrogen on carbon 3' },
    H3: { el: 'H', x: C[2][0] + up[0], y: C[2][1] + up[1], role: 'hydrogen on carbon 3' },

    C4: { el: 'C', x: C[3][0], y: C[3][1], n: 4, role: 'carbon 4' },
    O4: { el: 'O', x: C[3][0] + up[0], y: C[3][1] + up[1], role: 'hydroxyl oxygen on carbon 4' },
    HO4: { el: 'H', x: C[3][0] + 0.766, y: C[3][1] - 1 - 0.643, role: 'hydroxyl hydrogen on carbon 4' },
    H4: { el: 'H', x: C[3][0] + down[0], y: C[3][1] + down[1], role: 'hydrogen on carbon 4' },

    C5: { el: 'C', x: C[4][0], y: C[4][1], n: 5, role: 'carbon 5' },
    O5: { el: 'O', x: C[4][0] + down[0], y: C[4][1] + down[1], role: 'hydroxyl oxygen on carbon 5' },
    HO5: { el: 'H', x: C[4][0] + 0.766, y: C[4][1] + 1 + 0.643, role: 'hydroxyl hydrogen on carbon 5' },
    H5: { el: 'H', x: C[4][0] + up[0], y: C[4][1] + up[1], role: 'hydrogen on carbon 5' },

    C6: { el: 'C', x: C[5][0], y: C[5][1], n: 6, role: 'carbon 6' },
    O6: { el: 'O', x: C[5][0] + up[0], y: C[5][1] + up[1], role: 'hydroxyl oxygen on carbon 6' },
    HO6: { el: 'H', x: C[5][0] + 0.766, y: C[5][1] - 1 - 0.643, role: 'hydroxyl hydrogen on carbon 6' },
    H6a: { el: 'H', x: C[5][0] + 0.94, y: C[5][1] + 0.342, role: 'hydrogen on carbon 6' },
    H6b: { el: 'H', x: C[5][0] - 0.174, y: C[5][1] + 0.985, role: 'hydrogen on carbon 6' },
  },
  bonds: [
    ['C1', 'O1', 2],
    ['C1', 'H1', 1],
    ['C1', 'C2', 1],
    ['C2', 'O2', 1],
    ['O2', 'HO2', 1],
    ['C2', 'H2', 1],
    ['C2', 'C3', 1],
    ['C3', 'O3', 1],
    ['O3', 'HO3', 1],
    ['C3', 'H3', 1],
    ['C3', 'C4', 1],
    ['C4', 'O4', 1],
    ['O4', 'HO4', 1],
    ['C4', 'H4', 1],
    ['C4', 'C5', 1],
    ['C5', 'O5', 1],
    ['O5', 'HO5', 1],
    ['C5', 'H5', 1],
    ['C5', 'C6', 1],
    ['C6', 'O6', 1],
    ['O6', 'HO6', 1],
    ['C6', 'H6a', 1],
    ['C6', 'H6b', 1],
  ],
};
