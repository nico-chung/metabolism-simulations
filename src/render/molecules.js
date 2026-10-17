import { ELEMENTS } from '../chem/elements.js';
import { getSpecies } from '../chem/species/index.js';
import { worldToScreen } from './camera.js';
import { darken, mix } from './color.js';
import { glowSprite } from './glow.js';
import { atomDrawn, atomRadius, atomWorld, moleculeLod } from './hit.js';
import { tagKey } from '../ui/tags.js';
import { boxVisible, setScreen, setWorld } from './view.js';

const FONT_FALLBACK = 'system-ui, sans-serif';

export function drawMolecule(ctx, frame, item) {
  const species = item.speciesData ?? getSpecies(item.species);
  const lod = moleculeLod(item.scale, frame.camera.zoom);
  const tags = itemTags(frame, item);
  const dim = (frame.tags ?? []).length > 0;
  const veil = item.alpha ?? 1;

  if (veil <= 0.01) return;
  if (frame.visible) {
    const box = moleculeBounds(species, item);
    if (!boxVisible(frame.visible, box.x, box.y, box.x + box.w, box.y + box.h)) return;
  }
  if (lod === 'far') {
    drawPill(ctx, frame, species, item, dim && tags.length === 0, veil);
    drawHalos(ctx, frame, species, item, tags, lod);
    return;
  }

  const { dpr, viewport, camera } = frame;
  setWorld(ctx, dpr, viewport, camera);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  drawBonds(ctx, frame, species, item, tags, dim);
  drawHalos(ctx, frame, species, item, tags, lod);
  drawAtoms(ctx, frame, species, item, tags, dim, lod);
  if (lod === 'near') {
    drawCarbonNumbers(ctx, frame, species, item);
    drawCaption(ctx, frame, species, item);
  }
  ctx.globalAlpha = 1;
  drawHover(ctx, frame, species, item, lod);
  drawBadges(ctx, frame, species, item, tags);
}

function drawBonds(ctx, frame, species, item, tags, dim) {
  const tagged = new Set(tags.map((tag) => tag.atomId));
  ctx.lineWidth = 1.35 / frame.camera.zoom;
  ctx.strokeStyle = frame.tokens['ink-soft'];
  for (const [a, b, order] of species.bonds) {
    const hot = tagged.has(a) || tagged.has(b);
    ctx.globalAlpha = (dim && !hot ? 0.38 : 1) * (item.alpha ?? 1);
    strokeBond(ctx, atomWorld(species.atoms[a], item), atomWorld(species.atoms[b], item), order, frame.camera.zoom);
  }
  ctx.globalAlpha = item.alpha ?? 1;
}

function strokeBond(ctx, p1, p2, order, zoom) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) || 1;
  const screenGap = Math.max(2.6, len * zoom * 0.2);
  const gap = screenGap / zoom;
  const ox = (-dy / len) * gap;
  const oy = (dx / len) * gap;
  const offsets = order === 3 ? [-1, 0, 1] : order === 2 ? [-0.5, 0.5] : [0];
  for (const offset of offsets) {
    ctx.beginPath();
    ctx.moveTo(p1.x + ox * offset, p1.y + oy * offset);
    ctx.lineTo(p2.x + ox * offset, p2.y + oy * offset);
    ctx.stroke();
  }
}

