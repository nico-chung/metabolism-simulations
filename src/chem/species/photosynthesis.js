import { addHydroxyl, addPhosphate, at, degrees, graph, polar, zigzag } from '../layout.js';

// Species of the chloroplast (M6 plan §3.1, §3.2). The carriers are
// abbreviated bodies like their respiration counterparts: NADP like NAD,
// plastoquinone like ubiquinone, plastocyanin and ferredoxin like
// cytochrome c, a body whose charge drops by one while it holds an electron.
// The Calvin cycle's sugars are drawn open-chain from one builder.

function carrier(id, name, short, label, charge, extra = {}) {
  const g = graph();
  g.put('body', 'C', at(0, 0), { body: true, role: name, ...(charge ? { charge } : {}) });
  return {
    id,
    name,
    short,
    label: short,
    formula: 'C',
    charge,
    family: 'carrier',
    carrier: { label },
    ecount: 0,
    atoms: g.atoms,
    bonds: g.bonds,
    ...extra,
  };
}

export const nadp = carrier('nadp', 'NADP⁺', 'NADP⁺', 'NADP', 1);

export const nadph = {
  id: 'nadph',
  name: 'NADPH',
  short: 'NADPH',
  label: 'NADPH',
  formula: 'CH',
  charge: 0,
  family: 'carrier',
  carrier: { label: 'NADP' },
  ecount: 2,
  atoms: {
    body: { el: 'C', x: 0, y: 0, body: true, role: 'NADP' },
    H: { el: 'H', x: 1, y: 0, hydride: true, role: 'hydride' },
  },
  bonds: [['body', 'H', 1]],
};

function plastoquinone(id, name, short, formula, hydrogens) {
  const g = graph();
  g.put('body', 'C', at(0, 0), { body: true, role: 'plastoquinone' });
  if (hydrogens) {
    g.put('Ha', 'H', polar(at(0, 0), 30), { hydride: true, role: 'hydrogen' });
    g.put('Hb', 'H', polar(at(0, 0), 150), { hydride: true, role: 'hydrogen' });
    g.link('body', 'Ha');
    g.link('body', 'Hb');
  }
  return {
    id,
    name,
    short,
    label: short,
    formula,
    charge: 0,
    family: 'carrier',
    carrier: { label: 'PQ' },
    ecount: hydrogens ? 2 : 0,
    atoms: g.atoms,
    bonds: g.bonds,
  };
}

export const pq = plastoquinone('pq', 'plastoquinone', 'PQ', 'C', false);
export const pqh2 = plastoquinone('pqh2', 'plastoquinol', 'PQH₂', 'CH2', true);

// One-electron carriers: the oxidized body carries +1, the reduced one 0.
export const pc = carrier('pc', 'plastocyanin', 'PC', 'PC', 1);
export const pcr = { ...carrier('pcr', 'reduced plastocyanin', 'PC', 'PC', 0), ecount: 1 };
export const fd = carrier('fd', 'ferredoxin', 'Fd', 'Fd', 1);
export const fdr = { ...carrier('fdr', 'reduced ferredoxin', 'Fd', 'Fd', 0), ecount: 1 };

// Open-chain sugar phosphates --------------------------------------------------
//
// Each carbon is one of: CHO (an aldehyde end), CH2OH, CH2OP (a phosphate
// end), CO (a ketone) or CHOH. Labels: C{n}; its oxygen O{n}; a lone C–H
// H{n}, a CH₂'s H{n}a and H{n}b; a hydroxyl H HO{n}; a phosphate P{n}, D{n},
// M{n}, E{n}.

const ROLE = {
  CHO: 'aldehyde carbon',
  CO: 'ketone carbon',
};

function sugarGraph(groups) {
  const g = graph();
  const carbons = zigzag(groups.length);
  const last = groups.length;
  groups.forEach((kind, i) => {
    const n = i + 1;
    g.put(`C${n}`, 'C', carbons[i], { n, role: ROLE[kind] ?? `carbon ${n}` });
    if (i) g.link(`C${i}`, `C${n}`);
  });
  groups.forEach((kind, i) => {
    const n = i + 1;
    const C = `C${n}`;
    const point = carbons[i];
    const up = n % 2 === 0;
    if (n === 1 || n === last) {
      const neighbour = carbons[n === 1 ? 1 : last - 2];
      const incoming = degrees(point, neighbour);
      if (kind === 'CHO') {
        const away = n === 1 ? 210 : -30;
        g.put(`O${n}`, 'O', polar(point, away), { role: 'carbonyl oxygen' });
        g.put(`H${n}`, 'H', polar(point, 90), { role: 'aldehyde hydrogen' });
        g.link(C, `O${n}`, 2);
        g.link(C, `H${n}`);
        return;
      }
      g.put(`O${n}`, 'O', polar(point, incoming + 180), { role: kind === 'CH2OP' ? `bridging oxygen on carbon ${n}` : `hydroxyl oxygen on carbon ${n}` });
      g.put(`H${n}a`, 'H', polar(point, incoming + 125), { role: `hydrogen on carbon ${n}` });
      g.put(`H${n}b`, 'H', polar(point, incoming - 125), { role: `hydrogen on carbon ${n}` });
      g.link(C, `O${n}`);
      g.link(C, `H${n}a`);
      g.link(C, `H${n}b`);
      if (kind === 'CH2OP') addPhosphate(g, `O${n}`, C, { p: `P${n}`, oxo: `D${n}`, minus: `M${n}`, end: `E${n}` });
      else addHydroxyl(g, `O${n}`, C, `HO${n}`, n === 1 ? 48 : -48, `hydroxyl hydrogen on carbon ${n}`);
      return;
    }
    if (kind === 'CO') {
      g.put(`O${n}`, 'O', polar(point, up ? -90 : 90), { role: 'carbonyl oxygen' });
      g.link(C, `O${n}`, 2);
      return;
    }
    g.put(`O${n}`, 'O', polar(point, up ? -90 : 90), { role: `hydroxyl oxygen on carbon ${n}` });
    g.put(`H${n}`, 'H', polar(point, up ? 90 : -90), { role: `hydrogen on carbon ${n}` });
    g.link(C, `O${n}`);
    g.link(C, `H${n}`);
    addHydroxyl(g, `O${n}`, C, `HO${n}`, up ? -42 : 42, `hydroxyl hydrogen on carbon ${n}`);
  });
  return g;
}

