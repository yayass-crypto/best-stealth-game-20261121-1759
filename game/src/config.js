// Shadow Lantern — shared constants for the whole game.
// One fixed logical canvas (1280x720); the renderer scales it to the window.
export const VIEW_W = 1280;
export const VIEW_H = 720;
export const TILE = 40;
export const MAP_COLS = 28;
export const MAP_ROWS = 16;
export const MAP_W = MAP_COLS * TILE; // 1120
export const MAP_H = MAP_ROWS * TILE; // 640
export const MAP_X = 80; // map left edge on the canvas
export const MAP_Y = 64; // map top edge (HUD occupies the strip above)
export const STEP = 1 / 60;

export const PLAYER_SPEED = 155; // px/s walking
export const SNEAK_SPEED = 82; // px/s while Shift is held
export const PLAYER_RADIUS = 13;
export const GUARD_PATROL_SPEED = 68;
export const GUARD_CHASE_SPEED = 132;
export const GUARD_PAUSE = 1.4; // seconds a guard waits at each waypoint

export const CONE_RANGE = 195;
export const CONE_HALF_ANGLE = 0.62; // ~35.5 degrees each side
export const NOISE_RADIUS = 112; // walking (not sneaking) is heard this far
export const BUSH_HIDE_RADIUS = 46; // a guard this close spots a player in a bush
export const SHADOW_CLOSE_RANGE = 62; // inside a shadow, only this close fills the meter

export const SUSPICIOUS_AT = 0.35; // meter level where a guard starts investigating
export const ALERT_AT = 1.0;
export const FILL_RATE = 1.5; // detection meter per second at point blank
export const DECAY_RATE = 0.55;
export const ALERT_MEMORY = 4.0; // seconds an alert guard chases after losing sight

export const BEST_KEY = 'shadow-lantern-best';
export const STARS_KEY = 'shadow-lantern-stars';

export const KEY_SNEAK = 'Shift';
