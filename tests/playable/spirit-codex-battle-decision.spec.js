const {test,expect}=require('@playwright/test');
async function load(page,lab=true){
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/playable/spirit-codex.html');
  await page.evaluate(()=>SC.preloadArt());await page.clock.install();await page.clock.pauseAt(Date.now()+1000);
  await page.evaluate(lab=>{SC.setRandomSource(()=>.5);if(lab)openBattleLab();else{SC.setTeam([0,1,2,3]);SC.setAutoBattle(false);SC.startBattle();}},lab);
  await page.clock.fastForward(50);return errors;
}
async function advance(page,ms){for(let t=0;t<ms;t+=100)await page.clock.fastForward(Math.min(100,ms-t));}
async function snapshot(page){return page.evaluate(()=>JSON.stringify({allies:state.allies,enemies:state.enemies,run:state.run,phase:state.phase}));}
async function scenario(page,kind){expect(await page.evaluate(kind=>SC.BattleLab.prepareBossScenario(kind),kind)).toBe(true);await page.clock.fastForward(32);}
async function visibleCommandsFit(page){
  const layout=await page.evaluate(()=>{const dock=document.getElementById('battle-ui').getBoundingClientRect();return {width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,dock:dock.toJSON(),buttons:[...document.querySelectorAll('#battle-commands button')].filter(n=>n.getClientRects().length).map(n=>({text:n.textContent,rect:n.getBoundingClientRect().toJSON()}))};});
  expect(layout.overflow).toBe(false);
  for(const b of layout.buttons){expect(b.rect.height,b.text).toBeGreaterThanOrEqual(44);expect(b.rect.left,b.text).toBeGreaterThanOrEqual(0);expect(b.rect.right,b.text).toBeLessThanOrEqual(layout.width);expect(b.rect.top,b.text).toBeGreaterThanOrEqual(layout.dock.top);expect(b.rect.bottom,b.text).toBeLessThanOrEqual(layout.height+1);}
}
test.afterEach(async({page})=>{await page.evaluate(()=>{SC.closeComboModal();BattleHUD.closeReport();if(SC.BattleLab.isActive())closeBattleLab();else if(inBattle)returnTown();});await page.clock.resume();});

test('all 48 skill plans are read-only and distinguish target roles, randomness and summon capacity',async({page})=>{
  const errors=await load(page);
  const result=await page.evaluate(()=>{
    const actor=currentPlayerActor(),enemy=state.enemies[0];let rolls=0;
    SC.setRandomSource(()=>{rolls++;return .5;});
    const before=JSON.stringify(SC.snapshot());const plans=CHARACTERS.flatMap(c=>c.skills.map(sk=>BattleDecision.plan(actor,sk,sk.single?actor:enemy)));
    const after=JSON.stringify(SC.snapshot());
    const dead=state.allies[2];dead.alive=false;dead.curHp=0;
    const summon=makeUnit(SUMMONS.skeleton,false,SUMMONS.skeleton);state.allies.push(summon);addStatus(summon,'burn',2,0,actor);
    const revival=BattleDecision.plan(actor,CHARACTERS.find(c=>c.id==='L1').skills[3]);
    const single=BattleDecision.plan(actor,CHARACTERS.find(c=>c.id==='L1').skills[1],state.allies[1]);
    const chain=BattleDecision.plan(actor,{name:'链测试',type:'attack',chain:1},enemy);
    const summoning=BattleDecision.plan(actor,{name:'召唤测试',type:'summon',summon:'skeleton',summonCount:2});
    return {before,after,rolls,plans,revival,single,chain,summoning,dead:String(dead.uid),summon:String(summon.uid),selected:String(state.allies[1].uid),enemy:String(enemy.uid)};
  });
  expect(result.before).toBe(result.after);expect(result.rolls).toBe(0);expect(result.plans).toHaveLength(48);
  for(const p of result.plans){expect(p.title).toBeTruthy();expect(p.marks.every(m=>m.uid&&m.role)).toBe(true);}
  expect(result.revival.marks).toContainEqual({uid:result.dead,role:'revive',possible:false});expect(result.revival.marks).toContainEqual({uid:result.summon,role:'cleanse',possible:false});expect(result.revival.marks.some(m=>m.uid===result.summon&&m.role==='heal')).toBe(false);
  expect(result.single.marks).toEqual([{uid:result.selected,role:'heal',possible:false}]);
  expect(result.chain.marks.filter(m=>!m.possible)).toEqual([{uid:result.enemy,role:'attack',possible:false}]);expect(result.chain.marks.filter(m=>m.possible)).toHaveLength(2);expect(result.summoning.summon).toBe(true);expect(result.summoning.notes.join('')).toContain('召唤');expect(errors).toEqual([]);
});

