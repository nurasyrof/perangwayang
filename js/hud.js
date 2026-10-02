import { drawPortrait } from './textures.js';
import { ULT_MAX } from './fighter.js';

const $ = (id) => document.getElementById(id);

const LABELS = {
  solo: { move: 'WASD / ←→', up: 'W', down: 'S', fwd: '→', punch: 'J', kick: 'K', block: 'L', roll: 'Spasi', ult: 'U' },
  p1: { move: 'A D', up: 'W', down: 'S', fwd: 'maju', punch: 'F', kick: 'G', block: 'H', roll: 'Q', ult: 'R' },
  p2: { move: '← →', up: '↑', down: '↓', fwd: 'maju', punch: ',', kick: '.', block: '/', roll: 'Shift‑Ka', ult: "'" },
  pad: { move: 'Stik / D-pad', up: '↑', down: '↓', fwd: '→', punch: 'X □', kick: 'A ✕', block: 'RB R1', roll: 'B ○', ult: 'Y △' },
};

function guideHTML(layout, device, ultReady, def, who) {
  const L = device === 'pad' ? LABELS.pad : LABELS[layout] || LABELS.solo;
  const k = (t) => `<kbd>${t}</kbd>`;
  const row = (keys, label, cls = '') => `<div class="g-row ${cls}"><span class="g-keys">${keys}</span><span>${label}</span></div>`;
  return `<div class="g-head">${who ? who + ' · ' : ''}${device === 'pad' ? '🎮 Controller' : 'Keyboard'}</div>`
    + row(k(L.punch), 'Pukul')
    + row(k(L.kick), 'Tendang')
    + row(k(L.block), 'Tangkis')
    + row(k(L.roll), 'Guling')
    + row(k(L.up), 'Lompat' + (def.doubleJump ? ' (2×)' : ''))
    + row(k(L.ult), ultReady ? 'Aji — SIAP!' : 'Aji', ultReady ? 'g-ult' : 'g-dim')
    + '<div class="g-sep"></div>'
    + row(`${k(L.punch)}${k(L.punch)}${k(L.kick)}`, 'Kombo')
    + row(`${k(L.fwd)}+${k(L.punch)}`, 'Berat')
    + row(`${k(L.down)}+${k(L.punch)}`, 'Anti-udara')
    + row(`${k(L.down)}+${k(L.kick)}`, 'Sapuan rendah');
}

export class HUD {
  constructor() {
    this.el = $('hud');
    this.side = [0, 1].map((i) => {
      const p = `p${i + 1}`;
      return {
        hp: $(`hp-${p}`), trail: $(`trail-${p}`), ult: $(`ult-${p}`), ultBox: $(`ult-${p}`).parentElement,
        ultLbl: $(`ultlbl-${p}`), name: $(`name-${p}`), aksara: $(`aksara-${p}`), rounds: $(`rounds-${p}`),
        portrait: $(`portrait-${p}`), combo: $(`combo-${p}`), lastHp: -1, lastUlt: -1, comboTimer: 0,
      };
    });
    this.timer = $('timer');
    this.timerNum = $('timer-num');
    this.announcer = $('announcer');
    this.banner = $('ult-banner');
    this.flashEl = $('flash');
  }

  show(v) { this.el.classList.toggle('hidden', !v); }

  setup(fighters, infiniteTime) {
    fighters.forEach((f, i) => {
      const s = this.side[i];
      s.name.textContent = f.def.name;
      s.aksara.textContent = f.def.aksara;
      drawPortrait(s.portrait, f.def.look, i === 1);
      s.lastHp = -1;
      s.lastUlt = -1;
      s.combo.classList.remove('show');
    });
    this.timer.style.visibility = infiniteTime ? 'hidden' : 'visible';
  }

  // ---------------------------------------------------------------- in-fight button guide
  toggleGuide(v) {
    this.guideOn = v ?? !this.guideOn;
    try { localStorage.setItem('pw-guide', this.guideOn ? '1' : '0'); } catch (e) { /* storage blocked */ }
    this.guideKey = null;
  }

