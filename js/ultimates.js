import * as THREE from 'three';
import { ULT } from './poses.js';
import { resolveHit, overlap, STAGE_HALF } from './fighter.js';

export const CINE_FRAMES = 44;

const glowMat = (color, opacity = 1) => new THREE.MeshBasicMaterial({
  color: new THREE.Color(color).multiplyScalar(2.2), transparent: true, opacity,
  blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
});

// ------------------------------------------------------------------ Arjuna
class Pasopati {
  constructor(f, g) { this.f = f; this.g = g; this.t = 0; }
  update() {
    const { f, g } = this;
    this.t++;
    const t = this.t;
    f.invuln = Math.max(f.invuln, 2);
    if (t === 1) {
      f.puppet.bow.visible = true;
      f.puppet.bow.rotation.z = Math.PI / 2;
    }
    if (t < 48) {
      f.ultPose = ULT.bowDraw;
      f.ultPoseK = 0.2;
      if (t % 2 === 0) {
        const p = f.puppet.handWorld(true);
        g.fx.spark(p.x + f.facing * 0.2, p.y + 0.05, 0.4, 0x8fe8ff, 2, 0.05);
      }
    } else if (t === 48) {
      const p = f.puppet.handWorld(true);
      g.entities.push(new PasopatiArrow(g, f, p.x + f.facing * 0.3, 1.45 * f.def.scale));
      g.audio.arrow(true);
      g.shake(0.25);
      f.ultPose = ULT.bowRelease;
      f.ultPoseK = 0.5;
      f.vx = -f.facing * 0.1;
    } else {
      f.vx *= 0.85;
    }
    return t >= 76;
  }
}

class PasopatiArrow {
  constructor(g, owner, x, y) {
    this.g = g;
    this.owner = owner;
    this.target = g.opponentOf(owner);
    this.dir = owner.facing;
    this.x = x;
    this.y = y;
    this.group = new THREE.Group();
    // crescent head (bulan sabit)
    const cres = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.07, 8, 24, Math.PI), glowMat(0x9ff0ff));
    cres.rotation.z = -Math.PI / 2;
    cres.position.x = 0.55;
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), glowMat(0xffffff));
    core.position.x = 0.45;
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.06, 0.06), glowMat(0x7fdcff));
    shaft.position.x = -0.4;
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.2), new THREE.MeshBasicMaterial({
      map: g.fx.glowTex, color: new THREE.Color(0x5cc8ff).multiplyScalar(1.5), transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    this.group.add(halo, shaft, cres, core);
    this.light = new THREE.PointLight(0x8fe8ff, 6, 8, 1.5);
    this.group.add(this.light);
    this.group.scale.x = this.dir;
    this.group.position.set(x, y, 0.3);
    g.scene.add(this.group);
    this.done = false;
  }
  update() {
    this.x += this.dir * 0.5;
    this.group.position.x = this.x;
    this.group.children[2].rotation.x += 0.4;
    this.g.fx.spark(this.x - this.dir * 0.8, this.y + (Math.random() - 0.5) * 0.3, 0.3, 0x8fe8ff, 2, 0.04);
    const box = { x0: this.x - 0.6, x1: this.x + 0.6, y0: 0.35, y1: 2.05 };
    const tgt = this.target;
    if (!this.done && overlap(box, tgt.hurtbox())) {
      const r = resolveHit(this.g, this.owner, tgt, {
        dmg: 300 * this.owner.def.power, type: 'mid', hitstun: 30, blockstun: 30, push: 0.3,
        launch: { vx: 0.2, vy: 0.26 }, heavy: true, isUlt: true, sfx: 'ult',
        pos: { x: this.x + this.dir * 0.4, y: this.y, z: 0.4 },
      });
      if (r !== 'miss') {
        this.g.fx.burst(this.x, this.y, 0.4, 0x9ff0ff, 60, 0.28);
        this.g.fx.ring({ x: this.x, y: this.y, z: 0.4 }, 0x9ff0ff, 4, 26);
        this.done = true;
        return false;
      }
    }
    return Math.abs(this.x) < STAGE_HALF + 6;
  }
  dispose() {
    this.g.scene.remove(this.group);
    this.group.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
    this.light.dispose();
  }
}

