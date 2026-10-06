import { InputManager } from "./core/InputManager"
import * as THREE from 'three'
import { Projectile } from "./entities/Projectile"
import { Player } from "./entities/Player"
import { GameField } from "./world/GameField"
import type { StairData } from "./world/StairData"
import type { Vec3 } from "./world/LevelData"


export interface ColliderBox {
  minX: number
  maxX: number
  minZ: number
  maxZ: number

  minY: number
  maxY: number
}

export interface ParsedMap {
  // Achsparallele Quader: position = Mittelpunkt, size = Ausdehnung in x/y/z
  blocks: Array<{ tile: string; position: Vec3; size: Vec3 }>
  // y = Hoehe der Fuesse
  playerSpawn: Vec3
  enemySpawns: Vec3[]
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