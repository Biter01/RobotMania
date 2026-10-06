import { NavGrid, NavNode } from '../../world/NavGrid';

interface AstarNode {
    nav: NavNode;
    previousNode: AstarNode | null;
    gCost: number;
    fCost: number;
}

// A* ueber das Ebenen-Nav-Grid. Welche Schritte erlaubt sind (gleiche Hoehe, keine
// Ecken schneiden, Stiegen nur entlang ihrer Achse), entscheidet NavGrid.neighbors.
export class AstarPathfinding {

    private heap: AstarNode[] = [];

    // Ganzer Weg vom Start- zum Zielknoten, path[0] ist der Start. Leer = kein Weg.
    public findPath(start: NavNode, goal: NavNode, nav: NavGrid): NavNode[] {
        this.heap = [];
        const visited: Set<number> = new Set();
        const bestCost: Map<number, number> = new Map([[start.id, 0]]);

        this.addToHeap({ nav: start, previousNode: null, gCost: 0, fCost: this.heuristic(start, goal) });

        while (this.heap.length > 0) {
            const current: AstarNode = this.pickBestNode();
            if (visited.has(current.nav.id)) {
                continue;
            }
            if (current.nav.id === goal.id) {
                return this.reconstructPath(current);
            }
            visited.add(current.nav.id);

            for (const edge of nav.neighbors(current.nav)) {
                const next: NavNode = edge.node;
                if (visited.has(next.id)) continue;

                const gCost: number = current.gCost + edge.cost;
                if (gCost >= (bestCost.get(next.id) ?? Infinity)) continue;
                bestCost.set(next.id, gCost);

                this.addToHeap({ nav: next, previousNode: current, gCost, fCost: gCost + this.heuristic(next, goal) });
            }
        }
        return [];   // Heap leer, Ziel nie gezogen -> kein Weg
    }

    // Luftlinie in Tiles - zulaessig, weil jeder Schritt mindestens seine Luftlinie kostet
    private heuristic(a: NavNode, b: NavNode): number {
        return Math.hypot(a.col - b.col, a.row - b.row);
    }

    private reconstructPath(node: AstarNode): NavNode[] {
        const path: NavNode[] = [];
        let currentNode: AstarNode | null = node;
        while (currentNode) {
            path.unshift(currentNode.nav);
            currentNode = currentNode.previousNode;
        }
        return path;
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

