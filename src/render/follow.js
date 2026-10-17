// The follow camera is drone footage from directly above: it keeps the
// student's zoom, follows a critically damped spring, and looks a little
// ahead along the particle's smoothed velocity. The look-ahead fades slowly
// while the particle sits still in a station, so docking never jerks the view.

const POSITION_RATE = 5.5;
const VELOCITY_TIME = 0.6;
const LOOK_TIME = 0.55;

export function createFollow() {
  return { vx: 0, vy: 0, cvx: 0, cvy: 0, last: null };
}

export function followCamera(state, camera, viewport, point, dt, reduceMotion) {
  if (!point) return camera;
  if (dt <= 0 || !state.last) {
    state.last = { x: point.x, y: point.y };
    return reduceMotion ? { ...camera, x: point.x, y: point.y } : camera;
  }
  const rawVx = (point.x - state.last.x) / dt;
  const rawVy = (point.y - state.last.y) / dt;
  state.last = { x: point.x, y: point.y };
  const jump = Math.hypot(rawVx, rawVy) > 4000;
  const k = 1 - Math.exp(-dt / VELOCITY_TIME);
  if (!jump) {
    state.vx += (rawVx - state.vx) * k;
    state.vy += (rawVy - state.vy) * k;
  }
  const reachLimit = (0.16 * Math.min(viewport.width, viewport.height)) / camera.zoom;
  let lookX = state.vx * LOOK_TIME;
  let lookY = state.vy * LOOK_TIME;
  const look = Math.hypot(lookX, lookY);
  if (look > reachLimit) {
    lookX *= reachLimit / look;
    lookY *= reachLimit / look;
  }
  const targetX = point.x + lookX;
  const targetY = point.y + lookY;
  if (reduceMotion) return { ...camera, x: targetX, y: targetY };
  // Critically damped spring toward the target.
  const w = POSITION_RATE;
  const ax = w * w * (targetX - camera.x) - 2 * w * state.cvx;
  const ay = w * w * (targetY - camera.y) - 2 * w * state.cvy;
  state.cvx += ax * dt;
  state.cvy += ay * dt;
  return { ...camera, x: camera.x + state.cvx * dt, y: camera.y + state.cvy * dt };
}