// ------------------------------------------------------------------ Srikandi
class HujanPanah {
  constructor(f, g) { this.f = f; this.g = g; this.t = 0; }
  update() {
    const { f, g } = this;
    this.t++;
    const t = this.t;
    f.invuln = Math.max(f.invuln, 2);
    if (t === 1) {
      f.puppet.bow.visible = true;
      f.puppet.bow.rotation.z = Math.PI / 2;
    }
    f.ultPose = t < 50 ? ULT.bowUp : ULT.bowRelease;
    f.ultPoseK = 0.25;
    if (t < 48 && t % 2 === 0) {
      const p = f.puppet.handWorld(true);
      g.fx.spark(p.x, p.y + 0.2, 0.4, 0xffc46a, 2, 0.05);
    }
    if (t === 48) {
      const p = f.puppet.handWorld(true);
      g.entities.push(new SkyArrow(g, p.x, p.y));
      g.audio.arrow(false);
      g.entities.push(new ArrowRain(g, f));
    }
    return t >= 72;
  }
}

class SkyArrow {
  constructor(g, x, y) {
    this.g = g;
    this.x = x;
    this.y = y;
    this.m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.2, 0.06), glowMat(0xffd27a));
    this.m.position.set(x, y, 0.3);
    g.scene.add(this.m);
  }
  update() {
    this.y += 0.6;
    this.m.position.y = this.y;
    this.g.fx.spark(this.x, this.y - 0.5, 0.3, 0xffc46a, 1, 0.03);
    return this.y < 14;
  }
  dispose() { this.g.scene.remove(this.m); this.m.geometry.dispose(); this.m.material.dispose(); }
}

