// The chloroplast's reactions (M6 plan §3.1 to §3.3). Light reactions first,
// then the Calvin cycle and hexose assembly. Several Calvin and hexose steps
// are glycolysis run backwards; `invert` builds those from the forward map,
// so the two directions can never disagree about an atom.

import { compileMap } from './compile.js';
import { aldolase, phosphoglucoseIsomerase, phosphoglycerateKinase, triosePhosphateIsomerase } from './glycolysis.js';

// The reverse of a reaction: products become reactants, and every atom
// goes back where it came from. Fields in `extra` (id, names) replace the
// forward reaction's.
export function invert(reaction, extra) {
  const { pairs, errors } = compileMap(reaction);
  if (errors.length) throw new Error(errors[0]);
  return {
    id: extra.id,
    enzyme: extra.enzyme ?? reaction.enzyme,
    short: extra.short ?? reaction.short,
    phase: extra.phase,
    blurb: extra.blurb,
    in: { ...reaction.out },
    out: { ...reaction.in },
    map: Object.fromEntries(pairs.map(([from, to]) => [to, from])),
    ...(extra.more ?? {}),
  };
}

// Light reactions ---------------------------------------------------------------

export const psiiLight = {
  id: 'psii-pq',
  enzyme: 'Photosystem II',
  short: 'PSII',
  phase: 'light',
  blurb: 'Light lifts two electrons from the manganese cluster, one photon each. They leave on plastoquinone, which takes two protons from the stroma.',
  in: { e1: 'electron', e2: 'electron', pq: 'pq', h1: 'proton', h2: 'proton' },
  out: { pqh2: 'pqh2' },
  map: {
    'h1.H': 'pqh2.Ha',
    'h2.H': 'pqh2.Hb',
    'pq.body': 'pqh2.body',
  },
  emap: { 'e1.0': 'pqh2.0', 'e2.0': 'pqh2.1' },
};

// Photosystem II is Complex IV running backwards (D8): two waters become O₂,
// four protons in the lumen and four electrons, which refill the cluster.
// Each new electron is named after the water oxygen it came from (E6).
export const psiiSplit = {
  id: 'psii-split',
  enzyme: 'Photosystem II',
  short: 'PSII',
  phase: 'light',
  blurb: 'With its manganese cluster empty, photosystem II splits two water molecules. Their oxygens pair up as O₂, their protons go into the lumen, and four electrons refill the cluster.',
  in: { wA: 'water', wB: 'water' },
  out: { o2: 'oxygen', h1: 'proton', h2: 'proton', h3: 'proton', h4: 'proton', e1: 'electron', e2: 'electron', e3: 'electron', e4: 'electron' },
  map: {
    'wA.O': 'o2.Oa',
    'wB.O': 'o2.Ob',
    'wA.Ha': 'h1.H',
    'wA.Hb': 'h2.H',
    'wB.Ha': 'h3.H',
    'wB.Hb': 'h4.H',
  },
  enew: { e1: 'wA.O', e2: 'wA.O', e3: 'wB.O', e4: 'wB.O' },
  ledger: { split: 2, o2: 1 },
};

export const b6f = {
  id: 'b6f',
  enzyme: 'Cytochrome b₆f',
  short: 'b₆f',
  phase: 'light',
  blurb: 'Plastoquinol releases its two protons into the lumen and transfers its two electrons to two plastocyanins, one each. Two more protons are pumped from the stroma.',
  pump: 2,
  in: { pqh2: 'pqh2', pcA: 'pc', pcB: 'pc' },
  out: { pq: 'pq', pcA: 'pcr', pcB: 'pcr', hA: 'proton', hB: 'proton' },
  map: {
    'pqh2.Ha': 'hA.H',
    'pqh2.Hb': 'hB.H',
    'pqh2.body': 'pq.body',
    'pcA.body': 'pcA.body',
    'pcB.body': 'pcB.body',
  },
  emap: { 'pqh2.0': 'pcA.0', 'pqh2.1': 'pcB.0' },
};

