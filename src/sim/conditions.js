// Modes and conditions are patches to one network (PLAN §7.6, §16 D1, D10).
// A patch can close the O₂ supply, block a station (a poison), remove one (a
// missing gene product), slow one (a partly working enzyme), open a proton
// leak, or change the cell's ATP demand. Nothing after that is scripted.

export const MODES = {
  aerobic: { oxygen: true },
  lactic: { oxygen: false, demand: 'ferment' },
  ethanol: { oxygen: false, demand: 'ferment' },
  // The bacterium's anaerobic respiration: no O₂, nitrate instead (§17 D5).
  nitrate: { oxygen: false, nitrate: true },
  // A leaf has one mode; what changes it is light and its stomata (M6 plan E10).
  light: { light: true },
};

// Groups, in the order the rail shows them, each with the tab it belongs to.
export const GROUPS = [
  ['poison', 'Poisons', 'respiration'],
  ['physiology', 'Physiology', 'respiration'],
  ['mutation', 'Mutations', 'respiration'],
  ['disease', 'Diseases', 'respiration'],
  ['environment', 'Environment', 'photosynthesis'],
  ['herbicide', 'Herbicides', 'photosynthesis'],
  ['weed', 'Mutations', 'photosynthesis'],
];

export const CONDITIONS = {
  none: { label: 'None', scenes: ['human', 'yeast', 'bacterium', 'c3', 'c4', 'cam'] },
  cyanide: {
    group: 'poison',
    label: 'Cyanide',
    scenes: ['human', 'yeast', 'bacterium'],
    off: ['complex4'],
    text: 'Cyanide blocks Complex IV, so the chain cannot pass electrons to oxygen.',
    death: 'Complex IV is blocked, so the chain can no longer feed ATP synthase. Fermentation is not enough to meet this cell’s demand.',
    by: {
      bacterium: {
        text: 'Cyanide blocks cytochrome bo₃, the terminal oxidase, so the chain cannot pass electrons to oxygen.',
        death: 'With bo₃ blocked, NADH could not be reoxidized and glycolysis stopped too. This bacterium has no fermentation in this model, so it ran out of ATP.',
      },
    },
  },
  oligomycin: {
    group: 'poison',
    label: 'Oligomycin',
    scenes: ['human', 'yeast'],
    off: ['synthase'],
    text: 'Oligomycin blocks the proton channel of ATP synthase, the Fₒ part, which is named for it.',
    death: 'ATP synthase can no longer let protons back in, so the gradient fills and the pumps stop. The cell runs out of ATP.',
  },
  dnp: {
    group: 'poison',
    label: 'DNP',
    scenes: ['human', 'yeast', 'bacterium'],
    modes: ['aerobic', 'nitrate'],
    leak: { kind: 'dnp', rate: 200, heat: 1 },
    text: 'DNP carries protons back across the inner membrane, and the energy leaves as heat.',
    by: {
      bacterium: {
        text: 'DNP carries protons back from the periplasm across the inner membrane, and the energy leaves as heat.',
        death: 'Protons leaked back without making ATP. Glycolysis and the cycle alone could not keep up.',
      },
    },
    death: 'Protons leak back without making ATP. The energy leaves as heat, and the cell cannot keep up.',
  },
  ucp1: {
    group: 'physiology',
    label: 'UCP1 (brown fat)',
    scenes: ['human'],
    leak: { kind: 'ucp1', rate: 0.55, heat: 1 },
    eyebrow: 'Brown Fat',
    text: 'UCP1 lets protons through the inner membrane of brown fat. The cell releases the energy as heat.',
    death: 'The cell ran out of ATP.',
  },
  pdhd: {
    group: 'mutation',
    label: 'PDH deficiency',
    scenes: ['human'],
    rate: { pdh: 0.03 },
    eyebrow: 'PDH Deficiency',
    text: 'A mutation in PDHA1, on the X chromosome, leaves pyruvate dehydrogenase working at a fraction of its rate. Pyruvate backs up at the fork and becomes lactate even with oxygen present: congenital lactic acidosis.',
  },
  lhon: {
    group: 'mutation',
    label: 'LHON',
    scenes: ['human'],
    rate: { complex1: 0.17 },
    eyebrow: 'LHON',
    text: 'Leber hereditary optic neuropathy. A mutation in mitochondrial DNA, most often in the Complex I gene MT-ND4, slows Complex I. NADH backs up, electrons from succinate still enter at Complex II, and each glucose yields less ATP. In patients the optic nerve, with the highest demand, fails first.',
  },
  merrf: {
    group: 'mutation',
    label: 'MERRF',
    scenes: ['human'],
    rate: { complex1: 0.2, complex3: 0.2, complex4: 0.2, synthase: 0.2 },
    eyebrow: 'MERRF',
    text: 'Myoclonic epilepsy with ragged-red fibres. A mitochondrial tRNA mutation (MT-TK) leaves every protein made from mitochondrial DNA in short supply: parts of Complexes I, III and IV and of ATP synthase. The whole chain runs slow. Mitochondrial DNA comes from the mother, so this is inherited through her.',
  },
  petite: {
    group: 'mutation',
    label: 'Petite (ρ⁰)',
    scenes: ['yeast'],
    absent: ['complex3', 'complex4', 'synthase'],
    oxygen: false,
    eyebrow: 'Petite (ρ⁰)',
    // What the cell actually does, in place of the mode's equation.
    equation: 'C₆H₁₂O₆ + 2 ADP + 2 Pᵢ → 2 ethanol + 2 CO₂ + 2 ATP',
    text: 'This yeast has lost its mitochondrial DNA. Without it there is no cytochrome b for Complex III, no core of Complex IV, and no Fₒ for ATP synthase. The cell takes up no oxygen and lives by fermenting, even in air. Its colonies are small, hence the name.',
  },
  ischemia: {
    group: 'disease',
    label: 'Ischemia',
    scenes: ['human'],
    oxygen: false,
    eyebrow: 'Ischemia',
    text: 'Blood flow has stopped, as in a heart attack or a stroke, so no oxygen arrives. The cell still needs as much ATP as before. Choose None before the cell dies, and oxygen returns.',
    death: 'Without oxygen the chain stopped. Glycolysis and lactate alone could not meet the demand of a heart or brain cell.',
    resetWithout: 'Reset with blood flow restored',
  },
  beriberi: {
    group: 'disease',
    label: 'Beriberi',
    scenes: ['human'],
    rate: { pdh: 0.04, akgdh: 0.1 },
    eyebrow: 'Beriberi',
    text: 'Thiamine (vitamin B₁) deficiency. Thiamine pyrophosphate is a cofactor of pyruvate dehydrogenase and α-ketoglutarate dehydrogenase, so both slow down. Pyruvate turns to lactate even with oxygen present.',
  },
  darkness: {
    group: 'environment',
    label: 'Darkness',
    scenes: ['c3', 'c4', 'cam'],
    modes: ['light'],
    light: false,
    eyebrow: 'Darkness',
    text: 'No photons reach the photosystems. Without light no water is split, and no ATP or NADPH is made, so the Calvin cycle runs down and stops. The plant lives on the sugar it stored in the light, as it does every night. Only darkness that outlasts the store starves the cell.',
    death: 'The darkness outlasted the plant’s stored sugar. With no light, no ATP or NADPH was made, the Calvin cycle stayed stopped, and the cell starved. The model compresses this: a real plant can last days in the dark.',
    resetWithout: 'Reset with light',
    by: {
      cam: {
        text: 'The plant’s clock still keeps time, but no light comes. Each night the stomata open and the cell goes on storing CO₂ as malate, spending its starch to do it; each day they close, but there is no light to fix it. Once the vacuole is full the night machinery stops, and the plant lives on what is left in its starch grain.',
        death: 'No daylight came to fix the malate in the vacuole, and the starch grain ran out. The model compresses this: a real plant can last days in the dark.',
      },
    },
  },
  hotdry: {
    group: 'environment',
    label: 'Hot, dry day',
    scenes: ['c3', 'c4', 'cam'],
    modes: ['light'],
    stomata: 0.1,
    eyebrow: 'Hot, Dry Day',
    text: 'To save water the guard cells close the stoma. Less CO₂ gets in, and the O₂ that photosystem II makes builds up in the air space. RuBisCO takes O₂ more often: each time, two carbons leave as glycolate for the salvage pathway, and less sugar is made.',
    by: {
      c4: {
        text: 'To save water the guard cells close the stoma, and CO₂ in the air space falls. PEP carboxylase keeps pulling it in all the same, and the pump keeps the bundle sheath rich in CO₂, so RuBisCO still rarely takes O₂. A C4 leaf is barely affected, which is why maize and sugarcane grow well in hot, dry climates.',
      },
      cam: {
        text: 'Nothing changes: a CAM leaf keeps its stomata shut through the heat of the day anyway, and opens them only in the cool of the night. This is how pineapple and cacti live where water is scarcest.',
      },
    },
  },
  dcmu: {
    group: 'herbicide',
    label: 'DCMU',
    scenes: ['c3', 'c4', 'cam'],
    modes: ['light'],
    off: ['psii'],
    eyebrow: 'DCMU',
    text: 'DCMU (diuron) is a herbicide. It binds photosystem II where plastoquinone should, so electrons from water cannot leave. Photosystem II gives its light off as heat and fluorescence, no O₂ is made, and the Calvin cycle runs out of NADPH.',
    death: 'DCMU blocked photosystem II, so no electrons came from water and the Calvin cycle stopped. The cell starved when the plant’s stored sugar ran out. The model compresses this: a sprayed plant takes days to die.',
  },
  // D1 Ser264Gly (M6 plan C1, §9.4): resistant to triazines such as atrazine,
  // with little cross-resistance to DCMU, and a slower photosystem II.
  triazine: {
    group: 'weed',
    label: 'Triazine-resistant weed',
    scenes: ['c3', 'c4'],
    modes: ['light'],
    rate: { psii: 0.2 },
    eyebrow: 'Triazine-Resistant Weed',
    text: 'A single change in the D1 protein of photosystem II (serine 264 to glycine) stops atrazine from binding, so this weed survives fields sprayed with triazine herbicides. The cost is that electrons leave photosystem II more slowly. Without the herbicide it makes less sugar than its neighbours, which is why resistance stays rare until a herbicide is used.',
  },
};

