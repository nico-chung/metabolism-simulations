import { describeAtom } from '../chem/describe.js';
import { formatSigned } from '../chem/oxidation.js';
import { REACTIONS } from '../chem/reactions/catalog.js';
import { getSpecies } from '../chem/species/index.js';
import { counterpartCard } from '../scenes/counterparts.js';
import { findAtom, findElectron } from '../sim/molecules.js';
import { parkedCount } from '../sim/stores.js';
import { partCard } from './parts.js';
import { atomPoint, electronPoint } from '../sim/snapshot.js';
import { renderAtom, renderElectron, renderInspector, renderStation, stageLabel } from './rail.js';
import { CHAIN_STATIONS, Z_STATIONS, chainStaircase, equationOf, zScheme } from './station.js';

// The rail's inspector: the card for the focused tag, the clicked station or
// the current scene. `view` reads the page's state through getters (world,
// shown, stationFocus) and functions (scene, focusTag, state), so the
// inspector holds nothing but the key of the card it last drew.
export function createInspector(view) {
  const { canvas, tokens } = view;
  let inspectorKey = '';

  function syncInspector() {
    const state = view.state();
    const tag = view.focusTag();
    if (tag?.electronId) {
      renderElectronCard(tag);
      return;
    }
    if (tag?.persistentId && view.world.atoms[tag.persistentId]) {
      renderAtomCard(tag);
      return;
    }
    if (view.partFocus) {
      const part = view.partFocus;
      const counts = part.kind === 'store' ? { [part.id]: parkedCount(view.world, part.id) } : {};
      const card = partCard(part, view.scene(), counts);
      const key = JSON.stringify(['part', part.kind, part.species ?? part.id, card.fields]);
      if (key === inspectorKey) return;
      inspectorKey = key;
      renderStation(card);
      canvas.setAttribute('aria-label', `${card.name}. ${card.blurb}`);
      return;
    }
    if (view.stationFocus) {
      const def = view.scene().stations.find((entry) => entry.id === view.stationFocus);
      const reaction = def ? REACTIONS[def.modes[view.world.stations[def.id].mode].reaction] : null;
      if (reaction) {
        const key = `station:${view.stationFocus}:${reaction.id}:${view.world.mode}`;
        if (key === inspectorKey) return;
        inspectorKey = key;
        const mode = def.modes[view.world.stations[def.id].mode];
        const photons = mode.inputs.filter((input) => input.from === 'light').reduce((sum, input) => sum + input.count, 0);
        renderStation({
          name: reaction.enzyme,
          blurb: reaction.blurb,
          equation: equationOf(reaction, photons),
          compare: counterpartCard(view.scene().id, def.id),
          zscheme: energyOf(view.scene(), def.id, view.world.mode),
        });
        canvas.setAttribute('aria-label', `${reaction.enzyme}. ${reaction.blurb}`);
        return;
      }
    }
    const key = `mode:${state.tab}:${state.organism}:${state.pathway}:${state.condition}`;
    if (key === inspectorKey) return;
    inspectorKey = key;
    renderInspector(state);
    canvas.setAttribute('aria-label', stageLabel(state));
  }

  // The light reactions' Z-scheme, or the respiration chain's staircase.
  function energyOf(scene, stationId, mode) {
    if (scene.tab === 'photosynthesis') return Z_STATIONS.has(stationId) ? zScheme(stationId) : null;
    return CHAIN_STATIONS.has(stationId) ? chainStaircase(scene.id, stationId, mode) : null;
  }

  function renderAtomCard(tag) {
    const atom = view.world.atoms[tag.persistentId];
    const found = findAtom(view.world, tag.persistentId);
    const point = atomPoint(view.shown, tag.persistentId);
    let card;
    if (found) {
      card = describeAtom(getSpecies(found.molecule.species), found.label, tag.n, {
        place: point?.place ?? 'in the cell',
        origin: atom.origin,
      });
    } else {
      const last = atom.journey.at(-1);
      card = {
        element: last ? elementName(last) : 'Atom',
        tag: tag.n,
        origin: atom.origin,
        now: 'No longer on the stage. The guide has stopped following it.',
        oxidation: formatSigned(atom.oxidation ?? 0),
        charge: '—',
        bonded: '—',
      };
    }
    card.history = atom.history.length > 1 ? atom.history.map((value) => formatSigned(value)).join(' → ') : '';
    card.blurb = blurbAt(point);
    card.journey = journeyLines(atom.journey);
    card.pending = Boolean(tag.pairAtom);
    // A carbon gives up electrons to a dehydrogenase; a water oxygen gives up
    // its electrons at photosystem II (M6 plan E6).
    const el = found ? getSpecies(found.molecule.species).atoms[found.label]?.el : null;
    card.pendingText = el === 'O' ? 'Waiting for photosystem II to split this water and take its electrons.' : 'Waiting for the electrons this carbon will give up.';
    // A hydrogen that took over an electron tag (E7) says whose electrons it holds.
    card.carrying = atom.carrying ? `Carrying electrons from ${atom.carrying}` : '';
    const key = JSON.stringify(['a', tag.n, tag.persistentId, card.now, card.history, card.blurb, card.journey, card.pending, card.carrying]);
    if (key === inspectorKey) return;
    inspectorKey = key;
    renderAtom(card, tokens[`tag-${tag.n}`]);
    canvas.setAttribute('aria-label', `${card.element}, tag ${card.tag}. ${card.now}. Oxidation state ${card.oxidation}.`);
  }

  function elementName(entry) {
    const species = getSpecies(entry.species);
    const el = species.atoms[entry.label]?.el;
    return { C: 'Carbon', H: 'Hydrogen', O: 'Oxygen', P: 'Phosphorus', N: 'Nitrogen' }[el] ?? 'Atom';
  }

  function renderElectronCard(tag) {
    const electron = view.world.electrons[tag.electronId];
    const found = findElectron(view.world, tag.electronId);
    const point = electronPoint(view.shown, tag.electronId);
    let now;
    if (found) {
      const species = getSpecies(found.molecule.species);
      const place = point?.place ?? 'in the cell';
      // A lone electron waits in a station's store: Complex IV, bo₃, nitrate
      // reductase, PSII's manganese cluster, NADP⁺ reductase, the cyclic site.
      const holder = Object.values(view.world.stations).find((station) => station.store.includes(found.molecule.id));
      const where = holder ? stationName(holder.id) : 'a station';
      now = found.molecule.species === 'electron' ? `Waiting inside ${where}, ${place}` : `On ${species.short}, ${place}`;
    } else if (point) {
      now = `Passing through ${stationName(point.electron?.on)}, ${point.place}`;
    } else if (electron?.end) {
      now = electron.end.enzyme ? `It ended at ${electron.end.enzyme}.` : 'The guide has stopped following it.';
    } else if (electron) {
      now = 'In a station';
    } else {
      now = 'Not taken from food yet.';
    }
    const card = {
      tag: tag.n,
      origin: electron ? `Taken from ${electron.origin}` : 'Comes from food',
      now,
      blurb: blurbAt(point),
      journey: electron ? journeyLines(electron.journey) : [],
    };
    const key = JSON.stringify(['e', tag.n, tag.electronId, card.now, card.blurb, card.journey]);
    if (key === inspectorKey) return;
    inspectorKey = key;
    renderElectron(card, tokens[`tag-${tag.n}`]);
    canvas.setAttribute('aria-label', `Electron, tag ${card.tag}. ${card.now}.`);
  }

  function stationName(id) {
    const def = view.scene().stations.find((entry) => entry.id === id);
    if (!def) return id ?? 'a station';
    return REACTIONS[def.modes[view.world.stations[def.id].mode].reaction]?.enzyme ?? id;
  }

  function blurbAt(point) {
    const item = point?.item;
    let stationId = null;
    if (item?.kind === 'tween') stationId = String(item.key).split(':')[0];
    else if (point?.electron?.on && view.world.stations[point.electron.on]) stationId = point.electron.on;
    if (!stationId) return '';
    const def = view.scene().stations.find((entry) => entry.id === stationId);
    const station = view.world.stations[stationId];
    if (!def || !station || station.phase !== 'work') return '';
    return REACTIONS[def.modes[station.mode].reaction]?.blurb ?? '';
  }

  function journeyLines(list) {
    const lines = [];
    for (let i = list.length - 1; i >= 0 && lines.length < 8; i -= 1) {
      const entry = list[i];
      const name = getSpecies(entry.species).label;
      lines.push(entry.enzyme ? `${entry.enzyme} · ${name}` : name);
    }
    return lines;
  }

  return {
    sync: syncInspector,
    // The rail redraws the inspector on every change; this puts the card back.
    refresh() {
      inspectorKey = '';
      syncInspector();
    },
  };
}
