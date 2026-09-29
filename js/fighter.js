import { Puppet } from './puppet.js';
import * as P from './poses.js';
import { createUlt } from './ultimates.js';

export const GRAV = 0.016;
export const STAGE_HALF = 8.0;
export const MAX_SEP = 9.0;
export const ULT_MAX = 100;

// hb = [xStart, xEnd, yBottom, yTop] relative to feet, x along facing
// type: high (whiffs on crouch) | mid | low (crouch-block only) | overhead (stand-block only)
const BASE_MOVES = {
  jab: { startup: 5, active: 3, recovery: 10, dmg: 36, hb: [0.25, 1.1, 1.45, 1.95], type: 'high', hitstun: 16, blockstun: 10, push: 0.1, step: 0.06, pose: 'jab', chain: { punch: 'jab2', kick: 'comboKick' }, sfx: 'punch' },
  jab2: { startup: 5, active: 3, recovery: 12, dmg: 40, hb: [0.25, 1.12, 1.45, 1.95], type: 'high', hitstun: 17, blockstun: 11, push: 0.12, step: 0.08, pose: 'jab2', chain: { punch: 'jab3', kick: 'comboKick' }, sfx: 'punch' },
  jab3: { startup: 9, active: 4, recovery: 18, dmg: 70, hb: [0.25, 1.3, 1.05, 1.85], type: 'mid', hitstun: 24, blockstun: 15, push: 0.2, step: 0.13, pose: 'jab3', launch: { vx: 0.09, vy: 0.2 }, heavy: true, sfx: 'heavy' },
  kick: { startup: 9, active: 4, recovery: 15, dmg: 66, hb: [0.3, 1.55, 0.75, 1.45], type: 'mid', hitstun: 19, blockstun: 12, push: 0.15, step: 0.03, pose: 'kick', sfx: 'kick' },
  comboKick: { startup: 10, active: 5, recovery: 20, dmg: 82, hb: [0.3, 1.6, 1.0, 2.0], type: 'mid', hitstun: 24, blockstun: 15, push: 0.2, step: 0.06, pose: 'roundhouse', launch: { vx: 0.1, vy: 0.2 }, heavy: true, sfx: 'kick' },
  heavy: { startup: 15, active: 4, recovery: 21, dmg: 105, hb: [0.3, 1.45, 0.9, 1.8], type: 'mid', hitstun: 26, blockstun: 22, push: 0.3, step: 0.16, pose: 'heavy', guardCrush: true, chip: 0.2, heavy: true, sfx: 'heavy' },
  upper: { startup: 8, active: 5, recovery: 22, dmg: 78, hb: [0.05, 1.05, 0.9, 2.7], type: 'mid', hitstun: 24, blockstun: 12, push: 0.08, step: 0.05, pose: 'upper', launch: { vx: 0.05, vy: 0.33 }, heavy: true, sfx: 'heavy' },
  sweep: { startup: 11, active: 5, recovery: 21, dmg: 60, hb: [0.2, 1.75, 0.0, 0.5], type: 'low', hitstun: 20, blockstun: 12, push: 0.14, step: 0.02, pose: 'sweep', launch: { vx: 0.06, vy: 0.13 }, sfx: 'kick' },
  airP: { startup: 5, active: 9, recovery: 4, dmg: 50, hb: [0.1, 1.1, 0.5, 1.5], type: 'overhead', hitstun: 18, blockstun: 12, push: 0.12, pose: 'airP', air: true, sfx: 'punch' },
  airK: { startup: 6, active: 11, recovery: 4, dmg: 60, hb: [0.1, 1.3, -0.1, 1.0], type: 'overhead', hitstun: 20, blockstun: 13, push: 0.14, pose: 'airK', air: true, sfx: 'kick' },
};

