import { ParsedMap } from '../types'

export function parseMap(mapData: string[], tileSize: number): ParsedMap {
  const walls: ParsedMap['walls'] = []
  const enemySpawns: ParsedMap['enemySpawns'] = []
  let playerSpawn: ParsedMap['playerSpawn'] = { x: tileSize / 2, z: tileSize / 2 }

  const rows = mapData.length
  const cols = mapData[0]?.length ?? 0

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < mapData[row].length; col++) {
      const ch = mapData[row][col]
      const x = col * tileSize + tileSize / 2
      const z = row * tileSize + tileSize / 2
      if (ch === '#') {
        walls.push({ x, z })
      } else if (ch === 'P') {
        playerSpawn = { x, z }
      } else if (ch === 'E') {
        enemySpawns.push({ x, z })
      }
    }
  }

  return { walls, playerSpawn, enemySpawns, rows, cols }
}
