import { addHydroxyl, addPhosphate, degrees, graph, polar, zigzag } from '../layout.js';

function finish(id, name, short, formula, charge, built) {
  return {
    id,
    name,
    short,
    label: short,
    formula,
    charge,
    family: 'sugar',
    atoms: built.atoms,
    bonds: built.bonds,
  };
}

function hexoseCarbons(g, roles) {
  const carbons = zigzag(6);
  carbons.forEach((point, index) => {
    g.put(`C${index + 1}`, 'C', point, { n: index + 1, role: roles[index] });
  });
  for (let i = 1; i < 6; i += 1) g.link(`C${i}`, `C${i + 1}`);
  return carbons;
}

function chainHydroxyls(g, carbons, from, to) {
  for (let carbon = from; carbon <= to; carbon += 1) {
    const up = carbon % 2 === 0;
    const point = carbons[carbon - 1];
    g.put(`O${carbon}`, 'O', polar(point, up ? -90 : 90), { role: `hydroxyl oxygen on carbon ${carbon}` });
    g.put(`H${carbon}`, 'H', polar(point, up ? 90 : -90), { role: `hydrogen on carbon ${carbon}` });
    g.link(`C${carbon}`, `O${carbon}`);
    g.link(`C${carbon}`, `H${carbon}`);
    addHydroxyl(
      g,
      `O${carbon}`,
      `C${carbon}`,
      `HO${carbon}`,
      up ? -42 : 42,
      `hydroxyl hydrogen on carbon ${carbon}`,
    );
  }
}

function carbon6Phosphate(g, carbons) {
  const incoming = degrees(carbons[5], carbons[4]);
  g.put('O6', 'O', polar(carbons[5], incoming + 180), { role: 'bridging oxygen on carbon 6' });
  g.put('H6a', 'H', polar(carbons[5], incoming + 125), { role: 'hydrogen on carbon 6' });
  g.put('H6b', 'H', polar(carbons[5], incoming + 235), { role: 'hydrogen on carbon 6' });
  g.link('C6', 'O6');
  g.link('C6', 'H6a');
  g.link('C6', 'H6b');
  addPhosphate(g, 'O6', 'C6', { p: 'P6', oxo: 'D6', minus: 'M6', end: 'E6' });
}

const HEXOSE_ROLES = [
  'aldehyde carbon',
  'carbon 2',
  'carbon 3',
  'carbon 4',
  'carbon 5',
  'carbon 6',
];

function g6pGraph() {
  const g = graph();
  const carbons = hexoseCarbons(g, HEXOSE_ROLES);
  g.put('O1', 'O', polar(carbons[0], 210), { role: 'carbonyl oxygen' });
  g.put('H1', 'H', polar(carbons[0], 90), { role: 'aldehyde hydrogen' });
  g.link('C1', 'O1', 2);
  g.link('C1', 'H1');
  chainHydroxyls(g, carbons, 2, 5);
  carbon6Phosphate(g, carbons);
  return g;
}

function fructoseEnd(g, carbons, phosphorylated) {
  g.put('O2', 'O', polar(carbons[1], -90), { role: 'carbonyl oxygen' });
  g.link('C2', 'O2', 2);
  const incoming = degrees(carbons[0], carbons[1]);
  g.put('O1', 'O', polar(carbons[0], incoming + 180), { role: phosphorylated ? 'bridging oxygen on carbon 1' : 'hydroxyl oxygen on carbon 1' });
  g.put('H1', 'H', polar(carbons[0], incoming + 78), { role: 'hydrogen on carbon 1' });
  g.put('H2', 'H', polar(carbons[0], incoming - 78), { role: 'hydrogen on carbon 1' });
  g.link('C1', 'O1');
  g.link('C1', 'H1');
  g.link('C1', 'H2');
  if (phosphorylated) {
    addPhosphate(g, 'O1', 'C1', { p: 'P1', oxo: 'D1', minus: 'M1', end: 'E1' });
  } else {
    addHydroxyl(g, 'O1', 'C1', 'HO2', 48, 'hydroxyl hydrogen on carbon 1');
  }
}

function f6pGraph() {
  const g = graph();
  const carbons = hexoseCarbons(g, [
    'carbon 1',
    'ketone carbon',
    'carbon 3',
    'carbon 4',
    'carbon 5',
    'carbon 6',
  ]);
  fructoseEnd(g, carbons, false);
  chainHydroxyls(g, carbons, 3, 5);
  carbon6Phosphate(g, carbons);
  return g;
}

function fbpGraph() {
  const g = graph();
  const carbons = hexoseCarbons(g, [
    'carbon 1',
    'ketone carbon',
    'carbon 3',
    'carbon 4',
    'carbon 5',
    'carbon 6',
  ]);
  fructoseEnd(g, carbons, true);
  chainHydroxyls(g, carbons, 3, 5);
  carbon6Phosphate(g, carbons);
  return g;
}

