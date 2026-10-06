import { describe, it, expect } from 'vitest'
import { TILE_SIZE, STAIR_COUNT, STAIR_HEIGHT } from '../GameConstants'
import { parseLevel } from './Map'
import { StairData, StairTile, buildStairColliders } from './StairData'
import { LevelData } from './LevelData'
import { ColliderBox, ParsedMap } from '../types'

const TILE_HEIGHT: number = STAIR_COUNT * STAIR_HEIGHT

describe('parseLevel', () => {
  it('keeps blocks with their full 3D position and size', () => {
    const level: LevelData = {
      objects: [{ type: 'block', tile: 'brick', position: { x: 2, y: 3.5, z: -1 }, size: { x: 4, y: 1, z: 0.5 } }],
    }
    expect(parseLevel(level, TILE_SIZE).blocks).toEqual([
      { tile: 'brick', position: { x: 2, y: 3.5, z: -1 }, size: { x: 4, y: 1, z: 0.5 } },
    ])
  })

  it('reads spawns including their height', () => {
    const parsed: ParsedMap = parseLevel({
      objects: [
        { type: 'player', position: { x: 1.5, y: 2, z: 3.5 } },
        { type: 'enemy', position: { x: 4.5, y: 0, z: 0.5 } },
        { type: 'enemy', position: { x: 2.5, y: 6, z: 2.5 } },
      ],
    }, TILE_SIZE)

    expect(parsed.playerSpawn).toEqual({ x: 1.5, y: 2, z: 3.5 })
    expect(parsed.enemySpawns).toEqual([{ x: 4.5, y: 0, z: 0.5 }, { x: 2.5, y: 6, z: 2.5 }])
  })

  it('turns a stair object into StairData with tile range and base height', () => {
    const stairs: StairData[] = parseLevel({
      objects: [
        { type: 'stair', dir: '>', position: { x: 3, y: 2, z: 5 }, tiles: 3 },
        { type: 'stair', dir: '^', position: { x: 1, y: 0, z: 1 }, tiles: 2 },
      ],
    }, TILE_SIZE).stairs

    expect([stairs[0].minCol, stairs[0].maxCol, stairs[0].minRow, stairs[0].maxRow]).toEqual([3, 5, 5, 5])
    expect(stairs[0].baseY).toBe(2)
    expect(stairs[0].topY).toBe(2 + 3 * TILE_HEIGHT)
    expect([stairs[1].minCol, stairs[1].maxCol, stairs[1].minRow, stairs[1].maxRow]).toEqual([1, 1, 1, 2])
  })
})

describe('StairData', () => {
  it('orders tiles from the low end upwards', () => {
    const low = (stair: StairData): StairTile => stair.tiles()[0]

    expect(low(new StairData('>', 0, 0, 1, 0))).toMatchObject({ col: 0, row: 0, index: 0 })
    expect(low(new StairData('<', 0, 0, 1, 0))).toMatchObject({ col: 1, row: 0, index: 0 })
    expect(low(new StairData('v', 0, 0, 0, 1))).toMatchObject({ col: 0, row: 0, index: 0 })
    expect(low(new StairData('^', 0, 0, 0, 1))).toMatchObject({ col: 0, row: 1, index: 0 })
  })

  it('points upStep in the rising direction', () => {
    expect(new StairData('>', 0, 0, 0, 0).upStep).toEqual({ dCol: 1, dRow: 0 })
    expect(new StairData('<', 0, 0, 0, 0).upStep).toEqual({ dCol: -1, dRow: 0 })
    expect(new StairData('v', 0, 0, 0, 0).upStep).toEqual({ dCol: 0, dRow: 1 })
    expect(new StairData('^', 0, 0, 0, 0).upStep).toEqual({ dCol: 0, dRow: -1 })
  })
})

describe('buildStairColliders', () => {
  const sidesOf = (stairs: StairData[]): number => buildStairColliders(stairs).length - stairs.length

  it('walls both long sides of a single stair tile', () => {
    expect(sidesOf([new StairData('v', 1, 0, 1, 0)])).toBe(2)
    expect(sidesOf([new StairData('>', 0, 1, 0, 1)])).toBe(2)
  })

  it('leaves the seam between flush parallel stairs open', () => {
    expect(sidesOf([new StairData('v', 0, 0, 0, 0), new StairData('v', 1, 0, 1, 0)])).toBe(2)
  })

  it('keeps the seam between opposite directions', () => {
    expect(sidesOf([new StairData('v', 0, 0, 0, 0), new StairData('^', 1, 0, 1, 0)])).toBe(4)
  })

  it('keeps the seam between parallel stairs on different heights', () => {
    expect(sidesOf([new StairData('v', 0, 0, 0, 0, 0), new StairData('v', 1, 0, 1, 0, 2)])).toBe(4)
  })

  it('lifts the colliders of an elevated stair to its base height', () => {
    const colliders: ColliderBox[] = buildStairColliders([new StairData('>', 0, 0, 0, 0, 3)])
    for (const c of colliders) {
      expect(c.minY).toBe(3)
      expect(c.maxY).toBeGreaterThan(3)
    }
  })
})
