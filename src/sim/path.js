// Paths measured by arc length. A path is a list of line and arc segments.
// Corners of a polyline are replaced by circular fillets, so anything that
// rides a path turns smoothly and keeps its speed through the corner.

export function polyPath(points, radius = 20, closed = false) {
  const pts = points.map((point) => ({ x: point.x, y: point.y }));
  const n = pts.length;
  const corners = [];
  for (let i = 0; i < n; i += 1) {
    const isEnd = !closed && (i === 0 || i === n - 1);
    if (isEnd) {
      corners.push(null);
      continue;
    }
    const prev = pts[(i - 1 + n) % n];
    const here = pts[i];
    const next = pts[(i + 1) % n];
    corners.push(fillet(prev, here, next, radius));
  }
  // Fillets on short segments are shrunk so two never overlap.
  for (let i = 0; i < n; i += 1) {
    const corner = corners[i];
    if (!corner) continue;
    const prev = pts[(i - 1 + n) % n];
    const next = pts[(i + 1) % n];
    const inLen = dist(prev, pts[i]);
    const outLen = dist(pts[i], next);
    const prevCorner = corners[(i - 1 + n) % n];
    const nextCorner = corners[(i + 1) % n];
    const inRoom = prevCorner ? inLen / 2 : inLen;
    const outRoom = nextCorner ? outLen / 2 : outLen;
    const room = Math.min(inRoom, outRoom);
    if (corner.t > room) corners[i] = fillet(prev, pts[i], next, radius * (room / corner.t));
  }
  const segs = [];
  const startAt = (i) => (corners[i] ? corners[i].b : pts[i]);
  const endAt = (i) => (corners[i] ? corners[i].a : pts[i]);
  const count = closed ? n : n - 1;
  for (let i = 0; i < count; i += 1) {
    const j = (i + 1) % n;
    const from = startAt(i);
    const to = endAt(j);
    if (dist(from, to) > 1e-6) segs.push(line(from, to));
    if (corners[j] && (closed || j < n - 1)) segs.push(corners[j].arc);
  }
  return finish(segs, closed);
}

function finish(segs, closed) {
  let s = 0;
  const out = segs.map((seg) => {
    const copy = { ...seg, s0: s };
    s += seg.len;
    return copy;
  });
  return { segs: out, length: s, closed };
}

function line(a, b) {
  return { t: 'L', x0: a.x, y0: a.y, x1: b.x, y1: b.y, len: dist(a, b) };
}

function arcSeg(cx, cy, r, a0, sweep) {
  return { t: 'A', cx, cy, r, a0, sweep, len: Math.abs(sweep) * r };
}

function fillet(prev, here, next, radius) {
  const ux = here.x - prev.x;
  const uy = here.y - prev.y;
  const ul = Math.hypot(ux, uy) || 1;
  const wx = next.x - here.x;
  const wy = next.y - here.y;
  const wl = Math.hypot(wx, wy) || 1;
  const u = { x: ux / ul, y: uy / ul };
  const w = { x: wx / wl, y: wy / wl };
  const cross = u.x * w.y - u.y * w.x;
  const dot = Math.max(-1, Math.min(1, u.x * w.x + u.y * w.y));
  const phi = Math.acos(dot);
  if (phi < 1e-4 || radius <= 0) return null;
  const t = radius * Math.tan(phi / 2);
  const a = { x: here.x - u.x * t, y: here.y - u.y * t };
  const b = { x: here.x + w.x * t, y: here.y + w.y * t };
  const normal = cross > 0 ? { x: -u.y, y: u.x } : { x: u.y, y: -u.x };
  const cx = a.x + normal.x * radius;
  const cy = a.y + normal.y * radius;
  const a0 = Math.atan2(a.y - cy, a.x - cx);
  const sweep = cross > 0 ? phi : -phi;
  return { a, b, t, arc: arcSeg(cx, cy, radius, a0, sweep) };
}

function dist(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function segStart(seg) {
  if (seg.t === 'L') return { x: seg.x0, y: seg.y0 };
  return { x: seg.cx + Math.cos(seg.a0) * seg.r, y: seg.cy + Math.sin(seg.a0) * seg.r };
}

export function segEnd(seg) {
  if (seg.t === 'L') return { x: seg.x1, y: seg.y1 };
  const a = seg.a0 + seg.sweep;
  return { x: seg.cx + Math.cos(a) * seg.r, y: seg.cy + Math.sin(a) * seg.r };
}

// Position and unit tangent at arc length s. Closed paths wrap; open paths
// clamp to their ends.
export function pointAt(path, s, out = {}) {
  let at = s;
  if (path.closed) {
    at %= path.length;
    if (at < 0) at += path.length;
  } else {
    at = Math.max(0, Math.min(path.length, at));
  }
  const segs = path.segs;
  let lo = 0;
  let hi = segs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (segs[mid].s0 <= at) lo = mid;
    else hi = mid - 1;
  }
  const seg = segs[lo];
  const local = Math.min(seg.len, Math.max(0, at - seg.s0));
  if (seg.t === 'L') {
    const f = seg.len > 0 ? local / seg.len : 0;
    out.x = seg.x0 + (seg.x1 - seg.x0) * f;
    out.y = seg.y0 + (seg.y1 - seg.y0) * f;
    out.dx = seg.len > 0 ? (seg.x1 - seg.x0) / seg.len : 1;
    out.dy = seg.len > 0 ? (seg.y1 - seg.y0) / seg.len : 0;
    return out;
  }
  const sign = seg.sweep >= 0 ? 1 : -1;
  const angle = seg.a0 + (seg.len > 0 ? (local / seg.len) * seg.sweep : 0);
  out.x = seg.cx + Math.cos(angle) * seg.r;
  out.y = seg.cy + Math.sin(angle) * seg.r;
  out.dx = -Math.sin(angle) * sign;
  out.dy = Math.cos(angle) * sign;
  return out;
}

// Arc length of the point on the path nearest to (x, y), found by sampling
// and then refining.
export function nearestS(path, x, y) {
  const steps = Math.max(40, Math.ceil(path.length / 4));
  let best = 0;
  let bestD = Infinity;
  const p = {};
  for (let i = 0; i <= steps; i += 1) {
    const s = (i / steps) * path.length;
    pointAt(path, s, p);
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  let span = path.length / steps;
  for (let k = 0; k < 20; k += 1) {
    for (const s of [best - span, best + span]) {
      pointAt(path, s, p);
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = path.closed ? ((s % path.length) + path.length) % path.length : Math.max(0, Math.min(path.length, s));
      }
    }
    span /= 2;
  }
  return best;
}
