// Pyruvate oxidation, the citric acid cycle, and the respiratory chain.
// Succinyl-CoA synthetase makes ATP here, not GTP. Fumarase has two maps
// because succinate is symmetric; the engine picks one with the world seed.

const fumaraseMapA = {
  'fum.H2': 'mal.H2',
  'fum.H3': 'mal.H3a',
  'water.O': 'mal.O2',
  'water.Ha': 'mal.HO2',
  'water.Hb': 'mal.H3b',
};

const fumaraseMapB = {
  'fum.C3': 'mal.C2',
  'fum.H3': 'mal.H2',
  'fum.C2': 'mal.C3',
  'fum.H2': 'mal.H3a',
  'fum.C4': 'mal.C1',
  'fum.O4': 'mal.O1',
  'fum.O4b': 'mal.O1b',
  'fum.C1': 'mal.C4',
  'fum.O1': 'mal.O4',
  'fum.O1b': 'mal.O4b',
  'water.O': 'mal.O2',
  'water.Ha': 'mal.HO2',
  'water.Hb': 'mal.H3b',
};

export const pdh = {
  id: 'pdh',
  enzyme: 'Pyruvate dehydrogenase',
  short: 'PDH',
  phase: 'oxidation',
  blurb: 'Pyruvate loses its carboxylate as CO₂. The rest becomes acetyl-CoA.',
  co2: 1,
  enew: { nadh: 'pyr.C2' },
  in: { pyr: 'pyruvate', coa: 'coa', nad: 'nad' },
  out: { acetyl: 'acetylcoa', co2: 'co2', nadh: 'nadh' },
  map: {
    'coa.H': 'nadh.H',
    'pyr.C1': 'co2.C',
    'pyr.O1': 'co2.Oa',
    'pyr.O1b': 'co2.Ob',
    'pyr.C2': 'acetyl.Cc',
    'pyr.O2': 'acetyl.Oc',
    'pyr.C3': 'acetyl.Cm',
    'pyr.H3a': 'acetyl.Hm1',
    'pyr.H3b': 'acetyl.Hm2',
    'pyr.H3c': 'acetyl.Hm3',
    'coa.body': 'acetyl.body',
    'coa.S': 'acetyl.S',
    'nad.body': 'nadh.body',
  },
  ledger: { nadh: 1 },
};

export const citrateSynthase = {
  id: 'cs',
  enzyme: 'Citrate synthase',
  short: 'CS',
  phase: 'cycle',
  blurb: 'Acetyl-CoA condenses with oxaloacetate. The new C–C bond starts the cycle.',
  water: -1,
  in: { acetyl: 'acetylcoa', oaa: 'oaa', water: 'water' },
  out: { cit: 'citrate', coa: 'coa', h: 'proton' },
  map: {
    'oaa.C2': 'cit.C3',
    'oaa.C1': 'cit.C6',
    'oaa.O1': 'cit.O6',
    'oaa.O1b': 'cit.O6b',
    'oaa.C3': 'cit.C2',
    'oaa.H3a': 'cit.H2a',
    'oaa.H3b': 'cit.H2b',
    'oaa.C4': 'cit.C1',
    'oaa.O4': 'cit.O1',
    'oaa.O4b': 'cit.O1b',
    'oaa.O2': 'cit.O3',
    'acetyl.Cm': 'cit.C4',
    'acetyl.Hm1': 'cit.H4a',
    'acetyl.Hm2': 'cit.H4b',
    'acetyl.Hm3': 'h.H',
    'acetyl.Cc': 'cit.C5',
    'acetyl.Oc': 'cit.O5',
    'water.O': 'cit.O5b',
    'water.Ha': 'cit.HO3',
    'water.Hb': 'coa.H',
    'acetyl.body': 'coa.body',
    'acetyl.S': 'coa.S',
  },
};

export const aconitase = {
  id: 'aconitase',
  enzyme: 'Aconitase',
  short: 'ACO',
  phase: 'cycle',
  blurb: 'The hydroxyl moves onto the oxaloacetate arm of citrate.',
  in: { cit: 'citrate' },
  out: { iso: 'isocitrate' },
  map: {},
};

