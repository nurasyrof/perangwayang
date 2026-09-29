export const BUTTONS = ['left', 'right', 'up', 'down', 'punch', 'kick', 'block', 'roll', 'ult'];

export const KEYMAPS = {
  solo: {
    left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'],
    punch: ['KeyJ', 'KeyZ'], kick: ['KeyK', 'KeyX'], block: ['KeyL', 'KeyC'], roll: ['Space', 'ShiftLeft'], ult: ['KeyU', 'KeyI', 'KeyV'],
  },
  p1: {
    left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'],
    punch: ['KeyF'], kick: ['KeyG'], block: ['KeyH'], roll: ['KeyQ'], ult: ['KeyR'],
  },
  p2: {
    left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
    punch: ['Comma', 'Numpad1'], kick: ['Period', 'Numpad2'], block: ['Slash', 'Numpad3'], roll: ['ShiftRight', 'Numpad0'], ult: ['Quote', 'Numpad5'],
  },
};

const down = new Set();
const PREVENT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Quote', 'Slash']);

export function initKeyboard() {
  window.addEventListener('keydown', (e) => {
    if (PREVENT.has(e.code)) e.preventDefault();
    down.add(e.code);
  });
  window.addEventListener('keyup', (e) => down.delete(e.code));
  window.addEventListener('blur', () => down.clear());
}

function emptyState() {
  const o = {};
  for (const b of BUTTONS) o[b] = false;
  return o;
}

function readPad(index) {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const p = pads && pads[index];
  if (!p) return null;
  const b = (i) => !!(p.buttons[i] && p.buttons[i].pressed);
  const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
  return {
    left: b(14) || ax < -0.45, right: b(15) || ax > 0.45, up: b(12) || ay < -0.6, down: b(13) || ay > 0.6,
    punch: b(2), kick: b(0), roll: b(1), ult: b(3) || b(7), block: b(4) || b(5) || b(6),
  };
}

export class KeyController {
  constructor(map, padIndex = -1) {
    this.map = map;
    this.padIndex = padIndex;
    this.held = emptyState();
    this.prev = emptyState();
    this.pressed = emptyState();
  }
  update() {
    const pad = this.padIndex >= 0 ? readPad(this.padIndex) : null;
    for (const b of BUTTONS) {
      this.prev[b] = this.held[b];
      let v = this.map[b].some((c) => down.has(c));
      if (pad && pad[b]) v = true;
      this.held[b] = v;
      this.pressed[b] = v && !this.prev[b];
    }
  }
  clear() {
    for (const b of BUTTONS) {
      this.held[b] = false;
      this.pressed[b] = false;
    }
  }
}

// Menu navigation helper: merges every keyboard layout + all pads
export class MenuInput {
  constructor() {
    this.prev = {};
  }
  poll() {
    const now = {
      up: ['KeyW', 'ArrowUp'].some((c) => down.has(c)),
      down: ['KeyS', 'ArrowDown'].some((c) => down.has(c)),
      left: ['KeyA', 'ArrowLeft'].some((c) => down.has(c)),
      right: ['KeyD', 'ArrowRight'].some((c) => down.has(c)),
      ok: ['Enter', 'KeyJ', 'Space', 'KeyF', 'Comma', 'NumpadEnter', 'Numpad1'].some((c) => down.has(c)),
      back: ['Escape', 'KeyK', 'Backspace', 'KeyG', 'Period'].some((c) => down.has(c)),
      p1left: down.has('KeyA'), p1right: down.has('KeyD'), p1ok: down.has('KeyJ') || down.has('KeyF'), p1back: down.has('KeyK') || down.has('KeyG'),
      p2left: down.has('ArrowLeft'), p2right: down.has('ArrowRight'), p2ok: down.has('Comma') || down.has('Numpad1') || down.has('Enter'), p2back: down.has('Period') || down.has('Numpad2'),
    };
    for (let i = 0; i < 2; i++) {
      const p = readPad(i);
      if (!p) continue;
      now.up ||= p.up; now.down ||= p.down; now.left ||= p.left; now.right ||= p.right;
      now.ok ||= p.kick || p.punch; now.back ||= p.roll;
      const pre = i === 0 ? 'p1' : 'p2';
      now[pre + 'left'] ||= p.left; now[pre + 'right'] ||= p.right; now[pre + 'ok'] ||= p.kick || p.punch; now[pre + 'back'] ||= p.roll;
    }
    const pressed = {};
    for (const k in now) pressed[k] = now[k] && !this.prev[k];
    this.prev = now;
    return pressed;
  }
}

export function isDown(code) {
  return down.has(code);
}
