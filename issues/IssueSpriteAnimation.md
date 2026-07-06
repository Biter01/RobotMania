*Issue SpriteAnimation*

Als Nutzer will ich animierte Sprites die in der Welt angezeigt werden, um als Spieler animierte Gegner zu haben!

**Akzeptanzkriterien**:

Erstelle die Klasse StateMachine

Erstelle einen type/interface in eigener Datei StateConfig

Passe Enemy an so dass es die verschieden States des Spritesheets lädt und benutzt

Enemy soll dabei StateMachine Verwenden

**Implementierungsdetails**

Halte dich soweit möglich an diese Implementierungsdetails

enum EnemyState { Idle, Walk, Attack, Hit, Die }

interface StateConfig<S> {
  frames: number[];   // Indizes im Sprite-Sheet
  fps: number;
  loop: boolean;
  next?: S;           // wohin nach Ende bei loop:false, z.B. Attack -> Idle
}

class StateMachine<S extends number | string>

//Enemy Erweiterung

// Idle/Front 1-6, 7-12 Idle/Side, run Front 13-18, Walk Side 19-24, Shooting 25,26

this.sm = new StateMachine<EnemyState>()
  .addState(EnemyState.IdleFront,   { frames:[0,1,2,3,4,5],       fps:4,  loop:true })
  .addState(EnemyState.IdleSide,   { frames:[6,7,8,9,10,11],   fps:8,  loop:true })
  .addState(EnemyState.WalkFront, { frames:[....], fps:12, loop:false, next: EnemyState.Idle });
  ....
this.sm.start(EnemyState.Idle);

// im Update-Loop:

this.sm.update(dt);
this.applyFrame(this.sm.currentFrame);  // setzt texture.offset/repeat am SpriteMaterial von Enemy

**Anmerkungen**

Erstelle neue Dateien für eine Klasse
Schreibe bei unklarer/komplizierter Logik Kommentare
Nutze das neue Sprite in Enemy RoboOrginalNew.png
Bei unklaren Anweisungen Stelle Fragen