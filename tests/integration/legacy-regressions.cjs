const assert = require('node:assert/strict');
const {launch} = require('../browser.cjs');
const URL = process.env.BASE_URL || 'http://127.0.0.1:8000/';
async function read(p) { return p.evaluate(async()=>document.documentElement.dataset.appReady === 'true'
 ? (await (await import('/js/infrastructure/repositories/studyRepository.js')).readSnapshot()).store
 : JSON.parse(localStorage.getItem('silverArrowPomodoro2026'))); }
async function boot(ctx) {
 const p=await ctx.newPage();await p.clock.install();await p.goto(URL,{waitUntil:'networkidle'});if(!process.env.EXPECT_LEGACY)await require('../browser.cjs').ready(p);
 await p.locator('.team-select-card').first().waitFor({state:'visible'}).catch(()=>{});
 if(await p.locator('#teamSelectOverlay').isVisible())await p.locator('.team-select-card[data-team="mercedes"]').click();
 await p.locator('.circuit-row').first().waitFor();return p;
}
async function finish(p) {await p.locator('.circuit-row').first().click();await p.locator('#startBtn').click();await p.clock.fastForward(1500000);await p.locator('#ratingPanel').waitFor({state:'visible'});}
(async()=>{const b=await launch();let failures=0;
try {
 for(const name of ['recarregar preserva avaliação pendente','abas preservam duas voltas e duas avaliações']) {
  const ctx=await b.newContext();try {
   const p=await boot(ctx);
   if(name.startsWith('recarregar')) {await finish(p);await p.reload({waitUntil:'networkidle'});if(!process.env.EXPECT_LEGACY)await require('../browser.cjs').ready(p);assert.ok(await p.locator('#ratingPanel').isVisible(),'formulário de avaliação deve ser recuperado');}
   else {const q=await ctx.newPage();await q.clock.install();await q.goto(URL,{waitUntil:'networkidle'});if(!process.env.EXPECT_LEGACY)await require('../browser.cjs').ready(q);await q.locator('.circuit-row').first().waitFor();await Promise.all([finish(p),finish(q)]);await Promise.all([p,q].map(async t=>{await t.locator('#ratingSubmit').click();await t.locator('#ratingPanel').waitFor({state:'hidden'})}));const data=await read(p);assert.equal(data.laps,2);assert.equal(data.sessions.length,2);assert.equal(data.totalSeconds,3000);}
   console.log('PASS:',name);
  } catch(error) {failures++;console.log('FAIL:',name,'—',error.message)} finally {await ctx.close()}
 }
}finally{await b.close()}
if(failures)process.exitCode=1;
})();
