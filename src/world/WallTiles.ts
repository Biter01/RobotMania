import { COLOR_FLOOR } from '../GameConstants'

export interface WallTile {
  // Ohne Textur wird der Block nur in color eingefaerbt
  texture?: string
  color?: number
  // Wiederholungen der Textur pro TILE_SIZE (die Block-UVs sind schon auf die
  // Blockgroesse skaliert, siehe GameField.scaleBoxUVs)
  uvScale?: { x: number; y: number }
}

export const DEFAULT_WALL_UV_SCALE: { x: number; y: number } = { x: 1, y: 1 }

// Blocktypen: der Schluessel steht im Level als BlockObject.tile
export const WALL_TILES: Record<string, WallTile> = {
  brick: { texture: './sprites/tiles/BrickWall.png' },
  floor: { color: COLOR_FLOOR },
}
