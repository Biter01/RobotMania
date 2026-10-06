import { StateConfig } from './StateConfig'

/**
 * Plays frame animations and switches between states.
 * @typeParam S - The state identifiers, e.g. an enum.
 */
export class StateMachine<S extends number | string> {
  private states = new Map<S, StateConfig<S>>()
  private current: S | null = null
  private frameIdx = 0  // index within frames[]
  private elapsed = 0   // time accumulated since the last frame change

  /** Current sprite sheet frame index - read by Enemy.applyFrame(). */
  currentFrame = 0

  /** Registers a state. Returns `this` for chaining. */
  addState(state: S, config: StateConfig<S>): this {
    this.states.set(state, config)
    return this
  }

  /** Starts `state` from its first frame, even if it is already running. */
  start(state: S): void {
    this.current = state
    this.frameIdx = 0
    this.elapsed = 0
    const config = this.states.get(state)
    if (config) this.currentFrame = config.frames[0]
  }

  /** Switches to `state` unless it is already the current one. */
  transition(state: S): void {
    if (this.current === state) return
    this.start(state)
  }

  /** Advances the animation by `dt` seconds. */
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
          // Transition to the follow-up state
          this.transition(config.next)
          return
        } else {
          // Hold the last frame
          this.frameIdx = config.frames.length - 1
        }
      }

      this.currentFrame = config.frames[this.frameIdx]
    }
  }

  /** Returns the current state (despite the name, not the frame), or null before start(). */
  public getCurrentFrame():S|null {
      return this.current
  }
}
