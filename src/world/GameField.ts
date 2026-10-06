import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { ColliderBox, ParsedMap } from '../types'
import { Enemy } from '../entities/Enemy'
import {
  TILE_SIZE, COLOR_WALL_BLOCK,
  STAIR_COUNT, STAIR_WIDTH, STAIR_HEIGHT, COLOR_STAIR,
} from '../GameConstants'
import { parseLevel } from './Map'
import { LevelData, Vec3 } from './LevelData'
import { loadPixelTexture } from '../core/AssetLoader'
import { WALL_TILES, WallTile, DEFAULT_WALL_UV_SCALE } from './WallTiles'
import { StairData, StairDir, buildStairColliders } from './StairData'
import { PhysicsWorld } from '../physics/Physics'
import { NavGrid } from './NavGrid'

// Die Stiegen-Geometrie wird lokal Richtung -z ansteigend gebaut ('^') und dann gedreht
const STAIR_ROTATION: Record<StairDir, number> = {
  '^': 0,
  '<': Math.PI / 2,
  'v': Math.PI,
  '>': -Math.PI / 2,
}

// Toleranz, mit der die Fuesse einer Stiege zugeordnet werden (unter baseY / ueber topY)
const STAIR_FOOT_TOLERANCE: number = 0.5

//Singleton class that represents the game field, including blocks, stairs and enemies
export class GameField implements PhysicsWorld {
  readonly colliders: ColliderBox[] = []
  readonly enemies: Enemy[] = []
  // y = Hoehe der Fuesse
  readonly playerSpawn: Vec3
  // Ebenen-Nav-Grid fuer die Gegner-Wegfindung
  readonly nav: NavGrid

  // Analog zu Weapon.ready: der ctor bleibt synchron, die Block-Texturen kommen
  // asynchron nach. Game.loadLevel() wartet darauf, damit im ersten Frame keine
  // untexturierten Bloecke zu sehen sind.
  readonly ready: Promise<void>

  private meshes: THREE.Mesh[] = []
  private parsed: ParsedMap
  private pending: Promise<void>[] = []
  private textures: THREE.Texture[] = []
  private disposed: boolean = false

  public constructor(level: LevelData) {
    this.parsed = parseLevel(level, TILE_SIZE)
    this.playerSpawn = this.parsed.playerSpawn
    this.nav = new NavGrid(this.parsed.blocks, this.parsed.stairs, TILE_SIZE)

    this.meshes.push(...this.buildBlocks())
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

  // Ein gemergtes Mesh pro Blocktyp: mergeGeometries kennt keine Material-Gruppen,
  // also braucht jede Textur ihr eigenes Mesh.
  private buildBlocks(): THREE.Mesh[] {
    const geosByTile = new Map<string, THREE.BufferGeometry[]>()

    for (const { tile, position, size } of this.parsed.blocks) {
      const geo = new THREE.BoxGeometry(size.x, size.y, size.z)
      scaleBoxUVs(geo, size)
      geo.translate(position.x, position.y, position.z)
      this.colliders.push({
        minX: position.x - size.x / 2,
        maxX: position.x + size.x / 2,
        minY: position.y - size.y / 2,
        maxY: position.y + size.y / 2,
        minZ: position.z - size.z / 2,
        maxZ: position.z + size.z / 2,
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
      meshes.push(this.createBlockMesh(tile, geos))
      for (const geo of geos) geo.dispose()
    }
    return meshes
  }

  private createBlockMesh(tileKey: string, geos: THREE.BufferGeometry[]): THREE.Mesh {
    // COLOR_WALL_BLOCK ist der Fallback, solange die Textur laedt - und bleibt
    // stehen, falls ein Schluessel keine Definition hat.
    const mat = new THREE.MeshLambertMaterial({ color: COLOR_WALL_BLOCK })
    const mesh = new THREE.Mesh(mergeGeometries(geos), mat)

    const def: WallTile | undefined = WALL_TILES[tileKey]
    if (!def) return mesh

    // Blocktyp ohne Textur: nur Farbe
    if (!def.texture) {
      mat.color.setHex(def.color ?? COLOR_WALL_BLOCK)
      return mesh
    }

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

  // Alle Stufen aller Stiegen in einem gemergten Mesh. Jede Stufe ist ein Block von
  // baseY bis zu ihrer Hoehe; zusammengesetzte Stiegen bauen auf dem vorigen Tile auf.
  private buildStairs(): THREE.Mesh | null {
    const geos: THREE.BufferGeometry[] = []

    for (const stair of this.parsed.stairs) {
      for (const { col, row, index } of stair.tiles()) {
        const x: number = col * TILE_SIZE + TILE_SIZE / 2
        const z: number = row * TILE_SIZE + TILE_SIZE / 2
        for (let s = 1; s <= STAIR_COUNT; s++) {
          const height: number = STAIR_HEIGHT * (index * STAIR_COUNT + s)
          const geo = new THREE.BoxGeometry(TILE_SIZE, height, STAIR_WIDTH)
          // Lokal: Stufe 1 an der +z-Kante des Tiles, letzte Stufe an der -z-Kante
          const localZ: number = TILE_SIZE / 2 - STAIR_WIDTH * (s - 0.5)
          geo.translate(0, height / 2, localZ)
          geo.rotateY(STAIR_ROTATION[stair.dir])
          geo.translate(x, stair.baseY, z)
          geos.push(geo)
        }
      }
    }
    this.colliders.push(...buildStairColliders(this.parsed.stairs))

    if (geos.length === 0) return null
    const mesh = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshLambertMaterial({ color: COLOR_STAIR }))
    for (const geo of geos) geo.dispose()
    return mesh
  }

  // Stiege unter den Fuessen. Liegen mehrere Stiegen uebereinander (z. B. unter
  // einer Bruecke), zaehlt nur die, deren Hoehenbereich die Fuesse enthaelt.
  public getStairAt(x: number, z: number, footY: number): StairData | undefined {
    return this.parsed.stairs.find((s: StairData): boolean =>
      s.containsXZ(x, z) &&
      footY >= s.baseY - STAIR_FOOT_TOLERANCE &&
      footY <= s.topY + STAIR_FOOT_TOLERANCE)
  }

  private buildEnemies() {
    for (const { x, y, z } of this.parsed.enemySpawns) {
      this.enemies.push(new Enemy(x, y, z))
    }
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
    // 1024er-Blocktextur im GPU-Speicher liegen.
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
  }
}

// BoxGeometry legt auf jede Seite UVs von 0..1 - bei grossen Bloecken wuerde die
// Textur gestreckt. Hier wird jede Seite auf ihre Groesse in Tiles skaliert, damit die
// Textur pro TILE_SIZE einmal wiederholt wird, egal wie gross der Block ist.
// Seiten-Reihenfolge von BoxGeometry: +x, -x, +y, -y, +z, -z (je 4 Vertices).
function scaleBoxUVs(geo: THREE.BoxGeometry, size: Vec3): void {
  const uv: THREE.BufferAttribute = geo.getAttribute('uv') as THREE.BufferAttribute
  const faceScale: Array<[number, number]> = [
    [size.z, size.y], [size.z, size.y],
    [size.x, size.z], [size.x, size.z],
    [size.x, size.y], [size.x, size.y],
  ]
  for (let face = 0; face < 6; face++) {
    const [su, sv] = faceScale[face]
    for (let v = face * 4; v < face * 4 + 4; v++) {
      uv.setXY(v, uv.getX(v) * su / TILE_SIZE, uv.getY(v) * sv / TILE_SIZE)
    }
  }
  uv.needsUpdate = true
}
