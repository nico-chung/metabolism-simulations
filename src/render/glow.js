import { rgba } from './color.js';

const sprites = new Map();

// One radial sprite per tag colour. Drawn with drawImage so the halo never
// uses a live shadow blur.
export function glowSprite(color) {
  const cached = sprites.get(color);
  if (cached) return cached;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const mid = size / 2;
  const gradient = ctx.createRadialGradient(mid, mid, size * 0.06, mid, mid, mid);
  gradient.addColorStop(0, rgba(color, 0.9));
  gradient.addColorStop(0.28, rgba(color, 0.38));
  gradient.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  sprites.set(color, canvas);
  return canvas;
}
