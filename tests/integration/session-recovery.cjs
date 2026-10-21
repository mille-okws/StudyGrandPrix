const assert = require('node:assert/strict');

(async () => {
  // The session manager is deliberately tested without a browser so this
  // regression does not depend on a real timer or a persisted database.
  global.document = { getElementById: () => null };
  const { initializeSessionManager, startTimer, pauseTimer } = await import('../../js/sessionManager.js');
  const state = {
    mode: 'practice', currentRaceId: 'monza', running: false, starting: false,
    dataBusy: false, unsavedLap: null, pendingLap: null, secondsLeft: 1500,
    totalSeconds: 1500, rest: 100, currentLap: 1, completedLaps: 0,
    sessionSubject: { id: 'fisica' }, timerId: null
  };
  let blockStarts = 0;
  let segmentStarts = 0;
  initializeSessionManager({
    getState: () => state,
    getCurrentRaceLaps: () => 3,
    ensureStudyBlock: async () => { blockStarts++; await new Promise(resolve => setTimeout(resolve, 25)); },
    beginStudySegment: async () => { segmentStarts++; await new Promise(resolve => setTimeout(resolve, 25)); },
    endStudySegment: async () => {},
    updateDisplay: () => {}, updateTrackProgress: () => {}, setEngineer: () => {},
    pick: () => 'ok', recoverRest: () => {}, consumeRest: () => {},
    registerCompletedLap: async () => true, submitPendingRating: async () => true
  });

  const pendingStart = startTimer();
  // Simulates a quick PAUSAR click while IndexedDB is still opening the stint.
  await pauseTimer();
  await pendingStart;

  assert.equal(blockStarts, 1);
  assert.equal(segmentStarts, 1);
  assert.equal(state.running, false, 'a stale async start must not resurrect the timer');
  assert.equal(state.timerId, null);
  assert.equal(state.starting, false);
  console.log('PASSOU: uma pausa durante a inicialização não reativa a sessão nem cria um cronômetro órfão.');
})().catch(error => { console.error(error); process.exitCode = 1; });
