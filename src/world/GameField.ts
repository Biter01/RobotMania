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

/** Stair geometry is built locally rising towards -z (`'^'`) and then rotated by this angle. */
const STAIR_ROTATION: Record<StairDir, number> = {
  '^': 0,
  '<': Math.PI / 2,
  'v': Math.PI,
  '>': -Math.PI / 2,
}

/** Tolerance for matching feet to a stair (below baseY / above topY). */
const STAIR_FOOT_TOLERANCE: number = 0.5

/**
 * The playable world of one level: block and stair meshes, their colliders,
 * the enemies and the nav grid.
 *
 * Implements {@link PhysicsWorld}, so it can be passed straight to the physics.
 */
export class GameField implements PhysicsWorld {
  /** All static colliders (blocks and stair sides) in world coordinates. */
  readonly colliders: ColliderBox[] = []
  /** Living enemies of this level. */
  readonly enemies: Enemy[] = []
  /** Player spawn; `y` is the height of the feet. */
  readonly playerSpawn: Vec3
  /** Layered nav grid for enemy pathfinding. */
  readonly nav: NavGrid

  /**
   * Like Weapon.ready: the constructor stays synchronous and block textures
   * arrive asynchronously. Game.loadLevel() awaits this, so no untextured
   * blocks are visible in the first frame.
   */
  readonly ready: Promise<void>

  private meshes: THREE.Mesh[] = []
  private parsed: ParsedMap
  private pending: Promise<void>[] = []
  private textures: THREE.Texture[] = []
  private disposed: boolean = false

  /** Builds meshes, colliders, enemies and the nav grid for `level`. */
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

  /** Resolves once all block textures are loaded. See {@link ready}. */
  public isReady(): Promise<void> {
    return this.ready
  }

  /** Adds all meshes and enemy sprites to the scene. */
  render(scene: THREE.Scene) {
    for (const mesh of this.meshes) {
      scene.add(mesh)
    }
    for (const enemy of this.enemies) {
      scene.add(enemy.mesh)
    }
  }

  /**
   * One merged mesh per block type: mergeGeometries does not support material
   * groups, so every texture needs its own mesh.
   */
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
    // COLOR_WALL_BLOCK is the fallback while the texture loads - and stays
    // if a key has no definition.
    const mat = new THREE.MeshLambertMaterial({ color: COLOR_WALL_BLOCK })
    const mesh = new THREE.Mesh(mergeGeometries(geos), mat)

    const def: WallTile | undefined = WALL_TILES[tileKey]
    if (!def) return mesh

    // Block type without a texture: color only
    if (!def.texture) {
      mat.color.setHex(def.color ?? COLOR_WALL_BLOCK)
      return mesh
    }

    const uvScale: { x: number; y: number } = def.uvScale ?? DEFAULT_WALL_UV_SCALE

    this.pending.push(
      loadPixelTexture(def.texture, THREE.SRGBColorSpace, { mipmaps: true }).then(
        (tex: THREE.Texture) => {
          // A retry/level change may have disposed the field while loading
          // - otherwise this texture would leak.
          if (this.disposed) {
            tex.dispose()
            return
          }

          tex.wrapS = THREE.RepeatWrapping
          tex.wrapT = THREE.RepeatWrapping
          tex.repeat.set(uvScale.x, uvScale.y)

          this.textures.push(tex)
          mat.map = tex
          // Only switch to the tint now: the grey fallback would otherwise
          // darken the texture.
          mat.color.setHex(def.color ?? 0xffffff)
          mat.needsUpdate = true
        }
      )
    )

    return mesh
  }

  /**
   * All steps of all stairs in one merged mesh. Every step is a block from
   * baseY up to its height; composed stairs build on top of the previous tile.
   */
  private buildStairs(): THREE.Mesh | null {
    const geos: THREE.BufferGeometry[] = []

    for (const stair of this.parsed.stairs) {
      for (const { col, row, index } of stair.tiles()) {
        const x: number = col * TILE_SIZE + TILE_SIZE / 2
        const z: number = row * TILE_SIZE + TILE_SIZE / 2
        for (let s = 1; s <= STAIR_COUNT; s++) {
          const height: number = STAIR_HEIGHT * (index * STAIR_COUNT + s)
          const geo = new THREE.BoxGeometry(TILE_SIZE, height, STAIR_WIDTH)
          // Local: step 1 at the tile's +z edge, last step at the -z edge
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

  /**
   * Finds the stair under the feet. If several stairs lie above each other
   * (e.g. under a bridge), only the one whose height range contains the feet counts.
   * @param footY - Height of the feet.
   */
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

  /** Releases all meshes, textures and enemies of this level. */
  public dispose() {
    // Set before cleaning up: texture loads still in flight see this and
    // release their texture themselves.
    this.disposed = true

    for (const mesh of this.meshes) {
      // Detach first: a disposed geometry still in the scene would be
      // registered and uploaded again on the next render().
      mesh.removeFromParent()
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
    }

    // Materials do not release their map - otherwise every retry would leave
    // a 1024px block texture in GPU memory.
    for (const tex of this.textures) {
      tex.dispose()
    }

    for (const enemie of this.enemies) {
      enemie.dispose();
    }

    // Empty the arrays - Game.ctx.field still points at this instance
    this.meshes.length = 0
    this.colliders.length = 0
    this.enemies.length = 0
    this.textures.length = 0
    this.pending.length = 0
  }
}

/**
 * Scales a box's UVs to its size in tiles.
 *
 * BoxGeometry puts UVs from 0..1 on every face, which would stretch the texture
 * on large blocks. Scaling each face to its size in tiles repeats the texture
 * once per TILE_SIZE, no matter how big the block is.
 * BoxGeometry face order: +x, -x, +y, -y, +z, -z (4 vertices each).
 */
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
