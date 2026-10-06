import { ParsedMap } from '../types'
import { StairData, isHorizontalStair } from './StairData'
import { LevelData } from './LevelData'

// Objektliste -> ParsedMap. Stiegen werden vom Objekt (Ecke + Laenge) in StairData
// (Tile-Bereich + baseY) umgerechnet; das Nav-Grid baut GameField daraus (NavGrid.ts).
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

function toStairData(dir: StairData['dir'], x: number, y: number, z: number, tiles: number, tileSize: number): StairData {
  const col: number = Math.round(x / tileSize)
  const row: number = Math.round(z / tileSize)
  const maxCol: number = isHorizontalStair(dir) ? col + tiles - 1 : col
  const maxRow: number = isHorizontalStair(dir) ? row : row + tiles - 1
  return new StairData(dir, col, row, maxCol, maxRow, y)
}
