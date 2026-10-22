// The model notes (PLAN §5.11, §8.9): the simplifications the model makes,
// grouped by topic and filtered to the scene. A note that quotes a tuned
// value reads it from the code, so the two cannot drift apart.

import { camScene } from '../scenes/cam.js';
import { c3Scene } from '../scenes/c3.js';
import { PHOTOSYNTHESIS_SCENES, RESPIRATION_SCENES } from '../scenes/counterparts.js';
import { CONDITIONS } from '../sim/conditions.js';

export const TOPICS = [
  'General',
  'Chain and ATP synthase',
  'Glycolysis, pyruvate and the cycle',
  'Fermentation',
  'The bacterium',
  'Respiration conditions',
  'Light reactions',
  'Calvin cycle and sugar',
  'Air and photorespiration',
  'C4',
  'CAM',
  'Photosynthesis conditions',
];

export const SCENE_IDS = [...RESPIRATION_SCENES, ...PHOTOSYNTHESIS_SCENES];

const SCENE_GROUPS = { all: SCENE_IDS, respiration: RESPIRATION_SCENES, photosynthesis: PHOTOSYNTHESIS_SCENES };

export const percent = (fraction) => `${Math.round(fraction * 100)}%`;

const PARTS = ['', 'whole', 'half', 'third', 'quarter', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];

// "a tenth", "two-thirds", or a percentage when no simple fraction fits.
export function fractionWords(fraction) {
  for (let n = 2; n < PARTS.length; n++) {
    const k = Math.round(fraction * n);
    if (k < 1 || k >= n || Math.abs(fraction - k / n) > 1e-9) continue;
    if (k === 1) return `a ${PARTS[n]}`;
    if (k === 2) return `two-${PARTS[n]}s`;
    return `${percent(fraction)}`;
  }
  return percent(fraction);
}

const rate = (id) => CONDITIONS[id].rate;
const rubisco = () => c3Scene.gas.draws.find((draw) => draw.station === 'rubisco').specificity;
const reserve = () => c3Scene.life;

