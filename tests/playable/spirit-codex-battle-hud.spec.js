const {test,expect}=require('@playwright/test');
async function load(page,lab=false){
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/playable/spirit-codex.html');await page.evaluate(()=>SC.preloadArt());await page.clock.install();await page.clock.pauseAt(Date.now()+1000);
  await page.evaluate(lab=>{SC.setRandomSource(()=>.5);if(lab)openBattleLab();else{SC.setTeam([0,1,2,3]);SC.setAutoBattle(false);SC.startBattle();}},lab);await page.clock.fastForward(50);return errors;
}
async function frame(page){return page.evaluate(()=>{drawScene(performance.now());return {time:BattleClock.now(),paused:BattleClock.paused,phase:state.phase,mode:document.getElementById('battle-ui').dataset.mode,action:BattleMotion.inspect(),units:[...state.allies,...state.enemies].map(u=>({uid:String(u.uid),hp:u.curHp,visual:battleVisual(u),x:u._x,y:u._y,rect:u._artRect}))};});}
async function rect(page,id){return page.locator('#'+id).boundingBox();}
test.afterEach(async({page})=>{await page.evaluate(()=>{BattleHUD.closeReport();if(SC.BattleLab.isActive())closeBattleLab();else if(inBattle)returnTown();});await page.clock.resume();});

