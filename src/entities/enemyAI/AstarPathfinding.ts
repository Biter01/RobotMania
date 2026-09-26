import * as THREE from 'three';
import { TILE_SIZE } from '../../GameConstants';
import { GameField } from '../../world/GameField';
import { StairDir, isStairChar, isHorizontalStair } from '../../world/StairData';

class AstarNode {
    nowPos: THREE.Vector2;
    goalPos: THREE.Vector2;
    previousNode: AstarNode | null;
    fCost: number
    gCost: number;

    constructor(nowPos: THREE.Vector2, goalPos: THREE.Vector2, previousNode: AstarNode | null, gCost: number) {
        this.nowPos = nowPos;
        this.goalPos = goalPos;
        this.previousNode = previousNode;
        if(previousNode) {
            this.gCost = previousNode.gCost + gCost; // Assuming a cost of 1 for moving to the next tile
        } else {
            this.gCost = 0;

        }
        this.fCost = this.gCost + this.calculateHeuristic(nowPos, goalPos);
    }

    private calculateHeuristic(nowPos: THREE.Vector2, goalPos: THREE.Vector2): number {
        // Implement heuristic calculation (e.g., Manhattan distance) to the goal
        return Math.sqrt(Math.pow(nowPos.x - goalPos.x, 2) + Math.pow(nowPos.y - goalPos.y, 2));
    }
}

export class AstarPathfinding {
    
    private static readonly directions: THREE.Vector2[] = [
            new THREE.Vector2(1, 0),  // Right
            new THREE.Vector2(-1, 0), // Left
            new THREE.Vector2(0, 1),  // Up
            new THREE.Vector2(0, -1),  // Down  
            new THREE.Vector2(1, 1),  // Up-Right
            new THREE.Vector2(-1, 1), // Up-Left
            new THREE.Vector2(1, -1), // Down-Right
            new THREE.Vector2(-1, -1) // Down-Left
        ];


    private gameField!: GameField;
    private heap: AstarNode[] = [];

    public findPath(enemyPos: THREE.Vector2, playerPos: THREE.Vector2, gameField: GameField): THREE.Vector2[] {
        this.gameField = gameField
        this.heap = [];
        return this.findOptimalWay(enemyPos, playerPos);   // ganzer Weg statt nur [1]
    }


    private findOptimalWay(enemyPos: THREE.Vector2, playerPos: THREE.Vector2): THREE.Vector2[] {
        
        const currTile = this.toTileCoordinates(enemyPos);
        const goalTile = this.toTileCoordinates(playerPos);
        
        const visitedNodes: Set<string> = new Set();

        
        this.addToHeap(new AstarNode(currTile, goalTile, null, 0));

        while (this.heap.length > 0) {
            const current = this.pickBestNode();          
            const currKey = `${current.nowPos.x},${current.nowPos.y}`;

            if (visitedNodes.has(currKey)) { 
                continue
            }

            if (current.nowPos.equals(goalTile))    {
                return this.reconstructPath(current);
            }
            
            visitedNodes.add(currKey);

            for (const neighbor of this.exploreNeighbors(current)) {
                const nKey = `${neighbor.nowPos.x},${neighbor.nowPos.y}`;
                if (!visitedNodes.has(nKey)) {
                    this.addToHeap(neighbor)
                }
            }
        }
        return [];   // Heap leer, Ziel nie gezogen → kein Weg

    }

    private toTileCoordinates(pos: THREE.Vector2): THREE.Vector2 {
        return new THREE.Vector2(Math.floor(pos.x / TILE_SIZE), Math.floor(pos.y / TILE_SIZE));
    }


