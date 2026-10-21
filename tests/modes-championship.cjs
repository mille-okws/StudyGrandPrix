const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const STORE = 'silverArrowPomodoro2026';
const AWARDS = 'studyGrandPrixChampionship';
(async () => {
 const browser = await require('./browser.cjs').launch();
 try {
  const page = await browser.newPage({timezoneId:'America/Sao_Paulo',viewport:{width:1440,height:1100}});
  const errors=[];const failed=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push(r.url())});
  await page.clock.install({time:new Date('2026-10-09T12:00:00-03:00')});
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8000/',{waitUntil:'networkidle'});await require('./browser.cjs').ready(page);
  await page.locator('.team-select-card[data-team="astonmartin"]').click();
  const rules=await page.evaluate(async()=>{
   const {weeklyResult,weekStart}=await import('/js/championship.js');
   const dates=['2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09'];
   const week=Object.fromEntries(dates.map(key=>[key,{totalSeconds:1500}]));
   const sunday=new Date('2026-10-11T12:00:00');
   return {none:weeklyResult({},sunday).position,perfect:weeklyResult(week,sunday).position,
    single:weeklyResult({'2026-10-05':{totalSeconds:100000}},sunday).position,
    tiny:weeklyResult({'2026-10-05':{totalSeconds:300}},sunday).position,
    monday:weeklyResult({'2026-10-05':{totalSeconds:1500}},new Date('2026-10-05T12:00:00'),true).position,
    sundayKey:weeklyResult({},sunday).key,newYear:weeklyResult({},new Date('2027-01-01T12:00:00')).key};
  });
  assert.equal(rules.none,22);assert.equal(rules.perfect,1);assert.ok(rules.single>1 && rules.single<22);
  assert.ok(rules.tiny<22);assert.equal(rules.monday,1);assert.equal(rules.sundayKey,'2026-10-05');assert.equal(rules.newYear,'2026-12-28');
  assert.equal(await page.locator('#championshipPosition').innerText(),'P22');
  await page.locator('.circuit-row').first().click();
  await page.locator('#sleepInput').fill('8');await page.locator('#sleepInput').dispatchEvent('change');
  // Three qualifying laps, all individually evaluated, never 29 laps.
  await page.locator('[data-mode="qualy"]').click();
  assert.match(await page.locator('#timerSub').innerText(),/1\/3/);
  assert.match(await page.locator('#modeHelp').innerText(),/3 etapas/);
  await page.locator('#startBtn').click();
  for(let lap=1;lap<=3;lap++) {
   await page.clock.runFor(300000);
   await page.locator('#ratingPanel').waitFor({state:'visible'});assert.ok(await page.locator('#ratingPanel').isVisible());
   const time=await page.locator('#timerDisplay').innerText();await page.clock.runFor(2000);
   assert.equal(await page.locator('#timerDisplay').innerText(),time,'rating pauses countdown');
   await page.locator('#ratingSubmit').click();await page.locator('#ratingPanel').waitFor({state:'hidden'});
   assert.equal(await page.evaluate(async key=>(await (await import('/js/infrastructure/repositories/studyRepository.js')).readSnapshot()).store.sessions.length,STORE),lap);
  }
  assert.equal(await page.locator('#timerDisplay').innerText(),'00:00');
  assert.equal(await page.locator('#startBtn').innerText(),'[ INICIAR ]');
  await page.locator('#startBtn').click();assert.equal(await page.locator('#timerDisplay').innerText(),'05:00');
  assert.match(await page.locator('#timerSub').innerText(),/1\/3/);
  // Circuit and mode changes retain an outstanding lap's evaluation.
  await page.clock.runFor(300000);await page.locator('.circuit-row').nth(1).click();
  assert.equal(await page.evaluate(async key=>(await (await import('/js/infrastructure/repositories/studyRepository.js')).readSnapshot()).store.sessions.length,STORE),4);
  assert.ok(await page.locator('#ratingPanel').isHidden());
  assert.equal(await page.locator('#startBtn').innerText(),'[ INICIAR ]');
  await page.locator('[data-mode="race"]').click();
  assert.match(await page.locator('#modeHelp').innerText(),/56 voltas/);
  await page.locator('#startBtn').click();await page.clock.runFor(300000);await page.locator('#ratingSubmit').click();await page.locator('#ratingPanel').waitFor({state:'hidden'});
  assert.match(await page.locator('#timerSub').innerText(),/2\/56/);
  await page.clock.fastForward(60000);
  assert.equal(await page.locator('#timerDisplay').innerText(),'04:00','throttled timers use elapsed time');
  await page.locator('#startBtn').click();const paused=await page.locator('#timerDisplay').innerText();await page.clock.runFor(3000);
  assert.equal(await page.locator('#timerDisplay').innerText(),paused);
  await page.locator('#resetBtn').click();assert.match(await page.locator('#timerSub').innerText(),/1\/56/);
  // Finish all 56 laps, even after energy is exhausted. Each lap is retained.
  const beforeRace = await page.evaluate(async key=>(await (await import('/js/infrastructure/repositories/studyRepository.js')).readSnapshot()).store.sessions.length,STORE);
  await page.locator('#startBtn').click();
  for (let lap=1;lap<=56;lap++) {
   await page.clock.fastForward(300000);
   await page.locator('#ratingPanel').waitFor({state:'visible'});assert.ok(await page.locator('#ratingPanel').isVisible(), `race rating ${lap}`);
   await page.locator('#ratingSubmit').click();await page.locator('#ratingPanel').waitFor({state:'hidden'});
  }
  assert.equal(await page.locator('#timerDisplay').innerText(),'00:00');
  assert.equal(await page.evaluate(async key=>(await (await import('/js/infrastructure/repositories/studyRepository.js')).readSnapshot()).store.sessions.length,STORE),beforeRace+56);
  assert.equal(await page.locator('#startBtn').innerText(),'[ INICIAR ]');
  const laps=await page.evaluate(async key=>(await (await import('/js/infrastructure/repositories/studyRepository.js')).readSnapshot()).store.laps,STORE);
  for(const [mode,seconds] of [['short',300],['long',900]]) {
   await page.locator(`[data-mode="${mode}"]`).click();await page.locator('#startBtn').click();await page.clock.runFor(seconds*1000);
   assert.equal(await page.evaluate(async key=>(await (await import('/js/infrastructure/repositories/studyRepository.js')).readSnapshot()).store.laps,STORE),laps,'breaks do not register study');
   assert.ok(await page.locator('#ratingPanel').isHidden());
  }
  await page.locator('[data-mode="practice"]').click();await page.locator('#startBtn').click();await page.clock.runFor(1500000);await page.locator('#ratingSubmit').click();await page.locator('#ratingPanel').waitFor({state:'hidden'});
  assert.equal(await page.evaluate(async key=>(await (await import('/js/infrastructure/repositories/studyRepository.js')).readSnapshot()).store.laps,STORE),laps+1);
  assert.notEqual(await page.locator('#championshipPosition').innerText(),'P22');
  // Closed weeks: award exactly once, compare movement, and persist reloads.
  await require('./browser.cjs').clearDatabase(page);
  await page.evaluate(([store,awards])=>{
   const byDate={};for(const key of ['2026-09-28','2026-09-29','2026-09-30','2026-10-01','2026-10-02'])byDate[key]={laps:1,totalSeconds:1500};
   localStorage.setItem(store,JSON.stringify({byDate}));localStorage.removeItem(awards);
  },[STORE,AWARDS]);
  await page.reload({waitUntil:'networkidle'});await require('./browser.cjs').ready(page);
  assert.equal(await page.locator('#awardPosition').innerText(),'P1');
  assert.equal(await page.locator('#weeklyAward').getAttribute('data-tier'),'gold');
  assert.ok(await page.locator('#awardIcon').isVisible());
  assert.equal(await page.locator('#championshipPosition').innerText(),'P22');
  assert.match(await page.locator('#championshipMovement').innerText(),/↓ Caiu 21/);
  const awards=await page.evaluate(key=>localStorage.getItem(key),AWARDS);
  await page.reload({waitUntil:'networkidle'});await require('./browser.cjs').ready(page);assert.equal(await page.evaluate(key=>localStorage.getItem(key),AWARDS),awards);
  await require('./browser.cjs').clearDatabase(page);
  await page.evaluate(([store,awards])=>{
   const byDate={'2026-09-28':{laps:0,totalSeconds:0}};
   for(const key of ['2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09'])byDate[key]={laps:1,totalSeconds:1500};
   localStorage.setItem(store,JSON.stringify({byDate}));localStorage.removeItem(awards);
  },[STORE,AWARDS]);await page.reload({waitUntil:'networkidle'});await require('./browser.cjs').ready(page);
  assert.equal(await page.locator('#awardPosition').innerText(),'P22');assert.equal(await page.locator('#awardIcon').isVisible(),false);
  assert.equal(await page.locator('#championshipPosition').innerText(),'P1');assert.match(await page.locator('#championshipMovement').innerText(),/↑ Subiu 21/);
  await page.clock.setSystemTime(new Date('2026-10-12T00:01:00-03:00'));await page.clock.runFor(60000);
  assert.equal(await page.locator('#awardPosition').innerText(),'P1','open app closes the week on Monday');
  assert.equal(await page.locator('#championshipPosition').innerText(),'P22');
  for(const team of ['mercedes','ferrari','redbull','mclaren','alpine','astonmartin']) {
   await page.locator('#changeTeamBtn').click();await page.locator(`.team-select-card[data-team="${team}"]`).click();await page.waitForLoadState('networkidle');
   assert.ok(await page.locator('#championshipCard').isVisible());assert.ok(await page.locator('#weeklyAward').isVisible());
  }
  for(const width of [320,390,768,1440]) {
   await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`layout ${width}`);
  }
  await page.screenshot({path:require('./browser.cjs').screenshot('championship-desktop.png'),fullPage:true});
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  console.log('PASSOU: regras P1–P22, semana/ano, classificação completa, avaliações por volta, corrida, troca/reset/retomada, treino, pausas, prêmio persistente, setas, virada semanal e seis temas responsivos.');
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
