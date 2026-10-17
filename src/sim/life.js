// Life, the grain, death, the reserve, demand, the proton leak and the rotor.

import { BOOKS, scene } from './book.js';
import { demandPer, nearestProton, PARAMS, protonPosition, startTransit } from './engine.js';
import { storedSugar } from './stores.js';

// What keeps the cell alive (M6 plan §4.1, E8): a respiring cell must meet
// its demand for ATP; a leaf cell must keep its sugar reserve from emptying.
// Either way a dead cell slows to a stop.
export function updateLife(world, dt) {
  if (world.dead) {
    world.pace = Math.max(0, world.pace - dt / 1.7);
    return;
  }
  const life = scene.life ?? { kind: 'demand' };
  if (life.kind === 'demand') updateDemand(world, dt);
  else if (life.kind === 'reserve') updateReserve(world, dt, life);
  else if (life.kind === 'store') updateGrain(world, dt, life);
}

// CAM lives on its starch grain (E11): the reserve is the glucose in it
// and on its way from it to night glycolysis, the rest of the plant draws
// some away, and the cell starves once all of it has gone for a while.
function updateGrain(world, dt, life) {
  world.drain = Math.min(2, (world.drain ?? 0) + life.drain * (world.pace ?? 1) * dt);
  world.reserve = storedSugar(world, life);
  if (world.reserve > 0) {
    world.empty = 0;
    return;
  }
  world.empty = (world.empty ?? 0) + dt;
  if (world.empty >= life.starveAfter) die(world);
}

function die(world) {
  world.dead = true;
  world.death = world.condition;
  world.events.push({ type: 'death', condition: world.condition, time: world.time });
}

function updateReserve(world, dt, life) {
  world.reserve = Math.max(0, (world.reserve ?? life.start ?? life.cap) - life.drain * (world.pace ?? 1) * dt);
  if (world.reserve > 0) {
    world.empty = 0;
    return;
  }
  world.empty = (world.empty ?? 0) + dt;
  if (world.empty >= life.starveAfter) die(world);
}

function updateDemand(world, dt) {
  // Demand eases in, both when the cell starts and when a patch raises it
  // (switching back to aerobic respiration), so the cell has time to respond.
  const warm = Math.min(1, 0.3 + (world.time - (world.warmFrom ?? 0)) / PARAMS.workWarmup);
  const rate = demandPer(world) * warm;
  world.work.credit = Math.min(3, world.work.credit + rate * dt);
  const saturated = world.work.credit >= 2.9 ? 1 : 0;
  world.work.behind = (world.work.behind ?? 0) + (saturated - (world.work.behind ?? 0)) * (1 - Math.exp(-dt / 30));
  // Demand is unmet when the clock is saturated and nothing is on the way
  // from the mitochondrion or already in its dock. A single glycolytic ATP
  // pays the debt down and the clock saturates again within a second, so a
  // trickle cannot hide a demand the cell cannot meet.
  const clock = world.stations[scene.life?.clock ?? 'workm'];
  // Only ATP that has reached the clock counts. A molecule still touring
  // the export loop has not been found yet; the lap itself is a couple of seconds.
  const paying = clock.phase !== 'idle' || clock.docks.atp.slots.some(Boolean);
  // A payment wears the debt down rather than wiping it, so an occasional
  // glycolytic ATP cannot hide a demand the cell mostly fails to meet.
  if (world.work.credit >= 2.9 && !paying) world.work.starved += dt;
  else world.work.starved = Math.max(0, world.work.starved - PARAMS.starveDecay * dt);
  const starveAfter = world.patch?.demand === 'ferment' ? (scene.params?.fermentStarve ?? 55) : (scene.params?.starveAfter ?? 44);
  if (world.work.starved >= starveAfter) die(world);
}

// Protons return across the membrane without ATP synthase. DNP is a fast
// carrier; UCP1 is a slower channel. Each one that crosses is heat.
export function leakProtons(world, dt) {
  if (!world.leak || !scene.uncoupler) return;
  world.leakCredit += world.leak.rate * dt * (world.pace ?? 1);
  const at = scene.uncoupler[world.leak.kind];
  if (!at) return;
  while (world.leakCredit >= 1 && world.reservoir.length) {
    // DNP and UCP1 sit in the membrane all along the cloud: no reach.
    const index = nearestProton(world, at, Infinity);
    if (index < 0) break;
    world.leakCredit -= 1;
    const [entry] = world.reservoir.splice(index, 1);
    const from = protonPosition(world, entry);
    const dist = Math.hypot(at.x - from.x, (at.y + 48) - from.y);
    const dur = Math.min(1.3, Math.max(0.5, dist / 260));
    startTransit(world, entry.mol, [from, { x: at.x, y: at.y + 6 }, { x: at.x, y: at.y + 46 }], dur, 'bulk', {
      fade: 'out',
      via: world.leak.kind,
    });
    world.ledger.heat += world.leak.heat;
    world.events.push({ type: 'heat', mol: entry.mol, time: world.time });
  }
}

// Each scene has one ATP synthase; its rotor turns while it works.
export function updateRotor(world, dt) {
  const def = BOOKS.get(world.sceneId).synthases[0];
  if (!def) return;
  const station = world.stations[def.id];
  const turning = station.phase === 'work' || station.phase === 'load';
  const target = turning ? (2 * Math.PI) / 3 / (def.times.load + def.times.work + def.times.unload) : 0;
  world.rotor.omega += (target - world.rotor.omega) * (1 - Math.exp(-dt / 0.35));
  world.rotor.angle += world.rotor.omega * dt;
}
