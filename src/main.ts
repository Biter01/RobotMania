import { Game } from './core/Game'
import { GameState } from './types'
import { UIRenderer } from './ui/UIRenderer'

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement

let game: Game  = new Game(canvas)

const ui = UIRenderer.getInstance()

ui.on('start', () => {
    game.setState(GameState.PLAYING)
    game.start()
})

ui.on('retry', () => {
    game.dispose()
    game = new Game(canvas)
    game.setState(GameState.PLAYING)
    game.start()
})

// initiales Rendern des Menüs
ui.render(GameState.MENU)

document.addEventListener('keydown', (keyboardEvent: KeyboardEvent) => {
  if (keyboardEvent.key === 'Tab') {
      keyboardEvent.preventDefault(); // wichtig, siehe unten
      game.toggleDebug();
      // z. B. game.toggleSomething();
  }
})