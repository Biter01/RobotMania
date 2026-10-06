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

export const FRAME_DT_CAP = 0.05


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
  
  //Avoid memory leaks
  private rafId = 0;
  private disposed = false
  private ac = new AbortController()

  private accumulator = 0
  private static readonly FIXED_DT = 1 / 60 


  private frameCount = 0
  private fpsTimer = 0

  constructor(canvas: HTMLCanvasElement, renderer: THREE.WebGLRenderer) {
    this.renderer = renderer
    this.state = GameState.MENU

    // Muss vor dem ersten setupWorld() stehen: die Wand-Tiles lesen den Wert
    // beim Laden ihrer Textur.
    setMaxAnisotropy(this.renderer.capabilities.getMaxAnisotropy())

    this.setupScene()
    this.setupCamera()
    this.setupLights()
    this.setupPostProcessing()   // existiert schon
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

  /*
    This class RenderPass represents a render pass. 
    It takes a camera and a scene and produces a beauty pass for subsequent post processing effects.
  */
  private setupPostProcessing() {
    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))

    this.scanlinePass = new ShaderPass(ScanlineShader)
    this.scanlinePass.uniforms.resolution.value = window.innerHeight * window.devicePixelRatio
    this.composer.addPass(this.scanlinePass)


    //New Damage Flash Shader!! Builds upon scanline Shader
    this.damageFlashPass = new ShaderPass(DamageFlashShader)
    this.composer.addPass(this.damageFlashPass)
  }

  setState(next: GameState) {
    this.state = next
  
    UIRenderer.getInstance().render(next)
    // Release the pointer lock so the mouse cursor is available for the retry button
    if (next === GameState.GAMEOVER) {
      document.exitPointerLock()
    }
  }


  async start(level: LevelData) {
    await this.loadLevel(level)
    if (this.disposed) return
    this.lastTime = performance.now()
    this.rafId = requestAnimationFrame(this.loop)
  }

  async loadLevel(level: LevelData) {
    this.disposeWorld()
    this.setupWorld(level)
    this.setupPlayer()
    this.ctx = this.createContext()

    // disposeWorld() hat die Debug-Pfeile mitgenommen - bei aktivem Debug neu
    // aufbauen, damit der Tab-Toggle nach einem Retry nicht aus dem Tritt geraet.
    // Die statischen Collider haengen am Level - deshalb auch ColliderDebug neu bauen.
    if (this.debug) {this.createDebugHelpers()}

    // Beide Ready-Promises: sonst blitzen im ersten Frame graue Waende auf.
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
        this.update(Game.FIXED_DT)          // <- immer derselbe dt
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
    if (this.fpsTimer >= 0.3) {              // alle 0,3 s aktualisieren
      this.fps = this.frameCount / this.fpsTimer
      this.frameCount = 0
      this.fpsTimer = 0
    }
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
    // Nach den Projektilen: neue/geloeschte Geschosse sind sonst einen Step verspaetet
    this.colliderDebug?.update(this.field.enemies, this.projectiles)
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

  // Alles, was zu EINEM Level gehoert. Laeuft bei jedem Retry - der rAF-Loop
  // und die Game-Lifetime-Objekte (Composer, Input) bleiben dabei bestehen.
  private disposeWorld(): void {
    for (const p of this.projectiles) {
      this.scene.remove(p.mesh)
      p.dispose()
    }
    this.projectiles.length = 0

    // Die Debug-Maps halten sonst Referenzen auf disposte Enemies/Projektile.
    this.disposeDebugHelpers()

    // init() lief evtl. nie (dispose aus dem MENU-State)
    this.field?.dispose()
    this.player?.dispose()

    this.ctx = undefined as unknown as UpdateContext
  }

  public dispose() {
    if (this.disposed) return
    this.disposed = true

    this.ac.abort()                    // raeumt auch die InputManager-Listener ab
    cancelAnimationFrame(this.rafId)   // ← Loop stoppen

    this.disposeWorld()

    this.composer.dispose()
    this.scanlinePass.dispose()
    this.damageFlashPass.dispose()
    // this.renderer.dispose() bewusst NICHT - der Renderer gehoert main.ts

    this.scene.clear()                 // Lights + Kamera aus dem Setup
  }
}
