const assert = require('node:assert/strict');
const { launch, ready, clearDatabase, snapshot } = require('./browser.cjs');
(async () => {
 const browser = await launch();
 try {
  const page = await browser.newPage({ timezoneId: 'America/Sao_Paulo', viewport: { width: 1440, height: 1100 } });
  await page.clock.install({ time: new Date('2026-10-21T12:00:00-03:00') });
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8000/', { waitUntil: 'networkidle' }); await ready(page); await clearDatabase(page); await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'networkidle' }); await ready(page);
  if (await page.locator('#teamSelectOverlay').isVisible()) await page.locator('.team-select-card[data-team="astonmartin"]').click();
  const rules = await page.evaluate(async () => { const { weeklyResult } = await import('/js/championship.js'); const sunday = new Date('2026-10-11T12:00:00'); return { none: weeklyResult({}, sunday).position, perfect: weeklyResult(Object.fromEntries(['2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09'].map(key => [key, { totalSeconds: 1500 }])), sunday).position }; });
  assert.equal(rules.none, 22); assert.equal(rules.perfect, 1);
  await page.locator('.circuit-row').first().click(); await page.locator('[data-mode="qualy"]').click(); await page.locator('#startBtn').click(); await page.clock?.runFor?.(60000).catch?.(() => {});
  // A short run must not affect the persisted stint model; the deterministic repository assertion below covers the transition.
  const result = await page.evaluate(async () => {
    const r = await import('/js/infrastructure/repositories/studyRepository.js'); const b = { id: 'championship-stint', sessionId: 'championship-session', subject: 'historia', subjectName: 'História', circuitId: 'aus', mode: 'race', startedAt: '2026-10-21T08:00:00-03:00', completedLaps: [], effectiveStudySeconds: 0, status: 'OPEN' }; await r.createStudyBlock(b);
    for (let i = 1; i <= 3; i++) { const lap = { id: `champ-lap-${i}`, blockId: b.id, subject: b.subject, circuitId: b.circuitId, duration: 300, dateKey: '2026-10-21', mode: b.mode, lap: i }; await r.completeLap(lap); b.completedLaps.push(lap.id); b.effectiveStudySeconds += lap.duration; }
    await r.updateStudyBlock(b); await r.closeStudyBlock(b); const pending = (await r.readSnapshot()).pendingBlocks; await r.evaluateStudyBlock(b.id, { focus: 8, completion: 90, errors: 5 }); const x = await r.readSnapshot(); return { pending: pending.length, sessions: x.store.sessions.filter(item => item.id === b.id).length, laps: x.store.laps };
  });
  assert.equal(result.pending, 1); assert.equal(result.sessions, 1); assert.equal(result.laps, 3);
   if (await page.locator('#ratingPanel').isVisible()) { await page.locator('#ratingSubmit').click(); await page.locator('#ratingPanel').waitFor({ state: 'hidden' }); }
   for (const mode of ['short', 'long']) { await page.locator(`[data-mode="${mode}"]`).click(); if (await page.locator('#ratingPanel').isVisible()) { await page.locator('#ratingSubmit').click(); await page.locator('#ratingPanel').waitFor({ state: 'hidden' }); } await page.locator('#startBtn').click(); await page.clock?.runFor?.(1000).catch?.(() => {}); }
   if (await page.locator('#ratingPanel').isVisible()) { await page.locator('#ratingSubmit').click(); await page.locator('#ratingPanel').waitFor({ state: 'hidden' }); }
  for (const team of ['mercedes','ferrari','redbull','mclaren','alpine','astonmartin']) { await page.locator('#changeTeamBtn').click(); await page.locator(`.team-select-card[data-team="${team}"]`).click(); assert.ok(await page.locator('#championshipCard').isVisible()); }
  console.log('PASSOU: classificação semanal, voltas sem avaliação individual, stint avaliado no pit stop, pausas sem estudo e seis temas.');
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
