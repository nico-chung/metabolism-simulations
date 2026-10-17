import { REACTIONS } from '../chem/reactions/catalog.js';
import { CAM_BEATS, CAM_MOMENTS, HOPPER_WAITS, PS_BEATS, PS_ENDINGS, PS_KEY_BEATS, PS_MOMENTS } from './photosynthesis.js';
import { BACTERIAL_BEATS, BACTERIAL_ENDINGS, BEATS, ENDINGS, SPLIT, YEAST_ENDINGS } from './respiration.js';

// Watches engine events for the tag being followed and decides when the
// guide speaks. Beats are spaced so the student is not stopped too often,
// and a journey has at most a handful of them. Endings always speak.

const BEAT_SPACING = 6;
export const BEAT_LIMIT = 9;

// Turning points that are always worth a stop, however close together.
const KEY_BEATS = new Set(['aldolase', 'gapdh', 'pdh', 'shuttle', 'complex1', 'complex3', 'oxidase', 'synthase', 'ldh', 'pdc', 'adh', 'ndh1', 'bo3-quinol', 'bo3', 'nar-quinol', 'nar']);

// The bacterium's own words where they differ (§17).
function beatsFor(organism) {
  return organism === 'bacterium' ? { ...BEATS, ...BACTERIAL_BEATS } : BEATS;
}

function endingsFor(organism) {
  if (organism === 'bacterium') return { ...ENDINGS, ...BACTERIAL_ENDINGS };
  if (organism === 'yeast') return { ...ENDINGS, ...YEAST_ENDINGS };
  return ENDINGS;
}

// `said` is the stops spoken, by key; `heard` their words, so the same words
// are never said twice in one journey (M8.8).
export function createJourney() {
  return { key: null, beats: 0, last: -Infinity, ended: false, said: [], heard: [] };
}

function restart(journey, key) {
  journey.key = key;
  journey.beats = 0;
  journey.last = -Infinity;
  journey.ended = false;
  journey.said = [];
  journey.heard = [];
}

const ELEMENT_WORDS = { C: 'carbon', O: 'oxygen', H: 'hydrogen', N: 'nitrogen' };

// An ending's words for the atom that reached it.
function named(ending, label) {
  return { ...ending, text: ending.text.replace('{atom}', ELEMENT_WORDS[label?.[0]] ?? 'atom') };
}

// The words an atom hears at a station: its reactant's own (an oxygen of O₂
// at Complex IV), those for an atom leaving in CO₂, or the station's.
function atomWords(entry, event, atomId) {
  if (!entry) return null;
  const move = event.moves?.[atomId];
  const role = move?.from.split('.')[0];
  if (entry.roles?.[role]) return entry.roles[role];
  if (entry.released && move?.to.startsWith('co2.')) return entry.released;
  return entry.atom ?? null;
}

function involvesAtom(event, atomId) {
  return event.atoms?.includes(atomId) || Object.prototype.hasOwnProperty.call(event.moves ?? {}, atomId);
}

function electronIn(event, electronId) {
  const record = event.electrons;
  if (!record) return null;
  if (record.made.includes(electronId)) return 'made';
  if (record.ended.some((entry) => entry.id === electronId)) return 'ended';
  if (record.moved.some((entry) => entry.id === electronId)) return 'moved';
  return null;
}

// Electrons that left the molecule a followed atom was on, when the atom
// itself went somewhere else. At Complex I a glucose hydrogen becomes a
// matrix proton while its electrons go on to ubiquinone.
function splitAt(event, atomId) {
  if (event.type !== 'reaction' || !REACTIONS[event.reaction]?.split) return null;
  const move = event.moves?.[atomId];
  if (!move) return null;
  const [fromRole] = move.from.split('.');
  const [toRole] = move.to.split('.');
  const leaving = event.electrons.moved.filter((entry) => entry.from.split('.')[0] === fromRole && entry.to.split('.')[0] !== toRole);
  return leaving.length ? leaving.map((entry) => entry.id) : null;
}