function buildMoves(def) {
  const out = {};
  for (const [k, m] of Object.entries(BASE_MOVES)) {
    const s = def.scale * def.reach;
    out[k] = {
      ...m,
      id: k,
      startup: Math.max(3, Math.round(m.startup * def.frameMul)),
      recovery: Math.max(3, Math.round(m.recovery * def.frameMul)),
      dmg: m.dmg * def.power,
      hb: [m.hb[0] * s, m.hb[1] * s, m.hb[2] * def.scale, m.hb[3] * def.scale],
      armor: k === 'heavy' && def.armored,
    };
  }
  return out;
}

const NEUTRAL_STATES = new Set(['idle', 'walk', 'walkback', 'crouch', 'block']);
const BLOCKABLE_STATES = new Set(['idle', 'walk', 'walkback', 'crouch', 'block', 'blockstun', 'land']);

export class Fighter {
  constructor(game, def, idx) {
    this.game = game;
    this.def = def;
    this.idx = idx;
    this.puppet = new Puppet(def);
    game.scene.add(this.puppet.root);
    this.moves = buildMoves(def);
    this.maxHp = def.hp;
    this.meter = 0;
    this.wins = 0;
    this.ctrl = null;
    this.z = idx === 0 ? 0.12 : -0.12;
    this.resetRound(idx === 0 ? -2.2 : 2.2, idx === 0 ? 1 : -1);
  }

  dispose() {
    this.game.scene.remove(this.puppet.root);
    this.ult?.dispose?.();
  }

  resetRound(x, facing) {
    this.hp = this.maxHp;
    this.x = x;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.facing = facing;
    this.grounded = true;
    this.state = 'intro';
    this.sf = 0;
    this.stun = 0;
    this.invuln = 0;
    this.comboTaken = 0;
    this.comboDmg = 0;
    this.move = null;
    this.moveConnected = false;
    this.moveHitDone = false;
    this.attackActive = false;
    this.usedDouble = false;
    this.bounced = false;
    this.tick = 0;
    this.buf = { punch: -99, kick: -99, roll: -99, ult: -99 };
    this.lastBlockPress = -99;
    this.pressedUp = false;
    this.crouching = false;
    this.armor = 0;
    this.noPhysics = false;
    this.ult?.dispose?.();
    this.ult = null;
    this.walkPhase = 0;
    this.rollDir = 0;
    this.hitPose = P.HIT_HIGH;
    this.puppet.bow.visible = false;
    this.puppet.glow = 0;
    this.lastBlockStance = null;
  }

  get fwdHeld() { const h = this.ctrl.held; return this.facing > 0 ? h.right : h.left; }
  get backHeld() { const h = this.ctrl.held; return this.facing > 0 ? h.left : h.right; }
  get isNeutral() { return NEUTRAL_STATES.has(this.state); }
  get isAirborne() { return !this.grounded; }

  isInvuln() {
    return this.invuln > 0 || this.state === 'knockdown' || this.state === 'getup' || this.state === 'ko' || this.state === 'intro' || this.state === 'victory';
  }

  // Called every simulation frame (also during hit-stop) so no press is lost
  recordInputs() {
    const pr = this.ctrl.pressed;
    for (const b of ['punch', 'kick', 'roll', 'ult']) if (pr[b]) this.buf[b] = this.tick;
    if (pr.block) this.lastBlockPress = this.tick;
    this.pressedUp = this.pressedUp || pr.up;
  }

  consume(btn, window = 9) {
    if (this.tick - this.buf[btn] <= window) {
      this.buf[btn] = -99;
      return true;
    }
    return false;
  }

  setState(s) {
    if (this.state !== s) {
      this.state = s;
      this.sf = 0;
    }
  }

