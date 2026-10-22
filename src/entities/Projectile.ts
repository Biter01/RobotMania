import * as THREE from 'three'
import { ColliderBox, UpdateContext, DamageGroup } from '../types'
import { ENEMY_RADIUS, PLAYER_RADIUS } from '../GameConstants'
import { Entity } from './Entity'
import { Enemy } from './Enemy'
import {Physics} from '../physics/Physics'

/** Seconds before a projectile disappears on its own. */
const PROJECTILE_LIFETIME = 3.0
/** Radius of the projectile sphere and its collider. */
const PROJECTILE_MESH_RADIUS = 0.08

/** The path of a projectile during one step: start point o and movement d. */
interface ProjectileGeometry {
  ox: number
  oy: number 
  oz: number // start point x, y, z
  dx: number 
  dy: number 
  dz: number // movement vector of the sphere
}

/**
 * Whether the projectile's path segment hits a vertical cylinder.
 *
 * @param proGeo - Start point and movement of the projectile.
 * @param cx - Center of the cylinder (x).
 * @param cz - Center of the cylinder (z).
 * @param radius - Radius of the cylinder in the XZ plane.
 * @param yMin - Bottom of the cylinder in world coordinates.
 * @param yMax - Top of the cylinder in world coordinates.
 */
function segmentHitsCircle(
  proGeo: ProjectileGeometry,
  cx: number, cz: number,            // center of the target (XZ)
  radius: number,                    // radius of the target (XZ circle)
  yMin: number, yMax: number,       // height range of the cylinder
): boolean {

  // Squared length of the movement in the XZ plane (for the projection)
  const lenSq = proGeo.dx * proGeo.dx + proGeo.dz * proGeo.dz

  // ------------------------------------------------------------
  // 1. PROJECTION:
  // Find the point on the flight path (segment)
  // that is closest to the target in the XZ plane.
  //
  // That is the point with the smallest distance to the circle's center.
  // ------------------------------------------------------------
  const t = lenSq > 1e-12
    ? Math.max(
        0,
        Math.min(
          1,
          ((cx - proGeo.ox) * proGeo.dx + (cz - proGeo.oz) * proGeo.dz) / lenSq
        )
      )
    : 0

  // ------------------------------------------------------------
  // 2. CLOSEST POINT (POINT OF MINIMUM DISTANCE)
  //
  // Point on the flight path at t
  // and its distance to the circle's center
  // ------------------------------------------------------------
  const nearX = proGeo.ox + t * proGeo.dx - cx
  const nearZ = proGeo.oz + t * proGeo.dz - cz

  // ------------------------------------------------------------
  // 3. HORIZONTAL TEST (XZ plane)
  //
  // Check whether this point lies within the radius.
  //
  // -> This is the minimum distance to the circle's center
  // -> If it is larger than the radius, there is no hit
  // ------------------------------------------------------------
  if (nearX * nearX + nearZ * nearZ >= radius * radius)
    return false

  // ------------------------------------------------------------
  // 4. VERTICAL TEST (Y axis)
  //
  // Compute the y position of the same point on the line
  // ------------------------------------------------------------
  const nearY = proGeo.oy + t * proGeo.dy

  // Check whether the point lies within the cylinder's height
  return nearY >= yMin && nearY <= yMax
}

/** Parameters for spawning a {@link Projectile}. */
interface ProjectileConfig {
  size: THREE.Vector2
  spawnPosition: THREE.Vector3
  damage: number
  spawnOffset: THREE.Vector3
  shootDir: THREE.Vector3
  speed: number
  projectileColor: number
  /** Which side this projectile damages. */
  damageGroup: DamageGroup
}


/**
 * A fast shot that flies in a straight line.
 *
 * Every step it sweeps against the static colliders and stops at the first
 * wall; before that it checks hits against enemies or the player, depending
 * on its damage group.
 */
export class Projectile implements Entity {
  mesh: THREE.Mesh
  position: THREE.Vector3
  velocity: THREE.Vector3
  alive = true
  damage: number
  private age = 0
  private prev = new THREE.Vector3()
  private group: DamageGroup

