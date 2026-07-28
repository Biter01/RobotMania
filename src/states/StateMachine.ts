import { StateConfig } from './StateConfig'

export class StateMachine<S extends number | string> {
  private states = new Map<S, StateConfig<S>>()
  private current: S | null = null
  private frameIdx = 0  // Index innerhalb frames[]
  private elapsed = 0   // akkumulierte Zeit seit letztem Frame-Wechsel

  // Aktueller Sprite-Sheet-Index – wird von applyFrame() gelesen
  currentFrame = 0

  addState(state: S, config: StateConfig<S>): this {
    this.states.set(state, config)
    return this
  }

  start(state: S): void {
    this.current = state
    this.frameIdx = 0
    this.elapsed = 0
    const config = this.states.get(state)
    if (config) this.currentFrame = config.frames[0]
  }

  transition(state: S): void {
    if (this.current === state) return
    this.start(state)
  }

  update(dt: number): void {
    if (this.current === null) return
    const config = this.states.get(this.current)
    if (!config) return

    this.elapsed += dt
    const frameDuration = 1 / config.fps

    if (this.elapsed >= frameDuration) {
      this.elapsed -= frameDuration
      this.frameIdx++

      if (this.frameIdx >= config.frames.length) {
        if (config.loop) {
          this.frameIdx = 0
        } else if (config.next !== undefined) {
          // Transition in den Nachfolge-State
          this.transition(config.next)
          return
        } else {
          // Letzten Frame halten
          this.frameIdx = config.frames.length - 1
        }
      }

      this.currentFrame = config.frames[this.frameIdx]
    }
  }

  public getCurrentFrame():S|null {
      return this.current
  }
}
