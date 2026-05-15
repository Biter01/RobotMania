import * as THREE from 'three'
import { WallBox } from '../types'
import { Enemy } from './Enemy'
import { PROJECTILE_SPEED, ENEMY_RADIUS } from '../GameConstants'

const PROJECTILE_LIFETIME = 3.0
const PROJECTILE_MESH_RADIUS = 0.08

function segmentHitsBox(ox: number, oz: number, dx: number, dz: number, box: WallBox): boolean {
  let tmin = 0
  let tmax = 1
  
  if (Math.abs(dx) < 1e-9) {
    if (ox < box.minX || ox > box.maxX) return false
  } else {
    let t1 = (box.minX - ox) / dx
    let t2 = (box.maxX - ox) / dx
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp }
    tmin = Math.max(tmin, t1)
    tmax = Math.min(tmax, t2)
    if (tmin > tmax) return false
  }

  if (Math.abs(dz) < 1e-9) {
    if (oz < box.minZ || oz > box.maxZ) return false
  } else {
    let t1 = (box.minZ - oz) / dz
    let t2 = (box.maxZ - oz) / dz
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp }
    tmin = Math.max(tmin, t1)
    tmax = Math.min(tmax, t2)
    if (tmin > tmax) return false
  }

  return true
}


function segmentHitsCircle(
  ox: number, oy: number, oz: number, // Startpunkt der Kugel
  dx: number, dy: number, dz: number, // Bewegungsvektor der Kugel (Segment)
  cx: number, cz: number,            // Zentrum des Gegners (XZ)
  radius: number,                    // Radius des Gegners (XZ-Kreis)
  yMin: number, yMax: number,       // Höhe des Zylinders
): boolean {

  // Länge der Bewegung im XZ-Bereich (für Projektion)
  const lenSq = dx * dx + dz * dz

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
          ((cx - ox) * dx + (cz - oz) * dz) / lenSq
        )
      )
    : 0

  // ------------------------------------------------------------
  // 2. NÄCHSTER PUNKT (MINIMALER ABSTANDSPUNKT)
  //
  // Punkt auf der Flugbahn bei t
  // und Abstand zum Kreiszentrum
  // ------------------------------------------------------------
  const nearX = ox + t * dx - cx
  const nearZ = oz + t * dz - cz

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
  const nearY = oy + t * dy

  // Prüfe ob der Punkt innerhalb der Zylinder-Höhe liegt
  return nearY >= yMin && nearY <= yMax
}

export class Projectile {
  mesh: THREE.Mesh
  position: THREE.Vector3
  velocity: THREE.Vector3
  alive = true
  damage: number
  private age = 0
  private prev = new THREE.Vector3()

  constructor(camera: THREE.Camera, damage: number, spawnOffset = new THREE.Vector3()) {
    this.position = camera.position.clone().add(spawnOffset)
    this.prev.copy(this.position)
    this.damage = damage

    const dir = new THREE.Vector3()
    camera.getWorldDirection(dir)
    this.velocity = dir.multiplyScalar(PROJECTILE_SPEED)

    const geo = new THREE.SphereGeometry(PROJECTILE_MESH_RADIUS, 6, 6)
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff })
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.position.copy(this.position)
  }

  update(dt: number, walls: WallBox[], enemies: Enemy[]) {
    this.age += dt
    if (this.age > PROJECTILE_LIFETIME) {
      this.alive = false
      return
    }

    this.prev.copy(this.position)
    this.position.addScaledVector(this.velocity, dt)
    this.mesh.position.copy(this.position)

    const ox = this.prev.x
    const oy = this.prev.y
    const oz = this.prev.z
    const dx = this.position.x - ox
    const dy = this.position.y - oy
    const dz = this.position.z - oz

    for (const box of walls) {
      if (segmentHitsBox(ox, oz, dx, dz, box)) {
        this.alive = false
        return
      }
    }

    for (const enemy of enemies) {
      if (!enemy.alive) continue
      if (segmentHitsCircle(ox, oy, oz, dx, dy, dz, enemy.position.x, enemy.position.z, ENEMY_RADIUS, enemy.yMin, enemy.yMax)) {
        enemy.takeDamage(this.damage)
        this.alive = false
        return
      }
    }
  }

  dispose() {
    this.mesh.geometry.dispose()
    ;(this.mesh.material as THREE.Material).dispose()
  }
}
