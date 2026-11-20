// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps, and the renderer paints what is there. The game moves between five
// screens: title, play, paused, busted and win. Progress (mission, cash, best
// take) is saved to localStorage.
//
// ?seed=N fixes the city. ?shot=cover|foot|drive|mission (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { createPlayer } from './player.js';
import { createPolice } from './police.js';
import { createTraffic } from './traffic.js';
import { createMissions, EVENT_ALL_DONE, EVENT_MISSION_DONE } from './missions.js';
import { createAudio } from './audio.js';
import {
  createRenderer, SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN,
} from './render.js';
import { stageShot } from './shots.js';
import {
  ACTION_CONFIRM, ACTION_HANDBRAKE, ACTION_INTERACT, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH,
  ACTION_RADIO, createInput,
} from './input.js';

/** The longest frame the loop catches up on; a longer stall is dropped, not replayed. */
const MAX_FRAME = 0.25;
const ADV_BUSTED = 1;
const ADV_WIN = 2;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const random = createRandom(seed);
const world = createWorld(random);
const player = createPlayer(world, random);
const police = createPolice(world, random);
const traffic = createTraffic(world, random);
const missions = createMissions();
const audio = createAudio();
const renderer = createRenderer(canvas);

const game = {
  world, player, police, traffic, missions, audio,
  time: 0, clockMinutes: 1060, cash: 0,
  camera: { x: 1160, y: 420, shake: 0 },
  particles: [], skids: [],
  banner: null, bustedLoss: 0,
  thudCd: 0, smokeTimer: 0, handbrakeTimer: 0,
  get radioName() { return audio.radioName; },
  get muted() { return audio.isMuted; },
};

function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return { mission: 0, cash: 0, best: 0 };
    const data = JSON.parse(raw);
    return {
      mission: Math.min(Math.max(0, data.mission | 0), 4),
      cash: Math.max(0, data.cash | 0),
      best: Math.max(0, data.best | 0),
    };
  } catch {
    return { mission: 0, cash: 0, best: 0 };
  }
}

function saveGame() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      mission: missions.state.index,
      cash: game.cash,
      best: game.best,
    }));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Ignore: best then lasts this visit only.
  }
}

function addParticles(kind, x, y, n) {
  for (let i = 0; i < n; i += 1) {
    game.particles.push({
      kind, x: x + (random() - 0.5) * 20, y: y + (random() - 0.5) * 20,
      vx: (random() - 0.5) * 120, vy: (random() - 0.5) * 120,
      size: 6 + random() * 10, ttl: 0.7 + random() * 0.5, max: 1.2,
    });
  }
  if (game.particles.length > 220) game.particles.splice(0, game.particles.length - 220);
}

function thud() {
  if (game.thudCd <= 0) {
    audio.thud();
    game.thudCd = 0.25;
  }
}

function onRam(unit, damage) {
  player.damage(damage);
  game.camera.shake = 14;
  thud();
  addParticles('spark', player.state.x, player.state.y, 8);
  addParticles('smoke', player.state.x, player.state.y, 4);
  const car = player.state.car;
  if (car && car.wrecked) {
    player.exitCar();
    game.banner = { text: 'CAR WRECKED', sub: 'Bail out — find new wheels', timer: 2.5 };
  }
}