function endingFor(event, tag, ENDINGS) {
  if (tag.electronId) {
    if (event.type === 'reaction' && electronIn(event, tag.electronId) === 'ended') {
      if (event.reaction === 'nar') return ENDINGS.nitriteElectron;
      if (event.reaction === 'ldh') return ENDINGS.lactateElectron;
      if (event.reaction === 'adh') return ENDINGS.ethanolElectron;
      return ENDINGS.electron;
    }
    return null;
  }
  const atomId = tag.persistentId;
  if (!atomId || !event.atoms?.includes(atomId)) return null;
  if (event.type === 'exit') {
    if (event.kind === 'co2') return named(ENDINGS.co2, event.labels?.[atomId]);
    if (event.kind === 'lactate') return ENDINGS.lactate;
    if (event.kind === 'ethanol') return ENDINGS.ethanol;
    if (event.kind === 'oxygen') return ENDINGS.oxygenOut;
    if (event.kind === 'nitrite') return ENDINGS.nitrite;
    if (event.kind === 'nitrate') return ENDINGS.nitrateOut;
    return named(ENDINGS.water, event.labels?.[atomId]);
  }
  if (event.type === 'bulk') {
    if (event.via === 'synthase') return ENDINGS.synthase;
    if (event.kind === 'proton') return ENDINGS.bulkProton;
    if (event.kind === 'pi') return ENDINGS.bulkPi;
    return ENDINGS.bulkWater;
  }
  return null;
}

// Returns what to show for this step's events, if anything:
// { beat }, { split }, or { end }. Only the first is returned.
export function observe(journey, events, tag, time, organism = 'human') {
  if (!tag) return null;
  if (LEAVES.has(organism)) return observeLeaf(journey, events, tag, time, organism);
  const beats = beatsFor(organism);
  const endings = endingsFor(organism);
  const key = journeyKey(tag);
  if (journey.key !== key) restart(journey, key);
  if (journey.ended) return null;
  for (const event of events) {
    const ending = endingFor(event, tag, endings);
    if (ending) {
      journey.ended = true;
      return { end: { ...ending, time } };
    }
    if (event.type !== 'reaction') continue;
    if (tag.persistentId && !tag.pairAtom) {
      const leaving = splitAt(event, tag.persistentId);
      if (leaving) return { split: { ...SPLIT, ...(organism === 'bacterium' ? { text: SPLIT.text.replace('matrix', 'cytoplasm') } : {}), electrons: leaving, time } };
    }
    let kind = null;
    if (tag.electronId && electronIn(event, tag.electronId)) kind = 'electron';
    else if (tag.persistentId && involvesAtom(event, tag.persistentId)) kind = 'atom';
    if (!kind) continue;
    const text = kind === 'atom' ? atomWords(beats[event.reaction], event, tag.persistentId) : beats[event.reaction]?.electron;
    if (!text || journey.heard.includes(text)) continue;
    if (journey.beats >= BEAT_LIMIT) continue;
    if (time - journey.last < BEAT_SPACING && !KEY_BEATS.has(event.reaction)) continue;
    journey.beats += 1;
    journey.last = time;
    journey.said.push(event.reaction);
    journey.heard.push(text);
    return { beat: { title: REACTIONS[event.reaction]?.enzyme ?? event.reaction, text, reaction: event.reaction, time } };
  }
  return null;
}

// The Photosynthesis tab (M6 plan §8) ------------------------------------------

const LEAVES = new Set(['c3', 'c4', 'cam']);
const PS_KEYS = new Set(PS_KEY_BEATS);

function journeyKey(tag) {
  return tag.electronId ? `e:${tag.electronId}` : tag.pairAtom ? `q:${tag.pairAtom}` : `p:${tag.persistentId}`;
}

function carbonNumber(label) {
  const match = /^C(\d)$/.exec(label ?? '');
  return match ? match[1] : null;
}

