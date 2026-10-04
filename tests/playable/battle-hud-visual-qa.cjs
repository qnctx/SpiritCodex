// Fresh profiles only. Exercise the user's file:// launch path and capture real HUD states.
const {chromium}=require('@playwright/test'),fs=require('node:fs'),path=require('node:path');
const output=path.resolve('output/battle-hud-v13');
(async()=>{fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch({channel:'msedge',headless:true}),reports=[];
try{for(const viewport of [{width:1366,height:768},{width:360,height:640}]){
  const label=viewport.width>700?'desktop':'compact',context=await browser.newContext({viewport}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('file:///E:/myProject/SpiritCodex/playable/spirit-codex.html');await page.evaluate(()=>SC.preloadArt());await page.clock.install();await page.clock.pauseAt(Date.now()+1000);
  await page.evaluate(()=>{SC.setTeam([0,1,2,3]);SC.setAutoBattle(false);SC.startBattle();});await page.clock.fastForward(50);
  async function capture(kind){await page.evaluate(()=>drawScene(performance.now()));await page.screenshot({path:path.join(output,label+'-'+kind+'.png')});reports.push({label,kind,errors:[...errors],...await page.evaluate(()=>({mode:document.querySelector('#battle-ui').dataset.mode,phase:state.phase,overflow:document.documentElement.scrollWidth>innerWidth+1,clock:BattleClock.inspect(),canvas:document.querySelector('#battle-canvas').getBoundingClientRect().toJSON(),dock:document.querySelector('#battle-ui').getBoundingClientRect().toJSON(),units:[...state.allies,...state.enemies].map(u=>({name:u.name,rect:u._artRect,hit:u._hit}))}))});}
  await capture('manual');await page.locator('#skill-bar .skill-btn').first().click();await capture('target');await page.locator('#target-chips .tgt').first().click();await page.clock.fastForward(400);await capture('attack');
  await page.locator('#battle-report-btn').click();await capture('report');await page.locator('#battle-report-tab-team').click();await capture('team');await page.locator('#battle-report-tab-log').click();await capture('log');await page.locator('#battle-report-close').click();
  await page.evaluate(()=>SC.setAutoBattle(true));await page.clock.fastForward(1600);await capture('auto');
  await page.evaluate(()=>{returnTown();openBattleLab();});await page.clock.fastForward(50);await capture('lab-expanded');
  await page.locator('#battle-lab-toggle').click();await page.clock.fastForward(32);await capture('lab-collapsed');
  await page.evaluate(()=>SC.BattleLab.prepareAndCast('phoenix'));await page.clock.fastForward(3100);await capture('lab-combo');
  await page.evaluate(()=>closeBattleLab());await context.close();
}fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(reports,null,2));console.log(JSON.stringify(reports.map(({label,kind,errors,mode,phase,overflow,canvas,dock})=>({label,kind,errors,mode,phase,overflow,canvas,dock})),null,2));}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