function trioseCarbons(g, roles) {
  const carbons = zigzag(3);
  carbons.forEach((point, index) => {
    g.put(`C${index + 1}`, 'C', point, { n: index + 1, role: roles[index] });
  });
  g.link('C1', 'C2');
  g.link('C2', 'C3');
  return carbons;
}

function phosphateOn(g, carbonId, oxygenId, hydrogenIds, ids) {
  const carbon = g.atoms[carbonId];
  const incoming = degrees(carbon, g.atoms[hydrogenIds.parent]);
  g.put(oxygenId, 'O', polar(carbon, incoming + 180), { role: 'bridging oxygen' });
  hydrogenIds.list.forEach((id, index) => {
    const spread = index === 0 ? 125 : 235;
    g.put(id, 'H', polar(carbon, incoming + spread), { role: 'hydrogen' });
    g.link(carbonId, id);
  });
  g.link(carbonId, oxygenId);
  addPhosphate(g, oxygenId, carbonId, ids);
}

function dhapGraph() {
  const g = graph();
  const carbons = trioseCarbons(g, ['carbon 1', 'ketone carbon', 'carbon 3']);
  const incoming = degrees(carbons[0], carbons[1]);
  g.put('O1', 'O', polar(carbons[0], incoming + 180), { role: 'hydroxyl oxygen' });
  g.put('H1a', 'H', polar(carbons[0], incoming + 78), { role: 'hydrogen on carbon 1' });
  g.put('H1b', 'H', polar(carbons[0], incoming - 78), { role: 'hydrogen on carbon 1' });
  g.link('C1', 'O1');
  g.link('C1', 'H1a');
  g.link('C1', 'H1b');
  addHydroxyl(g, 'O1', 'C1', 'HO1', 48, 'hydroxyl hydrogen');
  g.put('O2', 'O', polar(carbons[1], -90), { role: 'carbonyl oxygen' });
  g.link('C2', 'O2', 2);
  phosphateOn(g, 'C3', 'O3', { parent: 'C2', list: ['H3a', 'H3b'] }, { p: 'P3', oxo: 'D3', minus: 'M3', end: 'E3' });
  return g;
}

function g3pGraph() {
  const g = graph();
  const carbons = trioseCarbons(g, ['aldehyde carbon', 'carbon 2', 'carbon 3']);
  g.put('O1', 'O', polar(carbons[0], 210), { role: 'carbonyl oxygen' });
  g.put('H1', 'H', polar(carbons[0], 90), { role: 'aldehyde hydrogen' });
  g.link('C1', 'O1', 2);
  g.link('C1', 'H1');
  g.put('O2', 'O', polar(carbons[1], -90), { role: 'hydroxyl oxygen' });
  g.put('H2', 'H', polar(carbons[1], 90), { role: 'hydrogen on carbon 2' });
  g.link('C2', 'O2');
  g.link('C2', 'H2');
  addHydroxyl(g, 'O2', 'C2', 'HO2', -42, 'hydroxyl hydrogen');
  phosphateOn(g, 'C3', 'O3', { parent: 'C2', list: ['H3a', 'H3b'] }, { p: 'P3', oxo: 'D3', minus: 'M3', end: 'E3' });
  return g;
}

function bpgGraph() {
  const g = graph();
  const carbons = trioseCarbons(g, ['acyl carbon', 'carbon 2', 'carbon 3']);
  g.put('O1', 'O', polar(carbons[0], 150), { role: 'carbonyl oxygen' });
  g.link('C1', 'O1', 2);
  const incoming = degrees(carbons[0], carbons[1]);
  g.put('O1p', 'O', polar(carbons[0], incoming + 230), { role: 'bridging oxygen' });
  g.link('C1', 'O1p');
  addPhosphate(g, 'O1p', 'C1', { p: 'P1', oxo: 'D1', minus: 'M1', end: 'E1' });
  g.put('O2', 'O', polar(carbons[1], -90), { role: 'hydroxyl oxygen' });
  g.put('H2', 'H', polar(carbons[1], 90), { role: 'hydrogen on carbon 2' });
  g.link('C2', 'O2');
  g.link('C2', 'H2');
  addHydroxyl(g, 'O2', 'C2', 'HO2', -42, 'hydroxyl hydrogen');
  phosphateOn(g, 'C3', 'O3', { parent: 'C2', list: ['H3a', 'H3b'] }, { p: 'P3', oxo: 'D3', minus: 'M3', end: 'E3' });
  return g;
}

function carboxylate(g, carbon, toward) {
  const incoming = degrees(carbon, toward);
  g.put('O1', 'O', polar(carbon, incoming + 130), { role: 'carbonyl oxygen' });
  g.put('O1b', 'O', polar(carbon, incoming - 130), { charge: -1, role: 'carboxylate oxygen' });
  g.link('C1', 'O1', 2);
  g.link('C1', 'O1b');
}

