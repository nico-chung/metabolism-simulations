import { worldToScreen } from './camera.js';
import { mix } from './color.js';
import { glowSprite } from './glow.js';
import { tracePath } from './belts.js';
import { lodAt } from './lod.js';
import { boxVisible, setScreen, setWorld } from './view.js';
import { stationBox } from './hit.js';
import { choreography, siteActivity } from '../sim/choreography.js';
import { polyPath } from '../sim/path.js';

// Stations: enzymes, membrane complexes, ATP synthase, transporters and the
// cell's work. Flat shapes with thin outlines. A condition marks the
// stations it touches (§16 D6): blocked (a poison), absent (a gene product
// that is not made) or impaired (an enzyme that only partly works).

const PHASES = { idle: 0, load: 0, work: 1, unload: 2 };

export function drawMachines(ctx, frame) {
  const { scene, shot } = frame;
  const states = new Map(shot.stations.map((station) => [station.id, station]));
  const marks = shot.marks ?? {};
  for (const def of scene.stations) {
    // A store eases its drawn level each time it is drawn, so it is never
    // skipped: coming back on screen, it shows its level without a glide.
    if (def.kind !== 'store' && !stationVisible(frame.visible, def)) continue;
    const state = states.get(def.id);
    const mark = marks[def.id] ?? null;
    if (def.kind === 'enzyme') drawEnzyme(ctx, frame, def, state, mark);
    else if (def.kind === 'complex') drawComplex(ctx, frame, def, state, mark);
    else if (def.kind === 'synthase') drawSynthase(ctx, frame, def, state, mark);
    else if (def.kind === 'transport') drawTransport(ctx, frame, def, state, mark);
    else if (def.kind === 'work') drawWork(ctx, frame, def, state, mark);
    else if (def.kind === 'compound') drawCompound(ctx, frame, def, state, mark);
    else if (def.kind === 'store') drawStore(ctx, frame, def);
    if (mark) drawMark(ctx, frame, def, mark);
  }
  drawUncoupler(ctx, frame);
}

