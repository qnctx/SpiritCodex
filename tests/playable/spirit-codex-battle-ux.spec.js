const {test,expect}=require('@playwright/test');
async function load(page){const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/playable/spirit-codex.html');await page.evaluate(()=>SC.preloadArt());await page.clock.install();await page.clock.pauseAt(Date.now()+1000);await page.evaluate(()=>openBattleLab());await page.clock.fastForward(32);return errors;}
async function frame(page){return page.evaluate(()=>{drawScene(performance.now());return {action:BattleMotion.inspect(),phase:SC.state.phase,clock:BattleClock.inspect(),units:[...SC.state.allies,...SC.state.enemies].map(u=>({uid:String(u.uid),hp:u.curHp,visual:u._visual,facing:u._facing,rect:u._artRect}))};});}
test.afterEach(async({page})=>{await page.evaluate(()=>{if(window.SC?.BattleLab?.isActive())closeBattleLab();});await page.clock.resume();});
test('switching x2 during arrow rain keeps phase continuous, all three contacts, and exact once-only outcome',async({page})=>{
  const errors=await load(page);await page.evaluate(()=>{SC.BattleLab.selectCharacter('H1');SC.BattleLab.prepareSkillTest();SC.BattleLab.useSkill(2);});
  const initial=await frame(page),target=initial.action.targets.find(t=>t.before.isEnemy);expect(target.contacts).toHaveLength(3);
  await page.clock.fastForward(500);const before=await frame(page);await page.locator('#battle-lab-speed').click();const after=await frame(page);
  expect(after.clock.rate).toBe(2);expect(after.action.time).toBeCloseTo(before.action.time,3);expect(after.action.token).toBe(initial.action.token);
  let age=500;for(const beat of target.contacts){const at=beat.at-initial.action.start;await page.clock.fastForward((at-5-age)/2);age=at-5;const pre=await frame(page);expect(pre.units.find(u=>u.uid===target.uid).visual.hp).toBeGreaterThan(beat.event.hpAfter);
    await page.clock.fastForward(100);age+=200;const hit=await frame(page);expect(hit.units.find(u=>u.uid===target.uid).visual.hp).toBe(beat.event.hpAfter);}
  // Slow down again for only the remaining animation, not a restarted skill.
  await page.locator('#battle-lab-speed').click();const restored=await frame(page);expect(restored.clock.rate).toBe(1);expect(restored.action.token).toBe(initial.action.token);
  await page.clock.fastForward(initial.action.duration-age+200);expect((await frame(page)).phase).toBe('player');
  const hp=await page.evaluate(()=>SC.state.enemies.map(u=>u.curHp));await page.clock.fastForward(10000);expect(await page.evaluate(()=>SC.state.enemies.map(u=>u.curHp))).toEqual(hp);expect(errors).toEqual([]);
});
test('all six real combos finish in 4.2 seconds at x2 with synchronized environment and one item expense',async({page})=>{
  test.setTimeout(90000);const errors=await load(page);await page.locator('#battle-lab-speed').click();
  for(const id of ['phoenix','leviathan','bastion','spring','eclipse','legion']){
    expect(await page.evaluate(id=>SC.BattleLab.prepareAndCast(id),id)).toBe(true);await page.clock.fastForward(1600);
    const cast=await page.evaluate(()=>{drawScene(performance.now());return {elapsed:LiveCombo.current.elapsed,env:ComboEnvironment.battleFrame(BattleClock.now()),motion:LiveCombo.current.motion,targets:LiveCombo.current.targets.map(t=>({before:t.hpBefore,visual:LiveCombo.pose([...SC.state.allies,...SC.state.enemies].find(u=>u.uid===t.uid)).hp})),casts:SC.state.run.comboCasts};});
    expect(cast.elapsed).toBeCloseTo(3200,0);expect(cast.env).toBeTruthy();expect(cast.casts).toBe(1);cast.targets.forEach(t=>expect(t.visual).toBe(t.before));
    await page.clock.fastForward(1250);const hit=await page.evaluate(()=>{drawScene(performance.now());return {elapsed:LiveCombo.current.elapsed,targets:LiveCombo.current.targets.map(t=>({before:t.hpBefore,after:t.hpAfter,visual:LiveCombo.pose([...SC.state.allies,...SC.state.enemies].find(u=>u.uid===t.uid)).hp}))};});
    expect(hit.elapsed).toBeCloseTo(5700,0);expect(hit.targets.some(t=>t.visual!==t.before||t.after===t.before)).toBe(true);
    await page.clock.fastForward(1340);expect(await page.evaluate(()=>!!LiveCombo.current)).toBe(true);await page.clock.fastForward(10);expect(await page.evaluate(()=>LiveCombo.current)).toBeNull();
    await page.clock.fastForward(600);const result=await page.evaluate(id=>({casts:SC.state.run.comboCasts,item:SC.progression.inventory[SC.COMBO_RECIPES.find(r=>r.id===id).itemId],phase:SC.state.phase,env:ComboEnvironment.battleFrame(BattleClock.now())}),id);
    expect(result).toEqual({casts:1,item:2,phase:'player',env:null});
  }expect(errors).toEqual([]);
});
test('wind eagle artwork and beak use the same mirror while summoning, attacking and being hit',async({page})=>{
  const errors=await load(page);await page.evaluate(()=>{SC.BattleLab.selectCharacter('A1');SC.BattleLab.prepareSkillTest();SC.BattleLab.useSkill(1);});const birth=await page.evaluate(()=>BattleMotion.inspect());
  await page.clock.fastForward(birth.duration+150);const pet=await page.evaluate(()=>{drawScene(performance.now());const u=SC.state.allies.find(u=>u.isSummon);return {uid:String(u.uid),art:u.art,facing:u._facing};});
  expect(pet.art).toContain('wind-eagle');expect(pet.facing).toMatchObject({facing:1,sourceFacing:-1,mirror:-1});
  const action=await page.evaluate(()=>{const u=SC.state.allies.find(u=>u.isSummon);SC.state.turnOrder=[u];SC.state.curIdx=0;SC.state.phase='anim';u._acted=false;summonAction(u);return BattleMotion.inspect();});
  await page.clock.fastForward(300);const release=await frame(page);expect(release.units.find(u=>u.uid===pet.uid).facing.mirror).toBe(-1);expect(release.action.targets[0].end.x).toBeGreaterThan(release.action.targets[0].start.x);
  const transforms=await page.evaluate(()=>{
    const u=SC.state.allies.find(u=>u.isSummon),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d'),signs=[],draw=ctx.drawImage;
    ctx.drawImage=function(...args){if(args[0]===loadedArt(u.art)){const m=this.getTransform();signs.push(Math.sign(m.a*m.d-m.b*m.c));}return draw.apply(this,args);};
    BattleMotion.drawActor(ctx,u,{x:10,y:10,width:100,height:100},BattleClock.now(),loadedArt);return signs;
  });expect(transforms.length).toBeGreaterThan(20);expect(new Set(transforms)).toEqual(new Set([-1]));
  await page.clock.fastForward(action.duration);await page.evaluate(()=>{
    const pet=SC.state.allies.find(u=>u.isSummon),enemy=SC.state.enemies[0];pet.curHp=pet.maxHp;enemy._acted=false;enemy.plannedIntent={...planEnemyIntent(enemy),skillIndex:0,chargeTurns:0,isRelease:false,targetUid:pet.uid};SC.state.turnOrder=[enemy];SC.state.curIdx=0;SC.state.phase='enemy';enemyAction(enemy);
  });const incoming=await page.evaluate(()=>BattleMotion.inspect());await page.clock.fastForward(incoming.impactAt-incoming.start+40);const hit=await frame(page);expect(hit.units.find(u=>u.uid===pet.uid).facing.mirror).toBe(-1);expect(errors).toEqual([]);
});
test('category tabs isolate controls without changing battle state; prepare preserves target lane; lab speed never leaks',async({page})=>{
  const errors=await load(page);const formal=await page.evaluate(()=>localStorage.getItem(SC.PROGRESSION_RULES.saveKey));await page.locator('#battle-lab-speed').click();
  const stateBefore=await page.evaluate(()=>JSON.stringify(SC.snapshot(),(k,v)=>/^_(x|y|r|hit|artHeight|artWidth|artRect|visual|hud|facing)$/.test(k)?undefined:v));
  for(const id of ['skills','tools','combos']){await page.locator('#battle-lab-tab-'+id).click();await expect(page.locator('[data-lab-panel]:visible')).toHaveCount(1);await expect(page.locator('#battle-lab-page-'+id)).toBeVisible();expect(await page.evaluate(()=>JSON.stringify(SC.snapshot(),(k,v)=>/^_(x|y|r|hit|artHeight|artWidth|artRect|visual|hud|facing)$/.test(k)?undefined:v))).toBe(stateBefore);}
  await page.evaluate(()=>{SC.BattleLab.selectCharacter('H1');SC.BattleLab.selectTestTarget('enemy',SC.state.enemies[1].uid);SC.BattleLab.prepareSkillTest();});
  expect(await page.locator('#battle-lab-enemy-target').inputValue()).toBe(await page.evaluate(()=>String(SC.state.enemies[1].uid)));
  await page.locator('#battle-lab-toggle').click();await expect(page.locator('.battle-lab-tabs')).toBeHidden();await expect(page.locator('#battle-lab-speed')).toBeVisible();
  expect(await page.evaluate(()=>BattleClock.rate)).toBe(2);await page.locator('#battle-lab-close').click();expect(await page.evaluate(()=>BattleClock.rate)).toBe(1);expect(await page.evaluate(()=>localStorage.getItem(SC.PROGRESSION_RULES.saveKey))).toBe(formal);expect(errors).toEqual([]);
});
test('formal battle speed stays clickable, report pauses battle, boss warnings remain exposed, and UI has no horizontal overflow',async({page})=>{
  const errors=await load(page);await page.evaluate(()=>{closeBattleLab();SC.setTeam([0,1,2,3]);showScreen('formation-screen');SC.setAutoBattle(false);SC.startBattle();});await page.clock.fastForward(50);
  await expect(page.locator('#battle-speed-btn')).toBeVisible();await expect(page.locator('#battle-report-modal')).toBeHidden();await expect(page.locator('#battle-team-details')).toBeHidden();
  await page.locator('#battle-speed-btn').click();expect(await page.evaluate(()=>BattleClock.rate)).toBe(2);
  await page.locator('#battle-settings summary').click();await expect(page.locator('#battle-auto-strategy-select')).toBeVisible();await page.locator('#battle-auto-strategy-select').selectOption('steady');await page.locator('#battle-settings summary').click();
  await page.evaluate(()=>{SC.state.enemies[0].charging={skillIndex:1,turns:1};updateHUD();});await expect(page.locator('#battle-intel-summary')).toContainText('正在蓄力');
  await page.locator('#battle-threat').click();await expect(page.locator('#enemy-intents')).toBeVisible();expect(await page.evaluate(()=>BattleClock.paused)).toBe(true);
  const layout=await page.evaluate(()=>{const ids=['battle-screen','battle-ui','battle-intel','enemy-intents'];return ids.map(id=>{const n=document.getElementById(id);return {id,width:n.clientWidth,scroll:n.scrollWidth};});});layout.forEach(n=>expect(n.scroll,n.id).toBeLessThanOrEqual(n.width+1));
  await page.locator('#battle-report-close').click();expect(await page.evaluate(()=>BattleClock.paused)).toBe(false);
  const rects=await page.evaluate(()=>{const a=document.querySelector('.battle-top-actions').getBoundingClientRect(),b=document.querySelector('#battle-canvas').getBoundingClientRect();return {a:a.bottom,b:b.top};});expect(rects.a).toBeLessThanOrEqual(rects.b+1);expect(errors).toEqual([]);
});
test('particle trajectories are game-time based and health ticks retain existing HUD image nodes',async({page})=>{
  const errors=await load(page);const result=await page.evaluate(()=>{
    const u=SC.state.allies[0],node=document.querySelector('#team-status .member img');updateHUD();u.curHp-=10;updateHUD();const same=node===document.querySelector('#team-status .member img');
    const ctx=document.createElement('canvas').getContext('2d'),seed={x:10,y:20,ox:10,oy:20,vx:2,vy:-2,life:1,color:'#fff',bornAt:100};
    SC.state.particles=[{...seed}];SC.state.floats=[];for(let t=100;t<=400;t+=10)drawParticles(ctx,t);const a={...SC.state.particles[0]};
    SC.state.particles=[{...seed}];drawParticles(ctx,400);const b={...SC.state.particles[0]};return {same,a,b,validation:SC.validateGameData()};
  });expect(result.same).toBe(true);expect(result.a).toEqual(result.b);expect(result.validation).toBe(true);expect(errors).toEqual([]);
});
test('automatic battle waits and actions run twice as fast without changing seeded decisions or rule outcomes',async({page})=>{
  const errors=await load(page),outcomes=[];
  for(const rate of [1,2]){
    await page.evaluate(rate=>{SC.BattleLab.prepareCombo('phoenix');SC.setRandomSource(()=>.5);SC.setBattleSpeed(rate);SC.BattleLab.setAutomatic(true);},rate);
    // Playwright fastForward truncates fractional milliseconds: use boundaries
    // divisible by both rates so 179.5 + 0.5 cannot accidentally become 179 + 0.
    await page.clock.fastForward(358/rate);expect(await page.evaluate(()=>BattleMotion.inspect().active)).toBe(false);
    await page.clock.fastForward(2/rate);const started=await page.evaluate(()=>({action:BattleMotion.inspect(),result:{actor:SC.state.turnOrder[SC.state.curIdx].characterId,enemies:SC.state.enemies.map(u=>({hp:u.curHp,shield:u.shield})),heroes:SC.state.allies.map(u=>({id:u.characterId,hp:u.curHp,energy:u.energy,cooldowns:u.cooldowns})),inventory:{...SC.progression.inventory}}}));
    expect(started.action.active,JSON.stringify(await page.evaluate(()=>({phase:state.phase,auto:autoBattle,actor:state.turnOrder[state.curIdx]?.name,clock:BattleClock.inspect(),modal:state.run?.pendingDecision,log:state.log,token:autoDecisionToken,lab:state.training})))+' rate='+rate).toBe(true);outcomes.push({skill:started.action.skill.name,...started.result});
    await page.clock.fastForward((started.action.duration-2)/rate);expect((await frame(page)).action.active).toBe(true);await page.clock.fastForward(2/rate);expect((await frame(page)).action.active).toBe(false);
    await page.evaluate(()=>SC.BattleLab.setAutomatic(false));
  }expect(outcomes[0]).toEqual(outcomes[1]);expect(errors).toEqual([]);
});
test('town foreground shows only playable destinations; planned buildings are folded and cannot masquerade as working features',async({page})=>{
  const errors=await load(page);await page.evaluate(()=>{closeBattleLab();showScreen('town-screen');});
  await expect(page.locator('#town-screen .town-building:visible')).toHaveCount(4);await expect(page.locator('#open-battle-lab-town')).toBeEnabled();
  await page.locator('.town-future summary').click();await expect(page.locator('.town-future .town-building:visible')).toHaveCount(3);
  for(const button of await page.locator('.town-future button').all())await expect(button).toBeDisabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(errors).toEqual([]);
});
