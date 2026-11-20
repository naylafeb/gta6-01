// Solmar Bay itself: the road grid, the blocks between them, the beachfront, the
// buildings, palms, neon signs, traffic lights and wanted posters. Generation is
// seeded, so the same seed always builds the same city.

import {
  AVENUES, BEACH_TOP, DISTRICTS, GARAGE, HIDEOUT, HOSPITAL, MARINA,
  PALETTE, ROAD_W, STREETS, WATER_TOP, WORLD,
} from './config.js';
import { pick, range } from './random.js';

const BUILDING_COLORS = ['#4b4365', '#544a6e', '#453d5e', '#5d5478', '#3e3752'];
const ROOF_COLORS = ['#6a5f8a', '#7a6a9a', '#5d5478', '#8a6a7a'];
const NEON_SIGNS = [
  { text: 'NEON', color: '#ff4d8d' },
  { text: 'SOLMAR', color: '#37e0ff' },
  { text: 'TIDE', color: '#ffc53c' },
  { text: '24H TACOS', color: '#ff9a3c' },
  { text: 'HOTEL', color: '#ff4d8d' },
  { text: 'ARCADE', color: '#37e0ff' },
  { text: 'PIER 9', color: '#ffc53c' },
  { text: 'DINE', color: '#54d97b' },
];
const CAR_COLORS = ['#c94f43', '#4f7dc9', '#e8e4da', '#3c3f4a', '#7a4fc9', '#c9a44f', '#4fc9a4', '#8a93a3'];

function isRoadPoint(x, y) {
  for (const ax of AVENUES) if (Math.abs(x - ax) < ROAD_W / 2) return true;
  for (const sy of STREETS) if (Math.abs(y - sy) < ROAD_W / 2) return true;
  return false;
}

/** The nearest road centre line (avenue or street) to a point. */
export function nearestRoad(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const ax of AVENUES) {
    const d = Math.abs(x - ax);
    if (d < bestD) { bestD = d; best = { axis: 'x', at: ax, along: y }; }
  }
  for (const sy of STREETS) {
    const d = Math.abs(y - sy);
    if (d < bestD) { bestD = d; best = { axis: 'y', at: sy, along: x }; }
  }
  return best;
}

export function createWorld(random) {
  const buildings = [];
  const palms = [];
  const posters = [];
  const lights = [];
  const parked = [];

  // Blocks: the rectangles between neighbouring avenues and streets.
  for (let ai = 0; ai < AVENUES.length - 1; ai += 1) {
    for (let si = 0; si < STREETS.length - 1; si += 1) {
      const x0 = AVENUES[ai] + ROAD_W / 2 + 14;
      const x1 = AVENUES[ai + 1] - ROAD_W / 2 - 14;
      const y0 = STREETS[si] + ROAD_W / 2 + 14;
      const y1 = STREETS[si + 1] - ROAD_W / 2 - 14;
      const kind = random();
      if (kind < 0.12) {
        // A plaza or park: grass, a few palms, no buildings.
        for (let p = 0; p < 5; p += 1) {
          palms.push({ x: range(random, x0 + 20, x1 - 20), y: range(random, y0 + 20, y1 - 20), sway: random() * Math.PI * 2 });
        }
        continue;
      }
      // One or two buildings per block, with a neon sign on some.
      const split = random() < 0.5;
      const spots = split
        ? [{ x: x0, y: y0, w: (x1 - x0) / 2 - 8, h: y1 - y0 }, { x: x0 + (x1 - x0) / 2 + 8, y: y0, w: (x1 - x0) / 2 - 8, h: y1 - y0 }]
        : [{ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }];
      for (const s of spots) {
        const b = {
          x: s.x, y: s.y, w: s.w, h: s.h,
          color: pick(random, BUILDING_COLORS),
          roof: pick(random, ROOF_COLORS),
          floors: 2 + Math.floor(random() * 5),
          sign: random() < 0.45 ? pick(random, NEON_SIGNS) : null,
        };
        buildings.push(b);
        if (random() < 0.5) {
          posters.push({ x: b.x + 6, y: b.y + b.h - 26, text: 'WANTED' });
        }
      }
      // A parked car or two along the block's edge.
      if (random() < 0.7) {
        parked.push({
          x: x0 + 30, y: y1 - 12, angle: 0,
          color: pick(random, CAR_COLORS), parked: true,
        });
      }
    }
  }

  // Palm-lined beachfront: a row of palms above the sand, and a few on the avenues.
  for (let x = 120; x < WORLD.width; x += 130) {
    palms.push({ x: x + range(random, -20, 20), y: BEACH_TOP - 30 + range(random, -8, 8), sway: random() * Math.PI * 2 });
  }
  for (const ax of AVENUES) {
    for (let y = 300; y < BEACH_TOP - 100; y += 640) {
      if (random() < 0.5) palms.push({ x: ax + 62, y, sway: random() * Math.PI * 2 });
    }
  }

  // Traffic lights at every intersection, cycling with an offset per corner.
  for (const ax of AVENUES) {
    for (const sy of STREETS) {
      lights.push({ x: ax, y: sy, phase: ((ax + sy) % 3) * 2.1, period: 9 });
    }
  }

  // The marina: a wooden pier jutting into the water at the east end.
  const pier = { x: 2320, y: WATER_TOP - 40, w: 200, h: 26 };

  return {
    buildings, palms, posters, lights, parked, pier,
    /** True when the point is on a road (drivable). */
    isRoad: isRoadPoint,
    /** True when the point is sand or water (not drivable, slow on foot). */
    isBeach(x, y) { return y >= BEACH_TOP; },
    isWater(x, y) { return y >= WATER_TOP; },
    /** Traffic-light state at an intersection at time t: 'go' | 'slow' | 'stop'. */
    lightState(light, t) {
      const phase = (t + light.phase) % light.period;
      if (phase < 5) return 'go';
      if (phase < 6.5) return 'slow';
      return 'stop';
    },
    /** The district name for a point, for the HUD. */
    districtAt(x, y) {
      for (const d of DISTRICTS) {
        if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d.name;
      }
      return 'Solmar Bay';
    },
    /** Push a circle out of every building it overlaps; returns true on a hit. */
    collideCircle(body) {
      let hit = false;
      for (const b of buildings) {
        const cx = Math.max(b.x, Math.min(body.x, b.x + b.w));
        const cy = Math.max(b.y, Math.min(body.y, b.y + b.h));
        const dx = body.x - cx;
        const dy = body.y - cy;
        const d2 = dx * dx + dy * dy;
        const r = body.radius || 14;
        if (d2 < r * r) {
          const d = Math.sqrt(d2) || 0.001;
          const push = r - d;
          body.x += (dx / d) * push;
          body.y += (dy / d) * push;
          hit = true;
        }
      }
      return hit;
    },
    /** The special places: garage, hospital, hideout, marina. */
    places: { garage: GARAGE, hospital: HOSPITAL, hideout: HIDEOUT, marina: MARINA },
    palette: PALETTE,
  };
}