function sugar(id, name, short, formula, charge, groups) {
  const built = sugarGraph(groups);
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

// Photorespiration (M7a, M6 plan §3.4) ------------------------------------------
//
// 2-Phosphoglycolate, ⁻OOC–CH₂–OPO₃²⁻, and glycolate, ⁻OOC–CH₂–OH. C-1 is
// the carboxylate; C-2 carries the phosphate or the hydroxyl.

function glycolateGraph(phosphate) {
  const g = graph();
  const [c1, c2] = zigzag(2);
  g.put('C1', 'C', c1, { n: 1, role: 'carboxylate carbon' });
  g.put('C2', 'C', c2, { n: 2, role: 'carbon 2' });
  g.link('C1', 'C2');
  const incoming = degrees(c1, c2);
  g.put('O1', 'O', polar(c1, incoming + 130), { role: 'carbonyl oxygen' });
  g.put('O1b', 'O', polar(c1, incoming - 130), { charge: -1, role: 'carboxylate oxygen' });
  g.link('C1', 'O1', 2);
  g.link('C1', 'O1b');
  const back = degrees(c2, c1);
  g.put('O2', 'O', polar(c2, back + 180), { role: phosphate ? 'bridging oxygen' : 'hydroxyl oxygen' });
  g.put('H2a', 'H', polar(c2, back + 125), { role: 'hydrogen on carbon 2' });
  g.put('H2b', 'H', polar(c2, back - 125), { role: 'hydrogen on carbon 2' });
  g.link('C2', 'O2');
  g.link('C2', 'H2a');
  g.link('C2', 'H2b');
  if (phosphate) addPhosphate(g, 'O2', 'C2', { p: 'P2', oxo: 'D2', minus: 'M2', end: 'E2' });
  else addHydroxyl(g, 'O2', 'C2', 'HO2', -48, 'hydroxyl hydrogen');
  return g;
}

function acid(id, name, short, formula, charge, built) {
  return { id, name, short, label: short, formula, charge, family: 'sugar', atoms: built.atoms, bonds: built.bonds };
}

export const pglycolate = acid('pglycolate', '2-phosphoglycolate', '2-PGly', 'C2H2O6P', -3, glycolateGraph(true));
export const glycolate = acid('glycolate', 'glycolate', 'glycolate', 'C2H3O3', -1, glycolateGraph(false));

export const rubp = sugar('rubp', 'ribulose 1,5-bisphosphate', 'RuBP', 'C5H8O11P2', -4, ['CH2OP', 'CO', 'CHOH', 'CHOH', 'CH2OP']);
export const e4p = sugar('e4p', 'erythrose 4-phosphate', 'E4P', 'C4H7O7P', -2, ['CHO', 'CHOH', 'CHOH', 'CH2OP']);
export const xu5p = sugar('xu5p', 'xylulose 5-phosphate', 'Xu5P', 'C5H9O8P', -2, ['CH2OH', 'CO', 'CHOH', 'CHOH', 'CH2OP']);
export const ru5p = sugar('ru5p', 'ribulose 5-phosphate', 'Ru5P', 'C5H9O8P', -2, ['CH2OH', 'CO', 'CHOH', 'CHOH', 'CH2OP']);
export const r5p = sugar('r5p', 'ribose 5-phosphate', 'R5P', 'C5H9O8P', -2, ['CHO', 'CHOH', 'CHOH', 'CHOH', 'CH2OP']);
export const sbp = sugar('sbp', 'sedoheptulose 1,7-bisphosphate', 'SBP', 'C7H12O13P2', -4, ['CH2OP', 'CO', 'CHOH', 'CHOH', 'CHOH', 'CHOH', 'CH2OP']);
export const s7p = sugar('s7p', 'sedoheptulose 7-phosphate', 'S7P', 'C7H13O10P', -2, ['CH2OH', 'CO', 'CHOH', 'CHOH', 'CHOH', 'CHOH', 'CH2OP']);
