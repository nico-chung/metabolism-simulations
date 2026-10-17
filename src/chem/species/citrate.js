import { at, graph, polar } from '../layout.js';

// Citrate, deprotonated: three carboxylates and one alcohol. The branch
// points up and the chain runs left to right, so the arms stay clear of
// each other. The cycle that uses it is a later milestone; this layout
// sizes the matrix.

const g = graph();
const c3 = at(0, 0);
const c2 = at(-1, 0);
const c4 = at(1, 0);
const c6 = at(0, -1);
const o3 = at(0, 1);
const c1 = at(-2, 0);
const c5 = at(2, 0);

g.put('C3', 'C', c3, { n: 3, role: 'carbon 3' });
g.put('C2', 'C', c2, { n: 2, role: 'carbon 2' });
g.put('C4', 'C', c4, { n: 4, role: 'carbon 4' });
g.put('C6', 'C', c6, { n: 6, role: 'carboxylate carbon' });
g.put('C1', 'C', c1, { n: 1, role: 'carboxylate carbon' });
g.put('C5', 'C', c5, { n: 5, role: 'carboxylate carbon' });
g.put('O3', 'O', o3, { role: 'hydroxyl oxygen' });
g.link('C3', 'C2');
g.link('C3', 'C4');
g.link('C3', 'C6');
g.link('C3', 'O3');
g.link('C2', 'C1');
g.link('C4', 'C5');

g.put('H2a', 'H', polar(c2, 125), { role: 'hydrogen' });
g.put('H2b', 'H', polar(c2, 235), { role: 'hydrogen' });
g.link('C2', 'H2a');
g.link('C2', 'H2b');
g.put('H4a', 'H', polar(c4, 55), { role: 'hydrogen' });
g.put('H4b', 'H', polar(c4, -55), { role: 'hydrogen' });
g.link('C4', 'H4a');
g.link('C4', 'H4b');
g.put('HO3', 'H', polar(o3, 70), { role: 'hydroxyl hydrogen' });
g.link('O3', 'HO3');

function carboxylate(carbon, out, oxo, minus) {
  g.put(oxo, 'O', polar(carbon, out + 52), { role: 'carbonyl oxygen' });
  g.put(minus, 'O', polar(carbon, out - 52), { charge: -1, role: 'carboxylate oxygen' });
  g.link(carbon === c1 ? 'C1' : carbon === c5 ? 'C5' : 'C6', oxo, 2);
  g.link(carbon === c1 ? 'C1' : carbon === c5 ? 'C5' : 'C6', minus);
}

carboxylate(c1, 180, 'O1', 'O1b');
carboxylate(c5, 0, 'O5', 'O5b');
carboxylate(c6, -90, 'O6', 'O6b');

const citrate = {
  id: 'citrate',
  name: 'citrate',
  short: 'citrate',
  label: 'citrate',
  formula: 'C6H5O7',
  charge: -3,
  family: 'sugar',
  atoms: g.atoms,
  bonds: g.bonds,
};

export default citrate;
