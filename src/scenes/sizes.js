import { localBounds } from '../chem/layout.js';
import { getSpecies } from '../chem/species/index.js';

// Bond length in world units. Small enough that a dozen sugars fit along
// a row of glycolysis, and a citrate still sits inside a matrix enzyme.
export const MOLECULE_SCALE = 8;

const boundsCache = new Map();

export function speciesBounds(speciesId) {
  let box = boundsCache.get(speciesId);
  if (!box) {
    const species = getSpecies(speciesId);
    box = Object.keys(species.atoms).length
      ? localBounds(species)
      : { minX: 0, minY: 0, maxX: 0, maxY: 0, w: 0, h: 0 };
    boundsCache.set(speciesId, box);
  }
  return box;
}

// Half the drawn size of a molecule, including atom radii and the carrier
// pill, in world units.
export function halfSize(speciesId) {
  const box = speciesBounds(speciesId);
  return {
    x: (box.w * MOLECULE_SCALE) / 2 + 6,
    y: (box.h * MOLECULE_SCALE) / 2 + 5,
  };
}

// How far a molecule reaches along a direction of travel.
export function reach(speciesId, dx, dy) {
  const half = halfSize(speciesId);
  return Math.abs(dx) * half.x + Math.abs(dy) * half.y;
}

export function enzymeBox(speciesIds) {
  let w = 0;
  let h = 0;
  for (const id of speciesIds) {
    const box = speciesBounds(id);
    w = Math.max(w, box.w);
    h = Math.max(h, box.h);
  }
  const pad = 18;
  return {
    w: Math.round(w * MOLECULE_SCALE + pad * 2),
    h: Math.round(h * MOLECULE_SCALE + pad * 2),
  };
}
