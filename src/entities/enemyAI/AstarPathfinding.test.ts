import * as THREE from 'three'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TILE_SIZE } from '../../GameConstants'
import { LEVEL_2 } from '../../world/MapData'
import { parseMap } from '../../world/Map'

/**
 * Walkability seam. The real GameField singleton cannot be constructed in Node:
 * its ctor builds THREE geometry and `new Enemy(...)`, which calls
 * loadPixelTexture() -> DOM TextureLoader. It also has a private static instance
 * with no reset method. Factory-mocking the whole module keeps the real
 * GameField -> Enemy -> AssetLoader graph from ever loading.
 */
let isWalkableImpl: (x: number, z: number) => boolean = (): boolean => true

vi.mock('../../world/GameField', () => ({
  GameField: {
    getInstance: (): { isTileWalkable: (x: number, z: number) => boolean } => ({
      isTileWalkable: (x: number, z: number): boolean => isWalkableImpl(x, z),
    }),
  },
}))

import { AstarPathfinding } from './AstarPathfinding'

// ---------------------------------------------------------------------------
// Fixtures & helpers
// ---------------------------------------------------------------------------

/**
 * Installs an ASCII grid as the walkable set. Reuses the production parseMap so
 * fixtures cannot drift from real level semantics ('#' wall, everything else
 * walkable; walkableTiles come back as grid indices).
 */
function useGrid(rows: string[]): void {
  const walkable: Set<string> = new Set(
    parseMap(rows, TILE_SIZE).walkableTiles.map((t): string => `${t.x},${t.z}`)
  )
  isWalkableImpl = (x: number, z: number): boolean => walkable.has(`${x},${z}`)
}

/** Marks every tile walkable, including negative coordinates. */
function useOpenWorld(): void {
  isWalkableImpl = (): boolean => true
}

/** Grid cell -> world-space centre, matching Map.ts:14-15 and EnemyAI.ts:161-165. */
function worldCentre(col: number, row: number): THREE.Vector2 {
  return new THREE.Vector2(col * TILE_SIZE + TILE_SIZE / 2, row * TILE_SIZE + TILE_SIZE / 2)
}

function tuples(path: THREE.Vector2[]): Array<[number, number]> {
  return path.map((v): [number, number] => [v.x, v.y])
}

/**
 * Step cost, mirroring exploreNeighbors (AstarPathfinding.ts:118): a straight
 * step costs 1, a diagonal one sqrt(2). That makes the objective the real world
 * distance travelled, not the number of tiles touched -- a shorter path in
 * steps can easily be the longer walk.
 */
function stepCost(dx: number, dy: number): number {
  return dx !== 0 && dy !== 0 ? Math.SQRT2 : 1
}

/**
 * Whether a step is legal, mirroring exploreNeighbors: the target must be
 * walkable, and a diagonal additionally needs BOTH orthogonal tiles it squeezes
 * past to be free, so nothing clips through a wall corner.
 */
function canStep(
  x: number,
  y: number,
  dx: number,
  dy: number,
  isWalkable: (x: number, z: number) => boolean
): boolean {
  if (!isWalkable(x + dx, y + dy)) return false
  if (dx === 0 || dy === 0) return true
  return isWalkable(x + dx, y) && isWalkable(x, y + dy)
}

/**
 * Ground truth: Dijkstra over the same octile costs and the same corner rule the
 * implementation uses. Returns the optimal path cost, or -1 if unreachable. A
 * sorted-array queue is fast enough here -- the largest fixture is LEVEL_2, and
 * pathfinder runtime has its own test.
 */