// A station's whole drawing: its box, complex I's arm, a photosystem's glow
// and a hopper above a compound station. Marks, sparks and the progress
// line sit close enough to fit in the culling margin.
const reaches = new WeakMap();
function stationVisible(rect, def) {
  if (!rect) return true;
  let reach = reaches.get(def);
  if (!reach) {
    const box = stationBox(def);
    reach = { left: box.x - box.w / 2, top: box.y - box.h / 2, right: box.x + box.w / 2, bottom: box.y + box.h / 2 };
    const grow = (x, y, w, h) => {
      reach.left = Math.min(reach.left, x - w / 2);
      reach.top = Math.min(reach.top, y - h / 2);
      reach.right = Math.max(reach.right, x + w / 2);
      reach.bottom = Math.max(reach.bottom, y + h / 2);
    };
    if (def.arm) grow(def.arm.x, def.arm.y, def.arm.w, def.arm.h);
    if (def.shape === 'PS') grow(def.x, def.y, def.w * 1.9, def.h * 2.5);
    if (def.hopper) {
      const hop = def.hopper;
      grow(def.x, def.y + (hop.dy ?? -def.h / 2 + 18), (hop.count - 1) * (hop.spacing ?? 26) + 52, 32);
    }
    reaches.set(def, reach);
  }
  return boxVisible(rect, reach.left, reach.top, reach.right, reach.bottom);
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

// Fills and strokes the current path as a station body, tinted by its mark.
function body(ctx, frame, mark, fill = 'enzyme', edge = 'enzyme-edge') {
  const { tokens } = frame;
  const zoom = frame.camera.zoom;
  if (mark?.kind === 'absent') {
    ctx.save();
    ctx.setLineDash([3 / zoom, 3 / zoom]);
    ctx.lineWidth = 1.2 / zoom;
    ctx.strokeStyle = tokens['ink-soft'];
    ctx.stroke();
    ctx.restore();
    return;
  }
  let fillColor = tokens[fill];
  let edgeColor = tokens[edge];
  if (mark?.kind === 'blocked') {
    fillColor = mix(tokens[fill], tokens.blocked, 0.32);
    edgeColor = mix(tokens[edge], tokens.blocked, 0.65);
  } else if (mark?.kind === 'impaired') {
    fillColor = mix(tokens[fill], tokens.blocked, 0.1);
    edgeColor = mix(tokens[edge], tokens.blocked, 0.3);
  }
  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.lineWidth = 1.25 / zoom;
  ctx.strokeStyle = edgeColor;
  ctx.stroke();
}

// A thin line along the lower edge fills while the station works.
function progressLine(ctx, frame, def, state, inset = 8) {
  if (!state || state.phase === 'idle') return;
  const overall = (PHASES[state.phase] + state.progress) / 3;
  const left = def.x - def.w / 2 + inset;
  const width = def.w - inset * 2;
  const y = def.y + def.h / 2 - 5;
  ctx.beginPath();
  ctx.moveTo(left, y);
  ctx.lineTo(left + width * Math.min(1, overall), y);
  ctx.strokeStyle = mix(frame.tokens['ink-soft'], frame.tokens.enzyme, 0.35);
  ctx.lineWidth = 1.6 / frame.camera.zoom;
  ctx.stroke();
}

function drawEnzyme(ctx, frame, def, state, mark) {
  ctx.beginPath();
  roundRect(ctx, def.x - def.w / 2, def.y - def.h / 2, def.w, def.h, 13);
  body(ctx, frame, mark);
  progressLine(ctx, frame, def, state);
}

const complexPaths = new Map();
function complexOutline(scene, def) {
  const key = `${scene.id}:${def.id}`;
  if (complexPaths.has(key)) return complexPaths.get(key);
  const x = def.x;
  const y = def.y;
  const hw = def.w / 2;
  const hh = def.h / 2;
  let paths;
  if (def.shape === 'I') {
    const arm = def.arm;
    paths = [polyPath([
      { x: x - hw, y: y - hh }, { x: x + hw, y: y - hh }, { x: x + hw, y: y + hh },
      { x: arm.x + arm.w / 2, y: y + hh }, { x: arm.x + arm.w / 2, y: arm.y + arm.h / 2 },
      { x: arm.x - arm.w / 2, y: arm.y + arm.h / 2 }, { x: arm.x - arm.w / 2, y: y + hh }, { x: x - hw, y: y + hh },
    ], 9, true)];
  } else if (def.shape === 'PS') {
    // A photosystem: the reaction centre, with an antenna lobe (its
    // light-harvesting complexes) on each side, in the membrane.
    const lobe = (cx) => polyPath([
      { x: cx - 16, y: y - hh + 8 }, { x: cx + 16, y: y - hh + 8 }, { x: cx + 16, y: y + hh - 8 }, { x: cx - 16, y: y + hh - 8 },
    ], 14, true);
    paths = [
      lobe(x - hw + 16),
      lobe(x + hw - 16),
      polyPath([{ x: x - hw + 26, y: y - hh }, { x: x + hw - 26, y: y - hh }, { x: x + hw - 26, y: y + hh }, { x: x - hw + 26, y: y + hh }], 12, true),
    ];
  } else if (def.shape === 'site' || def.shape === 'blob') {
    paths = [polyPath([
      { x: x - hw, y: y - hh }, { x: x + hw, y: y - hh }, { x: x + hw, y: y + hh }, { x: x - hw, y: y + hh },
    ], Math.min(hw, hh), true)];
  } else if (def.shape === 'III') {
    paths = [-1, 1].map((side) => {
      const cx = x + side * (hw / 2 + 1);
      return polyPath([
        { x: cx - hw / 2 + 1, y: y - hh }, { x: cx + hw / 2 - 1, y: y - hh },
        { x: cx + hw / 2 - 1, y: y + hh }, { x: cx - hw / 2 + 1, y: y + hh },
      ], 11, true);
    });
  } else {
    paths = [polyPath([
      { x: x - hw, y: y - hh }, { x: x + hw, y: y - hh }, { x: x + hw, y: y + hh }, { x: x - hw, y: y + hh },
    ], 13, true)];
  }
  complexPaths.set(key, paths);
  return paths;
}

function drawComplex(ctx, frame, def, state, mark) {
  const glow = def.shape === 'PS' && mark?.kind !== 'absent' ? frame.shot.glows?.[def.id] ?? 0 : 0;
  // A photosystem struck by light glows faintly yellow (M6.5 P2): a soft
  // halo behind it and a tint over its body, easing in and out per photon.
  if (glow > 0.01) {
    ctx.save();
    ctx.globalAlpha = 0.7 * glow;
    ctx.drawImage(glowSprite(frame.tokens.photon), def.x - def.w * 0.95, def.y - def.h * 1.25, def.w * 1.9, def.h * 2.5);
    ctx.restore();
  }
  const paths = complexOutline(frame.scene, def);
  for (const path of paths) {
    ctx.beginPath();
    tracePath(ctx, path);
    ctx.closePath();
    body(ctx, frame, mark);
  }
  if (glow > 0.01) {
    ctx.save();
    ctx.globalAlpha = 0.36 * glow;
    ctx.fillStyle = frame.tokens.photon;
    for (const path of paths) {
      ctx.beginPath();
      tracePath(ctx, path);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  progressLine(ctx, frame, def, state, 12);
}

// ATP synthase, simplified from the textbook figure: a rotor in the
// membrane, a stator beside it with an arm down to the knob, an internal rod,
// and the catalytic knob in the matrix. Oligomycin binds Fₒ (rotor and
// stator), so a blocked or absent synthase marks those parts; the F₁ knob
// is made from nuclear genes and keeps its colour.
function drawSynthase(ctx, frame, def, state, mark) {
  const { tokens, camera } = frame;
  const zoom = camera.zoom;
  const angle = frame.reduceMotion ? 0.6 : frame.shot.rotor;
  const rotor = def.rotor;
  const knob = def.knob;
  const stator = def.stator;
  const fo = mark?.kind === 'blocked' || mark?.kind === 'absent' ? mark : null;
  const f1 = mark?.kind === 'impaired' ? mark : null;
  const edge = tokens['enzyme-edge'];
  const stem = mix(tokens.enzyme, tokens['enzyme-edge'], 0.25);

  // Stator arm, behind everything.
  ctx.beginPath();
  ctx.moveTo(stator.x + 2, rotor.y + rotor.h / 2);
  ctx.lineTo(stator.x + 2, knob.y - knob.r * 0.6);
  ctx.lineTo(knob.x + knob.r * 0.75, knob.y - knob.r * 0.75);
  ctx.strokeStyle = edge;
  ctx.lineWidth = 4.5 / zoom;
  ctx.stroke();
  ctx.strokeStyle = stem;
  ctx.lineWidth = 2.5 / zoom;
  ctx.stroke();

  // Internal rod, with a mark that turns with the rotor.
  ctx.beginPath();
  roundRect(ctx, rotor.x - 4, rotor.y + rotor.h / 2 - 2, 8, knob.y - rotor.y - rotor.h / 2, 3);
  body(ctx, frame, f1);
  const turn = Math.sin(angle) * 3;
  ctx.beginPath();
  ctx.moveTo(rotor.x + turn - 1.5, knob.y - knob.r - 6);
  ctx.lineTo(rotor.x + turn + 1.5, knob.y - knob.r - 12);
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.4 / zoom;
  ctx.stroke();

  // Catalytic knob: three pairs of lobes.
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const lx = knob.x + Math.cos(a) * knob.r * 0.52;
    const ly = knob.y + Math.sin(a) * knob.r * 0.52;
    ctx.beginPath();
    ctx.arc(lx, ly, knob.r * 0.5, 0, Math.PI * 2);
    let fill = i % 2 ? tokens.enzyme : mix(tokens.enzyme, tokens['carrier-adenosine'], 0.55);
    if (f1) fill = mix(fill, tokens.blocked, 0.1);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 1.1 / zoom;
    ctx.strokeStyle = edge;
    ctx.stroke();
  }

  // Rotor: a ring of subunits seen edge on, sliding as it turns.
  ctx.beginPath();
  roundRect(ctx, rotor.x - rotor.w / 2, rotor.y - rotor.h / 2, rotor.w, rotor.h, rotor.h / 2);
  body(ctx, frame, fo ?? f1);
  if (fo?.kind !== 'absent') {
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, rotor.x - rotor.w / 2, rotor.y - rotor.h / 2, rotor.w, rotor.h, rotor.h / 2);
    ctx.clip();
    ctx.strokeStyle = mix(edge, tokens.enzyme, 0.35);
    ctx.lineWidth = 1 / zoom;
    for (let k = 0; k < 10; k += 1) {
      const a = angle + (k / 10) * Math.PI * 2;
      if (Math.cos(a) < 0) continue;
      const sx = rotor.x + Math.sin(a) * (rotor.w / 2 - 4);
      ctx.beginPath();
      ctx.moveTo(sx, rotor.y - rotor.h / 2 + 3);
      ctx.lineTo(sx, rotor.y + rotor.h / 2 - 3);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Stator block beside the rotor, where protons come in from above.
  ctx.beginPath();
  roundRect(ctx, stator.x - stator.w / 2, stator.y - stator.h / 2, stator.w, stator.h, 5);
  body(ctx, frame, fo ?? f1);
  if (fo?.kind !== 'absent') {
    ctx.beginPath();
    ctx.moveTo(stator.x, stator.y - stator.h / 2 + 3);
    ctx.lineTo(stator.x, stator.y + 2);
    ctx.strokeStyle = mix(tokens.proton, edge, 0.3);
    ctx.lineWidth = 1.4 / zoom;
    ctx.stroke();
  }
  void state;
}

// A compound station (M6 plan E4): a wide rounded box with a tray along
// its input side for the hopper. Its sub-steps' molecules sit inside.
function drawCompound(ctx, frame, def, state, mark) {
  const { tokens } = frame;
  const zoom = frame.camera.zoom;
  ctx.beginPath();
  roundRect(ctx, def.x - def.w / 2, def.y - def.h / 2, def.w, def.h, 18);
  body(ctx, frame, mark);
  const hop = def.hopper;
  if (hop) {
    const dy = hop.dy ?? -def.h / 2 + 18;
    const width = (hop.count - 1) * (hop.spacing ?? 26) + 52;
    ctx.beginPath();
    roundRect(ctx, def.x + (hop.dx ?? 0) - width / 2, def.y + dy - 16, width, 32, 10);
    ctx.fillStyle = mix(tokens.enzyme, tokens.paper, 0.45);
    ctx.fill();
    ctx.setLineDash([3 / zoom, 3 / zoom]);
    ctx.lineWidth = 1 / zoom;
    ctx.strokeStyle = mix(tokens['enzyme-edge'], tokens.enzyme, 0.4);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  const plan = def.inner?.sites && mark?.kind !== 'absent' ? choreography(def, def.modes[0].reaction) : null;
  if (plan?.staged) drawSites(ctx, frame, def, plan, state);
  progressLine(ctx, frame, def, state, 14);
}

// A store (E11). The starch grain is a granule with growth rings, sized by
// the glucose it holds; the vacuole's malate store fills the vacuole with a
// faint acid tint from the bottom up as malate comes in.
function drawStore(ctx, frame, def) {
  const { tokens } = frame;
  const zoom = frame.camera.zoom;
  if (def.look === 'grain') {
    const level = storeLevel(frame, def);
    const k = 0.45 + 0.55 * Math.sqrt(level);
    const rx = (def.w / 2) * k;
    const ry = (def.h / 2) * k;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(def.x, def.y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = mix(tokens.paper, tokens['zone-glycolysis'], 0.16);
    ctx.fill();
    ctx.strokeStyle = mix(tokens['zone-glycolysis'], tokens.paper, 0.45);
    ctx.lineWidth = 1.2 / zoom;
    ctx.stroke();
    ctx.strokeStyle = mix(tokens['zone-glycolysis'], tokens.paper, 0.75);
    ctx.lineWidth = 1 / zoom;
    for (const ring of [0.72, 0.44]) {
      ctx.beginPath();
      ctx.ellipse(def.x, def.y, rx * ring, ry * ring, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// The vacuole's fill is part of the cell, drawn with the compartments so the
// tonoplast's channels and the belts stay on top of it.
export function drawStoreFills(ctx, frame) {
  const { tokens, scene } = frame;
  for (const def of scene.stations) {
    if (def.kind !== 'store' || def.look !== 'vacuole') continue;
    const vac = scene.leaf?.vacuole;
    const level = storeLevel(frame, def);
    if (!vac || level <= 0.001) continue;
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, vac.x, vac.y, vac.w, vac.h, vac.r);
    ctx.clip();
    const top = vac.y + vac.h * (1 - level);
    ctx.fillStyle = mix(tokens.vacuole, tokens['zone-pump'], 0.16);
    ctx.fillRect(vac.x, top, vac.w, vac.y + vac.h - top);
    ctx.restore();
  }
}

// A store's drawn level glides to its count over about half a second of
// screen time, so each molecule parked or given fades the fill up or down
// instead of stepping it. A new scene, or a jump in the clock, snaps.
const STORE_EASE = 0.45;
const shown = new Map();
function storeLevel(frame, def) {
  const fill = frame.shot?.stores?.[def.id];
  const target = fill ? fill.count / fill.cap : 0;
  const now = (globalThis.performance?.now?.() ?? 0) / 1000;
  const key = `${frame.shot?.sceneId}:${def.id}`;
  const last = shown.get(key);
  const time = frame.shot?.time ?? 0;
  let level = target;
  if (last && time >= last.time && time - last.time < 5) {
    const k = 1 - Math.exp(-Math.max(0, now - last.now) / STORE_EASE);
    level = last.level + (target - last.level) * k;
  }
  shown.set(key, { level, now, time });
  return level;
}

// The enzyme sites of a compound station's assembly line (M6.5 P5): a pad
// each, which lights in the zone's colour while its step runs, and its name
// at Near.
function drawSites(ctx, frame, def, plan, state) {
  const { tokens } = frame;
  const zoom = frame.camera.zoom;
  const f = state?.phase === 'work' ? state.progress : -1;
  const pad = def.inner.pad ?? { w: 40, h: 20 };
  const zone = tokens[`zone-${def.zone}`] ?? tokens['enzyme-edge'];
  const base = mix(tokens.enzyme, tokens['enzyme-edge'], 0.07);
  const edge = mix(tokens['enzyme-edge'], tokens.enzyme, 0.5);
  const near = lodAt(zoom, frame.fitZoom || zoom) === 'near';
  for (const site of plan.sites) {
    const act = f < 0 ? 0 : siteActivity(plan, site, f);
    ctx.beginPath();
    roundRect(ctx, site.x - pad.w / 2, site.y - pad.h / 2, pad.w, pad.h, 8);
    ctx.fillStyle = mix(base, zone, 0.16 * act);
    ctx.fill();
    ctx.lineWidth = (1 + act) / zoom;
    ctx.strokeStyle = mix(edge, zone, act);
    ctx.stroke();
    if (!near) continue;
    const y = site.below ? site.y + pad.h / 2 + 3 : site.y - pad.h / 2 - 3;
    screenText(ctx, frame, site.name, site.x, y, { size: 9, baseline: site.below ? 'top' : 'bottom', color: mix(tokens['ink-soft'], zone, act) });
  }
}

function drawTransport(ctx, frame, def, state, mark) {
  ctx.beginPath();
  roundRect(ctx, def.x - def.w / 2, def.y - def.h / 2, def.w, def.h, 8);
  body(ctx, frame, mark, 'carrier', 'carrier-edge');
  ctx.beginPath();
  ctx.moveTo(def.x, def.y - def.h / 2 + 5);
  ctx.lineTo(def.x, def.y + def.h / 2 - 5);
  ctx.strokeStyle = frame.tokens['carrier-edge'];
  ctx.lineWidth = 1 / frame.camera.zoom;
  ctx.stroke();
  void state;
}

// Cell work: a small hammer strikes an anvil once for every ATP spent, and a
// few sparks fly. It moves on simulation time, so it pauses with the run.
function drawWork(ctx, frame, def, state, mark) {
  ctx.beginPath();
  roundRect(ctx, def.x - def.w / 2, def.y - def.h / 2, def.w, def.h, 12);
  body(ctx, frame, mark);
  const still = frame.reduceMotion || lodAt(frame.camera.zoom, frame.fitZoom || frame.camera.zoom) === 'far';
  hammerAndAnvil(ctx, frame, def.x, def.y + 2, still ? null : state);
  progressLine(ctx, frame, def, state);
}

const REST = 0.7;
const LIFT = 1.2;
const STRIKE_AT = 0.85;

// The hammer's lift, in radians above the strike, and the age of the sparks
// (0 to 1), from the station's phase.
function hammerPose(state) {
  if (!state || state.phase === 'idle') return { lift: REST, spark: null };
  const f = state.progress;
  if (state.phase === 'load') return { lift: REST + (LIFT - REST) * (1 - (1 - f) ** 2), spark: null };
  if (state.phase === 'work') {
    if (f < STRIKE_AT) {
      const k = f / STRIKE_AT;
      return { lift: LIFT * (1 - k * k), spark: null };
    }
    const k = (f - STRIKE_AT) / (1 - STRIKE_AT);
    return { lift: 0.1 * k, spark: k * 0.4 };
  }
  const k = f * f * (3 - 2 * f);
  return { lift: 0.1 + (REST - 0.1) * k, spark: 0.4 + f * 0.6 };
}

function hammerAndAnvil(ctx, frame, x, y, state) {
  const { tokens } = frame;
  const zoom = frame.camera.zoom;
  const edge = tokens['enzyme-edge'];
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.2 / zoom;
  ctx.strokeStyle = edge;

  // Anvil: flat top, a horn to the left, a waist and a foot.
  ctx.beginPath();
  ctx.moveTo(x - 12, y + 2);
  ctx.lineTo(x + 10, y + 2);
  ctx.lineTo(x + 10, y + 6);
  ctx.lineTo(x + 5, y + 7);
  ctx.lineTo(x + 4, y + 11);
  ctx.lineTo(x + 9, y + 14);
  ctx.lineTo(x - 9, y + 14);
  ctx.lineTo(x - 4, y + 11);
  ctx.lineTo(x - 5, y + 7);
  ctx.lineTo(x - 12, y + 6);
  ctx.quadraticCurveTo(x - 17, y + 4.5, x - 20, y + 2.5);
  ctx.lineTo(x - 12, y + 2);
  ctx.closePath();
  ctx.fillStyle = mix(tokens.enzyme, edge, 0.18);
  ctx.fill();
  ctx.stroke();

  // Hammer: pivots at its grip, up and to the right; the head meets the
  // anvil's face when the lift is zero.
  const { lift, spark } = hammerPose(state);
  const pivot = { x: x + 15, y: y - 5 };
  const strike = Math.atan2(4, -15.5);
  const a = strike + lift;
  ctx.save();
  ctx.translate(pivot.x, pivot.y);
  ctx.rotate(a);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(13, 0);
  ctx.stroke();
  ctx.beginPath();
  roundRect(ctx, 12, -4, 5, 8, 1.2);
  ctx.fillStyle = mix(tokens.enzyme, edge, 0.45);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  void spark;
  ctx.restore();
}

// Sparks are drawn after the molecules, so the ATP being spent never hides
// them.
export function drawSparksOver(ctx, frame) {
  const { scene, shot } = frame;
  if (!shot || frame.reduceMotion) return;
  if (lodAt(frame.camera.zoom, frame.fitZoom || frame.camera.zoom) === 'far') return;
  for (const def of scene.stations) {
    if (def.kind !== 'work') continue;
    const state = shot.stations.find((station) => station.id === def.id);
    const { spark } = hammerPose(state);
    if (spark != null && spark < 1) drawSparks(ctx, frame, { x: def.x - 1, y: def.y + 3 }, spark);
  }
}

// Where the hammer lands: a short flash, then a fan of sparks that fly up,
// arc back down and fade. Each spark is a streak from where it was a moment
// ago to where it is now.
const SPARKS = [
  { deg: -158, speed: 0.95 },
  { deg: -128, speed: 1.25 },
  { deg: -104, speed: 0.85 },
  { deg: -80, speed: 1.15 },
  { deg: -52, speed: 1 },
  { deg: -24, speed: 0.8 },
];
const SPARK_REACH = 19;
const SPARK_FALL = 12;

function sparkAt(at, spark, t) {
  const r = (spark.deg * Math.PI) / 180;
  const d = SPARK_REACH * spark.speed * (1 - (1 - t) ** 2);
  return { x: at.x + Math.cos(r) * d, y: at.y + Math.sin(r) * d + SPARK_FALL * t * t };
}

function drawSparks(ctx, frame, at, t) {
  const zoom = frame.camera.zoom;
  const color = frame.tokens.spark;
  ctx.save();
  if (t < 0.3) {
    const k = t / 0.3;
    const r = 2.5 + 3.5 * k;
    ctx.globalAlpha = 0.9 * (1 - k);
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const a = (i * Math.PI) / 4 - Math.PI / 2;
      const d = i % 2 === 0 ? r : r * 0.35;
      ctx.lineTo(at.x + Math.cos(a) * d, at.y + Math.sin(a) * d * 0.8);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = Math.min(1, 1.8 * (1 - t));
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1.6 / zoom, 0.9);
  ctx.beginPath();
  for (const spark of SPARKS) {
    const tail = sparkAt(at, spark, Math.max(0, t - 0.14));
    const head = sparkAt(at, spark, t);
    ctx.moveTo(tail.x, tail.y);
    ctx.lineTo(head.x, head.y);
  }
  ctx.stroke();
  ctx.restore();
}

// Marks: a dark red cross for a blocked station, a bar showing what still
// works for an impaired one, and a word for one that is absent.
function markCorner(def) {
  if (def.kind === 'synthase') return { x: def.stator.x + def.stator.w / 2, y: def.rotor.y - def.rotor.h / 2 };
  return { x: def.x + def.w / 2, y: def.y - def.h / 2 };
}

function drawMark(ctx, frame, def, mark) {
  const { tokens } = frame;
  const zoom = frame.camera.zoom;
  const at = markCorner(def);
  if (mark.kind === 'blocked') {
    const arm = Math.max(8, 5.5 / zoom);
    ctx.save();
    ctx.lineCap = 'round';
    const cross = () => {
      ctx.beginPath();
      ctx.moveTo(at.x - arm, at.y - arm);
      ctx.lineTo(at.x + arm, at.y + arm);
      ctx.moveTo(at.x + arm, at.y - arm);
      ctx.lineTo(at.x - arm, at.y + arm);
    };
    cross();
    ctx.strokeStyle = tokens.paper;
    ctx.lineWidth = 5 / zoom;
    ctx.stroke();
    cross();
    ctx.strokeStyle = tokens.blocked;
    ctx.lineWidth = 2.2 / zoom;
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (mark.kind === 'impaired') {
    const w = Math.max(16, 12 / zoom);
    const h = Math.max(4, 3.5 / zoom);
    const left = at.x - w / 2;
    const top = at.y - h / 2;
    ctx.save();
    ctx.fillStyle = tokens.paper;
    ctx.fillRect(left, top, w, h);
    ctx.fillStyle = tokens.blocked;
    ctx.fillRect(left, top, w * mark.residual, h);
    ctx.strokeStyle = tokens.blocked;
    ctx.lineWidth = 1 / zoom;
    ctx.strokeRect(left, top, w, h);
    ctx.restore();
    return;
  }
  if (mark.kind === 'absent' && lodAt(zoom, frame.fitZoom || zoom) !== 'far') {
    const below = def.kind === 'synthase' ? { x: def.rotor.x, y: def.rotor.y + def.rotor.h / 2 } : { x: def.x, y: def.y + def.h / 2 };
    screenText(ctx, frame, 'absent', below.x, below.y + 4, { size: 10.5, color: tokens['ink-soft'], baseline: 'top' });
  }
}

function screenText(ctx, frame, text, x, y, { size = 10.5, color, baseline = 'middle', weight = 400 } = {}) {
  const { camera, viewport, tokens } = frame;
  const { x: sx, y: sy } = worldToScreen(camera, viewport, x, y);
  ctx.save();
  setScreen(ctx, frame.dpr);
  ctx.font = `${weight} ${size}px ${tokens.font || 'system-ui, sans-serif'}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = baseline;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = tokens.paper;
  ctx.globalAlpha = 0.85;
  ctx.strokeText(text, sx, sy);
  ctx.globalAlpha = 1;
  ctx.fillStyle = color ?? tokens['ink-soft'];
  ctx.fillText(text, sx, sy);
  ctx.restore();
  setWorld(ctx, frame.dpr, viewport, camera);
}

const LEAK_NAMES = { ucp1: 'UCP1', dnp: 'DNP' };

// UCP1 is a channel protein in the membrane; DNP a small carrier. Both sit
// beside ATP synthase: the other way back for protons.
function drawUncoupler(ctx, frame) {
  const kind = frame.shot?.leak;
  const at = kind && frame.scene.uncoupler?.[kind];
  if (!at) return;
  const zoom = frame.camera.zoom;
  ctx.save();
  ctx.lineWidth = 1.25 / zoom;
  ctx.strokeStyle = frame.tokens.membrane;
  if (kind === 'ucp1') {
    ctx.fillStyle = frame.tokens.carrier;
    ctx.beginPath();
    roundRect(ctx, at.x - 8, at.y - 17, 16, 34, 5);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(at.x, at.y - 12);
    ctx.lineTo(at.x, at.y + 12);
    ctx.strokeStyle = frame.tokens['carrier-edge'];
    ctx.lineWidth = 1 / zoom;
    ctx.stroke();
  } else {
    ctx.fillStyle = frame.tokens.carrier;
    ctx.beginPath();
    ctx.arc(at.x, at.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
  if (lodAt(zoom, frame.fitZoom || zoom) !== 'far') {
    screenText(ctx, frame, LEAK_NAMES[kind], at.x, at.y - 24, { size: 11, weight: 500, baseline: 'bottom' });
  }
}

// Pores where a belt or a molecule crosses a membrane.
export function drawPores(ctx, frame) {
  for (const pore of frame.scene.pores) {
    const vertical = pore.membrane === 'cell';
    ctx.beginPath();
    roundRect(ctx, pore.x - pore.w / 2, pore.y - pore.h / 2, pore.w, pore.h, 5);
    body(ctx, frame, null, 'carrier', 'carrier-edge');
    ctx.beginPath();
    if (vertical) {
      ctx.moveTo(pore.x - pore.w / 2 + 5, pore.y);
      ctx.lineTo(pore.x + pore.w / 2 - 5, pore.y);
    } else {
      ctx.moveTo(pore.x, pore.y - pore.h / 2 + 2);
      ctx.lineTo(pore.x, pore.y + pore.h / 2 - 2);
    }
    ctx.strokeStyle = frame.tokens['carrier-edge'];
    ctx.lineWidth = 1 / frame.camera.zoom;
    ctx.stroke();
  }
}
