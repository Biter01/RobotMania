import * as THREE from 'three'
import { ColliderBox } from '../types'
import type { StairData } from '../world/StairData'
import { STAIR_HEIGHT_OFFSET } from '../GameConstants'

// Was computePhysics vom bewegten Objekt braucht (Player, Enemy)
export interface PhysicsBody {
    position: THREE.Vector3
    // y-Position auf Bodenhoehe; auf Stiegen kommt die Stiegenhoehe dazu
    readonly baseHeight: number
    getColliderBox(): ColliderBox
}

// Was computePhysics vom Spielfeld braucht - GameField erfuellt das
export interface PhysicsWorld {
    readonly colliders: ColliderBox[]
    getStairAt(x: number, z: number): StairData | undefined
}

export interface MoveResult {
    blockedX: boolean
    blockedZ: boolean
}

export class Physics {
    private static instance: Physics | null = null
    private static readonly _probe = new THREE.Vector3()

    public static getInstance(): Physics {
        if (!Physics.instance) {
            Physics.instance = new Physics()
        }
        return Physics.instance
    }

    // Bewegt body um velocity * dt (nur x/z), prueft Kollisionen und setzt die Hoehe auf Stiegen
    public computePhysics(body: PhysicsBody, world: PhysicsWorld, velocity: THREE.Vector3, dt: number): MoveResult {
        const oldX: number = body.position.x
        const oldZ: number = body.position.z
        const result: MoveResult = this.move(body, world.colliders, velocity, dt)
        this.stairMovement(body, world, oldX, oldZ)
        // Hier kommt spaeter die Gravity dazu
        return result
    }

    public checkWallCollision(colliders: ColliderBox[], position: THREE.Vector3, colliderBox: ColliderBox): boolean {
        const colliderCordinates = {
            minX: position.x + colliderBox.minX,
            maxX: position.x + colliderBox.maxX,
            minZ: position.z + colliderBox.minZ,
            maxZ: position.z + colliderBox.maxZ
        }

        for (const collider of colliders) {
            if(this.colliderOverlap(colliderCordinates, collider)) {
                return true
            }
        }
        return false
    }

    // Achsenweise: eine blockierte Achse wird verworfen, die andere trotzdem ausgefuehrt (Sliden an Waenden)
    private move(body: PhysicsBody, colliders: ColliderBox[], velocity: THREE.Vector3, dt: number): MoveResult {
        const pos: THREE.Vector3 = body.position
        const colliderBox: ColliderBox = body.getColliderBox()
        const newX: number = pos.x + velocity.x * dt
        const newZ: number = pos.z + velocity.z * dt
        const result: MoveResult = { blockedX: false, blockedZ: false }

        if (newX !== pos.x) {
            if (this.checkWallCollision(colliders, Physics._probe.set(newX, pos.y, pos.z), colliderBox)) {
                result.blockedX = true
            } else {
                pos.x = newX
            }
        }

        if (newZ !== pos.z) {
            if (this.checkWallCollision(colliders, Physics._probe.set(pos.x, pos.y, newZ), colliderBox)) {
                result.blockedZ = true
            } else {
                pos.z = newZ
            }
        }

        return result
    }

    // Auf einer Stiege wird die Hoehe absolut aus dem Fortschritt entlang der Rampe gesetzt,
    // plus STAIR_OFFSET. Beim Verlassen faellt der Offset wieder weg: unten raus -> Bodenhoehe,
    // oben raus -> Stiegenhoehe. Sonst bleibt y unveraendert - ohne Gravity schwebt man oben weiter.
    private stairMovement(body: PhysicsBody, world: PhysicsWorld, oldX: number, oldZ: number): void {
        const { x, z } = body.position
        const stair: StairData | undefined = world.getStairAt(x, z)
        if (stair) {
            body.position.y = body.baseHeight + stair.heightAt(x, z) + STAIR_HEIGHT_OFFSET
            return
        }

        // In diesem Frame verlassen: heightAt klemmt auf 0 bzw. HEIGHT
        const prev: StairData | undefined = world.getStairAt(oldX, oldZ)
        if (prev) {
            body.position.y = body.baseHeight + prev.heightAt(x, z)
        }
    }

    private colliderOverlap(boxA: { minX: number; maxX: number; minZ: number; maxZ: number }, boxB: { minX: number; maxX: number; minZ: number; maxZ: number }): boolean {
        return (
            boxA.minX < boxB.maxX &&
            boxA.maxX > boxB.minX &&
            boxA.minZ < boxB.maxZ &&
            boxA.maxZ > boxB.minZ
        )
    }
}
