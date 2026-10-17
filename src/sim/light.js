// Light: photons fly from the sun to the stations that catch them, and glow there.

import { DEFS, scene } from './book.js';
import { nextRand } from './engine.js';

// Light is the only thing pushed into a leaf (D9). Each photosystem receives
// photons at a set flux, jittered by the seeded generator so they do not
// tick like a clock. A photon is not an atom: it has an id only so it can be
// drawn, and it cannot be tagged.
const PHOTON_SPEED = 600;
const FLASH_TIME = 0.25;
// Every photon that reaches an antenna, used or not, makes its photosystem
// glow for a second (M6.5 P2).
export const GLOW_TIME = 1;

export function emitPhotons(world, dt) {
  world.photons ??= [];
  world.lightClock ??= {};
  if (world.patch?.light === false) {
    // In the dark a photosystem keeps no light: an excitation lasts
    // nanoseconds, so what was held is lost as heat.
    for (const def of scene.stations) if (def.lightCap) world.stations[def.id].light = 0;
    return;
  }
  if (world.dead) return;
  const pace = world.pace ?? 1;
  for (const [target, light] of Object.entries(scene.light)) {
    let clock = world.lightClock[target] ?? (nextRand(world) % 1000) / 1000 / light.flux;
    clock -= dt * pace;
    while (clock <= 0) {
      const jitter = (nextRand(world) % 1000) / 1000;
      const spread = ((nextRand(world) % 1000) / 1000 - 0.5) * (light.spread ?? 80);
      const from = { x: light.from.x + spread, y: light.from.y };
      const to = { x: light.antenna.x + spread * 0.15, y: light.antenna.y };
      const dur = Math.hypot(to.x - from.x, to.y - from.y) / PHOTON_SPEED;
      world.photons.push({ id: `p${world.nextPhoton = (world.nextPhoton ?? 0) + 1}`, target, from, to, t: 0, dur });
      clock += (0.55 + 0.9 * jitter) / light.flux;
    }
    world.lightClock[target] = clock;
  }
}

export function advancePhotons(world, dt) {
  const pace = world.pace ?? 1;
  world.flashes = (world.flashes ?? []).filter((flash) => {
    flash.t += dt * pace;
    return flash.t < FLASH_TIME;
  });
  world.glows = (world.glows ?? []).filter((glow) => {
    glow.t += dt * pace;
    return glow.t < GLOW_TIME;
  });
  const keep = [];
  for (const photon of world.photons ?? []) {
    photon.t += dt * pace;
    if (photon.t < photon.dur) {
      keep.push(photon);
      continue;
    }
    const def = DEFS[photon.target];
    const station = world.stations[photon.target];
    const cap = def?.lightCap ?? 2;
    world.glows.push({ target: photon.target, t: 0 });
    // A photosystem that is blocked, absent, or already holding all the
    // excitation it can use gives the photon off as heat and fluorescence.
    if (!station || world.off?.[photon.target] || station.light >= cap) {
      world.flashes.push({ id: photon.id, x: photon.to.x, y: photon.to.y, t: 0, target: photon.target });
      if (world.ledger.quenched != null) world.ledger.quenched += 1;
      world.events.push({ type: 'quench', station: photon.target, time: world.time });
      continue;
    }
    station.light += 1;
    world.events.push({ type: 'photon', station: photon.target, time: world.time });
  }
  world.photons = keep;
}
