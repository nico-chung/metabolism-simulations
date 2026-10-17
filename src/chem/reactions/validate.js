import { oxidationStates } from '../oxidation.js';
import { getSpecies } from '../species/index.js';
import { compileMap } from './compile.js';

export function validateReaction(reaction) {
  const errors = [];
  const { pairs, errors: mapErrors } = compileMap(reaction);
  errors.push(...mapErrors);

  const reactantAtoms = [];
  for (const [role, speciesId] of Object.entries(reaction.in)) {
    for (const label of Object.keys(getSpecies(speciesId).atoms)) {
      reactantAtoms.push(`${role}.${label}`);
    }
  }
  const productAtoms = [];
  for (const [role, speciesId] of Object.entries(reaction.out)) {
    for (const label of Object.keys(getSpecies(speciesId).atoms)) {
      productAtoms.push(`${role}.${label}`);
    }
  }

  const from = pairs.map(([left]) => left);
  const to = pairs.map(([, right]) => right);
  if (new Set(from).size !== from.length) errors.push(`${reaction.id} maps a reactant atom twice`);
  if (new Set(to).size !== to.length) errors.push(`${reaction.id} maps a product atom twice`);
  for (const id of reactantAtoms) {
    if (!from.includes(id)) errors.push(`${reaction.id} leaves out ${id}`);
  }
  for (const id of productAtoms) {
    if (!to.includes(id)) errors.push(`${reaction.id} never produces ${id}`);
  }

  for (const [left, right] of pairs) {
    const source = atomOf(reaction.in, left);
    const dest = atomOf(reaction.out, right);
    if (!source || !dest) continue;
    if (source.el !== dest.el) errors.push(`${reaction.id} ${left} is ${source.el} but ${right} is ${dest.el}`);
  }

  const inCharge = chargeOf(reaction.in);
  const outCharge = chargeOf(reaction.out);
  if (inCharge !== outCharge) errors.push(`${reaction.id} charge ${inCharge} becomes ${outCharge}`);

  const inOx = redoxOf(reaction.in);
  const outOx = redoxOf(reaction.out);
  if (inOx !== outOx) errors.push(`${reaction.id} oxidation sum ${inOx} becomes ${outOx}`);

  return errors;
}

function atomOf(roles, key) {
  const [role, label] = key.split('.');
  const speciesId = roles[role];
  if (!speciesId) return null;
  return getSpecies(speciesId).atoms[label] ?? null;
}

function chargeOf(roles) {
  return Object.values(roles).reduce((sum, id) => sum + getSpecies(id).charge, 0);
}

// Free electrons (one held inside Complex IV) count against the sum, so a
// carrier giving up an electron balances the electron it hands over.
function redoxOf(roles) {
  return Object.values(roles).reduce((sum, id) => {
    const species = getSpecies(id);
    const states = oxidationStates(species);
    const total = Object.values(states).reduce((inner, value) => inner + value, 0);
    return sum + total - (species.freeElectrons ?? 0);
  }, 0);
}

// Electron identities: every electron on a reactant goes to a product slot
// or ends (in water), and every product slot is filled by a moved electron
// or a new pair made by a dehydrogenase.
export function validateElectrons(reaction) {
  const errors = [];
  const inSlots = slots(reaction.in);
  const outSlots = slots(reaction.out);
  const moved = Object.entries(reaction.emap ?? {});
  const ended = Object.keys(reaction.eend ?? {});
  const filled = new Set(moved.map(([, to]) => to));
  for (const [role, source] of Object.entries(reaction.enew ?? {})) {
    const count = getSpecies(reaction.out[role] ?? '').ecount ?? 0;
    if (!count) errors.push(`${reaction.id} makes electrons on ${role}, which holds none`);
    for (let i = 0; i < count; i += 1) filled.add(`${role}.${i}`);
    const [srcRole, srcLabel] = source.split('.');
    if (!getSpecies(reaction.in[srcRole] ?? 'electron').atoms[srcLabel]) {
      errors.push(`${reaction.id} names a missing source atom ${source}`);
    }
  }
  const used = new Set([...moved.map(([from]) => from), ...ended]);
  for (const slot of inSlots) {
    if (!used.has(slot)) errors.push(`${reaction.id} loses electron ${slot}`);
  }
  for (const slot of used) {
    if (!inSlots.includes(slot)) errors.push(`${reaction.id} moves electron ${slot}, which is not there`);
  }
  for (const slot of outSlots) {
    if (!filled.has(slot)) errors.push(`${reaction.id} leaves electron slot ${slot} empty`);
  }
  for (const slot of filled) {
    if (!outSlots.includes(slot)) errors.push(`${reaction.id} fills ${slot}, which holds no electron`);
  }
  for (const [slot, role] of Object.entries(reaction.eend ?? {})) {
    if (!reaction.out[role]) errors.push(`${reaction.id} ends ${slot} in a missing product ${role}`);
  }
  return errors;
}

function slots(roles) {
  const list = [];
  for (const [role, id] of Object.entries(roles)) {
    const count = getSpecies(id).ecount ?? 0;
    for (let i = 0; i < count; i += 1) list.push(`${role}.${i}`);
  }
  return list;
}
