import { ENEMY_RADIUS, NAV_HEADROOM, NAV_HEIGHT_TOLERANCE, STAIR_COUNT, STAIR_HEIGHT } from '../GameConstants'
import { ParsedMap } from '../types'
import { StairData, isHorizontalStair } from './StairData'

/**
 * A walkable spot in the {@link NavGrid}: one surface of one grid cell.
 *
 * A cell (col, row) can hold several nodes at different heights (the floor
 * under a bridge and the bridge above it).
 */
export interface NavNode {
  /** Unique index within its NavGrid. */
  readonly id: number
  readonly col: number
  readonly row: number
  /** Height of the surface (on stairs: middle of the stair tile). */
  readonly y: number
  /** The stair this node lies on, or null for a block surface. */
  readonly stair: StairData | null
  /** Index of the stair tile (0 = lowest tile), -1 for block surfaces. */
  readonly stairIndex: number
}

/** A step from one node to a neighbor. */
export interface NavEdge {
  node: NavNode
  /** Walking cost: 1 for a straight step, sqrt(2) for a diagonal one. */
  cost: number
}

/** Axis-aligned box in world coordinates. */
interface Volume {
  minX: number
  maxX: number
  minY: number
  maxY: number
  minZ: number
  maxZ: number
}

const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [-1, 1], [1, -1], [-1, -1],
]

/**
 * Layered navigation grid for enemy pathfinding.
 *
 * Every block top with at least `NAV_HEADROOM` of free space above it becomes
 * a walkable node, and so does every stair tile. Nodes of the same height are
 * connected directly; stairs are the only connection between different heights.
 */
export class NavGrid {
  readonly tileSize: number
  private readonly cells: Map<string, NavNode[]> = new Map()
  private readonly nodes: NavNode[] = []

  /**
   * @param blocks - All solid blocks of the level.
   * @param stairs - All stairs of the level.
   * @param tileSize - Edge length of a grid cell.
   */
  public constructor(blocks: ParsedMap['blocks'], stairs: StairData[], tileSize: number) {
    this.tileSize = tileSize

    const solids: Volume[] = blocks.map((b): Volume => ({
      minX: b.position.x - b.size.x / 2, maxX: b.position.x + b.size.x / 2,
      minY: b.position.y - b.size.y / 2, maxY: b.position.y + b.size.y / 2,
      minZ: b.position.z - b.size.z / 2, maxZ: b.position.z + b.size.z / 2,
    }))
    const stairVolumes: Volume[] = stairs.flatMap((s: StairData): Volume[] => stairTileVolumes(s, tileSize))
    const obstacles: Volume[] = [...solids, ...stairVolumes]

    this.addSurfaceNodes(solids, obstacles)
    this.addStairNodes(stairs)
  }

  /** Total number of nodes. */
  public get nodeCount(): number {
    return this.nodes.length
  }

  /** All nodes of a cell, lowest first (stair nodes last). */
  public nodesAt(col: number, row: number): readonly NavNode[] {
    return this.cells.get(key(col, row)) ?? []
  }

  /**
   * Finds the node at a world position.
   *
   * If a cell has several levels, the one closest to the feet wins.
   * @param footY - Height of the feet.
   * @returns The node, or undefined if the cell has no walkable surface.
   */
  public nodeAt(x: number, footY: number, z: number): NavNode | undefined {
    const candidates: readonly NavNode[] = this.nodesAt(Math.floor(x / this.tileSize), Math.floor(z / this.tileSize))
    let best: NavNode | undefined
    for (const node of candidates) {
      if (!best || Math.abs(node.y - footY) < Math.abs(best.y - footY)) best = node
    }
    return best
  }

  /** World position of the cell center, at the height of the node's surface. */
  public centerOf(node: NavNode): { x: number; y: number; z: number } {
    return {
      x: node.col * this.tileSize + this.tileSize / 2,
      y: node.y,
      z: node.row * this.tileSize + this.tileSize / 2,
    }
  }

  /** All nodes reachable from `node` in one step, with their cost. */
  public neighbors(node: NavNode): NavEdge[] {
    const edges: NavEdge[] = []
    for (const [dCol, dRow] of DIRECTIONS) {
      const diagonal: boolean = dCol !== 0 && dRow !== 0
      const cost: number = diagonal ? Math.SQRT2 : 1
      for (const target of this.nodesAt(node.col + dCol, node.row + dRow)) {
        if (this.canStep(node, target, dCol, dRow)) edges.push({ node: target, cost })
      }
    }
    return edges
  }

  private canStep(from: NavNode, to: NavNode, dCol: number, dRow: number): boolean {
    const diagonal: boolean = dCol !== 0 && dRow !== 0

    if (from.stair || to.stair) {
      // Stairs are only entered, left and walked along their axis
      if (diagonal) return false
      if (from.stair && !isAlongAxis(from.stair, dCol, dRow)) return false
      if (to.stair && !isAlongAxis(to.stair, dCol, dRow)) return false

      if (from.stair && to.stair) {
        return from.stair === to.stair && Math.abs(from.stairIndex - to.stairIndex) === 1
      }
      if (from.stair) return this.leavesStair(from, to, dCol, dRow)
      return this.leavesStair(to, from, -dCol, -dRow)
    }

    if (!sameHeight(from.y, to.y)) return false
    if (!diagonal) return true
    // No corner cutting: both orthogonal neighbors must be surfaces of the same height
    return this.hasFlatNode(from.col + dCol, from.row, from.y) && this.hasFlatNode(from.col, from.row + dRow, from.y)
  }

