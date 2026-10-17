import { worldToScreen } from './camera.js';
import { drawBelts, tracePath } from './belts.js';
import { mix } from './color.js';
import { drawLabels } from './labels.js';
import { drawMachines, drawPores, drawSparksOver, drawStoreFills } from './machines.js';
import { drawMolecule, drawPrompt } from './molecules.js';
import { drawParticles } from './particles.js';
import { roundRectSpanAtY, traceShape } from '../scenes/geometry.js';
import { setScreen, setWorld, visibleRect } from './view.js';

const FONT_FALLBACK = 'system-ui, sans-serif';
const NIGHT_ALPHA = 0.16;
// World units beyond the screen's edge that still count as on screen.
const CULL_MARGIN = 80;

// Draws the whole stage for one frame. Layers, bottom to top: compartments,
// process outlines, tracks, machines, molecules, particles, labels.
export function drawStage(ctx, frame) {
  const { viewport, dpr, camera, tokens, scene } = frame;
  const font = tokens.font || FONT_FALLBACK;

  setScreen(ctx, dpr);
  ctx.fillStyle = tokens.paper;
  ctx.fillRect(0, 0, viewport.width, viewport.height);

  if (!scene) {
    if (frame.placeholder && frame.placeholderAt) {
      const screen = worldToScreen(camera, viewport, frame.placeholderAt.x, frame.placeholderAt.y);
      ctx.font = `16px ${font}`;
      ctx.fillStyle = tokens['ink-soft'];
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(frame.placeholder, screen.x, screen.y);
    }
    return;
  }

  // Machines, molecules and particles wholly outside the screen (plus a
  // margin) are skipped. Positions, not drawing, drive the glow and the
  // follow camera, so culling does not touch them.
  frame = { ...frame, visible: visibleRect(viewport, camera, CULL_MARGIN) };
  setWorld(ctx, dpr, viewport, camera);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  drawCompartments(ctx, frame);
  const shot = frame.shot;
  if (shot) drawStoreFills(ctx, frame);
  drawZones(ctx, frame);
  // Night (CAM's clock, or darkness in any leaf): the cell and the paper
  // round it dim to a cool dusk, under the machines and molecules, which
  // stay as clear as by day.
  if (shot?.night > 0) {
    setScreen(ctx, dpr);
    ctx.fillStyle = tokens.night;
    ctx.globalAlpha = NIGHT_ALPHA * shot.night;
    ctx.fillRect(0, 0, viewport.width, viewport.height);
    ctx.globalAlpha = 1;
    setWorld(ctx, dpr, viewport, camera);
  }
  drawPores(ctx, frame);
  if (shot) {
    drawBelts(ctx, frame);
    drawMachines(ctx, frame);
    // Captions already drawn this frame, so a carrier riding close behind
    // another does not print its name over the first (M8.12b).
    frame.captions = [];
    for (const item of shot.items) drawMolecule(ctx, frame, item);
    drawParticles(ctx, frame);
    drawSparksOver(ctx, frame);
  }
  drawLabels(ctx, frame);
  if (shot?.clock) drawDial(ctx, frame, shot.clock);
  if (shot?.prompt && frame.trayPrompt) drawPrompt(ctx, frame, frame.trayPrompt);
  if (shot && shot.vitality < 1) {
    setScreen(ctx, dpr);
    ctx.fillStyle = tokens.paper;
    ctx.globalAlpha = (1 - shot.vitality) * 0.82;
    ctx.fillRect(0, 0, viewport.width, viewport.height);
    ctx.globalAlpha = 1;
  }
}

