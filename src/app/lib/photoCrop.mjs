export function photoCrop(width, height, zoom = 1, x = 0.5, y = 0.5) {
  if (![width, height, zoom, x, y].every(Number.isFinite) || width <= 0 || height <= 0) throw new Error('Invalid image dimensions.');
  const size = Math.min(width, height) / Math.max(1, Math.min(zoom, 4));
  return {sx: (width - size) * Math.max(0, Math.min(1, x)), sy: (height - size) * Math.max(0, Math.min(1, y)), size};
}
