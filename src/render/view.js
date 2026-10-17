export function setScreen(ctx, dpr) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function setWorld(ctx, dpr, viewport, camera) {
  const { zoom, x, y } = camera;
  ctx.setTransform(
    dpr * zoom,
    0,
    0,
    dpr * zoom,
    dpr * (viewport.width / 2 - x * zoom),
    dpr * (viewport.height / 2 - y * zoom),
  );
}

// The world rectangle on screen, grown by `margin` world units on each side.
// Anything wholly outside it is not drawn.
export function visibleRect(viewport, camera, margin) {
  const hw = viewport.width / 2 / camera.zoom + margin;
  const hh = viewport.height / 2 / camera.zoom + margin;
  return { left: camera.x - hw, top: camera.y - hh, right: camera.x + hw, bottom: camera.y + hh };
}

// True when the box (left, top, right, bottom) touches the rectangle. With no
// rectangle, as when a caller draws outside drawStage, everything is visible.
export function boxVisible(rect, left, top, right, bottom) {
  if (!rect) return true;
  return right >= rect.left && left <= rect.right && bottom >= rect.top && top <= rect.bottom;
}

export function pointVisible(rect, x, y) {
  return boxVisible(rect, x, y, x, y);
}
