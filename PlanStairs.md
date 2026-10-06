## Stiegen Implementierungsplan

Stiegen sollen in die Tile basierte Spielwelt implementiert werden!

## Grobe Beschreibeung

### Rendering

Stiegen sollen in GameField.ts gerendert werden und in ParsedMap.ts gespeichert werden

Dabei soll zwischen < > ^ v als Char für die Richtung unterschieden werden.
Sowie die höhe der Stiege die Stufen Anzahl und die Breiten h,w,s

### Physics
Erweitere Physics zu einer generischen Klasse die 
jetzt auch das komplette movement abnehmen soll
Sprich man übergibt das Entity, die Collider des Spielfelds und wo z.b der Spieler hingehen will
Daraus berechnet man nun ob das geht über checkCollisions, stairMovement ..

(In Zukunft kommt dann auch noch eine Gravitaion hinzu)

#### StairMovment

Das StairMovement in Physics soll so geschen das
geschaut wird kollidiert der Spieler mit einer Stair?

Wenn ja dann soll er je nach Position am StairTile nachOben oder unten oder nicht bewegt werden

Beim Bewegen auf der Stufe wird geshchaut wie viel von der TILE_WIDHT 
wurde schon gegangen. Der Spieler/Gegner geht also eine Rampe rauf oder runter!


### Enemy Pathfinding

Das Enemy Pathfinding soll angepasst werden
Die neuen <>^v Zeichen werden berücksichtigt

Die heuristik berücksichtig diese als Weg wie alle anderen Böden

## Betroffene Files / Code Changes

**GameField.ts**
- Stiegen müssen aus MapData gerendert werden
- Stiegen Teile werden jeweils als eine Geometry gerendert und zusammengefasst
- Stiegen sollen am Rand einen collider erhalten der so hoch wie die Erste Stufe ist

for(const {x,z,tile} of this.parsed.stairs) {
    buildStair(x,z,tile)
}
...

for(s = 1 ;s <= StairData.STAIR_COUNT; s++) {
    const geo =  new THREE.BoxGeometry(STAIR_WIDTH,STAIR_HEIGHT * s , TILE_SIZE)
}

geo.rotateY(0)                 // Für ^
geo.rotateY(Math.PI / 2)       // Für >
geo.rotateY(Math.PI)           // Für v
geo.rotateY(-Math.PI / 2)      // Für < 

makeTranslation(x,STAIR_HEIGHT/2, z)

**Map.ts**
- Zusammengesetze Stairs müssen erkannt werden. Werden nur einmal als Stair
unter stairs in ParsedMap gespeichert. 


**MapData.ts**
- Stiegen müssen eingezeichnet werden 
< für links 
> rechts 
^ oben
v unten

**types.ts**
- Neuer Eintrag für Stair in Parsed Map
    stairs: Array<StairData>

**StairData.ts (New File)**
- Die DatenStruktur für Stairs
- Auch zusammengestze Tiles Stair Tiles die in die gleiche Richtung schauen
Können mit der Klasse zusammengefasst werden

class StairData
x,z
stairs, 
WIDTH = STAIR_WIDTH*stairs
HEIGHT = STAIR_HEIGHT * stairs //Height ergibt sich aus STAIR_HEIGHT * stairs
DEPTH=TILE_SIZE,
tile in (>,<,^,v)


**Physics.ts**
- Führe die Schnittstelle computePhysics(Entity,GameField,velocity, dt) ein


if(collision()) {
    ...
    return
} 

if(isOnStairTile()) {
    //Check movement Direction
    stairData = getStairDataOnPos(x,y)

    zMovement;

    if(stairTile === '>') 
        z= |StairDataLeftMostZ - Entity.position.z|
        stairProgress = z / (stairData.WIDTH)
        zMovement = stairProgress * stairData.Height

    else if(stairData === '<')
        z= |StairDataRightMostZ - Entity.position.z|
        stairProgress = z / (stairData.WIDTH)
        zMovement = stairProgress * stairData.Height


    else if(stairData === '^')
        |StairDataDownMostX - Entity.position.x|
        stairProgress = z / (stairData.WIDTH)
        zMovement = stairProgress * stairData.Height

    else is(stairData === 'v')
        |StairDataUpMostX - Entity.position.x|
        stairProgress = z / (stairData.WIDTH)
        zMovement = stairProgress * stairData.Height

    Entity.position.z += zMovement

}

getStairDataOnPos(x,y): StairData {
    if(isConnectedStair) {
        ...
        return getStairDataOf(x,y)
    }

    return getStairDataOf(x,y)
}

move(Entity,velocity,dt)


**Enemy.ts**
- Movement in Physics auslagern. Also das Bewegen nicht ob bewegt wird!!!
- Collisions Berechnungen in Physics auslagern

**Player.ts**
- Movement in Physics auslagern. Also das Bewegen nicht ob bewegt wird!!!
- Collisions Berechnungen in Physics auslagern

**AStarPathfinding.ts**
- Stufen wie Boden behandeln in der Heuristik
- Stufen nur als möglichen Nachbar zählen wenn das Boden Tile in einer Reihe liegt

isCorrectStairNeighbourTile(currTile,vec2: stairTile) {
    
    //Correct Right Tile
    if(currTile.x +1 == stairTile.x && currTile.y == stairTile.y  && getCharFromTile(stairTile) == '>' ) {
        return true
    }

    //Correct Leftt Tile
     if(currTile.x - 1 == stairTile.x && currTile.y == stairTile.y  && getCharFromTile(stairTile) == '>' ) {
        return true
    }

    //Correct Up Tile
     if(currTile.x  == stairTile.x && currTile.y + 1 == stairTile.y  && getCharFromTile(stairTile) == '^' ) {
        return true
    }

    //Correct Down Tile
     if(currTile.x  == stairTile.x && currTile.y - 1 == stairTile.y  && getCharFromTile(stairTile) == 'v' ) {
        return true
    }

    return false
}


## Randfälle

Stufen sollen nicht auf der Seite betreten werden können nur in Richtung Stiegen aufwärts und Stiegen abwärts

Wenn mehre Stufen hintereinander gereiht sind << oder >> oder ^  oder v
                                                              ^       v
sollen diese auf der höhe der letzen Stufe aufbauen. Und zusammen hängen

Fürs Erste soll der Spieler in der höhe schweben wenn er Schwelle der Stiegen überschritten hat!

## Out of Scope
Keine Gravity
Die Gravity soll im Zuge mit der Height Map kommen



