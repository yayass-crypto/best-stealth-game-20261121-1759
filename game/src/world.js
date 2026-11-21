// Shadow Lantern — the simulation: the thief, the guards, the detection meter,
// loot, the exit and the autopilot that plays the game for screenshots.
// Positions are in map pixels (tile = 40 px, origin at the map's top-left).
import {
  ALERT_AT, ALERT_MEMORY, BUSH_HIDE_RADIUS, CONE_HALF_ANGLE, CONE_RANGE,
  DECAY_RATE, FILL_RATE, GUARD_CHASE_SPEED, GUARD_PATROL_SPEED, GUARD_PAUSE,
  MAP_COLS, MAP_ROWS, MAP_X, MAP_Y, NOISE_RADIUS, PLAYER_RADIUS, PLAYER_SPEED,
  SHADOW_CLOSE_RANGE, SNEAK_SPEED, SUSPICIOUS_AT, TILE,
} from './config.js';
import { LEVELS, blocksSightTile, isSolidTile, parseLevel } from './levels.js';

export const EVENT_NONE = 0;
export const EVENT_PICKUP = 1;
export const EVENT_SUSPICIOUS = 2;
export const EVENT_ALERT = 4;
export const EVENT_CAUGHT = 8;
export const EVENT_WIN = 16;
export const EVENT_HEARD = 32;

const GUARD_STATES = { PATROL: 'patrol', SUSPICIOUS: 'suspicious', ALERT: 'alert' };

function tileCenter(tx, ty) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function turnToward(current, target, maxStep) {
  const d = angleDiff(target, current);
  if (Math.abs(d) <= maxStep) return target;
  return current + Math.sign(d) * maxStep;
}

