// Atom maps for the ten steps. Labels that stay put are filled in by
// compileMap. The spelled-out pairs are the atoms that change molecule.

const atpToAdp = {
  'atp.B2': 'adp.E',
};

export const hexokinase = {
  id: 'hexokinase',
  atp: -1,
  enzyme: 'Hexokinase',
  short: 'HK',
  phase: 'investment',
  blurb: 'A phosphate from ATP attaches to carbon 6 of glucose.',
  in: { glc: 'glucose', atp: 'atp' },
  out: { g6p: 'g6p', adp: 'adp', h: 'proton' },
  map: {
    'glc.HO6': 'h.H',
    ...atpToAdp,
    'atp.P2': 'g6p.P6',
    'atp.D2': 'g6p.D6',
    'atp.M2': 'g6p.M6',
    'atp.E': 'g6p.E6',
  },
};

export const phosphoglucoseIsomerase = {
  id: 'pgi',
  enzyme: 'Phosphoglucose isomerase',
  short: 'PGI',
  phase: 'investment',
  blurb: 'Glucose 6-phosphate rearranges into fructose 6-phosphate.',
  in: { g6p: 'g6p' },
  out: { f6p: 'f6p' },
  map: {},
};

export const phosphofructokinase = {
  id: 'pfk',
  atp: -1,
  enzyme: 'Phosphofructokinase',
  short: 'PFK',
  phase: 'investment',
  blurb: 'A second phosphate from ATP attaches to carbon 1.',
  in: { f6p: 'f6p', atp: 'atp' },
  out: { fbp: 'fbp', adp: 'adp', h: 'proton' },
  map: {
    'f6p.HO2': 'h.H',
    ...atpToAdp,
    'atp.P2': 'fbp.P1',
    'atp.D2': 'fbp.D1',
    'atp.M2': 'fbp.M1',
    'atp.E': 'fbp.E1',
  },
};

export const aldolase = {
  id: 'aldolase',
  enzyme: 'Aldolase',
  short: 'ALD',
  phase: 'investment',
  blurb: 'The six-carbon sugar splits into DHAP and glyceraldehyde 3-phosphate.',
  in: { fbp: 'fbp' },
  out: { dhap: 'dhap', g3p: 'g3p' },
  map: {
    'fbp.C1': 'dhap.C3',
    'fbp.H1': 'dhap.H3a',
    'fbp.H2': 'dhap.H3b',
    'fbp.O1': 'dhap.O3',
    'fbp.P1': 'dhap.P3',
    'fbp.D1': 'dhap.D3',
    'fbp.M1': 'dhap.M3',
    'fbp.E1': 'dhap.E3',
    'fbp.C2': 'dhap.C2',
    'fbp.O2': 'dhap.O2',
    'fbp.C3': 'dhap.C1',
    'fbp.O3': 'dhap.O1',
    'fbp.H3': 'dhap.H1a',
    'fbp.HO3': 'dhap.HO1',
    'fbp.HO4': 'dhap.H1b',
    'fbp.C4': 'g3p.C1',
    'fbp.O4': 'g3p.O1',
    'fbp.H4': 'g3p.H1',
    'fbp.C5': 'g3p.C2',
    'fbp.O5': 'g3p.O2',
    'fbp.HO5': 'g3p.HO2',
    'fbp.H5': 'g3p.H2',
    'fbp.C6': 'g3p.C3',
    'fbp.O6': 'g3p.O3',
    'fbp.H6a': 'g3p.H3a',
    'fbp.H6b': 'g3p.H3b',
    'fbp.P6': 'g3p.P3',
    'fbp.D6': 'g3p.D3',
    'fbp.M6': 'g3p.M3',
    'fbp.E6': 'g3p.E3',
  },
};

export const triosePhosphateIsomerase = {
  id: 'tpi',
  enzyme: 'Triose phosphate isomerase',
  short: 'TIM',
  phase: 'investment',
  blurb: 'Triose phosphate isomerase turns DHAP into glyceraldehyde 3-phosphate.',
  in: { dhap: 'dhap' },
  out: { g3p: 'g3p' },
  map: {
    'dhap.H1a': 'g3p.H1',
    'dhap.H1b': 'g3p.H2',
    'dhap.HO1': 'g3p.HO2',
  },
};