export const psi = {
  id: 'psi',
  enzyme: 'Photosystem I',
  short: 'PSI',
  phase: 'light',
  blurb: 'A photon lifts the electron plastocyanin brought, high enough to reach ferredoxin on the stroma side.',
  in: { pc: 'pcr', fd: 'fd' },
  out: { pc: 'pc', fd: 'fdr' },
  map: { 'pc.body': 'pc.body', 'fd.body': 'fd.body' },
  emap: { 'pc.0': 'fd.0' },
};

function unload(id, enzyme, short, blurb) {
  return {
    id,
    enzyme,
    short,
    phase: 'light',
    blurb,
    in: { fd: 'fdr' },
    out: { fd: 'fd', e: 'electron' },
    map: {},
    emap: { 'fd.0': 'e.0' },
  };
}

export const fnrLoad = unload('fnr-load', 'NADP⁺ reductase', 'FNR', 'Ferredoxin drops one electron into NADP⁺ reductase and goes back to photosystem I for another.');

export const fnr = {
  id: 'fnr',
  enzyme: 'NADP⁺ reductase',
  short: 'FNR',
  phase: 'light',
  blurb: 'Two electrons and a proton from the stroma reduce NADP⁺ to NADPH. The hydride’s nucleus is a stroma proton; its electrons came from water.',
  in: { e1: 'electron', e2: 'electron', nadp: 'nadp', h: 'proton' },
  out: { nadph: 'nadph' },
  map: { 'h.H': 'nadph.H', 'nadp.body': 'nadph.body' },
  emap: { 'e1.0': 'nadph.0', 'e2.0': 'nadph.1' },
  ledger: { nadph: 1 },
};

export const cyclicLoad = unload('cyclic-load', 'Cyclic route', 'Cyclic', 'Ferredoxin passes its electron back towards plastoquinone instead of to NADP⁺.');

export const cyclic = {
  ...psiiLight,
  id: 'cyclic',
  enzyme: 'Cyclic route',
  short: 'Cyclic',
  blurb: 'Two electrons from ferredoxin go back onto plastoquinone, with two protons from the stroma. They will pass cytochrome b₆f again and pump more protons: ATP without NADPH.',
  ledger: { cyclic: 1 },
};

// Calvin cycle: carboxylation and reduction --------------------------------------

// RuBP⁴⁻ + CO₂ + H₂O → 2 3-PG³⁻ + 2 H⁺ (§3.2). CO₂ adds to C-2 and the chain
// splits between C-2 and C-3. Which hydrogens go where is a model choice
// that conserves atoms: water's two go to the upper fragment's C-2; RuBP
// C-3's H and its hydroxyl H leave as the two protons.
export const rubisco = {
  id: 'rubisco',
  enzyme: 'RuBisCO',
  short: 'RuBisCO',
  phase: 'carboxylation',
  blurb: 'CO₂ joins the five-carbon RuBP, and the six-carbon product splits at once into two 3-phosphoglycerates. The new carbon is a carboxylate carbon in one of them.',
  water: -1,
  in: { rubp: 'rubp', co2: 'co2', water: 'water' },
  out: { pgA: 'pg3', pgB: 'pg3', hA: 'proton', hB: 'proton' },
  ledger: { fixed: 1 },
  map: {
    'co2.C': 'pgA.C1',
    'co2.Oa': 'pgA.O1',
    'co2.Ob': 'pgA.O1b',
    'rubp.C2': 'pgA.C2',
    'rubp.O2': 'pgA.O2',
    'water.Ha': 'pgA.H2',
    'water.Hb': 'pgA.HO2',
    'rubp.C1': 'pgA.C3',
    'rubp.O1': 'pgA.O3',
    'rubp.H1a': 'pgA.H3a',
    'rubp.H1b': 'pgA.H3b',
    'rubp.P1': 'pgA.P3',
    'rubp.D1': 'pgA.D3',
    'rubp.M1': 'pgA.M3',
    'rubp.E1': 'pgA.E3',
    'rubp.C3': 'pgB.C1',
    'rubp.O3': 'pgB.O1',
    'water.O': 'pgB.O1b',
    'rubp.H3': 'hA.H',
    'rubp.HO3': 'hB.H',
    'rubp.C4': 'pgB.C2',
    'rubp.O4': 'pgB.O2',
    'rubp.H4': 'pgB.H2',
    'rubp.HO4': 'pgB.HO2',
    'rubp.C5': 'pgB.C3',
    'rubp.O5': 'pgB.O3',
    'rubp.H5a': 'pgB.H3a',
    'rubp.H5b': 'pgB.H3b',
    'rubp.P5': 'pgB.P3',
    'rubp.D5': 'pgB.D3',
    'rubp.M5': 'pgB.M3',
    'rubp.E5': 'pgB.E3',
  },
};

