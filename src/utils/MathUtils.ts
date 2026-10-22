/**
 * Whether a world position lies on a `'#'` cell of an ASCII map (or outside it).
 * Left over from the former tile array world; not used by the game anymore.
 */
export function isSolid(x: number, z: number, map: string[], tileSize: number): boolean {
  const col = Math.floor(x / tileSize)
  const row = Math.floor(z / tileSize)
  if (row < 0 || row >= map.length) return true
  if (col < 0 || col >= map[0].length) return true
  return map[row][col] === '#'
}

/** Limits `value` to the range [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
