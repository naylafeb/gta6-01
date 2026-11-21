// The city of Solmar Bay: a street grid, beach and sea to the south, a marina
// to the east, and the building blocks between the roads. This file owns the
// layout data (roads, building boxes, palms, lights, signs) and the collision
// test; render.js turns the data into three.js meshes.

import { AVENUES, BEACH_Z, DISTRICTS, ROAD_HALF, SEA_Z, STREETS, WORLD } from './config.js';
import { makeRandom } from './random.js';

const FACADE_COLORS = ['#4b4365', '#5d5478', '#3f3a5c', '#6b5a7d', '#463d63', '#54486e'];
const NEON_SIGNS = ['SOLMAR', 'NEON ROW', 'HOTEL', '24H TACOS', 'PIER 9', 'CASINO', 'SUNSET', 'GARAGE'];
const NEON_COLORS = ['#ff4d8d', '#37e0ff', '#ffc53c', '#7dff6a'];

/** True when (x, z) is on a road surface. */
export function onRoad(x, z) {
  for (const ax of AVENUES) if (Math.abs(x - ax) <= ROAD_HALF) return true;
  for (const sz of STREETS) if (Math.abs(z - sz) <= ROAD_HALF) return true;
  return false;
}

/** The district name at (x, z), for the HUD's location line. */
export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x <= d.x1 && z >= d.z0 && z <= d.z1) return d.name;
  }
  return 'Solmar Bay';
}

/** Build the whole city from a seed. Returns { buildings, palms, lamps, signs, ground }. */
export function buildWorld(seed) {
  const rnd = makeRandom(seed);
  const buildings = [];
  const palms = [];
  const lamps = [];
  const signs = [];

  // One block between each pair of neighbouring roads; the marina and the beach
  // stay open, and the tunnel mouth at the west end of South Beach stays clear.
  const xs = [WORLD.minX, ...AVENUES, WORLD.maxX];
  const zs = [WORLD.minZ, ...STREETS, WORLD.maxZ];
  for (let bi = 0; bi < xs.length - 1; bi += 1) {
    for (let bj = 0; bj < zs.length - 1; bj += 1) {
      const x0 = xs[bi] + ROAD_HALF + 6;
      const x1 = xs[bi + 1] - ROAD_HALF - 6;
      const z0 = zs[bj] + ROAD_HALF + 6;
      const z1 = zs[bj + 1] - ROAD_HALF - 6;
      if (x1 - x0 < 40 || z1 - z0 < 40) continue;
      if (z0 >= BEACH_Z - 40) continue; // the beach stays open sand
      if (x0 >= 1040 && z0 >= 520) continue; // the marina stays open water and dock
      if (x0 <= -1120 && z0 >= 720) continue; // the tunnel mouth stays clear
      const count = rnd.int(1, 3);
      for (let k = 0; k < count; k += 1) {
        const w = rnd.range(36, Math.min(90, x1 - x0 - 8));
        const d = rnd.range(36, Math.min(90, z1 - z0 - 8));
        const bx = rnd.range(x0 + w / 2, x1 - w / 2);
        const bz = rnd.range(z0 + d / 2, z1 - d / 2);
        const h = rnd.chance(0.2) ? rnd.range(60, 110) : rnd.range(18, 55);
        buildings.push({
          x: bx, z: bz, w, d, h,
          color: rnd.pick(FACADE_COLORS),
          variant: rnd.int(0, 3),
          roof: rnd.chance(0.4),
        });
        if (rnd.chance(0.3)) {
          signs.push({
            x: bx, z: bz - d / 2 - 0.6, y: rnd.range(8, Math.min(26, h - 4)),
            text: rnd.pick(NEON_SIGNS), color: rnd.pick(NEON_COLORS),
            face: 'north',
          });
        }
      }
    }
  }

  // Palms line the beachfront and the avenues, lamps line every road.
  for (let x = -1200; x <= 1200; x += 130) {
    palms.push({ x: x + rnd.range(-20, 20), z: BEACH_Z + 22 + rnd.range(-6, 6), s: rnd.range(0.8, 1.3) });
  }
  for (const ax of AVENUES) {
    for (let z = -900; z <= 760; z += 260) {
      palms.push({ x: ax + ROAD_HALF + 8, z: z + rnd.range(-30, 30), s: rnd.range(0.7, 1.1) });
    }
  }
  for (const ax of AVENUES) {
    for (const sz of STREETS) {
      lamps.push({ x: ax + ROAD_HALF - 2, z: sz + ROAD_HALF - 2 });
    }
  }

  return { buildings, palms, lamps, signs, seed };
}

/** True when a circle at (x, z) with radius r hits a building or the map edge. */
export function collides(world, x, z, r) {
  if (x < WORLD.minX + r || x > WORLD.maxX - r) return true;
  if (z < WORLD.minZ + r || z > SEA_Z - r) return true;
  for (const b of world.buildings) {
    if (
      x + r > b.x - b.w / 2 && x - r < b.x + b.w / 2 &&
      z + r > b.z - b.d / 2 && z - r < b.z + b.d / 2
    ) {
      return true;
    }
  }
  return false;
}

/** Push a circle out of whatever it overlaps; returns the corrected position. */
export function resolveCollision(world, x, z, r) {
  let nx = x;
  let nz = z;
  for (const b of world.buildings) {
    const ox = b.w / 2 + r - Math.abs(nx - b.x);
    const oz = b.d / 2 + r - Math.abs(nz - b.z);
    if (ox > 0 && oz > 0) {
      if (ox < oz) nx = b.x + (nx > b.x ? b.w / 2 + r : -(b.w / 2 + r));
      else nz = b.z + (nz > b.z ? b.d / 2 + r : -(b.d / 2 + r));
    }
  }
  nx = Math.max(WORLD.minX + r, Math.min(WORLD.maxX - r, nx));
  nz = Math.max(WORLD.minZ + r, Math.min(SEA_Z - r, nz));
  return { x: nx, z: nz };
}
