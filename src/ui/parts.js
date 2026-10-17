// Cards for the parts of the stage that are not stations (M8.12a): pores and
// transporters in the membranes, the uncouplers, CAM's two stores, the
// carriers, every other molecule, and the protons. Each card names the part
// and says, in one or two sentences, what it does in the pathway. A click
// tries a tag first, then a station, then these.

import { REACTIONS } from '../chem/reactions/catalog.js';
import { choreography } from '../sim/choreography.js';
import { equationOf } from './station.js';
import { getSpecies } from '../chem/species/index.js';
import { moleculeBounds } from '../render/molecules.js';
import { worldToScreen } from '../render/camera.js';

// Pores and transporters, by id. A scene's own entry wins over the shared one
// (the bacterium's glucose transporter is its phosphotransferase system).
export const PORES = {
  glut: {
    name: 'Glucose transporter (GLUT)',
    blurb: 'A carrier protein in the plasma membrane. Glucose enters the cell through it by facilitated diffusion, down its concentration gradient, without spending ATP.',
  },
  mct: {
    name: 'Monocarboxylate transporter (MCT)',
    blurb: 'Carries lactate out of the cell across the plasma membrane together with a proton, so lactic acid does not accumulate inside.',
  },
  vdac: {
    name: 'Porin (VDAC)',
    blurb: 'A large channel in the outer mitochondrial membrane. Small molecules such as pyruvate, ADP and ATP pass through it freely.',
  },
  mpc: {
    name: 'Mitochondrial pyruvate carrier (MPC)',
    blurb: 'Carries pyruvate across the inner mitochondrial membrane into the matrix, where pyruvate dehydrogenase converts it to acetyl-CoA.',
  },
  'porin-glc': {
    name: 'Porin (OmpF)',
    blurb: 'A channel in the outer membrane of the bacterium. Small molecules such as glucose and nitrate diffuse through it into the periplasm.',
  },
  'porin-n': {
    name: 'Porin (OmpF)',
    blurb: 'A channel in the outer membrane of the bacterium. Small molecules such as glucose and nitrate diffuse through it into the periplasm.',
  },
  nark: {
    name: 'Nitrate–nitrite antiporter (NarK)',
    blurb: 'Exchanges nitrate from the periplasm for nitrite from the cytoplasm across the inner membrane, supplying nitrate reductase and removing its product.',
  },
  'export-port': {
    name: 'Sugar export (to the phloem)',
    blurb: 'Sugar leaves the cell here for the phloem, which carries it to the rest of the plant. The model exports glucose; real leaves export sucrose.',
  },
  salvage: {
    name: 'Glycolate transporter (PLGG1)',
    blurb: 'Carries glycolate, the product of photorespiration, out of the chloroplast toward the peroxisome, where the salvage pathway begins.',
  },
  'tono-in': {
    name: 'Tonoplast malate channel',
    blurb: 'A channel in the tonoplast, the membrane of the vacuole. Malate made at night enters the vacuole here and leaves again by day.',
  },
  'tono-out': {
    name: 'Tonoplast malate channel',
    blurb: 'A channel in the tonoplast, the membrane of the vacuole. Malate made at night enters the vacuole here and leaves again by day.',
  },
};

const SCENE_PORES = {
  bacterium: {
    glut: {
      name: 'Phosphotransferase system (PTS)',
      blurb: 'The bacterium’s glucose uptake system in the inner membrane. It phosphorylates glucose with PEP as it enters; the model admits glucose unchanged and phosphorylates it with hexokinase.',
    },
  },
};

export const UNCOUPLERS = {
  dnp: {
    name: '2,4-Dinitrophenol (DNP)',
    blurb: 'A lipid-soluble weak acid. It takes up a proton on the side where protons are concentrated, crosses the membrane and releases it on the other side, bypassing ATP synthase.',
  },
  ucp1: {
    name: 'Uncoupling protein 1 (UCP1)',
    blurb: 'A proton channel in the inner mitochondrial membrane of brown fat. Protons return through it without making ATP, and their energy is released as heat.',
  },
};

export const STORES = {
  grain: {
    name: 'Starch grain',
    blurb: 'Stores the sugar made by day as starch. At night, night glycolysis breaks it down to supply PEP, the acceptor of CO₂.',
    holds: 'glucose',
  },
  vacuole: {
    name: 'Vacuole',
    blurb: 'Stores the malate made at night, as malic acid. By day the malate returns to the chloroplast, where malic enzyme releases its CO₂ for RuBisCO.',
    holds: 'malate',
  },
};

