// The compiled scene the engine reads. Every module imports these bindings,
// and only activate() assigns them, so all of them see the active world's book.

import { humanScene } from '../scenes/human.js';

// One compiled book per scene. step() and snapshot() activate the world's
// book, so a human cell and a yeast cell can both exist and the geometry
// they draw is the one they were built with.
export const BOOKS = new Map();
export let scene = null;
export let BELTS = null;
export let LOOPS = null;
export let DEFS = null;
export let DRIFTS = null;
export let RESERVOIR = null;
export let TAPS = null;

function compileBook(next) {
  const belts = Object.fromEntries(next.belts.map((belt) => [belt.id, belt]));
  const loops = next.loops;
  const defs = Object.fromEntries(next.stations.map((station) => [station.id, station]));
  const taps = {};
  for (const id of Object.keys(loops)) taps[id] = [];
  for (const def of next.stations) {
    for (const [name, dock] of Object.entries(def.docks ?? {})) {
      for (const [loopId, s] of Object.entries(dock.taps ?? {})) {
        taps[loopId].push({ station: def.id, dock: name, s, species: dock.species });
      }
    }
  }
  return {
    scene: next,
    belts,
    loops,
    defs,
    drifts: next.drifts,
    reservoir: next.reservoir,
    taps,
    synthases: next.stations.filter((def) => def.kind === 'synthase'),
  };
}

export function ensureBook(next) {
  if (!BOOKS.has(next.id)) BOOKS.set(next.id, compileBook(next));
  return BOOKS.get(next.id);
}

export let ACTIVE = null;

export function activate(world) {
  if (world.motors) ACTIVE = world;
  const book = BOOKS.get(world.sceneId);
  scene = book.scene;
  BELTS = book.belts;
  LOOPS = book.loops;
  DEFS = book.defs;
  DRIFTS = book.drifts;
  RESERVOIR = book.reservoir;
  TAPS = book.taps;
}

ensureBook(humanScene);
activate({ sceneId: humanScene.id });

export function bindWorld(world) {
  activate(world);
}

export function currentScene() {
  return scene;
}