export const glyceraldehydePhosphateDehydrogenase = {
  id: 'gapdh',
  enzyme: 'Glyceraldehyde 3-phosphate dehydrogenase',
  short: 'GAPDH',
  phase: 'payoff',
  blurb: 'Carbon 1 is oxidized and gains a phosphate. Its hydrogen leaves on NADH.',
  enew: { nadh: 'g3p.C1' },
  in: { g3p: 'g3p', nad: 'nad', pi: 'pi' },
  out: { bpg: 'bpg', nadh: 'nadh', h: 'proton' },
  map: {
    'g3p.H1': 'nadh.H',
    'nad.body': 'nadh.body',
    'pi.M': 'bpg.O1p',
    'pi.P': 'bpg.P1',
    'pi.D': 'bpg.D1',
    'pi.N': 'bpg.M1',
    'pi.O': 'bpg.E1',
    'pi.H': 'h.H',
  },
  ledger: { nadh: 1 },
};

export const phosphoglycerateKinase = {
  id: 'pgk',
  atp: 1,
  enzyme: 'Phosphoglycerate kinase',
  short: 'PGK',
  phase: 'payoff',
  blurb: 'The phosphate on carbon 1 transfers to ADP, and that makes ATP.',
  in: { bpg: 'bpg', adp: 'adp' },
  out: { pg3: 'pg3', atp: 'atp' },
  map: {
    'bpg.O1p': 'pg3.O1b',
    'bpg.P1': 'atp.P2',
    'bpg.D1': 'atp.D2',
    'bpg.M1': 'atp.M2',
    'bpg.E1': 'atp.E',
    'adp.E': 'atp.B2',
  },
};

export const phosphoglycerateMutase = {
  id: 'pgm',
  enzyme: 'Phosphoglycerate mutase',
  short: 'PGM',
  phase: 'payoff',
  blurb: 'The phosphate moves from carbon 3 to carbon 2.',
  in: { pg3: 'pg3' },
  out: { pg2: 'pg2' },
  map: {},
};

export const enolase = {
  id: 'enolase',
  enzyme: 'Enolase',
  short: 'ENO',
  phase: 'payoff',
  blurb: 'A molecule of water leaves, and a double bond forms.',
  water: 1,
  in: { pg2: 'pg2' },
  out: { pep: 'pep', water: 'water' },
  map: {
    'pg2.O3': 'water.O',
    'pg2.HO2': 'water.Ha',
    'pg2.H2': 'water.Hb',
  },
};

export const pyruvateKinase = {
  id: 'pk',
  atp: 1,
  enzyme: 'Pyruvate kinase',
  short: 'PK',
  phase: 'payoff',
  blurb: 'The phosphate transfers to ADP, making ATP, and pyruvate is left behind.',
  in: { pep: 'pep', adp: 'adp', h: 'proton' },
  out: { pyr: 'pyruvate', atp: 'atp' },
  map: {
    'pep.P3': 'atp.P2',
    'pep.D3': 'atp.D2',
    'pep.M3': 'atp.M2',
    'pep.E3': 'atp.E',
    'adp.E': 'atp.B2',
    'h.H': 'pyr.H3c',
  },
};

export const cellWork = {
  id: 'cell-work',
  enzyme: 'Cell work',
  short: 'Work',
  phase: 'payoff',
  blurb: 'The cell uses ATP for its work: water hydrolyses the terminal phosphate, and ADP and phosphate return to be rephosphorylated.',
  water: -1,
  in: { atp: 'atp', water: 'water' },
  out: { adp: 'adp', pi: 'pi', h: 'proton' },
  map: {
    'atp.B2': 'adp.E',
    'atp.P2': 'pi.P',
    'atp.D2': 'pi.D',
    'atp.M2': 'pi.M',
    'atp.E': 'pi.N',
    'water.O': 'pi.O',
    'water.Ha': 'pi.H',
    'water.Hb': 'h.H',
  },
};

export const GLYCOLYSIS = [
  hexokinase,
  phosphoglucoseIsomerase,
  phosphofructokinase,
  aldolase,
  triosePhosphateIsomerase,
  glyceraldehydePhosphateDehydrogenase,
  phosphoglycerateKinase,
  phosphoglycerateMutase,
  enolase,
  pyruvateKinase,
];
