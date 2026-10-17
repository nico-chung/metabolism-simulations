import { mix } from './color.js';
import { BELTS, LOOPS } from '../sim/engine.js';
import { pointAt, segEnd, segStart } from '../sim/path.js';

// Traces a path, or the part of it between arc lengths a and b, with real
// lines and arcs.
export function tracePath(ctx, path, a = 0, b = path.length, move = true) {
  let started = !move;
  for (const seg of path.segs) {
    const s0 = seg.s0;
    const s1 = seg.s0 + seg.len;
    if (s1 <= a || s0 >= b) continue;
    const from = Math.max(a, s0) - s0;
    const to = Math.min(b, s1) - s0;
    if (seg.t === 'L') {
      const fx = seg.len ? from / seg.len : 0;
      const tx = seg.len ? to / seg.len : 0;
      const x0 = seg.x0 + (seg.x1 - seg.x0) * fx;
      const y0 = seg.y0 + (seg.y1 - seg.y0) * fx;
      if (!started) {
        ctx.moveTo(x0, y0);
        started = true;
      }
      ctx.lineTo(seg.x0 + (seg.x1 - seg.x0) * tx, seg.y0 + (seg.y1 - seg.y0) * tx);
    } else {
      const a0 = seg.a0 + (seg.len ? (from / seg.len) * seg.sweep : 0);
      const a1 = seg.a0 + (seg.len ? (to / seg.len) * seg.sweep : 0);
      if (!started) {
        ctx.moveTo(seg.cx + Math.cos(a0) * seg.r, seg.cy + Math.sin(a0) * seg.r);
        started = true;
      }
      ctx.arc(seg.cx, seg.cy, seg.r, a0, a1, seg.sweep < 0);
    }
  }
}

// Crossings are drawn as underpasses: the belt stops short on both sides of
// the loop it passes under.
const crossings = new Map();
function crossingsOf(scene, beltId) {
  const key = `${scene.id}:${beltId}`;
  if (crossings.has(key)) return crossings.get(key);
  const list = [];
  for (const pair of scene.matrixCrossings ?? []) {
    if (pair.a !== beltId) continue;
    const belt = BELTS[beltId].path;
    const loop = LOOPS[pair.b].path;
    for (const s of intersections(belt, loop)) list.push(s);
  }
  crossings.set(key, list);
  return list;
}

export function intersections(pathA, pathB) {
  const a = sample(pathA, 3);
  const b = sample(pathB, 3);
  const hits = [];
  for (let i = 1; i < a.length; i += 1) {
    for (let j = 1; j < b.length; j += 1) {
      if (segmentsCross(a[i - 1], a[i], b[j - 1], b[j])) {
        const s = a[i - 1].s;
        if (!hits.some((other) => Math.abs(other - s) < 8)) hits.push(s);
      }
    }
  }
  return hits;
}

function sample(path, step) {
  const out = [];
  const p = {};
  for (let s = 0; s <= path.length; s += step) {
    pointAt(path, s, p);
    out.push({ x: p.x, y: p.y, s });
  }
  if (path.closed) out.push({ ...out[0], s: path.length });
  return out;
}