function optimalCost(
  start: [number, number],
  goal: [number, number],
  isWalkable: (x: number, z: number) => boolean
): number {
  if (!isWalkable(...start) || !isWalkable(...goal)) return -1

  const best: Map<string, number> = new Map([[`${start[0]},${start[1]}`, 0]])
  const queue: Array<[number, number, number]> = [[start[0], start[1], 0]]

  while (queue.length > 0) {
    queue.sort((a, b): number => a[2] - b[2])
    const [cx, cy, cost] = queue.shift()!
    if (cost > (best.get(`${cx},${cy}`) ?? Infinity)) continue
    if (cx === goal[0] && cy === goal[1]) return cost

    for (const dir of NEIGHBOURS) {
      const nx: number = cx + dir[0]
      const ny: number = cy + dir[1]
      if (!canStep(cx, cy, dir[0], dir[1], isWalkable)) continue

      const key = `${nx},${ny}`
      const next: number = cost + stepCost(dir[0], dir[1])
      if (next < (best.get(key) ?? Infinity) - 1e-12) {
        best.set(key, next)
        queue.push([nx, ny, next])
      }
    }
  }
  return -1
}

/** Octile cost of a returned path, comparable against optimalCost. */
function pathCost(path: THREE.Vector2[]): number {
  let total = 0
  for (let i = 1; i < path.length; i++) {
    total += stepCost(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y)
  }
  return total
}

const NEIGHBOURS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
]

/** Deterministic PRNG so the fuzz test is reproducible without a dependency. */
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

/** Invariants every returned path must satisfy, regardless of optimality. */
function assertValidPath(
  path: THREE.Vector2[],
  start: [number, number],
  goal: [number, number]
): void {
  expect(path.length).toBeGreaterThan(0)
  expect([path[0].x, path[0].y]).toEqual(start)
  expect([path[path.length - 1].x, path[path.length - 1].y]).toEqual(goal)

  for (const tile of path) {
    expect(isWalkableImpl(tile.x, tile.y)).toBe(true)
  }

  for (let i = 1; i < path.length; i++) {
    const dx: number = path[i].x - path[i - 1].x
    const dy: number = path[i].y - path[i - 1].y
    // Contiguous single step in one or both axes, and never a repeated tile.
    expect(Math.max(Math.abs(dx), Math.abs(dy))).toBe(1)
    // ... and no diagonal squeezing past a wall corner.
    expect(canStep(path[i - 1].x, path[i - 1].y, dx, dy, isWalkableImpl)).toBe(true)
  }
}

beforeEach((): void => {
  useOpenWorld()
})

// ---------------------------------------------------------------------------

describe('coordinate contract', () => {
  it('takes world coordinates in and returns grid tiles out', () => {
    const path: THREE.Vector2[] = new AstarPathfinding().findPath(
      worldCentre(1, 1),
      worldCentre(3, 1)
    )

    expect([path[0].x, path[0].y]).toEqual([1, 1])
    expect([path[path.length - 1].x, path[path.length - 1].y]).toEqual([3, 1])
    // Grid indices, not world units: worldCentre(3, 1) is (7, 3) in world space.
    expect(path[path.length - 1].x).not.toBe(7)
  })

  it('path[0] is the start tile, not the first step', () => {
    const path: THREE.Vector2[] = new AstarPathfinding().findPath(
      worldCentre(2, 2),
      worldCentre(5, 2)
    )
    expect([path[0].x, path[0].y]).toEqual([2, 2])
  })

  it('floors world coordinates onto tiles at tile boundaries', () => {
    const finder: AstarPathfinding = new AstarPathfinding()

    // TILE_SIZE is 2: world x = 4.0 is the first world unit of tile 2 ...
    const onBoundary: THREE.Vector2[] = finder.findPath(
      new THREE.Vector2(4.0, 1),
      worldCentre(6, 0)
    )
    expect(onBoundary[0].x).toBe(2)

    // ... and world x = 3.999 is still tile 1.
    const belowBoundary: THREE.Vector2[] = finder.findPath(
      new THREE.Vector2(3.999, 1),
      worldCentre(6, 0)
    )
    expect(belowBoundary[0].x).toBe(1)
  })

  it('uses Math.floor, so negative world coordinates map to negative tiles', () => {
    // floor(-0.5 / 2) === -1, whereas truncation would give 0.
    const path: THREE.Vector2[] = new AstarPathfinding().findPath(
      new THREE.Vector2(-0.5, -0.5),
      worldCentre(1, 1)
    )
    expect([path[0].x, path[0].y]).toEqual([-1, -1])
  })
})

