// Jax Calloway on foot and behind the wheel. On foot he runs where the keys
// point and turns to face his run; in a car he steers an arcade model —
// throttle, brake, handbrake turn — and the car, not Jax, takes the damage.

import { PLAYER, WORLD } from './config.js';
import { resolveCollision } from './world.js';

export function createPlayer() {
  const state = fresh();
  function fresh() {
    return {
      x: -160, z: -320, angle: 0, speed: 0,
      onFoot: true, health: PLAYER.health, armour: PLAYER.armour,
      ammo: PLAYER.pistolAmmo, weapon: 'fists', car: null, carHealth: 100,
      punchCooldown: 0, shootCooldown: 0, invulnerable: 0,
    };
  }
  return {
    state,
    reset() {
      Object.assign(state, fresh());
    },
    /** True while Jax is driving something. */
    get inCar() {
      return !state.onFoot && state.car !== null;
    },
    /** Move on foot: keys move him camera-relative, he faces where he runs. */
    stepFoot(dt, ax, ay, camAngle, world) {
      const run = ax !== 0 || ay !== 0;
      const speed = run ? PLAYER.runSpeed : PLAYER.footSpeed;
      // Camera-relative movement: forward is away from the camera.
      const fx = Math.sin(camAngle);
      const fz = Math.cos(camAngle);
      const rx = -Math.cos(camAngle);
      const rz = Math.sin(camAngle);
      let mx = fx * ay + rx * ax;
      let mz = fz * ay + rz * ax;
      const len = Math.hypot(mx, mz);
      if (len > 0) {
        mx /= len;
        mz /= len;
        const want = Math.atan2(mx, mz);
        let d = want - state.angle;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        state.angle += Math.max(-8 * dt, Math.min(8 * dt, d));
        const nx = state.x + mx * speed * dt;
        const nz = state.z + mz * speed * dt;
        const fixed = resolveCollision(world, nx, nz, PLAYER.radius);
        state.x = fixed.x;
        state.z = fixed.z;
        state.speed = speed;
      } else {
        state.speed = 0;
      }
      state.punchCooldown = Math.max(0, state.punchCooldown - dt);
      state.shootCooldown = Math.max(0, state.shootCooldown - dt);
      state.invulnerable = Math.max(0, state.invulnerable - dt);
    },
    /** Arcade driving: throttle, brake, reverse, handbrake, building bumps. */
    stepCar(dt, ax, ay, brake, world) {
      const car = state.car;
      if (!car) return 0;
      const forward = ay;
      let accel = 0;
      if (forward > 0) accel = PLAYER.carAccel;
      else if (forward < 0) accel = state.speed > 0.5 ? -PLAYER.carBrake : -PLAYER.carReverse;
      state.speed += accel * dt;
      // Drag and the handbrake bleed speed off.
      state.speed -= state.speed * (brake ? 2.4 : 0.35) * dt;
      const max = state.speed >= 0 ? PLAYER.carMaxSpeed : PLAYER.carMaxReverse;
      state.speed = Math.max(-PLAYER.carMaxReverse, Math.min(PLAYER.carMaxSpeed, state.speed));
      void max;
      const grip = Math.min(1, Math.abs(state.speed) / 12);
      state.angle += ax * PLAYER.carTurn * grip * dt * (state.speed >= 0 ? 1 : -1);
      car.angle = state.angle;
      const nx = state.x + Math.sin(state.angle) * state.speed * dt;
      const nz = state.z + Math.cos(state.angle) * state.speed * dt;
      const before = { x: state.x, z: state.z };
      const fixed = resolveCollision(world, nx, nz, 1.9);
      const hitWall = Math.hypot(fixed.x - nx, fixed.z - nz) > 0.01;
      state.x = fixed.x;
      state.z = fixed.z;
      car.x = state.x;
      car.z = state.z;
      void before;
      if (hitWall && Math.abs(state.speed) > 8) {
        const damage = Math.min(18, Math.abs(state.speed) * 0.45);
        state.carHealth = Math.max(0, state.carHealth - damage);
        state.speed *= -0.25;
        return damage;
      }
      return 0;
    },
    /** Get into the nearest car within reach; returns the car or null. */
    enterCar(cars) {
      let best = null;
      let bestD = 4;
      for (const car of cars) {
        const d = Math.hypot(car.x - state.x, car.z - state.z);
        if (d < bestD) {
          best = car;
          bestD = d;
        }
      }
      if (!best) return null;
      state.car = best;
      state.onFoot = false;
      state.x = best.x;
      state.z = best.z;
      state.angle = best.angle;
      state.speed = best.speed || 0;
      state.carHealth = best.health ?? 100;
      best.parked = false;
      best.driven = true;
      return best;
    },
    /** Step out beside the car; the car stays where it stopped. */
    exitCar() {
      const car = state.car;
      if (!car) return;
      car.speed = state.speed;
      car.driven = false;
      state.x = car.x - Math.sin(car.angle + Math.PI / 2) * 3;
      state.z = car.z - Math.cos(car.angle + Math.PI / 2) * 3;
      state.onFoot = true;
      state.car = null;
      state.speed = 0;
    },
    /** Hurt Jax (armour soaks first); returns true when he goes down. */
    hurt(amount) {
      if (state.invulnerable > 0) return false;
      let left = amount;
      if (state.armour > 0) {
        const soak = Math.min(state.armour, left);
        state.armour -= soak;
        left -= soak;
      }
      state.health -= left;
      state.invulnerable = 0.4;
      return state.health <= 0;
    },
    /** Hurt the car; returns true when it is wrecked. */
    hurtCar(amount) {
      state.carHealth = Math.max(0, state.carHealth - amount);
      return state.carHealth <= 0;
    },
    healAtHospital() {
      state.health = PLAYER.health;
      state.armour = PLAYER.armour;
      state.carHealth = 100;
    },
  };
}

/** The heading from (x, z) toward (tx, tz), in the same angle convention. */
export function headingTo(x, z, tx, tz) {
  return Math.atan2(tx - x, tz - z);
}

/** Shortest signed turn from angle a toward angle b, in (-PI, PI]. */
export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