// What happened to the followed thing in one event on a leaf: a beat (with
// the key it is filed under), an end, or the hand-off of an electron tag to
// the hydrogen its electrons now hold (E7).
function leafMoment(event, tag, scene) {
  const cam = scene === 'cam';
  const BEATS = cam ? { ...PS_BEATS, ...CAM_BEATS } : PS_BEATS;
  const MOMENTS = cam ? { ...PS_MOMENTS, ...CAM_MOMENTS } : PS_MOMENTS;
  if (tag.electronId) {
    if (event.type !== 'reaction') return null;
    const handed = event.electrons?.handed?.find((entry) => entry.id === tag.electronId);
    if (handed) return { key: event.reaction, text: BEATS[event.reaction]?.hand ?? PS_BEATS['calvin-gapdh'].hand, handoff: handed.atom, force: true };
    if (electronIn(event, tag.electronId) === 'ended') return { end: PS_ENDINGS.electron };
    if (!electronIn(event, tag.electronId)) return null;
    const text = BEATS[event.reaction]?.electron;
    return text ? { key: event.reaction, text } : null;
  }
  const atom = tag.persistentId;
  if (!atom || tag.pairAtom) {
    // A water oxygen waiting for its electrons still hears the split.
    if (tag.pairAtom && event.type === 'reaction' && event.reaction === 'psii-split' && event.atoms?.includes(tag.pairAtom)) {
      return { key: 'psii-split', text: PS_BEATS['psii-split'].atom };
    }
    return null;
  }
  if (event.type === 'exit' && event.atoms?.includes(atom)) {
    if (event.kind === 'glucose') {
      if (tag.handed) return { end: PS_ENDINGS.glucoseHydrogen };
      const n = carbonNumber(event.labels?.[atom]);
      const ending = n ? PS_ENDINGS.glucose : PS_ENDINGS.glucoseAtom;
      return { end: { ...ending, text: ending.text.replace('{n}', n) } };
    }
    if (event.kind === 'oxygen') return { end: PS_ENDINGS.oxygenOut };
    if (event.kind === 'glycolate') {
      return { end: event.labels?.[atom]?.startsWith('C') ? PS_ENDINGS.glycolate : PS_ENDINGS.glycolateOxygen };
    }
    return { end: PS_ENDINGS.bulkWater };
  }
  if (event.type === 'bulk' && event.atoms?.includes(atom)) {
    if (event.via === 'synthase') return { end: PS_ENDINGS.synthase };
    if (event.kind === 'proton') return { end: PS_ENDINGS.bulkProton };
    return { end: PS_ENDINGS.bulkWater };
  }
  if (event.type === 'launch' && event.kind === 'water' && event.atoms?.includes(atom)) return { key: 'water', text: PS_MOMENTS.water };
  if (event.type === 'launch' && event.kind === 'co2' && event.atoms?.includes(atom)) {
    return { key: 'stoma', text: event.atoms[0] === atom ? PS_MOMENTS.stoma : PS_MOMENTS.stomaOxygen };
  }
  if (event.type === 'dock' && event.gas && event.kind === 'co2' && event.atoms?.includes(atom)) {
    if (event.pool === 'sheath') return { key: 'sheath', text: MOMENTS.sheath };
    return { key: 'air', text: event.station === 'pepc' ? MOMENTS.airPepc : MOMENTS.air };
  }
  // CAM's stores (E11, E13): the vacuole by night, the grain, and dawn.
  if (event.type === 'park' && event.atoms?.includes(atom)) {
    if (event.station === 'vacuole') return { key: 'vacuole', text: MOMENTS.vacuole };
    if (event.station === 'grain') return { key: 'grain', text: MOMENTS.grain, force: true };
  }
  if (event.type === 'unpark' && event.station === 'vacuole' && event.atoms?.includes(atom)) return { key: 'dawn', text: MOMENTS.dawn };
  if (event.type === 'fork' && event.atoms?.includes(atom)) {
    return event.to === 'export' ? { key: 'toExport', text: PS_MOMENTS.toExport } : { key: 'toRegen', text: PS_MOMENTS.toRegen, once: true };
  }
  if (event.type !== 'reaction' || !involvesAtom(event, atom)) return null;
  const move = event.moves?.[atom];
  if (event.reaction === 'calvin-gapdh' && move?.to.startsWith('pi.')) return { end: PS_ENDINGS.stromaPi };
  if (event.station === 'regen') return { key: 'regen', text: PS_BEATS.regen.atom, once: true };
  if (event.station === 'hexose') {
    if (event.reaction !== 'g6pase') return null;
    const n = carbonNumber(move?.to.split('.')[1]);
    return n ? { key: 'hexose', text: PS_BEATS.hexose.atom.replace('{n}', n), force: true } : null;
  }
  if (event.reaction === 'rubisco') {
    const fromCo2 = move?.from.startsWith('co2.');
    const words = !fromCo2 ? PS_BEATS.rubisco.lap : move.from === 'co2.C' ? PS_BEATS.rubisco.atom : PS_BEATS.rubisco.oxygen;
    return { key: 'rubisco', text: words, force: fromCo2 };
  }
  if (event.reaction === 'me') {
    const to = move?.to.split('.')[0];
    if (to === 'co2') return { key: 'me', text: BEATS.me.atom, force: true };
    if (to === 'nadph') return { key: 'me', text: BEATS.me.hydrogen };
    return { key: 'me', text: BEATS.me.backbone };
  }
  if (event.station === 'ppdk') return { key: 'ppdk', text: BEATS.ppdk.atom, once: true };
  if (cam && event.station === 'nightgly') return { key: 'nightgly', text: BEATS.nightgly.atom, once: true };
  if (cam && event.station === 'pep3pg') return { key: 'pep3pg', text: BEATS.pep3pg.atom, once: true };
  if (cam && event.station === 'starch') {
    if (event.reaction !== 'g6pase') return null;
    const n = carbonNumber(move?.to.split('.')[1]);
    return n ? { key: 'starch', text: BEATS.starch.atom.replace('{n}', n), force: true } : null;
  }
  if (event.reaction === 'rubisco-o2' && move?.from.startsWith('o2.')) return { key: 'rubisco-o2', text: PS_BEATS['rubisco-o2'].oxygen };
  const text = BEATS[event.reaction]?.atom;
  return text ? { key: event.reaction, text } : null;
}

