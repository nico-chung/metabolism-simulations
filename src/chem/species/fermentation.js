// Lactate, acetaldehyde and ethanol. Open-chain, same scale as pyruvate.
// Lactate keeps pyruvate's labels so the hydride from NADH is the new
// hydrogen on carbon 2, and the proton from the medium is the hydroxyl hydrogen.

import { addHydroxyl, degrees, graph, polar, zigzag } from '../layout.js';

function metabolite(id, name, short, formula, charge, built) {
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

function carbons(g, roles) {
  const points = zigzag(roles.length);
  points.forEach((point, index) => {
    g.put(`C${index + 1}`, 'C', point, { n: index + 1, role: roles[index] });
  });
  for (let i = 1; i < roles.length; i += 1) g.link(`C${i}`, `C${i + 1}`);
  return points;
}

function lactateGraph() {
  const g = graph();
  const points = carbons(g, ['carboxylate carbon', 'carbon 2', 'methyl carbon']);
  const incoming = degrees(points[0], points[1]);
  g.put('O1', 'O', polar(points[0], incoming + 130), { role: 'carbonyl oxygen' });
  g.put('O1b', 'O', polar(points[0], incoming - 130), { charge: -1, role: 'carboxylate oxygen' });
  g.link('C1', 'O1', 2);
  g.link('C1', 'O1b');
  g.put('O2', 'O', polar(points[1], -90), { role: 'hydroxyl oxygen' });
  g.put('H2', 'H', polar(points[1], 90), { role: 'hydrogen on carbon 2' });
  g.link('C2', 'O2');
  g.link('C2', 'H2');
  addHydroxyl(g, 'O2', 'C2', 'HO2', -42, 'hydroxyl hydrogen');
  const methyl = degrees(points[2], points[1]);
  g.put('H3a', 'H', polar(points[2], methyl + 120), { role: 'hydrogen' });
  g.put('H3b', 'H', polar(points[2], methyl + 180), { role: 'hydrogen' });
  g.put('H3c', 'H', polar(points[2], methyl + 240), { role: 'hydrogen' });
  g.link('C3', 'H3a');
  g.link('C3', 'H3b');
  g.link('C3', 'H3c');
  return g;
}

function acetaldehydeGraph() {
  const g = graph();
  const points = carbons(g, ['aldehyde carbon', 'methyl carbon']);
  g.put('O1', 'O', polar(points[0], 150), { role: 'carbonyl oxygen' });
  g.put('H1', 'H', polar(points[0], 30), { role: 'aldehyde hydrogen' });
  g.link('C1', 'O1', 2);
  g.link('C1', 'H1');
  const methyl = degrees(points[1], points[0]);
  g.put('H3a', 'H', polar(points[1], methyl + 120), { role: 'hydrogen' });
  g.put('H3b', 'H', polar(points[1], methyl + 180), { role: 'hydrogen' });
  g.put('H3c', 'H', polar(points[1], methyl + 240), { role: 'hydrogen' });
  g.link('C2', 'H3a');
  g.link('C2', 'H3b');
  g.link('C2', 'H3c');
  return g;
}

function ethanolGraph() {
  const g = graph();
  const points = carbons(g, ['carbinol carbon', 'methyl carbon']);
  g.put('O1', 'O', polar(points[0], -90), { role: 'hydroxyl oxygen' });
  g.put('H1a', 'H', polar(points[0], 30), { role: 'hydrogen' });
  g.put('H1b', 'H', polar(points[0], 150), { role: 'hydrogen' });
  g.link('C1', 'O1');
  g.link('C1', 'H1a');
  g.link('C1', 'H1b');
  addHydroxyl(g, 'O1', 'C1', 'HO1', -42, 'hydroxyl hydrogen');
  const methyl = degrees(points[1], points[0]);
  g.put('H3a', 'H', polar(points[1], methyl + 120), { role: 'hydrogen' });
  g.put('H3b', 'H', polar(points[1], methyl + 180), { role: 'hydrogen' });
  g.put('H3c', 'H', polar(points[1], methyl + 240), { role: 'hydrogen' });
  g.link('C2', 'H3a');
  g.link('C2', 'H3b');
  g.link('C2', 'H3c');
  return g;
}

export const lactate = metabolite('lactate', 'lactate', 'lactate', 'C3H5O3', -1, lactateGraph());
export const acetaldehyde = metabolite('acetaldehyde', 'acetaldehyde', 'acetaldehyde', 'C2H4O', 0, acetaldehydeGraph());
export const ethanol = metabolite('ethanol', 'ethanol', 'ethanol', 'C2H6O', 0, ethanolGraph());
