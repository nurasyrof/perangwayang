import { BUTTONS } from './input.js';
import { ULT_MAX } from './fighter.js';

const DIFF = [
  { react: 24, block: 0.22, parry: 0.0, punish: 0.25, aggro: 0.3, chain: 0.35, antiAir: 0.2, dodge: 0.15, think: 26, ult: 0.01 },
  { react: 14, block: 0.55, parry: 0.06, punish: 0.6, aggro: 0.5, chain: 0.7, antiAir: 0.5, dodge: 0.4, think: 16, ult: 0.03 },
  { react: 8, block: 0.82, parry: 0.22, punish: 0.9, aggro: 0.65, chain: 0.92, antiAir: 0.8, dodge: 0.75, think: 9, ult: 0.08 },
];

const rnd = Math.random;

// Produces the same {held, pressed} shape as a keyboard controller.
export class BotController {
  constructor(game, level = 1, dummy = false) {
    this.game = game;
    this.p = DIFF[level];
    this.dummy = dummy;
    this.held = {};
    this.pressed = {};
    this.me = null;
    this.plan = null;
    this.planUntil = 0;
    this.defend = null;
    this.defendUntil = 0;
    this.nextThink = 0;
    this.pending = [];
    this.seenAttack = null;
    this.seenEntities = new WeakSet();
    this.opBlockLow = 0;
    this.opBlockHigh = 0;
    this.clear();
  }

  clear() {
    for (const b of BUTTONS) {
      this.held[b] = false;
      this.pressed[b] = false;
    }
  }

  press(btn, delay = 0) {
    this.pending.push({ btn, at: this.game.frame + delay });
  }

