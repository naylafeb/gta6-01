// The living city around the player: traffic cars that follow the roads and stop
// at red lights, and pedestrians who stroll the sidewalks and flee from danger.

import { AVENUES, ROAD_W, STREETS, WORLD } from './config.js';
import { nearestRoad } from './world.js';
import { pick, range } from './random.js';

const TRAFFIC_COLORS = ['#c94f43', '#4f7dc9', '#e8e4da', '#3c3f4a', '#7a4fc9', '#c9a44f', '#4fc9a4', '#8a93a3', '#d97b2f'];
const PED_COLORS = ['#e8b4a0', '#c9a44f', '#7a4fc9', '#4fc9a4', '#e84f6a', '#5a7dc9', '#d9d4c8'];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function createTraffic(world, random) {
  const cars = [];
  const peds = [];

  function spawnCar(x, y, traffic) {
    const road = nearestRoad(x, y);
    const car = {
      x, y,
      angle: road.axis === 'x' ? (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (random() < 0.5 ? 0 : Math.PI),
      speed: 0, targetSpeed: range(random, 90, 150),
      color: pick(random, TRAFFIC_COLORS),
      traffic: !!traffic, parked: false, isPolice: false,
      health: 100, wrecked: false, width: 44, length: 22,
      axis: road.axis, lane: random() < 0.5 ? -1 : 1,
    };
    cars.push(car);
    return car;
  }

  function spawnPed(x, y) {
    const ped = {
      x, y, angle: random() * Math.PI * 2, speed: range(random, 28, 55),
      color: pick(random, PED_COLORS), flee: 0, radius: 9,
    };
    peds.push(ped);
    return ped;
  }

  function reset(playerStart) {
    cars.length = 0;
    peds.length = 0;
    for (const c of world.parked) {
      const car = spawnCar(c.x, c.y, false);
      car.parked = true;
      car.angle = c.angle;
      car.color = c.color;
    }
    for (let i = 0; i < 14; i += 1) {
      const ax = pick(random, AVENUES);
      const sy = pick(random, STREETS);
      spawnCar(ax + range(random, -20, 20), sy + range(random, -20, 20), true);
    }
    for (let i = 0; i < 26; i += 1) {
      const ax = pick(random, AVENUES);
      const sy = pick(random, STREETS);
      spawnPed(
        clamp(ax + range(random, -140, 140), 30, WORLD.width - 30),
        clamp(sy + range(random, -140, 140), 30, WORLD.height - 30),
      );
    }
    void playerStart;
  }

  /** One fixed step: traffic follows roads and lights, peds stroll or flee. */
  function step(dt, t, player, policeNear) {
    for (const car of cars) {
      if (car.wrecked || car.parked) continue;
      if (!car.traffic) continue;
      // Stop at a red light when approaching an intersection.
      let go = true;
      for (const light of world.lights) {
        const d = Math.hypot(light.x - car.x, light.y - car.y);
        if (d < 90 && world.lightState(light, t) === 'stop') {
          const ahead = (light.x - car.x) * Math.cos(car.angle) + (light.y - car.y) * Math.sin(car.angle);
          if (ahead > 0) { go = false; break; }
        }
      }
      const want = go ? car.targetSpeed : 0;
      car.speed += clamp(want - car.speed, -260 * dt, 160 * dt);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      // At an intersection, sometimes turn onto the crossing road.
      const road = nearestRoad(car.x, car.y);
      const dist = road.axis === 'x' ? Math.abs(car.x - road.at) : Math.abs(car.y - road.at);
      if (dist < 6 && random() < 0.02) {
        car.angle = road.axis === 'x'
          ? (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2)
          : (random() < 0.5 ? 0 : Math.PI);
        car.axis = road.axis;
      }
      // Wrap around the city edges so traffic never runs out.
      if (car.x < -60) car.x = WORLD.width + 50;
      if (car.x > WORLD.width + 60) car.x = -50;
      if (car.y < -60) car.y = WORLD.height + 50;
      if (car.y > WORLD.height + 60) car.y = -50;
      if (car.speed > 0) {
        const body = { x: car.x, y: car.y, radius: 18 };
        if (world.collideCircle(body)) {
          car.x = body.x;
          car.y = body.y;
          car.speed *= 0.4;
        }
      }
    }

    for (const ped of peds) {
      const dx = ped.x - player.x;
      const dy = ped.y - player.y;
      const d = Math.hypot(dx, dy);
      if (d < 130 || policeNear) ped.flee = 1.2;
      if (ped.flee > 0) {
        ped.flee -= dt;
        ped.angle = Math.atan2(dy, dx);
        ped.x += Math.cos(ped.angle) * 120 * dt;
        ped.y += Math.sin(ped.angle) * 120 * dt;
      } else {
        ped.x += Math.cos(ped.angle) * ped.speed * dt;
        ped.y += Math.sin(ped.angle) * ped.speed * dt;
        if (random() < 0.005) ped.angle = random() * Math.PI * 2;
      }
      ped.x = clamp(ped.x, 20, WORLD.width - 20);
      ped.y = clamp(ped.y, 20, WORLD.height - 20);
      world.collideCircle(ped);
    }
  }

  return { cars, peds, reset, step, spawnCar, spawnPed };
}
