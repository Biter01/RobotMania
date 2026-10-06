import * as THREE from 'three'
import { describe, it, expect } from 'vitest'
import {
  TILE_SIZE, STAIR_HEIGHT_OFFSET, STAIR_COUNT, STAIR_HEIGHT,
  PLAYER_EYE_HEIGHT, PLAYER_HALF_WIDTH_X, PLAYER_HALF_WIDTH_Z,
  GRAVITY, MAX_FALL_SPEED,
} from '../GameConstants'
import { ColliderBox } from '../types'
import { StairData, buildStairColliders } from '../world/StairData'
import { Physics, PhysicsBody, PhysicsWorld } from './Physics'

const T: number = TILE_SIZE
// Wie Player: position.y liegt auf Augenhoehe, die Box ist relativ dazu
const BASE: number = PLAYER_EYE_HEIGHT
const TILE_HEIGHT: number = STAIR_COUNT * STAIR_HEIGHT

function body(x: number, z: number): PhysicsBody {
  const box: ColliderBox = {
    minX: -PLAYER_HALF_WIDTH_X, maxX: PLAYER_HALF_WIDTH_X,
    minZ: -PLAYER_HALF_WIDTH_Z, maxZ: PLAYER_HALF_WIDTH_Z,
    minY: -PLAYER_EYE_HEIGHT, maxY: 0,
  }
  return { position: new THREE.Vector3(x, BASE, z), baseHeight: BASE, velocityY: 0, getColliderBox: (): ColliderBox => box }
}

// Wie GameField.buildFloor: Oberkante auf y = 0
const FLOOR: ColliderBox = { minX: -100, maxX: 100, minZ: -100, maxZ: 100, minY: -1, maxY: 0 }

// Wie GameField: Lookup ueber Tile-Koordinaten + Seiten-Collider
function worldWith(stair: StairData | StairData[], extraColliders: ColliderBox[] = []): PhysicsWorld {
  const stairs: StairData[] = Array.isArray(stair) ? stair : [stair]
  return {
    colliders: [FLOOR, ...buildStairColliders(stairs), ...extraColliders],
    getStairAt: (x: number, z: number): StairData | undefined => {
      const col: number = Math.floor(x / TILE_SIZE)
      const row: number = Math.floor(z / TILE_SIZE)
      return stairs.find((s: StairData): boolean =>
        col >= s.minCol && col <= s.maxCol && row >= s.minRow && row <= s.maxRow)
    },
  }
}

describe('StairData.heightAt', () => {
  it('rises in arrow direction for all four directions', () => {
    const right: StairData = new StairData('>', 0, 0, 0, 0)
    expect(right.heightAt(0, 0.5 * T)).toBe(0)
    expect(right.heightAt(0.5 * T, 0.5 * T)).toBeCloseTo(right.HEIGHT / 2)
    expect(right.heightAt(T, 0.5 * T)).toBeCloseTo(right.HEIGHT)

    const left: StairData = new StairData('<', 0, 0, 0, 0)
    expect(left.heightAt(T, 0.5 * T)).toBe(0)
    expect(left.heightAt(0, 0.5 * T)).toBeCloseTo(left.HEIGHT)

    const up: StairData = new StairData('^', 0, 0, 0, 0)
    expect(up.heightAt(0.5 * T, T)).toBe(0)
    expect(up.heightAt(0.5 * T, 0)).toBeCloseTo(up.HEIGHT)

    const down: StairData = new StairData('v', 0, 0, 0, 0)
    expect(down.heightAt(0.5 * T, 0)).toBe(0)
    expect(down.heightAt(0.5 * T, T)).toBeCloseTo(down.HEIGHT)
  })

  it('spans the whole length of a composed stair', () => {
    const stair: StairData = new StairData('>', 0, 0, 1, 0)
    expect(stair.heightAt(T, 0.5 * T)).toBeCloseTo(stair.HEIGHT / 2)
    expect(stair.heightAt(2 * T, 0.5 * T)).toBeCloseTo(stair.HEIGHT)
  })
})

