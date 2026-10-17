// A drawable picture of the world at one moment: where every molecule,
// proton and electron is. It reads the world and never changes it. Two
// snapshots taken one step apart can be blended, so frames fall between
// engine steps and nothing ticks.

import { REACTIONS } from '../chem/reactions/catalog.js';
import { getSpecies } from '../chem/species/index.js';
import { STRIP_HALF, STRIP_Y } from '../scenes/human.js';
import { MOLECULE_SCALE, speciesBounds } from '../scenes/sizes.js';
import {
  BELTS,
  DEFS,
  DRIFTS,
  LOOPS,
  bindWorld,
  currentScene,
  PARAMS,
  arriveProgress,
  atpLevel,
  easeGlide,
  entryS,
  internalPoint,
  protonLevel,
  protonPosition,
  settleOffset,
  slotOffsets,
  slotPoint,
  storePoint,
  timesOf,
  loadTime,
  hopperDrawn,
  RELEASE_EASE,
  GLOW_TIME,
  clockPhase,
  clockTime,
  parkPoint,
} from './engine.js';
import { choreography, slotAt } from './choreography.js';
import { pairsOf } from './molecules.js';
import { pointAt } from './path.js';
import { marksFor } from './conditions.js';
import { inEllipse, inRoundRect } from '../scenes/geometry.js';

const SCALE = MOLECULE_SCALE;
const p = {};

export function ease(t) {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - ((-2 * x + 2) ** 3) / 2;
}

