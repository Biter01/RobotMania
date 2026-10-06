/**
 * Global gameplay, rendering and world constants.
 *
 * All lengths are in world units; one tile is {@link TILE_SIZE} units wide.
 * @module
 */

// World / playfield

/** Edge length of one grid tile in world units. */
export const TILE_SIZE           = 1
/** Default height of wall blocks in the bundled levels. */
export const WALL_HEIGHT         = 3

// Navigation (layered nav grid for A*)

/** Free space that must be clear above a surface for it to count as walkable. */
export const NAV_HEADROOM         = 1
/** Height difference up to which two surfaces count as the same level. */
export const NAV_HEIGHT_TOLERANCE = 0.05

// Stairs (STAIR_COUNT steps per tile; the total height follows from the steps)

/** Number of steps per stair tile. */
export const STAIR_COUNT          = 4
/** Depth of a single step along the walking direction. */
export const STAIR_WIDTH          = TILE_SIZE / STAIR_COUNT
/** Height of a single step. */
export const STAIR_HEIGHT         = 0.25
/** Base thickness of the thin colliders along the sides of a stair. */
export const STAIR_SIDE_THICKNESS = 0.005
/**
 * Extra height on stairs so entities do not get stuck in the step blocks
 * (the walking ramp lies below the step edges).
 */
export const STAIR_HEIGHT_OFFSET  = 0.25

// Gravity

/** Downward acceleration in units/s². */
export const GRAVITY              = 20
/** Maximum falling speed in units/s. */
export const MAX_FALL_SPEED       = 30
/** Gap a body keeps to a collider when landing, to absorb float rounding. */
export const COLLISION_EPSILON    = 1e-6

// Lighting

/** Intensity of the ambient light. */
export const AMBIENT_INTENSITY   = 0.4
/** Intensity of the directional light. */
export const DIR_LIGHT_INTENSITY = 0.8

// Camera / renderer

/** Vertical field of view in degrees. */
export const CAMERA_FOV          = 75
/** Near clipping plane. */
export const CAMERA_NEAR         = 0.1
/** Far clipping plane. */
export const CAMERA_FAR          = 100
/** Upper limit for frames per second. */
export const FRAME_CAP           = 60

// Colors

/** Background / sky color. */
export const COLOR_SKY           = 0xb6b8b8
/** Color of `floor` blocks. */
export const COLOR_FLOOR         = 0x7d7573
/** Fallback color of blocks while their texture loads, or without a definition. */
export const COLOR_WALL_BLOCK    = 0x7d7573
/** Color of boundary walls. */
export const COLOR_WALL_BOUNDARY = 0xb6b8b8
/** Color of stair geometry. */
export const COLOR_STAIR         = 0x8f8680

// Player movement

/** Walking speed of the player in units/s. */
export const PLAYER_SPEED        = 6
/** Horizontal radius of the player, used for collisions and hits. */
export const PLAYER_RADIUS       = 0.3
/** Half width of the player collider along x. */
export const PLAYER_HALF_WIDTH_X = PLAYER_RADIUS
/** Half width of the player collider along z. */
export const PLAYER_HALF_WIDTH_Z = PLAYER_RADIUS
/** Eye height above the feet; the player's position sits at this height. */
export const PLAYER_EYE_HEIGHT   = 0.5
/** Mouse look sensitivity in radians per pixel. */
export const MOUSE_SENSITIVITY   = 0.0010
/** Maximum up/down look angle in degrees. */
export const PITCH_LIMIT_DEG     = 80
/** {@link PITCH_LIMIT_DEG} in radians. */
export const PLAYER_PITCH_LIMIT = (PITCH_LIMIT_DEG * Math.PI) / 180

// Weapon

/** Damage of one pistol shot. */
export const PISTOL_DAMAGE       = 34
/** Seconds between two pistol shots. */
export const PISTOL_COOLDOWN     = 0.2

// Projectile

/** Projectile speed in units/s. */
export const PROJECTILE_SPEED    = 200

// Enemy

/** Starting hit points of an enemy. */
export const ENEMY_HP            = 100
/** Horizontal radius of an enemy, used for collisions, hits and the nav grid. */
export const ENEMY_RADIUS        = 0.3
/** Height of the enemy's position above its feet. */
export const ENEMY_BASE_HEIGHT   = 0.4
