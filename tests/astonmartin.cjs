const assert = require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const b=await require('./browser.cjs').launch();
 try{
 const p=await b.newPage({viewport:{width:390,height:844}}); const errors=[],failed=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)failed.push(r.url())});
 await p.clock.install();await p.goto(process.env.BASE_URL || 'http://127.0.0.1:8000/',{waitUntil:'networkidle'});await require('./browser.cjs').ready(p);
 await p.keyboard.press('Escape');assert.ok(await p.locator('#teamSelectOverlay').isVisible(),'first boot needs a team');
 await p.locator('.team-select-card[data-team="astonmartin"]').click();
 assert.equal(await p.evaluate(()=>document.activeElement.id),'changeTeamBtn');
 assert.ok(await p.locator('.driver-condition').evaluate(e=>e.classList.contains('danger')),'critical energy has danger styling');
 await p.locator('#changeTeamBtn').click();
 assert.equal(await p.evaluate(()=>document.activeElement.dataset.team),'astonmartin');
 const accent=await p.locator('.team-select-card[data-team="astonmartin"]').evaluate(e=>getComputedStyle(e).getPropertyValue('--team-accent').trim());
 assert.equal(accent,'#d4ec70');
 await p.locator('#closeTeamSelectBtn').focus();await p.keyboard.press('Shift+Tab');assert.equal(await p.evaluate(()=>document.activeElement.dataset.team),'alpine');
 await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement.id),'closeTeamSelectBtn');
 await p.keyboard.press('Escape');assert.ok(await p.locator('#teamSelectOverlay').isHidden());assert.equal(await p.evaluate(()=>document.activeElement.id),'changeTeamBtn');
 const identities={astonmartin:'Tudo preparado. Vamos começar com calma e precisão.',mercedes:'Tudo verificado. Vamos fazer isso direito.',ferrari:'Tudo pronto. Vamos lá, vamos fazer essa volta valer.',mclaren:'Tudo pronto. Vamos ver o que conseguimos tirar dessa volta.',redbull:'Tudo pronto. Vamos.',alpine:'Sistemas ativos. Tudo pronto para sair.'};
 const results=[];
 for(const team of Object.keys(identities)){
  if(team!=='astonmartin'){await p.locator('#changeTeamBtn').click();await p.locator(`.team-select-card[data-team="${team}"]`).click();await p.waitForLoadState('networkidle');}
  const message=await p.evaluate(async()=>{const {getEngineerStart}=await import('/data/engineerStatus.js');return getEngineerStart()[0]});assert.equal(message,identities[team],`live messages ${team}`);
  await p.locator('.circuit-row').first().click();await p.locator('[data-mode="practice"]').click();await p.locator('#startBtn').click();await p.clock.fastForward(1500000);
  await p.locator('#ratingPanel').waitFor({state:'visible'});assert.ok(await p.locator('#ratingPanel').isVisible());await p.locator('#ratingSubmit').click();await p.locator('#ratingPanel').waitFor({state:'hidden'});
  const total=await p.evaluate(async()=>(await (await import('/js/infrastructure/repositories/studyRepository.js')).readSnapshot()).store.sessions.length);results.push(total);
  await p.locator('[data-mode="short"]').click();await p.locator('#startBtn').click();await p.clock.fastForward(300000);
  assert.equal(await p.locator('#timerDisplay').innerText(),'00:00');assert.ok(await p.locator('#ratingPanel').isHidden());
  assert.equal(await p.evaluate(async()=>(await (await import('/js/infrastructure/repositories/studyRepository.js')).readSnapshot()).store.sessions.length),total,'break does not add study');
 }
 assert.deepEqual(results,[1,2,3,4,5,6]);
 await p.locator('#changeTeamBtn').click();await p.locator('.team-select-card[data-team="astonmartin"]').click();await p.waitForLoadState('networkidle');
 for(const width of [320,390,768,1024,1366,1920,2560,3440]){
  await p.setViewportSize({width,height:1080});await p.locator('.subject-manager summary').click();
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`expanded subject editor ${width}`);
  await p.locator('.subject-manager summary').click();
 }
 await p.screenshot({path:require('./browser.cjs').screenshot('aston-reviewed.png'),fullPage:true});
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 console.log('PASSOU: Aston comparada com cinco equipes, resultados idênticos por sessão, mensagens corretas, recuperação, seleção por teclado, oito larguras e formulários expandidos.');
 }finally{await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
