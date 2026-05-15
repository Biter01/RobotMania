import * as THREE from 'three'
import { ENEMY_HP } from '../GameConstants'
import { loadPixelTexture } from '../core/AssetLoader'

const COLOR_ALIVE  = 0xffffff
const COLOR_DEAD   = 0x555555
const COLOR_FLASH  = 0xff8888
const FLASH_DURATION = 0.12

export class Enemy {
  mesh: THREE.Sprite
  position: THREE.Vector3
  readonly yMin: number
  readonly yMax: number
  hp = ENEMY_HP
  alive = true
  flashTimer = 0

  private texture: THREE.Texture | null = null

  constructor(x: number, z: number) {
    this.position = new THREE.Vector3(x, 0.4, z)
    this.yMin = 0
    this.yMax = 1.4
    const mat = new THREE.SpriteMaterial({ color: COLOR_ALIVE, alphaTest: 1 })
    this.mesh = new THREE.Sprite(mat)
    this.mesh.scale.set(0.8, 0.8, 0.8)
    this.mesh.position.copy(this.position)

    loadPixelTexture('./sprites/enemies/RobotOrginalNew.png').then(tex => {
      this.texture = tex
      mat.map = tex
      mat.needsUpdate = true
    })
  }

  private get mat(): THREE.SpriteMaterial {
    return this.mesh.material as THREE.SpriteMaterial
  }

  update(dt: number) {
    if (this.flashTimer > 0) {
      this.flashTimer -= dt
      if (this.flashTimer <= 0) {
        this.mat.color.setHex(this.alive ? COLOR_ALIVE : COLOR_DEAD)
      }
    }
  }

  takeDamage(amount: number) {
    this.hp -= amount
    if (this.hp <= 0) {
      this.alive = false
    }
    this.mat.color.setHex(COLOR_FLASH)
    this.flashTimer = FLASH_DURATION
  }

  dispose() {
    this.texture?.dispose()
    this.mesh.material.dispose()
  }
}
