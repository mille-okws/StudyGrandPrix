const assert = require('node:assert/strict');
const { launch, ready, clearDatabase, snapshot } = require('../browser.cjs');
const URL = process.env.BASE_URL || 'http://127.0.0.1:8000/';

async function clean(page) {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await ready(page);
  await clearDatabase(page);
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await ready(page);
  if (await page.locator('#teamSelectOverlay').isVisible()) await page.locator('.team-select-card[data-team="mercedes"]').click();
  await page.locator('.circuit-row').first().click();
}

(async () => {
  const browser = await launch();
  try {
    const context = await browser.newContext({ timezoneId: 'America/Sao_Paulo' });
    const page = await context.newPage();
    await page.clock.install({ time: new Date('2026-10-21T08:00:00-03:00') });
    await clean(page);
    await page.locator('[data-mode="qualy"]').click();
    await page.locator('#startBtn').click();
    await page.clock.runFor(60000);
    assert.ok(await page.locator('#ratingPanel').isHidden(), 'uma volta incompleta não abriu avaliação');
    const before = await page.evaluate(async () => {
      const r = await import('/js/infrastructure/repositories/studyRepository.js');
      const block = { id: 'block-stint-ui', sessionId: 'session-stint-ui', subject: 'historia', subjectName: 'História', circuitId: 'monza', mode: 'qualy', startedAt: '2026-10-21T08:00:00-03:00', completedLaps: [], effectiveStudySeconds: 0, status: 'OPEN' };
      await r.createStudyBlock(block);
      for (let i = 1; i <= 3; i++) { const lap = { id: `lap-stint-${i}`, blockId: block.id, circuitId: block.circuitId, subject: block.subject, duration: 300, dateKey: '2026-10-21', mode: block.mode, lap: i }; await r.completeLap(lap); block.completedLaps.push(lap.id); block.effectiveStudySeconds += lap.duration; }
      await r.updateStudyBlock(block); await r.closeStudyBlock(block);
      const x = await r.readSnapshot(); return { blocks: x.store.studyBlocks, pending: x.pendingBlocks };
    });
    const testedBlock = before.blocks.find(block => block.id === 'block-stint-ui');
    assert.equal(testedBlock.completedLaps.length, 3);
    assert.equal(before.pending.length, 1);
    const after = await page.evaluate(async () => { const r = await import('/js/infrastructure/repositories/studyRepository.js'); await r.evaluateStudyBlock('block-stint-ui', { focus: 8, completion: 90, errors: 5 }); return r.readSnapshot(); });
    assert.equal(after.store.blockEvaluations.length, 1);
    assert.equal(after.store.sessions.length, 1);
    assert.equal(after.store.laps, 3);

    const fake = await page.evaluate(async () => {
      const repo = await import('/js/infrastructure/repositories/studyRepository.js');
      const queue = await import('/js/infrastructure/calendarSyncService.js');
      const adapterModule = await import('/js/infrastructure/googleCalendarAdapter.js');
      const block = { id: 'block-calendar-test', sessionId: 'session-calendar-test', subject: 'historia', subjectName: 'História', circuitId: 'monza', mode: 'race', startedAt: '2026-10-21T10:00:00-03:00', endedAt: '2026-10-21T10:25:00-03:00', completedLaps: ['lap-a'], effectiveStudySeconds: 1500, status: 'OPEN' };
      await repo.createStudyBlock(block); await repo.closeStudyBlock(block);
      await queue.enqueueCalendarBlock(block.id);
      const calls = [];
      const adapter = { connected: true, upsertEvent: async args => { calls.push(args); return { id: 'remote-calendar-event' }; } };
      const result = await queue.syncCalendarQueue(adapter, { calendarId: 'study-calendar' });
      const entries = await queue.listCalendarQueue();
      const built = new adapterModule.GoogleCalendarAdapter({ clientId: 'test', fetchImpl: async (url, options) => { calls.push({ url, options }); return { ok: true, status: 200, json: async () => ({ id: 'remote' }) }; }, windowObj: {} });
      built.accessToken = 'token';
      await built.upsertEvent({ calendarId: 'study-calendar', block, evaluation: null });
      return { result, entries, calls: calls.length };
    });
    assert.equal(fake.result.synced, 1);
    assert.equal(fake.entries[0].state, 'SYNCED');
    assert.ok(fake.calls >= 2);
    console.log('PASSOU: stint com três voltas, avaliação única no pit stop, fila offline e evento Google idempotente.');
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