  // ------------------------------------------------------------------ main update
  update(opp) {
    this.tick++;
    this.recordInputs();
    if (this.invuln > 0) this.invuln--;
    this.sf++;
    this.attackActive = false;
    this.puppet.glow = this.meter >= ULT_MAX && this.state !== 'ult' ? 1 : Math.max(0, this.puppet.glow - 0.05);

    switch (this.state) {
      case 'intro':
      case 'victory':
        this.vx = 0;
        break;
      case 'idle': case 'walk': case 'walkback': case 'crouch': case 'block':
        this.updateNeutral(opp);
        break;
      case 'prejump':
        if (this.sf >= 3) this.launchJump();
        break;
      case 'jump':
        this.updateAir();
        break;
      case 'land':
        this.vx *= 0.7;
        if (this.sf >= 4) this.toNeutral();
        break;
      case 'attack':
        this.updateAttack(opp);
        break;
      case 'hitstun':
      case 'blockstun':
      case 'stagger':
        this.vx *= 0.86;
        if (--this.stun <= 0) this.toNeutral();
        break;
      case 'launched':
        this.vx *= 0.975;
        break;
      case 'knockdown':
        this.vx *= 0.8;
        if (this.sf <= 14 && this.consume('roll', 4)) {
          this.startRoll(-1, true);
          break;
        }
        if (this.sf >= 38) this.setState('getup');
        break;
      case 'getup':
        if (this.sf >= 14) {
          this.invuln = 6;
          this.toNeutral();
        }
        break;
      case 'roll':
        this.updateRoll();
        break;
      case 'ult':
        if (this.ult && this.ult.update()) {
          this.ult.dispose?.();
          this.ult = null;
          this.noPhysics = false;
          this.puppet.bow.visible = false;
          if (this.grounded) this.toNeutral();
          else this.setState('jump');
        }
        break;
      case 'held':
        this.vx = 0;
        break;
      case 'ko':
        this.vx *= 0.85;
        break;
    }

    if (!this.noPhysics) this.physics();
  }

  toNeutral() {
    this.move = null;
    this.crouching = false;
    this.comboTaken = 0;
    this.comboDmg = 0;
    this.state = 'idle';
    this.sf = 0;
    this.usedDouble = false;
  }

  tryUlt() {
    if (this.meter >= ULT_MAX && this.consume('ult', 6)) {
      this.startUlt();
      return true;
    }
    return false;
  }

  updateNeutral() {
    const h = this.ctrl.held;
    if (this.tryUlt()) return;
    if (this.consume('roll')) {
      this.startRoll(this.fwdHeld ? 1 : -1);
      return;
    }
    if (this.consume('punch')) {
      this.startMove(h.down ? 'upper' : this.fwdHeld ? 'heavy' : 'jab');
      return;
    }
    if (this.consume('kick')) {
      this.startMove(h.down ? 'sweep' : 'kick');
      return;
    }
    if (h.up) {
      this.setState('prejump');
      this.jumpDir = this.fwdHeld ? 1 : this.backHeld ? -1 : 0;
      this.vx = 0;
      return;
    }
    const spd = 0.062 * this.def.speed;
    if (h.down) {
      this.setState('crouch');
      this.vx = 0;
    } else if (h.block) {
      this.setState('block');
      this.vx = 0;
    } else if (this.fwdHeld) {
      this.setState('walk');
      this.vx = spd * this.facing;
      this.walkPhase += 0.2 * this.def.speed;
    } else if (this.backHeld) {
      this.setState('walkback');
      this.vx = -spd * 0.75 * this.facing;
      this.walkPhase -= 0.16 * this.def.speed;
    } else {
      this.setState('idle');
      this.vx = 0;
    }
  }

  launchJump() {
    this.setState('jump');
    this.grounded = false;
    this.vy = 0.29 * this.def.jump;
    this.vx = this.jumpDir * 0.078 * this.def.speed * this.facing;
    this.game.audio.jump();
    this.game.fx.dust(this.x, 0, this.z, 5);
  }

  updateAir() {
    const h = this.ctrl.held;
    if (this.tryUlt()) return;
    if (this.consume('punch', 5)) return this.startMove('airP');
    if (this.consume('kick', 5)) return this.startMove('airK');
    const upPressed = this.pressedUp;
    this.pressedUp = false;
    if (this.def.doubleJump && upPressed && !this.usedDouble && this.sf > 6) {
      this.usedDouble = true;
      this.vy = 0.2 * this.def.jump;
      const dir = (h.right ? 1 : 0) - (h.left ? 1 : 0);
      this.vx = dir * 0.085;
      this.game.audio.jump(1.4);
      this.game.fx.ring({ x: this.x, y: this.y + 0.2, z: this.z }, 0xb48cff, 1.4, 18);
    }
  }

