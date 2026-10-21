const assert = require('node:assert/strict');
const { launch, ready, clearDatabase } = require('../browser.cjs');
const URL = process.env.BASE_URL || 'http://127.0.0.1:8000/';

(async () => {
  const browser = await launch();
  try {
    const context = await browser.newContext({ timezoneId: 'America/Sao_Paulo' });
    const page = await context.newPage();
    await page.goto(URL, { waitUntil: 'networkidle' }); await ready(page); await clearDatabase(page);
    const result = await page.evaluate(async () => {
      const repo = await import('/js/infrastructure/repositories/studyRepository.js');
      const queue = await import('/js/infrastructure/calendarSyncService.js');
      const adapter = await import('/js/infrastructure/googleCalendarAdapter.js');
      const block = { id: 'segment-block', sessionId: 'segment-session', subject: 'fisica', subjectName: 'Física', circuitId: 'monza', mode: 'race', startedAt: '2026-10-21T11:00:00.000Z', completedLaps: [], effectiveStudySeconds: 0, status: 'OPEN' };
      await repo.createStudyBlock(block);
      await repo.startStudySegment({ id: 'segment-a', blockId: block.id, sessionId: block.sessionId, subjectId: block.subject, startedAt: '2026-10-21T11:00:00.000Z', effectiveSeconds: 1500 });
      await repo.finishStudySegment('segment-a', { endedAt: '2026-10-21T11:25:00.000Z' });
      await repo.startStudySegment({ id: 'segment-b', blockId: block.id, sessionId: block.sessionId, subjectId: block.subject, startedAt: '2026-10-21T11:30:00.000Z', effectiveSeconds: 1500 });
      await repo.finishStudySegment('segment-b', { endedAt: '2026-10-21T11:55:00.000Z' });
      block.endedAt = '2026-10-21T11:55:00.000Z'; await repo.closeStudyBlock(block);
      await queue.enqueueCalendarBlock(block.id);
      const calls = []; const fake = { connected: true, upsertEvent: async args => { calls.push(args); return { id: args.segment.id }; } };
      const first = await queue.syncCalendarQueue(fake, { calendarId: 'study' });
      const database = await import('/js/infrastructure/database.js');
      await database.transaction(['syncQueue'], 'readwrite', tx => tx.objectStore('syncQueue').put({ id: 'abandoned', entityType: 'STUDY_SEGMENT', entityId: 'segment-a', blockId: block.id, operation: 'UPSERT_EVENT', state: 'SYNCING', leaseExpiresAt: Date.now() - 1, attempts: 0 }));
      await queue.recoverExpiredSyncOperations();
      const recovered = (await queue.listCalendarQueue()).find(item => item.id === 'abandoned');
      const snapshot = await repo.readSnapshot();
      const ids = [adapter.eventIdFor(block.id, 'segment-a'), adapter.eventIdFor(block.id, 'segment-b')];
      await queue.recoverExpiredSyncOperations();
      return { first, calls, ids, recovered, block: snapshot.store.studyBlocks.find(item => item.id === block.id), queue: await queue.listCalendarQueue() };
    });
    assert.equal(result.first.synced, 2); assert.equal(result.calls.length, 2);
    assert.equal(result.block.effectiveStudySeconds, 3000); assert.equal(result.block.segments.length, 2);
    assert.notEqual(result.ids[0], result.ids[1]); assert.ok(result.ids.every(id => /^[a-v0-9]{5,1024}$/.test(id)));
    assert.ok(result.queue.filter(item => item.id !== 'abandoned').every(item => item.state === 'SYNCED'));
    assert.equal(result.recovered.state, 'PENDING');
    console.log('PASSOU: segmentos excluem pausa técnica, somam tempo efetivo e geram eventos estáveis por intervalo.');
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
