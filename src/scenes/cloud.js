// The proton reservoir: protons pumped into the intermembrane space (or the
// periplasm) spread out and keep moving. Each takes a slow random walk, so
// the cloud evens itself out and, because ATP synthase uses the protons
// nearest to it, drifts on balance from the pumps toward the synthase. The
// walk's noise comes from the proton's id and the step count, so every run
// is the same.

import { inRoundRect } from './geometry.js';

// Each axis of a proton's velocity relaxes toward zero over tau seconds and
// is kicked so that it averages sigma units per second, which gives a
// diffusion coefficient of sigma² · tau. A short tau makes the path read as
// Brownian jitter rather than a slow sway (M8.12a); the coefficient is about
// twice what it was (3072 before, 6050 now), so protons cross the reservoir
// by walking and ATP synthase seldom has to pull one from far away.
const DIFFUSION = { sigma: 110, tau: 0.5 };

// Where a primed proton starts: a place in the reservoir chosen from its id.
export function cloudHome(region, molId) {
  const n = molNumber(molId);
  for (let k = 0; k < 8; k += 1) {
    const point = {
      x: region.x1 + hash(n * 2 + 1 + k * 7919) * (region.x2 - region.x1),
      y: region.y1 + hash(n * 2 + 2 + k * 7919) * (region.y2 - region.y1),
    };
    if (inside(region, point.x, point.y)) return point;
  }
  return { x: (region.x1 + region.x2) / 2, y: (region.y1 + region.y2) / 2 };
}

// A new member of the cloud, at rest where it came out.
export function cloudEntry(region, mol, at, time) {
  const point = inside(region, at.x, at.y) ? at : clampInto(region, at);
  return { mol, since: time, x: point.x, y: point.y, vx: 0, vy: 0 };
}

// One step of the walk. A proton that would leave the reservoir bounces off
// its edge instead. A drift, in units per second, biases the walk: the
// gradient's net flow toward ATP synthase.
export function diffuse(entry, region, dt, tick, motion = DIFFUSION, drift = null) {
  const n = molNumber(entry.mol);
  const keep = Math.exp(-dt / motion.tau);
  const kick = motion.sigma * Math.sqrt(1 - keep * keep);
  entry.vx = entry.vx * keep + kick * normal(n, tick, 1);
  entry.vy = entry.vy * keep + kick * normal(n, tick, 2);
  const x = entry.x + (entry.vx + (drift?.x ?? 0)) * dt;
  if (inside(region, x, entry.y)) entry.x = x;
  else entry.vx = -entry.vx;
  const y = entry.y + (entry.vy + (drift?.y ?? 0)) * dt;
  if (inside(region, entry.x, y)) entry.y = y;
  else entry.vy = -entry.vy;
}

// Inside the reservoir's rectangle and, where the membrane's corners round
// off, inside those too.
function inside(region, x, y) {
  if (x < region.x1 || x > region.x2 || y < region.y1 || y > region.y2) return false;
  return !region.within || inRoundRect(region.within, x, y);
}

function clampInto(region, at) {
  const point = {
    x: Math.min(region.x2, Math.max(region.x1, at.x)),
    y: Math.min(region.y2, Math.max(region.y1, at.y)),
  };
  if (inside(region, point.x, point.y)) return point;
  const mid = { x: (region.x1 + region.x2) / 2, y: (region.y1 + region.y2) / 2 };
  for (let f = 0.1; f <= 1; f += 0.1) {
    const p = { x: point.x + (mid.x - point.x) * f, y: point.y + (mid.y - point.y) * f };
    if (inside(region, p.x, p.y)) return p;
  }
  return mid;
}

function molNumber(molId) {
  return Number.parseInt(String(molId).replace(/\D/g, ''), 10) || 1;
}

// Roughly normal, mean 0 and spread 1, from three uniform draws.
function normal(n, tick, axis) {
  const seed = (Math.imul(n, 0x9e3779b1) ^ Math.imul(tick, 0x85ebca77) ^ Math.imul(axis, 0xc2b2ae3d)) >>> 0;
  return (hash(seed) + hash(seed + 1) + hash(seed + 2) - 1.5) * 2;
}

function hash(n) {
  let t = Math.imul(n, 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
