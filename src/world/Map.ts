import { ParsedMap } from '../types'
import { isWallChar } from './WallTiles'

export function parseMap(mapData: string[], tileSize: number): ParsedMap {
  const walls: ParsedMap['walls'] = []
  const enemySpawns: ParsedMap['enemySpawns'] = []
  let playerSpawn: ParsedMap['playerSpawn'] = { x: tileSize / 2, z: tileSize / 2 }
  const walkableTiles: ParsedMap['walkableTiles'] = []
  const rows = mapData.length
  const cols = mapData[0]?.length ?? 0

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < mapData[row].length; col++) {
      const ch = mapData[row][col]
      const x = col * tileSize + tileSize / 2
      const z = row * tileSize + tileSize / 2
      // Nicht auf '#' hartkodieren: jedes in WALL_TILES registrierte Zeichen ist
      // eine Wand und damit automatisch solide und nicht begehbar.
      if (isWallChar(ch)) {
        walls.push({ x, z, tile: ch })
      } else {
        walkableTiles.push({ x: col, z: row })
        if (ch === 'P') {
          playerSpawn = { x, z }
        } else if (ch === 'E') {
          enemySpawns.push({ x, z })
        }
      }
    }
  }

  return { walls, playerSpawn, enemySpawns, rows, cols, walkableTiles }
}
