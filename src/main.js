import { biologicalWait, createJourney, journeySummary, observe, readingTime, waitingText } from './narration/journey.js';
import { humanScene } from './scenes/human.js';
import { yeastScene } from './scenes/yeast.js';
import { bacteriumScene } from './scenes/bacterium.js';
import { c3Scene } from './scenes/c3.js';
import { c4Scene } from './scenes/c4.js';
import { camScene } from './scenes/cam.js';
import { tabOf } from './scenes/counterparts.js';
import { MOLECULE_SCALE, speciesBounds } from './scenes/sizes.js';
import {
  FIT_PAD,
  clampCenter,
  easeInOut,
  fitCamera,
  panBy,
  screenToWorld,
  worldToScreen,
  zoomAt,
  zoomLimits,
} from './render/camera.js';
import { createFollow, followCamera } from './render/follow.js';
import { hitMolecule, hitParticle, hitStation } from './render/hit.js';
import { drawStage } from './render/stage.js';
import { readTokens } from './render/tokens.js';
import { conditionCopy } from './sim/conditions.js';
import { STEP, createWorld, setPatch, step } from './sim/engine.js';
import { atomPoint, blendShots, electronPoint, snapshot, withArrival } from './sim/snapshot.js';
import { bindBeat } from './ui/beat.js';
import { bindRailGrip } from './ui/grip.js';
import { pathwayTitle } from './ui/copy.js';
import { ledgerOverflow, ledgerValues, renderLedger } from './ui/ledger.js';
import { createInspector } from './ui/inspector.js';
import { renderNotes } from './ui/notes.js';
import { counterpartView } from './ui/counterparts.js';
import { bindRail } from './ui/rail.js';
import { createStepper } from './ui/stepper.js';
import { hitPart, hitSite } from './ui/parts.js';
import { replaceTag, tagKey, toggleTag } from './ui/tags.js';
import { bindTransport } from './ui/transport.js';
import { createTour, shouldWelcome } from './ui/tour.js';
import { VERSION } from './version.js';

const FIT_MS = 550;
const TOUR_FLIGHT = { ms: 1800 };
const CLICK_PX = 4;
const CHECKPOINT_EVERY = 3;
const PROMPT = 'Click an atom to tag it, then press play.';
const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const tokens = readTokens();
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
// Narration is one setting, shown on both tabs.
const narrationBox = document.getElementById('narration');
const notesBody = document.getElementById('notes-body');

let viewport = { width: 1, height: 1, dpr: 1 };
let camera = { x: 0, y: 0, zoom: 1 };
let userMoved = false;
let animating = 0;
let tags = [];
let focus = null;
let hover = null;
let stationFocus = null;
let partFocus = null;
let pinned = null;
let root = null;
let world = createWorld(1);
let worldKey = 'human';
renderNotes(notesBody, worldKey);
let deathShown = false;
let playing = false;
let speedIndex = 2;
let acc = 0;
let slow = 1;
let prevShot = null;
let curShot = snapshot(world);
let shown = curShot;
let loopId = 0;
let lastFrame = 0;
let lastCheckpoint = 0;
let introAt = performance.now();
let follow = createFollow();
let journey = createJourney();
const pointers = new Map();
let pinch = null;
let hadScene = true;
let shownTab = 'respiration';
let noteTimer = 0;
// Each tab keeps its own world, paused while the other tab is shown (M8.5).
const kept = { respiration: null, photosynthesis: null };

const inspector = createInspector({
  canvas,
  tokens,
  get world() {
    return world;
  },
  get shown() {
    return shown;
  },
  get stationFocus() {
    return stationFocus;
  },
  get partFocus() {
    return partFocus;
  },
  scene: activeScene,
  focusTag,
  state: () => rail.read(),
});

measure();
camera = fitCamera(viewport, humanScene.bounds, FIT_PAD);

const transport = bindTransport({
  onPlay: () => (tour.last ? tour.play() : togglePlay()),
  onBack: stepBack,
  onStep: stepForward,
  onSpeed: changeSpeed,
  onFeed: toggleFeed,
  onFit: () => {
    releasePin();
    fit(true);
  },
  onReset: () => resetWorld(null),
  onFollow: togglePin,
});
transport.setSpeed(transport.speeds[speedIndex]);
transport.setFeed(world.feed);
transport.setPlaying(false);

const stepper = createStepper({
  keep: keepIds,
  onEvents: () => afterStep(),
  paused: () => beat.showing || beat.endShowing,
  onHistory: (on) => transport.setCanBack(on),
  onDone: () => {
    prevShot = null;
    curShot = snapshot(world);
    inspector.sync();
  },
  setWorld: (next) => {
    world = next;
  },
  world: () => world,
});

