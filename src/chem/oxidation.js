import { enRank } from './elements.js';

// Oxidation state is derived from the bonds. The more electronegative atom
// takes the bonding electrons: minus one per bond order for it, plus one
// for its partner. Formal charge is then added.
export function oxidationStates(species) {
  const states = {};
  const hydride = new Set();
  for (const [id, atom] of Object.entries(species.atoms)) {
    states[id] = atom.hydride ? -1 : (atom.charge ?? 0);
    if (atom.hydride) hydride.add(id);
  }
  for (const [a, b, order] of species.bonds) {
    if (hydride.has(a) || hydride.has(b)) {
      // A hydride on a carrier is -1. The bond's other end is raised so the
      // oxidation states still add up to the charge of the molecule.
      states[hydride.has(a) ? b : a] += 1;
      continue;
    }
    const elementA = species.atoms[a].el;
    const elementB = species.atoms[b].el;
    if (elementA === elementB) continue;
    const aWins = enRank(elementA) < enRank(elementB);
    states[aWins ? a : b] -= order;
    states[aWins ? b : a] += order;
  }
  return states;
}

export function formatSigned(value) {
  if (value === 0) return '0';
  return `${value > 0 ? '+' : '−'}${Math.abs(value)}`;
}