describe('trivial cases', () => {
  it('returns a single-tile path when start and goal are the same tile', () => {
    const path: THREE.Vector2[] = new AstarPathfinding().findPath(
      worldCentre(4, 4),
      worldCentre(4, 4)
    )
    expect(path).toHaveLength(1)
    expect([path[0].x, path[0].y]).toEqual([4, 4])
  })

  it('returns a single-tile path when both positions fall inside one tile', () => {
    // Different world coords, same tile.
    const path: THREE.Vector2[] = new AstarPathfinding().findPath(
      new THREE.Vector2(4.1, 4.1),
      new THREE.Vector2(5.9, 5.9)
    )
    expect(path).toHaveLength(1)
    expect([path[0].x, path[0].y]).toEqual([2, 2])
  })

  it('returns two tiles for an orthogonally adjacent goal', () => {
    const path: THREE.Vector2[] = new AstarPathfinding().findPath(
      worldCentre(3, 3),
      worldCentre(4, 3)
    )
    expect(path).toHaveLength(2)
    assertValidPath(path, [3, 3], [4, 3])
  })

  it('returns two tiles for a diagonally adjacent goal', () => {
    const path: THREE.Vector2[] = new AstarPathfinding().findPath(
      worldCentre(3, 3),
      worldCentre(4, 4)
    )
    expect(path).toHaveLength(2)
    assertValidPath(path, [3, 3], [4, 4])
  })
})

describe('open ground', () => {
  const OPEN_10x10: string[] = Array.from({ length: 10 }, (): string => '..........')

  beforeEach((): void => {
    useGrid(OPEN_10x10)
  })

  it('walks a straight horizontal line in Chebyshev-many steps', () => {
    const path: THREE.Vector2[] = new AstarPathfinding().findPath(
      worldCentre(0, 4),
      worldCentre(7, 4)
    )
    assertValidPath(path, [0, 4], [7, 4])
    expect(path.length - 1).toBe(7)
  })

  it('walks a straight vertical line in Chebyshev-many steps', () => {
    const path: THREE.Vector2[] = new AstarPathfinding().findPath(
      worldCentre(4, 0),
      worldCentre(4, 6)
    )
    assertValidPath(path, [4, 0], [4, 6])
    expect(path.length - 1).toBe(6)
  })

  it('walks a pure diagonal rather than stepping around it', () => {
    const path: THREE.Vector2[] = new AstarPathfinding().findPath(
      worldCentre(0, 0),
      worldCentre(6, 6)
    )
    assertValidPath(path, [0, 0], [6, 6])
    expect(path.length - 1).toBe(6)
  })

  it('reaches every goal in the grid at Chebyshev cost', () => {
    const finder: AstarPathfinding = new AstarPathfinding()

    for (let gx = 0; gx < 10; gx++) {
      for (let gy = 0; gy < 10; gy++) {
        const path: THREE.Vector2[] = finder.findPath(worldCentre(0, 0), worldCentre(gx, gy))
        assertValidPath(path, [0, 0], [gx, gy])
        expect(path.length - 1).toBe(Math.max(gx, gy))
      }
    }
  })
})