  startMove(id) {
    const m = this.moves[id];
    this.move = m;
    this.state = 'attack';
    this.sf = 0;
    this.moveConnected = false;
    this.moveHitDone = false;
    this.armor = m.armor ? 1 : 0;
    this.crouching = id === 'sweep';
    if (!m.air) this.vx = 0;
    this.game.audio.whoosh(m.heavy ? 0.7 : 1);
  }

  updateAttack() {
    const m = this.move;
    const f = this.sf;
    const total = m.startup + m.active + m.recovery;
    if (!m.air) {
      if (f > m.startup - 3 && f <= m.startup + m.active) this.vx = (m.step || 0) * this.facing;
      else this.vx *= 0.75;
    }
    this.attackActive = f > m.startup && f <= m.startup + m.active && !this.moveHitDone;

    // super-cancel into ultimate once the move connected
    if (this.moveConnected && this.tryUlt()) return;

    // chains
    if (m.chain && f > m.startup && f < total - 1) {
      if (m.chain.punch && this.consume('punch', 12)) return this.startMove(m.chain.punch);
      if (m.chain.kick && this.consume('kick', 12)) return this.startMove(m.chain.kick);
    }

    if (m.air) {
      if (f >= total && !this.grounded) {
        this.state = 'jump';
        this.sf = 20;
        this.move = null;
      }
      return;
    }
    if (f >= total) {
      if (this.moveConnected === false && this.move.id === 'heavy') this.game.audio.tick?.();
      this.toNeutral();
    }
  }

  startRoll(dir, tech = false) {
    this.setState('roll');
    this.rollDir = dir;
    this.move = null;
    const nimble = this.def.nimble ? 1.25 : 1;
    this.rollLen = tech ? 18 : 22;
    this.rollSpeed = (tech ? 0.11 : 0.125) * nimble;
    this.invuln = tech ? 18 : 16;
    this.game.audio.roll();
    this.game.fx.dust(this.x, 0, this.z, 6);
  }

  updateRoll() {
    const t = this.sf / this.rollLen;
    if (this.sf <= this.rollLen - 4) this.vx = this.rollDir * this.facing * this.rollSpeed;
    else this.vx *= 0.6;
    if (this.sf >= this.rollLen + 4) this.toNeutral();
    this.rollT = Math.min(1, t);
  }

  startUlt() {
    this.meter = 0;
    this.move = null;
    this.state = 'ult';
    this.sf = 0;
    this.vx = 0;
    this.ult = createUlt(this.def.ult.type, this, this.game);
    this.game.startCinematic(this);
  }

  physics() {
    if (!this.grounded) this.vy -= GRAV * (this.state === 'launched' ? 0.95 : 1);
    this.x += this.vx;
    this.y += this.vy;
    if (this.y <= 0 && (this.vy <= 0 || this.grounded)) {
      const wasAir = !this.grounded;
      const impact = this.vy;
      this.y = 0;
      this.vy = 0;
      this.grounded = true;
      if (wasAir) this.onLand(impact);
    } else if (this.y > 0) {
      this.grounded = false;
    }
    this.x = Math.max(-STAGE_HALF, Math.min(STAGE_HALF, this.x));
  }

  onLand(impact) {
    const g = this.game;
    if (this.state === 'launched' || this.state === 'ko') {
      if (!this.bounced && impact < -0.12) {
        this.bounced = true;
        this.vy = -impact * 0.32;
        this.grounded = false;
        this.y = 0.001;
        g.audio.thud();
        g.fx.dust(this.x, 0, this.z, 12);
        g.shake(0.18);
        return;
      }
      g.audio.thud(0.6);
      g.fx.dust(this.x, 0, this.z, 8);
      this.vx *= 0.5;
      if (this.state === 'ko') {
        this.sf = 0;
        this.koLanded = true;
        return;
      }
      this.setState('knockdown');
      return;
    }
    if (this.state === 'jump' || (this.state === 'attack' && this.move?.air)) {
      g.audio.land();
      g.fx.dust(this.x, 0, this.z, 4);
      this.move = null;
      this.state = 'land';
      this.sf = 0;
      this.usedDouble = false;
      this.vx *= 0.3;
    }
  }