function lerp(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function snapshot(world) {
  bindWorld(world);
  const scene = currentScene();
  const shot = {
    time: world.time,
    sceneId: world.sceneId,
    items: [],
    protons: [],
    electrons: [],
    stations: [],
    rotor: world.rotor.angle,
    ledger: { ...world.ledger },
    atpLevel: atpLevel(world),
    protonLevel: protonLevel(world),
    // The prompt shows until the first feed molecule leaves the tray: the
    // glucose of a respiring cell, the first launch of a leaf's supplies.
    prompt: scene.feed ? world.tray[scene.feed.id] != null && world.fed === 0 : !world.launched,
    tray: { ...world.tray },
    reserveLevel: reserveLevel(world, scene),
    // CAM's clock and stores (E10, E11): the dial, the night tint, the
    // vacuole's fill and the grain's size.
    clock: clockOf(world, scene),
    night: nightOf(world, scene),
    stores: Object.fromEntries(scene.stations.filter((def) => def.park).map((def) => [def.id, { count: world.stations[def.id].parked.length, cap: def.park.cap }])),
    marks: marksFor(world.condition),
    leak: world.leak?.kind ?? null,
    oxygen: world.oxygen !== false,
    supplies: { oxygen: world.oxygen !== false, nitrate: Boolean(world.nitrate) },
    motors: Object.fromEntries(Object.entries(world.motors ?? {}).map(([id, motor]) => [id, { phase: motor.phase, v: motor.v }])),
    dead: Boolean(world.dead),
    vitality: world.dead ? (world.pace ?? 0) : 1,
    stoma: world.stomata ?? 1,
  };
  addTray(world, shot);
  addBelts(world, shot);
  addLoops(world, shot);
  for (const def of scene.stations) addStation(world, def, world.stations[def.id], shot);
  addDrifts(world, shot);
  addGas(world, shot);
  addTransits(world, shot);
  addReservoir(world, shot);
  addLight(world, shot);
  return shot;
}

function reserveLevel(world, scene) {
  const life = scene.life;
  if (life?.kind === 'reserve') return Math.min(1, (world.reserve ?? life.start ?? life.cap) / life.cap);
  if (life?.kind === 'store') return Math.min(1, world.stations[life.station].parked.length / DEFS[life.station].park.cap);
  return null;
}

// The night tint eases in over 3 s after dusk and out over 3 s after dawn.
const TINT_EASE = 3;
function clockOf(world, scene) {
  const clock = scene.clock;
  if (!clock) return null;
  const t = clockTime(world, scene);
  const phase = clockPhase(world, scene);
  const night = phase === 'night' ? Math.min(1, (t - clock.dayLength) / TINT_EASE) : Math.max(0, 1 - t / TINT_EASE);
  return { phase, t, period: clock.period, dayLength: clock.dayLength, night: ease(night) };
}

// How far the stage has dimmed for night: CAM's night, or a darkness the
// user chose, which eases in and out over 3 s from when it was chosen.
function nightOf(world, scene) {
  const flip = world.darkFlip;
  let dark = 0;
  if (flip) {
    const f = Math.min(1, Math.max(0, (world.time - flip.time) / TINT_EASE));
    dark = ease(flip.dark ? f : 1 - f);
  } else if (world.basePatch?.light === false) dark = 1;
  return Math.max(dark, clockOf(world, scene)?.night ?? 0);
}

// Items ----------------------------------------------------------------------

function center(speciesId) {
  const box = speciesBounds(speciesId);
  return { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
}

function molItem(world, molId, at, extra = {}) {
  const molecule = world.molecules[molId];
  if (!molecule) return null;
  const mid = center(molecule.species);
  const item = {
    key: molId,
    id: molId,
    species: molecule.species,
    atomIds: molecule.atoms,
    x: at.x - mid.x * (extra.scale ?? SCALE),
    y: at.y - mid.y * (extra.scale ?? SCALE),
    cx: at.x,
    cy: at.y,
    scale: extra.scale ?? SCALE,
    alpha: extra.alpha ?? 1,
    place: extra.place ?? placeOf(at.x, at.y),
    kind: extra.kind ?? 'belt',
  };
  if (extra.station) item.station = extra.station;
  return item;
}

function push(world, shot, molId, at, extra) {
  const molecule = world.molecules[molId];
  if (!molecule) return;
  if (molecule.species === 'proton') {
    shot.protons.push({ key: molId, id: molId, atomId: molecule.atoms.H, x: at.x, y: at.y, alpha: extra?.alpha ?? 1, place: placeOf(at.x, at.y) });
    return;
  }
  if (molecule.species === 'electron') {
    for (const id of molecule.electrons ?? []) shot.electrons.push({ id, x: at.x, y: at.y, alpha: extra?.alpha ?? 1, on: 'Complex IV' });
    return;
  }
  const item = molItem(world, molId, at, extra);
  shot.items.push(item);
  addElectrons(world, shot, molecule, item);
}

// Electrons ride carriers as dots beside the body.
const DOT_OFFSETS = {
  1: [[0, -0.8]],
  2: [[-0.55, -0.8], [0.55, -0.8]],
};

function addElectrons(world, shot, molecule, item) {
  const list = molecule.electrons;
  if (!list?.length) return;
  const body = getSpecies(molecule.species).atoms.body ?? { x: 0, y: 0 };
  const bx = item.x + body.x * SCALE;
  const by = item.y + body.y * SCALE;
  const offsets = DOT_OFFSETS[list.length] ?? DOT_OFFSETS[2];
  list.forEach((id, i) => {
    if (!id) return;
    const [ox, oy] = offsets[i] ?? [0, -0.8];
    shot.electrons.push({ id, x: bx + ox * SCALE, y: by + oy * SCALE, alpha: item.alpha, on: getSpecies(molecule.species).short, carrier: molecule.id });
  });
}

function addTray(world, shot) {
  const scene = currentScene();
  const tray = scene.tray;
  const feed = scene.feed;
  if (feed && world.tray[feed.id]) push(world, shot, world.tray[feed.id], tray[feed.id], { place: 'in the tray', kind: 'tray' });
  // A supply waits in the tray only while it is open; it fades with it.
  for (const supply of scene.supplies ?? []) {
    const id = supply.id;
    if (!world.tray[id] || !tray[id]) continue;
    const shown = world.shown?.[id] ?? 0;
    if (shown > 0.01) push(world, shot, world.tray[id], tray[id], { place: 'in the tray', kind: 'tray', alpha: shown });
  }
  // A gas that comes in through the stoma waits outside it (E9).
  for (const entry of scene.gas?.trays ?? []) {
    if (world.tray[entry.id] && tray[entry.id]) push(world, shot, world.tray[entry.id], tray[entry.id], { place: 'in the tray', kind: 'tray' });
  }
}

function addBelts(world, shot) {
  for (const def of currentScene().belts) {
    for (const item of world.belts[def.id].items) {
      pointAt(def.path, item.s, p);
      let at = { x: p.x, y: p.y };
      if (item.glide) {
        const k = easeGlide((world.time - item.glide.at) / item.glide.dur);
        if (k < 1) at = lerp(item.glide.from, at, k);
      }
      push(world, shot, item.mols[0], at, { kind: 'belt' });
    }
  }
}

// Pairs (ADP and phosphate) ride one slot, the leading molecule ahead. A
// molecule whose partner was just taken eases back to the middle.
function loopPoint(world, loopId, item) {
  pointAt(LOOPS[loopId].path, item.s, p);
  const offsets = slotOffsets(world, item.mols, p.dx, p.dy);
  const settle = settleOffset(item);
  return offsets.map((offset) => ({ x: p.x + offset.x + settle.x, y: p.y + offset.y + settle.y }));
}

function addLoops(world, shot) {
  for (const loopId of Object.keys(LOOPS)) {
    for (const item of world.loops[loopId].items) {
      if (item.ph) continue;
      const spots = loopPoint(world, loopId, item);
      item.mols.forEach((mol, i) => push(world, shot, mol, spots[i], { kind: 'loop' }));
    }
  }
}

// Stations --------------------------------------------------------------------

function homeOf(def, point, index = 0, count = 1) {
  const k = def.kind === 'synthase' ? 0.15 : 0.3;
  const spread = count > 1 ? (index - (count - 1) / 2) * 10 : 0;
  const cx = def.kind === 'synthase' ? def.knob.x : def.x;
  const cy = def.kind === 'synthase' ? def.knob.y : def.y;
  const x = cx + (point.x - cx) * k + spread;
  const y = cy + (point.y - cy) * k;
  const halfW = def.kind === 'synthase' ? def.knob.r : def.w / 2 - 6;
  const halfH = def.kind === 'synthase' ? def.knob.r : def.h / 2 - 6;
  return {
    x: Math.min(cx + halfW, Math.max(cx - halfW, x)),
    y: Math.min(cy + halfH, Math.max(cy - halfH, y)),
  };
}

// Where an output is headed, used for the product's place inside the station.
function outputAim(world, def, output, speciesId) {
  if (output.to === 'belt') {
    pointAt(BELTS[output.belt].path, entryS(world, output.belt, speciesId), p);
    return { x: p.x, y: p.y };
  }
  if (output.to === 'exhaust') {
    pointAt(DRIFTS[output.drift], 0, p);
    return { x: p.x, y: p.y };
  }
  if (output.to === 'internal') return internalPoint(def, output.slot);
  if (output.to === 'store') {
    // Each electron bound for a smooth store aims at its own place in it.
    const station = world.stations[def.id];
    const mode = def.modes[station.mode];
    const place = def.store?.smooth ? mode.outputs.filter((other) => other.to === 'store').indexOf(output) : 0;
    return storePoint(def, station.store.length + Math.max(0, place));
  }
  return output.at ?? { x: def.x, y: def.y };
}

// Where the place-th product waiting for a belt sits: the belt's entrance
// for the first, then back along the belt's direction, into the station.
const QUEUE_GAP = 16;
function queueAim(world, beltId, mol, place) {
  const s = entryS(world, beltId, speciesOf(world, mol));
  pointAt(BELTS[beltId].path, s, p);
  return { x: p.x - p.dx * QUEUE_GAP * place, y: p.y - p.dy * QUEUE_GAP * place };
}

function speciesOf(world, mol) {
  return world.molecules[mol]?.species ?? 'water';
}

// A smooth store eases what is left forward when some of it is used.
function storeDrawn(world, def, station, i) {
  const shift = station.storeShift;
  if (!def.store?.smooth || !shift) return storePoint(def, i);
  const k = easeGlide((world.time - shift.at) / 0.3);
  if (k >= 1) return storePoint(def, i);
  return lerp(storePoint(def, i + shift.by), storePoint(def, i), k);
}

function parkedDrawn(def, entry) {
  const target = parkPoint(def, entry.place);
  if (!entry.glide) return target;
  return lerp(entry.glide.from.point, target, easeGlide(entry.glide.t / entry.glide.dur));
}

function inputStart(def, station, role) {
  return station.starts[role] ?? { x: def.x, y: def.y };
}

function addStation(world, def, station, shot) {
  const times = timesOf(def, station);
  const phaseDur = station.phase === 'load' ? loadTime(def, station)
    : station.phase === 'work' ? times.work
      : station.phase === 'unload' ? times.unload + station.extra : 1;
  shot.stations.push({
    id: def.id,
    phase: station.phase,
    progress: station.phase === 'idle' ? 0 : Math.min(1, station.t / Math.max(0.001, phaseDur)),
    store: station.store.length,
    light: station.light ?? 0,
    hopper: station.hopper?.length ?? 0,
    done: station.done ?? 0,
    waiting: station.waiting,
    fired: station.fired,
  });
  addDocks(world, def, station, shot);
  for (const [slot, mol] of Object.entries(station.internal)) {
    if (mol) push(world, shot, mol, internalPoint(def, slot), { kind: 'internal' });
  }
  // A store's molecules sit in their places, gliding in as they arrive.
  for (const entry of station.parked ?? []) push(world, shot, entry.mol, parkedDrawn(def, entry), { kind: 'parked', station: def.id, scale: def.park.scale });
  // An absent complex (a missing gene product) has nothing to hold them in.
  if (!world.absent?.[def.id]) station.store.forEach((mol, i) => push(world, shot, mol, storeDrawn(world, def, station, i), { kind: 'store' }));
  (station.hopper ?? []).forEach((entry, i) => push(world, shot, entry.mol, hopperDrawn(def, station, i, entry), { kind: 'hopper', station: def.id }));
  if (station.phase === 'idle') return;
  if (station.phase === 'release') {
    // Products waiting their turn for a belt queue back from its entrance,
    // and ease forward one place each time the front one leaves.
    const k = station.advance == null ? 0 : easeGlide((world.time - station.advance) / RELEASE_EASE);
    station.queue.forEach((entry, i) => {
      const from = queueAim(world, entry.belt, entry.mol, i + 1);
      const to = queueAim(world, entry.belt, entry.mol, i);
      push(world, shot, entry.mol, lerp(from, to, k), { kind: 'station' });
    });
    return;
  }
  const mode = def.modes[station.mode];
  const compound = REACTIONS[mode.reaction].compound;
  const roles = Object.keys(station.held);
  if (station.phase === 'load') {
    const f = easeGlide(station.t / loadTime(def, station));
    roles.forEach((role, i) => {
      const start = inputStart(def, station, role);
      const home = compound ? station.where[role] : homeOf(def, start, i, 1);
      const at = lerp(start, home, f);
      push(world, shot, station.held[role], at, { kind: 'station', alpha: start.fade === 'in' ? Math.sqrt(f) : 1 });
    });
    return;
  }
  if (station.phase === 'work' && compound) {
    // Each slot glides along the station's assembly line (M6.5 P5).
    const plan = choreography(def, mode.reaction);
    const f = station.t / times.work;
    for (const [slot, mol] of Object.entries(station.slots ?? {})) push(world, shot, mol, slotAt(plan, slot, f) ?? station.where[slot], { kind: 'compound', scale: def.inner?.scale });
    return;
  }
  if (station.phase === 'work') {
    addTween(world, def, station, mode, ease(station.t / times.work), shot);
    return;
  }
  addUnload(world, def, station, mode, times, shot);
}

function addDocks(world, def, station, shot) {
  for (const [name, dock] of Object.entries(station.docks)) {
    dock.slots.forEach((slot, i) => {
      if (!slot) return;
      push(world, shot, slot.mol, slotPoint(def, name, i, slot), { kind: 'dock' });
    });
  }
}

// During the reaction every atom slides from its place in the reactants to
// its place in the products. Atoms persist, so this is a plain tween.
function addTween(world, def, station, mode, f, shot) {
  const base = REACTIONS[mode.reaction];
  const reaction = station.map ? { ...base, map: station.map } : base;
  const roles = Object.keys(station.held);
  const inputHome = {};
  roles.forEach((role, i) => { inputHome[role] = homeOf(def, inputStart(def, station, role), i, 1); });
  const outputs = mode.outputs;
  const productHome = {};
  outputs.forEach((output, i) => {
    const species = reaction.out[output.role];
    const sameAim = outputs.filter((other) => other.at && output.at && other.at.x === output.at.x && other.at.y === output.at.y);
    const index = sameAim.indexOf(output);
    productHome[output.role] = homeOf(def, outputAim(world, def, output, species), Math.max(0, index), sameAim.length || 1);
    void i;
  });
  const groups = new Map();
  for (const [from, to] of pairsOf(reaction)) {
    const [fromRole, fromLabel] = from.split('.');
    const [toRole, toLabel] = to.split('.');
    if (!groups.has(toRole)) groups.set(toRole, []);
    groups.get(toRole).push({ fromRole, fromLabel, toLabel });
  }
  for (const [toRole, group] of groups) {
    const toSpecies = getSpecies(reaction.out[toRole]);
    const home = productHome[toRole] ?? { x: def.x, y: def.y };
    const toMid = center(toSpecies.id);
    if (toSpecies.id === 'proton') {
      const pair = group[0];
      const src = world.molecules[station.held[pair.fromRole]];
      const srcSpecies = getSpecies(src.species);
      const srcMid = center(src.species);
      const srcHome = inputHome[pair.fromRole];
      const a = srcSpecies.atoms[pair.fromLabel];
      const from = { x: srcHome.x + (a.x - srcMid.x) * SCALE, y: srcHome.y + (a.y - srcMid.y) * SCALE };
      const at = lerp(from, home, f);
      shot.protons.push({ key: `${def.id}:${toRole}`, id: null, atomId: src.atoms[pair.fromLabel], x: at.x, y: at.y, alpha: 1, place: placeOf(at.x, at.y) });
      continue;
    }
    const atoms = {};
    const atomIds = {};
    const fromLabels = new Map();
    let mainSource = null;
    let mainSize = -1;
    for (const pair of group) {
      const src = world.molecules[station.held[pair.fromRole]];
      if (!src) continue;
      const srcSpecies = getSpecies(src.species);
      const srcMid = center(src.species);
      const srcHome = inputHome[pair.fromRole];
      const a = srcSpecies.atoms[pair.fromLabel];
      const b = toSpecies.atoms[pair.toLabel];
      const from = { x: srcHome.x + (a.x - srcMid.x) * SCALE, y: srcHome.y + (a.y - srcMid.y) * SCALE };
      const to = { x: home.x + (b.x - toMid.x) * SCALE, y: home.y + (b.y - toMid.y) * SCALE };
      const at = lerp(from, to, f);
      atoms[pair.toLabel] = { ...b, x: (at.x - def.x) / SCALE, y: (at.y - def.y) / SCALE };
      atomIds[pair.toLabel] = src.atoms[pair.fromLabel];
      const size = Object.keys(srcSpecies.atoms).length;
      if (size > mainSize) {
        mainSize = size;
        mainSource = { role: pair.fromRole, species: srcSpecies };
      }
      fromLabels.set(`${pair.fromRole}.${pair.fromLabel}`, pair.toLabel);
    }
    let bonds;
    if (f < 0.5) {
      bonds = [];
      for (const role of roles) {
        const src = world.molecules[station.held[role]];
        if (!src) continue;
        for (const [x, y, order] of getSpecies(src.species).bonds) {
          const left = fromLabels.get(`${role}.${x}`);
          const right = fromLabels.get(`${role}.${y}`);
          if (left && right) bonds.push([left, right, order]);
        }
      }
    } else {
      bonds = toSpecies.bonds.filter(([x, y]) => atoms[x] && atoms[y]);
    }
    void mainSource;
    const item = {
      key: `${def.id}:${toRole}`,
      id: `${def.id}:${toRole}`,
      species: toSpecies.id,
      speciesData: { ...toSpecies, atoms, bonds },
      atomIds,
      x: def.x,
      y: def.y,
      cx: home.x,
      cy: home.y,
      scale: SCALE,
      alpha: 1,
      place: placeOf(def.x, def.y),
      kind: 'tween',
    };
    shot.items.push(item);
  }
  addTweenElectrons(world, def, station, reaction, inputHome, productHome, f, shot);
}

function electronHome(speciesId, home, index, count) {
  const body = getSpecies(speciesId).atoms.body ?? { x: 0, y: 0 };
  const mid = center(speciesId);
  const offsets = DOT_OFFSETS[count] ?? DOT_OFFSETS[2];
  const [ox, oy] = offsets[index] ?? [0, -0.8];
  return { x: home.x + (body.x - mid.x + ox) * SCALE, y: home.y + (body.y - mid.y + oy) * SCALE };
}

function addTweenElectrons(world, def, station, reaction, inputHome, productHome, f, shot) {
  for (const [from, to] of Object.entries(reaction.emap ?? {})) {
    const [fromRole, fromIndex] = from.split('.');
    const [toRole, toIndex] = to.split('.');
    const src = world.molecules[station.held[fromRole]];
    if (!src?.electrons) continue;
    const id = src.electrons[Number(fromIndex)];
    const a = src.species === 'electron'
      ? inputHome[fromRole]
      : electronHome(src.species, inputHome[fromRole], Number(fromIndex), src.electrons.length);
    const outSpecies = reaction.out[toRole];
    const count = getSpecies(outSpecies).ecount ?? 1;
    const b = outSpecies === 'electron'
      ? productHome[toRole] ?? storePoint(def, station.store.length)
      : electronHome(outSpecies, productHome[toRole] ?? { x: def.x, y: def.y }, Number(toIndex), count);
    const at = lerp(a, b, f);
    shot.electrons.push({ id, x: at.x, y: at.y, alpha: 1, on: def.id });
  }
  for (const [from, role] of Object.entries(reaction.eend ?? {})) {
    const [fromRole] = from.split('.');
    const src = world.molecules[station.held[fromRole]];
    if (!src?.electrons) continue;
    const at = lerp(inputHome[fromRole], productHome[role] ?? { x: def.x, y: def.y }, f);
    shot.electrons.push({ id: src.electrons[0], x: at.x, y: at.y, alpha: 1 - f * 0.7, on: def.id });
  }
  for (const [role, source] of Object.entries(reaction.enew ?? {})) {
    const [srcRole, srcLabel] = source.split('.');
    const src = world.molecules[station.held[srcRole]];
    if (!src) continue;
    const srcSpecies = getSpecies(src.species);
    const mid = center(src.species);
    const a = srcSpecies.atoms[srcLabel];
    const home = inputHome[srcRole];
    const from = { x: home.x + (a.x - mid.x) * SCALE, y: home.y + (a.y - mid.y) * SCALE };
    const outSpecies = reaction.out[role];
    const count = getSpecies(outSpecies).ecount ?? 2;
    for (let i = 0; i < count; i += 1) {
      const to = electronHome(outSpecies, productHome[role] ?? { x: def.x, y: def.y }, i, count);
      const at = lerp(from, to, f);
      shot.electrons.push({ id: null, x: at.x, y: at.y, alpha: Math.min(1, f * 3), on: def.id, pending: `${src.atoms[srcLabel]}:${i}` });
    }
  }
}

function addUnload(world, def, station, mode, times, shot) {
  const reactionOut = REACTIONS[mode.reaction].out;
  const outputs = mode.outputs;
  outputs.forEach((output) => {
    const mol = station.products[output.role];
    if (!mol || !world.molecules[mol]) return;
    const species = reactionOut[output.role];
    const sameAim = outputs.filter((other) => other.at && output.at && other.at.x === output.at.x && other.at.y === output.at.y);
    const index = Math.max(0, sameAim.indexOf(output));
    const home = station.where?.[output.role] && REACTIONS[mode.reaction].compound ? station.where[output.role] : homeOf(def, outputAim(world, def, output, species), index, sameAim.length || 1);
    let target;
    let fadeOut = false;
    let dur = times.unload;
    if (output.to === 'loop') {
      const hold = station.holds.find((entry) => entry.roles.includes(output.role));
      if (hold) {
        const spots = loopPoint(world, hold.loop, hold.item);
        target = spots[hold.item.mols.indexOf(mol)] ?? spots[0];
        dur = times.unload + hold.extra;
      } else {
        target = home;
      }
    } else if (output.to === 'bulk') {
      target = output.at;
      fadeOut = true;
    } else if (output.to === 'belt') {
      // A second or third product for the same belt goes to its place in the
      // queue at the belt's entrance.
      const place = outputs.filter((other) => other.to === 'belt' && other.belt === output.belt).indexOf(output);
      target = queueAim(world, output.belt, mol, place);
    } else {
      target = outputAim(world, def, output, species);
      if (output.to === 'reservoir') target = output.at;
    }
    const f = station.waiting ? 0 : easeGlide(station.t / dur);
    const at = lerp(home, target, f);
    push(world, shot, mol, at, { kind: 'station', alpha: fadeOut ? 1 - f : 1 });
  });
}

// Drift and transits -------------------------------------------------------------

function addDrifts(world, shot) {
  for (const drift of world.drifts) {
    const path = drift.route ?? DRIFTS[drift.path];
    if (drift.kind === 'arrive') {
      pointAt(path, path.length * arriveProgress(drift.t), p);
      push(world, shot, drift.mol, { x: p.x, y: p.y }, { kind: 'arrive', alpha: Math.min(1, drift.t / (PARAMS.arriveTime * 0.6)), place: 'outside the cell' });
      continue;
    }
    pointAt(path, drift.s, p);
    let x = p.x;
    let y = p.y;
    let alpha = 1;
    if (drift.kind === 'exhaust' && !drift.join) {
      const phase = (Number.parseInt(String(drift.mol).replace(/\D/g, ''), 10) % 7) * 0.9;
      const k = Math.min(1, drift.t / 1.5);
      x += Math.sin(drift.t * 1.2 + phase) * 6 * k - Math.sin(phase) * 6 * k;
      // Gases fade as they leave the top of the cell (or of a leaf, above
      // its stoma); exported sugar fades below the cell.
      const scene = currentScene();
      const top = scene.fadeTop ?? 0;
      if (y < top) alpha = Math.max(0, 1 + (y - top) / 90);
      if (scene.fadeBottom != null && y > scene.fadeBottom) alpha = Math.max(0, 1 - (y - scene.fadeBottom) / 90);
    }
    if (drift.kind === 'outflow') alpha = Math.min(1, drift.s / 60);
    // A drift that ends inside the cell (glycolate into the peroxisome) fades there.
    if (path.fade) alpha = Math.min(alpha, Math.max(0, (path.length - drift.s) / path.fade));
    push(world, shot, drift.mol, { x, y }, { kind: drift.kind, alpha });
  }
}

// The leaf's air space: CO₂ and O₂ on their slow walk (M7a, E9).
function addGas(world, shot) {
  for (const entry of world.gas ?? []) push(world, shot, entry.mol, { x: entry.x, y: entry.y }, { kind: 'gas' });
}

function addTransits(world, shot) {
  for (const transit of world.transits) {
    const f = ease(transit.t / transit.dur);
    pointAt(transit.path, transit.path.length * f, p);
    let alpha = 1;
    if (transit.fade === 'in') alpha = Math.min(1, transit.t / 0.3);
    if (transit.fade === 'out') alpha = Math.min(1, Math.max(0, (transit.dur - transit.t) / 0.4));
    push(world, shot, transit.mol, { x: p.x, y: p.y }, { kind: 'transit', alpha });
  }
}

function addReservoir(world, shot) {
  for (const entry of world.reservoir) {
    push(world, shot, entry.mol, protonPosition(world, entry), { kind: 'reservoir' });
  }
}

// Light ---------------------------------------------------------------------------

// Photons in flight and the flashes of quenched ones (E1). Not atoms.
function addLight(world, shot) {
  shot.photons = (world.photons ?? []).map((photon) => {
    const f = Math.min(1, photon.t / photon.dur);
    return { id: photon.id, target: photon.target, x: photon.from.x + (photon.to.x - photon.from.x) * f, y: photon.from.y + (photon.to.y - photon.from.y) * f, dx: photon.to.x - photon.from.x, dy: photon.to.y - photon.from.y };
  });
  shot.flashes = (world.flashes ?? []).map((flash) => ({ id: flash.id, x: flash.x, y: flash.y, t: flash.t }));
  // Each strike's glow eases in and out (sin²); overlapping strikes add up
  // to a cap, so steady light reads as a gentle pulse about once a second.
  shot.glows = {};
  for (const glow of world.glows ?? []) {
    const k = Math.sin((Math.PI * glow.t) / GLOW_TIME) ** 2;
    shot.glows[glow.target] = Math.min(1, (shot.glows[glow.target] ?? 0) + k);
  }
}

// Places ------------------------------------------------------------------------

function blendGlows(a, b, t) {
  if (!a || !b) return b;
  const out = {};
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) out[id] = (a[id] ?? 0) + ((b[id] ?? 0) - (a[id] ?? 0)) * t;
  return out;
}

function blendMotors(a, b, t) {
  if (!a || !b) return b;
  const out = {};
  for (const [id, motor] of Object.entries(b)) {
    const old = a[id];
    out[id] = old ? { v: motor.v, phase: old.phase + (motor.phase - old.phase) * t } : motor;
  }
  return out;
}

function placeOf(x, y) {
  const scene = currentScene();
  if (scene.place) return scene.place(x, y);
  if (scene.envelope) return bacterialPlace(scene, x, y);
  const mito = scene.mitochondrion;
  if (!inRoundRect(scene.cell.shape, x, y)) {
    if (scene.bud && inEllipse(scene.bud, x, y)) return 'in the cytosol (bud)';
    return 'outside the cell';
  }
  if (inEllipse(scene.nucleus.shape, x, y)) return 'in the nucleus';
  if (inRoundRect(mito.inner, x, y)) {
    if (y < STRIP_Y - STRIP_HALF) return 'in the intermembrane space';
    if (y <= STRIP_Y + STRIP_HALF) return 'in the inner membrane';
    return 'in the matrix';
  }
  if (inRoundRect(mito.outer, x, y)) return 'crossing the mitochondrial membranes';
  return 'in the cytosol';
}

// Blending ------------------------------------------------------------------------

export function blendShots(a, b, t) {
  if (!a || t >= 1) return b;
  if (t <= 0) return a;
  const before = new Map(a.items.map((item) => [item.key, item]));
  const items = b.items.map((item) => {
    const old = before.get(item.key);
    if (!old || old.species !== item.species) return item;
    const blended = {
      ...item,
      x: old.x + (item.x - old.x) * t,
      y: old.y + (item.y - old.y) * t,
      cx: old.cx + (item.cx - old.cx) * t,
      cy: old.cy + (item.cy - old.cy) * t,
      alpha: old.alpha + (item.alpha - old.alpha) * t,
    };
    if (item.speciesData && old.speciesData) {
      const atoms = {};
      for (const [label, atom] of Object.entries(item.speciesData.atoms)) {
        const prev = old.speciesData.atoms[label];
        atoms[label] = prev ? { ...atom, x: prev.x + (atom.x - prev.x) * t, y: prev.y + (atom.y - prev.y) * t } : atom;
      }
      blended.speciesData = { ...item.speciesData, atoms };
    }
    return blended;
  });
  const protonsBefore = new Map(a.protons.map((entry) => [entry.key, entry]));
  const protons = b.protons.map((entry) => {
    const old = protonsBefore.get(entry.key);
    if (!old) return entry;
    return { ...entry, x: old.x + (entry.x - old.x) * t, y: old.y + (entry.y - old.y) * t, alpha: old.alpha + (entry.alpha - old.alpha) * t };
  });
  const electronsBefore = new Map(a.electrons.filter((entry) => entry.id).map((entry) => [entry.id, entry]));
  const electrons = b.electrons.map((entry) => {
    const old = entry.id ? electronsBefore.get(entry.id) : null;
    if (!old) return entry;
    return { ...entry, x: old.x + (entry.x - old.x) * t, y: old.y + (entry.y - old.y) * t };
  });
  const photonsBefore = new Map((a.photons ?? []).map((entry) => [entry.id, entry]));
  const photons = (b.photons ?? []).map((entry) => {
    const old = photonsBefore.get(entry.id);
    return old ? { ...entry, x: old.x + (entry.x - old.x) * t, y: old.y + (entry.y - old.y) * t } : entry;
  });
  return {
    ...b,
    items,
    protons,
    electrons,
    photons,
    glows: blendGlows(a.glows, b.glows, t),
    rotor: a.rotor + (b.rotor - a.rotor) * t,
    time: a.time + (b.time - a.time) * t,
    vitality: a.vitality == null || b.vitality == null ? b.vitality : a.vitality + (b.vitality - a.vitality) * t,
    motors: blendMotors(a.motors, b.motors, t),
    stations: b.stations.map((station, i) => {
      const old = a.stations[i];
      if (!old || old.phase !== station.phase) return station;
      return { ...station, progress: old.progress + (station.progress - old.progress) * t };
    }),
  };
}

// Lookups ---------------------------------------------------------------------------

export function atomPoint(shot, atomId) {
  for (const item of shot.items) {
    const species = item.speciesData ?? getSpecies(item.species);
    for (const [label, id] of Object.entries(item.atomIds)) {
      if (id !== atomId) continue;
      const atom = species.atoms[label];
      if (!atom) continue;
      return { x: item.x + atom.x * item.scale, y: item.y + atom.y * item.scale, place: item.place, item };
    }
  }
  for (const proton of shot.protons) {
    if (proton.atomId === atomId) return { x: proton.x, y: proton.y, place: proton.place, proton };
  }
  return null;
}

export function electronPoint(shot, electronId) {
  const entry = shot.electrons.find((dot) => dot.id === electronId);
  return entry ? { x: entry.x, y: entry.y, place: placeOf(entry.x, entry.y), electron: entry } : null;
}

// The first glucose and O₂ glide in from off the left of the stage when the
// page opens or the cell is reset, the same way later feed molecules arrive.
// Only the picture moves; the world already has them in the tray.
export function withArrival(shot, t) {
  if (!shot || t >= PARAMS.arriveTime) return shot;
  const f = arriveProgress(t);
  const alpha = Math.min(1, Math.max(0, t / (PARAMS.arriveTime * 0.6)));
  const scene = currentScene();
  const arrivals = [scene.feed, ...(scene.supplies ?? []), ...(scene.gas?.trays ?? [])].filter(Boolean);
  const items = shot.items.map((item) => {
    if (item.kind !== 'tray') return item;
    const source = arrivals.find((entry) => entry.species === item.species);
    const path = DRIFTS[source?.arrive];
    if (!path) return item;
    pointAt(path, path.length, p);
    const endX = p.x;
    const endY = p.y;
    pointAt(path, path.length * f, p);
    const dx = p.x - endX;
    const dy = p.y - endY;
    return {
      ...item,
      x: item.x + dx,
      y: item.y + dy,
      cx: item.cx + dx,
      cy: item.cy + dy,
      alpha: item.alpha * alpha,
      place: placeOf(p.x, p.y),
    };
  });
  return { ...shot, items, prompt: shot.prompt && f > 0.8 };
}

// Outside, in the outer membrane's periplasm, in the inner membrane, or in
// the cytoplasm (with the nucleoid) of the bacterium.
function bacterialPlace(scene, x, y) {
  const { outer, inner, strip } = scene.envelope;
  if (!inRoundRect(outer, x, y)) return 'outside the cell';
  if (!inRoundRect(inner, x, y)) return 'in the periplasm';
  if (x <= strip.x2 + strip.half) {
    if (y < strip.y - strip.half) return x < strip.x2 - strip.half ? 'in the periplasm' : 'in the inner membrane';
    if (y <= strip.y + strip.half) return 'in the inner membrane';
  }
  return 'in the cytoplasm';
}
