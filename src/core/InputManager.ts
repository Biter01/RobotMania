import { GameState } from '../types'

/**
 * Collects keyboard and mouse input for the game loop.
 *
 * All listeners are registered with the given AbortSignal, so aborting it
 * removes them again.
 */
export class InputManager {
  /** Pressed state per `KeyboardEvent.code`. */
  keys: Record<string, boolean> = {}
  /** Accumulated mouse movement since the last {@link consumeMouse}. */
  mouseX = 0
  mouseY = 0
  /** Whether the left button was pressed since the last {@link consumeClick}. */
  mouseDown = false
  /** Whether the pointer is currently locked to the canvas. */
  isLocked = false

  /**
   * @param canvas - The game canvas; clicks on it request pointer lock.
   * @param getState - Returns the current game state; pointer lock is only requested while playing.
   * @param signal - Removes all listeners when aborted.
   * @param toggleDebug - Called when Tab is pressed.
   */
  constructor(canvas: HTMLCanvasElement, getState: () => GameState, signal: AbortSignal, toggleDebug: () => void) {
    window.addEventListener('keydown', e => {
      this.keys[e.code] = true
      if (e.code === 'Escape' && this.isLocked) {
        document.exitPointerLock()
      }
    }, { signal })

    window.addEventListener('keyup', e => { this.keys[e.code] = false }, { signal })

    canvas.addEventListener('click', () => {
      if (getState() === GameState.PLAYING) {
        canvas.requestPointerLock()
      }
    }, { signal })

    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === canvas
    }, { signal })

    document.addEventListener('mousemove', e => {
      if (!this.isLocked) return
      this.mouseX += e.movementX
      this.mouseY += e.movementY
    }, { signal })

    canvas.addEventListener('mousedown', e => { if (e.button === 0) this.mouseDown = true }, { signal })
    canvas.addEventListener('mouseup',   e => { if (e.button === 0) this.mouseDown = false }, { signal })
    
    document.addEventListener('keydown', (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === 'Tab') {
          keyboardEvent.preventDefault(); // keep the browser from moving focus away from the canvas
          toggleDebug();
      }
    }, {signal})
  }

  /** Returns the mouse movement since the last call and resets it. */
  consumeMouse(): { dx: number; dy: number } {
    const dx = this.mouseX
    const dy = this.mouseY
    this.mouseX = 0
    this.mouseY = 0
    return { dx, dy }
  }

  /** Returns whether the left button was pressed since the last call and resets it. */
  consumeClick(): boolean {
    const was = this.mouseDown
    this.mouseDown = false
    return was
  }
}
