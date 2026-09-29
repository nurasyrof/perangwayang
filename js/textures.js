// Procedural wayang-kulit textures drawn on 2D canvases.
// Every part is drawn in its own local space (units, y-up, pivot at origin),
// then small holes are punched through the ornaments (tatahan) so the
// puppet casts a lace-like shadow on the kelir.

export const PX = 300; // pixels per world unit

// Part layout: w,h = size in units, ox,oy = pivot measured from bottom-left.
export const PARTS = {
  torso: { w: 1.1, h: 1.25, ox: 0.55, oy: 0.12 },
  head: { w: 0.95, h: 1.15, ox: 0.4, oy: 0.1 },
  upperArm: { w: 0.26, h: 0.66, ox: 0.13, oy: 0.6 },
  foreArm: { w: 0.34, h: 0.86, ox: 0.14, oy: 0.8 },
  thigh: { w: 0.36, h: 0.64, ox: 0.18, oy: 0.6 },
  shin: { w: 0.5, h: 0.74, ox: 0.16, oy: 0.68 },
  kain: { w: 1.1, h: 1.0, ox: 0.55, oy: 0.9 },
};

export const LIMB = { upper: 0.5, fore: 0.52, hand: 0.66, thigh: 0.52, shin: 0.6 };

function makeCanvas(spec) {
  const c = document.createElement('canvas');
  c.width = Math.round(spec.w * PX);
  c.height = Math.round(spec.h * PX);
  const ctx = c.getContext('2d');
  ctx.setTransform(PX, 0, 0, -PX, spec.ox * PX, (spec.h - spec.oy) * PX);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  return { c, ctx };
}

// ------------------------------------------------------------ helpers
function poly(ctx, pts, close = true) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (close) ctx.closePath();
}
// smooth closed curve through points (quadratic midpoints)
function blob(ctx, pts) {
  ctx.beginPath();
  const n = pts.length;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let m = mid(pts[n - 1], pts[0]);
  ctx.moveTo(m[0], m[1]);
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = mid(p, pts[(i + 1) % n]);
    ctx.quadraticCurveTo(p[0], p[1], q[0], q[1]);
  }
  ctx.closePath();
}
function fillStroke(ctx, fill, stroke = '#0b0705', lw = 0.012) {
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
function goldGrad(ctx, x0, y0, x1, y1, gold) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, '#fff2bf');
  g.addColorStop(0.35, gold);
  g.addColorStop(0.7, '#9a6a1f');
  g.addColorStop(1, gold);
  return g;
}
function holes(ctx, pts, r = 0.009) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000';
  for (const [x, y] of pts) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
function holeLine(x0, y0, x1, y1, n) {
  const out = [];
  for (let i = 0; i <= n; i++) out.push([x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n]);
  return out;
}
function band(ctx, x0, x1, y, h, gold, rows = 1) {
  ctx.beginPath();
  ctx.rect(x0, y - h / 2, x1 - x0, h);
  fillStroke(ctx, goldGrad(ctx, x0, y + h, x1, y - h, gold), '#3a2008', 0.006);
  const pts = [];
  const n = Math.max(2, Math.round((x1 - x0) / 0.03));
  for (let r = 0; r < rows; r++) {
    const yy = y - h / 2 + (h * (r + 1)) / (rows + 1);
    for (let i = 1; i < n; i++) pts.push([x0 + ((x1 - x0) * i) / n + (r % 2) * 0.012, yy]);
  }
  holes(ctx, pts, Math.min(0.008, h / 5));
}
// Leaf/flame ornament (sumping, praba feathers)
function leaf(ctx, x, y, len, wid, ang, fill, stroke = '#2a1405') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.4, wid, len, 0);
  ctx.quadraticCurveTo(len * 0.4, -wid, 0, 0);
  ctx.closePath();
  fillStroke(ctx, fill, stroke, 0.005);
  ctx.restore();
}
function spiral(ctx, x, y, r, turns, dir, color, lw = 0.012) {
  ctx.beginPath();
  const steps = 40 * turns;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = dir * t * turns * Math.PI * 2;
    const rr = r * (1 - t * 0.85);
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.stroke();
}

