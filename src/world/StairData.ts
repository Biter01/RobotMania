import { TILE_SIZE, STAIR_COUNT, STAIR_WIDTH, STAIR_HEIGHT, STAIR_SIDE_THICKNESS } from '../GameConstants'
import type { ColliderBox } from '../types'

/**
 * Direction a stair rises in. The arrow points uphill: `'>'` rises towards +x,
 * `'<'` towards -x, `'^'` towards -z (smaller row) and `'v'` towards +z.
 */
export type StairDir = '<' | '>' | '^' | 'v'

/** All valid {@link StairDir} characters. */
export const STAIR_CHARS: ReadonlySet<string> = new Set<string>(['<', '>', '^', 'v'])

/** Whether `ch` is one of the {@link STAIR_CHARS}. */
export function isStairChar(ch: string | undefined): ch is StairDir {
  return ch !== undefined && STAIR_CHARS.has(ch)
}

/** Whether the stair runs along the x axis (`'<'` or `'>'`). */
export function isHorizontalStair(dir: StairDir): boolean {
  return dir === '<' || dir === '>'
}

/** One grid tile of a stair. */
export interface StairTile {
  col: number
  row: number
  /** Position along the stair; 0 = lowest tile. */
  index: number
}

/**
 * A stair made of one or more tiles in a row along its axis, all rising in the same direction.
 *
 * The stair covers a range of grid tiles and starts at height {@link baseY}.
 * Each tile rises by `STAIR_COUNT * STAIR_HEIGHT`.
 */
export class StairData {
  readonly dir: StairDir
  readonly minCol: number
  readonly minRow: number
  readonly maxCol: number
  readonly maxRow: number
  readonly tileCount: number
  /** Height of the lower end in world coordinates. */
  readonly baseY: number
  readonly DEPTH: number = TILE_SIZE

  // World bounds
  readonly minX: number
  readonly maxX: number
  readonly minZ: number
  readonly maxZ: number

  /**
   * @param dir - Rising direction.
   * @param minCol - Smallest column covered by the stair.
   * @param minRow - Smallest row covered by the stair.
   * @param maxCol - Largest column covered by the stair.
   * @param maxRow - Largest row covered by the stair.
   * @param baseY - Height of the lower end.
   */
  public constructor(dir: StairDir, minCol: number, minRow: number, maxCol: number, maxRow: number, baseY: number = 0) {
    this.dir = dir
    this.baseY = baseY
    this.minCol = minCol
    this.minRow = minRow
    this.maxCol = maxCol
    this.maxRow = maxRow
    this.tileCount = isHorizontalStair(dir) ? maxCol - minCol + 1 : maxRow - minRow + 1

    this.minX = minCol * TILE_SIZE
    this.maxX = (maxCol + 1) * TILE_SIZE
    this.minZ = minRow * TILE_SIZE
    this.maxZ = (maxRow + 1) * TILE_SIZE
  }

  /** Total number of steps. */
  public get steps(): number {
    return this.tileCount * STAIR_COUNT
  }

  /** Walking length of the stair. */
  public get WIDTH(): number {
    return STAIR_WIDTH * this.steps
  }

  /** Total rise from the lower to the upper end. */
  public get HEIGHT(): number {
    return STAIR_HEIGHT * this.steps
  }

  /** Height of the upper end in world coordinates. */
  public get topY(): number {
    return this.baseY + this.HEIGHT
  }

  /** Direction (in tiles) in which the stair rises. */
  public get upStep(): { dCol: number; dRow: number } {
    switch (this.dir) {
      case '>': return { dCol: 1, dRow: 0 }
      case '<': return { dCol: -1, dRow: 0 }
      case 'v': return { dCol: 0, dRow: 1 }
      case '^': return { dCol: 0, dRow: -1 }
    }
  }

  /** Whether the world position lies within the stair's footprint (ignoring height). */
  public containsXZ(x: number, z: number): boolean {
    return x >= this.minX && x < this.maxX && z >= this.minZ && z < this.maxZ
  }

  /** All tiles of the stair, ordered from the lower end (index 0) upwards. */
  public tiles(): StairTile[] {
    const result: StairTile[] = []
    for (let i = 0; i < this.tileCount; i++) {
      switch (this.dir) {
        case '>': result.push({ col: this.minCol + i, row: this.minRow, index: i }); break
        case '<': result.push({ col: this.maxCol - i, row: this.minRow, index: i }); break
        case 'v': result.push({ col: this.minCol, row: this.minRow + i, index: i }); break
        case '^': result.push({ col: this.minCol, row: this.maxRow - i, index: i }); break
      }
    }
    return result
  }

