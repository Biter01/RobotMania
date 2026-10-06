import * as THREE from 'three'
import { ColliderBox } from '../types'
import type { StairData } from '../world/StairData'
import { STAIR_HEIGHT_OFFSET, GRAVITY, MAX_FALL_SPEED, COLLISION_EPSILON } from '../GameConstants'

/** What {@link Physics.computePhysics} needs from a moving object (Player, Enemy). */
export interface PhysicsBody {
    position: THREE.Vector3
    /** Height of the position above the feet; on stairs the stair height is added on top. */
    readonly baseHeight: number
    /** Vertical speed (negative = falling), accelerated by gravity. */
    velocityY: number
    /** Collider relative to {@link position}. */
    getColliderBox(): ColliderBox
}

/** What {@link Physics.computePhysics} needs from the playfield - GameField implements it. */
export interface PhysicsWorld {
    /** Static colliders in world coordinates. */
    readonly colliders: ColliderBox[]
    /**
     * Returns the stair at a world position.
     * @param footY - Height of the feet; decides which stair is meant when several lie above each other.
     */
    getStairAt(x: number, z: number, footY: number): StairData | undefined
}

/**
 * Converts an entity collider (stored relative to its position) into world coordinates.
 *
 * Also used by ColliderDebug, so the display matches the physics exactly.
 * @param out - Optional box to write into instead of allocating a new one.
 */
export function toWorldBox(position: THREE.Vector3, box: ColliderBox, out?: ColliderBox): ColliderBox {
    const result: ColliderBox = out ?? { minX: 0, maxX: 0, minZ: 0, maxZ: 0, minY: 0, maxY: 0 }
    result.minX = position.x + box.minX
    result.maxX = position.x + box.maxX
    result.minZ = position.z + box.minZ
    result.maxZ = position.z + box.maxZ
    result.minY = position.y + box.minY
    result.maxY = position.y + box.maxY
    return result
}

/** Which horizontal axes were blocked during a move. */
export interface MoveResult {
    blockedX: boolean
    blockedZ: boolean
}



/**
 * Collision and movement for player and enemies (singleton).
 *
 * Bodies move axis by axis with swept AABB tests, follow stair ramps, and fall
 * under gravity everywhere else.
 */
export class Physics {

    private static instance: Physics | null = null
    private static readonly _probe = new THREE.Vector3()
    private static readonly _movement = new THREE.Vector3()

    /** Returns the shared instance. */
    public static getInstance(): Physics {
        if (!Physics.instance) {
            Physics.instance = new Physics()
        }
        return Physics.instance
    }

    /**
     * Moves `body` by `velocity * dt` (x/z only), resolves collisions and sets the height on stairs.
     * Away from stairs, gravity acts on `body.velocityY`.
     * @returns Which axes were blocked.
     */
    public computePhysics(body: PhysicsBody, world: PhysicsWorld, velocity: THREE.Vector3, dt: number): MoveResult {
        const oldX: number = body.position.x
        const oldZ: number = body.position.z
        const result: MoveResult = this.move(body, world.colliders, velocity, dt)
        const onStair: boolean = this.stairMovement(body, world, oldX, oldZ)

        if (onStair) {
            body.velocityY = 0
        } else {
            this.applyGravity(body, world.colliders, dt)
        }

        return result
    }

    /**
     * Sweeps the box along from -> to (against tunneling at high speed). If the box
     * already overlaps a collider at the start, that counts as a collision too.
     */
    public checkWallCollision(colliders: ColliderBox[], from: THREE.Vector3, to: THREE.Vector3, colliderBox: ColliderBox): boolean {
        return this.sweep(colliders, from, to, colliderBox) !== null
    }

    /**
     * Earliest contact (0..1) along from -> to over all colliders.
     * @returns The contact time, 0 if the box already overlaps a collider at the start, or null for a free path.
     */
    public sweep(colliders: ColliderBox[], from: THREE.Vector3, to: THREE.Vector3, colliderBox: ColliderBox): number | null {
        const movement: THREE.Vector3 = Physics._movement.subVectors(to, from)
        let tMin: number | null = null

        for (const collider of colliders) {
            const t: number | null = this.sweepTime(from, movement, collider, colliderBox)
            if (t !== null && (tMin === null || t < tMin)) {
                tMin = t
            }
        }

        return tMin
    }

