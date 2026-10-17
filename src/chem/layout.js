const RAD = Math.PI / 180;

export function at(x, y) {
  return { x: round(x), y: round(y) };
}

export function polar(origin, degrees) {
  return at(
    origin.x + Math.cos(degrees * RAD),
    origin.y + Math.sin(degrees * RAD),
  );
}

export function degrees(from, to) {
  return Math.atan2(to.y - from.y, to.x - from.x) / RAD;
}

function round(value) {
  return Math.round(value * 1e6) / 1e6;
}

// Horizontal zigzag, C-1 at the origin. Bond angles alternate 30° above
// and below the row. World y grows downward, so a negative angle is up.
export function zigzag(count) {
  const carbons = [at(0, 0)];
  for (let i = 1; i < count; i += 1) {
    carbons.push(polar(carbons[i - 1], i % 2 ? -30 : 30));
  }
  return carbons;
}

export function localBounds(species) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const atom of Object.values(species.atoms)) {
    minX = Math.min(minX, atom.x);
    minY = Math.min(minY, atom.y);
    maxX = Math.max(maxX, atom.x);
    maxY = Math.max(maxY, atom.y);
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

export function graph() {
  const atoms = {};
  const bonds = [];
  return {
    atoms,
    bonds,
    put(id, element, point, extra = {}) {
      atoms[id] = { el: element, x: point.x, y: point.y, ...extra };
      return atoms[id];
    },
    link(a, b, order = 1) {
      bonds.push([a, b, order]);
    },
  };
}

// Phosphate continuing outward through `anchor`, away from `parent`.
// The anchor stays the bridging oxygen. Three oxygens land on the phosphorus:
// a double-bonded oxygen, and two O-.
export function addPhosphate(g, anchorId, parentId, ids) {
  const anchor = g.atoms[anchorId];
  const parent = g.atoms[parentId];
  const angle = degrees(parent, anchor);
  const phosphorus = polar(anchor, angle);
  g.put(ids.p, 'P', phosphorus, { role: 'phosphorus' });
  g.put(ids.oxo, 'O', polar(phosphorus, angle + 90), { role: 'phosphoryl oxygen' });
  g.put(ids.minus, 'O', polar(phosphorus, angle - 90), { charge: -1, role: 'phosphoryl oxygen' });
  g.put(ids.end, 'O', polar(phosphorus, angle), { charge: -1, role: 'phosphoryl oxygen' });
  g.link(anchorId, ids.p, 1);
  g.link(ids.p, ids.oxo, 2);
  g.link(ids.p, ids.minus, 1);
  g.link(ids.p, ids.end, 1);
}

export function addHydroxyl(g, oxygenId, carbonId, hydrogenId, tilt, role) {
  const oxygen = g.atoms[oxygenId];
  const carbon = g.atoms[carbonId];
  const angle = degrees(carbon, oxygen);
  g.put(hydrogenId, 'H', polar(oxygen, angle + tilt), { role });
  g.link(oxygenId, hydrogenId, 1);
}
