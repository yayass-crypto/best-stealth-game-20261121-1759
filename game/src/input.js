// Shadow Lantern — keyboard + mouse input.
// Keys are read as a held set each frame; one-shot actions (confirm, pause,
// restart, hint, mute, level select) are queued and taken by the main loop.
// A mouse click sets a click-to-move target in canvas pixels.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_HINT = 8;
export const ACTION_MUTE = 16;
export const ACTION_MENU = 32;

const LEVEL_KEYS = { Digit1: 0, Digit2: 1, Digit3: 2 };

export function createInput(canvas) {
  const held = new Set();
  let queued = 0;
  let clickTarget = null;
  let clickConsumed = true;

  function keyDown(event) {
    const code = event.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) event.preventDefault();
    if (event.repeat) return;
    held.add(code);
    if (code === 'Space' || code === 'Enter') queued |= ACTION_CONFIRM;
    else if (code === 'Escape') queued |= ACTION_PAUSE;
    else if (code === 'KeyR') queued |= ACTION_RESTART;
    else if (code === 'KeyH') queued |= ACTION_HINT;
    else if (code === 'KeyM') queued |= ACTION_MUTE;
    else if (code === 'KeyQ') queued |= ACTION_MENU;
    else if (code in LEVEL_KEYS) queued |= (LEVEL_KEYS[code] + 1) << 8;
  }

  function keyUp(event) {
    held.delete(event.code);
  }

  function pointerDown(event) {
    const rect = canvas.getBoundingClientRect();
    clickTarget = {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
    clickConsumed = false;
  }

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  canvas.addEventListener('pointerdown', pointerDown);

  function direction() {
    let x = 0;
    let y = 0;
    if (held.has('KeyA') || held.has('ArrowLeft')) x -= 1;
    if (held.has('KeyD') || held.has('ArrowRight')) x += 1;
    if (held.has('KeyW') || held.has('ArrowUp')) y -= 1;
    if (held.has('KeyS') || held.has('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.SQRT2;
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  return {
    direction,
    sneaking() { return held.has('ShiftLeft') || held.has('ShiftRight'); },
    takeActions() {
      const actions = queued & 0xff;
      queued &= ~0xff;
      return actions;
    },
    takeLevelSelect() {
      const sel = (queued >> 8) & 0xff;
      queued &= 0xff;
      return sel;
    },
    takeClick() {
      if (clickConsumed || !clickTarget) return null;
      clickConsumed = true;
      return clickTarget;
    },
    clearClick() { clickConsumed = true; },
  };
}
