import { getSpecies } from '../species/index.js';

// Same label in one reactant and one product is the default. A reaction
// only has to name the atoms that change role.
export function compileMap(reaction) {
  const pairs = [];
  const usedIn = new Set();
  const usedOut = new Set();
  const errors = [];

  for (const [from, to] of Object.entries(reaction.map ?? {})) {
    if (usedIn.has(from) || usedOut.has(to)) errors.push(`${reaction.id} reuses ${from} or ${to}`);
    pairs.push([from, to]);
    usedIn.add(from);
    usedOut.add(to);
  }

  for (const [role, speciesId] of Object.entries(reaction.in)) {
    const species = getSpecies(speciesId);
    for (const label of Object.keys(species.atoms)) {
      const key = `${role}.${label}`;
      if (usedIn.has(key)) continue;
      const hits = [];
      for (const [outRole, outId] of Object.entries(reaction.out)) {
        const outKey = `${outRole}.${label}`;
        const product = getSpecies(outId);
        const atom = product.atoms[label];
        if (!atom || usedOut.has(outKey)) continue;
        if (atom.el !== species.atoms[label].el) continue;
        hits.push(outKey);
      }
      if (hits.length !== 1) {
        errors.push(`${reaction.id} ${key} has ${hits.length} default destinations`);
        continue;
      }
      pairs.push([key, hits[0]]);
      usedIn.add(key);
      usedOut.add(hits[0]);
    }
  }

  return { pairs, errors };
}
