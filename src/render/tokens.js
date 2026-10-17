export const TOKEN_NAMES = [
  'paper',
  'ink',
  'ink-soft',
  'hairline',
  'carbon',
  'hydrogen',
  'hydrogen-edge',
  'oxygen',
  'nitrogen',
  'phosphorus',
  'sulfur',
  'electron',
  'proton',
  'photon',
  'cytosol',
  'matrix',
  'stroma',
  'reservoir',
  'vacuole',
  'membrane',
  'wall',
  'enzyme',
  'enzyme-edge',
  'carrier',
  'carrier-edge',
  'tag-1',
  'tag-2',
  'tag-3',
  'sugar',
  'gas',
  'carrier-nad',
  'carrier-coa',
  'carrier-adenosine',
  'carrier-q',
  'carrier-cyt',
  'carrier-fad',
  'carrier-fd',
  'bilayer',
  'zone-glycolysis',
  'zone-oxidation',
  'zone-krebs',
  'zone-oxphos',
  'zone-ferment',
  'zone-pump',
  'blocked',
  'spark',
  'night',
];

export function readTokens(doc = document) {
  const style = getComputedStyle(doc.documentElement);
  const tokens = { font: style.getPropertyValue('--font').trim() };
  for (const name of TOKEN_NAMES) {
    tokens[name] = style.getPropertyValue(`--${name}`).trim();
  }
  return tokens;
}