// RuBisCO's oxygenase reaction (M7a, M6 plan §3.4): RuBP⁴⁻ + O₂ + H₂O →
// 3-PG³⁻ + 2-phosphoglycolate³⁻ + H₂O + 2 H⁺. O₂ adds at C-2. One of its
// oxygens ends in phosphoglycolate's carboxylate, the other leaves in water;
// the incoming water's oxygen becomes the 3-PG's second carboxylate oxygen,
// as in carboxylation. Which hydrogens go where is a model choice that
// conserves atoms: the outgoing water keeps the incoming water's two, and
// RuBP C-3's H and its hydroxyl H leave as the two protons, as before.
export const rubiscoO2 = {
  id: 'rubisco-o2',
  enzyme: 'RuBisCO',
  short: 'RuBisCO',
  phase: 'photorespiration',
  blurb: 'RuBisCO takes O₂ instead of CO₂, and no carbon is fixed. RuBP splits into one 3-phosphoglycerate and one 2-phosphoglycolate, which the Calvin cycle cannot use.',
  in: { rubp: 'rubp', o2: 'oxygen', water: 'water' },
  out: { pg: 'pg3', pgly: 'pglycolate', waterOut: 'water', hA: 'proton', hB: 'proton' },
  ledger: { oxygenated: 1 },
  map: {
    'rubp.C2': 'pgly.C1',
    'rubp.O2': 'pgly.O1',
    'o2.Oa': 'pgly.O1b',
    'rubp.C1': 'pgly.C2',
    'rubp.H1a': 'pgly.H2a',
    'rubp.H1b': 'pgly.H2b',
    'rubp.O1': 'pgly.O2',
    'rubp.P1': 'pgly.P2',
    'rubp.D1': 'pgly.D2',
    'rubp.M1': 'pgly.M2',
    'rubp.E1': 'pgly.E2',
    'o2.Ob': 'waterOut.O',
    'water.Ha': 'waterOut.Ha',
    'water.Hb': 'waterOut.Hb',
    'rubp.C3': 'pg.C1',
    'rubp.O3': 'pg.O1',
    'water.O': 'pg.O1b',
    'rubp.H3': 'hA.H',
    'rubp.HO3': 'hB.H',
    'rubp.C4': 'pg.C2',
    'rubp.O4': 'pg.O2',
    'rubp.H4': 'pg.H2',
    'rubp.HO4': 'pg.HO2',
    'rubp.C5': 'pg.C3',
    'rubp.O5': 'pg.O3',
    'rubp.H5a': 'pg.H3a',
    'rubp.H5b': 'pg.H3b',
    'rubp.P5': 'pg.P3',
    'rubp.D5': 'pg.D3',
    'rubp.M5': 'pg.M3',
    'rubp.E5': 'pg.E3',
  },
};