// What each carrier does, by species id.
export const CARRIERS = {
  atp: 'Adenosine triphosphate, the cell’s energy currency. Transferring or hydrolysing its terminal phosphate releases the energy that drives cellular work.',
  adp: 'Adenosine diphosphate. ATP synthase and substrate-level phosphorylation add a phosphate to it, regenerating ATP.',
  amp: 'Adenosine monophosphate, left by PPDK in C4 and CAM leaves. Adenylate kinase converts it back to ADP, using one ATP.',
  pi: 'Inorganic phosphate. It is added to ADP to make ATP and released again when ATP is used.',
  ppi: 'Pyrophosphate, two phosphates joined, released by PPDK. Pyrophosphatase hydrolyses it to two phosphates, which drives the PPDK reaction forward.',
  nad: 'Nicotinamide adenine dinucleotide, oxidized. Dehydrogenases transfer a hydride to it, two electrons and a proton, making NADH.',
  nadh: 'Carries two electrons, as a hydride, from glycolysis and the citric acid cycle to the electron transport chain, or to the fermentation enzymes when there is no chain.',
  coa: 'Coenzyme A carries acyl groups as thioesters. Pyruvate dehydrogenase attaches an acetyl group to it, and citrate synthase releases it again.',
  q: 'Ubiquinone, a lipid-soluble carrier within the membrane. It accepts two electrons and two protons from Complex I or Complex II, becoming ubiquinol.',
  qh2: 'Ubiquinol, the reduced form of ubiquinone. It carries two electrons within the membrane to the next complex of the chain.',
  fad: 'Flavin adenine dinucleotide, bound inside succinate dehydrogenase (Complex II). It accepts two hydrogens from succinate, becoming FADH₂.',
  fadh2: 'FADH₂ passes its two electrons to ubiquinone. They enter the chain below those of NADH, so fewer protons are pumped for each pair.',
  cytc: 'Cytochrome c, a small protein on the outer face of the inner membrane. It carries one electron at a time from Complex III to Complex IV.',
  cytcr: 'Reduced cytochrome c, carrying one electron from Complex III to Complex IV.',
  nadp: 'NADP⁺, the oxidized form. NADP⁺ reductase transfers two electrons from ferredoxin and a proton from the stroma to it, making NADPH.',
  nadph: 'Carries two electrons, as a hydride, from the light reactions to the Calvin cycle, where they reduce 1,3-bisphosphoglycerate to G3P.',
  pq: 'Plastoquinone, a lipid-soluble carrier within the thylakoid membrane. Photosystem II reduces it with two electrons and two protons from the stroma.',
  pqh2: 'Plastoquinol carries two electrons to cytochrome b₆f and releases its two protons into the thylakoid lumen.',
  pc: 'Plastocyanin, a small copper protein in the thylakoid lumen. It carries one electron at a time from cytochrome b₆f to photosystem I.',
  pcr: 'Reduced plastocyanin, carrying one electron from cytochrome b₆f to photosystem I.',
  fd: 'Ferredoxin, a small iron–sulfur protein on the stroma side. It carries one electron at a time from photosystem I to NADP⁺ reductase.',
  fdr: 'Reduced ferredoxin, carrying one electron from photosystem I to NADP⁺ reductase, or back to plastoquinone in cyclic electron flow.',
};

export const PROTON = {
  respiration: 'Pumped across the membrane by the electron transport chain, it adds to the proton gradient. It can return only through ATP synthase, which uses the flow to make ATP.',
  photosynthesis: 'Released into the thylakoid lumen by photosystem II or cytochrome b₆f, it adds to the proton gradient. It returns to the stroma through ATP synthase, which makes ATP.',
  bulk: 'A free proton. Protons pumped across the membrane form the gradient that drives ATP synthase; protons on this side are the ones taken up by reactions.',
};

const RESERVOIR_PLACES = ['intermembrane space', 'periplasm', 'thylakoid lumen'];

export function poreOf(sceneId, id) {
  return SCENE_PORES[sceneId]?.[id] ?? PORES[id] ?? null;
}

// What the click at `world` (a world point) and `screen` landed on, if it is
// one of these parts. Membrane parts first, then protons, then molecules.
export function hitPart(scene, shot, world, screen, camera, viewport) {
  for (const pore of scene.pores ?? []) {
    if (Math.abs(world.x - pore.x) <= pore.w / 2 + 3 && Math.abs(world.y - pore.y) <= pore.h / 2 + 3) return { kind: 'pore', id: pore.id };
  }
  const leak = shot?.leak && scene.uncoupler?.[shot.leak];
  if (leak && Math.abs(world.x - leak.x) <= 12 && Math.abs(world.y - leak.y) <= 20) return { kind: 'uncoupler', id: shot.leak };
  for (const def of scene.stations) {
    if (def.kind !== 'store') continue;
    if (Math.abs(world.x - def.x) <= def.w / 2 && Math.abs(world.y - def.y) <= def.h / 2) return { kind: 'store', id: def.id };
  }
  let best = null;
  let bestD = 8;
  for (const proton of shot?.protons ?? []) {
    const at = worldToScreen(camera, viewport, proton.x, proton.y);
    const d = Math.hypot(at.x - screen.x, at.y - screen.y);
    if (d < bestD) {
      bestD = d;
      best = { kind: 'proton', id: proton.key, place: proton.place };
    }
  }
  if (best) return best;
  let nearest = null;
  let nearestD = Infinity;
  for (const item of shot?.items ?? []) {
    if (item.alpha != null && item.alpha < 0.2) continue;
    const species = item.speciesData ?? getSpecies(item.species);
    if (species.id === 'electron') continue;
    const box = moleculeBounds(species, item);
    if (world.x < box.x || world.x > box.x + box.w || world.y < box.y || world.y > box.y + box.h) continue;
    const d = Math.hypot(world.x - (item.cx ?? item.x), world.y - (item.cy ?? item.y));
    if (d < nearestD) {
      nearestD = d;
      nearest = { kind: 'molecule', id: item.id, species: species.id };
    }
  }
  return nearest;
}

