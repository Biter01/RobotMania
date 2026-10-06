import { PLAYER_EYE_HEIGHT } from '../../GameConstants';
import { Enemy } from '../Enemy'
import * as THREE from 'three'
import { AstarPathfinding } from './AstarPathfinding';
import { GameField } from '../../world/GameField';
import { ColliderBox } from '../../types';
import { NavGrid, NavNode } from '../../world/NavGrid';
import { Physics, PhysicsWorld } from '../../physics/Physics';

export class EnemyAI {
    
    readonly enemy: Enemy;
    readonly sightRange = 50;
    readonly attackRange = 8;
    readonly speed = 3;
    readonly replanInterval = 0.3;   
    private readonly pathFinder = new AstarPathfinding();   
    private path: NavNode[] = [];
    private pathIndex = 0;
    private replanTimer = Math.random() * this.replanInterval;
    //private seperationTimer = 0.5; // Random initial timer to avoid all enemies separating at the same time

    private readonly wanderTime = 0.6; 
    private wanderTimer = this.wanderTime; 
    private isWandering = false;
    private wanderRight:boolean = false; 

    private static readonly _toTarget3 = new THREE.Vector3();
    private static readonly _target3   = new THREE.Vector3();
    private static readonly _right     = new THREE.Vector3();
    private static readonly _up        = new THREE.Vector3(0, 1, 0);
    private static readonly _velocity  = new THREE.Vector3();

    constructor(enemy: Enemy) {
        this.enemy = enemy;
    }

    public update(dt:number,playerPos: THREE.Vector3, gameField:GameField): void {
        if (!this.enemy.sm) return;

        const inAttackRange = this.isPlayerInAttackRange(this.enemy.position, playerPos);
        const inSight = this.isPlayerInSight(this.enemy.position, playerPos);

        if (inAttackRange || this.isWandering) {
            this.attackBehaviour(playerPos, dt, gameField);
        } else if (inSight) {
            this.followBehaviour(playerPos, dt,gameField)
        } else {
            //Idle Behaviour
            this.enemy.setActivity('idle');
        }
        
       
        //this.resolveSeparation(gameField.enemies, dt);
    

    }

    private attackBehaviour(playerPos: THREE.Vector3,dt: number, world: PhysicsWorld): void {
        const randomSeed = Math.random()

        if((randomSeed > 0.98 || this.isWandering)) {
            this.wanderSide(playerPos,dt,world);
        }
            
        if(this.isWandering) {
            this.enemy.setActivity('walk');
        } else {
            this.enemy.facing = EnemyAI._toTarget3.subVectors(playerPos, this.enemy.position).normalize();
            this.enemy.setActivity('shoot');
        }
    }

    private followBehaviour(playerPos: THREE.Vector3,dt: number, gameField:GameField): void {
        this.enemy.setActivity('walk');
        this.stepTowardsPlayer(dt, playerPos, gameField);
    }
    
     private stepTowardsPlayer(dt: number, playerPos: THREE.Vector3, gameField:GameField): void {
        this.replanTimer -= dt;
        if (this.replanTimer <= 0 || this.path.length === 0) {
            this.recomputePath(playerPos, gameField);          
            this.replanTimer = this.replanInterval;
        }
        //Just follow
        this.followPath(dt, gameField, gameField.nav);
    }

