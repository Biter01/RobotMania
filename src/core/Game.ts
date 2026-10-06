import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass }     from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass }     from 'three/addons/postprocessing/ShaderPass.js'
import { InputManager } from './InputManager'
import { Player } from '../entities/Player'
import { Projectile } from '../entities/Projectile'
import { GameField } from '../world/GameField'
import { ScanlineShader } from '../shaders/ScanlineShader'
import { DamageFlashShader } from '../shaders/DamageFlashShader'

import { EnemyFacingDebug } from '../entities/enemyAI/EnemyFacingDebug'
import { ColliderDebug } from '../physics/ColliderDebug'
import {
  COLOR_SKY,
  AMBIENT_INTENSITY, DIR_LIGHT_INTENSITY,
  CAMERA_FOV, CAMERA_NEAR, CAMERA_FAR,
} from '../GameConstants'
import { GameState, UpdateContext } from '../types'
import { UIRenderer } from '../ui/UIRenderer'
import { setMaxAnisotropy } from './AssetLoader'
import type { LevelData } from '../world/LevelData'

/** Upper limit for one frame's time step in seconds, so a stalled tab does not cause a huge jump. */
export const FRAME_DT_CAP = 0.05


/**
 * Owns the scene, camera, post-processing and game loop, and runs one level at a time.
 *
 * Lifetime objects (composer, input, lights) live as long as the Game; level
 * objects (field, player, projectiles) are rebuilt by {@link loadLevel}.
 */
export class Game {
  scene!: THREE.Scene
  camera!: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  input!: InputManager 
  state: GameState

  private composer!: EffectComposer
  private scanlinePass!: ShaderPass
  private damageFlashPass!: ShaderPass

  private player!: Player
  private field!: GameField
  private enemyFacingDebug?: EnemyFacingDebug
  private colliderDebug?: ColliderDebug
  private projectiles: Projectile[] = []
  private lastTime = 0
  private fps = 0
  private debug = false
  private ctx!: UpdateContext
  
  // Avoid memory leaks
  private rafId = 0;
  private disposed = false
  private ac = new AbortController()

  private accumulator = 0
  /** Fixed simulation step in seconds; the loop runs update() in steps of this size. */
  private static readonly FIXED_DT = 1 / 60 


  private frameCount = 0
  private fpsTimer = 0

  /**
   * @param canvas - The game canvas, used for input and pointer lock.
   * @param renderer - The shared renderer; it is owned by `main.ts`, not by the Game.
   */
  constructor(canvas: HTMLCanvasElement, renderer: THREE.WebGLRenderer) {
    this.renderer = renderer
    this.state = GameState.MENU

    // Must run before the first setupWorld(): blocks read this value when
    // loading their texture.
    setMaxAnisotropy(this.renderer.capabilities.getMaxAnisotropy())

    this.setupScene()
    this.setupCamera()
    this.setupLights()
    this.setupPostProcessing()
    this.setupInput(canvas)
    this.setupResizeHandler()
  }

  private setupScene(): void {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(COLOR_SKY)
  }

  private setupCamera(): void {
    this.camera = new THREE.PerspectiveCamera(
      CAMERA_FOV, window.innerWidth / window.innerHeight, CAMERA_NEAR, CAMERA_FAR,
    )
    this.scene.add(this.camera)
  }

  private setupLights(): void {
    this.scene.add(new THREE.AmbientLight(0xffffff, AMBIENT_INTENSITY))
    const dir = new THREE.DirectionalLight(0xffffff, DIR_LIGHT_INTENSITY)
    dir.position.set(5, 10, 5)
    this.scene.add(dir)
  }

  private setupInput(canvas: HTMLCanvasElement): void {
    this.input = new InputManager(
      canvas, () => this.state, this.ac.signal, () => this.toggleDebug(),
    )
  }

private setupResizeHandler(): void {
  window.addEventListener('resize', () => {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.composer.setSize(window.innerWidth, window.innerHeight)
    this.scanlinePass.uniforms.resolution.value =
      window.innerHeight * window.devicePixelRatio
  }, { signal: this.ac.signal })
}

private setupWorld(level: LevelData): void {
  this.field = new GameField(level)
  this.field.render(this.scene)
}

private setupPlayer(): void {
  this.player = new Player(
    this.camera, this.field.playerSpawn.x, this.field.playerSpawn.z, this.field.playerSpawn.y,
  )
  this.player.setDamageShader(this.damageFlashPass)
}

private createContext(): UpdateContext {
  return {
    dt: 0,
    input: this.input,
    camera: this.camera,
    field: this.field,
    player: this.player,
    spawnProjectile: (p: Projectile) => {
      this.projectiles.push(p)
      this.scene.add(p.mesh)
    },
  }
}