class ArrowRain {
  constructor(g, owner) {
    this.g = g;
    this.owner = owner;
    this.target = g.opponentOf(owner);
    this.t = 0;
    this.arrows = [];
    this.count = 0;
    this.total = 14;
    this.geo = new THREE.BoxGeometry(0.05, 1.1, 0.05);
    this.headGeo = new THREE.ConeGeometry(0.08, 0.25, 6);
    // warning glow on the ground
    this.mark = new THREE.Mesh(new THREE.CircleGeometry(1.4, 32), glowMat(0xffa94a, 0.25));
    this.mark.rotation.x = -Math.PI / 2;
    this.mark.position.set(this.target.x, 0.02, 0);
    g.scene.add(this.mark);
  }
  spawn(x, big) {
    const grp = new THREE.Group();
    const mat = glowMat(big ? 0xfff0b0 : 0xffc46a);
    const body = new THREE.Mesh(this.geo, mat);
    const head = new THREE.Mesh(this.headGeo, mat);
    head.rotation.z = Math.PI;
    head.position.y = -0.62;
    grp.add(body, head);
    if (big) grp.scale.setScalar(2.2);
    grp.position.set(x, 11, 0.2 + Math.random() * 0.1);
    grp.rotation.z = (Math.random() - 0.5) * 0.15;
    this.g.scene.add(grp);
    this.arrows.push({ grp, mat, x, y: 11, vy: big ? -0.55 : -0.5, big, stuck: 0, hit: false });
  }
  update() {
    this.t++;
    const tgt = this.target;
    this.mark.position.x += (tgt.x - this.mark.position.x) * 0.1;
    this.mark.material.opacity = 0.2 + 0.1 * Math.sin(this.t * 0.5);
    if (this.t > 18 && this.count < this.total && this.t % 4 === 0) {
      const big = this.count === this.total - 1;
      this.spawn(big ? tgt.x : tgt.x + (Math.random() - 0.5) * 2.4, big);
      this.count++;
    }
    for (const a of this.arrows) {
      if (a.stuck) {
        a.stuck++;
        a.mat.opacity = Math.max(0, 1 - a.stuck / 50);
        continue;
      }
      a.y += a.vy;
      a.grp.position.y = a.y;
      const tip = a.y - (a.big ? 1.4 : 0.7);
      if (!a.hit) {
        const box = { x0: a.x - (a.big ? 0.5 : 0.15), x1: a.x + (a.big ? 0.5 : 0.15), y0: tip, y1: tip + 0.6 };
        if (overlap(box, tgt.hurtbox())) {
          a.hit = true;
          resolveHit(this.g, this.owner, tgt, a.big
            ? { dmg: 80 * this.owner.def.power, type: 'overhead', hitstun: 30, blockstun: 20, push: 0.05, launch: { vx: 0.05, vy: 0.2 }, heavy: true, isUlt: true, sfx: 'ult', pos: { x: a.x, y: tip + 0.3, z: 0.4 } }
            : { dmg: 17 * this.owner.def.power, type: 'overhead', hitstun: 22, blockstun: 10, push: 0.0, isUlt: true, sfx: 'arrowhit', pos: { x: a.x, y: tip + 0.3, z: 0.4 } });
        }
      }
      if (tip <= 0) {
        a.stuck = 1;
        a.grp.position.y = (a.big ? 1.4 : 0.7) - 0.15;
        this.g.fx.dust(a.x, 0, 0.2, a.big ? 14 : 3);
        if (a.big) {
          this.g.shake(0.3);
          this.g.fx.ring({ x: a.x, y: 0.2, z: 0.3 }, 0xffc46a, 3, 22);
          this.g.audio.boom(0.6);
        } else if (Math.random() < 0.5) this.g.audio.arrowThud();
      }
    }
    const alive = this.count < this.total || this.arrows.some((a) => !a.stuck || a.stuck < 50);
    if (!alive || this.count >= this.total) this.mark.material.opacity *= 0.8;
    return alive;
  }
  dispose() {
    for (const a of this.arrows) {
      this.g.scene.remove(a.grp);
      a.mat.dispose();
    }
    this.geo.dispose();
    this.headGeo.dispose();
    this.g.scene.remove(this.mark);
    this.mark.geometry.dispose();
    this.mark.material.dispose();
  }
}