// Phosphoglycolate phosphatase, in the stroma (D17): water takes the
// phosphate off, so the stroma keeps its phosphorus and only glycolate
// leaves for the salvage pathway.
export const pgp = {
  id: 'pgp',
  enzyme: 'Phosphoglycolate phosphatase',
  short: 'PGP',
  phase: 'photorespiration',
  blurb: 'Hydrolysis removes the phosphate from 2-phosphoglycolate. The phosphate remains in the stroma; glycolate leaves for the salvage pathway.',
  water: -1,
  in: { pgly: 'pglycolate', water: 'water' },
  out: { glycolate: 'glycolate', pi: 'pi' },
  map: {
    'pgly.C1': 'glycolate.C1',
    'pgly.O1': 'glycolate.O1',
    'pgly.O1b': 'glycolate.O1b',
    'pgly.C2': 'glycolate.C2',
    'pgly.H2a': 'glycolate.H2a',
    'pgly.H2b': 'glycolate.H2b',
    'pgly.O2': 'glycolate.O2',
    'pgly.P2': 'pi.P',
    'pgly.D2': 'pi.D',
    'pgly.M2': 'pi.M',
    'pgly.E2': 'pi.N',
    'water.O': 'pi.O',
    'water.Ha': 'pi.H',
    'water.Hb': 'glycolate.HO2',
  },
};

// Phosphoglycerate kinase run backwards. The two carboxylate oxygens of
// 3-PG are equivalent, so either may become the bridging oxygen (D11).
const calvinPgkBase = invert(phosphoglycerateKinase, {
  id: 'calvin-pgk',
  phase: 'reduction',
  blurb: 'ATP puts a phosphate on the carboxylate of 3-phosphoglycerate. This is glycolysis’s phosphoglycerate kinase, running the other way.',
});
const pgkMapB = { ...calvinPgkBase.map, 'pg3.O1': 'bpg.O1p', 'pg3.O1b': 'bpg.O1' };
export const calvinPgk = { ...calvinPgkBase, atp: -1, maps: [calvinPgkBase.map, pgkMapB] };
export const calvinPgkAlt = { ...calvinPgk, id: 'calvin-pgk-alt', map: pgkMapB, maps: undefined };

// The chloroplast's NADP-linked G3P dehydrogenase: glycolysis step 6 run
// backwards on NADPH. The hydride becomes G3P's aldehyde hydrogen, and its
// electrons end in that C–H bond; a tag on them passes to the hydrogen (E7).
// The bridging oxygen leaves with the phosphate.
export const calvinGapdh = {
  id: 'calvin-gapdh',
  enzyme: 'G3P dehydrogenase',
  short: 'GAPDH',
  phase: 'reduction',
  blurb: 'NADPH hands a hydride to carbon 1, and the phosphate leaves. Carbon 1 is reduced to an aldehyde: G3P, a three-carbon sugar.',
  in: { bpg: 'bpg', nadph: 'nadph', h: 'proton' },
  out: { g3p: 'g3p', nadp: 'nadp', pi: 'pi' },
  map: {
    'nadph.H': 'g3p.H1',
    'nadph.body': 'nadp.body',
    'bpg.O1p': 'pi.M',
    'bpg.P1': 'pi.P',
    'bpg.D1': 'pi.D',
    'bpg.M1': 'pi.N',
    'bpg.E1': 'pi.O',
    'h.H': 'pi.H',
  },
  eend: { 'nadph.0': 'g3p', 'nadph.1': 'g3p' },
  ehand: { 'nadph.0': 'g3p.H1', 'nadph.1': 'g3p.H1' },
  ledger: { nadphUsed: 1 },
};

// Regeneration and hexose assembly: the sub-steps -------------------------------

export const tpiBack = invert(triosePhosphateIsomerase, {
  id: 'tpi-back',
  phase: 'regeneration',
  blurb: 'Triose phosphate isomerase turns G3P into DHAP.',
});

export const aldolaseBack = invert(aldolase, {
  id: 'aldolase-back',
  phase: 'regeneration',
  blurb: 'Aldolase joins DHAP and G3P into fructose 1,6-bisphosphate.',
});

export const pgiBack = invert(phosphoglucoseIsomerase, {
  id: 'pgi-back',
  phase: 'export',
  blurb: 'Phosphoglucose isomerase turns fructose 6-phosphate into glucose 6-phosphate.',
});

