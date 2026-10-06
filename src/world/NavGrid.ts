import { ENEMY_RADIUS, NAV_HEADROOM, NAV_HEIGHT_TOLERANCE, STAIR_COUNT, STAIR_HEIGHT } from '../GameConstants'
import { ParsedMap } from '../types'
import { StairData, isHorizontalStair } from './StairData'

// Ebenen-Nav-Grid: pro Zelle (col, row) kann es mehrere begehbare Knoten in
// unterschiedlicher Hoehe geben (Boden unter einer Bruecke + Bruecke darueber).
// Knoten derselben Hoehe sind direkt verbunden; die einzige Verbindung zwischen
// verschiedenen Hoehen sind Stiegen.
export interface NavNode {
  readonly id: number
  readonly col: number
  readonly row: number
  // Hoehe der Flaeche (bei Stiegen: Mitte des Stiegen-Tiles)
  readonly y: number
  readonly stair: StairData | null
  // 0 = unterstes Tile der Stiege, -1 bei normalen Flaechen
  readonly stairIndex: number
}

export interface NavEdge {
  node: NavNode
  cost: number
}

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

export class NavGrid {
  readonly tileSize: number
  private readonly cells: Map<string, NavNode[]> = new Map()
  private readonly nodes: NavNode[] = []

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

  public get nodeCount(): number {
    return this.nodes.length
  }

  public nodesAt(col: number, row: number): readonly NavNode[] {
    return this.cells.get(key(col, row)) ?? []
  }

  // Knoten an einer Weltposition; footY = Hoehe der Fuesse. Bei mehreren Ebenen in
  // einer Zelle gewinnt die, deren Hoehe am naechsten an den Fuessen liegt.
  public nodeAt(x: number, footY: number, z: number): NavNode | undefined {
    const candidates: readonly NavNode[] = this.nodesAt(Math.floor(x / this.tileSize), Math.floor(z / this.tileSize))
    let best: NavNode | undefined
    for (const node of candidates) {
      if (!best || Math.abs(node.y - footY) < Math.abs(best.y - footY)) best = node
    }
    return best
  }

  // Weltposition der Zellmitte auf Hoehe der Flaeche
  public centerOf(node: NavNode): { x: number; y: number; z: number } {
    return {
      x: node.col * this.tileSize + this.tileSize / 2,
      y: node.y,
      z: node.row * this.tileSize + this.tileSize / 2,
    }
  }

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
      // Stiegen nur entlang ihrer Achse betreten, verlassen und begehen
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
    // Keine Ecken schneiden: beide Nachbarn muessen Flaechen derselben Hoehe sein
    return this.hasFlatNode(from.col + dCol, from.row, from.y) && this.hasFlatNode(from.col, from.row + dRow, from.y)
  }

  // Schritt von einem Stiegen-Tile auf eine Flaeche: nur am unteren Ende auf baseY
  // oder am oberen Ende auf topY
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

  // Jede Oberseite eines Blocks ist ein Kandidat. Begehbar ist sie, wenn darueber
  // NAV_HEADROOM frei ist - geprueft gegen ein um ENEMY_RADIUS vergroessertes Feld,
  // damit Gegner nicht an Kanten haengen bleiben.
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

// Jedes Stiegen-Tile ist ein Block vom unteren Ende bis zu seiner Oberkante
function stairTileVolumes(stair: StairData, tileSize: number): Volume[] {
  const tileHeight: number = STAIR_COUNT * STAIR_HEIGHT
  return stair.tiles().map(({ col, row, index }): Volume => ({
    minX: col * tileSize, maxX: (col + 1) * tileSize,
    minZ: row * tileSize, maxZ: (row + 1) * tileSize,
    minY: stair.baseY, maxY: stair.baseY + (index + 1) * tileHeight,
  }))
}
