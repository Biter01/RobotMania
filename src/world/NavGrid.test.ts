import { describe, it, expect } from 'vitest'
import { TILE_SIZE } from '../GameConstants'
import { parseLevel } from './Map'
import { NavGrid, NavNode } from './NavGrid'
import { LevelData } from './LevelData'
import { ParsedMap } from '../types'
import { gridLevel } from './testing/gridLevel'
import { DEMO_3D } from './levels/Demo3D'

function navOf(level: LevelData): NavGrid {
  const parsed: ParsedMap = parseLevel(level, TILE_SIZE)
  return new NavGrid(parsed.blocks, parsed.stairs, TILE_SIZE)
}

function heightsAt(nav: NavGrid, col: number, row: number): number[] {
  return nav.nodesAt(col, row).map((n: NavNode): number => n.y)
}

function neighborCells(nav: NavGrid, node: NavNode): string[] {
  return nav.neighbors(node).map((e): string => `${e.node.col},${e.node.row},${e.node.y}`).sort()
}

describe('NavGrid surfaces', () => {
  it('makes the floor walkable and walls not', () => {
    const nav: NavGrid = navOf(gridLevel(['.#.']))

    expect(heightsAt(nav, 0, 0)).toEqual([0])
    expect(heightsAt(nav, 2, 0)).toEqual([0])
    // Unter der Wand ist kein Platz, oben auf der Wand schon
    expect(heightsAt(nav, 1, 0)).toEqual([3])
  })

  it('gives a cell under a bridge two levels', () => {
    const nav: NavGrid = navOf({
      objects: [
        { type: 'block', tile: 'floor', position: { x: 1.5, y: -0.5, z: 0.5 }, size: { x: 3, y: 1, z: 1 } },
        { type: 'block', tile: 'floor', position: { x: 1.5, y: 1.9, z: 0.5 }, size: { x: 1, y: 0.2, z: 1 } },
      ],
    })

    expect(heightsAt(nav, 1, 0)).toEqual([0, 2])
    expect(heightsAt(nav, 0, 0)).toEqual([0])
  })

  it('drops a surface without enough headroom', () => {
    const nav: NavGrid = navOf({
      objects: [
        { type: 'block', tile: 'floor', position: { x: 0.5, y: -0.5, z: 0.5 }, size: { x: 1, y: 1, z: 1 } },
        // Decke nur 0.5 ueber dem Boden
        { type: 'block', tile: 'floor', position: { x: 0.5, y: 0.6, z: 0.5 }, size: { x: 1, y: 0.2, z: 1 } },
      ],
    })

    expect(heightsAt(nav, 0, 0)).toEqual([0.7])
  })

  it('blocks a cell next to a thin off-grid wall it does not cover', () => {
    const nav: NavGrid = navOf({
      objects: [
        { type: 'block', tile: 'floor', position: { x: 1.5, y: -0.5, z: 0.5 }, size: { x: 3, y: 1, z: 1 } },
        // 0.1 dick, steht 0.1 neben der Mitte von Zelle 1
        { type: 'block', tile: 'brick', position: { x: 1.65, y: 1.5, z: 0.5 }, size: { x: 0.1, y: 3, z: 1 } },
      ],
    })

    expect(heightsAt(nav, 1, 0)).toEqual([])
    expect(heightsAt(nav, 0, 0)).toEqual([0])
  })

  it('handles negative coordinates', () => {
    const nav: NavGrid = navOf({
      objects: [{ type: 'block', tile: 'floor', position: { x: -1, y: -0.5, z: -1 }, size: { x: 2, y: 1, z: 2 } }],
    })

    expect(heightsAt(nav, -2, -2)).toEqual([0])
    expect(heightsAt(nav, -1, -1)).toEqual([0])
    expect(heightsAt(nav, 0, 0)).toEqual([])
  })
})

describe('NavGrid.nodeAt', () => {
  it('picks the level closest to the feet', () => {
    const nav: NavGrid = navOf(DEMO_3D)

    expect(nav.nodeAt(11.5, 0, 10.5)?.y).toBe(0)
    expect(nav.nodeAt(11.5, 2, 10.5)?.y).toBe(2)
    // Auf einer Stiege liegen die Fuesse etwas ueber der Rampe
    expect(nav.nodeAt(7.5, 0.6, 3.5)?.stair).not.toBeNull()
  })

  it('returns undefined outside the level', () => {
    expect(navOf(DEMO_3D).nodeAt(-5, 0, -5)).toBeUndefined()
  })
})

describe('NavGrid.neighbors', () => {
  it('connects only cells of the same height', () => {
    const nav: NavGrid = navOf({
      objects: [
        { type: 'block', tile: 'floor', position: { x: 1, y: -0.5, z: 0.5 }, size: { x: 2, y: 1, z: 1 } },
        // Kleine Kante: 0.25 hoeher, aber keine Stiege
        { type: 'block', tile: 'floor', position: { x: 2.5, y: -0.375, z: 0.5 }, size: { x: 1, y: 1.25, z: 1 } },
      ],
    })
    const node: NavNode = nav.nodesAt(1, 0)[0]

    expect(neighborCells(nav, node)).toEqual(['0,0,0'])
  })

  it('does not cut corners', () => {
    const nav: NavGrid = navOf(gridLevel(['.#', '..']))
    const node: NavNode = nav.nodesAt(0, 0).find((n: NavNode): boolean => n.y === 0)!

    expect(neighborCells(nav, node)).toEqual(['0,1,0'])
  })

  it('enters a stair only at its low end along its axis', () => {
    const nav: NavGrid = navOf(gridLevel(['...', '.>.', '...']))
    const stairNode: NavNode = nav.nodesAt(1, 1)[0]

    // Unten raus auf den Boden ja, oben raus nein (dort ist kein Boden auf Stiegenhoehe)
    expect(neighborCells(nav, stairNode)).toEqual(['0,1,0'])
    // Von der Seite nicht hinein
    const side: NavNode = nav.nodesAt(1, 0)[0]
    expect(nav.neighbors(side).some((e): boolean => e.node === stairNode)).toBe(false)
  })

  it('links two levels only through the stair', () => {
    const nav: NavGrid = navOf(DEMO_3D)
    const topOfStair: NavNode = nav.nodesAt(8, 3).find((n: NavNode): boolean => n.stair !== null)!
    const platform: NavNode = nav.nodesAt(9, 3).find((n: NavNode): boolean => n.y === 2)!

    expect(nav.neighbors(topOfStair).map((e): NavNode => e.node)).toContain(platform)
    expect(nav.neighbors(platform).map((e): NavNode => e.node)).toContain(topOfStair)

    // Vom Plattformrand geht kein Schritt direkt auf den Boden
    const edge: NavNode = nav.nodesAt(9, 1).find((n: NavNode): boolean => n.y === 2)!
    expect(nav.neighbors(edge).every((e): boolean => e.node.y === 2)).toBe(true)
  })
})
