const {chromium}=require('@playwright/test');
const fs=require('fs'),path=require('path');
const output=path.resolve('output/skill-performance-v11');fs.mkdirSync(output,{recursive:true});
const shots=[['H1',0,.45,'arrow'],['H1',1,.54,'pierce'],['H1',2,.65,'rain'],['H1',3,.53,'meteor'],['H2',2,.51,'charge'],['W1',1,.67,'spring'],['T2',2,.70,'chain'],['D2',3,.62,'gate']];
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true}),reports=[];
  try{
    for(const viewport of [{width:1366,height:768},{width:360,height:640}]){
      const label=viewport.width>700?'desktop':'compact',context=await browser.newContext({viewport}),page=await context.newPage(),errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto('file:///E:/myProject/SpiritCodex/playable/spirit-codex.html');await page.evaluate(()=>SC.preloadArt());
      await page.clock.install();await page.clock.pauseAt(Date.now()+1000);await page.locator('#open-battle-lab-title').click();
      await page.locator('#battle-lab-tab-skills').click();
      await page.locator('#battle-lab-enemy-target').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,`${label}-controls.png`)});
      if(label==='compact')await page.locator('#battle-lab-toggle').click();
      for(const [id,index,p,name]of shots){
        await page.evaluate(id=>{SC.BattleLab.selectCharacter(id);SC.BattleLab.prepareSkillTest();SC.BattleLab.selectTestTarget('enemy',SC.state.enemies[1].uid);},id);
        await page.clock.fastForward(32);await page.evaluate(index=>SC.BattleLab.useSkill(index),index);
        const action=await page.evaluate(()=>BattleMotion.inspect());await page.clock.fastForward(action.duration*p);
        await page.evaluate(()=>drawScene(performance.now()));
        await page.screenshot({path:path.join(output,`${label}-${name}.png`)});
        const frame=await page.evaluate(()=>({action:BattleMotion.inspect(),overflow:document.documentElement.scrollWidth>innerWidth+1,
          units:[...SC.state.allies,...SC.state.enemies].map(u=>({uid:String(u.uid),rect:u._artRect,visual:u._visual,hud:u._hud}))}));
        reports.push({label,name,...frame});await page.clock.fastForward(action.duration*(1-p)+200);
      }
      // Resume RAF scheduling as a liveness smoke check; this is not a hardware FPS benchmark.
      await page.clock.resume();const performanceSample=await page.evaluate(()=>new Promise(resolve=>{
        const times=[];let previous=performance.now();const sample=now=>{times.push(now-previous);previous=now;if(times.length===45)resolve({median:times.sort((a,b)=>a-b)[22],p90:times[40]});else requestAnimationFrame(sample);};requestAnimationFrame(sample);
      }));
      reports.push({label,errors,performanceSample});await context.close();
    }
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(reports,null,2));console.log(JSON.stringify(reports.filter(r=>r.errors||r.overflow),null,2));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
