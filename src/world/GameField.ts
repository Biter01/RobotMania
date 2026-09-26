import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { ColliderBox } from '../types'
import { Enemy } from '../entities/Enemy'
import {
  TILE_SIZE, WALL_HEIGHT, BLOCK_HALF_SIZE, COLOR_FLOOR, COLOR_WALL_BLOCK,
  STAIR_COUNT, STAIR_WIDTH, STAIR_HEIGHT, COLOR_STAIR,
} from '../GameConstants'
import { parseMap } from './Map'
import { ParsedMap } from '../types'
import { loadPixelTexture } from '../core/AssetLoader'
import { WALL_TILES, WallTile, DEFAULT_WALL_UV_SCALE } from './WallTiles'
import { StairData, StairDir, buildStairSideColliders } from './StairData'
import { PhysicsWorld } from '../physics/Physics'

// Die Stiegen-Geometrie wird lokal Richtung -z ansteigend gebaut ('^') und dann gedreht
const STAIR_ROTATION: Record<StairDir, number> = {
  '^': 0,
  '<': Math.PI / 2,
  'v': Math.PI,
  '>': -Math.PI / 2,
}

//Singleton class that represents the game field, including walls, floor, and enemies
export class GameField implements PhysicsWorld {
  readonly colliders: ColliderBox[] = []
  readonly enemies: Enemy[] = []
  readonly playerSpawn: { x: number; z: number }

  readonly tileMap: string[]

  // Analog zu Weapon.ready: der ctor bleibt synchron, die Wand-Texturen kommen
  // asynchron nach. Game.loadLevel() wartet darauf, damit im ersten Frame keine
  // untexturierten Waende zu sehen sind.
  readonly ready: Promise<void>

  private meshes: THREE.Mesh[] = []
  private parsed: ParsedMap
  private walkableSet: Set<string>
  // "col,row" -> Stiege; alle Tiles einer zusammengesetzten Stiege zeigen auf dieselbe StairData
  private stairLookup: Map<string, StairData> = new Map()
  private pending: Promise<void>[] = []
  private textures: THREE.Texture[] = []
  private disposed: boolean = false

  public constructor(current_level: string[]) {
    this.parsed = parseMap(current_level, TILE_SIZE)
    this.playerSpawn = this.parsed.playerSpawn
    this.walkableSet = new Set(this.parsed.walkableTiles.map(t => `${t.x},${t.z}`))

    this.tileMap = current_level
    this.meshes.push(this.buildFloor())
    this.meshes.push(...this.buildWallBlocks())
    const stairMesh: THREE.Mesh | null = this.buildStairs()
    if (stairMesh) this.meshes.push(stairMesh)
    this.buildEnemies()

    for (const mesh of this.meshes) {
      mesh.matrixAutoUpdate = false
    }

    this.ready = Promise.all(this.pending).then(() => undefined)
  }