  // ------------------------------------------------------------------ boxes
  hurtbox() {
    const s = this.def.scale;
    const w = 0.4 * s;
    if (this.state === 'knockdown' || this.state === 'getup') return null;
    if (this.state === 'launched' || this.state === 'ko') {
      return { x0: this.x - 0.7 * s, x1: this.x + 0.7 * s, y0: this.y, y1: this.y + 1.1 * s };
    }
    const crouched = this.isCrouched();
    let h = crouched ? 1.28 * s : 2.2 * s;
    let y0 = this.y;
    if (!this.grounded) {
      y0 = this.y + 0.25;
      h = 1.75 * s;
    }
    return { x0: this.x - w, x1: this.x + w, y0, y1: y0 + h };
  }

  isCrouched() {
    if (!this.grounded) return false;
    if (this.state === 'crouch' || this.state === 'roll' || this.state === 'prejump' || this.state === 'land') return true;
    if (this.state === 'block' && this.ctrl.held.down) return true;
    if ((this.state === 'hitstun' || this.state === 'blockstun') && this.crouching) return true;
    return this.state === 'attack' && this.move && (this.move.id === 'sweep' || (this.move.id === 'upper' && this.sf <= this.move.startup));
  }

  hitbox() {
    if (!this.attackActive || !this.move || this.state !== 'attack') return null;
    const hb = this.move.hb;
    const a = this.x + hb[0] * this.facing;
    const b = this.x + hb[1] * this.facing;
    return { x0: Math.min(a, b), x1: Math.max(a, b), y0: this.y + hb[2], y1: this.y + hb[3] };
  }

  gainMeter(v) {
    const before = this.meter;
    this.meter = Math.min(ULT_MAX, this.meter + v);
    if (before < ULT_MAX && this.meter >= ULT_MAX) this.game.onUltReady(this);
  }

