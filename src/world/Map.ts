import { ParsedMap } from '../types'
import { StairData, isHorizontalStair } from './StairData'
import { LevelData } from './LevelData'

/**
 * Turns a level's object list into a {@link ParsedMap}.
 *
 * Stair objects (corner + length) are converted to {@link StairData} (tile range
 * + baseY). The nav grid is built from the result by `GameField` (see `NavGrid.ts`).
 *
 * @param level - The level to parse.
 * @param tileSize - Edge length of a grid tile; stair positions are divided by it.
 */
export function parseLevel(level: LevelData, tileSize: number): ParsedMap {
  const blocks: ParsedMap['blocks'] = []
  const enemySpawns: ParsedMap['enemySpawns'] = []
  const stairs: StairData[] = []
  let playerSpawn: ParsedMap['playerSpawn'] = { x: 0, y: 0, z: 0 }

  for (const obj of level.objects) {
    switch (obj.type) {
      case 'block':
        blocks.push({ tile: obj.tile, position: { ...obj.position }, size: { ...obj.size } })
        break
      case 'stair':
        stairs.push(toStairData(obj.dir, obj.position.x, obj.position.y, obj.position.z, obj.tiles, tileSize))
        break
      case 'player':
        playerSpawn = { ...obj.position }
        break
      case 'enemy':
        enemySpawns.push({ ...obj.position })
        break
    }
  }

  return { blocks, playerSpawn, enemySpawns, stairs }
}

/** Converts a stair object (min corner + number of tiles) into StairData. */
function toStairData(dir: StairData['dir'], x: number, y: number, z: number, tiles: number, tileSize: number): StairData {
  const col: number = Math.round(x / tileSize)
  const row: number = Math.round(z / tileSize)
  const maxCol: number = isHorizontalStair(dir) ? col + tiles - 1 : col
  const maxRow: number = isHorizontalStair(dir) ? row : row + tiles - 1
  return new StairData(dir, col, row, maxCol, maxRow, y)
}
