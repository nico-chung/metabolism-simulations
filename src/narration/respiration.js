// What the guide says when a followed atom or electron passes a station.
// Keyed by reaction id. `atom` is said for an atom, `electron` for an
// electron; either may be missing, and then that step is passed silently.
// `roles` holds words for an atom that came in as one reactant (an oxygen of
// O₂ at Complex IV), and `released` for an atom leaving in CO₂. The same
// words are never said twice in one journey. One or two sentences, at most
// 30 words, present tense (M8.8).

export const BEATS = {
  hexokinase: {
    atom: 'Hexokinase transfers a phosphate from ATP to carbon 6. The charged sugar can no longer leave the cell.',
  },
  pfk: {
    atom: 'Phosphofructokinase transfers a phosphate from a second ATP to carbon 1. The sugar now carries a phosphate at each end.',
  },
  aldolase: {
    atom: 'Aldolase splits the six-carbon sugar into two three-carbon halves.',
  },
  tpi: {
    atom: 'Triose phosphate isomerase converts DHAP to G3P, so both halves continue along the same pathway.',
  },
  gapdh: {
    atom: 'GAPDH oxidizes carbon 1 and adds a phosphate. Two electrons and a hydrogen leave on NADH.',
    electron: 'Your electrons have been removed from carbon 1 of G3P. NADH now carries them.',
  },
  pgk: {
    atom: 'The phosphate on carbon 1 passes to ADP. This is the first ATP glycolysis makes.',
  },
  pk: {
    atom: 'Pyruvate kinase makes a second ATP. The sugar is now pyruvate, the end of glycolysis.',
  },
  pdh: {
    atom: 'Oxygen is present, so pyruvate enters the mitochondrion. There one carbon is removed as CO₂, and your atom is joined to coenzyme A.',
    released: 'Oxygen is present, so pyruvate enters the mitochondrion. Pyruvate dehydrogenase removes its carboxyl group as CO₂, and your atom leaves with it.',
    electron: 'Your electrons have been removed from pyruvate. NADH now carries them.',
  },
  cs: {
    atom: 'Citrate synthase joins your two-carbon acetyl group to oxaloacetate, making citrate. A turn of the cycle begins.',
    roles: {
      oaa: 'One full turn, and your atom is still in the cycle, now in oxaloacetate. The CO₂ released on that turn came from carbons already there.',
    },
  },
  idh: {
    atom: 'Isocitrate dehydrogenase releases a CO₂ and makes NADH. Your atom stays, in α-ketoglutarate.',
    released: 'Isocitrate dehydrogenase removes a carboxyl group as CO₂, and your atom leaves with it.',
    electron: 'Your electrons have been removed from isocitrate. NADH now carries them.',
  },
  akgdh: {
    atom: 'α-Ketoglutarate dehydrogenase releases the turn’s second CO₂ and makes another NADH. Your atom stays, in succinyl-CoA.',
    released: 'α-Ketoglutarate dehydrogenase removes a carboxyl group as CO₂, and your atom leaves with it.',
    electron: 'Your electrons have been removed from α-ketoglutarate. NADH now carries them.',
  },
  scs: {
    atom: 'Succinyl-CoA synthetase releases coenzyme A and makes one ATP.',
  },
  sdh: {
    atom: 'Succinate gives two hydrogens to FAD inside Complex II. A double bond forms.',
    electron: 'Your electrons have been removed from succinate. They remain inside Complex II, on FAD.',
  },
  mdh: {
    atom: 'Malate dehydrogenase makes the last NADH of the turn and remakes oxaloacetate.',
    electron: 'Your electrons have been removed from malate. NADH now carries them.',
  },
  shuttle: {
    atom: 'The shuttle carries your hydrogen, a hydride with its two electrons, across the inner membrane to an NAD⁺ in the matrix.',
    electron: 'The shuttle carries your electrons across the inner membrane to a matrix NADH.',
  },
  complex1: {
    atom: 'Complex I takes NADH’s two electrons. The hydrogen stays behind in the matrix as a proton.',
    electron: 'Complex I passes your electrons to ubiquinone, and pumps four protons across the membrane.',
  },
  qsite: {
    electron: 'FAD hands your electrons to ubiquinone. Complex II pumps no protons.',
  },
  complex3: {
    electron: 'Complex III separates the pair: each cytochrome c accepts one electron, and protons are pumped across the membrane.',
  },
  cytdeliver: {
    electron: 'Cytochrome c carries your electron along the membrane to Complex IV.',
  },
  oxidase: {
    atom: 'At Complex IV this proton joins four electrons and O₂ to make water.',
    roles: {
      o2: 'Complex IV splits your O₂. With four electrons and four protons, its two oxygens become two water molecules.',
    },
    electron: 'At Complex IV four electrons, four protons and O₂ make two water molecules. Your electron ends here.',
  },
  synthase: {
    atom: 'The proton returns through the stator and turns the rotor. The catalytic knob makes ATP.',
  },
  ldh: {
    atom: 'Pyruvate accepts the hydride from NADH and becomes lactate. This returns NAD⁺ to glycolysis, which can continue to make ATP.',
    electron: 'Both electrons from NADH end on lactate. They do not go on to oxygen.',
  },
  pdc: {
    atom: 'Pyruvate decarboxylase removes the carboxyl group as CO₂. Your atom remains, in acetaldehyde.',
    released: 'Pyruvate decarboxylase removes the carboxyl group as CO₂, and your atom leaves with it.',
  },
  adh: {
    atom: 'Acetaldehyde accepts the hydride from NADH and becomes ethanol. This returns NAD⁺ to glycolysis, which can continue to make ATP.',
    electron: 'Both electrons from NADH end on ethanol. They do not go on to oxygen.',
  },
};