function drawAtoms(ctx, frame, species, item, tags, dim, lod) {
  ctx.globalAlpha = item.alpha ?? 1;
  const byId = new Map(tags.map((tag) => [tag.atomId, tag]));
  for (const [id, atom] of Object.entries(species.atoms)) {
    if (!atomDrawn(atom, lod)) continue;
    if (atom.body && species.carrier) {
      drawCarrierBody(ctx, frame, species, item, atom, dim && !byId.get(id));
      continue;
    }
    const tag = byId.get(id);
    const quiet = dim && !tag;
    const at = atomWorld(atom, item);
    const radius = atomRadius(atom, item.scale);
    let fill = tag ? frame.tokens[`tag-${tag.n}`] : frame.tokens[ELEMENTS[atom.el].token];
    let edge = tag
      ? darken(fill, 0.3)
      : (ELEMENTS[atom.el].edge ? frame.tokens[ELEMENTS[atom.el].edge] : darken(fill, 0.3));
    if (quiet) {
      fill = mix(fill, frame.tokens.paper, 0.62);
      edge = mix(edge, frame.tokens.paper, 0.55);
    }
    ctx.beginPath();
    ctx.arc(at.x, at.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 1.25 / frame.camera.zoom;
    ctx.strokeStyle = edge;
    ctx.stroke();
    if (lod === 'near' && atom.charge) drawCharge(ctx, frame, atom.charge, at);
  }
  ctx.globalAlpha = item.alpha ?? 1;
}

function drawCharge(ctx, frame, charge, at) {
  const screen = worldToScreen(frame.camera, frame.viewport, at.x, at.y);
  const text = charge === -1 ? '−' : charge === 1 ? '+' : `${charge > 0 ? '+' : '−'}${Math.abs(charge)}`;
  ctx.save();
  setScreen(ctx, frame.dpr);
  ctx.font = `600 12px ${frame.tokens.font || FONT_FALLBACK}`;
  ctx.fillStyle = frame.tokens.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(text, screen.x + 7, screen.y - 4);
  ctx.restore();
}

function itemTags(frame, item) {
  const tags = frame.tags ?? [];
  if (item.atomIds) {
    const labels = new Map(Object.entries(item.atomIds).map(([label, id]) => [id, label]));
    return tags
      .filter((tag) => tag.persistentId && labels.has(tag.persistentId))
      .map((tag) => ({ ...tag, atomId: labels.get(tag.persistentId) }));
  }
  return tags.filter((tag) => tag.instanceId === item.id);
}

function drawCarrierBody(ctx, frame, species, item, atom, quiet) {
  const at = atomWorld(atom, item);
  const w = item.scale * 1.7;
  const h = item.scale * 1.05;
  ctx.beginPath();
  roundRect(ctx, at.x - w / 2, at.y - h / 2, w, h, h / 2);
  ctx.fillStyle = quiet ? mix(frame.tokens.carrier, frame.tokens.paper, 0.62) : frame.tokens.carrier;
  ctx.fill();
  ctx.lineWidth = 1.25 / frame.camera.zoom;
  ctx.strokeStyle = quiet ? mix(frame.tokens['carrier-edge'], frame.tokens.paper, 0.55) : frame.tokens['carrier-edge'];
  ctx.stroke();
  if (moleculeLod(item.scale, frame.camera.zoom) !== 'near') return;
  const screen = worldToScreen(frame.camera, frame.viewport, at.x, at.y);
  ctx.save();
  setScreen(ctx, frame.dpr);
  ctx.font = `600 12px ${frame.tokens.font || FONT_FALLBACK}`;
  if (textWidth(ctx, species.carrier.label) + 8 < w * frame.camera.zoom) {
    ctx.fillStyle = frame.tokens.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(species.carrier.label, screen.x, screen.y + 0.5);
  }
  ctx.restore();
}

function drawCarbonNumbers(ctx, frame, species, item) {
  const any = (frame.tags ?? []).length > 0;
  ctx.save();
  setScreen(ctx, frame.dpr);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const [id, atom] of Object.entries(species.atoms)) {
    if (!atom.n) continue;
    const tagged = itemTags(frame, item).some((tag) => tag.atomId === id);
    const at = atomWorld(atom, item);
    const screen = worldToScreen(frame.camera, frame.viewport, at.x, at.y);
    const radius = atomRadius(atom, item.scale) * frame.camera.zoom;
    const size = radius >= 14 ? Math.round(Math.min(16, radius * 0.7)) : 12;
    ctx.font = `600 ${size}px ${frame.tokens.font || FONT_FALLBACK}`;
    ctx.fillStyle = any && !tagged ? frame.tokens['ink-soft'] : frame.tokens.ink;
    ctx.fillText(String(atom.n), screen.x, screen.y + 0.5);
  }
  ctx.restore();
}

function drawCaption(ctx, frame, species, item) {
  const bounds = moleculeBounds(species, item);
  const numbered = Object.values(species.atoms).some((atom) => atom.n);
  const x = bounds.x + bounds.w / 2;
  const y = numbered ? bounds.y - 8 / frame.camera.zoom : bounds.y + bounds.h + 4 / frame.camera.zoom;
  if (!captionFree(ctx, frame, species.label, x, y, numbered)) return;
  paintText(ctx, frame, species.label, x, y, {
    size: 13,
    align: 'center',
    baseline: numbered ? 'bottom' : 'top',
    color: frame.tokens.ink,
  });
}

