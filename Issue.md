# Issue #001 – Cursor verschwindet beim Klick auf Canvas

**Status:** Geschlossen ✓  
**Priorität:** Hoch  
**Sprint:** Sprint 1  

---

## Beschreibung

Sobald der Benutzer auf den Canvas klickt (auch auf den Start-Screen), verschwindet der Maus-Cursor sofort und dauerhaft. Es gibt keine Möglichkeit ihn zurückzubekommen, da ESC nicht implementiert ist.

---

## Ursache

### Problem 1 – `requestPointerLock()` auf jedem Canvas-Klick

In `src/core/InputManager.ts:12` wird **bei jedem Klick auf den Canvas** die Pointer Lock API angefordert – unabhängig vom aktuellen `GameState`:

```ts
// InputManager.ts – Zeile 12
canvas.addEventListener('click', () => canvas.requestPointerLock())
```

Das bedeutet: Schon der erste Klick auf den Start-Screen (der durch das `menuOverlay` blockiert ist, aber danach direkt den Canvas trifft) kann den Cursor sperren.

### Problem 2 – Kein ESC-Handler für Pointer Lock Exit

`ESC` wird zwar als Key getrackt (`keys['Escape']`), aber es gibt keinen Handler der `document.exitPointerLock()` aufruft. Der Browser beendet Pointer Lock bei `ESC` automatisch intern, aber das Spiel reagiert nicht darauf – kein Pause-State, kein Cursor zurück.

### Problem 3 – `cursor: crosshair` im CSS immer aktiv

In `index.html` ist `cursor: crosshair` auf dem Canvas gesetzt, was den System-Cursor auch im Menü verändert.

---

## Erwartetes Verhalten

| Zustand | Cursor |
|---------|--------|
| `MENU` | Normal sichtbar (`default`) |
| `PLAYING` | Gesperrt via Pointer Lock (verschwindet korrekt) |
| `PLAYING` + ESC | Pointer Lock freigeben → Pause-Screen → Cursor zurück |
| `GAMEOVER` / `WIN` | Cursor sichtbar (`default`) |

---

## Lösung

### Fix 1 – `requestPointerLock` nur im `PLAYING`-State
### Fix 2 – ESC-Handler: Pointer Lock freigeben + Pause
### Fix 3 – `cursor: none` per CSS-Klasse steuern

---

## Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `src/core/InputManager.ts` | `requestPointerLock` nur wenn `PLAYING`, ESC-Handler |
| `src/core/Game.ts` | State-Callback an InputManager, `pointerlockchange`-Listener |
| `index.html` | CSS `cursor` an `.playing`-Klasse binden |

---

---

# Issue #002 – Cursor weg + Spiel stoppt bei ESC (Folgefehler aus Fix #001)

**Status:** Geschlossen ✓  
**Priorität:** Kritisch  
**Sprint:** Sprint 1  

---

## Beschreibung

Nach Implementierung von Issue #001 treten zwei neue Fehler auf:

1. **Cursor komplett unsichtbar** – auch im Menü und nach ESC ist kein Cursor zu sehen
2. **Spiel friert bei ESC ein** – Spieler kann sich nach ESC nicht mehr bewegen

---

## Ursache – Bug A: Cursor komplett weg

### Ursache 1 – CSS `cursor: none` und Pointer Lock sind doppelt gestapelt

`setState(PLAYING)` wird in `main.ts` aufgerufen → setzt `body.playing` Klasse → `cursor: none` greift auf dem Canvas (der `100vw × 100vh` groß ist).

Wenn der Browser den Pointer Lock aus irgendeinem Grund **nicht sofort gewährt** (z.B. kurze Verzögerung, Fokus-Problem), ist der Cursor per CSS bereits unsichtbar – ohne dass Pointer Lock aktiv ist. Der Nutzer sieht nichts, kann die Maus aber noch frei bewegen.

### Ursache 2 – CSS-Klasse bleibt beim ESC falsch gesetzt

```
ESC gedrückt
  → document.exitPointerLock()
  → pointerlockchange fires
  → setState(GameState.MENU)   ← entfernt body.playing
  → Cursor sollte zurück kommen
```

Das scheint zu funktionieren – aber nur wenn `pointerlockchange` zuverlässig feuert. Gibt es einen Race Condition zwischen `setState` und dem Browser-Event, bleibt `body.playing` hängen.

