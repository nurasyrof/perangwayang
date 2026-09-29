import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { drawGunungan, drawKelir, drawWood, drawGlow } from './textures.js';
import { STAGE_HALF } from './fighter.js';

// The pendopo: kelir screen lit by the blencong oil lamp, gunungan on both
// sides, banana-trunk debog, gamelan in the foreground.
export class Stage {
  constructor(container) {
    const renderer = (this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color(0x0c0604);
    scene.fog = new THREE.Fog(0x0c0604, 16, 34);

    this.camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(0, 2.2, 11);
    this.camPos = this.camera.position.clone();
    this.camLook = new THREE.Vector3(0, 1.4, 0);
    this.lookCur = this.camLook.clone();
    this.shakeAmp = 0;
    this.mode = 'orbit';
    this.time = 0;

    this.buildLights();
    this.buildSet();

    const composer = (this.composer = new EffectComposer(renderer));
    composer.addPass(new RenderPass(scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.55, 0.55, 0.85);
    composer.addPass(this.bloom);
    composer.addPass(new OutputPass());

    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  }

  buildLights() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0x8a5a3a, 0x1a0c06, 0.6));
    // blencong: the oil lamp above the dalang that throws the shadows
    const lamp = (this.lamp = new THREE.SpotLight(0xffb86a, 38, 0, 0.95, 0.5, 1.2));
    lamp.position.set(0, 5.2, 5.2);
    lamp.target.position.set(0, 2.2, -3.2);
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(2048, 2048);
    lamp.shadow.camera.near = 2;
    lamp.shadow.camera.far = 20;
    lamp.shadow.bias = -0.0004;
    lamp.shadow.radius = 2;
    s.add(lamp, lamp.target);
    this.lampBase = 38;

    const fill = new THREE.DirectionalLight(0xffe2b8, 0.9);
    fill.position.set(-4, 6, 8);
    s.add(fill);
    const rim = (this.rim = new THREE.DirectionalLight(0xff8a4a, 0.6));
    rim.position.set(5, 3, -2);
    s.add(rim);

    // ult mood light
    this.moodLight = new THREE.PointLight(0x88ccff, 0, 12, 1.2);
    this.moodLight.position.set(0, 2, 2);
    s.add(this.moodLight);