  private colliderBox: ColliderBox

  constructor(config: ProjectileConfig) {
    this.position = config.spawnPosition.clone().add(config.spawnOffset)
    // The first sweep starts at the shooter, not at the spawn point: if the spawn
    // offset lies in or behind a wall, this is detected as a wall hit.
    this.prev.copy(config.spawnPosition)
    this.damage = config.damage

    const dir = config.shootDir.clone().normalize()
    this.velocity = dir.multiplyScalar(config.speed)

    const geo = new THREE.SphereGeometry(PROJECTILE_MESH_RADIUS, config.size.x, config.size.y)
    const mat = new THREE.MeshBasicMaterial({ color: config.projectileColor })
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.position.copy(this.position)
    this.group = config.damageGroup

    this.colliderBox = {
      minX: -PROJECTILE_MESH_RADIUS,
      maxX: PROJECTILE_MESH_RADIUS,
      minZ: -PROJECTILE_MESH_RADIUS,
      maxZ: PROJECTILE_MESH_RADIUS,
      minY: -PROJECTILE_MESH_RADIUS,
      maxY: PROJECTILE_MESH_RADIUS
    }
  }

  /** Moves the projectile, stops it at walls and applies damage on a hit. */
  update(dt: number, ctx: UpdateContext) {
    this.age += dt
    if (this.age > PROJECTILE_LIFETIME) {
      this.alive = false
      return
    }

    this.position.addScaledVector(this.velocity, dt)

    // Earliest wall contact on the path prev -> position. The flight path ends there,
    // so enemies behind the wall are not hit and enemies in front of it are not skipped.
    const tWall: number | null = Physics.getInstance().sweep(ctx.field.colliders, this.prev, this.position, this.getColliderBox())
    const reach: number = tWall ?? 1

    const proGeo: ProjectileGeometry = {
        ox:  this.prev.x,
        oy: this.prev.y,
        oz: this.prev.z,
        dx: (this.position.x - this.prev.x) * reach,
        dy: (this.position.y - this.prev.y) * reach,
        dz: (this.position.z - this.prev.z) * reach
    }

    if (tWall !== null) {
      this.alive = false
      this.position.set(proGeo.ox + proGeo.dx, proGeo.oy + proGeo.dy, proGeo.oz + proGeo.dz)

    }
    
    this.mesh.position.copy(this.position)

    if(this.group == DamageGroup.Enemy) {
        for (const enemy of ctx.field.enemies) {
          if (!enemy.isAlive) continue
          if (this.enemyIsHit(proGeo,enemy)) {
            enemy.takeDamage(this.damage)
            this.alive = false
            return
          }
        }
    } else {
        if(this.playerIsHit(proGeo, ctx, 0, 1.4)) {
          ctx.player.takeDamage(this.damage)
          this.alive = false
        }
    }

    this.prev.copy(this.position)
  }

  private playerIsHit(
      proGeo: ProjectileGeometry,
      ctx: UpdateContext,
      yMin: number, yMax: number,       // height range of the cylinder, relative to the feet

  ): boolean {
    // yMin/yMax are relative to the feet - the player can stand on a higher level
    const footY: number = ctx.player.position.y - ctx.player.baseHeight
    return segmentHitsCircle(proGeo, ctx.player.position.x,ctx.player.position.z,PLAYER_RADIUS,footY + yMin,footY + yMax)
  }
      
  private enemyIsHit(
      proGeo: ProjectileGeometry,
      enemy: Enemy
  ): boolean {  
    // yMin/yMax are relative to the feet - the enemy can stand on a higher level
    const footY: number = enemy.position.y - enemy.baseHeight
    return segmentHitsCircle(proGeo, enemy.position.x, enemy.position.z, ENEMY_RADIUS, footY + enemy.yMin, footY + enemy.yMax)
  }

  public getColliderBox(): ColliderBox {
    return this.colliderBox;
  }

  public getPosition(): THREE.Vector3 {
    return this.position;
  }

  dispose() {
    this.mesh.geometry.dispose()
    ;(this.mesh.material as THREE.Material).dispose()
  }
}
