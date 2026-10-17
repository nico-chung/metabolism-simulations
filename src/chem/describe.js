import { ELEMENTS } from './elements.js';
import { formatSigned, oxidationStates } from './oxidation.js';

function oxidationOf(species, atomId) {
  return oxidationStates(species)[atomId];
}

function atomOrigin(species, atomId) {
  const atom = species.atoms[atomId];
  if (atom.n) return `C-${atom.n} of ${species.name}`;
  return `${atom.role} of ${species.short}`;
}

function atomNow(species, atomId, place = 'in the tray') {
  const atom = species.atoms[atomId];
  if (atom.n) return `C-${atom.n}, the ${atom.role} of ${species.name}, ${place}`;
  const role = atom.role.charAt(0).toUpperCase() + atom.role.slice(1);
  return `${role} of ${species.short}, ${place}`;
}

function bondedTo(species, atomId) {
  const parts = [];
  for (const [a, b, order] of species.bonds) {
    const otherId = a === atomId ? b : b === atomId ? a : null;
    if (!otherId) continue;
    const other = species.atoms[otherId];
    const mark = order === 3 ? '≡' : order === 2 ? '=' : '−';
    const charge = formatCharge(other.charge ?? 0);
    parts.push({ order, text: `${mark}${other.el}${charge}` });
  }
  parts.sort((left, right) => right.order - left.order || left.text.localeCompare(right.text));
  return parts.map((part) => part.text).join(', ');
}

export function describeAtom(species, atomId, tagNumber, extra = {}) {
  const atom = species.atoms[atomId];
  return {
    element: ELEMENTS[atom.el].name,
    tag: tagNumber,
    origin: extra.origin ?? atomOrigin(species, atomId),
    now: atomNow(species, atomId, extra.place),
    oxidation: formatSigned(oxidationOf(species, atomId)),
    charge: formatSigned(atom.charge ?? 0),
    bonded: bondedTo(species, atomId),
  };
}

function formatCharge(charge) {
  if (!charge) return '';
  if (charge === -1) return '(−)';
  if (charge === 1) return '(+)';
  return `(${formatSigned(charge)})`;
}
