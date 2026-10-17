import { getSpecies } from '../chem/species/index.js';

// A station's card (PLAN §5.8): its balanced reaction, and an energy
// diagram (M6 plan D5): for the light reactions the Z-scheme, where energy
// goes up at each photosystem and down along the chain, and for the
// respiration chain a staircase, where it only goes down (M8.6).

// "2 H₂O → O₂ + 4 H⁺ + 4 e⁻": each side's species, counted, in order.
export function equationOf(reaction, photons = 0) {
  const side = (roles) => {
    const counts = new Map();
    for (const id of Object.values(roles)) {
      const label = getSpecies(id).short;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts].map(([label, n]) => (n > 1 ? `${n} ${label}` : label));
  };
  const left = side(reaction.in);
  if (photons) left.unshift(photons > 1 ? `${photons} photons` : 'photon');
  return `${left.join(' + ')} → ${side(reaction.out).join(' + ')}`;
}

// Where each step of the Z sits: x across, y for energy (smaller is higher).
const Z = [
  { id: 'P680', x: 14, y: 92, stations: ['psii'] },
  { id: 'P680*', x: 30, y: 18, stations: ['psii'] },
  { id: 'PQ', x: 58, y: 40, stations: ['psii', 'b6f'] },
  { id: 'b₆f', x: 86, y: 56, stations: ['b6f'] },
  { id: 'PC', x: 114, y: 70, stations: ['b6f', 'psi'] },
  { id: 'P700', x: 138, y: 84, stations: ['psi'] },
  { id: 'P700*', x: 154, y: 8, stations: ['psi'] },
  { id: 'Fd', x: 182, y: 24, stations: ['psi', 'fnr'] },
  { id: 'NADP⁺', x: 210, y: 40, stations: ['fnr'] },
];
const LIFTS = [[0, 1], [5, 6]];

export const Z_STATIONS = new Set(['psii', 'b6f', 'psi', 'fnr', 'cyclic']);

export function zScheme(stationId) {
  return energyDiagram({
    steps: Z,
    lifts: LIFTS,
    stationId,
    label: 'Z-scheme: light lifts an electron at photosystem II, it falls through plastoquinone, cytochrome b₆f and plastocyanin to photosystem I, light lifts it again, and it falls through ferredoxin to NADP⁺.',
  });
}

// The respiration chain's staircase (M8.6): electrons only fall. FADH₂ joins
// at Complex II and enters Q below NADH, so its electrons skip Complex I's
// pump. `pump` marks a complex that moves H⁺ across the membrane.
const CHAIN = [
  { id: 'NADH', x: 14, y: 10, stations: ['complex1'] },
  { id: 'I', x: 46, y: 28, stations: ['complex1'], pump: true },
  { id: 'FADH₂', x: 56, y: 54, stations: ['complex2'], from: null, to: 'Q', name: 'left' },
  { id: 'Q', x: 80, y: 58, stations: ['complex1', 'complex2', 'complex3'], from: 'I' },
  { id: 'III', x: 112, y: 70, stations: ['complex3'], pump: true },
  { id: 'cyt c', x: 144, y: 80, stations: ['complex3', 'complex4'] },
  { id: 'IV', x: 176, y: 90, stations: ['complex4'], pump: true },
  { id: 'O₂', x: 208, y: 100, stations: ['complex4'] },
];

// The bacterium's: NDH-1 to the quinone pool, then bo₃ to O₂, or nitrate
// reductase to NO₃⁻. NO₃⁻ sits higher than O₂: less energy is released, so
// fewer protons move (§17 D10). The end not in use is drawn faint.
const BACTERIUM_CHAIN = [
  { id: 'NADH', x: 14, y: 10, stations: ['complex1'] },
  { id: 'NDH-1', x: 46, y: 28, stations: ['complex1'], pump: true },
  { id: 'FADH₂', x: 56, y: 54, stations: ['complex2'], from: null, to: 'Q', name: 'left' },
  { id: 'Q', x: 80, y: 58, stations: ['complex1', 'complex2', 'complex4', 'nar'], from: 'NDH-1' },
  { id: 'Nar', x: 124, y: 62, stations: ['nar'], pump: 'above', mode: 'nitrate' },
  { id: 'NO₃⁻', x: 172, y: 70, stations: ['nar'], mode: 'nitrate' },
  { id: 'bo₃', x: 124, y: 84, stations: ['complex4'], from: 'Q', pump: true, mode: 'aerobic' },
  { id: 'O₂', x: 172, y: 102, stations: ['complex4'], mode: 'aerobic' },
];

