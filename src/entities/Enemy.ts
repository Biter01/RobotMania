import * as THREE from 'three'
import { ENEMY_HP } from '../GameConstants'
import { loadPixelTexture } from '../core/AssetLoader'
import { StateMachine } from '../states/StateMachine'
import {EnemyState} from '../states/EnemyState'
import { EnemyAI } from './enemyAI/EnemyAI'

const COLOR_ALIVE    = 0xffffff
const COLOR_DEAD     = 0x555555
const COLOR_FLASH    = 0xff8888
const FLASH_DURATION = 0.12

// Sprite-Sheet: 102 frames horizontal in RoboOrginalNew.png

const TOTAL_FRAMES = 102

export class Enemy {
  mesh: THREE.Sprite
  position: THREE.Vector3
  readonly yMin: number
  readonly yMax: number
  hp = ENEMY_HP
  alive = true
  flashTimer = 0

  public facing: THREE.Vector3 = new THREE.Vector3(0, 0, -1)
  
  private enemyAI: EnemyAI;


  //Test value
  private activity: 'idle' | 'walk' | 'shoot' | 'dead' = 'idle'
  private static readonly _toViewer = new THREE.Vector3()

  private texture: THREE.Texture | null = null
  public sm: StateMachine<EnemyState> | null = null
  

  constructor(x: number, z: number) {
    this.position = new THREE.Vector3(x, 0.4, z)
    this.yMin = 0
    this.yMax = 1.4
    const mat = new THREE.SpriteMaterial({ color: COLOR_ALIVE, alphaTest: 0.5 })
    this.mesh = new THREE.Sprite(mat)
    this.mesh.scale.set(0.8, 0.8, 0.8)
    this.mesh.position.copy(this.position)
    this.enemyAI = new EnemyAI(this);

    loadPixelTexture('./sprites/enemies/RoboOrginalNew.png').then(tex => {
      this.texture = tex

      tex.wrapS = THREE.RepeatWrapping
      tex.repeat.set(1 / TOTAL_FRAMES, 1)

      mat.map = tex
      mat.needsUpdate = true

      this.sm = new StateMachine<EnemyState>()
        .addState(EnemyState.IdleFront,       { frames: [0,  1,  2,  3,  4,  5],  fps: 4,  loop: true })
        .addState(EnemyState.Idle34FrontRight,     { frames: [6,  7,  8,  9,  10, 11], fps: 4,  loop: true })
        .addState(EnemyState.Idle34FrontLeft,      { frames: [12, 13, 14, 15, 16, 17], fps: 4,  loop: true })
        .addState(EnemyState.IdleRight,      { frames: [18, 19, 20, 21, 22, 23], fps: 4,  loop: true })
        .addState(EnemyState.IdleLeft,     { frames: [24, 25, 26, 27, 28, 29], fps: 4,  loop: true })
        .addState(EnemyState.Idle34BackLeft,      { frames: [30, 31, 32, 33, 34, 35], fps: 4, loop: true })
        .addState(EnemyState.Idle34BackRight,     { frames: [36, 37, 38, 39, 40, 41], fps: 4, loop: true })
        .addState(EnemyState.IdleBack,        { frames: [42, 43, 44, 45, 46, 47], fps: 4, loop: true })
        .addState(EnemyState.WalkFront,      { frames: [48, 49, 50, 51, 52, 53], fps: 10, loop: true })
        .addState(EnemyState.Walk34FrontRight, { frames: [54, 55, 56, 57, 58, 59], fps: 10, loop: true })
        .addState(EnemyState.Walk34FrontLeft, { frames: [60, 61, 62, 63, 64, 65], fps: 10,  loop: true })
        .addState(EnemyState.WalkRight, { frames: [66, 67, 68, 69, 70, 71], fps: 5,  loop: true })
        .addState(EnemyState.WalkLeft, { frames: [72, 73, 74, 75, 76, 77], fps: 5,  loop: true })
        .addState(EnemyState.Walk34BackLeft, { frames: [78, 79, 80, 81, 82, 83], fps: 10,  loop: true })
        .addState(EnemyState.Walk34BackRight, { frames: [84, 85, 86, 87, 88, 89], fps: 10,  loop: true })
        .addState(EnemyState.WalkBack, { frames: [90, 91, 92, 93, 94, 95], fps: 10,  loop: true })
        .addState(EnemyState.ShootingFront, { frames: [96, 97], fps: 6,  loop: true })
        .addState(EnemyState.Shooting34FrontRight, { frames: [98,99], fps: 6,  loop: true })
        .addState(EnemyState.Shooting34FrontLeft, { frames: [100,101], fps: 6,  loop: true })


      this.sm.start(EnemyState.IdleFront)
    })
  }

