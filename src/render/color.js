export function darken(hex, amount = 0.28) {
  const value = Number.parseInt(hex.slice(1), 16);
  const channel = (shift) => {
    const byte = (value >> shift) & 255;
    return Math.max(0, Math.round(byte * (1 - amount))).toString(16).padStart(2, '0');
  };
  return `#${channel(16)}${channel(8)}${channel(0)}`;
}

export function mix(hex, toward, amount) {
  const from = Number.parseInt(hex.slice(1), 16);
  const to = Number.parseInt(toward.slice(1), 16);
  const channel = (shift) => {
    const start = (from >> shift) & 255;
    const end = (to >> shift) & 255;
    return Math.round(start + (end - start) * amount).toString(16).padStart(2, '0');
  };
  return `#${channel(16)}${channel(8)}${channel(0)}`;
}

export function rgba(hex, alpha) {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
