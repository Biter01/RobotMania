import { LevelData } from '../LevelData'

/**
 * Small multi-level example: a stair leads up to platform A (y = 2), from where
 * a bridge crosses over the floor to platform B. The floor under the bridge
 * stays walkable.
 */
export const DEMO_3D: LevelData = {
  objects: [
    // Floor: top at y = 0
    { type: 'block', tile: 'floor', position: { x: 8, y: -0.5, z: 8 }, size: { x: 16, y: 1, z: 16 } },
    // Outer walls
    { type: 'block', tile: 'brick', position: { x: 8, y: 2.5, z: 0.5 }, size: { x: 16, y: 5, z: 1 } },
    { type: 'block', tile: 'brick', position: { x: 8, y: 2.5, z: 15.5 }, size: { x: 16, y: 5, z: 1 } },
    { type: 'block', tile: 'brick', position: { x: 0.5, y: 2.5, z: 8 }, size: { x: 1, y: 5, z: 14 } },
    { type: 'block', tile: 'brick', position: { x: 15.5, y: 2.5, z: 8 }, size: { x: 1, y: 5, z: 14 } },
    // Platform A (top at y = 2)
    { type: 'block', tile: 'brick', position: { x: 12, y: 1, z: 4 }, size: { x: 6, y: 2, z: 6 } },
    // Stair from the floor (y = 0) up to platform A: 2 tiles rise by 2
    { type: 'stair', dir: '>', position: { x: 7, y: 0, z: 3 }, tiles: 2 },
    // Bridge from platform A to platform B (top at y = 2, 1.7 clear below)
    { type: 'block', tile: 'floor', position: { x: 12, y: 1.85, z: 10 }, size: { x: 2, y: 0.3, z: 6 } },
    // Platform B (top at y = 2)
    { type: 'block', tile: 'brick', position: { x: 12, y: 1, z: 14 }, size: { x: 6, y: 2, z: 2 } },
    // Spawns
    { type: 'player', position: { x: 2.5, y: 0, z: 2.5 } },
    { type: 'enemy', position: { x: 12.5, y: 2, z: 14.5 } },
    { type: 'enemy', position: { x: 11.5, y: 0, z: 10.5 } },
    { type: 'enemy', position: { x: 3.5, y: 0, z: 12.5 } },
  ],
}
