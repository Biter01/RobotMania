import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { ColliderBox } from '../types'
import { Enemy } from '../entities/Enemy'
import { TILE_SIZE, WALL_HEIGHT, BLOCK_HALF_SIZE, COLOR_FLOOR, COLOR_WALL_BLOCK } from '../GameConstants'
import { parseMap } from './Map'
import { ParsedMap } from '../types'

//Singleton class that represents the game field, including walls, floor, and enemies
export class GameField {
  readonly colliders: ColliderBox[] = []
  readonly enemies: Enemy[] = []
  readonly playerSpawn: { x: number; z: number }

  readonly tileMap: string[]

  private meshes: THREE.Mesh[] = []
  private parsed: ParsedMap
  private walkableSet: Set<string>

  public constructor(current_level: string[]) {
    this.parsed = parseMap(current_level, TILE_SIZE)
    this.playerSpawn = this.parsed.playerSpawn
    this.walkableSet = new Set(this.parsed.walkableTiles.map(t => `${t.x},${t.z}`))

    this.tileMap = current_level
    this.meshes.push(this.buildFloor())
    this.meshes.push(this.buildWallBlocks())
    this.buildEnemies()

    for (const mesh of this.meshes) {
      mesh.matrixAutoUpdate = false
    }
  }

  render(scene: THREE.Scene) {
    for (const mesh of this.meshes) {
      scene.add(mesh)
    }
    for (const enemy of this.enemies) {
      scene.add(enemy.mesh)
    }
  }

  private buildFloor(): THREE.Mesh {
    const w = this.parsed.cols * TILE_SIZE
    const d = this.parsed.rows * TILE_SIZE
    const geo = new THREE.PlaneGeometry(w, d)
    geo.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
    geo.applyMatrix4(new THREE.Matrix4().makeTranslation(w / 2, 0, d / 2))
    const mat = new THREE.MeshLambertMaterial({ color: COLOR_FLOOR })
    return new THREE.Mesh(geo, mat)
  }

  private buildWallBlocks(): THREE.Mesh {
    const geos = this.parsed.walls.map(({ x, z }) => {
      const geo = new THREE.BoxGeometry(TILE_SIZE, WALL_HEIGHT, TILE_SIZE)
      geo.applyMatrix4(new THREE.Matrix4().makeTranslation(x, WALL_HEIGHT / 2, z))
      this.colliders.push({
        minX: x - BLOCK_HALF_SIZE,
        maxX: x + BLOCK_HALF_SIZE,
        minZ: z - BLOCK_HALF_SIZE,
        maxZ: z + BLOCK_HALF_SIZE,
      })
      return geo
    })

    const mat = new THREE.MeshLambertMaterial({ color: COLOR_WALL_BLOCK })
    return new THREE.Mesh(mergeGeometries(geos), mat)
  }

  private buildEnemies() {
    for (const { x, z } of this.parsed.enemySpawns) {
      this.enemies.push(new Enemy(x, z))
    }
  }

  public isTileWalkable(x: number, z: number): boolean {
    return this.walkableSet.has(`${x},${z}`)
  }

  public dispose() {
    for (const mesh of this.meshes) {
      // Erst abhaengen: eine disposte Geometry, die noch in der Scene haengt,
      // wird beim naechsten render() neu registriert und neu hochgeladen.
      mesh.removeFromParent()
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
    }

    for (const enemie of this.enemies) {
      enemie.dispose();
    }

    // Arrays leeren - Game.ctx.field zeigt auf diese Instanz
    this.meshes.length = 0
    this.colliders.length = 0
    this.enemies.length = 0
  }
}
