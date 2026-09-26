import { ParsedMap } from '../types'
import { isWallChar } from './WallTiles'
import { StairData, isStairChar, isHorizontalStair } from './StairData'

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
        // Stiegen sind begehbar - ueber welche Seite, entscheidet A*/Physics
        walkableTiles.push({ x: col, z: row })
        if (ch === 'P') {
          playerSpawn = { x, z }
        } else if (ch === 'E') {
          enemySpawns.push({ x, z })
        }
      }
    }
  }

  return { walls, playerSpawn, enemySpawns, rows, cols, walkableTiles, stairs: parseStairs(mapData) }
}

// Gleich gerichtete Stiegen-Tiles in Achsrichtung ('>>', '^' ueber '^') werden zu
// einer StairData zusammengefasst. Parallele Reihen bleiben getrennte Stiegen.
function parseStairs(mapData: string[]): StairData[] {
  const stairs: StairData[] = []
  const visited: Set<string> = new Set()

  for (let row = 0; row < mapData.length; row++) {
    for (let col = 0; col < mapData[row].length; col++) {
      const ch: string = mapData[row][col]
      if (!isStairChar(ch) || visited.has(`${col},${row}`)) continue

      let maxCol: number = col
      let maxRow: number = row
      if (isHorizontalStair(ch)) {
        while (mapData[row][maxCol + 1] === ch) maxCol++
      } else {
        while (mapData[maxRow + 1]?.[col] === ch) maxRow++
      }

      for (let r = row; r <= maxRow; r++) {
        for (let c = col; c <= maxCol; c++) {
          visited.add(`${c},${r}`)
        }
      }
      stairs.push(new StairData(ch, col, row, maxCol, maxRow))
    }
  }
  return stairs
}
