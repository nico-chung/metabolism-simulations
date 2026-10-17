// Nitrate and nitrite, the bacterium's other final electron acceptor and what
// it becomes (PLAN §8.4). Drawn with nitrogen in the middle and one N=O double
// bond; the formal charges put +1 on nitrogen in nitrate, so its derived
// oxidation state is +5, and +3 in nitrite.

export const nitrate = {
  id: 'nitrate',
  name: 'nitrate',
  short: 'NO₃⁻',
  label: 'NO₃⁻',
  formula: 'NO3',
  charge: -1,
  family: 'nitrogen',
  atoms: {
    N: { el: 'N', x: 0, y: 0, charge: 1, role: 'nitrogen' },
    Oa: { el: 'O', x: 0, y: -1, role: 'oxygen atom' },
    Ob: { el: 'O', x: -0.87, y: 0.5, charge: -1, role: 'oxygen atom' },
    Oc: { el: 'O', x: 0.87, y: 0.5, charge: -1, role: 'oxygen atom' },
  },
  bonds: [
    ['N', 'Oa', 2],
    ['N', 'Ob', 1],
    ['N', 'Oc', 1],
  ],
};

export const nitrite = {
  id: 'nitrite',
  name: 'nitrite',
  short: 'NO₂⁻',
  label: 'NO₂⁻',
  formula: 'NO2',
  charge: -1,
  family: 'nitrogen',
  atoms: {
    N: { el: 'N', x: 0, y: 0, role: 'nitrogen' },
    Oa: { el: 'O', x: -0.87, y: -0.5, role: 'oxygen atom' },
    Ob: { el: 'O', x: 0.87, y: -0.5, charge: -1, role: 'oxygen atom' },
  },
  bonds: [
    ['N', 'Oa', 2],
    ['N', 'Ob', 1],
  ],
};