test('hover cannot shift buttons; group preview can cancel without spending and confirms exactly one real action',async({page})=>{
  const errors=await load(page,false),button=page.locator('#skill-bar .skill-btn').nth(2),box=await button.boundingBox(),before=await snapshot(page);
  await button.hover();const hovered=await button.boundingBox();expect(hovered.height).toBe(box.height);expect(hovered.width).toBe(box.width);expect(Math.abs(hovered.y-box.y)).toBeLessThanOrEqual(2);await expect(page.locator('#skill-preview')).toBeHidden();
  await button.click();await expect(page.locator('#battle-command-label')).toHaveText('确认范围');await expect(page.locator('#skill-preview')).toContainText('全体攻击');expect(await snapshot(page)).toBe(before);
  const ids=await page.evaluate(()=>({marks:BattleDecision.current().marks.map(m=>m.uid),enemies:state.enemies.filter(e=>e.alive).map(e=>String(e.uid)),click:!!document.getElementById('battle-canvas').onclick}));expect(ids.marks).toEqual(ids.enemies);expect(ids.click).toBe(false);await visibleCommandsFit(page);
  await page.locator('#target-chips .tgt').last().click();expect(await snapshot(page)).toBe(before);await button.click();await page.locator('.target-confirm').click();
  expect(await page.evaluate(()=>state.phase)).toBe('anim');const after=await snapshot(page);expect(after).not.toBe(before);expect(await page.evaluate(()=>BattleDecision.confirmGroup())).toBe(false);expect(await snapshot(page)).toBe(after);expect(errors).toEqual([]);
});

test('single heal targets only a living formal ally; canvas preview never changes resources',async({page})=>{
  const errors=await load(page);await page.evaluate(()=>{SC.BattleLab.selectCharacter('L1');SC.BattleLab.prepareSkillTest();});await page.locator('#battle-lab-toggle').click();
  const before=await snapshot(page);await page.locator('#skill-bar .skill-btn').nth(1).click();await expect(page.locator('#skill-preview')).toContainText('单体治疗');
  const plan=await page.evaluate(()=>{const ally=state.allies.find(u=>u.alive&&u!==currentPlayerActor());BattleDecision.selectTarget(ally);return {p:BattleDecision.current(),uid:String(ally.uid),target:state.target.side};});
  expect(plan.target).toBe('ally');expect(plan.p.marks).toEqual([{uid:plan.uid,role:'heal',possible:false}]);expect(await snapshot(page)).toBe(before);await visibleCommandsFit(page);
  const invalid=await page.evaluate(()=>{const enemy=state.enemies[0];SC.resolveTarget(enemy);return {phase:state.phase,pending:!!state.target};});expect(invalid).toEqual({phase:'player',pending:true});expect(errors).toEqual([]);
});

test('boss scenarios show true control chance versus immunity and leave all commands reachable',async({page})=>{
  const errors=await load(page);await page.locator('#battle-lab-tab-tools').click();await page.locator('#battle-lab-scenario-interrupt').click();await page.locator('#battle-lab-toggle').click();
  await page.locator('#skill-bar .skill-btn').nth(2).click();const chance=await page.evaluate(()=>Math.round(SC.skillInterruptChance(currentPlayerActor().skills[2],state.enemies[0])*100));
  expect(chance).toBe(22);await expect(page.locator('#skill-preview')).toContainText('22%');await expect(page.locator('#skill-preview')).toContainText('不含被动');await visibleCommandsFit(page);
  await page.locator('#target-chips .tgt').last().click();await scenario(page,'guard');await visibleCommandsFit(page);
  await page.evaluate(()=>SC.BattleLab.selectCharacter('T1'));await page.locator('#skill-bar .skill-btn').nth(2).click();await expect(page.locator('#skill-preview')).toContainText('免疫硬控');await visibleCommandsFit(page);
  await page.locator('#target-chips .tgt').last().click();await page.evaluate(()=>BattleHUD.openReport());await expect(page.locator('#boss-tactical-detail')).toContainText('优先护盾');await expect(page.locator('#boss-charge-value')).toContainText('免疫硬控');expect(errors).toEqual([]);
});

