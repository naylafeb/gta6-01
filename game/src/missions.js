// The story arc: five jobs from Lena and Brick, ending in a five-star escape by
// boat. Each mission names its target, pays cash on completion, and hands the
// player its briefing lines for the dialogue box.

import { MISSIONS } from './config.js';

export const EVENT_MISSION_DONE = 1;
export const EVENT_ALL_DONE = 2;

export function createMissions() {
  const state = { index: 0, done: false, lineIndex: 0, lineTimer: 0, flash: 0 };

  function reset() {
    state.index = 0;
    state.done = false;
    state.lineIndex = 0;
    state.lineTimer = 0;
    state.flash = 0;
  }

  function current() {
    return MISSIONS[Math.min(state.index, MISSIONS.length - 1)];
  }

  function line() {
    const m = current();
    return m.lines[Math.min(state.lineIndex, m.lines.length - 1)];
  }

  /** One fixed step. Returns event flags when a mission completes. */
  function step(dt, player, police) {
    let events = 0;
    if (state.done) return events;
    const m = current();
    state.lineTimer += dt;
    if (state.lineTimer > 7 && state.lineIndex < m.lines.length - 1) {
      state.lineIndex += 1;
      state.lineTimer = 0;
    }
    if (state.flash > 0) state.flash -= dt;

    // Mission 3 is a cooldown job: reach the hideout, then lose every star.
    if (m.id === 'beachfront-heat') {
      const d = Math.hypot(player.state.x - m.target.x, player.state.y - m.target.y);
      if (d < m.target.r && police.state.stars === 0) {
        events |= EVENT_MISSION_DONE;
      }
      return events;
    }
    const d = Math.hypot(player.state.x - m.target.x, player.state.y - m.target.y);
    if (d < m.target.r) {
      events |= EVENT_MISSION_DONE;
      if (state.index >= MISSIONS.length - 1) events |= EVENT_ALL_DONE;
    }
    return events;
  }

  function advance() {
    state.index += 1;
    state.lineIndex = 0;
    state.lineTimer = 0;
    state.flash = 3;
    if (state.index >= MISSIONS.length) state.done = true;
  }

  /** Scripted heat when a mission starts: jobs 2, 4 and 5 open hot. */
  function heatOnStart(police) {
    const m = current();
    if (m.id === 'neon-run') police.setStars(2);
    else if (m.id === 'beachfront-heat') police.setStars(3);
    else if (m.id === 'air-one') police.setStars(4);
    else if (m.id === 'five-star-dawn') police.setStars(5);
  }

  return { state, reset, step, advance, current, line, heatOnStart };
}
