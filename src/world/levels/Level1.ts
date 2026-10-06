import { LevelData } from '../LevelData'

export const LEVEL_1: LevelData = {
  objects: [
    // Boden: Oberseite auf y = 0
    { type: 'block', tile: 'floor', position: { x: 16, y: -0.5, z: 16 }, size: { x: 32, y: 1, z: 32 } },
    // Waende
    { type: 'block', tile: 'brick', position: { x: 16, y: 1.5, z: 0.5 }, size: { x: 32, y: 3, z: 1 } },
    { type: 'block', tile: 'brick', position: { x: 0.5, y: 1.5, z: 16.5 }, size: { x: 1, y: 3, z: 31 } },
    { type: 'block', tile: 'brick', position: { x: 31.5, y: 1.5, z: 16.5 }, size: { x: 1, y: 3, z: 31 } },
    { type: 'block', tile: 'brick', position: { x: 25.5, y: 1.5, z: 5 }, size: { x: 1, y: 3, z: 4 } },
    { type: 'block', tile: 'brick', position: { x: 4.5, y: 1.5, z: 8.5 }, size: { x: 1, y: 3, z: 9 } },
    { type: 'block', tile: 'brick', position: { x: 20.5, y: 1.5, z: 11.5 }, size: { x: 5, y: 3, z: 1 } },
    { type: 'block', tile: 'brick', position: { x: 6, y: 1.5, z: 12.5 }, size: { x: 2, y: 3, z: 1 } },
    { type: 'block', tile: 'brick', position: { x: 18.5, y: 1.5, z: 12.5 }, size: { x: 1, y: 3, z: 1 } },
    { type: 'block', tile: 'brick', position: { x: 8, y: 1.5, z: 13.5 }, size: { x: 4, y: 3, z: 1 } },
    { type: 'block', tile: 'brick', position: { x: 12, y: 1.5, z: 17.5 }, size: { x: 4, y: 3, z: 1 } },
    { type: 'block', tile: 'brick', position: { x: 13.5, y: 1.5, z: 20 }, size: { x: 1, y: 3, z: 4 } },
    { type: 'block', tile: 'brick', position: { x: 24, y: 1.5, z: 18.5 }, size: { x: 4, y: 3, z: 1 } },
    { type: 'block', tile: 'brick', position: { x: 14.5, y: 1.5, z: 24 }, size: { x: 1, y: 3, z: 6 } },
    { type: 'block', tile: 'brick', position: { x: 5.5, y: 1.5, z: 25 }, size: { x: 1, y: 3, z: 4 } },
    { type: 'block', tile: 'brick', position: { x: 21, y: 1.5, z: 26.5 }, size: { x: 6, y: 3, z: 1 } },
    { type: 'block', tile: 'brick', position: { x: 23.5, y: 1.5, z: 28 }, size: { x: 1, y: 3, z: 2 } },
    { type: 'block', tile: 'brick', position: { x: 16, y: 1.5, z: 31.5 }, size: { x: 30, y: 3, z: 1 } },
    // Stiegen
    { type: 'stair', dir: '>', position: { x: 18, y: 0, z: 14 }, tiles: 2 },
    { type: 'stair', dir: '>', position: { x: 18, y: 0, z: 15 }, tiles: 2 },
    { type: 'stair', dir: '<', position: { x: 24, y: 0, z: 15 }, tiles: 1 },
    { type: 'stair', dir: '^', position: { x: 25, y: 0, z: 19 }, tiles: 4 },
    { type: 'stair', dir: 'v', position: { x: 20, y: 0, z: 24 }, tiles: 1 },
    // Spawns
    { type: 'player', position: { x: 16.5, y: 0, z: 6.5 } },
    { type: 'enemy', position: { x: 28.5, y: 0, z: 9.5 } },
    { type: 'enemy', position: { x: 3.5, y: 0, z: 17.5 } },
    { type: 'enemy', position: { x: 16.5, y: 0, z: 19.5 } },
    { type: 'enemy', position: { x: 11.5, y: 0, z: 22.5 } },
  ],
}
