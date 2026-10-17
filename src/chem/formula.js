export function parseFormula(formula) {
  const counts = {};
  if (formula === '') return counts;
  const pattern = /([A-Z][a-z]?)(\d*)/g;
  let match = pattern.exec(formula);
  if (!match) throw new Error(`Bad formula ${formula}`);
  let used = 0;
  while (match) {
    const [, element, digits] = match;
    counts[element] = (counts[element] ?? 0) + (digits ? Number(digits) : 1);
    used += match[0].length;
    match = pattern.exec(formula);
  }
  if (used !== formula.length) throw new Error(`Bad formula ${formula}`);
  return counts;
}

export function countElements(species) {
  const counts = {};
  for (const atom of Object.values(species.atoms)) {
    counts[atom.el] = (counts[atom.el] ?? 0) + 1;
  }
  return counts;
}
