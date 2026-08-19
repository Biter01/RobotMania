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
  private damageFlashPass!: ShaderPass

  private player!: Player
  private field!: GameField
  private enemyFacingDebug?: EnemyFacingDebug
  private projectiles: Projectile[] = []
  private lastTime = 0
  private fps = 0
  private debug = false
  private ctx!: UpdateContext
  
  //Avoid memory leaks
  private rafId = 0;
  private disposed = false
  private ac = new AbortController()


  constructor(canvas: HTMLCanvasElement, renderer: THREE.WebGLRenderer) {
    const { signal } = this.ac

    this.scene = new THREE.Scene()

    this.scene.background = new THREE.Color(COLOR_SKY)

    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV, window.innerWidth / window.innerHeight, CAMERA_NEAR, CAMERA_FAR)

    // Der Renderer wird ausserhalb erzeugt und ueberlebt den Retry - ein
    // zweiter WebGLRenderer auf demselben Canvas wuerde einen weiteren
    // WebGL-Context belegen, den dispose() nicht freigibt.
    this.renderer = renderer

    this.state = GameState.MENU

    this.setupPostProcessing()

    this.input = new InputManager(canvas, () => this.state, signal, () => this.toggleDebug())

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(window.innerWidth, window.innerHeight)
      this.composer.setSize(window.innerWidth, window.innerHeight)
      // Update resolution so that Scanline-density uniform is correct for new window size
      this.scanlinePass.uniforms.resolution.value = window.innerHeight * window.devicePixelRatio
    }, {signal})
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

  init() {
    this.scene.add(new THREE.AmbientLight(0xffffff, AMBIENT_INTENSITY))
    const dir = new THREE.DirectionalLight(0xffffff, DIR_LIGHT_INTENSITY)
    dir.position.set(5, 10, 5)
    this.scene.add(dir)
    this.scene.add(this.camera)

    this.field = GameField.getInstance()
    this.field.render(this.scene)

    this.player = new Player(this.camera, this.field.playerSpawn.x, this.field.playerSpawn.z)
    this.player.setDamageShader(this.damageFlashPass)
    
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

  async  start() {
    this.init()
    this.lastTime = performance.now()

    await this.player.isReady();
    //Because it is async it can be that dipsose has already run!! 
    if (this.disposed) { return }

    this.rafId = requestAnimationFrame(this.loop)
  }

  private loop = (now: number) => {
    if (this.disposed) return

    const rawDt = (now - this.lastTime) / 1000
    const dt = Math.min(rawDt, FRAME_DT_CAP)
    this.lastTime = now

    this.calculateFPS(rawDt)
    this.update(dt)
    this.render()
    this.rafId = requestAnimationFrame(this.loop)
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
    if (this.disposed) return
    this.disposed = true

    this.ac.abort()                    // raeumt auch die InputManager-Listener ab
    cancelAnimationFrame(this.rafId)   // ← Loop stoppen

    this.enemyFacingDebug?.dispose()
    this.enemyFacingDebug = undefined

    for (const p of this.projectiles) {
      this.scene.remove(p.mesh)
      p.dispose()
    }
    this.projectiles.length = 0

    // init() lief evtl. nie (dispose aus dem MENU-State)
    this.field?.dispose()
    this.player?.dispose()

    this.composer.dispose()
    this.scanlinePass.dispose()
    this.damageFlashPass.dispose()
    // this.renderer.dispose() bewusst NICHT - der Renderer gehoert main.ts

    this.scene.clear()                 // Lights + Field-Meshes aus init()
    this.ctx = undefined as unknown as UpdateContext
  }
}

