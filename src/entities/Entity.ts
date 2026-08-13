import {UpdateContext} from "../types"

export interface Entity {
  update(dt: number, ctx: UpdateContext): void
  dispose(): void
}