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
│   ├── LevelData.ts     # Level-Format: frei platzierte Objekte in x/y/z (block, stair, player, enemy)
│   ├── levels/          # Levels als LevelData (Level1, Level2, Extrem, Extrem2, Demo3D)
│   ├── Map.ts           # parseLevel: LevelData → Blöcke/Stiegen/Spawns
│   ├── NavGrid.ts       # Ebenen-Nav-Grid: begehbare Flächen pro Zelle und Höhe, Stiegen verbinden Ebenen
│   ├── StairData.ts     # Stiegen (Tile-Bereich + baseY), Höhenverlauf, Seiten-Collider
│   ├── WallTiles.ts     # Registry: Blocktyp → Textur/Farbe
│   ├── testing/         # gridLevel(): ASCII → LevelData, nur für Test-Fixtures
│   └── GameField.ts     # Baut Blöcke, Stiegen, Gegner und das NavGrid der Szene
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
└── tiles/     # BrickWall.png (Block-Textur 'brick', via WallTiles.ts registriert)
```

## Code Conventions

- **Pixel-Rendering:** `magFilter = NearestFilter` auf alle Texturen, `antialias: false`, CSS `image-rendering: pixelated`
- **Texturen laden:** immer über `loadPixelTexture()` (`core/AssetLoader.ts`) – cached, klont pro Instanz. Welt-Geometrie (Wand-Tiles) nutzt `{ mipmaps: true }` gegen Flimmern auf Distanz; Sprites/HUD bleiben ohne Mipmaps.
- **Sprites:** `alphaTest = 0.5` für PNG-Transparenz
- **Sprite-Animation:** UV-Offset (`texture.offset.x`, `texture.repeat.x`) statt Spritesheet-Slicing
- **Level-Format:** `LevelData` (`world/LevelData.ts`) – eine Objektliste in Welt-Koordinaten, y zeigt nach oben. `block` = achsparalleler Quader (`position` = Mittelpunkt, `size` in x/y/z); Böden, Wände, Plattformen und Brücken sind alles Blöcke, es gibt **keinen automatischen Boden**. `stair` liegt mit x/z auf dem Tile-Raster, y = unteres Ende. Spawns: y = Höhe der Füße.
- **Ebenen & Wegfindung:** Jede Block-Oberseite mit `NAV_HEADROOM` Freiraum wird begehbar (`NavGrid`). Knoten gleicher Höhe sind verbunden; **Stiegen sind die einzige Verbindung zwischen Ebenen** (kein Springen/Fallen im A*). Das obere Stiegenende braucht eine Fläche auf genau `topY`.
- **Blocktypen:** `world/WallTiles.ts` mappt `BlockObject.tile` → Textur oder Farbe (`brick`, `floor`). Neuer Blocktyp = ein Registry-Eintrag. Block-UVs werden auf die Blockgröße skaliert, die Textur wiederholt sich pro `TILE_SIZE`.
- **Asset-Lifecycle:** Texturen gehören dem Erzeuger – im `.then()` auf `this.disposed` prüfen und in `dispose()` explizit freigeben (Materials geben ihre `map` nicht mit frei).
- **Gegner-AI:** `idle → chase (dist < 10) → attack (dist < 1.5)`; gleiche AABB-Kollision wie Spieler
- Kein Anti-Aliasing, kein Weichzeichnen – bewusster Retro-Look
- TypeScript Typen immer explizit schreiben!
- **Kommentare:** immer auf **Englisch**. Kommentare an Deklarationen sind **TypeDoc** (`/** ... */`), nicht `//`. Jede exportierte Klasse, jedes Interface und jede wichtige Methode/Funktion bekommt einen TypeDoc-Kommentar: erster Satz = was sie tut, danach bei Bedarf Details sowie `@param` / `@returns` (Format `@param name - Beschreibung`). Einheiten und Koordinatenbezug nennen (z. B. „world units“, „relative to the feet“). Querverweise mit `{@link Name}`. Inline-Kommentare in Funktionskörpern bleiben `//` und erklären das *Warum*, nicht das *Was*.

## Controls

| Taste | Aktion |
|-------|--------|
| W / A / S / D | Bewegen |
| Maus | Umsehen (Pointer Lock) |
| Linksklick | Schießen |
| ESC | Pause / Maus freigeben |