// Fructose bisphosphatase: water's oxygen goes to the phosphate it frees.
export const fbpase = {
  id: 'fbpase',
  enzyme: 'Fructose bisphosphatase',
  short: 'FBPase',
  phase: 'regeneration',
  blurb: 'Hydrolysis removes the phosphate from carbon 1 of fructose 1,6-bisphosphate.',
  water: -1,
  in: { fbp: 'fbp', water: 'water' },
  out: { f6p: 'f6p', pi: 'pi' },
  map: {
    'fbp.P1': 'pi.P',
    'fbp.D1': 'pi.D',
    'fbp.M1': 'pi.M',
    'fbp.E1': 'pi.N',
    'water.O': 'pi.O',
    'water.Ha': 'pi.H',
    'water.Hb': 'f6p.HO2',
  },
};

// Transketolase moves a two-carbon unit (the donor's C-1 and C-2) onto the
// aldehyde carbon of G3P. The donor's C-3 becomes an aldehyde, and its
// hydroxyl hydrogen goes to the new hydroxyl on the acceptor.
function transketolase(id, donor, donorSpecies, donorCarbons, rest, restSpecies) {
  const map = {
    // The two-carbon unit becomes Xu5P C-1 and C-2.
    [`${donor}.C1`]: 'xu5p.C1',
    [`${donor}.O1`]: 'xu5p.O1',
    [`${donor}.C2`]: 'xu5p.C2',
    [`${donor}.O2`]: 'xu5p.O2',
    // G3P becomes Xu5P C-3 to C-5.
    'g3p.C1': 'xu5p.C3',
    'g3p.O1': 'xu5p.O3',
    'g3p.H1': 'xu5p.H3',
    [`${donor}.HO3`]: 'xu5p.HO3',
    'g3p.C2': 'xu5p.C4',
    'g3p.O2': 'xu5p.O4',
    'g3p.H2': 'xu5p.H4',
    'g3p.HO2': 'xu5p.HO4',
    'g3p.C3': 'xu5p.C5',
    'g3p.O3': 'xu5p.O5',
    'g3p.H3a': 'xu5p.H5a',
    'g3p.H3b': 'xu5p.H5b',
    'g3p.P3': 'xu5p.P5',
    'g3p.D3': 'xu5p.D5',
    'g3p.M3': 'xu5p.M5',
    'g3p.E3': 'xu5p.E5',
    // The donor's C-3 onward become the shorter sugar, C-3 its aldehyde.
    [`${donor}.C3`]: `${rest}.C1`,
    [`${donor}.O3`]: `${rest}.O1`,
    [`${donor}.H3`]: `${rest}.H1`,
  };
  Object.assign(map, donorCarbons);
  for (let n = 4; n <= (donorSpecies === 'f6p' ? 6 : 7); n += 1) {
    const m = n - 2;
    map[`${donor}.C${n}`] = `${rest}.C${m}`;
    map[`${donor}.O${n}`] = `${rest}.O${m}`;
  }
  return {
    id,
    enzyme: 'Transketolase',
    short: 'TK',
    phase: 'regeneration',
    blurb: `Transketolase moves a two-carbon unit from ${donorSpecies === 'f6p' ? 'fructose 6-phosphate' : 'sedoheptulose 7-phosphate'} onto G3P, making xylulose 5-phosphate.`,
    in: { [donor]: donorSpecies, g3p: 'g3p' },
    out: { [rest]: restSpecies, xu5p: 'xu5p' },
    map,
  };
}

// F6P's own hydrogen labels: H1 and H2 on C-1, HO2 its hydroxyl, then the
// chain's usual H, HO; C-6 carries the phosphate.
export const transketolaseA = transketolase('tk-f6p', 'f6p', 'f6p', {
  'f6p.H1': 'xu5p.H1a',
  'f6p.H2': 'xu5p.H1b',
  'f6p.HO2': 'xu5p.HO1',
  'f6p.H4': 'e4p.H2',
  'f6p.HO4': 'e4p.HO2',
  'f6p.H5': 'e4p.H3',
  'f6p.HO5': 'e4p.HO3',
  'f6p.H6a': 'e4p.H4a',
  'f6p.H6b': 'e4p.H4b',
  'f6p.P6': 'e4p.P4',
  'f6p.D6': 'e4p.D4',
  'f6p.M6': 'e4p.M4',
  'f6p.E6': 'e4p.E4',
}, 'e4p', 'e4p');