test('command dock changes by battle state without moving the stage or hiding actor targets',async({page})=>{
  const errors=await load(page),manual=await frame(page),canvas=await rect(page,'battle-canvas'),dock=await rect(page,'battle-ui');
  expect(manual.mode).toBe('command');await expect(page.locator('#battle-commands')).toBeVisible();await expect(page.locator('#battle-report-modal')).toBeHidden();
  for(const u of manual.units){expect(u.rect.y+u.rect.height+canvas.y,u.uid).toBeLessThan(dock.y);}
  const layout=await page.evaluate(()=>({vw:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth,buttons:[...document.querySelectorAll('#battle-commands button')].filter(n=>n.getClientRects().length).map(n=>({text:n.textContent,rect:n.getBoundingClientRect().toJSON()}))}));
  expect(layout.scroll).toBeLessThanOrEqual(layout.vw);for(const b of layout.buttons){expect(b.rect.left,b.text).toBeGreaterThanOrEqual(0);expect(b.rect.right,b.text).toBeLessThanOrEqual(layout.vw);expect(b.rect.bottom,b.text).toBeLessThanOrEqual(layout.height);expect(b.rect.height,b.text).toBeGreaterThanOrEqual(44);}
  await page.locator('#auto-battle-btn').click();await expect(page.locator('#battle-commands')).toBeHidden();expect((await rect(page,'battle-ui')).height).toBeLessThanOrEqual(60);
  const observed=await frame(page);expect(await rect(page,'battle-canvas')).toEqual(canvas);expect(observed.units.map(u=>[u.x,u.y])).toEqual(manual.units.map(u=>[u.x,u.y]));
  for(let i=0;i<80;i++){if((await frame(page)).phase==='enemy')break;await page.clock.fastForward(100);}
  expect((await frame(page)).phase).toBe('enemy');await expect(page.locator('#battle-commands')).toBeHidden();await expect(page.locator('#combo-battle-btn')).toBeHidden();
  await page.locator('#auto-battle-btn').click();for(let i=0;i<80;i++){if((await frame(page)).mode==='command')break;await page.clock.fastForward(100);}
  expect((await frame(page)).mode).toBe('command');await expect(page.locator('#skill-bar .skill-btn').first()).toBeEnabled();expect(await rect(page,'battle-canvas')).toEqual(canvas);expect(errors).toEqual([]);
});
test('manual targeting replaces the skill grid, cancel restores it, and canvas click hits the chosen enemy once',async({page})=>{
  const errors=await load(page),canvas=await rect(page,'battle-canvas');await page.locator('#skill-bar .skill-btn').first().click();
  await expect(page.locator('#battle-ui')).toHaveAttribute('data-mode','target');await expect(page.locator('#skill-bar')).toBeHidden();await expect(page.locator('#target-chips .tgt')).toHaveCount(4);
  await page.locator('#target-chips .tgt').last().click();await expect(page.locator('#battle-ui')).toHaveAttribute('data-mode','command');await expect(page.locator('#skill-bar .skill-btn').first()).toBeVisible();
  await page.locator('#skill-bar .skill-btn').first().click();const before=await frame(page),enemy=before.units[5];
  await page.mouse.click(canvas.x+enemy.rect.x+enemy.rect.width/2,canvas.y+enemy.rect.y+enemy.rect.height/2);const hit=await frame(page);
  expect(hit.mode).toBe('observe');expect(hit.action.targets.some(t=>t.uid===enemy.uid)).toBe(true);expect(hit.units.find(u=>u.uid===enemy.uid).hp).toBeLessThan(enemy.hp);
  expect(await page.evaluate(()=>document.getElementById('battle-canvas').onclick)).toBeNull();const hp=hit.units.map(u=>u.hp);
  await page.mouse.click(canvas.x+enemy.rect.x+enemy.rect.width/2,canvas.y+enemy.rect.y+enemy.rect.height/2);expect((await frame(page)).units.map(u=>u.hp)).toEqual(hp);expect(errors).toEqual([]);
});
test('opening the report pauses an automatic decision, Escape restores focus and resumes the remaining delay',async({page})=>{
  const errors=await load(page);await page.locator('#auto-battle-btn').click();await page.locator('#battle-speed-btn').click();await page.locator('#battle-report-btn').click();
  const paused=await frame(page);expect(paused.paused).toBe(true);expect(paused.action.active).toBe(false);await expect(page.locator('#battle-report-close')).toBeFocused();
  await page.clock.fastForward(5000);const still=await frame(page);expect(still.time).toBe(paused.time);expect(still.units).toEqual(paused.units);expect(still.action.active).toBe(false);
  await page.keyboard.press('Escape');await expect(page.locator('#battle-report-modal')).toBeHidden();await expect(page.locator('#battle-report-btn')).toBeFocused();expect(await page.evaluate(()=>({auto:autoBattle,rate:BattleClock.rate,paused:BattleClock.paused}))).toEqual({auto:true,rate:2,paused:false});
  await page.clock.fastForward(179);expect((await frame(page)).action.active).toBe(false);await page.clock.fastForward(1);expect((await frame(page)).action.active).toBe(true);expect(errors).toEqual([]);
});
test('mid-skill report freezes choreography and HP at x2; continuing does not apply damage twice',async({page})=>{
  const errors=await load(page,true);await page.evaluate(()=>{SC.BattleLab.selectCharacter('H1');SC.BattleLab.prepareSkillTest();SC.setBattleSpeed(2);SC.BattleLab.useSkill(2);});const begin=await frame(page);
  await page.clock.fastForward(300);await page.evaluate(()=>BattleHUD.openReport());const paused=await frame(page);expect(paused.action.active).toBe(true);expect(paused.action.targets.find(t=>t.before.isEnemy).contacts).toHaveLength(3);
  await page.clock.fastForward(7000);const still=await frame(page);expect(still.time).toBe(paused.time);expect(still.action.time).toBe(paused.action.time);expect(still.units).toEqual(paused.units);
  await page.locator('#battle-report-close').click();await page.clock.fastForward(Math.ceil((begin.action.duration-600)/2)+120);const ended=await frame(page);expect(ended.phase).toBe('player');expect(ended.action.active).toBe(false);expect(ended.units.map(u=>u.hp)).toEqual(begin.units.map(u=>u.hp));
  await page.clock.fastForward(5000);expect((await frame(page)).units.map(u=>u.hp)).toEqual(ended.units.map(u=>u.hp));expect(errors).toEqual([]);
});
test('real phoenix and dragon combos pause the environment with the performance and consume only one item',async({page})=>{
  test.setTimeout(60000);const errors=await load(page,true);await page.evaluate(()=>SC.setBattleSpeed(2));
  for(const id of ['phoenix','leviathan']){
    expect(await page.evaluate(id=>SC.BattleLab.prepareAndCast(id),id)).toBe(true);await page.clock.fastForward(1600);await page.evaluate(()=>BattleHUD.openReport());
    const snapshot=()=>page.evaluate(()=>{drawScene(performance.now());return {time:BattleClock.now(),elapsed:LiveCombo.current.elapsed,environment:ComboEnvironment.battleFrame(BattleClock.now()),casts:state.run.comboCasts,hp:state.enemies.map(u=>battleVisual(u).hp)};});
    const before=await snapshot();await page.clock.fastForward(5000);expect(await snapshot()).toEqual(before);expect(before.elapsed).toBe(3200);
    await page.locator('#battle-report-close').click();await page.clock.fastForward(2599);expect(await page.evaluate(()=>!!LiveCombo.current)).toBe(true);await page.clock.fastForward(1);expect(await page.evaluate(()=>LiveCombo.current)).toBeNull();await page.clock.fastForward(600);
    expect(await page.evaluate(id=>({casts:state.run.comboCasts,item:state.progression.inventory[SC.COMBO_RECIPES.find(r=>r.id===id).itemId],phase:state.phase,environment:ComboEnvironment.battleFrame(BattleClock.now())}),id)).toEqual({casts:1,item:2,phase:'player',environment:null});
  }expect(errors).toEqual([]);
});
test('report tabs give readable named order, vitals and six records without overflowing or mutating battle',async({page})=>{
  const errors=await load(page);await page.evaluate(()=>{for(let i=1;i<=7;i++)pushLog('测试记录 '+i);});await page.locator('#battle-report-btn').click();
  const paused=await frame(page);await expect(page.locator('#turn-order .turn-order-name')).toHaveCount(7);await expect(page.locator('#turn-order .on')).toContainText('当前');
  await page.locator('#battle-report-tab-intel').focus();await page.keyboard.press('ArrowRight');await expect(page.locator('#battle-report-tab-team')).toBeFocused();await expect(page.locator('#battle-team-details')).toBeVisible();await expect(page.locator('#team-status .member-vitals').first()).toContainText('生命');
  await page.keyboard.press('End');await expect(page.locator('#battle-log-details')).toBeVisible();await expect(page.locator('#log b')).toHaveCount(6);await expect(page.locator('#log b').first()).toHaveText('测试记录 2');
  for(const tab of ['intel','team','log']){await page.locator('#battle-report-tab-'+tab).click();const sizes=await page.evaluate(()=>[document.getElementById('battle-report-modal'),document.querySelector('.battle-report-body'),...document.querySelectorAll('[data-report-panel]:not([hidden]) *')].filter(n=>n.clientWidth).map(n=>({name:n.className||n.id,w:n.clientWidth,s:n.scrollWidth})));sizes.forEach(n=>expect(n.s,n.name).toBeLessThanOrEqual(n.w+1));}
  expect((await frame(page)).units).toEqual(paused.units);expect(errors).toEqual([]);
});
test('rapid close and reopen retains pause ownership; leaving battle clears the modal and cannot stall the next battle',async({page})=>{
  const errors=await load(page);await page.evaluate(()=>{SC.setAutoBattle(true);BattleHUD.openReport();BattleHUD.closeReport();BattleHUD.openReport('team');});const paused=await frame(page);
  await page.clock.fastForward(5000);expect((await frame(page)).time).toBe(paused.time);expect(await page.evaluate(()=>BattleClock.paused)).toBe(true);
  await page.evaluate(()=>returnTown());await expect(page.locator('#battle-report-modal')).toBeHidden();expect(await page.evaluate(()=>BattleClock.paused)).toBe(false);
  await page.evaluate(()=>{SC.setAutoBattle(true);startBattle();});await page.clock.fastForward(370);expect((await frame(page)).action.active).toBe(true);expect(errors).toEqual([]);
});
test('manual feedback and urgent threats remain visible and test tools expose the same report',async({page})=>{
  const errors=await load(page,true);await page.locator('#battle-lab-tab-tools').click();await page.locator('#battle-lab-report').click();await expect(page.locator('#battle-report-modal')).toBeVisible();await page.locator('#battle-report-close').click();
  await page.evaluate(()=>{closeBattleLab();SC.setTeam([0,1,2,3]);SC.setAutoBattle(false);startBattle();});await page.clock.fastForward(50);
  const nested=await page.evaluate(()=>{currentPlayerActor().energy=100;const fusion=openFusion(),report=BattleHUD.openReport(),paused=BattleClock.paused;closeFusion();return {fusion,report,paused};});expect(nested).toEqual({fusion:true,report:false,paused:false});
  await page.evaluate(()=>setTip('该技能当前无法生效，请选择其他技能'));await expect(page.locator('#target-tip')).toBeVisible();await expect(page.locator('#target-tip')).toContainText('无法生效');
  await page.evaluate(()=>{state.enemies[0].charging={skillIndex:1,turns:1};updateHUD();});await expect(page.locator('#battle-threat')).toBeVisible();await page.locator('#battle-threat').click();await expect(page.locator('#enemy-intents')).toBeVisible();expect(await page.evaluate(()=>BattleClock.paused)).toBe(true);expect(errors).toEqual([]);
});