// A condition's words for one scene: its own, with that scene's
// versions where the biology reads differently (bo₃ instead of Complex IV).
export function conditionCopy(id, sceneId) {
  const entry = CONDITIONS[id];
  if (!entry) return null;
  return { ...entry, ...(entry.by?.[sceneId] ?? {}) };
}

export function conditionApplies(id, sceneId, mode) {
  const entry = CONDITIONS[id];
  if (!entry) return false;
  if (id === 'none') return true;
  return (entry.modes ?? ['aerobic']).includes(mode) && entry.scenes.includes(sceneId);
}

// The world's patch: the mode's, then the condition's on top.
export function patchFor(mode, condition) {
  const base = MODES[mode] ?? MODES.aerobic;
  const entry = CONDITIONS[condition] ?? CONDITIONS.none;
  const off = {};
  const absent = {};
  for (const id of entry.off ?? []) off[id] = true;
  for (const id of entry.absent ?? []) absent[id] = true;
  return {
    oxygen: base.oxygen !== false && entry.oxygen !== false,
    nitrate: base.nitrate === true,
    light: base.light !== false && entry.light !== false,
    // How far the stomata are open: 1 open, lower on a hot, dry day (E9).
    stomata: (base.stomata ?? 1) * (entry.stomata ?? 1),
    demand: base.demand ?? 'aerobic',
    off,
    absent,
    rate: { ...(entry.rate ?? {}) },
    leak: entry.leak ? { ...entry.leak } : null,
  };
}

// What the stage marks, from the condition alone (never from a mode).
export function marksFor(condition) {
  const entry = CONDITIONS[condition];
  const marks = {};
  if (!entry) return marks;
  for (const id of entry.off ?? []) marks[id] = { kind: 'blocked' };
  for (const id of entry.absent ?? []) marks[id] = { kind: 'absent' };
  for (const [id, residual] of Object.entries(entry.rate ?? {})) marks[id] = { kind: 'impaired', residual };
  return marks;
}
