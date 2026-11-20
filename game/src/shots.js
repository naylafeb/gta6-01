// The screenshot scenes behind ?shot=cover|foot|drive|mission. Each one stages a
// real game state (mission, stars, police, traffic) and plays it forward with a
// simple autopilot, so the frame is what a short game really looks like and the
// same seed always gives the same frame.

import { STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Steer a car toward (tx, ty): full throttle, turn toward the target. */
function driveToward(game, tx, ty) {
  const p = game.player.state;
  const want = Math.atan2(ty - p.y, tx - p.x);
  const d = angleDiff(p.angle, want);
  return { x: d > 0.15 ? 1 : d < -0.15 ? -1 : 0, y: -1 };
}

/** Walk toward (tx, ty) on foot. */
function walkToward(game, tx, ty) {
  const p = game.player.state;
  const want = Math.atan2(ty - p.y, tx - p.x);
  return { x: Math.cos(want), y: Math.sin(want) };
}

function putPlayerInCar(game, x, y, angle, speed, carHealth) {
  const car = game.traffic.spawnCar(x, y, false);
  car.angle = angle;
  car.speed = speed;
  car.color = '#ffcf3d';
  game.player.state.car = car;
  game.player.state.onFoot = false;
  game.player.state.carHealth = carHealth;
  game.player.state.x = x;
  game.player.state.y = y;
  game.player.state.angle = angle;
  game.player.state.speed = speed;
  return car;
}

function stageCover(game) {
  // The finale, mid-chase: five stars, cruisers behind, the tank ahead, Air One
  // overhead, the marina boat in sight. The player runs east along street 1440
  // so the camera can centre him clear of the HUD banners below; the tank is
  // placed ahead on the same road, nose to nose with the chase.
  game.missions.state.index = 4;
  game.missions.state.lineIndex = 0;
  game.cash = 2450;
  game.time = 126;
  putPlayerInCar(game, 1500, 1440, 0, 380, 78);
  game.camera.x = 1500;
  game.camera.y = 1440;
  game.police.setStars(5);
  game.police.state.roadblockTimer = 0;
  game.police.state.tank = { x: 2250, y: 1440, angle: Math.PI, speed: 0, health: 400, radius: 26 };
  const c1 = game.police.spawnCruiser(1320, 1420, false);
  c1.speed = 420; c1.angle = 0;
  const c2 = game.police.spawnCruiser(1280, 1470, true);
  c2.speed = 460; c2.angle = 0;
  const c3 = game.police.spawnCruiser(1390, 1400, false);
  c3.speed = 400; c3.angle = 0;
  void c1; void c2; void c3;
  // Only 45 steps: the car is still at speed when the frame is taken, short of
  // the roadblock that forms 420px ahead of it.
  for (let i = 0; i < 45; i += 1) {
    game.advance(STEP, driveToward(game, 2400, 1440), false);
  }
  return { screen: SCREEN_PLAY };
}

function stageFoot(game) {
  // Jax on foot in Neon Row, walking to his first job, city alive around him.
  // Only one second of walking: far enough to be moving, nowhere near the
  // garage, so the first mission stays open and the stars stay at zero.
  game.missions.state.index = 0;
  game.cash = 120;
  game.time = 40;
  game.player.state.x = 1000;
  game.player.state.y = 620;
  game.player.state.onFoot = true;
  game.camera.x = 1000;
  game.camera.y = 620;
  for (let i = 0; i < 60; i += 1) {
    game.advance(STEP, walkToward(game, 1160, 300), false);
  }
  return { screen: SCREEN_PLAY };
}

function stageDrive(game) {
  // The Neon Run: two stars, a cruiser on the tail, traffic ahead, drop-off east.
  // The autopilot steers straight, so the run stays on one road — east along
  // street 800 — instead of cutting diagonally across blocks.
  game.missions.state.index = 1;
  game.cash = 400;
  game.time = 60;
  putPlayerInCar(game, 800, 800, 0, 340, 100);
  game.camera.x = 800;
  game.camera.y = 800;
  game.police.setStars(2);
  const c = game.police.spawnCruiser(620, 800, false);
  c.speed = 380; c.angle = 0;
  void c;
  // 90 steps: long enough to be at speed, short enough not to rear-end the
  // traffic ahead and stop.
  for (let i = 0; i < 90; i += 1) {
    game.advance(STEP, driveToward(game, 2320, 800), false);
  }
  return { screen: SCREEN_PLAY };
}

function stageMission(game) {
  // Air One: four stars, the helicopter's spotlight sweeping, tunnel to the west.
  // The run stays on one road — west along street 1440 — so the car is driving,
  // not wedged on a building corner.
  game.missions.state.index = 3;
  game.cash = 1550;
  game.time = 96;
  // The car starts east of the intersection, clear of the traffic stopped at
  // its red light, and runs 60 steps west — at speed, short of the car ahead.
  putPlayerInCar(game, 1600, 1440, Math.PI, 360, 88);
  game.camera.x = 1600;
  game.camera.y = 1440;
  game.police.setStars(4);
  // No roadblock in this frame: it would form 420px ahead of the car and the
  // car would drive straight into it and stop. The helicopter and the cruiser
  // carry the four-star chase here.
  game.police.state.roadblockTimer = 999;
  const c = game.police.spawnCruiser(1820, 1440, true);
  c.speed = 430; c.angle = Math.PI;
  void c;
  for (let i = 0; i < 30; i += 1) {
    game.advance(STEP, driveToward(game, 200, 1440), false);
  }
  return { screen: SCREEN_PLAY };
}

/** Set `game` to the named scene and return the screen to draw over it. */
export function stageShot(name, game) {
  game.missions.reset();
  game.player.reset();
  game.police.reset();
  game.traffic.reset();
  game.cash = 0;
  game.banner = null;
  game.bustedLoss = 0;
  game.particles.length = 0;
  game.skids.length = 0;
  game.camera.shake = 0;
  game.time = 0;
  if (name === 'cover') return stageCover(game);
  if (name === 'foot') return stageFoot(game);
  if (name === 'drive') return stageDrive(game);
  if (name === 'mission') return stageMission(game);
  // Any other name is the title backdrop: the city at dusk, camera downtown.
  game.camera.x = 1280;
  game.camera.y = 900;
  game.time = 30;
  return { screen: SCREEN_TITLE };
}
