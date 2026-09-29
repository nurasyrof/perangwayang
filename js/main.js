import { Stage } from './stage.js';
import { AudioEngine } from './audio.js';
import { FX } from './fx.js';
import { HUD } from './hud.js';
import { Fighter, overlap, resolveHit, STAGE_HALF, MAX_SEP, ULT_MAX } from './fighter.js';
import { CHARACTERS } from './characters.js';
import { KeyController, KEYMAPS, MenuInput, initKeyboard, BUTTONS } from './input.js';
import { BotController } from './ai.js';
import { CINE_FRAMES } from './ultimates.js';
import { drawPortrait } from './textures.js';

const STEP = 1 / 60;
const ROUND_TIME = 60;
const $ = (id) => document.getElementById(id);

class NullController {
  constructor() {
    this.held = {};
    this.pressed = {};
    for (const b of BUTTONS) this.held[b] = this.pressed[b] = false;
  }
  update() {}
}

class MenuNav {
  constructor(el, onChoose, audio) {
    this.el = el;
    this.buttons = [...el.querySelectorAll('button')];
    this.i = 0;
    this.onChoose = onChoose;
    this.audio = audio;
    this.buttons.forEach((b, i) => {
      b.addEventListener('mouseenter', () => { this.i = i; this.render(); });
      b.addEventListener('click', () => { this.i = i; this.choose(); });
    });
    this.render();
  }
  move(d) {
    this.i = (this.i + d + this.buttons.length) % this.buttons.length;
    this.audio.uiMove();
    this.render();
  }
  render() { this.buttons.forEach((b, i) => b.classList.toggle('sel', i === this.i)); }
  choose() {
    this.audio.init();
    this.audio.uiSelect();
    this.onChoose(this.buttons[this.i]);
  }
}

class Game {
  constructor() {
    this.stage = new Stage($('stage'));
    this.scene = this.stage.scene;
    this.audio = new AudioEngine();
    this.fx = new FX(this.scene, this.stage.camera);
    this.hud = new HUD();
    this.menuInput = new MenuInput();
    initKeyboard();

    this.frame = 0;
    this.hitstop = 0;
    this.slow = 0;
    this.acc = 0;
    this.time = 0;
    this.entities = [];
    this.fighterCache = new Map();
    this.fighters = [];
    this.phase = 'title';
    this.overlay = null; // pause | controls | result
    this.mode = 'cpu';
    this.diff = 1;
    this.sel = { step: 'p1', p1: 0, p2: 1, lock1: false, lock2: false };
    this.nullCtrl = new NullController();
    this.cine = null;

    this.buildMenus();
    this.buildSelect();
    this.setPair(0, 1);
    this.fighters.forEach((f) => (f.ctrl = this.nullCtrl));
    this.stage.mode = 'orbit';
    this.audio.setMusic('menu');

    const unlock = () => {
      this.audio.init();
      this.audio.setMusic(this.audio.mode || 'menu');
    };
    window.addEventListener('keydown', unlock, { once: false });
    window.addEventListener('pointerdown', unlock, { once: false });
    window.addEventListener('keydown', (e) => this.onKey(e));

    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
    setTimeout(() => $('loading').classList.add('done'), 300);
  }

  // ================================================================ setup
  getFighter(ci, idx) {
    const key = `${CHARACTERS[ci].id}_${idx}`;
    let f = this.fighterCache.get(key);
    if (!f) {
      f = new Fighter(this, CHARACTERS[ci], idx);
      this.fighterCache.set(key, f);
    }
    return f;
  }

  setPair(c1, c2) {
    for (const f of this.fighterCache.values()) this.scene.remove(f.puppet.root);
    const a = this.getFighter(c1, 0);
    const b = this.getFighter(c2, 1);
    this.scene.add(a.puppet.root, b.puppet.root);
    this.fighters = [a, b];
    a.resetRound(-2.3, 1);
    b.resetRound(2.3, -1);
    a.meter = b.meter = 0;
    return this.fighters;
  }

  opponentOf(f) {
    return this.fighters[0] === f ? this.fighters[1] : this.fighters[0];
  }