/** Advance the whole simulation one fixed step. Returns ADV_* event flags. */
game.advance = function advance(dt, vector, handbrake) {
  let events = 0;
  game.time += dt;
  game.clockMinutes = 1060 + game.time * 0.5;
  if (game.thudCd > 0) game.thudCd -= dt;
  if (game.handbrakeTimer > 0) game.handbrakeTimer -= dt;
  if (game.banner && game.banner.timer > 0) game.banner.timer -= dt;

  // Missions.
  const missionEvents = missions.step(dt, player, police);
  if (missionEvents & EVENT_MISSION_DONE) {
    const m = missions.current();
    game.cash += m.reward;
    game.best = Math.max(game.best, game.cash);
    audio.missionDone();
    addParticles('ring', player.state.x, player.state.y, 1);
    if (missionEvents & EVENT_ALL_DONE) {
      saveGame();
      saveBest(game.best);
      return ADV_WIN;
    }
    missions.advance();
    missions.heatOnStart(police);
    game.banner = { text: 'MISSION COMPLETE', sub: `+$${m.reward} — ${missions.current().title}`, timer: 3 };
    saveGame();
  }

  // The player.
  player.step(dt, vector, { handbrake: !!handbrake }, traffic.cars, police);

  // Collisions: player car against traffic, peds and roadblocks.
  const p = player.state;
  if (!p.onFoot && p.car) {
    for (const car of traffic.cars) {
      if (car === p.car || car.wrecked || car.parked) continue;
      const dx = car.x - p.x;
      const dy = car.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < 36 && d > 0.01) {
        const push = (36 - d) / 2;
        car.x += (dx / d) * push;
        car.y += (dy / d) * push;
        p.car.x -= (dx / d) * push;
        p.car.y -= (dy / d) * push;
        if (Math.abs(p.car.speed) > 200) {
          player.damage(3);
          addParticles('spark', p.x, p.y, 6);
          thud();
          game.camera.shake = 8;
        }
        car.speed *= 0.5;
        p.car.speed *= 0.7;
      } else if (d < 52 && Math.abs(p.car.speed) > 300 && (car.nearMissCd || 0) <= 0) {
        car.nearMissCd = 2;
        game.cash += 25;
        audio.coin();
        addParticles('ring', car.x, car.y, 1);
      }
      if (car.nearMissCd > 0) car.nearMissCd -= dt;
    }
    for (let i = traffic.peds.length - 1; i >= 0; i -= 1) {
      const ped = traffic.peds[i];
      const d = Math.hypot(ped.x - p.x, ped.y - p.y);
      if (d < 26 && Math.abs(p.car.speed) > 40) {
        traffic.peds.splice(i, 1);
        police.addHeat(15);
        thud();
        addParticles('smoke', ped.x, ped.y, 5);
        game.camera.shake = 10;
      }
    }
    for (const rb of police.state.roadblocks) {
      for (const c of rb.cars) {
        const d = Math.hypot(c.x - p.x, c.y - p.y);
        if (d < 36) {
          player.damage(5);
          p.car.speed *= 0.4;
          addParticles('spark', p.x, p.y, 8);
          thud();
          game.camera.shake = 10;
        }
      }
    }
    // Skid marks while drifting, smoke while the car is hurt.
    if (handbrake && Math.abs(p.car.speed) > 200) {
      const bx = p.x - Math.cos(p.angle) * 20;
      const by = p.y - Math.sin(p.angle) * 20;
      game.skids.push({
        x1: bx, y1: by, x2: bx - Math.cos(p.angle) * 8, y2: by - Math.sin(p.angle) * 8,
        ttl: 3, max: 3,
      });
      if (game.skids.length > 200) game.skids.shift();
    }
    game.smokeTimer -= dt;
    if (p.carHealth < 45 && game.smokeTimer <= 0) {
      game.smokeTimer = 0.12;
      addParticles('smoke', p.x, p.y, 1);
    }
  }
  for (const s of game.skids) s.ttl -= dt;
  game.skids = game.skids.filter((s) => s.ttl > 0);
  for (const pt of game.particles) {
    pt.ttl -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
  }
  game.particles = game.particles.filter((pt) => pt.ttl > 0);

  // The living city and the law.
  traffic.step(dt, game.time, p, police.state.stars > 0);
  police.step(dt, game.time, player, onRam);

  // Keep the streets full.
  if (traffic.peds.length < 20 && random() < 0.05) {
    const ax = 160 + Math.floor(random() * 15) * 160;
    const sy = 160 + Math.floor(random() * 11) * 160;
    traffic.spawnPed(ax, sy);
  }
  const moving = traffic.cars.filter((c) => c.traffic).length;
  if (moving < 12 && random() < 0.03) {
    const ax = 160 + Math.floor(random() * 15) * 160;
    traffic.spawnCar(ax, 160 + Math.floor(random() * 11) * 160, true);
  }

  // Camera follows the player; shake fades.
  const tx = p.x;
  const ty = p.y;
  game.camera.x += (tx - game.camera.x) * Math.min(1, dt * 5);
  game.camera.y += (ty - game.camera.y) * Math.min(1, dt * 5);
  if (game.camera.shake > 0) game.camera.shake = Math.max(0, game.camera.shake - dt * 30);

  // Sound: sirens when the law is close, engine when driving.
  const nearCop = police.state.cruisers.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 600);
  audio.siren(dt, nearCop || police.state.stars > 0);
  if (!p.onFoot) audio.engine(Math.abs(p.speed) / 560);

  if (player.busted) return ADV_BUSTED;
  return events;
};

