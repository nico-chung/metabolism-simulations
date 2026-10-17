// What the guide says on the Photosynthesis tab (M6 plan §8), edited at M8.8.
// Keyed by reaction id like the respiration table. `atom` is said for an
// atom, `electron` for an electron. A CO₂'s oxygens hear most of what its
// carbon hears, so the words say "your atom" unless only a carbon can be
// there. One or two sentences, at most 30 words.

export const PS_BEATS = {
  rubisco: {
    atom: 'RuBisCO fixes your carbon. CO₂ joins a five-carbon sugar, which splits at once into two 3-phosphoglycerates.',
    // An oxygen of the CO₂ being fixed.
    oxygen: 'RuBisCO fixes the CO₂ your oxygen is in. It joins a five-carbon sugar, which splits at once into two 3-phosphoglycerates.',
    // An atom already on the ring, coming round again in RuBP.
    lap: 'Your atom is in RuBP this time. RuBisCO turns it back into part of a 3-phosphoglycerate, ready to be reduced again.',
  },
  'rubisco-o2': {
    atom: 'RuBisCO took O₂ instead of CO₂. RuBP splits into one 3-phosphoglycerate and one two-carbon 2-phosphoglycolate, and no carbon is fixed.',
    // An oxygen of the O₂ itself.
    oxygen: 'RuBisCO took your O₂ instead of CO₂. One of its oxygens joins 2-phosphoglycolate; the other leaves as water.',
  },
  pgp: {
    atom: 'Phosphoglycolate phosphatase removes the phosphate. The phosphate remains in the stroma, and glycolate leaves the chloroplast.',
  },
  // C4's CO₂ pump (M7a).
  pepc: {
    atom: 'PEP carboxylase fixes your CO₂ onto PEP, making oxaloacetate, a four-carbon acid. Unlike RuBisCO, it never takes O₂.',
  },
  'mdh-nadp': {
    atom: 'NADPH reduces oxaloacetate to malate, the form in which your atom travels.',
    hand: 'Your electrons now hold a hydrogen to carbon 2 of malate. Follow the hydrogen.',
  },
  plasmo: {
    atom: 'Malate carries your atom through the plasmodesmata, channels in the wall that join the mesophyll cell to the bundle-sheath cell.',
  },
  me: {
    atom: 'Malic enzyme releases your atom again, in CO₂, beside RuBisCO in the bundle sheath. It has already been fixed once.',
    hydrogen: 'Malic enzyme hands your hydrogen, with its two electrons, to NADP⁺: NADPH again, now in the bundle sheath.',
    backbone: 'Malic enzyme removes CO₂ from malate. Your carbon remains in pyruvate, which returns to the mesophyll to carry another CO₂.',
  },
  ppdk: {
    atom: 'PPDK uses ATP to convert pyruvate back to PEP, ready to carry another CO₂. This ATP is the additional cost of C4 photosynthesis.',
  },
  'calvin-pgk': {
    atom: 'Phosphoglycerate kinase spends one ATP to put a phosphate on the carboxylate of 3-phosphoglycerate.',
  },
  'calvin-gapdh': {
    atom: 'NADPH transfers a hydride. Carbon 1 is reduced to an aldehyde: G3P, a three-carbon sugar.',
    hand: 'Your electrons now hold a hydrogen to carbon 1 of G3P. Follow the hydrogen.',
  },
  regen: {
    atom: 'Your atom is rearranged into a new RuBP, ready to fix another CO₂. Five three-carbon sugars become three five-carbon sugars.',
  },
  tpt: {
    atom: 'G3P leaves the chloroplast through the triose phosphate translocator, in exchange for a phosphate.',
  },
  hexose: {
    atom: 'Two G3P have joined into one glucose. Your carbon is carbon {n} of glucose.',
  },
  'psii-split': {
    atom: 'Photosystem II splits water. Your oxygen is released and bonds to a second oxygen, forming O₂.',
    electron: 'Water has just been split. Your electron waits in photosystem II’s manganese cluster.',
  },
  'psii-pq': {
    electron: 'Light lifts your electron. It leaves photosystem II on plastoquinone.',
  },
  b6f: {
    electron: 'Cytochrome b₆f pumps protons into the lumen as your electron passes, onto plastocyanin.',
  },
  psi: {
    electron: 'A second photon lifts your electron again, onto ferredoxin.',
  },
  fnr: {
    electron: 'Your electrons join a proton from the stroma on NADP⁺. This is NADPH.',
  },
  cyclic: {
    electron: 'Ferredoxin has returned your electron to plastoquinone. It will pass through b₆f again, which yields additional ATP without NADPH.',
  },
  synthase: {
    atom: 'The proton flows back out of the lumen through ATP synthase and turns the rotor. The knob makes ATP in the stroma.',
  },
};

// Beats that are not reactions.
export const PS_MOMENTS = {
  stoma: 'Your carbon enters the leaf as CO₂, through a stoma between two guard cells.',
  stomaOxygen: 'Your oxygen enters the leaf in CO₂, through a stoma between two guard cells.',
  airPepc: 'Your CO₂ leaves the air space inside the leaf and diffuses into the mesophyll cell, to PEP carboxylase.',
  sheath: 'Your CO₂ waits in the bundle sheath. The pump keeps CO₂ here many times as concentrated as in the air, so RuBisCO rarely takes O₂.',
  air: 'Your CO₂ leaves the air space inside the leaf and diffuses into the chloroplast, to RuBisCO. Gases need no transporter: they cross membranes on their own.',
  water: 'Your water came up from the roots through the xylem. Now it crosses the leaf cell into the thylakoid lumen, to photosystem II.',
  toRegen: 'This G3P remains in the cycle. Five of every six regenerate RuBP.',
  toExport: 'This G3P leaves the cycle. One in six is the cycle’s net product.',
};

