import { TILE_SIZE, STAIR_COUNT, STAIR_WIDTH, STAIR_HEIGHT, STAIR_SIDE_THICKNESS } from '../GameConstants'
import type { ColliderBox } from '../types'

// Der Pfeil zeigt bergauf: '>' steigt Richtung +x, '<' Richtung -x,
// '^' Richtung -z (kleinere Zeile), 'v' Richtung +z.
export type StairDir = '<' | '>' | '^' | 'v'

export const STAIR_CHARS: ReadonlySet<string> = new Set<string>(['<', '>', '^', 'v'])

export function isStairChar(ch: string | undefined): ch is StairDir {
  return ch !== undefined && STAIR_CHARS.has(ch)
}

export function isHorizontalStair(dir: StairDir): boolean {
  return dir === '<' || dir === '>'
}

export interface StairTile {
  col: number
  row: number
  // 0 = unterstes Tile der Stiege
  index: number
}

// Eine Stiege aus einem oder mehreren gleich gerichteten Tiles in Achsrichtung.
export class StairData {
  readonly dir: StairDir
  readonly minCol: number
  readonly minRow: number
  readonly maxCol: number
  readonly maxRow: number
  readonly tileCount: number
  readonly DEPTH: number = TILE_SIZE

  // Weltgrenzen
  readonly minX: number
  readonly maxX: number
  readonly minZ: number
  readonly maxZ: number

  public constructor(dir: StairDir, minCol: number, minRow: number, maxCol: number, maxRow: number) {
    this.dir = dir
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

  public get steps(): number {
    return this.tileCount * STAIR_COUNT
  }

  // Lauflaenge der Stiege
  public get WIDTH(): number {
    return STAIR_WIDTH * this.steps
  }

  public get HEIGHT(): number {
    return STAIR_HEIGHT * this.steps
  }

  // Alle Tiles der Stiege, index 0 = unteres Ende
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

  // Hoehe ueber dem Boden an einer Weltposition: Rampe vom unteren zum oberen Ende
  public heightAt(x: number, z: number): number {
    return this.progressAt(x, z) * this.HEIGHT
  }

  // Fortschritt entlang der Stiege vom unteren (0) zum oberen Ende (1), geklemmt
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

// Duenne Collider an den Laengsseiten jedes Stiegen-Tiles - Stiegen sind nur ueber die Enden
// betretbar. Ausnahme: liegt daneben ein Tile einer parallelen Stiege mit gleicher Richtung und
// gleichem index, ist die Hoehe dort identisch und die Fuge bleibt offen (breite Treppe).
export function buildStairColliders(stairs: StairData[]): ColliderBox[] {
  const lookup: Map<string, { dir: StairDir; index: number }> = new Map()
  for (const stair of stairs) {
    for (const { col, row, index } of stair.tiles()) {
      lookup.set(`${col},${row}`, { dir: stair.dir, index })
    }
  }

  const isFlush = (dir: StairDir, index: number, col: number, row: number): boolean => {
    const neighbor: { dir: StairDir; index: number } | undefined = lookup.get(`${col},${row}`)
    return neighbor !== undefined && neighbor.dir === dir && neighbor.index === index
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

  switch (stair.dir) {
      case '>':
        colliders.push({ minX: stair.maxX - END_THICKNESS, maxX: stair.maxX, minY: 0, maxY: stair.HEIGHT/2, minZ: stair.minZ, maxZ: stair.maxZ })
        break
      case '<':
        colliders.push({ minX: stair.minX, maxX: stair.minX + END_THICKNESS, minY: 0, maxY: stair.HEIGHT/2, minZ: stair.minZ, maxZ: stair.maxZ })
        break
      case 'v':
        colliders.push({ minX: stair.minX, maxX: stair.maxX, minY: 0, maxY: stair.HEIGHT/2, minZ: stair.maxZ - END_THICKNESS, maxZ: stair.maxZ })
        break
      case '^':
        colliders.push({ minX: stair.minX, maxX: stair.maxX, minY: 0, maxY: stair.HEIGHT/2, minZ: stair.minZ, maxZ: stair.minZ + END_THICKNESS })
        break
    }
}

function buildSideColliders(stair: StairData, col: number, row: number, index: number, colliders: ColliderBox[], isFlush: (dir: StairDir, index: number, col: number, row: number) => boolean): void {
  const t: number = STAIR_SIDE_THICKNESS*20
  const minX: number = col * TILE_SIZE
  const maxX: number = minX + TILE_SIZE
  const minZ: number = row * TILE_SIZE
  const maxZ: number = minZ + TILE_SIZE
  // Vom Boden bis zur Oberkante dieses Tiles - die Stufen sind Bloecke ab dem Boden (GameField.buildStairs)
  const minY: number = 0
  const maxY: number = (index + 1) * STAIR_COUNT * STAIR_HEIGHT

  if (isHorizontalStair(stair.dir)) {
    if (!isFlush(stair.dir, index, col, row - 1)) colliders.push({ minX, maxX, minY, maxY, minZ, maxZ: minZ + t })
    if (!isFlush(stair.dir, index, col, row + 1)) colliders.push({ minX, maxX, minY, maxY, minZ: maxZ - t, maxZ })
  } else {
    if (!isFlush(stair.dir, index, col - 1, row)) colliders.push({ minX, maxX: minX + t, minY, maxY, minZ, maxZ })
    if (!isFlush(stair.dir, index, col + 1, row)) colliders.push({ minX: maxX - t, maxX, minY, maxY, minZ, maxZ })
  }
}