import { describe, it, expect } from 'vitest'
import { TILE_SIZE } from '../../GameConstants'
import { parseLevel } from '../../world/Map'
import { NavGrid, NavNode } from '../../world/NavGrid'
import { LevelData } from '../../world/LevelData'
import { ParsedMap } from '../../types'
import { gridLevel } from '../../world/testing/gridLevel'
import { DEMO_3D } from '../../world/levels/Demo3D'
import { LEVEL_2 } from '../../world/levels/Level2'
import { AstarPathfinding } from './AstarPathfinding'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function navOf(level: LevelData): NavGrid {
  const parsed: ParsedMap = parseLevel(level, TILE_SIZE)
  return new NavGrid(parsed.blocks, parsed.stairs, TILE_SIZE)
}

// Knoten auf Bodenhoehe (oder der angegebenen Hoehe) einer Zelle
function at(nav: NavGrid, col: number, row: number, y: number = 0): NavNode {
  const node: NavNode | undefined = nav.nodesAt(col, row).find((n: NavNode): boolean => Math.abs(n.y - y) < 1e-6)
  if (!node) throw new Error(`no node at ${col},${row},${y}`)
  return node
}

function cells(path: NavNode[]): Array<[number, number]> {
  return path.map((n: NavNode): [number, number] => [n.col, n.row])
}

function stepCost(dx: number, dy: number): number {
  return dx !== 0 && dy !== 0 ? Math.SQRT2 : 1
}

function pathCost(path: NavNode[]): number {
  let total: number = 0
  for (let i = 1; i < path.length; i++) {
    total += stepCost(path[i].col - path[i - 1].col, path[i].row - path[i - 1].row)
  }
  return total
}

const NEIGHBOURS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1],
]

// Referenz: Dijkstra direkt auf dem ASCII-Raster (eine Ebene, keine Stiegen) mit
// derselben Eckenregel - unabhaengig von NavGrid, damit die Tests nicht sich selbst pruefen.
function optimalCost(rows: string[], start: [number, number], goal: [number, number]): number {
  const free = (x: number, y: number): boolean => rows[y]?.[x] === '.'
  if (!free(...start) || !free(...goal)) return -1

  const best: Map<string, number> = new Map([[`${start[0]},${start[1]}`, 0]])
  const queue: Array<[number, number, number]> = [[start[0], start[1], 0]]
  while (queue.length > 0) {
    queue.sort((a, b): number => a[2] - b[2])
    const [cx, cy, cost] = queue.shift()!
    if (cost > (best.get(`${cx},${cy}`) ?? Infinity)) continue
    if (cx === goal[0] && cy === goal[1]) return cost
    for (const [dx, dy] of NEIGHBOURS) {
      if (!free(cx + dx, cy + dy)) continue
      if (dx !== 0 && dy !== 0 && (!free(cx + dx, cy) || !free(cx, cy + dy))) continue
      const next: number = cost + stepCost(dx, dy)
      const k: string = `${cx + dx},${cy + dy}`
      if (next < (best.get(k) ?? Infinity) - 1e-12) {
        best.set(k, next)
        queue.push([cx + dx, cy + dy, next])
      }
    }
  }
  return -1
}

