
// World / playfield
export const TILE_SIZE           = 1
export const WALL_HEIGHT         = 3
export const BLOCK_HALF_SIZE     = 0.5*TILE_SIZE

// Stairs (pro Tile STAIR_COUNT Stufen; Gesamthoehe ergibt sich dynamisch aus den Stufen)
export const STAIR_COUNT          = 4
export const STAIR_WIDTH          = TILE_SIZE / STAIR_COUNT
export const STAIR_HEIGHT         = 0.25
export const STAIR_SIDE_THICKNESS = 0.005
// Zusatzhoehe auf Stiegen, damit Entities nicht in den Stufenbloecken stecken (Rampe liegt unter den Stufenkanten)
export const STAIR_HEIGHT_OFFSET  = 0.25

// Gravitation (Beschleunigung nach unten, Einheiten/s²) + maximale Fallgeschwindigkeit
export const GRAVITY              = 20
export const MAX_FALL_SPEED       = 30
// Abstand, den ein Body beim Aufsetzen vor dem Collider stoppt (gegen Float-Rundung)
export const COLLISION_EPSILON    = 1e-6

// Lighting
export const AMBIENT_INTENSITY   = 0.4
export const DIR_LIGHT_INTENSITY = 0.8

// Camera / renderer
export const CAMERA_FOV          = 75
export const CAMERA_NEAR         = 0.1
export const CAMERA_FAR          = 100
export const FRAME_CAP           = 60
// Colors
export const COLOR_SKY           = 0xb6b8b8
export const COLOR_FLOOR         = 0x7d7573
export const COLOR_WALL_BLOCK    = 0x7d7573
export const COLOR_WALL_BOUNDARY = 0xb6b8b8
export const COLOR_STAIR         = 0x8f8680

// Player movement
export const PLAYER_SPEED        = 6
export const PLAYER_RADIUS       = 0.3
export const PLAYER_HALF_WIDTH_X = PLAYER_RADIUS
export const PLAYER_HALF_WIDTH_Z = PLAYER_RADIUS
export const PLAYER_EYE_HEIGHT   = 0.5
export const MOUSE_SENSITIVITY   = 0.0010
export const PITCH_LIMIT_DEG     = 80
export const PLAYER_PITCH_LIMIT = (PITCH_LIMIT_DEG * Math.PI) / 180

// Weapon
export const PISTOL_DAMAGE       = 34
export const PISTOL_COOLDOWN     = 0.2

// Projectile
export const PROJECTILE_SPEED    = 200

// Enemy
export const ENEMY_HP            = 100
export const ENEMY_RADIUS        = 0.3
export const ENEMY_BASE_HEIGHT   = 0.4
