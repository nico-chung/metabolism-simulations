import { at, graph, polar } from '../layout.js';

// Matrix intermediates and the membrane carriers. Carbon numbers follow the
// textbook: oxaloacetate C-1 is the carboxylate next to the ketone.

function species(id, name, short, formula, charge, built, extra = {}) {
  return {
    id,
    name,
    short,
    label: extra.label ?? short,
    formula,
    charge,
    family: extra.family ?? 'sugar',
    carrier: extra.carrier,
    ecount: extra.ecount ?? 0,
    atoms: built.atoms,
    bonds: built.bonds,
  };
}

function carboxyl(g, carbonId, angle, oxo, minus) {
  const carbon = g.atoms[carbonId];
  g.put(oxo, 'O', polar(carbon, angle + 52), { role: 'carbonyl oxygen' });
  g.put(minus, 'O', polar(carbon, angle - 52), { charge: -1, role: 'carboxylate oxygen' });
  g.link(carbonId, oxo, 2);
  g.link(carbonId, minus);
}

const coaGraph = graph();
coaGraph.put('body', 'C', at(0, 0), { body: true, role: 'coenzyme A' });
coaGraph.put('S', 'S', polar(at(0, 0), 0), { role: 'thiol sulfur' });
coaGraph.put('H', 'H', polar(polar(at(0, 0), 0), 0), { role: 'thiol hydrogen' });
coaGraph.link('body', 'S');
coaGraph.link('S', 'H');

export const coa = species('coa', 'coenzyme A', 'CoA', 'CHS', 0, coaGraph, {
  family: 'carrier',
  carrier: { label: 'CoA' },
});

const acetylGraph = graph();
acetylGraph.put('body', 'C', at(0, 0), { body: true, role: 'coenzyme A' });
acetylGraph.put('S', 'S', polar(at(0, 0), 0), { role: 'thioester sulfur' });
const cc = polar(acetylGraph.atoms.S, 0);
acetylGraph.put('Cc', 'C', cc, { n: 1, role: 'carbonyl carbon' });
acetylGraph.put('Oc', 'O', polar(cc, 90), { role: 'carbonyl oxygen' });
const cm = polar(cc, 0);
acetylGraph.put('Cm', 'C', cm, { n: 2, role: 'methyl carbon' });
acetylGraph.put('Hm1', 'H', polar(cm, 60), { role: 'hydrogen' });
acetylGraph.put('Hm2', 'H', polar(cm, -60), { role: 'hydrogen' });
acetylGraph.put('Hm3', 'H', polar(cm, 0), { role: 'hydrogen' });
acetylGraph.link('body', 'S');
acetylGraph.link('S', 'Cc');
acetylGraph.link('Cc', 'Oc', 2);
acetylGraph.link('Cc', 'Cm');
acetylGraph.link('Cm', 'Hm1');
acetylGraph.link('Cm', 'Hm2');
acetylGraph.link('Cm', 'Hm3');

export const acetylcoa = species('acetylcoa', 'acetyl-CoA', 'acetyl-CoA', 'C3H3OS', 0, acetylGraph, {
  carrier: { label: 'CoA' },
});

const oaaGraph = graph();
oaaGraph.put('C2', 'C', at(0, 0), { n: 2, role: 'ketone carbon' });
oaaGraph.put('C1', 'C', polar(at(0, 0), 180), { n: 1, role: 'carboxylate carbon' });
oaaGraph.put('C3', 'C', polar(at(0, 0), 0), { n: 3, role: 'carbon 3' });
oaaGraph.put('C4', 'C', polar(polar(at(0, 0), 0), 0), { n: 4, role: 'carboxylate carbon' });
oaaGraph.put('O2', 'O', polar(at(0, 0), -90), { role: 'ketone oxygen' });
oaaGraph.put('H3a', 'H', polar(oaaGraph.atoms.C3, 90), { role: 'hydrogen' });
oaaGraph.put('H3b', 'H', polar(oaaGraph.atoms.C3, -90), { role: 'hydrogen' });
oaaGraph.link('C1', 'C2');
oaaGraph.link('C2', 'C3');
oaaGraph.link('C2', 'O2', 2);
oaaGraph.link('C3', 'C4');
oaaGraph.link('C3', 'H3a');
oaaGraph.link('C3', 'H3b');
carboxyl(oaaGraph, 'C1', 180, 'O1', 'O1b');
carboxyl(oaaGraph, 'C4', 0, 'O4', 'O4b');

