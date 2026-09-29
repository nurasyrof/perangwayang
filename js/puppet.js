import * as THREE from 'three';
import { drawPart, PARTS, LIMB } from './textures.js';
import { NEUTRAL } from './poses.js';

const JOINTS = ['lean', 'head', 'sF', 'eF', 'sB', 'eB', 'hF', 'kF', 'hB', 'kB', 'kain', 'spin', 'dx'];

function partMesh(name, look, opts, z, cache) {
  const spec = PARTS[name];
  const key = name + (opts.front ? 'F' : '');
  let tex = cache[key];
  if (!tex) {
    tex = new THREE.CanvasTexture(drawPart(name, look, opts));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    cache[key] = tex;
  }
  const geo = new THREE.PlaneGeometry(spec.w, spec.h);
  geo.translate(spec.w / 2 - spec.ox, spec.h / 2 - spec.oy, 0);
  const mat = new THREE.MeshStandardMaterial({
    map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.18,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.z = z;
  mesh.castShadow = true;
  mesh.customDepthMaterial = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5, side: THREE.DoubleSide,
  });
  return mesh;
}

function stick(len, width = 0.022) {
  const geo = new THREE.BoxGeometry(width, len, width * 0.6);
  const mat = new THREE.MeshStandardMaterial({ color: 0x2a1a0e, roughness: 0.4, metalness: 0.1 });
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  return m;
}

export class Puppet {
  constructor(def) {
    this.def = def;
    const look = def.look;
    const b = look.build;
    const cache = {};
    this.materials = [];

    this.root = new THREE.Group();
    this.hip = new THREE.Group();
    this.root.add(this.hip);

    // torso & upper body
    this.torso = new THREE.Group();
    this.hip.add(this.torso);
    const torsoMesh = partMesh('torso', look, {}, 0, cache);
    this.torso.add(torsoMesh);

    this.headG = new THREE.Group();
    this.headG.position.set(0.02, 0.9, 0.006);
    this.torso.add(this.headG);
    this.headG.add(partMesh('head', look, {}, 0, cache));

    const mkArm = (front) => {
      const sh = new THREE.Group();
      sh.position.set(front ? 0.19 * b : -0.17 * b, 0.8, front ? 0.05 : -0.05);
      const upper = partMesh('upperArm', look, {}, 0, cache);
      sh.add(upper);
      const el = new THREE.Group();
      el.position.set(0, -LIMB.upper, 0.002);
      sh.add(el);
      el.add(partMesh('foreArm', look, { front }, 0, cache));
      const hand = new THREE.Group();
      hand.position.set(0.02, -0.6, 0.004);
      el.add(hand);
      // tuding - the thin control rod the dalang holds
      const rod = stick(0.75, 0.012);
      rod.position.y = -0.36;
      const rodPivot = new THREE.Group();
      rodPivot.add(rod);
      hand.add(rodPivot);
      this.torso.add(sh);
      return { sh, el, hand, rodPivot };
    };
    this.armB = mkArm(false);
    this.armF = mkArm(true);

    const mkLeg = (front) => {
      const th = new THREE.Group();
      th.position.set(front ? 0.06 : -0.06, 0.02, front ? 0.012 : -0.03);
      th.add(partMesh('thigh', look, {}, 0, cache));
      const kn = new THREE.Group();
      kn.position.set(0, -LIMB.thigh, 0.002);
      th.add(kn);
      kn.add(partMesh('shin', look, {}, 0, cache));
      this.hip.add(th);
      return { th, kn };
    };
    this.legB = mkLeg(false);
    this.legF = mkLeg(true);

    this.kain = new THREE.Group();
    this.kain.position.set(0, 0.05, 0.03);
    this.kain.add(partMesh('kain', look, {}, 0, cache));
    this.hip.add(this.kain);

    // gapit - central horn rod running through the puppet into the banana trunk
    const gapit = stick(3.0, 0.028);
    gapit.position.set(0.0, 0.25, -0.012);
    this.torso.add(gapit);

    this.root.traverse((o) => {
      if (o.isMesh) this.materials.push(o.material);
    });

    // bow prop (hidden unless an ultimate needs it)
    this.bow = this.makeBow(def.ult.color);
    this.bow.visible = false;
    this.armF.hand.add(this.bow);

    this.pose = { ...NEUTRAL };
    this.flashT = 0;
    this.flashColor = new THREE.Color();
    this.glow = 0;
    this.glowColor = new THREE.Color(def.ult.color);
    this.shakeX = 0;
    this.apply();
  }