export const idh = {
  id: 'idh',
  enzyme: 'Isocitrate dehydrogenase',
  short: 'IDH',
  phase: 'cycle',
  blurb: 'Isocitrate is oxidized and loses the carboxylate that came from oxaloacetate.',
  co2: 1,
  enew: { nadh: 'iso.C2' },
  in: { iso: 'isocitrate', nad: 'nad' },
  out: { akg: 'akg', co2: 'co2', nadh: 'nadh' },
  map: {
    'iso.C6': 'co2.C',
    'iso.O6': 'co2.Oa',
    'iso.O6b': 'co2.Ob',
    'iso.H2a': 'nadh.H',
    'iso.O3': 'akg.O2',
    'iso.H2b': 'akg.H3a',
    'iso.HO3': 'akg.H3b',
    'iso.C2': 'akg.C2',
    'iso.C3': 'akg.C3',
    'iso.C4': 'akg.C4',
    'iso.H4a': 'akg.H4a',
    'iso.H4b': 'akg.H4b',
    'iso.C5': 'akg.C5',
    'iso.O5': 'akg.O5',
    'iso.O5b': 'akg.O5b',
    'iso.C1': 'akg.C1',
    'iso.O1': 'akg.O1',
    'iso.O1b': 'akg.O1b',
    'nad.body': 'nadh.body',
  },
  ledger: { nadh: 1 },
};

export const akgdh = {
  id: 'akgdh',
  enzyme: 'α-Ketoglutarate dehydrogenase',
  short: 'α-KGDH',
  phase: 'cycle',
  blurb: 'The second CO₂ leaves. It is the other carboxylate of the oxaloacetate that took this acetyl in.',
  co2: 1,
  enew: { nadh: 'akg.C2' },
  in: { akg: 'akg', nad: 'nad', coa: 'coa' },
  out: { suc: 'succinyl', co2: 'co2', nadh: 'nadh' },
  map: {
    'coa.H': 'nadh.H',
    'akg.C1': 'co2.C',
    'akg.O1': 'co2.Oa',
    'akg.O1b': 'co2.Ob',
    'akg.C2': 'suc.C1',
    'akg.O2': 'suc.O1',
    'akg.C3': 'suc.C2',
    'akg.H3a': 'suc.H2a',
    'akg.H3b': 'suc.H2b',
    'akg.C4': 'suc.C3',
    'akg.H4a': 'suc.H3a',
    'akg.H4b': 'suc.H3b',
    'akg.C5': 'suc.C4',
    'akg.O5': 'suc.O4',
    'akg.O5b': 'suc.O4b',
    'coa.body': 'suc.body',
    'coa.S': 'suc.S',
    'nad.body': 'nadh.body',
  },
  ledger: { nadh: 1 },
};

export const scs = {
  id: 'scs',
  atp: 1,
  enzyme: 'Succinyl-CoA synthetase',
  short: 'SCS',
  phase: 'cycle',
  blurb: 'The energy of the thioester bond is used to make one ATP. In many tissues this enzyme makes GTP instead.',
  in: { suc: 'succinyl', adp: 'adp', pi: 'pi' },
  out: { succinate: 'succinate', atp: 'atp', coa: 'coa' },
  map: {
    'suc.C1': 'succinate.C1',
    'suc.O1': 'succinate.O1',
    'pi.O': 'succinate.O1b',
    'suc.C2': 'succinate.C2',
    'suc.H2a': 'succinate.H2a',
    'suc.H2b': 'succinate.H2b',
    'suc.C3': 'succinate.C3',
    'suc.H3a': 'succinate.H3a',
    'suc.H3b': 'succinate.H3b',
    'suc.C4': 'succinate.C4',
    'suc.O4': 'succinate.O4',
    'suc.O4b': 'succinate.O4b',
    'pi.H': 'coa.H',
    'suc.body': 'coa.body',
    'suc.S': 'coa.S',
    'pi.P': 'atp.P2',
    'pi.D': 'atp.D2',
    'pi.M': 'atp.M2',
    'pi.N': 'atp.E',
    'adp.E': 'atp.B2',
  },
};

