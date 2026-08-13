import * as THREE from 'three'
import { InputManager } from '../core/InputManager'
import { clamp } from '../utils/MathUtils'
import {
  PLAYER_SPEED, PLAYER_RADIUS, PLAYER_EYE_HEIGHT,
  MOUSE_SENSITIVITY, PITCH_LIMIT_DEG,
} from '../GameConstants'
import { Entity } from './Entity'  
import { Weapon } from '../weapons/Weapon'
import { Pistol } from '../weapons/Pistol'
import { ColliderBox, UpdateContext } from '../types'

const PITCH_LIMIT = (PITCH_LIMIT_DEG * Math.PI) / 180

export class Player implements Entity {
  camera: THREE.PerspectiveCamera
  position: THREE.Vector3
  hp = 100

  private yaw = 0
  private pitch = 0
  private moveDir = new THREE.Vector3()
  private weapon: Weapon;

  constructor(camera: THREE.PerspectiveCamera, spawnX = 2, spawnZ = 2) {
    this.camera = camera
    this.position = new THREE.Vector3(spawnX, PLAYER_EYE_HEIGHT, spawnZ)
    this.yaw = Math.PI
    this.camera.position.copy(this.position)
    this.weapon = new Pistol(this.camera)
  }

  update(dt: number, ctx: UpdateContext) {
    this.handleLook(ctx.input)
    this.handleMove(dt, ctx.input, ctx.colliders)
    this.updateWeapon(dt, ctx)
  }

  private handleLook(input: InputManager) {
    const { dx, dy } = input.consumeMouse()
    this.yaw   -= dx * MOUSE_SENSITIVITY
    this.pitch  = clamp(this.pitch - dy * MOUSE_SENSITIVITY, -PITCH_LIMIT, PITCH_LIMIT)

    const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ')
    this.camera.quaternion.setFromEuler(euler)
  }

  private overlapsBox(x: number, z: number, box: ColliderBox): boolean {
    return (
      x + PLAYER_RADIUS > box.minX &&
      x - PLAYER_RADIUS < box.maxX &&
      z + PLAYER_RADIUS > box.minZ &&
      z - PLAYER_RADIUS < box.maxZ
    )
  }

  private handleMove(dt: number, input: InputManager, colliders: ColliderBox[]) {
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

    const newX = this.position.x + this.moveDir.x * PLAYER_SPEED * dt
    const newZ = this.position.z + this.moveDir.z * PLAYER_SPEED * dt

    // Axis-separated collision – allows sliding along walls
    const blockedX = colliders.some(b => this.overlapsBox(newX, this.position.z, b))
    if (!blockedX) this.position.x = newX

    const blockedZ = colliders.some(b => this.overlapsBox(this.position.x, newZ, b))
    if (!blockedZ) this.position.z = newZ

    this.camera.position.copy(this.position)
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
}
