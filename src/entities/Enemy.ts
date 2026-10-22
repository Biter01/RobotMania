import * as THREE from 'three'
import { ENEMY_HP, ENEMY_RADIUS, ENEMY_BASE_HEIGHT } from '../GameConstants'
import { loadPixelTexture } from '../core/AssetLoader'
import { StateMachine } from '../states/StateMachine'
import {EnemyState} from '../states/EnemyState'
import { EnemyAI } from './enemyAI/EnemyAI'
import { Damageable, UpdateContext, DamageGroup, ColliderBox } from '../types'
import { Entity } from './Entity'
import { Projectile } from './Projectile'
import { PhysicsBody } from '../physics/Physics'

const COLOR_ALIVE    = 0xffffff
const COLOR_DEAD     = 0x555555
const COLOR_FLASH    = 0xff8888
const FLASH_DURATION = 0.12

/** Number of frames in the horizontal sprite sheet RoboOrginalNew.png. */
const TOTAL_FRAMES = 102

/**
 * A robot enemy rendered as an animated, direction-dependent sprite.
 *
 * Movement and decisions come from its {@link EnemyAI}; the sprite frame comes
 * from the animation state machine and the angle to the viewer.
 */
export class Enemy implements Entity, Damageable, PhysicsBody {
  public mesh: THREE.Sprite
  /** Position at {@link baseHeight} above the feet. */
  public position: THREE.Vector3
  readonly baseHeight: number = ENEMY_BASE_HEIGHT
  velocityY: number = 0
  /** Bottom of the hit cylinder, relative to the feet. */
  readonly yMin: number
  /** Top of the hit cylinder, relative to the feet. */
  readonly yMax: number
  private hp = ENEMY_HP
  private alive = true
  /** Remaining seconds of the damage flash; dead enemies are removed once it reaches 0. */
  public flashTimer = 0

  /** Direction the enemy looks in; picks the sprite view. */
  public facing: THREE.Vector3 = new THREE.Vector3(0, 0, -1)
  
  private enemyAI: EnemyAI;
  private activity: 'idle' | 'walk' | 'shoot' | 'dead' = 'idle'
  private static readonly _toViewer = new THREE.Vector3()

  private texture: THREE.Texture | null = null
  private disposed = false
  public sm: StateMachine<EnemyState> | null = null
  
  readonly attackCooldown; // seconds between attacks
  private cooldownTimer; // time left until the next attack

  private colliderBox: ColliderBox

  /**
   * @param x - Spawn position x.
   * @param footY - Height of the feet at the spawn (top of the block below).
   * @param z - Spawn position z.
   * @param attackCooldown - Seconds between attacks.
   */
  constructor(x: number, footY: number, z: number, attackCooldown = 0.3) {
    this.position = new THREE.Vector3(x, footY + this.baseHeight, z)
    this.yMin = 0
    this.yMax = 1.4
    const mat = new THREE.SpriteMaterial({ color: COLOR_ALIVE, alphaTest: 0.5 })
    this.mesh = new THREE.Sprite(mat)
    this.mesh.scale.set(0.8, 0.8, 0.8)
    this.mesh.position.copy(this.position)
    this.enemyAI = new EnemyAI(this);
    this.cooldownTimer = attackCooldown;
    this.attackCooldown = attackCooldown;


    this.colliderBox = {
      minX: -ENEMY_RADIUS,
      maxX: ENEMY_RADIUS,
      minZ: -ENEMY_RADIUS,
      maxZ: ENEMY_RADIUS,
      // position.y sits at ENEMY_BASE_HEIGHT - the box reaches from the feet up to there
      minY: -ENEMY_BASE_HEIGHT,
      maxY: 0
    }

    loadPixelTexture('./sprites/enemies/RoboOrginalNew.png').then(tex => {
      // The enemy may already have been disposed while loading
      // (retry right after the start) - otherwise this texture would leak.
      if (this.disposed) {
        tex.dispose()
        return
      }

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

  private get mat(): THREE.SpriteMaterial {
    return this.mesh.material as THREE.SpriteMaterial
  }

  /** Shows a frame of the sprite sheet by shifting the texture offset. */
  private applyFrame(frame: number): void {
    if (!this.texture) return
    this.texture.offset.x = frame / TOTAL_FRAMES
  }

  /** Which of the 8 view directions the viewer sees, and whether the sprite must be mirrored. */
  private viewSector(viewerPos: THREE.Vector3): { sector: number; mirror: boolean } {
    const toViewer = Enemy._toViewer.copy(viewerPos).sub(this.position)
    toViewer.y = 0
    toViewer.normalize()
    const fx = this.facing.x
    const fz = this.facing.z
    // Two normalized vectors: facing and toViewer

    // cos(o) for x
    const dot   = fx * toViewer.x + fz * toViewer.z

    // sin(o) for y
    const cross = fx * toViewer.z - fz * toViewer.x 
    // Plot the point; atan2 computes the angle in radians
    const angle = Math.atan2(-cross, dot)
    let a = angle < 0 ? angle + Math.PI * 2 : angle
    return {
      sector: Math.round(a / (Math.PI / 4)) % 8,
      mirror: cross > 0,   // sprite sheet has right-side views only; left side needs flip
    }
  }

  private updateDirection(viewerPos: THREE.Vector3): void {
    const { sector } = this.viewSector(viewerPos)

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

  /** Runs the AI, updates the animation and syncs the sprite with the position. */
  public update(dt: number, ctx: UpdateContext): void {

    this.enemyAI.update(dt, ctx.player.position, ctx.field);
    this.updateEnemyState(dt, ctx.player.position)
    this.mesh.position.copy(this.position)

    if(this.activity === 'shoot') {
      this.attackPlayer(ctx, dt)
    }

    if (this.flashTimer > 0) {
      this.flashTimer -= dt
      if (this.flashTimer <= 0) {
        this.mat.color.setHex(this.alive ? COLOR_ALIVE : COLOR_DEAD)
      }
    }
  }

  private attackPlayer(ctx: UpdateContext, dt: number): void {
    
    this.cooldownTimer -= dt
    if(this.cooldownTimer <= 0) {
      const playerPos = ctx.player.position.clone()
      const toPlayer = playerPos.clone().sub(this.position)
      //toPlayer.y = 0
      toPlayer.normalize()

      const size = new THREE.Vector2(4, 4)

      const projectile = new Projectile({
        size,
        spawnPosition: this.position,
        damage: 10,
        spawnOffset: new THREE.Vector3(toPlayer.x, 0, toPlayer.z),
        shootDir: toPlayer,
        speed: 70,
        projectileColor: 0xdb4646,
        damageGroup: DamageGroup.Player
      })

      ctx.spawnProjectile(projectile)

      this.cooldownTimer = this.attackCooldown
    }
  }

  /** Applies damage and starts the hit flash; at 0 HP the enemy dies and plays its death animation. */
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

  public isAlive(): boolean {
    return this.alive
  }

  /** Sets what the enemy is doing; drives the animation state. */
  public setActivity(activity: 'idle' | 'walk' | 'shoot'): void {
    if (!this.alive) return
    this.activity = activity
  }

  public getColliderBox(): ColliderBox {
    return this.colliderBox;
  }

  public dispose() {
    if (this.disposed) return
    this.disposed = true

    this.texture?.dispose()
    this.texture = null
    this.mesh.removeFromParent()
    // Do NOT dispose mesh.geometry - THREE.Sprite shares one global geometry
    this.mesh.material.dispose()
  }

  public getPosition(): THREE.Vector3 {
    return this.position;
  }
}
