import * as THREE from 'three'
import { InputManager } from '../core/InputManager'
import { Projectile } from '../entities/Projectile'
import { PISTOL_DAMAGE, PISTOL_COOLDOWN } from '../GameConstants'

export class Pistol {
  private cooldownTimer = 0

  update(dt: number, input: InputManager, camera: THREE.Camera): Projectile | null {
    this.cooldownTimer -= dt
    if (input.consumeClick() && this.cooldownTimer <= 0) {
      this.cooldownTimer = PISTOL_COOLDOWN
      return new Projectile(camera, PISTOL_DAMAGE)
    }
    return null
  }
}