  /**
   * Builds the post-processing chain: a RenderPass produces the beauty pass of
   * scene and camera, followed by the scanline and damage flash shaders.
   */
  private setupPostProcessing() {
    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))

    this.scanlinePass = new ShaderPass(ScanlineShader)
    this.scanlinePass.uniforms.resolution.value = window.innerHeight * window.devicePixelRatio
    this.composer.addPass(this.scanlinePass)


    // Damage flash shader, applied on top of the scanline shader
    this.damageFlashPass = new ShaderPass(DamageFlashShader)
    this.composer.addPass(this.damageFlashPass)
  }

  /** Switches the game state and renders the matching UI screen. */
  setState(next: GameState) {
    this.state = next
  
    UIRenderer.getInstance().render(next)
    // Release the pointer lock so the mouse cursor is available for the retry button
    if (next === GameState.GAMEOVER) {
      document.exitPointerLock()
    }
  }


  /** Loads the level and starts the render loop. */
  async start(level: LevelData) {
    await this.loadLevel(level)
    if (this.disposed) return
    this.lastTime = performance.now()
    this.rafId = requestAnimationFrame(this.loop)
  }

  /**
   * Replaces the current level with a new one (also used for retries).
   * Resolves once all textures of the field and player are loaded.
   */
  async loadLevel(level: LevelData) {
    this.disposeWorld()
    this.setupWorld(level)
    this.setupPlayer()
    this.ctx = this.createContext()

    // disposeWorld() removed the debug arrows - rebuild them while debug is on,
    // so the Tab toggle does not get out of step after a retry.
    // The static colliders belong to the level, so ColliderDebug is rebuilt too.
    if (this.debug) {this.createDebugHelpers()}

    // Wait for both ready promises, otherwise grey walls flash up in the first frame.
    await Promise.all([this.player.isReady(), this.field.isReady()])
  }

  private loop = (now: number) => {
    if (this.disposed) return

    let frameTime = (now - this.lastTime) / 1000
    this.lastTime = now

    frameTime = Math.min(frameTime, FRAME_DT_CAP)

    this.calculateFPS(frameTime)

    this.accumulator += frameTime
    while (this.accumulator >= Game.FIXED_DT) {
        this.update(Game.FIXED_DT)          // always the same dt
        this.accumulator -= Game.FIXED_DT
    }

  this.render()
  this.rafId = requestAnimationFrame(this.loop)
}

  private updateHud() {
    const health = Math.max(this.player.getHealth(),0)
    UIRenderer.getInstance().updateHud({
        fps: this.fps,
        health: health,
        enemieCount: this.field.enemies.length,
        debug: this.debug
    })
  }

  private calculateFPS(rawDt: number) {
    this.frameCount++
    this.fpsTimer += rawDt
    if (this.fpsTimer >= 0.3) {              // refresh every 0.3 s
      this.fps = this.frameCount / this.fpsTimer
      this.frameCount = 0
      this.fpsTimer = 0
    }
  }

  /** Advances the simulation by one fixed step. Does nothing unless the game is playing. */
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
    // After the projectiles: new or removed shots would otherwise lag one step behind
    this.colliderDebug?.update(this.field.enemies, this.projectiles)
    this.updateHud()
  }

  /** Renders the scene through the post-processing chain. */
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

  /** Toggles the debug view (collider boxes, facing arrows) and player invincibility. */
  public toggleDebug() {
    
    this.debug = !this.debug
    
    this.player.setInvincible(true);

    if( this.debug) {
      this.createDebugHelpers()
    } else {
      this.disposeDebugHelpers()

      this.player.setInvincible(false);
    }
  }

  private createDebugHelpers(): void {
    this.enemyFacingDebug = new EnemyFacingDebug(this.scene)
    this.colliderDebug = new ColliderDebug(this.scene, this.field.colliders)
  }

  private disposeDebugHelpers(): void {
    this.enemyFacingDebug?.dispose()
    this.enemyFacingDebug = undefined
    this.colliderDebug?.dispose()
    this.colliderDebug = undefined
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

  /**
   * Disposes everything that belongs to ONE level. Runs on every retry - the rAF
   * loop and the Game lifetime objects (composer, input) stay alive.
   */
  private disposeWorld(): void {
    for (const p of this.projectiles) {
      this.scene.remove(p.mesh)
      p.dispose()
    }
    this.projectiles.length = 0

    // The debug maps would otherwise keep references to disposed enemies/projectiles.
    this.disposeDebugHelpers()

    // The level may never have been loaded (dispose from the MENU state)
    this.field?.dispose()
    this.player?.dispose()

    this.ctx = undefined as unknown as UpdateContext
  }

  /** Stops the loop and releases all resources. The renderer is left to its owner. */
  public dispose() {
    if (this.disposed) return
    this.disposed = true

    this.ac.abort()                    // also removes the InputManager listeners
    cancelAnimationFrame(this.rafId)   // stop the loop

    this.disposeWorld()

    this.composer.dispose()
    this.scanlinePass.dispose()
    this.damageFlashPass.dispose()
    // Deliberately NOT this.renderer.dispose() - the renderer belongs to main.ts

    this.scene.clear()                 // lights + camera from the setup
  }
}