// A molecule waiting in a station's hopper for the others it reacts with is
// not stuck (M8.8). Keyed by station.
export const HOPPER_WAITS = {
  regen: 'Your G3P waits until five have gathered. Regeneration rebuilds five three-carbon sugars into three RuBP at once.',
  hexose: 'Your G3P waits for a second one. Two G3P join into one glucose.',
  starch: 'Your G3P waits for a second one. Two G3P join into one glucose for the starch grain.',
  nightgly: 'Your glucose waits for night, when night glycolysis splits it to make PEP.',
};

export const PS_ENDINGS = {
  glucose: { title: 'Sugar for the plant', text: 'Your carbon came in from the air as CO₂. It leaves the cell as carbon {n} of a glucose, sugar for the rest of the plant.' },
  glucoseHydrogen: { title: 'Sugar for the plant', text: 'The electrons you followed came from water. Now they hold this hydrogen in a glucose, on its way to the rest of the plant.' },
  glucoseAtom: { title: 'Sugar for the plant', text: 'Your atom is part of a glucose, on its way to the rest of the plant.' },
  oxygenOut: { title: 'Out as O₂', text: 'Your oxygen came from water. It leaves the leaf as O₂, through a stoma.' },
  synthase: { title: 'Through ATP synthase', text: 'Your proton came from water, was released into the lumen, and flowed back through ATP synthase into the stroma, helping make one ATP.' },
  bulkProton: { title: 'Into the stroma', text: 'Your hydrogen joins the stroma’s pool of protons.' },
  stromaPi: { title: 'Into the stroma’s phosphate', text: 'Your oxygen left with the phosphate at G3P dehydrogenase. It joins the stroma’s phosphate, which ATP synthase will use again.' },
  bulkWater: { title: 'Into the cell’s water', text: 'Your atom joins the cell’s water. The guide stops following it here.' },
  electron: { title: 'Electron at rest', text: 'Your electron ends here.' },
  glycolate: { title: 'Lost to photorespiration', text: 'RuBisCO took O₂ instead of CO₂, so your carbon leaves the chloroplast in glycolate. The salvage pathway recovers most such carbon, but spends ATP and loses some as CO₂.' },
  glycolateOxygen: { title: 'Lost to photorespiration', text: 'RuBisCO took O₂ instead of CO₂, so your oxygen leaves the chloroplast in glycolate, for the salvage pathway in the peroxisome and mitochondrion.' },
};

// CAM's own words where the C4 pump's differ (M7b, §8.2): the same enzymes,
// split in time instead of between cells.
export const CAM_BEATS = {
  pepc: {
    atom: 'PEP carboxylase fixes your CO₂ onto PEP, making oxaloacetate. A CAM plant does this only at night, when open stomata lose little water.',
  },
  'mdh-nad': {
    atom: 'NADH from night glycolysis reduces oxaloacetate to malate, the acid the cell stores overnight.',
    hand: 'Your electrons now hold a hydrogen to carbon 2 of malate. Follow the hydrogen.',
  },
  dit: {
    atom: 'Malate enters the chloroplast through the dicarboxylate transporter.',
  },
  me: {
    atom: 'Malic enzyme releases your atom again, in CO₂, inside the closed leaf. It was fixed last night; now RuBisCO will fix it again.',
    hydrogen: 'Malic enzyme hands your hydrogen, with its two electrons, to NADP⁺: NADPH in the stroma.',
    backbone: 'Malic enzyme removes CO₂ from malate. Your carbon remains in pyruvate, which is converted back toward sugar.',
  },
  ppdk: {
    atom: 'PPDK uses ATP to convert pyruvate back to PEP. This ATP is part of the additional cost of CAM.',
  },
  pep3pg: {
    atom: 'Enolase and phosphoglycerate mutase, run backwards, turn PEP into 3-phosphoglycerate. Your atom joins the Calvin cycle without passing RuBisCO.',
  },
  nightgly: {
    atom: 'It is night. Glycolysis splits your glucose from the starch grain as far as PEP, making NADH on the way.',
  },
  starch: {
    atom: 'Two G3P have joined into one glucose. Your carbon is carbon {n} of glucose, stored in the starch grain.',
  },
};

export const CAM_MOMENTS = {
  airPepc: 'It is night, so the stomata are open. Your CO₂ leaves the air space and diffuses into the cytosol, to PEP carboxylase.',
  air: 'Your CO₂ is in the air space of the closed leaf. With the stomata shut, CO₂ released from malate builds up here, and RuBisCO takes it.',
  vacuole: 'Your atom is stored in the vacuole, in malate, until morning.',
  dawn: 'It is morning. The stomata have closed to save water, and malate leaves the vacuole for the chloroplast.',
  grain: 'Your atom is stored in the starch grain. Night glycolysis will draw on it after dark, or the rest of the plant will take it.',
  night: 'It is night: without light there is no ATP or NADPH, so the Calvin cycle has stopped. Your atom waits for daylight.',
};

// Turning points that are always worth a stop.
export const PS_KEY_BEATS = ['psii-split', 'psii-pq', 'b6f', 'psi', 'fnr', 'rubisco', 'rubisco-o2', 'calvin-gapdh', 'hexose', 'pepc', 'me', 'vacuole', 'dawn'];
