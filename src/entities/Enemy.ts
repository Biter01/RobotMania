import * as THREE from 'three'
import { ENEMY_HP } from '../GameConstants'
import { loadPixelTexture } from '../core/AssetLoader'
import { StateMachine } from '../sprites/StateMachine'

const COLOR_ALIVE    = 0xffffff
const COLOR_DEAD     = 0x555555
const COLOR_FLASH    = 0xff8888
const FLASH_DURATION = 0.12

// Sprite-Sheet: 26 Frames horizontal in RoboOrginalNew.png
// Idle/Front 1-6, Idle/Side 7-12, Walk Front 13-18, Walk Side 19-24, Shooting 25-26
const TOTAL_FRAMES = 26

export enum EnemyState {
  IdleFront,
  IdleSide,
  WalkFront,
  WalkSide,
  Shooting,
  Dead,
}

export class Enemy {
  mesh: THREE.Sprite
  position: THREE.Vector3
  readonly yMin: number
  readonly yMax: number
  hp = ENEMY_HP
  alive = true
  flashTimer = 0

  private texture: THREE.Texture | null = null
  private sm: StateMachine<EnemyState> | null = null

  constructor(x: number, z: number) {
    this.position = new THREE.Vector3(x, 0.4, z)
    this.yMin = 0
    this.yMax = 1.4
    const mat = new THREE.SpriteMaterial({ color: COLOR_ALIVE, alphaTest: 0.5 })
    this.mesh = new THREE.Sprite(mat)
    this.mesh.scale.set(0.8, 0.8, 0.8)
    this.mesh.position.copy(this.position)

    loadPixelTexture('./sprites/enemies/RoboOrginalNew.png').then(tex => {
      this.texture = tex

      // UV-Repeat auf ein Frame setzen – offset.x wird pro Frame gesetzt
      tex.wrapS = THREE.RepeatWrapping
      tex.repeat.set(1 / TOTAL_FRAMES, 1)

      mat.map = tex
      mat.needsUpdate = true

      this.sm = new StateMachine<EnemyState>()
        .addState(EnemyState.IdleFront, { frames: [0, 1, 2, 3, 4, 5],          fps: 4,  loop: true })
        .addState(EnemyState.IdleSide,  { frames: [6, 7, 8, 9, 10, 11],        fps: 4,  loop: true })
        .addState(EnemyState.WalkFront, { frames: [12, 13, 14, 15, 16, 17],    fps: 10, loop: true })
        .addState(EnemyState.WalkSide,  { frames: [18, 19, 20, 21, 22, 23],    fps: 4, loop: true })
        .addState(EnemyState.Shooting,  { frames: [24, 25],                    fps: 6,  loop: true })
        .addState(EnemyState.Dead,      { frames: [25],                        fps: 1,  loop: false })

      let randNum = Math.random()
      if (randNum < 0.25) {
        this.sm.start(EnemyState.IdleFront);
      } else if (randNum < 0.5) {
        this.sm.start(EnemyState.IdleSide);
      } else if (randNum < 0.75) {
        this.sm.start(EnemyState.WalkSide);
      } else {
        this.sm.start(EnemyState.WalkFront);
      }
    })
  }

  private get mat(): THREE.SpriteMaterial {
    return this.mesh.material as THREE.SpriteMaterial
  }

  // Setzt texture.offset.x auf den entsprechenden Frame im Sprite-Sheet
  private applyFrame(frame: number): void {
    if (!this.texture) return
    this.texture.offset.x = frame / TOTAL_FRAMES
  }

  update(dt: number) {
    // Animation
    if (this.sm) {
      this.sm.update(dt)
      this.applyFrame(this.sm.currentFrame)
    }

    // Hit-Flash
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
      this.sm?.transition(EnemyState.Dead)
    }
    this.mat.color.setHex(COLOR_FLASH)
    this.flashTimer = FLASH_DURATION
  }

  dispose() {
    this.texture?.dispose()
    this.mesh.material.dispose()
  }
}