describe('walls', () => {
  it('threads the single gap in a dividing wall', () => {
    useGrid([
      '.....#.....',
      '.....#.....',
      '.....#.....',
      '...........', // the gap, row 3
      '.....#.....',
      '.....#.....',
      '.....#.....',
    ])

    const path: THREE.Vector2[] = new AstarPathfinding().findPath(
      worldCentre(1, 0),
      worldCentre(9, 0)
    )

    assertValidPath(path, [1, 0], [9, 0])
    // Crossing column 5 is only possible on row 3.
    const crossing: THREE.Vector2 | undefined = path.find((t): boolean => t.x === 5)
    expect(crossing).toBeDefined()
    expect(crossing!.y).toBe(3)
  })

  it('routes around a U-shaped dead end without entering a wall', () => {
    useGrid([
      '.........',
      '.#######.',
      '.#.....#.',
      '.#..X..#.', // 'X' is not '#', so parseMap treats it as walkable
      '.#.....#.',
      '.#######.',
      '.........',
    ])

    const path: THREE.Vector2[] = new AstarPathfinding().findPath(
      worldCentre(0, 0),
      worldCentre(8, 6)
    )

    assertValidPath(path, [0, 0], [8, 6])
    // Every tile walkable is already asserted; make the wall claim explicit.
    for (const tile of path) {
      expect(isWalkableImpl(tile.x, tile.y)).toBe(true)
    }
  })

  it('navigates a corridor maze', () => {
    useGrid([
      '#########',
      '#.......#',
      '#.#####.#',
      '#.#...#.#',
      '#.#.#.#.#',
      '#...#...#',
      '#########',
    ])

    const path: THREE.Vector2[] = new AstarPathfinding().findPath(
      worldCentre(1, 1),
      worldCentre(3, 3)
    )
    assertValidPath(path, [1, 1], [3, 3])
  })
})

describe('no path', () => {
  it('returns an empty array when the goal is sealed off', () => {
    useGrid([
      '#########',
      '#.......#',
      '#.......#',
      '#########',
      '#.......#', // sealed room, unreachable from above
      '#.......#',
      '#########',
    ])

    const path: THREE.Vector2[] = new AstarPathfinding().findPath(
      worldCentre(1, 1),
      worldCentre(5, 5)
    )
    expect(path).toEqual([])
  })

  it('returns an empty array when the goal tile is itself a wall', () => {
    // The goal is never validated up front, so this costs a full flood fill of
    // every reachable tile before the heap empties and [] is returned.
    useGrid([
      '#########',
      '#.......#',
      '#...#...#',
      '#.......#',
      '#########',
    ])

    const path: THREE.Vector2[] = new AstarPathfinding().findPath(
      worldCentre(1, 1),
      worldCentre(4, 2)
    )
    expect(path).toEqual([])
  })

  it('CHARACTERIZATION: start tile is never validated, so a path can begin inside a wall', () => {
    // AstarPathfinding.ts:78 pushes the start node without an isValidTile check.
    // This is a latent bug (resolveSeparation in EnemyAI.ts:67-93 nudges enemies
    // off tile centres every frame and can push one into a wall), not desired
    // behaviour. Pinned here so a future fix is a deliberate change.
    useGrid([
      '.....',
      '.#...', // start tile (1,1) is a wall
      '.....',
      '.....',
    ])

    const path: THREE.Vector2[] = new AstarPathfinding().findPath(
      worldCentre(1, 1),
      worldCentre(4, 3)
    )

    expect(path.length).toBeGreaterThan(0)
    expect([path[0].x, path[0].y]).toEqual([1, 1])
    expect(isWalkableImpl(path[0].x, path[0].y)).toBe(false)
    // Every tile after the start is walkable, though.
    for (const tile of path.slice(1)) {
      expect(isWalkableImpl(tile.x, tile.y)).toBe(true)
    }
  })
})

describe('statelessness across calls', () => {
  it('returns identical results for the same query on the same instance', () => {
    useGrid([
      '.....#.....',
      '.....#.....',
      '...........',
      '.....#.....',
      '.....#.....',
    ])

    const finder: AstarPathfinding = new AstarPathfinding()
    const first: THREE.Vector2[] = finder.findPath(worldCentre(0, 0), worldCentre(9, 4))
    const second: THREE.Vector2[] = finder.findPath(worldCentre(0, 0), worldCentre(9, 4))

    expect(tuples(second)).toEqual(tuples(first))
  })

  it('does not leak heap state between different queries', () => {
    useGrid([
      '.........',
      '.........',
      '....#....',
      '.........',
      '.........',
    ])

    const finder: AstarPathfinding = new AstarPathfinding()
    const routeA: THREE.Vector2[] = finder.findPath(worldCentre(0, 0), worldCentre(8, 4))
    finder.findPath(worldCentre(8, 0), worldCentre(0, 4))
    const routeAgain: THREE.Vector2[] = finder.findPath(worldCentre(0, 0), worldCentre(8, 4))

    expect(tuples(routeAgain)).toEqual(tuples(routeA))
  })
})

