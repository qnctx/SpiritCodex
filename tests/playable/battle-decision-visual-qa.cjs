const {chromium}=require('@playwright/test'),fs=require('node:fs'),path=require('node:path');
const output=path.resolve('output/battle-decision-v14');
(async()=>{fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch({channel:'msedge',headless:true}),reports=[];
try{for(const viewport of [{width:1366,height:768},{width:360,height:640}]){
  const name=viewport.width>700?'desktop':'compact',context=await browser.newContext({viewport}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('file:///E:/myProject/SpiritCodex/playable/spirit-codex.html');await page.evaluate(()=>SC.preloadArt());await page.clock.install();await page.clock.pauseAt(Date.now()+1000);
  async function advance(ms){for(let t=0;t<ms;t+=100)await page.clock.fastForward(Math.min(100,ms-t));}
  async function scenario(kind){if(!await page.evaluate(kind=>SC.BattleLab.prepareBossScenario(kind),kind))throw new Error('Scenario not prepared: '+kind);await page.clock.fastForward(32);}
  async function shot(label){await page.evaluate(()=>drawScene(performance.now()));await page.screenshot({path:path.join(output,name+'-'+label+'.png')});reports.push({name,label,errors:[...errors],...await page.evaluate(()=>({preview:BattleDecision.current(),mode:document.getElementById('battle-ui').dataset.mode,overflow:document.documentElement.scrollWidth>innerWidth+1,dock:document.getElementById('battle-ui').getBoundingClientRect().toJSON()}))});}
  await page.evaluate(()=>{SC.setTeam([0,1,2,3]);SC.setAutoBattle(false);startBattle();});await page.clock.fastForward(50);await page.locator('#skill-bar .skill-btn').nth(2).click();await shot('aoe-preview');await page.locator('#target-chips .tgt').last().click();
  await page.evaluate(()=>{returnTown();openBattleLab();SC.BattleLab.prepareBossScenario('interrupt');});await page.locator('#battle-lab-toggle').click();await page.clock.fastForward(32);await page.locator('#skill-bar .skill-btn').nth(2).click();await shot('boss-control');
  await page.locator('#target-chips .tgt').last().click();await scenario('guard');await page.locator('#skill-bar .skill-btn').nth(1).click();await shot('boss-shield');await page.locator('.target-confirm').click();await advance(4000);await page.evaluate(()=>SC.BattleLab.enemyStep());await advance(5000);await shot('boss-window');
  await scenario('opportunity');await shot('auto-opportunity');await page.locator('#combo-opportunity').click();await advance(5000);await shot('combo-takeover');
  await page.evaluate(()=>closeBattleLab());await context.close();
}fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(reports,null,2));console.log(JSON.stringify(reports.map(({name,label,errors,overflow,mode})=>({name,label,errors,overflow,mode})),null,2));}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
