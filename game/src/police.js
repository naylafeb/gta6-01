// Solmar PD: the wanted level and everything that answers it. Patrol cruisers at
// low stars, interceptors and roadblocks in the middle, a helicopter with a
// searchlight from four stars, and a tank at five. Heat rises with crimes and cools
// when no officer can see the player.

import { POLICE, WANTED, WORLD } from './config.js';
import { nearestRoad } from './world.js';
import { range } from './random.js';

export const EVENT_BUSTED = 1;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function createPolice(world, random) {
  const state = {
    heat: 0, stars: 0,
    cruisers: [], heli: null, tank: null,
    roadblockTimer: 0, heliTimer: 0, spawnTimer: 0,
    roadblocks: [],
  };

  function reset() {
    state.heat = 0;
    state.stars = 0;
    state.cruisers.length = 0;
    state.heli = null;
    state.tank = null;
    state.roadblocks.length = 0;
    state.roadblockTimer = POLICE.roadblockEverySeconds;
    state.heliTimer = 4;
    state.spawnTimer = 0;
  }

  function addHeat(amount) {
    state.heat = clamp(state.heat + amount, 0, 100);
    state.stars = Math.ceil(state.heat / 20);
  }

  function spawnCruiser(x, y, interceptor) {
    const cruiser = {
      x, y, angle: 0, speed: 0,
      color: '#20242e', isPolice: true, interceptor: !!interceptor,
      width: 46, length: 23, health: 100, wrecked: false,
      sirenPhase: random() * Math.PI * 2,
    };
    state.cruisers.push(cruiser);
    return cruiser;
  }

  function spawnNearPlayer(player, distance) {
    const road = nearestRoad(player.x + range(random, -1, 1) * distance, player.y + range(random, -1, 1) * distance);
    const x = road.axis === 'x' ? road.at + range(random, -30, 30) : clamp(player.x + range(random, -1, 1) * distance, 60, WORLD.width - 60);
    const y = road.axis === 'y' ? road.at + range(random, -30, 30) : clamp(player.y + range(random, -1, 1) * distance, 60, WORLD.height - 60);
    return { x, y };
  }

  function setStars(n) {
    state.stars = clamp(n, 0, 5);
    state.heat = state.stars * 20;
  }

  /** One fixed step. Returns event flags. */
  function step(dt, t, player, onRam) {
    let events = 0;
    const px = player.state.x;
    const py = player.state.y;

    // Heat cools when no cruiser is close enough to see the player.
    let seen = false;
    for (const c of state.cruisers) {
      if (Math.hypot(c.x - px, c.y - py) < 520) { seen = true; break; }
    }
    if (state.heli && Math.hypot(state.heli.x - px, state.heli.y - py) < 700) seen = true;
    const inHideout = Math.hypot(px - world.places.hideout.x, py - world.places.hideout.y) < world.places.hideout.r;
    if (!seen) {
      state.heat = Math.max(0, state.heat - (inHideout ? WANTED.hideoutDecayPerSecond : WANTED.decayPerSecond) * dt);
      state.stars = Math.ceil(state.heat / 20);
    }

    // Keep the cruiser count matched to the stars.
    const want = POLICE.maxCruisers[state.stars];
    state.spawnTimer -= dt;
    if (state.cruisers.length < want && state.spawnTimer <= 0) {
      const p = spawnNearPlayer(player.state, 620);
      spawnCruiser(p.x, p.y, state.stars >= 3 && random() < 0.4);
      state.spawnTimer = 1.2;
    }
    while (state.cruisers.length > want) state.cruisers.pop();

    // Cruisers pursue: steer at the player with a little prediction, ram to hurt.
    for (const c of state.cruisers) {
      if (c.wrecked) continue;
      const lead = 0.35;
      const tx = px + (player.inCar ? Math.cos(player.state.angle) * (player.state.speed || 0) * lead : 0);
      const ty = py + (player.inCar ? Math.sin(player.state.angle) * (player.state.speed || 0) * lead : 0);
      const wantAngle = angleTo(c.x, c.y, tx, ty);
      c.angle += clamp(angleDiff(c.angle, wantAngle), -2.6 * dt, 2.6 * dt);
      const max = c.interceptor ? POLICE.interceptorMaxSpeed : POLICE.cruiserMaxSpeed[state.stars];
      c.speed = Math.min(max, c.speed + POLICE.cruiserAccel * dt);
      c.x += Math.cos(c.angle) * c.speed * dt;
      c.y += Math.sin(c.angle) * c.speed * dt;
      const d = Math.hypot(c.x - px, c.y - py);
      if (d < 46) {
        onRam(c, POLICE.ramDamage * (c.speed / 300 + 0.5));
        c.speed *= 0.4;
        // A hard ram can wreck a cruiser too.
        if (c.speed > 380 && player.inCar) { c.wrecked = true; }
      }
      if (world.collideCircle(c)) c.speed *= 0.5;
    }

    // Roadblocks: two cruisers parked across the road ahead, from three stars.
    state.roadblockTimer -= dt;
    if (state.stars >= 3 && state.roadblockTimer <= 0) {
      state.roadblockTimer = POLICE.roadblockEverySeconds;
      const road = nearestRoad(px, py);
      const ahead = 420;
      const ax = px + Math.cos(player.state.angle) * ahead;
      const ay = py + Math.sin(player.state.angle) * ahead;
      const across = road.axis === 'x' ? 0 : Math.PI / 2;
      state.roadblocks.push({
        x: ax, y: ay, angle: across, ttl: 20,
        cars: [
          { x: ax - 26, y: ay - 10, angle: across },
          { x: ax + 26, y: ay + 10, angle: across },
        ],
      });
    }
    for (const rb of state.roadblocks) rb.ttl -= dt;
    state.roadblocks = state.roadblocks.filter((rb) => rb.ttl > 0);

    // The helicopter: circles the player from four stars, spotlight and all.
    if (state.stars >= 4 && !state.heli) {
      state.heli = { x: px, y: py - 260, angle: 0, orbit: random() * Math.PI * 2 };
    }
    if (state.stars < 4) state.heli = null;
    if (state.heli) {
      state.heli.orbit += dt * 0.5;
      state.heli.x = px + Math.cos(state.heli.orbit) * 150;
      state.heli.y = py + Math.sin(state.heli.orbit) * 150 - 40;
      state.heli.angle += dt;
      state.heliTimer -= dt;
      if (state.heliTimer <= 0) {
        state.heliTimer = POLICE.heliCallEverySeconds;
        if (state.cruisers.length < POLICE.maxCruisers[state.stars]) {
          const p = spawnNearPlayer(player.state, 520);
          spawnCruiser(p.x, p.y, true);
        }
      }
    }

    // The tank: five stars only. Slow, heavy, and it does not stop for anything.
    if (state.stars >= 5 && !state.tank) {
      const p = spawnNearPlayer(player.state, 900);
      state.tank = { x: p.x, y: p.y, angle: 0, speed: 0, health: 400, radius: 26 };
    }
    if (state.stars < 5) state.tank = null;
    if (state.tank) {
      const wantAngle = angleTo(state.tank.x, state.tank.y, px, py);
      state.tank.angle += clamp(angleDiff(state.tank.angle, wantAngle), -1.1 * dt, 1.1 * dt);
      state.tank.speed = Math.min(POLICE.tankMaxSpeed, state.tank.speed + 120 * dt);
      state.tank.x += Math.cos(state.tank.angle) * state.tank.speed * dt;
      state.tank.y += Math.sin(state.tank.angle) * state.tank.speed * dt;
      const d = Math.hypot(state.tank.x - px, state.tank.y - py);
      if (d < 60) {
        onRam(state.tank, POLICE.tankRamDamage);
        state.tank.speed *= 0.3;
      }
      world.collideCircle(state.tank);
    }

    return events;
  }

  return { state, reset, step, addHeat, setStars, spawnCruiser };
}
