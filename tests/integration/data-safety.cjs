const assert = require('node:assert/strict');
const { launch, ready, clearDatabase, snapshot } = require('../browser.cjs');
const URL = process.env.BASE_URL || 'http://127.0.0.1:8000/';

async function pageFor(context) {
  const page = await context.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' }); await ready(page);
  await clearDatabase(page); await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' }); await ready(page);
  if (await page.locator('#teamSelectOverlay').isVisible()) await page.locator('.team-select-card[data-team="mercedes"]').click();
  return page;
}

(async () => {
  const browser = await launch();
  try {
    const context = await browser.newContext({ timezoneId: 'America/Sao_Paulo' });
    const page = await pageFor(context);
    const concurrent = await page.evaluate(async () => {
      const r = await import('/js/infrastructure/repositories/studyRepository.js');
      const base = { circuitId: 'aus', subject: 'historia', dateKey: '2026-10-21', mode: 'race' };
      await Promise.all([1, 2].map(lap => r.completeLap({ ...base, id: `concurrent-${lap}`, lap, duration: 300 })));
      const x = await r.readSnapshot(); return { laps: x.store.laps, sessions: x.store.sessions.length };
    });
    assert.equal(concurrent.laps, 2); assert.equal(concurrent.sessions, 0);

    const block = await page.evaluate(async () => {
      const r = await import('/js/infrastructure/repositories/studyRepository.js');
      const b = { id: 'data-safety-block', sessionId: 'data-safety-session', subject: 'historia', subjectName: 'História', circuitId: 'monza', mode: 'race', startedAt: '2026-10-21T08:00:00-03:00', completedLaps: [], effectiveStudySeconds: 0, status: 'OPEN' };
      await r.createStudyBlock(b);
      for (let i = 1; i <= 3; i++) { const lap = { id: `data-lap-${i}`, blockId: b.id, circuitId: b.circuitId, subject: b.subject, duration: 300, dateKey: '2026-10-21', mode: b.mode, lap: i }; await r.completeLap(lap); b.completedLaps.push(lap.id); b.effectiveStudySeconds += lap.duration; }
      await r.updateStudyBlock(b); await r.closeStudyBlock(b); const pending = (await r.readSnapshot()).pendingBlocks;
      await Promise.all([r.evaluateStudyBlock(b.id, { focus: 8, completion: 90, errors: 5 }), r.evaluateStudyBlock(b.id, { focus: 1, completion: 1, errors: 99 })]);
      const x = await r.readSnapshot(); return { pending: pending.length, laps: x.store.laps, blocks: x.store.studyBlocks, sessions: x.store.sessions };
    });
    assert.equal(block.pending, 1); assert.equal(block.laps, 5); assert.equal(block.blocks.find(item => item.id === 'data-safety-block').completedLaps.length, 3); assert.equal(block.sessions.filter(item => item.id === 'data-safety-block').length, 1); assert.equal(block.sessions.find(item => item.id === 'data-safety-block').focus, 8);

    await page.evaluate(() => localStorage.setItem('silverArrowPomodoro2026', JSON.stringify({ laps: 4, totalSeconds: 1200, sessions: [{ subject: 'historia', duration: 300, focus: 7, completion: 80, errors: 10, dateKey: '2026-10-20' }] })));
    await clearDatabase(page); await page.reload({ waitUntil: 'networkidle' }); await ready(page);
    const migrated = await snapshot(page); assert.equal(migrated.sessions.length, 1); assert.equal(migrated.laps, 4);
    const raw = await page.evaluate(() => localStorage.getItem('silverArrowPomodoro2026')); await page.reload({ waitUntil: 'networkidle' }); await ready(page); assert.equal(await page.evaluate(() => localStorage.getItem('silverArrowPomodoro2026')), raw);

    const queue = await page.evaluate(async () => { const q = await import('/js/infrastructure/calendarSyncService.js'); await q.enqueueCalendarBlock('data-safety-block'); return q.listCalendarQueue(); });
    assert.equal(queue.length, 1); assert.equal(queue[0].state, 'PENDING');
    console.log('PASSOU: concorrência, blocos multi-volta, idempotência de avaliação, migração preservada e fila local.');
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