  renderGuide(fighters) {
    if (this.guideOn === undefined) {
      let saved = null;
      try { saved = localStorage.getItem('pw-guide'); } catch (e) { /* storage blocked */ }
      this.guideOn = saved !== '0';
    }
    const humans = fighters.map((f) => (f.ctrl && f.ctrl.layout ? f : null));
    const key = this.guideOn + '|' + humans.map((f) => (f ? `${f.ctrl.layout}:${f.ctrl.device}:${f.meter >= ULT_MAX}:${f.def.id}` : '-')).join('|');
    if (key === this.guideKey) return;
    this.guideKey = key;
    humans.forEach((f, i) => {
      const el = document.getElementById(`guide-p${i + 1}`);
      if (!f || !this.guideOn) {
        el.classList.remove('show');
        return;
      }
      el.innerHTML = guideHTML(f.ctrl.layout, f.ctrl.device, f.meter >= ULT_MAX, f.def, humans.filter(Boolean).length > 1 ? `P${i + 1}` : '');
      el.classList.add('show');
    });
  }

  update(fighters, time) {
    this.renderGuide(fighters);
    fighters.forEach((f, i) => {
      const s = this.side[i];
      const hp = Math.max(0, f.hp / f.maxHp) * 100;
      if (hp !== s.lastHp) {
        s.hp.style.width = hp + '%';
        s.trail.style.width = hp + '%';
        s.hp.classList.toggle('low', hp < 25);
        s.lastHp = hp;
      }
      const u = Math.floor((f.meter / ULT_MAX) * 100);
      if (u !== s.lastUlt) {
        s.ult.style.width = u + '%';
        const ready = f.meter >= ULT_MAX;
        s.ultBox.classList.toggle('ready', ready);
        s.ultLbl.textContent = ready ? `${f.def.ult.name} — SIAP!` : 'AJI';
        s.lastUlt = u;
      }
      const wins = s.rounds.children;
      for (let r = 0; r < wins.length; r++) wins[r].classList.toggle('won', f.wins > r);
      if (s.comboTimer > 0 && --s.comboTimer === 0) s.combo.classList.remove('show');
    });
    if (time != null) {
      const t = Math.ceil(time);
      if (this.timerNum.textContent !== String(t)) this.timerNum.textContent = t;
      this.timer.classList.toggle('urgent', time <= 10);
    }
  }

  combo(attIdx, hits, dmg, tag) {
    const s = this.side[attIdx];
    if (hits < 2 && !tag) return;
    s.combo.innerHTML = (hits >= 2 ? `<b>${hits}</b><span>PUKULAN</span><em>${dmg} RUSAK</em>` : '') + (tag ? `<em>${tag}</em>` : '');
    s.combo.classList.add('show');
    s.combo.classList.remove('bump');
    void s.combo.offsetWidth;
    s.combo.classList.add('bump');
    s.comboTimer = 80;
  }

  announce(text, opts = {}) {
    const a = this.announcer;
    a.className = '';
    a.innerHTML = text + (opts.sub ? `<small>${opts.sub}</small>` : '');
    void a.offsetWidth;
    a.className = (opts.stay ? 'stay' : 'go') + (opts.small ? ' small' : '') + (opts.red ? ' red' : '');
  }

  clearAnnounce() {
    this.announcer.className = '';
    this.announcer.style.opacity = 0;
    setTimeout(() => (this.announcer.style.opacity = ''), 0);
  }

  ultBanner(f) {
    const b = this.banner;
    b.querySelector('.ub-aksara').textContent = `${f.def.ult.aksara} ${f.def.ult.aksara} ${f.def.ult.aksara}`;
    b.querySelector('.ub-name').textContent = f.def.ult.name;
    b.querySelector('.ub-who').textContent = f.def.name;
    const c = '#' + f.def.ult.color.toString(16).padStart(6, '0');
    b.querySelector('.ub-name').style.textShadow = `0 0 24px ${c}, 0 3px 0 #000`;
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
  }

  toast(text, sub = '') {
    let t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      document.body.appendChild(t);
    }
    t.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    t.classList.remove('show');
    void t.offsetWidth;
    t.classList.add('show');
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => t.classList.remove('show'), 2600);
  }

  flash(color = '#fff', opacity = 0.7) {
    const f = this.flashEl;
    f.style.transition = 'none';
    f.style.background = color;
    f.style.opacity = opacity;
    void f.offsetWidth;
    f.style.transition = 'opacity .35s ease-out';
    f.style.opacity = 0;
  }
}
