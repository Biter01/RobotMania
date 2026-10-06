/**
 * Entry point: creates the renderer, the game and the UI, and wires up the menu events.
 * @module
 */
import * as THREE from 'three'
import { Game } from './core/Game'
import { GameState } from './types'
import { UIRenderer } from './ui/UIRenderer'

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement

import { LEVEL_1 } from "./world/levels/Level1"

/**
 * Exactly ONE WebGL context for the whole session. `renderer.dispose()` does not
 * release the context, so one renderer per Game would pile them up.
 */
const renderer: THREE.WebGLRenderer = new THREE.WebGLRenderer({ canvas, antialias: false })
renderer.setPixelRatio(window.devicePixelRatio)
renderer.setSize(window.innerWidth, window.innerHeight)

let currLevel = LEVEL_1

let game: Game = new Game(canvas, renderer)

const ui = UIRenderer.getInstance()

let retries = 0;

ui.on('start', () => {
    logGpu(retries + "")
    game.setState(GameState.PLAYING)
    game.start(currLevel)
})


ui.on('retry', async () => {
  game.setState(GameState.LOADING)   // or MENU - anything but PLAYING
  await game.loadLevel(currLevel)
  game.setState(GameState.PLAYING)
  retries++
  logGpu(retries + "")
})

// Previous retry handler that rebuilt the whole Game instead of reloading the level:
/*
ui.on('retry', () => {
    game.dispose()
    game = new Game(canvas, renderer)
    game.setState(GameState.PLAYING)
    game.start(currLevel)
    retries++;
    logGpu(retries + "")
})*/

// Initial render of the menu
ui.render(GameState.MENU)

/** Logs the renderer's GPU memory counters, used to spot leaks across retries. */
function logGpu(tag: string) {
    const m = renderer.info.memory
    console.log(`[${tag}] geo=${m.geometries} tex=${m.textures} prog=${renderer.info.programs!.length}`)
}
