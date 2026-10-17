// Where the camera lands when the user switches tabs (PLAN §5.8, M8.5): on
// the counterpart of what they were looking at, at the same zoom relative to
// each scene's Fit. Pure, so it runs under Node.

import { FIT_PAD, clampCenter, fitCamera, zoomLimits } from '../render/camera.js';
import { PAIRS, RINGS, tabOf } from '../scenes/counterparts.js';
import { pointAt } from '../sim/path.js';

const FIT_TOLERANCE = 0.01;

// The centre of a path, from its bounding box.
function pathCentre(path) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const point = {};
  for (let i = 0; i <= 64; i += 1) {
    pointAt(path, (path.length * i) / 64, point);
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

// The scene's elements that have a counterpart, each as { id, x, y }: the
// paired stations, zones and loops, and each ring station standing for its
// ring.
export function counterpartPoints(scene) {
  const side = tabOf(scene.id) === 'respiration' ? 0 : 1;
  const points = [];
  for (const pair of PAIRS) {
    const id = pair[side];
    const station = scene.stations.find((def) => def.id === id);
    const zone = scene.zones?.find((entry) => entry.id === id);
    const loop = scene.loops?.[id];
    if (station) points.push({ id, x: station.x, y: station.y });
    else if (zone) points.push({ id, ...pathCentre(zone.path) });
    else if (loop) points.push({ id, ...pathCentre(loop.path) });
  }
  for (const [ring, ids] of Object.entries(RINGS)) {
    if (!PAIRS.some((pair) => pair[side] === ring)) continue;
    for (const def of scene.stations) {
      if (ids.includes(def.id)) points.push({ id: ring, x: def.x, y: def.y });
    }
  }
  return points;
}

// Within 1% of Fit's zoom and two screen pixels of its centre.
function atFit(camera, fit) {
  return Math.abs(camera.zoom / fit.zoom - 1) <= FIT_TOLERANCE
    && Math.hypot(camera.x - fit.x, camera.y - fit.y) * fit.zoom <= 2;
}

// The camera for `toScene` after switching from `fromScene`. Fit goes to Fit,
// as does a view with no counterpart element on screen. Otherwise the element
// nearest the view's centre whose pair exists in `toScene` (b₆f has none in
// the bacterium) sets the target.
export function counterpartView(fromScene, toScene, camera, viewport, pad = FIT_PAD) {
  const fromFit = fitCamera(viewport, fromScene.bounds, pad);
  const toFit = fitCamera(viewport, toScene.bounds, pad);
  if (atFit(camera, fromFit)) return toFit;
  const halfW = viewport.width / 2 / camera.zoom;
  const halfH = viewport.height / 2 / camera.zoom;
  const onScreen = counterpartPoints(fromScene)
    .filter((point) => Math.abs(point.x - camera.x) <= halfW && Math.abs(point.y - camera.y) <= halfH)
    .sort((a, b) => Math.hypot(a.x - camera.x, a.y - camera.y) - Math.hypot(b.x - camera.x, b.y - camera.y));
  if (onScreen.length === 0) return toFit;
  const side = tabOf(fromScene.id) === 'respiration' ? 0 : 1;
  const targets = counterpartPoints(toScene);
  for (const point of onScreen) {
    const other = PAIRS.find((pair) => pair[side] === point.id)?.[1 - side];
    // A ring lands on its ring's centre, not on one of its stations.
    const target = targets.find((entry) => entry.id === other && !RINGS[other])
      ?? ringCentre(toScene, other);
    if (!target) continue;
    const { min, max } = zoomLimits(viewport, toScene.bounds, pad);
    const zoom = Math.min(max, Math.max(min, toFit.zoom * (camera.zoom / fromFit.zoom)));
    return clampCenter({ x: target.x, y: target.y, zoom }, toScene.bounds);
  }
  return toFit;
}

function ringCentre(scene, id) {
  const zone = scene.zones?.find((entry) => entry.id === id);
  return zone ? pathCentre(zone.path) : null;
}