  buildMenus() {
    this.titleMenu = new MenuNav($('title-menu'), (b) => {
      const m = b.dataset.mode;
      if (m === 'controls') return this.openControls('title');
      this.mode = m;
      this.openSelect();
    }, this.audio);
    this.pauseMenu = new MenuNav($('pause-menu'), (b) => {
      const a = b.dataset.act;
      if (a === 'resume') this.setPause(false);
      else if (a === 'moves') this.openControls('pause');
      else if (a === 'restart') { this.setPause(false); this.startMatch(); }
      else if (a === 'select') { this.setPause(false); this.openSelect(); }
      else if (a === 'quit') { this.setPause(false); this.openTitle(); }
    }, this.audio);
    this.resultMenu = new MenuNav($('result-menu'), (b) => {
      const a = b.dataset.act;
      this.showScreen('result', false);
      this.overlay = null;
      if (a === 'restart') this.startMatch();
      else if (a === 'select') this.openSelect();
      else this.openTitle();
    }, this.audio);
    this.controlsMenu = new MenuNav($('screen-controls').querySelector('.menu'), () => this.closeControls(), this.audio);
    document.querySelectorAll('#diff-row button').forEach((b) => {
      b.addEventListener('click', () => {
        this.audio.init();
        this.setDiff(+b.dataset.diff);
      });
    });
  }

  setDiff(d) {
    this.diff = Math.max(0, Math.min(2, d));
    document.querySelectorAll('#diff-row button').forEach((b) => b.classList.toggle('on', +b.dataset.diff === this.diff));
    this.audio.uiMove();
  }

  showScreen(name, v) {
    $(`screen-${name}`).classList.toggle('hidden', !v);
  }

  hideAllScreens() {
    for (const n of ['title', 'select', 'pause', 'controls', 'result']) this.showScreen(n, false);
  }

  openTitle() {
    this.hideAllScreens();
    this.overlay = null;
    this.phase = 'title';
    this.hud.show(false);
    this.hud.clearAnnounce();
    this.clearEntities();
    this.cine = null;
    this.stage.mode = 'orbit';
    this.stage.centerGTarget = 1;
    this.stage.setMood(0x000000, 0);
    this.showScreen('title', true);
    this.setPair(this.sel.p1, this.sel.p2);
    this.fighters.forEach((f) => (f.ctrl = this.nullCtrl));
    this.audio.setMusic('menu');
  }

  openControls(from) {
    this.controlsFrom = from;
    this.showScreen('controls', true);
    this.overlay = 'controls';
  }

  closeControls() {
    this.showScreen('controls', false);
    this.overlay = this.controlsFrom === 'pause' ? 'pause' : null;
  }

  setPause(v) {
    this.paused = v;
    this.overlay = v ? 'pause' : null;
    this.showScreen('pause', v);
    if (v) this.pauseMenu.i = 0, this.pauseMenu.render();
  }