    private exploreNeighbors(node: AstarNode): AstarNode[] {
        const neighbors: AstarNode[] = [];

        for(const dir of AstarPathfinding.directions) {
            const neighborPos = node.nowPos.clone().add(dir);

            if(this.isValidTile(neighborPos) && this.isStairTransitionAllowed(node.nowPos, neighborPos)) {

                if(dir.x != 0 && dir.y != 0) {
                    const sideA = node.nowPos.clone().add(new THREE.Vector2(dir.x, 0));
                    const sideB = node.nowPos.clone().add(new THREE.Vector2(0, dir.y));
                    // if one side is no valid tile don't allow diagonal movement.
                    // Stiegen-Ecken auch nicht schneiden - dort sitzen die Seiten-Collider
                    if (!this.isValidTile(sideA) || !this.isValidTile(sideB) || this.isStairTile(sideA) || this.isStairTile(sideB)) {
                        continue;
                    }
                    neighbors.push(new AstarNode(neighborPos, node.goalPos, node, Math.sqrt(2))); // Diagonal movement cost
   
                } else {
                    neighbors.push(new AstarNode(neighborPos, node.goalPos, node, 1));
                }
            }

        }
        return neighbors;
    }

    private reconstructPath(node: AstarNode): THREE.Vector2[] {
        const path: THREE.Vector2[] = [];
        let currentNode: AstarNode | null = node;

        while(currentNode) {
            path.unshift(currentNode.nowPos);
            currentNode = currentNode.previousNode;
        }

        return path;
    }

    private isValidTile(tilePos: THREE.Vector2): boolean {
        // Implement logic to check if the tile is walkable (not a wall or obstacle)
        // For now, let's assume all tiles are valid
        
        return this.gameField.isTileWalkable(tilePos.x, tilePos.y);

    }

    private isStairTile(tilePos: THREE.Vector2): boolean {
        return isStairChar(this.gameField.getTileChar(tilePos.x, tilePos.y));
    }

    // Stiegen werden in der Heuristik wie Boden behandelt, sind aber nur entlang ihrer
    // Achse (von beiden Enden) betretbar und verlassbar. Stiege -> Stiege nur bei gleicher Richtung.
    private isStairTransitionAllowed(from: THREE.Vector2, to: THREE.Vector2): boolean {
        const fromChar: string | undefined = this.gameField.getTileChar(from.x, from.y);
        const toChar: string | undefined = this.gameField.getTileChar(to.x, to.y);
        const dx: number = to.x - from.x;
        const dy: number = to.y - from.y;

        if (isStairChar(fromChar) && !this.isAlongStairAxis(fromChar, dx, dy)) return false;
        if (isStairChar(toChar) && !this.isAlongStairAxis(toChar, dx, dy)) return false;
        if (isStairChar(fromChar) && isStairChar(toChar) && fromChar !== toChar) return false;
        return true;
    }

    private isAlongStairAxis(dir: StairDir, dx: number, dy: number): boolean {
        return isHorizontalStair(dir) ? dx !== 0 && dy === 0 : dx === 0 && dy !== 0;
    }


    private addToHeap(node: AstarNode): void {
        this.heap.push(node);
        let i = this.heap.length - 1;
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (this.heap[i].fCost >= this.heap[parent].fCost) break;
            [this.heap[i], this.heap[parent]] = [this.heap[parent], this.heap[i]];
            i = parent;
        }
    }

    private pickBestNode(): AstarNode {
        const top = this.heap[0];
        const last = this.heap.pop()!;      // heap ist beim Aufruf garantiert nicht leer
        if (this.heap.length > 0) {
            this.heap[0] = last;
            let i = 0;
            const n = this.heap.length;
            for (;;) {
                let smallest = i;
                const l = 2 * i + 1;
                const r = 2 * i + 2;
                if (l < n && this.heap[l].fCost < this.heap[smallest].fCost) smallest = l;
                if (r < n && this.heap[r].fCost < this.heap[smallest].fCost) smallest = r;
                if (smallest === i) break;
                [this.heap[i], this.heap[smallest]] = [this.heap[smallest], this.heap[i]];
                i = smallest;
            }
        }
        return top;
    }
}