  public setActivity(activity: 'idle' | 'walk' | 'shoot'): void {
    if (!this.alive) return
    this.activity = activity
  }

  private get mat(): THREE.SpriteMaterial {
    return this.mesh.material as THREE.SpriteMaterial
  }

  private applyFrame(frame: number): void {
    if (!this.texture) return
    this.texture.offset.x = frame / TOTAL_FRAMES
  }

  private viewSector(viewerPos: THREE.Vector3): { sector: number; mirror: boolean } {
    const toViewer = Enemy._toViewer.copy(viewerPos).sub(this.position)
    toViewer.y = 0
    toViewer.normalize()
    const fx = this.facing.x
    const fz = this.facing.z
    //Two normalized vectors: facing and toViewer

    //cos(o) for x
    const dot   = fx * toViewer.x + fz * toViewer.z

    //sin(o) for y
    const cross = fx * toViewer.z - fz * toViewer.x 
    //Plot point and atan2 computes the angle in radians
    const angle = Math.atan2(-cross, dot)
    let a = angle < 0 ? angle + Math.PI * 2 : angle
    return {
      sector: Math.round(a / (Math.PI / 4)) % 8,
      mirror: cross > 0,   // sprite sheet has right-side views only; left side needs flip
    }
  }

  private updateDirection(viewerPos: THREE.Vector3): void {
    const { sector, mirror } = this.viewSector(viewerPos)

    let nextState: EnemyState
    switch (this.activity) {
      case 'idle': 
        const IDLE: EnemyState[] = [EnemyState.IdleFront, EnemyState.Idle34FrontLeft,EnemyState.IdleLeft ,EnemyState.Idle34BackLeft,EnemyState.IdleBack ,EnemyState.Idle34BackRight,EnemyState.IdleRight ,EnemyState.Idle34FrontRight]
        
        nextState = IDLE[sector]

        // case 3 and 5 must be switched to look correct
        if(sector === 3) {
            nextState = IDLE[sector+2]
        }

        if(sector === 5) {
            nextState = IDLE[sector-2]
        }

        break
      
      case 'walk': 
        const WALK: EnemyState[] = [EnemyState.WalkFront, EnemyState.Walk34FrontLeft,EnemyState.WalkLeft ,EnemyState.Walk34BackLeft,EnemyState.WalkBack ,EnemyState.Walk34BackRight,EnemyState.WalkRight ,EnemyState.Walk34FrontRight]
        
      
        nextState = WALK[sector]

        // case 3 and 5 must be switched to look correct
        if(sector === 3) {
          nextState = WALK[sector+2]
        }

        if(sector === 5) {
            nextState = WALK[sector-2]
        } 
        break
      
      case 'shoot':
        /*if(mirror) {
          nextState = EnemyState.Shooting34FrontLeft
        } else {
          nextState = EnemyState.Shooting34FrontRight
        }*/

        nextState = EnemyState.ShootingFront;

        break
      case 'dead':
        nextState = EnemyState.Dead
        break
    }

    this.sm!.transition(nextState)
    
  }


  private updateEnemyState(dt: number, playerPos: THREE.Vector3): void {
    if (this.sm) {
      if (this.alive && playerPos) {
          this.updateDirection(playerPos)
        }

        this.sm.update(dt)
        this.applyFrame(this.sm.currentFrame)
    }
  }


  public update(dt: number, playerPos: THREE.Vector3): void {

    this.enemyAI.update(dt, playerPos);
    this.updateEnemyState(dt, playerPos)
    this.mesh.position.copy(this.position)


    if (this.flashTimer > 0) {
      this.flashTimer -= dt
      if (this.flashTimer <= 0) {
        this.mat.color.setHex(this.alive ? COLOR_ALIVE : COLOR_DEAD)
      }
    }
  }

  
  public takeDamage(amount: number): void {
    this.hp -= amount
    if (this.hp <= 0) {
      this.alive = false
      this.activity = 'dead'
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
