export function isSolid(x: number, z: number, map: string[], tileSize: number): boolean {
  const col = Math.floor(x / tileSize)
  const row = Math.floor(z / tileSize)
  if (row < 0 || row >= map.length) return true
  if (col < 0 || col >= map[0].length) return true
  return map[row][col] === '#'
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