// The sun-and-moon dial (E10): a day of 80 s round the face, the day half
// light and the night half dark, a hand at the time now, and a sun or moon
// in the middle. Drawn on the screen, top right.
function drawDial(ctx, frame, clock) {
  const { tokens, viewport, dpr } = frame;
  const font = tokens.font || FONT_FALLBACK;
  setScreen(ctx, dpr);
  const r = 24;
  const cx = viewport.width - r - 22;
  // Below the ledger row, which may run the full width of the stage.
  const cy = r + 58;
  const start = -Math.PI / 2;
  const dayEnd = start + (clock.dayLength / clock.period) * Math.PI * 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
  ctx.fillStyle = tokens.paper;
  ctx.globalAlpha = 0.85;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, r, start, dayEnd);
  ctx.closePath();
  ctx.fillStyle = mix(tokens.photon, tokens.paper, 0.55);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, r, dayEnd, start + Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = mix(tokens.vacuole, tokens.ink, 0.45);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = tokens['ink-soft'];
  ctx.lineWidth = 1;
  ctx.stroke();
  const a = start + (clock.t / clock.period) * Math.PI * 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2));
  ctx.strokeStyle = tokens.ink;
  ctx.lineWidth = 2;
  ctx.stroke();
  const hub = 7;
  ctx.beginPath();
  ctx.arc(cx, cy, hub, 0, Math.PI * 2);
  ctx.fillStyle = clock.phase === 'day' ? tokens.photon : mix(tokens.night, tokens.paper, 0.2);
  ctx.fill();
  if (clock.phase !== 'day') {
    // A crescent moon inside the hub: a lit disc with its shadow side cut
    // away, set right of centre so the crescent itself sits in the middle.
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, hub, 0, Math.PI * 2);
    ctx.clip();
    ctx.beginPath();
    ctx.arc(cx + 1.2, cy, 4.8, 0, Math.PI * 2);
    ctx.fillStyle = tokens.paper;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 3.4, cy - 1.4, 4.2, 0, Math.PI * 2);
    ctx.fillStyle = mix(tokens.night, tokens.paper, 0.2);
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, hub, 0, Math.PI * 2);
  ctx.strokeStyle = tokens['ink-soft'];
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.font = `500 12px ${font}`;
  ctx.fillStyle = tokens.ink;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(clock.phase === 'day' ? 'Day' : 'Night', cx - r - 12, cy);
  ctx.restore();
  setWorld(ctx, dpr, viewport, frame.camera);
}

function fillShape(ctx, shape, color) {
  traceShape(ctx, shape);
  ctx.fillStyle = color;
  ctx.fill();
}

function strokeShape(ctx, shape, color, width, zoom) {
  traceShape(ctx, shape);
  ctx.strokeStyle = color;
  ctx.lineWidth = width / zoom;
  ctx.stroke();
}

function strokeUnion(ctx, shapes, color, width, zoom) {
  if (shapes.length === 1) {
    strokeShape(ctx, shapes[0], color, width, zoom);
    return;
  }
  shapes.forEach((shape, i) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(-1e5, -1e5, 2e5, 2e5);
    shapes.forEach((other, j) => {
      if (j !== i) traceShape(ctx, other, false);
    });
    ctx.clip('evenodd');
    strokeShape(ctx, shape, color, width, zoom);
    ctx.restore();
  });
}

// The mitochondrion has two membranes. The thin band between them is
// intermembrane space and joins the reservoir above the strip, which is the
// inner membrane unrolled.
function drawCompartments(ctx, frame) {
  const { scene, tokens, camera } = frame;
  const zoom = camera.zoom;
  // A budding yeast has one wall and one plasma membrane around mother and
  // bud, joined at a neck: each outline is drawn only where it lies outside
  // the other shape, so nothing crosses the neck.
  if (scene.wall) {
    const walls = [scene.wall, scene.budWall].filter(Boolean);
    for (const shape of walls) fillShape(ctx, shape, tokens.wall);
    strokeUnion(ctx, walls, tokens.membrane, 1.4, zoom);
  }
  if (scene.envelope) {
    drawEnvelope(ctx, frame);
    drawBrownFat(ctx, frame);
    return;
  }
  if (scene.leaf) {
    drawLeaf(ctx, frame);
    return;
  }
  const bodies = [scene.cell.shape, scene.bud].filter(Boolean);
  for (const shape of bodies) fillShape(ctx, shape, tokens.cytosol);
  strokeUnion(ctx, bodies, tokens.ink, 1.25, zoom);
  fillShape(ctx, scene.nucleus.shape, tokens.paper);
  strokeShape(ctx, scene.nucleus.shape, tokens['ink-soft'], 1.15, zoom);

  const mito = scene.mitochondrion;
  fillShape(ctx, mito.outer, tokens.reservoir);
  ctx.save();
  traceShape(ctx, mito.inner);
  ctx.clip();
  ctx.fillStyle = tokens.matrix;
  ctx.fillRect(mito.inner.x, mito.inner.y, mito.inner.w, mito.inner.h);
  ctx.fillStyle = tokens.reservoir;
  ctx.fillRect(mito.inner.x, mito.inner.y, mito.inner.w, mito.strip.y - mito.strip.half - mito.inner.y);
  ctx.fillStyle = tokens.bilayer;
  ctx.fillRect(mito.inner.x, mito.strip.y - mito.strip.half, mito.inner.w, mito.strip.half * 2);
  ctx.restore();

  strokeShape(ctx, mito.outer, tokens.membrane, 1.5, zoom);
  strokeShape(ctx, mito.inner, tokens.membrane, 1.25, zoom);
  ctx.strokeStyle = tokens.membrane;
  ctx.lineWidth = 1.25 / zoom;
  for (const y of [mito.strip.y - mito.strip.half, mito.strip.y + mito.strip.half]) {
    const span = roundRectSpanAtY(mito.inner, y, 0);
    if (!span) continue;
    ctx.beginPath();
    ctx.moveTo(span.x1, y);
    ctx.lineTo(span.x2, y);
    ctx.stroke();
  }

  drawBrownFat(ctx, frame);
}

