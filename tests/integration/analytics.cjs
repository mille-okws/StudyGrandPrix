const assert = require('node:assert/strict');
const { launch } = require('../browser.cjs');

const URL = process.env.BASE_URL || 'http://127.0.0.1:8000/';

(async () => {
  const browser = await launch();
  try {
    const context = await browser.newContext({ timezoneId: 'America/Sao_Paulo' });
    const page = await context.newPage();
    await page.goto(URL, { waitUntil: 'networkidle' });
    const result = await page.evaluate(async () => {
      const model = await import('/js/ui/analyticsModel.js');
      const view = await import('/js/ui/analyticsView.js');
      const snapshot = {
        studySegments: [
          { id: 'seg-1', blockId: 'block-modern', subjectId: 'matematica', subjectName: 'Matemática', status: 'CLOSED', startedAt: '2026-10-21T11:00:00.000Z', endedAt: '2026-10-21T11:25:00.000Z', effectiveSeconds: 1500 },
          { id: 'seg-2', blockId: 'block-modern', subjectId: 'matematica', subjectName: 'Matemática', status: 'CLOSED', startedAt: '2026-10-21T11:30:00.000Z', endedAt: '2026-10-21T11:55:00.000Z', effectiveSeconds: 1500 },
          // Duplicate IDs must not inflate totals.
          { id: 'seg-2', blockId: 'block-modern', subjectId: 'matematica', status: 'CLOSED', startedAt: '2026-10-21T11:30:00.000Z', endedAt: '2026-10-21T11:55:00.000Z', effectiveSeconds: 1500 }
        ],
        studyBlocks: [
          { id: 'block-modern', subject: 'matematica', effectiveStudySeconds: 3000, completedLaps: ['lap-1', 'lap-2'] },
          // Legacy aggregate has duration but no real interval. It must be
          // counted in all-history totals, never positioned on the calendar.
          { id: 'block-legacy', subject: 'fisica', effectiveStudySeconds: 1800, completedLaps: ['old-lap'] }
        ],
        sessions: [{ id: 'legacy-lap', subject: 'quimica', duration: 600, dateKey: '2026-10-20', targetType: 'LAP', focus: 8 }],
        blockEvaluations: [{ id: 'evaluation-1', blockId: 'block-modern', targetType: 'STUDY_BLOCK', focus: 9 }]
      };
      const metrics = model.buildStudyAnalytics(snapshot);
      const rows = model.calendarRows(snapshot, { from: '2026-10-21T00:00:00.000Z', to: '2026-10-22T00:00:00.000Z' });
      const root = document.createElement('div'); document.body.append(root);
      view.renderStudyCalendar(snapshot, { root, view: 'day', date: new Date('2026-10-21T12:00:00Z') });
      return { metrics, rows, html: root.innerHTML };
    });
    assert.equal(result.metrics.totalStudySeconds, 5400);
    assert.equal(result.metrics.exactStudySeconds, 3000);
    assert.equal(result.metrics.historicalAggregateSeconds, 2400);
    assert.equal(result.metrics.totalSegments, 2);
    assert.equal(result.metrics.totalStints, 2);
    assert.equal(result.metrics.totalLaps, 4);
    assert.equal(result.metrics.evaluations, 2);
    assert.equal(result.rows.segments.length, 2);
    assert.equal(result.rows.aggregateRows.length, 0, 'legacy block without date must not be assigned to a day');
    assert.equal((result.html.match(/calendar-segment/g) || []).length, 2);
    console.log('PASSOU: telemetria distingue segmentos exatos de agregados históricos sem inventar horários.');
    await context.close();
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