// Endings, by what the followed thing became. `{atom}` is the element's
// name: carbon, oxygen or hydrogen.
export const ENDINGS = {
  co2: { title: 'Out of the cell', text: 'Your {atom} leaves the cell in carbon dioxide, which the lungs exhale.' },
  water: { title: 'Out as water', text: 'Your {atom} leaves the cell in a water molecule made at Complex IV.' },
  bulkWater: { title: 'Into the cell’s water', text: 'Your atom joins the cell’s water. The guide stops following it here.' },
  bulkProton: { title: 'One proton among many', text: 'Your hydrogen leaves as a proton, H⁺, and joins the cell’s pool of protons.' },
  synthase: { title: 'Through ATP synthase', text: 'Your proton flowed back through ATP synthase and helped make one ATP. It joins the matrix’s protons.' },
  bulkPi: { title: 'Into the cell’s phosphate', text: 'Your atom joins the cell’s phosphate pool.' },
  electron: { title: 'Electron at rest', text: 'Your electron ends on oxygen. Electrons removed from food end in water.' },
  lactate: { title: 'Out as lactate', text: 'Your atoms leave the cell as lactate, through the transporter in the plasma membrane.' },
  oxygenOut: { title: 'Back out as O₂', text: 'The oxygen supply stopped before your O₂ reached Complex IV, so it diffused back out of the cell, unused.' },
  ethanol: { title: 'Out as ethanol', text: 'Your atoms leave the cell as ethanol. It diffuses across the plasma membrane.' },
  lactateElectron: { title: 'Electron at rest', text: 'Your electron ends on lactate. In fermentation it does not travel on to oxygen.' },
  ethanolElectron: { title: 'Electron at rest', text: 'Your electron ends on ethanol. In fermentation it does not travel on to oxygen.' },
};

// Yeast breathes out nothing: its CO₂ raises bread.
export const YEAST_ENDINGS = {
  co2: { title: 'Out of the cell', text: 'Your {atom} leaves the cell in carbon dioxide, the gas that leavens bread dough.' },
};

