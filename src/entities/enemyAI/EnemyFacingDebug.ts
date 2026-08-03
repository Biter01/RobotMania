import * as THREE from 'three'
import { Enemy } from '../Enemy'
import { TILE_SIZE } from '../../GameConstants'

const ARROW_COLOR = 0xff0000
const ARROW_LENGTH = 0.3* TILE_SIZE
const ARROW_HEAD_LENGTH = 0.05 * TILE_SIZE
const ARROW_HEAD_WIDTH = 0.05 * TILE_SIZE
const ARROW_Y_OFFSET = 0.05

// Draws arrows in the scene to visualize the facing direction of enemies. Useful for debugging AI behavior.
export class EnemyFacingDebug {
  private arrows = new Map<Enemy, THREE.ArrowHelper>()

  constructor(private scene: THREE.Scene) {}

  update(enemies: Enemy[]): void {
    const alive = new Set(enemies)

    for (const enemy of enemies) {
      let arrow = this.arrows.get(enemy)
      if (!arrow) {
        arrow = new THREE.ArrowHelper(
          enemy.facing,
          enemy.position,
          ARROW_LENGTH,
          ARROW_COLOR,
          ARROW_HEAD_LENGTH,
          ARROW_HEAD_WIDTH
        )
        this.scene.add(arrow)
        this.arrows.set(enemy, arrow)
      }

      arrow.position.copy(enemy.position)
      arrow.position.y += ARROW_Y_OFFSET
      arrow.setDirection(enemy.facing)
    }

    for (const [enemy, arrow] of this.arrows) {
      if (!alive.has(enemy)) {
        this.scene.remove(arrow)
        arrow.dispose()
        this.arrows.delete(enemy)
      }
    }
  }

  dispose(): void {
    for (const arrow of this.arrows.values()) {
      this.scene.remove(arrow)
      arrow.dispose()
    }
    this.arrows.clear()
  }
}
