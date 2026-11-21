// The HUD: the DOM overlay that looks like the reference — mission card top
// left, wanted stars and vitals top right, dispatch list down the right side,
// minimap bottom left, speedometer bottom right, crew chatter bottom centre.
// Plus the live minimap, drawn on its own canvas every frame.

import { WORLD } from './config.js';
import { districtAt } from './world.js';

const CAR_NAMES = ['Solmar Comet GT', 'Coral Cruiser', 'Neon Runner', 'Bayline Sedan', 'Palm GT'];

export function createHud(world) {
  const $ = (id) => document.getElementById(id);
  const el = {
    missionTitle: $('mission-title'),
    missionStage: $('mission-stage'),
    missionObjective: $('mission-objective'),
    stars: $('wanted-stars'),
    wantedState: $('wanted-state'),
    cash: $('cash'),
    clock: $('clock'),
    district: $('district'),
    healthFill: $('health-fill'),
    healthNum: $('health-num'),
    armourFill: $('armour-fill'),
    armourNum: $('armour-num'),
    weaponSlots: $('weapon-slots'),
    crewList: $('crew-list'),
    dispatchList: $('dispatch-list'),
    speedNum: $('speed-num'),
    carName: $('car-name'),
    engineFill: $('engine-fill'),
    radioName: $('radio-name'),
    dialogue: $('dialogue'),
    dialogueName: $('dialogue-name'),
    minimap: $('minimap'),
    status: $('status'),
  };
  const mm = el.minimap ? el.minimap.getContext('2d') : null;
  let lastDialogue = '';

  function starRow(stars) {
    let html = '';
    for (let i = 0; i < 5; i += 1) {
      html += `<span class="star${i < stars ? ' on' : ''}">★</span>`;
    }
    return html;
  }

  function drawMinimap(game) {
    if (!mm) return;
    const W = 220;
    const H = 220;
    const sx = W / (WORLD.maxX - WORLD.minX);
    const sz = H / (WORLD.maxZ - WORLD.minZ + 500);
    const X = (x) => (x - WORLD.minX) * sx;
    const Z = (z) => (z - WORLD.minZ) * sz;
    mm.fillStyle = '#0c0a18';
    mm.fillRect(0, 0, W, H);
    // The sea and the sand at the bottom edge.
    mm.fillStyle = '#1d6f8e';
    mm.fillRect(0, Z(960), W, H - Z(960));
    mm.fillStyle = '#d9b380';
    mm.fillRect(0, Z(800), W, Z(960) - Z(800));
    // Roads.
    mm.strokeStyle = '#5a5470';
    mm.lineWidth = 3;
    for (const ax of [-1120, -800, -480, -160, 160, 480, 800, 1120]) {
      mm.beginPath();
      mm.moveTo(X(ax), Z(-960));
      mm.lineTo(X(ax), Z(960));
      mm.stroke();
    }
    for (const szz of [-800, -480, -160, 160, 480, 800]) {
      mm.beginPath();
      mm.moveTo(X(-1280), Z(szz));
      mm.lineTo(X(1280), Z(szz));
      mm.stroke();
    }
    // Buildings as faint blocks.
    mm.fillStyle = '#3a3450';
    for (const b of world.buildings) {
      mm.fillRect(X(b.x - b.w / 2), Z(b.z - b.d / 2), Math.max(1, b.w * sx), Math.max(1, b.d * sz));
    }
    // The mission marker.
    const target = game.missions.target();
    if (target) {
      mm.fillStyle = '#ffd23c';
      const tx = X(target.x);
      const tz = Z(target.z);
      mm.beginPath();
      mm.moveTo(tx, tz - 6);
      mm.lineTo(tx + 5, tz);
      mm.lineTo(tx, tz + 6);
      mm.lineTo(tx - 5, tz);
      mm.closePath();
      mm.fill();
    }
    // Police as red dots, the helicopter as a blue one.
    const p = game.player.state;
    mm.fillStyle = '#ff534d';
    for (const c of game.police.state.cruisers) {
      mm.beginPath();
      mm.arc(X(c.x), Z(c.z), 2.5, 0, Math.PI * 2);
      mm.fill();
    }
    if (game.police.state.heli) {
      mm.fillStyle = '#37e0ff';
      mm.beginPath();
      mm.arc(X(game.police.state.heli.x), Z(game.police.state.heli.z), 3, 0, Math.PI * 2);
      mm.fill();
    }
    // The player: a yellow arrow pointing where he faces.
    mm.save();
    mm.translate(X(p.x), Z(p.z));
    mm.rotate(Math.atan2(Math.sin(p.angle), -Math.cos(p.angle)) + Math.PI);
    mm.fillStyle = '#ffd23c';
    mm.beginPath();
    mm.moveTo(0, -6);
    mm.lineTo(4.5, 5);
    mm.lineTo(-4.5, 5);
    mm.closePath();
    mm.fill();
    mm.restore();
  }

  return {
    update(game) {
      const p = game.player.state;
      const stars = game.police.stars;
      if (el.missionTitle) el.missionTitle.textContent = game.missions.title();
      const countEl = document.getElementById('mission-count');
      if (countEl) {
        countEl.textContent = game.missions.state.done ? 'DONE' : `${game.missions.state.index + 1} OF 5`;
      }
      if (el.missionStage) {
        el.missionStage.style.width = `${(game.missions.state.index / 5) * 100}%`;
      }
      if (el.missionObjective) el.missionObjective.textContent = game.missions.objective(game);
      if (el.stars) el.stars.innerHTML = starRow(stars);
      if (el.wantedState) {
        el.wantedState.textContent = stars === 0 ? 'CLEAN' : stars >= 5 ? 'IN SIGHT — FIVE STARS' : 'IN SIGHT';
        el.wantedState.className = stars > 0 ? 'hot' : '';
      }
      if (el.cash) el.cash.textContent = `$${game.cash.toLocaleString('en-US')}`;
      if (el.clock) {
        const mins = 16 * 60 + 24 + Math.floor(game.time / 10);
        el.clock.textContent = `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
      }
      if (el.district) el.district.textContent = districtAt(p.x, p.z);
      if (el.healthFill) el.healthFill.style.width = `${Math.max(0, p.health)}%`;
      if (el.healthNum) el.healthNum.textContent = String(Math.max(0, Math.round(p.health)));
      if (el.armourFill) el.armourFill.style.width = `${Math.max(0, p.armour)}%`;
      if (el.armourNum) el.armourNum.textContent = String(Math.max(0, Math.round(p.armour)));
      if (el.weaponSlots) {
        const pistol = p.weapon === 'pistol' ? ' active' : '';
        const fists = p.weapon === 'fists' ? ' active' : '';
        el.weaponSlots.innerHTML =
          `<div class="slot${fists}"><span class="slot-key">1</span> FISTS</div>` +
          `<div class="slot${pistol}"><span class="slot-key">2</span> PISTOL <b>${p.ammo}</b></div>`;
      }
      if (el.crewList) {
        el.crewList.innerHTML =
          `<div class="crew"><span class="crew-key">1</span> <b>LENA</b> <span>Driver — ready</span></div>` +
          `<div class="crew"><span class="crew-key">2</span> <b>BRICK</b> <span>Muscle — ready</span></div>`;
      }
      if (el.dispatchList) {
        const rows = game.police.dispatch(p);
        el.dispatchList.innerHTML = rows.length === 0
          ? '<div class="dispatch-empty">No units on you. Stay clean.</div>'
          : rows.map((r) => `<div class="dispatch-row"><b>${r.callsign}</b> ${r.type} <span>${r.dist}m</span> <em>${r.status}</em></div>`).join('');
      }
      if (el.speedNum) {
        const kmh = Math.round(Math.abs(p.speed) * 3.6);
        el.speedNum.textContent = String(kmh);
      }
      if (el.carName) el.carName.textContent = p.onFoot ? 'ON FOOT' : (p.carName || 'Solmar Comet GT');
      if (el.engineFill) el.engineFill.style.width = `${Math.max(0, p.carHealth)}%`;
      if (el.radioName) el.radioName.textContent = game.audio.radioOn ? game.radio.name : 'Radio off';
      if (el.dialogue && game.dialogue !== lastDialogue) {
        lastDialogue = game.dialogue;
        const [who, ...rest] = game.dialogue.split(':');
        if (el.dialogueName) el.dialogueName.textContent = rest.length > 0 ? who : '';
        el.dialogue.textContent = rest.length > 0 ? rest.join(':').trim() : game.dialogue;
      }
      if (el.status) {
        el.status.textContent = `Mission ${game.missions.title()}. Wanted ${stars} stars. Cash $${game.cash}.`;
      }
      drawMinimap(game);
    },
    /** Show one of the overlay screens: title, pause, busted, win, or none. */
    showScreen(name) {
      for (const id of ['screen-title', 'screen-pause', 'screen-busted', 'screen-win']) {
        const n = document.getElementById(id);
        if (n) n.classList.toggle('hidden', id !== `screen-${name}`);
      }
    },
    carNames: CAR_NAMES,
  };
}
