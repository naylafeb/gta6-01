// Five-Star Heat 3D: every tuning number, colour and story beat in one place.
// The world is a 2560 by 1920 metre coastal city at dusk; the renderer shows a
// 1280 by 720 window of it from a third-person chase camera.

export const VIEW = { width: 1280, height: 720 };
export const STEP = 1 / 60;

/** Avenues (north-south roads) and streets (east-west roads), centre lines in metres. */
export const AVENUES = [-1120, -800, -480, -160, 160, 480, 800, 1120];
export const STREETS = [-800, -480, -160, 160, 480, 800];
export const ROAD_HALF = 18;
export const WORLD = { minX: -1280, maxX: 1280, minZ: -960, maxZ: 960 };
export const BEACH_Z = 800;
export const SEA_Z = 960;

export const PLAYER = {
  footSpeed: 6,
  runSpeed: 9,
  radius: 0.6,
  health: 100,
  armour: 50,
  carAccel: 22,
  carBrake: 34,
  carReverse: 11,
  carMaxSpeed: 52,
  carMaxReverse: 14,
  carTurn: 1.9,
  carGrip: 2.6,
  pistolAmmo: 12,
  pistolDamage: 34,
  punchDamage: 12,
  punchRange: 1.8,
};

export const WANTED = {
  /** Heat 0-100; stars = ceil(heat / 20). */
  stealCar: 25,
  hitPedestrian: 15,
  hitCop: 20,
  punch: 10,
  shoot: 8,
  nearCopSpeeding: 2.5,
  spotlightPerSecond: 6,
  decayPerSecond: 3,
  hideoutDecayPerSecond: 14,
};

export const POLICE = {
  cruiserMaxSpeed: [0, 26, 29, 32, 34, 36],
  cruiserAccel: 18,
  interceptorMaxSpeed: 38,
  tankMaxSpeed: 9,
  tankRamDamage: 22,
  ramDamage: 6,
  roadblockEverySeconds: 26,
  heliCallEverySeconds: 14,
  maxCruisers: [0, 2, 3, 4, 5, 6],
  bustRadius: 4,
  bustSeconds: 2.5,
};

/** Districts the HUD names as the player drives through them. */
export const DISTRICTS = [
  { name: 'Neon Row', x0: -480, z0: -960, x1: 480, z1: -320 },
  { name: 'Palm Court', x0: 480, z0: -960, x1: 1280, z1: -320 },
  { name: 'Old Docks', x0: -1280, z0: -320, x1: -480, z1: 320 },
  { name: 'Coral Heights', x0: -480, z0: -320, x1: 480, z1: 480 },
  { name: 'Marina Bay', x0: 480, z0: 320, x1: 1280, z1: 800 },
  { name: 'South Beach', x0: -1280, z0: 800, x1: 1280, z1: 960 },
];

export const GARAGE = { x: -160, z: -480, r: 12 };
export const HOSPITAL = { x: -800, z: 160, r: 12 };
export const HIDEOUT = { x: 800, z: -480, r: 12 };
export const MARINA = { x: 1180, z: 700, r: 14 };
export const TUNNEL = { x: -1120, z: 800, r: 14 };
export const DROP_OFF = { x: 1120, z: 480, r: 12 };

/** The story arc: five jobs, ending in a five-star escape by boat. */
export const MISSIONS = [
  {
    id: 'hot-start',
    title: '1 — Hot Start',
    reward: 400,
    target: { x: GARAGE.x, z: GARAGE.z, r: GARAGE.r, label: "Lena's Garage" },
    lines: [
      'LENA: Jax, wheels. Grab any car off Neon Row and bring it to my garage.',
      'LENA: Careful — Solmar PD does not hand out parking tickets. They hand out stars.',
    ],
  },
  {
    id: 'neon-run',
    title: '2 — Neon Run',
    reward: 650,
    target: { x: DROP_OFF.x, z: DROP_OFF.z, r: DROP_OFF.r, label: 'Marina drop-off' },
    lines: [
      'BRICK: Package goes to the marina drop. Fast. The boys in blue are already sniffing.',
      'LENA: Two stars and counting if you dawdle. Keep it smooth, keep it moving.',
    ],
  },
  {
    id: 'beachfront-heat',
    title: '3 — Beachfront Heat',
    reward: 900,
    target: { x: HIDEOUT.x, z: HIDEOUT.z, r: HIDEOUT.r, label: 'Hideout' },
    lines: [
      'LENA: Three stars, Jax! Get to the hideout on Palm Court and lay low till it cools.',
      'BRICK: Cops sweep the beachfront first. Stay off the sand — too open.',
    ],
  },
  {
    id: 'air-one',
    title: '4 — Air One',
    reward: 1200,
    target: { x: TUNNEL.x, z: TUNNEL.z, r: TUNNEL.r, label: 'Underpass tunnel' },
    lines: [
      'LENA: Air One is up. That spotlight sees everything — get under the tunnel, west side.',
      'BRICK: Four stars. Do not stop. Do not look up. Just drive.',
    ],
  },
  {
    id: 'five-star-dawn',
    title: '5 — Five-Star Dawn',
    reward: 2500,
    target: { x: MARINA.x, z: MARINA.z, r: MARINA.r, label: 'Escape boat' },
    lines: [
      'LENA: Five stars. The whole city is coming — cruisers, roadblocks, the tank. The boat is at the marina.',
      'BRICK: One run, Jax. Dawn is coming. Make it count.',
    ],
  },
];

export const RADIOS = [
  { name: 'Solmar FM 88.4', style: 'sunset pop', bpm: 112, root: 220 },
  { name: 'Neon Tide Radio', style: 'night drive', bpm: 96, root: 174.61 },
];

export const PALETTE = {
  skyTop: '#2b1e4e',
  skyBottom: '#ff7a3c',
  road: '#2c2f3a',
  roadLine: '#d8c25a',
  sidewalk: '#4a4238',
  sand: '#d9b380',
  water: '#1d6f8e',
  palm: '#2f7d4f',
  palmTrunk: '#7a5a3c',
  player: '#ffd23c',
  playerCar: '#ffcf3d',
  police: '#3f7dff',
  tank: '#4c5a3c',
  heli: '#20242e',
  text: '#f4efe6',
  muted: '#b9b0a4',
  panel: '#100c1c',
  star: '#ffd23c',
  starEmpty: '#5a5470',
  health: '#54d97b',
  damage: '#ff534d',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const SAVE_KEY = 'five-star-heat.save.v1';
export const BEST_KEY = 'five-star-heat.best.v1';