  // ------------------------------------------------------------------ visuals
  animate(time) {
    const pup = this.puppet;
    let target = P.IDLE;
    let k = 0.2;
    const s = this.state;
    const breath = Math.sin(time * 2.4 + this.idx) * 0.04;

    if (s === 'idle' || s === 'intro') {
      target = { ...P.IDLE, lean: P.IDLE.lean + breath * 0.6, sF: P.IDLE.sF + breath, eF: P.IDLE.eF - breath, head: breath * 0.5 };
      k = 0.15;
    } else if (s === 'walk' || s === 'walkback') {
      const ph = this.walkPhase;
      target = {
        ...P.IDLE,
        hF: 0.3 + Math.sin(ph) * 0.35, kF: -0.35 - Math.max(0, Math.sin(ph + 1.2)) * 0.5,
        hB: -0.1 - Math.sin(ph) * 0.35, kB: -0.15 - Math.max(0, -Math.sin(ph + 1.2)) * 0.5,
        lean: -0.08 + Math.sin(ph * 2) * 0.02,
        sB: P.IDLE.sB + Math.sin(ph) * 0.15,
      };
      k = 0.3;
    } else if (s === 'crouch') {
      target = this.ctrl.held.block || this.backHeld ? P.CROUCH_BLOCK : P.CROUCH;
      k = 0.3;
    } else if (s === 'block') {
      target = this.ctrl.held.down ? P.CROUCH_BLOCK : P.BLOCK;
      k = 0.35;
    } else if (s === 'prejump' || s === 'land') {
      target = s === 'prejump' ? P.PREJUMP : P.LAND;
      k = 0.45;
    } else if (s === 'jump') {
      target = this.vy > 0.04 ? P.JUMP_UP : P.JUMP_FALL;
      if (this.usedDouble && this.vy > 0) target = { ...P.JUMP_UP, spin: -Math.min(1, this.sf / 20) * Math.PI * 2 };
      k = 0.22;
    } else if (s === 'attack') {
      const m = this.move;
      const [wind, strike] = P.ATTACK[m.pose];
      if (this.sf <= m.startup) {
        target = this.sf < m.startup * 0.6 ? wind : strike;
        k = this.sf < m.startup * 0.6 ? 0.4 : 0.55;
      } else if (this.sf <= m.startup + m.active + 2) {
        target = strike;
        k = 0.7;
      } else {
        target = m.air ? P.JUMP_FALL : m.id === 'sweep' ? P.CROUCH : P.IDLE;
        k = 0.12;
      }
    } else if (s === 'hitstun') {
      target = this.crouching ? P.HIT_CROUCH : this.hitPose;
      k = this.sf < 3 ? 0.6 : 0.12;
    } else if (s === 'blockstun') {
      target = this.crouching ? P.CROUCH_BLOCK : P.BLOCKSTUN;
      k = 0.5;
    } else if (s === 'stagger') {
      target = { ...P.STAGGER, lean: P.STAGGER.lean + Math.sin(time * 9) * 0.12, head: 0.3 + Math.sin(time * 7) * 0.2 };
      k = 0.25;
    } else if (s === 'launched' || (s === 'ko' && !this.koLanded)) {
      target = P.LAUNCHED;
      k = 0.2;
    } else if (s === 'knockdown' || s === 'ko') {
      target = P.LYING;
      k = 0.25;
    } else if (s === 'getup') {
      target = P.GETUP;
      k = 0.2;
    } else if (s === 'roll') {
      const spin = -this.rollDir * (this.rollT || 0) * Math.PI * 2;
      pup.blend({ ...P.ROLL }, 0.5);
      pup.pose.spin = this.sf >= this.rollLen ? pup.pose.spin * 0.5 : spin;
      pup.apply();
      return;
    } else if (s === 'victory') {
      const bounce = Math.sin(time * 3) * 0.08;
      target = { ...(this.def.id === 'srikandi' ? P.SEMBAH : P.VICTORY), sF: (this.def.id === 'srikandi' ? P.SEMBAH.sF : P.VICTORY.sF) + bounce };
      k = 0.08;
    } else if (s === 'held') {
      target = { ...P.HIT_GUT, lean: -0.5 + Math.sin(time * 30) * 0.1 };
      k = 0.4;
    } else if (s === 'ult') {
      target = this.ultPose || P.IDLE;
      k = this.ultPoseK || 0.3;
    }

    pup.blend(target, k);
    pup.apply();
  }

  render(time) {
    this.animate(time);
    this.puppet.shakeX = this.game.hitstop > 0 && (this.state === 'hitstun' || this.state === 'launched' || this.state === 'held' || this.state === 'ko')
      ? (Math.random() - 0.5) * 0.08 : 0;
    this.puppet.tick(time);
    this.puppet.setTransform(this.x, this.y, this.facing, this.def.scale, this.z);
  }
}

