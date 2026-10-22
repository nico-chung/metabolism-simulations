import { CONDITIONS, GROUPS, conditionApplies } from '../sim/conditions.js';
import { describeSelection } from './copy.js';

// One radio group per tab, one condition at a time (§3), under subheads
// (§16 D10), each group on the tab it belongs to (M6 plan D6).
function buildConditions(tab) {
  const fieldset = document.getElementById(`conditions-${tab}`);
  if (!fieldset || fieldset.querySelector('input')) return;
  const option = (id) => {
    const label = document.createElement('label');
    label.className = 'choice';
    label.dataset.condition = id;
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = `condition-${tab}`;
    input.value = id;
    if (id === 'none') input.checked = true;
    const text = document.createElement('span');
    text.textContent = CONDITIONS[id].label;
    label.append(input, text);
    return label;
  };
  fieldset.append(option('none'));
  for (const [group, title, groupTab] of GROUPS) {
    if (groupTab !== tab) continue;
    const head = document.createElement('p');
    head.className = 'subhead';
    head.dataset.group = group;
    head.textContent = title;
    fieldset.append(head);
    for (const [id, entry] of Object.entries(CONDITIONS)) {
      if (entry.group === group) fieldset.append(option(id));
    }
  }
}

// Each organism's second mode. Fermentation (human, yeast) and anaerobic
// respiration (the bacterium, with nitrate) are never conflated (§3).
const SECOND_MODE = { human: 'lactic', yeast: 'ethanol', bacterium: 'nitrate' };
const SECOND_LABEL = {
  human: 'Lactic Acid Fermentation',
  yeast: 'Ethanol Fermentation',
  bacterium: 'Anaerobic Respiration (Nitrate)',
};

export function bindRail(onChange) {
  buildConditions('respiration');
  buildConditions('photosynthesis');
  // The two tabs' narration switches are one setting.
  const switches = ['narration', 'narration-photosynthesis'].map((id) => document.getElementById(id)).filter(Boolean);
  for (const box of switches) box.addEventListener('change', () => { for (const other of switches) other.checked = box.checked; });
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const panels = {
    respiration: document.getElementById('panel-respiration'),
    photosynthesis: document.getElementById('panel-photosynthesis'),
  };

  function selected(name) {
    const input = document.querySelector(`input[name="${name}"]:checked`);
    return input ? input.value : null;
  }

  function read() {
    const tab = document.querySelector('[role="tab"][aria-selected="true"]').dataset.tab;
    const conditionName = tab === 'respiration' ? 'condition-respiration' : 'condition-photosynthesis';
    const organism = selected('organism');
    let mode = selected('mode');
    if (mode === 'ferment') mode = SECOND_MODE[organism] ?? 'lactic';
    // A leaf has one mode; light and stomata are conditions (M6 plan E10).
    if (tab === 'photosynthesis') mode = 'light';
    return {
      tab,
      organism,
      mode,
      pathway: selected('pathway'),
      condition: selected(conditionName),
    };
  }

  function syncControls() {
    const organism = selected('organism');
    const label = document.getElementById('mode-label');
    if (label) label.textContent = SECOND_LABEL[organism] ?? 'Lactic Acid Fermentation';
    const mode = selected('mode') === 'aerobic' ? 'aerobic' : SECOND_MODE[organism] ?? 'lactic';
    // Only what applies to this organism and mode is shown (§4.3).
    let changed = false;
    const shown = new Set();
    for (const label of document.querySelectorAll('#conditions-respiration .choice')) {
      const id = label.dataset.condition;
      const ok = conditionApplies(id, organism, mode);
      label.hidden = !ok;
      const input = label.querySelector('input');
      input.disabled = !ok;
      if (ok) shown.add(CONDITIONS[id].group);
      if (!ok && input.checked) {
        const none = document.querySelector('input[name="condition-respiration"][value="none"]');
        if (none) none.checked = true;
        changed = true;
      }
    }
    for (const head of document.querySelectorAll('#conditions-respiration .subhead')) head.hidden = !shown.has(head.dataset.group);
    const pathway = selected('pathway');
    const shownPs = new Set();
    for (const label of document.querySelectorAll('#conditions-photosynthesis .choice')) {
      const id = label.dataset.condition;
      const ok = conditionApplies(id, pathway, 'light');
      label.hidden = !ok;
      const input = label.querySelector('input');
      input.disabled = !ok;
      if (ok) shownPs.add(CONDITIONS[id].group);
      if (!ok && input.checked) {
        const none = document.querySelector('input[name="condition-photosynthesis"][value="none"]');
        if (none) none.checked = true;
        changed = true;
      }
    }
    for (const head of document.querySelectorAll('#conditions-photosynthesis .subhead')) head.hidden = !shownPs.has(head.dataset.group);
    return changed;
  }

  function selectTab(tab) {
    for (const button of tabs) {
      const on = button.dataset.tab === tab;
      button.setAttribute('aria-selected', on ? 'true' : 'false');
      button.tabIndex = on ? 0 : -1;
    }
    for (const [id, panel] of Object.entries(panels)) {
      panel.hidden = id !== tab;
    }
    publish();
  }

  function publish() {
    syncControls();
    const state = read();
    renderInspector(state);
    onChange(state);
  }

  for (const button of tabs) {
    button.addEventListener('click', () => selectTab(button.dataset.tab));
  }

  document.querySelector('[role="tablist"]').addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const current = tabs.findIndex((button) => button.getAttribute('aria-selected') === 'true');
    const step = event.key === 'ArrowRight' ? 1 : -1;
    const next = tabs[(current + step + tabs.length) % tabs.length];
    next.focus();
    selectTab(next.dataset.tab);
  });

  document.getElementById('rail').addEventListener('change', publish);
  // A control chosen with the mouse hands the keys back to the stage, so
  // Space, Left and Right play and step again (v1.1). Before, Right after a
  // click on a condition chose the next condition, and after a click on a
  // tab switched tabs. A choice made with the keyboard (detail 0) keeps its
  // focus.
  document.getElementById('rail').addEventListener('click', (event) => {
    if (event.detail === 0) return;
    const release = () => {
      const focused = document.activeElement;
      if (focused?.closest('#rail') && focused.matches('input, [role="tab"], summary')) focused.blur();
    };
    // Now for a tab or a summary; after the click for a label's input.
    release();
    setTimeout(release);
  });
  syncControls();
  renderInspector(read());

  return {
    read,
    // Only the shown tab's: the other tab keeps its world (M8.5).
    resetConditions(options = {}) {
      const none = document.querySelector(`input[name="condition-${read().tab}"][value="none"]`);
      if (none) none.checked = true;
      syncControls();
      if (!options.silent) publish();
    },
  };
}