// True, and the caption's screen box is kept, unless it would overlap a
// caption already drawn this frame; then it is skipped.
function captionFree(ctx, frame, text, x, y, above) {
  if (!frame.captions) return true;
  const at = worldToScreen(frame.camera, frame.viewport, x, y);
  ctx.save();
  ctx.font = `13px ${frame.tokens.font || FONT_FALLBACK}`;
  const w = textWidth(ctx, text) + 4;
  ctx.restore();
  const box = { x: at.x - w / 2, y: above ? at.y - 15 : at.y, w, h: 15 };
  const hit = frame.captions.some((other) => box.x < other.x + other.w && other.x < box.x + box.w && box.y < other.y + other.h && other.y < box.y + box.h);
  if (!hit) frame.captions.push(box);
  return !hit;
}

function drawPill(ctx, frame, species, item, dim) {
  const bounds = moleculeBounds(species, item);
  const { dpr, viewport, camera, tokens } = frame;
  setWorld(ctx, dpr, viewport, camera);
  ctx.save();
  ctx.globalAlpha = (dim ? 0.5 : 1) * (item.alpha ?? 1);
  const radius = Math.min(bounds.h / 2, item.scale * 0.85);
  roundRect(ctx, bounds.x, bounds.y, bounds.w, bounds.h, radius);
  ctx.fillStyle = pillColor(tokens, species);
  ctx.fill();
  ctx.lineWidth = 1.25 / camera.zoom;
  ctx.strokeStyle = tokens['ink-soft'];
  ctx.stroke();
  ctx.restore();

  const screen = worldToScreen(camera, viewport, bounds.x + bounds.w / 2, bounds.y + bounds.h / 2);
  ctx.save();
  setScreen(ctx, dpr);
  ctx.globalAlpha = (dim ? 0.5 : 1) * (item.alpha ?? 1);
  ctx.font = `600 13px ${tokens.font || FONT_FALLBACK}`;
  if (textWidth(ctx, species.label) + 16 < bounds.w * camera.zoom) {
    ctx.fillStyle = tokens.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(species.label, screen.x, screen.y);
  }
  ctx.restore();
}

const CARRIER_TINTS = {
  NAD: 'carrier-nad',
  CoA: 'carrier-coa',
  Adenosine: 'carrier-adenosine',
  Q: 'carrier-q',
  c: 'carrier-cyt',
  FAD: 'carrier-fad',
  NADP: 'carrier-nad',
  PQ: 'carrier-q',
  PC: 'carrier-cyt',
  Fd: 'carrier-fd',
};

// Carriers are tinted by kind, so a stream of NADH reads differently from a
// stream of ATP even as small pills.
function pillColor(tokens, species) {
  if (species.family === 'carrier') {
    if (species.id === 'pi') return tokens['carrier-adenosine'];
    return tokens[CARRIER_TINTS[species.carrier?.label]] ?? tokens.carrier;
  }
  return tokens[species.family] ?? tokens.carrier;
}

function drawHalos(ctx, frame, species, item, tags, lod) {
  for (const tag of tags) {
    const atom = species.atoms[tag.atomId];
    if (!atom) continue;
    const at = atomWorld(atom, item);
    const color = frame.tokens[`tag-${tag.n}`];
    const screen = worldToScreen(frame.camera, frame.viewport, at.x, at.y);
    const drawn = atomRadius(atom, item.scale) * frame.camera.zoom;
    const halo = Math.max(drawn * 4.2, 26);
    ctx.save();
    setScreen(ctx, frame.dpr);
    ctx.globalAlpha = glowAlpha(frame);
    const sprite = glowSprite(color);
    ctx.drawImage(sprite, screen.x - halo, screen.y - halo, halo * 2, halo * 2);
    if (lod === 'far') {
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 1.25;
      ctx.strokeStyle = darken(color, 0.3);
      ctx.stroke();
    }
    ctx.restore();
    if (lod === 'far') drawTagNumber(ctx, frame, tag, screen, 5.5, color);
  }
}

function drawBadges(ctx, frame, species, item, tags) {
  for (const tag of tags) {
    const atom = species.atoms[tag.atomId];
    if (!atom) continue;
    const at = atomWorld(atom, item);
    const screen = worldToScreen(frame.camera, frame.viewport, at.x, at.y);
    const drawn = atomRadius(atom, item.scale) * frame.camera.zoom;
    drawTagNumber(ctx, frame, tag, screen, drawn, frame.tokens[`tag-${tag.n}`]);
  }
}

// The tag's number sits at ten o'clock from its atom, whatever the molecule
// is or how it turns, so it never jumps as the atom moves.
const TAG_ANGLE = (-5 * Math.PI) / 6;