export const transketolaseB = transketolase('tk-s7p', 's7p', 's7p', {
  's7p.H1a': 'xu5p.H1a',
  's7p.H1b': 'xu5p.H1b',
  's7p.HO1': 'xu5p.HO1',
  's7p.H4': 'r5p.H2',
  's7p.HO4': 'r5p.HO2',
  's7p.H5': 'r5p.H3',
  's7p.HO5': 'r5p.HO3',
  's7p.H6': 'r5p.H4',
  's7p.HO6': 'r5p.HO4',
  's7p.H7a': 'r5p.H5a',
  's7p.H7b': 'r5p.H5b',
  's7p.P7': 'r5p.P5',
  's7p.D7': 'r5p.D5',
  's7p.M7': 'r5p.M5',
  's7p.E7': 'r5p.E5',
}, 'r5p', 'r5p');

// Aldolase joins DHAP (from its C-1) to the aldehyde of erythrose
// 4-phosphate: SBP C-1 to C-3 are DHAP C-3 to C-1, C-4 on are E4P's. As in
// the fructose case, one of DHAP C-1's hydrogens becomes the new hydroxyl's.
export const aldolaseSbp = {
  id: 'aldolase-sbp',
  enzyme: 'Aldolase',
  short: 'ALD',
  phase: 'regeneration',
  blurb: 'Aldolase joins DHAP and erythrose 4-phosphate into sedoheptulose 1,7-bisphosphate.',
  in: { e4p: 'e4p', dhap: 'dhap' },
  out: { sbp: 'sbp' },
  map: {
    'dhap.C3': 'sbp.C1',
    'dhap.O3': 'sbp.O1',
    'dhap.H3a': 'sbp.H1a',
    'dhap.H3b': 'sbp.H1b',
    'dhap.P3': 'sbp.P1',
    'dhap.D3': 'sbp.D1',
    'dhap.M3': 'sbp.M1',
    'dhap.E3': 'sbp.E1',
    'dhap.C2': 'sbp.C2',
    'dhap.O2': 'sbp.O2',
    'dhap.C1': 'sbp.C3',
    'dhap.O1': 'sbp.O3',
    'dhap.H1a': 'sbp.H3',
    'dhap.HO1': 'sbp.HO3',
    'dhap.H1b': 'sbp.HO4',
    'e4p.C1': 'sbp.C4',
    'e4p.O1': 'sbp.O4',
    'e4p.H1': 'sbp.H4',
    'e4p.C2': 'sbp.C5',
    'e4p.O2': 'sbp.O5',
    'e4p.H2': 'sbp.H5',
    'e4p.HO2': 'sbp.HO5',
    'e4p.C3': 'sbp.C6',
    'e4p.O3': 'sbp.O6',
    'e4p.H3': 'sbp.H6',
    'e4p.HO3': 'sbp.HO6',
    'e4p.C4': 'sbp.C7',
    'e4p.O4': 'sbp.O7',
    'e4p.H4a': 'sbp.H7a',
    'e4p.H4b': 'sbp.H7b',
    'e4p.P4': 'sbp.P7',
    'e4p.D4': 'sbp.D7',
    'e4p.M4': 'sbp.M7',
    'e4p.E4': 'sbp.E7',
  },
};

