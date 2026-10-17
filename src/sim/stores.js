// Hoppers, parking, stores, stored sugar and the drain.

import { BELTS, DEFS, scene } from './book.js';
import { phaseAllows } from './clock.js';
import { atDoor, atomsOf, beltHasRoom, easeGlide, entryS, markFlux, PARAMS, scratch, speciesOf } from './engine.js';
import { hasPinned } from './gas.js';
import { pointAt } from './path.js';

// Hoppers (E3) ------------------------------------------------------------------

// A hopper is a neat row inside its station, along the input side.
export function hopperPoint(def, index) {
  const hop = def.hopper;
  if (hop.places) return hop.places[Math.min(index, hop.places.length - 1)];
  const spacing = hop.spacing ?? 26;
  return { x: def.x + (hop.dx ?? 0) - ((hop.count - 1) / 2) * spacing + index * spacing, y: def.y + (hop.dy ?? -def.h / 2 + 18) };
}

export function shiftHopper(def, station) {
  station.hopper.forEach((entry, i) => {
    const from = hopperDrawn(def, station, i + 1, entry);
    entry.glide = { t: 0, dur: 0.35, from: { point: from } };
  });
}

// Where a hopper item is drawn now, given the index it is gliding to.
export function hopperDrawn(def, station, index, entry) {
  const target = hopperPoint(def, Math.min(index, def.hopper.count - 1));
  if (!entry?.glide) return target;
  const f = easeGlide(entry.glide.t / entry.glide.dur);
  const from = entry.glide.from.point;
  return { x: from.x + (target.x - from.x) * f, y: from.y + (target.y - from.y) * f };
}

// A compound station draws from its belt door into its hopper until it has
// as many as its sequence needs. This is a legal threshold queue (PLAN §5.3),
// like Complex IV's store.
export function feedHoppers(world) {
  for (const def of scene.stations) {
    const hop = def.hopper;
    if (!hop || world.off?.[def.id]) continue;
    const station = world.stations[def.id];
    if (station.hopper.length >= hop.count) continue;
    for (const beltId of hop.belts) {
      const item = atDoor(world, beltId);
      if (!item || speciesOf(world, item.mols[0]) !== hop.species) continue;
      const items = world.belts[beltId].items;
      items.splice(items.indexOf(item), 1);
      pointAt(BELTS[beltId].path, item.s, scratch);
      const target = hopperPoint(def, station.hopper.length);
      const dist = Math.hypot(target.x - scratch.x, target.y - scratch.y);
      station.hopper.push({ mol: item.mols[0], glide: { t: 0, dur: Math.max(0.35, dist / PARAMS.glideSpeed), from: { point: { x: scratch.x, y: scratch.y } } } });
      world.events.push({ type: 'hopper', station: def.id, mol: item.mols[0], time: world.time });
      markFlux(world, beltId);
      break;
    }
  }
}

// Stores (E11) ------------------------------------------------------------------------

// A store station parks molecules of one kind, each in a place of its own
// that it keeps until it leaves: the vacuole's malate, the starch grain's
// glucose. It takes from its belt in while it has room, and gives the
// oldest to its belt out when that belt has room, each in the phase the
// store allows (the vacuole gives malate back only by day).
export function parkPoint(def, place) {
  return def.park.places[place];
}

function freePlace(def, station) {
  const used = new Set(station.parked.map((entry) => entry.place));
  for (let i = 0; i < def.park.cap; i += 1) if (!used.has(i)) return i;
  return -1;
}

export function parkedCount(world, stationId) {
  return world.stations[stationId]?.parked.length ?? 0;
}

export function feedStores(world) {
  for (const def of scene.stations) {
    const park = def.park;
    if (!park || world.off?.[def.id]) continue;
    const station = world.stations[def.id];
    if (phaseAllows(world, park.take)) {
      const place = freePlace(def, station);
      for (const beltId of place < 0 ? [] : park.in) {
        const item = atDoor(world, beltId);
        if (!item || speciesOf(world, item.mols[0]) !== park.species) continue;
        const items = world.belts[beltId].items;
        items.splice(items.indexOf(item), 1);
        pointAt(BELTS[beltId].path, item.s, scratch);
        const target = parkPoint(def, place);
        const dist = Math.hypot(target.x - scratch.x, target.y - scratch.y);
        station.parked.push({ mol: item.mols[0], place, glide: { t: 0, dur: Math.max(0.35, dist / PARAMS.glideSpeed), from: { point: { x: scratch.x, y: scratch.y } } } });
        world.events.push({ type: 'park', station: def.id, mol: item.mols[0], atoms: atomsOf(world, item.mols[0]), time: world.time });
        markFlux(world, beltId);
        break;
      }
    }
    if (!park.out || !phaseAllows(world, park.give)) continue;
    // The oldest leaves first, except that a followed molecule goes ahead,
    // so a guided journey is not kept waiting a day (as E5 at the junction).
    const pinned = station.parked.findIndex((entry) => hasPinned(world, entry.mol));
    const index = pinned >= 0 ? pinned : 0;
    const oldest = station.parked[index];
    if (!oldest || oldest.glide || !beltHasRoom(world, park.out, park.species)) continue;
    // A store keeps what it holds until its belt out is nearly clear.
    if (park.ahead != null && world.belts[park.out].items.length >= park.ahead) continue;
    station.parked.splice(index, 1);
    const from = parkPoint(def, oldest.place);
    const s = entryS(world, park.out, park.species);
    pointAt(BELTS[park.out].path, s, scratch);
    const dur = Math.max(0.35, Math.hypot(scratch.x - from.x, scratch.y - from.y) / PARAMS.glideSpeed);
    world.belts[park.out].items.push({ mols: [oldest.mol], s, v: 0, readyAt: null, glide: { at: world.time, dur, from: { x: from.x, y: from.y } } });
    world.events.push({ type: 'unpark', station: def.id, mol: oldest.mol, atoms: atomsOf(world, oldest.mol), time: world.time });
    markFlux(world, park.out);
  }
}

// The grain's glucose, and glucose between it and night glycolysis.
export function storedSugar(world, life = scene.life) {
  let count = parkedCount(world, life.station);
  for (const beltId of life.belts ?? []) count += world.belts[beltId].items.length;
  for (const id of life.stations ?? []) {
    const station = world.stations[id];
    count += station.hopper.length + Object.values(station.held).filter((mol) => speciesOf(world, mol) === 'glucose').length;
    count += Object.values(station.products ?? {}).filter((mol) => speciesOf(world, mol) === 'glucose').length;
  }
  return count;
}

// The drain mode of the grain's exporter (CAM's life rule): the rest of the
// plant takes glucose at a steady rate, and whatever the grain cannot hold.
export function drainDue(world) {
  const life = scene.life;
  if (life?.kind !== 'store') return false;
  if ((world.drain ?? 0) >= 1) return true;
  // A followed glucose leaving the grain goes to the rest of the plant.
  const next = atDoor(world, DEFS[life.station].park.out);
  if (next && hasPinned(world, next.mols[0])) return true;
  return parkedCount(world, life.station) >= DEFS[life.station].park.cap;
}
