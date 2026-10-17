// C4's CO₂ pump, NADP-malic enzyme type (maize, sugarcane) (M7a, M6 plan
// §3.5). PEP carboxylase fixes CO₂ in the mesophyll cytosol; the four-carbon
// acid crosses into the bundle sheath, where malic enzyme releases the same
// carbon beside RuBisCO; pyruvate goes back and is made into PEP again.

import { getSpecies } from '../species/index.js';

// A transporter moves a molecule unchanged: every atom keeps its label.
function carry(from, to, speciesId) {
  return Object.fromEntries(Object.keys(getSpecies(speciesId).atoms).map((label) => [`${from}.${label}`, `${to}.${label}`]));
}

// PEP³⁻ + CO₂ + H₂O → OAA²⁻ + Pᵢ + H⁺. CO₂'s carbon becomes OAA C-4 and its
// oxygens C-4's carboxylate; PEP's bridging oxygen becomes the ketone
// oxygen; water's oxygen goes to the phosphate (bicarbonate in reality,
// PLAN §8.9).
export const pepc = {
  id: 'pepc',
  enzyme: 'PEP carboxylase',
  short: 'PEPC',
  phase: 'pump',
  blurb: 'CO₂ joins phosphoenolpyruvate, making the four-carbon oxaloacetate. PEP carboxylase never takes O₂, so nothing is lost to photorespiration here.',
  water: -1,
  in: { pep: 'pep', co2: 'co2', water: 'water' },
  out: { oaa: 'oaa', pi: 'pi', h: 'proton' },
  ledger: { pumped: 1 },
  map: {
    'co2.C': 'oaa.C4',
    'co2.Oa': 'oaa.O4',
    'co2.Ob': 'oaa.O4b',
    'pep.P3': 'pi.P',
    'pep.D3': 'pi.D',
    'pep.M3': 'pi.M',
    'pep.E3': 'pi.N',
    'water.O': 'pi.O',
    'water.Ha': 'pi.H',
    'water.Hb': 'h.H',
  },
};

// The inverse of the citric acid cycle's malate dehydrogenase, on NADPH.
export const mdhNadp = {
  id: 'mdh-nadp',
  enzyme: 'NADP-malate dehydrogenase',
  short: 'MDH',
  phase: 'pump',
  blurb: 'NADPH reduces oxaloacetate to malate, the form in which the carbon travels to the bundle sheath.',
  in: { oaa: 'oaa', nadph: 'nadph', h: 'proton' },
  out: { mal: 'malate', nadp: 'nadp' },
  ledger: { nadphUsed: 1 },
  map: {
    'nadph.H': 'mal.H2',
    'h.H': 'mal.HO2',
    'nadph.body': 'nadp.body',
  },
  eend: { 'nadph.0': 'mal', 'nadph.1': 'mal' },
  ehand: { 'nadph.0': 'mal.H2', 'nadph.1': 'mal.H2' },
};

// Malate + NADP⁺ → pyruvate + CO₂ + NADPH. C-4 leaves as CO₂, right beside
// RuBisCO. The hydroxyl's hydrogen ends on pyruvate's methyl group (the
// enol is protonated there).
export const malicEnzyme = {
  id: 'me',
  enzyme: 'NADP-malic enzyme',
  short: 'ME',
  phase: 'pump',
  blurb: 'Malic enzyme removes carbon 4 of malate as CO₂, beside RuBisCO, and transfers two electrons to NADP⁺.',
  in: { mal: 'malate', nadp: 'nadp' },
  out: { pyr: 'pyruvate', co2: 'co2', nadph: 'nadph' },
  ledger: { nadph: 1, released: 1 },
  enew: { nadph: 'mal.C2' },
  map: {
    'mal.C4': 'co2.C',
    'mal.O4': 'co2.Oa',
    'mal.O4b': 'co2.Ob',
    'mal.H2': 'nadph.H',
    'mal.HO2': 'pyr.H3c',
    'nadp.body': 'nadph.body',
  },
};

// Pyruvate + ATP + Pᵢ → PEP + AMP + PPᵢ + H⁺. PEP's phosphate is ATP's β
// phosphate; the γ phosphate joins the incoming phosphate as pyrophosphate.
export const ppdk = {
  id: 'ppdk',
  enzyme: 'Pyruvate, phosphate dikinase',
  short: 'PPDK',
  phase: 'pump',
  blurb: 'Pyruvate becomes PEP again. ATP gives up two phosphates: one to pyruvate, one to a phosphate, making pyrophosphate.',
  atp: -1,
  in: { pyr: 'pyruvate', atp: 'atp', pi: 'pi' },
  out: { pep: 'pep', amp: 'amp', ppi: 'ppi', h: 'proton' },
  map: {
    'pyr.H3c': 'h.H',
    'atp.B1': 'amp.E',
    'atp.P1': 'pep.P3',
    'atp.D1': 'pep.D3',
    'atp.M1': 'pep.M3',
    'atp.B2': 'pep.E3',
    'atp.P2': 'ppi.PB',
    'atp.D2': 'ppi.DB',
    'atp.M2': 'ppi.MB',
    'atp.E': 'ppi.EB',
    'pi.P': 'ppi.PA',
    'pi.D': 'ppi.DA',
    'pi.M': 'ppi.MA',
    'pi.N': 'ppi.X',
    'pi.O': 'ppi.OA',
    'pi.H': 'ppi.HA',
  },
};

