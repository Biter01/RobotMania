import { GameState } from '../types'

export class InputManager {
  keys: Record<string, boolean> = {}
  mouseX = 0
  mouseY = 0
  mouseDown = false
  isLocked = false

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
          keyboardEvent.preventDefault(); // wichtig, siehe unten
          toggleDebug();
          // z. B. game.toggleSomething();
      }
    }, {signal})
  }

  consumeMouse(): { dx: number; dy: number } {
    const dx = this.mouseX
    const dy = this.mouseY
    this.mouseX = 0
    this.mouseY = 0
    return { dx, dy }
  }

  consumeClick(): boolean {
    const was = this.mouseDown
    this.mouseDown = false
    return was
  }
}