    /**
     * Accelerates velocityY downwards. If the next step collides, y only moves up to the
     * earliest contact (no tunneling through thin colliders) and velocityY is set to 0.
     */
    private applyGravity(body: PhysicsBody, colliders: ColliderBox[], dt: number): void {
        body.velocityY = Math.max(body.velocityY - GRAVITY * dt, -MAX_FALL_SPEED)

        const pos: THREE.Vector3 = body.position
        const colliderBox: ColliderBox = body.getColliderBox()
        const stepY: number = body.velocityY * dt
        const target: THREE.Vector3 = Physics._probe.set(pos.x, pos.y + stepY, pos.z)

        const t: number | null = this.sweep(colliders, pos, target, colliderBox)
        if (t === null) {
            pos.y = target.y
            return
        }

        // Stop just before the contact: float rounding must not push the body into the collider,
        // or it would get stuck there. t = 0 (resting on / stuck inside) -> do not move at all.
        const tSafe: number = Math.max(0, t - COLLISION_EPSILON / Math.abs(stepY))
        pos.y += stepY * tSafe
        body.velocityY = 0
    }

    /** Axis by axis: a blocked axis is dropped, the other one is still applied (sliding along walls). */
    private move(body: PhysicsBody, colliders: ColliderBox[], velocity: THREE.Vector3, dt: number): MoveResult {
        const pos: THREE.Vector3 = body.position
        const colliderBox: ColliderBox = body.getColliderBox()
        const newX: number = pos.x + velocity.x * dt
        const newZ: number = pos.z + velocity.z * dt
        const result: MoveResult = { blockedX: false, blockedZ: false }

        if (newX !== pos.x) {
            if (this.checkWallCollision(colliders, pos, Physics._probe.set(newX, pos.y, pos.z), colliderBox)) {
                result.blockedX = true
            } else {
                pos.x = newX
            }
        }

        if (newZ !== pos.z) {
            if (this.checkWallCollision(colliders, pos, Physics._probe.set(pos.x, pos.y, newZ), colliderBox)) {
                result.blockedZ = true
            } else {
                pos.z = newZ
            }
        }

        return result
    }

    /**
     * On a stair, the height is set absolutely from the progress along the ramp, plus
     * STAIR_HEIGHT_OFFSET. When leaving, the offset is dropped again: out at the bottom ->
     * the stair's base height, out at the top -> its top height; gravity takes over from there.
     * @returns Whether the body stands on a stair.
     */
    private stairMovement(body: PhysicsBody, world: PhysicsWorld, oldX: number, oldZ: number): boolean {
        const { x, z } = body.position
        const footY: number = body.position.y - body.baseHeight
        const stair: StairData | undefined = world.getStairAt(x, z, footY)
        if (stair) {
            body.position.y = body.baseHeight + stair.baseY + stair.heightAt(x, z) + STAIR_HEIGHT_OFFSET
            return true
        }

        // Left in this frame: heightAt clamps to 0 or HEIGHT
        const prev: StairData | undefined = world.getStairAt(oldX, oldZ, footY)
        if (prev) {
            body.position.y = body.baseHeight + prev.baseY + prev.heightAt(x, z)
        }
        return false
    }

    /**
     * Time t (0..1) along `movement` at which the box first touches the collider - null = no hit.
     * If the box already overlaps the collider at the start, t = 0.
     */
    private sweepTime(
        startPosition: THREE.Vector3,
        movement: THREE.Vector3,
        collider: ColliderBox,
        bodyBox: ColliderBox,
    ): number | null {

        const minX = collider.minX - bodyBox.maxX
        const maxX = collider.maxX - bodyBox.minX

        const minY = collider.minY - bodyBox.maxY
        const maxY = collider.maxY - bodyBox.minY

        const minZ = collider.minZ - bodyBox.maxZ
        const maxZ = collider.maxZ - bodyBox.minZ

        const x = this.sweepAxis(
            startPosition.x,
            movement.x,
            minX,
            maxX,
        )

        const y = this.sweepAxis(
            startPosition.y,
            movement.y,
            minY,
            maxY,
        )

        const z = this.sweepAxis(
            startPosition.z,
            movement.z,
            minZ,
            maxZ,
        )

        if (!x || !y || !z) {
            return null
        }

        const tEnter = Math.max(
            x[0],
            y[0],
            z[0],
        )

        const tExit = Math.min(
            x[1],
            y[1],
            z[1],
        )

        // tExit > 0 instead of tEnter >= 0: starting inside the collider (tEnter < 0) is a hit too.
        // Touching flush and moving away gives tExit = 0 and stays free.
        const hit: boolean = tEnter < tExit && tExit > 0 && tEnter <= 1
        return hit ? Math.max(tEnter, 0) : null
    }

    /** Entry and exit time of a moving point on one axis, or null if it never enters [min, max]. */
    private sweepAxis(
        start: number,
        movement: number,
        min: number,
        max: number,
    ): [number, number] | null {
        if (movement === 0) {
            // Touching does not count as a hit
            if (start <= min || start >= max) {
                return null
            }

            return [-Infinity, Infinity]
        }

        const t1 = (min - start) / movement
        const t2 = (max - start) / movement

        return [
            Math.min(t1, t2),
            Math.max(t1, t2),
        ]
    }
}