export function renderInspector(state) {
  const body = document.getElementById('inspector-body');
  const view = describeSelection(state);
  body.replaceChildren();
  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  // Segments never break inside: "Human", "Brown Fat", "Aerobic Respiration".
  view.eyebrow.split(' · ').forEach((part, i) => {
    if (i) eyebrow.append(document.createTextNode(' · '));
    const segment = document.createElement('span');
    segment.className = 'term';
    segment.textContent = part;
    eyebrow.append(segment);
  });
  body.append(eyebrow);
  for (const paragraph of view.paragraphs) {
    const p = document.createElement('p');
    p.textContent = paragraph;
    body.append(p);
  }
  for (const line of view.equations ?? []) body.append(equationLine(line));
}

// An equation breaks only between its terms, never inside "6 O₂" or
// "about 32 ATP" (§16 W10).
function equationLine(text) {
  const equation = document.createElement('p');
  equation.className = 'equation';
  for (const part of text.split(/( \+ | → )/)) {
    if (part === ' + ' || part === ' → ') {
      equation.append(document.createTextNode(part));
      continue;
    }
    const term = document.createElement('span');
    term.className = 'term';
    term.textContent = part;
    equation.append(term);
  }
  return equation;
}

export function renderAtom(card, color) {
  const body = document.getElementById('inspector-body');
  body.replaceChildren();
  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  const swatch = document.createElement('span');
  swatch.className = 'swatch';
  swatch.style.background = color;
  swatch.setAttribute('aria-hidden', 'true');
  eyebrow.append(swatch, document.createTextNode(`${card.element}, tag ${card.tag}`));
  body.append(eyebrow);
  body.append(field('Origin', card.origin));
  body.append(field('Now', card.now));
  if (card.carrying) body.append(field('Bond', card.carrying));
  const oxidation = document.createElement('p');
  oxidation.className = 'ox';
  oxidation.textContent = card.oxidation;
  const caption = document.createElement('p');
  caption.className = 'ox-label';
  caption.textContent = 'Oxidation state';
  body.append(oxidation, caption);
  body.append(field('Charge', card.charge));
  body.append(field('Bonded to', card.bonded));
  if (card.history) {
    const history = document.createElement('p');
    history.className = 'history';
    history.textContent = card.history;
    body.append(history);
  }
  if (card.blurb) {
    const blurb = document.createElement('p');
    blurb.textContent = card.blurb;
    body.append(blurb);
  }
  if (card.journey) {
    const journey = document.createElement('ol');
    journey.className = 'journey';
    for (const line of card.journey) {
      const item = document.createElement('li');
      item.textContent = line;
      journey.append(item);
    }
    body.append(journey);
  }
  if (card.pending) {
    const pending = document.createElement('p');
    pending.className = 'tagpair';
    pending.textContent = card.pendingText ?? 'Waiting for the electrons this carbon will give up.';
    body.append(pending);
  }
  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.textContent = 'Click the atom again to clear it. Escape clears every tag. P follows the selected atom.';
  body.append(hint);
}

