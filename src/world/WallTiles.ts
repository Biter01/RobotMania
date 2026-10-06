import { COLOR_FLOOR } from '../GameConstants'

/** Appearance of a block type. */
export interface WallTile {
  /** Image path; without a texture the block is only tinted with {@link color}. */
  texture?: string
  /** Tint, or the plain color if there is no texture. */
  color?: number
  /**
   * Texture repetitions per TILE_SIZE (the block UVs are already scaled to the
   * block size, see `scaleBoxUVs` in `GameField.ts`).
   */
  uvScale?: { x: number; y: number }
}

/** UV scale used when a block type does not define one. */
export const DEFAULT_WALL_UV_SCALE: { x: number; y: number } = { x: 1, y: 1 }

/**
 * Registry of block types. The key is what a level uses as `BlockObject.tile`.
 * A new block type is one entry here, no further code needed.
 */
export const WALL_TILES: Record<string, WallTile> = {
  brick: { texture: './sprites/tiles/BrickWall.png' },
  floor: { color: COLOR_FLOOR },
}