export const oaa = species('oaa', 'oxaloacetate', 'OAA', 'C4H2O5', -2, oaaGraph);

const iso = graph();
iso.put('C3', 'C', at(0, 0), { n: 3, role: 'carbon 3' });
iso.put('C2', 'C', polar(at(0, 0), 180), { n: 2, role: 'carbon 2' });
iso.put('C4', 'C', polar(at(0, 0), 0), { n: 4, role: 'carbon 4' });
iso.put('C6', 'C', polar(at(0, 0), -90), { n: 6, role: 'carboxylate carbon' });
iso.put('H2b', 'H', polar(at(0, 0), 90), { role: 'hydrogen' });
iso.put('C1', 'C', polar(iso.atoms.C2, 180), { n: 1, role: 'carboxylate carbon' });
iso.put('C5', 'C', polar(iso.atoms.C4, 0), { n: 5, role: 'carboxylate carbon' });
iso.put('O3', 'O', polar(iso.atoms.C2, 235), { role: 'hydroxyl oxygen' });
iso.put('H2a', 'H', polar(iso.atoms.C2, 125), { role: 'hydrogen' });
iso.put('HO3', 'H', polar(iso.atoms.O3, 235), { role: 'hydroxyl hydrogen' });
iso.put('H4a', 'H', polar(iso.atoms.C4, 55), { role: 'hydrogen' });
iso.put('H4b', 'H', polar(iso.atoms.C4, -55), { role: 'hydrogen' });
iso.link('C3', 'C2');
iso.link('C3', 'C4');
iso.link('C3', 'C6');
iso.link('C3', 'H2b');
iso.link('C2', 'C1');
iso.link('C2', 'O3');
iso.link('C2', 'H2a');
iso.link('C4', 'C5');
iso.link('C4', 'H4a');
iso.link('C4', 'H4b');
iso.link('O3', 'HO3');
carboxyl(iso, 'C1', 180, 'O1', 'O1b');
carboxyl(iso, 'C5', 0, 'O5', 'O5b');
carboxyl(iso, 'C6', -90, 'O6', 'O6b');

export const isocitrate = species('isocitrate', 'isocitrate', 'isocitrate', 'C6H5O7', -3, iso);

const akgGraph = graph();
akgGraph.put('C2', 'C', at(0, 0), { n: 2, role: 'ketone carbon' });
akgGraph.put('C1', 'C', polar(at(0, 0), 180), { n: 1, role: 'carboxylate carbon' });
akgGraph.put('C3', 'C', polar(at(0, 0), 0), { n: 3, role: 'carbon 3' });
akgGraph.put('C4', 'C', polar(akgGraph.atoms.C3, 0), { n: 4, role: 'carbon 4' });
akgGraph.put('C5', 'C', polar(akgGraph.atoms.C4, 0), { n: 5, role: 'carboxylate carbon' });
akgGraph.put('O2', 'O', polar(at(0, 0), -90), { role: 'ketone oxygen' });
akgGraph.put('H3a', 'H', polar(akgGraph.atoms.C3, 90), { role: 'hydrogen' });
akgGraph.put('H3b', 'H', polar(akgGraph.atoms.C3, -90), { role: 'hydrogen' });
akgGraph.put('H4a', 'H', polar(akgGraph.atoms.C4, 90), { role: 'hydrogen' });
akgGraph.put('H4b', 'H', polar(akgGraph.atoms.C4, -90), { role: 'hydrogen' });
akgGraph.link('C1', 'C2');
akgGraph.link('C2', 'C3');
akgGraph.link('C2', 'O2', 2);
akgGraph.link('C3', 'C4');
akgGraph.link('C3', 'H3a');
akgGraph.link('C3', 'H3b');
akgGraph.link('C4', 'C5');
akgGraph.link('C4', 'H4a');
akgGraph.link('C4', 'H4b');
carboxyl(akgGraph, 'C1', 180, 'O1', 'O1b');
carboxyl(akgGraph, 'C5', 0, 'O5', 'O5b');

export const akg = species('akg', 'α-ketoglutarate', 'α-KG', 'C5H4O5', -2, akgGraph);

