export default {
  id: 'oxygen',
  name: 'oxygen',
  short: 'O₂',
  label: 'O₂',
  formula: 'O2',
  charge: 0,
  family: 'gas',
  atoms: {
    Oa: { el: 'O', x: 0, y: 0, role: 'oxygen atom' },
    Ob: { el: 'O', x: 1, y: 0, role: 'oxygen atom' },
  },
  bonds: [
    ['Oa', 'Ob', 2],
  ],
};
