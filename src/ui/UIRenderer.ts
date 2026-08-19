import { GameState } from "../types";

type UIEventName = 'start' | 'retry'


export interface HUDElements {
    health: number
    fps: number
    debug: boolean
}

export class UIRenderer {

    private uiContainer: HTMLElement
    private fpsEl: HTMLElement | null = null
    private healthEl: HTMLElement | null = null
    private debugEl: HTMLElement | null = null;

    private listeners: Partial<Record<UIEventName, () => void>> = {}

    private menuScreen: string = `
        <div id="menu-overlay">
            <h1>ROBOT MANIA</h1>
            <p>[ CLICK TO START ]</p>
        </div>
    `
    private gameOverOverlay: string = `
        <div id="gameover-overlay">
            <h1>GAME OVER</h1>
            <button id="retry-button">
                <span class="retry-icon">&#8635;</span>
                <span class="retry-label">[ RETRY ]</span>
            </button>
        </div>
    `
    private hud: string = `
        <div id="hud">
            <span id="fps"></span>
            <span id="debug"></span>
            <span id="health"></span>
        </div>
    `

    private static instance: null | UIRenderer

    static getInstance(): UIRenderer {
        if (!UIRenderer.instance) {
            const uiContainer = document.getElementById("game-ui") as HTMLElement
            UIRenderer.instance = new UIRenderer(uiContainer)
        }
        return UIRenderer.instance
    }

    private constructor(uiContainer: HTMLElement) {
        this.uiContainer = uiContainer
        // Ein einziger Listener, der NIE verloren geht, egal wie oft innerHTML wechselt
        this.uiContainer.addEventListener('click', this.handleClick)
    }

    // Registrierung: Game (bzw. main.ts) sagt UIRenderer, WAS bei welchem Klick passieren soll
    public on(event: UIEventName, cb: () => void): void {
        this.listeners[event] = cb
    }

    //UI Event
    private handleClick = (e: MouseEvent): void => {
        const target = e.target as HTMLElement

        if (target.closest('#menu-overlay')) {
            this.listeners.start?.()
        } else if (target.closest('#retry-button')) {
            this.listeners.retry?.()
        }
    }

    public render(state: GameState): void {
        if (state === GameState.GAMEOVER) {
            this.renderGameOverScreen()
        } else if (state === GameState.MENU) {
            this.renderMenuScreen()
        } else if (state === GameState.PLAYING) {
            this.renderHud()
        }
    }

    private renderGameOverScreen(): void {
        this.uiContainer.innerHTML = this.gameOverOverlay
    }

   


    private renderMenuScreen(): void {
        this.uiContainer.innerHTML = this.menuScreen
    }

    private renderHud(): void {
        this.uiContainer.innerHTML = this.hud
        this.fpsEl = document.getElementById('fps') as HTMLElement
        this.healthEl = document.getElementById('health') as HTMLElement
        this.debugEl =  document.getElementById('debug') as HTMLElement
    }

    public updateHud(hud: HUDElements) {
        this.fpsEl!.textContent = `FPS: ${Math.round(hud.fps)}`
        this.healthEl!.textContent = hud.debug ? `INVINCIBLE`: `Health: ${hud.health}`;
        this.debugEl!.textContent = hud.debug ? 'DEBUG: ENEMY FACING ON' : ''
    }
}