test('real control interrupts the charge, prevents storm damage and opens +35% until next boss entry',async({page})=>{
  const errors=await load(page);await scenario(page,'interrupt');
  const before=await page.evaluate(()=>state.allies.map(u=>u.curHp));
  expect(await page.evaluate(()=>{let i=0;const rolls=[.99,.1,.99];SC.setRandomSource(()=>rolls[i++]??.99);return SC.BattleLab.useSkill(2);})).toBe(true);
  expect(await page.evaluate(()=>hasStatus(state.enemies[0],'stun'))).toBe(true);await advance(page,4000);expect(await page.evaluate(()=>SC.BattleLab.enemyStep())).toBe(true);await advance(page,1000);
  expect(await page.evaluate(()=>({hp:state.allies.map(u=>u.curHp),charge:state.enemies[0].charging,bonus:state.enemies[0].coreExposure?.bonus,resist:state.enemies[0].controlResistTurns}))).toEqual({hp:before,charge:null,bonus:.35,resist:2});
  await expect(page.locator('#battle-intel-summary')).toContainText('+35%');await page.evaluate(()=>SC.setBattleSpeed(2));await advance(page,6000);expect(await page.evaluate(()=>state.enemies[0].coreExposure.bonus)).toBe(.35);
  await page.evaluate(()=>SC.BattleLab.enemyStep());expect(await page.evaluate(()=>state.enemies[0].coreExposure)).toBeNull();expect(errors).toEqual([]);
});

test('shield absorbs an actual immune-boss storm, +20% window permits a real bastion combo without extra cost',async({page})=>{
  test.setTimeout(60000);const errors=await load(page);await scenario(page,'guard');
  const immune=await page.evaluate(()=>({applied:SC.applyStatus(state.enemies[0],'stun',currentPlayerActor(),1,1),floats:state.floats.map(f=>f.txt)}));expect(immune.applied).toBe(false);expect(immune.floats.join('')).toContain('免疫');
  expect(await page.evaluate(()=>SC.BattleLab.useSkill(1))).toBe(true);await advance(page,4000);const shields=await page.evaluate(()=>state.allies.map(u=>u.shield));expect(shields.every(x=>x>0)).toBe(true);
  await page.evaluate(()=>SC.BattleLab.enemyStep());await advance(page,5000);
  const after=await page.evaluate(()=>({shields:state.allies.map(u=>u.shield),bonus:state.enemies[0].coreExposure?.bonus,logs:state.log}));expect(after.bonus).toBe(.20);expect(after.shields.some((x,i)=>x<shields[i])).toBe(true);expect(JSON.stringify(after.logs)).toContain('吸收');
  await page.evaluate(()=>SC.BattleLab.selectCharacter('L2'));expect(await page.evaluate(()=>SC.comboAvailability('bastion').ready)).toBe(true);
  expect(await page.evaluate(()=>SC.BattleLab.castCombo('bastion'))).toBe(true);expect(await page.evaluate(()=>!!LiveCombo.current)).toBe(true);await advance(page,9600);
  expect(await page.evaluate(()=>({casts:state.run.comboCasts,item:state.progression.inventory[SC.COMBO_RECIPES.find(r=>r.id==='bastion').itemId],bonus:state.enemies[0].coreExposure?.bonus}))).toEqual({casts:1,item:2,bonus:.20});expect(errors).toEqual([]);
});

test('exposure modifies only direct attacks, not raw damage, and dies with the encounter',async({page})=>{
  const errors=await load(page);await scenario(page,'guard');const result=await page.evaluate(()=>{
    const boss=state.enemies[0],actor=currentPlayerActor();boss.charging=null;boss.maxHp=boss.curHp=100000;SC.setRandomSource(()=>.99);
    const skill={name:'倍率验证',mult:1},base=SC.dealDamage(actor,skill,boss,true,{noCounter:true});BossTactics.open(boss,'interrupted');
    const boosted=SC.dealDamage(actor,skill,boss,true,{noCounter:true});const raw=SC.applyDamageToUnit(boss,100,actor,{noCounter:true}).dealt;
    const enemyMultiplier=BossTactics.multiplier(boss,boss);SC.BattleLab.prepareCombo('phoenix');return {base,boosted,raw,enemyMultiplier,clean:state.enemies.every(e=>!e.coreExposure)};
  });expect(result.boosted).toBeGreaterThanOrEqual(Math.floor(result.base*1.35));expect(result.boosted).toBeLessThanOrEqual(Math.ceil((result.base+1)*1.35));expect(result.raw).toBe(100);expect(result.enemyMultiplier).toBe(1);expect(result.clean).toBe(true);expect(errors).toEqual([]);
});

