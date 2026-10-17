// The margin Fit leaves around the scene: more at the bottom, for the
// transport bar.
export const FIT_PAD = { top: 28, right: 28, bottom: 76, left: 28 };
const MAX_ZOOM = 5.5;

function clamp(value, lo, hi) {
  return Math.min(hi, Math.max(lo, value));
}

// How far the user may zoom: out to Fit or half the screen, whichever is
// smaller, and in to MAX_ZOOM.
export function zoomLimits(viewport, bounds, pad = FIT_PAD) {
  const fitZoom = fitCamera(viewport, bounds, pad).zoom;
  return { min: Math.min(fitZoom, halfScreenZoom(viewport, bounds)), max: MAX_ZOOM };
}

export function easeInOut(t) {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - ((-2 * x + 2) ** 3) / 2;
}

export function screenToWorld(camera, viewport, sx, sy) {
  return {
    x: camera.x + (sx - viewport.width / 2) / camera.zoom,
    y: camera.y + (sy - viewport.height / 2) / camera.zoom,
  };
}

export function worldToScreen(camera, viewport, wx, wy) {
  return {
    x: viewport.width / 2 + (wx - camera.x) * camera.zoom,
    y: viewport.height / 2 + (wy - camera.y) * camera.zoom,
  };
}

export function panBy(camera, dx, dy) {
  return {
    ...camera,
    x: camera.x - dx / camera.zoom,
    y: camera.y - dy / camera.zoom,
  };
}

export function zoomAt(camera, viewport, sx, sy, nextZoom, limits) {
  const zoom = clamp(nextZoom, limits.min, limits.max);
  const before = screenToWorld(camera, viewport, sx, sy);
  const zoomed = { ...camera, zoom };
  const after = screenToWorld(zoomed, viewport, sx, sy);
  return {
    ...zoomed,
    x: zoomed.x + before.x - after.x,
    y: zoomed.y + before.y - after.y,
  };
}

export function fitCamera(viewport, bounds, padding = 48) {
  const pad = typeof padding === 'number'
    ? { top: padding, right: padding, bottom: padding, left: padding }
    : padding;
  const availW = Math.max(1, viewport.width - pad.left - pad.right);
  const availH = Math.max(1, viewport.height - pad.top - pad.bottom);
  const zoom = Math.min(availW / bounds.w, availH / bounds.h);
  const contentCx = pad.left + availW / 2;
  const contentCy = pad.top + availH / 2;
  return {
    x: bounds.x + bounds.w / 2 - (contentCx - viewport.width / 2) / zoom,
    y: bounds.y + bounds.h / 2 - (contentCy - viewport.height / 2) / zoom,
    zoom,
  };
}

// Zoom at which the cell is half the viewport in both width and height.
// The larger of the two is the limit, so neither side of the cell is smaller
// than half the screen.
export function halfScreenZoom(viewport, bounds) {
  return Math.max(
    (viewport.width * 0.5) / bounds.w,
    (viewport.height * 0.5) / bounds.h,
  );
}

export function clampCenter(camera, bounds) {
  return {
    ...camera,
    x: clamp(camera.x, bounds.x, bounds.x + bounds.w),
    y: clamp(camera.y, bounds.y, bounds.y + bounds.h),
  };
}
