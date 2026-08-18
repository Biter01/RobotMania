import * as THREE from 'three'
import { Projectile } from '../entities/Projectile'
import { PISTOL_DAMAGE, PISTOL_COOLDOWN, PROJECTILE_SPEED } from '../GameConstants'
import { Weapon } from './Weapon'
import { UpdateContext, DamageGroup} from '../types'

const BARREL_OFFSET_RIGHT = 0;
const BARREL_OFFSET_DOWN  = 0.3;

export class Pistol extends Weapon {

  constructor(camera: THREE.Camera, texturePath = './sprites/weapons/waffe2.png', cooldown = PISTOL_COOLDOWN, damage = PISTOL_DAMAGE) {
      super(camera, texturePath, cooldown, damage)
      this.cooldownTimer = cooldown;
  }

  update(dt: number, ctx: UpdateContext) {
    this.cooldownTimer -= dt
    if (ctx.input.consumeClick() && this.cooldownTimer <= 0) {
      this.cooldownTimer = this.cooldown
      
      const shootDir = new THREE.Vector3()
      ctx.camera.getWorldDirection(shootDir)

      const projectile = new Projectile({
              size: new THREE.Vector2(6, 6),
              spawnPosition:  ctx.camera.position,
              damage: PISTOL_DAMAGE,
              spawnOffset: this.barrelOffset(ctx.camera),
              shootDir: shootDir,
              speed: PROJECTILE_SPEED,
              projectileColor: 0xFFFFFF,
              damageGroup: DamageGroup.Enemy
            })

      ctx.spawnProjectile(projectile)
    }   
  }

  private barrelOffset(camera: THREE.Camera): THREE.Vector3 {
    const forward = new THREE.Vector3()
    camera.getWorldDirection(forward)

    // forward × worldUp ergibt den lokalen "right"-Vektor der Kamera.
    // Das Ergebnis steht senkrecht auf beiden Vektoren

    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()

    // right × forward ergibt den lokalen "up"-Vektor,
    // sodass wir ein orthogonales Kamerakoordinatensystem haben:
    // forward / right / up

    const up    = new THREE.Vector3().crossVectors(right, forward)

    return right.multiplyScalar(BARREL_OFFSET_RIGHT)
                .addScaledVector(up, -BARREL_OFFSET_DOWN)
  }
}

