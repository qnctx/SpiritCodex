const {chromium}=require('@playwright/test');
const fs=require('fs');
const path=require('path');
const quick=process.argv.includes('--quick');
const output=path.resolve(quick?'output/live-battle-v10-final':'output/live-battle-v10');fs.mkdirSync(output,{recursive:true});
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const reports=[];
  try{
    for(const viewport of [{width:1366,height:768},{width:360,height:640}]){
      const label=viewport.width>700?'desktop':'compact',context=await browser.newContext({viewport});
      const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.goto('file:///E:/myProject/SpiritCodex/playable/spirit-codex.html');
      await page.evaluate(()=>SC.preloadArt());
      await page.clock.install();await page.clock.pauseAt(Date.now()+1000);
      await page.locator('#open-battle-lab-title').click();
      await page.screenshot({path:path.join(output,`${label}-lab.png`)});
      for(const id of quick?['phoenix','leviathan']:['phoenix','leviathan','bastion','spring','eclipse','legion']){
        await page.evaluate(async id=>{await SC.BattleLab.prepareAndCast(id);},id);
        if(label==='compact'&&await page.locator('#battle-lab-toggle').getAttribute('aria-expanded')==='true')await page.locator('#battle-lab-toggle').click();
        let elapsed=0;
        for(const [stage,time]of [['charge',950],['manifest',2500],['attack',4400],['impact',5150]]){
          await page.clock.runFor(time-elapsed);elapsed=time;
          await page.screenshot({path:path.join(output,`${label}-${id}-${stage}.png`)});
        }
        reports.push(await page.evaluate(({label,id})=>{
          const canvas=document.querySelector('#battle-canvas'),live=LiveCombo.current;
          const units=[...SC.state.allies,...SC.state.enemies].map(u=>({uid:u.uid,body:u._artRect,hud:u._hud,hp:u._visual?.hp,actual:u.curHp}));
          return {label,id,canvas:{width:canvas.clientWidth,height:canvas.clientHeight},live:!!live,targets:live?.geometry.targets.map(t=>({uid:t.uid,role:t.role,start:t.start,end:t.end,ground:t.ground})),units,overflow:document.documentElement.scrollWidth>innerWidth};
        },{label,id}));
        await page.locator('#live-combo-skip').click();await page.clock.runFor(150);
      }
      await page.evaluate(()=>{SC.BattleLab.prepareCombo('bastion');SC.BattleLab.useSkill(0);});
      await page.clock.runFor(350);await page.screenshot({path:path.join(output,`${label}-normal-action.png`)});
      await page.evaluate(()=>closeBattleLab());
      reports.push({label,errors});await context.close();
    }
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(reports,null,2));
    console.log(JSON.stringify(reports.filter(r=>r.errors||r.overflow),null,2));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
