import * as THREE from 'three'
import { describe, it, expect } from 'vitest'
import { TILE_SIZE, STAIR_OFFSET } from '../GameConstants'
import { ColliderBox } from '../types'
import { StairData, buildStairSideColliders } from '../world/StairData'
import { Physics, PhysicsBody, PhysicsWorld } from './Physics'

const HALF: number = 0.3
const BASE: number = 0.5

function body(x: number, z: number): PhysicsBody {
  const box: ColliderBox = { minX: -HALF, maxX: HALF, minZ: -HALF, maxZ: HALF }
  return { position: new THREE.Vector3(x, BASE, z), baseHeight: BASE, getColliderBox: (): ColliderBox => box }
}

// Wie GameField: Lookup ueber Tile-Koordinaten + Seiten-Collider
function worldWith(stair: StairData | StairData[], extraColliders: ColliderBox[] = []): PhysicsWorld {
  const stairs: StairData[] = Array.isArray(stair) ? stair : [stair]
  return {
    colliders: [...buildStairSideColliders(stairs), ...extraColliders],
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
    expect(right.heightAt(0, 1)).toBe(0)
    expect(right.heightAt(1, 1)).toBeCloseTo(right.HEIGHT / 2)
    expect(right.heightAt(2, 1)).toBe(right.HEIGHT)

    const left: StairData = new StairData('<', 0, 0, 0, 0)
    expect(left.heightAt(2, 1)).toBe(0)
    expect(left.heightAt(0, 1)).toBe(left.HEIGHT)

    const up: StairData = new StairData('^', 0, 0, 0, 0)
    expect(up.heightAt(1, 2)).toBe(0)
    expect(up.heightAt(1, 0)).toBe(up.HEIGHT)

    const down: StairData = new StairData('v', 0, 0, 0, 0)
    expect(down.heightAt(1, 0)).toBe(0)
    expect(down.heightAt(1, 2)).toBe(down.HEIGHT)
  })

  it('spans the whole length of a composed stair', () => {
    const stair: StairData = new StairData('>', 0, 0, 1, 0)
    expect(stair.heightAt(2, 1)).toBeCloseTo(stair.HEIGHT / 2)
    expect(stair.heightAt(4, 1)).toBe(stair.HEIGHT)
  })
})

describe('Physics.computePhysics', () => {
  const physics: Physics = Physics.getInstance()

  it('slides along a wall instead of stopping', () => {
    const b: PhysicsBody = body(1, 1)
    const world: PhysicsWorld = {
      colliders: [{ minX: 1.4, maxX: 3, minZ: -10, maxZ: 10 }],
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
    const b: PhysicsBody = body(1.8, 1)

    physics.computePhysics(b, world, new THREE.Vector3(1, 0, 0), 1)
    expect(b.position.x).toBeCloseTo(2.8)
    expect(b.position.y).toBeCloseTo(BASE + stair.heightAt(2.8, 1) + STAIR_OFFSET)

    // Stehen bleiben aendert die Hoehe nicht mehr (kein Aufaddieren pro Frame)
    physics.computePhysics(b, world, new THREE.Vector3(0, 0, 0), 1)
    expect(b.position.y).toBeCloseTo(BASE + stair.heightAt(2.8, 1) + STAIR_OFFSET)
  })

  it('removes the offset when leaving at the bottom', () => {
    const stair: StairData = new StairData('>', 1, 0, 1, 0)
    const world: PhysicsWorld = worldWith(stair)
    const b: PhysicsBody = body(2.1, 1)

    physics.computePhysics(b, world, new THREE.Vector3(0, 0, 0), 1)
    expect(b.position.y).toBeGreaterThan(BASE)

    physics.computePhysics(b, world, new THREE.Vector3(-1, 0, 0), 0.5)
    expect(b.position.x).toBeCloseTo(1.6)
    expect(b.position.y).toBe(BASE)
  })

  it('blocks entering a stair from the side', () => {
    const stair: StairData = new StairData('>', 1, 0, 1, 0)
    const b: PhysicsBody = body(3, 2.5)

    const result = physics.computePhysics(b, worldWith(stair), new THREE.Vector3(0, 0, -1), 0.5)

    expect(result.blockedZ).toBe(true)
    expect(b.position.z).toBe(2.5)
    expect(b.position.y).toBe(BASE)
  })

  it('walks sideways between flush parallel stairs without a height jump', () => {
    // 'vv' in Spalte 1 und 2
    const left: StairData = new StairData('v', 1, 0, 1, 0)
    const right: StairData = new StairData('v', 2, 0, 2, 0)
    const world: PhysicsWorld = worldWith([left, right])
    const b: PhysicsBody = body(1.5 * TILE_SIZE, 0.5 * TILE_SIZE)

    physics.computePhysics(b, world, new THREE.Vector3(0, 0, 0), 1)
    const y: number = b.position.y

    const result = physics.computePhysics(b, world, new THREE.Vector3(0.4 * TILE_SIZE, 0, 0), 1)
    expect(result.blockedX).toBe(false)
    expect(b.position.x).toBeCloseTo(1.9 * TILE_SIZE)
    expect(b.position.y).toBeCloseTo(y)
  })

  it('blocks sideways between parallel stairs of different height', () => {
    // Links einzelnes 'v' in Reihe 1, rechts 'v' ueber Reihe 0-1 -> in Reihe 1 hoeher
    const left: StairData = new StairData('v', 1, 1, 1, 1)
    const right: StairData = new StairData('v', 2, 0, 2, 1)
    const b: PhysicsBody = body(1.5 * TILE_SIZE, 1.5 * TILE_SIZE)

    const result = physics.computePhysics(b, worldWith([left, right]), new THREE.Vector3(0.4 * TILE_SIZE, 0, 0), 1)
    expect(result.blockedX).toBe(true)
  })

  it('keeps floating at stair height without offset after leaving the top', () => {
    const stair: StairData = new StairData('>', 1, 0, 1, 0)
    const world: PhysicsWorld = worldWith(stair)
    const b: PhysicsBody = body(3.9, 1)

    physics.computePhysics(b, world, new THREE.Vector3(0, 0, 0), 1)
    physics.computePhysics(b, world, new THREE.Vector3(1, 0, 0), 1)

    expect(b.position.x).toBeCloseTo(4.9)
    expect(b.position.y).toBe(BASE + stair.HEIGHT)

    physics.computePhysics(b, world, new THREE.Vector3(1, 0, 0), 1)
    expect(b.position.y).toBe(BASE + stair.HEIGHT)
  })
})
