const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const b=await require('./browser.cjs').launch();
 try{
 const p=await b.newPage();const errors=[],failed=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)failed.push(r.url())});
 await p.clock.install();await p.goto(process.env.BASE_URL || 'http://127.0.0.1:8000/',{waitUntil:'networkidle'});await require('./browser.cjs').ready(p);
 const screens=[[3440,1440],[2560,1440],[1920,1080],[1366,768],[1024,768],[768,1024],[390,844],[320,740]];
 for(const team of ['astonmartin','mercedes','ferrari','mclaren','alpine','redbull']){
  if(team!=='astonmartin')await p.locator('#changeTeamBtn').click();
  await p.locator(`.team-select-card[data-team="${team}"]`).click();await p.waitForLoadState('networkidle');
  await p.locator('.circuit-row').first().click();
  for(const [width,height] of screens){
   await p.setViewportSize({width,height});
   const geometry=await p.evaluate(()=>{
    const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};
    return{width:document.documentElement.scrollWidth,hero:rect('.session-panel'),track:rect('.trackview'),timer:rect('.timer-block'),calendar:rect('.picker-panel'),cards:[...document.querySelectorAll('.dashboard > section')].map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}})};
   });
   assert.ok(geometry.width<=width,`${team} overflow ${width}: ${geometry.width}`);
   assert.ok(geometry.track.h>=270 && geometry.track.w>=230,`${team} track too small ${width}`);
   if(width>=1100)assert.ok(geometry.hero.w>geometry.calendar.w*1.5,`${team} hero priority ${width}`);
   for(let i=0;i<geometry.cards.length;i++)for(let j=i+1;j<geometry.cards.length;j++){
    const a=geometry.cards[i],c=geometry.cards[j];assert.ok(a.right<=c.x+1||c.right<=a.x+1||a.bottom<=c.y+1||c.bottom<=a.y+1,`${team} overlapping cards ${width}`);
   }
   assert.ok(await p.locator('.controls button').evaluateAll(es=>es.every(e=>e.scrollWidth<=e.clientWidth+1)),`${team} controls ${width}`);
   assert.ok(await p.locator('.circuit-shortcut').isVisible());
   if(team==='astonmartin'&&[3440,1920,768,390].includes(width))await p.screenshot({path:require('./browser.cjs').screenshot(`layout-${width}.png`),fullPage:true});
  }
  await p.locator('[data-mode="qualy"]').click();await p.locator('#startBtn').click();await p.clock.fastForward(300000);
  await p.locator('#ratingPanel').waitFor({state:'visible'});assert.ok(await p.locator('#ratingPanel').isVisible());await p.locator('#ratingSubmit').click();await p.locator('#ratingPanel').waitFor({state:'hidden'});await p.locator('#resetBtn').click();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 console.log('PASSOU: 48 combinações de equipe/tela, pista grande, hierarquia, cards sem sobreposição, controles e avaliação por volta.');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
