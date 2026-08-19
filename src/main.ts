import * as THREE from 'three'
import { Game } from './core/Game'
import { GameState } from './types'
import { UIRenderer } from './ui/UIRenderer'

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement

// Genau EIN WebGL-Context fuer die gesamte Session. renderer.dispose() gibt den
// Context nicht frei, ein Renderer pro Game wuerde sie also aufstauen.
const renderer: THREE.WebGLRenderer = new THREE.WebGLRenderer({ canvas, antialias: false })
renderer.setPixelRatio(window.devicePixelRatio)
renderer.setSize(window.innerWidth, window.innerHeight)

let game: Game = new Game(canvas, renderer)

const ui = UIRenderer.getInstance()


let retries = 0;

ui.on('start', () => {
    logGpu(retries + "")
    game.setState(GameState.PLAYING)
    game.start()
})

ui.on('retry', () => {
    game.dispose()
    game = new Game(canvas, renderer)
    game.setState(GameState.PLAYING)
    game.start()
    retries++;
    logGpu(retries + "")
})

// initiales Rendern des Menüs
ui.render(GameState.MENU)

function logGpu(tag: string) {
    const m = renderer.info.memory
    console.log(`[${tag}] geo=${m.geometries} tex=${m.textures} prog=${renderer.info.programs!.length}`)
}
