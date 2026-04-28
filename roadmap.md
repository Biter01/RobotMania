# Pixel Art Shooter – Implementierungs-Roadmap

> Detaillierter Schritt-für-Schritt-Plan für einen Doom-inspirierten Pixelart-Shooter mit Three.js.
> Jede Aufgabe ist eigenständig umsetzbar und baut auf der vorherigen auf.

---

## Status-Legende
- `[ ]` Offen
- `[~]` In Arbeit
- `[x]` Fertig
- `[!]` Blocker / Problem

---

## Sprint 0 – Projekt-Setup
**Ziel:** Lauffähige Entwicklungsumgebung, Three.js-Szene im Pixelart-Modus.

| # | Aufgabe | Datei(en) | Abhängigkeit |
|---|---------|-----------|--------------|
| 0.1 | `npm create vite` mit `vanilla-ts` Template | – | – |
| 0.2 | `npm install three @types/three` | `package.json` | 0.1 |
| 0.3 | `index.html` – Canvas-Element + HUD-Overlay-Div anlegen | `index.html` | 0.1 |
| 0.4 | `main.ts` – Scene, PerspectiveCamera, WebGLRenderer initialisieren | `src/main.ts` | 0.2 |
| 0.5 | **Pixelart-Renderer:** `pixelRatio = 1`, interne Auflösung 320×200 | `src/main.ts` | 0.4 |
| 0.6 | **CSS:** Canvas auf `100vw/100vh` + `image-rendering: pixelated` | `src/main.ts`, `style.css` | 0.5 |
| 0.7 | Resize-Listener (internes Seitenverhältnis beibehalten) | `src/main.ts` | 0.5 |
| 0.8 | Leere `Game`-Klasse mit `init()`, `update(dt)`, `render()` | `src/core/Game.ts` | 0.4 |
| 0.9 | Game-Loop via `requestAnimationFrame` + Delta-Time | `src/main.ts` | 0.8 |

**Abnahme:** Browser zeigt pixeligen Canvas ohne Blur, kein Konsolenfehler.

---

## Sprint 1 – Spieler & Kamera
**Ziel:** Spieler bewegt sich flüssig, Mauslook funktioniert.

| # | Aufgabe | Datei(en) | Abhängigkeit |
|---|---------|-----------|--------------|
| 1.1 | `InputManager` – `keydown`/`keyup` für `W/A/S/D`, `ESC`, `LMB` | `src/core/InputManager.ts` | 0.8 |
| 1.2 | Pointer Lock API – Klick auf Canvas sperrt Maus | `src/core/InputManager.ts` | 1.1 |
| 1.3 | `mousemove`-Delta auslesen (yaw, pitch) | `src/core/InputManager.ts` | 1.2 |
| 1.4 | `Player`-Klasse – Position, Geschwindigkeit, HP (100) | `src/entities/Player.ts` | 0.8 |
| 1.5 | Kamera an Spieler-Position binden (Augenhöhe y = 0.5) | `src/entities/Player.ts` | 1.4 |
| 1.6 | Kamera-Rotation via Maus (yaw = Y-Achse, pitch ±80° begrenzt) | `src/entities/Player.ts` | 1.3, 1.5 |
| 1.7 | WASD-Bewegung relativ zur Blickrichtung | `src/entities/Player.ts` | 1.1, 1.6 |
| 1.8 | Bewegung mit Delta-Time skalieren | `src/entities/Player.ts` | 1.7 |

**Abnahme:** Spieler läuft flüssig, kein Pitch-Überschlag, Mauslook funktioniert.

---

## Sprint 2 – Level (Pixelart-Texturen)
**Ziel:** Map wird als 3D-Welt mit Pixelart-Texturen gerendert.

