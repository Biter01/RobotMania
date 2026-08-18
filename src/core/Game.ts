import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass }     from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass }     from 'three/addons/postprocessing/ShaderPass.js'
import { InputManager } from './InputManager'
import { Player } from '../entities/Player'
import { Projectile } from '../entities/Projectile'
import { GameField } from '../world/GameField'
import { ScanlineShader } from '../shaders/ScanlineShader'
import { EnemyFacingDebug } from '../entities/enemyAI/EnemyFacingDebug'
import {
  COLOR_SKY,
  AMBIENT_INTENSITY, DIR_LIGHT_INTENSITY,
  CAMERA_FOV, CAMERA_NEAR, CAMERA_FAR, FRAME_CAP,
} from '../GameConstants'
import { GameState, UpdateContext } from '../types'
import { UIRenderer } from '../ui/UIRenderer'

export const FRAME_DT_CAP = 0.05


export class Game {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  input: InputManager
  state: GameState

  private composer!: EffectComposer
  private scanlinePass!: ShaderPass
  private player!: Player
  private field!: GameField
  private enemyFacingDebug?: EnemyFacingDebug
  private projectiles: Projectile[] = []
  private lastTime = 0
  private fps = 0
  private debug = false
  private ctx!: UpdateContext

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene()

    this.scene.background = new THREE.Color(COLOR_SKY)

    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV, window.innerWidth / window.innerHeight, CAMERA_NEAR, CAMERA_FAR)

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.setSize(window.innerWidth, window.innerHeight)

    this.state = GameState.MENU

    this.setupPostProcessing()

    this.input = new InputManager(canvas, () => this.state)

    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === canvas
      document.body.classList.toggle('locked', locked)
    })

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(window.innerWidth, window.innerHeight)
      this.composer.setSize(window.innerWidth, window.innerHeight)
      // Update resolution so that Scanline-density uniform is correct for new window size
      this.scanlinePass.uniforms.resolution.value = window.innerHeight * window.devicePixelRatio
    })
  }

  /*
    This class represents a render pass. 
    It takes a camera and a scene and produces a beauty pass for subsequent post processing effects.
  */
  private setupPostProcessing() {
    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))

    this.scanlinePass = new ShaderPass(ScanlineShader)
    this.scanlinePass.uniforms.resolution.value = window.innerHeight * window.devicePixelRatio
    this.composer.addPass(this.scanlinePass)
  }

  setState(next: GameState) {
    this.state = next
  
    UIRenderer.getInstance().render(next)
    // Release the pointer lock so the mouse cursor is available for the retry button
    if (next === GameState.GAMEOVER) {
      document.exitPointerLock()
    }
  }

  init() {
    this.scene.add(new THREE.AmbientLight(0xffffff, AMBIENT_INTENSITY))
    const dir = new THREE.DirectionalLight(0xffffff, DIR_LIGHT_INTENSITY)
    dir.position.set(5, 10, 5)
    this.scene.add(dir)
    this.scene.add(this.camera)

    this.field = GameField.getInstance()
    this.field.render(this.scene)

    this.player = new Player(this.camera, this.field.playerSpawn.x, this.field.playerSpawn.z)
    
    this.ctx = {
      dt: 0,
      input: this.input,
      camera: this.camera,
      colliders: this.field.colliders,
      enemies: this.field.enemies,
      player: this.player,
      spawnProjectile: (p: Projectile) => {
        this.projectiles.push(p)
        this.scene.add(p.mesh)
      }
    }

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

    this.calculateFPS(rawDt)
    this.update(dt)
    this.render()
    requestAnimationFrame(this.loop)
  }

  private updateHud() {
    const health = Math.max(this.player.getHealth(),0)
    UIRenderer.getInstance().updateHud({
        fps: this.fps,
        health: health,
        debug: this.debug
    })
  }

  private calculateFPS(rawDt: number) {
    this.fps = this.fps * 0.9 + (1 / rawDt) * 0.1
    this.fps = Math.min(this.fps, FRAME_CAP)
  }

  update(dt: number) {
    if (this.state !== GameState.PLAYING) {
      return
    } 

    if(!this.player.isAlive()) {
      this.setState(GameState.GAMEOVER)
      return
    }

    this.ctx.dt = dt
    this.player.update(dt, this.ctx)
    this.updateEnemies(dt);
    this.updateProjectiles(dt, this.ctx)
    this.updateHud()
  }

  render() {
    this.composer.render()
  }


  private updateEnemies(dt: number) : void {
    const enemies = this.field.enemies
    for (const enemy of enemies) {
      enemy.update(dt, this.ctx)
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
      if (!enemies[i].isAlive() && enemies[i].flashTimer <= 0) {
        const e = enemies[i]
        this.scene.remove(e.mesh)
        e.dispose()
        enemies.splice(i, 1)
      }
    }

    this.enemyFacingDebug?.update(enemies)
  }

  public toggleDebug() {
    
    this.debug = !this.debug
    
    this.player.setInvincible(true);

    if( this.debug) {
      this.enemyFacingDebug = new EnemyFacingDebug(this.scene)
    } else {
      this.enemyFacingDebug?.dispose()
      this.enemyFacingDebug = undefined

      this.player.setInvincible(false);
    }

  }

   private updateProjectiles(dt: number, ctx: UpdateContext) : void {
    for (const p of this.projectiles) {
      p.update(dt, ctx)
      if (!p.alive) {
        this.scene.remove(p.mesh)
        p.dispose()
      }
    }
    this.projectiles = this.projectiles.filter(p => p.alive)

  }

  public dispose() {
    this.composer.dispose()
    this.scanlinePass.dispose()
    this.renderer.dispose()

    this.field.dispose()
    this.player.dispose()

    for (const p of this.projectiles) {
      p.dispose()
    }
  }
}

