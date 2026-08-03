import * as THREE from 'three';
import { TILE_SIZE } from '../../GameConstants';
import { GameField } from '../../world/GameField';


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
    
    private heap: AstarNode[] = [];

    public findPath(enemyPos: THREE.Vector2, playerPos: THREE.Vector2): THREE.Vector2[] {
        this.heap = [];
        return this.findOptimalWay(enemyPos, playerPos);   // ganzer Weg statt nur [1]
    }


    public findNextTile(enemyPos: THREE.Vector2, playerPos: THREE.Vector2): THREE.Vector2{
        this.heap = [];
        

        // Implement A* pathfinding algorithm here to find the next tile towards the player
        // For simplicity, let's return a dummy value for now
        const optimalWay: THREE.Vector2[]= this.findOptimalWay(enemyPos, playerPos);

        if(optimalWay[1]) {
            return optimalWay[1];
        } 

        return this.toTileCoordinates(enemyPos);
        //return optimalWay.nextTile;
    }

    private findOptimalWay(enemyPos: THREE.Vector2, playerPos: THREE.Vector2): THREE.Vector2[] {
        
        const currTile = this.toTileCoordinates(enemyPos);
        const goalTile = this.toTileCoordinates(playerPos);
        
        const visitedNodes: Set<string> = new Set();

        
        this.addToHeap(new AstarNode(currTile, goalTile, null, 0));

        while (this.heap.length > 0) {
            const current = this.pickBestNode();          
            const key = `${current.nowPos.x},${current.nowPos.y}`;

            if (visitedNodes.has(key)) { 
                continue
            }

            if (current.nowPos.equals(goalTile))    {
                return this.reconstructPath(current);
            }
            
            visitedNodes.add(key);

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
        const directions = [
            new THREE.Vector2(1, 0),  // Right
            new THREE.Vector2(-1, 0), // Left
            new THREE.Vector2(0, 1),  // Up
            new THREE.Vector2(0, -1),  // Down
            new THREE.Vector2(1, 1),  // Up-Right
            new THREE.Vector2(-1, 1), // Up-Left
            new THREE.Vector2(1, -1), // Down-Right
            new THREE.Vector2(-1, -1) // Down-Left
        ];
        for(const dir of directions) {
            const neighborPos = node.nowPos.clone().add(dir);

            if(this.isValidTile(neighborPos)) {
                neighbors.push(new AstarNode(neighborPos, node.goalPos, node, 1));
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
        
        for(const enemy of GameField.getInstance().enemies) {
            const enemyTile = this.toTileCoordinates(new THREE.Vector2(enemy.position.x, enemy.position.z));
            if(enemyTile.equals(tilePos)) {
                return false; // Tile is occupied by another enemy
            }
        }
        
        return GameField.getInstance().isTileWalkable(tilePos.x, tilePos.y);

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