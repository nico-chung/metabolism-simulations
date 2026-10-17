import { oxidationStates } from '../chem/oxidation.js';
import { compileMap } from '../chem/reactions/compile.js';
import { getSpecies } from '../chem/species/index.js';

// Species data never changes, so oxidation states and maps are computed once.
const statesCache = new Map();
const mapCache = new Map();

function statesOf(speciesId) {
  let states = statesCache.get(speciesId);
  if (!states) {
    states = oxidationStates(getSpecies(speciesId));
    statesCache.set(speciesId, states);
  }
  return states;
}

export function pairsOf(reaction) {
  const key = reaction.map;
  let cached = mapCache.get(key);
  if (!cached || cached.reaction !== reaction.id) {
    const { pairs, errors } = compileMap(reaction);
    if (errors.length) throw new Error(errors[0]);
    cached = { reaction: reaction.id, pairs };
    mapCache.set(key, cached);
  }
  return cached.pairs;
}

export function createMolecule(world, speciesId, source, extra = {}) {
  const species = getSpecies(speciesId);
  const id = `m${world.nextMol}`;
  world.nextMol += 1;
  const serial = source === 'feed' ? world.serial : null;
  if (source === 'feed') world.serial += 1;
  const states = statesOf(speciesId);
  const atoms = {};
  for (const [label, atom] of Object.entries(species.atoms)) {
    const persistent = `a${world.nextAtom}`;
    world.nextAtom += 1;
    atoms[label] = persistent;
    world.atoms[persistent] = {
      id: persistent,
      el: atom.el,
      feed: source === 'feed',
      origin: originText(species, label, atom, serial, source),
      journey: [{ species: speciesId, label, enzyme: null }],
      oxidation: states[label],
      history: [states[label]],
    };
  }
  const molecule = { id, species: speciesId, atoms, serial, feed: source === 'feed' };
  if (species.ecount) {
    molecule.electrons = [];
    for (let i = 0; i < species.ecount; i += 1) {
      const id = newElectron(world, extra.electronOrigin ?? `the cell's ${species.short}`, speciesId, null);
      // Electrons the cell starts with are a starting pool: not taggable (§5.5).
      if (source === 'pool') world.electrons[id].pool = true;
      molecule.electrons.push(id);
    }
  }
  world.molecules[id] = molecule;
  return molecule;
}

function newElectron(world, origin, speciesId, sourceAtom) {
  const id = `e${world.nextElectron}`;
  world.nextElectron += 1;
  world.electrons[id] = {
    id,
    origin,
    source: sourceAtom,
    journey: [{ species: speciesId, enzyme: null }],
    end: null,
  };
  return id;
}

// Applies a reaction's atom map and electron moves. Returns the products and
// a record of where each reactant atom went, for narration.
export function applyReaction(world, reaction, inputs) {
  const pairs = pairsOf(reaction);
  const products = {};
  for (const [role, speciesId] of Object.entries(reaction.out)) {
    const id = `m${world.nextMol}`;
    world.nextMol += 1;
    products[role] = { id, species: speciesId, atoms: {}, serial: null, feed: false };
    world.molecules[id] = products[role];
  }
  const moves = {};
  for (const [from, to] of pairs) {
    const [fromRole, fromLabel] = from.split('.');
    const [toRole, toLabel] = to.split('.');
    const persistent = inputs[fromRole].atoms[fromLabel];
    products[toRole].atoms[toLabel] = persistent;
    moves[persistent] = { from, to };
    if (world.atoms[persistent].feed) products[toRole].feed = true;
  }
  for (const [role, molecule] of Object.entries(products)) {
    const species = getSpecies(molecule.species);
    const states = statesOf(molecule.species);
    for (const [label, persistent] of Object.entries(molecule.atoms)) {
      const atom = world.atoms[persistent];
      const oxidation = states[label];
      atom.journey.push({ species: molecule.species, label, enzyme: reaction.enzyme, time: world.time });
      if (oxidation !== atom.oxidation) {
        atom.oxidation = oxidation;
        atom.history.push(oxidation);
      }
      // The cell's own carrier atoms cycle forever; keep only their recent past.
      if (!atom.feed && atom.journey.length > 12) atom.journey.splice(0, atom.journey.length - 12);
      if (!atom.feed && atom.history.length > 12) atom.history.splice(0, atom.history.length - 12);
    }
    if (Object.keys(molecule.atoms).length !== Object.keys(species.atoms).length) {
      throw new Error(`${reaction.id} ${role} is missing atoms`);
    }
    if (species.ecount) molecule.electrons = new Array(species.ecount).fill(null);
  }
  const electronMoves = moveElectrons(world, reaction, inputs, products);
  for (const molecule of Object.values(inputs)) delete world.molecules[molecule.id];
  return { products, moves, electrons: electronMoves };
}