// A Gram-negative envelope (§17 D1): the outer membrane is the cell's
// boundary, a thin periplasm with a peptidoglycan wall lies inside it, then
// the inner membrane. The strip is the inner membrane unrolled; at its right
// end it turns up to rejoin the envelope, so the periplasm above it, the
// proton reservoir, is a pocket of the same periplasm.
function drawEnvelope(ctx, frame) {
  const { scene, tokens, camera } = frame;
  const zoom = camera.zoom;
  const { outer, inner, wall, strip } = scene.envelope;
  const top = strip.y - strip.half;
  fillShape(ctx, outer, tokens.reservoir);
  ctx.save();
  traceShape(ctx, inner);
  ctx.clip();
  ctx.fillStyle = tokens.cytosol;
  ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
  ctx.fillStyle = tokens.reservoir;
  ctx.fillRect(inner.x, inner.y, strip.x2 - strip.half - inner.x, top - inner.y);
  ctx.fillStyle = tokens.bilayer;
  ctx.fillRect(inner.x, top, strip.x2 + strip.half - inner.x, strip.half * 2);
  ctx.fillRect(strip.x2 - strip.half, inner.y, strip.half * 2, top - inner.y);
  ctx.restore();

  drawNucleoid(ctx, frame);

  // The peptidoglycan wall, a hairline in the middle of the periplasm.
  ctx.save();
  ctx.setLineDash([3 / zoom, 3 / zoom]);
  strokeShape(ctx, wall, mix(tokens.membrane, tokens.reservoir, 0.35), 1, zoom);
  ctx.restore();
  strokeShape(ctx, outer, tokens.membrane, 1.5, zoom);
  strokeShape(ctx, inner, tokens.membrane, 1.25, zoom);

  // The strip's two faces, and its turn up into the envelope.
  ctx.strokeStyle = tokens.membrane;
  ctx.lineWidth = 1.25 / zoom;
  const left = roundRectSpanAtY(inner, top, 0);
  const leftLow = roundRectSpanAtY(inner, strip.y + strip.half, 0);
  ctx.beginPath();
  if (left) {
    ctx.moveTo(left.x1, top);
    ctx.lineTo(strip.x2 - strip.half, top);
    ctx.lineTo(strip.x2 - strip.half, inner.y);
  }
  if (leftLow) {
    ctx.moveTo(leftLow.x1, strip.y + strip.half);
    ctx.lineTo(strip.x2 + strip.half, strip.y + strip.half);
    ctx.lineTo(strip.x2 + strip.half, inner.y);
  }
  ctx.stroke();
}

