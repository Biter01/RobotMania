export interface WallBox {
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
}

export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAMEOVER = 'GAMEOVER',
  WIN = 'WIN',
}
