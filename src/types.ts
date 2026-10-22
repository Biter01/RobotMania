import { InputManager } from "./core/InputManager"
import * as THREE from 'three'
import { Projectile } from "./entities/Projectile"
import { Player } from "./entities/Player"
import { GameField } from "./world/GameField"
import type { StairData } from "./world/StairData"
import type { Vec3 } from "./world/LevelData"


/**
 * Axis-aligned bounding box.
 *
 * Static colliders store world coordinates; entity colliders store values
 * relative to the entity's position (see `toWorldBox` in `Physics.ts`).
 */
export interface ColliderBox {
  minX: number
  maxX: number
  minZ: number
  maxZ: number

  minY: number
  maxY: number
}

/** A level after parsing: the objects of a `LevelData`, ready for `GameField`. */
export interface ParsedMap {
  /** Axis-aligned boxes: `position` is the center, `size` the extent along x/y/z. */
  blocks: Array<{ tile: string; position: Vec3; size: Vec3 }>
  /** Player spawn; `y` is the height of the feet. */
  playerSpawn: Vec3
  /** Enemy spawns; `y` is the height of the feet. */
  enemySpawns: Vec3[]
  stairs: Array<StairData>
}

/** Something that can take damage and die. */
export interface Damageable {
  takeDamage(amount: number): void;
  isAlive(): boolean;
}

/** Top-level state of the game loop and UI. */
export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAMEOVER = 'GAMEOVER',
  WIN = 'WIN',
  LOADING = 'LOADING'
}

/** Everything an entity needs during one frame update. */
export interface UpdateContext {
  /** Seconds since the last frame. */
  dt: number
  input: InputManager
  camera: THREE.PerspectiveCamera
  field: GameField
  player: Player
  /** Adds a new projectile to the running game. */
  spawnProjectile: (p: Projectile) => void
}

/** Which side a projectile damages. */
export enum DamageGroup {
  Player,
  Enemy
}