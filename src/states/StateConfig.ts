/** Animation of one state: which sprite sheet frames play, how fast, and what follows. */
export interface StateConfig<S> {
  /** 0-based frame indices in the sprite sheet. */
  frames: number[]
  /** Frames per second. */
  fps: number
  /** Whether the animation repeats. */
  loop: boolean
  /** State to switch to when a non-looping animation ends. */
  next?: S
}
