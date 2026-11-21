// Five-Star Heat 3D: the game itself. This file owns the loop, the screens,
// the save, and the glue — the player, the traffic, the police and the
// missions all step from here, and the renderer and the HUD draw from here.

import { BEST_KEY, HIDEOUT, HOSPITAL, PLAYER, RADIOS, SAVE_KEY, STEP } from './config.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { createInput } from './input.js';
import { createMissions } from './missions.js';
import { createPlayer, headingTo, angleDiff } from './player.js';
import { createPolice } from './police.js';
import { createRenderer } from './render.js';
import { stageShot } from './shots.js';
import { createTraffic } from './traffic.js';
import { buildWorld } from './world.js';

const CAR_NAMES = ['Solmar Comet GT', 'Coral Cruiser', 'Neon Runner', 'Bayline Sedan', 'Palm GT'];

export function createGame(canvas, seed) {
  const world = buildWorld(seed);
  const audio = createAudio();
  const input = createInput();
  const player = createPlayer();
  const traffic = createTraffic(world, seed + 11);
  const police = createPolice(world);
  const missions = createMissions();
  const hud = createHud(world);
  const renderer = createRenderer(canvas, world);

  const game = {
    world, audio, input, player, traffic, police, missions, hud, renderer,
    screen: 'title',
    frozen: false,
    time: 0,
    cash: 120,
    dialogue: 'LENA: Jax, wheels. Grab any car off Neon Row and bring it to my garage.',
    particles: [],
    camera: { shake: 0 },
    radioIndex: 0,
    radio: RADIOS[0],
    hospitalTimer: 0,
    bestCash: 0,
  };

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ cash: game.cash, mission: missions.state.index }));
      localStorage.setItem(BEST_KEY, JSON.stringify({ cash: Math.max(game.bestCash, game.cash) }));
    } catch {
      // A browser that refuses storage still plays the game.
    }
  }

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (s && typeof s.cash === 'number') game.cash = s.cash;
      const b = JSON.parse(localStorage.getItem(BEST_KEY) || 'null');
      if (b && typeof b.cash === 'number') game.bestCash = b.cash;
    } catch {
      // No save, no problem.
    }
  }

  game.say = (text) => {
    game.dialogue = text;
  };

  /** A burst of fire and smoke at (x, z), with a shake and a thud. */
  game.explode = (x, z, radius) => {
    for (let i = 0; i < 22; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 4 + Math.random() * 12;
      game.particles.push({
        x, y: 0.5 + Math.random() * 2, z,
        vx: Math.sin(a) * sp, vy: 3 + Math.random() * 7, vz: Math.cos(a) * sp,
        life: 0.5 + Math.random() * 0.6, grav: -2,
        color: Math.random() < 0.5 ? '#ff9a00' : '#ffd23c',
      });
    }
    for (let i = 0; i < 12; i += 1) {
      game.particles.push({
        x: x + (Math.random() - 0.5) * 4, y: 1 + Math.random() * 3, z: z + (Math.random() - 0.5) * 4,
        vx: (Math.random() - 0.5) * 2, vy: 1.5 + Math.random() * 2, vz: (Math.random() - 0.5) * 2,
        life: 1.4 + Math.random(), grav: -1.2, color: '#555560',
      });
    }
    game.camera.shake = Math.max(game.camera.shake, 1.1);
    audio.crash(1);
    void radius;
  };

  game.onBusted = () => {
    if (game.screen !== 'play') return;
    game.screen = 'busted';
    game.cash = Math.max(0, game.cash - 500);
    audio.busted();
    hud.showScreen('busted');
    save();
  };

  game.onCarWrecked = () => {
    const p = player.state;
    if (!p.car) return;
    const wreck = p.car;
    wreck.parked = true;
    wreck.speed = 0;
    wreck.health = 0;
    player.exitCar();
    game.say('BRICK: The ride is done, Jax. On foot now — and the heat is still on.');
    game.explode(p.x, p.z, 4);
  };

  game.onMissionArcDone = () => {
    game.screen = 'win';
    game.bestCash = Math.max(game.bestCash, game.cash);
    hud.showScreen('win');
    save();
  };

  game.resetWorld = () => {
    player.reset();
    police.reset();
    traffic.reset();
    missions.reset();
    game.particles.length = 0;
    game.time = 0;
    game.cash = 120;
    game.dialogue = 'LENA: Jax, wheels. Grab any car off Neon Row and bring it to my garage.';
    game.camera.shake = 0;
    game.frozen = false;
  };

  /** Retry the current mission after a bust: same job, same cash, clean slate. */
  function retryAfterBusted() {
    const idx = missions.state.index;
    const cash = game.cash;
    game.resetWorld();
    missions.state.index = idx;
    game.cash = cash;
    missions.start(game);
    game.screen = 'play';
    hud.showScreen(null);
  }

  function firePistol() {
    const p = player.state;
    if (p.ammo <= 0) {
      game.say('JAX: Click. Dry. I need ammo.');
      return;
    }
    p.ammo -= 1;
    p.shootCooldown = 0.35;
    audio.gunshot();
    game.camera.shake = Math.max(game.camera.shake, 0.25);
    const range = 45;
    let best = null;
    let bestD = range;
    function consider(x, z, target) {
      const d = Math.hypot(x - p.x, z - p.z);
      if (d > bestD) return;
      if (Math.abs(angleDiff(p.angle, headingTo(p.x, p.z, x, z))) > 0.14) return;
      best = target;
      bestD = d;
    }
    for (const ped of traffic.peds) consider(ped.x, ped.z, { kind: 'ped', ref: ped });
    for (const c of police.state.cruisers) consider(c.x, c.z, { kind: 'cruiser', ref: c });
    if (police.state.tank) consider(police.state.tank.x, police.state.tank.z, { kind: 'tank', ref: police.state.tank });
    // A tracer line from the muzzle to the hit (or to full range).
    const tx = best ? best.ref.x : p.x + Math.sin(p.angle) * range;
    const tz = best ? best.ref.z : p.z + Math.cos(p.angle) * range;
    for (let i = 1; i <= 6; i += 1) {
      game.particles.push({
        x: p.x + (tx - p.x) * (i / 6), y: 1.4, z: p.z + (tz - p.z) * (i / 6),
        vx: 0, vy: 0, vz: 0, life: 0.12, grav: 0, color: '#ffe9a8',
      });
    }
    if (!best) return;
    police.addHeat(8);
    if (best.kind === 'ped') {
      const i = traffic.peds.indexOf(best.ref);
      if (i >= 0) traffic.peds.splice(i, 1);
      game.explode(best.ref.x, best.ref.z, 2);
      police.addHeat(15);
      game.say('Pedestrian down — the heat is on!');
    } else if (best.kind === 'cruiser') {
      const c = best.ref;
      c.health = (c.health ?? 100) - PLAYER.pistolDamage;
      game.explode(c.x, c.z, 3);
      if (c.health <= 0) {
        const i = police.state.cruisers.indexOf(c);
        if (i >= 0) police.state.cruisers.splice(i, 1);
        police.addHeat(20);
        game.say('DISPATCH: Officer down! All units, converge!');
      }
    } else if (best.kind === 'tank') {
      const t = best.ref;
      t.health = (t.health ?? 400) - PLAYER.pistolDamage;
      game.explode(t.x, t.z, 3);
      if (t.health <= 0) {
        police.state.tank = null;
        police.addHeat(30);
        game.say('BRICK: The tank is burning! Go, go, go!');
      }
    }
  }

  function punch() {
    const p = player.state;
    if (p.punchCooldown > 0) return;
    p.punchCooldown = 0.4;
    audio.punch();
    const range = 2.2;
    for (let i = traffic.peds.length - 1; i >= 0; i -= 1) {
      const ped = traffic.peds[i];
      const d = Math.hypot(ped.x - p.x, ped.z - p.z);
      if (d < range && Math.abs(angleDiff(p.angle, headingTo(p.x, p.z, ped.x, ped.z))) < 1.3) {
        traffic.peds.splice(i, 1);
        police.addHeat(10);
        game.say('JAX: Out of my way!');
        return;
      }
    }
    for (const c of police.state.cruisers) {
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      if (d < range + 1) {
        c.health = (c.health ?? 100) - PLAYER.punchDamage;
        police.addHeat(10);
        return;
      }
    }
  }

  /** One fixed step of the simulation. `axes` overrides the keys (autopilot). */
  game.advance = (dt, axesOverride) => {
    const p = player.state;
    const axes = axesOverride ?? input.axes();
    game.time += dt;
    // One-shot actions, live play only.
    if (!axesOverride) {
      if (input.hit('interact')) {
        if (p.onFoot) {
          const car = player.enterCar(traffic.cars);
          if (car) {
            p.carName = CAR_NAMES[Math.floor(Math.random() * CAR_NAMES.length)];
            police.addHeat(25);
            audio.pickup();
          }
        } else {
          player.exitCar();
        }
      }
      if (input.hit('punch') && p.onFoot) punch();
      if (input.mousePressed && p.weapon === 'pistol' && p.shootCooldown <= 0) firePistol();
      if (input.hit('pause')) {
        if (game.screen === 'play') {
          game.screen = 'pause';
          hud.showScreen('pause');
        } else if (game.screen === 'pause') {
          game.screen = 'play';
          hud.showScreen(null);
        }
      }
      if (input.hit('mute')) audio.toggleMute();
      if (input.hit('radio')) {
        game.radioIndex = (game.radioIndex + 1) % RADIOS.length;
        game.radio = RADIOS[game.radioIndex];
        game.say(`RADIO: Now playing ${game.radio.name} — ${game.radio.style}.`);
      }
    }
    // Movement.
    let crashDamage = 0;
    if (p.onFoot) {
      player.stepFoot(dt, axes.x, axes.y, p.angle, world);
    } else {
      crashDamage = player.stepCar(dt, axes.x, axes.y, input.held('brake'), world);
      if (crashDamage > 0) {
        audio.crash(crashDamage);
        game.camera.shake = Math.max(game.camera.shake, 0.7);
        game.explode(p.x, p.z, 2);
        if (p.carHealth <= 0) game.onCarWrecked();
      }
      // Handbrake smoke and damage smoke.
      if ((input.held('brake') && Math.abs(p.speed) > 10) || p.carHealth < 40) {
        game.particles.push({
          x: p.x - Math.sin(p.angle) * 2, y: 0.4, z: p.z - Math.cos(p.angle) * 2,
          vx: (Math.random() - 0.5), vy: 1.2, vz: (Math.random() - 0.5),
          life: 0.9, grav: -1, color: '#777780',
        });
      }
    }
    // Bumping traffic and pedestrians.
    if (!p.onFoot) {
      for (const car of traffic.cars) {
        if (car.driven || car === p.car) continue;
        const d = Math.hypot(car.x - p.x, car.z - p.z);
        if (d < 3.6 && d > 0.01) {
          const push = (3.6 - d) * 0.5;
          const nx = (car.x - p.x) / d;
          const nz = (car.z - p.z) / d;
          car.x += nx * push;
          car.z += nz * push;
          p.speed *= 0.6;
          car.speed = Math.max(0, car.speed - 4);
          if (Math.abs(p.speed) > 4) {
            player.hurtCar(2);
            audio.crash(0.5);
            game.camera.shake = Math.max(game.camera.shake, 0.4);
          }
        }
      }
      for (let i = traffic.peds.length - 1; i >= 0; i -= 1) {
        const ped = traffic.peds[i];
        const d = Math.hypot(ped.x - p.x, ped.z - p.z);
        if (d < 2 && Math.abs(p.speed) > 3) {
          traffic.peds.splice(i, 1);
          police.addHeat(15);
          player.hurtCar(1);
          audio.crash(0.8);
          game.camera.shake = Math.max(game.camera.shake, 0.5);
          game.say('Pedestrian down — the heat is on!');
        }
      }
      // Speeding past a cruiser adds heat.
      let near = Infinity;
      for (const c of police.state.cruisers) near = Math.min(near, Math.hypot(c.x - p.x, c.z - p.z));
      if (Math.abs(p.speed) > 30 && near < 50) police.addHeat(2.5 * dt);
    }
    // The hospital patches Jax and his car up.
    game.hospitalTimer = Math.max(0, game.hospitalTimer - dt);
    if (Math.hypot(p.x - HOSPITAL.x, p.z - HOSPITAL.z) < HOSPITAL.r && game.hospitalTimer <= 0) {
      if (p.health < 100 || p.armour < 100 || p.carHealth < 100) {
        player.healAtHospital();
        game.hospitalTimer = 10;
        game.say('Patched up at the hospital. Good as new.');
      }
    }
    traffic.step(dt, { x: p.x, z: p.z }, p.speed);
    police.update(dt, game);
    missions.update(game);
    // Particles age and drift.
    for (let i = game.particles.length - 1; i >= 0; i -= 1) {
      const pt = game.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) {
        game.particles.splice(i, 1);
        continue;
      }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.z += pt.vz * dt;
      pt.vy -= (pt.grav ?? 0) * dt;
    }
    game.camera.shake = Math.max(0, game.camera.shake - dt * 2.5);
    audio.update(dt, p.onFoot ? 0 : p.speed, PLAYER.carMaxSpeed, police.stars, game.radio);
  };

  function start() {
    audio.unlock();
    missions.start(game);
    game.screen = 'play';
    hud.showScreen(null);
  }

  // Weapon switching and screen keys, outside the input module's set.
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Digit1') player.state.weapon = 'fists';
    if (e.code === 'Digit2' && player.state.ammo > 0) player.state.weapon = 'pistol';
    if (e.code === 'KeyQ') {
      player.state.weapon = player.state.weapon === 'fists' && player.state.ammo > 0 ? 'pistol' : 'fists';
    }
    if (e.code === 'Enter' || e.code === 'Space') {
      if (game.screen === 'title') start();
      else if (game.screen === 'busted') retryAfterBusted();
      else if (game.screen === 'win') {
        game.resetWorld();
        game.screen = 'title';
        hud.showScreen('title');
      }
    }
  });
  canvas.addEventListener('mousedown', () => {
    if (game.screen === 'title') start();
    else if (game.screen === 'busted') retryAfterBusted();
  });

  load();
  input.attach();
  hud.showScreen('title');
  hud.update(game);

  // Shot mode: stage the scene, freeze it, render it still.
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (shot) {
    stageShot(shot, game);
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!game.frozen && game.screen === 'play') game.advance(dt);
    renderer.render(game, dt);
    hud.update(game);
    input.endFrame();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  return game;
}