export const NOTES = [
  // General
  { topic: 'General', scenes: 'all', text: 'Pathways and counts follow a standard first-year textbook. Where researchers still disagree, the picture uses the textbook account.' },
  { topic: 'General', scenes: 'all', text: 'The drawing is flat, in two dimensions, and not to scale. Sugars are drawn open-chain.' },
  { topic: 'General', scenes: 'all', text: 'Proton counts are whole numbers, and 4 H⁺ return through ATP synthase for each ATP.' },
  { topic: 'General', scenes: 'all', text: 'Protons are drawn as bare H⁺. Hydrogens on hydroxyl and carboxyl groups stay put, although in water they exchange.' },
  { topic: 'General', scenes: 'all', text: 'Pumped protons move at random in the intermembrane space, the periplasm or the thylakoid lumen, with a slight drift toward ATP synthase that represents the net flow the gradient drives. Real protons diffuse so fast that the space is effectively evenly mixed.' },
  { topic: 'General', scenes: 'all', text: 'The proton gradient is drawn as a count of protons. The real proton-motive force has two parts: the difference in pH and the electrical charge across the membrane.' },
  { topic: 'General', scenes: 'all', text: 'Water and gases cross membranes without a protein. Aquaporins are not drawn.' },
  { topic: 'General', scenes: 'all', text: 'Carriers, enzymes and the molecules each cycle starts from never wear out. They ride closed loops and are used again.' },
  { topic: 'General', scenes: 'all', text: 'Belts and loops move only while something flows along them. A belt shows net flux, not the jostling of single molecules, so when a pathway stops its tracks come to rest. Carrier loops run faster than the belts that carry sugars, and the ATP loops beside ATP synthase run fastest.' },
  { topic: 'General', scenes: 'all', text: 'There is no enzyme regulation, no kinetics, and no free-energy values.' },
  { topic: 'General', scenes: 'all', text: 'A blocked station has a dark red cross, an absent one a dashed outline, and an enzyme that only partly works a bar showing how much still works.' },
  { topic: 'General', scenes: 'all', text: 'The guide stops following an atom once it joins the cell’s water, phosphate or protons. The atom itself continues.' },

  // Chain and ATP synthase
  { topic: 'Chain and ATP synthase', scenes: ['human'], text: 'Human aerobic respiration is counted at about 32 ATP per glucose. Textbooks give about 30 or 32: cells that pass cytosolic NADH’s electrons in through the glycerol-phosphate shuttle hand them to FAD and make about 1 ATP less for each.' },
  { topic: 'Chain and ATP synthase', scenes: ['yeast'], text: 'Yeast is drawn with the same chain as a human mitochondrion. Baker’s yeast, Saccharomyces cerevisiae, has no proton-pumping Complex I. It does have a nucleus, a cell wall outside the plasma membrane, and a bud that shares the mother cell’s cytoplasm through a neck.' },
  { topic: 'Chain and ATP synthase', scenes: ['human', 'yeast'], text: 'The inner membrane is drawn as one straight strip. In a real mitochondrion it folds into cristae, which fit many more chains and ATP synthases.' },
  { topic: 'Chain and ATP synthase', scenes: ['human', 'yeast'], text: 'Complex III is shown passing ubiquinol’s two electrons to two cytochrome c, one each. The Q cycle inside it is not drawn.' },
  { topic: 'Chain and ATP synthase', scenes: ['human', 'yeast'], text: 'O₂ comes in at the top of the cell and diffuses straight through both mitochondrial membranes to Complex IV. When the supply stops, O₂ that has not yet reached Complex IV diffuses back out.' },
  { topic: 'Chain and ATP synthase', scenes: ['human', 'yeast'], text: 'Water made at Complex IV leaves through the top of the cell. Water used and made elsewhere is the cell’s own water. The ledger counts the net, 6 per glucose.' },
  { topic: 'Chain and ATP synthase', scenes: ['human', 'yeast'], text: 'The translocase is drawn swapping one ATP for one ADP and one phosphate. All four protons per ATP are drawn passing through the rotor, although one of them in fact pays for importing the phosphate.' },
  { topic: 'Chain and ATP synthase', scenes: ['human', 'yeast'], text: 'The ATP level is the cytosol’s. The mitochondrion’s own ATP and ADP are not counted.' },

  // Glycolysis, pyruvate and the cycle
  { topic: 'Glycolysis, pyruvate and the cycle', scenes: 'respiration', text: 'Glucose comes in only as fast as the cell uses the pyruvate it already has. Real cells do this by slowing hexokinase and phosphofructokinase when they have plenty.' },
  { topic: 'Glycolysis, pyruvate and the cycle', scenes: 'respiration', text: 'The cell’s ATP is spent at two “cell work” stations. A real cell spends it everywhere.' },
  { topic: 'Glycolysis, pyruvate and the cycle', scenes: ['human', 'yeast'], text: 'Cytosolic NADH hands its electrons to the chain through one stand-in shuttle, and the NAD⁺ comes back to glycolysis. The pyruvate carrier also moves a proton with each pyruvate; that proton is not counted.' },
  { topic: 'Glycolysis, pyruvate and the cycle', scenes: 'respiration', text: 'The citric acid cycle is shown making ATP. Many tissues make GTP there. FAD stays bound inside succinate dehydrogenase (Complex II).' },

  // Fermentation
  { topic: 'Fermentation', scenes: ['human', 'yeast'], text: 'Pyruvate forks in the cytosol. It goes into the mitochondrion unless three pyruvates are already waiting there; only then does it turn to lactate dehydrogenase or pyruvate decarboxylase. So a healthy cell never ferments, and any cell whose mitochondrion backs up does.' },
  { topic: 'Fermentation', scenes: ['human', 'yeast'], text: 'On the cytosol’s NAD loop the fermentation enzyme comes before the NADH shuttle, but it takes NADH only while its own substrate is waiting. In a healthy cell every NADH goes on to the shuttle.' },
  { topic: 'Fermentation', scenes: ['human', 'yeast'], text: 'Without oxygen the model only closes the O₂ supply. The chain stops, NADH builds up, and pyruvate dehydrogenase and the citric acid cycle stop for lack of NAD⁺; nothing else is switched off. ADP and phosphate wait at the translocase. A real cell also stops ATP synthase running backwards with a small inhibitor protein, IF1; here it stops.' },
  { topic: 'Fermentation', scenes: ['human', 'yeast'], text: 'When cell work runs short of ATP the glucose port opens sooner and lets more sugar in at once. That is this model’s Pasteur effect. A yeast cell can live on the 2 ATP of fermentation. A human cell cannot meet its usual demand that way.' },
  { topic: 'Fermentation', scenes: ['human', 'yeast'], text: 'Lactate leaves through a transporter in the plasma membrane. Ethanol diffuses out. Yeast’s fermentation CO₂ rises in the cytosol, beside the mitochondrion, and leaves through the top of the cell.' },
  { topic: 'Fermentation', scenes: ['human'], text: 'Fermentation is shown running steadily. A real muscle cell can sustain it only during brief, intense exertion.' },
  { topic: 'Fermentation', scenes: ['yeast'], text: 'With air, this yeast still turns most of its glucose into ethanol. Its demand is low enough that the proton gradient fills and the chain backs up, so pyruvate spills to fermentation. That is the model’s version of the Crabtree effect.' },

  // The bacterium
  { topic: 'The bacterium', scenes: ['bacterium'], text: 'The bacterial chain is a simplified textbook version, and its citric acid cycle does not change when nitrate is the acceptor. One quinone pool is drawn, although E. coli uses ubiquinone in air and menaquinone without it.' },
  { topic: 'The bacterium', scenes: ['bacterium'], text: 'E. coli’s chain: NDH-1 (the bacterial Complex I) pumps 4 H⁺ per NADH. Cytochrome bo₃ takes ubiquinol directly, with no Complex III and no cytochrome c: 4 H⁺ per pair reach the periplasm there, so 8 per NADH and 4 per FADH₂. Nitrate reductase releases ubiquinol’s 2 H⁺ and pumps none: 6 per NADH and 2 per FADH₂.' },
  { topic: 'The bacterium', scenes: ['bacterium'], text: 'With 4 H⁺ per ATP that gives, per glucose, 22 ATP from ATP synthase in air and 16 with nitrate, plus 4 by substrate-level phosphorylation: about 26 and 20 in all. Fermentation gives 2. Real figures vary with growth conditions; the order does not.' },
  { topic: 'The bacterium', scenes: ['bacterium'], text: 'Both terminal enzymes are drawn in the membrane all the time, and each works only when its acceptor is supplied. A real cell makes nitrate reductase only when oxygen is missing and nitrate is present.' },
  { topic: 'The bacterium', scenes: ['bacterium'], text: 'Nitrate is an ion, so it crosses the outer membrane through a porin and the inner membrane through NarK, which swaps it for the nitrite made inside.' },
  { topic: 'The bacterium', scenes: ['bacterium'], text: 'E. coli takes glucose up through its phosphotransferase system, which spends PEP rather than ATP to phosphorylate it. The model brings glucose in through a transporter and phosphorylates it with hexokinase, as in the other cells.' },
  { topic: 'The bacterium', scenes: ['bacterium'], text: 'Mixed-acid fermentation is not modelled, so the bacterium cannot ferment here; blocking its chain is lethal.' },
  { topic: 'The bacterium', scenes: 'respiration', text: 'Mitochondria descend from bacteria. That is why the bacterium’s chain, proton gradient and ATP synthase look so like the mitochondrion’s.' },

  // Respiration conditions
  { topic: 'Respiration conditions', scenes: 'respiration', text: 'Cyanide blocks Complex IV. Oligomycin blocks ATP synthase. DNP lets protons leak back as heat. UCP1 is a milder leak, and only the human cell offers it; that cell is labelled brown fat. A human cell dies when cell work goes without ATP for long enough. Yeast lives through cyanide, oligomycin and DNP by fermenting.' },
  {
    topic: 'Respiration conditions',
    scenes: ['human'],
    text: () => `Mutations and diseases are shown by how fast the affected enzymes work, tuned so the textbook outcome appears within a few minutes. PDH deficiency: pyruvate dehydrogenase works at ${percent(rate('pdhd').pdh)} of its usual rate. LHON: Complex I at ${percent(rate('lhon').complex1)}. MERRF: Complexes I, III and IV and ATP synthase at ${percent(rate('merrf').complex1)}. Beriberi: pyruvate dehydrogenase at ${percent(rate('beriberi').pdh)} and α-ketoglutarate dehydrogenase at ${percent(rate('beriberi').akgdh)}.`,
  },
  { topic: 'Respiration conditions', scenes: ['human'], text: 'Ischemia closes the oxygen supply but keeps the cell’s aerobic ATP demand, as in a heart or brain cell cut off from its blood. Fermentation mode instead lowers the demand to what an exercising muscle can sustain for a short time.' },
  { topic: 'Respiration conditions', scenes: ['yeast'], text: 'Petite (ρ⁰) yeast has no Complex III, no Complex IV and no Fₒ, so it takes up no oxygen. Its F₁ knob, made from nuclear genes, is drawn but idle.' },

  // Light reactions
  { topic: 'Light reactions', scenes: 'photosynthesis', text: 'Photosynthesis uses the same whole numbers: 12 H⁺ go into the thylakoid lumen for every 4 electrons from water, and 4 H⁺ come back through ATP synthase for each ATP. Linear electron flow then makes exactly the 3 ATP and 2 NADPH a C3 leaf needs for each CO₂. A real chloroplast’s ATP synthase needs about 4.7 H⁺ per ATP, so real C3 leaves also run some cyclic flow.' },
  { topic: 'Light reactions', scenes: 'photosynthesis', text: 'Photosystem II is drawn holding four electrons in its manganese cluster. Light sends them on, two at a time, and two water molecules are split to refill it.' },
  { topic: 'Light reactions', scenes: 'photosynthesis', text: 'One photon moves one electron at each photosystem. Light arrives at a steady rate. A photon a busy photosystem cannot use is given off as heat and fluorescence, drawn as a brief ring. Antenna pigments pass the energy to the reaction centre; this is drawn as the photon landing on an antenna lobe.' },
  { topic: 'Light reactions', scenes: 'photosynthesis', text: 'Cytochrome b₆f’s Q cycle is not drawn, as for Complex III. Cyclic flow is drawn as ferredoxin returning electrons to plastoquinone beside cytochrome b₆f. The real route runs through other proteins (PGR5 and PGRL1, or the NDH complex).' },

  // Calvin cycle and sugar
  { topic: 'Calvin cycle and sugar', scenes: 'photosynthesis', text: 'RuBisCO: which hydrogens go where is a model choice that conserves atoms. The two carboxylate oxygens of 3-phosphoglycerate are equivalent, so either may leave with the phosphate at G3P dehydrogenase.' },
  { topic: 'Calvin cycle and sugar', scenes: 'photosynthesis', text: 'Regeneration is one station whose steps are the real ones: triose phosphate isomerase, aldolase, the two bisphosphatases, transketolase, the isomerase and epimerase, and phosphoribulokinase. Xylulose 5-phosphate and ribulose 5-phosphate differ only in the shape at carbon 3, which the app does not draw.' },
  { topic: 'Calvin cycle and sugar', scenes: 'photosynthesis', text: 'One G3P leaves the Calvin cycle whenever the cycle already holds the carbon it started with: in steady light, one in six.' },
  { topic: 'Calvin cycle and sugar', scenes: 'photosynthesis', text: 'Glucose stands in for sucrose and starch. Hexose assembly is one station in the cytosol, where real leaves make sucrose. The triose phosphate translocator swaps each G3P out for a phosphate in.' },
  {
    topic: 'Calvin cycle and sugar',
    scenes: ['c3', 'c4'],
    text: () => {
      const life = reserve();
      return `The sugar reserve is the plant’s. Its drain stands for the plant’s own respiration and growth, about a tenth of what the leaf makes in light, so the store fills by day and lasts the night. The store starts ${fractionWords(life.start / life.cap)} full, which lasts about ${Math.round(life.start / life.drain / 60)} minutes of darkness; a real plant lasts days.`;
    },
  },
  { topic: 'Calvin cycle and sugar', scenes: ['c4', 'cam'], text: 'NADPH per glucose counts only what is spent. Malate carries one NADPH’s worth to malic enzyme, which gives it back, so C4 and CAM both use 12, as C3 does; the extra cost is ATP.' },

  // Air and photorespiration
  { topic: 'Air and photorespiration', scenes: 'photosynthesis', text: 'The stoma is drawn on the upper surface. Rice, wheat and maize have stomata on both surfaces.' },
  { topic: 'Air and photorespiration', scenes: 'photosynthesis', text: 'The leaf’s air space holds a few CO₂ and O₂ molecules that stand for the gas in it; only their ratio matters to RuBisCO. The stoma lets each gas through down its gradient, so closing it slows the flow without stopping it.' },
  { topic: 'Air and photorespiration', scenes: 'photosynthesis', text: () => `RuBisCO takes O₂ instead of CO₂ in proportion to their counts, weighted about ${rubisco()} to 1 towards CO₂. Photorespiration is shown as RuBisCO’s oxygenase reaction and phosphoglycolate phosphatase; glycolate leaves for the peroxisome, and the salvage pathway, which recovers most of its carbon, is an exit, not drawn. So each oxygenation here loses two carbons.` },
  { topic: 'Air and photorespiration', scenes: ['c4', 'cam'], text: 'PEP carboxylase is shown taking carbon dioxide and water, rather than bicarbonate.' },

  // C4
  { topic: 'C4', scenes: ['c4'], text: 'The light reactions are drawn only in the mesophyll. ATP and NADPH reach the bundle sheath on a stand-in link through both cells. Real bundle-sheath chloroplasts in maize make their own ATP with photosystem I and cyclic flow, and some 3-phosphoglycerate goes back to the mesophyll to be reduced.' },
  { topic: 'C4', scenes: ['c4'], text: 'Malic enzyme’s CO₂ gathers in a small pool in the bundle sheath, about ten times as concentrated as in the air space; none is shown leaking back out. O₂ seeps in from the air space.' },
  { topic: 'C4', scenes: ['c4'], text: 'PPDK and its recharge (adenylate kinase and pyrophosphatase) are one station, so AMP and pyrophosphate never leave it. Each CO₂ costs 5 ATP, against 3 in C3, made by extra cyclic flow.' },
  { topic: 'C4', scenes: ['c4'], text: 'The bundle sheath is drawn beside one vein, not as the ring of cells round it that gives Kranz anatomy its name (“wreath”).' },

  // CAM
  {
    topic: 'CAM',
    scenes: ['cam'],
    text: () => {
      const { period, dayLength } = camScene.clock;
      return `A day lasts ${period} s, ${dayLength} of light and ${period - dayLength} of dark. Real CAM plants use cytosolic or mitochondrial malic enzyme, and pineapple uses PEP carboxykinase; this model borrows C4’s chloroplast enzymes.`;
    },
  },
  { topic: 'CAM', scenes: ['cam'], text: 'Night glycolysis from starch is one station, and starch synthesis is drawn like hexose assembly, without the ADP-glucose step that costs one more ATP. The protons that come with malic acid acidify the vacuole, which is not drawn.' },
  { topic: 'CAM', scenes: ['cam'], text: 'The Glucose chip counts net sugar, the starch made by day less the glucose night glycolysis breaks down, so it falls each night.' },
  { topic: 'CAM', scenes: ['cam'], text: 'PEP carboxylase rests by day and RuBisCO, PPDK and malic enzyme by night, as the clock’s patches; in real plants these switches are slower and partly circadian. In darkness the clock keeps time, so the stomata still close by day. Malic enzyme waits while the closed leaf’s air already holds as much CO₂ as the air outside, so it keeps pace with RuBisCO.' },

  // Photosynthesis conditions
  { topic: 'Photosynthesis conditions', scenes: 'photosynthesis', text: 'DCMU blocks photosystem II as a whole. In reality it blocks only the step from photosystem II to plastoquinone; the outcome is the same, because a full manganese cluster never splits water.' },
  { topic: 'Photosynthesis conditions', scenes: 'photosynthesis', text: () => `On a hot, dry day the stomata are open to ${fractionWords(CONDITIONS.hotdry.stomata)} of their usual width.` },
  { topic: 'Photosynthesis conditions', scenes: CONDITIONS.triazine.scenes, text: () => `Triazine-resistant weed: photosystem II works at ${percent(rate('triazine').psii)} of its usual rate.` },
];

