import { TILE_SIZE, WALL_HEIGHT } from '../GameConstants'

export interface WallTile {
  texture: string
  color?: number
  // Kachelung pro Box-Face. Default unten haelt die Pixel quadratisch.
  uvScale?: { x: number; y: number }
}

export const DEFAULT_WALL_UV_SCALE: { x: number; y: number } = {
  x: 1,
  y: WALL_HEIGHT / TILE_SIZE,
}


export const WALL_TILES: Record<string, WallTile> = {
  '#': { texture: './sprites/tiles/BrickWall.png' },
}

export function isWallChar(ch: string): boolean {
  return Object.prototype.hasOwnProperty.call(WALL_TILES, ch)
}
