// The deterministic engine. Fixed steps, a seeded generator, no clock.
// Molecules ride belts and loops at one speed each, glide into and out of
// stations, drift as gases, and fade in and out as bulk water and protons.

import { REACTIONS } from '../chem/reactions/catalog.js';
import { getSpecies } from '../chem/species/index.js';
import { cloudEntry, cloudHome, diffuse } from '../scenes/cloud.js';
import { humanScene } from '../scenes/human.js';
import { reach } from '../scenes/sizes.js';
import { activate, ACTIVE, BELTS, BOOKS, DEFS, DRIFTS, ensureBook, LOOPS, RESERVOIR, scene, TAPS } from './book.js';
import { COMPOUND_SPAN, choreography, slotAt } from './choreography.js';
import { applyClock } from './clock.js';
import { MODES, patchFor } from './conditions.js';
import { gasCount, gasRoom, poolOf, poolRegion, primeGas, releaseGas, updateGas } from './gas.js';
import { leakProtons, updateLife, updateRotor } from './life.js';
import { advancePhotons, emitPhotons } from './light.js';
import { applyReaction, createMolecule } from './molecules.js';
import { pointAt, polyPath } from './path.js';
import { drainDue, feedHoppers, feedStores, hopperPoint, shiftHopper, storedSugar } from './stores.js';

export const STEP = 1 / 60;

export const PARAMS = {
  beltSpeed: 100,
  loopSpeed: 150,
  mergeWindow: 2.5,
  hotLoops: ['syn', 'export'],
  hotSpeed: 260,
  accel: 380,
  gap: 6,
  takt: 32,
  exhaustSpeed: 55,
  o2Speed: 180,
  arriveTime: 2.4,
  dockGlide: 0.35,
  reservoirGlide: 0.6,
  glideSpeed: 300,
  settleTime: 0.3,
  unloadSpeed: 260,
  protonAgePull: 20,
  // M8.12a: a pumped proton walks the cloud for protonSettle seconds before
  // ATP synthase can take it; while the synthase works, the cloud drifts
  // toward it at protonDrift units/s. The synthase prefers protons that have
  // walked within protonReach of its dock, and each glides in at protonGlide.
  protonSettle: 1.5,
  protonDrift: 30,
  protonReach: 300,
  protonGlide: 150,
  reservoirCap: 64,
  o2Ahead: 4,
  workWarmup: 80,
  backlog: 0.5,
  minSpacing: 24,
  surplusReserve: 3,
  // How long a track keeps running after its last flux (§16 D2). Belts hold
  // for about a takt, so glycolysis never pauses between glucoses.
  holdBelt: 45,
  holdCytosol: 70,
  holdLoop: 8,
  holdHot: 4,
  holdLane: 4,
  forkQueue: 3,
  starveDecay: 1,
};

// The ledger a respiring cell keeps. A scene can declare its own.
const LEDGER = { glucose: 0, o2: 0, co2: 0, h2o: 0, atp: 0, atpSub: 0, atpOx: 0, lactate: 0, ethanol: 0, nitrate: 0, nitrite: 0, heat: 0, nadh: 0, fadh2: 0 };

// What a scene takes in from outside, each on its own lane to the station
// that uses it (§17 D7): a mitochondrion's O₂, the bacterium's O₂ and
// nitrate, a leaf's water and CO₂. A supply is open while the patch key it
// names is not false (M6 plan §4.1).
function suppliesOf(target = scene) {
  return target.supplies ?? [];
}

function supplyOpen(world, supply) {
  const value = world.patch?.[supply.open ?? supply.id];
  return (value === undefined || Boolean(value)) && !world.off?.[supply.station];
}

const P = {};

// World ---------------------------------------------------------------------

export function createWorld(seed = 1, options = {}) {
  const next = options.scene ?? humanScene;
  ensureBook(next);
  const mode = options.mode ?? 'aerobic';
  const world = {
    seed,
    rng: seed >>> 0,
    time: 0,
    nextAtom: 1,
    nextMol: 1,
    nextElectron: 1,
    serial: 1,
    atoms: {},
    electrons: {},
    molecules: {},
    belts: {},
    loops: {},
    stations: {},
    drifts: [],
    transits: [],
    reservoir: [],
    tray: {},
    feed: 'continuous',
    fed: 0,
    launched: 0,
    gate: { last: -Infinity, backlog: 0 },
    work: { credit: 0, starved: 0, on: true },
    ledger: { ...(next.ledger ?? LEDGER) },
    rotor: { angle: 0, omega: 0 },
    level: { atp: 0.7, at: -1 },
    events: [],
    completed: [],
    keep: null,
    sceneId: next.id,
    mode,
    condition: 'none',
    patch: patchFor(mode, 'none'),
    oxygen: MODES[mode]?.oxygen !== false,
    nitrate: MODES[mode]?.nitrate === true,
    shown: {},
    off: {},
    absent: {},
    rate: {},
    leak: null,
    motors: {},
    leakCredit: 0,
    pace: 1,
    dead: false,
    death: null,
  };
  activate(world);
  for (const belt of scene.belts) world.belts[belt.id] = { items: [] };
  for (const id of Object.keys(LOOPS)) world.loops[id] = { items: [] };
  for (const id of trackIds()) world.motors[id] = { v: 0, phase: 0, last: -Infinity };
  for (const def of scene.stations) world.stations[def.id] = newStation(world, def);
  // A cell built with no acceptor at all starts in its anoxic resting state.
  const anoxic = MODES[mode]?.oxygen === false && !MODES[mode]?.nitrate;
  prime(world, anoxic);
  if (scene.feed) world.tray[scene.feed.id] = createMolecule(world, scene.feed.species, 'feed').id;
  for (const supply of suppliesOf()) world.tray[supply.id] = createMolecule(world, supply.species, 'feed').id;
  if (scene.gas) primeGas(world);
  if (scene.life?.kind === 'reserve') world.reserve = scene.life.start ?? scene.life.cap;
  if (scene.life?.kind === 'store') world.reserve = storedSugar(world, scene.life);
  if (scene.ring?.belts) world.ringPrimed = scene.ring.primed ?? ringCarbon(world);
  setPatch(world, mode, options.condition ?? 'none');
  if (scene.gas) world.stomata = world.patch.stomata ?? 1;
  for (const supply of suppliesOf()) world.shown[supply.id] = supplyOpen(world, supply) ? 1 : 0;
  world.level.atp = measureAtp(world);
  return world;
}

// Modes and conditions are patches to the running network (PLAN §7.6, §16).
// A fermentation mode closes the O₂ supply; everything after that follows.
export function setPatch(world, mode, condition) {
  activate(world);
  world.mode = mode ?? world.mode;
  world.condition = condition || 'none';
  const patch = patchFor(world.mode, world.condition);
  if (world.patch && world.patch.demand !== patch.demand && patch.demand === 'aerobic') {
    world.warmFrom = world.time;
    world.work.starved = 0;
  }
  // When the user turns the light off or on, the stage dims or brightens
  // from now (snapshot's night).
  const wasDark = world.basePatch ? world.basePatch.light === false : null;
  if (wasDark != null && wasDark !== (patch.light === false)) world.darkFlip = { time: world.time, dark: patch.light === false };
  world.basePatch = patch;
  world.patch = patch;
  world.oxygen = patch.oxygen;
  world.nitrate = patch.nitrate;
  world.rate = patch.rate;
  world.leak = patch.leak;
  world.absent = patch.absent;
  world.off = { ...patch.off, ...patch.absent };
  for (const id of Object.keys(patch.absent)) releaseCarriers(world, id);
  if (scene.clock) applyClock(world, true);
  // With no acceptor outside, any not yet bound to its enzyme leaves again.
  for (const supply of suppliesOf()) {
    if (supplyOpen(world, supply)) continue;
    for (const drift of world.drifts) {
      if (drift.kind !== 'intake' || drift.path !== supply.lane) continue;
      drift.kind = 'outflow';
      drift.v = 0;
    }
  }
}

// A station that is not made holds nothing: its carriers go back to their loops.
function releaseCarriers(world, stationId) {
  const def = DEFS[stationId];
  const station = world.stations[stationId];
  if (!def || !station) return;
  for (const [name, dock] of Object.entries(station.docks)) {
    const dockDef = def.docks[name];
    dock.slots.forEach((slot, i) => {
      if (!slot?.loop) return;
      const L = LOOPS[slot.loop].path.length;
      const tap = dockDef.taps?.[slot.loop] ?? 0;
      world.loops[slot.loop].items.push({ mols: [slot.mol], s: (tap + 14 * (i + 1)) % L, ph: null });
      dock.slots[i] = null;
    });
  }
}

function trackIds() {
  return [...scene.belts.map((belt) => belt.id), ...Object.keys(LOOPS), ...(scene.lanes ?? []).map((lane) => lane.id)];
}

function newStation(world, def) {
  const station = {
    id: def.id,
    phase: 'idle',
    t: 0,
    dur: 0,
    mode: 0,
    held: {},
    starts: {},
    products: {},
    targets: {},
    docks: {},
    internal: {},
    store: [],
    pumps: [],
    sources: {},
    holds: [],
    busy: 0,
    fired: 0,
    waiting: false,
    extra: 0,
    map: null,
    // Photons absorbed and waiting to drive a reaction (E1), the hopper of
    // a compound station (E3), and its sub-step slots while it works (E4).
    light: 0,
    hopper: [],
    slots: null,
    where: null,
    done: 0,
    // A store station's parked molecules, each in its own place (E11).
    parked: [],
  };
  for (let i = 0; i < (def.park?.prime ?? 0); i += 1) {
    station.parked.push({ mol: createMolecule(world, def.park.species, 'pool').id, place: i, glide: null });
  }
  // A primed store starts full: PSII's manganese cluster holds four
  // electrons of the leaf's own, which cannot be tagged (E2).
  for (let i = 0; i < (def.store?.prime ?? 0); i += 1) {
    station.store.push(createMolecule(world, 'electron', 'pool', { electronOrigin: def.store.origin ?? 'the cell' }).id);
  }
  for (const [name, dock] of Object.entries(def.docks ?? {})) {
    const count = (dock.count ?? 1) + (dock.buffer ?? 0);
    station.docks[name] = { slots: new Array(count).fill(null) };
  }
  for (const [slot, species] of Object.entries(def.internal ?? {})) {
    station.internal[slot] = createMolecule(world, species, 'pool').id;
  }
  return station;
}

