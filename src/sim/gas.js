// The leaf's air space and the stoma: gases drift, cross and are drawn by stations.

import { cloudEntry, cloudHome, diffuse } from '../scenes/cloud.js';
import { DEFS, scene } from './book.js';
import { atomsOf, dockPoint, markFlux, nextRand, shiftDock, speciesOf } from './engine.js';
import { createMolecule } from './molecules.js';
import { polyPath } from './path.js';

// A leaf's air space holds real CO₂ and O₂ molecules on a slow random walk,
// like the proton cloud. The stoma lets each gas through down its gradient
// (D18): in while the air space holds less than the outside air, out while it
// holds more, at a rate set by the gap and by how far the stomata are open.
// An enzyme that takes a gas draws the nearest molecule along its route.
//
// A scene may also keep inner pools (C4's bundle sheath): gas made inside a
// cell (malic enzyme's CO₂) joins one, and a gas named in its `exchange`
// seeps between it and the air space down the same kind of gradient.
const GAS_MOTION = { sigma: 40, tau: 2 };
const GAS_SPEED = 180;

// The air space is pool 'air'; an entry or drift with no pool is in it.
export function poolOf(id) {
  return id === true || id === 'gas' || id == null ? 'air' : id;
}

export function poolRegion(pool) {
  return pool === 'air' ? scene.gas.region : scene.gas.inner[pool].region;
}

export function primeGas(world) {
  const gas = scene.gas;
  world.gas = [];
  world.gasFlow = {};
  const fill = (pool, counts) => {
    const region = poolRegion(pool);
    for (const [species, count] of Object.entries(counts ?? {})) {
      for (let i = 0; i < count; i += 1) {
        const molecule = createMolecule(world, species, 'pool');
        const entry = cloudEntry(region, molecule.id, cloudHome(region, molecule.id), -10);
        if (pool !== 'air') entry.pool = pool;
        world.gas.push(entry);
      }
    }
  };
  fill('air', gas.ambient);
  for (const species of Object.keys(gas.ambient)) world.gasFlow[species] = 0;
  for (const [pool, inner] of Object.entries(gas.inner ?? {})) {
    fill(pool, inner.prime);
    for (const species of Object.keys(inner.exchange ?? {})) world.gasFlow[`${pool}:${species}`] = 0;
  }
  // The CO₂ waiting outside the stoma can be tagged; it is the next to enter.
  for (const tray of gas.trays ?? []) world.tray[tray.id] = createMolecule(world, tray.species, 'feed').id;
}

export function updateGas(world, dt) {
  const gas = scene.gas;
  const pace = world.pace ?? 1;
  // The guard cells ease open or shut over about two seconds.
  const target = world.patch?.stomata ?? 1;
  const now = world.stomata ?? target;
  world.stomata = now + Math.sign(target - now) * Math.min(Math.abs(target - now), (dt * pace) / 2);
  const motion = gas.motion ?? GAS_MOTION;
  for (const entry of world.gas) diffuse(entry, poolRegion(entry.pool ?? 'air'), dt * pace, world.tick, motion);
  if (world.dead) return;
  exchangeGas(world, dt * pace);
  for (const pool of Object.keys(gas.inner ?? {})) exchangeInner(world, pool, dt * pace);
  drawGas(world);
}

export function hasPinned(world, molId) {
  if (!world.keep) return false;
  const molecule = world.molecules[molId];
  return Boolean(molecule) && Object.values(molecule.atoms).some((id) => world.keep.has(id));
}

// Molecules of one gas in a pool (the air space unless named), counting
// those already on their way into it.
export function gasCount(world, species, pool = 'air') {
  let n = 0;
  for (const entry of world.gas ?? []) if ((entry.pool ?? 'air') === pool && speciesOf(world, entry.mol) === species) n += 1;
  for (const drift of world.drifts) if (drift.join && poolOf(drift.join) === pool && speciesOf(world, drift.mol) === species) n += 1;
  return n;
}

function gasJitter(world) {
  return ((nextRand(world) % 1000) / 1000 - 0.5) * 0.6;
}

function exchangeGas(world, dt) {
  const gas = scene.gas;
  const g = gas.conductance * (world.stomata ?? 1);
  for (const [species, ambient] of Object.entries(gas.ambient)) {
    let credit = (world.gasFlow[species] ?? 0) + g * (ambient - gasCount(world, species)) * dt;
    if (credit >= 1) {
      if (gasIn(world, species)) credit -= 1 + gasJitter(world);
      else credit = Math.min(credit, 1.5);
    } else if (credit <= -1) {
      if (gasOut(world, species)) credit += 1 + gasJitter(world);
      else credit = Math.max(credit, -1.5);
    }
    world.gasFlow[species] = credit;
  }
}