---

## Ursache – Bug B: Spiel friert bei ESC ein

```ts
// Game.ts – pointerlockchange Listener
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && this.state === GameState.PLAYING) {
    this.setState(GameState.MENU)   // ← BUG: State wechselt zu MENU
  }
})
```

```ts
// Game.ts – update()
update(dt: number) {
  if (this.state !== GameState.PLAYING) return   // ← stoppt alle Updates
  this.player.update(dt, this.input)
}
```

**Kausalkette:**
1. Spieler drückt ESC im Spiel
2. `exitPointerLock()` → `pointerlockchange` fires
3. `setState(MENU)` → `state = MENU`
4. `update()` prüft `state !== PLAYING` → return
5. Spieler bewegt sich nicht mehr, obwohl Szene noch gerendert wird
6. Kein Weg zurück ins Spiel ohne Seite neu zu laden

---

## Erwartetes Verhalten (korrigiert)

| Aktion | Erwartetes Verhalten |
|--------|----------------------|
| Menü sichtbar | Cursor sichtbar (`default`) |
| Klick im Menü → Spiel startet | Pointer Lock angefordert → Cursor weg |
| Pointer Lock aktiv | Cursor weg, Mauslook funktioniert |
| ESC während Spiel | Pointer Lock freigegeben, Cursor zurück, **Spiel läuft weiter** (nur Mauslook pausiert) |
| Klick auf Canvas nach ESC | Pointer Lock erneut anfordern, Mauslook aktiv |

---

## Lösung

### Fix A – CSS `cursor: none` NUR wenn Pointer Lock wirklich aktiv ist

**Statt** CSS-Klasse an `GameState` zu binden → Klasse an `input.isLocked` binden.  
`body.locked` Klasse wird direkt im `pointerlockchange`-Listener gesetzt/entfernt:

```ts
// Game.ts – pointerlockchange Listener (neu)
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas
  document.body.classList.toggle('locked', locked)
  // KEIN setState() mehr hier!
})
```

```css
/* index.html – cursor nur bei echtem Lock */
#game-canvas            { cursor: default; }
body.locked #game-canvas { cursor: none; }
```

---

### Fix B – ESC friert Spiel nicht ein: State bleibt `PLAYING`

`pointerlockchange` darf **nicht** den `GameState` ändern. Pointer Lock und GameState sind zwei unabhängige Dinge:

- `GameState.PLAYING` = Spiel läuft (Logik, Gegner, Kollision)
- `input.isLocked` = Mauslook aktiv

Mauslook in `Player.ts` funktioniert bereits nur wenn `isLocked === true` (via `consumeMouse()` das nur bei Lock Daten liefert). Das Spiel muss also **nicht pausieren** wenn der Lock verloren geht – der Spieler steht nur still.

```ts
// Game.ts – pointerlockchange (bereinigt)
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas
  document.body.classList.toggle('locked', locked)
  // Kein setState() – GameState bleibt unberührt
})
```

```ts
// Game.ts – update() bleibt so:
update(dt: number) {
  if (this.state !== GameState.PLAYING) return
  this.player.update(dt, this.input)
  // Mauslook funktioniert automatisch nur wenn input.isLocked === true
}
```

---

### Fix C – `setState()` entfernt `body.playing`, nicht `body.locked`

`setState()` soll `body.playing` für HUD-Sichtbarkeit steuern (unabhängig vom Lock).  
`body.locked` steuert ausschließlich den Cursor.

```ts
setState(next: GameState) {
  this.state = next
  document.body.classList.toggle('playing', next === GameState.PLAYING)
  // body.locked wird nur durch pointerlockchange gesetzt
}
```

---

## Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `src/core/Game.ts` | `pointerlockchange` entfernt `setState()`, setzt nur `body.locked` |
| `index.html` | CSS nutzt `body.locked` statt `body.playing` für `cursor: none` |

---

## Zusammenfassung der Trennung

```
body.playing  → HUD sichtbar / unsichtbar       (gesteuert durch setState)
body.locked   → cursor: none / default           (gesteuert durch pointerlockchange)
input.isLocked → Mauslook aktiv / inaktiv        (gesteuert durch Pointer Lock API)
GameState     → Spiellogik läuft / pausiert      (gesteuert durch setState)
```
