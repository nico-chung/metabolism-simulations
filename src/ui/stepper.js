import { STEP, step } from '../sim/engine.js';
import { blendShots, snapshot } from '../sim/snapshot.js';

// Step forward plays until the next reaction finishes and its products have
// left the station. Step back restores the checkpoint taken before that step,
// re-runs it headless, and plays the frames backwards. The engine is
// deterministic, so the replay is exact.

const HISTORY = 40;
const SUBSTRATE = new Set([
  'hexokinase', 'pgi', 'pfk', 'aldolase', 'tpi', 'gapdh', 'pgk', 'pgm', 'enolase', 'pk',
  'pdh', 'cs', 'aconitase', 'idh', 'akgdh', 'scs', 'complex2', 'fumarase', 'mdh',
  'ldh', 'pdc', 'adh',
]);

export function createStepper(api) {
  const history = [];
  let job = null;

  function keep() {
    return api.keep();
  }

  function checkpoint(world) {
    const last = history[history.length - 1];
    if (last && Math.abs(last.time - world.time) < 1e-9) return;
    history.push(structuredClone(world));
    if (history.length > HISTORY) history.shift();
    api.onHistory(history.length > 0);
  }

  // Does this step's event involve what the student is watching?
  function involves(event, focus) {
    if (event.type !== 'reaction') return false;
    if (!focus) return SUBSTRATE.has(event.station);
    if (focus.persistentId) return event.atoms.includes(focus.persistentId) || Object.prototype.hasOwnProperty.call(event.moves ?? {}, focus.persistentId);
    if (focus.electronId) {
      const electrons = event.electrons;
      return electrons?.moved.some((entry) => entry.id === focus.electronId)
        || electrons?.ended.some((entry) => entry.id === focus.electronId)
        || electrons?.made.includes(focus.electronId);
    }
    return false;
  }

  function startForward(world, focus, speed) {
    checkpoint(world);
    job = {
      kind: 'forward',
      focus,
      rate: Math.max(1, speed),
      speed: Math.max(1, speed),
      real: 0,
      sim: 0,
      settle: null,
      acc: 0,
      prev: snapshot(world),
      cur: snapshot(world),
    };
  }

  function runForward(world, dt) {
    job.real += dt;
    if (job.real > 1.2) job.rate = Math.min(32, job.rate * (1 + dt * 2.5));
    job.acc += dt * job.rate;
    let steps = 0;
    while (job.acc >= STEP && steps < 2000) {
      if (job.acc - STEP < STEP) job.prev = snapshot(world);
      step(world, STEP, keep());
      api.onEvents(world);
      job.acc -= STEP;
      job.sim += STEP;
      steps += 1;
      if (!job.settle) {
        const hit = world.events.find((event) => involves(event, job.focus));
        if (hit) job.settle = hit.station;
      }
      if (job.settle && world.stations[job.settle].phase === 'idle') {
        job.cur = snapshot(world);
        return true;
      }
      if (job.sim > 180 || api.paused()) {
        job.cur = snapshot(world);
        return true;
      }
    }
    if (steps) job.cur = snapshot(world);
    return false;
  }

  function finishForward(world) {
    while (true) {
      step(world, STEP, keep());
      api.onEvents(world);
      job.sim += STEP;
      if (!job.settle) {
        const hit = world.events.find((event) => involves(event, job.focus));
        if (hit) job.settle = hit.station;
      }
      if (job.settle && world.stations[job.settle].phase === 'idle') break;
      if (job.sim > 180 || api.paused()) break;
    }
  }

  function startBack(world, speed) {
    while (history.length && history[history.length - 1].time >= world.time - 1e-9) history.pop();
    if (!history.length) {
      api.onHistory(false);
      return false;
    }
    const from = history.pop();
    api.onHistory(history.length > 0);
    const replay = structuredClone(from);
    const frames = [snapshot(replay)];
    const span = world.time - from.time;
    const every = Math.max(1, Math.floor(span / STEP / 240));
    let count = 0;
    while (replay.time < world.time - 1e-9) {
      step(replay, STEP, keep());
      count += 1;
      if (count % every === 0) frames.push(snapshot(replay));
    }
    frames.push(snapshot(replay));
    const duration = Math.min(2.5, Math.max(0.35, span / Math.max(1, speed)));
    job = { kind: 'back', frames, t: 0, duration, target: from };
    return true;
  }

  return {
    get active() {
      return job != null;
    },
    get kind() {
      return job?.kind ?? null;
    },
    canBack() {
      return history.length > 0;
    },
    clear() {
      history.length = 0;
      job = null;
      api.onHistory(false);
    },
    checkpoint,
    forward(world, focus, speed) {
      if (job?.kind === 'forward') finishForward(world);
      if (job?.kind === 'back') {
        api.setWorld(job.target);
        world = job.target;
      }
      job = null;
      startForward(world, focus, speed);
      return world;
    },
    back(world, speed) {
      let current = world;
      if (job?.kind === 'forward') finishForward(world);
      if (job?.kind === 'back') {
        api.setWorld(job.target);
        current = job.target;
      }
      job = null;
      return startBack(current, speed);
    },
    // Advances the current step by one frame and returns the picture to draw.
    tick(world, dt) {
      if (!job) return null;
      if (job.kind === 'forward') {
        const done = runForward(world, dt);
        const shot = blendShots(job.prev, job.cur, Math.min(1, job.acc / STEP));
        if (done) {
          job = null;
          api.onDone();
          return snapshot(world);
        }
        return shot;
      }
      job.t += dt;
      const f = Math.min(1, job.t / job.duration);
      const eased = f < 0.5 ? 2 * f * f : 1 - ((-2 * f + 2) ** 2) / 2;
      const position = (1 - eased) * (job.frames.length - 1);
      const i = Math.floor(position);
      const shot = blendShots(job.frames[i], job.frames[Math.min(job.frames.length - 1, i + 1)], position - i);
      if (f >= 1) {
        api.setWorld(job.target);
        job = null;
        api.onDone();
        return snapshot(api.world());
      }
      return shot;
    },
  };
}