function segmentsCross(p1, p2, p3, p4) {
  const d1 = cross(p3, p4, p1);
  const d2 = cross(p3, p4, p2);
  const d3 = cross(p1, p2, p3);
  const d4 = cross(p1, p2, p4);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

function cross(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

export function drawBelts(ctx, frame) {
  const { scene, tokens, camera } = frame;
  const zoom = camera.zoom;
  // Chevrons move with each track's motor, so a track with nothing flowing
  // along it is drawn still (§16 D2).
  const motors = frame.shot?.motors ?? {};
  const phase = (id) => motors[id]?.phase ?? 0;
  const track = mix(tokens.hairline, tokens['ink-soft'], 0.28);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.strokeStyle = mix(tokens.hairline, tokens['ink-soft'], 0.2);
  ctx.lineWidth = 1 / zoom;
  for (const stub of scene.stubs) {
    ctx.beginPath();
    ctx.moveTo(stub.from.x, stub.from.y);
    ctx.lineTo(stub.to.x, stub.to.y);
    ctx.stroke();
  }

  for (const [id, loop] of Object.entries(LOOPS)) {
    const color = mix(tokens[loop.tint] ?? tokens.hairline, tokens['ink-soft'], 0.42);
    drawTrack(ctx, loop.path, color, zoom, phase(id), []);
  }
  for (const belt of scene.belts) {
    drawTrack(ctx, belt.path, track, zoom, phase(belt.id), crossingsOf(scene, belt.id));
    drawPorts(ctx, belt.path, track, zoom, belt.fork ? [0] : belt.junction ? [1] : [0, 1]);
    if (belt.fork) drawJunction(ctx, belt.path, track, zoom, tokens);
  }
  for (const lane of scene.lanes ?? []) drawLane(ctx, frame, scene.drifts[lane.drift], lane);
  ctx.restore();
}

// A gas lane is dotted, not a belt: gases diffuse, and cross membranes with no
// transporter. The gas molecules on it show the flow, so the lane itself is
// still.
function drawLane(ctx, frame, path, lane) {
  const { tokens, camera } = frame;
  const zoom = camera.zoom;
  const color = mix(tokens.gas, tokens['ink-soft'], 0.55);
  ctx.save();
  const supplies = frame.shot?.supplies;
  const open = lane?.supply && supplies ? supplies[lane.supply] : frame.shot?.oxygen !== false;
  ctx.globalAlpha = open ? 1 : 0.45;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.3 / zoom;
  ctx.setLineDash([1.5 / zoom, 5 / zoom]);
  ctx.beginPath();
  tracePath(ctx, path);
  ctx.stroke();
  ctx.restore();
}

// Where a belt forks: a small open node, so the split reads as a switch.
function drawJunction(ctx, path, color, zoom, tokens) {
  const p = {};
  pointAt(path, path.length, p);
  ctx.beginPath();
  ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = tokens.paper;
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4 / zoom;
  ctx.stroke();
}

function drawTrack(ctx, path, color, zoom, phase, gaps) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2 / zoom;
  const pieces = [];
  let from = 0;
  for (const s of [...gaps].sort((x, y) => x - y)) {
    pieces.push([from, s - 10]);
    from = s + 10;
  }
  pieces.push([from, path.length]);
  for (const [a, b] of pieces) {
    if (b <= a) continue;
    ctx.beginPath();
    tracePath(ctx, path, a, b);
    ctx.stroke();
  }
  for (const s of gaps) {
    for (const end of [s - 10, s + 10]) capAt(ctx, path, end, color, zoom);
  }
  drawChevrons(ctx, path, color, zoom, phase, gaps);
}

function capAt(ctx, path, s, color, zoom) {
  const p = {};
  pointAt(path, s, p);
  const half = 4.5;
  ctx.beginPath();
  ctx.moveTo(p.x - p.dy * half, p.y + p.dx * half);
  ctx.lineTo(p.x + p.dy * half, p.y - p.dx * half);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2 / zoom;
  ctx.stroke();
}

// Small chevrons creep along each track at the speed it really runs.
const CHEVRON_GAP = 26;
function drawChevrons(ctx, path, color, zoom, phase, gaps) {
  if (CHEVRON_GAP * zoom < 9) return;
  const p = {};
  const size = 3.2;
  const offset = phase % CHEVRON_GAP;
  ctx.beginPath();
  for (let s = offset; s < path.length; s += CHEVRON_GAP) {
    if (!path.closed && (s < 8 || s > path.length - 8)) continue;
    if (gaps.some((g) => Math.abs(g - s) < 14)) continue;
    pointAt(path, s, p);
    const bx = p.x - p.dx * size;
    const by = p.y - p.dy * size;
    ctx.moveTo(bx - p.dy * size, by + p.dx * size);
    ctx.lineTo(p.x, p.y);
    ctx.lineTo(bx + p.dy * size, by - p.dx * size);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 1 / zoom;
  ctx.stroke();
}

// A small notch where a track meets a station.
function drawPorts(ctx, path, color, zoom, which = [0, 1]) {
  const ends = [segStart(path.segs[0]), segEnd(path.segs[path.segs.length - 1])];
  const p = {};
  ends.forEach((end, i) => {
    if (!which.includes(i)) return;
    pointAt(path, i === 0 ? 0 : path.length, p);
    const half = 5;
    ctx.beginPath();
    ctx.moveTo(end.x - p.dy * half, end.y + p.dx * half);
    ctx.lineTo(end.x + p.dy * half, end.y - p.dx * half);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6 / zoom;
    ctx.stroke();
  });
}
