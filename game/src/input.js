// Keyboard and pointer input. Held keys give a two-axis steering vector; one-shot
// presses (confirm, pause, interact, punch, handbrake, radio, mute) are queued as bit
// flags and taken once by the loop, so a press between two frames is never lost.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_PUNCH = 8;
export const ACTION_HANDBRAKE = 16;
export const ACTION_RADIO = 32;
export const ACTION_MUTE = 64;

const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};

export function createInput(target) {
  const held = { up: false, down: false, left: false, right: false };
  let actions = 0;

  function press(code, event) {
    if (KEYMAP[code]) {
      held[KEYMAP[code]] = true;
    } else if (code === 'Space' || code === 'Enter') {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (code === 'KeyP' || code === 'Escape') {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (code === 'KeyE') {
      if (!event.repeat) actions |= ACTION_INTERACT;
    } else if (code === 'KeyF') {
      if (!event.repeat) actions |= ACTION_PUNCH;
    } else if (code === 'ShiftLeft' || code === 'ShiftRight') {
      if (!event.repeat) actions |= ACTION_HANDBRAKE;
    } else if (code === 'KeyR') {
      if (!event.repeat) actions |= ACTION_RADIO;
    } else if (code === 'KeyM') {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else {
      return;
    }
    event.preventDefault();
  }

  window.addEventListener('keydown', (event) => press(event.code, event));
  window.addEventListener('keyup', (event) => {
    const dir = KEYMAP[event.code];
    if (dir) held[dir] = false;
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    held.up = held.down = held.left = held.right = false;
  });
  target.addEventListener('pointerdown', () => {
    actions |= ACTION_CONFIRM;
  });

  return {
    /** { x: -1..1, y: -1..1 } steering vector from the held keys. */
    vector() {
      return {
        x: (held.right ? 1 : 0) - (held.left ? 1 : 0),
        y: (held.down ? 1 : 0) - (held.up ? 1 : 0),
      };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
