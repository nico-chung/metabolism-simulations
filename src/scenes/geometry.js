export function traceShape(ctx, shape, begin = true) {
  if (shape.type === 'roundRect') {
    const { x, y, w, h } = shape;
    const r = Math.min(shape.r, w / 2, h / 2);
    if (begin) ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    return;
  }
  if (shape.type === 'ellipse') {
    if (begin) ctx.beginPath();
    ctx.moveTo(shape.cx + shape.rx, shape.cy);
    ctx.ellipse(shape.cx, shape.cy, shape.rx, shape.ry, 0, 0, Math.PI * 2);
    ctx.closePath();
    return;
  }
  throw new Error(`Unknown shape ${shape.type}`);
}

export function inRoundRect(shape, px, py) {
  const { x, y, w, h } = shape;
  const r = Math.min(shape.r, w / 2, h / 2);
  if (px < x || py < y || px > x + w || py > y + h) return false;
  const left = px < x + r;
  const right = px > x + w - r;
  const top = py < y + r;
  const bottom = py > y + h - r;
  if (!(left || right) || !(top || bottom)) return true;
  const cx = left ? x + r : x + w - r;
  const cy = top ? y + r : y + h - r;
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= r * r + 1e-8;
}

export function inEllipse(shape, px, py) {
  const dx = (px - shape.cx) / shape.rx;
  const dy = (py - shape.cy) / shape.ry;
  return dx * dx + dy * dy <= 1 + 1e-8;
}

// Horizontal chord of a rounded rectangle at y, pulled in by inset.
export function roundRectSpanAtY(shape, y, inset = 0) {
  const { x, w, h } = shape;
  const top = shape.y;
  const bottom = top + h;
  if (!(y > top && y < bottom)) return null;
  const r = Math.min(shape.r, w / 2, h / 2);
  let left = x;
  let right = x + w;
  if (y < top + r) {
    const dy = y - (top + r);
    const half = Math.sqrt(Math.max(0, r * r - dy * dy));
    left = Math.max(left, x + r - half);
    right = Math.min(right, x + w - r + half);
  }
  if (y > bottom - r) {
    const dy = y - (bottom - r);
    const half = Math.sqrt(Math.max(0, r * r - dy * dy));
    left = Math.max(left, x + r - half);
    right = Math.min(right, x + w - r + half);
  }
  left += inset;
  right -= inset;
  if (right - left < 1) return null;
  return { x1: left, x2: right };
}