| # | Aufgabe | Datei(en) | Abhängigkeit |
|---|---------|-----------|--------------|
| 2.1 | `MapData.ts` – Level 1 als `number[][]` (min. 16×16) | `src/world/MapData.ts` | – |
| 2.2 | **Pixelart-Texturen zeichnen:** `wall_stone.png`, `wall_brick.png` (64×64 px) | `public/sprites/tiles/` | – |
| 2.3 | **Pixelart-Texturen zeichnen:** `floor.png`, `ceiling.png` (64×64 px) | `public/sprites/tiles/` | – |
| 2.4 | `AssetLoader` – Texturen laden, **`NearestFilter`** für alle setzen | `src/core/AssetLoader.ts` | 2.2, 2.3 |
| 2.5 | `Map`-Klasse – Grid iterieren, `BoxGeometry` pro Wand-Tile | `src/world/Map.ts` | 2.1 |
| 2.6 | Pixelart-Wand-Textur auf alle Wände anwenden | `src/world/Map.ts` | 2.4, 2.5 |
| 2.7 | Boden als `PlaneGeometry` + Pixelart-Textur | `src/world/Map.ts` | 2.4, 2.5 |
| 2.8 | Decke als invertierte `PlaneGeometry` + Pixelart-Textur | `src/world/Map.ts` | 2.7 |
| 2.9 | Spieler-Spawn (Tile `2`) aus Map lesen | `src/world/Map.ts` | 2.1 |
| 2.10 | Ambient + DirectionalLight (gedimmt, Retro-Feeling) | `src/core/Game.ts` | 2.5 |

**Abnahme:** Level pixelig gerendert, Texturen knackig scharf (kein Blur).

---

## Sprint 3 – Kollisionserkennung
**Ziel:** Spieler kann nicht durch Wände laufen, gleitet daran entlang.

| # | Aufgabe | Datei(en) | Abhängigkeit |
|---|---------|-----------|--------------|
| 3.1 | `isSolid(x, z, map)` – prüft Tile-Koordinate auf Wand | `src/utils/MathUtils.ts` | 2.1 |
| 3.2 | AABB-Kollision: neue Spieler-Position berechnen | `src/entities/Player.ts` | 3.1 |
| 3.3 | X- und Z-Achse **getrennt** testen (Sliding an Wänden) | `src/entities/Player.ts` | 3.2 |
| 3.4 | Spieler-Radius als Konstante (`0.3`) | `src/entities/Player.ts` | 3.3 |
| 3.5 | Alle 4 Ecken des Spieler-AABB prüfen | `src/entities/Player.ts` | 3.4 |

**Abnahme:** Spieler gleitet an Wänden, kann nicht hindurchlaufen.

---

## Sprint 4 – Sprite-System (Kern der Pixelart)
**Ziel:** Billboard-Sprites rendern korrekt als Pixelart in der 3D-Welt.

| # | Aufgabe | Datei(en) | Abhängigkeit |
|---|---------|-----------|--------------|
| 4.1 | `BillboardSprite`-Klasse – `PlaneGeometry` dreht sich immer zur Kamera | `src/sprites/BillboardSprite.ts` | 0.8 |
| 4.2 | `alphaTest = 0.5` auf Material (PNG-Transparenz) | `src/sprites/BillboardSprite.ts` | 4.1 |
| 4.3 | **`NearestFilter`** für alle Sprite-Texturen erzwingen | `src/sprites/BillboardSprite.ts` | 4.1 |
| 4.4 | `AnimatedSprite` extends `BillboardSprite` – Sprite-Sheet-Logik | `src/sprites/AnimatedSprite.ts` | 4.1 |
| 4.5 | Frame-Timer: `texture.offset.x` + `texture.repeat.x` per Frame setzen | `src/sprites/AnimatedSprite.ts` | 4.4 |
| 4.6 | `setAnimation(name)` – zwischen Sprite-Sheets wechseln (idle/walk/attack/dead) | `src/sprites/AnimatedSprite.ts` | 4.5 |
| 4.7 | Test-Sprite in Level platzieren und Animation prüfen | `src/core/Game.ts` | 4.6 |

**Abnahme:** Sprite dreht sich zur Kamera, Animation läuft, Pixel sind scharf.

---

## Sprint 5 – Pixelart-Gegner
**Ziel:** Animierte Pixel-Gegner spawnen, verfolgen und greifen an.