  /**
   * Whether a step from a stair tile onto a surface is allowed: only at the
   * lower end onto `baseY` or at the upper end onto `topY`.
   */
  private leavesStair(stairNode: NavNode, surface: NavNode, dCol: number, dRow: number): boolean {
    const stair: StairData = stairNode.stair!
    const up: { dCol: number; dRow: number } = stair.upStep
    const last: number = stair.tileCount - 1
    if (dCol === up.dCol && dRow === up.dRow) {
      return stairNode.stairIndex === last && sameHeight(surface.y, stair.topY)
    }
    if (dCol === -up.dCol && dRow === -up.dRow) {
      return stairNode.stairIndex === 0 && sameHeight(surface.y, stair.baseY)
    }
    return false
  }

  private hasFlatNode(col: number, row: number, y: number): boolean {
    return this.nodesAt(col, row).some((n: NavNode): boolean => !n.stair && sameHeight(n.y, y))
  }

  /**
   * Every block top is a candidate. It is walkable if `NAV_HEADROOM` above it is
   * free - checked against an area grown by `ENEMY_RADIUS`, so enemies do not
   * get stuck on edges.
   */
  private addSurfaceNodes(solids: Volume[], obstacles: Volume[]): void {
    if (solids.length === 0) return
    const bounds: Volume[] = obstacles
    const t: number = this.tileSize
    const minCol: number = Math.floor(Math.min(...bounds.map((v: Volume): number => v.minX)) / t)
    const maxCol: number = Math.ceil(Math.max(...bounds.map((v: Volume): number => v.maxX)) / t) - 1
    const minRow: number = Math.floor(Math.min(...bounds.map((v: Volume): number => v.minZ)) / t)
    const maxRow: number = Math.ceil(Math.max(...bounds.map((v: Volume): number => v.maxZ)) / t) - 1

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const cx: number = col * t + t / 2
        const cz: number = row * t + t / 2
        const tops: number[] = []

        for (const s of solids) {
          if (cx <= s.minX || cx >= s.maxX || cz <= s.minZ || cz >= s.maxZ) continue
          if (tops.some((y: number): boolean => sameHeight(y, s.maxY))) continue
          if (this.isBlocked(obstacles, cx, cz, s.maxY)) continue
          tops.push(s.maxY)
        }

        tops.sort((a: number, b: number): number => a - b)
        for (const y of tops) this.addNode(col, row, y, null, -1)
      }
    }
  }

  /** Whether any obstacle intrudes into the headroom above (cx, y, cz). */
  private isBlocked(obstacles: Volume[], cx: number, cz: number, y: number): boolean {
    const r: number = ENEMY_RADIUS
    return obstacles.some((o: Volume): boolean =>
      o.minX < cx + r && o.maxX > cx - r &&
      o.minZ < cz + r && o.maxZ > cz - r &&
      o.minY < y + NAV_HEADROOM && o.maxY > y + NAV_HEIGHT_TOLERANCE)
  }

  private addStairNodes(stairs: StairData[]): void {
    const tileHeight: number = STAIR_COUNT * STAIR_HEIGHT
    for (const stair of stairs) {
      for (const { col, row, index } of stair.tiles()) {
        this.addNode(col, row, stair.baseY + (index + 0.5) * tileHeight, stair, index)
      }
    }
  }

  private addNode(col: number, row: number, y: number, stair: StairData | null, stairIndex: number): void {
    const node: NavNode = { id: this.nodes.length, col, row, y, stair, stairIndex }
    this.nodes.push(node)
    const k: string = key(col, row)
    const list: NavNode[] | undefined = this.cells.get(k)
    if (list) list.push(node)
    else this.cells.set(k, [node])
  }
}

function key(col: number, row: number): string {
  return `${col},${row}`
}

function sameHeight(a: number, b: number): boolean {
  return Math.abs(a - b) < NAV_HEIGHT_TOLERANCE
}

function isAlongAxis(stair: StairData, dCol: number, dRow: number): boolean {
  return isHorizontalStair(stair.dir) ? dCol !== 0 && dRow === 0 : dCol === 0 && dRow !== 0
}

/** Every stair tile is a block from the stair's lower end up to the tile's top edge. */
function stairTileVolumes(stair: StairData, tileSize: number): Volume[] {
  const tileHeight: number = STAIR_COUNT * STAIR_HEIGHT
  return stair.tiles().map(({ col, row, index }): Volume => ({
    minX: col * tileSize, maxX: (col + 1) * tileSize,
    minZ: row * tileSize, maxZ: (row + 1) * tileSize,
    minY: stair.baseY, maxY: stair.baseY + (index + 1) * tileHeight,
  }))
}
