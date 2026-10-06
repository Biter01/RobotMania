import type { StairDir } from './StairData'

// Ein Level ist eine Liste frei platzierter Objekte in Welt-Koordinaten (x, y, z).
// y zeigt nach oben. Es gibt keinen automatischen Boden: alles, worauf man stehen
// kann, ist ein Block.

export interface Vec3 {
  x: number
  y: number
  z: number
}

// Achsparalleler Quader: Wand, Boden, Plattform, Bruecke ...
// Die Oberseite jedes Blocks ist begehbar, sofern darueber genug Platz ist.
export interface BlockObject {
  type: 'block'
  // Schluessel in WALL_TILES -> Textur
  tile: string
  // Mittelpunkt des Quaders
  position: Vec3
  // Ausdehnung entlang x, y, z
  size: Vec3
}

// Stiegen sind die einzige Verbindung zwischen Ebenen unterschiedlicher Hoehe.
// x/z ist die Ecke mit minimalem x/z und liegt auf dem Tile-Raster (Vielfaches von
// TILE_SIZE), y ist die Hoehe des unteren Endes. Die Stiege steigt pro Tile um
// STAIR_COUNT * STAIR_HEIGHT; das obere Ende braucht eine Flaeche auf genau dieser
// Hoehe, damit Gegner dort weitergehen koennen.
export interface StairObject {
  type: 'stair'
  dir: StairDir
  position: Vec3
  // Anzahl hintereinanderliegender Stiegen-Tiles in Laufrichtung
  tiles: number
}

// Spawn-Positionen: y ist die Hoehe der Fuesse (= Oberseite des Blocks darunter)
export interface PlayerSpawnObject {
  type: 'player'
  position: Vec3
}

export interface EnemySpawnObject {
  type: 'enemy'
  position: Vec3
}

export type LevelObject = BlockObject | StairObject | PlayerSpawnObject | EnemySpawnObject

export interface LevelData {
  objects: LevelObject[]
}