describe('buildStairSideColliders', () => {
  it('spans from the floor up to the top of each stair tile', () => {
    const stair: StairData = new StairData('>', 0, 0, 1, 0)
    const colliders: ColliderBox[] = buildStairColliders([stair])

    // 2 Tiles * 2 Laengsseiten
    expect(colliders).toHaveLength(4)
    for (const c of colliders) expect(c.minY).toBe(0)

    const lower: ColliderBox[] = colliders.filter((c: ColliderBox): boolean => c.minX === 0)
    const upper: ColliderBox[] = colliders.filter((c: ColliderBox): boolean => c.minX === T)
    for (const c of lower) expect(c.maxY).toBeCloseTo(TILE_HEIGHT)
    for (const c of upper) expect(c.maxY).toBeCloseTo(2 * TILE_HEIGHT)
  })

  it('lies exactly on the long edges of the tile', () => {
    const stair: StairData = new StairData('>', 1, 2, 1, 2)
    const [north, south]: ColliderBox[] = buildStairColliders([stair])

    expect(north.minZ).toBe(2 * T)
    expect(south.maxZ).toBe(3 * T)
  })
})

describe('Physics.computePhysics', () => {
  const physics: Physics = Physics.getInstance()

  it('slides along a wall instead of stopping', () => {
    const b: PhysicsBody = body(1, 1)
    const world: PhysicsWorld = {
      colliders: [FLOOR, { minX: 1.4, maxX: 3, minZ: -10, maxZ: 10, minY: -10, maxY: 10 }],
      getStairAt: (): undefined => undefined,
    }

    const result = physics.computePhysics(b, world, new THREE.Vector3(1, 0, 1), 0.5)

    expect(result).toEqual({ blockedX: true, blockedZ: false })
    expect(b.position.x).toBe(1)
    expect(b.position.z).toBe(1.5)
  })

  it('sets the height absolutely plus offset while on the stair', () => {
    const stair: StairData = new StairData('>', 1, 0, 1, 0)
    const world: PhysicsWorld = worldWith(stair)
    const b: PhysicsBody = body(0.9 * T, 0.5 * T)

    physics.computePhysics(b, world, new THREE.Vector3(T, 0, 0), 0.5)
    expect(b.position.x).toBeCloseTo(1.4 * T)
    expect(b.position.y).toBeCloseTo(BASE + stair.heightAt(1.4 * T, 0.5 * T) + STAIR_HEIGHT_OFFSET)

    // Stehen bleiben aendert die Hoehe nicht mehr (kein Aufaddieren pro Frame)
    physics.computePhysics(b, world, new THREE.Vector3(0, 0, 0), 1)
    expect(b.position.y).toBeCloseTo(BASE + stair.heightAt(1.4 * T, 0.5 * T) + STAIR_HEIGHT_OFFSET)
  })

  it('removes the offset when leaving at the bottom', () => {
    const stair: StairData = new StairData('>', 1, 0, 1, 0)
    const world: PhysicsWorld = worldWith(stair)
    const b: PhysicsBody = body(1.05 * T, 0.5 * T)

    physics.computePhysics(b, world, new THREE.Vector3(0, 0, 0), 1)
    expect(b.position.y).toBeGreaterThan(BASE)

    physics.computePhysics(b, world, new THREE.Vector3(-T, 0, 0), 0.5)
    expect(b.position.x).toBeCloseTo(0.55 * T)
    expect(b.position.y).toBe(BASE)
  })

  it('blocks entering a stair from the side', () => {
    const stair: StairData = new StairData('>', 1, 0, 1, 0)
    const b: PhysicsBody = body(1.5 * T, 1.5 * T)

    const result = physics.computePhysics(b, worldWith(stair), new THREE.Vector3(0, 0, -T), 0.5)

    expect(result.blockedZ).toBe(true)
    expect(b.position.z).toBe(1.5 * T)
    expect(b.position.y).toBe(BASE)
  })

  it('walks sideways between flush parallel stairs without a height jump', () => {
    // 'vv' in Spalte 1 und 2
    const left: StairData = new StairData('v', 1, 0, 1, 0)
    const right: StairData = new StairData('v', 2, 0, 2, 0)
    const world: PhysicsWorld = worldWith([left, right])
    const b: PhysicsBody = body(1.5 * T, 0.5 * T)

    physics.computePhysics(b, world, new THREE.Vector3(0, 0, 0), 1)
    const y: number = b.position.y

    const result = physics.computePhysics(b, world, new THREE.Vector3(0.4 * T, 0, 0), 1)
    expect(result.blockedX).toBe(false)
    expect(b.position.x).toBeCloseTo(1.9 * T)
    expect(b.position.y).toBeCloseTo(y)
  })

  it('blocks sideways between parallel stairs of different height', () => {
    // Links einzelnes 'v' in Reihe 1, rechts 'v' ueber Reihe 0-1 -> in Reihe 1 hoeher
    const left: StairData = new StairData('v', 1, 1, 1, 1)
    const right: StairData = new StairData('v', 2, 0, 2, 1)
    const world: PhysicsWorld = worldWith([left, right])
    const b: PhysicsBody = body(1.5 * T, 1.5 * T)

    // Erst auf die Stiegenhoehe setzen - blockieren muss es auch fuer einen erhoehten Koerper
    physics.computePhysics(b, world, new THREE.Vector3(0, 0, 0), 1)
    expect(b.position.y).toBeGreaterThan(BASE)

    const result = physics.computePhysics(b, world, new THREE.Vector3(0.4 * T, 0, 0), 1)
    expect(result.blockedX).toBe(true)
  })

  it('falls down to the floor after leaving the top', () => {
    const stair: StairData = new StairData('>', 1, 0, 1, 0)
    const world: PhysicsWorld = worldWith(stair)
    const b: PhysicsBody = body(1.95 * T, 0.5 * T)
    const dt: number = 1 / 60

    physics.computePhysics(b, world, new THREE.Vector3(0, 0, 0), dt)
    physics.computePhysics(b, world, new THREE.Vector3(6 * T, 0, 0), dt)

    // Erster Frame nach dem Verlassen: knapp unter der Stiegenhoehe, schon im Fallen
    expect(b.position.x).toBeGreaterThan(2 * T)
    expect(b.position.y).toBeLessThan(BASE + stair.HEIGHT)
    expect(b.velocityY).toBeLessThan(0)

    for (let i = 0; i < 120; i++) {
      physics.computePhysics(b, world, new THREE.Vector3(0, 0, 0), dt)
    }
    expect(b.position.y).toBeCloseTo(BASE)
    expect(b.velocityY).toBe(0)
  })
})

