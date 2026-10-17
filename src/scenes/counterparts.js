// Counterparts between the two tabs (PLAN §5.8, M8 plan §1 and M8.4). The
// pairs go by position in the chain, not by chemistry: Complex I stands where
// photosystem II stands, though photosystem II's chemistry is Complex IV's run
// backwards. Where position and chemistry disagree, the card's line says both.

// Respiration id, photosynthesis id. Stations, zones (the two rings) and loops
// (the two buses). The bacterium's NDH-1 is `complex1` and its bo₃ is
// `complex4`; it has no Complex III, so b₆f has nothing to point to there.
export const PAIRS = [
  ['complex1', 'psii'],
  ['complex3', 'b6f'],
  ['complex4', 'psi'],
  ['synthase', 'synthase'],
  ['krebs', 'calvin'],
  ['bus', 'sbus'],
];

export const RESPIRATION_SCENES = ['human', 'yeast', 'bacterium'];
export const PHOTOSYNTHESIS_SCENES = ['c3', 'c4', 'cam'];
// Ids a scene lacks although its tab has them.
export const ABSENT = { bacterium: ['complex3'] };

// The stations on each ring, which all carry the ring's line. Complex II is a
// step of the cycle that sits in the membrane; phosphoglycolate phosphatase is
// photorespiration, not the Calvin cycle.
export const RINGS = {
  krebs: ['cs', 'aconitase', 'idh', 'akgdh', 'scs', 'complex2', 'fumarase', 'mdh'],
  calvin: ['rubisco', 'pgk', 'gapdh', 'regen'],
};

const KREBS = 'The Calvin cycle is the other ring: it fixes CO₂ where this cycle releases it, and spends ATP and NADPH where this one makes ATP and NADH.';
const CALVIN = 'The citric acid cycle is the other ring: it releases CO₂ where this cycle fixes it, and makes NADH and ATP where this one spends NADPH and ATP.';

// One line per card, keyed by tab and then station id. A scene's own entry
// (the bacterium's bo₃ and synthase) wins over its tab's.
export const LINES = {
  respiration: {
    complex1: 'In photosynthesis, photosystem II stands here: it too hands electrons to a quinone, but takes them from water, lifted by light. NADP⁺ reductase runs this NADH step backwards.',
    complex3: 'In photosynthesis, cytochrome b₆f does this job: it takes electrons from plastoquinol, releases protons into the thylakoid lumen and passes the electrons to plastocyanin, a small carrier like cytochrome c.',
    complex4: 'In photosynthesis, photosystem I stands here, taking electrons from plastocyanin as Complex IV takes them from cytochrome c. Photosystem II runs the oxygen chemistry backwards, making O₂.',
    synthase: 'The chloroplast\'s ATP synthase is the same machine. There, protons flow back from the thylakoid lumen into the stroma, where the ATP is made.',
    ...Object.fromEntries(RINGS.krebs.map((id) => [id, KREBS])),
  },
  photosynthesis: {
    psii: 'In respiration, Complex I stands here: it too hands electrons to a quinone. The chemistry is Complex IV\'s run backwards: water into O₂, not O₂ into water.',
    b6f: 'In respiration, Complex III does this job, with cytochrome c in place of plastocyanin. Both take electrons from a quinol and move protons across the membrane.',
    psi: 'In respiration, Complex IV stands here, taking electrons from cytochrome c as photosystem I takes them from plastocyanin. Complex IV gives them to O₂; here light lifts them to ferredoxin.',
    fnr: 'Respiration runs this step the other way: Complex I takes the hydride off NADH, and NADP⁺ reductase puts one on NADP⁺.',
    synthase: 'The mitochondrion\'s ATP synthase is the same machine. There, protons flow back from the intermembrane space into the matrix (in a bacterium, from the periplasm into the cytoplasm).',
    ...Object.fromEntries(RINGS.calvin.map((id) => [id, CALVIN])),
  },
  bacterium: {
    complex4: 'In photosynthesis, photosystem I stands at this end of the chain. bo₃ takes electrons straight from ubiquinol, with no Complex III or cytochrome c; photosystem I takes them from plastocyanin.',
    synthase: 'The chloroplast\'s ATP synthase is the same machine. Here protons flow from the periplasm into the cytoplasm; there, from the thylakoid lumen into the stroma, where ATP is made.',
  },
};

export function tabOf(sceneId) {
  return PHOTOSYNTHESIS_SCENES.includes(sceneId) ? 'photosynthesis' : 'respiration';
}

// The line for a station's card in a scene, or '' if it has none.
export function counterpartLine(sceneId, stationId) {
  return LINES[sceneId]?.[stationId] ?? LINES[tabOf(sceneId)][stationId] ?? '';
}

// The station card's comparison section: a title naming the other tab, and
// the line. Null if the station has no line.
export function counterpartCard(sceneId, stationId) {
  const text = counterpartLine(sceneId, stationId);
  if (!text) return null;
  const other = tabOf(sceneId) === 'respiration' ? 'photosynthesis' : 'respiration';
  return { title: `Compare with ${other}`, text };
}

// The id in the other tab that stands where `id` stands, or null.
export function counterpartOf(sceneId, id) {
  const side = tabOf(sceneId) === 'respiration' ? 0 : 1;
  return PAIRS.find((pair) => pair[side] === id)?.[1 - side] ?? null;
}