const succinylGraph = graph();
succinylGraph.put('body', 'C', at(0, 0), { body: true, role: 'coenzyme A' });
succinylGraph.put('S', 'S', polar(at(0, 0), 0), { role: 'thioester sulfur' });
succinylGraph.put('C1', 'C', polar(succinylGraph.atoms.S, 0), { n: 1, role: 'thioester carbon' });
succinylGraph.put('O1', 'O', polar(succinylGraph.atoms.C1, 90), { role: 'carbonyl oxygen' });
succinylGraph.put('C2', 'C', polar(succinylGraph.atoms.C1, 0), { n: 2, role: 'carbon 2' });
succinylGraph.put('C3', 'C', polar(succinylGraph.atoms.C2, 0), { n: 3, role: 'carbon 3' });
succinylGraph.put('C4', 'C', polar(succinylGraph.atoms.C3, 0), { n: 4, role: 'carboxylate carbon' });
succinylGraph.put('H2a', 'H', polar(succinylGraph.atoms.C2, 90), { role: 'hydrogen' });
succinylGraph.put('H2b', 'H', polar(succinylGraph.atoms.C2, -90), { role: 'hydrogen' });
succinylGraph.put('H3a', 'H', polar(succinylGraph.atoms.C3, 90), { role: 'hydrogen' });
succinylGraph.put('H3b', 'H', polar(succinylGraph.atoms.C3, -90), { role: 'hydrogen' });
succinylGraph.link('body', 'S');
succinylGraph.link('S', 'C1');
succinylGraph.link('C1', 'O1', 2);
succinylGraph.link('C1', 'C2');
succinylGraph.link('C2', 'C3');
succinylGraph.link('C2', 'H2a');
succinylGraph.link('C2', 'H2b');
succinylGraph.link('C3', 'C4');
succinylGraph.link('C3', 'H3a');
succinylGraph.link('C3', 'H3b');
carboxyl(succinylGraph, 'C4', 0, 'O4', 'O4b');

export const succinyl = species('succinyl', 'succinyl-CoA', 'succinyl-CoA', 'C5H4O3S', -1, succinylGraph, {
  carrier: { label: 'CoA' },
});

function diacid(id, name, short, formula, charge, middle) {
  const g = graph();
  g.put('C2', 'C', at(0, 0), { n: 2, role: 'carbon 2' });
  g.put('C1', 'C', polar(at(0, 0), 180), { n: 1, role: 'carboxylate carbon' });
  g.put('C3', 'C', polar(at(0, 0), 0), { n: 3, role: 'carbon 3' });
  g.put('C4', 'C', polar(g.atoms.C3, 0), { n: 4, role: 'carboxylate carbon' });
  g.link('C1', 'C2');
  g.link('C2', 'C3', middle);
  g.link('C3', 'C4');
  carboxyl(g, 'C1', 180, 'O1', 'O1b');
  carboxyl(g, 'C4', 0, 'O4', 'O4b');
  return { g };
}

const succinateBuilt = diacid('succinate', 'succinate', 'succinate', 'C4H4O4', -2, 1);
succinateBuilt.g.put('H2a', 'H', polar(succinateBuilt.g.atoms.C2, 90), { role: 'hydrogen' });
succinateBuilt.g.put('H2b', 'H', polar(succinateBuilt.g.atoms.C2, -90), { role: 'hydrogen' });
succinateBuilt.g.put('H3a', 'H', polar(succinateBuilt.g.atoms.C3, 90), { role: 'hydrogen' });
succinateBuilt.g.put('H3b', 'H', polar(succinateBuilt.g.atoms.C3, -90), { role: 'hydrogen' });
succinateBuilt.g.link('C2', 'H2a');
succinateBuilt.g.link('C2', 'H2b');
succinateBuilt.g.link('C3', 'H3a');
succinateBuilt.g.link('C3', 'H3b');

export const succinate = species('succinate', 'succinate', 'succinate', 'C4H4O4', -2, succinateBuilt.g);

const fumarateBuilt = diacid('fumarate', 'fumarate', 'fumarate', 'C4H2O4', -2, 2);
fumarateBuilt.g.put('H2', 'H', polar(fumarateBuilt.g.atoms.C2, 90), { role: 'hydrogen' });
fumarateBuilt.g.put('H3', 'H', polar(fumarateBuilt.g.atoms.C3, -90), { role: 'hydrogen' });
fumarateBuilt.g.link('C2', 'H2');
fumarateBuilt.g.link('C3', 'H3');