// An enzyme inside a compound station (Regeneration, hexose assembly, PPDK
// and recharge, night glycolysis, starch synthesis, PEP to 3-PG): the pad
// it is drawn on, from the station's plan (M8.13, Nico's review).
export function hitSite(def, reactionId, world) {
  if (def.kind !== 'compound' || !def.inner?.sites) return null;
  const pad = def.inner.pad ?? { w: 40, h: 20 };
  for (const site of choreography(def, reactionId).sites) {
    if (Math.abs(world.x - site.x) <= pad.w / 2 + 2 && Math.abs(world.y - site.y) <= pad.h / 2 + 2) return { kind: 'site', station: def.id, id: site.id };
  }
  return null;
}

// The stations of this scene that make or use a species, by enzyme name.
function makersAndUsers(scene, speciesId) {
  const made = new Set();
  const used = new Set();
  for (const def of scene.stations) {
    for (const mode of def.modes ?? []) {
      const reaction = REACTIONS[mode.reaction];
      if (!reaction) continue;
      if (Object.values(reaction.out ?? {}).includes(speciesId)) made.add(reaction.enzyme);
      if (Object.values(reaction.in ?? {}).includes(speciesId)) used.add(reaction.enzyme);
    }
  }
  return { made: [...made], used: [...used] };
}

// The card for a part: a name, a blurb and a few fields.
export function partCard(part, scene, counts = {}) {
  if (part.kind === 'site') return siteCard(part, scene);
  if (part.kind === 'pore') {
    const pore = poreOf(scene.id, part.id);
    const def = scene.pores.find((entry) => entry.id === part.id);
    return { name: pore?.name ?? def?.name ?? part.id, blurb: pore?.blurb ?? '', fields: [] };
  }
  if (part.kind === 'uncoupler') return { ...UNCOUPLERS[part.id], fields: [] };
  if (part.kind === 'store') {
    const store = STORES[part.id];
    return { name: store.name, blurb: store.blurb, fields: [['Holds', `${counts[part.id] ?? 0} ${store.holds}`]] };
  }
  if (part.kind === 'proton') {
    const reservoir = RESERVOIR_PLACES.some((place) => part.place?.includes(place));
    const blurb = reservoir ? PROTON[scene.tab ?? 'respiration'] : PROTON.bulk;
    return { name: 'Proton (H⁺)', blurb, fields: part.place ? [['Where', capital(part.place)]] : [] };
  }
  const species = getSpecies(part.species);
  const fields = [];
  if (species.formula && species.family !== 'carrier') fields.push(['Formula', formulaText(species.formula)]);
  fields.push(['Charge', species.charge > 0 ? `+${species.charge}` : species.charge < 0 ? `−${-species.charge}` : '0']);
  const { made, used } = makersAndUsers(scene, species.id);
  if (made.length) fields.push(['Made by', list(made)]);
  if (used.length) fields.push(['Used by', list(used)]);
  return { name: capital(species.name), blurb: CARRIERS[species.id] ?? '', fields };
}

// A site's card: the enzyme, what it does, and its equation, from the
// sub-reactions the station runs on that site.
function siteCard(part, scene) {
  const def = scene.stations.find((entry) => entry.id === part.station);
  const reactions = Object.entries(def?.inner?.steps ?? {})
    .filter(([, site]) => site === part.id)
    .map(([id]) => REACTIONS[id])
    .filter(Boolean);
  const station = def?.names?.[1] ?? def?.id ?? '';
  if (!reactions.length) return { name: def?.inner?.sites?.[part.id]?.name ?? part.id, blurb: '', fields: [['Part of', station]] };
  const blurbs = [...new Set(reactions.map((reaction) => reaction.blurb).filter(Boolean))];
  return {
    name: reactions[0].enzyme,
    blurb: blurbs.join(' '),
    fields: [['Part of', station]],
    equation: reactions.map((reaction) => equationOf(reaction)).join('; '),
  };
}

function list(names) {
  return names.length > 4 ? `${names.slice(0, 4).join(', ')} and others` : names.join(', ');
}

// "glucose" becomes "Glucose"; "α-ketoglutarate" and "NAD⁺" stay as they are.
function capital(text) {
  return text && /[a-z]/.test(text[0]) ? text[0].toUpperCase() + text.slice(1) : text;
}

const SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉' };
function formulaText(formula) {
  return formula.replace(/\d/g, (digit) => SUB[digit]);
}