export function createWorld(random) {
  const state = {
    levelIndex: 0,
    level: LEVELS[0],
    levels: LEVELS,
    tiles: [],
    player: { x: 0, y: 0, facing: 0, moving: false, sneaking: false, hidden: false },
    guards: [],
    gems: [],
    exit: { x: 0, y: 0 },
    loot: 0,
    lootTotal: 0,
    score: 0,
    time: 0,
    detection: 0,
    everAlerted: false,
    everSuspicious: false,
    caught: false,
    won: false,
    alarm: false,
    hintUntil: 0,
    hintPath: null,
    path: null, // click-to-move path: list of pixel points
    pathTarget: null,
    autoPath: null,
    autoPathAt: 0,
    autoTarget: null,
    now: 0,
  };

  function loadLevel(index) {
    const level = LEVELS[index];
    const parsed = parseLevel(level);
    state.levelIndex = index;
    state.level = level;
    state.tiles = parsed.tiles;
    const start = tileCenter(parsed.player.x, parsed.player.y);
    state.player = { x: start.x, y: start.y, facing: Math.PI / 2, moving: false, sneaking: false, hidden: false };
    state.exit = tileCenter(parsed.exit.x, parsed.exit.y);
    state.gems = parsed.gems.map((g) => ({ ...tileCenter(g.x, g.y), tx: g.x, ty: g.y, taken: false }));
    state.loot = 0;
    state.lootTotal = state.gems.length;
    state.score = 0;
    state.time = 0;
    state.detection = 0;
    state.everAlerted = false;
    state.everSuspicious = false;
    state.caught = false;
    state.won = false;
    state.alarm = false;
    state.hintUntil = 0;
    state.hintPath = null;
    state.path = null;
    state.pathTarget = null;
    state.autoPath = null;
    state.autoTarget = null;
    state.guards = level.guards.map((def, i) => {
      const spawn = parsed.guardSpawns[i] || parsed.guardSpawns[0];
      const at = tileCenter(spawn.x, spawn.y);
      const first = tileCenter(def.waypoints[0][0], def.waypoints[0][1]);
      return {
        x: at.x,
        y: at.y,
        facing: Math.atan2(first.y - at.y, first.x - at.x) || 0,
        waypoints: def.waypoints.map(([wx, wy]) => tileCenter(wx, wy)),
        waypointIndex: 1,
        pause: 0,
        scanPhase: random.next() * Math.PI * 2,
        state: GUARD_STATES.PATROL,
        suspicion: 0,
        lastSeen: null,
        lastHeard: null,
        lostSightFor: 0,
        investigateUntil: 0,
      };
    });
  }

  function tileAt(px, py) {
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    if (tx < 0 || ty < 0 || tx >= MAP_COLS || ty >= MAP_ROWS) return '#';
    return state.tiles[ty][tx];
  }

  function tileAtTile(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= MAP_COLS || ty >= MAP_ROWS) return '#';
    return state.tiles[ty][tx];
  }

  function circleHitsSolid(x, y, radius) {
    for (let a = 0; a < 8; a += 1) {
      const ang = (a / 8) * Math.PI * 2;
      if (isSolidTile(tileAt(x + Math.cos(ang) * radius, y + Math.sin(ang) * radius))) return true;
    }
    return isSolidTile(tileAt(x, y));
  }

  function moveCircle(body, dx, dy, radius) {
    const nx = body.x + dx;
    if (!circleHitsSolid(nx, body.y, radius)) body.x = nx;
    const ny = body.y + dy;
    if (!circleHitsSolid(body.x, ny, radius)) body.y = ny;
  }

  /** Line of sight between two map points: blocked by walls, crates and bushes. */
  function hasLineOfSight(ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(dist / 7));
    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      if (blocksSightTile(tileAt(ax + dx * t, ay + dy * t))) return false;
    }
    return true;
  }

  function playerTile() {
    return tileAt(state.player.x, state.player.y);
  }

  /** Can this guard see the thief right now? Returns a fill-rate multiplier, 0 when hidden. */
  function guardSeesPlayer(guard) {
    const dx = state.player.x - guard.x;
    const dy = state.player.y - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist > CONE_RANGE) return 0;
    const ang = Math.atan2(dy, dx);
    if (Math.abs(angleDiff(ang, guard.facing)) > CONE_HALF_ANGLE) return 0;
    if (!hasLineOfSight(guard.x, guard.y, state.player.x, state.player.y)) return 0;
    const tile = playerTile();
    if (tile === 'b' && dist > BUSH_HIDE_RADIUS) return 0;
    let rate = 1 - (dist / CONE_RANGE) * 0.6;
    if (state.player.sneaking) rate *= 0.5;
    if (tile === 's') {
      if (dist > SHADOW_CLOSE_RANGE) rate *= 0.25;
      else rate *= 0.6;
    }
    return Math.max(0, rate);
  }

  function pointInCone(px, py, guard) {
    const dx = px - guard.x;
    const dy = py - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist > CONE_RANGE) return false;
    const ang = Math.atan2(dy, dx);
    if (Math.abs(angleDiff(ang, guard.facing)) > CONE_HALF_ANGLE) return false;
    return hasLineOfSight(guard.x, guard.y, px, py);
  }

  /** Grid path from (sx,sy) to (tx,ty); cone tiles are avoided when a safe path exists. */
  function findPath(sx, sy, tx, ty, avoidCones) {
    if (sx === tx && sy === ty) return [];
    const key = (x, y) => y * MAP_COLS + x;
    const prev = new Map();
    const seen = new Set([key(sx, sy)]);
    const queue = [[sx, sy]];
    const coneBlocked = (x, y) => {
      if (!avoidCones) return false;
      const cx = x * TILE + TILE / 2;
      const cy = y * TILE + TILE / 2;
      return state.guards.some((g) => pointInCone(cx, cy, g));
    };
    while (queue.length) {
      const [cx, cy] = queue.shift();
      if (cx === tx && cy === ty) break;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= MAP_COLS || ny >= MAP_ROWS) continue;
        const k = key(nx, ny);
        if (seen.has(k)) continue;
        if (isSolidTile(tileAtTile(nx, ny))) continue;
        if (coneBlocked(nx, ny)) continue;
        seen.add(k);
        prev.set(k, [cx, cy]);
        queue.push([nx, ny]);
      }
    }
    if (!prev.has(key(tx, ty))) return null;
    const path = [];
    let cur = [tx, ty];
    while (!(cur[0] === sx && cur[1] === sy)) {
      path.unshift(tileCenter(cur[0], cur[1]));
      cur = prev.get(key(cur[0], cur[1]));
    }
    return path;
  }

  function findSafePath(sx, sy, tx, ty) {
    return findPath(sx, sy, tx, ty, true) || findPath(sx, sy, tx, ty, false);
  }

  function nearestGuardDistance() {
    let best = Infinity;
    for (const g of state.guards) {
      best = Math.min(best, Math.hypot(g.x - state.player.x, g.y - state.player.y));
    }
    return best;
  }

  function updateGuard(guard, dt, events) {
    const player = state.player;
    const seeRate = guardSeesPlayer(guard);
    const dist = Math.hypot(player.x - guard.x, player.y - guard.y);
    const wasState = guard.state;

    if (seeRate > 0) {
      guard.suspicion = Math.min(ALERT_AT, guard.suspicion + FILL_RATE * seeRate * dt);
      guard.lastSeen = { x: player.x, y: player.y };
      guard.lostSightFor = 0;
      if (guard.state !== GUARD_STATES.ALERT && guard.suspicion >= ALERT_AT) {
        guard.state = GUARD_STATES.ALERT;
        state.everAlerted = true;
        state.alarm = true;
        events.value |= EVENT_ALERT;
      } else if (guard.state === GUARD_STATES.PATROL && guard.suspicion >= SUSPICIOUS_AT) {
        guard.state = GUARD_STATES.SUSPICIOUS;
        state.everSuspicious = true;
        events.value |= EVENT_SUSPICIOUS;
      }
    } else {
      guard.lostSightFor += dt;
      const decay = guard.state === GUARD_STATES.SUSPICIOUS ? DECAY_RATE * 0.45 : DECAY_RATE;
      guard.suspicion = Math.max(0, guard.suspicion - decay * dt);
      if (guard.state === GUARD_STATES.ALERT && guard.lostSightFor >= ALERT_MEMORY) {
        guard.state = GUARD_STATES.SUSPICIOUS;
        guard.investigateUntil = state.now + 2.2;
      } else if (guard.state === GUARD_STATES.SUSPICIOUS && guard.suspicion <= 0) {
        guard.state = GUARD_STATES.PATROL;
        guard.lastSeen = null;
      }
    }

    // Hearing: a walking thief is loud; a sneaking one is not.
    if (player.moving && !player.sneaking && dist < NOISE_RADIUS && guard.state === GUARD_STATES.PATROL) {
      guard.suspicion = Math.min(ALERT_AT, guard.suspicion + 0.3 * dt);
      guard.lastHeard = { x: player.x, y: player.y };
      if (guard.suspicion >= SUSPICIOUS_AT) {
        guard.state = GUARD_STATES.SUSPICIOUS;
        state.everSuspicious = true;
        events.value |= EVENT_HEARD;
      }
    }

    // Movement by state.
    if (guard.state === GUARD_STATES.ALERT) {
      const target = guard.lastSeen || { x: player.x, y: player.y };
      moveToward(guard, target, GUARD_CHASE_SPEED, dt);
      if (dist < 26) events.value |= EVENT_CAUGHT;
    } else if (guard.state === GUARD_STATES.SUSPICIOUS) {
      const target = guard.lastSeen || guard.lastHeard;
      if (target) {
        const arrived = moveToward(guard, target, GUARD_PATROL_SPEED * 1.35, dt);
        if (arrived) {
          guard.scanPhase += dt * 1.6;
          guard.facing += Math.sin(guard.scanPhase) * dt * 1.8;
        }
      }
    } else if (guard.state === GUARD_STATES.PATROL) {
      if (wasState !== GUARD_STATES.PATROL) guard.waypointIndex = nearestWaypointIndex(guard);
      if (guard.pause > 0) {
        guard.pause -= dt;
        guard.scanPhase += dt;
        guard.facing += Math.sin(guard.scanPhase) * dt * 0.9;
      } else {
        const target = guard.waypoints[guard.waypointIndex];
        const arrived = moveToward(guard, target, GUARD_PATROL_SPEED, dt);
        if (arrived) {
          guard.pause = GUARD_PAUSE;
          guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
        }
      }
    }
  }

  function nearestWaypointIndex(guard) {
    let best = 0;
    let bestDist = Infinity;
    guard.waypoints.forEach((w, i) => {
      const d = Math.hypot(w.x - guard.x, w.y - guard.y);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    return best;
  }

  /** Walk toward a point; returns true when arrived (within 6 px). */
  function moveToward(guard, target, speed, dt) {
    const dx = target.x - guard.x;
    const dy = target.y - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 6) return true;
    const want = Math.atan2(dy, dx);
    guard.facing = turnToward(guard.facing, want, dt * 6);
    const stepLen = Math.min(dist, speed * dt);
    moveCircle(guard, Math.cos(guard.facing) * stepLen, Math.sin(guard.facing) * stepLen, 12);
    return false;
  }

  /** Autopilot: steer the thief toward the nearest gem, then the exit, avoiding cones. */
  function autopilotDirection(dt) {
    const player = state.player;
    const ptx = Math.floor(player.x / TILE);
    const pty = Math.floor(player.y / TILE);
    const exitTile = { x: Math.floor(state.exit.x / TILE), y: Math.floor(state.exit.y / TILE) };
    let target = exitTile;
    let nearestGem = null;
    let nearestDist = Infinity;
    for (const gem of state.gems) {
      if (gem.taken) continue;
      const d = Math.hypot(gem.x - player.x, gem.y - player.y);
      if (d < nearestDist) { nearestDist = d; nearestGem = gem; }
    }
    if (nearestGem && nearestDist < 260) target = { x: nearestGem.tx, y: nearestGem.ty };
    const stale = !state.autoPath || !state.autoTarget || state.autoTarget.x !== target.x || state.autoTarget.y !== target.y
      || state.now - state.autoPathAt > 0.6;
    if (stale) {
      state.autoPath = findSafePath(ptx, pty, target.x, target.y);
      state.autoTarget = target;
      state.autoPathAt = state.now;
    }
    let dir = { x: 0, y: 0 };
    let sneak = false;
    if (state.autoPath && state.autoPath.length) {
      const node = state.autoPath[0];
      const dx = node.x - player.x;
      const dy = node.y - player.y;
      if (Math.hypot(dx, dy) < 8) state.autoPath.shift();
      else {
        const len = Math.hypot(dx, dy);
        dir = { x: dx / len, y: dy / len };
      }
      const nearGuard = nearestGuardDistance();
      const inCone = state.guards.some((g) => pointInCone(player.x, player.y, g));
      sneak = inCone || nearGuard < 110;
    }
    return { dir, sneak };
  }

  function step(dt, input, ambient) {
    const events = { value: EVENT_NONE };
    state.now += dt;
    if (state.caught || state.won) return events.value;
    const player = state.player;

    if (!ambient) state.time += dt;

    // --- player movement: keyboard, or the click-to-move path ---
    let dir = { x: input?.x || 0, y: input?.y || 0 };
    let sneaking = !!input?.sneak;
    if (input?.clickPath && input.clickPath.length) {
      const node = input.clickPath[0];
      const dx = node.x - player.x;
      const dy = node.y - player.y;
      if (Math.hypot(dx, dy) < 8) input.clickPath.shift();
      else {
        const len = Math.hypot(dx, dy);
        dir = { x: dx / len, y: dy / len };
      }
    }
    const speed = sneaking ? SNEAK_SPEED : PLAYER_SPEED;
    const moving = Math.hypot(dir.x, dir.y) > 0.01;
    player.moving = moving;
    player.sneaking = sneaking && moving;
    if (moving) {
      player.facing = Math.atan2(dir.y, dir.x);
      moveCircle(player, dir.x * speed * dt, dir.y * speed * dt, PLAYER_RADIUS);
      if (!ambient) events.value |= 0; // footsteps are handled by the caller via player.moving
    }
    player.hidden = playerTile() === 'b';

    // --- guards and detection ---
    for (const guard of state.guards) {
      if (ambient) {
        // Title-screen backdrop: patrol only, no detection.
        if (guard.pause > 0) {
          guard.pause -= dt;
          guard.scanPhase += dt;
          guard.facing += Math.sin(guard.scanPhase) * dt * 0.9;
        } else {
          const target = guard.waypoints[guard.waypointIndex];
          if (moveToward(guard, target, GUARD_PATROL_SPEED, dt)) {
            guard.pause = GUARD_PAUSE;
            guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
          }
        }
        continue;
      }
      updateGuard(guard, dt, events);
    }
    if (!ambient) {
      state.detection = Math.max(0, ...state.guards.map((g) => g.suspicion));
      state.alarm = state.guards.some((g) => g.state === GUARD_STATES.ALERT);
      if (events.value & EVENT_CAUGHT) {
        state.caught = true;
        return events.value;
      }
    }

    // --- loot ---
    if (!ambient) {
      for (const gem of state.gems) {
        if (!gem.taken && Math.hypot(gem.x - player.x, gem.y - player.y) < 24) {
          gem.taken = true;
          state.loot += 1;
          state.score += 100;
          events.value |= EVENT_PICKUP;
        }
      }
      // --- exit ---
      if (Math.hypot(state.exit.x - player.x, state.exit.y - player.y) < 24) {
        state.won = true;
        const timeBonus = Math.max(0, Math.round((state.level.par - state.time) * 10));
        state.score += timeBonus;
        events.value |= EVENT_WIN;
      }
    }
    return events.value;
  }

  function stars() {
    if (!state.won) return 0;
    let s = 1;
    if (state.loot === state.lootTotal) s += 1;
    if (!state.everAlerted) s += 1;
    return s;
  }

  loadLevel(0);

  return {
    state,
    loadLevel,
    step,
    tileAt,
    hasLineOfSight,
    pointInCone,
    findSafePath,
    autopilotDirection,
    stars,
    guardSeesPlayer,
    toCanvas(px, py) { return { x: px + MAP_X, y: py + MAP_Y }; },
    fromCanvas(cx, cy) { return { x: cx - MAP_X, y: cy - MAP_Y }; },
    EVENT_PICKUP,
    EVENT_SUSPICIOUS,
    EVENT_ALERT,
    EVENT_CAUGHT,
    EVENT_WIN,
    EVENT_HEARD,
  };
}