// A leaf (M6 plan §5.1): the epidermis with its stoma above an air space,
// then the mesophyll cell with its wall, nucleus and vacuole, and the
// chloroplast. The band between the chloroplast's two envelope membranes is
// cytosol-coloured (D14); the only lavender is the thylakoid lumen.
function drawLeaf(ctx, frame) {
  const { scene, tokens, camera } = frame;
  const zoom = camera.zoom;
  const leaf = scene.leaf;
  const b = scene.bounds;
  const { y1, y2 } = leaf.epidermis;

  // Outside air above the leaf, and the air space below the epidermis.
  ctx.fillStyle = mix(tokens.gas, tokens.paper, 0.72);
  ctx.fillRect(b.x, y2, b.w, leaf.wall.y - y2 + 40);

  // Upper epidermis: a row of flat cells under a cuticle, opened by the stoma.
  const stoma = leaf.stoma;
  const gap = (frame.shot?.stoma ?? 1) * stoma.pore;
  ctx.fillStyle = mix(tokens.cytosol, tokens.wall, 0.35);
  ctx.fillRect(b.x, y1, stoma.x - 30 - b.x, y2 - y1);
  ctx.fillRect(stoma.x + 30, y1, b.x + b.w - stoma.x - 30, y2 - y1);
  ctx.strokeStyle = tokens.membrane;
  ctx.lineWidth = 1 / zoom;
  ctx.beginPath();
  for (let x = stoma.x + 30 + 110; x < b.x + b.w; x += 110) {
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
  }
  for (let x = stoma.x - 30 - 110; x > b.x; x -= 110) {
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
  }
  ctx.moveTo(b.x, y2);
  ctx.lineTo(stoma.x - 30, y2);
  ctx.moveTo(stoma.x + 30, y2);
  ctx.lineTo(b.x + b.w, y2);
  ctx.stroke();
  // The cuticle, a waxy line along the top.
  ctx.strokeStyle = mix(tokens.wall, tokens['ink-soft'], 0.45);
  ctx.lineWidth = 3 / zoom;
  ctx.beginPath();
  ctx.moveTo(b.x, y1);
  ctx.lineTo(stoma.x - 30, y1);
  ctx.moveTo(stoma.x + 30, y1);
  ctx.lineTo(b.x + b.w, y1);
  ctx.stroke();
  // Two kidney-shaped guard cells round the pore.
  for (const side of [-1, 1]) {
    const cx = stoma.x + side * (gap / 2 + 13);
    ctx.beginPath();
    ctx.ellipse(cx, (y1 + y2) / 2, 13, (y2 - y1) / 2 + 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = mix(tokens.enzyme, tokens.stroma, 0.4);
    ctx.fill();
    ctx.strokeStyle = tokens['enzyme-edge'];
    ctx.lineWidth = 1.2 / zoom;
    ctx.stroke();
  }

  // The cells: one mesophyll cell in C3; in C4 a bundle-sheath cell and a
  // mesophyll cell side by side (Kranz anatomy).
  for (const cell of leaf.cells ?? [leaf]) drawLeafCell(ctx, frame, cell);
  if (leaf.vein) drawVein(ctx, frame, leaf.vein);
}

// The vein the bundle sheath wraps (C4): xylem vessels, ringed with
// thickening, carry water up; phloem sieve tubes carry sugar away.
function drawVein(ctx, frame, vein) {
  const { tokens, camera } = frame;
  const zoom = camera.zoom;
  fillShape(ctx, vein.shape, mix(tokens.wall, tokens.paper, 0.35));
  strokeShape(ctx, vein.shape, tokens.membrane, 1.2, zoom);
  fillShape(ctx, vein.xylem, mix(tokens.gas, tokens.paper, 0.45));
  strokeShape(ctx, vein.xylem, tokens['ink-soft'], 1.1, zoom);
  fillShape(ctx, vein.phloem, mix(tokens['zone-glycolysis'], tokens.paper, 0.85));
  strokeShape(ctx, vein.phloem, tokens['ink-soft'], 1.1, zoom);
  ctx.save();
  ctx.strokeStyle = mix(tokens['ink-soft'], tokens.paper, 0.45);
  ctx.lineWidth = 1 / zoom;
  // Rings of thickening in the xylem; sieve plates across the phloem.
  const x = vein.xylem;
  for (let y = x.y + 40; y < x.y + x.h - 30; y += 22) {
    ctx.beginPath();
    ctx.moveTo(x.x + 30, y);
    ctx.lineTo(x.x + x.w - 30, y);
    ctx.stroke();
  }
  const p = vein.phloem;
  ctx.setLineDash([3 / zoom, 3 / zoom]);
  for (let y = p.y + 90; y < p.y + p.h - 40; y += 110) {
    ctx.beginPath();
    ctx.moveTo(p.x + 24, y);
    ctx.lineTo(p.x + p.w - 24, y);
    ctx.stroke();
  }
  ctx.restore();
}

// One leaf cell: wall, plasma membrane, cytosol, vacuole and nucleus, then
// its chloroplast, with the thylakoid sac where the cell has one.
function drawLeafCell(ctx, frame, leaf) {
  const { scene, tokens, camera } = frame;
  const zoom = camera.zoom;
  fillShape(ctx, leaf.wall, tokens.wall);
  strokeShape(ctx, leaf.wall, tokens.membrane, 1.2, zoom);
  fillShape(ctx, leaf.cell, tokens.cytosol);
  strokeShape(ctx, leaf.cell, tokens.ink, 1.25, zoom);
  if (leaf.vacuole) {
    fillShape(ctx, leaf.vacuole, tokens.vacuole);
    strokeShape(ctx, leaf.vacuole, tokens['ink-soft'], 1.1, zoom);
  }
  if (leaf.nucleus) {
    fillShape(ctx, leaf.nucleus, tokens.paper);
    strokeShape(ctx, leaf.nucleus, tokens['ink-soft'], 1.15, zoom);
  }
  // The peroxisome glycolate leaves for (M7a): where the salvage pathway begins.
  if (scene.peroxisome) {
    fillShape(ctx, scene.peroxisome, mix(tokens.cytosol, tokens['zone-krebs'], 0.12));
    strokeShape(ctx, scene.peroxisome, tokens['ink-soft'], 1.1, zoom);
  }

  // The chloroplast: two envelope membranes with cytosol between them, the
  // stroma inside, and faint stacked discs for the grana elsewhere.
  const { outer, inner } = leaf.chloroplast;
  fillShape(ctx, outer, tokens.cytosol);
  fillShape(ctx, inner, tokens.stroma);
  ctx.save();
  ctx.strokeStyle = mix(tokens.stroma, tokens['zone-krebs'], 0.22);
  ctx.fillStyle = mix(tokens.stroma, tokens.reservoir, 0.55);
  ctx.lineWidth = 1 / zoom;
  for (const [gx, gy] of leaf.grana ?? []) {
    for (let k = 0; k < 4; k += 1) {
      ctx.beginPath();
      ctx.ellipse(gx, gy - k * 9, 34, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
  strokeShape(ctx, outer, tokens.membrane, 1.5, zoom);
  strokeShape(ctx, inner, tokens.membrane, 1.25, zoom);

  // The thylakoid sac: a closed membrane round the lumen. Its floor is the
  // strip, drawn as a bilayer band.
  const sac = leaf.sac;
  if (!sac) return;
  const strip = { y: 300, half: 14 };
  const sacShape = { type: 'roundRect', x: sac.x1, y: sac.roof, w: sac.x2 - sac.x1, h: strip.y + strip.half - sac.roof, r: 22 };
  fillShape(ctx, sacShape, tokens.reservoir);
  ctx.save();
  traceShape(ctx, sacShape);
  ctx.clip();
  ctx.fillStyle = tokens.bilayer;
  ctx.fillRect(sac.x1, strip.y - strip.half, sac.x2 - sac.x1, strip.half * 2);
  ctx.restore();
  strokeShape(ctx, sacShape, tokens.membrane, 1.25, zoom);
  ctx.strokeStyle = tokens.membrane;
  ctx.lineWidth = 1.25 / zoom;
  ctx.beginPath();
  ctx.moveTo(sac.x1 + 6, strip.y - strip.half);
  ctx.lineTo(sac.x2 - 6, strip.y - strip.half);
  ctx.stroke();
}

// The nucleoid: the cell's DNA, a loose coil with no membrane around it.
function drawNucleoid(ctx, frame) {
  const nucleoid = frame.scene.nucleoid;
  if (!nucleoid) return;
  const { tokens, camera } = frame;
  ctx.save();
  ctx.beginPath();
  nucleoid.outline.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.fillStyle = mix(tokens.cytosol, tokens.paper, 0.6);
  ctx.fill();
  ctx.setLineDash([5 / camera.zoom, 4 / camera.zoom]);
  ctx.strokeStyle = mix(tokens['ink-soft'], tokens.cytosol, 0.35);
  ctx.lineWidth = 1 / camera.zoom;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = mix(tokens['ink-soft'], tokens.cytosol, 0.55);
  for (const coil of nucleoid.coils) {
    ctx.beginPath();
    coil.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
  }
  ctx.restore();
}

function drawBrownFat(ctx, frame) {
  const { scene, tokens, camera } = frame;
  if (frame.brownFat && scene.brownFatLabel) {
    const at = worldToScreen(camera, frame.viewport, scene.brownFatLabel.x, scene.brownFatLabel.y);
    ctx.save();
    setScreen(ctx, frame.dpr);
    ctx.font = `600 15px ${tokens.font || FONT_FALLBACK}`;
    ctx.fillStyle = tokens.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Brown fat', at.x, at.y);
    ctx.restore();
    setWorld(ctx, frame.dpr, frame.viewport, camera);
  }
}

// Each process gets a dashed outline in its own colour, the colour its title
// is written in (§16 D8). The dashes are lighter, so the outlines stay quiet.
const ZONE_DASH_ALPHA = 0.6;

function drawZones(ctx, frame) {
  const { scene, tokens, camera } = frame;
  ctx.save();
  ctx.lineWidth = 1.2 / camera.zoom;
  ctx.setLineDash([6 / camera.zoom, 5 / camera.zoom]);
  ctx.globalAlpha = ZONE_DASH_ALPHA;
  for (const zone of scene.zones) {
    ctx.strokeStyle = tokens[zone.token] || tokens['ink-soft'];
    ctx.beginPath();
    tracePath(ctx, zone.path);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}
