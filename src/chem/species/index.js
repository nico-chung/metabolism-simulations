import { adp, amp, atp, nad, nadh, pi, ppi, proton, water } from './carriers.js';
import { cytc, cytcr, electron } from './chain.js';
import citrate from './citrate.js';
import {
  acetylcoa,
  akg,
  co2,
  coa,
  fad,
  fadh2,
  fumarate,
  isocitrate,
  malate,
  oaa,
  q,
  qh2,
  succinate,
  succinyl,
} from './cycle.js';
import { acetaldehyde, ethanol, lactate } from './fermentation.js';
import glucose from './glucose.js';
import { bpg, dhap, f6p, fbp, g3p, g6p, pep, pg2, pg3, pyruvate } from './glycolysis.js';
import { nitrate, nitrite } from './nitrogen.js';
import oxygen from './oxygen.js';
import { e4p, fd, fdr, glycolate, nadp, nadph, pc, pcr, pglycolate, pq, pqh2, r5p, ru5p, rubp, s7p, sbp, xu5p } from './photosynthesis.js';

export const SPECIES = {
  glucose,
  oxygen,
  atp,
  adp,
  nad,
  nadh,
  pi,
  proton,
  water,
  g6p,
  f6p,
  fbp,
  dhap,
  g3p,
  bpg,
  pg3,
  pg2,
  pep,
  pyruvate,
  lactate,
  acetaldehyde,
  ethanol,
  citrate,
  coa,
  acetylcoa,
  oaa,
  isocitrate,
  akg,
  succinyl,
  succinate,
  fumarate,
  malate,
  co2,
  q,
  qh2,
  fad,
  fadh2,
  cytc,
  cytcr,
  electron,
  nitrate,
  nitrite,
  nadp,
  nadph,
  pq,
  pqh2,
  pc,
  pcr,
  fd,
  fdr,
  rubp,
  e4p,
  xu5p,
  ru5p,
  r5p,
  sbp,
  s7p,
  pglycolate,
  glycolate,
  amp,
  ppi,
};

export function getSpecies(id) {
  const species = SPECIES[id];
  if (!species) throw new Error(`Unknown species ${id}`);
  return species;
}

export const ALL_SPECIES = Object.values(SPECIES);
