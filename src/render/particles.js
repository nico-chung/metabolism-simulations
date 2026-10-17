import { worldToScreen } from './camera.js';
import { darken } from './color.js';
import { glowSprite } from './glow.js';
import { boxVisible, pointVisible, setScreen, setWorld } from './view.js';

// Protons are darker pastel blue dots and electrons smaller cyan dots (§16 D7).
// Both keep a minimum size on screen so they never vanish when zoomed out,
// and a maximum, so zoomed in a bare proton is never drawn bigger than a
// hydrogen atom.
export function drawParticles(ctx, frame) {
  const { shot, tokens, camera } = frame;
  const zoom = camera.zoom;
  const tags = frame.tags ?? [];
  const dim = tags.length > 0;
  setWorld(ctx, frame.dpr, frame.viewport, camera);
  drawLight(ctx, frame, dim);
  const protonR =Math.max(1.7 / zoom, Math.min(3, PROTON_MAX_PX / zoom));
  for (const proton of shot.protons) {
    if (!pointVisible(frame.visible, proton.x, proton.y)) continue;
    const tag = tags.find((entry) => entry.persistentId && entry.persistentId === proton.atomId);
    ctx.globalAlpha = proton.alpha * (dim && !tag ? 0.45 : 1);
    ctx.beginPath();
    ctx.arc(proton.x, proton.y, protonR, 0, Math.PI * 2);
    ctx.fillStyle = tag ? tokens[`tag-${tag.n}`] : tokens.proton;
    ctx.fill();
    if (zoom * protonR >= 2.5) {
      ctx.lineWidth = 1 / zoom;
      ctx.strokeStyle = darken(tokens.proton, 0.3);
      ctx.stroke();
    }
  }
  const electronR = Math.min(Math.max(1.15, 1 / zoom), ELECTRON_MAX_PX / zoom);
  for (const dot of shot.electrons) {
    if (!pointVisible(frame.visible, dot.x, dot.y)) continue;
    const tag = dot.id ? tags.find((entry) => entry.electronId === dot.id) : null;
    ctx.globalAlpha = dot.alpha * (dim && !tag ? 0.5 : 1);
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, electronR, 0, Math.PI * 2);
    ctx.fillStyle = tag ? tokens[`tag-${tag.n}`] : tokens.electron;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const tag of tags) {
    let at = null;
    if (tag.electronId) at = shot.electrons.find((dot) => dot.id === tag.electronId);
    else if (tag.persistentId) at = shot.protons.find((proton) => proton.atomId === tag.persistentId);
    if (!at) continue;
    halo(ctx, frame, at, tokens[`tag-${tag.n}`]);
  }
}

// Light (M6 plan E1, §5.3; M6.5 P2). A photon is a bright warm head with a
// soft glow, trailing the textbook wave squiggle, at least 3 px across the
// head at any zoom. One that lands on a photosystem that cannot use it is
// given off again: a ring that grows and fades. The photosystem's own glow
// is drawn with the machine (machines.js).
const PHOTON_PX = 3.2;
const FLASH_TIME = 0.25;
const WAVES = 3;

function drawLight(ctx, frame, dim) {
  const { shot, tokens, camera } = frame;
  const zoom = camera.zoom;
  if (!shot.photons && !shot.flashes) return;
  const color = tokens.photon;
  const edge = darken(color, 0.3);
  const r = Math.min(Math.max(PHOTON_PX / zoom, 4), 8 / zoom);
  const len = Math.min(Math.max(70, 34 / zoom), 110 / zoom);
  const amp = len * 0.09;
  const sprite = glowSprite(color);
  const base = dim ? 0.5 : 1;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const photon of shot.photons ?? []) {
    // The wave trails up to `len` behind the head.
    if (!boxVisible(frame.visible, photon.x - len, photon.y - len, photon.x + len, photon.y + len)) continue;
    const length = Math.hypot(photon.dx, photon.dy) || 1;
    const ux = photon.dx / length;
    const uy = photon.dy / length;
    if (!frame.reduceMotion) {
      // The squiggle behind the head, fading toward its tail.
      const n = 30;
      ctx.lineWidth = Math.max(1.3 / zoom, r * 0.42);
      ctx.strokeStyle = color;
      let px = photon.x;
      let py = photon.y;
      for (let i = 1; i <= n; i += 1) {
        const f = i / n;
        const wob = Math.sin(f * WAVES * Math.PI * 2) * amp;
        const x = photon.x - ux * f * len - uy * wob;
        const y = photon.y - uy * f * len + ux * wob;
        ctx.globalAlpha = base * 0.9 * (1 - f);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(x, y);
        ctx.stroke();
        px = x;
        py = y;
      }
    }
    ctx.globalAlpha = base * 0.75;
    ctx.drawImage(sprite, photon.x - r * 3.2, photon.y - r * 3.2, r * 6.4, r * 6.4);
    ctx.globalAlpha = base;
    ctx.beginPath();
    ctx.arc(photon.x, photon.y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 1 / zoom;
    ctx.strokeStyle = edge;
    ctx.stroke();
  }
  for (const flash of shot.flashes ?? []) {
    const k = Math.min(1, flash.t / FLASH_TIME);
    ctx.globalAlpha = (1 - k) * 0.9;
    ctx.beginPath();
    ctx.arc(flash.x, flash.y, (3 + 12 * k) / zoom, 0, Math.PI * 2);
    ctx.strokeStyle = darken(color, 0.15);
    ctx.lineWidth = 1.8 / zoom;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

const PROTON_MAX_PX = 3.5;
const ELECTRON_MAX_PX = 2.5;

function halo(ctx, frame, at, color) {
  const screen = worldToScreen(frame.camera, frame.viewport, at.x, at.y);
  ctx.save();
  setScreen(ctx, frame.dpr);
  ctx.globalAlpha = frame.reduceMotion ? 0.62 : 0.4 + 0.38 * (0.5 + 0.5 * Math.sin((frame.time ?? 0) / 380));
  const size = 22;
  ctx.drawImage(glowSprite(color), screen.x - size, screen.y - size, size * 2, size * 2);
  ctx.restore();
  setWorld(ctx, frame.dpr, frame.viewport, frame.camera);
}
