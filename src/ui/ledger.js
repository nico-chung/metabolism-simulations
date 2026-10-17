const NAMES = {
  glucose: 'Glucose',
  o2: 'O₂',
  co2: 'CO₂',
  h2o: 'H₂O',
  lactate: 'Lactate',
  ethanol: 'Ethanol',
  nitrate: 'NO₃⁻',
  nitrite: 'NO₂⁻',
  atp: 'ATP',
  heat: 'Heat',
};

// The chips in each mode's net equation (§16 W10), in reading order.
const BY_MODE = {
  aerobic: ['glucose', 'o2', 'co2', 'h2o', 'atp'],
  lactic: ['glucose', 'lactate', 'atp'],
  ethanol: ['glucose', 'ethanol', 'co2', 'atp'],
  nitrate: ['glucose', 'nitrate', 'co2', 'h2o', 'nitrite', 'atp'],
};
const ORDER = ['glucose', 'o2', 'nitrate', 'co2', 'h2o', 'nitrite', 'lactate', 'ethanol', 'atp', 'heat'];

function ledgerChips(ledger, mode, leak) {
  const keys = new Set(BY_MODE[mode] ?? BY_MODE.aerobic);
  // A run that switched mode keeps what it has already counted. Water is
  // counted only once oxygen has been used, so fermentation's bookkeeping
  // of bulk water never shows as a stray negative.
  if (ledger.o2 > 0) {
    keys.add('o2');
    keys.add('h2o');
  }
  if (ledger.nitrate > 0) {
    keys.add('nitrate');
    keys.add('h2o');
  }
  for (const key of ['co2', 'nitrite', 'lactate', 'ethanol', 'heat']) if (ledger[key] > 0) keys.add(key);
  if (leak) keys.add('heat');
  return ORDER.filter((key) => keys.has(key));
}

// A leaf's chips (M6 plan §7, D12): what goes in and what comes out, so the
// net equation 6 CO₂ + 12 H₂O → C₆H₁₂O₆ + 6 O₂ + 6 H₂O assembles itself.
const LEAF_CHIPS = [
  ['photons', 'Photons'],
  ['split', 'H₂O split'],
  ['fixed', 'CO₂ fixed'],
  ['o2', 'O₂'],
  ['glucose', 'Glucose'],
];

// What one glucose has cost so far, from the counters: six CO₂ make one.
// The NADPH that malic enzyme hands back (C4, CAM) was only carried by
// malate, not spent, so the cost is what was used less what came back.
export function perGlucose(ledger) {
  if (!ledger.fixed) return null;
  const k = 6 / ledger.fixed;
  const nadph = ledger.nadphUsed - (ledger.released ?? 0);
  return { atp: Math.round(ledger.atpUsed * k), nadph: Math.round(nadph * k), photons: Math.round(ledger.photons * k) };
}

// NADH and FADH₂ made for each glucose, from the counters (M8.6). In
// respiration a glucose counts once its carbon has left: as CO₂, as lactate
// (three carbons) or as ethanol (two, its third leaving as CO₂). Fermentation
// makes its NADH in glycolysis, soon after the glucose comes in, while the
// lactate or ethanol leaves much later, so there each glucose taken in counts.
// Fermentation makes no FADH₂, so fadh2 is null there.
export function carriersPerGlucose(ledger, mode) {
  const ferment = mode === 'lactic' || mode === 'ethanol';
  const done = ferment
    ? (ledger.nadh ? ledger.glucose : 0)
    : ((ledger.co2 ?? 0) + 3 * (ledger.lactate ?? 0) + 2 * (ledger.ethanol ?? 0)) / 6;
  if (!(done >= 1)) return null;
  const nadh = Math.round((ledger.nadh ?? 0) / done);
  const fadh2 = ferment && !ledger.fadh2 ? null : Math.round((ledger.fadh2 ?? 0) / done);
  return { nadh, fadh2 };
}

// What goes in, as against what comes out, for the arrow between them.
// Glucose and O₂ go in to respiration and come out of photosynthesis.
const INPUTS = { respiration: new Set(['glucose', 'o2', 'nitrate']), photosynthesis: new Set(['photons', 'split', 'fixed']) };

// The counts the chips show, for the restart past 9999 (M8.9). The
// per-glucose figures are ratios, not counts, and are left out.
export function ledgerValues(ledger, { mode, leak, tab } = {}) {
  if (tab === 'photosynthesis') return LEAF_CHIPS.map(([key]) => ledger[key] ?? 0);
  const keys = ledgerChips(ledger, mode, leak);
  const values = keys.map((key) => ledger[key] ?? 0);
  if (keys.includes('atp')) values.push(ledger.atpSub ?? 0, ledger.atpOx ?? 0);
  return values;
}

// Every number has four places (a minus sign takes one), so the chips keep
// their width. Past them, the scene starts again.
export function ledgerOverflow(values) {
  return values.some((value) => value > 9999 || value < -999);
}

