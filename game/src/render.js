// Drawing only: the city, its cars and people, the police chase, the particles and
// the HUD. The camera follows the player; the HUD is drawn in a fixed 1280x720
// logical space on top. Flat shapes and canvas text, no images, no network.

import { AVENUES, BEACH_TOP, PALETTE, ROAD_W, STREETS, VIEW, WATER_TOP, WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WIN = 'win';

const fonts = new Map();
function font(size) {
  if (!fonts.has(size)) fonts.set(size, `bold ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`);
  return fonts.get(size);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, baseline) {
    context.font = font(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  function panel(x, y, w, h) {
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, w, h);
    context.strokeStyle = 'rgba(255, 210, 60, 0.35)';
    context.lineWidth = 2;
    context.strokeRect(x, y, w, h);
  }

  /** The visible world rectangle for the camera, in world coordinates. */
  function cameraRect(game) {
    const vw = canvas.width / view.scale;
    const vh = canvas.height / view.scale;
    const cx = clamp(game.camera.x - vw / 2, 0, Math.max(0, WORLD.width - vw));
    const cy = clamp(game.camera.y - vh / 2, 0, Math.max(0, WORLD.height - vh));
    return { x: cx, y: cy, w: vw, h: vh };
  }

  function drawRoads(game) {
    const t = game.time;
    context.fillStyle = PALETTE.block;
    context.fillRect(0, 0, WORLD.width, BEACH_TOP);
    // Sand, then water with slow wave lines.
    context.fillStyle = PALETTE.sand;
    context.fillRect(0, BEACH_TOP, WORLD.width, WATER_TOP - BEACH_TOP);
    context.fillStyle = PALETTE.water;
    context.fillRect(0, WATER_TOP, WORLD.width, WORLD.height - WATER_TOP);
    context.strokeStyle = 'rgba(255,255,255,0.25)';
    context.lineWidth = 2;
    for (let i = 0; i < 6; i += 1) {
      const y = WATER_TOP + 14 + i * 9 + Math.sin(t * 0.8 + i) * 2;
      context.beginPath();
      context.moveTo(0, y);
      for (let x = 0; x <= WORLD.width; x += 80) context.lineTo(x, y + Math.sin(x / 160 + t + i) * 3);
      context.stroke();
    }
    // Asphalt.
    context.fillStyle = PALETTE.road;
    for (const ax of AVENUES) context.fillRect(ax - ROAD_W / 2, 0, ROAD_W, BEACH_TOP);
    for (const sy of STREETS) context.fillRect(0, sy - ROAD_W / 2, WORLD.width, ROAD_W);
    // Centre dashes.
    context.fillStyle = PALETTE.roadLine;
    for (const ax of AVENUES) {
      for (let y = 0; y < BEACH_TOP; y += 44) context.fillRect(ax - 2, y, 4, 22);
    }
    for (const sy of STREETS) {
      for (let x = 0; x < WORLD.width; x += 44) context.fillRect(x, sy - 2, 22, 4);
    }
    // Crosswalks at every intersection.
    context.fillStyle = 'rgba(232, 228, 218, 0.75)';
    for (const ax of AVENUES) {
      for (const sy of STREETS) {
        for (let i = -3; i <= 3; i += 1) {
          context.fillRect(ax + i * 12 - 4, sy - ROAD_W / 2 + 6, 8, 16);
          context.fillRect(ax + i * 12 - 4, sy + ROAD_W / 2 - 22, 8, 16);
        }
      }
    }
  }

  function drawBuildings(game) {
    const t = game.time;
    for (const b of game.world.buildings) {
      context.fillStyle = b.color;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = b.roof;
      context.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
      // Lit windows: warm dots in a grid.
      context.fillStyle = 'rgba(255, 197, 60, 0.8)';
      const cols = Math.max(1, Math.floor(b.w / 26));
      const rows = Math.max(1, Math.floor(b.h / 26));
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          if ((c * 7 + r * 3 + b.floors) % 3 === 0) {
            context.fillRect(b.x + 12 + c * 26, b.y + 12 + r * 26, 9, 12);
          }
        }
      }
      if (b.sign) {
        const flicker = 0.75 + 0.25 * Math.sin(t * 3 + b.x);
        context.globalAlpha = flicker;
        context.fillStyle = b.sign.color;
        context.font = font(20);
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(b.sign.text, b.x + b.w / 2, b.y + 18);
        context.globalAlpha = 1;
      }
    }
    for (const p of game.world.posters) {
      context.fillStyle = '#e8e4da';
      context.fillRect(p.x, p.y, 34, 22);
      context.fillStyle = '#c92e2e';
      context.font = font(9);
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(p.text, p.x + 17, p.y + 11);
    }
    // Palms: trunk plus swaying fronds.
    for (const palm of game.world.palms) {
      const sway = Math.sin(t * 0.9 + palm.sway) * 0.12;
      context.strokeStyle = PALETTE.palmTrunk;
      context.lineWidth = 5;
      context.beginPath();
      context.moveTo(palm.x, palm.y);
      context.lineTo(palm.x + 6, palm.y - 26);
      context.stroke();
      context.strokeStyle = PALETTE.palm;
      context.lineWidth = 4;
      for (let f = 0; f < 5; f += 1) {
        const a = -Math.PI / 2 + (f - 2) * 0.5 + sway;
        context.beginPath();
        context.moveTo(palm.x + 6, palm.y - 26);
        context.lineTo(palm.x + 6 + Math.cos(a) * 22, palm.y - 26 + Math.sin(a) * 16);
        context.stroke();
      }
    }
    // Traffic lights.
    for (const light of game.world.lights) {
      const s = game.world.lightState(light, t);
      context.fillStyle = '#14161c';
      context.fillRect(light.x + ROAD_W / 2 + 2, light.y - ROAD_W / 2 - 6, 10, 30);
      context.fillStyle = s === 'stop' ? '#ff3b30' : '#3a3f4a';
      context.beginPath(); context.arc(light.x + ROAD_W / 2 + 7, light.y - ROAD_W / 2 + 2, 4, 0, Math.PI * 2); context.fill();
      context.fillStyle = s === 'slow' ? '#ffc53c' : '#3a3f4a';
      context.beginPath(); context.arc(light.x + ROAD_W / 2 + 7, light.y - ROAD_W / 2 + 12, 4, 0, Math.PI * 2); context.fill();
      context.fillStyle = s === 'go' ? '#54d97b' : '#3a3f4a';
      context.beginPath(); context.arc(light.x + ROAD_W / 2 + 7, light.y - ROAD_W / 2 + 22, 4, 0, Math.PI * 2); context.fill();
    }
    // The marina pier.
    const pier = game.world.pier;
    context.fillStyle = '#7a5a3c';
    context.fillRect(pier.x, pier.y, pier.w, pier.h);
    context.fillStyle = '#8a6a4a';
    for (let x = pier.x; x < pier.x + pier.w; x += 18) context.fillRect(x, pier.y, 3, pier.h);
    context.fillStyle = '#e8e4da';
    context.beginPath();
    context.moveTo(pier.x + 150, pier.y - 6);
    context.lineTo(pier.x + 196, pier.y + 4);
    context.lineTo(pier.x + 150, pier.y + 14);
    context.closePath();
    context.fill();
  }

  function drawCar(car, isPlayer, t) {
    context.save();
    context.translate(car.x, car.y);
    // Long dusk shadow.
    context.fillStyle = 'rgba(0, 0, 0, 0.3)';
    context.fillRect(-18 + 8, -8 + 10, 46, 22);
    context.rotate(car.angle);
    context.fillStyle = car.wrecked ? '#2a2d33' : car.color;
    context.beginPath();
    context.roundRect(-23, -12, 46, 24, 7);
    context.fill();
    context.fillStyle = car.wrecked ? '#1c1e24' : 'rgba(20, 22, 28, 0.85)';
    context.fillRect(-6, -9, 16, 18);
    context.fillStyle = 'rgba(255, 255, 255, 0.25)';
    context.fillRect(12, -8, 6, 16);
    if (car.isPolice) {
      const flash = Math.floor(t * 6) % 2 === 0;
      context.fillStyle = flash ? PALETTE.policeLightRed : PALETTE.policeLightBlue;
      context.fillRect(-4, -12, 8, 24);
      context.fillStyle = '#e8e4da';
      context.fillRect(-22, -11, 4, 22);
    }
    if (isPlayer) {
      context.strokeStyle = PALETTE.player;
      context.lineWidth = 2;
      context.beginPath();
      context.roundRect(-25, -14, 50, 28, 8);
      context.stroke();
    }
    // Headlight cones at dusk.
    context.fillStyle = 'rgba(255, 240, 180, 0.14)';
    context.beginPath();
    context.moveTo(23, -8);
    context.lineTo(90, -26);
    context.lineTo(90, 26);
    context.lineTo(23, 8);
    context.closePath();
    context.fill();
    context.restore();
  }

  function drawPed(ped) {
    context.fillStyle = 'rgba(0, 0, 0, 0.3)';
    context.beginPath(); context.ellipse(ped.x + 3, ped.y + 5, 8, 4, 0, 0, Math.PI * 2); context.fill();
    context.fillStyle = ped.color;
    context.beginPath(); context.arc(ped.x, ped.y, ped.radius, 0, Math.PI * 2); context.fill();
    context.fillStyle = '#e8b4a0';
    context.beginPath(); context.arc(ped.x, ped.y - 2, 4, 0, Math.PI * 2); context.fill();
  }

  function drawPlayer(game) {
    const p = game.player.state;
    if (!p.onFoot) return;
    if (p.invulnerable > 0 && Math.floor(p.invulnerable * 10) % 2 === 0) return;
    context.fillStyle = 'rgba(0, 0, 0, 0.3)';
    context.beginPath(); context.ellipse(p.x + 4, p.y + 6, 11, 5, 0, 0, Math.PI * 2); context.fill();
    // A soft gold ring at Jax's feet: on foot he is small against the city, and
    // the ring is what the eye finds first.
    context.strokeStyle = 'rgba(255, 207, 61, 0.75)';
    context.lineWidth = 2;
    context.beginPath(); context.arc(p.x, p.y, 21, 0, Math.PI * 2); context.stroke();
    context.fillStyle = '#ffd23c';
    context.beginPath(); context.arc(p.x, p.y, 13, 0, Math.PI * 2); context.fill();
    context.strokeStyle = '#20242e';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(p.x, p.y);
    context.lineTo(p.x + Math.cos(p.angle) * 14, p.y + Math.sin(p.angle) * 14);
    context.stroke();
    context.fillStyle = '#e8b4a0';
    context.beginPath(); context.arc(p.x, p.y - 2, 5, 0, Math.PI * 2); context.fill();
  }

  function drawPolice(game) {
    const t = game.time;
    const pol = game.police.state;
    for (const c of pol.cruisers) {
      if (c.wrecked) {
        context.fillStyle = 'rgba(0,0,0,0.35)';
        context.fillRect(c.x - 20, c.y - 10, 40, 20);
        continue;
      }
      drawCar(c, false, t);
    }
    for (const rb of pol.roadblocks) {
      for (const c of rb.cars) {
        context.save();
        context.translate(c.x, c.y);
        context.rotate(c.angle);
        context.fillStyle = '#20242e';
        context.beginPath(); context.roundRect(-23, -12, 46, 24, 7); context.fill();
        context.fillStyle = Math.floor(t * 6) % 2 === 0 ? PALETTE.policeLightRed : PALETTE.policeLightBlue;
        context.fillRect(-4, -12, 8, 24);
        context.restore();
      }
      context.fillStyle = '#ffc53c';
      context.font = font(15);
      context.textAlign = 'center';
      context.fillText('ROADBLOCK', rb.x, rb.y - 34);
    }
    if (pol.heli) {
      const h = pol.heli;
      // Searchlight cone down to the player.
      const p = game.player.state;
      context.fillStyle = 'rgba(255, 240, 180, 0.16)';
      context.beginPath();
      context.moveTo(h.x, h.y);
      context.lineTo(p.x - 60, p.y - 40);
      context.lineTo(p.x + 60, p.y + 40);
      context.closePath();
      context.fill();
      context.fillStyle = 'rgba(255, 240, 180, 0.35)';
      context.beginPath(); context.ellipse(p.x, p.y, 55, 40, 0, 0, Math.PI * 2); context.fill();
      // Ground shadow, then the helicopter itself.
      context.fillStyle = 'rgba(0, 0, 0, 0.3)';
      context.beginPath(); context.ellipse(h.x + 20, h.y + 26, 26, 10, 0, 0, Math.PI * 2); context.fill();
      context.save();
      context.translate(h.x, h.y);
      context.rotate(h.angle);
      context.fillStyle = PALETTE.heli;
      context.beginPath(); context.ellipse(0, 0, 26, 12, 0, 0, Math.PI * 2); context.fill();
      context.strokeStyle = '#9aa0ad';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(-34, 0);
      context.lineTo(34, 0);
      context.stroke();
      context.restore();
      context.fillStyle = '#e8e4da';
      context.font = font(13);
      context.textAlign = 'center';
      context.fillText('AIR ONE', h.x, h.y - 34);
    }
    if (pol.tank) {
      const k = pol.tank;
      context.save();
      context.translate(k.x, k.y);
      context.fillStyle = 'rgba(0,0,0,0.35)';
      context.fillRect(-30 + 8, -18 + 12, 62, 36);
      context.rotate(k.angle);
      context.fillStyle = PALETTE.tank;
      context.beginPath(); context.roundRect(-32, -20, 64, 40, 8); context.fill();
      context.fillStyle = '#3a4432';
      context.beginPath(); context.arc(0, 0, 14, 0, Math.PI * 2); context.fill();
      context.fillStyle = '#2c3526';
      context.fillRect(10, -4, 34, 8);
      context.restore();
      context.fillStyle = '#ff534d';
      context.font = font(15);
      context.textAlign = 'center';
      context.fillText('TANK', k.x, k.y - 36);
    }
  }

  function drawParticles(game) {
    for (const s of game.skids) {
      context.strokeStyle = `rgba(20, 18, 24, ${0.4 * (s.ttl / s.max)})`;
      context.lineWidth = 5;
      context.beginPath();
      context.moveTo(s.x1, s.y1);
      context.lineTo(s.x2, s.y2);
      context.stroke();
    }
    for (const pt of game.particles) {
      if (pt.kind === 'smoke') {
        context.fillStyle = `rgba(120, 118, 128, ${0.45 * (pt.ttl / pt.max)})`;
        context.beginPath(); context.arc(pt.x, pt.y, pt.size * (2 - pt.ttl / pt.max), 0, Math.PI * 2); context.fill();
      } else if (pt.kind === 'spark') {
        context.strokeStyle = `rgba(255, 197, 60, ${pt.ttl / pt.max})`;
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(pt.x, pt.y);
        context.lineTo(pt.x - pt.vx * 0.05, pt.y - pt.vy * 0.05);
        context.stroke();
      } else if (pt.kind === 'ring') {
        context.strokeStyle = `rgba(255, 210, 60, ${pt.ttl / pt.max})`;
        context.lineWidth = 3;
        context.beginPath(); context.arc(pt.x, pt.y, pt.size * (2 - pt.ttl / pt.max), 0, Math.PI * 2); context.stroke();
      }
    }
  }

  function drawObjectiveMarker(game) {
    const m = game.missions.current();
    if (game.missions.state.done) return;
    const t = game.time;
    const pulse = 1 + 0.15 * Math.sin(t * 4);
    // Clamp the marker into the frame: a target past the world edge (the marina
    // boat, the tunnel) would otherwise draw its label half off the screen.
    const cam = cameraRect(game);
    // 90px of side margin, not 70: the label is centred on the ring and is
    // about 140px wide, so 70 would leave its edge hanging off the screen.
    const sx = clamp(m.target.x - cam.x, 90, VIEW.width - 90);
    const sy = clamp(m.target.y - cam.y, 80, VIEW.height - 50);
    context.save();
    context.translate(cam.x + sx, cam.y + sy);
    context.strokeStyle = PALETTE.neonGold;
    context.lineWidth = 3;
    context.beginPath(); context.arc(0, 0, m.target.r * 0.5 * pulse, 0, Math.PI * 2); context.stroke();
    context.fillStyle = 'rgba(255, 197, 60, 0.15)';
    context.beginPath(); context.arc(0, 0, m.target.r * 0.5 * pulse, 0, Math.PI * 2); context.fill();
    context.fillStyle = PALETTE.neonGold;
    context.font = font(16);
    context.textAlign = 'center';
    context.fillText(m.target.label, 0, -m.target.r * 0.5 - 12);
    context.restore();
  }

  function drawWorld(game) {
    drawRoads(game);
    drawBuildings(game);
    drawObjectiveMarker(game);
    drawParticles(game);
    for (const car of game.traffic.cars) {
      if (car === game.player.state.car) continue;
      drawCar(car, false, game.time);
    }
    for (const ped of game.traffic.peds) drawPed(ped);
    drawPolice(game);
    const p = game.player.state;
    if (p.car) drawCar(p.car, true, game.time);
    drawPlayer(game);
  }

  function drawStars(stars) {
    for (let i = 0; i < 5; i += 1) {
      const filled = i < stars;
      const flash = stars === 5 && Math.floor(performance.now() / 300) % 2 === 0;
      context.font = font(30);
      context.fillStyle = filled ? (flash ? '#ff534d' : PALETTE.star) : PALETTE.starEmpty;
      context.textAlign = 'left';
      context.textBaseline = 'alphabetic';
      context.fillText('★', 24 + i * 34, 46);
    }
  }

  function drawMinimap(game) {
    const x0 = VIEW.width - 210;
    const y0 = 16;
    const w = 194;
    const h = 146;
    const sx = w / WORLD.width;
    const sy = h / WORLD.height;
    panel(x0, y0, w, h);
    context.save();
    context.beginPath();
    context.rect(x0 + 2, y0 + 2, w - 4, h - 4);
    context.clip();
    context.fillStyle = PALETTE.water;
    context.fillRect(x0, y0 + (BEACH_TOP - 60) * sy, w, h);
    context.fillStyle = PALETTE.road;
    for (const ax of AVENUES) context.fillRect(x0 + ax * sx - 1, y0, 2, h);
    for (const sy2 of STREETS) context.fillRect(x0, y0 + sy2 * sy - 1, w, 2);
    const m = game.missions.current();
    if (!game.missions.state.done) {
      context.strokeStyle = PALETTE.neonGold;
      context.lineWidth = 2;
      context.beginPath(); context.arc(x0 + m.target.x * sx, y0 + m.target.y * sy, 6, 0, Math.PI * 2); context.stroke();
    }
    for (const c of game.police.state.cruisers) {
      context.fillStyle = '#2e7dff';
      context.fillRect(x0 + c.x * sx - 2, y0 + c.y * sy - 2, 4, 4);
    }
    if (game.police.state.heli) {
      context.fillStyle = '#ff534d';
      context.fillRect(x0 + game.police.state.heli.x * sx - 2, y0 + game.police.state.heli.y * sy - 2, 4, 4);
    }
    if (game.police.state.tank) {
      context.fillStyle = '#ff534d';
      context.beginPath(); context.arc(x0 + game.police.state.tank.x * sx, y0 + game.police.state.tank.y * sy, 4, 0, Math.PI * 2); context.fill();
    }
    const p = game.player.state;
    context.fillStyle = PALETTE.player;
    context.beginPath(); context.arc(x0 + p.x * sx, y0 + p.y * sy, 4, 0, Math.PI * 2); context.fill();
    context.restore();
    text('SOLMAR BAY', x0 + 8, y0 + h - 8, 12, PALETTE.muted, 'left');
  }

  function drawHud(game) {
    const p = game.player.state;
    const pol = game.police.state;
    panel(12, 12, 250, 96);
    drawStars(pol.stars);
    text(`HEALTH ${Math.round(p.health)}`, 24, 74, 18, p.health > 30 ? PALETTE.health : PALETTE.damage, 'left');
    context.fillStyle = '#3a3f4a';
    context.fillRect(24, 80, 180, 10);
    context.fillStyle = p.health > 30 ? PALETTE.health : PALETTE.damage;
    context.fillRect(24, 80, 180 * clamp(p.health / 100, 0, 1), 10);
    text(`$${game.cash}`, 214, 74, 18, PALETTE.neonGold, 'left');
    drawMinimap(game);
    const district = game.world.districtAt(p.x, p.y);
    text(district, 24, 128, 20, PALETTE.text, 'left');
    text(game.missions.state.done ? 'SOLMAR BAY — FREE' : game.missions.current().title, 24, 152, 16, PALETTE.muted, 'left');
    // Objective banner, bottom centre.
    const m = game.missions.current();
    if (!game.missions.state.done) {
      const d = Math.round(Math.hypot(p.x - m.target.x, p.y - m.target.y));
      panel(VIEW.width / 2 - 260, VIEW.height - 116, 520, 44);
      text(`▶ ${m.target.label} — ${d}m`, VIEW.width / 2, VIEW.height - 88, 18, PALETTE.text, 'center');
    }
    // Bottom-left: speed, radio, clock.
    const hh = 17 + Math.floor(game.clockMinutes / 60);
    const mm = Math.floor(game.clockMinutes % 60);
    const clock = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    text(p.onFoot ? 'ON FOOT' : `${Math.round(p.speed * 0.24)} km/h`, 24, VIEW.height - 24, 18, PALETTE.text, 'left');
    text(`${game.radioName}  ·  ${clock}${game.muted ? '  ·  MUTED' : ''}`, 24, VIEW.height - 48, 14, PALETTE.muted, 'left');
    // Dialogue box.
    if (!game.missions.state.done) {
      const line = game.missions.line();
      panel(240, VIEW.height - 186, VIEW.width - 480, 56);
      text(line, VIEW.width / 2, VIEW.height - 152, 17, PALETTE.text, 'center');
    }
    // Centre flash banner.
    if (game.banner && game.banner.timer > 0) {
      context.globalAlpha = clamp(game.banner.timer, 0, 1);
      text(game.banner.text, VIEW.width / 2, 210, 44, PALETTE.neonGold, 'center');
      if (game.banner.sub) text(game.banner.sub, VIEW.width / 2, 246, 20, PALETTE.text, 'center');
      context.globalAlpha = 1;
    }
    // Controls hint, first seconds of play.
    if (game.time < 9) {
      text('WASD drive / walk · E enter car · F punch · Shift handbrake · R radio · P pause', VIEW.width / 2, VIEW.height - 130, 14, PALETTE.muted, 'center');
    }
  }

  function drawPanelScreen(title, lines, prompt, best) {
    const w = 640;
    const h = 190 + lines.length * 34;
    const x = (VIEW.width - w) / 2;
    const y = (VIEW.height - h) / 2;
    panel(x, y, w, h);
    text(title, VIEW.width / 2, y + 74, 46, PALETTE.neonGold, 'center');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], VIEW.width / 2, y + 128 + i * 34, 20, PALETTE.muted, 'center');
    }
    if (best !== null && best !== undefined) text(`Best escape: $${best}`, VIEW.width / 2, y + h - 66, 18, PALETTE.text, 'center');
    text(prompt, VIEW.width / 2, y + h - 34, 20, PALETTE.text, 'center');
  }

  /** Paint one frame: the world through the camera, then the HUD or a screen panel. */
  function draw(game, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    // Dusk sky behind everything.
    const sky = context.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, PALETTE.duskTop);
    sky.addColorStop(1, PALETTE.duskBottom);
    context.fillStyle = sky;
    context.fillRect(0, 0, canvas.width, canvas.height);
    // World through the camera, with screen shake.
    const cam = cameraRect(game);
    const shx = game.camera.shake > 0 ? (Math.random() - 0.5) * game.camera.shake : 0;
    const shy = game.camera.shake > 0 ? (Math.random() - 0.5) * game.camera.shake : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x - (cam.x + shx) * view.scale, view.y - (cam.y + shy) * view.scale);
    drawWorld(game);
    // HUD in fixed logical space.
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_TITLE) {
      drawPanelScreen('FIVE-STAR HEAT', [
        'Solmar Bay. One driver. Five stars. The whole city is coming.',
        'Steal a car, run five jobs for Lena and Brick, and escape by boat at dawn.',
        'On foot and by car — watch the stars. At five, the tank rolls in.',
      ], 'Press Space or click to start', best);
      return;
    }
    drawHud(game);
    if (screen === SCREEN_PAUSED) {
      drawPanelScreen('Paused', ['The chase waits for no one. Except now.'], 'Press P to resume', null);
    } else if (screen === SCREEN_BUSTED) {
      drawPanelScreen('BUSTED', [
        'Solmar PD caught up with Jax. The crew posts bail; the jobs stay open.',
        `Cash lost: $${game.bustedLoss || 0}. The heat resets — the city does not forget.`,
      ], 'Press Space to get back out there', best);
    } else if (screen === SCREEN_WIN) {
      drawPanelScreen('DAWN BREAKS', [
        'Five stars, one boat, and the whole of Solmar Bay in the rear-view.',
        `Jax Calloway made it out. Total take: $${game.cash}.`,
      ], 'Press Space to play again', best);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
