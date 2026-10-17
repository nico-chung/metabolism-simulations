// `scale` is the current zoom divided by the zoom that fits the cell.
// The fitted view stays Far on any screen size.
export function lodAt(zoom, fitZoom) {
  const scale = zoom / fitZoom;
  if (scale < 1.35) return 'far';
  if (scale < 2.6) return 'mid';
  return 'near';
}

export function reveal(zoom, from, to, reduceMotion = false) {
  if (zoom <= from) return 0;
  if (zoom >= to) return 1;
  const t = (zoom - from) / (to - from);
  const smooth = t * t * (3 - 2 * t);
  if (reduceMotion) return smooth >= 0.5 ? 1 : 0;
  return smooth;
}
