const assert = require('node:assert/strict');
const { launch, ready } = require('./browser.cjs');
(async()=>{
 const browser=await launch();
 try {
  const page=await browser.newPage({viewport:{width:390,height:844}}); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8000/',{waitUntil:'networkidle'}); await ready(page);
  if(await page.locator('#teamSelectOverlay').isVisible()) await page.locator('.team-select-card[data-team="astonmartin"]').click();
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.team),'astonmartin'); assert.ok(await page.locator('.driver-condition').evaluate(e=>e.classList.contains('danger')));
  const identities={astonmartin:'Tudo preparado. Vamos começar com calma e precisão.',mercedes:'Tudo verificado. Vamos fazer isso direito.',ferrari:'Tudo pronto. Vamos lá, vamos fazer essa volta valer.',mclaren:'Tudo pronto. Vamos ver o que conseguimos tirar dessa volta.',redbull:'Tudo pronto. Vamos.',alpine:'Sistemas ativos. Tudo pronto para sair.'};
  for(const team of Object.keys(identities)) { if(team!=='astonmartin'){await page.locator('#changeTeamBtn').click();await page.locator(`.team-select-card[data-team="${team}"]`).click();} const message=await page.evaluate(async()=>{const {getEngineerStart}=await import('/data/engineerStatus.js');return getEngineerStart()[0]}); assert.equal(message,identities[team]); }
  await page.locator('#changeTeamBtn').click(); await page.locator('.team-select-card[data-team="astonmartin"]').click();
  for(const width of [320,390,768,1024,1366,1920,2560,3440]) { await page.setViewportSize({width,height:1080}); await page.locator('.subject-manager summary').click(); assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)); await page.locator('.subject-manager summary').click(); }
  assert.deepEqual(errors,[]); console.log('PASSOU: Aston Martin, mensagens das equipes, estado de energia, foco de seleção e oito larguras.');
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
