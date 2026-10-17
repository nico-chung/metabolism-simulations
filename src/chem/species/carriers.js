import { at, graph, polar } from '../layout.js';

function chain(count) {
  const g = graph();
  let cursor = at(0, 0);
  let previous = 'body';
  g.put('body', 'C', cursor, { body: true, role: 'adenosine' });
  for (let i = 0; i < count; i += 1) {
    const oxygen = polar(cursor, 0);
    const phosphorus = polar(oxygen, 0);
    const bridge = `B${i}`;
    const last = i === count - 1;
    g.put(bridge, 'O', oxygen, { role: 'bridging oxygen' });
    g.put(`P${i}`, 'P', phosphorus, { role: 'phosphorus' });
    g.put(`D${i}`, 'O', polar(phosphorus, 90), { role: 'phosphoryl oxygen' });
    g.put(`M${i}`, 'O', polar(phosphorus, -90), { charge: -1, role: 'phosphoryl oxygen' });
    g.link(previous, bridge, 1);
    g.link(bridge, `P${i}`, 1);
    g.link(`P${i}`, `D${i}`, 2);
    g.link(`P${i}`, `M${i}`, 1);
    if (last) {
      g.put('E', 'O', polar(phosphorus, 0), { charge: -1, role: 'phosphoryl oxygen' });
      g.link(`P${i}`, 'E', 1);
    }
    cursor = phosphorus;
    previous = `P${i}`;
  }
  return g;
}

function nucleotide(id, name, phosphates, charge) {
  const built = chain(phosphates);
  const oxygens = phosphates * 3 + 1;
  return {
    id,
    name,
    short: name,
    label: name,
    formula: `CO${oxygens}P${phosphates}`,
    charge,
    family: 'carrier',
    carrier: { label: 'Adenosine' },
    atoms: built.atoms,
    bonds: built.bonds,
  };
}

export const atp = nucleotide('atp', 'ATP', 3, -4);
export const adp = nucleotide('adp', 'ADP', 2, -3);
// C4's pyruvate, phosphate dikinase leaves AMP (M7a, M6 plan §3.5).
export const amp = nucleotide('amp', 'AMP', 1, -2);

// Pyrophosphate, HP₂O₇³⁻: phosphorus A carries the hydroxyl, X bridges.
const ppiGraph = graph();
ppiGraph.put('PA', 'P', at(0, 0), { role: 'phosphorus' });
ppiGraph.put('X', 'O', polar(at(0, 0), 0), { role: 'bridging oxygen' });
ppiGraph.put('PB', 'P', polar(polar(at(0, 0), 0), 0), { role: 'phosphorus' });
ppiGraph.put('DA', 'O', polar(at(0, 0), 90), { role: 'phosphoryl oxygen' });
ppiGraph.put('MA', 'O', polar(at(0, 0), -90), { charge: -1, role: 'phosphoryl oxygen' });
ppiGraph.put('OA', 'O', polar(at(0, 0), 180), { role: 'hydroxyl oxygen' });
ppiGraph.put('HA', 'H', polar(polar(at(0, 0), 180), 180), { role: 'hydroxyl hydrogen' });
ppiGraph.put('DB', 'O', polar(ppiGraph.atoms.PB, 90), { role: 'phosphoryl oxygen' });
ppiGraph.put('MB', 'O', polar(ppiGraph.atoms.PB, -90), { charge: -1, role: 'phosphoryl oxygen' });
ppiGraph.put('EB', 'O', polar(ppiGraph.atoms.PB, 0), { charge: -1, role: 'phosphoryl oxygen' });
ppiGraph.link('PA', 'X', 1);
ppiGraph.link('X', 'PB', 1);
ppiGraph.link('PA', 'DA', 2);
ppiGraph.link('PA', 'MA', 1);
ppiGraph.link('PA', 'OA', 1);
ppiGraph.link('OA', 'HA', 1);
ppiGraph.link('PB', 'DB', 2);
ppiGraph.link('PB', 'MB', 1);
ppiGraph.link('PB', 'EB', 1);

export const ppi = {
  id: 'ppi',
  name: 'pyrophosphate',
  short: 'PPᵢ',
  label: 'PPᵢ',
  formula: 'HO7P2',
  charge: -3,
  family: 'carrier',
  atoms: ppiGraph.atoms,
  bonds: ppiGraph.bonds,
};

export const nad = {
  id: 'nad',
  name: 'NAD⁺',
  short: 'NAD⁺',
  label: 'NAD⁺',
  formula: 'C',
  charge: 1,
  family: 'carrier',
  carrier: { label: 'NAD' },
  atoms: {
    body: { el: 'C', x: 0, y: 0, charge: 1, body: true, role: 'NAD' },
  },
  bonds: [],
};

export const nadh = {
  id: 'nadh',
  name: 'NADH',
  short: 'NADH',
  label: 'NADH',
  formula: 'CH',
  charge: 0,
  family: 'carrier',
  carrier: { label: 'NAD' },
  ecount: 2,
  atoms: {
    body: { el: 'C', x: 0, y: 0, body: true, role: 'NAD' },
    H: { el: 'H', x: 1, y: 0, hydride: true, role: 'hydride' },
  },
  bonds: [['body', 'H', 1]],
};

const piGraph = graph();
piGraph.put('P', 'P', at(0, 0), { role: 'phosphorus' });
piGraph.put('D', 'O', polar(at(0, 0), 180), { role: 'phosphoryl oxygen' });
piGraph.put('M', 'O', polar(at(0, 0), -90), { charge: -1, role: 'phosphoryl oxygen' });
piGraph.put('N', 'O', polar(at(0, 0), 90), { charge: -1, role: 'phosphoryl oxygen' });
piGraph.put('O', 'O', polar(at(0, 0), 0), { role: 'hydroxyl oxygen' });
piGraph.put('H', 'H', polar(polar(at(0, 0), 0), 0), { role: 'hydroxyl hydrogen' });
piGraph.link('P', 'D', 2);
piGraph.link('P', 'M', 1);
piGraph.link('P', 'N', 1);
piGraph.link('P', 'O', 1);
piGraph.link('O', 'H', 1);

export const pi = {
  id: 'pi',
  name: 'phosphate',
  short: 'Pᵢ',
  label: 'Pᵢ',
  formula: 'HO4P',
  charge: -2,
  family: 'carrier',
  atoms: piGraph.atoms,
  bonds: piGraph.bonds,
};

export const proton = {
  id: 'proton',
  name: 'H⁺',
  short: 'H⁺',
  label: 'H⁺',
  formula: 'H',
  charge: 1,
  family: 'proton',
  atoms: {
    H: { el: 'H', x: 0, y: 0, charge: 1, role: 'proton' },
  },
  bonds: [],
};

const waterGraph = graph();
waterGraph.put('O', 'O', at(0, 0), { role: 'oxygen' });
waterGraph.put('Ha', 'H', polar(at(0, 0), 0), { role: 'hydrogen' });
waterGraph.put('Hb', 'H', polar(at(0, 0), 104), { role: 'hydrogen' });
waterGraph.link('O', 'Ha', 1);
waterGraph.link('O', 'Hb', 1);

export const water = {
  id: 'water',
  name: 'water',
  short: 'H₂O',
  label: 'H₂O',
  formula: 'H2O',
  charge: 0,
  family: 'gas',
  atoms: waterGraph.atoms,
  bonds: waterGraph.bonds,
};
