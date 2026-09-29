import * as THREE from 'three';
import { drawGlow, drawSpark } from './textures.js';

// Lightweight particle / effect system (pooled sprites + transient meshes)
export class FX {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.glowTex = new THREE.CanvasTexture(drawGlow(64));
    this.sparkTex = new THREE.CanvasTexture(drawSpark(128));
    this.pool = [];
    this.live = [];
    this.meshes = [];
    for (let i = 0; i < 500; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.glowTex, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending,
        depthWrite: false, toneMapped: false,
      });
      const s = new THREE.Sprite(mat);
      s.visible = false;
      scene.add(s);
      this.pool.push(s);
    }
    this.dustMat = null;
  }

  emit(o) {
    const s = this.pool.pop();
    if (!s) return;
    s.visible = true;
    s.position.set(o.x, o.y, o.z);
    s.material.map = o.tex || this.glowTex;
    s.material.color.set(o.color ?? 0xffffff).multiplyScalar(o.bright ?? 1.6);
    s.material.blending = o.normal ? THREE.NormalBlending : THREE.AdditiveBlending;
    s.material.opacity = 1;
    s.material.rotation = Math.random() * Math.PI;
    s.userData = {
      vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, g: o.g || 0, life: o.life, max: o.life,
      size: o.size, grow: o.grow ?? 1, drag: o.drag ?? 0.96, fade: o.fade ?? 1,
    };
    s.scale.setScalar(o.size);
    this.live.push(s);
  }

  spark(x, y, z, color, n = 1, speed = 0.05) {
    for (let i = 0; i < n; i++) {
      this.emit({
        x, y, z, color, size: 0.12 + Math.random() * 0.15,
        vx: (Math.random() - 0.5) * speed * 2, vy: (Math.random() - 0.3) * speed * 2, vz: (Math.random() - 0.5) * speed,
        life: 18 + Math.random() * 14, grow: 0.97,
      });
    }
  }

  burst(x, y, z, color, n = 20, speed = 0.18) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random());
      this.emit({
        x, y, z, color, size: 0.08 + Math.random() * 0.12, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        vz: (Math.random() - 0.5) * v * 0.5, g: 0.006, life: 16 + Math.random() * 16, drag: 0.9, grow: 0.97,
      });
    }
  }

  hit(pos, color, heavy) {
    this.emit({ ...pos, tex: this.sparkTex, color: 0xffffff, size: heavy ? 1.9 : 1.2, life: 8, grow: 1.08, bright: 2.2 });
    this.emit({ ...pos, tex: this.sparkTex, color, size: heavy ? 2.4 : 1.5, life: 10, grow: 1.05 });
    this.burst(pos.x, pos.y, pos.z, color, heavy ? 26 : 14, heavy ? 0.22 : 0.15);
    if (heavy) this.ring(pos, color, 2.4, 14);
  }

  block(pos) {
    this.emit({ ...pos, tex: this.sparkTex, color: 0x9fdcff, size: 1.1, life: 8, grow: 1.05, bright: 2 });
    for (let i = 0; i < 12; i++) {
      const a = (Math.random() - 0.5) * 2.2 + (Math.random() < 0.5 ? 0 : Math.PI);
      const v = 0.08 + Math.random() * 0.1;
      this.emit({ ...pos, color: 0xbfe9ff, size: 0.07, vx: Math.cos(a) * v, vy: Math.sin(a) * v + 0.05, g: 0.008, life: 18, drag: 0.93 });
    }
  }

  dust(x, y, z, n = 6) {
    for (let i = 0; i < n; i++) {
      this.emit({
        x: x + (Math.random() - 0.5) * 0.6, y: y + 0.05, z: z + (Math.random() - 0.5) * 0.3,
        color: 0x7a5a3a, bright: 0.6, normal: true, size: 0.3 + Math.random() * 0.3,
        vx: (Math.random() - 0.5) * 0.06, vy: 0.01 + Math.random() * 0.02, life: 30 + Math.random() * 20,
        grow: 1.03, drag: 0.95, fade: 0.5,
      });
    }
  }

  ring(pos, color, maxScale = 3, life = 20) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1, 48),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color).multiplyScalar(2), transparent: true, blending: THREE.AdditiveBlending,
        depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
      }),
    );
    m.position.set(pos.x, pos.y, pos.z);
    m.quaternion.copy(this.camera.quaternion);
    m.scale.setScalar(0.1);
    this.scene.add(m);
    this.meshes.push({ m, life, max: life, kind: 'ring', maxScale });
  }

  slash(x, y, z, facing, variant, color) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 0.95, 32, 1, 0, Math.PI * 0.9),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color).multiplyScalar(2.5), transparent: true, blending: THREE.AdditiveBlending,
        depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
      }),
    );
    m.position.set(x, y, z);
    m.rotation.z = variant ? -0.6 : 2.2;
    m.scale.set(facing, 1, 1);
    this.scene.add(m);
    this.meshes.push({ m, life: 12, max: 12, kind: 'slash' });
    this.burst(x, y, z, color, 10, 0.15);
  }

  lightning(x0, y0, x1, y1, color, life = 10) {
    const pts = [];
    const n = 10;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const j = i === 0 || i === n ? 0 : (Math.random() - 0.5) * 0.5;
      pts.push(new THREE.Vector3(x0 + (x1 - x0) * t + j, y0 + (y1 - y0) * t + j * 0.5, 0.35));
    }
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0);
    const m = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 20, 0.025, 4),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    );
    this.scene.add(m);
    this.meshes.push({ m, life, max: life, kind: 'bolt' });
  }

  update() {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const s = this.live[i];
      const u = s.userData;
      u.life--;
      u.vy -= u.g;
      u.vx *= u.drag;
      u.vy *= u.drag;
      s.position.x += u.vx;
      s.position.y += u.vy;
      s.position.z += u.vz;
      u.size *= u.grow;
      s.scale.setScalar(u.size);
      s.material.opacity = Math.min(1, (u.life / u.max) * 1.5) * u.fade;
      if (u.life <= 0) {
        s.visible = false;
        this.live.splice(i, 1);
        this.pool.push(s);
      }
    }
    for (let i = this.meshes.length - 1; i >= 0; i--) {
      const e = this.meshes[i];
      e.life--;
      const t = 1 - e.life / e.max;
      if (e.kind === 'ring') e.m.scale.setScalar(0.1 + t * e.maxScale);
      if (e.kind === 'slash') e.m.scale.y = 1 + t * 0.3;
      e.m.material.opacity = e.kind === 'bolt' ? (Math.random() < 0.7 ? e.life / e.max : 0.1) : 1 - t;
      if (e.life <= 0) {
        this.scene.remove(e.m);
        e.m.geometry.dispose();
        e.m.material.dispose();
        this.meshes.splice(i, 1);
      }
    }
  }

  clear() {
    for (const s of this.live) {
      s.visible = false;
      this.pool.push(s);
    }
    this.live.length = 0;
    for (const e of this.meshes) {
      this.scene.remove(e.m);
      e.m.geometry.dispose();
      e.m.material.dispose();
    }
    this.meshes.length = 0;
  }
}
