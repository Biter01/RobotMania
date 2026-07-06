# Issue Enemy Player Rotation

## User Story

Der Spieler soll den Roboter(Enemy) von allen 8 Seiten sehen um ihn als 3D wahrnehmen zu können!


## Akzeptanzkriterien
Enemy Sprite soll sich je nach Blilckrichtung des Enemy und Kameraposition des Spielers ändern. Das das Enemy Sprite richtig zum Spieler angezeigt wird
Enemy Sprite soll für links oder rechts Unterscheidung jeweils gespiegelt werden!


## Möglicher Anhaltspunkt 

// Feld in der Klasse:
// 1) Blickrichtung des Gegners in der Welt (XZ-Ebene, normalisiert)
facing = new THREE.Vector3(0, 0, 1)

// wiederverwendeter Temp-Vektor, um pro Frame keine Allocation zu machen
private static readonly _toViewer = new THREE.Vector3()

/** Liefert den Blick-Sektor 0..7 (0 = Spieler steht frontal vor dem Gegner). */
private viewSector(viewerPos: THREE.Vector3): number {
  // 2) Vektor vom Gegner zum Betrachter, auf die XZ-Ebene projiziert
  const toViewer = Enemy._toViewer.copy(viewerPos).sub(this.position)
  toViewer.y = 0
  toViewer.normalize()

  const fx = this.facing.x
  const fz = this.facing.z

  // 3) Winkel zwischen Blickrichtung und Betrachter
  //    dot   = cos(θ)  -> wie frontal (nur Betrag, 0..180°)
  //    cross = sin(θ)  -> Vorzeichen: welche Seite (links/rechts)
  const dot   = fx * toViewer.x + fz * toViewer.z
  const cross = fx * toViewer.z - fz * toViewer.x
  const angle = Math.atan2(cross, dot)          // signiert: -π..π

  // 4) In 8 Sektoren à 45° quantisieren, Sektor 0 zentriert auf "frontal"
  let a = angle < 0 ? angle + Math.PI * 2 : angle   // 0..2π
  return Math.round(a / (Math.PI / 4)) % 8          // 0..7
}

## Sprite Positionen

IdleFront: 0-5
IdleFront34: 6-11
IdleSide: 12-17
IdleBack34: 18-23
IdleBack: 24-29

RunFront: 30-35
WalkFron34: 36-41
WalkSide: 42-47
WalkBack34: 48-53
WalkBack: 54-59

ShootingFront: 60-61
ShootingFront34: 62-63