export const sdh = {
  id: 'sdh',
  enzyme: 'Succinate dehydrogenase',
  short: 'SDH',
  phase: 'cycle',
  blurb: 'Succinate gives two hydrogens, and their electrons, to the FAD bound inside. This enzyme is Complex II of the chain.',
  enew: { fadh2: 'succinate.C2' },
  in: { succinate: 'succinate', fad: 'fad' },
  out: { fum: 'fumarate', fadh2: 'fadh2' },
  map: {
    'succinate.H2a': 'fadh2.Ha',
    'succinate.H3a': 'fadh2.Hb',
    'succinate.H2b': 'fum.H2',
    'succinate.H3b': 'fum.H3',
    'fad.body': 'fadh2.body',
  },
  ledger: { fadh2: 1 },
};

export const fumarase = {
  id: 'fumarase',
  enzyme: 'Fumarase',
  short: 'FUM',
  phase: 'cycle',
  blurb: 'Water adds across the double bond. Either carbon can receive the hydroxyl.',
  water: -1,
  in: { fum: 'fumarate', water: 'water' },
  out: { mal: 'malate' },
  map: fumaraseMapA,
  maps: [fumaraseMapA, fumaraseMapB],
};

export const fumaraseAlt = {
  ...fumarase,
  id: 'fumarase-alt',
  map: fumaraseMapB,
  maps: undefined,
};

export const mdh = {
  id: 'mdh',
  enzyme: 'Malate dehydrogenase',
  short: 'MDH',
  phase: 'cycle',
  blurb: 'Malate is oxidized back to oxaloacetate, and the cycle can turn again.',
  enew: { nadh: 'mal.C2' },
  in: { mal: 'malate', nad: 'nad' },
  out: { oaa: 'oaa', nadh: 'nadh', h: 'proton' },
  map: {
    'mal.H2': 'nadh.H',
    'mal.HO2': 'h.H',
    'nad.body': 'nadh.body',
  },
  ledger: { nadh: 1 },
};

export const shuttle = {
  id: 'shuttle',
  enzyme: 'NADH shuttle',
  short: 'Shuttle',
  phase: 'shuttle',
  blurb: 'The hydride of cytosolic NADH is passed to a matrix NAD⁺. The NADH molecule itself stays outside.',
  in: { cytNadh: 'nadh', matNad: 'nad' },
  out: { cytNad: 'nad', matNadh: 'nadh' },
  emap: { 'cytNadh.0': 'matNadh.0', 'cytNadh.1': 'matNadh.1' },
  map: {
    'cytNadh.H': 'matNadh.H',
    'cytNadh.body': 'cytNad.body',
    'matNad.body': 'matNadh.body',
  },
};

export const complex1 = {
  id: 'complex1',
  // The hydride's nucleus stays behind while its electrons go on: a tag splits here.
  split: true,
  enzyme: 'Complex I',
  short: 'I',
  phase: 'chain',
  blurb: 'NADH hands two electrons to ubiquinone. The hydride’s proton stays in the matrix, and four protons are pumped across.',
  pump: 4,
  in: { nadh: 'nadh', q: 'q', h1: 'proton', h2: 'proton' },
  out: { nad: 'nad', qh2: 'qh2', h: 'proton' },
  map: {
    'nadh.H': 'h.H',
    'h1.H': 'qh2.Ha',
    'h2.H': 'qh2.Hb',
    'nadh.body': 'nad.body',
    'q.body': 'qh2.body',
  },
  emap: { 'nadh.0': 'qh2.0', 'nadh.1': 'qh2.1' },
};

export const qSite = {
  id: 'qsite',
  enzyme: 'Complex II',
  short: 'II',
  phase: 'chain',
  blurb: 'The FAD inside Complex II passes its two electrons to ubiquinone. Complex II pumps no protons.',
  in: { fadh2: 'fadh2', q: 'q' },
  out: { fad: 'fad', qh2: 'qh2' },
  map: {
    'fadh2.Ha': 'qh2.Ha',
    'fadh2.Hb': 'qh2.Hb',
    'fadh2.body': 'fad.body',
    'q.body': 'qh2.body',
  },
  emap: { 'fadh2.0': 'qh2.0', 'fadh2.1': 'qh2.1' },
};

export const complex3 = {
  id: 'complex3',
  enzyme: 'Complex III',
  short: 'III',
  phase: 'chain',
  blurb: 'Ubiquinol gives up its two protons to the intermembrane space and its two electrons to two cytochrome c, one each. Two more protons are pumped.',
  pump: 2,
  in: { qh2: 'qh2', cytA: 'cytc', cytB: 'cytc' },
  out: { q: 'q', cytA: 'cytcr', cytB: 'cytcr', hA: 'proton', hB: 'proton' },
  map: {
    'qh2.Ha': 'hA.H',
    'qh2.Hb': 'hB.H',
    'qh2.body': 'q.body',
    'cytA.body': 'cytA.body',
    'cytB.body': 'cytB.body',
  },
  emap: { 'qh2.0': 'cytA.0', 'qh2.1': 'cytB.0' },
};

