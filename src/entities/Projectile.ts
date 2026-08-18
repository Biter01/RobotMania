import * as THREE from 'three'
import { ColliderBox, UpdateContext, DamageGroup } from '../types'
import { ENEMY_RADIUS, PLAYER_RADIUS } from '../GameConstants'
import { Entity } from './Entity'
import { Enemy } from './Enemy'



const PROJECTILE_LIFETIME = 3.0
const PROJECTILE_MESH_RADIUS = 0.08


interface ProjectileGeometry {
  ox: number
  oy: number 
  oz: number // Starting point x,y,z
  dx: number 
  dy: number 
  dz: number // Movement Vector sphere
}


function segmentHitsBox(proGeo: ProjectileGeometry, box: ColliderBox): boolean {
  let tmin = 0
  let tmax = 1
  
  if (Math.abs(proGeo.dx) < 1e-9) {
    if (proGeo.ox < box.minX || proGeo.ox > box.maxX) return false
  } else {
    let t1 = (box.minX - proGeo.ox) / proGeo.dx
    let t2 = (box.maxX - proGeo.ox) / proGeo.dx
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp }
    tmin = Math.max(tmin, t1)
    tmax = Math.min(tmax, t2)
    if (tmin > tmax) return false
  }

  if (Math.abs(proGeo.dz) < 1e-9) {
    if (proGeo.oz < box.minZ || proGeo.oz > box.maxZ) return false
  } else {
    let t1 = (box.minZ - proGeo.oz) / proGeo.dz
    let t2 = (box.maxZ - proGeo.oz) / proGeo.dz
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp }
    tmin = Math.max(tmin, t1)
    tmax = Math.min(tmax, t2)
    if (tmin > tmax) return false
  }

  return true
}

function segmentHitsCircle(
  proGeo: ProjectileGeometry,
  cx: number, cz: number,            // Zentrum des Gegners (XZ)
  radius: number,                    // Radius des Gegners (XZ-Kreis)
  yMin: number, yMax: number,       // Höhe des Zylinders
): boolean {

  // Länge der Bewegung im XZ-Bereich (für Projektion)
  const lenSq = proGeo.dx * proGeo.dx + proGeo.dz * proGeo.dz

  // ------------------------------------------------------------
  // 1. PROJEKTION:
  // Finde den Punkt auf der Flugbahn (Segment),
  // der dem Gegner im XZ-Bereich am nächsten liegt.
  //
  // Das ist der Punkt mit minimalem Abstand zur Kreismitte.
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
  // 2. NÄCHSTER PUNKT (MINIMALER ABSTANDSPUNKT)
  //
  // Punkt auf der Flugbahn bei t
  // und Abstand zum Kreiszentrum
  // ------------------------------------------------------------
  const nearX = proGeo.ox + t * proGeo.dx - cx
  const nearZ = proGeo.oz + t * proGeo.dz - cz

  // ------------------------------------------------------------
  // 3. HORIZONTALER TEST (XZ-Ebene)
  //
  // Prüfe ob dieser Punkt innerhalb des Radius liegt.
  //
  // -> Das ist der minimale Abstand zur Kreismitte
  // -> Wenn dieser größer als Radius ist, gibt es keinen Treffer
  // ------------------------------------------------------------
  if (nearX * nearX + nearZ * nearZ >= radius * radius)
    return false

  // ------------------------------------------------------------
  // 4. VERTIKALER TEST (Y-Achse)
  //
  // Berechne Y-Position des gleichen Punktes auf der Linie
  // ------------------------------------------------------------
  const nearY = proGeo.oy + t * proGeo.dy

  // Prüfe ob der Punkt innerhalb der Zylinder-Höhe liegt
  return nearY >= yMin && nearY <= yMax
}

interface ProjectileConfig {
  size: THREE.Vector2
  spawnPosition: THREE.Vector3
  damage: number
  spawnOffset: THREE.Vector3
  shootDir: THREE.Vector3
  speed: number
  projectileColor: number
  damageGroup: DamageGroup   // NEU
}


export class Projectile implements Entity {
  mesh: THREE.Mesh
  position: THREE.Vector3
  velocity: THREE.Vector3
  alive = true
  damage: number
  private age = 0
  private prev = new THREE.Vector3()
  private group: DamageGroup

  constructor(config: ProjectileConfig) {
    this.position = config.spawnPosition.clone().add(config.spawnOffset)
    this.prev.copy(this.position)
    this.damage = config.damage

    const dir = config.shootDir.clone().normalize()
    this.velocity = dir.multiplyScalar(config.speed)

    const geo = new THREE.SphereGeometry(PROJECTILE_MESH_RADIUS, config.size.x, config.size.y)
    const mat = new THREE.MeshBasicMaterial({ color: config.projectileColor })
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.position.copy(this.position)
    this.group = config.damageGroup
  }

  update(dt: number, ctx: UpdateContext) {
    this.age += dt
    if (this.age > PROJECTILE_LIFETIME) {
      this.alive = false
      return
    }

    this.prev.copy(this.position)
    this.position.addScaledVector(this.velocity, dt)
    this.mesh.position.copy(this.position)

    

    const proGeo: ProjectileGeometry = { 
        ox:  this.prev.x,
        oy: this.prev.y,
        oz: this.prev.z,
        dx: this.position.x - this.prev.x,
        dy: this.position.y - this.prev.y,
        dz: this.position.z - this.prev.z
    }


    for (const box of ctx.colliders) {
      if (segmentHitsBox(proGeo, box)) {
        this.alive = false
        return
      }
    }


    if(this.group == DamageGroup.Enemy) {
        for (const enemy of ctx.enemies) {
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
  }

  private playerIsHit(
      proGeo: ProjectileGeometry,
      ctx: UpdateContext,
      yMin: number, yMax: number,       // Höhe des Zylinders): boolean {

  ): boolean {
    return segmentHitsCircle(proGeo, ctx.player.position.x,ctx.player.position.z,PLAYER_RADIUS,yMin,yMax)
  }
      
  private enemyIsHit(
      proGeo: ProjectileGeometry,
      enemy: Enemy
  ): boolean {  
    return segmentHitsCircle(proGeo, enemy.position.x, enemy.position.z, ENEMY_RADIUS, enemy.yMin, enemy.yMax)
  }

  dispose() {
    this.mesh.geometry.dispose()
    ;(this.mesh.material as THREE.Material).dispose()
  }
}