  /**
   * Height above the lower end ({@link baseY}) at a world position, along a ramp
   * from the lower to the upper end.
   */
  public heightAt(x: number, z: number): number {
    return this.progressAt(x, z) * this.HEIGHT
  }

  /** Progress along the stair from the lower (0) to the upper end (1), clamped. */
  public progressAt(x: number, z: number): number {
    let walked: number
    switch (this.dir) {
      case '>': walked = x - this.minX; break
      case '<': walked = this.maxX - x; break
      case 'v': walked = z - this.minZ; break
      case '^': walked = this.maxZ - z; break
    }
    return Math.min(Math.max(walked / this.WIDTH, 0), 1)
  }
}

/**
 * Builds the colliders that make stairs walkable only from their ends.
 *
 * Thin colliders run along the long sides of every stair tile, plus a low
 * collider at the upper end's back. Exception: if the neighbor is a tile of a
 * parallel stair with the same direction, index and base height, the height is
 * identical there and the seam stays open (a wide staircase).
 */
export function buildStairColliders(stairs: StairData[]): ColliderBox[] {
  // Several stairs can lie above each other on one tile - hence a list
  const lookup: Map<string, Array<{ dir: StairDir; index: number; baseY: number }>> = new Map()
  for (const stair of stairs) {
    for (const { col, row, index } of stair.tiles()) {
      const key: string = `${col},${row}`
      const list: Array<{ dir: StairDir; index: number; baseY: number }> = lookup.get(key) ?? []
      list.push({ dir: stair.dir, index, baseY: stair.baseY })
      lookup.set(key, list)
    }
  }

  const isFlush = (stair: StairData, index: number, col: number, row: number): boolean => {
    const neighbors: Array<{ dir: StairDir; index: number; baseY: number }> = lookup.get(`${col},${row}`) ?? []
    return neighbors.some((n): boolean => n.dir === stair.dir && n.index === index && n.baseY === stair.baseY)
  }

  const colliders: ColliderBox[] = []
  
  for (const stair of stairs) {
    for (const { col, row, index } of stair.tiles()) {
      buildSideColliders(stair,col,row,index,colliders, isFlush)
    }
    
    buildBackColliders(stair, colliders)
  }
  return colliders
}


function buildBackColliders(stair:StairData, colliders: ColliderBox[]): void {
  const END_THICKNESS = STAIR_SIDE_THICKNESS * 20
  const minY: number = stair.baseY
  const maxY: number = stair.baseY + stair.HEIGHT / 2

  switch (stair.dir) {
      case '>':
        colliders.push({ minX: stair.maxX - END_THICKNESS, maxX: stair.maxX, minY, maxY, minZ: stair.minZ, maxZ: stair.maxZ })
        break
      case '<':
        colliders.push({ minX: stair.minX, maxX: stair.minX + END_THICKNESS, minY, maxY, minZ: stair.minZ, maxZ: stair.maxZ })
        break
      case 'v':
        colliders.push({ minX: stair.minX, maxX: stair.maxX, minY, maxY, minZ: stair.maxZ - END_THICKNESS, maxZ: stair.maxZ })
        break
      case '^':
        colliders.push({ minX: stair.minX, maxX: stair.maxX, minY, maxY, minZ: stair.minZ, maxZ: stair.minZ + END_THICKNESS })
        break
    }
}

function buildSideColliders(stair: StairData, col: number, row: number, index: number, colliders: ColliderBox[], isFlush: (stair: StairData, index: number, col: number, row: number) => boolean): void {
  const t: number = STAIR_SIDE_THICKNESS*20
  const minX: number = col * TILE_SIZE
  const maxX: number = minX + TILE_SIZE
  const minZ: number = row * TILE_SIZE
  const maxZ: number = minZ + TILE_SIZE
  // From the lower end to the top of this tile - the steps are blocks starting at baseY (GameField.buildStairs)
  const minY: number = stair.baseY
  const maxY: number = stair.baseY + (index + 1) * STAIR_COUNT * STAIR_HEIGHT

  if (isHorizontalStair(stair.dir)) {
    if (!isFlush(stair, index, col, row - 1)) colliders.push({ minX, maxX, minY, maxY, minZ, maxZ: minZ + t })
    if (!isFlush(stair, index, col, row + 1)) colliders.push({ minX, maxX, minY, maxY, minZ: maxZ - t, maxZ })
  } else {
    if (!isFlush(stair, index, col - 1, row)) colliders.push({ minX, maxX: minX + t, minY, maxY, minZ, maxZ })
    if (!isFlush(stair, index, col + 1, row)) colliders.push({ minX: maxX - t, maxX, minY, maxY, minZ, maxZ })
  }
}