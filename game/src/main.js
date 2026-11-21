// Shadow Lantern — boot and the one loop: input is read every frame, the
// world advances in fixed 1/60 s steps, and the renderer paints what is there.
// The game moves between six screens: title, play, paused, caught, level
// clear and game clear.
//
// ?seed=N fixes the decoration and guard scan phases. ?shot=title|play|alert|
// win|caught|autoplay stages that scene instead of running the loop, paints
// it twice and sets window.__shotReady (and window.__shotResult) for a
// screenshot or a play-test.
import { BEST_KEY, MAP_H, MAP_W, MAP_X, MAP_Y, STEP, STARS_KEY, TILE } from './config.js';
import { createRandom } from './random.js';
import { LEVELS } from './levels.js';
import {
  EVENT_ALERT, EVENT_CAUGHT, EVENT_HEARD, EVENT_PICKUP, EVENT_SUSPICIOUS,
  EVENT_WIN, createWorld,
} from './world.js';
import { ACTION_CONFIRM, ACTION_HINT, ACTION_MENU, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  SCREEN_CAUGHT, SCREEN_CLEAR, SCREEN_GAME_CLEAR, SCREEN_PAUSED, SCREEN_PLAY,
  SCREEN_TITLE, createRenderer,
} from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off: the best score then lasts this visit only.
  }
}

function readStars() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STARS_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed : [0, 0, 0];
  } catch {
    return [0, 0, 0];
  }
}

function saveStars(stars) {
  try {
    window.localStorage.setItem(STARS_KEY, JSON.stringify(stars));
  } catch {
    // Storage can be off: stars then last this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  window.__shotResult = scene.result;
  let painted = 0;
  const ui = {
    best: readBest(), stars: readStars(), selectedLevel: 0,
    lastStars: world.stars(), totalScore: world.state.score, totalStars: 0,
  };
  function paint() {
    renderer.draw(world.state, scene.screen, ui);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let selectedLevel = 0;
  let best = readBest();
  let stars = readStars();
  let lastStars = 0;
  let totalScore = 0;
  let totalStars = 0;
  let clickPath = null;
  let accumulator = 0;
  let last = performance.now();

  window.addEventListener('keydown', () => audio.unlock(), { once: true });
  canvas.addEventListener('pointerdown', () => audio.unlock(), { once: true });

  function announce(message) {
    status.textContent = message;
  }

  function ui() {
    return { best, stars, selectedLevel, lastStars, totalScore, totalStars };
  }

  function startLevel(index) {
    world.loadLevel(index);
    selectedLevel = index;
    clickPath = null;
    screen = SCREEN_PLAY;
    announce(`Playing ${LEVELS[index].name}. Reach the exit unseen.`);
  }

  function endLevel() {
    lastStars = world.stars();
    stars[world.state.levelIndex] = Math.max(stars[world.state.levelIndex] || 0, lastStars);
    saveStars(stars);
    totalScore += world.state.score;
    totalStars = stars.reduce((a, b) => a + b, 0);
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    if (world.state.levelIndex >= LEVELS.length - 1) {
      screen = SCREEN_GAME_CLEAR;
      audio.win();
      announce(`Heist complete. Total score ${totalScore}.`);
    } else {
      screen = SCREEN_CLEAR;
      audio.levelClear();
      announce(`Level clear. ${lastStars} stars.`);
    }
  }

  function endCaught() {
    screen = SCREEN_CAUGHT;
    audio.caught();
    announce(`Caught in ${world.state.level.name}. Press R to try again.`);
  }

  function handleClick(click) {
    if (!click) return;
    if (screen === SCREEN_TITLE) {
      for (let i = 0; i < LEVELS.length; i += 1) {
        const card = renderer.levelCardRect(i);
        if (click.x >= card.x && click.x <= card.x + card.w && click.y >= card.y && click.y <= card.y + card.h) {
          audio.click();
          startLevel(i);
          return;
        }
      }
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const mapX = click.x - MAP_X;
    const mapY = click.y - MAP_Y;
    if (mapX < 0 || mapY < 0 || mapX >= MAP_W || mapY >= MAP_H) return;
    const ptx = Math.floor(world.state.player.x / TILE);
    const pty = Math.floor(world.state.player.y / TILE);
    const ttx = Math.floor(mapX / TILE);
    const tty = Math.floor(mapY / TILE);
    const path = world.findSafePath(ptx, pty, ttx, tty);
    if (path) clickPath = path;
  }

  function handleActions() {
    const actions = input.takeActions();
    const levelSelect = input.takeLevelSelect();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (levelSelect >= 1 && levelSelect <= LEVELS.length) {
      selectedLevel = levelSelect - 1;
      if (screen === SCREEN_TITLE) startLevel(selectedLevel);
      return;
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startLevel(selectedLevel);
      return;
    }
    if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (actions & ACTION_RESTART) {
        startLevel(world.state.levelIndex);
      } else if (actions & ACTION_HINT) {
        const s = world.state;
        s.hintUntil = s.now + 3;
        const ptx = Math.floor(s.player.x / TILE);
        const pty = Math.floor(s.player.y / TILE);
        const etx = Math.floor(s.exit.x / TILE);
        const ety = Math.floor(s.exit.y / TILE);
        s.hintPath = world.findSafePath(ptx, pty, etx, ety);
        announce('Hint: gold dashes are guard patrols, green is the safe path.');
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      } else if (actions & ACTION_RESTART) startLevel(world.state.levelIndex);
      else if (actions & ACTION_MENU) screen = SCREEN_TITLE;
      return;
    }
    if (screen === SCREEN_CAUGHT) {
      if (actions & ACTION_RESTART) startLevel(world.state.levelIndex);
      else if (actions & ACTION_MENU) screen = SCREEN_TITLE;
      return;
    }
    if (screen === SCREEN_CLEAR) {
      if (actions & ACTION_CONFIRM) startLevel(world.state.levelIndex + 1);
      else if (actions & ACTION_RESTART) startLevel(world.state.levelIndex);
      else if (actions & ACTION_MENU) screen = SCREEN_TITLE;
      return;
    }
    if (screen === SCREEN_GAME_CLEAR) {
      if (actions & ACTION_RESTART) {
        totalScore = 0;
        startLevel(0);
      } else if (actions & (ACTION_MENU | ACTION_CONFIRM)) screen = SCREEN_TITLE;
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0 }, true);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const dir = input.direction();
    if (Math.hypot(dir.x, dir.y) > 0.01) clickPath = null;
    const events = world.step(STEP, { x: dir.x, y: dir.y, sneak: input.sneaking(), clickPath }, false);
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_SUSPICIOUS) audio.suspicious();
    if (events & EVENT_HEARD) audio.suspicious();
    if (events & EVENT_ALERT) audio.alert();
    if (events & EVENT_CAUGHT) endCaught();
    else if (events & EVENT_WIN) endLevel();
    if (world.state.player.moving && !world.state.player.sneaking) audio.step();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    handleClick(input.takeClick());
    while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
      step();
      accumulator -= STEP;
    }
    if (screen !== SCREEN_TITLE && screen !== SCREEN_PLAY) accumulator = 0;
    renderer.draw(world.state, screen, ui());
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // Debug handle for the play-test harness: lets a scripted check drive the
  // world directly and read the outcome.
  window.__game = { world, renderer, input, audio, get screen() { return screen; } };

  announce('Shadow Lantern. Press Space or click a level to play.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