export const sbpase = {
  id: 'sbpase',
  enzyme: 'Sedoheptulose bisphosphatase',
  short: 'SBPase',
  phase: 'regeneration',
  blurb: 'Hydrolysis removes the phosphate from carbon 1 of sedoheptulose 1,7-bisphosphate.',
  water: -1,
  in: { sbp: 'sbp', water: 'water' },
  out: { s7p: 's7p', pi: 'pi' },
  map: {
    'sbp.P1': 'pi.P',
    'sbp.D1': 'pi.D',
    'sbp.M1': 'pi.M',
    'sbp.E1': 'pi.N',
    'water.O': 'pi.O',
    'water.Ha': 'pi.H',
    'water.Hb': 's7p.HO1',
  },
};

// Aldose to ketose through an enediol: C-2's hydrogen moves to C-1, and
// C-2's hydroxyl hydrogen ends on C-1's oxygen.
export const rpi = {
  id: 'rpi',
  enzyme: 'Ribose 5-phosphate isomerase',
  short: 'RPI',
  phase: 'regeneration',
  blurb: 'Ribose 5-phosphate isomerase turns the aldose into the ketose ribulose 5-phosphate.',
  in: { r5p: 'r5p' },
  out: { ru5p: 'ru5p' },
  map: {
    'r5p.H1': 'ru5p.H1a',
    'r5p.H2': 'ru5p.H1b',
    'r5p.HO2': 'ru5p.HO1',
  },
};

// Xu5P and Ru5P differ only in the shape at C-3, which is not drawn, so
// every atom keeps its label; only the name changes.
export const rpe = {
  id: 'rpe',
  enzyme: 'Ribulose 5-phosphate epimerase',
  short: 'RPE',
  phase: 'regeneration',
  blurb: 'Ribulose 5-phosphate epimerase turns xylulose 5-phosphate into ribulose 5-phosphate. The two differ only in the shape at carbon 3.',
  in: { xu5p: 'xu5p' },
  out: { ru5p: 'ru5p' },
  map: {},
};

export const prk = {
  id: 'prk',
  enzyme: 'Phosphoribulokinase',
  short: 'PRK',
  phase: 'regeneration',
  blurb: 'Phosphoribulokinase spends one ATP to put a phosphate on carbon 1. This is RuBP, ready for RuBisCO.',
  atp: -1,
  in: { ru5p: 'ru5p', atp: 'atp' },
  out: { rubp: 'rubp', adp: 'adp', h: 'proton' },
  map: {
    'ru5p.HO1': 'h.H',
    'atp.B2': 'adp.E',
    'atp.P2': 'rubp.P1',
    'atp.D2': 'rubp.D1',
    'atp.M2': 'rubp.M1',
    'atp.E': 'rubp.E1',
  },
};

// Glucose 6-phosphatase: water's oxygen goes to the phosphate (§3.2).
export const g6pase = {
  id: 'g6pase',
  enzyme: 'Glucose 6-phosphatase',
  short: 'G6Pase',
  phase: 'export',
  blurb: 'Hydrolysis removes the last phosphate, leaving glucose.',
  water: -1,
  in: { g6p: 'g6p', water: 'water' },
  out: { glc: 'glucose', pi: 'pi' },
  ledger: { glucose: 1 },
  map: {
    'g6p.P6': 'pi.P',
    'g6p.D6': 'pi.D',
    'g6p.M6': 'pi.M',
    'g6p.E6': 'pi.N',
    'water.O': 'pi.O',
    'water.Ha': 'pi.H',
    'water.Hb': 'glc.HO6',
  },
};

// The triose phosphate translocator swaps one G3P out for one phosphate in.
const g3pLabels = ['C1', 'O1', 'H1', 'C2', 'O2', 'H2', 'HO2', 'C3', 'O3', 'H3a', 'H3b', 'P3', 'D3', 'M3', 'E3'];
const piLabels = ['P', 'D', 'M', 'N', 'O', 'H'];
const carry = (from, to, labels) => Object.fromEntries(labels.map((label) => [`${from}.${label}`, `${to}.${label}`]));

export const tpt = {
  id: 'tpt',
  enzyme: 'Triose phosphate translocator',
  short: 'TPT',
  phase: 'export',
  blurb: 'One G3P leaves the chloroplast for each phosphate that comes in, so the stroma never runs short of phosphate.',
  in: { g3pIn: 'g3p', piIn: 'pi' },
  out: { g3pOut: 'g3p', piOut: 'pi' },
  map: { ...carry('g3pIn', 'g3pOut', g3pLabels), ...carry('piIn', 'piOut', piLabels) },
};

