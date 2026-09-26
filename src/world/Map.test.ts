import { describe, it, expect } from 'vitest'
import { TILE_SIZE, STAIR_COUNT, STAIR_HEIGHT } from '../GameConstants'
import { parseMap } from './Map'
import { StairData, StairTile, buildStairSideColliders } from './StairData'

function stairsOf(rows: string[]): StairData[] {
  return parseMap(rows, TILE_SIZE).stairs
}

describe('parseMap stairs', () => {
  it('parses a single stair tile', () => {
    const stairs: StairData[] = stairsOf(['.>.'])

    expect(stairs).toHaveLength(1)
    expect(stairs[0].dir).toBe('>')
    expect(stairs[0].tileCount).toBe(1)
    expect(stairs[0].HEIGHT).toBe(STAIR_COUNT * STAIR_HEIGHT)
    expect(stairs[0].WIDTH).toBe(TILE_SIZE)
  })

  it('merges consecutive horizontal stairs of the same direction', () => {
    const stairs: StairData[] = stairsOf(['.>>>.'])

    expect(stairs).toHaveLength(1)
    expect(stairs[0].tileCount).toBe(3)
    expect([stairs[0].minCol, stairs[0].maxCol]).toEqual([1, 3])
    expect(stairs[0].HEIGHT).toBe(3 * STAIR_COUNT * STAIR_HEIGHT)
  })

  it('merges consecutive vertical stairs of the same direction', () => {
    const stairs: StairData[] = stairsOf(['.', '^', '^', '.'])

    expect(stairs).toHaveLength(1)
    expect(stairs[0].tileCount).toBe(2)
    expect([stairs[0].minRow, stairs[0].maxRow]).toEqual([1, 2])
  })

  it('keeps parallel rows and opposite directions apart', () => {
    expect(stairsOf(['>>', '>>'])).toHaveLength(2)
    expect(stairsOf(['<>'])).toHaveLength(2)
    expect(stairsOf(['^', 'v'])).toHaveLength(2)
  })

  it('keeps stair tiles walkable', () => {
    const walkable: string[] = parseMap(['#>#'], TILE_SIZE).walkableTiles.map((t): string => `${t.x},${t.z}`)
    expect(walkable).toEqual(['1,0'])
  })

  it('orders tiles from the low end upwards', () => {
    const low = (rows: string[]): StairTile => stairsOf(rows)[0].tiles()[0]

    expect(low(['>>'])).toMatchObject({ col: 0, row: 0, index: 0 })
    expect(low(['<<'])).toMatchObject({ col: 1, row: 0, index: 0 })
    expect(low(['v', 'v'])).toMatchObject({ col: 0, row: 0, index: 0 })
    expect(low(['^', '^'])).toMatchObject({ col: 0, row: 1, index: 0 })
  })
})

describe('buildStairSideColliders', () => {
  const sidesOf = (rows: string[]): number => buildStairSideColliders(stairsOf(rows)).length

  it('walls both long sides of a single stair tile', () => {
    expect(sidesOf(['.v.'])).toBe(2)
    expect(sidesOf(['.', '>', '.'])).toBe(2)
  })

  it('leaves the seam between flush parallel stairs open', () => {
    expect(sidesOf(['vv'])).toBe(2)
    expect(sidesOf(['^^^'])).toBe(2)
    expect(sidesOf(['>', '>'])).toBe(2)
  })

  it('keeps the seam between opposite directions', () => {
    expect(sidesOf(['v^'])).toBe(4)
  })

  it('keeps the seam where parallel stairs have different heights', () => {
    // Rechte Stiege startet eine Reihe frueher -> in Reihe 1 unterschiedlicher index
    expect(sidesOf(['.v', 'vv'])).toBe(6)
  })
})