const beat = bindBeat({
  onContinue: (done, choice) => {
    if (done.split && choice === 'electrons') followElectrons(done.split);
    inspector.sync();
    ensureLoop();
  },
});

const rail = bindRail((state) => {
  const scene = sceneFor(state);
  const hasScene = scene != null;
  const key = scene ? scene.id : '';
  const switched = state.tab !== shownTab;
  const fromScene = hadScene ? SCENES[worldKey] : null;
  if (switched) {
    leaveTab();
    shownTab = state.tab;
    if (scene) enterTab(scene, state);
  }
  if (scene && key !== worldKey) {
    worldKey = key;
    rebuildWorld(state, true);
  } else if (scene && !world.dead && (state.mode !== world.mode || state.condition !== world.condition)) {
    // Modes and conditions patch the running cell (§16 D1): close the O₂
    // supply and watch the mitochondrion wind down. History from before the
    // patch would replay under the wrong one, so it goes.
    setPatch(world, state.mode, state.condition);
    stepper.clear();
    transport.setCanBack(false);
    still = null;
    prevShot = null;
    curShot = snapshot(world);
    shown = curShot;
  }
  if (!hasScene) {
    pause();
    clearTab();
  }
  transport.setEnabled(hasScene);
  inspector.refresh();
  if (switched && scene) {
    // Fly to the counterpart of what was in view (PLAN §5.8).
    flyTo(fromScene ? counterpartView(fromScene, scene, camera, viewport, FIT_PAD) : fitted(), true);
  } else if (hadScene && !hasScene) fit(true);
  else draw();
  hadScene = hasScene;
});
transport.setEnabled(sceneFor(rail.read()) != null);

const resize = new ResizeObserver(() => {
  measure();
  if (!userMoved) camera = fitted();
  else camera = clampCenter({ ...camera, zoom: clampZoom(camera.zoom) }, activeBounds());
  draw();
});
resize.observe(canvas.parentElement);
bindRailGrip(document.querySelector('.app'), document.getElementById('rail-grip'));

document.getElementById('version').textContent = `v${VERSION}`;

let storage = null;
try {
  storage = window.localStorage;
} catch {
  // Blocked storage: the welcome shows on every visit.
}
const tour = createTour({
  storage,
  tab: () => rail.read().tab,
  stage: () => canvas.getBoundingClientRect(),
  feed: feedRect,
  spot: tourSpot,
  enter: (step) => {
    if (step.target === 'feed') flyTo(feedCamera(), true, TOUR_FLIGHT);
  },
  next: (step) => {
    if (step.target === 'feed' && !tags.length) tagFeed();
  },
  play: () => {
    const tag = focusTag();
    if (tag && pinned !== tagKey(tag)) togglePin();
    if (!playing) togglePlay();
  },
});
document.getElementById('replay').addEventListener('click', replayTour);

canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  cancelAnimation();
  const point = pointOf(event);
  pointers.set(event.pointerId, { ...point, ox: point.x, oy: point.y, moved: false });
  try {
    canvas.setPointerCapture(event.pointerId);
  } catch {
    // A pointer that is already gone cannot be captured.
  }
  if (pointers.size >= 2) beginPinch();
});

canvas.addEventListener('pointermove', (event) => {
  const point = pointOf(event);
  if (!pointers.has(event.pointerId)) {
    if (event.buttons === 0) updateHover(point);
    return;
  }
  const previous = pointers.get(event.pointerId);
  const travel = Math.hypot(point.x - previous.ox, point.y - previous.oy);
  if (!previous.moved && travel < CLICK_PX && pointers.size === 1) {
    pointers.set(event.pointerId, { ...previous, x: point.x, y: point.y });
    return;
  }
  previous.moved = true;
  pointers.set(event.pointerId, { ...previous, x: point.x, y: point.y, moved: true });
  if (pointers.size === 1) {
    if (pinned) {
      releasePin();
      inspector.sync();
    }
    userMoved = true;
    const fromX = previous.moved ? previous.x : previous.ox;
    const fromY = previous.moved ? previous.y : previous.oy;
    camera = clampCenter(panBy(camera, point.x - fromX, point.y - fromY), activeBounds());
    hover = null;
    canvas.style.cursor = 'grabbing';
    draw();
    return;
  }
  if (!pinch) return;
  const next = pinchInfo();
  if (pinch.distance > 0 && next.distance > 0) {
    userMoved = true;
    const about = pinnedScreen() ?? { x: next.midX, y: next.midY };
    camera = clampCenter(zoomAt(
      camera,
      viewport,
      about.x,
      about.y,
      camera.zoom * (next.distance / pinch.distance),
      limits(),
    ), activeBounds());
    draw();
  }
  pinch = next;
});

canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('pointerleave', () => {
  if (pointers.size > 0) return;
  if (!hover) return;
  hover = null;
  canvas.style.cursor = '';
  draw();
});

canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  cancelAnimation();
  userMoved = true;
  const point = pointOf(event);
  const about = pinnedScreen() ?? point;
  let dy = event.deltaY;
  if (event.deltaMode === 1) dy *= 16;
  if (event.deltaMode === 2) dy *= viewport.height;
  const exponent = Math.min(0.4, Math.max(-0.4, -dy * 0.0015));
  camera = clampCenter(
    zoomAt(camera, viewport, about.x, about.y, camera.zoom * Math.exp(exponent), limits()),
    activeBounds(),
  );
  draw();
  updateHover(point);
}, { passive: false });

const KEYS = {
  ArrowRight: stepForward,
  ArrowLeft: stepBack,
  '-': () => changeSpeed(-1),
  _: () => changeSpeed(-1),
  '+': () => changeSpeed(1),
  '=': () => changeSpeed(1),
  p: togglePin,
  P: togglePin,
};

window.addEventListener('keydown', (event) => {
  // The rail's grip uses Left and Right to resize the rail (v1.1: they also
  // stepped the simulation).
  if (event.target.closest?.('input, textarea, select, summary, [role="tablist"], [role="separator"]')) return;
  // The welcome and the tour keep the keys from the simulation behind them.
  if (tour.open) {
    if (event.key === 'Escape') tour.close();
    if (event.key === ' ' || event.key.startsWith('Arrow') || event.key === 'Escape') event.preventDefault();
    return;
  }
  // A focused button keeps Space for itself; the other keys still work.
  const onButton = event.target.tagName === 'BUTTON';
  if (event.key === 'Escape') {
    if (beat.showing) {
      event.preventDefault();
      beat.continueNow();
      return;
    }
    if (tags.length === 0 && !pinned) return;
    event.preventDefault();
    tags = [];
    focus = null;
    root = null;
    stationFocus = null;
    partFocus = null;
    releasePin();
    inspector.sync();
    draw();
    return;
  }
  if (!sceneFor(rail.read())) return;
  if (event.key === ' ' && !onButton) {
    event.preventDefault();
    if (beat.showing) beat.continueNow();
    else if (!beat.endShowing) togglePlay();
    return;
  }
  const run = KEYS[event.key];
  if (!run) return;
  event.preventDefault();
  run();
});

motionQuery.addEventListener('change', () => {
  ensureLoop();
});

inspector.sync();
ensureLoop();
if (shouldWelcome(storage, window.location.search)) tour.start();

// Frame loop ---------------------------------------------------------------------

