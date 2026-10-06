import {UpdateContext} from "../types"
import * as THREE from "three"

/** Common interface of everything that lives in the game loop (player, enemies, projectiles). */
export interface Entity {
  /** Advances the entity by one step. */
  update(dt: number, ctx: UpdateContext): void
  /** Releases GPU resources. */
  dispose(): void
  getPosition(): THREE.Vector3
}