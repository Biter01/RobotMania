import * as THREE from 'three'
import { InputManager } from './InputManager'
import { Player } from '../entities/Player'
import { Projectile } from '../entities/Projectile'
import { GameField } from '../world/GameField'
import { Pistol } from '../weapons/Pistol'
import {
  COLOR_SKY,
  AMBIENT_INTENSITY, DIR_LIGHT_INTENSITY,
  CAMERA_FOV, CAMERA_NEAR, CAMERA_FAR, FRAME_CAP,
} from '../GameConstants'
import { GameState } from '../types'


export const FRAME_DT_CAP = 0.05


export class Game {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  input: InputManager
  state: GameState = GameState.MENU

  private player!: Player
  private pistol!: Pistol
  private field!: GameField
  private projectiles: Projectile[] = []
  private lastTime = 0
  private fps = 0
  private fpsEl: HTMLElement

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(COLOR_SKY)

    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV, window.innerWidth / window.innerHeight, CAMERA_NEAR, CAMERA_FAR)

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.setSize(window.innerWidth, window.innerHeight)

    this.fpsEl = document.getElementById('fps') as HTMLElement

    this.input = new InputManager(canvas, () => this.state)

    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === canvas
      document.body.classList.toggle('locked', locked)
    })

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(window.innerWidth, window.innerHeight)
    })
  }

  setState(next: GameState) {
    this.state = next
    document.body.classList.toggle('playing', next === GameState.PLAYING)
  }

  init() {
    this.scene.add(new THREE.AmbientLight(0xffffff, AMBIENT_INTENSITY))
    const dir = new THREE.DirectionalLight(0xffffff, DIR_LIGHT_INTENSITY)
    dir.position.set(5, 10, 5)
    this.scene.add(dir)

    this.field = new GameField()
    this.field.render(this.scene)

    this.player = new Player(this.camera, this.field.playerSpawn.x, this.field.playerSpawn.z, this.field.colliders)
    this.pistol = new Pistol()
  }

  start() {
    this.init()
    this.lastTime = performance.now()
    requestAnimationFrame(this.loop)
  }

  private loop = (now: number) => {
    const rawDt = (now - this.lastTime) / 1000
    const dt = Math.min(rawDt, FRAME_DT_CAP)
    this.lastTime = now

    this.fps = this.fps * 0.9 + (1 / rawDt) * 0.1

    this.fps = Math.min(this.fps, FRAME_CAP)

    if (this.fpsEl) this.fpsEl.textContent = `FPS: ${Math.round(this.fps)}`
    
    this.update(dt)
    this.render()
    requestAnimationFrame(this.loop)
  }

  update(dt: number) {
    if (this.state !== GameState.PLAYING) return

    this.player.update(dt, this.input)

    const newProjectile = this.pistol.update(dt, this.input, this.camera)
    if (newProjectile) {
      this.scene.add(newProjectile.mesh)
      this.projectiles.push(newProjectile)
    }

    const enemies = this.field.enemies
    for (const p of this.projectiles) {
      p.update(dt, this.field.colliders, enemies)
      if (!p.alive) {
        this.scene.remove(p.mesh)
        p.dispose()
      }
    }
    this.projectiles = this.projectiles.filter(p => p.alive)

    for (const enemy of enemies) {
      enemy.update(dt)
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
      if (!enemies[i].alive && enemies[i].flashTimer <= 0) {
        const e = enemies[i]
        this.scene.remove(e.mesh)
        e.dispose()
        enemies.splice(i, 1)
      }
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera)
  }
}