// Cloth patterns -------------------------------------------------------
function clothPattern(ctx, kind, look, x0, y0, x1, y1) {
  const { gold } = look;
  if (kind === 'poleng') {
    // Bima's sacred checkered cloth: black, white, red & gold
    const s = 0.075;
    for (let x = x0; x < x1; x += s) {
      for (let y = y0; y < y1; y += s) {
        const i = Math.round((x - x0) / s) + Math.round((y - y0) / s);
        const cols = ['#f4efe2', '#111', '#b3241a', '#111'];
        ctx.fillStyle = i % 2 === 0 ? cols[(Math.round((x - x0) / s) % 2) * 2] : '#111';
        ctx.fillRect(x, y, s + 0.002, s + 0.002);
      }
    }
    return;
  }
  ctx.fillStyle = look.cloth;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  if (kind === 'parang') {
    // diagonal parang rusak blades
    ctx.strokeStyle = look.cloth2;
    ctx.lineWidth = 0.014;
    for (let k = -2; k < 3; k += 0.14) {
      ctx.beginPath();
      for (let t = 0; t <= 1.0001; t += 0.05) {
        const x = x0 + k + t * 1.2;
        const y = y1 - t * 1.2 + Math.sin(t * 22) * 0.018;
        if (t === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.fillStyle = gold;
    for (let k = -2; k < 3; k += 0.14)
      for (let t = 0.05; t < 1; t += 0.1) {
        ctx.beginPath();
        ctx.arc(x0 + k + t * 1.2 + 0.05, y1 - t * 1.2, 0.01, 0, 7);
        ctx.fill();
      }
  } else if (kind === 'kawung') {
    const s = 0.1;
    for (let x = x0; x < x1 + s; x += s)
      for (let y = y0; y < y1 + s; y += s) {
        ctx.fillStyle = look.cloth2;
        for (let q = 0; q < 4; q++) {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate((q * Math.PI) / 2 + Math.PI / 4);
          ctx.beginPath();
          ctx.ellipse(0.024, 0, 0.022, 0.012, 0, 0, 7);
          ctx.fill();
          ctx.restore();
        }
      }
  } else if (kind === 'cinde') {
    const s = 0.09;
    for (let x = x0; x < x1 + s; x += s)
      for (let y = y0; y < y1 + s; y += s) {
        ctx.fillStyle = look.cloth2;
        poly(ctx, [[x, y + 0.035], [x + 0.035, y], [x, y - 0.035], [x - 0.035, y]]);
        ctx.fill();
        ctx.fillStyle = look.accent;
        ctx.beginPath();
        ctx.arc(x, y, 0.012, 0, 7);
        ctx.fill();
      }
  }
}

// ------------------------------------------------------------ parts
function drawUpperArm(ctx, look) {
  const k = look.build;
  const w0 = 0.07 * k, w1 = 0.05 * k;
  blob(ctx, [[-w0, 0.04], [w0, 0.05], [w0 * 0.95, -0.25], [w1, -0.5], [-w1, -0.5], [-w0 * 0.95, -0.25]]);
  fillStroke(ctx, look.skin);
  // kelat bahu (armlet) with naga motif
  band(ctx, -w0 - 0.01, w0 + 0.01, -0.12, 0.05, look.gold, 1);
  leaf(ctx, w0, -0.12, 0.08, 0.025, -0.4, goldGrad(ctx, 0, 0, 0.1, 0.1, look.gold));
}

function drawForeArm(ctx, look, isFront) {
  const k = look.build;
  const w0 = 0.05 * k, w1 = 0.038 * k;
  blob(ctx, [[-w0, 0.03], [w0, 0.03], [w1 + 0.005, -0.3], [w1, -0.5], [-w1, -0.5], [-w0, -0.25]]);
  fillStroke(ctx, look.skin);
  band(ctx, -w1 - 0.012, w1 + 0.012, -0.46, 0.05, look.gold, 1); // gelang
  // hand: wayang hands have long curled fingers pointing forward
  ctx.beginPath();
  ctx.moveTo(-w1, -0.49);
  ctx.quadraticCurveTo(-0.05, -0.6, -0.01, -0.66);
  ctx.quadraticCurveTo(0.06, -0.68, 0.12, -0.63);
  ctx.quadraticCurveTo(0.16, -0.59, 0.12, -0.585);
  ctx.quadraticCurveTo(0.07, -0.6, 0.05, -0.56);
  ctx.quadraticCurveTo(0.07, -0.52, w1, -0.49);
  ctx.closePath();
  fillStroke(ctx, look.skin);
  ctx.strokeStyle = '#0b0705';
  ctx.lineWidth = 0.006;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(0.0 + i * 0.02, -0.6 - i * 0.008);
    ctx.quadraticCurveTo(0.06, -0.63, 0.11, -0.615 + i * 0.006);
    ctx.stroke();
  }
  if (look.claw && isFront) {
    // Kuku Pancanaka: the long thumb-claw
    ctx.beginPath();
    ctx.moveTo(0.02, -0.55);
    ctx.quadraticCurveTo(0.2, -0.52, 0.27, -0.64);
    ctx.quadraticCurveTo(0.2, -0.58, 0.04, -0.585);
    ctx.closePath();
    fillStroke(ctx, '#f7d8c8', '#4a1a10', 0.006);
  }
}

function drawThigh(ctx, look) {
  const k = look.build;
  blob(ctx, [[-0.12 * k, 0.05], [0.12 * k, 0.05], [0.1 * k, -0.3], [0.075 * k, -0.53], [-0.07 * k, -0.53], [-0.1 * k, -0.25]]);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = look.pants;
  ctx.fillRect(-0.2, -0.6, 0.4, 0.7);
  ctx.fillStyle = look.gold;
  for (let y = -0.5; y < 0.05; y += 0.06)
    for (let x = -0.15; x < 0.15; x += 0.06) {
      ctx.beginPath();
      ctx.arc(x + ((y * 100) % 2 ? 0.03 : 0), y, 0.008, 0, 7);
      ctx.fill();
    }
  ctx.restore();
  blob(ctx, [[-0.12 * k, 0.05], [0.12 * k, 0.05], [0.1 * k, -0.3], [0.075 * k, -0.53], [-0.07 * k, -0.53], [-0.1 * k, -0.25]]);
  fillStroke(ctx, null);
}

function drawShin(ctx, look) {
  const k = look.build;
  blob(ctx, [[-0.075 * k, 0.03], [0.075 * k, 0.03], [0.06 * k, -0.25], [0.045, -0.5], [-0.05, -0.5], [-0.065 * k, -0.25]]);
  fillStroke(ctx, look.pants === look.skin ? look.skin : look.skin);
  // celana hem at the knee
  ctx.save();
  blob(ctx, [[-0.08 * k, 0.04], [0.08 * k, 0.04], [0.07 * k, -0.12], [-0.07 * k, -0.12]]);
  fillStroke(ctx, look.pants);
  band(ctx, -0.075 * k, 0.075 * k, -0.11, 0.03, look.gold, 1);
  ctx.restore();
  band(ctx, -0.055, 0.055, -0.47, 0.04, look.gold, 1); // binggel (anklet)
  // foot: flat, long, pointing forward
  ctx.beginPath();
  ctx.moveTo(-0.055, -0.49);
  ctx.lineTo(-0.075, -0.6);
  ctx.lineTo(0.26, -0.6);
  ctx.quadraticCurveTo(0.27, -0.56, 0.2, -0.55);
  ctx.quadraticCurveTo(0.1, -0.54, 0.05, -0.49);
  ctx.closePath();
  fillStroke(ctx, look.skin);
  ctx.strokeStyle = '#0b0705';
  ctx.lineWidth = 0.005;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(0.17 + i * 0.025, -0.6);
    ctx.lineTo(0.16 + i * 0.025, -0.565);
    ctx.stroke();
  }
}

function drawTorso(ctx, look) {
  const k = look.build;
  const fs = look.torso;
  const sh = 0.86; // shoulder height
  const body = [
    [-0.17 * k, 0.0], [0.19 * k, 0.0], [0.22 * k, 0.3], [0.27 * k, 0.6],
    [0.25 * k, sh], [0.08, sh + 0.08], [-0.06, sh + 0.08], [-0.22 * k, sh + 0.02], [-0.25 * k, 0.6], [-0.2 * k, 0.3],
  ];

  // badong / praba: ornament behind the back
  const bScale = fs === 'vest' ? 1.5 : fs === 'mighty' ? 1.2 : 1.0;
  ctx.save();
  ctx.translate(-0.2 * k, 0.55);
  for (let i = 0; i < 7; i++) {
    leaf(ctx, 0, 0, 0.26 * bScale, 0.05 * bScale, Math.PI - 0.5 + i * 0.17 + (i > 3 ? 0.05 : 0),
      i % 2 ? '#8a1c10' : goldGrad(ctx, -0.3, 0.3, 0, 0, look.gold));
  }
  ctx.restore();
  holes(ctx, [...Array(18)].map((_, i) => [-0.2 * k - 0.05 - (i % 6) * 0.03 * bScale, 0.5 + Math.floor(i / 6) * 0.05 - 0.02 + (i % 6) * 0.012]), 0.009);

  if (fs === 'putri') {
    // slim body with kemben
    blob(ctx, [[-0.14, 0.0], [0.14, 0.0], [0.17, 0.3], [0.22, 0.58], [0.18, sh], [0.04, sh + 0.08], [-0.06, sh + 0.08], [-0.17, sh + 0.02], [-0.19, 0.6], [-0.15, 0.3]]);
    fillStroke(ctx, look.skin);
    poly(ctx, [[-0.16, 0.12], [0.16, 0.12], [0.21, 0.5], [0.23, 0.6], [-0.19, 0.62], [-0.18, 0.4]]);
    ctx.save();
    ctx.clip();
    clothPattern(ctx, 'kawung', { ...look, cloth: look.kemben }, -0.3, 0.1, 0.3, 0.7);
    ctx.restore();
    poly(ctx, [[-0.16, 0.12], [0.16, 0.12], [0.21, 0.5], [0.23, 0.6], [-0.19, 0.62], [-0.18, 0.4]]);
    fillStroke(ctx, null);
    band(ctx, -0.2, 0.235, 0.6, 0.04, look.gold, 1);
  } else {
    blob(ctx, body);
    fillStroke(ctx, look.skin);
    // chest line
    ctx.beginPath();
    ctx.moveTo(0.26 * k, 0.55);
    ctx.quadraticCurveTo(0.12 * k, 0.45, 0.2 * k, 0.33);
    ctx.strokeStyle = 'rgba(0,0,0,.35)';
    ctx.lineWidth = 0.01;
    ctx.stroke();
  }

  if (fs === 'vest') {
    // Kotang Antakusuma - the magic vest that lets Gatotkaca fly
    poly(ctx, [[-0.2 * k, 0.1], [0.2 * k, 0.1], [0.25 * k, 0.55], [0.22 * k, 0.8], [0.08, 0.82], [0.02, 0.5], [-0.06, 0.82], [-0.21 * k, 0.8], [-0.24 * k, 0.5]]);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = look.vest;
    ctx.fillRect(-0.4, 0, 0.8, 1);
    ctx.fillStyle = look.gold;
    for (let y = 0.15; y < 0.85; y += 0.08)
      for (let x = -0.25; x < 0.3; x += 0.08) {
        ctx.save();
        ctx.translate(x + ((Math.round(y * 12.5) % 2) * 0.04), y);
        poly(ctx, [[0, 0.02], [0.006, 0.006], [0.02, 0], [0.006, -0.006], [0, -0.02], [-0.006, -0.006], [-0.02, 0], [-0.006, 0.006]]);
        ctx.fill();
        ctx.restore();
      }
    ctx.restore();
    poly(ctx, [[-0.2 * k, 0.1], [0.2 * k, 0.1], [0.25 * k, 0.55], [0.22 * k, 0.8], [0.08, 0.82], [0.02, 0.5], [-0.06, 0.82], [-0.21 * k, 0.8], [-0.24 * k, 0.5]]);
    fillStroke(ctx, null, look.gold, 0.012);
    // garuda emblem on chest
    ctx.save();
    ctx.translate(0.13, 0.5);
    for (let i = -2; i <= 2; i++) leaf(ctx, 0, 0, 0.09, 0.02, Math.PI / 2 + i * 0.35, goldGrad(ctx, 0, 0, 0.1, 0.1, look.gold));
    ctx.restore();
  }

  // kalung (necklace) - long ulur chain
  if (fs !== 'putri') {
    ctx.beginPath();
    ctx.moveTo(-0.02, sh + 0.04);
    ctx.quadraticCurveTo(0.24 * k, 0.55, 0.06, 0.34);
    ctx.strokeStyle = look.gold;
    ctx.lineWidth = 0.022;
    ctx.stroke();
    ctx.strokeStyle = '#6a4413';
    ctx.lineWidth = 0.006;
    ctx.stroke();
    leaf(ctx, 0.06, 0.34, 0.1, 0.03, -Math.PI / 2 - 0.3, goldGrad(ctx, 0, 0.2, 0.1, 0.4, look.gold));
  } else {
    ctx.beginPath();
    ctx.moveTo(-0.03, sh + 0.04);
    ctx.quadraticCurveTo(0.2, 0.74, 0.02, 0.66);
    ctx.strokeStyle = look.gold;
    ctx.lineWidth = 0.016;
    ctx.stroke();
  }
  // collar (kace)
  ctx.beginPath();
  ctx.ellipse(0.02, sh + 0.05, 0.14, 0.05, -0.15, 0, Math.PI * 2);
  fillStroke(ctx, goldGrad(ctx, -0.1, sh, 0.15, sh + 0.1, look.gold), '#3a2008', 0.006);
  holes(ctx, holeLine(-0.09, sh + 0.06, 0.13, sh + 0.03, 8), 0.008);
  // sabuk / waist belt
  band(ctx, -0.2 * k, 0.21 * k, 0.07, 0.09, look.gold, 2);
  // timang (buckle)
  ctx.beginPath();
  ctx.ellipse(0.17 * k, 0.07, 0.05, 0.06, 0, 0, 7);
  fillStroke(ctx, look.accent, look.gold, 0.012);
}

function drawKain(ctx, look) {
  const k = look.build;
  const kind = look.kain;
  const shape = kind === 'kawung'
    ? [[-0.2, 0.03], [0.2, 0.03], [0.26, -0.3], [0.3, -0.72], [-0.12, -0.74], [-0.24, -0.5], [-0.26, -0.2]]
    : [[-0.2 * k, 0.03], [0.21 * k, 0.03], [0.28 * k, -0.25], [0.24 * k, -0.42], [-0.05, -0.46], [-0.26 * k, -0.4], [-0.27 * k, -0.18]];
  // dodot / sampur long front flap
  const flap = [[0.1 * k, 0.0], [0.24 * k, 0.0], [0.33 * k, -0.62], [0.26 * k, -0.78], [0.16 * k, -0.7]];
  poly(ctx, flap);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = look.accent;
  ctx.fillRect(-0.5, -1, 1, 1.1);
  ctx.strokeStyle = look.gold;
  ctx.lineWidth = 0.01;
  for (let y = -0.8; y < 0; y += 0.05) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(0.5, y - 0.1);
    ctx.stroke();
  }
  ctx.restore();
  poly(ctx, flap);
  fillStroke(ctx, null);
  // fringe
  ctx.strokeStyle = look.gold;
  ctx.lineWidth = 0.008;
  for (let i = 0; i < 6; i++) {
    const x = 0.26 * k + i * 0.012, y = -0.78 + i * 0.03;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.015, y - 0.05);
    ctx.stroke();
  }

  blob(ctx, shape);
  ctx.save();
  ctx.clip();
  clothPattern(ctx, kind, look, -0.4, -0.9, 0.45, 0.1);
  ctx.restore();
  blob(ctx, shape);
  fillStroke(ctx, null);
  // hem stripe
  ctx.save();
  blob(ctx, shape);
  ctx.clip();
  ctx.strokeStyle = look.gold;
  ctx.lineWidth = 0.025;
  blob(ctx, shape);
  ctx.stroke();
  ctx.restore();
  // uncal (dangling ornament from the belt)
  ctx.beginPath();
  ctx.moveTo(-0.14 * k, 0.0);
  ctx.quadraticCurveTo(-0.2 * k, -0.2, -0.16 * k, -0.42);
  ctx.strokeStyle = look.gold;
  ctx.lineWidth = 0.02;
  ctx.stroke();
  leaf(ctx, -0.16 * k, -0.42, 0.13, 0.035, -Math.PI / 2, goldGrad(ctx, -0.2, -0.5, -0.1, -0.4, look.gold));
  holes(ctx, holeLine(-0.16 * k, -0.45, -0.16 * k, -0.52, 3), 0.008);
}

