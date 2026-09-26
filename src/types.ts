import { InputManager } from "./core/InputManager"
import * as THREE from 'three'
import { Projectile } from "./entities/Projectile"
import { Player } from "./entities/Player"
import { GameField } from "./world/GameField"
import type { StairData } from "./world/StairData"


export interface ColliderBox {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export interface ParsedMap {
  // tile = das Map-Zeichen, ueber das der Wandtyp in WALL_TILES nachgeschlagen wird
  walls: Array<{ x: number; z: number; tile: string }>
  playerSpawn: { x: number; z: number }
  enemySpawns: Array<{ x: number; z: number }>
  rows: number
  cols: number
  walkableTiles: Array<{ x: number; z: number }>
  stairs: Array<StairData>
}

export interface Damageable {
  takeDamage(amount: number): void;
  isAlive(): boolean;
}

export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAMEOVER = 'GAMEOVER',
  WIN = 'WIN',
  LOADING = 'LOADING'
}

export interface UpdateContext {
  dt: number
  input: InputManager
  camera: THREE.PerspectiveCamera
  field: GameField
  player: Player
  spawnProjectile: (p: Projectile) => void 
}

export enum DamageGroup {
  Player,
  Enemy
}