import { Game } from './core/Game'
import { GameState } from './types'

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement
const menuOverlay = document.getElementById('menu-overlay') as HTMLDivElement

const game = new Game(canvas)


// Start on first click
menuOverlay.addEventListener('click', () => {
  menuOverlay.style.display = 'none'
  game.setState(GameState.PLAYING)
  game.start()
}, { once: true })
