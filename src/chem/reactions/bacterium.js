// The E. coli chain (PLAN §8.4, §17 D2, D3). NADH dehydrogenase (NDH-1) is
// Complex I's homologue and does the same chemistry. There is no Complex III
// or cytochrome c: cytochrome bo₃ and nitrate reductase each take ubiquinol
// themselves. Each quinol gives its two protons to the periplasm and its two
// electrons to the enzyme's store; with enough stored, the enzyme reduces its
// acceptor.

import { complex1, oxidase } from './respiration.js';

export const ndh1 = {
  ...complex1,
  id: 'ndh1',
  // The hydride's nucleus stays behind while its electrons go on: a tag splits here.
  split: true,
  enzyme: 'NADH dehydrogenase (NDH-1)',
  short: 'NDH-1',
  blurb: 'The bacterial Complex I: NADH hands two electrons to ubiquinone, and four protons are pumped into the periplasm. The hydride’s proton stays in the cytoplasm.',
};

// A quinol gives up two protons to the periplasm and two electrons to the
// enzyme that took it.
function quinolSite(id, enzyme, short, blurb) {
  return {
    id,
    enzyme,
    short,
    phase: 'chain',
    blurb,
    in: { qh2: 'qh2' },
    out: { q: 'q', hA: 'proton', hB: 'proton', eA: 'electron', eB: 'electron' },
    map: {
      'qh2.Ha': 'hA.H',
      'qh2.Hb': 'hB.H',
      'qh2.body': 'q.body',
    },
    emap: { 'qh2.0': 'eA.0', 'qh2.1': 'eB.0' },
  };
}

export const bo3Quinol = quinolSite(
  'bo3-quinol',
  'Cytochrome bo₃ oxidase',
  'bo₃',
  'Ubiquinol gives its two protons to the periplasm and its two electrons to cytochrome bo₃, which holds them until it has four.',
);

export const bo3 = {
  ...oxidase,
  id: 'bo3',
  enzyme: 'Cytochrome bo₃ oxidase',
  short: 'bo₃',
  blurb: 'With four electrons gathered, O₂ and four cytoplasmic protons become two water molecules, and four more protons are pumped out. Like Complex IV, it is a heme–copper oxidase.',
};

export const narQuinol = quinolSite(
  'nar-quinol',
  'Nitrate reductase',
  'Nar',
  'Ubiquinol gives its two protons to the periplasm and its two electrons to nitrate reductase. It pumps none.',
);

export const nitrateReductase = {
  id: 'nar',
  enzyme: 'Nitrate reductase',
  short: 'Nar',
  phase: 'chain',
  blurb: 'Two electrons and two protons take one oxygen off nitrate, which leaves as water. The nitrogen stays in nitrite, now at +3 instead of +5.',
  water: 1,
  acceptor: 'nitrate',
  in: { e1: 'electron', e2: 'electron', no3: 'nitrate', h1: 'proton', h2: 'proton' },
  out: { no2: 'nitrite', water: 'water' },
  map: {
    'no3.N': 'no2.N',
    'no3.Oa': 'no2.Oa',
    'no3.Ob': 'no2.Ob',
    'no3.Oc': 'water.O',
    'h1.H': 'water.Ha',
    'h2.H': 'water.Hb',
  },
  eend: { 'e1.0': 'no2', 'e2.0': 'no2' },
};

export const BACTERIUM = [ndh1, bo3Quinol, bo3, narQuinol, nitrateReductase];