// An inner pool trades the gases it names with the air space, down their
// gradient, through its cell (the bundle sheath's thick walls let gas
// through only slowly).
function exchangeInner(world, pool, dt) {
  const inner = scene.gas.inner[pool];
  for (const [species, k] of Object.entries(inner.exchange ?? {})) {
    const key = `${pool}:${species}`;
    let credit = (world.gasFlow[key] ?? 0) + k * (gasCount(world, species) - gasCount(world, species, pool)) * dt;
    if (credit >= 1) {
      if (moveGas(world, species, 'air', pool, inner.entry)) credit -= 1 + gasJitter(world);
      else credit = Math.min(credit, 1.5);
    } else if (credit <= -1) {
      if (moveGas(world, species, pool, 'air', [...inner.entry].reverse())) credit += 1 + gasJitter(world);
      else credit = Math.max(credit, -1.5);
    }
    world.gasFlow[key] = credit;
  }
}

// One molecule from one pool to another along a route: the unpinned one
// nearest the route's start.
function moveGas(world, species, from, to, route) {
  let best = -1;
  let bestD = Infinity;
  world.gas.forEach((entry, i) => {
    if ((entry.pool ?? 'air') !== from || speciesOf(world, entry.mol) !== species || hasPinned(world, entry.mol)) return;
    const d = Math.hypot(entry.x - route[0].x, entry.y - route[0].y);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  if (best < 0) return false;
  const [entry] = world.gas.splice(best, 1);
  const land = landing(world, to);
  world.drifts.push({ mol: entry.mol, route: polyPath([{ x: entry.x, y: entry.y }, ...route, land], 18), s: 0, v: 0, kind: 'exhaust', t: 0, join: to });
  return true;
}

// A place to land in a pool, chosen by the seeded generator.
function landing(world, pool) {
  const region = poolRegion(pool);
  const point = {
    x: region.x1 + 20 + ((nextRand(world) % 1000) / 1000) * (region.x2 - region.x1 - 40),
    y: region.y1 + 20 + ((nextRand(world) % 1000) / 1000) * (region.y2 - region.y1 - 40),
  };
  return cloudEntry(region, 'x', point, 0);
}

// One molecule in through the stoma: the tray's, if this gas waits in the
// tray, otherwise one from the outside air.
function gasIn(world, species) {
  const gas = scene.gas;
  const stoma = gas.stoma;
  const tray = (gas.trays ?? []).find((entry) => entry.species === species);
  let mol;
  let start;
  if (tray) {
    mol = world.tray[tray.id];
    if (!mol) return false;
    world.tray[tray.id] = null;
    start = scene.tray[tray.id];
    world.launched += 1;
    world.events.push({ type: 'launch', mol, kind: species, atoms: atomsOf(world, mol), time: world.time });
    const next = createMolecule(world, species, 'feed');
    world.drifts.push({ mol: next.id, path: tray.arrive, s: 0, v: 0, kind: 'arrive', slot: tray.id, t: 0 });
  } else {
    mol = createMolecule(world, species, 'pool').id;
    start = { x: stoma.x, y: stoma.exit };
  }
  const spread = ((nextRand(world) % 1000) / 1000 - 0.5) * 140;
  const land = { x: stoma.x + 40 + spread, y: gas.region.y1 + 24 + ((nextRand(world) % 1000) / 1000) * 50 };
  const route = polyPath([start, { x: stoma.x, y: stoma.outer - 6 }, { x: stoma.x, y: stoma.inner + 6 }, land], 18);
  world.drifts.push({ mol, route, s: 0, v: 0, kind: 'exhaust', t: 0, join: 'air' });
  return true;
}

// One molecule out through the stoma, the one nearest it. A tagged O₂ goes
// first, so a water oxygen's journey ends outside the leaf; a tagged CO₂
// never leaves this way.
function gasOut(world, species) {
  const stoma = scene.gas.stoma;
  const at = { x: stoma.x, y: stoma.inner };
  let best = -1;
  let bestD = Infinity;
  world.gas.forEach((entry, i) => {
    if ((entry.pool ?? 'air') !== 'air' || speciesOf(world, entry.mol) !== species) return;
    const pinned = hasPinned(world, entry.mol);
    if (pinned && species === 'co2') return;
    const d = pinned ? -1 : Math.hypot(entry.x - at.x, entry.y - at.y);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  if (best < 0) return false;
  const [entry] = world.gas.splice(best, 1);
  const route = polyPath([{ x: entry.x, y: entry.y }, { x: stoma.x, y: stoma.inner + 6 }, { x: stoma.x, y: stoma.outer - 6 }, { x: stoma.x, y: stoma.exit }], 18);
  world.drifts.push({ mol: entry.mol, route, s: 0, v: 0, kind: 'exhaust', t: 0 });
  return true;
}

// Which gas an enzyme's dock takes next. RuBisCO takes CO₂ or O₂ by their
// counts in its pool, weighted towards CO₂ by its specificity:
// p(O₂) = n(O₂) / (n(O₂) + S · n(CO₂)) (M6 plan §3.4). A pinned CO₂ goes
// first, once it has drifted in its pool long enough to be seen there.
const PINNED_AIR_TIME = 5;
function pinnedReady(world, entry) {
  return world.time - entry.since >= PINNED_AIR_TIME;
}

function chooseGas(world, draw) {
  const [first, second] = draw.species;
  const pool = draw.pool ?? 'air';
  let n1 = 0;
  let n2 = 0;
  for (const entry of world.gas) {
    if ((entry.pool ?? 'air') !== pool) continue;
    const species = speciesOf(world, entry.mol);
    if (species === first) {
      if (hasPinned(world, entry.mol)) {
        if (pinnedReady(world, entry)) return first;
        continue;
      }
      n1 += 1;
    } else if (species === second && !hasPinned(world, entry.mol)) n2 += 1;
  }
  if (!second || !n2) return n1 ? first : null;
  if (!n1) return second;
  const p = n2 / (n2 + (draw.specificity ?? 1) * n1);
  return (nextRand(world) % 100000) / 100000 < p ? second : first;
}

function pickGas(world, species, at, pool) {
  let best = -1;
  let bestD = Infinity;
  world.gas.forEach((entry, i) => {
    if ((entry.pool ?? 'air') !== pool || speciesOf(world, entry.mol) !== species) return;
    const pinned = hasPinned(world, entry.mol);
    // A tagged O₂ is on its way out of the leaf, not to RuBisCO.
    if (pinned && (species !== 'co2' || !pinnedReady(world, entry))) return;
    const d = pinned ? -1 : Math.hypot(entry.x - at.x, entry.y - at.y);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

function drawGas(world) {
  for (const draw of scene.gas.draws ?? []) {
    if (world.off?.[draw.station]) continue;
    const def = DEFS[draw.station];
    const dock = world.stations[draw.station].docks[draw.dock];
    if (!dock.slots[0] && dock.slots.some((slot) => slot && !slot.glide?.from.path)) shiftDock(def, draw.dock, dock);
    // A new draw joins the back of the queue, never ahead of one on its way.
    let free = dock.slots.length;
    while (free > 0 && !dock.slots[free - 1]) free -= 1;
    const used = dock.slots.filter(Boolean).length;
    if (free >= dock.slots.length || used >= (draw.ahead ?? dock.slots.length)) continue;
    const species = chooseGas(world, draw);
    if (!species) continue;
    const target = dockPoint(def, draw.dock, free);
    const pool = draw.pool ?? 'air';
    const index = pickGas(world, species, draw.route[0] ?? target, pool);
    if (index < 0) continue;
    const [entry] = world.gas.splice(index, 1);
    const path = polyPath([{ x: entry.x, y: entry.y }, ...draw.route, target], 16);
    dock.slots[free] = { mol: entry.mol, loop: null, glide: { t: 0, dur: Math.max(0.6, path.length / GAS_SPEED), from: { path } } };
    if (draw.lane) markFlux(world, draw.lane);
    world.events.push({ type: 'dock', station: draw.station, dock: draw.dock, mol: entry.mol, kind: species, atoms: atomsOf(world, entry.mol), gas: true, pool, time: world.time });
  }
}

// Room in an inner pool for one more molecule a station makes (E9): malic
// enzyme waits while the bundle sheath already holds its fill of CO₂.
export function gasRoom(world, output, species) {
  const cap = scene.gas?.inner?.[output.pool]?.cap?.[species];
  return cap == null || gasCount(world, species, output.pool) < cap;
}

export function releaseGas(world, def, mol, output) {
  const from = output.at ?? { x: def.x, y: def.y };
  world.drifts.push({ mol, route: polyPath([from, landing(world, output.pool)], 18), s: 0, v: 0, kind: 'exhaust', t: 0, join: output.pool });
}
