// Cytochrome c and a lone electron. Cytochrome c is a carrier body whose
// formal charge drops by one when it holds an electron, so oxidation states
// still add up. An electron held inside Complex IV is a species with no
// atoms; the redox check counts it as a free electron.

export const cytc = {
  id: 'cytc',
  name: 'cytochrome c',
  short: 'cyt c',
  label: 'cyt c',
  formula: 'C',
  charge: 1,
  family: 'carrier',
  carrier: { label: 'c' },
  ecount: 0,
  atoms: {
    body: { el: 'C', x: 0, y: 0, charge: 1, body: true, role: 'cytochrome c' },
  },
  bonds: [],
};

export const cytcr = {
  id: 'cytcr',
  name: 'reduced cytochrome c',
  short: 'cyt c',
  label: 'cyt c',
  formula: 'C',
  charge: 0,
  family: 'carrier',
  carrier: { label: 'c' },
  ecount: 1,
  atoms: {
    body: { el: 'C', x: 0, y: 0, body: true, role: 'cytochrome c' },
  },
  bonds: [],
};

export const electron = {
  id: 'electron',
  name: 'electron',
  short: 'e⁻',
  label: 'e⁻',
  formula: '',
  charge: -1,
  freeElectrons: 1,
  family: 'electron',
  ecount: 1,
  atoms: {},
  bonds: [],
};
