import { Enemy } from "./entities/Enemy"
import { InputManager } from "./core/InputManager"
import * as THREE from 'three'
import { Projectile } from "./entities/Projectile"
import { Player } from "./entities/Player"


export interface ColliderBox {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export interface ParsedMap {
  walls: Array<{ x: number; z: number }>
  playerSpawn: { x: number; z: number }
  enemySpawns: Array<{ x: number; z: number }>
  rows: number
  cols: number
  walkableTiles: Array<{ x: number; z: number }>
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
}

export interface UpdateContext {
  dt: number
  input: InputManager
  camera: THREE.PerspectiveCamera
  colliders: ColliderBox[]
  enemies: Enemy[]
  player: Player
  spawnProjectile: (p: Projectile) => void 
}