describe('findNextTile', () => {
  it('returns the second tile of the path', () => {
    useGrid(Array.from({ length: 6 }, (): string => '......'))

    const finder: AstarPathfinding = new AstarPathfinding()
    const path: THREE.Vector2[] = finder.findPath(worldCentre(0, 0), worldCentre(5, 5))
    const next: THREE.Vector2 = finder.findNextTile(worldCentre(0, 0), worldCentre(5, 5))

    expect([next.x, next.y]).toEqual([path[1].x, path[1].y])
  })

  it('falls back to the own tile when start and goal are the same', () => {
    const next: THREE.Vector2 = new AstarPathfinding().findNextTile(
      worldCentre(3, 3),
      worldCentre(3, 3)
    )
    expect([next.x, next.y]).toEqual([3, 3])
  })

  it('falls back to the own tile when the goal is unreachable', () => {
    useGrid([
      '#########',
      '#.......#',
      '#########',
      '#.......#',
      '#########',
    ])

    const next: THREE.Vector2 = new AstarPathfinding().findNextTile(
      worldCentre(1, 1),
      worldCentre(5, 3)
    )
    expect([next.x, next.y]).toEqual([1, 1])
  })
})

describe('performance and termination on LEVEL_2', () => {
  beforeEach((): void => {
    useGrid(LEVEL_2)
  })

  it('finds a long cross-map path quickly', () => {
    const start: [number, number] = [1, 1]
    const goal: [number, number] = [58, 58]
    expect(isWalkableImpl(...start)).toBe(true)
    expect(isWalkableImpl(...goal)).toBe(true)

    const began: number = performance.now()
    const path: THREE.Vector2[] = new AstarPathfinding().findPath(
      worldCentre(...start),
      worldCentre(...goal)
    )
    const elapsed: number = performance.now() - began

    assertValidPath(path, start, goal)
    expect(elapsed).toBeLessThan(500)
  })

  it('terminates on an unreachable goal instead of looping forever', { timeout: 5000 }, () => {
    // Worst case in the game: no path means a full flood fill of the level, and
    // EnemyAI.ts:98 re-runs exactly this every frame while path.length === 0.
    const path: THREE.Vector2[] = new AstarPathfinding().findPath(
      worldCentre(1, 1),
      worldCentre(-5, -5) // outside the map, so never in the walkable set
    )
    expect(path).toEqual([])
  })
})

