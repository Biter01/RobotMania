import { LevelData } from '../LevelData'

// Kleines Beispiel fuer mehrere Ebenen: eine Stiege fuehrt auf Plattform A (y = 2),
// von dort fuehrt eine Bruecke ueber den Boden zu Plattform B. Unter der Bruecke
// bleibt der Boden begehbar.
export const DEMO_3D: LevelData = {
  objects: [
    // Boden: Oberseite auf y = 0
    { type: 'block', tile: 'floor', position: { x: 8, y: -0.5, z: 8 }, size: { x: 16, y: 1, z: 16 } },
    // Aussenwaende
    { type: 'block', tile: 'brick', position: { x: 8, y: 2.5, z: 0.5 }, size: { x: 16, y: 5, z: 1 } },
    { type: 'block', tile: 'brick', position: { x: 8, y: 2.5, z: 15.5 }, size: { x: 16, y: 5, z: 1 } },
    { type: 'block', tile: 'brick', position: { x: 0.5, y: 2.5, z: 8 }, size: { x: 1, y: 5, z: 14 } },
    { type: 'block', tile: 'brick', position: { x: 15.5, y: 2.5, z: 8 }, size: { x: 1, y: 5, z: 14 } },
    // Plattform A (Oberseite y = 2)
    { type: 'block', tile: 'brick', position: { x: 12, y: 1, z: 4 }, size: { x: 6, y: 2, z: 6 } },
    // Stiege vom Boden (y = 0) auf Plattform A: 2 Tiles steigen um 2
    { type: 'stair', dir: '>', position: { x: 7, y: 0, z: 3 }, tiles: 2 },
    // Bruecke von Plattform A zu Plattform B (Oberseite y = 2, darunter 1.7 frei)
    { type: 'block', tile: 'floor', position: { x: 12, y: 1.85, z: 10 }, size: { x: 2, y: 0.3, z: 6 } },
    // Plattform B (Oberseite y = 2)
    { type: 'block', tile: 'brick', position: { x: 12, y: 1, z: 14 }, size: { x: 6, y: 2, z: 2 } },
    // Spawns
    { type: 'player', position: { x: 2.5, y: 0, z: 2.5 } },
    { type: 'enemy', position: { x: 12.5, y: 2, z: 14.5 } },
    { type: 'enemy', position: { x: 11.5, y: 0, z: 10.5 } },
    { type: 'enemy', position: { x: 3.5, y: 0, z: 12.5 } },
  ],
}