  public isReady(): Promise<void> {
    return this.ready
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

  // Ein gemergtes Mesh pro Wandtyp: mergeGeometries kennt keine Material-Gruppen,
  // also braucht jede Textur ihr eigenes Mesh. Bei nur einem Tile-Typ bleibt es
  // wie bisher bei genau einem Draw-Call fuer alle Waende.
  private buildWallBlocks(): THREE.Mesh[] {
    const geosByTile = new Map<string, THREE.BufferGeometry[]>()

    for (const { x, z, tile } of this.parsed.walls) {
      const geo = new THREE.BoxGeometry(TILE_SIZE, WALL_HEIGHT, TILE_SIZE)
      geo.applyMatrix4(new THREE.Matrix4().makeTranslation(x, WALL_HEIGHT / 2, z))
      this.colliders.push({
        minX: x - BLOCK_HALF_SIZE,
        maxX: x + BLOCK_HALF_SIZE,
        minZ: z - BLOCK_HALF_SIZE,
        maxZ: z + BLOCK_HALF_SIZE,
      })

      const group: THREE.BufferGeometry[] | undefined = geosByTile.get(tile)
      if (group) {
        group.push(geo)
      } else {
        geosByTile.set(tile, [geo])
      }
    }

    const meshes: THREE.Mesh[] = []
    for (const [tile, geos] of geosByTile) {
      meshes.push(this.createWallMesh(tile, geos))
    }
    return meshes
  }

  private createWallMesh(tileChar: string, geos: THREE.BufferGeometry[]): THREE.Mesh {
    // COLOR_WALL_BLOCK ist der Fallback, solange die Textur laedt - und bleibt
    // stehen, falls ein Zeichen keine Definition hat.
    const mat = new THREE.MeshLambertMaterial({ color: COLOR_WALL_BLOCK })
    const mesh = new THREE.Mesh(mergeGeometries(geos), mat)

    const def: WallTile | undefined = WALL_TILES[tileChar]
    if (!def) return mesh

    const uvScale: { x: number; y: number } = def.uvScale ?? DEFAULT_WALL_UV_SCALE

    this.pending.push(
      loadPixelTexture(def.texture, THREE.SRGBColorSpace, { mipmaps: true }).then(
        (tex: THREE.Texture) => {
          // Retry/Level-Wechsel kann das Feld waehrend des Ladens disposed haben
          // - sonst leakt diese Textur.
          if (this.disposed) {
            tex.dispose()
            return
          }

          tex.wrapS = THREE.RepeatWrapping
          tex.wrapT = THREE.RepeatWrapping
          tex.repeat.set(uvScale.x, uvScale.y)

          this.textures.push(tex)
          mat.map = tex
          // Erst jetzt auf den Tint wechseln: der graue Fallback wuerde die
          // Textur sonst abdunkeln.
          mat.color.setHex(def.color ?? 0xffffff)
          mat.needsUpdate = true
        }
      )
    )

    return mesh
  }

  // Alle Stufen aller Stiegen in einem gemergten Mesh. Jede Stufe ist ein Block vom
  // Boden bis zu ihrer Hoehe; zusammengesetzte Stiegen bauen auf dem vorigen Tile auf.
  private buildStairs(): THREE.Mesh | null {
    const geos: THREE.BufferGeometry[] = []

    for (const stair of this.parsed.stairs) {
      for (const { col, row, index } of stair.tiles()) {
        this.stairLookup.set(`${col},${row}`, stair)

        const x: number = col * TILE_SIZE + TILE_SIZE / 2
        const z: number = row * TILE_SIZE + TILE_SIZE / 2
        for (let s = 1; s <= STAIR_COUNT; s++) {
          const height: number = STAIR_HEIGHT * (index * STAIR_COUNT + s)
          const geo = new THREE.BoxGeometry(TILE_SIZE, height, STAIR_WIDTH)
          // Lokal: Stufe 1 an der +z-Kante des Tiles, letzte Stufe an der -z-Kante
          const localZ: number = TILE_SIZE / 2 - STAIR_WIDTH * (s - 0.5)
          geo.translate(0, height / 2, localZ)
          geo.rotateY(STAIR_ROTATION[stair.dir])
          geo.translate(x, 0, z)
          geos.push(geo)
        }
      }
    }
    this.colliders.push(...buildStairSideColliders(this.parsed.stairs))

    if (geos.length === 0) return null
    const mesh = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshLambertMaterial({ color: COLOR_STAIR }))
    for (const geo of geos) geo.dispose()
    return mesh
  }

  public getStairAt(x: number, z: number): StairData | undefined {
    return this.stairLookup.get(`${Math.floor(x / TILE_SIZE)},${Math.floor(z / TILE_SIZE)}`)
  }

  public getTileChar(col: number, row: number): string | undefined {
    return this.tileMap[row]?.[col]
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
    // Vor dem Aufraeumen setzen: noch laufende Textur-Loads erkennen daran, dass
    // sie ins Leere laufen, und geben ihre Textur selbst wieder frei.
    this.disposed = true

    for (const mesh of this.meshes) {
      // Erst abhaengen: eine disposte Geometry, die noch in der Scene haengt,
      // wird beim naechsten render() neu registriert und neu hochgeladen.
      mesh.removeFromParent()
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
    }

    // Die Materials geben ihre map nicht mit frei - sonst bliebe pro Retry eine
    // 1024er-Wandtextur im GPU-Speicher liegen.
    for (const tex of this.textures) {
      tex.dispose()
    }

    for (const enemie of this.enemies) {
      enemie.dispose();
    }

    // Arrays leeren - Game.ctx.field zeigt auf diese Instanz
    this.meshes.length = 0
    this.colliders.length = 0
    this.enemies.length = 0
    this.textures.length = 0
    this.pending.length = 0
    this.stairLookup.clear()
  }
}
