import { TILE_SIZE } from '../../GameConstants';
import { Enemy } from '../Enemy'
import * as THREE from 'three'
import { AstarPathfinding } from './AstarPathfinding';

export class EnemyAI {
    
    readonly enemy: Enemy;
    readonly sightRange = 50;
    readonly attackRange = 5;
    readonly speed = 3;
    readonly replanInterval = 0.5;   // Sekunden zwischen A*-Läufen (siehe Hinweis unten)

    private readonly pathFinder = new AstarPathfinding();   // EINMAL anlegen, nicht pro Aufruf
    private path: THREE.Vector2[] = [];
    private pathIndex = 0;
    // zufälliger Versatz -> die Gegner rechnen NICHT alle im selben Frame neu
    private replanTimer = Math.random() * this.replanInterval;

    constructor(enemy: Enemy) {
        this.enemy = enemy;
    }

    public update(dt:number,playerPos: THREE.Vector3): void {
        if (!this.enemy.sm) return;

        const inAttackRange = this.isPlayerInAttackRange(this.enemy.position, playerPos);
        const inSight = this.isPlayerInSight(this.enemy.position, playerPos);

        if (inAttackRange) {
            this.enemy.setActivity('shoot');
            //this.enemy.attackPlayer(this.enemy, playerPos);
        } else if (inSight) {
            this.enemy.setActivity('walk');
            this.stepTowardsPlayer(dt, playerPos);
        } else {
            this.enemy.setActivity('idle');
        }
    }

     private stepTowardsPlayer(dt: number, playerPos: THREE.Vector3): void {
        this.replanTimer -= dt;
        if (this.replanTimer <= 0 || this.path.length === 0) {
            this.recomputePath(playerPos);          // <-- HIER läuft A*, nur selten
            this.replanTimer = this.replanInterval;
        }
        this.followPath(dt);                        // <-- jeden Frame, aber gratis
    }

    private recomputePath(playerPos: THREE.Vector3): void {
        const enemy2D  = new THREE.Vector2(this.enemy.position.x, this.enemy.position.z);
        const player2D = new THREE.Vector2(playerPos.x, playerPos.z);
        this.path = this.pathFinder.findPath(enemy2D, player2D);
        this.pathIndex = this.path.length > 1 ? 1 : 0;  // Index 0 ist das eigene Feld
    }

    private followPath(dt: number): void {
        if (this.pathIndex >= this.path.length) {
            return
        }   
        const target = this.path[this.pathIndex];
        this.moveTowards(target, this.speed * dt);
        if (this.tileIsReached(this.enemy.position, target)) {
            this.pathIndex++;                             // nächstes Feld des GECACHTEN Wegs
        }
    }

    private isPlayerInSight(enemyPos: THREE.Vector3, playerPos: THREE.Vector3): boolean {
        const distance = enemyPos.distanceTo(playerPos);
        return distance < this.sightRange;
    }

    private isPlayerInAttackRange(enemyPos: THREE.Vector3, playerPos: THREE.Vector3): boolean {
        const distance = enemyPos.distanceTo(playerPos);
        return distance < this.attackRange;
    }


    private moveTowards(targetPos: THREE.Vector2, step: number): void {
        const target = new THREE.Vector3(
            targetPos.x * TILE_SIZE + TILE_SIZE / 2,
            this.enemy.position.y,                       // y beibehalten, nicht auf 0 setzen!
            targetPos.y * TILE_SIZE + TILE_SIZE / 2
        );

        const toTarget = new THREE.Vector3().subVectors(target, this.enemy.position);
        const dist = toTarget.length();

        if (dist > 0) {
            this.enemy.facing = toTarget.clone().normalize();
        }

        if (dist <= step) {
            this.enemy.position.copy(target);            // exakt aufs Feld, kein Überschießen
        } else {
            this.enemy.position.add(toTarget.normalize().multiplyScalar(step));
        }

    }

    private tileIsReached(enemyPos: THREE.Vector3, nextTile: THREE.Vector2): boolean {
        const tileCenter = new THREE.Vector3(nextTile.x * TILE_SIZE + TILE_SIZE / 2, enemyPos.y, nextTile.y * TILE_SIZE + TILE_SIZE / 2);
        const distance = enemyPos.distanceTo(tileCenter);
        return distance <= 0.1; // Threshold to consider the tile reached
    }
}