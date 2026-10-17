import { ELEMENTS } from '../chem/elements.js';
import { getSpecies } from '../chem/species/index.js';
import { worldToScreen } from './camera.js';

// Carbon radius as a fraction of one bond. Ball-and-stick, not space-filling.
const CARBON_RADIUS = 0.3;

// Screen length of one bond, in CSS pixels, below which the drawing simplifies.
const FAR_BOND = 9;
const MID_BOND = 16;

export function atomRadius(atom, scale) {
  return CARBON_RADIUS * ELEMENTS[atom.el].radius * scale;
}

export function atomWorld(atom, pose) {
  return {
    x: pose.x + atom.x * pose.scale,
    y: pose.y + atom.y * pose.scale,
  };
}

function bondPixels(scale, zoom) {
  return scale * zoom;
}

// Molecule detail follows the on-screen bond length, so a large tray molecule
// can be ball-and-stick while the cell around it is still the fitted view.
export function moleculeLod(scale, zoom) {
  const bond = bondPixels(scale, zoom);
  if (bond < FAR_BOND) return 'far';
  if (bond < MID_BOND) return 'mid';
  return 'near';
}

export function atomDrawn(atom, lod) {
  if (lod === 'near') return true;
  if (lod === 'mid') return atom.el !== 'H';
  return false;
}

export function hitAtom(species, pose, world, zoom) {
  const lod = moleculeLod(pose.scale, zoom);
  if (lod === 'far') return null;
  let best = null;
  let bestDist = Infinity;
  for (const [id, atom] of Object.entries(species.atoms)) {
    if (!atomDrawn(atom, lod)) continue;
    const at = atomWorld(atom, pose);
    const dist = Math.hypot(world.x - at.x, world.y - at.y);
    const screen = dist * zoom;
    const limit = Math.max(atomRadius(atom, pose.scale) * zoom + 6, 11);
    if (screen <= limit && dist < bestDist) {
      best = id;
      bestDist = dist;
    }
  }
  return best;
}

// Tray atoms, including feed still fading into its tray, and already-tagged
// atoms can be clicked. `shot` is the snapshot
// as drawn (with the intro's arrival applied).
export function hitMolecule(shot, point, zoom, world, tags) {
  for (let i = shot.items.length - 1; i >= 0; i -= 1) {
    const item = shot.items[i];
    const species = item.speciesData ?? getSpecies(item.species);
    const atomId = hitAtom(species, item, point, zoom);
    if (!atomId) continue;
    const persistentId = item.atomIds[atomId];
    const atom = world.atoms[persistentId];
    if (!atom?.feed) continue;
    const tagged = tags.some((tag) => tag.persistentId === persistentId);
    if (!tagged && item.kind !== 'tray' && item.kind !== 'arrive') continue;
    return { instanceId: item.id, atomId, persistentId };
  }
  return null;
}

// Electron dots with an identity can be clicked anywhere, but only right on
// the dot and only zoomed in, where a carrier is drawn larger than its dot:
// otherwise a click on the carrier opens the carrier's card (M8.12a).
const ELECTRON_HIT_ZOOM = 1.5;
export function hitParticle(shot, world, camera, viewport, screen) {
  if (camera.zoom < ELECTRON_HIT_ZOOM) return null;
  let best = null;
  let bestD = 5;
  for (const dot of shot.electrons) {
    if (!dot.id || world.electrons[dot.id]?.pool) continue;
    const at = worldToScreen(camera, viewport, dot.x, dot.y);
    const d = Math.hypot(at.x - screen.x, at.y - screen.y);
    if (d < bestD) {
      bestD = d;
      best = { electronId: dot.id };
    }
  }
  return best;
}

export function hitStation(stations, point) {
  for (const def of stations) {
    const box = stationBox(def);
    if (Math.abs(point.x - box.x) > box.w / 2) continue;
    if (Math.abs(point.y - box.y) > box.h / 2) continue;
    return def;
  }
  return null;
}

export function stationBox(def) {
  if (def.kind !== 'synthase') return def;
  const top = def.rotor.y - def.rotor.h / 2;
  const bottom = def.knob.y + def.knob.r;
  const left = Math.min(def.rotor.x - def.rotor.w / 2, def.knob.x - def.knob.r);
  const right = Math.max(def.stator.x + def.stator.w / 2, def.knob.x + def.knob.r);
  return { x: (left + right) / 2, y: (top + bottom) / 2, w: right - left, h: bottom - top };
}