function drawTagNumber(ctx, frame, tag, screen, radius, color) {
  const font = frame.tokens.font || FONT_FALLBACK;
  const dist = radius + 11;
  const x = screen.x + Math.cos(TAG_ANGLE) * dist;
  const y = screen.y + Math.sin(TAG_ANGLE) * dist;
  ctx.save();
  setScreen(ctx, frame.dpr);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 12px ${font}`;
  ctx.lineWidth = 3;
  ctx.strokeStyle = frame.tokens.paper;
  ctx.strokeText(String(tag.n), x, y);
  ctx.fillStyle = color;
  ctx.fillText(String(tag.n), x, y);
  ctx.restore();
}

function drawHover(ctx, frame, species, item, lod) {
  const hover = frame.hover;
  if (!hover) return;
  const mine = item.atomIds
    ? hover.persistentId && Object.values(item.atomIds).includes(hover.persistentId)
    : hover.instanceId === item.id;
  if (!mine) return;
  const atomId = item.atomIds
    ? Object.entries(item.atomIds).find(([, id]) => id === hover.persistentId)?.[0]
    : hover.atomId;
  const atom = species.atoms[atomId];
  if (!atom || !atomDrawn(atom, lod)) return;
  const at = atomWorld(atom, item);
  const tag = (frame.tags ?? []).find((entry) => tagKey(entry) === tagKey(hover));
  setWorld(ctx, frame.dpr, frame.viewport, frame.camera);
  ctx.beginPath();
  ctx.arc(at.x, at.y, atomRadius(atom, item.scale) + 3.5 / frame.camera.zoom, 0, Math.PI * 2);
  ctx.lineWidth = 1.25 / frame.camera.zoom;
  ctx.strokeStyle = tag ? frame.tokens[`tag-${tag.n}`] : frame.tokens.ink;
  ctx.stroke();
}

export function drawPrompt(ctx, frame, prompt) {
  if (moleculeLod(8, frame.camera.zoom) !== 'near') return;
  paintText(ctx, frame, prompt.text, prompt.at.x, prompt.at.y, {
    size: 14,
    align: 'left',
    baseline: 'top',
    color: frame.tokens.ink,
  });
}

function paintText(ctx, frame, text, x, y, options) {
  const screen = worldToScreen(frame.camera, frame.viewport, x, y);
  if (screen.x < -240 || screen.y < -40 || screen.x > frame.viewport.width + 40 || screen.y > frame.viewport.height + 40) {
    return;
  }
  ctx.save();
  setScreen(ctx, frame.dpr);
  ctx.font = `${options.size}px ${frame.tokens.font || FONT_FALLBACK}`;
  ctx.fillStyle = options.color;
  ctx.textAlign = options.align;
  ctx.textBaseline = options.baseline;
  ctx.fillText(text, screen.x, screen.y);
  ctx.restore();
}

// A species' extent in bond lengths round its own origin, atoms' radii
// included. Computed once per species object.
const extents = new WeakMap();
function speciesExtent(species) {
  let extent = extents.get(species);
  if (extent) return extent;
  extent = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const atom of Object.values(species.atoms)) {
    const radius = atomRadius(atom, 1);
    extent.minX = Math.min(extent.minX, atom.x - radius);
    extent.minY = Math.min(extent.minY, atom.y - radius);
    extent.maxX = Math.max(extent.maxX, atom.x + radius);
    extent.maxY = Math.max(extent.maxY, atom.y + radius);
  }
  extents.set(species, extent);
  return extent;
}

export function moleculeBounds(species, pose) {
  const extent = speciesExtent(species);
  const pad = pose.scale * 0.42;
  return {
    x: pose.x + extent.minX * pose.scale - pad,
    y: pose.y + extent.minY * pose.scale - pad,
    w: (extent.maxX - extent.minX) * pose.scale + pad * 2,
    h: (extent.maxY - extent.minY) * pose.scale + pad * 2,
  };
}

// Text widths by font and text. A label's width never changes, so it is
// measured once; the font must already be set on the context.
const widths = new Map();
function textWidth(ctx, text) {
  const key = `${ctx.font}|${text}`;
  let width = widths.get(key);
  if (width === undefined) {
    width = ctx.measureText(text).width;
    widths.set(key, width);
  }
  return width;
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function glowAlpha(frame) {
  if (frame.reduceMotion) return 0.62;
  const wave = 0.5 + 0.5 * Math.sin((frame.time ?? 0) / 380);
  return 0.4 + 0.38 * wave;
}