| # | Aufgabe | Datei(en) | Abhängigkeit |
|---|---------|-----------|--------------|
| 5.1 | **Sprites zeichnen:** `demon_idle.png`, `demon_walk.png` (32×32, Sprite-Sheet) | `public/sprites/enemies/` | – |
| 5.2 | **Sprites zeichnen:** `demon_attack.png`, `demon_dead.png` (32×32) | `public/sprites/enemies/` | – |
| 5.3 | `Enemy`-Klasse: Position, HP, Zustand (`idle/chase/attack/dead`) | `src/entities/Enemy.ts` | 4.6 |
| 5.4 | `AnimatedSprite` in `Enemy` einbinden, Texturen laden | `src/entities/Enemy.ts` | 5.1, 5.2, 5.3 |
| 5.5 | Gegner-Spawn-Positionen aus Map lesen (Tile `3`) | `src/world/Map.ts`, `src/core/Game.ts` | 2.1 |
| 5.6 | AI: Distanz messen → `idle` wenn > 10, `chase` wenn < 10 | `src/entities/Enemy.ts` | 5.3 |
| 5.7 | Chase: Richtung zum Spieler berechnen, bewegen + Walk-Animation | `src/entities/Enemy.ts` | 5.6, 4.6 |
| 5.8 | Gegner-Wandkollision (`isSolid`) | `src/entities/Enemy.ts` | 3.1, 5.7 |
| 5.9 | `attack`-State wenn Distanz < 1.5: alle 1.5s Spieler-Schaden (10 HP) | `src/entities/Enemy.ts` | 5.6 |
| 5.10 | `takeDamage(amount)` → Hurt-Flash (kurzes Aufhellen) → bei 0 HP: `dead` | `src/entities/Enemy.ts` | 5.3 |
| 5.11 | Dead-Animation abspielen → Mesh nach 3s entfernen | `src/entities/Enemy.ts` | 5.10 |

**Abnahme:** Pixelart-Gegner laufen animiert auf Spieler zu, sterben mit Animation.

---

## Sprint 6 – Waffe (Pixelart-HUD-Sprite)
**Ziel:** Pixelart-Pistole im HUD, Schießen tötet Gegner.

| # | Aufgabe | Datei(en) | Abhängigkeit |
|---|---------|-----------|--------------|
| 6.1 | **Sprites zeichnen:** `pistol_idle.png`, `pistol_fire.png` (64×64 px) | `public/sprites/weapons/` | – |
| 6.2 | `Weapon`-Basis-Klasse: `damage`, `firerate`, `ammo`, `fire()` | `src/weapons/Weapon.ts` | – |
| 6.3 | `Pistol` extends `Weapon`: 25 Schaden, 0.5s Cooldown, 50 Ammo | `src/weapons/Pistol.ts` | 6.2 |
| 6.4 | Pistolen-Sprite als `<img>` im HUD unten-mitte (CSS `image-rendering: pixelated`) | `src/ui/HUD.ts` | 6.1 |
| 6.5 | Schuss-Frame: `pistol_fire.png` für 80ms → zurück zu `pistol_idle.png` | `src/ui/HUD.ts` | 6.4 |
| 6.6 | Bob-Effekt: Sprite schwingt beim Laufen (CSS `translateY`) | `src/ui/HUD.ts` | 6.4 |
| 6.7 | Mündungsfeuer: weißes Overlay-Div, kurzer opacity-Flash | `src/ui/HUD.ts` | 6.5 |
| 6.8 | `THREE.Raycaster` von Kamera in Blickrichtung beim Schuss | `src/weapons/Pistol.ts` | Sprint 5 |
| 6.9 | Raycaster trifft Gegner-Mesh → `enemy.takeDamage(25)` | `src/weapons/Pistol.ts` | 6.8 |
| 6.10 | Ammo bei Schuss reduzieren, bei 0 kein Schuss | `src/weapons/Pistol.ts` | 6.3 |

**Abnahme:** Pixelart-Waffe sichtbar, Schuss-Animation, Gegner sterben durch Treffer.

---

## Sprint 7 – Pixelart-HUD & Game-States
**Ziel:** Vollständiges Pixelart-HUD + kompletter Spielablauf.