// Starting carriers on each loop, spread evenly and interleaved, plus the
// cycle's carbon skeletons and a modest proton gradient.
const PRIME = {
  bus: [['nad', 20], ['coa', 8], ['adpPi', 3], ['atp', 1]],
  q: [['q', 9]],
  cyt: [['cytc', 8]],
  syn: [['atp', 3], ['adpPi', 3]],
  export: [['atp', 2], ['adpPi', 3]],
  nadc: [['nad', 3]],
  glyco: [['atp', 6], ['adpPi', 3], ['pi', 4], ['adp', 2]],
};

// A cell built without oxygen starts as the mitochondrion is left when its
// oxygen has gone: every carrier downstream of NADH reduced, no gradient,
// matrix adenosine all ADP, ADP waiting at the translocase, the cycle's skeletons waiting at dehydrogenases
// with no NAD⁺, and pyruvate waiting at pyruvate dehydrogenase.
const PRIME_ANOXIC = {
  bus: [['nadh', 20], ['coa', 8], ['adpPi', 4]],
  q: [['qh2', 9]],
  cyt: [['cytcr', 8]],
  syn: [['adpPi', 6]],
  export: [['adpPi', 5]],
};

function prime(world, anoxic = false) {
  for (const loopId of Object.keys(LOOPS)) {
    const recipe = (anoxic ? PRIME_ANOXIC[loopId] : null) ?? scene.params?.prime?.[loopId] ?? PRIME[loopId];
    if (!recipe) continue;
    const list = [];
    const counts = recipe.map(([, count]) => count);
    const total = counts.reduce((sum, value) => sum + value, 0);
    const used = recipe.map(() => 0);
    for (let i = 0; i < total; i += 1) {
      let best = 0;
      let bestRatio = Infinity;
      for (let k = 0; k < recipe.length; k += 1) {
        if (used[k] >= counts[k]) continue;
        const ratio = used[k] / counts[k];
        if (ratio < bestRatio) {
          bestRatio = ratio;
          best = k;
        }
      }
      used[best] += 1;
      list.push(recipe[best][0]);
    }
    const loop = LOOPS[loopId].path;
    for (let i = 0; i < list.length; i += 1) {
      const kind = list[i];
      const mols = kind === 'adpPi'
        ? [createMolecule(world, 'adp', 'pool').id, createMolecule(world, 'pi', 'pool').id]
        : [createMolecule(world, kind, 'pool').id];
      world.loops[loopId].items.push({ mols, s: (i / list.length) * loop.length, ph: null });
    }
  }
  for (const [species, beltId, count = 1, at = 0.4] of scene.skeletons ?? []) {
    for (let k = 0; k < count; k += 1) {
      const molecule = createMolecule(world, species, 'pool');
      const belt = BELTS[beltId];
      const item = { mols: [molecule.id], s: belt.path.length * at, v: 0, readyAt: null };
      if (anoxic) {
        item.s = beltLimit(world, beltId, item);
        item.readyAt = -100;
      }
      // Several on one belt are spaced out behind the first.
      if (k) item.s = Math.max(0, belt.path.length * at - k * (belt.spacing ?? 56));
      world.belts[beltId].items.push(item);
    }
  }
  if (anoxic) {
    // FAD in Complex II is reduced, Complex IV holds four electrons, and two
    // pyruvates (as many as the fork lets queue) wait on its mitochondrial branch.
    const ii = world.stations.complex2;
    if (ii?.internal.fad) {
      removeMolecule(world, ii.internal.fad);
      ii.internal.fad = createMolecule(world, 'fadh2', 'pool').id;
    }
    const iv = world.stations.complex4;
    for (let i = 0; i < (DEFS.complex4?.store?.cap ?? 0); i += 1) iv.store.push(createMolecule(world, 'electron', 'pool').id);
    const items = world.belts.pyruvate.items;
    const queue = BELTS['pk-fork']?.fork?.queue ?? PARAMS.forkQueue;
    for (let i = 0; i < queue; i += 1) {
      const molecule = createMolecule(world, 'pyruvate', 'pool');
      const item = { mols: [molecule.id], s: 0, v: 0, readyAt: -100 };
      const ahead = items[items.length - 1];
      item.s = ahead ? ahead.s - 52 : beltLimit(world, 'pyruvate', item);
      items.push(item);
    }
    return;
  }
  for (let i = 0; i < (scene.params?.protons ?? 24); i += 1) {
    const molecule = createMolecule(world, 'proton', 'pool');
    world.reservoir.push(cloudEntry(RESERVOIR, molecule.id, cloudHome(RESERVOIR, molecule.id), -10));
  }
}

// Step ------------------------------------------------------------------------

export function step(world, dt = STEP, keep = null) {
  activate(world);
  world.keep = keep ? new Set(keep) : null;
  world.events = [];
  world.completed = [];
  world.time += dt;
  world.tick = (world.tick ?? 0) + 1;
  if (scene.clock) applyClock(world);
  markWants(world);
  updateMotors(world, dt);
  advanceBelts(world, dt);
  advanceLoops(world, dt);
  advanceGlides(world, dt);
  advanceTransits(world, dt);
  if (scene.light) {
    advancePhotons(world, dt);
    emitPhotons(world, dt);
  }
  feedHoppers(world);
  feedStores(world);
  for (const def of scene.stations) advanceStation(world, def, world.stations[def.id], dt);
  releaseStuckShuttle(world);
  releaseIdleDocks(world);
  for (const def of scene.stations) {
    const station = world.stations[def.id];
    if (station.phase === 'idle') tryStart(world, def, station);
  }
  diffuseCloud(world, dt);
  leakProtons(world, dt);
  feedReservoirDocks(world);
  advanceDrifts(world, dt);
  if (scene.gas) updateGas(world, dt);
  supplyFeed(world);
  supplyAcceptors(world);
  updateLife(world, dt);
  updateRotor(world, dt);
  // Each acceptor's tray place fades with its supply.
  world.shown ??= {};
  for (const supply of suppliesOf()) {
    const target = supplyOpen(world, supply) ? 1 : 0;
    const now = world.shown[supply.id] ?? target;
    world.shown[supply.id] = Math.min(1, Math.max(0, now + Math.sign(target - now) * dt / 0.5));
  }
  if (world.time - world.level.at >= 0.5) {
    world.level.atp = measureAtp(world);
    world.level.at = world.time;
  }
}

export function runUntil(world, predicate, seconds, keep = null) {
  const start = world.time;
  while (world.time - start < seconds) {
    step(world, STEP, keep);
    if (predicate(world)) return true;
  }
  return predicate(world);
}

// Track motors (§16 D2) ---------------------------------------------------------

// Every belt, loop and gas lane has a motor. It runs while its track has had
// flux recently, or while a station waits for something on it, and coasts to
// rest under the acceleration limit when neither is true. A belt shows net
// flux, so a belt with nothing flowing is drawn still.
export function trackSpeed(id) {
  if (LOOPS[id]) return loopSpeedOf(id);
  if (BELTS[id]) return PARAMS.beltSpeed;
  return PARAMS.o2Speed;
}

function holdOf(id) {
  if (LOOPS[id]) {
    if (PARAMS.hotLoops.includes(id) || LOOPS[id].hot) return PARAMS.holdHot;
    // Cytosolic loops serve glycolysis, which passes one glucose about every
    // takt, so they hold as long as its belts do.
    return LOOPS[id].compartment === 'cytosol' ? PARAMS.holdCytosol : PARAMS.holdLoop;
  }
  if (BELTS[id]) return scene.params?.holdBelt ?? (BELTS[id].compartment === 'matrix' ? PARAMS.holdBelt : PARAMS.holdCytosol);
  return PARAMS.holdLane;
}

export function markFlux(world, id) {
  const motor = world.motors?.[id];
  if (motor) motor.last = world.time;
}

function updateMotors(world, dt) {
  const pace = world.pace ?? 1;
  for (const [id, motor] of Object.entries(world.motors)) {
    const live = world.time - motor.last < holdOf(id);
    const target = live ? trackSpeed(id) * pace : 0;
    if (motor.v < target) motor.v = Math.min(target, motor.v + PARAMS.accel * dt);
    else motor.v = Math.max(target, motor.v - PARAMS.accel * dt);
  }
}

// A loop is wanted when a station waiting at one of its taps needs a species
// that is on it, or when a product is waiting for a gap on it.
function markWants(world) {
  for (const loopId of Object.keys(LOOPS)) {
    const items = world.loops[loopId].items;
    if (!items.length) continue;
    const present = new Set();
    let held = false;
    for (const item of items) {
      if (item.ph) held = true;
      for (const id of item.mols) present.add(speciesOf(world, id));
    }
    if (held) {
      markFlux(world, loopId);
      continue;
    }
    for (const tap of TAPS[loopId]) {
      if (!present.has(tap.species)) continue;
      const station = world.stations[tap.station];
      const dock = station.docks[tap.dock];
      if (!dock.slots.some((slot) => !slot)) continue;
      if (!wantsCarrier(world, DEFS[tap.station], station, tap.dock, loopId)) continue;
      markFlux(world, loopId);
      break;
    }
  }
}

// Belts -----------------------------------------------------------------------

export const scratch = {};

export function speciesOf(world, molId) {
  return world.molecules[molId]?.species ?? 'water';
}

function itemReach(world, item, dx, dy) {
  let total = 0;
  for (const id of item.mols) total += reach(speciesOf(world, id), dx, dy);
  return total + (item.mols.length - 1) * 2;
}

function beltLimit(world, beltId, item) {
  const path = BELTS[beltId].path;
  pointAt(path, path.length, scratch);
  return path.length - reach(speciesOf(world, item.mols[0]), scratch.dx, scratch.dy);
}