function pg3Graph() {
  const g = graph();
  const carbons = trioseCarbons(g, ['carboxylate carbon', 'carbon 2', 'carbon 3']);
  carboxylate(g, carbons[0], carbons[1]);
  g.put('O2', 'O', polar(carbons[1], -90), { role: 'hydroxyl oxygen' });
  g.put('H2', 'H', polar(carbons[1], 90), { role: 'hydrogen on carbon 2' });
  g.link('C2', 'O2');
  g.link('C2', 'H2');
  addHydroxyl(g, 'O2', 'C2', 'HO2', -42, 'hydroxyl hydrogen');
  phosphateOn(g, 'C3', 'O3', { parent: 'C2', list: ['H3a', 'H3b'] }, { p: 'P3', oxo: 'D3', minus: 'M3', end: 'E3' });
  return g;
}

function pg2Graph() {
  const g = graph();
  const carbons = trioseCarbons(g, ['carboxylate carbon', 'carbon 2', 'carbon 3']);
  carboxylate(g, carbons[0], carbons[1]);
  g.put('H2', 'H', polar(carbons[1], 100), { role: 'hydrogen on carbon 2' });
  g.link('C2', 'H2');
  g.put('O2', 'O', polar(carbons[1], -80), { role: 'bridging oxygen' });
  g.link('C2', 'O2');
  addPhosphate(g, 'O2', 'C2', { p: 'P3', oxo: 'D3', minus: 'M3', end: 'E3' });
  const incoming = degrees(carbons[2], carbons[1]);
  g.put('O3', 'O', polar(carbons[2], incoming + 180), { role: 'hydroxyl oxygen' });
  g.put('H3a', 'H', polar(carbons[2], incoming + 125), { role: 'hydrogen' });
  g.put('H3b', 'H', polar(carbons[2], incoming + 235), { role: 'hydrogen' });
  g.link('C3', 'O3');
  g.link('C3', 'H3a');
  g.link('C3', 'H3b');
  addHydroxyl(g, 'O3', 'C3', 'HO2', 48, 'hydroxyl hydrogen');
  return g;
}

function pepGraph() {
  const g = graph();
  const carbons = trioseCarbons(g, ['carboxylate carbon', 'enol carbon', 'carbon 3']);
  carboxylate(g, carbons[0], carbons[1]);
  g.put('O2', 'O', polar(carbons[1], -80), { role: 'bridging oxygen' });
  g.link('C2', 'O2');
  addPhosphate(g, 'O2', 'C2', { p: 'P3', oxo: 'D3', minus: 'M3', end: 'E3' });
  const alkene = g.bonds.find(([a, b]) => a === 'C2' && b === 'C3');
  alkene[2] = 2;
  const incoming = degrees(carbons[2], carbons[1]);
  g.put('H3a', 'H', polar(carbons[2], incoming + 130), { role: 'hydrogen' });
  g.put('H3b', 'H', polar(carbons[2], incoming + 230), { role: 'hydrogen' });
  g.link('C3', 'H3a');
  g.link('C3', 'H3b');
  return g;
}

function pyruvateGraph() {
  const g = graph();
  const carbons = trioseCarbons(g, ['carboxylate carbon', 'carbonyl carbon', 'methyl carbon']);
  carboxylate(g, carbons[0], carbons[1]);
  g.put('O2', 'O', polar(carbons[1], -90), { role: 'carbonyl oxygen' });
  g.link('C2', 'O2', 2);
  const incoming = degrees(carbons[2], carbons[1]);
  g.put('H3a', 'H', polar(carbons[2], incoming + 120), { role: 'hydrogen' });
  g.put('H3b', 'H', polar(carbons[2], incoming + 180), { role: 'hydrogen' });
  g.put('H3c', 'H', polar(carbons[2], incoming + 240), { role: 'hydrogen' });
  g.link('C3', 'H3a');
  g.link('C3', 'H3b');
  g.link('C3', 'H3c');
  return g;
}

export const g6p = finish('g6p', 'glucose 6-phosphate', 'G6P', 'C6H11O9P', -2, g6pGraph());
export const f6p = finish('f6p', 'fructose 6-phosphate', 'F6P', 'C6H11O9P', -2, f6pGraph());
export const fbp = finish('fbp', 'fructose 1,6-bisphosphate', 'FBP', 'C6H10O12P2', -4, fbpGraph());
export const dhap = finish('dhap', 'dihydroxyacetone phosphate', 'DHAP', 'C3H5O6P', -2, dhapGraph());
export const g3p = finish('g3p', 'glyceraldehyde 3-phosphate', 'G3P', 'C3H5O6P', -2, g3pGraph());
export const bpg = finish('bpg', '1,3-bisphosphoglycerate', '1,3-BPG', 'C3H4O10P2', -4, bpgGraph());
export const pg3 = finish('pg3', '3-phosphoglycerate', '3-PG', 'C3H4O7P', -3, pg3Graph());
export const pg2 = finish('pg2', '2-phosphoglycerate', '2-PG', 'C3H4O7P', -3, pg2Graph());
export const pep = finish('pep', 'phosphoenolpyruvate', 'PEP', 'C3H2O6P', -3, pepGraph());
export const pyruvate = finish('pyruvate', 'pyruvate', 'pyruvate', 'C3H3O3', -1, pyruvateGraph());