export function renderElectron(card, color) {
  const body = document.getElementById('inspector-body');
  body.replaceChildren();
  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  const swatch = document.createElement('span');
  swatch.className = 'swatch';
  swatch.style.background = color;
  swatch.setAttribute('aria-hidden', 'true');
  eyebrow.append(swatch, document.createTextNode(`Electron, tag ${card.tag}`));
  body.append(eyebrow);
  body.append(field('Origin', card.origin));
  body.append(field('Now', card.now));
  if (card.blurb) {
    const blurb = document.createElement('p');
    blurb.textContent = card.blurb;
    body.append(blurb);
  }
  if (card.journey?.length) {
    const journey = document.createElement('ol');
    journey.className = 'journey';
    for (const line of card.journey) {
      const item = document.createElement('li');
      item.textContent = line;
      journey.append(item);
    }
    body.append(journey);
  }
  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.textContent = 'Electrons ride carriers as small cyan dots. Click the dot again to clear the tag.';
  body.append(hint);
}

export function renderStation(card) {
  const body = document.getElementById('inspector-body');
  body.replaceChildren();
  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = card.name;
  body.append(eyebrow);
  if (card.blurb) {
    const blurb = document.createElement('p');
    blurb.textContent = card.blurb;
    body.append(blurb);
  }
  for (const [name, value] of card.fields ?? []) body.append(field(name, value));
  if (card.equation) body.append(equationLine(card.equation));
  if (card.zscheme) body.append(card.zscheme);
  // The counterpart in the other tab (M8.4), set apart under its own title so
  // a chloroplast in a respiration card reads as a comparison.
  if (card.compare) {
    const section = document.createElement('div');
    section.className = 'compare';
    const title = document.createElement('p');
    title.className = 'compare-title';
    title.textContent = card.compare.title;
    const text = document.createElement('p');
    text.textContent = card.compare.text;
    section.append(title, text);
    body.append(section);
  }
}

function field(name, value) {
  const paragraph = document.createElement('p');
  const key = document.createElement('span');
  key.className = 'k';
  key.textContent = name;
  paragraph.append(key, document.createTextNode(` ${value}`));
  return paragraph;
}

export function stageLabel(state) {
  if (state.tab === 'photosynthesis') {
    if (state.pathway === 'c4') {
      return 'Schematic of a C4 leaf: a vein, the bundle-sheath cell that wraps it, and a mesophyll cell under the stoma, joined by plasmodesmata. The mesophyll chloroplast holds the light reactions and the CO₂ pump; the bundle-sheath chloroplast holds the Calvin cycle. CO₂ and water wait in the tray. Click an atom to tag it. Drag to pan. Scroll or pinch to zoom.';
    }
    if (state.pathway === 'cam') {
      return 'Schematic of a CAM leaf cell: the epidermis with a stoma, an air space, and a cell with its chloroplast, a starch grain and a large vacuole. By night the stoma opens and CO₂ is stored in the vacuole as malate; by day the stoma closes and the Calvin cycle fixes that CO₂. A dial shows the time of day. Click an atom to tag it. Drag to pan. Scroll or pinch to zoom.';
    }
    return 'Schematic of a C3 leaf cell: the epidermis with a stoma, an air space, and a mesophyll cell with its chloroplast blown up. CO₂ and water wait in the tray. Click an atom to tag it. Drag to pan. Scroll or pinch to zoom.';
  }
  const cell = state.condition === 'ucp1' ? 'brown fat cell' : 'human cell';
  return `Schematic of a ${cell} with glucose and oxygen in the tray. Click an atom to tag it. Drag to pan. Scroll or pinch to zoom.`;
}