function advanceBelts(world, dt) {
  const { accel, gap } = PARAMS;
  const handoffs = [];
  for (const def of scene.belts) {
    const motor = world.motors[def.id];
    const items = world.belts[def.id].items;
    const L = def.path.length;
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      let limit;
      let branch = null;
      if (i === 0) {
        limit = beltLimit(world, def.id, item);
        // At a fork the leading item runs on through the junction onto the
        // branch it is handed to, without stopping.
        if (def.fork) {
          branch = forkBranch(world, def, item);
          if (branch) limit = L + 40;
        }
      } else {
        const ahead = items[i - 1];
        pointAt(def.path, (ahead.s + item.s) / 2, scratch);
        limit = ahead.s - itemReach(world, ahead, scratch.dx, scratch.dy) - itemReach(world, item, scratch.dx, scratch.dy) - gap;
      }
      const room = Math.max(0, limit - item.s);
      if (room > 0.5) markFlux(world, def.id);
      const target = Math.min(motor.v, Math.sqrt(2 * accel * room));
      item.v = item.v < target ? Math.min(target, item.v + accel * dt) : target;
      const before = item.s;
      item.s = Math.max(item.s, Math.min(limit, item.s + item.v * dt));
      if (item.s - before < 1e-6 && room < 0.5) item.v = 0;
      if (item.v < 1) item.still ??= world.time;
      else item.still = null;
      if (i === 0 && room < 0.5 && item.readyAt == null) item.readyAt = world.time;
      for (const gate of def.gates ?? []) {
        const at = gateS(def, gate);
        if (before < at && item.s >= at) world.events.push({ type: 'cross', gate, mol: item.mols[0], time: world.time });
      }
      if (branch && item.s >= L) handoffs.push({ def, item, branch });
    }
    motor.phase += motor.v * dt;
  }
  for (const { def, item, branch } of handoffs) {
    const items = world.belts[def.id].items;
    items.splice(items.indexOf(item), 1);
    world.belts[branch].items.push({ mols: item.mols, s: item.s - def.path.length, v: item.v, readyAt: null, still: null });
    markFlux(world, branch);
    world.events.push({ type: 'fork', mol: item.mols[0], to: branch, atoms: atomsOf(world, item.mols[0]), time: world.time });
  }
}

// The first branch is preferred. Pyruvate turns to the next branch only when
// the first has backed up, with `queue` items already waiting on it (§16 D3).
function forkBranch(world, def, item) {
  if (def.fork.choose === 'carbonBalance') return carbonBranch(world, def, item);
  const [first, ...rest] = def.fork.to;
  const queue = def.fork.queue ?? PARAMS.forkQueue;
  const waiting = world.belts[first].items.filter((entry) => entry.v < 1).length;
  if (waiting < queue) return branchRoom(world, first, item) ? first : null;
  for (const id of rest) if (branchRoom(world, id, item)) return id;
  return null;
}

// The Calvin junction (E5). A G3P is exported only when the rest of the
// ring already holds at least the carbon it was primed with; otherwise it
// goes to regeneration. Nothing is a fixed ratio: in steady state one in
// six leaves, and fewer when the ring loses carbon. A pinned G3P that has
// already been round once is let out if the ring is nearly whole.
function carbonBranch(world, def, item) {
  const [exportBelt, regenBelt] = def.fork.to;
  const count = ringCarbon(world, item);
  const primed = world.ringPrimed ?? scene.ring?.primed ?? 0;
  let out = count >= primed;
  if (!out && world.keep && count >= primed - 5 && pinnedLapped(world, item)) out = true;
  const branch = out ? exportBelt : regenBelt;
  return branchRoom(world, branch, item) ? branch : null;
}

function pinnedLapped(world, item) {
  const molecule = world.molecules[item.mols[0]];
  if (!molecule) return false;
  // A hydrogen that took over a tagged electron's story counts as lapped:
  // its journey ends when its glucose leaves (M6 plan E7).
  return Object.values(molecule.atoms).some((id) => world.keep.has(id) && (world.atoms[id]?.carrying || world.atoms[id]?.journey.some((entry) => entry.enzyme === 'Phosphoribulokinase')));
}

const carbonCache = new Map();
function carbonsOf(speciesId) {
  if (!carbonCache.has(speciesId)) {
    const species = getSpecies(speciesId);
    const count = species.family === 'sugar' ? Object.values(species.atoms).filter((atom) => atom.el === 'C').length : 0;
    carbonCache.set(speciesId, count);
  }
  return carbonCache.get(speciesId);
}

// Sugar carbon on the Calvin ring: its belts, and its stations' hands,
// hoppers and inner slots. The G3P at the junction is left out.
export function ringCarbon(world, except = null) {
  const ring = scene.ring;
  if (!ring?.belts) return 0;
  let count = 0;
  const add = (mol) => { count += carbonsOf(speciesOf(world, mol)); };
  for (const beltId of ring.belts) {
    for (const entry of world.belts[beltId].items) if (entry !== except) entry.mols.forEach(add);
  }
  for (const id of ring.stations) {
    const station = world.stations[id];
    Object.values(station.held).forEach(add);
    Object.values(station.products).forEach(add);
    Object.values(station.slots ?? {}).forEach(add);
    station.hopper.forEach((entry) => add(entry.mol));
    (station.queue ?? []).forEach((entry) => add(entry.mol));
    for (const dock of Object.values(station.docks)) for (const slot of dock.slots) if (slot) add(slot.mol);
  }
  return count;
}

function branchRoom(world, beltId, item) {
  const items = world.belts[beltId].items;
  if (!items.length) return true;
  const last = items[items.length - 1];
  pointAt(BELTS[beltId].path, 0, scratch);
  const needed = itemReach(world, item, scratch.dx, scratch.dy) + itemReach(world, last, scratch.dx, scratch.dy) + PARAMS.gap + 4;
  return last.s >= needed;
}