function drawHead(ctx, look) {
  const { faceStyle, crown } = look;
  const face = look.face;
  const strong = faceStyle === 'strong';
  const putri = faceStyle === 'putri';
  const B = strong ? 1.12 : 1.0;

  // ngore (hair falling on the back of the neck) + long hair for putri
  ctx.fillStyle = look.hair;
  if (putri) {
    blob(ctx, [[-0.12, 0.5], [-0.03, 0.45], [-0.08, 0.1], [-0.2, -0.12], [-0.26, 0.0], [-0.22, 0.3]]);
    fillStroke(ctx, look.hair);
  } else {
    blob(ctx, [[-0.12, 0.5], [-0.02, 0.4], [-0.06, 0.12], [-0.14, 0.02], [-0.2, 0.2]]);
    fillStroke(ctx, look.hair);
  }

  // neck
  poly(ctx, [[-0.055 * B, -0.05], [0.07 * B, -0.05], [0.06 * B, 0.12], [-0.05 * B, 0.12]]);
  fillStroke(ctx, putri ? look.skin : look.skin === '#17120f' ? face : look.skin);

  // face silhouette (profile, facing +x)
  let facePts;
  if (strong) {
    facePts = [
      [-0.12, 0.12], [-0.14, 0.34], [-0.06, 0.52], [0.13, 0.52], [0.16, 0.42],
      [0.2, 0.36], [0.26, 0.3], [0.27, 0.25], [0.22, 0.22], [0.2, 0.2], [0.21, 0.16],
      [0.17, 0.13], [0.15, 0.08], [0.06, 0.05],
    ];
  } else {
    facePts = [
      [-0.1, 0.12], [-0.12, 0.34], [-0.05, 0.5], [0.1, 0.5], [0.13, 0.42],
      [0.2, 0.3], [0.285, 0.21], [0.2, 0.2], [0.18, 0.18], [0.185, 0.16],
      [0.16, 0.14], [0.145, 0.1], [0.06, 0.06],
    ];
  }
  poly(ctx, facePts.map(([x, y]) => [x * B, y * B]));
  fillStroke(ctx, face, '#050302', 0.012);

  const eyeCut = face === '#e8c07a' || face === '#d9a548' ? '#1a0f08' : null;
  // eyes
  if (strong) {
    // mata thelengan (round, bulging)
    ctx.beginPath();
    ctx.ellipse(0.12 * B, 0.36 * B, 0.045, 0.034, 0, 0, 7);
    fillStroke(ctx, '#fff6dc', '#000', 0.008);
    ctx.beginPath();
    ctx.arc(0.135 * B, 0.36 * B, 0.017, 0, 7);
    ctx.fillStyle = '#000';
    ctx.fill();
    // brow
    ctx.beginPath();
    ctx.moveTo(0.06 * B, 0.41 * B);
    ctx.quadraticCurveTo(0.12 * B, 0.44 * B, 0.18 * B, 0.4 * B);
    ctx.strokeStyle = look.gold;
    ctx.lineWidth = 0.012;
    ctx.stroke();
    // mouth with fang + mustache
    ctx.beginPath();
    ctx.moveTo(0.21 * B, 0.2 * B);
    ctx.lineTo(0.13 * B, 0.18 * B);
    ctx.strokeStyle = '#b2160c';
    ctx.lineWidth = 0.014;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0.19 * B, 0.2 * B);
    ctx.lineTo(0.2 * B, 0.165 * B);
    ctx.lineTo(0.18 * B, 0.195 * B);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0.22 * B, 0.215 * B);
    ctx.quadraticCurveTo(0.14 * B, 0.25 * B, 0.08 * B, 0.2 * B);
    ctx.quadraticCurveTo(0.14 * B, 0.22 * B, 0.22 * B, 0.215 * B);
    fillStroke(ctx, '#000', '#000', 0.01);
  } else {
    // mata gabahan (rice-grain eye) - cut through like real wayang
    ctx.beginPath();
    ctx.moveTo(0.06 * B, 0.335);
    ctx.quadraticCurveTo(0.12, 0.36, 0.17, 0.325);
    ctx.quadraticCurveTo(0.12, 0.315, 0.06 * B, 0.335);
    ctx.closePath();
    if (eyeCut) fillStroke(ctx, '#fff6dc', eyeCut, 0.008);
    else {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fill();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.moveTo(0.05, 0.37);
    ctx.quadraticCurveTo(0.12, 0.39, 0.18, 0.35);
    ctx.strokeStyle = eyeCut || look.gold;
    ctx.lineWidth = 0.008;
    ctx.stroke();
    // lips
    ctx.beginPath();
    ctx.moveTo(0.185, 0.17);
    ctx.lineTo(0.15, 0.165);
    ctx.strokeStyle = '#b52414';
    ctx.lineWidth = 0.01;
    ctx.stroke();
  }

  // sumping (ear ornament) - leaf fan
  const ex = 0.0, ey = 0.3 * B;
  for (let i = 0; i < 5; i++) {
    leaf(ctx, ex, ey, 0.17, 0.035, Math.PI + 0.9 - i * 0.28, i % 2 ? '#a12014' : goldGrad(ctx, -0.2, 0.1, 0.1, 0.4, look.gold));
  }
  ctx.beginPath();
  ctx.arc(ex, ey, 0.035, 0, 7);
  fillStroke(ctx, look.accent, look.gold, 0.012);
  // anting
  ctx.beginPath();
  ctx.moveTo(ex, ey - 0.03);
  ctx.lineTo(ex - 0.01, ey - 0.16);
  ctx.strokeStyle = look.gold;
  ctx.lineWidth = 0.012;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(ex - 0.01, ey - 0.17, 0.02, 0, 7);
  fillStroke(ctx, '#c42818', look.gold, 0.006);

  // crowns / headdress
  const g = (x0, y0, x1, y1) => goldGrad(ctx, x0, y0, x1, y1, look.gold);
  if (crown === 'supit') {
    // Gelung supit urang: bun curling like a prawn's claw
    ctx.fillStyle = look.hair;
    ctx.beginPath();
    ctx.moveTo(-0.13, 0.4);
    ctx.bezierCurveTo(-0.3, 0.6, -0.1, 0.86, 0.05, 0.78);
    ctx.bezierCurveTo(0.14, 0.73, 0.1, 0.62, 0.04, 0.66);
    ctx.bezierCurveTo(-0.02, 0.7, -0.08, 0.64, 0.0, 0.54);
    ctx.lineTo(0.1, 0.5);
    ctx.lineTo(-0.05, 0.5);
    ctx.closePath();
    fillStroke(ctx, look.hair, '#000', 0.01);
    // gold jamang on the forehead
    poly(ctx, [[-0.06, 0.47], [0.12, 0.5], [0.14, 0.56], [-0.04, 0.56]]);
    fillStroke(ctx, g(-0.05, 0.47, 0.14, 0.56), '#3a2008', 0.006);
    holes(ctx, holeLine(-0.03, 0.52, 0.11, 0.525, 6), 0.008);
    // garuda mungkur at back of the bun
    for (let i = 0; i < 4; i++) leaf(ctx, -0.14, 0.58, 0.14, 0.03, Math.PI - 0.4 + i * 0.25, g(-0.3, 0.5, -0.1, 0.7));
    ctx.beginPath();
    ctx.arc(-0.13, 0.58, 0.035, 0, 7);
    fillStroke(ctx, look.accent, look.gold, 0.01);
    // small red ribbon
    leaf(ctx, 0.06, 0.78, 0.12, 0.02, 0.8, '#b8261a');
  } else if (crown === 'minangkara') {
    // Gelung minangkara: huge bun with forward curl & golden pupuk on the forehead
    ctx.beginPath();
    ctx.moveTo(-0.16, 0.42);
    ctx.bezierCurveTo(-0.34, 0.66, -0.2, 0.98, 0.08, 0.92);
    ctx.bezierCurveTo(0.26, 0.88, 0.26, 0.72, 0.16, 0.68);
    ctx.bezierCurveTo(0.1, 0.66, 0.06, 0.74, 0.1, 0.78);
    ctx.bezierCurveTo(-0.02, 0.8, -0.06, 0.66, 0.02, 0.6);
    ctx.lineTo(0.15, 0.56);
    ctx.lineTo(-0.05, 0.54);
    ctx.closePath();
    fillStroke(ctx, look.hair, '#000', 0.01);
    ctx.beginPath();
    ctx.moveTo(-0.2, 0.62);
    ctx.bezierCurveTo(-0.15, 0.84, 0.05, 0.9, 0.13, 0.84);
    ctx.strokeStyle = look.gold;
    ctx.lineWidth = 0.018;
    ctx.stroke();
    poly(ctx, [[-0.08, 0.52], [0.15, 0.56], [0.17, 0.62], [-0.06, 0.61]]);
    fillStroke(ctx, g(-0.05, 0.5, 0.15, 0.6), '#3a2008', 0.006);
    holes(ctx, holeLine(-0.04, 0.57, 0.14, 0.585, 7), 0.008);
    // pupuk (jewel) on forehead
    ctx.beginPath();
    ctx.arc(0.16, 0.56, 0.028, 0, 7);
    fillStroke(ctx, '#d83a1f', look.gold, 0.01);
    for (let i = 0; i < 5; i++) leaf(ctx, -0.18, 0.6, 0.18, 0.035, Math.PI - 0.6 + i * 0.28, i % 2 ? '#8a1c10' : g(-0.35, 0.5, -0.1, 0.7));
    ctx.beginPath();
    ctx.arc(-0.17, 0.6, 0.04, 0, 7);
    fillStroke(ctx, look.accent, look.gold, 0.01);
  } else if (crown === 'makutha') {
    // Caping/makutha with garuda mungkur (Gatotkaca)
    // rounded topong with a backward-curling tip
    ctx.beginPath();
    ctx.moveTo(-0.17, 0.44);
    ctx.lineTo(0.17, 0.5);
    ctx.bezierCurveTo(0.23, 0.62, 0.17, 0.78, 0.05, 0.84);
    ctx.bezierCurveTo(0.0, 0.88, -0.01, 0.97, -0.1, 1.0);
    ctx.bezierCurveTo(-0.07, 0.92, -0.1, 0.87, -0.14, 0.82);
    ctx.bezierCurveTo(-0.21, 0.72, -0.21, 0.56, -0.17, 0.44);
    ctx.closePath();
    fillStroke(ctx, g(-0.2, 0.44, 0.2, 0.9), '#3a2008', 0.01);
    // red tiers following the dome
    ctx.strokeStyle = '#8a1c10';
    ctx.lineWidth = 0.022;
    for (let t = 0; t < 3; t++) {
      ctx.beginPath();
      ctx.moveTo(-0.18 + t * 0.015, 0.53 + t * 0.1);
      ctx.quadraticCurveTo(0.0, 0.6 + t * 0.1, 0.19 - t * 0.04, 0.57 + t * 0.09);
      ctx.stroke();
    }
    holes(ctx, [...holeLine(-0.14, 0.49, 0.14, 0.53, 9), ...holeLine(-0.13, 0.6, 0.13, 0.64, 8), ...holeLine(-0.1, 0.71, 0.08, 0.73, 5)], 0.009);
    // jamang band + jewel
    poly(ctx, [[-0.17, 0.43], [0.17, 0.49], [0.18, 0.53], [-0.17, 0.48]]);
    fillStroke(ctx, g(-0.1, 0.4, 0.2, 0.55), '#3a2008', 0.006);
    ctx.beginPath();
    ctx.arc(0.12, 0.62, 0.028, 0, 7);
    fillStroke(ctx, '#d83a1f', look.gold, 0.01);
    ctx.beginPath();
    ctx.arc(-0.1, 1.0, 0.022, 0, 7);
    fillStroke(ctx, '#d83a1f', look.gold, 0.008);
    // garuda mungkur: bird head facing backwards with wings
    ctx.save();
    ctx.translate(-0.2, 0.62);
    for (let i = 0; i < 6; i++) leaf(ctx, 0, 0, 0.22, 0.04, Math.PI - 0.8 + i * 0.3, i % 2 ? '#8a1c10' : g(-0.2, -0.1, 0.1, 0.2));
    ctx.beginPath();
    ctx.arc(0, 0, 0.05, 0, 7);
    fillStroke(ctx, look.accent, look.gold, 0.012);
    ctx.beginPath();
    ctx.moveTo(-0.04, 0.02);
    ctx.lineTo(-0.1, -0.02);
    ctx.lineTo(-0.03, -0.02);
    fillStroke(ctx, look.gold, '#3a2008', 0.005);
    ctx.restore();
    // mustache thin sideburn (godeg)
    ctx.beginPath();
    ctx.moveTo(0.0, 0.45);
    ctx.quadraticCurveTo(-0.06, 0.3, 0.02, 0.18);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 0.02;
    ctx.stroke();
  } else if (crown === 'keling') {
    // Gelung keling: round bun with flowers (Srikandi)
    ctx.beginPath();
    ctx.moveTo(-0.12, 0.42);
    ctx.bezierCurveTo(-0.22, 0.56, -0.12, 0.68, 0.02, 0.62);
    ctx.lineTo(0.1, 0.5);
    ctx.lineTo(-0.05, 0.47);
    ctx.closePath();
    fillStroke(ctx, look.hair, '#000', 0.01);
    ctx.beginPath();
    ctx.arc(-0.14, 0.58, 0.1, 0, 7);
    fillStroke(ctx, look.hair, '#000', 0.01);
    ctx.beginPath();
    ctx.arc(-0.14, 0.58, 0.07, 0, 7);
    ctx.strokeStyle = look.gold;
    ctx.lineWidth = 0.016;
    ctx.stroke();
    // flowers (ceplok)
    for (const [fx, fy] of [[-0.05, 0.6], [-0.2, 0.66], [-0.22, 0.5]]) {
      for (let p = 0; p < 5; p++) {
        ctx.beginPath();
        ctx.arc(fx + Math.cos((p * 2 * Math.PI) / 5) * 0.018, fy + Math.sin((p * 2 * Math.PI) / 5) * 0.018, 0.013, 0, 7);
        ctx.fillStyle = '#f7efe0';
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(fx, fy, 0.01, 0, 7);
      ctx.fillStyle = look.accent;
      ctx.fill();
    }
    poly(ctx, [[-0.05, 0.47], [0.1, 0.49], [0.11, 0.53], [-0.04, 0.53]]);
    fillStroke(ctx, g(-0.05, 0.47, 0.1, 0.53), '#3a2008', 0.006);
    leaf(ctx, -0.18, 0.66, 0.2, 0.02, 2.3, look.gold);
  }
}

export function drawPart(name, look, opts = {}) {
  const spec = PARTS[name];
  const { c, ctx } = makeCanvas(spec);
  switch (name) {
    case 'torso': drawTorso(ctx, look); break;
    case 'head': drawHead(ctx, look); break;
    case 'upperArm': drawUpperArm(ctx, look); break;
    case 'foreArm': drawForeArm(ctx, look, opts.front); break;
    case 'thigh': drawThigh(ctx, look); break;
    case 'shin': drawShin(ctx, look); break;
    case 'kain': drawKain(ctx, look); break;
  }
  return c;
}

// Head portrait for HUD / select cards
export function drawPortrait(target, look, flip = false) {
  const head = drawPart('head', look);
  const ctx = target.getContext('2d');
  const W = target.width, H = target.height;
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (flip) {
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
  }
  const s = (H * 0.98) / head.height;
  const dw = head.width * s, dh = head.height * s;
  ctx.drawImage(head, (W - dw) / 2 + W * 0.04, H - dh, dw, dh);
  ctx.restore();
}

// ------------------------------------------------------------ stage art
export function drawGunungan(w = 700, h = 1100) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.setTransform(w, 0, 0, -w, w / 2, h); // units: width 1, origin bottom-center, y up
  const H = h / w;
  const outline = () => {
    ctx.beginPath();
    ctx.moveTo(-0.46, 0.02);
    ctx.bezierCurveTo(-0.52, 0.45, -0.46, 0.75, -0.3, 0.98);
    ctx.bezierCurveTo(-0.16, 1.2, -0.04, 1.35, 0, H - 0.02);
    ctx.bezierCurveTo(0.04, 1.35, 0.16, 1.2, 0.3, 0.98);
    ctx.bezierCurveTo(0.46, 0.75, 0.52, 0.45, 0.46, 0.02);
    ctx.closePath();
  };
  outline();
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#5a120b');
  bg.addColorStop(0.5, '#8e1f14');
  bg.addColorStop(1, '#2c0805');
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.save();
  outline();
  ctx.clip();
  // flames at the top rim
  for (let i = 0; i < 40; i++) {
    const t = i / 39;
    const a = -1.2 + t * 2.4;
    leaf(ctx, Math.sin(a) * 0.4, 0.55 + Math.cos(a) * 0.75, 0.2, 0.04, Math.PI / 2 + a * 0.9, i % 2 ? '#e0a33a' : '#b8261a', '#2a0805');
  }
  // tree of life
  const gold = '#e8b85a';
  const branch = (x, y, ang, len, depth) => {
    if (depth <= 0 || len < 0.02) return;
    const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(ang + 0.3) * len * 0.6, y + Math.sin(ang + 0.3) * len * 0.6, x2, y2);
    ctx.strokeStyle = gold;
    ctx.lineWidth = 0.004 + depth * 0.004;
    ctx.stroke();
    if (depth <= 2) {
      spiral(ctx, x2, y2, 0.025, 1.2, ang > Math.PI / 2 ? 1 : -1, gold, 0.005);
      leaf(ctx, x2, y2, 0.05, 0.015, ang + 0.6, '#2f8f63', '#10301f');
    }
    branch(x2, y2, ang + 0.45, len * 0.72, depth - 1);
    branch(x2, y2, ang - 0.45, len * 0.72, depth - 1);
  };
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0.25);
  ctx.lineTo(0, 1.1);
  ctx.strokeStyle = gold;
  ctx.lineWidth = 0.03;
  ctx.stroke();
  for (let i = 0; i < 7; i++) {
    const y = 0.42 + i * 0.1;
    branch(0, y, Math.PI / 2 - 0.9, 0.16 - i * 0.012, 4);
    branch(0, y, Math.PI / 2 + 0.9, 0.16 - i * 0.012, 4);
  }
  // kala face (banaspati) in the center
  ctx.beginPath();
  ctx.ellipse(0, 0.62, 0.11, 0.09, 0, 0, 7);
  fillStroke(ctx, '#1b0a06', gold, 0.012);
  ctx.fillStyle = '#fff2c8';
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(sx * 0.045, 0.65, 0.022, 0, 7);
    ctx.fill();
  }
  ctx.fillStyle = '#000';
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(sx * 0.045, 0.65, 0.01, 0, 7);
    ctx.fill();
  }
  ctx.fillStyle = '#fff';
  for (let i = -3; i <= 3; i++) {
    poly(ctx, [[i * 0.018 - 0.008, 0.59], [i * 0.018 + 0.008, 0.59], [i * 0.018, 0.565]]);
    ctx.fill();
  }
  // gapura (gate) at the base
  poly(ctx, [[-0.18, 0.02], [0.18, 0.02], [0.18, 0.2], [0.12, 0.24], [0.12, 0.3], [0, 0.36], [-0.12, 0.3], [-0.12, 0.24], [-0.18, 0.2]]);
  fillStroke(ctx, '#b0482a', gold, 0.012);
  ctx.strokeStyle = 'rgba(60,15,5,.8)';
  ctx.lineWidth = 0.004;
  for (let y = 0.05; y < 0.3; y += 0.03) {
    ctx.beginPath();
    ctx.moveTo(-0.18, y);
    ctx.lineTo(0.18, y);
    ctx.stroke();
  }
  poly(ctx, [[-0.05, 0.02], [0.05, 0.02], [0.05, 0.14], [0, 0.18], [-0.05, 0.14]]);
  fillStroke(ctx, '#1a0a04', gold, 0.008);
  // guardian clubs
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(sx * 0.3, 0.14, 0.06, 0.12, 0, 0, 7);
    fillStroke(ctx, '#20100a', gold, 0.01);
    ctx.beginPath();
    ctx.arc(sx * 0.3, 0.22, 0.03, 0, 7);
    fillStroke(ctx, '#fff2c8', null);
  }
  ctx.restore();
  // gold rim with tatahan holes
  outline();
  ctx.strokeStyle = gold;
  ctx.lineWidth = 0.02;
  ctx.stroke();
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 260; i++) {
    const x = (Math.random() - 0.5) * 0.8;
    const y = 0.35 + Math.random() * 0.95;
    ctx.beginPath();
    ctx.arc(x, y, 0.006 + Math.random() * 0.004, 0, 7);
    ctx.fill();
  }
  ctx.restore();
  // central gapit stick
  ctx.fillStyle = '#3a2412';
  ctx.fillRect(-0.012, -0.5, 0.024, 0.55);
  return c;
}

