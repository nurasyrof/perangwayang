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

// Connected pads in a stable order (browsers can leave holes in getGamepads()).
export function connectedPads() {
  const raw = navigator.getGamepads ? navigator.getGamepads() : [];
  const out = [];
  for (const p of raw) if (p && p.connected) out.push(p);
  return out;
}

const DEAD = 0.45;
function padState(p) {
  const b = (i) => !!(p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > 0.5));
  const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
  // Standard layout: 0 A/✕, 1 B/○, 2 X/□, 3 Y/△, 4 LB, 5 RB, 6 LT, 7 RT, 8 Back, 9 Start, 12-15 D-pad
  return {
    left: b(14) || ax < -DEAD, right: b(15) || ax > DEAD, up: b(12) || ay < -0.6, down: b(13) || ay > 0.6,
    punch: b(2), kick: b(0), roll: b(1), ult: b(3) || b(7), block: b(4) || b(5) || b(6),
    start: b(9), select: b(8),
  };
}

// slot >= 0: that pad; slot === ANY_PAD: every connected pad merged
export const ANY_PAD = -2;
function readPad(slot) {
  const pads = connectedPads();
  if (slot === ANY_PAD) {
    if (!pads.length) return null;
    const m = {};
    for (const p of pads) {
      const st = padState(p);
      for (const k in st) m[k] = m[k] || st[k];
    }
    return m;
  }
  const p = pads[slot];
  return p ? padState(p) : null;
}

export function rumble(slot, strong = 0.5, weak = 0.5, ms = 80) {
  const pads = connectedPads();
  const list = slot === ANY_PAD ? pads : pads[slot] ? [pads[slot]] : [];
  for (const p of list) {
    const act = p.vibrationActuator;
    if (act && act.playEffect) {
      act.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak }).catch(() => {});
    }
  }
}

export class KeyController {
  constructor(map, padIndex = -1, layout = 'solo') {
    this.map = map;
    this.padIndex = padIndex;
    this.layout = layout;
    this.device = padIndex !== -1 && readPad(padIndex) ? 'pad' : 'kb';
    this.held = emptyState();
    this.prev = emptyState();
    this.pressed = emptyState();
  }
  update() {
    const pad = this.padIndex !== -1 ? readPad(this.padIndex) : null;
    for (const b of BUTTONS) {
      this.prev[b] = this.held[b];
      const k = this.map[b].some((c) => down.has(c));
      const g = !!(pad && pad[b]);
      // remember the last device used, so the on-screen guide shows matching labels
      if (k && !this.prevKey?.[b]) this.device = 'kb';
      if (g && !this.prevPad?.[b]) this.device = 'pad';
      (this.prevKey ||= {})[b] = k;
      (this.prevPad ||= {})[b] = g;
      const v = k || g;
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
  rumble(strong, weak, ms) {
    if (this.padIndex !== -1) rumble(this.padIndex, strong, weak, ms);
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
    now.pause = false;
    now.guide = false;
    const pads = connectedPads();
    pads.forEach((pad, i) => {
      const p = padState(pad);
      now.up ||= p.up; now.down ||= p.down; now.left ||= p.left; now.right ||= p.right;
      now.ok ||= p.kick || p.punch; now.back ||= p.roll;
      now.pause ||= p.start;
      now.guide ||= p.select;
      if (i < 2) {
        const pre = i === 0 ? 'p1' : 'p2';
        now[pre + 'left'] ||= p.left; now[pre + 'right'] ||= p.right; now[pre + 'ok'] ||= p.kick || p.punch; now[pre + 'back'] ||= p.roll;
      }
    });
    const pressed = {};
    for (const k in now) pressed[k] = now[k] && !this.prev[k];
    this.prev = now;
    return pressed;
  }
}

export function isDown(code) {
  return down.has(code);
}
