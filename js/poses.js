// Joint angles in radians, puppet facing +x.
// Limbs hang straight down at 0; positive shoulder/hip swings forward & up,
// positive elbow flexes the hand up, negative knee bends the shin back.
// lean < 0 bows the torso forward. spin rotates the whole body around the hip.

export const NEUTRAL = {
  lean: 0, head: 0, sF: 0.2, eF: 0.3, sB: -0.1, eB: 0.3,
  hF: 0.15, kF: -0.05, hB: -0.15, kB: -0.05, kain: 0, spin: 0, dx: 0, hip: null,
};

const P = (o) => ({ ...NEUTRAL, ...o });

export const IDLE = P({ lean: -0.06, head: 0.02, sF: 0.75, eF: 1.5, sB: 0.45, eB: 1.9, hF: 0.38, kF: -0.45, hB: -0.2, kB: -0.1 });
export const CROUCH = P({ lean: -0.3, head: 0.22, sF: 0.9, eF: 1.6, sB: 0.6, eB: 1.9, hF: 1.35, kF: -2.1, hB: 0.5, kB: -2.0 });
export const BLOCK = P({ lean: 0.06, head: -0.12, sF: 1.25, eF: 2.35, sB: 1.05, eB: 2.45, hF: 0.3, kF: -0.3, hB: -0.3, kB: -0.1 });
export const CROUCH_BLOCK = P({ ...CROUCH, sF: 1.3, eF: 2.25, sB: 1.1, eB: 2.4, lean: -0.15 });
export const PREJUMP = P({ ...CROUCH, lean: -0.2, hF: 1.0, kF: -1.5, hB: 0.3, kB: -1.3 });
export const JUMP_UP = P({ lean: -0.1, head: -0.05, sF: 1.9, eF: 1.0, sB: 1.3, eB: 1.2, hF: 1.25, kF: -1.7, hB: 0.3, kB: -1.5 });
export const JUMP_FALL = P({ lean: 0.05, sF: 1.2, eF: 0.8, sB: 0.4, eB: 0.9, hF: 0.6, kF: -0.7, hB: -0.1, kB: -0.5 });
export const LAND = P({ ...CROUCH, lean: -0.2, hF: 0.9, kF: -1.4, hB: 0.25, kB: -1.2 });

export const HIT_HIGH = P({ lean: 0.5, head: 0.4, sF: 0.3, eF: 0.8, sB: -0.4, eB: 0.5, hF: 0.1, kF: -0.3, hB: -0.35, kB: -0.1, dx: -0.12 });
export const HIT_GUT = P({ lean: -0.55, head: 0.25, sF: 0.1, eF: 0.6, sB: -0.2, eB: 0.4, hF: 0.3, kF: -0.6, hB: -0.3, kB: -0.3, dx: -0.1 });
export const HIT_CROUCH = P({ ...CROUCH, lean: 0.15, head: 0.4, sF: 0.3, eF: 0.8 });
export const BLOCKSTUN = P({ ...BLOCK, lean: 0.18, dx: -0.06 });
export const LAUNCHED = P({ lean: 0.4, head: 0.45, sF: -0.6, eF: 0.4, sB: -0.9, eB: 0.3, hF: 0.7, kF: -1.0, hB: 0.3, kB: -0.4, spin: 0.7 });
export const LYING = P({ spin: 1.5, lean: 0, head: 0.15, hip: 0.2, sF: 2.6, eF: 0.2, sB: 2.9, eB: 0.2, hF: 0.15, kF: -0.25, hB: 0.05, kB: -0.1 });
export const GETUP = P({ ...CROUCH, lean: -0.45, sF: 0.4, eF: 0.8, sB: 0.2, eB: 0.8 });
export const ROLL = P({ lean: -0.8, head: 0.45, sF: 1.9, eF: 2.2, sB: 1.8, eB: 2.3, hF: 2.2, kF: -2.5, hB: 2.0, kB: -2.5, hip: 0.55 });
export const STAGGER = P({ lean: 0.35, head: 0.35, sF: 0.1, eF: 0.3, sB: -0.2, eB: 0.2, hF: 0.25, kF: -0.4, hB: -0.2, kB: -0.2 });
export const VICTORY = P({ lean: 0.1, head: -0.15, sF: 2.9, eF: 0.35, sB: 0.55, eB: 1.9, hF: 0.35, kF: -0.25, hB: -0.3, kB: -0.1 });
export const SEMBAH = P({ lean: -0.35, head: 0.3, sF: 1.1, eF: 2.2, sB: 1.0, eB: 2.3, hF: 0.9, kF: -1.6, hB: 0.0, kB: -0.9 });