export function drawKelir(w = 2048, h = 1024) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#efe2c2';
  ctx.fillRect(0, 0, w, h);
  // weave noise
  const img = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 14;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  ctx.strokeStyle = 'rgba(120,90,50,.06)';
  for (let x = 0; x < w; x += 6) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  // plangitan (top border) - red with gold
  ctx.fillStyle = '#7d1710';
  ctx.fillRect(0, 0, w, 60);
  ctx.fillStyle = '#d7a94a';
  ctx.fillRect(0, 60, w, 8);
  for (let x = 0; x < w; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 68);
    ctx.lineTo(x + 20, 92);
    ctx.lineTo(x + 40, 68);
    ctx.fillStyle = '#7d1710';
    ctx.fill();
  }
  // palemahan (bottom border) - black
  ctx.fillStyle = '#1a0d08';
  ctx.fillRect(0, h - 70, w, 70);
  ctx.fillStyle = '#d7a94a';
  ctx.fillRect(0, h - 76, w, 6);
  return c;
}

export function drawWood(w = 1024, h = 1024) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const plank = 128;
  for (let y = 0; y < h; y += plank) {
    const base = 38 + Math.random() * 14;
    ctx.fillStyle = `hsl(22, 45%, ${base / 4}%)`;
    ctx.fillRect(0, y, w, plank);
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = `rgba(${40 + Math.random() * 40},${20 + Math.random() * 20},10,.35)`;
      ctx.lineWidth = 1 + Math.random() * 2;
      ctx.beginPath();
      const yy = y + Math.random() * plank;
      ctx.moveTo(0, yy);
      for (let x = 0; x < w; x += 64) ctx.lineTo(x, yy + Math.sin(x * 0.01 + i) * 4);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillRect(0, y, w, 3);
  }
  return c;
}

// Radial soft sprite for particles
export function drawGlow(size = 64, inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, 'rgba(255,255,255,.55)');
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}
export function drawSpark(size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.translate(size / 2, size / 2);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.2, 'rgba(255,255,255,.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  for (let i = 0; i < 8; i++) {
    ctx.rotate(Math.PI / 4);
    ctx.beginPath();
    ctx.moveTo(0, -size * (i % 2 ? 0.25 : 0.5));
    ctx.lineTo(size * 0.05, 0);
    ctx.lineTo(0, size * (i % 2 ? 0.25 : 0.5));
    ctx.lineTo(-size * 0.05, 0);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.12, 0, 7);
  ctx.fill();
  return c;
}