| # | Aufgabe | Datei(en) | Abhängigkeit |
|---|---------|-----------|--------------|
| 7.1 | **Sprites zeichnen:** `face_normal.png`, `face_hurt.png`, `face_dead.png` (24×24) | `public/sprites/hud/` | – |
| 7.2 | HP-Balken aus einzelnen Pixel-Blöcken (CSS, kein Gradient) | `src/ui/HUD.ts` | Sprint 1 |
| 7.3 | Doom-Face-Sprite: wechselt bei Schaden zu `face_hurt`, bei Tod zu `face_dead` | `src/ui/HUD.ts` | 7.1 |
| 7.4 | Ammo-Zahl in Pixelart-Font (Google Fonts: `Press Start 2P`) | `src/ui/HUD.ts` | – |
| 7.5 | Crosshair als Pixelart-Kreuz (4 Pixel, CSS oder Canvas) | `src/ui/HUD.ts` | – |
| 7.6 | Schaden-Indikator: Screen flasht rot wenn Spieler getroffen | `src/ui/HUD.ts` | Sprint 5 |
| 7.7 | `GameState`-Enum: `MENU / PLAYING / GAMEOVER / WIN` | `src/core/Game.ts` | – |
| 7.8 | Start-Screen: Pixelart-Titel + "Klicken zum Starten" | `src/ui/MenuScreen.ts` | 7.7 |
| 7.9 | Game-Over-Screen: bei HP ≤ 0 → Overlay + "Neu starten" | `src/ui/MenuScreen.ts` | 7.7 |
| 7.10 | Gewonnen-Screen: alle Gegner tot → Overlay | `src/ui/MenuScreen.ts` | 7.7 |
| 7.11 | Neustart: Szene vollständig zurücksetzen | `src/core/Game.ts` | 7.9 |

**Abnahme:** Vollständiger Spielablauf Menü → Spiel → Tod/Sieg → Neustart.

---

## Sprint 8 – Audio (Chiptune-Stil)
**Ziel:** 8-Bit-Sound-Effekte und Chiptune-Musik.

| # | Aufgabe | Datei(en) | Abhängigkeit |
|---|---------|-----------|--------------|
| 8.1 | `AudioManager`-Klasse mit Web Audio API | `src/core/AudioManager.ts` | – |
| 8.2 | Sound-Dateien beschaffen (`.ogg`): Schuss, Treffer, Tod, Schritte (Chiptune) | `public/audio/` | – |
| 8.3 | Chiptune-Hintergrundmusik als Loop | `src/core/AudioManager.ts` | 8.1 |
| 8.4 | AudioContext erst nach erstem User-Klick erstellen (Browser-Policy) | `src/core/AudioManager.ts` | 8.1 |
| 8.5 | Schuss-Sound bei `fire()` | `src/weapons/Pistol.ts` | 8.1 |
| 8.6 | Treffer-Sound bei `takeDamage()` | `src/entities/Enemy.ts` | 8.1 |
| 8.7 | Tod-Sound bei Gegner-Tod | `src/entities/Enemy.ts` | 8.1 |
| 8.8 | Schritt-Sound alle 0.4s während Bewegung | `src/entities/Player.ts` | 8.1 |

**Abnahme:** Alle Sounds spielen im Chiptune-Stil, Musik läuft als Loop.

---

## Sprint 9 – Polish & Extras
**Ziel:** Spielerlebnis verfeinern, optionale Features.

| # | Aufgabe | Datei(en) | Abhängigkeit |
|---|---------|-----------|--------------|
| 9.1 | **Sprites zeichnen:** `medpack.png`, `ammo.png` (16×16 px) | `public/sprites/pickups/` | – |
| 9.2 | `Pickup`-Klasse als `BillboardSprite` | `src/entities/Pickup.ts` | 4.1 |
| 9.3 | Pickup-Kollision: Spieler läuft drüber → aufheben + Effekt | `src/entities/Pickup.ts` | 3.1 |
| 9.4 | Medpack: +25 HP (max 100) | `src/entities/Pickup.ts` | 9.3 |
| 9.5 | Ammo-Pack: +20 Munition | `src/entities/Pickup.ts` | 9.3 |
| 9.6 | `MapData.ts` – Level 2 mit neuem Layout + mehr Gegnern | `src/world/MapData.ts` | Sprint 1–7 |
| 9.7 | Level-Übergang: Tile `4` = Exit → nächstes Level laden | `src/core/Game.ts` | 9.6 |
| 9.8 | Pixelart-Minimap: kleines Canvas oben rechts (Tiles + Spieler-Dot) | `src/ui/HUD.ts` | Sprint 2 |
| 9.9 | `THREE.FogExp2` für Tiefenwirkung (dunkler Retro-Nebel) | `src/core/Game.ts` | Sprint 2 |
| 9.10 | FPS-Anzeige in Pixelart-Font oben links | `src/ui/HUD.ts` | – |