export const CHAIN_STATIONS = new Set(['complex1', 'complex2', 'complex3', 'complex4', 'nar']);

export function chainStaircase(sceneId, stationId, mode) {
  if (sceneId === 'bacterium') {
    return energyDiagram({
      steps: BACTERIUM_CHAIN.map((step) => ({ ...step, off: Boolean(step.mode) && step.mode !== mode })),
      stationId,
      label: 'Energy staircase: an electron falls from NADH through NDH-1 to the quinone pool, then through cytochrome bo₃ to O₂, or through nitrate reductase to nitrate, which sits higher than O₂. FADH₂ enters the quinone pool below NADH.',
    });
  }
  return energyDiagram({
    steps: CHAIN,
    stationId,
    label: 'Energy staircase: an electron falls from NADH through Complex I, ubiquinone, Complex III, cytochrome c and Complex IV to O₂. FADH₂ enters at ubiquinone, below NADH. Complexes I, III and IV pump protons.',
  });
}

// An energy diagram (M6 plan D5): each step a dot at its energy, joined to
// the step before it, or to `from` (`from: null` starts a new line, and
// `to` joins a step to a later one). Lifts
// by light are dashed, the steps of `stationId` are lit and `off` steps are
// faint. No numbers and no units.
function energyDiagram({ steps, lifts = [], stationId, label }) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '-26 -4 256 118');
  svg.setAttribute('class', 'zscheme');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', label);
  const el = (name, attrs, text) => {
    const node = document.createElementNS(ns, name);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    if (text) node.textContent = text;
    svg.append(node);
    return node;
  };
  el('line', { x1: -14, y1: 104, x2: -14, y2: 2, class: 'z-axis' });
  el('path', { d: 'M -17 8 L -14 2 L -11 8', class: 'z-axis' });
  el('text', { x: -20, y: 54, class: 'z-label', transform: 'rotate(-90 -20 54)', 'text-anchor': 'middle' }, 'Energy of the electron (higher is more energy)');
  const index = new Map(steps.map((step, i) => [step.id, i]));
  const lit = (step) => step.stations.includes(stationId);
  const faint = (step) => (step.off ? ' z-off' : '');
  // The falls, step by step, and the lifts by light.
  const edges = [];
  steps.forEach((step, i) => {
    if (i > 0 && step.from !== null) edges.push([step.from === undefined ? i - 1 : index.get(step.from), i]);
    if (step.to) edges.push([i, index.get(step.to)]);
  });
  for (const [from, to] of edges) {
    const a = steps[from];
    const b = steps[to];
    const lift = lifts.some(([x, y]) => x === from && y === to);
    const on = lit(a) && lit(b);
    el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: `${lift ? 'z-lift' : 'z-fall'}${faint(b)}${on ? ' z-on' : ''}` });
  }
  for (const [a, b] of lifts) {
    const at = steps[a];
    el('text', { x: (at.x + steps[b].x) / 2 - 4, y: (at.y + steps[b].y) / 2 + 2, class: 'z-light', 'text-anchor': 'end' }, 'light');
  }
  // A pump: a small arrow pointing up beside the complex, labelled H⁺.
  for (const step of steps) {
    if (!step.pump) continue;
    const x = step.x - 3;
    const y = step.pump === 'above' ? step.y - 4 : step.y + 14;
    el('path', { d: `M ${x} ${y} L ${x} ${y - 8} M ${x - 2} ${y - 5.5} L ${x} ${y - 8} L ${x + 2} ${y - 5.5}`, class: `z-pump${faint(step)}` });
    el('text', { x: x - 2.5, y, class: `z-pump-label${faint(step)}`, 'text-anchor': 'end' }, 'H⁺');
  }
  for (const step of steps) {
    const on = lit(step);
    el('circle', { cx: step.x, cy: step.y, r: on ? 3.2 : 2.4, class: `${on ? 'z-dot z-on' : 'z-dot'}${faint(step)}` });
    const name = step.name === 'left' ? { x: step.x - 5, y: step.y + 3, 'text-anchor': 'end' } : { x: step.x + 4, y: step.y - 4 };
    el('text', { ...name, class: `${on ? 'z-name z-on' : 'z-name'}${faint(step)}` }, step.id);
  }
  return svg;
}
