import type { StairDir } from './StairData'

/**
 * The level format.
 *
 * A level is a list of freely placed objects in world coordinates (x, y, z),
 * with y pointing up. There is no implicit floor: everything you can stand on
 * is a block.
 * @module
 */

/** A point or extent in world coordinates; y points up. */
export interface Vec3 {
  x: number
  y: number
  z: number
}

/**
 * Axis-aligned box: wall, floor, platform, bridge ...
 *
 * The top of every block is walkable, as long as there is enough room above it.
 */
export interface BlockObject {
  type: 'block'
  /** Key in `WALL_TILES` that selects the texture or color. */
  tile: string
  /** Center of the box. */
  position: Vec3
  /** Extent along x, y and z. */
  size: Vec3
}

/**
 * A stair - the only connection between levels of different height.
 *
 * `position.x`/`position.z` is the corner with the smallest x/z and must lie on
 * the tile grid (a multiple of `TILE_SIZE`); `position.y` is the height of the
 * lower end. The stair rises by `STAIR_COUNT * STAIR_HEIGHT` per tile; its upper
 * end needs a surface at exactly that height so enemies can continue there.
 */
export interface StairObject {
  type: 'stair'
  dir: StairDir
  position: Vec3
  /** Number of consecutive stair tiles along the walking direction. */
  tiles: number
}

/** Player spawn; `position.y` is the height of the feet (= top of the block below). */
export interface PlayerSpawnObject {
  type: 'player'
  position: Vec3
}

/** Enemy spawn; `position.y` is the height of the feet (= top of the block below). */
export interface EnemySpawnObject {
  type: 'enemy'
  position: Vec3
}

/** Any object that can be placed in a level. */
export type LevelObject = BlockObject | StairObject | PlayerSpawnObject | EnemySpawnObject

/** A complete level. */
export interface LevelData {
  objects: LevelObject[]
}
