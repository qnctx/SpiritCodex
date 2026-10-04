// Separate, disposable contexts: never reads or mutates the player's browser profile.
const {chromium}=require('@playwright/test'),fs=require('node:fs'),path=require('node:path');
const output=path.resolve('output/battle-ux-v12');
(async()=>{fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch({channel:'msedge',headless:true}),reports=[];
try{for(const viewport of [{width:1366,height:768},{width:360,height:640}]){
  const label=viewport.width>700?'desktop':'compact',context=await browser.newContext({viewport}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('file:///E:/myProject/SpiritCodex/playable/spirit-codex.html');await page.evaluate(()=>SC.preloadArt());await page.clock.install();await page.clock.pauseAt(Date.now()+1000);
  await page.locator('#open-battle-lab-title').click();await page.locator('#battle-lab-tab-skills').click();
  await page.selectOption('#battle-lab-character','A1');await page.locator('#battle-lab-skill-prepare').click();await page.locator('#battle-lab-speed').click();await page.evaluate(()=>SC.BattleLab.useSkill(1));await page.clock.fastForward(2400);await page.evaluate(()=>drawScene(performance.now()));
  await page.locator('#battle-lab-skill-prepare').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,label+'-skills.png')});
  await page.locator('#battle-lab-toggle').click();await page.clock.fastForward(32);await page.evaluate(()=>drawScene(performance.now()));await page.screenshot({path:path.join(output,label+'-eagle.png')});
  reports.push({label,kind:'pet',...await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,rate:BattleClock.rate,pet:SC.state.allies.filter(u=>u.isSummon).map(u=>({facing:u._facing,rect:u._artRect})),canvas:document.querySelector('#battle-canvas').getBoundingClientRect().toJSON(),panel:document.querySelector('#battle-lab-panel').getBoundingClientRect().toJSON()}))});
  await page.evaluate(()=>SC.BattleLab.prepareAndCast('phoenix'));await page.clock.fastForward(2550);await page.evaluate(()=>drawScene(performance.now()));await page.screenshot({path:path.join(output,label+'-combo-x2.png')});
  await page.evaluate(()=>{closeBattleLab();SC.setTeam([0,1,2,3]);SC.setAutoBattle(false);startBattle();});await page.clock.fastForward(50);await page.locator('#battle-speed-btn').click();await page.screenshot({path:path.join(output,label+'-battle.png')});
  await page.locator('#battle-settings summary').click();await page.screenshot({path:path.join(output,label+'-settings.png')});
  reports.push({label,kind:'formal',errors,...await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,rate:BattleClock.rate,canvas:document.querySelector('#battle-canvas').getBoundingClientRect().toJSON(),top:document.querySelector('.battle-top-actions').getBoundingClientRect().toJSON()}))});
  await page.evaluate(()=>returnTown());await page.screenshot({path:path.join(output,label+'-town.png')});await context.close();
}fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(reports,null,2));console.log(JSON.stringify(reports,null,2));}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
