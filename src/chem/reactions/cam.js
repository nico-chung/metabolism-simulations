// CAM's own chemistry (M7b, M6 plan §3.6). By night, stored glucose is
// broken down by glycolysis as far as PEP, which supplies both the PEP
// and the NADH that fix CO₂ into malate; by day, malic enzyme releases
// that CO₂ beside RuBisCO, and the pyruvate goes back to sugar as PEP and
// then 3-phosphoglycerate. PEP carboxylase, malic enzyme, PPDK and the
// dicarboxylate transporter are C4's (c4.js).

import { getSpecies } from '../species/index.js';
import { enolase, phosphoglycerateMutase } from './glycolysis.js';
import { invert } from './photosynthesis.js';

// Malate dehydrogenase in the cytosol, on NADH: the citric acid cycle's
// malate dehydrogenase run backwards, as C4's runs on NADPH.
export const mdhNad = {
  id: 'mdh-nad',
  enzyme: 'NAD-malate dehydrogenase',
  short: 'MDH',
  phase: 'pump',
  blurb: 'NADH from night glycolysis reduces oxaloacetate to malate, the acid the cell stores overnight.',
  in: { oaa: 'oaa', nadh: 'nadh', h: 'proton' },
  out: { mal: 'malate', nad: 'nad' },
  map: {
    'nadh.H': 'mal.H2',
    'h.H': 'mal.HO2',
    'nadh.body': 'nad.body',
  },
  eend: { 'nadh.0': 'mal', 'nadh.1': 'mal' },
  ehand: { 'nadh.0': 'mal.H2', 'nadh.1': 'mal.H2' },
};

// PEP to 3-phosphoglycerate by day: enolase and phosphoglycerate mutase
// run backwards (gluconeogenesis), so the pyruvate's carbons rejoin the
// Calvin cycle's reduction steps.
export const enolaseBack = invert(enolase, {
  id: 'enolase-back',
  phase: 'pump',
  blurb: 'Enolase adds water across PEP’s double bond: 2-phosphoglycerate.',
  more: { water: -1 },
});

export const pgmBack = invert(phosphoglycerateMutase, {
  id: 'pgm-back',
  phase: 'pump',
  blurb: 'Phosphoglycerate mutase moves the phosphate back to carbon 3: 3-phosphoglycerate.',
});

// The sugar exporter on the chloroplast envelope: glucose leaves the
// stroma unchanged.
export const glcOut = {
  id: 'glc-out',
  enzyme: 'Sugar exporter',
  short: 'Export',
  phase: 'export',
  blurb: 'Glucose from the starch grain leaves the chloroplast for the cytosol.',
  in: { glcIn: 'glucose' },
  out: { glcOut: 'glucose' },
  map: Object.fromEntries(Object.keys(getSpecies('glucose').atoms).map((label) => [`glcIn.${label}`, `glcOut.${label}`])),
};

// Night glycolysis, one compound station (D3): glucose + 2 NAD⁺ + 2 Pᵢ →
// 2 PEP + 2 NADH + 2 H₂O. Steps 1 to 9 of glycolysis, with 6 to 9 twice.
// The station keeps two adenosines of its own: hexokinase and
// phosphofructokinase turn them into ADP, and phosphoglycerate kinase
// turns them back, so no ATP is made or spent.
export const NIGHT_GLYCOLYSIS = [
  { reaction: 'hexokinase', bind: { in: { glc: 'glc', atp: 'atpA' }, out: { g6p: 'g6p', adp: 'atpA', h: 'h1' } } },
  { reaction: 'pgi', bind: { in: { g6p: 'g6p' }, out: { f6p: 'f6p' } } },
  { reaction: 'pfk', bind: { in: { f6p: 'f6p', atp: 'atpB' }, out: { fbp: 'fbp', adp: 'atpB', h: 'h2' } } },
  { reaction: 'aldolase', bind: { in: { fbp: 'fbp' }, out: { dhap: 'triB', g3p: 'triA' } } },
  { reaction: 'tpi', bind: { in: { dhap: 'triB' }, out: { g3p: 'triB' } } },
  { reaction: 'gapdh', bind: { in: { g3p: 'triA', nad: 'nadA', pi: 'piA' }, out: { bpg: 'triA', nadh: 'nadA', h: 'h3' } } },
  { reaction: 'gapdh', bind: { in: { g3p: 'triB', nad: 'nadB', pi: 'piB' }, out: { bpg: 'triB', nadh: 'nadB', h: 'h4' } } },
  { reaction: 'pgk', bind: { in: { bpg: 'triA', adp: 'atpA' }, out: { pg3: 'triA', atp: 'atpA' } } },
  { reaction: 'pgk', bind: { in: { bpg: 'triB', adp: 'atpB' }, out: { pg3: 'triB', atp: 'atpB' } } },
  { reaction: 'pgm', bind: { in: { pg3: 'triA' }, out: { pg2: 'triA' } } },
  { reaction: 'pgm', bind: { in: { pg3: 'triB' }, out: { pg2: 'triB' } } },
  { reaction: 'enolase', bind: { in: { pg2: 'triA' }, out: { pep: 'pepA', water: 'waterA' } } },
  { reaction: 'enolase', bind: { in: { pg2: 'triB' }, out: { pep: 'pepB', water: 'waterB' } } },
];

// PEP to 3-PG by day, one compound station.
export const PEP_TO_PG3 = [
  { reaction: 'enolase-back', bind: { in: { pep: 'pep', water: 'water' }, out: { pg2: 'pg' } } },
  { reaction: 'pgm-back', bind: { in: { pg2: 'pg' }, out: { pg3: 'pg' } } },
];

export const CAM = [mdhNad, enolaseBack, pgmBack, glcOut];
