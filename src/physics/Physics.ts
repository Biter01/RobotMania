import * as THREE from 'three'
import { ColliderBox } from '../types'
import type { StairData } from '../world/StairData'
import { STAIR_HEIGHT_OFFSET, GRAVITY, MAX_FALL_SPEED, COLLISION_EPSILON } from '../GameConstants'

// Was computePhysics vom bewegten Objekt braucht (Player, Enemy)
export interface PhysicsBody {
    position: THREE.Vector3
    // y-Position auf Bodenhoehe; auf Stiegen kommt die Stiegenhoehe dazu
    readonly baseHeight: number
    // Vertikale Geschwindigkeit (negativ = fallen), wird von der Gravitation beschleunigt
    velocityY: number
    getColliderBox(): ColliderBox
}

// Was computePhysics vom Spielfeld braucht - GameField erfuellt das
export interface PhysicsWorld {
    readonly colliders: ColliderBox[]
    getStairAt(x: number, z: number): StairData | undefined
}

// Entity-Collider sind relativ zur position gespeichert - hier in Weltkoordinaten umrechnen.
// Wird auch von ColliderDebug genutzt, damit die Anzeige exakt der Physik entspricht.
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

export interface MoveResult {
    blockedX: boolean
    blockedZ: boolean
}



export class Physics {

    private static instance: Physics | null = null
    private static readonly _probe = new THREE.Vector3()
    private static readonly _movement = new THREE.Vector3()

    public static getInstance(): Physics {
        if (!Physics.instance) {
            Physics.instance = new Physics()
        }
        return Physics.instance
    }

    // Bewegt body um velocity * dt (nur x/z), prueft Kollisionen und setzt die Hoehe auf Stiegen.
    // Abseits von Stiegen wirkt die Gravitation auf body.velocityY.
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

    // Sweept die Box entlang from -> to (gegen Tunneling bei hoher Speed). Steckt die Box schon
    // beim Start in einem Collider, zaehlt das ebenfalls als Kollision.
    public checkWallCollision(colliders: ColliderBox[], from: THREE.Vector3, to: THREE.Vector3, colliderBox: ColliderBox): boolean {
        return this.sweep(colliders, from, to, colliderBox) !== null
    }

    // Fruehester Kontakt (0..1) entlang from -> to ueber alle Collider - null = freie Strecke.
    // 0 = die Box steckt schon beim Start in einem Collider.
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

    // Beschleunigt velocityY nach unten. Kollidiert der naechste Schritt, wird y nur bis zum
    // fruehesten Kontakt bewegt (kein Tunneling durch duenne Collider) und velocityY auf 0 gesetzt.
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

        // Knapp vor dem Kontakt stoppen: Float-Rundung darf den Body nicht in den Collider schieben,
        // sonst wuerde er dort feststecken. t = 0 (liegt auf / steckt drin) -> gar nicht bewegen.
        const tSafe: number = Math.max(0, t - COLLISION_EPSILON / Math.abs(stepY))
        pos.y += stepY * tSafe
        body.velocityY = 0
    }

    // Achsenweise: eine blockierte Achse wird verworfen, die andere trotzdem ausgefuehrt (Sliden an Waenden)
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

    // Auf einer Stiege wird die Hoehe absolut aus dem Fortschritt entlang der Rampe gesetzt,
    // plus STAIR_OFFSET. Beim Verlassen faellt der Offset wieder weg: unten raus -> Bodenhoehe,
    // oben raus -> Stiegenhoehe, von dort uebernimmt die Gravitation. Gibt zurueck, ob body auf einer Stiege steht.
    private stairMovement(body: PhysicsBody, world: PhysicsWorld, oldX: number, oldZ: number): boolean {
        const { x, z } = body.position
        const stair: StairData | undefined = world.getStairAt(x, z)
        if (stair) {
            body.position.y = body.baseHeight + stair.heightAt(x, z) + STAIR_HEIGHT_OFFSET
            return true
        }

        // In diesem Frame verlassen: heightAt klemmt auf 0 bzw. HEIGHT
        const prev: StairData | undefined = world.getStairAt(oldX, oldZ)
        if (prev) {
            body.position.y = body.baseHeight + prev.heightAt(x, z)
        }
        return false
    }

    // Zeitpunkt t (0..1) entlang movement, an dem die Box den Collider erstmals beruehrt - null = kein Treffer.
    // Ueberlappt die Box den Collider schon beim Start, ist t = 0.
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

        // tExit > 0 statt tEnter >= 0: ein Start im Collider (tEnter < 0) ist auch ein Treffer.
        // Buendig anliegen und wegbewegen ergibt tExit = 0 und bleibt frei.
        const hit: boolean = tEnter < tExit && tExit > 0 && tEnter <= 1
        return hit ? Math.max(tEnter, 0) : null
    }

    private sweepAxis(
        start: number,
        movement: number,
        min: number,
        max: number,
    ): [number, number] | null {
        if (movement === 0) {
            // Beruehren zaehlt nicht als Treffer
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