function measure() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  viewport = {
    width: Math.max(1, rect.width),
    height: Math.max(1, rect.height),
    dpr,
  };
  const width = Math.max(1, Math.round(viewport.width * dpr));
  const height = Math.max(1, Math.round(viewport.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function holding() {
  return beat.showing || beat.endShowing;
}

function introTime(now) {
  return motionQuery.matches ? Infinity : (now - introAt) / 1000;
}

function introRunning(now = performance.now()) {
  return introTime(now) < 3;
}

function frame(now) {
  loopId = 0;
  const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  const scene = sceneFor(rail.read());
  if (scene) {
    beat.tick(dt);
    let shot = null;
    if (stepper.active) shot = stepper.tick(world, dt);
    else if (playing && !holding()) shot = advance(dt);
    shown = shot ?? blendShots(prevShot, curShot, acc / STEP);
    if (playing && ledgerOverflow(ledgerValues(world.ledger, { mode: world.mode, leak: Boolean(shown.leak), tab: scene.tab }))) restartOverflow();
    if (pinned) followPinned(dt);
    if (beat.showing) beat.place(pinnedScreen() ?? focusScreen(), viewport);
  }
  draw(now);
  if (playing || stepper.active || pinned || beat.showing || introRunning(now) || (tags.length && !motionQuery.matches)) ensureLoop();
  if (tags.length || stationFocus || partFocus) inspector.sync();
}

// Runs whole engine steps for this frame and returns a picture blended
// between the last two, so motion is smooth at every speed.
function advance(dt) {
  const target = pinnedWorking() ? 0.5 : 1;
  slow += (target - slow) * (1 - Math.exp(-dt / 0.3));
  acc += dt * transport.speeds[speedIndex] * slow;
  let count = 0;
  while (acc >= STEP && count < 1200) {
    if (acc < 2 * STEP) prevShot = snapshot(world);
    step(world, STEP, keepIds());
    acc -= STEP;
    count += 1;
    afterStep();
    if (holding()) {
      acc = 0;
      prevShot = null;
      break;
    }
  }
  if (count >= 1200) acc = 0;
  if (count) curShot = snapshot(world);
  if (world.time - lastCheckpoint >= CHECKPOINT_EVERY) {
    stepper.checkpoint(world);
    lastCheckpoint = world.time;
  }
  return blendShots(prevShot, curShot, acc / STEP);
}

// After each engine step: waiting electron tags find their electrons, and
// the guide decides whether to speak.
function afterStep() {
  const events = world.events;
  if (world.dead && !deathShown && world.pace < 0.05) {
    deathShown = true;
    pause();
    showDeath();
    return;
  }
  if (world.dead) return;
  checkWaiting();
  if (!events.length) return;
  convertPairs(events);
  const tag = focusTag();
  if (!tag) return;
  const outcome = observe(journey, events, tag, world.time, world.sceneId);
  if (!outcome || !narrationBox?.checked) return;
  if (outcome.beat) {
    // An electron tag that ends in a bond to a hydrogen passes to that
    // hydrogen, and the journey carries on (M6 plan E7).
    if (outcome.handoff) swapTag(tagKey(tag), [{ persistentId: outcome.handoff, handed: true }]);
    beat.show(outcome.beat, readingTime(outcome.beat.text));
  } else if (outcome.split) {
    beat.show({ title: outcome.split.title, text: outcome.split.text, choices: outcome.split.choices, split: outcome.split }, 8);
  } else if (outcome.end) {
    pause();
    showEnd(outcome.end);
  }
}

function convertPairs(events) {
  for (const tag of tags.filter((entry) => entry.pairAtom)) {
    for (const event of events) {
      if (event.type !== 'reaction' || !event.electrons?.made.length) continue;
      const made = event.electrons.made.filter((id) => world.electrons[id]?.source === tag.pairAtom);
      if (!made.length) continue;
      swapTag(tagKey(tag), made.map((id) => ({ electronId: id })));
      break;
    }
  }
}

function followElectrons(split) {
  const tag = focusTag();
  if (!tag) return;
  swapTag(tagKey(tag), split.electrons.map((id) => ({ electronId: id })));
}

function swapTag(oldKey, replacements) {
  const wasFocus = focus === oldKey;
  const wasPinned = pinned === oldKey;
  const next = replaceTag(tags, oldKey, replacements);
  tags = next.tags;
  if (wasFocus || !focus) focus = next.focus;
  // The journey carries on under the new tag.
  if (journey.key === oldKey && next.focus) journey.key = next.focus;
  if (wasPinned) {
    pinned = next.focus;
    follow.last = null;
  }
}

function showDeath() {
  journey.ended = true;
  const entry = conditionCopy(world.death, world.sceneId);
  const text = entry?.death ?? 'Cell work found no ATP for long enough.';
  const named = world.death && world.death !== 'none';
  beat.showEnd({ title: 'The cell has died', text, summary: '' }, [
    { label: 'Reset', run: () => resetWorld(null, true) },
    { label: named ? (entry.resetWithout ?? `Reset without ${entry.label}`) : 'Reset', run: () => resetWorld(null, false) },
  ]);
}

// The Waiting ending (§16 W3). A followed particle that has not moved for
// 20 simulated seconds, parked in a living cell, ends its journey here: it
// was caught by a mode or condition that stopped what it was waiting for.
let still = null;
const WAIT_LIMIT = 20;

function checkWaiting() {
  const tag = focusTag();
  if (!tag || journey.ended || world.dead || !narrationBox?.checked) return;
  if (still && world.time - still.checked < 1) return;
  const shot = snapshot(world);
  const point = tag.electronId ? electronPoint(shot, tag.electronId) : atomPoint(shot, tag.persistentId);
  const key = tagKey(tag);
  // Feed waiting its turn in the tray is not stuck.
  if (!point || point.item?.kind === 'tray' || point.item?.kind === 'arrive') {
    still = null;
    return;
  }
  if (!still || still.key !== key || Math.hypot(point.x - still.x, point.y - still.y) > 3) {
    still = { key, x: point.x, y: point.y, since: world.time, checked: world.time };
    return;
  }
  still.checked = world.time;
  if (world.time - still.since < WAIT_LIMIT) return;
  // Waiting in CAM's vacuole or grain, in a hopper for partners, or on the
  // Calvin ring at night, is biology, not a stall (E13): say why once, and
  // keep going.
  const wait = biologicalWait(activeScene(), shot, point);
  if (wait) {
    if (still.said !== wait && narrationBox?.checked) beat.show({ title: 'Waiting', text: wait }, readingTime(wait));
    still = { key, x: point.x, y: point.y, since: world.time, checked: world.time, said: wait };
    return;
  }
  journey.ended = true;
  pause();
  const restartTag = root;
  beat.showEnd({ title: 'Waiting', text: waitingText(point.place, world.oxygen), summary: journeySummary(journey) }, [
    { label: 'Keep watching', run: () => { journey.ended = false; still = null; playing = true; transport.setPlaying(true); ensureLoop(); } },
    { label: 'Tag something else', run: () => resetWorld(null, true) },
    { label: 'Restart with the same tag', run: () => resetWorld(restartTag, true) },
  ]);
}

// Both restarts keep the condition, as the Waiting card's do (v1.1): before,
// a journey followed under PDH deficiency restarted in a healthy cell.
function showEnd(ending) {
  const restartTag = root;
  beat.showEnd({ title: ending.title, text: ending.text, summary: journeySummary(journey) }, [
    { label: 'Restart with the same tag', run: () => resetWorld(restartTag, true) },
    { label: 'Tag something else', run: () => resetWorld(null, true) },
    {
      label: 'Keep watching',
      run: () => {
        playing = true;
        transport.setPlaying(true);
        ensureLoop();
      },
    },
  ]);
}

function draw(now = performance.now()) {
  const state = rail.read();
  const scene = sceneFor(state);
  const t = introTime(now);
  const shot = scene ? withArrival(shown, t) : null;
  drawStage(ctx, {
    viewport,
    dpr: viewport.dpr,
    camera,
    tokens,
    scene,
    shot,
    brownFat: state.tab === 'respiration' && state.condition === 'ucp1',
    placeholder: scene ? '' : pathwayTitle(state.pathway),
    placeholderAt: centerOf(activeBounds()),
    fitZoom: fitted().zoom,
    reduceMotion: motionQuery.matches,
    trayPrompt: { text: PROMPT, at: (scene ?? humanScene).tray.prompt },
    tags,
    hover,
    time: now,
  });
  if (scene && shot) {
    renderLedger(shot.ledger, shot.atpLevel, shot.protonLevel, { mode: world.mode, leak: Boolean(shot.leak), reservoir: scene.reservoir?.name, reserve: shot.reserveLevel, scene });
  }
  else document.getElementById('ledger').replaceChildren();
  const selected = focusTag();
  transport.setFollow(Boolean(selected), Boolean(selected) && pinned === tagKey(selected));
}

function ensureLoop() {
  if (loopId) return;
  lastFrame = performance.now();
  loopId = requestAnimationFrame(frame);
}

// Camera --------------------------------------------------------------------------

function tagPoint(tag, shot = shown) {
  if (!tag || !shot) return null;
  if (tag.electronId) return electronPoint(shot, tag.electronId);
  const id = tag.persistentId ?? tag.pairAtom;
  return id ? atomPoint(shot, id) : null;
}

function followPinned(dt) {
  const tag = tags.find((entry) => tagKey(entry) === pinned);
  const point = tagPoint(tag);
  if (!point) return;
  userMoved = true;
  camera = clampCenter(followCamera(follow, camera, viewport, point, dt, motionQuery.matches), activeBounds());
}

// The pinned particle's station runs at half speed while it reacts.
function pinnedWorking() {
  if (!pinned) return false;
  const tag = tags.find((entry) => tagKey(entry) === pinned);
  const point = tagPoint(tag);
  const kind = point?.item?.kind;
  return kind === 'tween' || kind === 'station';
}

function pinnedScreen() {
  if (!pinned) return null;
  const point = tagPoint(tags.find((entry) => tagKey(entry) === pinned));
  return point ? worldToScreen(camera, viewport, point.x, point.y) : null;
}

function focusScreen() {
  const point = tagPoint(focusTag());
  return point ? worldToScreen(camera, viewport, point.x, point.y) : null;
}

const SCENES = { human: humanScene, yeast: yeastScene, bacterium: bacteriumScene, c3: c3Scene, c4: c4Scene, cam: camScene };

function sceneFor(state) {
  if (state.tab === 'photosynthesis') return { c3: c3Scene, c4: c4Scene, cam: camScene }[state.pathway] ?? null;
  if (state.tab !== 'respiration') return null;
  return { human: humanScene, yeast: yeastScene, bacterium: bacteriumScene }[state.organism] ?? null;
}

function activeScene() {
  return sceneFor(rail.read()) ?? humanScene;
}

function activeBounds() {
  return sceneFor(rail.read())?.bounds ?? humanScene.bounds;
}

function centerOf(bounds) {
  return { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
}

function fitted() {
  return fitCamera(viewport, activeBounds(), FIT_PAD);
}

function limits() {
  return zoomLimits(viewport, activeBounds(), FIT_PAD);
}

function clampZoom(zoom) {
  const { min, max } = limits();
  return Math.min(max, Math.max(min, zoom));
}

function fit(animate) {
  flyTo(fitted(), animate);
}

// The eased move to a target camera; a cut under reduced motion. Anything
// but Fit counts as the user's view. The tour's flight (gentle) is slower,
// with a sine ease and the zoom changing by a steady factor, so a sixfold
// zoom-in does not rush at the end.
function flyTo(target, animate, gentle = null) {
  const fit = fitted();
  userMoved = target.x !== fit.x || target.y !== fit.y || target.zoom !== fit.zoom;
  if (!animate || motionQuery.matches) {
    cancelAnimation();
    camera = target;
    draw();
    return;
  }
  const from = { ...camera };
  const started = performance.now();
  const generation = ++animating;
  function tick(now) {
    if (generation !== animating) return;
    const t = Math.min(1, (now - started) / (gentle?.ms ?? FIT_MS));
    const e = gentle ? (1 - Math.cos(Math.PI * t)) / 2 : easeInOut(t);
    camera = {
      x: from.x + (target.x - from.x) * e,
      y: from.y + (target.y - from.y) * e,
      zoom: gentle ? from.zoom * (target.zoom / from.zoom) ** e : from.zoom + (target.zoom - from.zoom) * e,
    };
    draw(now);
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function cancelAnimation() {
  animating += 1;
}

// Pointer -------------------------------------------------------------------------

function pointOf(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function beginPinch() {
  pinch = pinchInfo();
  for (const pointer of pointers.values()) pointer.moved = true;
}

function pinchInfo() {
  const pts = [...pointers.values()];
  return {
    distance: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
    midX: (pts[0].x + pts[1].x) / 2,
    midY: (pts[0].y + pts[1].y) / 2,
  };
}

function endPointer(event) {
  const previous = pointers.get(event.pointerId);
  const alone = pointers.size === 1;
  pointers.delete(event.pointerId);
  if (pointers.size < 2) pinch = null;
  if (previous && !previous.moved && alone) onStageClick(previous);
  if (pointers.size === 0) {
    canvas.style.cursor = '';
    updateHover(pointOf(event));
  }
}

function onStageClick(screen) {
  if (!sceneFor(rail.read())) return;
  const worldPoint = screenToWorld(camera, viewport, screen.x, screen.y);
  const hit = hitTag(screen, worldPoint);
  if (hit) {
    applyTag(hit);
    if (tags.some((tag) => tagKey(tag) === tagKey(hit))) tour.tagged();
    return;
  }
  // A station, then any other part of the stage (M8.12a): a pore, the
  // uncoupler, a store, a proton or a molecule. Empty paper clears the card.
  const station = hitStation(activeScene().stations, worldPoint);
  let part = null;
  if (station?.kind === 'store') part = { kind: 'store', id: station.id };
  else if (station?.kind === 'compound') part = hitSite(station, station.modes[world.stations[station.id].mode].reaction, worldPoint);
  else if (!station) part = hitPart(activeScene(), withArrival(shown, introTime(performance.now())), worldPoint, screen, camera, viewport);
  if (station && !part) {
    stationFocus = station.id;
    partFocus = null;
    focus = null;
  } else if (part) {
    partFocus = part;
    stationFocus = null;
    focus = null;
  } else if (stationFocus || partFocus) {
    stationFocus = null;
    partFocus = null;
  } else {
    return;
  }
  inspector.sync();
  draw();
}

function applyTag(hit) {
  const next = toggleTag(tags, hit);
  tags = next.tags;
  focus = next.focus;
  root = tags.find((tag) => tagKey(tag) === focus) ?? null;
  stationFocus = null;
  partFocus = null;
  if (pinned && !tags.some((tag) => tagKey(tag) === pinned)) releasePin();
  ensureLoop();
  inspector.sync();
  draw();
}

function hitTag(screen, worldPoint) {
  const drawn = withArrival(shown, introTime(performance.now()));
  return hitParticle(shown, world, camera, viewport, screen) ?? hitMolecule(drawn, worldPoint, camera.zoom, world, tags);
}

function updateHover(screen) {
  if (!sceneFor(rail.read())) return;
  const worldPoint = screenToWorld(camera, viewport, screen.x, screen.y);
  const hit = hitTag(screen, worldPoint);
  const nextKey = hit ? tagKey(hit) : null;
  const prevKey = hover ? tagKey(hover) : null;
  const clickable = hit || hitStation(activeScene().stations, worldPoint) || hitPart(activeScene(), shown, worldPoint, screen, camera, viewport);
  canvas.style.cursor = clickable ? 'pointer' : '';
  if (nextKey === prevKey) return;
  hover = hit;
  draw();
}

// Transport ------------------------------------------------------------------------

function pause() {
  if (!playing) return;
  playing = false;
  transport.setPlaying(false);
  stepper.checkpoint(world);
}

function togglePlay() {
  if (holding()) return;
  if (playing) {
    pause();
    return;
  }
  if (stepper.active) return;
  playing = true;
  transport.setPlaying(true);
  acc = 0;
  prevShot = null;
  curShot = snapshot(world);
  stepper.checkpoint(world);
  lastCheckpoint = world.time;
  ensureLoop();
}

function stepForward() {
  if (beat.showing) beat.continueNow();
  if (beat.endShowing) return;
  pause();
  world = stepper.forward(world, focusTag(), Math.max(1, transport.speeds[speedIndex]));
  acc = 0;
  ensureLoop();
}

function stepBack() {
  if (beat.showing) beat.cancel();
  beat.hideEnd();
  pause();
  if (stepper.back(world, Math.max(1, transport.speeds[speedIndex]))) {
    journey.ended = false;
    journey.last = -Infinity;
    acc = 0;
    ensureLoop();
  }
}

function changeSpeed(direction) {
  speedIndex = Math.min(transport.speeds.length - 1, Math.max(0, speedIndex + direction));
  transport.setSpeed(transport.speeds[speedIndex]);
}

function toggleFeed() {
  world.feed = world.feed === 'continuous' ? 'one' : 'continuous';
  transport.setFeed(world.feed);
}

// Leaving a tab pauses its world and keeps it, with its feed setting and
// whether it has died. Tags, the pin, beats, end cards and step history
// belong to the tab being left, and go.
function leaveTab() {
  pause();
  kept[tabOf(worldKey)] = { world, deathShown, introAt };
  clearTab();
}

function clearTab() {
  tags = [];
  focus = null;
  root = null;
  hover = null;
  stationFocus = null;
  partFocus = null;
  beat.cancel();
  beat.hideEnd();
  releasePin();
  stepper.clear();
  transport.setCanBack(false);
  journey = createJourney();
  follow = createFollow();
}

// The tab's kept world, still paused, or a new one if it has none for this
// scene. Changing organism or pathway rebuilds it, as before.
function enterTab(scene, state) {
  const saved = kept[state.tab];
  if (!saved || saved.world.sceneId !== scene.id) {
    startWorld(scene, state.mode, state.condition);
    return;
  }
  world = saved.world;
  worldKey = scene.id;
  renderNotes(notesBody, scene.id);
  deathShown = saved.deathShown;
  introAt = saved.introAt;
  playing = false;
  acc = 0;
  slow = 1;
  prevShot = null;
  curShot = snapshot(world);
  shown = curShot;
  lastCheckpoint = world.time;
  transport.setFeed(world.feed);
  transport.setPlaying(false);
}

// Restart keeps the same tag: the engine is deterministic, so the same atoms
// sit in the tray again under the same ids.
function rebuildWorld(state, keepPlaying) {
  const scene = sceneFor(state);
  if (!scene) return;
  const wasPlaying = keepPlaying && playing;
  startWorld(scene, state.mode, state.condition);
  tags = [];
  focus = null;
  root = null;
  pinned = null;
  if (!userMoved) camera = fitted();
  if (wasPlaying) {
    playing = true;
    transport.setPlaying(true);
    ensureLoop();
  }
  draw();
}

// A count past 9999 would widen its chip (M8.9), so the scene starts again
// from zero, as Reset does, keeping the user's choices and playing on.
function restartOverflow() {
  rebuildWorld(rail.read(), true);
  inspector.sync();
  const note = document.getElementById('ledger-note');
  note.textContent = 'The counters passed 9999, so the scene started again.';
  note.hidden = false;
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => {
    note.hidden = true;
  }, 4000);
}

function resetWorld(keepTag, keepCondition = false) {
  const state = rail.read();
  if (!keepCondition) rail.resetConditions({ silent: true });
  const next = rail.read();
  const scene = sceneFor(keepCondition ? state : next);
  if (!scene) return;
  startWorld(scene, (keepCondition ? state : next).mode, keepCondition ? state.condition : 'none');
  if (keepTag) {
    tags = [{ ...keepTag, n: 1 }];
    focus = tagKey(tags[0]);
    root = tags[0];
    pinned = focus;
  } else {
    tags = [];
    focus = null;
    root = null;
    pinned = null;
    if (!keepCondition) rail.resetConditions();
    fit(true);
  }
  ensureLoop();
  inspector.sync();
}

// A new world for the scene, paused, keeping only the feed setting.
function startWorld(scene, mode, condition) {
  const feed = world?.feed ?? 'continuous';
  world = createWorld(1, { scene, mode, condition });
  world.feed = feed;
  worldKey = scene.id;
  renderNotes(notesBody, scene.id);
  deathShown = false;
  playing = false;
  acc = 0;
  slow = 1;
  prevShot = null;
  curShot = snapshot(world);
  shown = curShot;
  lastCheckpoint = 0;
  introAt = performance.now();
  stepper.clear();
  beat.cancel();
  beat.hideEnd();
  journey = createJourney();
  follow = createFollow();
  hover = null;
  stationFocus = null;
  partFocus = null;
  transport.setFeed(world.feed);
  transport.setPlaying(false);
  transport.setCanBack(false);
}

// Tags --------------------------------------------------------------------------------

function focusTag() {
  return tags.find((tag) => tagKey(tag) === focus) ?? null;
}

function keepIds() {
  const ids = [];
  for (const tag of tags) {
    if (tag.persistentId) ids.push(tag.persistentId);
    if (tag.pairAtom) ids.push(tag.pairAtom);
    if (tag.electronId) ids.push(tag.electronId);
  }
  return ids;
}

function togglePin() {
  const tag = focusTag() ?? tags[0];
  if (!tag) return;
  const key = tagKey(tag);
  if (pinned === key) {
    releasePin();
  } else {
    pinned = key;
    follow = createFollow();
    ensureLoop();
  }
  inspector.sync();
  draw();
}

function releasePin() {
  pinned = null;
}

// Welcome tour (M8.11) ------------------------------------------------------------------

// The tray molecule step 1 shows: glucose in respiration, CO₂ in a leaf.
function feedId(scene) {
  return scene.feed?.id ?? scene.gas?.trays?.[0]?.id;
}

function feedItem() {
  const scene = sceneFor(rail.read());
  const id = scene && world.tray[feedId(scene)];
  return id ? withArrival(shown, introTime(performance.now())).items.find((item) => item.id === id) : null;
}

function feedRect() {
  const item = feedItem();
  if (!item) return null;
  const box = speciesBounds(item.species);
  const a = worldToScreen(camera, viewport, item.x + box.minX * item.scale, item.y + box.minY * item.scale);
  const b = worldToScreen(camera, viewport, item.x + box.maxX * item.scale, item.y + box.maxY * item.scale);
  const rect = canvas.getBoundingClientRect();
  const pad = 0.5 * item.scale * camera.zoom + 8;
  return { left: rect.left + a.x - pad, top: rect.top + a.y - pad, width: b.x - a.x + 2 * pad, height: b.y - a.y + 2 * pad };
}

// Close enough that every atom is drawn and can be clicked: bonds of 24 px.
function feedCamera() {
  const scene = sceneFor(rail.read());
  const at = scene?.tray[feedId(scene)];
  if (!at) return camera;
  return clampCenter({ x: at.x, y: at.y, zoom: clampZoom(24 / MOLECULE_SCALE) }, activeBounds());
}

// Next on step 1 tags carbon 3 (the CO₂'s carbon in a leaf).
function tagFeed() {
  const scene = sceneFor(rail.read());
  const id = scene && world.tray[feedId(scene)];
  const atoms = id && world.molecules[id]?.atoms;
  if (!atoms) return;
  const atomId = atoms.C3 ? 'C3' : 'C';
  applyTag({ instanceId: id, atomId, persistentId: atoms[atomId] });
}

function tourSpot() {
  const point = focusScreen();
  if (!point) return null;
  const rect = canvas.getBoundingClientRect();
  return { x: rect.left + point.x, y: rect.top + point.y, r: Math.max(18, 0.6 * MOLECULE_SCALE * camera.zoom) };
}

// The ? button: a clean start in whatever scene is showing, with a full tray.
function replayTour() {
  pause();
  beat.cancel();
  beat.hideEnd();
  tags = [];
  focus = null;
  root = null;
  stationFocus = null;
  partFocus = null;
  releasePin();
  const scene = sceneFor(rail.read());
  if (scene && (world.dead || !world.tray[feedId(scene)])) rebuildWorld(rail.read(), false);
  inspector.sync();
  draw();
  tour.start();
}

// With ?debug in the address, scripts can read the state (used by the
// browser checks; nothing in the page depends on it).
if (new URLSearchParams(window.location.search).has('debug')) {
  window.metasim = {
    get world() {
      return world;
    },
    get camera() {
      return camera;
    },
    get viewport() {
      return viewport;
    },
    get shot() {
      return shown;
    },
    get tags() {
      return tags;
    },
    get playing() {
      return playing;
    },
    get focus() {
      return { tag: focus, station: stationFocus, part: partFocus };
    },
    toScreen: (x, y) => worldToScreen(camera, viewport, x, y),
    // For scripts/shoot.js: tag the tray molecule (carbon 3, or a CO₂'s
    // carbon), follow the focused atom, and play or pause.
    tagFeed,
    follow: togglePin,
    play: togglePlay,
    look(x, y, zoom) {
      userMoved = true;
      camera = { x, y, zoom };
      ensureLoop();
    },
    atomPoint: (id) => atomPoint(shown, id),
    // Runs the world forward without animation frames, for checks in a
    // hidden browser.
    run(seconds) {
      const end = world.time + seconds;
      while (world.time < end) {
        step(world, STEP, keepIds());
        afterStep();
      }
      prevShot = null;
      curShot = snapshot(world);
      shown = curShot;
      draw();
      return world.time;
    },
  };
}
