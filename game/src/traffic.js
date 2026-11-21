// Traffic and pedestrians: the city alive around the player. Cars cruise the
// avenues and streets, turn at intersections, brake for the car ahead; people
// walk the sidewalks and run when a chase comes through.

import { AVENUES, ROAD_HALF, STREETS, WORLD } from './config.js';
import { makeRandom } from './random.js';
import { resolveCollision } from './world.js';

const CAR_COLORS = ['#c94f4f', '#4f7dc9', '#d8c25a', '#7dc94f', '#c9c9c9', '#8a5fc9', '#3d3d3d', '#e07a3c'];
const PED_COLORS = ['#e07a3c', '#4f7dc9', '#7dc94f', '#c94f4f', '#d8c25a', '#8a5fc9'];

function pickRoad(rnd) {
  if (rnd.chance(0.5)) {
    return { axis: 'x', line: rnd.pick(AVENUES), dir: rnd.chance(0.5) ? 1 : -1 };
  }
  return { axis: 'z', line: rnd.pick(STREETS), dir: rnd.chance(0.5) ? 1 : -1 };
}

export function createTraffic(world, seed) {
  const rnd = makeRandom(seed);
  const cars = [];
  const peds = [];
  const CAR_COUNT = 14;
  const PED_COUNT = 12;

  function spawnCar(nearX, nearZ) {
    const road = pickRoad(rnd);
    const lane = rnd.chance(0.5) ? 6 : -6;
    let x;
    let z;
    if (road.axis === 'x') {
      x = road.line + lane;
      z = rnd.range(WORLD.minZ + 60, WORLD.maxZ - 60);
    } else {
      x = rnd.range(WORLD.minX + 60, WORLD.maxX - 60);
      z = road.line + lane;
    }
    if (nearX !== undefined) {
      x = nearX + rnd.range(-160, 160);
      z = nearZ + rnd.range(-160, 160);
      x = Math.max(WORLD.minX + 40, Math.min(WORLD.maxX - 40, x));
      z = Math.max(WORLD.minZ + 40, Math.min(WORLD.maxZ - 40, z));
    }
    const angle = road.axis === 'x' ? (road.dir > 0 ? 0 : Math.PI) : (road.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    return {
      x, z, angle, speed: rnd.range(8, 14), color: rnd.pick(CAR_COLORS),
      road, lane, parked: false, driven: false, health: 100,
    };
  }

  function spawnPed(nearX, nearZ) {
    let x = rnd.range(WORLD.minX + 40, WORLD.maxX - 40);
    let z = rnd.range(WORLD.minZ + 40, WORLD.maxZ - 160);
    if (nearX !== undefined) {
      x = nearX + rnd.range(-120, 120);
      z = nearZ + rnd.range(-120, 120);
    }
    return {
      x, z, angle: rnd.range(0, Math.PI * 2), speed: rnd.range(1.2, 2),
      color: rnd.pick(PED_COLORS), flee: 0, walkTimer: rnd.range(2, 6),
    };
  }

  for (let i = 0; i < CAR_COUNT; i += 1) cars.push(spawnCar());
  for (let i = 0; i < PED_COUNT; i += 1) peds.push(spawnPed());

  function turnAtIntersection(car) {
    // At an intersection, sometimes turn onto the crossing road.
    const onAvenue = AVENUES.some((ax) => Math.abs(car.x - ax) < ROAD_HALF + 4);
    const onStreet = STREETS.some((sz) => Math.abs(car.z - sz) < ROAD_HALF + 4);
    if (!onAvenue || !onStreet) return;
    if (!rnd.chance(0.25)) return;
    const vertical = rnd.chance(0.5);
    if (vertical) {
      const ax = AVENUES.reduce((a, b) => (Math.abs(b - car.x) < Math.abs(a - car.x) ? b : a));
      car.road = { axis: 'x', line: ax, dir: rnd.chance(0.5) ? 1 : -1 };
      car.lane = rnd.chance(0.5) ? 6 : -6;
      car.angle = car.road.dir > 0 ? 0 : Math.PI;
    } else {
      const sz = STREETS.reduce((a, b) => (Math.abs(b - car.z) < Math.abs(a - car.z) ? b : a));
      car.road = { axis: 'z', line: sz, dir: rnd.chance(0.5) ? 1 : -1 };
      car.lane = rnd.chance(0.5) ? 6 : -6;
      car.angle = car.road.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
  }

  return {
    cars,
    peds,
    reset() {
      cars.length = 0;
      peds.length = 0;
      for (let i = 0; i < CAR_COUNT; i += 1) cars.push(spawnCar());
      for (let i = 0; i < PED_COUNT; i += 1) peds.push(spawnPed());
    },
    spawnCar(x, z, parked) {
      const car = spawnCar(x, z);
      car.parked = parked;
      car.speed = parked ? 0 : car.speed;
      cars.push(car);
      return car;
    },
    /** Advance traffic and pedestrians one step; playerPos steers braking and fleeing. */
    step(dt, playerPos, playerSpeed) {
      for (const car of cars) {
        if (car.driven || car.parked) continue;
        // Brake for the car ahead (or the player's car) in the same lane.
        let target = 12;
        for (const other of cars) {
          if (other === car) continue;
          const dx = other.x - car.x;
          const dz = other.z - car.z;
          const ahead = dx * Math.sin(car.angle) + dz * Math.cos(car.angle);
          const side = Math.abs(dx * Math.cos(car.angle) - dz * Math.sin(car.angle));
          if (ahead > 0 && ahead < 16 && side < 4) target = Math.min(target, 0);
        }
        if (playerPos) {
          const dx = playerPos.x - car.x;
          const dz = playerPos.z - car.z;
          const ahead = dx * Math.sin(car.angle) + dz * Math.cos(car.angle);
          const side = Math.abs(dx * Math.cos(car.angle) - dz * Math.sin(car.angle));
          if (ahead > 0 && ahead < 18 && side < 5) target = 0;
        }
        car.speed += ((target - car.speed) * Math.min(1, dt * 1.5));
        const nx = car.x + Math.sin(car.angle) * car.speed * dt;
        const nz = car.z + Math.cos(car.angle) * car.speed * dt;
        const fixed = resolveCollision(world, nx, nz, 1.9);
        if (Math.hypot(fixed.x - nx, fixed.z - nz) > 0.01) {
          // A building is in the way: turn around at the next chance.
          car.angle += Math.PI;
          car.road.dir *= -1;
        }
        car.x = fixed.x;
        car.z = fixed.z;
        turnAtIntersection(car);
        // Keep the car on its road: ease back to its lane.
        if (car.road.axis === 'x') {
          const want = car.road.line + car.lane;
          car.x += (want - car.x) * Math.min(1, dt * 1.2);
        } else {
          const want = car.road.line + car.lane;
          car.z += (want - car.z) * Math.min(1, dt * 1.2);
        }
        // Wrap around the map edges so traffic never runs out.
        if (car.x < WORLD.minX - 40 || car.x > WORLD.maxX + 40 || car.z < WORLD.minZ - 40 || car.z > WORLD.maxZ + 40) {
          Object.assign(car, spawnCar(playerPos ? playerPos.x : 0, playerPos ? playerPos.z : 0));
        }
      }
      for (const ped of peds) {
        ped.walkTimer -= dt;
        if (ped.flee > 0) {
          ped.flee -= dt;
          ped.speed = 4.5;
        } else {
          ped.speed = 1.6;
          if (ped.walkTimer <= 0) {
            ped.walkTimer = rnd.range(3, 8);
            ped.angle = rnd.range(0, Math.PI * 2);
          }
        }
        const nx = ped.x + Math.sin(ped.angle) * ped.speed * dt;
        const nz = ped.z + Math.cos(ped.angle) * ped.speed * dt;
        const fixed = resolveCollision(world, nx, nz, 0.6);
        ped.x = fixed.x;
        ped.z = fixed.z;
        if (playerPos) {
          const d = Math.hypot(ped.x - playerPos.x, ped.z - playerPos.z);
          if (d < 14 && Math.abs(playerSpeed) > 6) {
            ped.flee = 2;
            ped.angle = Math.atan2(ped.x - playerPos.x, ped.z - playerPos.z);
          }
        }
      }
    },
  };
}