const gateCache = new Map();
function gateS(def, gateId) {
  const key = `${scene.id}:${def.id}:${gateId}`;
  if (!gateCache.has(key)) {
    const pore = scene.pores.find((entry) => entry.id === gateId);
    let best = 0;
    let bestD = Infinity;
    for (let s = 0; s <= def.path.length; s += 2) {
      pointAt(def.path, s, scratch);
      const d = Math.hypot(scratch.x - pore.x, scratch.y - pore.y);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    gateCache.set(key, best);
  }
  return gateCache.get(key);
}

export function entryS(world, beltId, speciesId) {
  const path = BELTS[beltId].path;
  pointAt(path, 0, scratch);
  return Math.min(path.length / 2, reach(speciesId, scratch.dx, scratch.dy) + 2);
}

export function beltHasRoom(world, beltId, speciesId) {
  const items = world.belts[beltId].items;
  if (!items.length) return true;
  const last = items[items.length - 1];
  const start = entryS(world, beltId, speciesId);
  pointAt(BELTS[beltId].path, start, scratch);
  const needed = start + reach(speciesId, scratch.dx, scratch.dy) + itemReach(world, last, scratch.dx, scratch.dy) + PARAMS.gap;
  return last.s >= needed;
}

export function atDoor(world, beltId) {
  const items = world.belts[beltId].items;
  if (!items.length) return null;
  const item = items[0];
  const limit = beltLimit(world, beltId, item);
  if (item.s < limit - 0.5 || item.v > 2) return null;
  return item;
}

// Loops -----------------------------------------------------------------------

// Length an item takes up along a loop at arc length s.
function loopSpan(world, item, loopId, s) {
  pointAt(LOOPS[loopId].path, s, scratch);
  return itemReach(world, item, scratch.dx, scratch.dy) * 2;
}

function advanceLoops(world, dt) {
  for (const [loopId, loop] of Object.entries(LOOPS)) {
    const motor = world.motors[loopId];
    const ds = motor.v * dt;
    const phase0 = motor.phase;
    motor.phase += ds;
    const L = loop.path.length;
    const items = world.loops[loopId].items;
    const taps = TAPS[loopId];
    for (const item of items) {
      const before = item.s;
      item.s = (item.s + ds) % L;
      if (item.settle) {
        item.settle.t += dt;
        if (item.settle.t >= PARAMS.settleTime) item.settle = null;
      }
      if (item.ph) continue;
      for (const tap of taps) {
        const ahead = (((tap.s - before) % L) + L) % L;
        if (ahead <= 0 || ahead > ds) continue;
        pickAtTap(world, loopId, item, tap, before + ahead, phase0 + ahead);
      }
    }
    world.loops[loopId].items = items.filter((item) => item.mols.length > 0);
    world.loops[loopId].items.sort((a, b) => a.s - b.s);
  }
}

function pickAtTap(world, loopId, item, tap, s, phaseAt) {
  const station = world.stations[tap.station];
  const dock = station.docks[tap.dock];
  const def = DEFS[tap.station];
  for (let slot = 0; slot < dock.slots.length; slot += 1) {
    if (dock.slots[slot]) continue;
    const index = item.mols.findIndex((id) => speciesOf(world, id) === tap.species);
    if (index < 0) return;
    if (!wantsCarrier(world, def, station, tap.dock, loopId)) return;
    pointAt(LOOPS[loopId].path, s, scratch);
    const dockAt = def.docks[tap.dock].at;
    const reachDock = Math.hypot(dockAt.x - scratch.x, dockAt.y - scratch.y);
    const offsets = slotOffsets(world, item.mols, scratch.dx, scratch.dy);
    const settle = settleOffset(item);
    const [mol] = item.mols.splice(index, 1);
    // The partner left behind eases back to the middle of the slot.
    if (item.mols.length === 1) item.settle = { x: offsets[1 - index].x + settle.x, y: offsets[1 - index].y + settle.y, t: 0 };
    else item.settle = null;
    const offset = { x: offsets[index].x + settle.x, y: offsets[index].y + settle.y };
    dock.slots[slot] = {
      mol,
      loop: loopId,
      glide: {
        t: 0,
        dur: Math.max(PARAMS.dockGlide, reachDock / 260),
        from: { loop: loopId, s: s % LOOPS[loopId].path.length, offset, phase0: phaseAt },
      },
    };
    markFlux(world, loopId);
    world.events.push({ type: 'dock', station: def.id, dock: tap.dock, mol, time: world.time });
    return;
  }
}

// A cell-work station takes ATP from the glycolysis loop only when that loop
// has ATP to spare, so hexokinase and phosphofructokinase are never starved.
function wantsCarrier(world, def, station, dockName, loopId) {
  if (world.off?.[def.id]) return false;
  // A terminal enzyme whose acceptor is not supplied takes no quinol: a real
  // E. coli does not make it then (§17 D5).
  if (def.acceptor && dockName === 'qh2' && !world[def.acceptor]) return false;
  if (def.demand === 'surplus' && dockName === 'atp') {
    return countOnLoop(world, 'glyco', 'atp') > PARAMS.surplusReserve;
  }
  // Glycolysis keeps a few ATP. Cell work may spend the rest when the
  // mitochondrion is not the one supplying it.
  if (def.demand === 'clock' && dockName === 'atp' && loopId === 'glyco') {
    return world.work.credit >= 1 && countOnLoop(world, 'glyco', 'atp') > PARAMS.surplusReserve;
  }
  // The shuttle only takes NADH it can pass into the matrix. Otherwise the
  // NADH stays on the loop and fermentation can use it.
  if (def.id === 'shuttle' && dockName === 'cyt') {
    const mat = station.docks.mat?.slots?.[0];
    if (mat && !mat.glide) return true;
    return countOnLoop(world, 'bus', 'nad') > 0;
  }
  // A fermentation enzyme docks NADH only while its substrate is on its way,
  // so an idle one never hoards the cytosol's NADH. On the NAD loop the
  // shuttle's tap comes first, so it only sees what the shuttle let pass.
  const dock = def.docks?.[dockName];
  if (dock?.when === 'substrate') return substrateComing(world, def);
  // A dock with `idle` (the cyclic route's plastoquinone, v1.1) keeps a
  // carrier ready only while its station is in use: it has acted (taken an
  // electron or fired) in the last `idle` seconds, or its store is full.
  if (dock?.idle) return inUse(world, def, station, dock.idle);
  // NADP⁺ reductase takes ferredoxin only while it holds NADP⁺, so when
  // NADPH backs up, ferredoxin passes on to the cyclic route (M6 plan L9).
  if (dock?.requires && !station.docks[dock.requires]?.slots.some((slot) => slot && !slot.glide)) return false;
  return true;
}

function substrateComing(world, def) {
  for (const mode of def.modes) {
    for (const input of mode.inputs) {
      if (input.from !== 'belt') continue;
      if (input.belts.some((id) => world.belts[id].items.length > 0)) return true;
    }
  }
  return false;
}

function countOnLoop(world, loopId, speciesId) {
  let count = 0;
  for (const item of world.loops[loopId].items) {
    for (const id of item.mols) if (speciesOf(world, id) === speciesId) count += 1;
  }
  return count;
}

// Whether a new item fits at s. Spacing is checked for the direction of
// travel both where the item joins the loop and at the tap, where it merges.
function gapFits(world, loopId, s, tap, mols) {
  const L = LOOPS[loopId].path.length;
  const item = { mols };
  const span = Math.max(loopSpan(world, item, loopId, s), loopSpan(world, item, loopId, tap));
  for (const other of world.loops[loopId].items) {
    const otherSpan = Math.max(loopSpan(world, other, loopId, s), loopSpan(world, other, loopId, tap));
    let d = Math.abs(other.s - s);
    d = Math.min(d, L - d);
    if (d < (span + otherSpan) / 2 + PARAMS.gap) return false;
  }
  return true;
}

// Glides into docks -----------------------------------------------------------

function advanceGlides(world, dt) {
  for (const station of Object.values(world.stations)) {
    for (const entry of [...station.hopper, ...station.parked]) {
      if (!entry.glide) continue;
      entry.glide.t += dt * (world.pace ?? 1);
      if (entry.glide.t >= entry.glide.dur) entry.glide = null;
    }
    for (const dock of Object.values(station.docks)) {
      for (const slot of dock.slots) {
        if (!slot?.glide) continue;
        slot.glide.t += dt * (world.pace ?? 1);
        if (slot.glide.t >= slot.glide.dur) slot.glide = null;
      }
    }
  }
}

// Protons in transit ------------------------------------------------------------

export function startTransit(world, mol, points, dur, then, extra = {}) {
  world.transits.push({ mol, path: polyPath(points, 10, false), t: 0, dur, then, ...extra });
}

function advanceTransits(world, dt) {
  const keep = [];
  for (const transit of world.transits) {
    transit.t += dt * (world.pace ?? 1);
    if (transit.t < transit.dur) {
      keep.push(transit);
      continue;
    }
    if (transit.then === 'reservoir') {
      pointAt(transit.path, transit.path.length, scratch);
      world.reservoir.push(cloudEntry(RESERVOIR, transit.mol, { x: scratch.x, y: scratch.y }, world.time));
      world.events.push({ type: 'reservoir', mol: transit.mol, time: world.time });
    } else if (transit.then === 'dock') {
      const slot = world.stations[transit.station].docks[transit.dock].slots[transit.slot];
      if (slot) slot.glide = null;
    } else if (transit.then === 'bulk') {
      world.events.push({ type: 'bulk', mol: transit.mol, kind: 'proton', via: transit.via ?? null, atoms: atomsOf(world, transit.mol), time: world.time });
      removeMolecule(world, transit.mol);
    }
  }
  world.transits = keep;
}

function reservoirInbound(world) {
  let count = 0;
  for (const transit of world.transits) if (transit.then === 'reservoir') count += 1;
  return count;
}

// Protons already promised to the reservoir but not yet in transit: a complex
// creates them when it starts and only launches them when work begins. Counting
// those stops several complexes, starting in one step, from overshooting the cap.
function protonsCommitted(world) {
  let count = reservoirInbound(world);
  for (const def of scene.stations) {
    const station = world.stations[def.id];
    const mode = def.modes[station?.mode];
    if (!station || station.phase !== 'load' || !mode?.pump || mode.pumpFrom) continue;
    count += station.pumps.length;
  }
  return count;
}

// Protons in the reservoir diffuse (scenes/cloud.js): every step each one
// moves a little on its own random walk.
function diffuseCloud(world, dt) {
  const tick = world.tick;
  const pace = world.pace ?? 1;
  const synthase = BOOKS.get(world.sceneId).synthases[0];
  const toward = synthase && !world.off?.[synthase.id] ? synthase.docks?.h?.at : null;
  for (const entry of world.reservoir) {
    let drift = null;
    if (toward) {
      const dx = toward.x - entry.x;
      const dy = toward.y - entry.y;
      const d = Math.hypot(dx, dy);
      // Near the dock the walk alone takes over, so the pool there stays loose.
      if (d > 60) drift = { x: (dx / d) * PARAMS.protonDrift, y: (dy / d) * PARAMS.protonDrift };
    }
    diffuse(entry, RESERVOIR, dt * pace, tick, undefined, drift);
  }
}

export function protonPosition(world, entry) {
  return { x: entry.x, y: entry.y };
}

// The synthase's stator draws on the protons nearest to it, older ones
// first, so none waits for long; each glides at an even pace. A proton just
// pumped is never taken at once, even when the cloud is empty, and one
// within reach of the point is taken before any further away (M8.12a), so
// most arrive by walking. The synthase never waits while one is settled.
export function nearestProton(world, at, reach = PARAMS.protonReach) {
  let best = -1;
  let bestScore = Infinity;
  world.reservoir.forEach((entry, i) => {
    const age = world.time - entry.since;
    if (age < PARAMS.protonSettle) return;
    const dist = Math.hypot(entry.x - at.x, entry.y - at.y);
    const score = dist - PARAMS.protonAgePull * age + (dist > reach ? 1e6 : 0);
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

function feedReservoirDocks(world) {
  for (const def of scene.stations) {
    if (world.off?.[def.id]) continue;
    for (const [name, dockDef] of Object.entries(def.docks ?? {})) {
      if (!dockDef.reservoir) continue;
      const dock = world.stations[def.id].docks[name];
      for (let slot = 0; slot < dock.slots.length; slot += 1) {
        if (dock.slots[slot] || !world.reservoir.length) continue;
        const target = dockPoint(def, name, slot);
        const index = nearestProton(world, target);
        if (index < 0) return;
        const [entry] = world.reservoir.splice(index, 1);
        const from = protonPosition(world, entry);
        const dist = Math.hypot(target.x - from.x, target.y - from.y);
        const dur = Math.min(4, Math.max(PARAMS.reservoirGlide, dist / PARAMS.protonGlide));
        dock.slots[slot] = { mol: entry.mol, loop: null, glide: { t: 0, dur, from: { point: from }, wander: true } };
        world.events.push({ type: 'dock', station: def.id, dock: name, mol: entry.mol, time: world.time });
      }
    }
  }
}

// Where a carrier waits in a dock. Extra buffer slots queue outward along
// the line from the station to the dock.
export function dockPoint(def, name, slot = 0) {
  const dock = def.docks[name];
  const at = dock.at;
  // Buffered docks with authored parking places use them, so a queue never
  // piles up on itself or on the station's label (§16 W1).
  if (dock.places) return dock.places[Math.min(slot, dock.places.length - 1)];
  const count = dock.count ?? 1;
  if (count > 1) {
    const row = Math.floor(slot / count);
    const col = slot % count;
    return { x: at.x + (col - (count - 1) / 2) * 7, y: at.y - row * 9 - (col % 2) * 3 };
  }
  if (slot === 0) return at;
  const dx = at.x - def.x;
  const dy = at.y - def.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: at.x + (dx / len) * 18 * slot, y: at.y + (dy / len) * 18 * slot };
}

// Glides into docks use a gentle ease: half again the average speed at most.
export function easeGlide(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

// Where a glide into a dock starts at this moment. From a loop, the start
// moves on with the loop, offset to the molecule's place in its slot.
function glideFrom(glide) {
  const from = glide.from;
  if (!from.loop) return from.point;
  const motor = ACTIVE?.motors?.[from.loop];
  const moved = motor && from.phase0 != null ? Math.max(0, motor.phase - from.phase0) : loopSpeedOf(from.loop) * glide.t;
  pointAt(LOOPS[from.loop].path, from.s + moved, scratch);
  return { x: scratch.x + (from.offset?.x ?? 0), y: scratch.y + (from.offset?.y ?? 0) };
}

// Where a docked molecule is drawn now.
export function slotPoint(def, name, index, slot) {
  const target = dockPoint(def, name, index);
  if (!slot?.glide) return target;
  // A gas drawn from the leaf's air space follows its route to the dock.
  if (slot.glide.from.path) {
    const path = slot.glide.from.path;
    pointAt(path, path.length * easeGlide(slot.glide.t / slot.glide.dur), scratch);
    return { x: scratch.x, y: scratch.y };
  }
  const from = glideFrom(slot.glide);
  const f = easeGlide(slot.glide.t / slot.glide.dur);
  const point = { x: from.x + (target.x - from.x) * f, y: from.y + (target.y - from.y) * f };
  if (slot.glide.wander) wander(point, from, target, slot.mol, slot.glide.t, f);
  return point;
}

// A proton on its way to the synthase keeps jostling (M8.12a): it strays to
// either side of the straight line, by an amount that fades to nothing at
// both ends. Deterministic, from its id and the glide's time.
function wander(point, from, target, mol, t, f) {
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const d = Math.hypot(dx, dy);
  if (d < 1) return;
  const n = Number.parseInt(String(mol).replace(/\D/g, ''), 10) || 1;
  const a = n * 2.399;
  const b = n * 1.618;
  const side = (Math.sin(t * 7.1 + a) + 0.7 * Math.sin(t * 12.7 + b) + 0.4 * Math.sin(t * 19.3 + a + b)) / 2.1;
  const along = 0.35 * Math.sin(t * 9.4 + b);
  const amp = Math.min(34, d * 0.18) * Math.sin(Math.PI * f);
  point.x += (-dy / d) * side * amp + (dx / d) * along * amp;
  point.y += (dx / d) * side * amp + (dy / d) * along * amp;
}

// What is left of a loop item's ease back to the middle of its slot.
export function settleOffset(item) {
  if (!item.settle) return { x: 0, y: 0 };
  const k = 1 - easeGlide(item.settle.t / PARAMS.settleTime);
  return { x: item.settle.x * k, y: item.settle.y * k };
}

// Each molecule's place in a loop slot: a pair rides one slot, the leading
// molecule ahead.
export function slotOffsets(world, mols, dx, dy) {
  if (mols.length === 1) return [{ x: 0, y: 0 }];
  const r = mols.map((id) => reach(speciesOf(world, id), dx, dy));
  return [
    { x: dx * (r[1] + 1), y: dy * (r[1] + 1) },
    { x: -dx * (r[0] + 1), y: -dy * (r[0] + 1) },
  ];
}

// A buffered dock moves its queue forward when the front carriers are used.
export function shiftDock(def, name, dock) {
  let write = 0;
  for (let read = 0; read < dock.slots.length; read += 1) {
    const slot = dock.slots[read];
    if (!slot) continue;
    // A gas still on its route through the cell finishes it first; the
    // queue closes up once it has arrived (drawGas).
    if (slot.glide?.from.path) break;
    if (read !== write) {
      const from = slotPoint(def, name, read, slot);
      const left = slot.glide ? Math.max(0, slot.glide.dur - slot.glide.t) : 0;
      slot.glide = { t: 0, dur: Math.max(0.25, left), from: { point: from } };
      dock.slots[write] = slot;
      dock.slots[read] = null;
    }
    write += 1;
  }
}

// Stations --------------------------------------------------------------------

// A store has no reaction and so no times of its own.
const NO_TIMES = { load: 0, work: 1, unload: 0 };
export function timesOf(def, station) {
  return def.modes[station.mode]?.times ?? def.times ?? NO_TIMES;
}

export function loadTime(def, station) {
  return station.loadDur ?? timesOf(def, station).load;
}

function stationDt(world, def, station, dt) {
  const pace = world.pace ?? 1;
  const rate = scene.params?.enzymeRate ?? 1;
  const scaled = rate !== 1 && (def.zone === 'glycolysis' || def.zone === 'ferment');
  // Only the chemistry step speeds up. Glides in and out stay at belt pace,
  // so a faster yeast glycolysis never flings a molecule across the cell.
  const factor = station.phase === 'work' && scaled ? rate : 1;
  // A partly working enzyme (a mutation or a deficiency) takes longer over
  // its chemistry, by its residual activity.
  const residual = station.phase === 'work' ? (world.rate?.[def.id] ?? 1) : 1;
  return dt * pace * factor * residual;
}

function advanceStation(world, def, station, dt) {
  if (station.phase === 'idle') return;
  station.busy += dt;
  const times = timesOf(def, station);
  const scaled = stationDt(world, def, station, dt);
  if (station.phase === 'load') {
    station.t += scaled;
    if (station.t >= loadTime(def, station)) beginWork(world, def, station);
    return;
  }
  if (station.phase === 'work') {
    station.t += scaled;
    if (station.slots) {
      const count = REACTIONS[def.modes[station.mode].reaction].sequence.length;
      runSubSteps(world, def, station, Math.floor((station.t / times.work / COMPOUND_SPAN) * count + 0.5));
    }
    if (station.t >= times.work) finishWork(world, def, station);
    return;
  }
  if (station.phase === 'release') {
    release(world, station);
    return;
  }
  if (station.phase === 'unload') {
    if (station.waiting) {
      station.waiting = !reserveOutputs(world, def, station);
      if (station.waiting) return;
    }
    const total = times.unload + station.extra;
    station.t = Math.min(total, station.t + scaled);
    if (station.t >= total) handOff(world, def, station);
  }
}

function demandReady(world, def) {
  if (def.kind === 'work' && !world.work.on) return false;
  if (def.demand === 'clock') return world.work.credit >= 1;
  return true;
}

function tryStart(world, def, station) {
  if (world.off?.[def.id]) return;
  if (!demandReady(world, def)) return;
  for (let m = 0; m < def.modes.length; m += 1) {
    const mode = def.modes[m];
    if (mode.when === 'storeNotFull' && station.store.length >= def.store.cap) continue;
    if (mode.when === 'storeFull' && station.store.length < def.store.cap) continue;
    if (mode.when === 'storeEmpty' && station.store.length > 0) continue;
    if (mode.when === 'storeAtLeast' && station.store.length < mode.atLeast) continue;
    if (mode.when === 'drain' && !drainDue(world)) continue;
    const plan = planInputs(world, def, station, mode);
    if (!plan) continue;
    if (!outputsReady(world, def, station, mode)) continue;
    commit(world, def, station, m, plan);
    return;
  }
}

function planInputs(world, def, station, mode) {
  const reaction = REACTIONS[mode.reaction];
  const plan = [];
  let storeIndex = 0;
  for (const input of mode.inputs) {
    const species = reaction.in[input.role];
    if (input.from === 'belt') {
      let best = null;
      let bestBelt = null;
      for (const beltId of input.belts) {
        const chosen = atDoor(world, beltId);
        if (!chosen || speciesOf(world, chosen.mols[0]) !== species) continue;
        if (!best || (chosen.readyAt ?? 0) < (best.readyAt ?? 0)) {
          best = chosen;
          bestBelt = beltId;
        }
      }
      if (!best) return null;
      plan.push({ input, kind: 'belt', belt: bestBelt, item: best });
    } else if (input.from === 'dock') {
      // A dock that holds several (PSII's two waters, Regeneration's three
      // ATP) names the slot each input takes.
      const index = input.slot ?? 0;
      const dock = station.docks[input.dock];
      const slot = dock.slots[index];
      if (!slot || slot.glide || speciesOf(world, slot.mol) !== species) return null;
      plan.push({ input, kind: 'dock', dock: input.dock, slot: index });
    } else if (input.from === 'light') {
      if (station.light < input.count) return null;
      plan.push({ input, kind: 'light' });
    } else if (input.from === 'hopper') {
      const entry = station.hopper[input.index];
      if (!entry || entry.glide || speciesOf(world, entry.mol) !== species) return null;
      plan.push({ input, kind: 'hopper', index: input.index });
    } else if (input.from === 'internal') {
      const mol = station.internal[input.slot];
      if (!mol || speciesOf(world, mol) !== species) return null;
      plan.push({ input, kind: 'internal' });
    } else if (input.from === 'store') {
      if (storeIndex >= station.store.length) return null;
      plan.push({ input, kind: 'store', index: storeIndex });
      storeIndex += 1;
    } else if (input.from === 'bulk') {
      plan.push({ input, kind: 'bulk', species });
    }
  }
  if (mode.pumpFrom?.startsWith('dock:')) {
    const dock = station.docks[mode.pumpFrom.slice(5)];
    for (let i = 0; i < mode.pump; i += 1) {
      const slot = dock.slots[i];
      if (!slot || slot.glide) return null;
    }
  }
  return plan;
}

function outputsReady(world, def, station, mode) {
  const reaction = REACTIONS[mode.reaction];
  let toReservoir = 0;
  for (const output of mode.outputs) {
    if (output.to === 'belt' && !beltHasRoom(world, output.belt, reaction.out[output.role])) return false;
    // An output may keep its belt's queue short (CAM's glucose for night glycolysis).
    if (output.to === 'belt' && output.max != null && world.belts[output.belt].items.length >= output.max) return false;
    if (output.to === 'gas' && !gasRoom(world, output, reaction.out[output.role])) return false;
    // A gas that joins the air space may wait while the air already holds
    // its fill (CAM's malic enzyme, paced by RuBisCO).
    if (output.to === 'exhaust' && output.cap != null && gasCount(world, reaction.out[output.role]) >= output.cap) return false;
    if (output.to === 'reservoir') toReservoir += 1;
  }
  if (mode.pump && !mode.pumpFrom) toReservoir += mode.pump;
  if (toReservoir && world.reservoir.length + protonsCommitted(world) + toReservoir > PARAMS.reservoirCap) return false;
  return true;
}

function commit(world, def, station, modeIndex, plan) {
  const mode = def.modes[modeIndex];
  station.mode = modeIndex;
  station.held = {};
  station.starts = {};
  station.sources = {};
  station.products = {};
  station.targets = {};
  station.pumps = [];
  station.holds = [];
  const touched = new Set();
  for (const entry of plan) {
    const role = entry.input.role;
    if (entry.kind === 'light') {
      station.light -= entry.input.count;
      station.lit = entry.input.count;
      if (world.ledger.photons != null) world.ledger.photons += entry.input.count;
      continue;
    }
    if (entry.kind === 'hopper') {
      const hop = station.hopper[entry.index];
      station.held[role] = hop.mol;
      station.starts[role] = hopperPoint(def, entry.index);
      continue;
    }
    if (entry.kind === 'belt') {
      const items = world.belts[entry.belt].items;
      items.splice(items.indexOf(entry.item), 1);
      pointAt(BELTS[entry.belt].path, entry.item.s, scratch);
      station.held[role] = entry.item.mols[0];
      station.starts[role] = { x: scratch.x, y: scratch.y };
    } else if (entry.kind === 'dock') {
      const dock = station.docks[entry.dock];
      const slot = dock.slots[entry.slot];
      station.held[role] = slot.mol;
      station.starts[role] = slotPoint(def, entry.dock, entry.slot, slot);
      station.sources[entry.dock] = slot.loop;
      dock.slots[entry.slot] = null;
      touched.add(entry.dock);
    } else if (entry.kind === 'internal') {
      station.held[role] = station.internal[entry.input.slot];
      station.starts[role] = internalPoint(def, entry.input.slot);
      station.internal[entry.input.slot] = null;
    } else if (entry.kind === 'store') {
      station.held[role] = station.store[entry.index];
      station.starts[role] = storePoint(def, entry.index);
    } else if (entry.kind === 'bulk') {
      const molecule = createMolecule(world, entry.species, 'pool');
      station.held[role] = molecule.id;
      station.starts[role] = { ...entry.input.at, fade: 'in' };
    }
  }
  for (const name of touched) shiftDock(def, name, station.docks[name]);
  const hopperUsed = plan.filter((entry) => entry.kind === 'hopper').length;
  if (hopperUsed) {
    station.hopper.splice(0, hopperUsed);
    shiftHopper(def, station);
  }
  // A compound station lays its inputs out inside itself (E4).
  if (REACTIONS[mode.reaction].compound) station.where = { ...choreography(def, mode.reaction).start };
  // Inputs glide in at an even pace: the load takes as long as the longest
  // glide needs, so a dock some way from the station never flings anything.
  const center = def.kind === 'synthase' ? def.knob : def;
  let far = 0;
  for (const [role, start] of Object.entries(station.starts)) {
    // A compound station's inputs go to their own inner places.
    const to = station.where?.[role] && REACTIONS[mode.reaction].compound ? station.where[role] : center;
    far = Math.max(far, Math.hypot(start.x - to.x, start.y - to.y));
  }
  station.loadDur = Math.max(timesOf(def, { mode: modeIndex }).load, far / PARAMS.glideSpeed);
  const storeUsed = plan.filter((entry) => entry.kind === 'store').length;
  if (storeUsed) {
    station.store.splice(0, storeUsed);
    // What is left moves up the store; a smooth store draws it easing there.
    station.storeShift = { at: world.time, by: storeUsed };
  }
  if (mode.pumpFrom?.startsWith('dock:')) {
    const dock = station.docks[mode.pumpFrom.slice(5)];
    for (let i = 0; i < mode.pump; i += 1) {
      station.pumps.push({ mol: dock.slots[i].mol, from: slotPoint(def, mode.pumpFrom.slice(5), i, dock.slots[i]) });
      dock.slots[i] = null;
    }
    shiftDock(def, mode.pumpFrom.slice(5), dock);
  } else if (mode.pump) {
    for (let i = 0; i < mode.pump; i += 1) {
      const molecule = createMolecule(world, 'proton', 'pool');
      station.pumps.push({ mol: molecule.id, from: null });
    }
  }
  const reaction = REACTIONS[mode.reaction];
  station.map = reaction.maps ? reaction.maps[nextRand(world) % reaction.maps.length] : null;
  if (def.demand === 'clock') world.work.credit -= 1;
  if (mode.when === 'drain') world.drain = Math.max(0, (world.drain ?? 0) - 1);
  station.phase = 'load';
  station.t = 0;
  station.waiting = false;
  world.events.push({ type: 'start', station: def.id, reaction: reaction.id, held: { ...station.held }, time: world.time });
}

// Compound stations (E4) -----------------------------------------------------------

// Runs the sub-steps that are due: step k fires halfway through its share
// of the first COMPOUND_SPAN of the work time. Each is a real reaction with
// its own event.
function runSubSteps(world, def, station, due) {
  const reaction = REACTIONS[def.modes[station.mode].reaction];
  const steps = reaction.sequence;
  while (station.done < Math.min(due, steps.length)) {
    const step = steps[station.done];
    const sub = REACTIONS[step.reaction];
    const inputs = {};
    const fromSlots = [];
    for (const [role, slot] of Object.entries(step.bind.in)) {
      let mol = station.slots[slot];
      if (!mol) {
        // Water comes from the stroma's own bulk water.
        mol = createMolecule(world, sub.in[role], 'pool').id;
      }
      inputs[role] = world.molecules[mol];
      fromSlots.push(slot);
      delete station.slots[slot];
    }
    const involved = Object.values(inputs).flatMap((molecule) => Object.values(molecule.atoms));
    const { products, moves, electrons } = applyReaction(world, sub, inputs);
    countReaction(world, def, sub);
    const outSlots = Object.entries(step.bind.out);
    outSlots.forEach(([role, slot], i) => {
      station.slots[slot] = products[role].id;
      const at = station.where[fromSlots[Math.min(i, fromSlots.length - 1)]] ?? station.where[fromSlots[0]];
      station.where[slot] = i < fromSlots.length ? at : { x: at.x, y: at.y + 18 * i };
    });
    const event = {
      type: 'reaction',
      station: def.id,
      reaction: sub.id,
      atoms: involved,
      moves,
      electrons,
      products: Object.fromEntries(outSlots.map(([role]) => [role, products[role].id])),
      time: world.time,
      sub: station.done,
    };
    world.events.push(event);
    world.completed.push(event);
    station.done += 1;
  }
}

export function internalPoint(def, slot = null) {
  const at = slot ? def.internalAt?.[slot] : null;
  if (at) return { x: def.x + at.x, y: def.y + at.y };
  return { x: def.x, y: def.y + def.h * 0.18 };
}

export function storePoint(def, index) {
  const at = def.storeAt ?? { x: def.x, y: def.y - 6 };
  return { x: at.x + (index % 2 ? 8 : -8), y: at.y + Math.floor(index / 2) * 12 };
}

function beginWork(world, def, station) {
  station.phase = 'work';
  station.t = 0;
  const mode = def.modes[station.mode];
  if (REACTIONS[mode.reaction].compound) {
    station.slots = { ...station.held };
    station.held = {};
    station.done = 0;
  }
  const times = timesOf(def, station);
  if (!mode.pump) return;
  const count = station.pumps.length;
  station.pumps.forEach((pump, i) => {
    if (mode.pumpFrom) {
      // Down through the stator, round the rotor, out into the matrix.
      const rotor = def.rotor;
      const points = [
        pump.from,
        { x: def.stator.x, y: rotor.y - 6 },
        { x: rotor.x + rotor.w / 2 - 4, y: rotor.y + 4 },
        { x: rotor.x, y: rotor.y + rotor.h / 2 + 2 },
        { x: rotor.x - rotor.w / 2 + 8, y: rotor.y + 6 },
        { x: rotor.x - rotor.w / 2 - 4, y: rotor.y + 34 },
      ];
      startTransit(world, pump.mol, points, times.work + 0.5 + i * 0.05, 'bulk', { fade: 'out', via: def.id });
    } else {
      const offset = (i - (count - 1) / 2) * 12;
      const x = def.x + offset;
      const points = [
        { x, y: def.y + def.h / 2 + 22 },
        { x, y: def.y + def.h / 2 - 6 },
        { x, y: def.y - def.h / 2 - 6 },
        { x: x + offset * 0.6, y: def.y - def.h / 2 - 26 },
      ];
      startTransit(world, pump.mol, points, times.work + 0.4, 'reservoir', { fade: 'in', via: def.id });
    }
  });
  station.pumps = [];
}

function finishCompound(world, def, station) {
  const base = REACTIONS[def.modes[station.mode].reaction];
  runSubSteps(world, def, station, base.sequence.length);
  // A station may count something of its own once per firing (CAM's night
  // glycolysis takes a glucose off the net count).
  for (const [key, value] of Object.entries(def.ledger ?? {})) world.ledger[key] = (world.ledger[key] ?? 0) + value;
  // Products leave from where the assembly line left them (M6.5 P5).
  const plan = choreography(def, base.id);
  for (const slot of Object.keys(base.out)) {
    const rest = slotAt(plan, slot, 1);
    if (rest) station.where[slot] = rest;
  }
  station.fired += 1;
  station.lastFired = world.time;
  station.products = {};
  for (const slot of Object.keys(base.out)) station.products[slot] = station.slots[slot];
  station.slots = null;
  station.held = {};
  station.phase = 'unload';
  station.t = 0;
  station.extra = 0;
  station.targets = {};
  station.holds = [];
  station.waiting = !reserveOutputs(world, def, station);
}

function finishWork(world, def, station) {
  const mode = def.modes[station.mode];
  const base = REACTIONS[mode.reaction];
  if (base.compound) {
    finishCompound(world, def, station);
    return;
  }
  const reaction = station.map ? { ...base, map: station.map } : base;
  const inputs = {};
  for (const [role, mol] of Object.entries(station.held)) inputs[role] = world.molecules[mol];
  const involved = Object.values(inputs).flatMap((molecule) => Object.values(molecule.atoms));
  const { products, moves, electrons } = applyReaction(world, reaction, inputs);
  station.fired += 1;
  station.lastFired = world.time;
  countReaction(world, def, reaction);
  station.products = {};
  for (const [role, molecule] of Object.entries(products)) station.products[role] = molecule.id;
  const event = {
    type: 'reaction',
    station: def.id,
    reaction: reaction.id,
    atoms: involved,
    moves,
    electrons,
    products: { ...station.products },
    time: world.time,
  };
  world.events.push(event);
  world.completed.push(event);
  station.held = {};
  station.phase = 'unload';
  station.t = 0;
  station.extra = 0;
  station.targets = {};
  station.holds = [];
  station.waiting = !reserveOutputs(world, def, station);
}

// What a reaction adds to the ledger. ATP is counted by how it was made:
// substrate level, oxidative, or by a chloroplast's synthase (photo). ATP
// spent counts against the kind that spent it, so respiration's net is one
// number; a scene that keeps `atpUsed` also counts the spending on its own.
function countReaction(world, def, reaction) {
  const ledger = world.ledger;
  if (reaction.atp && def.atpKind !== 'held') {
    ledger.atp += reaction.atp;
    const kind = def.atpKind ?? reaction.atpKind ?? 'sub';
    if (kind === 'ox') ledger.atpOx += reaction.atp;
    else if (kind === 'photo') ledger.atpPhoto += reaction.atp;
    else ledger.atpSub += reaction.atp;
    if (reaction.atp < 0 && ledger.atpUsed != null) ledger.atpUsed -= reaction.atp;
  }
  if (reaction.nadph && ledger.nadph != null) ledger.nadph += reaction.nadph;
  if (reaction.water) ledger.h2o += reaction.water;
  if (reaction.co2) ledger.co2 += reaction.co2;
  if (reaction.acceptor === 'o2') ledger.o2 += 1;
  if (reaction.acceptor === 'nitrate') ledger.nitrate += 1;
  // The cycle's NADH and FADH₂ count from the first acetyl-CoA: until then
  // the ring is only finishing the skeletons it was primed with (M8.6).
  if (reaction.phase === 'cycle' && world.stations.pdh?.fired === 0) return;
  for (const [key, value] of Object.entries(reaction.ledger ?? {})) ledger[key] = (ledger[key] ?? 0) + value;
}

// Placeholders on loops are taken at the start of the unload. Each product
// meets its gap at the tap just as its glide ends. If no gap is free in time,
// that product's glide is stretched until one comes round, so a station
// rarely waits, and two outputs never wait on each other.
function reserveOutputs(world, def, station) {
  const mode = def.modes[station.mode];
  const times = timesOf(def, station);
  const groups = new Map();
  for (const output of mode.outputs) {
    if (output.to !== 'loop') continue;
    // ADP and phosphate go back to the loop the ATP came from. Without
    // oxygen they wait at the translocase, ready the moment oxygen returns.
    const loopId = output.loop.startsWith('source:') ? station.sources[output.loop.slice(7)] : output.loop;
    const key = `${loopId}:${output.group ?? output.role}`;
    if (!groups.has(key)) groups.set(key, { key, loopId, roles: [], output });
    groups.get(key).roles.push(output.role);
  }
  const lead = times.unload - station.t;
  for (const group of groups.values()) {
    const v = loopSpeedOf(group.loopId);
    if (station.holds.some((hold) => hold.key === group.key)) continue;
    const tap = group.output.tap ?? sourceTap(def, group.output, group.loopId);
    const mols = group.roles.map((role) => station.products[role]);
    const L = LOOPS[group.loopId].path.length;
    // Long hops get the time they need, so nothing streaks.
    pointAt(LOOPS[group.loopId].path, tap, scratch);
    const from = def.kind === 'synthase' ? def.knob : def;
    const hop = Math.hypot(scratch.x - from.x, scratch.y - from.y);
    const least = Math.max(0, hop / PARAMS.unloadSpeed - times.unload);
    let placed = null;
    for (let extra = least; extra <= least + PARAMS.mergeWindow; extra += 0.05) {
      const spot = ((tap - v * (lead + extra)) % L + L) % L;
      if (!gapFits(world, group.loopId, spot, tap, mols)) continue;
      placed = { item: { mols: [...mols], s: spot, ph: true }, extra };
      break;
    }
    if (!placed) return false;
    const items = world.loops[group.loopId].items;
    items.push(placed.item);
    items.sort((a, b) => a.s - b.s);
    markFlux(world, group.loopId);
    station.holds.push({ key: group.key, loop: group.loopId, item: placed.item, roles: group.roles, extra: placed.extra });
  }
  station.extra = station.holds.reduce((most, hold) => Math.max(most, hold.extra), 0);
  return true;
}

// The translocase can exchange while matrix ATP is waiting at it or on its
// way, or it has just fired. Without oxygen the matrix makes no ATP, so this
// goes false and ADP stays in the cytosol for glycolysis.
function sourceTap(def, output, loopId) {
  const cacheKey = `${scene.id}:${def.id}:${output.role}:${loopId}`;
  if (!sourceTapCache.has(cacheKey)) {
    const path = LOOPS[loopId].path;
    let best = 0;
    let bestD = Infinity;
    for (let s = 0; s <= path.length; s += 2) {
      pointAt(path, s, scratch);
      const d = Math.hypot(scratch.x - output.at.x, scratch.y - output.at.y);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    sourceTapCache.set(cacheKey, best);
  }
  return sourceTapCache.get(cacheKey);
}
const sourceTapCache = new Map();

// Products for a belt that already took one this hand-off (RuBisCO's second
// 3-PG, Regeneration's three RuBP) wait in the station and leave one by one
// as the belt makes room.
function handOff(world, def, station) {
  const mode = def.modes[station.mode];
  const first = new Set();
  for (const output of mode.outputs) {
    if (output.to !== 'belt' || first.has(output.belt)) continue;
    first.add(output.belt);
    const mol = station.products[output.role];
    if (!beltHasRoom(world, output.belt, speciesOf(world, mol))) return;
  }
  const used = new Set();
  station.queue = [];
  for (const output of mode.outputs) {
    const mol = station.products[output.role];
    if (output.to === 'belt') {
      if (used.has(output.belt)) {
        station.queue.push({ belt: output.belt, mol, role: output.role });
        continue;
      }
      used.add(output.belt);
      const s = entryS(world, output.belt, speciesOf(world, mol));
      world.belts[output.belt].items.push({ mols: [mol], s, v: 0, readyAt: null });
      markFlux(world, output.belt);
    } else if (output.to === 'bulk') {
      world.events.push({ type: 'bulk', mol, kind: speciesOf(world, mol), station: def.id, atoms: atomsOf(world, mol), time: world.time });
      removeMolecule(world, mol);
    } else if (output.to === 'exhaust') {
      // A gas made where the leaf keeps a gas pool joins it at the drift's end.
      world.drifts.push({ mol, path: output.drift, s: 0, v: 0, kind: 'exhaust', t: 0, ...(output.join ? { join: true } : {}) });
    } else if (output.to === 'gas') {
      releaseGas(world, def, mol, output);
    } else if (output.to === 'reservoir') {
      startTransit(world, mol, [output.at, { x: output.at.x, y: output.at.y - 24 }], 0.5, 'reservoir', { via: def.id });
    } else if (output.to === 'internal') {
      station.internal[output.slot] = mol;
    } else if (output.to === 'store') {
      station.store.push(mol);
    }
  }
  for (const hold of station.holds) hold.item.ph = null;
  station.holds = [];
  station.products = {};
  station.phase = station.queue.length ? 'release' : 'idle';
  station.t = 0;
}

// The next product waits one place back from the belt's entrance. Once
// the belt has room it eases into the entrance, then joins the belt.
export const RELEASE_EASE = 0.25;
function release(world, station) {
  const next = station.queue[0];
  if (!beltHasRoom(world, next.belt, speciesOf(world, next.mol))) {
    station.advance = null;
    return;
  }
  station.advance ??= world.time;
  if (world.time - station.advance < RELEASE_EASE) return;
  world.belts[next.belt].items.push({ mols: [next.mol], s: entryS(world, next.belt, speciesOf(world, next.mol)), v: 0, readyAt: null });
  markFlux(world, next.belt);
  station.queue.shift();
  station.advance = null;
  if (!station.queue.length) station.phase = 'idle';
}

// Drift: gases rise out of the top of the cell, O₂ drifts in to Complex IV,
// and new feed molecules arrive from off the left of the stage.

function advanceDrifts(world, dt) {
  const keep = [];
  const intake = world.drifts.filter((drift) => drift.kind === 'intake').sort((a, b) => b.s - a.s);
  const supplies = suppliesOf();
  for (const drift of world.drifts) {
    const path = drift.route ?? DRIFTS[drift.path];
    const pace = world.pace ?? 1;
    if (drift.kind === 'exhaust') {
      // A drift may set its own speed (CAM: malic enzyme's CO₂ rising to the air).
      drift.v = Math.min((path.speed ?? PARAMS.exhaustSpeed) * pace, drift.v + 60 * pace * dt);
      drift.s += drift.v * dt;
      drift.t += dt;
      if (drift.s >= path.length && drift.join) {
        pointAt(path, path.length, scratch);
        const pool = poolOf(drift.join);
        const entry = cloudEntry(poolRegion(pool), drift.mol, { x: scratch.x, y: scratch.y }, world.time);
        if (pool !== 'air') entry.pool = pool;
        world.gas.push(entry);
        world.events.push({ type: 'gas', mol: drift.mol, kind: speciesOf(world, drift.mol), atoms: atomsOf(world, drift.mol), time: world.time });
        continue;
      }
      if (drift.s >= path.length) {
        const kind = speciesOf(world, drift.mol);
        if (kind === 'lactate') world.ledger.lactate += 1;
        if (kind === 'ethanol') world.ledger.ethanol += 1;
        if (kind === 'nitrite') world.ledger.nitrite += 1;
        if (kind === 'glycolate' && world.ledger.glycolate != null) world.ledger.glycolate += 1;
        // Sugar leaving a leaf cell goes to the rest of the plant (E8).
        if (drift.path === scene.exportDrift && scene.life?.kind === 'store' && world.ledger.exported != null) world.ledger.exported += 1;
        if (drift.path === scene.exportDrift && scene.life?.kind === 'reserve') {
          world.reserve = Math.min(scene.life.cap, (world.reserve ?? 0) + 1);
          if (world.ledger.exported != null) world.ledger.exported += 1;
        }
        world.events.push({ type: 'exit', mol: drift.mol, kind, atoms: atomsOf(world, drift.mol), labels: labelsOf(world, drift.mol), time: world.time });
        removeMolecule(world, drift.mol);
        continue;
      }
    } else if (drift.kind === 'outflow') {
      // Unbound O₂ diffuses back out the way it came once the supply is gone.
      drift.v = Math.min(PARAMS.exhaustSpeed * 1.6 * pace, drift.v + 60 * pace * dt);
      drift.s -= drift.v * dt;
      if (drift.s <= 0) {
        world.events.push({ type: 'exit', mol: drift.mol, kind: speciesOf(world, drift.mol), atoms: atomsOf(world, drift.mol), time: world.time });
        removeMolecule(world, drift.mol);
        continue;
      }
    } else if (drift.kind === 'intake') {
      const lane = intake.filter((other) => other.path === drift.path);
      const index = lane.indexOf(drift);
      let limit = path.length;
      if (index > 0) limit = lane[index - 1].s - 22;
      const room = Math.max(0, limit - drift.s);
      if (room > 0.5) markFlux(world, drift.path);
      const target = Math.min(PARAMS.o2Speed * pace, Math.sqrt(2 * PARAMS.accel * room));
      drift.v = drift.v < target ? Math.min(target, drift.v + PARAMS.accel * pace * dt) : target;
      drift.s = Math.min(limit, drift.s + drift.v * dt);
      const supply = supplies.find((entry) => entry.lane === drift.path);
      if (index === 0 && room < 0.5 && supply) {
        const dock = world.stations[supply.station].docks[supply.dock];
        const free = dock.slots.indexOf(null);
        if (free >= 0) {
          dock.slots[free] = { mol: drift.mol, loop: null, glide: free ? { t: 0, dur: PARAMS.dockGlide, from: { point: dockPoint(DEFS[supply.station], supply.dock, 0) } } : null };
          world.events.push({ type: 'dock', station: supply.station, dock: supply.dock, mol: drift.mol, time: world.time });
          continue;
        }
      }
    } else if (drift.kind === 'arrive') {
      drift.t += dt;
      if (drift.t >= PARAMS.arriveTime) {
        world.tray[drift.slot] = drift.mol;
        world.events.push({ type: 'arrive', what: drift.slot, mol: drift.mol, time: world.time });
        continue;
      }
    }
    keep.push(drift);
  }
  world.drifts = keep;
  for (const lane of scene.lanes ?? []) {
    const motor = world.motors[lane.id];
    if (motor) motor.phase += motor.v * dt;
  }
}

export function arriveProgress(t) {
  const x = Math.min(1, Math.max(0, t / PARAMS.arriveTime));
  return 1 - (1 - x) ** 3;
}

// Glucose is pulled in, not pushed: a new one enters when the sugar already
// on its way to the mitochondrion has dropped below a small amount, and never
// sooner than a minimum spacing. Uptake therefore runs as fast as pyruvate is
// used, which is as fast as the cell spends ATP.
function spacingOf(world) {
  const params = scene.params ?? {};
  const base = params.minSpacing ?? PARAMS.minSpacing;
  const floor = params.spacingFloor ?? base;
  const level = world.level.atp;
  const low = level >= 0.62 ? 0 : Math.min(1, (0.62 - level) / 0.62);
  const t = Math.max(low, hunger(world));
  return base + (floor - base) * t;
}

// The Pasteur effect: a cell whose work is going unpaid takes glucose up
// faster and lets more of it into glycolysis at once. A healthy cell never
// starves, so this never touches it.
function hunger(world) {
  const starving = (world.work?.starved ?? 0) / 8;
  // How often cell work has been running behind its demand lately. A healthy
  // cell sits near a quarter; a cell held back by a slow enzyme sits higher.
  const behind = ((world.work?.behind ?? 0) - 0.45) / 0.25;
  return Math.min(1, Math.max(0, starving, behind));
}

function supplyFeed(world) {
  const feed = scene.feed;
  if (world.dead || !feed) return;
  if (!world.tray[feed.id]) return;
  if (world.feed === 'one' && world.fed > 0) return;
  if (world.time - world.gate.last < spacingOf(world)) return;
  if (!beltHasRoom(world, feed.belt, feed.species)) return;
  const inFlight = backlog(world);
  world.gate.backlog = inFlight;
  const backlogLimit = (scene.params?.backlog ?? PARAMS.backlog) + hunger(world) * (scene.params?.hungryBacklog ?? 2);
  if (inFlight > backlogLimit) return;
  const mol = world.tray[feed.id];
  world.belts[feed.belt].items.push({ mols: [mol], s: 0, v: 0, readyAt: null });
  markFlux(world, feed.belt);
  world.tray[feed.id] = null;
  world.gate.last = world.time;
  world.fed += 1;
  world.ledger[feed.id] += 1;
  world.events.push({ type: 'admit', mol, time: world.time });
  if (world.feed === 'continuous') {
    const next = createMolecule(world, feed.species, 'feed');
    world.drifts.push({ mol: next.id, path: feed.arrive, s: 0, v: 0, kind: 'arrive', slot: feed.id, t: 0 });
  }
}

// Sugar on its way to pyruvate dehydrogenase, in glucose equivalents. Uptake
// waits while this is high, which stands in for the feedback that slows
// hexokinase and phosphofructokinase when the cell already has plenty.
const HEXOSES = new Set(['glucose', 'g6p', 'f6p', 'fbp']);
const TRIOSES = new Set(['dhap', 'g3p', 'bpg', 'pg3', 'pg2', 'pep', 'pyruvate', 'acetaldehyde']);
export function backlog(world) {
  let count = 0;
  const add = (mol) => {
    const species = speciesOf(world, mol);
    if (HEXOSES.has(species)) count += 1;
    else if (TRIOSES.has(species)) count += 0.5;
  };
  // Sugar stalled for a while (pyruvate parked at a mitochondrion that has
  // stopped) is not on its way anywhere, so it does not hold uptake back.
  for (const belt of Object.values(world.belts)) {
    for (const item of belt.items) {
      if (item.still != null && world.time - item.still > 40) continue;
      if (item.readyAt != null && item.readyAt < 0) continue;
      add(item.mols[0]);
    }
  }
  for (const station of Object.values(world.stations)) {
    for (const mol of Object.values(station.held)) add(mol);
    for (const mol of Object.values(station.products)) add(mol);
  }
  return count;
}

// Each acceptor drifts in so that its enzyme always has one docked and a few
// on the way: O₂ to Complex IV (or bo₃), nitrate to nitrate reductase.
function supplyAcceptors(world) {
  if (world.dead) return;
  for (const supply of suppliesOf()) {
    if (!supplyOpen(world, supply) || !world.tray[supply.id]) continue;
    let count = world.drifts.filter((drift) => drift.kind === 'intake' && drift.path === supply.lane).length;
    for (const slot of world.stations[supply.station].docks[supply.dock].slots) if (slot) count += 1;
    if (count >= (supply.ahead ?? PARAMS.o2Ahead)) continue;
    const mol = world.tray[supply.id];
    world.drifts.push({ mol, path: supply.lane, s: 0, v: 0, kind: 'intake', t: 0 });
    world.tray[supply.id] = null;
    world.launched += 1;
    world.events.push({ type: 'launch', mol, kind: speciesOf(world, mol), atoms: atomsOf(world, mol), time: world.time });
    const next = createMolecule(world, supply.species, 'feed');
    world.drifts.push({ mol: next.id, path: supply.arrive, s: 0, v: 0, kind: 'arrive', slot: supply.id, t: 0 });
  }
}

export function demandPer(world) {
  const params = scene.params ?? {};
  if (world.patch?.demand === 'ferment') return params.fermentDemand ?? 0.05;
  return params.demand ?? (30 / PARAMS.takt);
}

function inUse(world, def, station, idle) {
  return station.store.length >= (def.store?.cap ?? Infinity) || world.time - (station.lastFired ?? -Infinity) < idle;
}

// An idle dock's carrier goes back to its loop once the station has not been
// in use for that long (v1.1). In a C3 leaf the cyclic route can rest for
// minutes, and the plastoquinone it held looked stuck; in C4 and CAM by day
// the route acts every few seconds and keeps its carrier.
function releaseIdleDocks(world) {
  for (const def of scene.stations) {
    if (!def.docks) continue;
    const station = world.stations[def.id];
    if (station.phase !== 'idle') continue;
    for (const [name, dockDef] of Object.entries(def.docks)) {
      if (!dockDef.idle || inUse(world, def, station, dockDef.idle)) continue;
      const slots = station.docks[name].slots;
      slots.forEach((slot, i) => {
        if (!slot?.loop || slot.glide) return;
        const path = LOOPS[slot.loop].path;
        const s = (dockDef.taps[slot.loop] + 14 * (i + 1)) % path.length;
        // It eases from the dock onto the loop rather than jumping.
        const from = slotPoint(def, name, i, slot);
        pointAt(path, s, scratch);
        world.loops[slot.loop].items.push({ mols: [slot.mol], s, ph: null, settle: { x: from.x - scratch.x, y: from.y - scratch.y, t: 0 } });
        slots[i] = null;
        markFlux(world, slot.loop);
      });
    }
  }
}

// Frees NADH an idle shuttle holds but cannot pass on (yeast aerobic needs it).
function releaseStuckShuttle(world) {
  const station = world.stations.shuttle;
  const def = DEFS.shuttle;
  if (!station || station.phase !== 'idle') return;
  const slot = station.docks.cyt?.slots?.[0];
  if (!slot || slot.glide) return;
  if (wantsCarrier(world, def, station, 'cyt', slot.loop)) return;
  const loopId = slot.loop || 'nadc';
  const tap = def.docks.cyt.taps?.[loopId] ?? 0;
  const length = LOOPS[loopId].path.length;
  world.loops[loopId].items.push({ mols: [slot.mol], s: (tap + 12) % length, ph: null });
  station.docks.cyt.slots[0] = null;
}

// Bookkeeping -------------------------------------------------------------------

// Which label each atom of a molecule has: the narration names glucose's carbons.
function labelsOf(world, molId) {
  const molecule = world.molecules[molId];
  return molecule ? Object.fromEntries(Object.entries(molecule.atoms).map(([label, id]) => [id, label])) : {};
}

export function atomsOf(world, molId) {
  const molecule = world.molecules[molId];
  return molecule ? Object.values(molecule.atoms) : [];
}

function removeMolecule(world, molId) {
  const molecule = world.molecules[molId];
  if (!molecule) return;
  for (const atomId of Object.values(molecule.atoms)) {
    if (world.keep?.has(atomId)) continue;
    delete world.atoms[atomId];
  }
  delete world.molecules[molId];
}

export function nextRand(world) {
  world.rng = (Math.imul(world.rng, 1664525) + 1013904223) >>> 0;
  return world.rng;
}

// The ATP level is the cytosol's: cytosolic ATP over cytosolic ATP and ADP,
// on the cytosol's loops and in the docks those loops feed (§16 D4). The
// mitochondrion's own adenosine does not count.
function measureAtp(world) {
  let atp = 0;
  let adp = 0;
  const add = (mol) => {
    const species = speciesOf(world, mol);
    if (species === 'atp') atp += 1;
    else if (species === 'adp') adp += 1;
  };
  for (const [loopId, loop] of Object.entries(LOOPS)) {
    if (loop.compartment !== 'cytosol') continue;
    for (const item of world.loops[loopId].items) item.mols.forEach(add);
  }
  for (const def of scene.stations) {
    for (const [name, dockDef] of Object.entries(def.docks ?? {})) {
      if (!dockDef.loops?.length || LOOPS[dockDef.loops[0]]?.compartment !== 'cytosol') continue;
      for (const slot of world.stations[def.id].docks[name].slots) if (slot) add(slot.mol);
    }
  }
  return atp + adp ? atp / (atp + adp) : 0;
}

export function atpLevel(world) {
  return world.level.atp;
}

export function protonLevel(world) {
  return Math.min(1, (world.reservoir.length + protonsCommitted(world)) / PARAMS.reservoirCap);
}

// Carrier loops run faster than substrate belts; the two ATP loops beside
// the synthase run fastest, because they carry the most traffic.
function loopSpeedOf(loopId) {
  if (LOOPS[loopId]?.speed) return LOOPS[loopId].speed;
  return PARAMS.hotLoops.includes(loopId) || LOOPS[loopId]?.hot ? PARAMS.hotSpeed : PARAMS.loopSpeed;
}

export { P };
export { BELTS, DEFS, DRIFTS, LOOPS, bindWorld, currentScene } from './book.js';
export { clockTime, clockPhase } from './clock.js';
export { gasCount } from './gas.js';
export { GLOW_TIME } from './light.js';
export { hopperPoint, hopperDrawn, parkPoint, parkedCount, storedSugar } from './stores.js';
