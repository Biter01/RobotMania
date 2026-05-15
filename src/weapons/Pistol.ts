import * as THREE from 'three'
import { InputManager } from '../core/InputManager'
import { Projectile } from '../entities/Projectile'
import { PISTOL_DAMAGE, PISTOL_COOLDOWN } from '../GameConstants'

const BARREL_OFFSET_RIGHT = 0;
const BARREL_OFFSET_DOWN  = 0.3;

export class Pistol {
  private cooldownTimer = 0
  private weaponMesh: THREE.Mesh


  constructor(camera: THREE.Camera) {
      const texture = new THREE.TextureLoader().load(
      './sprites/weapons/waffe2.png'
      )

      texture.magFilter = THREE.NearestFilter

      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true
      })

      const geometry = new THREE.PlaneGeometry(0.6, 0.5)

      this.weaponMesh = new THREE.Mesh(geometry, material)

      this.weaponMesh.position.set(0.0, -0.06, -0.4)

      camera.add(this.weaponMesh)
  }

  update(dt: number, input: InputManager, camera: THREE.Camera): Projectile | null {
    this.cooldownTimer -= dt
    if (input.consumeClick() && this.cooldownTimer <= 0) {
      this.cooldownTimer = PISTOL_COOLDOWN
      this.triggerKick()
      return new Projectile(camera, PISTOL_DAMAGE, this.barrelOffset(camera))
    }
    return null
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

  private triggerKick() {

  }
}