  makeBow(color) {
    const g = new THREE.Group();
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 0.75, 0), new THREE.Vector3(-0.45, 0, 0), new THREE.Vector3(0, -0.75, 0),
    );
    const bow = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 24, 0.025, 6),
      new THREE.MeshStandardMaterial({ color: 0xe8b64c, metalness: 0.8, roughness: 0.3, emissive: color, emissiveIntensity: 0.3 }),
    );
    bow.castShadow = true;
    const string = new THREE.Mesh(
      new THREE.BoxGeometry(0.008, 1.5, 0.008),
      new THREE.MeshBasicMaterial({ color: 0xfff4d0 }),
    );
    g.add(bow, string);
    g.position.set(0.05, -0.05, 0.02);
    return g;
  }

  // Blend towards target pose; k is the per-frame blend factor
  blend(target, k) {
    for (const j of JOINTS) {
      const t = target[j] ?? NEUTRAL[j];
      this.pose[j] += (t - this.pose[j]) * k;
    }
    this.pose.hip = target.hip ?? null;
  }

  footDrop(h, k) {
    return LIMB.thigh * Math.cos(h) + LIMB.shin * Math.cos(h + k);
  }

  hipHeight() {
    const p = this.pose;
    if (p.hip != null) return p.hip;
    return Math.max(this.footDrop(p.hF, p.kF), this.footDrop(p.hB, p.kB), 0.3);
  }

  apply() {
    const p = this.pose;
    this.hip.position.set(p.dx + this.shakeX, this.hipHeight(), 0);
    this.hip.rotation.z = p.spin;
    this.torso.rotation.z = p.lean;
    this.headG.rotation.z = p.head;
    this.armF.sh.rotation.z = p.sF;
    this.armF.el.rotation.z = p.eF;
    this.armB.sh.rotation.z = p.sB;
    this.armB.el.rotation.z = p.eB;
    // rods hang loosely toward the ground
    this.armF.rodPivot.rotation.z = -(p.sF + p.eF + p.lean + p.spin) * 0.92;
    this.armB.rodPivot.rotation.z = -(p.sB + p.eB + p.lean + p.spin) * 0.92;
    this.legF.th.rotation.z = p.hF;
    this.legF.kn.rotation.z = p.kF;
    this.legB.th.rotation.z = p.hB;
    this.legB.kn.rotation.z = p.kB;
    this.kain.rotation.z = (p.hF + p.hB) * 0.22 + p.kain;
  }

  flash(color = 0xffffff, frames = 6) {
    this.flashT = frames;
    this.flashMax = frames;
    this.flashColor.set(color);
  }

  tick(time) {
    let e = 0;
    if (this.flashT > 0) {
      this.flashT--;
      e = this.flashT / this.flashMax;
    }
    const gl = this.glow > 0 ? this.glow * (0.55 + 0.45 * Math.sin(time * 8)) : 0;
    for (const m of this.materials) {
      if (!m.emissive) continue;
      if (e > 0) {
        m.emissive.copy(this.flashColor);
        m.emissiveIntensity = e * 1.4;
      } else if (gl > 0) {
        m.emissive.copy(this.glowColor);
        m.emissiveIntensity = gl * 0.5;
      } else {
        m.emissiveIntensity = 0;
      }
    }
  }

  setTransform(x, y, facing, scale, z) {
    this.root.position.set(x, y, z);
    this.root.scale.set(facing * scale, scale, scale);
  }

  handWorld(front = true, target = new THREE.Vector3()) {
    this.root.updateMatrixWorld(true);
    return (front ? this.armF : this.armB).hand.getWorldPosition(target);
  }
}