// Compound stations (E4) as data: the sub-steps in order, each binding its
// roles to named slots inside the station. Regeneration takes trioses a to
// e (d and e become DHAP), three ATP and two waters (§3.2).
export const REGENERATION = [
  { reaction: 'tpi-back', bind: { in: { g3p: 'd' }, out: { dhap: 'd' } } },
  { reaction: 'tpi-back', bind: { in: { g3p: 'e' }, out: { dhap: 'e' } } },
  { reaction: 'aldolase-back', bind: { in: { dhap: 'd', g3p: 'a' }, out: { fbp: 'fbp' } } },
  { reaction: 'fbpase', bind: { in: { fbp: 'fbp', water: 'water1' }, out: { f6p: 'f6p', pi: 'pi1' } } },
  { reaction: 'tk-f6p', bind: { in: { f6p: 'f6p', g3p: 'b' }, out: { e4p: 'e4p', xu5p: 'xu1' } } },
  { reaction: 'aldolase-sbp', bind: { in: { e4p: 'e4p', dhap: 'e' }, out: { sbp: 'sbp' } } },
  { reaction: 'sbpase', bind: { in: { sbp: 'sbp', water: 'water2' }, out: { s7p: 's7p', pi: 'pi2' } } },
  { reaction: 'tk-s7p', bind: { in: { s7p: 's7p', g3p: 'c' }, out: { r5p: 'r5p', xu5p: 'xu2' } } },
  { reaction: 'rpi', bind: { in: { r5p: 'r5p' }, out: { ru5p: 'ru2' } } },
  { reaction: 'rpe', bind: { in: { xu5p: 'xu1' }, out: { ru5p: 'ru1' } } },
  { reaction: 'rpe', bind: { in: { xu5p: 'xu2' }, out: { ru5p: 'ru3' } } },
  { reaction: 'prk', bind: { in: { ru5p: 'ru1', atp: 'atp1' }, out: { rubp: 'rubp1', adp: 'adp1', h: 'h1' } } },
  { reaction: 'prk', bind: { in: { ru5p: 'ru2', atp: 'atp2' }, out: { rubp: 'rubp2', adp: 'adp2', h: 'h2' } } },
  { reaction: 'prk', bind: { in: { ru5p: 'ru3', atp: 'atp3' }, out: { rubp: 'rubp3', adp: 'adp3', h: 'h3' } } },
];

// Hexose assembly takes two G3P, x and y; y becomes DHAP (§3.2).
export const HEXOSE = [
  { reaction: 'tpi-back', bind: { in: { g3p: 'y' }, out: { dhap: 'y' } } },
  { reaction: 'aldolase-back', bind: { in: { dhap: 'y', g3p: 'x' }, out: { fbp: 'fbp' } } },
  { reaction: 'fbpase', bind: { in: { fbp: 'fbp', water: 'water1' }, out: { f6p: 'f6p', pi: 'pi1' } } },
  { reaction: 'pgi-back', bind: { in: { f6p: 'f6p' }, out: { g6p: 'g6p' } } },
  { reaction: 'g6pase', bind: { in: { g6p: 'g6p', water: 'water2' }, out: { glc: 'glc', pi: 'pi2' } } },
];

export const PHOTOSYNTHESIS = [
  psiiLight,
  psiiSplit,
  b6f,
  psi,
  fnrLoad,
  fnr,
  cyclicLoad,
  cyclic,
  rubisco,
  rubiscoO2,
  pgp,
  calvinPgk,
  calvinGapdh,
  tpiBack,
  aldolaseBack,
  pgiBack,
  fbpase,
  transketolaseA,
  transketolaseB,
  aldolaseSbp,
  sbpase,
  rpi,
  rpe,
  prk,
  g6pase,
  tpt,
];
