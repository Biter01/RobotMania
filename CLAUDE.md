# Pixel Art Shooter – Three.js

Ein Doom-inspirierter 3D-Shooter im Browser mit Three.js. Alle Sprites (Gegner, Items, Waffe, HUD) sind handgezeichnete 2D-Pixelart. Die 3D-Welt dient als Bühne – der Look ist bewusst retro und pixelig.

## Commands

```bash
npm run dev       # Dev-Server starten (Vite, HMR)
npm run build     # TypeScript-Check + Produktions-Build (dist/)
npm run preview   # Produktions-Build lokal vorschauen
```

## Tech Stack

| Was | Womit |
|-----|-------|
| Rendering | Three.js (WebGL) |
| Sprites | 2D Pixelart PNG mit Transparenz (`AlphaTest`) |
| Build | Vite |
| Sprache | TypeScript |

## Architecture

```
src/
├── main.ts              # Einstiegspunkt, Game-Loop
├── GameConstants.ts     # Globale Spielkonstanten
├── core/
│   ├── Game.ts          # Haupt-Game-Klasse (init, update, render)
│   ├── InputManager.ts  # Tastatur + Maus Input
│   └── AssetLoader.ts   # Texturen & Sprite-Sheets laden
├── world/
│   ├── Map.ts           # parseMap: ASCII-Level → Wände/Spawns/Walkables
│   ├── MapData.ts       # Level-Daten als string[] (LEVEL_1, LEVEL_2, EXTREM, EXTREM2)
│   ├── WallTiles.ts     # Registry: Map-Zeichen → Wand-Textur
│   └── GameField.ts     # Baut Boden-, Wand- und Gegner-Objekte der Szene
├── entities/
│   ├── Player.ts        # Bewegung, Kamera, Gesundheit
│   ├── Enemy.ts         # AI, Sprite-Animation
│   ├── Entity.ts        # Gemeinsame Basis
│   ├── Projectile.ts    # Geschosse
│   └── enemyAI/         # EnemyAI, A*-Pathfinding, Facing-Debug
├── states/              # StateMachine + Enemy-Animations-States
├── shaders/             # ScanlineShader, DamageFlashShader (Post-Processing)
├── weapons/
│   ├── Weapon.ts        # Basis-Klasse
│   └── Pistol.ts        # Pistole (Pixelart-Sprite im HUD)
├── ui/
│   └── UIRenderer.ts    # HUD + Menü-/Game-Over-Screens
└── utils/
    └── MathUtils.ts     # Hilfsfunktionen
```

Assets:
```
public/sprites/
├── enemies/   # RoboOrginalNew.png (Spritesheet horizontal, 102 Frames × 128px)
├── weapons/   # waffe2.png
└── tiles/     # BrickWall.png (Wand-Textur, via WallTiles.ts registriert)
```

## Code Conventions

- **Pixel-Rendering:** `magFilter = NearestFilter` auf alle Texturen, `antialias: false`, CSS `image-rendering: pixelated`
- **Texturen laden:** immer über `loadPixelTexture()` (`core/AssetLoader.ts`) – cached, klont pro Instanz. Welt-Geometrie (Wand-Tiles) nutzt `{ mipmaps: true }` gegen Flimmern auf Distanz; Sprites/HUD bleiben ohne Mipmaps.
- **Sprites:** `alphaTest = 0.5` für PNG-Transparenz
- **Sprite-Animation:** UV-Offset (`texture.offset.x`, `texture.repeat.x`) statt Spritesheet-Slicing
- **Level-Format:** `string[]`, eine Zeile pro Grid-Reihe – `.` = Boden, `P` = Spieler-Spawn, `E` = Gegner-Spawn, `#` = Wand
- **Wand-Tiles:** Wände werden **nicht** auf `#` hartkodiert. `world/WallTiles.ts` mappt Map-Zeichen → Textur; jedes registrierte Zeichen wird automatisch solide, nicht begehbar und bekommt ein eigenes gemergtes Mesh. Neuer Wandtyp = ein Registry-Eintrag, kein weiterer Code.
- **Asset-Lifecycle:** Texturen gehören dem Erzeuger – im `.then()` auf `this.disposed` prüfen und in `dispose()` explizit freigeben (Materials geben ihre `map` nicht mit frei).
- **Gegner-AI:** `idle → chase (dist < 10) → attack (dist < 1.5)`; gleiche AABB-Kollision wie Spieler
- Kein Anti-Aliasing, kein Weichzeichnen – bewusster Retro-Look
- TypeScript Typen immer explizit schreiben!

## Controls

| Taste | Aktion |
|-------|--------|
| W / A / S / D | Bewegen |
| Maus | Umsehen (Pointer Lock) |
| Linksklick | Schießen |
| ESC | Pause / Maus freigeben |
