// Keyboard and mouse input, read once a frame. WASD drives and walks, E gets in
// and out of cars, F punches, Space is the handbrake, P pauses, M mutes, and a
// mouse click fires the pistol.

export const KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  brake: ['Space'],
  interact: ['KeyE'],
  punch: ['KeyF'],
  pause: ['KeyP', 'Escape'],
  mute: ['KeyM'],
  radio: ['KeyR'],
};

export function createInput() {
  const down = new Set();
  const pressed = new Set();
  let mouseDown = false;
  let mousePressed = false;
  let listening = false;

  function keyDown(e) {
    if (e.repeat) return;
    down.add(e.code);
    pressed.add(e.code);
  }
  function keyUp(e) {
    down.delete(e.code);
  }
  function onMouseDown(e) {
    if (e.button === 0) {
      mouseDown = true;
      mousePressed = true;
    }
  }
  function onMouseUp(e) {
    if (e.button === 0) mouseDown = false;
  }
  function onBlur() {
    down.clear();
    mouseDown = false;
  }

  return {
    attach() {
      if (listening) return;
      listening = true;
      window.addEventListener('keydown', keyDown);
      window.addEventListener('keyup', keyUp);
      window.addEventListener('mousedown', onMouseDown);
      window.addEventListener('mouseup', onMouseUp);
      window.addEventListener('blur', onBlur);
    },
    detach() {
      if (!listening) return;
      listening = false;
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('blur', onBlur);
    },
    /** True while any of the named keys is held. */
    held(name) {
      return KEYS[name].some((code) => down.has(code));
    },
    /** True only on the frame the key went down. */
    hit(name) {
      return KEYS[name].some((code) => pressed.has(code));
    },
    get mouseDown() {
      return mouseDown;
    },
    get mousePressed() {
      return mousePressed;
    },
    /** Steering -1 (left) to 1 (right), throttle -1 to 1, from the keys. */
    axes() {
      const x = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
      const y = (this.held('up') ? 1 : 0) - (this.held('down') ? 1 : 0);
      return { x, y };
    },
    /** Clear the edge-triggered sets at the end of a frame. */
    endFrame() {
      pressed.clear();
      mousePressed = false;
    },
  };
}
