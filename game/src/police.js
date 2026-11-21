// Solmar PD: the wanted level, the cruisers that chase it, Air One overhead
// from three stars, roadblocks from four, and the tank at five. Heat is the
// single number behind the stars; crimes add it, hiding bleeds it away.

import { POLICE, WANTED } from './config.js';
import { angleDiff, headingTo } from './player.js';
import { resolveCollision } from './world.js';

const CALLSIGNS = ['PD-12', 'PD-27', 'PD-08', 'PD-31', 'PD-44', 'PD-19', 'PD-52', 'PD-63'];

export function createPolice(world) {
  const state = fresh();
  function fresh() {
    return {
      heat: 0, stars: 0,
      cruisers: [], heli: null, tank: null, shells: [],
      roadblockTimer: 10, heliTimer: 0, shellTimer: 4,
      bustTimer: 0, nextCallsign: 0,
    };
  }

  function spawnCruiser(x, z, interceptor) {
    const callsign = CALLSIGNS[state.nextCallsign % CALLSIGNS.length];
    state.nextCallsign += 1;
    const cruiser = {
      x, z, angle: 0, speed: 0,
      type: interceptor ? 'interceptor' : 'cruiser',
      callsign, lightPhase: Math.random() * Math.PI * 2,
      stuckTimer: 0,
    };
    state.cruisers.push(cruiser);
    return cruiser;
  }

  function nearestCruiserDistance(player) {
    let best = Infinity;
    for (const c of state.cruisers) {
      best = Math.min(best, Math.hypot(c.x - player.x, c.z - player.z));
    }
    if (state.tank) best = Math.min(best, Math.hypot(state.tank.x - player.x, state.tank.z - player.z));
    return best;
  }

  return {
    state,
    reset() {
      Object.assign(state, fresh());
    },
    get stars() {
      return state.stars;
    },
    setStars(n) {
      state.heat = n * 20;
      state.stars = n;
    },
    addHeat(n) {
      state.heat = Math.max(0, Math.min(100, state.heat + n));
      state.stars = Math.min(5, Math.ceil(state.heat / 20));
    },
    spawnCruiser,
    /** One step of the whole department: spawns, chases, the heli, the tank. */
    update(dt, game) {
      const player = game.player.state;
      // Heat bleeds off when no unit is close; the hideout cools it faster.
      const near = nearestCruiserDistance(player);
      const inHideout = game.missions.atHideout(game.player.state);
      if (state.stars > 0 && near > 90) {
        state.heat = Math.max(0, state.heat - (inHideout ? WANTED.hideoutDecayPerSecond : WANTED.decayPerSecond) * dt);
        state.stars = Math.ceil(state.heat / 20);
      }
      const want = POLICE.maxCruisers[state.stars];
      while (state.cruisers.length < want) {
        const a = Math.random() * Math.PI * 2;
        const d = 180 + Math.random() * 120;
        const cx = player.x + Math.sin(a) * d;
        const cz = player.z + Math.cos(a) * d;
        const fixed = resolveCollision(world, cx, cz, 2);
        spawnCruiser(fixed.x, fixed.z, state.stars >= 4 && state.cruisers.length === 0);
      }
      while (state.cruisers.length > want) state.cruisers.pop();
      // The helicopter joins at three stars and never leaves while wanted.
      if (state.stars >= 3 && !state.heli) {
        state.heli = { x: player.x + 40, z: player.z - 40, y: 70, angle: 0, rotor: 0, callsign: 'AIR-1' };
      }
      if (state.stars < 3) state.heli = null;
      if (state.heli) {
        const h = state.heli;
        h.rotor += dt * 22;
        const wantAngle = headingTo(h.x, h.z, player.x, player.z);
        h.angle += angleDiff(h.angle, wantAngle) * Math.min(1, dt * 1.5);
        const d = Math.hypot(player.x - h.x, player.z - h.z);
        const speed = Math.min(26, d * 0.6);
        h.x += Math.sin(h.angle) * speed * dt;
        h.z += Math.cos(h.angle) * speed * dt;
        h.y += (70 - h.y) * Math.min(1, dt);
        // Caught in the spotlight, the heat climbs.
        if (d < 26) state.heat = Math.min(100, state.heat + WANTED.spotlightPerSecond * dt);
      }
      // The tank rolls out at five stars.
      if (state.stars >= 5 && !state.tank) {
        const a = Math.random() * Math.PI * 2;
        state.tank = {
          x: player.x + Math.sin(a) * 150, z: player.z + Math.cos(a) * 150,
          angle: 0, speed: 0, callsign: 'TANK-1', turret: 0,
        };
      }
      if (state.stars < 5) state.tank = null;
      if (state.tank) {
        const t = state.tank;
        const wantAngle = headingTo(t.x, t.z, player.x, player.z);
        t.angle += angleDiff(t.angle, wantAngle) * Math.min(1, dt * 0.8);
        t.turret = wantAngle;
        t.speed = Math.min(POLICE.tankMaxSpeed, t.speed + 6 * dt);
        const nx = t.x + Math.sin(t.angle) * t.speed * dt;
        const nz = t.z + Math.cos(t.angle) * t.speed * dt;
        const fixed = resolveCollision(world, nx, nz, 2.6);
        t.x = fixed.x;
        t.z = fixed.z;
        state.shellTimer -= dt;
        const dist = Math.hypot(player.x - t.x, player.z - t.z);
        if (state.shellTimer <= 0 && dist < 130) {
          state.shellTimer = 4;
          const flight = Math.max(1.2, dist / 60);
          state.shells.push({
            x: t.x, y: 3, z: t.z,
            vx: (player.x - t.x) / flight, vy: 14, vz: (player.z - t.z) / flight,
            t: 0,
          });
        }
      }
      // Shells arc, land, and explode.
      for (let i = state.shells.length - 1; i >= 0; i -= 1) {
        const s = state.shells[i];
        s.t += dt;
        s.vy -= 22 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.z += s.vz * dt;
        if (s.y <= 0) {
          const d = Math.hypot(player.x - s.x, player.z - s.z);
          game.explode(s.x, s.z, 7);
          if (d < 7) {
            if (player.onFoot) game.player.hurt(26);
            else game.player.hurtCar(26);
          }
          state.shells.splice(i, 1);
        }
      }
      // Roadblocks from four stars: two cruisers parked across the road ahead.
      if (state.stars >= 4) {
        state.roadblockTimer -= dt;
        if (state.roadblockTimer <= 0) {
          state.roadblockTimer = POLICE.roadblockEverySeconds;
          const ahead = 90;
          const ax = player.x + Math.sin(player.angle) * ahead;
          const az = player.z + Math.cos(player.angle) * ahead;
          const perp = player.angle + Math.PI / 2;
          for (const off of [-7, 7]) {
            const c = spawnCruiser(ax + Math.sin(perp) * off, az + Math.cos(perp) * off, false);
            c.angle = player.angle + Math.PI;
            c.parked = true;
          }
          game.say('DISPATCH: Roadblock ahead — spikes on the avenue. Go around!');
        }
      }
      // Cruisers chase: steer at the player, ram, and get stuck sometimes.
      const maxSpeed = POLICE.cruiserMaxSpeed[state.stars] || 26;
      for (const c of state.cruisers) {
        if (c.parked) continue;
        const wantAngle = headingTo(c.x, c.z, player.x, player.z);
        const diff = angleDiff(c.angle, wantAngle);
        c.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
        const target = c.type === 'interceptor' ? POLICE.interceptorMaxSpeed : maxSpeed;
        c.speed = Math.min(target, c.speed + POLICE.cruiserAccel * dt);
        const nx = c.x + Math.sin(c.angle) * c.speed * dt;
        const nz = c.z + Math.cos(c.angle) * c.speed * dt;
        const fixed = resolveCollision(world, nx, nz, 1.9);
        if (Math.hypot(fixed.x - nx, fixed.z - nz) > 0.01) {
          c.stuckTimer += dt;
          if (c.stuckTimer > 1.2) {
            c.angle += Math.PI * 0.7;
            c.stuckTimer = 0;
          }
        } else {
          c.stuckTimer = 0;
        }
        c.x = fixed.x;
        c.z = fixed.z;
        c.lightPhase += dt * 9;
        // The ram: close in, shove the player's car, and hurt it.
        const d = Math.hypot(player.x - c.x, player.z - c.z);
        if (d < 4.5) {
          const push = 9 * dt;
          const px = player.x - c.x;
          const pz = player.z - c.z;
          const len = Math.hypot(px, pz) || 1;
          player.x += (px / len) * push;
          player.z += (pz / len) * push;
          if (!player.onFoot) {
            if (game.player.hurtCar(POLICE.ramDamage * dt * 4)) game.onCarWrecked();
          } else {
            game.player.hurt(POLICE.ramDamage * dt * 2);
          }
          c.speed *= 0.6;
        }
      }
      // Busted: on foot and down, or wrecked in the car with a cruiser on top.
      if (!player.onFoot && state.stars > 0 && player.carHealth <= 0 && Math.abs(player.speed) < 1.5) {
        if (near < POLICE.bustRadius) {
          state.bustTimer += dt;
          if (state.bustTimer >= POLICE.bustSeconds) game.onBusted();
        } else {
          state.bustTimer = 0;
        }
      } else {
        state.bustTimer = 0;
      }
      if (player.onFoot && player.health <= 0) game.onBusted();
    },
    /** The dispatch list the HUD shows: unit, type, distance, status. */
    dispatch(player) {
      const list = [];
      for (const c of state.cruisers) {
        list.push({
          callsign: c.callsign,
          type: c.type === 'interceptor' ? 'INTERCEPTOR' : 'CRUISER',
          dist: Math.round(Math.hypot(c.x - player.x, c.z - player.z)),
          status: c.parked ? 'ROADBLOCK' : 'PURSUIT',
        });
      }
      if (state.heli) {
        list.push({
          callsign: 'AIR-1', type: 'HELICOPTER',
          dist: Math.round(Math.hypot(state.heli.x - player.x, state.heli.z - player.z)),
          status: 'SPOTLIGHT',
        });
      }
      if (state.tank) {
        list.push({
          callsign: 'TANK-1', type: 'TANK',
          dist: Math.round(Math.hypot(state.tank.x - player.x, state.tank.z - player.z)),
          status: 'ROLLING IN',
        });
      }
      list.sort((a, b) => a.dist - b.dist);
      return list.slice(0, 5);
    },
  };
}
