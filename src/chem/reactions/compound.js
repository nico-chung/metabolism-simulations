// A compound station runs several real reactions in order on molecules held
// in named slots (M6 plan §4.3, E4). Its net reaction composes their maps:
// the slots it takes in, the slots it gives out, and where every atom goes.
// The engine runs the sub-steps one by one; the net reaction is what the
// station's docks, belts and outputs see, and what the validators check.

import { compileMap } from './compile.js';

export function compound(reactions, { id, enzyme, short, phase, blurb, sequence, ledger }) {
  const ins = {};
  const outs = {};
  // Where each original input atom is now: slot.label → "inSlot.label".
  let where = new Map();
  const live = {};
  for (const step of sequence) {
    const reaction = reactions[step.reaction];
    for (const [role, slot] of Object.entries(step.bind.in)) {
      if (live[slot]) continue;
      ins[slot] = reaction.in[role];
      live[slot] = reaction.in[role];
    }
    const { pairs, errors } = compileMap(reaction);
    if (errors.length) throw new Error(errors[0]);
    const next = new Map(where);
    for (const [role, slot] of Object.entries(step.bind.in)) {
      for (const key of [...next.keys()]) if (key.startsWith(`${slot}.`)) next.delete(key);
    }
    for (const [from, to] of pairs) {
      const [fromRole, fromLabel] = from.split('.');
      const [toRole, toLabel] = to.split('.');
      const fromSlot = step.bind.in[fromRole];
      const toSlot = step.bind.out[toRole];
      const origin = where.get(`${fromSlot}.${fromLabel}`) ?? `${fromSlot}.${fromLabel}`;
      next.set(`${toSlot}.${toLabel}`, origin);
    }
    for (const slot of Object.values(step.bind.in)) delete live[slot];
    for (const [role, slot] of Object.entries(step.bind.out)) live[slot] = reaction.out[role];
    where = next;
  }
  Object.assign(outs, live);
  const map = {};
  for (const [to, from] of where) {
    const [slot] = to.split('.');
    if (outs[slot]) map[from] = to;
  }
  const sum = (key) => sequence.reduce((total, step) => total + (reactions[step.reaction][key] ?? 0), 0);
  return {
    id,
    enzyme,
    short,
    phase,
    blurb,
    compound: true,
    sequence,
    in: ins,
    out: outs,
    map,
    // The ledger counts each sub-step as it fires, not the net.
    netAtp: sum('atp'),
    netWater: sum('water'),
    ...(ledger ? { ledger } : {}),
  };
}
