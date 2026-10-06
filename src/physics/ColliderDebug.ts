import * as THREE from 'three'
import { ColliderBox } from '../types'
import { toWorldBox } from './Physics'

const STATIC_COLOR = 0x00ff00
const ENEMY_COLOR = 0xff0000
const PROJECTILE_COLOR = 0xffff00
// Drawn on top of everything - depthTest is off, so the boxes are visible through walls
const DEBUG_RENDER_ORDER = 999

/** Anything with a position and a relative collider (Enemy, Projectile, Player). */
export interface ColliderSource {
  position: THREE.Vector3
  getColliderBox(): ColliderBox
}

/** The 12 edges of a box as corner index pairs. Corner i: bit 0 = x, bit 1 = y, bit 2 = z. */
const BOX_EDGES: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [2, 3], [4, 5], [6, 7], // along x
  [0, 2], [1, 3], [4, 6], [5, 7], // along y
  [0, 4], [1, 5], [2, 6], [3, 7], // along z
]

function createDebugMaterial(color: number): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({ color, depthTest: true, transparent: true, opacity: 0.5 })
}

/**
 * Debug view that draws all colliders as wireframe boxes into the scene.
 *
 * Static colliders (blocks, stairs) become one merged LineSegments; dynamic ones
 * (enemies, projectiles) get one scaled unit box per entity.
 */
export class ColliderDebug {
  private staticLines: THREE.LineSegments
  private unitBox: THREE.BufferGeometry
  private enemyMaterial: THREE.LineBasicMaterial = createDebugMaterial(ENEMY_COLOR)
  private projectileMaterial: THREE.LineBasicMaterial = createDebugMaterial(PROJECTILE_COLOR)
  private boxes: Map<ColliderSource, THREE.LineSegments> = new Map()
  private seen: Set<ColliderSource> = new Set()
  private worldBox: ColliderBox = { minX: 0, maxX: 0, minZ: 0, maxZ: 0, minY: 0, maxY: 0 }

  /**
   * @param scene - Scene to draw into.
   * @param staticColliders - The level's static colliders in world coordinates.
   */
  constructor(private scene: THREE.Scene, staticColliders: ColliderBox[]) {
    this.staticLines = new THREE.LineSegments(
      this.buildStaticGeometry(staticColliders),
      createDebugMaterial(STATIC_COLOR),
    )
    this.staticLines.renderOrder = DEBUG_RENDER_ORDER
    this.staticLines.matrixAutoUpdate = false
    this.scene.add(this.staticLines)

    const box = new THREE.BoxGeometry(1, 1, 1)
    this.unitBox = new THREE.EdgesGeometry(box)
    box.dispose()
  }

  /** Updates the dynamic boxes. Must run after all movement/spawns of the frame, or the boxes lag behind. */
  update(enemies: ColliderSource[], projectiles: ColliderSource[]): void {
    this.seen.clear()
    for (const enemy of enemies) this.syncBox(enemy, this.enemyMaterial)
    for (const projectile of projectiles) this.syncBox(projectile, this.projectileMaterial)

    for (const [source, lines] of this.boxes) {
      if (!this.seen.has(source)) {
        lines.removeFromParent()
        this.boxes.delete(source)
      }
    }
  }

  dispose(): void {
    this.staticLines.removeFromParent()
    this.staticLines.geometry.dispose()
    ;(this.staticLines.material as THREE.Material).dispose()

    // The dynamic boxes share geometry + materials - release them only once
    for (const lines of this.boxes.values()) {
      lines.removeFromParent()
    }
    this.boxes.clear()
    this.seen.clear()
    this.unitBox.dispose()
    this.enemyMaterial.dispose()
    this.projectileMaterial.dispose()
  }

  private syncBox(source: ColliderSource, material: THREE.LineBasicMaterial): void {
    this.seen.add(source)

    let lines: THREE.LineSegments | undefined = this.boxes.get(source)
    if (!lines) {
      lines = new THREE.LineSegments(this.unitBox, material)
      lines.renderOrder = DEBUG_RENDER_ORDER
      this.scene.add(lines)
      this.boxes.set(source, lines)
    }

    const box: ColliderBox = toWorldBox(source.position, source.getColliderBox(), this.worldBox)
    lines.position.set(
      (box.minX + box.maxX) / 2,
      (box.minY + box.maxY) / 2,
      (box.minZ + box.maxZ) / 2,
    )
    lines.scale.set(box.maxX - box.minX, box.maxY - box.minY, box.maxZ - box.minZ)
  }

  private buildStaticGeometry(colliders: ColliderBox[]): THREE.BufferGeometry {
    // Every box has 12 edges.
    // Every edge consists of 2 points with 3 coordinates each.
    const positions = new Float32Array(
      colliders.length * 12 * 2 * 3,
    )

    let offset = 0

    let posOffset = 0.0025

    for (const c of colliders) {
      const corners = [
        [c.minX-posOffset , c.minY , c.minZ -posOffset ],
        [c.maxX+posOffset , c.minY , c.minZ - posOffset],
        [c.minX-posOffset , c.maxY , c.minZ- posOffset],
        [c.maxX+posOffset , c.maxY , c.minZ -posOffset],
        [c.minX-posOffset , c.minY , c.maxZ -posOffset],
        [c.maxX+posOffset , c.minY , c.maxZ +posOffset],
        [c.minX-posOffset , c.maxY , c.maxZ +posOffset],
        [c.maxX+posOffset , c.maxY , c.maxZ +posOffset],
      ]

      for (const [start, end] of BOX_EDGES) {
        for (const cornerIndex of [start, end]) {
          const corner = corners[cornerIndex]

          positions[offset++] = corner[0]
          positions[offset++] = corner[1]
          positions[offset++] = corner[2]
        }
      }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(positions, 3),
  )

  return geometry
}

}
