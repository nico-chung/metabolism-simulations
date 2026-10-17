// Compound stations as small assembly lines (M6.5 P5). A compound station
// (Regeneration, hexose assembly) runs its sub-steps in the engine as real
// reactions, one after another. This module says where each slot is drawn
// while that happens. Every enzyme of the sequence has a site inside the
// station; an intermediate glides from the site that made it to the site
// that uses it, arriving as that step fires; each product of the whole
// station glides to a resting place for its unload. The plan depends only on
// the station and its reaction, so it adds no world state, and a step back
// replays it exactly.

import { REACTIONS } from '../chem/reactions/catalog.js';

// Sub-steps fire over the first 85% of the work; the rest lets the products
// settle before they leave.
export const COMPOUND_SPAN = 0.85;

// How far apart two molecules at one site sit.
const SPREAD = 22;

const plans = new Map();

// Inner places for a compound station's inputs: a grid across the station.
function compoundLayout(def, slots) {
  const cols = def.inner?.cols ?? Math.min(5, slots.length);
  const rows = Math.ceil(slots.length / cols);
  const dx = (def.w - 40) / cols;
  const dy = Math.min(40, (def.h - 40) / Math.max(1, rows));
  const where = {};
  slots.forEach((slot, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    where[slot] = { x: def.x - def.w / 2 + 20 + dx * (col + 0.5), y: def.y - ((rows - 1) * dy) / 2 + row * dy + (def.inner?.dy ?? 6) };
  });
  return where;
}

// The fraction of the work at which sub-step k fires.
function stepAt(k, count) {
  return (COMPOUND_SPAN * (k + 0.5)) / count;
}

export function choreography(def, reactionId) {
  const key = `${def.id}:${reactionId}:${def.x}:${def.y}`;
  const cached = plans.get(key);
  if (cached) return cached;
  const reaction = REACTIONS[reactionId];
  const inner = def.inner ?? {};
  const start = compoundLayout(def, Object.keys(reaction.in));
  const frames = {};
  const add = (slot, f, point) => (frames[slot] ??= []).push({ f, x: point.x, y: point.y });
  for (const [slot, point] of Object.entries(start)) add(slot, 0, point);
  const sites = {};
  for (const [id, site] of Object.entries(inner.sites ?? {})) {
    sites[id] = { id, name: site.name, x: def.x + site.x, y: def.y + site.y, below: site.below ?? false, fires: [] };
  }
  const count = reaction.sequence.length;
  reaction.sequence.forEach((step, k) => {
    const site = sites[inner.steps?.[step.reaction]];
    if (!site) return;
    const f = stepAt(k, count);
    site.fires.push(f);
    const place = (i, n) => ({ x: site.x + (i - (n - 1) / 2) * SPREAD, y: site.y });
    const ins = Object.values(step.bind.in);
    ins.forEach((slot, i) => add(slot, f, place(i, ins.length)));
    const outs = Object.values(step.bind.out);
    outs.forEach((slot, i) => add(slot, f, place(i, outs.length)));
  });
  for (const slot of Object.keys(reaction.out)) {
    const rest = inner.rest?.[slot];
    if (rest) add(slot, 1, { x: def.x + rest.x, y: def.y + rest.y });
  }
  const plan = { start, frames, sites: Object.values(sites), count, staged: Object.keys(sites).length > 0 };
  plans.set(key, plan);
  return plan;
}

// A sine ease: gentle at both ends, and its top speed only π/2 times the
// average, so a one-step glide never outruns the rest of the stage.
function easeInOut(t) {
  const x = Math.min(1, Math.max(0, t));
  return (1 - Math.cos(Math.PI * x)) / 2;
}

// Where a slot is drawn at fraction f of the work, or null if the plan does
// not place it.
export function slotAt(plan, slot, f) {
  const list = plan.frames[slot];
  if (!list || list.length < 2) return null;
  if (f <= list[0].f) return list[0];
  let i = 0;
  for (let j = 1; j < list.length; j += 1) if (list[j].f <= f) i = j;
  const a = list[i];
  const b = list[i + 1];
  if (!b) return a;
  const k = easeInOut((f - a.f) / (b.f - a.f));
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}

// How busy a site is at fraction f: 1 as one of its steps fires, easing to
// 0 a step's length either side.
export function siteActivity(plan, site, f) {
  let best = 0;
  const width = COMPOUND_SPAN / plan.count;
  for (const fire of site.fires) best = Math.max(best, 1 - Math.abs(f - fire) / (1.2 * width));
  return best;
}
