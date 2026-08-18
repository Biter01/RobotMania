import { TILE_SIZE, ENEMY_RADIUS } from '../../GameConstants';
import { Enemy } from '../Enemy'
import * as THREE from 'three'
import { AstarPathfinding } from './AstarPathfinding';
import { GameField } from '../../world/GameField';
import { ColliderBox } from '../../types';

export class EnemyAI {
    
    readonly enemy: Enemy;
    readonly sightRange = 50;
    readonly attackRange = 8;
    readonly speed = 3;
    readonly replanInterval = 1;   
    private readonly pathFinder = new AstarPathfinding();   
    private path: THREE.Vector2[] = [];
    private pathIndex = 0;
    private replanTimer = Math.random() * this.replanInterval;

    private readonly wanderTime = 0.6; 
    private wanderTimer = this.wanderTime; 
    private isWandering = false;
    private wanderRight:boolean = false; 

    private static readonly _toTarget3 = new THREE.Vector3();
    private static readonly _target3   = new THREE.Vector3();
    private static readonly _right     = new THREE.Vector3();
    private static readonly _up        = new THREE.Vector3(0, 1, 0);

    constructor(enemy: Enemy) {
        this.enemy = enemy;
    }

    public update(dt:number,playerPos: THREE.Vector3, colliders: ColliderBox[]): void {
        if (!this.enemy.sm) return;

        const inAttackRange = this.isPlayerInAttackRange(this.enemy.position, playerPos);
        const inSight = this.isPlayerInSight(this.enemy.position, playerPos);

        if (inAttackRange) {
            this.attackBehaviour(playerPos, dt, colliders);
        } else if (inSight) {
            this.followBehaviour(playerPos, dt)
        } else {
            //Idle Behaviour
            this.enemy.setActivity('idle');
        }

        this.resolveSeparation();
    }

    private attackBehaviour(playerPos: THREE.Vector3,dt: number, colliders: ColliderBox[]): void {
        const randomSeed = Math.random()

        if((randomSeed > 0.97 || this.isWandering)) {
            this.wanderSide(playerPos,dt,colliders);
        }
            
        if(this.isWandering) {
            this.enemy.setActivity('walk');
        } else {
            this.enemy.facing = EnemyAI._toTarget3.subVectors(playerPos, this.enemy.position).normalize();
            this.enemy.setActivity('shoot');
        }
    }

    private followBehaviour(playerPos: THREE.Vector3,dt: number): void {
        this.enemy.setActivity('walk');
        this.stepTowardsPlayer(dt, playerPos);
    }


    private resolveSeparation(): void {
        const minDist = ENEMY_RADIUS;

        for (const other of GameField.getInstance().enemies) {
            if (other === this.enemy || !other.isAlive()) continue;

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

            // only change own position the other enemy seperate on its own
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

     private wanderSide(playerPos: THREE.Vector3,dt: number, colliders: ColliderBox[]): void {
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

        const toTarget = EnemyAI._toTarget3.subVectors(playerPos, this.enemy.position).normalize();
        const right = EnemyAI._right.crossVectors(toTarget, EnemyAI._up).normalize();

        const canMoveRight = this.canMove(colliders, right,this.speed ,dt)
        const canMoveLeft = this.canMove(colliders, right.clone().negate(),this.speed ,dt)

        if(!canMoveLeft || !canMoveRight) {
            this.isWandering = false;
            this.wanderTimer = 0;
        }

        if (this.wanderRight && canMoveRight) {

            this.enemy.facing = right.clone(); // clone, da facing sonst denselben Scratch-Vektor referenziert
            this.enemy.position.addScaledVector(right, this.speed * dt);
        } else if(canMoveLeft) {
            this.enemy.facing = right.clone().negate();
            this.enemy.position.addScaledVector(right.clone().negate(), this.speed * dt);
        }
    }

    private canMove(colliders: ColliderBox[], direction: THREE.Vector3, speed: number, dt: number): boolean {
        
        return !colliders.some(b => this.enemy.position.x + direction.x * speed * dt + ENEMY_RADIUS > b.minX &&
                this.enemy.position.x + direction.x * speed * dt - ENEMY_RADIUS < b.maxX &&
                this.enemy.position.z + direction.z * speed * dt + ENEMY_RADIUS > b.minZ &&
                this.enemy.position.z + direction.z * speed * dt - ENEMY_RADIUS < b.maxZ)

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
            this.pathIndex++;     // next Field of cached way
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
        const target = EnemyAI._target3.set(
            targetPos.x * TILE_SIZE + TILE_SIZE / 2,
            this.enemy.position.y,
            targetPos.y * TILE_SIZE + TILE_SIZE / 2
        );

        const toTarget = EnemyAI._toTarget3.subVectors(target, this.enemy.position);
        const dist = toTarget.length();

        if (dist > 0) {
            this.enemy.facing = toTarget.clone().normalize(); // clone hier nötig, da facing eine eigene Referenz braucht
        }

        if (dist <= step) {
            this.enemy.position.copy(target);
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