function moveElectrons(world, reaction, inputs, products) {
  const record = { made: [], moved: [], ended: [], handed: [] };
  for (const [role, source] of Object.entries(reaction.enew ?? {})) {
    const [srcRole, srcLabel] = source.split('.');
    const sourceAtom = inputs[srcRole].atoms[srcLabel];
    const origin = electronOrigin(world, sourceAtom);
    const molecule = products[role];
    for (let i = 0; i < molecule.electrons.length; i += 1) {
      const id = newElectron(world, origin, molecule.species, sourceAtom);
      world.electrons[id].journey.push({ species: molecule.species, enzyme: reaction.enzyme });
      molecule.electrons[i] = id;
      record.made.push(id);
    }
  }
  for (const [from, to] of Object.entries(reaction.emap ?? {})) {
    const [fromRole, fromIndex] = from.split('.');
    const [toRole, toIndex] = to.split('.');
    const id = inputs[fromRole].electrons[Number(fromIndex)];
    const molecule = products[toRole];
    molecule.electrons[Number(toIndex)] = id;
    world.electrons[id].journey.push({ species: molecule.species, enzyme: reaction.enzyme });
    record.moved.push({ id, from, to });
  }
  for (const [from, role] of Object.entries(reaction.eend ?? {})) {
    const [fromRole, fromIndex] = from.split('.');
    const id = inputs[fromRole].electrons[Number(fromIndex)];
    world.electrons[id].end = { molecule: products[role].id, enzyme: reaction.enzyme, time: world.time };
    world.electrons[id].journey.push({ species: products[role].species, enzyme: reaction.enzyme });
    record.ended.push({ id, role });
    // Electrons that end in a bond to a hydrogen hand their tag to that
    // hydrogen (M6 plan E7): G3P dehydrogenase's hydride becomes C-1's H.
    const hand = reaction.ehand?.[from];
    if (hand) {
      const [toRole, toLabel] = hand.split('.');
      const atom = products[toRole].atoms[toLabel];
      record.handed.push({ id, atom });
      if (world.keep?.has(id) && world.atoms[atom]) world.atoms[atom].carrying = world.electrons[id].origin;
    }
    if (!world.keep?.has(id)) delete world.electrons[id];
  }
  return record;
}

// Electrons are named after the carbon they were taken from.
function electronOrigin(world, carbonId) {
  return world.atoms[carbonId]?.origin ?? 'the cell';
}

function originText(species, label, atom, serial, source) {
  const which = serial ? ` ${serial}` : '';
  if (source === 'feed') {
    if (atom.n) return `C-${atom.n} of ${species.name}${which}`;
    return `${atom.role} of ${species.short}${which}`;
  }
  return `${atom.role} of the cell's ${species.short}`;
}

export function findAtom(world, persistentId) {
  for (const molecule of Object.values(world.molecules)) {
    for (const [label, id] of Object.entries(molecule.atoms)) {
      if (id === persistentId) return { molecule, label };
    }
  }
  return null;
}

export function findElectron(world, electronId) {
  for (const molecule of Object.values(world.molecules)) {
    if (!molecule.electrons) continue;
    const index = molecule.electrons.indexOf(electronId);
    if (index >= 0) return { molecule, index };
  }
  return null;
}