// Deterministischer Zufall fuer den Fuzz-Test
function mulberry32(seed: number): () => number {
  let a: number = seed
  return (): number => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t: number = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const finder: AstarPathfinding = new AstarPathfinding()

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('trivial cases', () => {
  const nav: NavGrid = navOf(gridLevel(['.....', '.....']))

  it('returns just the start when start and goal are the same node', () => {
    expect(cells(finder.findPath(at(nav, 2, 1), at(nav, 2, 1), nav))).toEqual([[2, 1]])
  })

  it('starts the path with the start node', () => {
    const path: NavNode[] = finder.findPath(at(nav, 0, 0), at(nav, 4, 0), nav)
    expect(cells(path)[0]).toEqual([0, 0])
    expect(cells(path)[path.length - 1]).toEqual([4, 0])
  })

  it('takes a diagonal step for a diagonal neighbour', () => {
    expect(cells(finder.findPath(at(nav, 0, 0), at(nav, 1, 1), nav))).toEqual([[0, 0], [1, 1]])
  })
})

describe('walls', () => {
  it('threads the single gap in a dividing wall', () => {
    const rows: string[] = [
      '.....',
      '.....',
      '##.##',
      '.....',
      '.....',
    ]
    const nav: NavGrid = navOf(gridLevel(rows))
    const path: NavNode[] = finder.findPath(at(nav, 0, 0), at(nav, 4, 4), nav)

    expect(cells(path)).toContainEqual([2, 2])
    expect(pathCost(path)).toBeCloseTo(optimalCost(rows, [0, 0], [4, 4]))
  })

  it('returns an empty path when the goal is sealed off', () => {
    const nav: NavGrid = navOf(gridLevel(['..#..', '..#..', '..#..']))
    expect(finder.findPath(at(nav, 0, 0), at(nav, 4, 2), nav)).toEqual([])
  })

  it('walks around a corner instead of through it', () => {
    const nav: NavGrid = navOf(gridLevel(['.#', '..']))
    expect(cells(finder.findPath(at(nav, 0, 0), at(nav, 1, 1), nav))).toEqual([[0, 0], [0, 1], [1, 1]])
  })
})

describe('optimality', () => {
  it('fuzz - 100 seeded random grids all match the Dijkstra optimum', () => {
    const rand: () => number = mulberry32(42)
    for (let round = 0; round < 100; round++) {
      const w: number = 6 + Math.floor(rand() * 6)
      const h: number = 6 + Math.floor(rand() * 6)
      const rows: string[] = Array.from({ length: h }, (): string =>
        Array.from({ length: w }, (): string => (rand() < 0.28 ? '#' : '.')).join(''))
      const start: [number, number] = [0, 0]
      const goal: [number, number] = [w - 1, h - 1]
      rows[0] = '.' + rows[0].slice(1)
      rows[h - 1] = rows[h - 1].slice(0, w - 1) + '.'

      const nav: NavGrid = navOf(gridLevel(rows))
      const path: NavNode[] = finder.findPath(at(nav, ...start), at(nav, ...goal), nav)
      const expected: number = optimalCost(rows, start, goal)

      if (expected < 0) {
        expect(path).toEqual([])
      } else {
        expect(pathCost(path)).toBeCloseTo(expected)
      }
    }
  })

  it('returns identical results on repeated calls', () => {
    const nav: NavGrid = navOf(LEVEL_2)
    const a: NavNode[] = finder.findPath(nav.nodeAt(9.5, 0, 3.5)!, nav.nodeAt(56.5, 0, 22.5)!, nav)
    const b: NavNode[] = finder.findPath(nav.nodeAt(9.5, 0, 3.5)!, nav.nodeAt(56.5, 0, 22.5)!, nav)
    expect(cells(a)).toEqual(cells(b))
    expect(a.length).toBeGreaterThan(0)
  })
})

describe('performance on LEVEL_2', () => {
  it('finds a long cross-map path quickly', () => {
    const nav: NavGrid = navOf(LEVEL_2)
    const t0: number = performance.now()
    const path: NavNode[] = finder.findPath(nav.nodeAt(1.5, 0, 1.5)!, nav.nodeAt(58.5, 0, 58.5)!, nav)
    expect(path.length).toBeGreaterThan(0)
    expect(performance.now() - t0).toBeLessThan(100)
  })
})

describe('stairs and levels', () => {
  it('walks up a stair onto a platform and over a bridge', () => {
    const nav: NavGrid = navOf(DEMO_3D)
    const path: NavNode[] = finder.findPath(at(nav, 2, 2), at(nav, 12, 14, 2), nav)

    expect(path.length).toBeGreaterThan(0)
    // Die Stiege ist der einzige Weg nach oben
    expect(path.some((n: NavNode): boolean => n.stair !== null)).toBe(true)
    // Ueber die Bruecke (Hoehe 2), nicht unten durch
    expect(path.some((n: NavNode): boolean => n.row === 10 && n.y === 2)).toBe(true)
    // Hoehe aendert sich nur auf der Stiege
    for (let i = 1; i < path.length; i++) {
      const a: NavNode = path[i - 1]
      const b: NavNode = path[i]
      if (!a.stair && !b.stair) expect(b.y).toBe(a.y)
    }
  })

  it('stays on the floor when walking under the bridge', () => {
    const nav: NavGrid = navOf(DEMO_3D)
    const path: NavNode[] = finder.findPath(at(nav, 11, 12), at(nav, 11, 8), nav)

    expect(path.every((n: NavNode): boolean => n.y === 0)).toBe(true)
    expect(pathCost(path)).toBe(4)
  })

  it('cannot reach a platform that has no stair', () => {
    const level: LevelData = {
      objects: [
        { type: 'block', tile: 'floor', position: { x: 3, y: -0.5, z: 1.5 }, size: { x: 6, y: 1, z: 3 } },
        { type: 'block', tile: 'brick', position: { x: 4.5, y: 1, z: 1.5 }, size: { x: 3, y: 2, z: 3 } },
      ],
    }
    const nav: NavGrid = navOf(level)
    expect(finder.findPath(at(nav, 0, 1), at(nav, 4, 1, 2), nav)).toEqual([])
  })

  it('does not enter a stair from the side', () => {
    const nav: NavGrid = navOf(gridLevel(['...', '.v.', '...']))
    const path: NavNode[] = finder.findPath(at(nav, 0, 1), at(nav, 2, 1), nav)
    expect(path.every((n: NavNode): boolean => n.stair === null)).toBe(true)
  })

  it('walks along a composed stair in its direction only', () => {
    // Stiege fuehrt von y=0 auf eine Plattform mit Oberseite 3 (3 Tiles x 1)
    const level: LevelData = {
      objects: [
        { type: 'block', tile: 'floor', position: { x: 4, y: -0.5, z: 0.5 }, size: { x: 8, y: 1, z: 1 } },
        { type: 'stair', dir: '>', position: { x: 1, y: 0, z: 0 }, tiles: 3 },
        { type: 'block', tile: 'brick', position: { x: 6, y: 1.5, z: 0.5 }, size: { x: 4, y: 3, z: 1 } },
      ],
    }
    const nav: NavGrid = navOf(level)
    const path: NavNode[] = finder.findPath(at(nav, 0, 0), at(nav, 7, 0, 3), nav)

    expect(cells(path)).toEqual([[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0]])
    expect(path.slice(1, 4).map((n: NavNode): number => n.stairIndex)).toEqual([0, 1, 2])
  })
})
