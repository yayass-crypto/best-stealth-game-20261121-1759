// Shadow Lantern — the deterministic screenshot scenes behind ?shot=.
// Each scene plays the real rules forward from a fresh world for a fixed
// number of steps, so the frame is what a short game really looks like and
// the same seed always gives the same frame.
import { STEP, TILE } from './config.js';
import { EVENT_ALERT, EVENT_CAUGHT, EVENT_WIN } from './world.js';
import { SCREEN_CAUGHT, SCREEN_CLEAR, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const SAMPLE = STEP;

/** Run the autopilot for `seconds` of game time; returns the events seen. */
function runAutopilot(world, seconds) {
  let events = 0;
  const steps = Math.round(seconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    const { dir, sneak } = world.autopilotDirection(SAMPLE);
    events |= world.step(SAMPLE, { x: dir.x, y: dir.y, sneak }, false);
    if (events & (EVENT_WIN | EVENT_CAUGHT)) break;
  }
  return events;
}

/** Walk the thief to a point that tracks a guard's nose (80 px ahead of it),
 *  following a real path through the map; stops as soon as `stopEvents` fires. */
function stalkGuard(world, ahead, stopEvents, maxSteps) {
  let events = 0;
  const guard = world.state.guards[0];
  let path = null;
  let pathAt = -10;
  for (let i = 0; i < maxSteps; i += 1) {
    const player = world.state.player;
    const target = {
      x: guard.x + Math.cos(guard.facing) * ahead,
      y: guard.y + Math.sin(guard.facing) * ahead,
    };
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const dist = Math.hypot(dx, dy);
    let dir = { x: 0, y: 0 };
    if (dist < 60) {
      if (dist > 10) dir = { x: dx / dist, y: dy / dist };
    } else {
      if (!path || world.state.now - pathAt > 0.5) {
        const ptx = Math.floor(player.x / TILE);
        const pty = Math.floor(player.y / TILE);
        path = world.findSafePath(ptx, pty, Math.floor(target.x / TILE), Math.floor(target.y / TILE))
          || world.findSafePath(ptx, pty, Math.floor(guard.x / TILE), Math.floor(guard.y / TILE));
        pathAt = world.state.now;
      }
      if (path && path.length) {
        const node = path[0];
        const nx = node.x - player.x;
        const ny = node.y - player.y;
        if (Math.hypot(nx, ny) < 8) path.shift();
        else {
          const len = Math.hypot(nx, ny);
          dir = { x: nx / len, y: ny / len };
        }
      }
    }
    events |= world.step(SAMPLE, { x: dir.x, y: dir.y, sneak: false }, false);
    if (events & stopEvents) break;
  }
  return events;
}

/** Stand still, stepping the real rules, until `stopEvents` fires. */
function standStill(world, stopEvents, maxSteps) {
  let events = 0;
  for (let i = 0; i < maxSteps; i += 1) {
    events |= world.step(SAMPLE, { x: 0, y: 0, sneak: false }, false);
    if (events & stopEvents) break;
  }
  return events;
}

/**
 * Stage the named scene on a fresh world and return the screen to draw.
 * Scenes: title (ambient museum behind the menu), play (mid-heist, guards
 * patrolling, cones and cover on show), alert (a guard has spotted the
 * thief — red cone, "!" and a high detection meter), win (level clear),
 * caught (the thief is caught), autoplay (play until the level is won or
 * lost; used by the play-test harness).
 */
export function stageShot(name, world) {
  world.loadLevel(0);
  if (name === 'title') {
    for (let i = 0; i < 12 / SAMPLE; i += 1) world.step(SAMPLE, { x: 0, y: 0 }, true);
    return { screen: SCREEN_TITLE, result: 'title' };
  }
  if (name === 'alert') {
    // Stalk guard 1 into its own cone until the alarm trips, then freeze the
    // frame: red cone, "!" overhead, detection meter high.
    const events = stalkGuard(world, 120, EVENT_ALERT | EVENT_CAUGHT, 2400);
    return { screen: SCREEN_PLAY, result: events & EVENT_ALERT ? 'alert' : 'patrol' };
  }
  if (name === 'win') {
    const events = runAutopilot(world, 180);
    return { screen: events & EVENT_WIN ? SCREEN_CLEAR : SCREEN_PLAY, result: events & EVENT_WIN ? 'won' : 'playing' };
  }
  if (name === 'caught') {
    // Walk into guard 1's cone, then stand still so the chase ends in a catch.
    let events = stalkGuard(world, 70, EVENT_ALERT, 2400);
    if (events & EVENT_ALERT) events |= standStill(world, EVENT_CAUGHT, 900);
    return { screen: events & EVENT_CAUGHT ? SCREEN_CAUGHT : SCREEN_PLAY, result: events & EVENT_CAUGHT ? 'caught' : 'playing' };
  }
  if (name === 'autoplay') {
    const events = runAutopilot(world, 240);
    if (events & EVENT_WIN) return { screen: SCREEN_CLEAR, result: 'won' };
    if (events & EVENT_CAUGHT) return { screen: SCREEN_CAUGHT, result: 'caught' };
    return { screen: SCREEN_PLAY, result: 'playing' };
  }
  // Default: play — 7 seconds of autopilot heist, mid-patrol, mid-map.
  const events = runAutopilot(world, 7);
  return { screen: events & EVENT_WIN ? SCREEN_CLEAR : SCREEN_PLAY, result: 'play' };
}