  // ================================================================ select
  buildSelect() {
    const grid = $('sel-grid');
    this.cards = CHARACTERS.map((c, i) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `<canvas width="240" height="240"></canvas><span class="tag t1">P1</span><span class="tag t2">P2</span><div class="cn">${c.name}</div><div class="ca">${c.aksara}</div>`;
      drawPortrait(card.querySelector('canvas'), c.look);
      card.addEventListener('mouseenter', () => this.selHover(i));
      card.addEventListener('click', () => {
        this.audio.init();
        this.selHover(i);
        this.selConfirm(this.activeSelector());
      });
      grid.appendChild(card);
      return card;
    });
  }

  activeSelector() {
    if (this.mode === 'versus') return this.sel.lock1 ? 2 : 1;
    return this.sel.step === 'p1' ? 1 : 2;
  }

  selHover(i) {
    const who = this.activeSelector();
    if (who === 1 && !this.sel.lock1) this.sel.p1 = i;
    else if (who === 2 && !this.sel.lock2) this.sel.p2 = i;
    this.renderSelect();
  }

  openSelect() {
    this.hideAllScreens();
    this.overlay = null;
    this.phase = 'select';
    this.hud.show(false);
    this.hud.clearAnnounce();
    this.clearEntities();
    this.cine = null;
    this.stage.mode = 'select';
    this.stage.centerGTarget = 0;
    this.stage.setMood(0x000000, 0);
    this.sel.step = 'p1';
    this.sel.lock1 = this.sel.lock2 = false;
    this.showScreen('select', true);
    $('diff-row').style.visibility = this.mode === 'cpu' ? 'visible' : 'hidden';
    $('sel-help').innerHTML = this.mode === 'versus'
      ? 'P1: A / D + F &nbsp;·&nbsp; P2: ← / → + , &nbsp;·&nbsp; Esc kembali'
      : 'A / D pilih · J konfirmasi · K kembali' + (this.mode === 'cpu' ? ' · ↑ / ↓ tingkat bot' : '');
    this.audio.setMusic('menu');
    this.renderSelect();
  }

  renderSelect() {
    const s = this.sel;
    this.cards.forEach((c, i) => {
      c.classList.toggle('p1', s.p1 === i);
      const showP2 = this.mode === 'versus' || s.step === 'p2';
      c.classList.toggle('p2', showP2 && s.p2 === i);
      c.querySelector('.t1').style.display = s.p1 === i ? '' : 'none';
      c.querySelector('.t2').style.display = showP2 && s.p2 === i ? '' : 'none';
    });
    const title = $('sel-title');
    const sub = $('sel-sub');
    if (this.mode === 'versus') {
      title.textContent = 'PILIH KSATRIA';
      sub.textContent = `P1 ${s.lock1 ? '✓' : '…'}   ·   P2 ${s.lock2 ? '✓' : '…'}`;
    } else {
      title.textContent = s.step === 'p1' ? 'PILIH KSATRIA' : 'PILIH LAWAN';
      sub.textContent = s.step === 'p1' ? 'Pemain 1' : this.mode === 'training' ? 'Boneka latihan' : 'Lawan (Bot)';
    }
    this.renderInfo($('info-p1'), CHARACTERS[s.p1], 'PEMAIN 1');
    const showP2 = this.mode === 'versus' || s.step === 'p2';
    if (showP2) this.renderInfo($('info-p2'), CHARACTERS[s.p2], this.mode === 'versus' ? 'PEMAIN 2' : this.mode === 'training' ? 'BONEKA' : 'BOT');
    else $('info-p2').innerHTML = '';

    // live 3D preview
    const [a, b] = this.fighters;
    if (a.def !== CHARACTERS[s.p1] || b.def !== CHARACTERS[s.p2] || !showP2 !== !this.previewShowP2) {
      this.setPair(s.p1, s.p2);
      this.fighters.forEach((f) => (f.ctrl = this.nullCtrl));
      this.fighters[1].puppet.root.visible = showP2;
      this.previewShowP2 = showP2;
      this.fighters[0].x = -1.7;
      this.fighters[1].x = 1.7;
    }
    this.fighters[0].state = s.lock1 || s.step === 'p2' ? 'victory' : 'intro';
    this.fighters[1].state = s.lock2 ? 'victory' : 'intro';
  }

  renderInfo(el, c, who) {
    const stats = Object.entries(c.stats).map(([k, v]) =>
      `<div class="stat"><span>${k}</span>${[1, 2, 3, 4, 5].map((n) => `<i class="${n <= v ? 'on' : ''}"></i>`).join('')}</div>`).join('');
    el.innerHTML = `<div class="who">${who}</div><div class="nm">${c.name}</div><div class="tt">${c.title}</div>${stats}
      <div class="ul">Aji: <b>${c.ult.name}</b> — ${c.ult.desc}</div><div class="tr">${c.trait}</div>`;
  }

  selConfirm(who) {
    const s = this.sel;
    this.audio.uiSelect();
    if (this.mode === 'versus') {
      if (who === 1) s.lock1 = true;
      else s.lock2 = true;
      this.renderSelect();
      if (s.lock1 && s.lock2) setTimeout(() => this.phase === 'select' && this.startMatch(), 500);
      return;
    }
    if (s.step === 'p1') {
      s.step = 'p2';
      if (s.p2 === s.p1) s.p2 = (s.p1 + 1) % CHARACTERS.length;
      this.renderSelect();
    } else {
      s.lock2 = true;
      this.renderSelect();
      setTimeout(() => this.phase === 'select' && this.startMatch(), 450);
    }
  }

  selBack(who) {
    const s = this.sel;
    this.audio.uiBack();
    if (this.mode === 'versus') {
      if (who === 1 && s.lock1) s.lock1 = false;
      else if (who === 2 && s.lock2) s.lock2 = false;
      else return this.openTitle();
    } else if (s.step === 'p2' && !s.lock2) s.step = 'p1';
    else if (s.step === 'p1') return this.openTitle();
    this.renderSelect();
  }

  selectInput(m) {
    const s = this.sel;
    const n = CHARACTERS.length;
    if (this.mode === 'versus') {
      if (!s.lock1 && (m.p1left || m.p1right)) { s.p1 = (s.p1 + (m.p1left ? -1 : 1) + n) % n; this.audio.uiMove(); this.renderSelect(); }
      if (!s.lock2 && (m.p2left || m.p2right)) { s.p2 = (s.p2 + (m.p2left ? -1 : 1) + n) % n; this.audio.uiMove(); this.renderSelect(); }
      if (m.p1ok && !s.lock1) this.selConfirm(1);
      if (m.p2ok && !s.lock2) this.selConfirm(2);
      if (m.p1back) this.selBack(1);
      if (m.p2back) this.selBack(2);
      return;
    }
    const key = s.step === 'p1' ? 'p1' : 'p2';
    if (s.lock2) return;
    if (m.left || m.right) {
      s[key] = (s[key] + (m.left ? -1 : 1) + n) % n;
      this.audio.uiMove();
      this.renderSelect();
    }
    if (this.mode === 'cpu' && (m.up || m.down)) this.setDiff(this.diff + (m.up ? 1 : -1));
    if (m.ok) this.selConfirm(s.step === 'p1' ? 1 : 2);
    else if (m.back) this.selBack(1);
  }

  // ================================================================ match flow
  startMatch() {
    this.hideAllScreens();
    this.overlay = null;
    this.paused = false;
    const [a, b] = this.setPair(this.sel.p1, this.sel.p2);
    b.puppet.root.visible = true;
    a.wins = b.wins = 0;
    if (this.mode === 'versus') {
      a.ctrl = new KeyController(KEYMAPS.p1, 0);
      b.ctrl = new KeyController(KEYMAPS.p2, 1);
    } else {
      a.ctrl = new KeyController(KEYMAPS.solo, 0);
      b.ctrl = new BotController(this, this.diff, this.mode === 'training');
      b.ctrl.me = b;
    }
    this.round = 1;
    this.hud.show(true);
    this.stage.centerGTarget = 0;
    this.audio.setMusic('fight');
    this.startRound();
  }

  startRound() {
    this.clearEntities();
    this.fx.clear();
    this.cine = null;
    const [a, b] = this.fighters;
    a.resetRound(-2.3, 1);
    b.resetRound(2.3, -1);
    this.timer = ROUND_TIME;
    this.phase = 'intro';
    this.introT = 0;
    this.slow = 0;
    this.hitstop = 0;
    this.winner = null;
    this.stage.mode = 'fight';
    this.stage.setMood(0x000000, 0);
    this.hud.setup(this.fighters, this.mode === 'training');
    this.hud.clearAnnounce();
    if (this.mode === 'training') {
      a.meter = ULT_MAX;
      this.introT = 70;
    }
  }

  introStep() {
    this.introT++;
    const t = this.introT;
    const [a, b] = this.fighters;
    if (t === 1) {
      const final = a.wins === 1 && b.wins === 1;
      this.hud.announce(final ? 'BABAK PAMUNGKAS' : `BABAK ${this.round}`, { sub: final ? 'ꦥꦩꦸꦁꦏꦱ꧀' : '', small: final });
      this.audio.roundStart();
    }
    if (t === 72) {
      this.hud.announce(this.mode === 'training' ? 'LATIHAN' : 'TARUNG!', { sub: 'ꦥꦼꦫꦁ' });
      this.audio.fightStart();
      this.stage.shake(0.15);
    }
    if (t >= 84) {
      this.phase = 'fight';
      a.toNeutral();
      b.toNeutral();
    }
  }

  clearEntities() {
    for (const e of this.entities) e.dispose?.();
    this.entities.length = 0;
  }

  // ================================================================ events
  startCinematic(f) {
    this.cine = { caster: f, t: 0 };
    this.stage.mode = 'cine';
    this.hud.ultBanner(f);
    this.hud.flash('#' + f.def.ult.color.toString(16).padStart(6, '0'), 0.35);
    this.audio.ultCharge();
    this.stage.setMood(f.def.ult.color, 14);
    this.stage.bloom.strength = 0.95;
  }

  onHit(att, def, dmg, h, counter, pos) {
    const heavy = h.heavy || h.isUlt;
    const sfx = h.sfx || 'punch';
    if (sfx === 'kick') this.audio.kick(heavy ? 1.2 : 1);
    else if (sfx === 'heavy') this.audio.heavy();
    else if (sfx === 'slash') this.audio.slash();
    else if (sfx === 'arrowhit') this.audio.arrowHit();
    else if (sfx === 'ult') { this.audio.heavy(); this.audio.boom(0.7); }
    else this.audio.punch();
    const color = h.isUlt ? att.def.ult.color : counter ? 0xff6a3a : 0xffc860;
    this.fx.hit(pos, color, heavy);
    this.hitstop = Math.max(this.hitstop, h.isUlt && heavy ? 12 : heavy ? 8 : 5);
    this.stage.shake(heavy ? 0.28 : 0.1);
    def.puppet.flash(0xffffff, 6);
    this.hud.combo(att.idx, def.comboTaken, def.comboDmg, counter ? 'KONTER!' : null);
    if (h.isUlt && heavy) this.hud.flash('#fff', 0.35);
  }

  onBlock(att, def, pos, h) {
    this.audio.block();
    this.fx.block(pos);
    this.hitstop = Math.max(this.hitstop, h.isUlt ? 6 : 4);
    def.puppet.flash(0x6fc8ff, 5);
    if (h.guardCrush) {
      this.stage.shake(0.12);
      this.hud.combo(att.idx, 0, 0, 'TEMBUS!');
    }
  }

  onParry(def, att, pos) {
    this.audio.parry();
    this.fx.ring(pos, 0xffd76a, 2.6, 18);
    this.fx.burst(pos.x, pos.y, pos.z, 0xffe39a, 24, 0.2);
    this.hitstop = 14;
    def.puppet.flash(0xffd76a, 10);
    this.hud.combo(def.idx, 0, 0, 'TANGKIS SEMPURNA!');
    this.hud.flash('#ffe7a0', 0.25);
  }

  onArmor(def, pos) {
    this.audio.block();
    this.audio.punch(0.6);
    this.fx.hit(pos, 0xff4a2a, false);
    this.hitstop = 6;
    def.puppet.flash(0xff3a1a, 8);
    this.hud.combo(def.idx, 0, 0, 'KEBAL!');
  }

  onUltReady(f) {
    this.audio.ultReady();
    this.fx.ring({ x: f.x, y: f.y + 1.2, z: 0.4 }, f.def.ult.color, 2.5, 22);
  }

  onKO(att, def) {
    if (this.mode === 'training') {
      def.hp = def.maxHp;
      def.state = 'launched';
      return;
    }
    if (this.phase !== 'fight') return;
    this.phase = 'ko';
    this.koT = 0;
    this.winner = att;
    att.wins++;
    this.slow = 80;
    this.hitstop = 18;
    this.audio.ko();
    this.stage.shake(0.6);
    this.hud.flash('#fff', 0.8);
    const perfect = att.hp >= att.maxHp;
    this.hud.announce('K.O.', { sub: perfect ? 'SEMPURNA!' : '', red: true });
  }

  timeUp() {
    const [a, b] = this.fighters;
    this.phase = 'ko';
    this.koT = 30;
    const ra = a.hp / a.maxHp, rb = b.hp / b.maxHp;
    this.winner = ra === rb ? null : ra > rb ? a : b;
    if (this.winner) this.winner.wins++;
    this.hud.announce('WAKTU HABIS', { small: true });
    this.audio.gong(130, this.audio.now, 0.8);
    this.fighters.forEach((f) => {
      if (f.state !== 'ult') f.toNeutral();
    });
  }

  koStep() {
    this.koT++;
    const t = this.koT;
    const w = this.winner;
    if (t === 130) {
      this.clearEntities();
      if (w) {
        w.state = 'victory';
        w.sf = 0;
        w.vx = 0;
        w.ult?.dispose?.();
        w.ult = null;
        w.noPhysics = false;
        this.stage.mode = 'victory';
        this.hud.announce(`${w.def.name}`, { sub: 'MENANG', small: true, stay: true });
      } else {
        this.hud.announce('SERI', { small: true, stay: true });
      }
    }
    if (t === 290) {
      if (w && w.wins >= 2) this.matchEnd(w);
      else {
        this.round++;
        this.startRound();
      }
    }
  }

  matchEnd(w) {
    this.phase = 'result';
    this.overlay = 'result';
    this.hud.clearAnnounce();
    this.hud.show(false);
    let title;
    if (this.mode === 'versus') title = w.idx === 0 ? 'PEMAIN 1 MENANG' : 'PEMAIN 2 MENANG';
    else title = w.idx === 0 ? 'MENANG' : 'KALAH';
    $('res-title').textContent = title;
    $('res-aksara').textContent = w.def.aksara;
    $('res-sub').textContent = `${w.def.name} — ${w.def.title}`;
    this.resultMenu.i = 0;
    this.resultMenu.render();
    this.showScreen('result', true);
    this.audio.setMusic('menu');
  }

  shake(a) { this.stage.shake(a); }
  flash(c, o) { this.hud.flash(c, o); }

  // ================================================================ simulation
  step() {
    this.frame++;
    const phase = this.phase;
    const [a, b] = this.fighters;

    if (phase === 'title' || phase === 'select' || phase === 'result') {
      a.update(b);
      b.update(a);
      a.y = b.y = 0;
      this.fx.update();
      return;
    }
    if (phase === 'intro') this.introStep();
    if (phase === 'ko') this.koStep();
    if (this.phase !== phase && this.phase !== 'fight') return;

    const live = this.phase === 'fight';
    for (const f of this.fighters) {
      if (live) f.ctrl.update();
      else if (f.ctrl.clear) f.ctrl.clear();
    }

    if (this.hitstop > 0) {
      this.hitstop--;
      for (const f of this.fighters) f.recordInputs();
      this.fx.update();
      return;
    }

    if (this.cine) {
      this.cine.t++;
      const c = this.cine.caster;
      c.update(this.opponentOf(c));
      if (this.cine.t >= CINE_FRAMES) {
        this.cine = null;
        this.stage.mode = 'fight';
        this.stage.bloom.strength = 0.55;
        this.stage.setMood(c.def.ult.color, 4);
      }
    } else {
      a.update(b);
      b.update(a);
      if (a.state !== 'ult' && b.state !== 'ult') this.stage.setMood(0x000000, 0);
    }

    this.resolveBodies(a, b);
    this.updateFacing(a, b);
    this.checkHits(a, b);

    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      if (!e.update()) {
        e.dispose?.();
        this.entities.splice(i, 1);
      }
    }

    if (this.phase === 'fight' && !this.cine && this.mode !== 'training') {
      this.timer -= STEP;
      if (this.timer <= 0) {
        this.timer = 0;
        this.timeUp();
      }
    }

    if (this.mode === 'training') {
      if (a.state !== 'ult' && a.meter < ULT_MAX) a.meter = Math.min(ULT_MAX, a.meter + 0.6);
      for (const f of this.fighters) {
        if (f.isNeutral) {
          f.regenT = (f.regenT || 0) + 1;
          if (f.regenT > 90) f.hp = Math.min(f.maxHp, f.hp + 12);
        } else f.regenT = 0;
      }
    }
    this.fx.update();
  }

  resolveBodies(a, b) {
    const skip = (f) => f.state === 'roll' || f.state === 'knockdown' || f.state === 'ko' || f.state === 'held' || f.noPhysics;
    if (!skip(a) && !skip(b) && Math.abs(a.y - b.y) < 1.5) {
      const minD = 0.36 * (a.def.scale + b.def.scale);
      const dx = b.x - a.x;
      if (Math.abs(dx) < minD) {
        const dir = Math.sign(dx) || a.facing;
        const push = (minD - Math.abs(dx)) / 2;
        a.x -= dir * push;
        b.x += dir * push;
        for (const [p, q] of [[a, b], [b, a]]) {
          if (Math.abs(p.x) > STAGE_HALF) {
            const over = Math.abs(p.x) - STAGE_HALF;
            p.x = Math.sign(p.x) * STAGE_HALF;
            q.x -= Math.sign(p.x) * over;
          }
        }
      }
    }
    // camera leash
    if (!a.noPhysics && !b.noPhysics) {
      const dx = b.x - a.x;
      if (Math.abs(dx) > MAX_SEP) {
        const s = Math.sign(dx);
        if (Math.abs(a.vx) >= Math.abs(b.vx)) a.x = b.x - s * MAX_SEP;
        else b.x = a.x + s * MAX_SEP;
      }
    }
  }

  updateFacing(a, b) {
    for (const [f, o] of [[a, b], [b, a]]) {
      const canTurn = f.grounded && (f.isNeutral || f.state === 'land' || f.state === 'intro' || f.state === 'getup' || f.state === 'blockstun' || f.state === 'hitstun');
      const dx = o.x - f.x;
      if (canTurn && Math.abs(dx) > 0.15) f.facing = Math.sign(dx);
    }
  }

  checkHits(a, b) {
    const ha = a.hitbox();
    const hb = b.hitbox();
    const hurtA = a.hurtbox();
    const hurtB = b.hurtbox();
    const hits = [];
    if (ha && overlap(ha, hurtB)) hits.push([a, b, ha, hurtB]);
    if (hb && overlap(hb, hurtA)) hits.push([b, a, hb, hurtA]);
    for (const [att, def, box, hurt] of hits) {
      const m = att.move;
      if (!m) continue;
      att.moveHitDone = true;
      const pos = {
        x: (Math.max(box.x0, hurt.x0) + Math.min(box.x1, hurt.x1)) / 2,
        y: (Math.max(box.y0, hurt.y0) + Math.min(box.y1, hurt.y1)) / 2,
        z: 0.35,
      };
      const r = resolveHit(this, att, def, {
        dmg: m.dmg, type: m.type, hitstun: m.hitstun, blockstun: m.blockstun, push: m.push,
        launch: m.launch, heavy: m.heavy, guardCrush: m.guardCrush, chip: m.chip, sfx: m.sfx, pos,
      });
      if (r !== 'miss') att.moveConnected = true;
      else att.moveHitDone = false;
    }
  }

  // ================================================================ input / loop
  onKey(e) {
    if (e.code === 'KeyM') {
      this.audio.init();
      const on = this.audio.toggleMusic();
      if (this.phase === 'fight' || this.phase === 'intro') this.hud.combo(0, 0, 0, on ? 'MUSIK ON' : 'MUSIK OFF');
    }
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (this.overlay === 'controls') return this.closeControls();
      if (this.phase === 'fight' || this.phase === 'intro' || this.phase === 'ko') {
        this.setPause(!this.paused);
      }
    }
  }

  menuStep() {
    const m = this.menuInput.poll();
    let nav = null;
    if (this.overlay === 'pause') nav = this.pauseMenu;
    else if (this.overlay === 'result') nav = this.resultMenu;
    else if (this.overlay === 'controls') nav = this.controlsMenu;
    else if (this.phase === 'title') nav = this.titleMenu;
    else if (this.phase === 'select') return this.selectInput(m);
    if (!nav) return;
    if (m.up) nav.move(-1);
    if (m.down) nav.move(1);
    if (m.ok) nav.choose();
    else if (m.back && this.overlay === 'controls') this.closeControls();
  }

  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    this.menuStep();

    if (!this.paused) {
      const scale = this.slow > 0 ? 0.3 : 1;
      this.acc += dt * scale;
      let n = 0;
      while (this.acc >= STEP && n < 4) {
        this.step();
        if (this.slow > 0) this.slow--;
        this.acc -= STEP;
        n++;
      }
      if (n >= 4) this.acc = 0;
    }

    for (const f of this.fighters) f.render(this.time);
    this.stage.update(dt);
    this.stage.updateCamera(dt, { fighters: this.fighters, caster: this.cine?.caster, winner: this.winner });
    if (this.phase === 'intro' || this.phase === 'fight' || this.phase === 'ko') {
      this.hud.update(this.fighters, this.mode === 'training' ? null : this.timer);
    }
    this.stage.render();
  }
}

window.game = new Game();
