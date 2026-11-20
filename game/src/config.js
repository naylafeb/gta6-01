// Five-Star Heat: every tuning number, colour and story beat in one place.
// The world is a 2560x1920 coastal city; the renderer shows a 1280x720 window of it.

export const VIEW = { width: 1280, height: 720 };
export const WORLD = { width: 2560, height: 1920 };
export const STEP = 1 / 60;

/** Avenues (vertical roads) and streets (horizontal roads), centre lines in world px. */
export const AVENUES = [160, 480, 800, 1120, 1440, 1760, 2080, 2400];
export const STREETS = [160, 480, 800, 1120, 1440, 1760];
export const ROAD_W = 96;
export const BEACH_TOP = 1760;
export const WATER_TOP = 1864;

export const PLAYER = {
  footSpeed: 165,
  radius: 13,
  health: 100,
  carAccel: 340,
  carBrake: 520,
  carReverse: 170,
  carMaxSpeed: 560,
  carMaxReverse: 190,
  carTurn: 2.5,
  carGrip: 3.2,
};

export const WANTED = {
  /** Heat 0-100; stars = ceil(heat / 20). */
  stealCar: 25,
  hitPedestrian: 15,
  hitCop: 20,
  punch: 10,
  nearCopSpeeding: 2.5,
  decayPerSecond: 3,
  hideoutDecayPerSecond: 14,
};

export const POLICE = {
  cruiserMaxSpeed: [0, 430, 470, 510, 540, 560],
  cruiserAccel: 300,
  interceptorMaxSpeed: 590,
  tankMaxSpeed: 150,
  tankRamDamage: 22,
  ramDamage: 6,
  roadblockEverySeconds: 26,
  heliCallEverySeconds: 14,
  maxCruisers: [0, 2, 3, 4, 5, 6],
};

/** Districts the HUD names as the player drives through them. */
export const DISTRICTS = [
  { name: 'Neon Row', x0: 700, y0: 80, x1: 1560, y1: 560 },
  { name: 'Palm Court', x0: 1560, y0: 80, x1: 2560, y1: 560 },
  { name: 'Old Docks', x0: 80, y0: 560, x1: 700, y1: 1280 },
  { name: 'Coral Heights', x0: 700, y0: 560, x1: 1760, y1: 1280 },
  { name: 'Marina Bay', x0: 1760, y0: 1280, x1: 2560, y1: 1760 },
  { name: 'South Beach', x0: 80, y0: 1760, x1: 2560, y1: 1920 },
];

export const GARAGE = { x: 1160, y: 300, r: 70 };
export const HOSPITAL = { x: 300, y: 980, r: 70 };
export const HIDEOUT = { x: 1900, y: 300, r: 70 };
export const MARINA = { x: 2440, y: 1810, r: 80 };

/** The story arc: five jobs, ending in a five-star escape by boat. */
export const MISSIONS = [
  {
    id: 'hot-start',
    title: '1 — Hot Start',
    reward: 400,
    target: { x: GARAGE.x, y: GARAGE.y, r: GARAGE.r, label: 'Lena’s Garage' },
    lines: [
      'LENA: Jax, wheels. Grab any car off Neon Row and bring it to my garage.',
      'LENA: Careful — Solmar PD does not hand out parking tickets. They hand out stars.',
    ],
  },
  {
    id: 'neon-run',
    title: '2 — Neon Run',
    reward: 650,
    target: { x: 2320, y: 1500, r: 70, label: 'Marina drop-off' },
    lines: [
      'BRICK: Package goes to the marina drop. Fast. The boys in blue are already sniffing.',
      'LENA: Two stars and counting if you dawdle. Keep it smooth, keep it moving.',
    ],
  },
  {
    id: 'beachfront-heat',
    title: '3 — Beachfront Heat',
    reward: 900,
    target: { x: HIDEOUT.x, y: HIDEOUT.y, r: HIDEOUT.r, label: 'Hideout' },
    lines: [
      'LENA: Three stars, Jax! Get to the hideout on Palm Court and lay low till it cools.',
      'BRICK: Cops sweep the beachfront first. Stay off the sand — too open.',
    ],
  },
  {
    id: 'air-one',
    title: '4 — Air One',
    reward: 1200,
    target: { x: 200, y: 1700, r: 80, label: 'Underpass tunnel' },
    lines: [
      'LENA: Air One is up. That spotlight sees everything — get under the tunnel, west side.',
      'BRICK: Four stars. Do not stop. Do not look up. Just drive.',
    ],
  },
  {
    id: 'five-star-dawn',
    title: '5 — Five-Star Dawn',
    reward: 2500,
    target: { x: MARINA.x, y: MARINA.y, r: MARINA.r, label: 'Escape boat' },
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
  sky: '#2b1e4e',
  duskTop: '#3a2060',
  duskBottom: '#ff7a3c',
  road: '#2c2f3a',
  roadLine: '#d8c25a',
  sidewalk: '#4a4238',
  block: '#332f45',
  building: '#4b4365',
  buildingRoof: '#5d5478',
  neonPink: '#ff4d8d',
  neonCyan: '#37e0ff',
  neonGold: '#ffc53c',
  sand: '#d9b380',
  water: '#1d6f8e',
  waterDeep: '#14506a',
  palm: '#2f7d4f',
  palmTrunk: '#7a5a3c',
  grass: '#3d6b46',
  player: '#ffd23c',
  playerCar: '#ffcf3d',
  police: '#3f7dff',
  policeLightRed: '#ff2e2e',
  policeLightBlue: '#2e7dff',
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