export const cytDeliver = {
  id: 'cytdeliver',
  enzyme: 'Complex IV',
  short: 'IV',
  phase: 'chain',
  blurb: 'Cytochrome c transfers one electron to Complex IV and returns for another.',
  in: { cyt: 'cytcr' },
  out: { cyt: 'cytc', e: 'electron' },
  map: {},
  emap: { 'cyt.0': 'e.0' },
};

export const oxidase = {
  id: 'oxidase',
  enzyme: 'Complex IV',
  short: 'IV',
  phase: 'chain',
  blurb: 'With four electrons gathered, O₂ and four protons become two water molecules, so both oxygens end up in water. Four more protons are pumped.',
  water: 2,
  pump: 4,
  acceptor: 'o2',
  in: {
    e1: 'electron', e2: 'electron', e3: 'electron', e4: 'electron',
    o2: 'oxygen', h1: 'proton', h2: 'proton', h3: 'proton', h4: 'proton',
  },
  out: { waterA: 'water', waterB: 'water' },
  map: {
    'o2.Oa': 'waterA.O',
    'o2.Ob': 'waterB.O',
    'h1.H': 'waterA.Ha',
    'h2.H': 'waterA.Hb',
    'h3.H': 'waterB.Ha',
    'h4.H': 'waterB.Hb',
  },
  eend: { 'e1.0': 'waterA', 'e2.0': 'waterA', 'e3.0': 'waterB', 'e4.0': 'waterB' },
};

export const synthase = {
  id: 'synthase',
  atp: 1,
  // Oxidative phosphorylation. A chloroplast's synthase is photophosphorylation.
  atpKind: 'ox',
  enzyme: 'ATP synthase',
  short: 'ATP synthase',
  phase: 'chain',
  blurb: 'Four protons flow down through the rotor and turn it. The rod twists the catalytic knob, which joins ADP and phosphate into ATP.',
  water: 1,
  pump: 4,
  in: { adp: 'adp', pi: 'pi', h: 'proton' },
  out: { atp: 'atp', water: 'water' },
  map: {
    'adp.E': 'atp.B2',
    'pi.P': 'atp.P2',
    'pi.D': 'atp.D2',
    'pi.M': 'atp.M2',
    'pi.N': 'atp.E',
    'pi.O': 'water.O',
    'pi.H': 'water.Ha',
    'h.H': 'water.Hb',
  },
};

function carry(map, from, to, speciesAtoms) {
  for (const label of speciesAtoms) map[`${from}.${label}`] = `${to}.${label}`;
  return map;
}

const atpLabels = ['body', 'B0', 'P0', 'D0', 'M0', 'B1', 'P1', 'D1', 'M1', 'B2', 'P2', 'D2', 'M2', 'E'];
const adpLabels = ['body', 'B0', 'P0', 'D0', 'M0', 'B1', 'P1', 'D1', 'M1', 'E'];
const piLabels = ['P', 'D', 'M', 'N', 'O', 'H'];

export const translocase = {
  id: 'ant',
  enzyme: 'ATP–ADP translocase',
  short: 'ANT',
  phase: 'transport',
  blurb: 'One ATP leaves the matrix for each ADP that comes in. A phosphate carrier beside it brings phosphate in.',
  in: { atpIn: 'atp', adpIn: 'adp', piIn: 'pi' },
  out: { atpOut: 'atp', adpOut: 'adp', piOut: 'pi' },
  map: carry(carry(carry({}, 'atpIn', 'atpOut', atpLabels), 'adpIn', 'adpOut', adpLabels), 'piIn', 'piOut', piLabels),
};

export const RESPIRATION = [
  pdh,
  citrateSynthase,
  aconitase,
  idh,
  akgdh,
  scs,
  sdh,
  fumarase,
  mdh,
  shuttle,
  complex1,
  qSite,
  complex3,
  cytDeliver,
  oxidase,
  synthase,
  translocase,
];