---

## Sprite-Checkliste (alle zu zeichnenden Assets)

| Asset | Größe | Frames | Priorität |
|-------|-------|--------|-----------|
| `demon_idle.png` | 32×32 | 4 | Hoch |
| `demon_walk.png` | 32×32 | 6 | Hoch |
| `demon_attack.png` | 32×32 | 3 | Hoch |
| `demon_dead.png` | 32×32 | 4 | Hoch |
| `pistol_idle.png` | 64×64 | 1 | Hoch |
| `pistol_fire.png` | 64×64 | 1 | Hoch |
| `face_normal.png` | 24×24 | 1 | Mittel |
| `face_hurt.png` | 24×24 | 1 | Mittel |
| `face_dead.png` | 24×24 | 1 | Mittel |
| `wall_stone.png` | 64×64 | 1 | Hoch |
| `wall_brick.png` | 64×64 | 1 | Mittel |
| `floor.png` | 64×64 | 1 | Hoch |
| `ceiling.png` | 64×64 | 1 | Hoch |
| `medpack.png` | 16×16 | 1 | Niedrig |
| `ammo.png` | 16×16 | 1 | Niedrig |

---

## Abhängigkeits-Übersicht

```
Sprint 0 (Setup + Pixelart-Renderer)
    └── Sprint 1 (Spieler)
            └── Sprint 2 (Level + Pixelart-Texturen)
                    └── Sprint 3 (Kollision)
                            └── Sprint 4 (Sprite-System ← KERN)
                                    ├── Sprint 5 (Pixelart-Gegner)
                                    └── Sprint 6 (Waffe + Raycasting)
                                            └── Sprint 7 (HUD + GameStates)
                                                    └── Sprint 8 (Audio)
                                                            └── Sprint 9 (Polish)
```

---

## Datei-Erstellungsreihenfolge

```
1.  index.html + style.css
2.  src/main.ts
3.  src/core/Game.ts
4.  src/core/InputManager.ts
5.  src/core/AssetLoader.ts
6.  src/utils/MathUtils.ts
7.  src/world/MapData.ts
8.  src/world/Map.ts
9.  src/entities/Player.ts
10. src/sprites/BillboardSprite.ts
11. src/sprites/AnimatedSprite.ts
12. src/weapons/Weapon.ts
13. src/weapons/Pistol.ts
14. src/entities/Enemy.ts
15. src/entities/Pickup.ts
16. src/ui/HUD.ts
17. src/ui/MenuScreen.ts
18. src/core/AudioManager.ts
```

---

## Risiken & Lösungen

| Risiko | Lösung |
|--------|--------|
| Sprites erscheinen unscharf | `NearestFilter` + `image-rendering: pixelated` auf Canvas |
| Pointer Lock nur nach User-Interaktion | Click-Event als Auslöser |
| AudioContext blockiert ohne Interaktion | AudioContext erst nach erstem Klick erstellen |
| Sprite-Sheet UV-Offset falsch | Frame-Breite = `1 / frameCount`, Offset = `frame / frameCount` |
| Billboard-Sprite flackert bei Rotation | `lookAt` nur auf Y-Achse beschränken |
| Viele Wand-Meshes → Performance | `InstancedMesh` in Sprint 9 als Optimierung |

---

## Zeitschätzung

| Sprint | Aufwand |
|--------|---------|
| Sprint 0 | ~1h |
| Sprint 1 | ~2h |
| Sprint 2 | ~2h + Sprite-Zeichnen |
| Sprint 3 | ~1h |
| Sprint 4 | ~2h |
| Sprint 5 | ~3h + Sprite-Zeichnen |
| Sprint 6 | ~2h + Sprite-Zeichnen |
| Sprint 7 | ~2h |
| Sprint 8 | ~1h |
| Sprint 9 | ~3h + Sprite-Zeichnen |
| **Gesamt** | **~19h + Asset-Produktion** |