// ------------------------------------------------------------------ Bima
class Pancanaka {
  constructor(f, g) {
    this.f = f;
    this.g = g;
    this.t = 0;
    this.phase = 'roar';
    this.target = g.opponentOf(f);
  }
  update() {
    const { f, g } = this;
    const tgt = this.target;
    this.t++;
    const t = this.t;
    if (this.phase === 'roar') {
      f.invuln = 2;
      f.ultPose = ULT.roar;
      f.ultPoseK = 0.25;
      if (t % 3 === 0) {
        const p = f.puppet.handWorld(true);
        g.fx.spark(p.x, p.y, 0.4, 0xff5a2a, 3, 0.07);
      }
      if (t === 20) g.audio.roar();
      if (t >= CINE_FRAMES + 2) {
        this.phase = 'rush';
        this.t = 0;
      }
    } else if (this.phase === 'rush') {
      f.invuln = 2;
      f.ultPose = ULT.rush;
      f.ultPoseK = 0.5;
      f.vx = f.facing * 0.38;
      if (t % 2 === 0) g.fx.dust(f.x - f.facing * 0.4, 0, f.z, 2);
      g.fx.spark(f.x + f.facing * 0.7, 1.3 * f.def.scale, 0.4, 0xff5a2a, 1, 0.03);
      const box = { x0: Math.min(f.x, f.x + f.facing * 1.2), x1: Math.max(f.x, f.x + f.facing * 1.2), y0: 0.2, y1: 2.2 };
      if (overlap(box, tgt.hurtbox())) {
        const r = resolveHit(g, f, tgt, {
          dmg: 30 * f.def.power, type: 'mid', hitstun: 40, blockstun: 32, push: 0.0,
          isUlt: true, heavy: true, sfx: 'slash', hold: true,
          pos: { x: tgt.x - f.facing * 0.3, y: 1.4, z: 0.4 },
        });
        if (r === 'hit' && tgt.state === 'held') {
          this.phase = 'maul';
          this.t = 0;
          f.vx = 0;
          return false;
        }
        if (r !== 'miss') {
          this.phase = 'recover';
          this.t = 0;
          f.vx = -f.facing * 0.1;
          return false;
        }
      }
      if (t > 40 || Math.abs(f.x) >= STAGE_HALF - 0.05) {
        this.phase = 'recover';
        this.t = 0;
      }
    } else if (this.phase === 'maul') {
      f.invuln = 2;
      f.vx = 0;
      tgt.x += ((f.x + f.facing * 0.95 * f.def.scale) - tgt.x) * 0.5;
      tgt.y = 0;
      tgt.vx = 0;
      if (tgt.state === 'held') {
        tgt.vy = 0;
        tgt.grounded = true;
      }
      const slashT = [8, 17, 26, 35, 44];
      if (slashT.includes(t)) {
        const i = slashT.indexOf(t);
        f.ultPose = i % 2 ? ULT.slashB : ULT.slashA;
        f.ultPoseK = 0.7;
        if (tgt.state === 'held') {
          const dmg = Math.round(34 * f.def.power);
          tgt.hp = Math.max(1, tgt.hp - dmg);
          tgt.comboTaken++;
          tgt.comboDmg += dmg;
          g.onHit(f, tgt, dmg, { heavy: false, sfx: 'slash', isUlt: true }, false, { x: tgt.x, y: 1.3 + (i % 2) * 0.3, z: 0.4 });
          g.fx.slash(tgt.x, 1.4, 0.45, f.facing, i % 2, 0xff5a2a);
        }
      }
      if (t === 58) {
        f.ultPose = ULT.roar;
        f.ultPoseK = 0.8;
        if (tgt.state === 'held') {
          tgt.state = 'hitstun';
          tgt.stun = 1;
          resolveHit(g, f, tgt, {
            dmg: 110 * f.def.power, type: 'mid', hitstun: 30, blockstun: 30, push: 0.3,
            launch: { vx: 0.18, vy: 0.34 }, isUlt: true, heavy: true, unblockable: true, sfx: 'ult',
            pos: { x: tgt.x, y: 1.5, z: 0.4 },
          });
          g.fx.ring({ x: tgt.x, y: 1.2, z: 0.4 }, 0xff5a2a, 4, 24);
        }
      }
      if (t >= 80) return true;
    } else if (this.phase === 'recover') {
      f.ultPose = ULT.slashB;
      f.ultPoseK = 0.2;
      f.vx *= 0.8;
      if (t >= 24) return true;
    }
    return false;
  }
  dispose() {
    if (this.target.state === 'held') {
      this.target.state = 'hitstun';
      this.target.stun = 10;
    }
  }
}

