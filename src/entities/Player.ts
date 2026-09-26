import * as THREE from 'three'
import { InputManager } from '../core/InputManager'
import { clamp } from '../utils/MathUtils'
import {
  PLAYER_SPEED, PLAYER_EYE_HEIGHT,
  MOUSE_SENSITIVITY, PLAYER_PITCH_LIMIT,
  PLAYER_HALF_WIDTH_X, PLAYER_HALF_WIDTH_Z,
} from '../GameConstants'
import { ShaderPass }     from 'three/addons/postprocessing/ShaderPass.js'
import { Entity } from './Entity'  
import { Weapon } from '../weapons/Weapon'
import { Pistol } from '../weapons/Pistol'
import { ColliderBox, Damageable, UpdateContext } from '../types'
import { Physics, PhysicsBody, PhysicsWorld } from '../physics/Physics'

export class Player implements Entity, Damageable, PhysicsBody {
  camera: THREE.PerspectiveCamera
  position: THREE.Vector3
  private health = 100
  private invincible = false;

  private yaw = 0
  private pitch = 0
  readonly moveDir = new THREE.Vector3()
  readonly weapon: Weapon
  
  //Damage Shader private fields
  private damageFlashIntensity = 0
  private damageShaderPass!: ShaderPass
  private readonly DAMAGE_FLASH_DECAY_RATE = 3 
  private readonly DAMAGE_FLASH_PER_DAMAGE = 0.05

  private colliderBox: ColliderBox
  readonly baseHeight: number = PLAYER_EYE_HEIGHT
  private static readonly _velocity = new THREE.Vector3()

  constructor(camera: THREE.PerspectiveCamera, spawnX = 2, spawnZ = 2) {
    this.camera = camera
    this.position = new THREE.Vector3(spawnX, PLAYER_EYE_HEIGHT, spawnZ)
    this.yaw = Math.PI
    this.camera.position.copy(this.position)
    this.weapon = new Pistol(this.camera)
    this.colliderBox = {
      minX: -PLAYER_HALF_WIDTH_X,
      maxX: PLAYER_HALF_WIDTH_X,
      minZ: -PLAYER_HALF_WIDTH_Z,
      maxZ: PLAYER_HALF_WIDTH_Z
    }
  }

  update(dt: number, ctx: UpdateContext) {
    this.handleLook(ctx.input)
    this.handleMove(dt, ctx.input, ctx.field)
    this.updateWeapon(dt, ctx)

    this.updateDamageShader(dt)
  }

  private updateDamageShader(dt: number) {
    this.damageFlashIntensity = clamp(
      this.damageFlashIntensity - this.DAMAGE_FLASH_DECAY_RATE * dt,
      0, 1
    )
    this.damageShaderPass.uniforms.intensity.value = this.damageFlashIntensity
  }

  public setDamageShader(shader: ShaderPass): void {
    this.damageShaderPass = shader
  }
  
  private handleLook(input: InputManager) {
    const { dx, dy } = input.consumeMouse()
    this.yaw   -= dx * MOUSE_SENSITIVITY
    this.pitch  = clamp(this.pitch - dy * MOUSE_SENSITIVITY, -PLAYER_PITCH_LIMIT, PLAYER_PITCH_LIMIT)

    const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ')
    this.camera.quaternion.setFromEuler(euler)
  }

  // Entscheidet nur, wohin bewegt wird - Bewegung, Kollision und Stiegen macht Physics
  private handleMove(dt: number, input: InputManager, world: PhysicsWorld) {
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw))
    const right   = new THREE.Vector3( Math.cos(this.yaw), 0, -Math.sin(this.yaw))

    this.moveDir.set(0, 0, 0)
    if (input.keys['KeyW']) this.moveDir.addScaledVector(forward,  1)
    if (input.keys['KeyS']) this.moveDir.addScaledVector(forward, -1)
    if (input.keys['KeyA']) this.moveDir.addScaledVector(right,   -1)
    if (input.keys['KeyD']) this.moveDir.addScaledVector(right,    1)

    if (this.moveDir.lengthSq() > 0) {
      this.moveDir.normalize()
    }

    const velocity: THREE.Vector3 = Player._velocity.copy(this.moveDir).multiplyScalar(PLAYER_SPEED)
    Physics.getInstance().computePhysics(this, world, velocity, dt)

    this.camera.position.copy(this.position)
  }

  public takeDamage(amount: number): void {
    if(this.invincible) {
      return
    }
  
    this.health -= amount;

    this.damageFlashIntensity = clamp(
      this.damageFlashIntensity + amount * this.DAMAGE_FLASH_PER_DAMAGE,
      0, 1
    )

  }

  public isAlive(): boolean {
    return this.health > 0
  }

  private updateWeapon(dt: number, ctx: UpdateContext) {
    this.weapon.update(dt, ctx)
  }

  get isMoving(): boolean {
    return this.moveDir.lengthSq() > 0
  }

  public dispose(): void{
    this.weapon.dispose()
  }

  public setInvincible(boolVal:boolean):void {
    this.invincible = boolVal
  }

  public getHealth() {
    return this.health;
  }

  public isReady(): Promise<void> {
        return this.weapon.ready
  }

  public getColliderBox(): { minX: number; maxX: number; minZ: number; maxZ: number } {
    return this.colliderBox;
  }

  public getPosition(): THREE.Vector3 {
    return this.position;
  }
}