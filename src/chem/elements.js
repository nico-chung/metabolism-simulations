// Electronegativity, most to least. Bonds between equals contribute nothing.
const EN_ORDER = ['O', 'N', 'S', 'C', 'H', 'P'];

export const ELEMENTS = {
  H: { name: 'Hydrogen', token: 'hydrogen', edge: 'hydrogen-edge', radius: 0.6 },
  C: { name: 'Carbon', token: 'carbon', radius: 1 },
  N: { name: 'Nitrogen', token: 'nitrogen', radius: 1 },
  O: { name: 'Oxygen', token: 'oxygen', radius: 0.95 },
  P: { name: 'Phosphorus', token: 'phosphorus', radius: 1.15 },
  S: { name: 'Sulfur', token: 'sulfur', radius: 1.15 },
};

// Bond-order sums that count as a full shell for a freshman structure.
const BOND_SUMS = {
  H: { 0: [1], 1: [0] },
  C: { 0: [4], 1: [3], '-1': [3] },
  N: { 0: [3], 1: [4], '-1': [2] },
  O: { 0: [2], 1: [3], '-1': [1] },
  P: { 0: [4, 5] },
  S: { 0: [2], 1: [3], '-1': [1] },
};

export function expectedBondSums(element, charge = 0) {
  return BOND_SUMS[element]?.[charge] ?? null;
}

export function enRank(element) {
  const rank = EN_ORDER.indexOf(element);
  if (rank < 0) throw new Error(`No electronegativity for ${element}`);
  return rank;
}