  update() {
    const g = this.game;
    const me = this.me;
    const op = g.opponentOf(me);
    const f = g.frame;
    this.clear();
    if (!me || !op || g.phase !== 'fight') return;

    const dx = op.x - me.x;
    const dist = Math.abs(dx);
    const towardKey = dx > 0 ? 'right' : 'left';
    const awayKey = dx > 0 ? 'left' : 'right';
    const P = this.p;

    // queued button presses (for chains / timed actions)
    for (let i = this.pending.length - 1; i >= 0; i--) {
      if (this.pending[i].at <= f) {
        this.pressed[this.pending[i].btn] = true;
        this.pending.splice(i, 1);
      }
    }

    if (this.dummy) {
      // training dummy: just stands (optionally blocks after being hit)
      if (this.g_block && me.isNeutral) this.held.block = true;
      return;
    }

    // track how the opponent blocks, to mix up high/low
    if (op.state === 'blockstun' && op.sf === 1) {
      if (op.lastBlockStance === 'low') this.opBlockLow++;
      else this.opBlockHigh++;
    }

    // ---------- perceive threats (with reaction delay)
    if (op.state === 'attack' && op.move && this.seenAttack !== op.move && op.sf <= 2) {
      this.seenAttack = op.move;
      const m = op.move;
      if (dist < m.hb[1] + 1.2 || m.air) {
        const at = f + P.react;
        if (at <= f + m.startup + 1) this.scheduleDefense(m, at);
        else if (rnd() < P.block * 0.3) this.scheduleDefense(m, f + 2);
      }
    }
    // ultimates / projectiles
    for (const e of g.entities) {
      if (e.owner === op && !this.seenEntities.has(e)) {
        this.seenEntities.add(e);
        if (rnd() < P.dodge) this.threatEntity = e;
      }
    }
    if (op.state === 'ult' && op.sf === 1 && rnd() < P.dodge) this.threatUlt = op.def.ult.type;

    if (this.threatEntity) {
      const e = this.threatEntity;
      if (e.x != null && e.dir != null) {
        const eta = (me.x - e.x) / (e.dir * 0.5);
        if (eta > 0 && eta < 7 && me.isNeutral) {
          if (rnd() < 0.6) {
            this.pressed.roll = true;
            this.held[towardKey] = true;
          }
          else this.held.up = true;
          this.threatEntity = null;
        } else if (eta < 0) this.threatEntity = null;
      } else if (e.mark) {
        // arrow rain: walk out of the marked zone
        this.held[Math.abs(me.x - e.mark.position.x) < 1.6 ? (me.x > e.mark.position.x ? 'right' : 'left') : 'block'] = true;
        if (e.count >= e.total) this.threatEntity = null;
        return;
      } else {
        this.threatEntity = null;
      }
    }
    if (this.threatUlt && op.state === 'ult') {
      const u = op.ult;
      if (u && u.phase === 'dive' && me.isNeutral) {
        this.pressed.roll = true;
        this.held[awayKey] = false;
        this.threatUlt = null;
      } else if (u && u.phase === 'rush' && me.isNeutral && dist < 4) {
        this.pressed.roll = true;
        this.held[towardKey] = true;
        this.threatUlt = null;
      }
      if (u && (u.phase === 'hover' || u.phase === 'rise')) return;
    } else if (op.state !== 'ult') this.threatUlt = null;

    // active defense
    if (this.defend && f <= this.defendUntil) {
      const d = this.defend;
      if (f >= d.start) {
        if (d.kind === 'roll') {
          if (f === d.start) {
            this.pressed.roll = true;
            this.held[awayKey] = true;
          }
        } else if (d.kind === 'parry') {
          if (f === d.start) this.pressed.block = true;
          this.held.block = true;
          this.held.down = d.low;
        } else if (d.kind === 'duck') {
          this.held.down = true;
        } else if (d.kind === 'block') {
          this.held.block = true;
          this.held.down = d.low;
        }
        return;
      }
    } else {
      this.defend = null;
    }

    // ---------- in the middle of our own attack: continue strings
    if (me.state === 'attack' && me.move) {
      const m = me.move;
      if (me.moveConnected && me.meter >= ULT_MAX && rnd() < 0.5 + P.ult * 3) {
        this.pressed.ult = true;
        return;
      }
      if (m.chain && me.sf === m.startup + 1 && rnd() < P.chain * (me.moveConnected ? 1 : 0.4)) {
        const useKick = m.id === 'jab2' ? rnd() < 0.45 : rnd() < 0.3;
        this.press(useKick && m.chain.kick ? 'kick' : 'punch', 2 + Math.floor(rnd() * 4));
      }
      return;
    }

    // air: attack when descending near the opponent
    if (me.state === 'jump') {
      if (me.vy < 0.05 && dist < 1.8 && rnd() < 0.5) this.pressed[rnd() < 0.6 ? 'kick' : 'punch'] = true;
      if (me.def.doubleJump && me.vy < 0 && dist > 3 && rnd() < 0.03) this.pressed.up = true;
      this.held[towardKey] = true;
      return;
    }
    if (me.state === 'knockdown' && me.sf < 10 && rnd() < P.dodge * 0.15) this.pressed.roll = true;
    if (!me.isNeutral) return;

    // ---------- ultimate
    if (me.meter >= ULT_MAX && rnd() < P.ult) {
      const t = me.def.ult.type;
      const okay = (t === 'pancanaka' && dist < 5) || (t === 'pasopati' && op.grounded) || t === 'brajamusti' || t === 'hujanpanah';
      if (okay && op.state !== 'knockdown' && op.state !== 'getup') {
        this.pressed.ult = true;
        return;
      }
    }

    // ---------- punish whiffs
    if (op.state === 'attack' && op.move && !op.moveConnected && op.sf > op.move.startup + op.move.active && dist < 2.0) {
      if (rnd() < P.punish * 0.3) {
        this.pressed.punch = true;
        if (rnd() < 0.5) this.held[towardKey] = true;
        return;
      }
    }
    if (op.state === 'stagger' && dist < 2.2) {
      if (me.meter >= ULT_MAX && rnd() < 0.6) this.pressed.ult = true;
      else {
        this.pressed.punch = true;
        this.held[towardKey] = rnd() < 0.5;
      }
      return;
    }

    // ---------- anti-air
    if (!op.grounded && op.state === 'jump' && dist < 2.4 && Math.sign(op.vx || dx) !== Math.sign(dx) && rnd() < P.antiAir * 0.25) {
      this.held.down = true;
      this.pressed.punch = true;
      return;
    }

    // ---------- neutral planning
    if (f >= this.nextThink || !this.plan || f > this.planUntil) {
      this.think(dist, op);
      this.nextThink = f + P.think + Math.floor(rnd() * P.think);
    }
    const plan = this.plan;
    switch (plan) {
      case 'approach':
        this.held[towardKey] = true;
        if (dist < 1.3) this.plan = 'pressure';
        break;
      case 'retreat':
        this.held[awayKey] = true;
        break;
      case 'wait':
        if (rnd() < 0.5) this.held[awayKey] = true;
        else if (rnd() < 0.2) this.held.down = true;
        break;
      case 'jumpin':
        this.held.up = true;
        this.held[towardKey] = true;
        this.plan = 'approach';
        break;
      case 'rollin':
        this.pressed.roll = true;
        this.held[towardKey] = true;
        this.plan = 'approach';
        break;
      case 'pressure': {
        if (dist > 1.9) {
          this.plan = 'approach';
          break;
        }
        if (rnd() < P.aggro * 0.2) {
          const r = rnd();
          const lowBias = this.opBlockHigh > this.opBlockLow + 1 ? 0.2 : 0;
          if (r < 0.38) this.pressed.punch = true;
          else if (r < 0.55) this.pressed.kick = true;
          else if (r < 0.68 + lowBias) {
            this.held.down = true;
            this.pressed.kick = true;
          } else if (r < 0.8) {
            this.held[towardKey] = true;
            this.pressed.punch = true;
          } else if (r < 0.88) {
            this.held.up = true;
            this.held[towardKey] = true;
          } else {
            this.plan = 'wait';
            this.planUntil = f + 20;
          }
        } else if (rnd() < 0.3) {
          this.held.block = true;
        }
        break;
      }
    }
  }

