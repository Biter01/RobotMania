import { GameState } from "../types";

type UIEventName = 'start' | 'retry'


/** Values shown in the HUD. */
export interface HUDElements {
    health: number
    fps: number
    enemieCount: number
    debug: boolean
}

/**
 * Renders the HTML overlays (menu, HUD, game over, loading) on top of the canvas (singleton).
 *
 * Clicks are forwarded to the callbacks registered with {@link on}.
 */
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

    private loadingOverlay: string = `
        <div id="loading-overlay">
            <h1>LOADING</h1>
            <p>[ PREPARING SYSTEMS ]</p>
        </div>` 

    private static instance: null | UIRenderer

    /** Returns the shared instance, creating it on the `#game-ui` element. */
    static getInstance(): UIRenderer {
        if (!UIRenderer.instance) {
            const uiContainer = document.getElementById("game-ui") as HTMLElement
            UIRenderer.instance = new UIRenderer(uiContainer)
        }
        return UIRenderer.instance
    }

    private constructor(uiContainer: HTMLElement) {
        this.uiContainer = uiContainer
        // One single listener that is NEVER lost, no matter how often innerHTML changes
        this.uiContainer.addEventListener('click', this.handleClick)
    }

    /** Registers what should happen on a UI event; called by main.ts. */
    public on(event: UIEventName, cb: () => void): void {
        this.listeners[event] = cb
    }

    // UI event
    private handleClick = (e: MouseEvent): void => {
        const target = e.target as HTMLElement

        if (target.closest('#menu-overlay')) {
            this.listeners.start?.()
        } else if (target.closest('#retry-button')) {
            this.listeners.retry?.()
        }
    }

    /** Shows the screen that belongs to `state`. */
    public render(state: GameState): void {
        if (state === GameState.GAMEOVER) {
            this.renderGameOverScreen()
        } else if (state === GameState.MENU) {
            this.renderMenuScreen()
        } else if (state === GameState.PLAYING) {
            this.renderHud()
        } else if(state == GameState.LOADING) {
            this.renderLoading()
        }
    }

    private renderGameOverScreen(): void {
        this.uiContainer.innerHTML = this.gameOverOverlay
    }

    private renderLoading(): void {
        this.uiContainer.innerHTML = this.loadingOverlay
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

    /** Updates the HUD values. Only valid while the HUD is shown (state PLAYING). */
    public updateHud(hud: HUDElements) {
        this.fpsEl!.textContent = `FPS: ${Math.round(hud.fps)}`
        this.healthEl!.textContent = hud.debug ? `INVINCIBLE`: `Health: ${hud.health}`;
        this.debugEl!.textContent = hud.debug ? `DEBUG: ENEMY FACING ON \n 
                                                ${hud.enemieCount}` : ''

        if(hud.debug) {
            this.debugEl!.innerHTML = `
            <div>DEBUG: ENEMY FACING ON</div>
            <div>Enemy Count: ${hud.enemieCount}</div>
            `
        } else {
            this.debugEl!.innerHTML = ''
        }
    }
}

