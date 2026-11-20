// Jax Calloway, on foot and behind the wheel: movement, entering and stealing cars,
// health and cash. The player is a circle on foot and drives a car object when in one.

import { PLAYER, WANTED, WORLD } from './config.js';

export const EVENT_BUSTED = 1;
export const EVENT_CAR_WRECKED = 2;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function createPlayer(world, random) {
  const state = {
    x: 1160, y: 420, angle: 0, onFoot: true,
    health: PLAYER.health, carHealth: 100,
    cash: 0, speed: 0, moving: false,
    car: null, invulnerable: 0, nearMissTimer: 0,
  };

  function reset() {
    state.x = 1160;
    state.y = 420;
    state.angle = 0;
    state.onFoot = true;
    state.health = PLAYER.health;
    state.carHealth = 100;
    state.cash = 0;
    state.speed = 0;
    state.car = null;
    state.invulnerable = 0;
  }

  /** Step the player one fixed step. Returns event flags. */
  function step(dt, vector, actions, cars, police) {
    let events = 0;
    if (state.invulnerable > 0) state.invulnerable = Math.max(0, state.invulnerable - dt);
    state.moving = false;

    if (state.onFoot) {
      const len = Math.hypot(vector.x, vector.y) || 1;
      const slow = world.isBeach(state.x, state.y) ? 0.55 : 1;
      state.x += (vector.x / len) * PLAYER.footSpeed * slow * dt * (vector.x || vector.y ? 1 : 0);
      state.y += (vector.y / len) * PLAYER.footSpeed * slow * dt * (vector.x || vector.y ? 1 : 0);
      if (vector.x || vector.y) {
        state.angle = Math.atan2(vector.y, vector.x);
        state.moving = true;
      }
      state.x = clamp(state.x, 20, WORLD.width - 20);
      state.y = clamp(state.y, 20, WORLD.height - 20);
      if (world.isWater(state.x, state.y)) state.y = 1860;
      world.collideCircle(state);
    } else if (state.car) {
      const car = state.car;
      const forward = vector.y < 0 ? 1 : vector.y > 0 ? -0.6 : 0;
      const handbrake = actions && actions.handbrake;
      const accel = forward > 0 ? PLAYER.carAccel : PLAYER.carBrake;
      car.speed += forward * accel * dt;
      if (!forward) car.speed -= Math.sign(car.speed) * 140 * dt;
      if (handbrake) car.speed -= Math.sign(car.speed) * 420 * dt;
      const max = forward < 0 ? PLAYER.carMaxReverse : PLAYER.carMaxSpeed;
      car.speed = clamp(car.speed, -PLAYER.carMaxReverse, max);
      if (Math.abs(car.speed) < 4 && !forward) car.speed = 0;
      const steer = vector.x * PLAYER.carTurn * (car.speed >= 0 ? 1 : -1);
      const grip = handbrake ? 1.6 : 1;
      car.angle += steer * clamp(Math.abs(car.speed) / 240, 0, 1) * grip * dt;
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      car.x = nx;
      car.y = ny;
      state.x = car.x;
      state.y = car.y;
      state.angle = car.angle;
      state.speed = Math.abs(car.speed);
      state.moving = Math.abs(car.speed) > 20;
      // Buildings stop the car hard; the beach slows it to a crawl.
      const body = { x: car.x, y: car.y, radius: 20 };
      if (world.collideCircle(body)) {
        car.x = body.x;
        car.y = body.y;
        if (Math.abs(car.speed) > 120) damage(Math.abs(car.speed) / 40, police);
        car.speed *= 0.25;
      }
      if (world.isWater(car.x, car.y)) {
        car.y = 1858;
        car.speed *= 0.5;
      }
      if (world.isBeach(car.x, car.y)) car.speed *= (1 - 0.9 * dt);
      state.x = car.x;
      state.y = car.y;
    }
    return events;
  }

  function damage(amount, police) {
    if (state.invulnerable > 0) return;
    if (state.onFoot) {
      state.health -= amount;
    } else {
      state.carHealth -= amount;
      if (state.carHealth <= 0) {
        state.carHealth = 0;
        state.car.wrecked = true;
      }
      // A wrecked car still hurts its driver a little.
      state.health -= amount * 0.25;
    }
    state.invulnerable = 0.4;
    if (state.health <= 0) {
      state.health = 0;
    }
  }

  /** Enter the nearest car within reach; stealing a parked or traffic car raises heat. */
  function enterCar(cars, addHeat) {
    let best = null;
    let bestD = 90;
    for (const car of cars) {
      if (car.wrecked || car.isPolice) continue;
      const d = Math.hypot(car.x - state.x, car.y - state.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    if (!best) return false;
    state.car = best;
    state.onFoot = false;
    state.carHealth = best.health ?? 100;
    if (best.parked || best.traffic) addHeat(WANTED.stealCar);
    best.parked = false;
    best.traffic = false;
    return true;
  }

  function exitCar() {
    if (state.onFoot || !state.car) return;
    const car = state.car;
    car.health = state.carHealth;
    state.car = null;
    state.onFoot = true;
    state.x = car.x - Math.cos(car.angle) * 34;
    state.y = car.y - Math.sin(car.angle) * 34;
    state.speed = 0;
  }

  return {
    state, reset, step, damage, enterCar, exitCar,
    get busted() { return state.health <= 0; },
    get inCar() { return !state.onFoot; },
  };
}
