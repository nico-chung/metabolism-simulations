import { EQUATIONS, conditionCopy, conditionEquations } from '../sim/conditions.js';

// Names of processes standing alone as labels are in Title Case (§16 D9);
// sentences keep textbook lower case.
const RESPIRATION = {
  human: {
    aerobic: {
      eyebrow: 'Human · Aerobic Respiration',
      paragraphs: [
        'A human cell oxidizes glucose completely. Electrons from food reach oxygen, and the proton gradient drives ATP synthase.',
      ],
      equation: EQUATIONS.aerobic,
    },
    lactic: {
      eyebrow: 'Human · Lactic Acid Fermentation',
      paragraphs: [
        'With no oxygen the chain stops, NADH backs up in the mitochondrion, and pyruvate takes the other branch at the fork. Lactate dehydrogenase reduces it to lactate so NAD⁺ returns to glycolysis. The model sustains this indefinitely; a real muscle cell can sustain it only during brief, intense exertion.',
      ],
      equation: EQUATIONS.lactic,
    },
  },
  yeast: {
    aerobic: {
      eyebrow: 'Yeast · Aerobic Respiration',
      // Most of this yeast's glucose becomes ethanol even in air (M4, the
      // model's Crabtree effect), so it shows both routes.
      paragraphs: [
        'Baker’s yeast, Saccharomyces cerevisiae, is a eukaryote with a nucleus, a cell wall and mitochondria. In air it can oxidize glucose completely; its chain is drawn as in the human cell. When glucose is plentiful, most of it still becomes ethanol: the Crabtree effect.',
      ],
      equation: [EQUATIONS.aerobic, EQUATIONS.ethanol],
    },
    ethanol: {
      eyebrow: 'Yeast · Ethanol Fermentation',
      paragraphs: [
        'With no oxygen the mitochondrion stops and pyruvate takes the other branch at the fork. It loses a carbon as CO₂ and becomes acetaldehyde, which is reduced to ethanol so NAD⁺ returns to glycolysis. A yeast cell can survive on these 2 ATP per glucose.',
      ],
      equation: EQUATIONS.ethanol,
    },
  },
};

RESPIRATION.bacterium = {
  aerobic: {
    eyebrow: 'Bacterium · Aerobic Respiration',
    paragraphs: [
      'Escherichia coli has no mitochondrion. Glycolysis, pyruvate oxidation and the citric acid cycle run in the cytoplasm, and the chain sits in the inner membrane, pumping protons into the periplasm. Mitochondria descend from bacteria like this one: the same pumps, the same ATP synthase.',
    ],
    equation: 'C₆H₁₂O₆ + 6 O₂ → 6 CO₂ + 6 H₂O + about 26 ATP',
  },
  nitrate: {
    eyebrow: 'Bacterium · Anaerobic Respiration',
    paragraphs: [
      'Without oxygen, E. coli can still respire. Nitrate takes oxygen’s place as the final electron acceptor and becomes nitrite. The chain still pumps protons, though fewer, so each glucose still yields far more ATP than fermentation. This is not fermentation: there is still an electron transport chain.',
    ],
    equation: 'C₆H₁₂O₆ + 12 NO₃⁻ → 6 CO₂ + 6 H₂O + 12 NO₂⁻ + about 20 ATP',
  },
};

// Each pathway's words and net equation (M6 plan §7, D12). The equation
// counts the water split at photosystem II, as Campbell writes it.
const PATHWAYS = {
  c3: {
    eyebrow: 'C3 Photosynthesis',
    paragraphs: [
      'A C3 leaf, such as rice, wheat, or soybean. Light splits water at photosystem II, and its electrons pass down the thylakoid membrane to NADPH, pumping protons that drive ATP synthase. The Calvin cycle spends that ATP and NADPH to fix CO₂ with RuBisCO. One G3P in six leaves the chloroplast and becomes sugar for the rest of the plant.',
    ],
    equation: '6 CO₂ + 12 H₂O + light → C₆H₁₂O₆ + 6 O₂ + 6 H₂O',
  },
  c4: {
    eyebrow: 'C4 Photosynthesis',
    paragraphs: [
      'A C4 leaf, such as maize or sugarcane. In the mesophyll cell, PEP carboxylase fixes CO₂ into a four-carbon acid; malate carries it through the plasmodesmata into the bundle-sheath cell, where malic enzyme releases it right beside RuBisCO. The pump keeps CO₂ high around RuBisCO, so it rarely takes O₂, even when the stomata close. The cost is additional ATP: five per CO₂ instead of three, supplied by additional cyclic electron flow.',
    ],
    equation: '6 CO₂ + 12 H₂O + light → C₆H₁₂O₆ + 6 O₂ + 6 H₂O',
  },
  cam: {
    eyebrow: 'CAM Photosynthesis',
    paragraphs: [
      'A CAM leaf, such as pineapple or a cactus, takes in CO₂ at night, when opening its stomata costs little water. Night glycolysis breaks down stored starch to PEP, PEP carboxylase fixes CO₂ onto it, and the malate made is stored in the vacuole. By day the stomata stay shut; malate comes back out, malic enzyme releases its CO₂ inside the closed leaf, and the Calvin cycle fixes it with the ATP and NADPH light makes. The pyruvate goes back to starch. The cost is about six ATP per CO₂, the highest of the three pathways.',
    ],
    equation: '6 CO₂ + 12 H₂O + light → C₆H₁₂O₆ + 6 O₂ + 6 H₂O',
  },
};

// The inspector's resting card: an eyebrow, paragraphs, and the equation
// lines of what the cell does under its condition (none, one or two).
export function describeSelection(state) {
  if (state.tab === 'photosynthesis') {
    const pathway = PATHWAYS[state.pathway] ?? PATHWAYS.c3;
    const entry = conditionCopy(state.condition, state.pathway);
    if (!entry?.text) return { ...pathway, equations: [pathway.equation] };
    return {
      ...pathway,
      eyebrow: entry.eyebrow ? `${pathway.eyebrow} · ${entry.eyebrow}` : pathway.eyebrow,
      paragraphs: [...pathway.paragraphs, entry.text],
      equations: conditionEquations(entry, state.mode, pathway.equation),
    };
  }
  const book = RESPIRATION[state.organism] ?? RESPIRATION.human;
  const view = book[state.mode] ?? book.aerobic;
  const entry = conditionCopy(state.condition, state.organism);
  if (!entry?.text) return { ...view, equations: [view.equation].flat() };
  const [organism, ...rest] = view.eyebrow.split(' · ');
  const eyebrow = entry.eyebrow ? [organism, entry.eyebrow, ...rest].join(' · ') : view.eyebrow;
  return { ...view, eyebrow, paragraphs: [...view.paragraphs, entry.text], equations: conditionEquations(entry, state.mode, view.equation) };
}

export function pathwayTitle(pathway) {
  if (pathway === 'c4') return 'C4 Photosynthesis';
  if (pathway === 'cam') return 'CAM Photosynthesis';
  return 'C3 Photosynthesis';
}