  think(dist, op) {
    const P = this.p;
    const r = rnd();
    const f = this.game.frame;
    this.planUntil = f + 20 + Math.floor(rnd() * 40);
    if (op.state === 'knockdown' || op.state === 'getup') {
      this.plan = dist > 2 ? 'approach' : 'wait';
      return;
    }
    if (dist > 4.5) {
      this.plan = r < 0.12 ? 'rollin' : r < 0.25 ? 'jumpin' : 'approach';
    } else if (dist > 1.8) {
      this.plan = r < P.aggro ? (rnd() < 0.2 ? 'jumpin' : 'approach') : r < P.aggro + 0.2 ? 'wait' : 'approach';
    } else {
      this.plan = r < P.aggro + 0.2 ? 'pressure' : r < 0.9 ? 'wait' : 'retreat';
    }
    if (this.me.hp < this.me.maxHp * 0.25 && rnd() < 0.2) this.plan = 'retreat';
  }

  scheduleDefense(m, at) {
    const P = this.p;
    const r = rnd();
    const low = m.type === 'low';
    const f = this.game.frame;
    const hitAt = f + m.startup - (this.game.opponentOf(this.me).sf || 0);
    if (r < P.parry && m.type !== 'overhead') {
      this.defend = { kind: 'parry', low, start: Math.max(at, hitAt - 3) };
    } else if (r < P.block) {
      if (m.type === 'high' && rnd() < 0.35) this.defend = { kind: 'duck', start: at };
      else this.defend = { kind: 'block', low, start: at };
    } else if (r < P.block + P.dodge * 0.2) {
      this.defend = { kind: 'roll', start: at };
    } else {
      this.defend = null;
      return;
    }
    this.defendUntil = hitAt + m.active + 10;
  }
}
