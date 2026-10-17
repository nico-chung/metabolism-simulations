import { expectedBondSums } from './elements.js';
import { countElements, parseFormula } from './formula.js';

export function validateSpecies(species) {
  const errors = [];
  const ids = Object.keys(species.atoms);

  const declared = parseFormula(species.formula);
  const actual = countElements(species);
  const elements = new Set([...Object.keys(declared), ...Object.keys(actual)]);
  for (const element of elements) {
    if ((declared[element] ?? 0) !== (actual[element] ?? 0)) {
      errors.push(`${species.id} formula ${species.formula} does not match its ${element} atoms`);
    }
  }

  const charge = ids.reduce((sum, id) => sum + (species.atoms[id].charge ?? 0), 0)
    - (species.freeElectrons ?? 0);
  if (charge !== species.charge) {
    errors.push(`${species.id} charges sum to ${charge}, declared ${species.charge}`);
  }

  const seen = new Map();
  for (const id of ids) {
    const atom = species.atoms[id];
    const key = `${atom.x.toFixed(3)},${atom.y.toFixed(3)}`;
    if (seen.has(key)) errors.push(`${species.id} ${id} shares a position with ${seen.get(key)}`);
    seen.set(key, id);
  }

  const totals = Object.fromEntries(ids.map((id) => [id, 0]));
  const pairs = new Set();
  for (const [a, b, order] of species.bonds) {
    if (!species.atoms[a] || !species.atoms[b]) {
      errors.push(`${species.id} bond ${a}-${b} names a missing atom`);
      continue;
    }
    if (![1, 2, 3].includes(order)) errors.push(`${species.id} bond ${a}-${b} has order ${order}`);
    const pair = [a, b].sort().join('|');
    if (pairs.has(pair)) errors.push(`${species.id} has a duplicate bond ${a}-${b}`);
    pairs.add(pair);
    totals[a] += order;
    totals[b] += order;
    const distance = Math.hypot(species.atoms[a].x - species.atoms[b].x, species.atoms[a].y - species.atoms[b].y);
    if (distance < 0.98 || distance > 1.02) {
      errors.push(`${species.id} bond ${a}-${b} has length ${distance.toFixed(3)}`);
    }
  }

  for (const id of ids) {
    const atom = species.atoms[id];
    if (atom.body) continue;
    const allowed = expectedBondSums(atom.el, atom.charge ?? 0);
    if (!allowed) {
      errors.push(`${species.id} ${id} has no bond rule for ${atom.el} charge ${atom.charge ?? 0}`);
    } else if (!allowed.includes(totals[id])) {
      errors.push(`${species.id} ${id} has bond sum ${totals[id]}, expected ${allowed.join(' or ')}`);
    }
  }

  let nearest = Infinity;
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const left = species.atoms[ids[i]];
      const right = species.atoms[ids[j]];
      nearest = Math.min(nearest, Math.hypot(left.x - right.x, left.y - right.y));
    }
  }
  if (ids.length > 1 && nearest < 0.75) {
    errors.push(`${species.id} has atoms ${nearest.toFixed(3)} apart`);
  }

  return errors;
}
