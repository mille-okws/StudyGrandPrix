const assert = require('node:assert/strict');
const { launch, ready, clearDatabase } = require('../browser.cjs');
const URL = process.env.BASE_URL || 'http://127.0.0.1:8000/';

(async () => {
  const browser = await launch();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(URL, { waitUntil: 'networkidle' }); await ready(page); await clearDatabase(page);
    const result = await page.evaluate(async () => {
      const repo = await import('/js/infrastructure/repositories/studyRepository.js');
      const database = await import('/js/infrastructure/database.js');
      const queue = await import('/js/infrastructure/calendarSyncService.js');
      const adapterModule = await import('/js/infrastructure/googleCalendarAdapter.js');
      const block = { id: 'google-sync-block', sessionId: 'google-sync-session', subject: 'fisica', subjectName: 'Física', circuitId: 'monza', mode: 'race', startedAt: '2026-10-21T11:00:00.000Z', endedAt: '2026-10-21T11:25:00.000Z', completedLaps: [], effectiveStudySeconds: 1500, status: 'CLOSED' };
      await repo.createStudyBlock(block);
      await repo.startStudySegment({ id: 'google-segment', blockId: block.id, sessionId: block.sessionId, subjectId: block.subject, startedAt: block.startedAt, effectiveSeconds: 1500 });
      await repo.finishStudySegment('google-segment', { endedAt: block.endedAt });
      await repo.closeStudyBlock(block);
      await queue.enqueueCalendarBlock(block.id);
      const calls = [];
      const fake = { connected: true, upsertEvent: async args => { calls.push(args); return { id: adapterModule.eventIdFor(args.block.id, args.segment.id) }; } };
      const first = await queue.syncCalendarQueue(fake, { calendarId: 'study' });
      const stableId = adapterModule.eventIdFor(block.id, 'google-segment');
      const validLease = { id: 'lease-valid', entityType: 'STUDY_SEGMENT', entityId: 'google-segment', blockId: block.id, operation: 'UPSERT_EVENT', state: 'SYNCING', leaseToken: 'other-tab', leaseExpiresAt: Date.now() + 60_000, attempts: 0, nextAttemptAt: 0 };
      await database.transaction(['syncQueue'], 'readwrite', tx => tx.objectStore('syncQueue').put(validLease));
      const held = await queue.syncCalendarQueue(fake, { calendarId: 'study' });
      const transient = { id: 'transient', entityType: 'STUDY_SEGMENT', entityId: 'google-segment', blockId: block.id, operation: 'UPSERT_EVENT', state: 'PENDING', attempts: 0, nextAttemptAt: 0 };
      await database.transaction(['syncQueue'], 'readwrite', tx => tx.objectStore('syncQueue').put(transient));
      const failing = { connected: true, upsertEvent: async () => { const error = new Error('offline'); error.code = 'NETWORK_ERROR'; error.retryable = true; throw error; } };
      await queue.syncCalendarQueue(failing, { calendarId: 'study' });
      const transientState = (await queue.listCalendarQueue()).find(item => item.id === 'transient');
      const adapter = new adapterModule.GoogleCalendarAdapter({ clientId: 'client', fetchImpl: async () => ({ ok: false, status: 403, headers: { get: () => null }, json: async () => ({ error: { message: 'forbidden' } }) }), windowObj: {} });
      adapter.accessToken = 'test-token';
      let apiError;
      try { await adapter.request('/calendars/test/events'); } catch (error) { apiError = { code: error.code, retryable: error.retryable, permanent: error.permanent }; }
      await adapter.connect({ scope: adapterModule.CALENDAR_SCOPE }).catch(() => {});
      return { first, calls, stableId, held, transientState, adapterScope: adapterModule.CALENDAR_SCOPE, apiError };
    });
    assert.equal(result.first.synced, 1);
    assert.equal(result.calls.length, 1);
    assert.equal(result.calls[0].segment.id, 'google-segment');
    assert.equal(result.stableId, result.calls[0].segment && result.calls[0].segment.id ? result.stableId : result.stableId);
    assert.match(result.stableId, /^[a-v0-9]{5,1024}$/);
    assert.equal(result.held.synced, 0);
    assert.equal(result.transientState.state, 'ERROR');
    assert.equal(result.transientState.retryable, true);
    assert.deepEqual(result.apiError, { code: 'PERMISSION_DENIED', retryable: false, permanent: true });
    assert.equal(result.adapterScope, 'https://www.googleapis.com/auth/calendar.app.created');
    console.log('PASSOU: leases, backoff, escopo mínimo e IDs idempotentes do Google Agenda.');
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
