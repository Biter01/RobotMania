import { TILE_SIZE, WALL_HEIGHT } from '../../GameConstants'
import { LevelData, LevelObject } from '../LevelData'
import { isStairChar, isHorizontalStair } from '../StairData'

// Nur fuer Tests: baut aus einem kleinen ASCII-Raster ein LevelData auf einer Ebene
// ('#' Wand, '.' Boden, '<' '>' '^' 'v' Stiegen). So bleiben Fixtures lesbar.
// Kein Teil des Spiels - Levels werden direkt als LevelData geschrieben.
export function gridLevel(rows: string[]): LevelData {
  const depth: number = rows.length
  const width: number = Math.max(...rows.map((r: string): number => r.length))
  const objects: LevelObject[] = [
    {
      type: 'block', tile: 'floor',
      position: { x: (width * TILE_SIZE) / 2, y: -0.5, z: (depth * TILE_SIZE) / 2 },
      size: { x: width * TILE_SIZE, y: 1, z: depth * TILE_SIZE },
    },
  ]
  const visited: Set<string> = new Set()

  for (let row = 0; row < depth; row++) {
    for (let col = 0; col < rows[row].length; col++) {
      const ch: string = rows[row][col]
      if (ch === '#') {
        objects.push({
          type: 'block', tile: 'brick',
          position: { x: (col + 0.5) * TILE_SIZE, y: WALL_HEIGHT / 2, z: (row + 0.5) * TILE_SIZE },
          size: { x: TILE_SIZE, y: WALL_HEIGHT, z: TILE_SIZE },
        })
      } else if (isStairChar(ch) && !visited.has(`${col},${row}`)) {
        let tiles: number = 1
        if (isHorizontalStair(ch)) {
          while (rows[row][col + tiles] === ch) tiles++
        } else {
          while (rows[row + tiles]?.[col] === ch) tiles++
        }
        for (let i = 0; i < tiles; i++) {
          visited.add(isHorizontalStair(ch) ? `${col + i},${row}` : `${col},${row + i}`)
        }
        objects.push({ type: 'stair', dir: ch, position: { x: col * TILE_SIZE, y: 0, z: row * TILE_SIZE }, tiles })
      }
    }
  }
  return { objects }
}
