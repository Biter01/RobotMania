import { GameState } from '../types'

export class InputManager {
  keys: Record<string, boolean> = {}
  mouseX = 0
  mouseY = 0
  mouseDown = false
  isLocked = false

  constructor(canvas: HTMLCanvasElement, getState: () => GameState) {
    window.addEventListener('keydown', e => {
      this.keys[e.code] = true
      if (e.code === 'Escape' && this.isLocked) {
        document.exitPointerLock()
      }
    })
    window.addEventListener('keyup', e => { this.keys[e.code] = false })

    canvas.addEventListener('click', () => {
      if (getState() === GameState.PLAYING) {
        canvas.requestPointerLock()
      }
    })

    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === canvas
    })

    document.addEventListener('mousemove', e => {
      if (!this.isLocked) return
      this.mouseX += e.movementX
      this.mouseY += e.movementY
    })

    canvas.addEventListener('mousedown', e => { if (e.button === 0) this.mouseDown = true })
    canvas.addEventListener('mouseup',   e => { if (e.button === 0) this.mouseDown = false })
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