// Adenylate kinase: AMP + ATP → 2 ADP. ATP's γ phosphate moves onto AMP.
export const adenylateKinase = {
  id: 'adk',
  enzyme: 'Adenylate kinase',
  short: 'ADK',
  phase: 'pump',
  blurb: 'ATP passes its end phosphate to AMP: two ADP.',
  atp: -1,
  in: { amp: 'amp', atp: 'atp' },
  out: { adpA: 'adp', adpB: 'adp' },
  map: {
    ...Object.fromEntries(['body', 'B0', 'P0', 'D0', 'M0', 'B1', 'P1', 'D1', 'M1'].map((label) => [`atp.${label}`, `adpA.${label}`])),
    'atp.B2': 'adpA.E',
    ...Object.fromEntries(['body', 'B0', 'P0', 'D0', 'M0'].map((label) => [`amp.${label}`, `adpB.${label}`])),
    'amp.E': 'adpB.B1',
    'atp.P2': 'adpB.P1',
    'atp.D2': 'adpB.D1',
    'atp.M2': 'adpB.M1',
    'atp.E': 'adpB.E',
  },
};

// Pyrophosphatase: PPᵢ + H₂O → 2 Pᵢ + H⁺.
export const pyrophosphatase = {
  id: 'ppase',
  enzyme: 'Pyrophosphatase',
  short: 'PPase',
  phase: 'pump',
  blurb: 'Water splits pyrophosphate into two phosphates.',
  water: -1,
  in: { ppi: 'ppi', water: 'water' },
  out: { piA: 'pi', piB: 'pi', h: 'proton' },
  map: {
    'ppi.PA': 'piA.P',
    'ppi.DA': 'piA.D',
    'ppi.MA': 'piA.M',
    'ppi.X': 'piA.N',
    'ppi.OA': 'piA.O',
    'ppi.HA': 'piA.H',
    'ppi.PB': 'piB.P',
    'ppi.DB': 'piB.D',
    'ppi.MB': 'piB.M',
    'ppi.EB': 'piB.N',
    'water.O': 'piB.O',
    'water.Ha': 'piB.H',
    'water.Hb': 'h.H',
  },
};

// Transporters and the plasmodesmata: molecules cross unchanged.
function transport(id, enzyme, short, blurb, moves) {
  const inputs = {};
  const outputs = {};
  let map = {};
  for (const [role, speciesId] of moves) {
    inputs[`${role}In`] = speciesId;
    outputs[`${role}Out`] = speciesId;
    map = { ...map, ...carry(`${role}In`, `${role}Out`, speciesId) };
  }
  return { id, enzyme, short, phase: 'pump', blurb, in: inputs, out: outputs, map };
}

export const omt = transport('omt', 'Oxaloacetate–malate translocator', 'OMT', 'Oxaloacetate enters the chloroplast as malate leaves it.', [['oaa', 'oaa'], ['mal', 'malate']]);
export const pyrIn = transport('pyr-in', 'Pyruvate transporter', 'Pyr', 'Pyruvate enters the mesophyll chloroplast.', [['pyr', 'pyruvate']]);
export const ppt = transport('ppt', 'PEP–phosphate translocator', 'PPT', 'PEP leaves the chloroplast as a phosphate comes in.', [['pep', 'pep'], ['pi', 'pi']]);
export const plasmodesmata = transport('plasmo', 'Plasmodesmata', 'PD', 'Channels through the cell wall join the two cells. Malate passes into the bundle sheath, and pyruvate comes back.', [['mal', 'malate'], ['pyr', 'pyruvate']]);
export const dit = transport('dit', 'Dicarboxylate transporter', 'DiT', 'Malate enters the bundle-sheath chloroplast.', [['mal', 'malate']]);
export const pyrOut = transport('pyr-out', 'Pyruvate exporter', 'Pyr', 'Pyruvate leaves the bundle-sheath chloroplast.', [['pyr', 'pyruvate']]);

// PPDK and its recharge, one compound station (E4): the AMP and the
// pyrophosphate it makes are turned back into ADP and phosphate inside it.
export const PPDK_STATION = [
  { reaction: 'ppdk', bind: { in: { pyr: 'pyr', atp: 'atp1', pi: 'pi' }, out: { pep: 'pep', amp: 'amp', ppi: 'ppi', h: 'h1' } } },
  { reaction: 'adk', bind: { in: { amp: 'amp', atp: 'atp2' }, out: { adpA: 'adp1', adpB: 'adp2' } } },
  { reaction: 'ppase', bind: { in: { ppi: 'ppi', water: 'water' }, out: { piA: 'pi1', piB: 'pi2', h: 'h2' } } },
];

export const C4 = [pepc, mdhNadp, malicEnzyme, ppdk, adenylateKinase, pyrophosphatase, omt, pyrIn, ppt, plasmodesmata, dit, pyrOut];