describe('Physics gravity', () => {
  const physics: Physics = Physics.getInstance()
  const empty: PhysicsWorld = { colliders: [], getStairAt: (): undefined => undefined }
  const still: THREE.Vector3 = new THREE.Vector3(0, 0, 0)

  it('accelerates while falling', () => {
    const b: PhysicsBody = body(0, 0)
    const dt: number = 0.1
    const ys: number[] = [b.position.y]

    for (let i = 0; i < 3; i++) {
      physics.computePhysics(b, empty, still, dt)
      ys.push(b.position.y)
    }

    const fall1: number = ys[0] - ys[1]
    const fall2: number = ys[1] - ys[2]
    const fall3: number = ys[2] - ys[3]
    expect(fall2).toBeGreaterThan(fall1)
    expect(fall3).toBeGreaterThan(fall2)
    expect(b.velocityY).toBeCloseTo(-GRAVITY * 3 * dt)
  })

  it('stays at rest on the floor', () => {
    const b: PhysicsBody = body(0, 0)
    const world: PhysicsWorld = { colliders: [FLOOR], getStairAt: (): undefined => undefined }

    for (let i = 0; i < 10; i++) {
      physics.computePhysics(b, world, still, 1 / 60)
    }

    expect(b.position.y).toBe(BASE)
    expect(b.velocityY).toBe(0)
  })

  it('does not tunnel through a thin platform at high fall speed', () => {
    const platform: ColliderBox = { minX: -5, maxX: 5, minZ: -5, maxZ: 5, minY: 2, maxY: 2.05 }
    const world: PhysicsWorld = { colliders: [platform], getStairAt: (): undefined => undefined }
    const b: PhysicsBody = body(0, 0)
    b.position.y = 10
    b.velocityY = -MAX_FALL_SPEED

    // Ein Schritt faellt ~30 Einheiten - weit durch die Plattform hindurch
    physics.computePhysics(b, world, still, 1)

    expect(b.position.y).toBeCloseTo(platform.maxY + PLAYER_EYE_HEIGHT)
    expect(b.velocityY).toBe(0)
  })
})