// Waiting that is biology (E13): a carbon parked in a store, in a hopper
// for its partners (M8.8), or on the Calvin ring at night, is not stuck.
// Returns the words to say instead of the Waiting card, or null.
export function biologicalWait(scene, shot, point) {
  if (!point) return null;
  const item = point.item;
  if (item?.kind === 'hopper' && HOPPER_WAITS[item.station]) return HOPPER_WAITS[item.station];
  if (!scene?.clock) return null;
  if (item?.kind === 'parked') {
    const def = scene.stations.find((entry) => entry.id === item.station);
    if (def?.waits) return def.waits;
  }
  if (shot?.clock?.phase === 'night' || shot?.night > 0) return CAM_MOMENTS.night;
  return null;
}

const CAM_ONCE = new Set(['air', 'pepc', 'mdh-nad', 'vacuole', 'dawn', 'me', 'dit']);

function observeLeaf(journey, events, tag, time, scene) {
  const key = journeyKey(tag);
  if (journey.key !== key) restart(journey, key);
  if (journey.ended) return null;
  for (const event of events) {
    const moment = leafMoment(event, tag, scene);
    if (!moment) continue;
    // A CAM carbon refixed after a second night does not hear it all again.
    if (scene === 'cam' && CAM_ONCE.has(moment.key)) moment.once = true;
    if (moment.end) {
      journey.ended = true;
      return { end: { ...moment.end, time } };
    }
    const beat = { title: beatTitle(moment.key), text: moment.text, reaction: moment.key, time };
    // A hand-off always speaks: the student must see the tag move.
    if (moment.handoff) {
      journey.beats += 1;
      journey.last = time;
      journey.said.push(moment.key);
      journey.heard.push(moment.text);
      return { beat, handoff: moment.handoff };
    }
    if (moment.once && journey.said.includes(moment.key)) continue;
    if (journey.heard.includes(moment.text)) continue;
    if (journey.beats >= BEAT_LIMIT) continue;
    if (time - journey.last < BEAT_SPACING && !moment.force && !PS_KEYS.has(moment.key)) continue;
    journey.beats += 1;
    journey.last = time;
    journey.said.push(moment.key);
    journey.heard.push(moment.text);
    return { beat };
  }
  return null;
}

const MOMENT_TITLES = {
  vacuole: 'The vacuole',
  dawn: 'Morning',
  grain: 'The starch grain',
  nightgly: 'Night glycolysis',
  pep3pg: 'Back towards sugar',
  starch: 'Starch synthesis',
  stoma: 'Into the leaf',
  water: 'From the roots',
  sheath: 'The bundle sheath',
  ppdk: 'PPDK',
  air: 'The air space',
  toRegen: 'The junction',
  toExport: 'The junction',
  regen: 'Regeneration',
  hexose: 'Hexose assembly',
};

function beatTitle(key) {
  return MOMENT_TITLES[key] ?? REACTIONS[key]?.enzyme ?? key;
}

// The Waiting card's text for a particle stuck at `place`.
export function waitingText(place, oxygen) {
  place ??= 'here';
  if (!oxygen) {
    return `Your particle is waiting ${place}. Without oxygen the mitochondrion has stopped, so nothing here can move it on. Switch back to aerobic respiration for it to continue.`;
  }
  return `Your particle is waiting ${place}. Under this condition nothing can move it on. Choose None for it to continue.`;
}

// Short names for the stops that are not reactions, for the end card.
const MOMENT_SHORT = {
  stoma: 'Stoma',
  water: 'Xylem',
  air: 'Air space',
  sheath: 'Bundle sheath',
  toRegen: 'Junction',
  toExport: 'Export',
  vacuole: 'Vacuole',
  dawn: 'Dawn',
  grain: 'Starch grain',
};

// The stops a journey has narrated, for an end card.
export function journeySummary(journey) {
  const said = journey.said.map((id) => REACTIONS[id]?.short ?? MOMENT_SHORT[id] ?? id);
  if (!said.length) return '';
  return `Stops on the way: ${said.join(' → ')}`;
}

// Seconds to leave a beat on screen before it continues by itself.
export function readingTime(text) {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.min(7, Math.max(4, 1.6 + words * 0.24));
}
