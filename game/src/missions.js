// The five jobs: Hot Start, Neon Run, Beachfront Heat, Air One, Five-Star
// Dawn. Each one is a target on the map and a line or two from the crew; the
// heat and the helicopter join in as the arc climbs toward five stars.

import { HIDEOUT, MISSIONS } from './config.js';

export function createMissions() {
  const state = { index: 0, lineIndex: 0, done: false, started: false };

  function current() {
    return MISSIONS[Math.min(state.index, MISSIONS.length - 1)];
  }

  return {
    state,
    reset() {
      state.index = 0;
      state.lineIndex = 0;
      state.done = false;
      state.started = false;
    },
    current,
    /** True when the player stands inside the hideout circle. */
    atHideout(player) {
      if (!player) return false;
      return Math.hypot(player.x - HIDEOUT.x, player.z - HIDEOUT.z) < HIDEOUT.r;
    },
    /** Begin the current mission: its opening line and its heat. */
    start(game) {
      const m = current();
      state.started = true;
      state.lineIndex = 0;
      game.say(m.lines[0]);
      if (m.id === 'neon-run') game.police.addHeat(40);
      if (m.id === 'air-one') game.police.setStars(4);
      if (m.id === 'five-star-dawn') game.police.setStars(5);
    },
    /** The mission's target marker, or null once the arc is done. */
    target() {
      if (state.done) return null;
      return current().target;
    },
    /** The mission's title line for the HUD card. */
    title() {
      if (state.done) return 'All jobs done';
      return current().title;
    },
    /** The objective line for the HUD card. */
    objective(game) {
      if (state.done) return 'Reach the boat. Sail out of Solmar Bay.';
      const m = current();
      if (m.id === 'hot-start' && game.player.state.onFoot) return 'Steal a car — any car — then reach the marker.';
      if (m.id === 'beachfront-heat') return 'Lose the heat, then reach the hideout marker.';
      return `Reach the marker: ${m.target.label}.`;
    },
    /** Called every step: arrive at the marker and the job pays out. */
    update(game) {
      if (state.done) return;
      const player = game.player.state;
      const m = current();
      const d = Math.hypot(player.x - m.target.x, player.z - m.target.z);
      // The beachfront job only counts once the heat is down.
      if (m.id === 'beachfront-heat' && game.police.stars > 1) return;
      // The first job needs wheels before it counts.
      if (m.id === 'hot-start' && player.onFoot) return;
      if (d > m.target.r) return;
      game.cash += m.reward;
      game.audio.missionDone();
      game.say(`JOB DONE: ${m.title} — $${m.reward} in the bag.`);
      if (state.index >= MISSIONS.length - 1) {
        state.done = true;
        game.onMissionArcDone();
        return;
      }
      state.index += 1;
      state.lineIndex = 0;
      this.start(game);
    },
    /** The next crew line, for the dialogue box's tap-to-continue. */
    nextLine(game) {
      const m = current();
      if (state.lineIndex < m.lines.length - 1) {
        state.lineIndex += 1;
        game.say(m.lines[state.lineIndex]);
        return true;
      }
      return false;
    },
  };
}
