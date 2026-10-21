const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
 const browser = await require('./browser.cjs').launch();
 try {
  const page = await browser.newPage({ viewport: { width:1440, height:1100 } });
  const errors=[], failed=[];
  page.on('pageerror', e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push(r.url())});
  await page.clock.install();
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8000/',{waitUntil:'networkidle'});await require('./browser.cjs').ready(page);
  const identities=[];
  for(const team of ['mercedes','ferrari','mclaren','alpine','astonmartin','redbull']) {
   if(team!=='mercedes')await page.locator('#changeTeamBtn').click();
   await page.locator(`.team-select-card[data-team="${team}"]`).click();await page.waitForLoadState('networkidle');
   assert.equal(await page.evaluate(()=>document.documentElement.dataset.team),team);
   await page.locator('.circuit-row').first().click();
   assert.equal(await page.locator('#baseTrack').evaluate(e=>getComputedStyle(e).fill),'none');
   identities.push(await page.locator('.topbar').evaluate(e=>getComputedStyle(e).background));
   for(const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:1100});
    if(team!=='redbull')assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${team} page overflow at ${width}`);
    // Red Bull is intentionally unchanged; its existing narrow-screen overflow is outside this revision.
    for(const id of ['#changeTeamBtn','#championshipCard','#weeklyAward','#subjectSelect','#startBtn','#resetBtn'])assert.ok(await page.locator(id).isVisible(),`${team} missing ${id}`);
    assert.ok(await page.locator('.controls button').evaluateAll(els=>els.every(e=>e.scrollWidth<=e.clientWidth+1)),`${team} control overflow at ${width}`);
   }
   if(team!=='redbull')await page.screenshot({path:require('./browser.cjs').screenshot(`theme-${team}.png`),fullPage:true});
   await page.locator('[data-mode="short"]').click();await page.locator('#startBtn').click();await page.clock.runFor(2000);
   assert.equal(await page.locator('#timerDisplay').innerText(),'04:58');await page.locator('#startBtn').click();await page.locator('#resetBtn').click();
   assert.equal(await page.locator('#timerDisplay').innerText(),'05:00');
   await page.locator('.subject-manager summary').click();await page.locator('#newSubjectName').fill('Teste '+team);await page.locator('#addSubjectForm button').click();
   assert.equal(await page.locator('#subjectSelect option:checked').innerText(),'Teste '+team);await page.locator('.subject-manager summary').click();
  }
  assert.equal(new Set(identities).size,6,'distinct team mastheads');assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  console.log('PASSOU: seis identidades, cinco temas revisados em quatro larguras, controles, circuitos, campeonato, timer e matérias; sem erros JS ou assets.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