// ------------------------------------------------------------------ Gatotkaca
class Brajamusti {
  constructor(f, g) {
    this.f = f;
    this.g = g;
    this.t = 0;
    this.phase = 'charge';
    this.target = g.opponentOf(f);
    this.mark = null;
  }
  update() {
    const { f, g } = this;
    const tgt = this.target;
    this.t++;
    const t = this.t;
    f.invuln = 2;
    if (this.phase === 'charge') {
      f.ultPose = ULT.charge;
      f.ultPoseK = 0.25;
      if (t % 3 === 0) {
        const p = f.puppet.handWorld(true);
        g.fx.lightning(p.x, p.y, p.x + (Math.random() - 0.5) * 1.6, p.y + Math.random() * 1.5, 0xb48cff, 6);
      }
      if (t >= CINE_FRAMES + 2) {
        this.phase = 'rise';
        this.t = 0;
        f.noPhysics = true;
        f.grounded = false;
        g.audio.jump(0.6);
        g.fx.ring({ x: f.x, y: 0.1, z: f.z }, 0xb48cff, 3, 20);
        g.fx.dust(f.x, 0, f.z, 16);
      }
    } else if (this.phase === 'rise') {
      f.ultPose = ULT.flyUp;
      f.ultPoseK = 0.4;
      f.y += 0.55;
      g.fx.spark(f.x, f.y, f.z, 0xb48cff, 2, 0.04);
      if (f.y > 13) {
        this.phase = 'hover';
        this.t = 0;
        this.tx = tgt.x;
        this.mark = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.4, 40), glowMat(0xb48cff, 0.5));
        this.mark.rotation.x = -Math.PI / 2;
        this.mark.position.set(this.tx, 0.03, 0);
        g.scene.add(this.mark);
      }
    } else if (this.phase === 'hover') {
      this.tx += (tgt.x - this.tx) * 0.14;
      this.mark.position.x = this.tx;
      this.mark.scale.setScalar(1 + Math.sin(t * 0.6) * 0.1);
      if (t >= 26) {
        this.phase = 'dive';
        this.t = 0;
        this.sx = this.tx - (Math.sign(tgt.x - f.x) || f.facing) * 3.2;
        f.facing = Math.sign(this.tx - this.sx) || f.facing;
        g.audio.dive();
      }
    } else if (this.phase === 'dive') {
      const k = Math.min(1, t / 14);
      f.x = this.sx + (this.tx - this.sx) * k;
      f.y = 13 * (1 - k);
      f.ultPose = ULT.dive;
      f.ultPoseK = 0.6;
      g.fx.spark(f.x, f.y + 0.6, f.z, 0xd8c4ff, 3, 0.06);
      if (k >= 1) {
        f.y = 0;
        f.grounded = true;
        this.phase = 'impact';
        this.t = 0;
        this.impact();
      }
    } else if (this.phase === 'impact') {
      f.ultPose = ULT.impact;
      f.ultPoseK = 0.5;
      if (this.mark) this.mark.material.opacity *= 0.85;
      if (t >= 32) {
        f.noPhysics = false;
        return true;
      }
    }
    return false;
  }
  impact() {
    const { f, g } = this;
    const tgt = this.target;
    g.shake(0.8);
    g.flash('#d8c4ff', 0.6);
    g.audio.thunder();
    g.fx.ring({ x: f.x, y: 0.15, z: 0.3 }, 0xb48cff, 7, 30);
    g.fx.ring({ x: f.x, y: 0.15, z: 0.3 }, 0xffffff, 4, 18);
    g.fx.dust(f.x, 0, 0.3, 30);
    for (let i = 0; i < 7; i++) {
      g.fx.lightning(f.x, 0.1, f.x + (Math.random() - 0.5) * 6, 3 + Math.random() * 6, 0xc8b0ff, 16);
    }
    if (Math.abs(tgt.x - f.x) < 2.3 && tgt.y < 1.8) {
      resolveHit(g, f, tgt, {
        dmg: 300 * f.def.power, type: 'mid', hitstun: 30, blockstun: 30, push: 0.3,
        launch: { vx: 0.12, vy: 0.36 }, heavy: true, isUlt: true, sfx: 'ult',
        pos: { x: tgt.x, y: 1.2, z: 0.4 },
      });
    }
  }
  dispose() {
    this.f.noPhysics = false;
    if (this.f.y > 0) this.f.grounded = false;
    if (this.mark) {
      this.g.scene.remove(this.mark);
      this.mark.geometry.dispose();
      this.mark.material.dispose();
    }
  }
}

const TYPES = { pasopati: Pasopati, hujanpanah: HujanPanah, pancanaka: Pancanaka, brajamusti: Brajamusti };

export function createUlt(type, f, g) {
  return new TYPES[type](f, g);
}
