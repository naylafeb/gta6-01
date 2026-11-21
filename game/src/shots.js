// The screenshot scenes behind ?shot=cover|foot|drive|mission. Each one stages
// a real game state (mission, stars, police, traffic) and plays it forward
// with a simple autopilot, then freezes it — so the frame is what a short game
// really looks like, and the same seed always gives the same frame.

import { STEP } from './config.js';
import { angleDiff, headingTo } from './player.js';

/** Steer a car toward (tx, tz): full throttle, turn toward the target. */
function driveToward(game, tx, tz) {
  const p = game.player.state;
  const d = angleDiff(p.angle, headingTo(p.x, p.z, tx, tz));
  return { x: d > 0.12 ? 1 : d < -0.12 ? -1 : 0, y: 1 };
}

/** Walk toward (tx, tz) on foot, camera-relative. */
function walkToward(game, tx, tz) {
  const p = game.player.state;
  const d = headingTo(p.x, p.z, tx, tz) - p.angle;
  void d;
  return { x: 0, y: 1 };
}

function putPlayerInCar(game, x, z, angle, speed, carHealth) {
  const car = game.traffic.spawnCar(x, z, false);
  car.angle = angle;
  car.speed = speed;
  car.color = '#ffcf3d';
  game.player.state.car = car;
  game.player.state.onFoot = false;
  game.player.state.carHealth = carHealth;
  game.player.state.carName = 'Solmar Comet GT';
  game.player.state.x = x;
  game.player.state.z = z;
  game.player.state.angle = angle;
  game.player.state.speed = speed;
  return car;
}

function stageCover(game) {
  // The finale, mid-chase: five stars, cruisers behind, the tank ahead, Air One
  // overhead, the marina boat in sight. The player runs north up the avenue so
  // the camera can centre him clear of the HUD banners; the tank waits ahead.
  game.missions.state.index = 4;
  game.missions.state.lineIndex = 0;
  game.cash = 2450;
  game.time = 126;
  putPlayerInCar(game, 160, 400, Math.PI, 30, 78);
  game.police.setStars(5);
  game.police.state.roadblockTimer = 999;
  game.police.state.tank = { x: 160, z: 250, angle: Math.PI, speed: 0, health: 400, radius: 2.6, callsign: 'TANK-1', turret: 0 };
  const c1 = game.police.spawnCruiser(160, 490, false);
  c1.speed = 26;
  c1.angle = Math.PI;
  // An interceptor pulls alongside on the left, in frame with the player.
  const c2 = game.police.spawnCruiser(146, 345, true);
  c2.speed = 30;
  c2.angle = Math.PI;
  const c3 = game.police.spawnCruiser(174, 540, false);
  c3.speed = 28;
  c3.angle = Math.PI;
  void c1;
  void c2;
  void c3;
  game.police.state.heli = { x: 230, z: 210, y: 65, angle: 0, rotor: 0, callsign: 'AIR-1' };
  for (let i = 0; i < 30; i += 1) {
    game.advance(STEP, driveToward(game, 160, -800));
  }
}

function stageFoot(game) {
  // Jax on foot in Neon Row, walking to his first job, city alive around him.
  game.missions.state.index = 0;
  game.cash = 120;
  game.time = 40;
  game.player.state.x = -160;
  game.player.state.z = -320;
  game.player.state.onFoot = true;
  game.player.state.angle = Math.PI;
  for (let i = 0; i < 50; i += 1) {
    game.advance(STEP, walkToward(game, -160, -480));
  }
}

function stageDrive(game) {
  // The Neon Run: two stars, a cruiser on the tail, traffic ahead, drop-off east.
  game.missions.state.index = 1;
  game.cash = 400;
  game.time = 60;
  putPlayerInCar(game, -480, -160, Math.PI / 2, 26, 100);
  game.police.setStars(2);
  const c = game.police.spawnCruiser(-560, -160, false);
  c.speed = 28;
  c.angle = Math.PI / 2;
  void c;
  // An interceptor closing in ahead on the left, and traffic to thread through.
  const interceptor = game.police.spawnCruiser(-420, -150, true);
  interceptor.speed = 26;
  interceptor.angle = Math.PI / 2;
  const t1 = game.traffic.spawnCar(-300, -166, false);
  t1.x = -300; t1.z = -166; t1.angle = Math.PI / 2; t1.speed = 12;
  const t2 = game.traffic.spawnCar(-180, -154, false);
  t2.x = -180; t2.z = -154; t2.angle = Math.PI / 2; t2.speed = 10;
  void interceptor;
  void t1;
  void t2;
  for (let i = 0; i < 60; i += 1) {
    game.advance(STEP, driveToward(game, 800, -160));
  }
}

function stageMission(game) {
  // Air One: four stars, the helicopter's spotlight sweeping, tunnel to the west.
  game.missions.state.index = 3;
  game.cash = 1550;
  game.time = 96;
  putPlayerInCar(game, 400, 800, -Math.PI / 2, 28, 88);
  game.police.setStars(4);
  game.police.state.roadblockTimer = 999;
  // Air One ahead and above, in frame with its spotlight on the player.
  game.police.state.heli = { x: 300, z: 780, y: 58, angle: 0, rotor: 0, callsign: 'AIR-1' };
  const c = game.police.spawnCruiser(520, 800, true);
  c.speed = 30;
  c.angle = -Math.PI / 2;
  void c;
  for (let i = 0; i < 40; i += 1) {
    game.advance(STEP, driveToward(game, -1120, 800));
  }
}

/** Set `game` to the named scene, play it forward, then freeze it for the shot. */
export function stageShot(name, game) {
  game.resetWorld();
  game.screen = 'play';
  if (name === 'cover') stageCover(game);
  else if (name === 'foot') stageFoot(game);
  else if (name === 'drive') stageDrive(game);
  else if (name === 'mission') stageMission(game);
  else {
    // Any other name is the title backdrop: the city at dusk.
    game.time = 30;
  }
  // The staged mission's opening line, without re-adding its heat.
  game.say(game.missions.current().lines[0]);
  game.frozen = true;
  game.hud.showScreen(null);
}