// The bacterium (§17): where its words differ from a mitochondrion's. There
// is no matrix, no Complex III and no cytochrome c, and nitrate can take
// oxygen's place.
export const BACTERIAL_BEATS = {
  pdh: {
    atom: 'Pyruvate dehydrogenase removes one carbon as CO₂, and your atom is joined to coenzyme A. Bacteria have no mitochondria: this occurs in the cytoplasm.',
    released: 'Pyruvate dehydrogenase removes the carboxyl group as CO₂, and your atom leaves with it. Bacteria have no mitochondria: this occurs in the cytoplasm.',
    electron: BEATS.pdh.electron,
  },
  ndh1: {
    atom: 'NDH-1, the bacterial Complex I, takes NADH’s two electrons. The hydrogen stays behind in the cytoplasm as a proton.',
    electron: 'NDH-1 passes your electrons to ubiquinone and pumps four protons out into the periplasm.',
  },
  'bo3-quinol': {
    atom: 'Ubiquinol gives up this hydrogen as a proton, out into the periplasm.',
    electron: 'Ubiquinol hands your electron straight to cytochrome bo₃. There is no Complex III and no cytochrome c here.',
  },
  bo3: {
    atom: 'At cytochrome bo₃ this proton joins electrons and O₂ to make water.',
    roles: {
      o2: 'Cytochrome bo₃ splits your O₂. With four electrons and four protons, its two oxygens become two water molecules.',
    },
    electron: 'At cytochrome bo₃ four electrons, four protons and O₂ make two water molecules. Your electron ends here.',
  },
  'nar-quinol': {
    atom: 'Ubiquinol gives up this hydrogen as a proton, out into the periplasm.',
    electron: 'Ubiquinol hands your electron to nitrate reductase, which will pass it to nitrate instead of oxygen.',
  },
  nar: {
    atom: 'Nitrate reductase takes one oxygen off nitrate as water. The nitrogen goes from +5 to +3 and leaves as nitrite.',
    electron: 'Nitrate reductase puts your electron on nitrate, which becomes nitrite. Your electron ends here, not on oxygen.',
  },
  synthase: {
    atom: 'The proton returns from the periplasm through the stator and turns the rotor. The catalytic knob makes ATP.',
  },
};

export const BACTERIAL_ENDINGS = {
  co2: { title: 'Out of the cell', text: 'Your {atom} leaves the cell in carbon dioxide. Gases cross the membranes on their own.' },
  water: { title: 'Out as water', text: 'Your {atom} leaves the cell in a water molecule made at the end of the chain.' },
  bulkProton: { title: 'Into the cytoplasm', text: 'Your hydrogen joins the cytoplasm’s pool of protons.' },
  synthase: { title: 'Through ATP synthase', text: 'Your proton flowed back through ATP synthase and helped make one ATP. It joins the cytoplasm’s protons.' },
  oxygenOut: { title: 'Back out as O₂', text: 'The oxygen supply stopped before your O₂ reached cytochrome bo₃, so it diffused back out of the cell, unused.' },
  nitrite: { title: 'Out as nitrite', text: 'Your atom leaves the cell in nitrite, through NarK. Bacteria such as this one reduce nitrate to nitrite in soil and in the gut.' },
  nitrateOut: { title: 'Back out as nitrate', text: 'The nitrate supply stopped before your nitrate reached nitrate reductase, so it went back out of the cell, unused.' },
  nitriteElectron: { title: 'Electron at rest', text: 'Your electron ends on nitrite. Without oxygen, nitrate was the final electron acceptor.' },
};

export const SPLIT = {
  title: 'Proton and electrons part',
  text: 'Your hydrogen stays in the matrix as a proton. Its two electrons go on to ubiquinone.',
  choices: [
    { id: 'electrons', label: 'Follow the electrons' },
    { id: 'proton', label: 'Follow the proton' },
  ],
};