test('combo hints name missing energy and preserve authoritative turn and item validation',async({page})=>{
  const errors=await load(page);const result=await page.evaluate(()=>{
    const actor=currentPlayerActor(),partner=state.allies.find(u=>u.characterId==='A1');actor.energy=59;partner.energy=38;
    const missing=SC.comboAvailability('phoenix').reasons;actor.energy=60;partner.energy=40;state.phase='enemy';
    const before=JSON.stringify(SC.snapshot()),future=BattleDecision.opportunities().map(x=>x.recipe.id),ready=SC.comboAvailability('phoenix').ready,executed=SC.executeCombo('phoenix'),after=JSON.stringify(SC.snapshot());
    state.phase='player';state.progression.inventory[SC.COMBO_RECIPES[0].itemId]=0;const noItem=BattleDecision.opportunities().map(x=>x.recipe.id);return {missing,future,ready,executed,before,after,noItem};
  });expect(result.missing.join('')).toContain('还缺 1 能量');expect(result.missing.join('')).toContain('还缺 2 能量');expect(result.future).toContain('phoenix');expect(result.ready).toBe(false);expect(result.executed).toBe(false);expect(result.before).toBe(result.after);expect(result.noItem).not.toContain('phoenix');expect(errors).toEqual([]);
});

test('auto combo takeover waits for a committed enemy hit at x2, opens manual confirmation and never spends by itself',async({page})=>{
  const errors=await load(page);await scenario(page,'opportunity');await page.locator('#battle-lab-toggle').click();await page.evaluate(()=>SC.setBattleSpeed(2));await advance(page,250);
  expect(await page.evaluate(()=>BattleMotion.inspect().active)).toBe(true);await expect(page.locator('#combo-opportunity')).toBeVisible();
  const before=await page.evaluate(()=>({inventory:{...state.progression.inventory},energy:state.allies.map(u=>u.energy),hp:state.allies.map(u=>u.curHp)}));await page.locator('#combo-opportunity').click();await expect(page.locator('#combo-opportunity')).toContainText('等待己方回合');await expect(page.locator('#combo-modal')).toBeHidden();
  await advance(page,4000);await expect(page.locator('#combo-modal')).toBeVisible();expect(await page.evaluate(()=>autoBattle)).toBe(false);
  const after=await page.evaluate(()=>({inventory:{...state.progression.inventory},energy:state.allies.map(u=>u.energy),hp:state.allies.map(u=>u.curHp)}));expect(after).toEqual(before);expect(await page.evaluate(()=>state.run.comboCasts)).toBe(0);
  await page.locator('#combo-modal-close').click();await expect(page.locator('#combo-modal')).toBeHidden();await expect(page.locator('#combo-opportunity')).toBeHidden();await advance(page,3000);expect(await page.evaluate(()=>state.run.comboCasts)).toBe(0);expect(errors).toEqual([]);
});

test('leaving a queued takeover restores the save and cannot open a stale modal in the next fight',async({page})=>{
  const errors=await load(page,false),saved=await page.evaluate(()=>({progress:JSON.stringify(state.progression),storage:JSON.stringify(localStorage)}));
  await page.evaluate(()=>{returnTown();openBattleLab();SC.BattleLab.prepareBossScenario('opportunity');BattleDecision.takeOverCombo();closeBattleLab();SC.setAutoBattle(false);startBattle();});
  await advance(page,5000);await expect(page.locator('#combo-modal')).toBeHidden();await expect(page.locator('#combo-opportunity')).toBeHidden();expect(await page.evaluate(()=>({progress:JSON.stringify(state.progression),storage:JSON.stringify(localStorage)}))).toEqual(saved);expect(errors).toEqual([]);
});

test('formal boss opens by charging and a phase transition cannot silently cancel the telegraphed storm',async({page})=>{
  const errors=await load(page,false);const result=await page.evaluate(()=>{
    state.battleToken++;const boss=SC.makeExpeditionEnemy(SC.ENEMIES[2][0]);state.enemies=[boss];state.turnOrder=[boss];state.curIdx=0;state.phase='enemy';
    const first=SC.planEnemyIntent(boss,true);boss.charging={skillIndex:first.skillIndex,turns:1};boss.curHp=Math.floor(boss.maxHp*.69);SC.updateBossStage(boss);
    const crossing={stage:boss.bossStage,charge:{...boss.charging},intent:SC.planEnemyIntent(boss,true)};
    SC.applyStatus(boss,'stun',state.allies[0],1,1);SC.processTurn();return {first,crossing,bonus:boss.coreExposure?.bonus,charge:boss.charging};
  });expect(result.first.chargeTurns).toBe(1);expect(result.first.skillIndex).toBe(1);expect(result.crossing.stage).toBe(2);expect(result.crossing.charge.skillIndex).toBe(1);expect(result.crossing.intent.isRelease).toBe(true);expect(result.bonus).toBe(.35);expect(result.charge).toBeNull();expect(errors).toEqual([]);
});