// ------------------------------------------------------------------ combat
export function overlap(a, b) {
  return a && b && a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

// h: { dmg, type, hitstun, blockstun, push, launch, heavy, guardCrush, chip, isUlt, unblockable, sfx, pos }
export function resolveHit(game, att, def, h) {
  if (def.isInvuln() || def.state === 'ko') return 'miss';
  if (h.type === 'high' && def.isCrouched()) return 'miss';
  const toward = Math.sign(att.x - def.x) || def.facing;
  const pos = h.pos || { x: def.x - toward * -0.1 + toward * 0.25, y: def.y + 1.4 * def.def.scale, z: 0.3 };
  const canBlock = !h.unblockable && def.grounded && BLOCKABLE_STATES.has(def.state) && toward === def.facing;
  // a fresh tap of block counts even if already released (perfect-block timing)
  const tapped = def.tick - def.lastBlockPress <= 6;
  const holding = def.ctrl.held.block || def.backHeld || tapped;
  let blocked = false;
  const crouchB = def.ctrl.held.down;
  if (canBlock && holding) {
    blocked = !((h.type === 'low' && !crouchB) || (h.type === 'overhead' && crouchB));
  }

  if (blocked) {
    const parry = !h.isUlt && tapped && def.state !== 'blockstun';
    if (parry) {
      att.state = 'stagger';
      att.sf = 0;
      att.stun = 26;
      att.vx = -att.facing * 0.08;
      att.move = null;
      def.state = 'blockstun';
      def.sf = 0;
      def.stun = 6;
      def.gainMeter(14);
      game.onParry(def, att, pos);
      return 'parry';
    }
    const chip = Math.round(h.dmg * (h.chip ?? (h.isUlt ? 0.25 : 0.06)));
    def.hp = Math.max(1, def.hp - chip);
    def.state = 'blockstun';
    def.sf = 0;
    def.stun = h.blockstun + (h.guardCrush ? 8 : 0);
    def.crouching = crouchB;
    def.lastBlockStance = crouchB ? 'low' : 'high';
    pushApart(att, def, h.push * 0.9);
    def.gainMeter(4);
    att.gainMeter(2);
    game.onBlock(att, def, pos, h);
    return 'block';
  }

  // Bima's armored heavy: absorb one hit
  if (def.state === 'attack' && def.move?.armor && def.armor > 0 && !h.isUlt) {
    def.armor--;
    const d = Math.round(h.dmg * 0.6);
    def.hp -= d;
    game.onArmor(def, pos, d);
    if (def.hp <= 0) {
      def.hp = 0;
      knockOut(game, att, def, h);
    }
    return 'armor';
  }

  const counter = def.state === 'attack' && def.move && def.sf <= def.move.startup + def.move.active;
  def.comboTaken++;
  const scale = h.isUlt ? Math.max(0.7, 1 - 0.04 * (def.comboTaken - 1)) : Math.max(0.35, 1 - 0.12 * (def.comboTaken - 1));
  let dmg = h.dmg * scale * (counter ? 1.25 : 1);
  dmg = Math.round(dmg);
  def.hp -= dmg;
  def.comboDmg += dmg;
  att.gainMeter(dmg * 0.11);
  def.gainMeter(dmg * 0.07);

  def.move = null;
  def.attackActive = false;
  def.ult?.dispose?.();
  def.ult = null;
  def.noPhysics = false;
  def.puppet.bow.visible = false;

  if (def.hp <= 0) {
    def.hp = 0;
    game.onHit(att, def, dmg, h, counter, pos);
    knockOut(game, att, def, h);
    return 'hit';
  }

  const airborne = !def.grounded;
  if (h.launch || airborne || h.knockdown) {
    const L = h.launch || { vx: 0.08, vy: 0.14 };
    def.state = 'launched';
    def.sf = 0;
    def.bounced = false;
    def.grounded = false;
    def.vx = att.facing * L.vx;
    def.vy = airborne ? Math.max(L.vy * 0.8, 0.14) : L.vy;
    def.y = Math.max(def.y, 0.01);
  } else {
    def.state = 'hitstun';
    def.sf = 0;
    def.stun = h.hitstun + (counter ? 8 : 0);
    def.crouching = def.crouching || def.ctrl.held.down;
    def.hitPose = h.type === 'high' ? P.HIT_HIGH : P.HIT_GUT;
    pushApart(att, def, h.push);
  }
  if (h.hold) {
    def.state = 'held';
    def.sf = 0;
  }
  game.onHit(att, def, dmg, h, counter, pos);
  return 'hit';
}

function pushApart(att, def, amount) {
  def.vx = att.facing * amount;
  if (Math.abs(def.x) >= STAGE_HALF - 0.1 && Math.sign(def.x) === att.facing) {
    att.vx = -att.facing * amount * 0.9;
  }
}

function knockOut(game, att, def) {
  def.state = 'ko';
  def.sf = 0;
  def.koLanded = false;
  def.bounced = false;
  def.grounded = false;
  def.vx = att.facing * 0.14;
  def.vy = 0.24;
  def.y = Math.max(def.y, 0.01);
  def.noPhysics = false;
  game.onKO(att, def);
}
