// Biblioteca de poses compartilhada pelo elenco nativo. Cada personagem pode
// sobrescrever poses pelo nome (ver characters.mjs → stance/poses).

const crouchLegs = { legF: [-12, 100], legB: [128, 70] };
const tuck = { legF: [10, 115], legB: [40, 140], ground: false };

export const POSES = {
  // ------------------------------------------------------------ básico
  stand1: {},
  stand2: { torso: -82, armF: [64, -34], legF: [70, 99], legB: [112, 97] },
  stand3: { torso: -80, armF: [66, -30], armB: [102, -50], legF: [72, 100], legB: [110, 98] },
  turn: { torso: -90, armF: [80, -60], armB: [80, -60], legF: [88, 92], legB: [92, 88] },
  crouchDown: { torso: -70, ...{ legF: [20, 105], legB: [130, 80] } },
  crouch1: { torso: -62, armF: [40, -50], armB: [80, -60], ...crouchLegs },
  crouch2: { torso: -60, armF: [42, -46], armB: [82, -56], ...crouchLegs },
  walk1: { legF: [55, 100], legB: [120, 92] },
  walk2: { legF: [75, 100], legB: [110, 115] },
  walk3: { legF: [95, 120], legB: [92, 100] },
  walk4: { legF: [118, 98], legB: [64, 100] },
  walk5: { legF: [105, 115], legB: [80, 92] },
  walk6: { legF: [88, 95], legB: [96, 120] },
  jumpStart: { torso: -75, legF: [30, 110], legB: [140, 75] },
  jumpUp: { torso: -88, armF: [20, -40], armB: [150, -150], ...tuck },
  jumpFwd: { torso: -60, armF: [10, -20], armB: [140, -170], legF: [0, 110], legB: [50, 150], ground: false },
  jumpBack: { torso: -105, armF: [40, -40], armB: [170, -150], legF: [30, 120], legB: [70, 150], ground: false },
  jumpDown: { torso: -86, armF: [40, -30], armB: [130, -120], legF: [60, 100], legB: [100, 95], ground: false },
  land: { torso: -70, legF: [15, 105], legB: [135, 78] },
  run1: { torso: -62, armF: [40, -60], armB: [150, 60], legF: [30, 100], legB: [140, 160] },
  run2: { torso: -64, armF: [120, 60], armB: [20, -70], legF: [100, 160], legB: [60, 100] },
  run3: { torso: -62, armF: [150, 70], armB: [30, -60], legF: [140, 170], legB: [30, 95] },
  hopBack: { torso: -110, armF: [30, -60], armB: [160, 170], legF: [40, 110], legB: [110, 130], ground: false },

  // ------------------------------------------------------------ defesa
  guard: { torso: -98, armF: [-25, -110], armB: [15, -112], legF: [64, 100], legB: [118, 94], hipX: -2 },
  guardCrouch: { torso: -80, armF: [-30, -112], armB: [10, -115], ...crouchLegs },
  guardAir: { torso: -95, armF: [-25, -110], armB: [15, -112], ...tuck },
  guardHit: { torso: -104, armF: [-35, -118], armB: [5, -118], legF: [60, 104], legB: [124, 96], hipX: -4 },
  guardCrouchHit: { torso: -88, armF: [-38, -118], armB: [0, -118], ...crouchLegs, hipX: -3 },

  // ------------------------------------------------------- normais em pé
  jabWind: { torso: -82, armF: [40, -70], armB: [100, -60] },
  jab: { torso: -80, armF: [2, 0], armB: [105, -60], hurtArm: true, strike: "handF", legF: [62, 100] },
  straightWind: { torso: -86, armF: [70, -40], armB: [140, -40] },
  straight: { torso: -70, armF: [80, -40], armB: [-4, -2], hurtArm: true, strike: "handB", legF: [55, 95], legB: [125, 100] },
  hookWind: { torso: -92, armF: [100, 20], armB: [100, -60] },
  hook: { torso: -74, armF: [-35, -75], armB: [110, -60], hurtArm: true, strike: "handF", legF: [60, 96] },
  hookFollow: { torso: -82, armF: [-60, -95], armB: [110, -60], hurtArm: true },
  shortKickWind: { torso: -96, legF: [40, 130], legB: [100, 92] },
  shortKick: { torso: -104, armF: [100, -50], legF: [18, 12], legB: [96, 92], strike: "footF" },
  midKickWind: { torso: -100, legF: [10, 120], legB: [102, 90] },
  midKick: { torso: -112, armF: [110, -40], armB: [150, -30], legF: [-14, -16], legB: [98, 90], strike: "footF" },
  roundWind: { torso: -102, armF: [120, -30], legF: [-10, 100], legB: [100, 90] },
  roundhouse: { torso: -124, armF: [150, -20], armB: [170, -60], legF: [-38, -44], legB: [96, 90], strike: "footF" },

  // ----------------------------------------------------- normais agachado
  crouchJab: { torso: -64, armF: [8, 4], armB: [80, -60], hurtArm: true, strike: "handF", ...crouchLegs },
  crouchUpperWind: { torso: -58, armF: [100, 120], armB: [80, -60], ...crouchLegs },
  crouchUpper: { torso: -86, armF: [-70, -88], armB: [100, -50], legF: [50, 100], legB: [120, 90], hurtArm: true, strike: "handF" },
  crouchKick: { torso: -55, armF: [60, -40], armB: [90, -60], legF: [10, 4], legB: [130, 70], strike: "footF" },
  sweep1: { torso: -40, armF: [100, 90], armB: [120, 80], legF: [5, 0], legB: [150, 60], strike: "footF" },
  sweep2: { torso: -38, armF: [95, 90], armB: [120, 80], legF: [-2, -2], legB: [150, 60], strike: "footF" },

  // ------------------------------------------------------------- aéreos
  airPunch: { torso: -70, armF: [30, 25], armB: [140, -150], ...tuck, hurtArm: true, strike: "handF" },
  airHammer: { torso: -60, armF: [40, 80], armB: [30, 85], ...tuck, strike: "hands" },
  airKick: { torso: -100, armF: [120, -40], armB: [170, -130], legF: [40, 42], legB: [60, 150], ground: false, strike: "footF" },
  flyingKick: { torso: -115, armF: [130, -20], armB: [170, -90], legF: [12, 10], legB: [60, 150], ground: false, strike: "footF" },

  // ------------------------------------------------------------ apanhar
  hitLight: { torso: -102, head: -110, armF: [90, 40], armB: [120, 60], legF: [70, 100], legB: [118, 96], hipX: -2 },
  hitMedium: { torso: -114, head: -125, armF: [120, 60], armB: [150, 60], legF: [66, 104], legB: [122, 92], hipX: -4 },
  hitHard: { torso: -50, head: -20, armF: [80, 110], armB: [100, 120], legF: [80, 100], legB: [110, 96], hipX: -3 },
  hitCrouch: { torso: -96, head: -115, armF: [100, 50], armB: [130, 60], ...crouchLegs },
  hitAir: { torso: -160, head: -170, armF: [-120, -150], armB: [-60, -90], legF: [20, 40], legB: [-10, 20], ground: false },
  fall: { torso: 175, head: 170, armF: [-100, -140], armB: [-60, -100], legF: [-20, 10], legB: [-35, -5], ground: false },
  bounce: { torso: 170, head: 175, armF: [-80, -40], armB: [-120, -160], legF: [-10, 5], legB: [-25, 0] },
  lie: { torso: 180, head: 180, armF: [-160, 180], armB: [160, 175], legF: [-4, 2], legB: [6, 0] },
  getUp1: { torso: -150, head: -140, armF: [120, 100], armB: [140, 110], legF: [-20, 80], legB: [10, 90] },
  getUp2: { torso: -70, armF: [80, 60], armB: [100, 70], ...crouchLegs },

  // --------------------------------------------------- poses de round
  win1: { torso: -88, armF: [-40, -90], armB: [110, -50], legF: [80, 95], legB: [102, 92] },
  win2: { torso: -90, armF: [-82, -96], armB: [100, 60], legF: [84, 92], legB: [98, 90] },
  lose: { torso: -66, head: -30, armF: [95, 92], armB: [100, 95], legF: [80, 96], legB: [105, 95] },
  intro1: { torso: -90, armF: [35, -150], armB: [40, -150], legF: [86, 92], legB: [96, 90] },
  intro2: { torso: -70, head: -60, armF: [45, -145], armB: [50, -148], legF: [86, 92], legB: [96, 90] },

  // ------------------------------------------------------- especiais
  palmWind: { torso: -92, armF: [140, -170], armB: [150, -175], legF: [60, 100], legB: [124, 92], hipX: -3 },
  palmThrust: { torso: -72, armF: [-2, 4], armB: [4, 2], legF: [42, 95], legB: [130, 104], hurtArm: true },
  risingWind: { torso: -55, armF: [110, 130], armB: [90, -60], ...crouchLegs },
  rising1: { torso: -82, armF: [-62, -80], armB: [100, -40], legF: [40, 120], legB: [100, 90], strike: "handF", hurtArm: true, ground: false },
  rising2: { torso: -88, armF: [-84, -92], armB: [110, 10], legF: [20, 110], legB: [96, 92], strike: "handF", ground: false },
  spinA: { torso: -90, armF: [-10, 10], armB: [190, 170], legF: [2, 4], legB: [110, 140], ground: false, strike: "footF" },
  spinB: { torso: -90, armF: [170, 190], armB: [10, -10], legF: [110, 140], legB: [178, 176], ground: false, strike: "footB" },
  dashPunch: { torso: -48, armF: [110, 40], armB: [-2, 0], legF: [30, 90], legB: [160, 150], hurtArm: true, strike: "handB" },
  shoulder: { torso: -40, head: -50, armF: [60, 100], armB: [100, 110], legF: [30, 95], legB: [160, 155], strike: "body" },
  slamWind: { torso: -100, armF: [-110, -100], armB: [-100, -95], legF: [60, 100], legB: [124, 92] },
  slam: { torso: -38, head: -20, armF: [70, 95], armB: [60, 92], legF: [40, 110], legB: [130, 80], strike: "hands" },
  vanish: { torso: -60, armF: [100, 120], armB: [100, 120], ...crouchLegs },
  capoeira1: { torso: 100, head: 110, armF: [80, 92], armB: [100, 95], legF: [-60, -40], legB: [-110, -130], ground: true, strike: "footF" },
  capoeira2: { torso: 95, head: 100, armF: [85, 95], armB: [95, 92], legF: [-120, -140], legB: [-40, -20], ground: true, strike: "footB" },
  superPose: { torso: -92, armF: [-35, -40], armB: [-145, -140], legF: [62, 100], legB: [120, 92] },
};