// The row (M8.9): what has gone in, an arrow, what has come out, the
// per-glucose figures, and after a rule the gauges, which show levels now
// rather than counts since reset.
export function renderLedger(ledger, level, protons = 0, extra = {}) {
  const root = document.getElementById('ledger');
  if (!root) return;
  root.replaceChildren();
  const leaf = extra.scene?.tab === 'photosynthesis';
  const keys = leaf ? LEAF_CHIPS.map(([key]) => key) : ledgerChips(ledger, extra.mode, extra.leak);
  const names = leaf ? Object.fromEntries(LEAF_CHIPS) : NAMES;
  let arrow = false;
  for (const key of keys) {
    if (!arrow && !INPUTS[leaf ? 'photosynthesis' : 'respiration'].has(key)) {
      root.append(mark('arrow', '→'));
      arrow = true;
    }
    const chip = countChip(names[key], ledger[key] ?? 0);
    if (key === 'atp') atpSplit(chip, ledger);
    if (key === 'glucose') chip.title = glucoseTip(leaf, extra.scene);
    root.append(chip);
  }
  root.append(leaf ? leafPerGlucose(ledger) : carrierChip(ledger, extra.mode));
  root.append(mark('rule', ''));
  if (leaf) {
    const reserveTip = extra.scene?.life?.kind === 'store'
      ? 'The starch grain: glucose stored by day, spent at night by night glycolysis and taken slowly by the rest of the plant. The cell dies only if it stays empty.'
      : 'The plant’s stored sugar. Glucose sent to the rest of the plant fills it; the plant’s own respiration and growth drain it slowly, so it lasts through a night. The cell dies only if it stays empty.';
    root.append(meter('Sugar reserve', reserveTip, extra.reserve ?? 0, 'reserve'));
    root.append(meter('H⁺ gradient', `Proton gradient: how full the ${extra.reservoir ?? 'thylakoid lumen'} is. The pumps stop when it is full.`, protons, 'protons'));
    return;
  }
  root.append(meter('ATP level', 'ATP level: the share of the cytosol’s adenosine (the cytoplasm’s, in a bacterium) that is ATP. Cell work consumes it.', level, 'atp'));
  root.append(meter('H⁺ gradient', `Proton gradient: how full the ${extra.reservoir ?? 'intermembrane space'} is. The pumps stop when it is full.`, protons, 'protons'));
}

function glucoseTip(leaf, scene) {
  if (!leaf) return 'Glucose taken in since reset.';
  return scene?.life?.kind === 'store'
    ? 'Net glucose since reset: made into starch by day, less what night glycolysis breaks down, so it falls at night. Six CO₂ fixed make one.'
    : 'Glucose made since reset: six CO₂ fixed make one.';
}

// The arrow between inputs and outputs, and the rule before the gauges.
function mark(kind, text) {
  const span = document.createElement('span');
  span.className = `ledger-${kind}`;
  span.setAttribute('aria-hidden', 'true');
  span.textContent = text;
  return span;
}

// A number in its own fixed slot, with a true minus sign.
function num(value, kind = 'num') {
  const span = document.createElement('span');
  span.className = kind;
  span.textContent = typeof value === 'number' ? (value < 0 ? `−${-value}` : String(value)) : value;
  return span;
}

function countChip(label, value) {
  const chip = document.createElement('span');
  chip.className = 'chip';
  const name = document.createElement('span');
  name.textContent = label;
  chip.append(name, num(value));
  return chip;
}

// The per-glucose chip: a label, then numbers in narrower slots, with a
// dash in each until the first glucose is done.
function perChip(parts, title) {
  const chip = document.createElement('span');
  chip.className = 'chip per';
  chip.title = title;
  const name = document.createElement('span');
  name.textContent = 'Per glucose';
  const split = document.createElement('span');
  split.className = 'split';
  parts.forEach(([value, unit], i) => {
    if (i) split.append(' · ');
    split.append(num(value ?? '–', 'n3'), ` ${unit}`);
  });
  chip.append(name, split);
  return chip;
}

function leafPerGlucose(ledger) {
  const per = perGlucose(ledger);
  return perChip([[per?.atp, 'ATP'], [per?.nadph, 'NADPH'], [per?.photons, 'photons']],
    'ATP, NADPH and photons used for each glucose, counted since reset: six CO₂ fixed make one glucose. Dashes until the first CO₂ is fixed.');
}

function carrierChip(ledger, mode) {
  const per = carriersPerGlucose(ledger, mode);
  const ferment = mode === 'lactic' || mode === 'ethanol';
  const parts = [[per?.nadh, 'NADH']];
  if (!ferment || ledger.fadh2) parts.push([per?.fadh2, 'FADH₂']);
  return perChip(parts, 'The NADH and FADH₂ made for each glucose whose carbon has all left the cell, counted since reset. They carry its electrons to the chain. Dashes until the first glucose is used up.');
}

// A labelled gauge, styled as a chip so it reads as part of the ledger.
function meter(label, title, level, kind) {
  const chip = document.createElement('span');
  chip.className = 'chip meter';
  chip.title = title;
  const name = document.createElement('span');
  name.textContent = label;
  const value = Math.round(Math.min(1, Math.max(0, level)) * 100);
  const gauge = document.createElement('span');
  gauge.className = `gauge gauge-${kind}`;
  gauge.setAttribute('role', 'meter');
  gauge.setAttribute('aria-label', label);
  gauge.setAttribute('aria-valuemin', '0');
  gauge.setAttribute('aria-valuemax', '100');
  gauge.setAttribute('aria-valuenow', String(value));
  const bar = document.createElement('span');
  bar.style.width = `${value}%`;
  gauge.append(bar);
  chip.append(name, gauge);
  return chip;
}

// Net ATP, split by how it was made: by enzymes of glycolysis and the cycle
// (substrate-level, net of the two spent at the start of glycolysis), and by
// ATP synthase (oxidative phosphorylation).
function atpSplit(chip, ledger) {
  const split = document.createElement('span');
  split.className = 'split';
  split.append(num(ledger.atpSub ?? 0), ' substrate-level + ', num(ledger.atpOx ?? 0), ' oxidative');
  chip.append(split);
  chip.title = 'Net ATP made since reset. Substrate-level: made by enzymes of glycolysis and the citric acid cycle, less the ATP glycolysis spends. Oxidative: made by ATP synthase, driven by the proton gradient.';
}