export const fumarate = species('fumarate', 'fumarate', 'fumarate', 'C4H2O4', -2, fumarateBuilt.g);

const malateGraph = graph();
malateGraph.put('C2', 'C', at(0, 0), { n: 2, role: 'alcohol carbon' });
malateGraph.put('C1', 'C', polar(at(0, 0), 180), { n: 1, role: 'carboxylate carbon' });
malateGraph.put('C3', 'C', polar(at(0, 0), 0), { n: 3, role: 'carbon 3' });
malateGraph.put('C4', 'C', polar(malateGraph.atoms.C3, 0), { n: 4, role: 'carboxylate carbon' });
malateGraph.put('O2', 'O', polar(at(0, 0), -90), { role: 'hydroxyl oxygen' });
malateGraph.put('HO2', 'H', polar(malateGraph.atoms.O2, -90), { role: 'hydroxyl hydrogen' });
malateGraph.put('H2', 'H', polar(at(0, 0), 90), { role: 'hydrogen' });
malateGraph.put('H3a', 'H', polar(malateGraph.atoms.C3, 90), { role: 'hydrogen' });
malateGraph.put('H3b', 'H', polar(malateGraph.atoms.C3, -90), { role: 'hydrogen' });
malateGraph.link('C1', 'C2');
malateGraph.link('C2', 'C3');
malateGraph.link('C2', 'O2');
malateGraph.link('C2', 'H2');
malateGraph.link('O2', 'HO2');
malateGraph.link('C3', 'C4');
malateGraph.link('C3', 'H3a');
malateGraph.link('C3', 'H3b');
carboxyl(malateGraph, 'C1', 180, 'O1', 'O1b');
carboxyl(malateGraph, 'C4', 0, 'O4', 'O4b');

export const malate = species('malate', 'malate', 'malate', 'C4H4O5', -2, malateGraph);

const co2Graph = graph();
co2Graph.put('C', 'C', at(0, 0), { role: 'carbon' });
co2Graph.put('Oa', 'O', polar(at(0, 0), 180), { role: 'oxygen' });
co2Graph.put('Ob', 'O', polar(at(0, 0), 0), { role: 'oxygen' });
co2Graph.link('C', 'Oa', 2);
co2Graph.link('C', 'Ob', 2);

export const co2 = species('co2', 'carbon dioxide', 'CO₂', 'CO2', 0, co2Graph, {
  family: 'gas',
  label: 'CO₂',
});

function quinone(id, name, short, formula, hydrogens) {
  const g = graph();
  g.put('body', 'C', at(0, 0), { body: true, role: 'ubiquinone' });
  if (hydrogens) {
    g.put('Ha', 'H', polar(at(0, 0), 30), { hydride: true, role: 'hydrogen' });
    g.put('Hb', 'H', polar(at(0, 0), 150), { hydride: true, role: 'hydrogen' });
    g.link('body', 'Ha');
    g.link('body', 'Hb');
  }
  return species(id, name, short, formula, 0, g, {
    family: 'carrier',
    carrier: { label: 'Q' },
    ecount: hydrogens ? 2 : 0,
  });
}

export const q = quinone('q', 'ubiquinone', 'Q', 'C', false);
export const qh2 = quinone('qh2', 'ubiquinol', 'QH₂', 'CH2', true);

function flavin(id, name, short, formula, hydrogens) {
  const g = graph();
  g.put('body', 'C', at(0, 0), { body: true, role: 'FAD' });
  if (hydrogens) {
    g.put('Ha', 'H', polar(at(0, 0), 30), { hydride: true, role: 'hydrogen' });
    g.put('Hb', 'H', polar(at(0, 0), 150), { hydride: true, role: 'hydrogen' });
    g.link('body', 'Ha');
    g.link('body', 'Hb');
  }
  return species(id, name, short, formula, 0, g, {
    family: 'carrier',
    carrier: { label: 'FAD' },
    ecount: hydrogens ? 2 : 0,
  });
}

export const fad = flavin('fad', 'FAD', 'FAD', 'C', false);
export const fadh2 = flavin('fadh2', 'FADH₂', 'FADH₂', 'CH2', true);
