// Lactate dehydrogenase, pyruvate decarboxylase and alcohol dehydrogenase.
// The hydride that left glyceraldehyde 3-phosphate comes back onto carbon 2
// of lactate, or onto the carbinol carbon of ethanol. Pyruvate's carboxylate
// is the CO₂ of alcoholic fermentation, glucose C-3 or C-4.

export const lactateDehydrogenase = {
  id: 'ldh',
  enzyme: 'Lactate dehydrogenase',
  short: 'LDH',
  phase: 'ferment',
  blurb: 'Pyruvate accepts the hydride from NADH and becomes lactate, and NAD⁺ returns to glycolysis. No carbon is lost.',
  in: { pyr: 'pyruvate', nadh: 'nadh', h: 'proton' },
  out: { lac: 'lactate', nad: 'nad' },
  map: {
    'nadh.H': 'lac.H2',
    'nadh.body': 'nad.body',
    'h.H': 'lac.HO2',
  },
  eend: { 'nadh.0': 'lac', 'nadh.1': 'lac' },
};

export const pyruvateDecarboxylase = {
  id: 'pdc',
  enzyme: 'Pyruvate decarboxylase',
  short: 'PDC',
  phase: 'ferment',
  blurb: 'Pyruvate loses its carboxylate as CO₂. The remainder is acetaldehyde.',
  co2: 1,
  in: { pyr: 'pyruvate', h: 'proton' },
  out: { ald: 'acetaldehyde', co2: 'co2' },
  map: {
    'pyr.C1': 'co2.C',
    'pyr.O1': 'co2.Oa',
    'pyr.O1b': 'co2.Ob',
    'pyr.C2': 'ald.C1',
    'pyr.O2': 'ald.O1',
    'pyr.C3': 'ald.C2',
    'h.H': 'ald.H1',
  },
};

export const alcoholDehydrogenase = {
  id: 'adh',
  enzyme: 'Alcohol dehydrogenase',
  short: 'ADH',
  phase: 'ferment',
  blurb: 'Acetaldehyde accepts the hydride from NADH and becomes ethanol. NAD⁺ returns to glycolysis.',
  in: { ald: 'acetaldehyde', nadh: 'nadh', h: 'proton' },
  out: { eth: 'ethanol', nad: 'nad' },
  map: {
    'ald.H1': 'eth.H1a',
    'nadh.H': 'eth.H1b',
    'nadh.body': 'nad.body',
    'h.H': 'eth.HO1',
  },
  eend: { 'nadh.0': 'eth', 'nadh.1': 'eth' },
};

export const FERMENTATION = [lactateDehydrogenase, pyruvateDecarboxylase, alcoholDehydrogenase];
