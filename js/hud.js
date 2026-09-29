import { drawPortrait } from './textures.js';
import { ULT_MAX } from './fighter.js';

const $ = (id) => document.getElementById(id);

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

  update(fighters, time) {
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
