import * as THREE from 'three'
import { ColliderBox } from '../types'
import { toWorldBox } from './Physics'

const STATIC_COLOR = 0x00ff00
const ENEMY_COLOR = 0xff0000
const PROJECTILE_COLOR = 0xffff00
// Ueber allem anderen zeichnen - depthTest ist aus, die Boxen sind auch durch Waende sichtbar
const DEBUG_RENDER_ORDER = 999

// Alles mit Position + relativem Collider (Enemy, Projectile, Player)
export interface ColliderSource {
  position: THREE.Vector3
  getColliderBox(): ColliderBox
}

// Die 12 Kanten einer Box als Eckpunkt-Index-Paare. Eckpunkt i: Bit 0 = x, Bit 1 = y, Bit 2 = z
const BOX_EDGES: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [2, 3], [4, 5], [6, 7], // entlang x
  [0, 2], [1, 3], [4, 6], [5, 7], // entlang y
  [0, 4], [1, 5], [2, 6], [3, 7], // entlang z
]

function createDebugMaterial(color: number): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({ color, depthTest: true, transparent: true, opacity: 0.5 })
}

// Zeichnet alle Collider als Drahtgitter-Boxen in die Scene.
// Statische Collider (Waende, Boden, Stiegen) als ein gemergtes LineSegments,
// dynamische (Gegner, Projektile) als skalierte Einheitsbox pro Entity.
export class ColliderDebug {
  private staticLines: THREE.LineSegments
  private unitBox: THREE.BufferGeometry
  private enemyMaterial: THREE.LineBasicMaterial = createDebugMaterial(ENEMY_COLOR)
  private projectileMaterial: THREE.LineBasicMaterial = createDebugMaterial(PROJECTILE_COLOR)
  private boxes: Map<ColliderSource, THREE.LineSegments> = new Map()
  private seen: Set<ColliderSource> = new Set()
  private worldBox: ColliderBox = { minX: 0, maxX: 0, minZ: 0, maxZ: 0, minY: 0, maxY: 0 }

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

  // Muss nach allen Bewegungen/Spawns des Frames laufen, sonst hinken die Boxen hinterher
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

    // Die dynamischen Boxen teilen sich Geometry + Materials - nur einmal freigeben
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
    // Jede Box hat 12 Kanten.
    // Jede Kante besteht aus 2 Punkten mit jeweils 3 Koordinaten.
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
