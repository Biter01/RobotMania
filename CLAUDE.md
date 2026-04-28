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
│   ├── Map.ts           # Level-Grid → 3D-Geometrie
│   ├── MapData.ts       # Level-Daten als 2D-Array
│   └── SkyBox.ts        # Pixelart-Himmel / Decke
├── entities/
│   ├── Player.ts        # Bewegung, Kamera, Gesundheit
│   ├── Enemy.ts         # AI, Billboard-Sprite, Animation
│   └── Pickup.ts        # Items als Billboard-Sprite
├── sprites/
│   ├── BillboardSprite.ts  # PlaneGeometry immer zur Kamera ausgerichtet
│   └── AnimatedSprite.ts   # Sprite-Sheet-Animation (UV-Offset, Frame-Timer)
├── weapons/
│   ├── Weapon.ts        # Basis-Klasse
│   └── Pistol.ts        # Pistole (Pixelart-Sprite im HUD)
├── ui/
│   ├── HUD.ts           # HP-Bar, Ammo, Face-Sprite
│   └── MenuScreen.ts    # Start- und Game-Over-Screen
└── utils/
    ├── Raycaster.ts     # Kollisionserkennung
    └── MathUtils.ts     # Hilfsfunktionen
```

Assets:
```
public/sprites/
├── enemies/   # demon_idle/walk/attack/dead.png (32×32, Spritesheet horizontal)
├── weapons/   # pistol_idle/fire.png (64×64)
├── pickups/   # medpack/ammo.png (16×16)
├── hud/       # face_normal/hurt/dead.png (24×24)
└── tiles/     # wall_stone/brick, floor, ceiling (64×64)
```

## Code Conventions

- **Pixel-Rendering:** `NearestFilter` auf alle Texturen, `antialias: false`, `pixelRatio = 1`, interne Auflösung 320×200 + CSS `image-rendering: pixelated`
- **Sprites:** `alphaTest = 0.5` für PNG-Transparenz; Billboard-Sprites via `lookAt(camera.position)`
- **Sprite-Animation:** UV-Offset (`texture.offset.x`, `texture.repeat.x`) statt Spritesheet-Slicing
- **Level-Format:** 2D-Zahlen-Array (`0` = Boden, `1` = Wand, `2` = Spieler-Spawn, `3` = Gegner-Spawn)
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