    // lamp prop + flame
    const brass = new THREE.MeshStandardMaterial({ color: 0xb8862b, metalness: 0.9, roughness: 0.3 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), brass);
    body.scale.set(1.3, 0.6, 1);
    body.position.copy(lamp.position).add(new THREE.Vector3(0, 0.25, 0));
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.5, 8), brass);
    beak.rotation.x = Math.PI / 2;
    beak.position.copy(body.position).add(new THREE.Vector3(0, 0, -0.35));
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 4), brass);
    chain.position.copy(body.position).add(new THREE.Vector3(0, 2, 0));
    this.flame = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(drawGlow(64, 'rgba(255,240,200,1)')), color: 0xffb050,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    this.flame.material.color.multiplyScalar(3);
    this.flame.scale.set(0.35, 0.6, 1);
    this.flame.position.copy(beak.position).add(new THREE.Vector3(0, 0.15, -0.25));
    s.add(body, beak, chain, this.flame);
  }

  buildSet() {
    const s = this.scene;
    // kelir (screen)
    const kelirTex = new THREE.CanvasTexture(drawKelir());
    kelirTex.colorSpace = THREE.SRGBColorSpace;
    const kelir = new THREE.Mesh(
      new THREE.PlaneGeometry(34, 10.5),
      new THREE.MeshStandardMaterial({ map: kelirTex, roughness: 0.95 }),
    );
    kelir.position.set(0, 5.0, -3.2);
    kelir.receiveShadow = true;
    s.add(kelir);
    this.kelir = kelir;
    // wooden frame (gawang)
    const wood = new THREE.MeshStandardMaterial({ color: 0x3a1c0c, roughness: 0.6 });
    const frameTop = new THREE.Mesh(new THREE.BoxGeometry(35, 0.3, 0.3), wood);
    frameTop.position.set(0, 10.3, -3.15);
    s.add(frameTop);
    for (const x of [-17, 17]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 11, 0.35), wood);
      post.position.set(x, 5, -3.15);
      s.add(post);
    }

    // floor
    const woodTex = new THREE.CanvasTexture(drawWood());
    woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping;
    woodTex.repeat.set(6, 3);
    woodTex.colorSpace = THREE.SRGBColorSpace;
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 30),
      new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.55, metalness: 0.05, color: 0x9a7a60 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    s.add(floor);

    // debog (banana trunks) where the puppets are planted
    const debogMat = new THREE.MeshStandardMaterial({ color: 0x4a5230, roughness: 0.85 });
    const debogBack = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 34, 20), debogMat);
    debogBack.rotation.z = Math.PI / 2;
    debogBack.position.set(0, 0.3, -2.75);
    debogBack.receiveShadow = true;
    s.add(debogBack);
    const debogFront = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 26, 20), debogMat);
    debogFront.rotation.z = Math.PI / 2;
    debogFront.position.set(0, -0.12, 1.6);
    s.add(debogFront);

    // gunungan: tree-of-life puppets marking the stage edges
    const gTex = new THREE.CanvasTexture(drawGunungan());
    gTex.colorSpace = THREE.SRGBColorSpace;
    this.gununganTex = gTex;
    const mkG = (h) => {
      const w = h * (700 / 1100);
      const geo = new THREE.PlaneGeometry(w, h);
      geo.translate(0, h / 2, 0);
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: gTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.2 }));
      m.castShadow = true;
      m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: gTex, alphaTest: 0.5 });
      return m;
    };
    this.gunungans = [];
    for (const sx of [-1, 1]) {
      const g = mkG(4.6);
      g.position.set(sx * (STAGE_HALF + 1.6), -0.25, -1.6);
      g.rotation.z = sx * -0.12;
      s.add(g);
      this.gunungans.push(g);
    }
    // center gunungan: stands in the middle before the lakon begins
    this.centerG = mkG(4.2);
    this.centerG.position.set(0, -0.2, -0.6);
    s.add(this.centerG);
    this.centerGTarget = 1;

    // pendopo pillars & roof beams
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x4a1a0e, roughness: 0.5 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xc8922e, metalness: 0.85, roughness: 0.3 });
    for (const x of [-15, 15]) {
      for (const z of [-5, 3.5]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 12, 12), pillarMat);
        p.position.set(x, 6, z);
        s.add(p);
        for (const y of [0.6, 3.5, 9]) {
          const r = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.06, 8, 20), goldMat);
          r.rotation.x = Math.PI / 2;
          r.position.set(x, y, z);
          s.add(r);
        }
      }
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(34, 0.5, 0.5), pillarMat);
    beam.position.set(0, 11.5, 3.5);
    s.add(beam);

    // gamelan in the foreground: bonang rack + gong stands
    const bronze = new THREE.MeshStandardMaterial({ color: 0x9c6b22, metalness: 0.9, roughness: 0.28 });
    const rackMat = new THREE.MeshStandardMaterial({ color: 0x5a1a0f, roughness: 0.5 });
    for (const sx of [-1, 1]) {
      const rack = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.25, 0.8), rackMat);
      frame.position.y = 0.3;
      rack.add(frame);
      for (let i = 0; i < 6; i++) {
        for (let r = 0; r < 2; r++) {
          const pot = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), bronze);
          pot.position.set(-1.3 + i * 0.52, 0.42, -0.18 + r * 0.36);
          const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), bronze);
          knob.position.set(pot.position.x, 0.62, pot.position.z);
          rack.add(pot, knob);
        }
      }
      rack.position.set(sx * 6.5, 0, 4.2);
      s.add(rack);

      const gong = new THREE.Group();
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.18, 32), bronze);
      disc.rotation.x = Math.PI / 2;
      const boss = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 10), bronze);
      boss.position.z = 0.12;
      const standL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.2, 0.18), rackMat);
      standL.position.set(-1.2, 0.3, 0);
      const standR = standL.clone();
      standR.position.x = 1.2;
      const top = new THREE.Mesh(new THREE.BoxGeometry(3, 0.25, 0.25), rackMat);
      top.position.y = 1.9;
      const topG1 = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.6, 4), goldMat);
      topG1.position.set(0, 2.25, 0);
      gong.add(disc, boss, standL, standR, top, topG1);
      gong.position.set(sx * 11.5, 1.6, 2.5);
      gong.rotation.y = -sx * 0.4;
      s.add(gong);
    }

    // floating embers / dust motes in the lamp light
    const N = 260;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 24;
      pos[i * 3 + 1] = Math.random() * 8;
      pos[i * 3 + 2] = -2.5 + Math.random() * 6;
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.embers = new THREE.Points(pg, new THREE.PointsMaterial({
      size: 0.06, map: new THREE.CanvasTexture(drawGlow(32)), color: 0xffb060, transparent: true,
      opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    s.add(this.embers);
  }

  setMood(color, intensity) {
    this.moodTarget = { color: new THREE.Color(color), intensity };
  }

  shake(a) {
    this.shakeAmp = Math.max(this.shakeAmp, a);
  }

  // mode: orbit | select | fight | cine
  updateCamera(dt, ctx) {
    this.time += dt;
    const t = this.time;
    let pos, look, k = 0.06;
    if (this.mode === 'orbit') {
      pos = new THREE.Vector3(Math.sin(t * 0.12) * 5.5, 2.6 + Math.sin(t * 0.2) * 0.4, 10.5 + Math.cos(t * 0.12) * 1.5);
      look = new THREE.Vector3(0, 2.0, -0.5);
      k = 0.03;
    } else if (this.mode === 'select') {
      pos = new THREE.Vector3(0, 1.6, 10.5);
      look = new THREE.Vector3(0, 1.75, 0);
      k = 0.05;
    } else if (this.mode === 'cine' && ctx.caster) {
      const c = ctx.caster;
      const cy = Math.min(c.y, 4);
      pos = new THREE.Vector3(c.x + c.facing * 2.6, 1.8 + cy, 5.0);
      look = new THREE.Vector3(c.x + c.facing * 0.3, 1.5 + cy, 0);
      k = 0.1;
    } else if (this.mode === 'victory' && ctx.winner) {
      const c = ctx.winner;
      pos = new THREE.Vector3(c.x + c.facing * 1.8 + Math.sin(t * 0.3) * 0.5, 1.7, 5.5);
      look = new THREE.Vector3(c.x, 1.6, 0);
      k = 0.03;
    } else {
      const [a, b] = ctx.fighters;
      const ay = a.y > 7 ? 0 : a.y, by = b.y > 7 ? 0 : b.y;
      let mid = (a.x + b.x) / 2;
      mid = Math.max(-STAGE_HALF + 3.2, Math.min(STAGE_HALF - 3.2, mid));
      const sep = Math.abs(a.x - b.x);
      const ym = Math.min(Math.max(ay, by), 4);
      const z = Math.max(8.4, Math.min(13, 6.8 + sep * 0.7));
      pos = new THREE.Vector3(mid, 2.05 + ym * 0.3, z);
      look = new THREE.Vector3(mid, 1.4 + ym * 0.35, 0);
      k = 0.08;
    }
    this.camPos.lerp(pos, k);
    this.lookCur.lerp(look, k * 1.2);
    this.camera.position.copy(this.camPos);
    if (this.shakeAmp > 0.002) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeAmp;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeAmp;
      this.shakeAmp *= 0.86;
    }
    this.camera.lookAt(this.lookCur);
  }

  update(dt) {
    const t = this.time;
    // blencong flicker
    const flick = 1 + Math.sin(t * 13) * 0.03 + Math.sin(t * 7.3) * 0.04 + (Math.random() - 0.5) * 0.04;
    this.lamp.intensity = this.lampBase * flick;
    this.flame.scale.set(0.35 * flick, 0.6 * flick, 1);
    // embers drift upward
    const p = this.embers.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) + 0.004 + Math.sin(t + i) * 0.001;
      if (y > 8) y = 0;
      p.setY(i, y);
      p.setX(i, p.getX(i) + Math.sin(t * 0.5 + i) * 0.002);
    }
    p.needsUpdate = true;
    // mood light for ultimates
    if (this.moodTarget) {
      this.moodLight.color.lerp(this.moodTarget.color, 0.1);
      this.moodLight.intensity += (this.moodTarget.intensity - this.moodLight.intensity) * 0.1;
    }
    // center gunungan raise/lower
    const cg = this.centerG;
    const target = this.centerGTarget;
    cg.position.y += ((target ? -0.2 : 9) - cg.position.y) * 0.05;
    cg.rotation.z += ((target ? 0 : 0.6) - cg.rotation.z) * 0.05;
    cg.visible = cg.position.y < 8.5;
  }

  render() {
    this.composer.render();
  }
}