function resetAll() {
  const save = loadSave();
  game.best = Math.max(save.best, readBest());
  game.cash = save.cash;
  game.time = 0;
  game.clockMinutes = 1060;
  game.particles.length = 0;
  game.skids.length = 0;
  game.banner = null;
  game.bustedLoss = 0;
  game.camera = { x: 1160, y: 420, shake: 0 };
  missions.reset();
  missions.state.index = Math.min(save.mission, 4);
  player.reset();
  police.reset();
  traffic.reset();
}

function runShot(name) {
  resetAll();
  game.best = Math.max(game.best, readBest());
  const scene = stageShot(name, game);
  let painted = 0;
  function paint() {
    renderer.draw(game, scene.screen, game.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = Math.max(loadSave().best, readBest());
  game.best = best;
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    resetAll();
    screen = SCREEN_PLAY;
    audio.ensure();
    audio.startRadio();
    announce('Playing. Five-Star Heat. Follow the gold marker.');
  }

  function endBusted() {
    screen = SCREEN_BUSTED;
    game.bustedLoss = Math.floor(game.cash * 0.3);
    game.cash -= game.bustedLoss;
    audio.busted();
    if (game.cash > best) {
      best = game.cash;
      saveBest(best);
    }
    saveGame();
    announce(`Busted. Lost $${game.bustedLoss}.`);
  }

  function endWin() {
    screen = SCREEN_WIN;
    if (game.cash > best) {
      best = game.cash;
      saveBest(best);
    }
    saveGame();
    announce(`Escaped! Total take $${game.cash}.`);
  }

  function respawn() {
    player.reset();
    player.state.x = world.places.hospital.x;
    player.state.y = world.places.hospital.y;
    player.state.health = 100;
    police.reset();
    game.camera.x = player.state.x;
    game.camera.y = player.state.y;
    screen = SCREEN_PLAY;
    announce('Back on the streets.');
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) {
      if (screen === SCREEN_TITLE || screen === SCREEN_WIN) startGame();
      else if (screen === SCREEN_BUSTED) respawn();
      else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (screen !== SCREEN_PLAY) return;
    if (actions & ACTION_INTERACT) {
      if (player.state.onFoot) {
        if (player.enterCar(traffic.cars, (n) => police.addHeat(n))) {
          announce('In the car. Drive.');
        }
      } else {
        player.exitCar();
        announce('On foot.');
      }
    }
    if (actions & ACTION_PUNCH && player.state.onFoot) {
      let nearest = null;
      let nearestD = 48;
      for (const ped of traffic.peds) {
        const d = Math.hypot(ped.x - player.state.x, ped.y - player.state.y);
        if (d < nearestD) { nearestD = d; nearest = ped; }
      }
      if (nearest) {
        nearest.flee = 2;
        police.addHeat(10);
        thud();
      }
    }
    if (actions & ACTION_RADIO) audio.nextRadio();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_HANDBRAKE) game.handbrakeTimer = 0.5;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE) {
      // Ambient city behind the title: traffic rolls, camera drifts.
      game.time += STEP;
      game.camera.x = 1280 + Math.sin(game.time * 0.05) * 320;
      game.camera.y = 900 + Math.cos(game.time * 0.04) * 200;
      traffic.step(STEP, game.time, { x: -9999, y: -9999 }, false);
      renderer.draw(game, screen, best);
      return;
    }
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        const vector = input.vector();
        if (vector.x || vector.y) audio.ensure();
        const events = game.advance(STEP, vector, game.handbrakeTimer > 0);
        accumulator -= STEP;
        if (events & ADV_BUSTED) { endBusted(); break; }
        if (events & ADV_WIN) { endWin(); break; }
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(game, screen, best);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Five-Star Heat. Press Space or click to start.');
  requestAnimationFrame(frame);
}

resetAll();
if (shot) runShot(shot);
else runGame();
