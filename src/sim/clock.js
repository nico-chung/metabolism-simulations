// CAM's clock: the time of day and which phase lets a station work.

import { scene } from './book.js';

// CAM's clock (E10). The phase follows from world.time alone, so stepping
// back and forth needs nothing new. Each phase is a patch laid over the
// user's: night turns the light off and opens the stomata, day closes them.
// Darkness still darkens both phases, and a hot, dry day narrows the
// stomata only by day, when they are shut anyway.
export function clockTime(world, target = scene) {
  const clock = target?.clock;
  if (!clock) return null;
  return (((world.time + clock.start) % clock.period) + clock.period) % clock.period;
}

export function clockPhase(world, target = scene) {
  const t = clockTime(world, target);
  if (t == null) return null;
  return t < target.clock.dayLength ? 'day' : 'night';
}

export function applyClock(world, force = false) {
  const phase = clockPhase(world);
  if (phase === world.phase && !force) return;
  const changed = world.phase != null && phase !== world.phase;
  world.phase = phase;
  const base = world.basePatch ?? world.patch;
  const at = scene.clock.phases[phase];
  const off = { ...base.off };
  for (const id of at.off ?? []) off[id] = true;
  world.patch = {
    ...base,
    light: base.light && at.light !== false,
    stomata: (at.stomata ?? 1) * (phase === 'day' ? base.stomata : 1),
    off,
  };
  world.off = { ...off, ...base.absent };
  if (changed) world.events.push({ type: 'phase', phase, time: world.time });
}

export function phaseAllows(world, phase) {
  return !phase || world.phase === phase;
}