describe('Physics.checkWallCollision', () => {
  const physics: Physics = Physics.getInstance()
  const r: number = 0.08
  const projectileBox: ColliderBox = { minX: -r, maxX: r, minZ: -r, maxZ: r, minY: -r, maxY: r }
  const thinWall: ColliderBox = { minX: 5, maxX: 5.1, minZ: 0, maxZ: 10, minY: 0, maxY: 3 }

  it('detects a fast projectile tunneling through a thin wall', () => {
    const from: THREE.Vector3 = new THREE.Vector3(4, 1, 5)
    const to: THREE.Vector3 = new THREE.Vector3(6, 1, 5)
    expect(physics.checkWallCollision([thinWall], from, to, projectileBox)).toBe(true)
  })

  it('does not use the path of a previously moved body', () => {
    // Body hinter der Wand bewegen - frueher landete dessen Position im Singleton als Sweep-Start
    const b: PhysicsBody = body(8, 5)
    physics.computePhysics(b, { colliders: [thinWall], getStairAt: (): undefined => undefined }, new THREE.Vector3(0.1, 0, 0), 1)

    const from: THREE.Vector3 = new THREE.Vector3(2, 1, 5)
    const to: THREE.Vector3 = new THREE.Vector3(2.5, 1, 5)
    expect(physics.checkWallCollision([thinWall], from, to, projectileBox)).toBe(false)
  })

  it('detects a start inside the wall even if the step ends behind it', () => {
    const from: THREE.Vector3 = new THREE.Vector3(5.05, 1, 5)
    const to: THREE.Vector3 = new THREE.Vector3(7, 1, 5)
    expect(physics.checkWallCollision([thinWall], from, to, projectileBox)).toBe(true)
    expect(physics.sweep([thinWall], from, to, projectileBox)).toBe(0)
  })

  it('ignores a wall behind the end of the step', () => {
    const from: THREE.Vector3 = new THREE.Vector3(2, 1, 5)
    const to: THREE.Vector3 = new THREE.Vector3(4, 1, 5)
    expect(physics.checkWallCollision([thinWall], from, to, projectileBox)).toBe(false)
  })

  it('lets a flush body move away from the wall but not into it', () => {
    const flush: THREE.Vector3 = new THREE.Vector3(thinWall.minX - r, 1, 5)
    const away: THREE.Vector3 = new THREE.Vector3(flush.x - 0.5, 1, 5)
    const into: THREE.Vector3 = new THREE.Vector3(flush.x + 0.5, 1, 5)
    expect(physics.checkWallCollision([thinWall], flush, away, projectileBox)).toBe(false)
    expect(physics.checkWallCollision([thinWall], flush, into, projectileBox)).toBe(true)
  })

  it('sweep returns the earliest contact of several walls', () => {
    const farWall: ColliderBox = { minX: 8, maxX: 8.1, minZ: 0, maxZ: 10, minY: 0, maxY: 3 }
    const from: THREE.Vector3 = new THREE.Vector3(0, 1, 5)
    const to: THREE.Vector3 = new THREE.Vector3(10, 1, 5)
    // Kontakt, sobald die Vorderkante der Box (x + r) die nahe Wand bei x = 5 erreicht
    expect(physics.sweep([farWall, thinWall], from, to, projectileBox)).toBeCloseTo((thinWall.minX - r) / 10)
  })

  it('does not block a body resting flush on the floor', () => {
    const floor: ColliderBox = { minX: 0, maxX: 10, minZ: 0, maxZ: 10, minY: -1, maxY: 0 }
    const box: ColliderBox = { minX: -0.2, maxX: 0.2, minZ: -0.2, maxZ: 0.2, minY: 0, maxY: 1.4 }
    const from: THREE.Vector3 = new THREE.Vector3(5, 0, 5)
    const to: THREE.Vector3 = new THREE.Vector3(5.1, 0, 5)
    expect(physics.checkWallCollision([floor], from, to, box)).toBe(false)
  })
})
