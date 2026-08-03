import { TILE_SIZE, ENEMY_RADIUS } from '../../GameConstants';
import { Enemy } from '../Enemy'
import * as THREE from 'three'
import { AstarPathfinding } from './AstarPathfinding';
import { GameField } from '../../world/GameField';

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

    private readonly wanderTime = 0.6; // Sekunden zwischen Wanderbewegungen
    private wanderTimer = this.wanderTime; 
    private isWandering = false;
    private wanderRight:boolean = false; // Zufällige Richtung für das Wandern

    constructor(enemy: Enemy) {
        this.enemy = enemy;
    }

    public update(dt:number,playerPos: THREE.Vector3): void {
        if (!this.enemy.sm) return;

        const inAttackRange = this.isPlayerInAttackRange(this.enemy.position, playerPos);
        const inSight = this.isPlayerInSight(this.enemy.position, playerPos);

        const randomSeed = Math.random()


        if (inAttackRange) {

             if((randomSeed > 0.99 || this.isWandering)) {
                this.wanderSide(playerPos,dt)
            }
            
            if(this.isWandering) {
                this.enemy.setActivity('walk');
            } else {
                this.enemy.setActivity('shoot');
            }
            //this.enemy.attackPlayer(this.enemy, playerPos);
        } else if (inSight) {
            this.enemy.setActivity('walk');
            this.stepTowardsPlayer(dt, playerPos);
        } else {
            this.enemy.setActivity('idle');
        }

        this.resolveSeparation();
    }

    private resolveSeparation(): void {
        const minDist = ENEMY_RADIUS;

        for (const other of GameField.getInstance().enemies) {
            if (other === this.enemy || !other.alive) continue;

            const dx = this.enemy.position.x - other.position.x;
            const dz = this.enemy.position.z - other.position.z;
            const distSq = dx * dx + dz * dz;

            if (distSq >= minDist * minDist) continue;

            const dist = Math.sqrt(distSq);
            
            // dx dz is always pointing from other to this.enemy, so we can use it to move this.enemy away from other

            // Enemies stay exactly on the same tile, go abitrary direction to separate

            const nx = dist > 0.0001 ? dx / dist : 1;
            const nz = dist > 0.0001 ? dz / dist : 0;
            const overlap = minDist - dist;

            // nur die eigene Position korrigieren (der andere Gegner löst sich in seinem eigenen Update)
            this.enemy.position.x += nx * overlap * 0.5;
            this.enemy.position.z += nz * overlap * 0.5;
        }
    }
    

     private stepTowardsPlayer(dt: number, playerPos: THREE.Vector3): void {
        this.replanTimer -= dt;
        if (this.replanTimer <= 0 || this.path.length === 0) {
            this.recomputePath(playerPos);          
            this.replanTimer = this.replanInterval;
        }
        //Just follow
        this.followPath(dt);              
    }


     private wanderSide(playerPos: THREE.Vector3,dt: number) {
        if(this.wanderTimer == this.wanderTime) {
            this.wanderRight = Math.random() > 0.5; // Zufällige Richtung für das Wandern
        }
        
        if(this.wanderTimer > 0) {
            this.wanderTimer -= dt;
            this.isWandering = true;
        } else {
            this.isWandering = false;
            this.wanderTimer = this.wanderTime; // Reset the timer for the next wander
        }

        const toTarget = new THREE.Vector3().subVectors(playerPos, this.enemy.position).normalize();
        const up = new THREE.Vector3(0, 1, 0);

        // Senkrecht nach rechts (aus Sicht des Gegners, der Richtung toTarget schaut)
        const right = new THREE.Vector3().crossVectors(toTarget, up).normalize();

        // Senkrecht nach links = einfach das Gegenteil
        const left = right.clone().negate();

        if(this.wanderRight) {
            this.enemy.facing = right;

            this.enemy.position.add(right.multiplyScalar(this.speed * dt));
        } else {
            this.enemy.facing = left;


            this.enemy.position.add(left.multiplyScalar(this.speed * dt));
        }
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