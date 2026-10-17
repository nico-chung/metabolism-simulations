import { BACTERIUM } from './bacterium.js';
import { C4, PPDK_STATION } from './c4.js';
import { CAM, NIGHT_GLYCOLYSIS, PEP_TO_PG3 } from './cam.js';
import { FERMENTATION } from './fermentation.js';
import { cellWork, GLYCOLYSIS } from './glycolysis.js';
import { compound } from './compound.js';
import { HEXOSE, PHOTOSYNTHESIS, REGENERATION, calvinPgkAlt } from './photosynthesis.js';
import { RESPIRATION } from './respiration.js';

const BASE = Object.fromEntries(
  [...GLYCOLYSIS, cellWork, ...RESPIRATION, ...FERMENTATION, ...BACTERIUM, ...PHOTOSYNTHESIS, calvinPgkAlt, ...C4, ...CAM].map((reaction) => [reaction.id, reaction]),
);

// Compound stations (M6 plan E4): their net reactions, composed from the
// sub-steps above.
export const COMPOUNDS = [
  compound(BASE, {
    id: 'regen',
    enzyme: 'Regeneration',
    short: 'Regen',
    phase: 'regeneration',
    blurb: 'Five three-carbon sugars and three ATP are rearranged into three five-carbon RuBP: isomerase, aldolase, phosphatase and transketolase steps, then phosphoribulokinase.',
    sequence: REGENERATION,
  }),
  compound(BASE, {
    id: 'hexose',
    enzyme: 'Hexose assembly',
    short: 'Hexose',
    phase: 'export',
    blurb: 'Two G3P join into one glucose, and two phosphates are freed. Real leaves make sucrose here.',
    sequence: HEXOSE,
  }),
  compound(BASE, {
    id: 'pump',
    enzyme: 'PPDK and recharge',
    short: 'PPDK',
    phase: 'pump',
    blurb: 'Pyruvate, phosphate dikinase makes PEP again from pyruvate, spending two ATP: adenylate kinase turns its AMP back into ADP, and pyrophosphatase splits its pyrophosphate.',
    sequence: PPDK_STATION,
  }),
  // CAM (M7b, §3.6).
  compound(BASE, {
    id: 'nightgly',
    enzyme: 'Night glycolysis',
    short: 'Glycolysis',
    phase: 'pump',
    blurb: 'Glucose from the starch grain is split as far as PEP, making two NADH. The two ATP spent at the start are made back, so no ATP comes from outside.',
    sequence: NIGHT_GLYCOLYSIS,
  }),
  compound(BASE, {
    id: 'pep3pg',
    enzyme: 'PEP to 3-phosphoglycerate',
    short: 'PEP→3-PG',
    phase: 'pump',
    blurb: 'Enolase and phosphoglycerate mutase run backwards: PEP becomes 3-phosphoglycerate, which the Calvin cycle reduces back to sugar.',
    sequence: PEP_TO_PG3,
  }),
  compound(BASE, {
    id: 'starch',
    enzyme: 'Starch synthesis',
    short: 'Starch',
    phase: 'export',
    blurb: 'Two G3P join into one glucose inside the chloroplast, and the glucose is stored in the starch grain. Real starch is built from ADP-glucose, at the cost of one ATP.',
    sequence: HEXOSE,
  }),
];

export const REACTIONS = { ...BASE, ...Object.fromEntries(COMPOUNDS.map((reaction) => [reaction.id, reaction])) };