     private wanderSide(playerPos: THREE.Vector3,dt: number, world: PhysicsWorld): void {
        const colliders: ColliderBox[] = world.colliders
        if(this.wanderTimer == this.wanderTime) {
            this.wanderRight = Math.random() > 0.5; // Zufällige Richtung für das Wandern
        }
        
        if(this.wanderTimer > 0) {
            this.wanderTimer -= dt;
            this.isWandering = true;
        } else {
            this.isWandering = false;
            this.wanderTimer = this.wanderTime; // Reset the timer for the next wander
            this.enemy.facing = EnemyAI._toTarget3.subVectors(playerPos, this.enemy.position).normalize();
        }

        const toTarget = EnemyAI._toTarget3.subVectors(playerPos, this.enemy.position);
        toTarget.y = 0; // Hoehenunterschied (Stiegen) darf die Seitwaertsrichtung nicht kippen
        toTarget.normalize();
        const right = EnemyAI._right.crossVectors(toTarget, EnemyAI._up).normalize();

        const canMoveRight = this.canMove(colliders, right,this.speed ,dt)
        const canMoveLeft = this.canMove(colliders, right.clone().negate(),this.speed ,dt)

        if(!canMoveLeft || !canMoveRight) {
            this.isWandering = false;
            this.wanderTimer = 0;
        }

        if (this.wanderRight && canMoveRight) {

            this.enemy.facing = right.clone(); // clone, da facing sonst denselben Scratch-Vektor referenziert
            Physics.getInstance().computePhysics(this.enemy, world, EnemyAI._velocity.copy(right).multiplyScalar(this.speed), dt);
        } else if(canMoveLeft) {
            this.enemy.facing = right.clone().negate();
            Physics.getInstance().computePhysics(this.enemy, world, EnemyAI._velocity.copy(right).multiplyScalar(-this.speed), dt);
        }
    }

    private canMove(colliders: ColliderBox[], direction: THREE.Vector3, speed: number, dt: number): boolean {
        
        return !Physics.getInstance().checkWallCollision(colliders, this.enemy.position, this.enemy.position.clone().addScaledVector(direction, speed * dt), this.enemy.getColliderBox())
        
        /*return !colliders.some(b => this.enemy.position.x + direction.x * speed * dt + ENEMY_RADIUS > b.minX &&
                this.enemy.position.x + direction.x * speed * dt - ENEMY_RADIUS < b.maxX &&
                this.enemy.position.z + direction.z * speed * dt + ENEMY_RADIUS > b.minZ &&
                this.enemy.position.z + direction.z * speed * dt - ENEMY_RADIUS < b.maxZ)*/

    }

    // Start und Ziel ueber die Fuss-Hoehe auf die richtige Ebene des Nav-Grids legen
    private recomputePath(playerPos: THREE.Vector3, gameField: GameField): void {
        const nav: NavGrid = gameField.nav;
        const pos: THREE.Vector3 = this.enemy.position;
        const start: NavNode | undefined = nav.nodeAt(pos.x, pos.y - this.enemy.baseHeight, pos.z);
        const goal: NavNode | undefined = nav.nodeAt(playerPos.x, playerPos.y - PLAYER_EYE_HEIGHT, playerPos.z);
        this.path = start && goal ? this.pathFinder.findPath(start, goal, nav) : [];
        this.pathIndex = this.path.length > 1 ? 1 : 0;  // Index 0 ist das eigene Feld
    }

    private followPath(dt: number, world: PhysicsWorld, nav: NavGrid): void {
        if (this.pathIndex >= this.path.length) {
            return
        }
        const target: { x: number; y: number; z: number } = nav.centerOf(this.path[this.pathIndex]);
        this.moveTowards(target, dt, world);
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

    // Entscheidet nur, wohin gegangen wird - Bewegung, Kollision und Stiegen macht Physics
    private moveTowards(targetPos: { x: number; z: number }, dt: number, world: PhysicsWorld): void {
        // Hoehe ignorieren: die setzt Physics (Stiegen, Gravitation)
        const target = EnemyAI._target3.set(targetPos.x, this.enemy.position.y, targetPos.z);

        const toTarget = EnemyAI._toTarget3.subVectors(target, this.enemy.position);
        const dist = toTarget.length();
        if (dist <= 0 || dt <= 0) {
            return
        }

        this.enemy.facing = toTarget.clone().normalize(); // clone hier nötig, da facing eine eigene Referenz braucht

        // Im letzten Schritt genau auf der Tile-Mitte landen statt darueber hinaus
        const speed: number = Math.min(this.speed, dist / dt);
        const velocity: THREE.Vector3 = EnemyAI._velocity.copy(toTarget).normalize().multiplyScalar(speed);
        Physics.getInstance().computePhysics(this.enemy, world, velocity, dt);
    }
    private tileIsReached(enemyPos: THREE.Vector3, tileCenter: { x: number; z: number }): boolean {
        const distance = Math.hypot(enemyPos.x - tileCenter.x, enemyPos.z - tileCenter.z);
        return distance <= 0.1; // Threshold to consider the tile reached
    }
}