describe('optimality under octile costs', () => {
  /**
   * exploreNeighbors (AstarPathfinding.ts:118) charges 1 for a straight step and
   * sqrt(2) for a diagonal one, so a step costs exactly its Euclidean length.
   * calculateHeuristic (AstarPathfinding.ts:28) is Euclidean too, which makes it
   * not merely admissible but CONSISTENT: h(n) <= c(n,n') + h(n') holds by the
   * triangle inequality. That is what justifies the closed set in
   * findOptimalWay (AstarPathfinding.ts:84-92), which never re-opens a settled
   * tile -- with a merely admissible heuristic that shortcut would be unsound.
   *
   * Consequence for these tests: the objective is path COST, not step count. A
   * 13-step path can be a longer walk than a 14-step one, so the oracle is
   * Dijkstra over the same costs (optimalCost), never BFS.
   */
  const DETOUR_GRID: string[] = [
    '.....#',
    '.#....',
    '......',
    '......',
    '....##',
    '......',
  ]

  beforeEach((): void => {
    useGrid(DETOUR_GRID)
  })

  it('returns a path that is valid and connected', () => {
    const path: THREE.Vector2[] = new AstarPathfinding().findPath(
      worldCentre(0, 0),
      worldCentre(5, 5)
    )
    // This must keep holding whatever the cost model becomes.
    assertValidPath(path, [0, 0], [5, 5])
  })

  it('walks the cheapest route once walls force a detour', () => {
    // Open ground hides any optimality defect (the 'open ground' block stays
    // green even for a badly chosen heuristic); a detour is what exposes it.
    const path: THREE.Vector2[] = new AstarPathfinding().findPath(
      worldCentre(0, 0),
      worldCentre(5, 5)
    )
    expect(pathCost(path)).toBeCloseTo(optimalCost([0, 0], [5, 5], isWalkableImpl), 9)
  })

  it('fuzz - 200 seeded random grids all match the Dijkstra optimum', () => {
    // Shows optimality is systemic, not an artefact of one hand-picked fixture.
    const rand: () => number = mulberry32(1337)
    const size = 12
    const goal: [number, number] = [size - 1, size - 1]
    let solvable = 0
    let suboptimal = 0
    let firstCounterexample: string | null = null

    for (let trial = 0; trial < 200; trial++) {
      const rows: string[] = []
      for (let y = 0; y < size; y++) {
        let row = ''
        for (let x = 0; x < size; x++) {
          const isCorner: boolean = (x === 0 && y === 0) || (x === goal[0] && y === goal[1])
          row += !isCorner && rand() < 0.25 ? '#' : '.'
        }
        rows.push(row)
      }
      useGrid(rows)

      const optimal: number = optimalCost([0, 0], goal, isWalkableImpl)
      if (optimal < 0) continue
      solvable++

      const path: THREE.Vector2[] = new AstarPathfinding().findPath(
        worldCentre(0, 0),
        worldCentre(...goal)
      )
      const actual: number = pathCost(path)
      if (Math.abs(actual - optimal) > 1e-9) {
        suboptimal++
        if (firstCounterexample === null) {
          firstCounterexample =
            `\n${rows.join('\n')}\n` +
            `A* = ${actual.toFixed(4)} (${path.length - 1} steps), ` +
            `optimal = ${optimal.toFixed(4)}\n` +
            `path: ${tuples(path).map((t): string => t.join(',')).join(' ')}`
        }
      }
    }

    expect(
      suboptimal,
      `${suboptimal} of ${solvable} solvable grids were suboptimal.` +
        `${firstCounterexample ?? ''}`
    ).toBe(0)
  })
})

describe('no diagonal corner cutting', () => {
  /**
   * Enemies have no wall collision of their own -- EnemyAI.moveTowards moves
   * straight at the next tile centre and GameField.colliders is only consulted
   * by Player and Projectile. So a diagonal that clips a wall corner is visible
   * in game as a sprite walking through masonry. exploreNeighbors
   * (AstarPathfinding.ts:119-124) therefore requires both orthogonal tiles of a
   * diagonal to be free.
   */
  it('reports no path when both orthogonal neighbours are walls', () => {
    // (1,0) and (0,1) are walls, so (0,0) is sealed off: the only way out would
    // be squeezing diagonally to (1,1), which is exactly what is forbidden.
    useGrid([
      '.#..',
      '#...',
      '....',
      '....',
    ])

    const path: THREE.Vector2[] = new AstarPathfinding().findPath(
      worldCentre(0, 0),
      worldCentre(1, 1)
    )

    expect(path).toEqual([])
  })

  it('walks around a corner instead of through it', () => {
    // Only one side of the (1,1) -> (2,2) diagonal is blocked, so a detour
    // exists and must be taken.
    useGrid([
      '....',
      '..#.',
      '....',
      '....',
    ])

    const path: THREE.Vector2[] = new AstarPathfinding().findPath(
      worldCentre(1, 1),
      worldCentre(2, 2)
    )

    assertValidPath(path, [1, 1], [2, 2])
    expect(tuples(path)).toEqual([
      [1, 1],
      [1, 2],
      [2, 2],
    ])
  })
})