// Attack poses: [windup, strike]
export const ATTACK = {
  jab: [
    P({ ...IDLE, sF: 0.5, eF: 2.1, lean: -0.02 }),
    P({ lean: -0.22, head: 0.05, sF: 1.58, eF: 0.05, sB: 0.3, eB: 1.9, hF: 0.55, kF: -0.55, hB: -0.35, kB: -0.1, dx: 0.12 }),
  ],
  jab2: [
    P({ ...IDLE, sB: 0.2, eB: 2.2, lean: 0.02 }),
    P({ lean: -0.3, head: 0.05, sB: 1.62, eB: 0.05, sF: 0.4, eF: 1.7, hF: 0.6, kF: -0.6, hB: -0.4, kB: -0.1, dx: 0.18 }),
  ],
  jab3: [
    P({ lean: 0.12, sF: 0.1, eF: 2.3, sB: 1.0, eB: 1.8, hF: 0.3, kF: -0.4, hB: -0.2, kB: -0.2, dx: -0.05 }),
    P({ lean: -0.45, head: 0.1, sF: 1.72, eF: 0.0, sB: -0.35, eB: 0.6, hF: 0.85, kF: -0.95, hB: -0.6, kB: -0.05, dx: 0.3 }),
  ],
  kick: [
    P({ lean: 0.15, sF: 1.0, eF: 1.4, sB: 0.2, eB: 1.0, hF: 1.0, kF: -1.8, hB: -0.1, kB: -0.1 }),
    P({ lean: 0.35, head: -0.1, sF: 0.3, eF: 1.2, sB: -0.4, eB: 0.8, hF: 1.57, kF: -0.05, hB: -0.05, kB: -0.05 }),
  ],
  roundhouse: [
    P({ lean: 0.3, sF: 0.6, eF: 1.2, sB: -0.3, eB: 0.8, hF: 1.3, kF: -2.0, hB: 0.0, kB: -0.1 }),
    P({ lean: 0.55, head: -0.2, sF: -0.2, eF: 0.5, sB: -0.7, eB: 0.3, hF: 2.05, kF: -0.1, hB: 0.0, kB: 0.0, dx: 0.1 }),
  ],
  heavy: [
    P({ lean: 0.28, sF: -0.4, eF: 1.7, sB: 0.8, eB: 1.8, hF: 0.25, kF: -0.25, hB: -0.2, kB: -0.2, dx: -0.12 }),
    P({ lean: -0.5, head: 0.12, sF: 1.45, eF: -0.05, sB: -0.5, eB: 0.4, hF: 0.9, kF: -1.0, hB: -0.7, kB: 0.0, dx: 0.35 }),
  ],
  upper: [
    P({ lean: -0.35, sF: 0.1, eF: 1.3, sB: 0.6, eB: 1.8, hF: 1.0, kF: -1.6, hB: 0.3, kB: -1.5 }),
    P({ lean: 0.18, head: -0.25, sF: 2.95, eF: 0.3, sB: 0.2, eB: 1.0, hF: 0.4, kF: -0.3, hB: -0.2, kB: -0.2, dx: 0.1 }),
  ],
  sweep: [
    P({ ...CROUCH }),
    P({ lean: -0.45, head: 0.2, sF: 0.6, eF: 0.5, sB: 1.2, eB: 1.0, hF: 1.52, kF: 0.0, hB: 0.6, kB: -2.3 }),
  ],
  airP: [
    P({ ...JUMP_UP, sF: 0.6, eF: 2.0 }),
    P({ lean: -0.3, sF: 1.1, eF: 0.1, sB: 0.5, eB: 1.5, hF: 1.0, kF: -1.4, hB: 0.2, kB: -1.2 }),
  ],
  airK: [
    P({ ...JUMP_UP }),
    P({ lean: 0.25, sF: 1.5, eF: 1.0, sB: 0.8, eB: 1.0, hF: 0.85, kF: -0.05, hB: -0.2, kB: -0.8 }),
  ],
};

// Ultimate poses
export const ULT = {
  bowDraw: P({ lean: 0.05, head: 0.0, sF: 1.57, eF: 0.0, sB: 1.45, eB: 2.7, hF: 0.55, kF: -0.3, hB: -0.45, kB: -0.1 }),
  bowRelease: P({ lean: 0.12, head: -0.05, sF: 1.6, eF: 0.0, sB: 0.6, eB: 1.2, hF: 0.55, kF: -0.3, hB: -0.45, kB: -0.1 }),
  bowUp: P({ lean: 0.3, head: -0.4, sF: 2.45, eF: 0.0, sB: 2.3, eB: 2.4, hF: 0.45, kF: -0.3, hB: -0.35, kB: -0.1 }),
  roar: P({ lean: 0.2, head: -0.2, sF: 2.4, eF: 1.2, sB: 2.1, eB: 1.3, hF: 0.6, kF: -0.8, hB: -0.5, kB: -0.3 }),
  rush: P({ lean: -0.7, head: 0.35, sF: 1.3, eF: 0.4, sB: 0.2, eB: 1.2, hF: 1.0, kF: -1.2, hB: -0.8, kB: -0.2, dx: 0.15 }),
  slashA: P({ lean: -0.4, sF: 2.4, eF: 0.5, sB: 0.3, eB: 1.2, hF: 0.7, kF: -0.8, hB: -0.5, kB: -0.1 }),
  slashB: P({ lean: -0.55, sF: 0.6, eF: 0.1, sB: 1.9, eB: 0.4, hF: 0.7, kF: -0.8, hB: -0.5, kB: -0.1 }),
  charge: P({ ...CROUCH, lean: -0.5, sF: -0.5, eF: 2.0, sB: 0.4, eB: 1.8 }),
  flyUp: P({ lean: 0.0, head: -0.3, sF: 3.0, eF: 0.0, sB: 2.8, eB: 0.1, hF: 0.0, kF: -0.2, hB: -0.2, kB: -0.3 }),
  dive: P({ lean: 0.0, head: 0.3, sF: 3.05, eF: 0.0, sB: 2.4, eB: 0.4, hF: 0.1, kF: -0.3, hB: -0.3, kB: -0.4, spin: -2.3 }),
  impact: P({ ...CROUCH, lean: -0.6, sF: 1.2, eF: 0.2, sB: 0.3, eB: 1.2, hF: 1.5, kF: -2.3, hB: 0.2, kB: -1.8 }),
};