export function noteScenes(note) {
  return SCENE_GROUPS[note.scenes] ?? note.scenes;
}

export function noteText(note) {
  return typeof note.text === 'function' ? note.text() : note.text;
}

export function notesFor(sceneId) {
  return NOTES.filter((note) => noteScenes(note).includes(sceneId));
}

function topicList(doc, notes) {
  const out = doc.createDocumentFragment();
  for (const topic of TOPICS) {
    const items = notes.filter((note) => note.topic === topic);
    if (!items.length) continue;
    const heading = doc.createElement('h3');
    heading.textContent = topic;
    const list = doc.createElement('ul');
    for (const note of items) {
      const item = doc.createElement('li');
      item.textContent = noteText(note);
      list.append(item);
    }
    out.append(heading, list);
  }
  return out;
}

// This scene's notes, then the rest in a nested "All model notes".
export function renderNotes(container, sceneId) {
  if (!container || container.dataset.scene === sceneId) return;
  container.dataset.scene = sceneId;
  const doc = container.ownerDocument;
  const own = notesFor(sceneId);
  const rest = NOTES.filter((note) => !own.includes(note));
  const all = doc.createElement('details');
  all.className = 'notes-all';
  const summary = doc.createElement('summary');
  summary.textContent = 'All model notes';
  all.append(summary, topicList(doc, rest));
  container.replaceChildren(topicList(doc, own), all);
}
