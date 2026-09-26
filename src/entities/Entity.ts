import {UpdateContext} from "../types"
import * as THREE from "three"

export interface Entity {
  update(dt: number, ctx: UpdateContext): void
  dispose(): void
  getPosition(): THREE.Vector3
}