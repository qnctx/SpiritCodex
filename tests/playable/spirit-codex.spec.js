const { test, expect } = require('@playwright/test');
const { createHash } = require('node:crypto');

const COMBO_REFERENCE_FILES = [
  ['phoenix', 'assets/combos/reference-phoenix-v7.png', '318900fc2fd569bd0fe9270d656cd6257260fb4c221bd341ae930989a082f042'],
  ['leviathan', 'assets/combos/reference-leviathan-v7.png', 'f0171168a53a38f91a426a140036d7f74332e3abf8d9633c15d9598f662f7230'],
  ['bastion', 'assets/combos/reference-bastion-v7.png', '065d1c025fd0046111f0ffac71e2d3136e2e0e176d99a8d65fa21aacca63227d'],
  ['spring', 'assets/combos/reference-spring-v7.png', '474c3ace0269a6b421d09c2b6736ea714c2437ab6053ccdd32c6374399c24f55'],
  ['eclipse', 'assets/combos/ultimate-eclipse-sequence-v3.png', '85d8e59d0ba739413d501a7dc331f5b96f84c354a5b2cec6aa6f5ccc46c4d044'],
  ['legion', 'assets/combos/ultimate-legion-sequence-v3.png', 'c197ed4e5ddcdf4cedf93aed9d5ed8eceddef08feb08426184b352f7fede6414'],
];

async function loadGame(page, { manual = true } = {}) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/playable/spirit-codex.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#title-screen')).toHaveClass(/active/);
  await expect(page.locator('#err-overlay')).not.toHaveClass(/show/);
  if (manual) await page.evaluate(() => window.SC.setAutoBattle(false));
  return errors;
}

async function enterFormation(page) {
  await page.getByRole('button', { name: /进\s*入\s*城\s*镇/ }).click();
  await expect(page.locator('#town-screen')).toHaveClass(/active/);
  await page.locator('#town-screen .primary-building').click();
  await expect(page.locator('#formation-screen')).toHaveClass(/active/);
}

test('loads the offline battle baseline and renders all characters', async ({ page }) => {
  const errors = await loadGame(page);
  await page.getByRole('button', { name: /进\s*入\s*城\s*镇/ }).click();
  await page.getByRole('button', { name: /角色阁/ }).click();
  await expect(page.locator('#roster-screen')).toHaveClass(/active/);
  await expect(page.locator('.char-card:visible')).toHaveCount(12);
  expect(await page.evaluate(() => window.SC.validateGameData())).toBe(true);
  expect(errors).toEqual([]);
});

test('auto battle is enabled by default and keeps its mode across battles', async ({ page }) => {
  await loadGame(page, { manual: false });
  await expect(page.locator('#auto-battle-btn')).toHaveText('自动：开');
  await expect(page.locator('#auto-battle-btn')).toHaveAttribute('aria-pressed', 'true');
  const modes = await page.evaluate(() => {
    const initial = window.SC.autoBattle;
    window.SC.setAutoBattle(false);
    window.SC.startBattle();
    const inBattle = window.SC.autoBattle;
    resetGame();
    window.SC.startBattle();
    return { initial, inBattle, afterReset: window.SC.autoBattle };
  });
  expect(modes).toEqual({ initial: true, inBattle: false, afterReset: false });
  await expect(page.locator('#auto-battle-btn')).toHaveText('手动');
});

test('switching to manual cancels an unsubmitted auto decision', async ({ page }) => {
  await loadGame(page);
  const setup = await page.evaluate(() => {
    window.SC.setTeam([0, 5, 11, 1]);window.SC.startBattle();
    const state = window.SC.state;state.battleToken++;
    const actor = state.allies[0];state.turnOrder = [actor];state.curIdx = 0;state.phase = 'player';actor._acted = false;
    renderAll();
    const before = state.enemies.reduce((sum, enemy) => sum + enemy.curHp, 0);
    window.SC.setAutoBattle(true);
    const pendingToken = window.SC.autoDecisionToken;
    window.SC.setAutoBattle(false);
    return { before, pendingToken, cancelledToken: window.SC.autoDecisionToken };
  });
  expect(setup.cancelledToken).toBeGreaterThan(setup.pendingToken);
  await page.waitForTimeout(500);
  const result = await page.evaluate(() => ({
    after: window.SC.state.enemies.reduce((sum, enemy) => sum + enemy.curHp, 0),
    acted: window.SC.state.turnOrder[0]._acted,
    phase: window.SC.state.phase,
    target: window.SC.state.target,
  }));
  expect(result).toMatchObject({ after: setup.before, acted: false, phase: 'player', target: null });
});

test('re-enabling auto advances a legal ultimate without opening fusion', async ({ page }) => {
  await loadGame(page);
  const before = await page.evaluate(() => {
    window.SC.setTeam([0, 5, 11, 1]);window.SC.startBattle();
    const state = window.SC.state;state.battleToken++;
    const actor = state.allies[0];state.turnOrder = [actor];state.curIdx = 0;state.phase = 'player';actor._acted = false;actor.energy = actor.maxEnergy;
    renderAll();
    const hp = state.enemies.reduce((sum, enemy) => sum + enemy.curHp, 0);
    window.SC.setAutoBattle(true);
    return hp;
  });
  await expect.poll(() => page.evaluate(() => window.SC.state.enemies.reduce((sum, enemy) => sum + enemy.curHp, 0))).toBeLessThan(before);
  const result = await page.evaluate(() => ({
    energy: window.SC.state.allies[0].energy,
    target: window.SC.state.target,
    fusionOpen: document.querySelector('#fusion-modal').classList.contains('show'),
  }));
  expect(result).toEqual({ energy: 0, target: null, fusionOpen: false });
});

test('summon turns never expose the player skill bar', async ({ page }) => {
  await loadGame(page);
  const result = await page.evaluate(() => {
    window.SC.startBattle();const state = window.SC.state;state.battleToken++;
    const summon = window.SC.makeUnit(window.SC.SUMMONS.skeleton, false, window.SC.SUMMONS.skeleton);
    state.allies.push(summon);state.turnOrder = [summon];state.curIdx = 0;state.phase = 'idle';summon._acted = false;
    window.SC.processTurn();
    const value = { phase: state.phase, skillButtons: document.querySelectorAll('#skill-bar .skill-btn').length, label: document.querySelector('#skill-bar').textContent.trim() };
    state.battleToken++;return value;
  });
  expect(result).toEqual({ phase: 'anim', skillButtons: 0, label: '召唤物行动中…' });
});

test('Image2 manifest resolves every required asset and DOM art keeps safe fallbacks', async ({ page, request }) => {
  test.setTimeout(90_000);
  const errors = await loadGame(page);
  await expect(page.locator('#title-emblem .emblem-art.loaded img')).toHaveCount(1);
  const report = await page.evaluate(() => ({
      paths: window.SC.REQUIRED_ART,
      characters: window.SC.CHARACTERS.filter(character => character.art).length,
      enemyArt: new Set(window.SC.ENEMIES.flat().map(enemy => enemy.art)).size,
      summons: Object.values(window.SC.SUMMONS).filter(summon => summon.art).length,
      battleBackgrounds: window.SC.ART.backgrounds.battle.length,
      attackAtlas: COMBO_STAGE_ART.attack,
      phoenixCombat: window.SC.COMBO_RECIPES.find(recipe => recipe.id === 'phoenix').rig.combat,
      rigs: window.SC.COMBO_RECIPES.map(recipe => ({ id: recipe.id, src: recipe.rig?.src, columns: recipe.rig?.columns, rows: recipe.rig?.rows })),
  }));
  const responses = await Promise.all(report.paths.map(async src => ({ src, status: (await request.fetch(`/playable/${src}`, { method: 'HEAD' })).status() })));
  expect(responses.filter(response => response.status !== 200)).toEqual([]);
  expect(report).toMatchObject({ characters: 12, enemyArt: 6, summons: 2, battleBackgrounds: 3 });
  expect(report.paths).toHaveLength(49); // Prior 41, six original sheets, separate attack materials, and one target-facing phoenix body.
  expect(report.rigs).toEqual(COMBO_REFERENCE_FILES.map(([id, src]) => ({ id, src, columns: 3, rows: 2 })));
  expect(report.paths).toEqual(expect.arrayContaining(COMBO_REFERENCE_FILES.map(([, src]) => src)));
  expect(report.attackAtlas).toBe('assets/combos/attack-material-atlas-v8.png');
  expect(report.paths).toContain(report.attackAtlas);
  const attackAtlas = await request.get(`/playable/${report.attackAtlas}`), attackBytes = await attackAtlas.body();
  expect(attackAtlas.status()).toBe(200);
  expect(attackBytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect([attackBytes.readUInt32BE(16), attackBytes.readUInt32BE(20)], 'six separate skill materials use their own 3×2 atlas').toEqual([1536, 1024]);
  expect(report.phoenixCombat).toMatchObject({ src: 'assets/combos/phoenix-combat-facing-v9.png', columns: 1, rows: 1, variant: 'phoenix-side' });
  expect(report.paths).toContain(report.phoenixCombat.src);
  const combatImage = await request.get(`/playable/${report.phoenixCombat.src}`), combatBytes = await combatImage.body();
  expect(combatImage.status()).toBe(200); expect(combatBytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect([combatBytes.readUInt32BE(16), combatBytes.readUInt32BE(20)]).toEqual([1254, 1254]);
  for (const [id, src, expectedHash] of COMBO_REFERENCE_FILES) {
    const response = await request.get(`/playable/${src}`), bytes = await response.body();
    expect(response.status()).toBe(200);
    expect(createHash('sha256').update(bytes).digest('hex'), `${id} preserves the selected reference image bytes`).toBe(expectedHash);
    expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], `${id} remains the original 3×2 six-stage sheet`).toEqual([1536, 1024]);
  }

  // These source PNGs are intentionally high-resolution. Wait for the shared
  // cache to finish decoding before asserting the DOM copies across four
  // concurrently running viewport projects.
  await page.evaluate(() => window.SC.preloadArt(window.SC.CHARACTERS.map(character => character.art)));

  await page.getByRole('button', { name: /进\s*入\s*城\s*镇/ }).click();
  await expect(page.locator('#town-screen .building-art.loaded img')).toHaveCount(6);
  await page.getByRole('button', { name: /角色阁/ }).click();
  await expect.poll(() => page.locator('.char-card .roster-art.loaded img').count()).toBe(12);
  await page.locator('.char-card').first().click();
  await expect(page.locator('#detail-modal')).toHaveClass(/show/);
  await expect(page.locator('.detail-art.loaded img')).toHaveCount(1);
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: /组队/ }).click();
  await expect(page.locator('.mini-art.loaded img')).toHaveCount(12);
  await expect(page.locator('.slot-art.loaded img')).toHaveCount(6);
  await page.evaluate(() => { window.SC.startBattle(); endBattle(true); });
  await expect(page.locator('#result-crest .crest-art.win.loaded img')).toHaveCount(1);
  await page.evaluate(() => { resetGame(); window.SC.startBattle(); endBattle(false); });
  await expect(page.locator('#result-crest .crest-art.lose.loaded img')).toHaveCount(1);

  const fallback = await page.evaluate(async () => {
    const host = document.createElement('div');
    host.innerHTML = '<span class="art-stack"><span class="art-fallback">安全回退</span><img data-art src="data:image/png;base64,broken"></span>';
    document.body.appendChild(host);
    await new Promise(resolve => setTimeout(resolve, 30));
    const result = { imageRemoved: !host.querySelector('img'), text: host.querySelector('.art-fallback')?.textContent };
    host.remove();
    return result;
  });
  expect(fallback).toEqual({ imageRemoved: true, text: '安全回退' });
  expect(errors).toEqual([]);
});

test('formation enforces four active characters plus at most two reserves', async ({ page }) => {
  await loadGame(page);
  await enterFormation(page);
  await expect(page.locator('#start-battle-btn')).toBeEnabled();
  expect(await page.evaluate(() => window.SC.state.team.some(index => window.SC.CHARACTERS[index].pos === 'front'))).toBe(true);
  await page.evaluate(() => window.SC.setTeam([0, 1]));
  await expect(page.locator('#start-battle-btn')).toBeDisabled();
  await page.evaluate(() => window.SC.setTeam([0, 1, 2, 3, 4, 5, 6]));
  expect(await page.evaluate(() => ({team:window.SC.state.team.length,active:window.SC.activeFormationIndices().length,reserve:window.SC.reserveFormationIndices().length}))).toEqual({team:6,active:4,reserve:2});
  await expect(page.locator('#start-battle-btn')).toBeEnabled();
  await page.locator('#start-battle-btn').click();
  await expect(page.locator('#battle-screen')).toHaveClass(/active/);
});

test('editable formation slots drive real front/back battle positions', async ({ page }) => {
  await loadGame(page);
  const result = await page.evaluate(() => {
    window.SC.setTeam([0, 1, 2, 3, 4, 5]);
    const before = JSON.parse(JSON.stringify(window.SC.state.formationSlots));
    window.SC.moveFormationCharacter(0, { zone: 'front', slotIndex: 0 });
    const moved = JSON.parse(JSON.stringify(window.SC.state.formationSlots));
    window.SC.startBattle();
    const battleRows = Object.fromEntries(window.SC.state.allies.map(unit => [unit.characterIndex, unit.pos]));
    const reserves = [...window.SC.state.reserves];
    window.SC.state.battleToken++;
    return { before, moved, battleRows, reserves };
  });
  expect(result.before.front.filter(Number.isInteger)).toHaveLength(2);
  expect(result.before.back.filter(Number.isInteger)).toHaveLength(2);
  expect(result.moved.front[0]).toBe(0);
  expect(Object.values(result.battleRows).filter(position => position === 'front')).toHaveLength(2);
  expect(Object.values(result.battleRows).filter(position => position === 'back')).toHaveLength(2);
  expect(result.reserves).toHaveLength(2);
});

test('skill cooldown disables tactical skills and ticks down by round', async ({ page }) => {
  await loadGame(page);
  const result = await page.evaluate(() => {
    window.SC.setTeam([0, 1, 2, 3]);window.SC.startBattle();
    const state = window.SC.state;state.battleToken++;
    const actor = state.allies.find(unit => unit.characterIndex === 0);
    const target = window.SC.makeUnit({ name:'冷却靶', element:'dark', hp:99999, atk:1, def:20, spd:1, res:100, skills:[{name:'等待',type:'attack',mult:0,cooldown:0,intent:{label:'等待',target:'front'}}], intent:{archetype:'dummy',pattern:[0]} }, true);
    state.enemies=[target];state.turnOrder=[actor];state.curIdx=0;state.phase='player';actor._acted=false;
    window.SC.playerSelectSkill(1);window.SC.resolveTarget(target);state.battleToken++;
    const afterUse=window.SC.skillCooldown(actor,actor.skills[1],1);
    state.phase='player';actor._acted=false;renderSkillBar();
    const disabledAfterUse=document.querySelectorAll('#skill-bar .skill-btn')[1].disabled;
    processDOT();state.battleToken++;
    const afterOneRound=window.SC.skillCooldown(actor,actor.skills[1],1);
    processDOT();state.battleToken++;
    state.phase='player';actor._acted=false;state.turnOrder=[actor];state.curIdx=0;renderSkillBar();
    const afterTwoRounds=window.SC.skillCooldown(actor,actor.skills[1],1);
    const enabledAgain=!document.querySelectorAll('#skill-bar .skill-btn')[1].disabled;
    return { afterUse, disabledAfterUse, afterOneRound, afterTwoRounds, enabledAgain };
  });
  expect(result).toEqual({ afterUse:2, disabledAfterUse:true, afterOneRound:1, afterTwoRounds:0, enabledAgain:true });
});

test('balance rules use moderate counters, capped shields, and narrow rarity stats', async ({ page }) => {
  await loadGame(page);
  const result = await page.evaluate(() => {
    const unit=window.SC.makeUnit(window.SC.CHARACTERS[1],false);
    window.SC.addShieldToUnit(unit,unit.maxHp);
    window.SC.addShieldToUnit(unit,unit.maxHp);
    return {
      advantage:window.SC.getAdvantage('fire','wind'),
      disadvantage:window.SC.getAdvantage('wind','fire'),
      lightDark:window.SC.getAdvantage('light','dark'),
      shieldRatio:unit.shield/unit.maxHp,
      rarityGap:window.SC.RARITY.SSR.mult/window.SC.RARITY.SR.mult,
    };
  });
  expect(result.advantage).toBe(1.25);
  expect(result.disadvantage).toBe(0.8);
  expect(result.lightDark).toBe(1.3);
  expect(result.shieldRatio).toBeLessThanOrEqual(0.4);
  expect(result.rarityGap).toBeCloseTo(1.1,5);
});

test('enemy intents are visible and preserve front/back tactical targeting', async ({ page }) => {
  await loadGame(page);
  await page.evaluate(() => {window.SC.setTeam([0,1,2,3]);window.SC.startBattle();window.SC.state.battleToken++;renderAll();});
  await page.locator('#battle-report-btn').click();
  await expect(page.locator('#enemy-intents')).toBeVisible();
  await expect(page.locator('#enemy-intents .intent-card')).toHaveCount(3);
  const intents=await page.evaluate(() => window.SC.state.enemies.map(enemy => ({name:enemy.name,target:enemy.plannedIntent.targetRule,label:enemy.plannedIntent.label})));
  expect(intents.filter(intent => intent.name === '暗影狼').every(intent => intent.target === 'front')).toBe(true);
  expect(intents.find(intent => intent.name === '暗影蝠').target).toBe('back');
});

test('boss changes at 70/35 percent and gains control resistance after interruption', async ({ page }) => {
  await loadGame(page);
  const result=await page.evaluate(() => {
    const boss=window.SC.makeUnit(window.SC.ENEMIES[2][0],true);
    const ally=window.SC.makeUnit(window.SC.CHARACTERS[1],false);ally.pos='front';
    window.SC.state.enemies=[boss];window.SC.state.allies=[ally];window.SC.state.turnOrder=[boss];window.SC.state.curIdx=0;window.SC.state.phase='idle';
    boss.curHp=Math.floor(boss.maxHp*0.69);const stageTwo=window.SC.updateBossStage(boss);
    boss.curHp=Math.floor(boss.maxHp*0.34);const stageThree=window.SC.updateBossStage(boss);
    const chargeIntent=window.SC.planEnemyIntent(boss,true);
    window.SC.setRandomSource(()=>0.99);
    const firstControl=window.SC.applyStatus(boss,'stun',ally,1,1);
    window.SC.processTurn();window.SC.state.battleToken++;
    const resistance=boss.controlResistTurns;
    const secondControl=window.SC.applyStatus(boss,'stun',ally,1,1);
    window.SC.resetRandomSource();
    return {stageTwo,stageThree,charge:chargeIntent.chargeTurns,resistance,firstControl,secondControl};
  });
  expect(result).toEqual({stageTwo:2,stageThree:3,charge:1,resistance:2,firstControl:true,secondControl:false});
});

test('wave clear pauses safely for a three-choice formula and locks milestone reward', async ({ page }) => {
  await loadGame(page);
  const before = await page.evaluate(() => {
    window.SC.startBattle();const state=window.SC.state;state.battleToken++;
    state.enemies=[];state.phase='anim';window.SC.completeWave();
    return {wave:state.wave,turn:state.turn,phase:state.phase,cleared:state.run.clearedWaves,reward:state.run.reward,offers:state.run.formulaOffers.map(item=>item.id),epoch:state.run.flowEpoch};
  });
  expect(before).toMatchObject({wave:0,phase:'intermission',cleared:1,reward:30});
  expect(new Set(before.offers).size).toBe(3);
  await expect(page.locator('#intermission-modal')).toBeVisible();
  await expect(page.locator('#intermission-options .intermission-option')).toHaveCount(3);
  await page.waitForTimeout(700);
  const after=await page.evaluate(() => ({wave:window.SC.state.wave,turn:window.SC.state.turn,phase:window.SC.state.phase,epoch:window.SC.state.run.flowEpoch}));
  expect(after).toEqual({wave:before.wave,turn:before.turn,phase:'intermission',epoch:before.epoch});
  const layout=await page.locator('.intermission-card').evaluate(element=>{const rect=element.getBoundingClientRect();return {inside:rect.left>=0&&rect.right<=innerWidth+1&&rect.top>=0&&rect.bottom<=innerHeight+1,scrollable:element.scrollHeight<=element.clientHeight+1||getComputedStyle(element).overflowY==='auto'};});
  expect(layout).toEqual({inside:true,scrollable:true});
});

test('formula choice advances one wave while preserving combat resources and summons', async ({ page }) => {
  await loadGame(page);
  const result=await page.evaluate(() => {
    window.SC.startBattle();const state=window.SC.state;state.battleToken++;
    const actor=state.allies[0];actor.curHp-=123;actor.energy=37;actor.cooldowns[1]=2;
    const summon=window.SC.makeUnit(window.SC.SUMMONS.skeleton,false,window.SC.SUMMONS.skeleton);summon.remainingRounds=2;state.allies.push(summon);
    const actorUid=actor.uid,summonUid=summon.uid;state.enemies=[];state.phase='anim';window.SC.completeWave();
    const formulaId=state.run.formulaOffers[0].id;window.SC.chooseFormula(formulaId);state.battleToken++;
    const keptActor=state.allies.find(unit=>unit.uid===actorUid),keptSummon=state.allies.find(unit=>unit.uid===summonUid);
    return {wave:state.wave,phase:state.phase,formulaId,formulas:[...state.run.formulas],actor:{hp:keptActor.curHp,energy:keptActor.energy,cooldown:keptActor.cooldowns[1]},summon:{alive:keptSummon.alive,rounds:keptSummon.remainingRounds},enemyCount:state.enemies.length};
  });
  expect(result.wave).toBe(1);expect(result.phase).toBe('idle');expect(result.formulas).toEqual([result.formulaId]);
  expect(result.actor.energy).toBe(37);expect(result.actor.cooldown).toBe(2);expect(result.summon).toEqual({alive:true,rounds:2});expect(result.enemyCount).toBeGreaterThan(0);
});

test('temporary formulas alter offense, energy and cooldown through the shared combat pipeline', async ({ page }) => {
  await loadGame(page);
  const result=await page.evaluate(() => {
    window.SC.startBattle();const state=window.SC.state;state.battleToken++;window.SC.setRandomSource(()=>0.99);
    const actor=state.allies.find(unit=>unit.element==='fire'),makeTarget=()=>window.SC.makeUnit({name:'灵方靶',element:'wind',hp:9999,atk:1,def:40,spd:1,res:100,skills:[],intent:{archetype:'dummy',pattern:[]}},true);
    state.run.formulas=[];let target=makeTarget();const base=window.SC.dealDamage(actor,actor.skills[0],target,true);
    state.run.formulas=['flaw_hunter'];target=makeTarget();target.debuffs.push({type:'slow',turns:2});const flaw=window.SC.dealDamage(actor,actor.skills[0],target,true);
    state.run.formulas=['echo_caliper','counterflow_cell'];state.run.triggerUsage={};state.turn=7;actor.cooldowns=[0,2,3,0];actor.energy=0;target=makeTarget();window.SC.dealDamage(actor,actor.skills[0],target,true);
    window.SC.resetRandomSource();return {base,flaw,energy:actor.energy,cooldowns:actor.cooldowns};
  });
  expect(result.flaw).toBeGreaterThan(result.base*1.14);expect(result.energy).toBe(8);expect(result.cooldowns).toEqual([0,2,2,0]);
});

test('camp recovery, targeted charge and reserve swap are exclusive real choices', async ({ page }) => {
  await loadGame(page);
  const result=await page.evaluate(() => {
    const prepare=()=>{resetGame();window.SC.setAutoBattle(false);window.SC.startBattle();const state=window.SC.state;state.battleToken++;state.wave=1;state.run.clearedWaves=1;state.enemies=[];state.phase='anim';window.SC.completeWave();return state;};
    let state=prepare(),actor=state.allies[0],reserve=state.reserveUnits[0];actor.curHp=100;reserve.curHp=100;
    const actorMax=actor.maxHp,reserveMax=reserve.maxHp;window.SC.chooseCampOption('recover');state.battleToken++;
    const recovery={actor:actor.curHp-100,reserve:reserve.curHp-100,actorExpected:Math.floor(actorMax*.25),reserveExpected:Math.floor(reserveMax*.25),wave:state.wave};
    state=prepare();actor=state.allies[0];actor.energy=35;window.SC.chooseCampOption('charge');window.SC.applyCampCharge(actor.uid);state.battleToken++;
    const charge={energy:actor.energy,wave:state.wave};
    state=prepare();const outgoing=state.allies[0],incoming=state.reserveUnits[0],persistentBefore=JSON.stringify(state.formationSlots);outgoing.curHp=123;outgoing.energy=57;outgoing.cooldowns[1]=2;incoming.curHp-=77;incoming.energy=19;incoming.cooldowns[2]=1;
    const outgoingUid=outgoing.uid,incomingUid=incoming.uid,outgoingCharacter=outgoing.characterIndex,incomingCharacter=incoming.characterIndex;
    window.SC.chooseCampOption('swap');window.SC.selectCampUnit('active',outgoingUid);window.SC.selectCampUnit('reserve',incomingUid);window.SC.confirmCampSwap();state.battleToken++;
    return {recovery,charge,swap:{active:state.allies.some(unit=>unit.uid===incomingUid),out:state.reserveUnits.some(unit=>unit.uid===outgoingUid),incoming:{hp:incoming.curHp,energy:incoming.energy,cd:incoming.cooldowns[2],pos:incoming.pos},outgoing:{hp:outgoing.curHp,energy:outgoing.energy,cd:outgoing.cooldowns[1],pos:outgoing.pos},activeCharacters:window.SC.runActiveFormationIndices(),reserveCharacters:window.SC.runReserveFormationIndices(),persistentUnchanged:JSON.stringify(state.formationSlots)===persistentBefore,outgoingCharacter,incomingCharacter,wave:state.wave,swaps:state.run.stats.swaps}};
  });
  expect(result.recovery.actor).toBe(result.recovery.actorExpected);expect(result.recovery.reserve).toBe(result.recovery.reserveExpected);expect(result.recovery.wave).toBe(2);
  expect(result.charge).toEqual({energy:75,wave:2});
  expect(result.swap.active).toBe(true);expect(result.swap.out).toBe(true);expect(result.swap.incoming).toMatchObject({energy:19,cd:1});expect(result.swap.incoming.pos).not.toBe('reserve');expect(result.swap.persistentUnchanged).toBe(true);
  expect(result.swap.outgoing).toEqual({hp:123,energy:57,cd:2,pos:'reserve'});expect(result.swap.activeCharacters).toContain(result.swap.incomingCharacter);expect(result.swap.reserveCharacters).toContain(result.swap.outgoingCharacter);expect(result.swap.wave).toBe(2);expect(result.swap.swaps).toBe(1);
});

test('all four battle formations apply both their declared benefit and tradeoff', async ({ page }) => {
  await loadGame(page);
  const result=await page.evaluate(() => {
    const prepare=id=>{resetGame();window.SC.setAutoBattle(false);window.SC.selectFormationStyle(id);window.SC.startBattle();window.SC.state.battleToken++;return window.SC.state;};
    let state=prepare('bulwark'),front=state.allies.find(unit=>unit.pos==='front'),back=state.allies.find(unit=>unit.pos==='back');const frontBefore=front.curHp,backBefore=back.curHp;window.SC.applyDamageToUnit(front,100,null);window.SC.applyDamageToUnit(back,100,null);
    const bulwark={front:frontBefore-front.curHp,back:backBefore-back.curHp,backSpeed:window.SC.effSpd(back)/back.spd};
    state=prepare('gale');const galeUnit=state.allies[0];state.run.waveRound=1;const openingSpeed=window.SC.effSpd(galeUnit)/galeUnit.spd;state.run.waveRound=2;const laterSpeed=window.SC.effSpd(galeUnit)/galeUnit.spd;const shield=window.SC.addShieldToUnit(galeUnit,100);
    state=prepare('alchemy');const alchemyUnit=state.allies[0];window.SC.gainEnergy(alchemyUnit,100);
    state=prepare('spirit_calling');window.SC.setRandomSource(()=>0.99);window.SC.summonUnits(state.allies[0],{summon:'skeleton',summonCount:1});const summon=state.allies.find(unit=>unit.isSummon),targetA=window.SC.makeUnit({name:'A',element:'light',hp:9999,def:50,skills:[]},true),targetB=window.SC.makeUnit({name:'B',element:'light',hp:9999,def:50,skills:[]},true);const summonSpirit=window.SC.dealDamage(summon,summon.skills[0],targetA,false);state.run.formationStyleId='bulwark';const summonBase=window.SC.dealDamage(summon,summon.skills[0],targetB,false);state.run.formationStyleId='spirit_calling';const hero=state.allies[0],targetC=window.SC.makeUnit({name:'C',element:'wind',hp:9999,def:50,skills:[]},true),targetD=window.SC.makeUnit({name:'D',element:'wind',hp:9999,def:50,skills:[]},true);const heroSpirit=window.SC.dealDamage(hero,hero.skills[0],targetC,true);state.run.formationStyleId='bulwark';const heroBase=window.SC.dealDamage(hero,hero.skills[0],targetD,true);window.SC.resetRandomSource();
    return {bulwark,gale:{openingSpeed,laterSpeed,shield},alchemyEnergy:alchemyUnit.energy,spirit:{summonSpirit,summonBase,heroSpirit,heroBase,duration:summon.remainingRounds}};
  });
  expect(result.bulwark.front).toBe(88);expect(result.bulwark.back).toBe(100);expect(result.bulwark.backSpeed).toBeCloseTo(.92,5);
  expect(result.gale.openingSpeed).toBeCloseTo(1.15,5);expect(result.gale.laterSpeed).toBeCloseTo(1,5);expect(result.gale.shield).toBe(85);expect(result.alchemyEnergy).toBe(90);
  expect(result.spirit.summonSpirit).toBeGreaterThan(result.spirit.summonBase);expect(result.spirit.heroSpirit).toBeLessThan(result.spirit.heroBase);expect(result.spirit.duration).toBe(4);
});

test('reward tiers are explicit and one-click reserve retry starts a clean run', async ({ page }) => {
  await loadGame(page);
  const result=await page.evaluate(() => {
    window.SC.startBattle();const state=window.SC.state;state.battleToken++;state.enemies=[];state.phase='anim';window.SC.completeWave();const formulaId=state.run.formulaOffers[0].id;window.SC.chooseFormula(formulaId);state.battleToken++;
    const weakest=state.allies.find(unit=>!unit.isSummon),incomingCharacter=window.SC.reserveFormationIndices()[0],outgoingCharacter=weakest.characterIndex;weakest.curHp=1;
    endBattle(false);const defeated={reward:state.run.reward,cleared:state.run.clearedWaves,dom:Number(document.querySelector('#rs-reward').textContent),review:document.querySelector('#result-review').textContent};
    const retried=window.SC.retryBattle(true);state.battleToken++;
    return {defeated,retried,wave:state.wave,reward:state.run.reward,formulas:state.run.formulas,active:window.SC.activeFormationIndices(),reserve:window.SC.reserveFormationIndices(),incomingCharacter,outgoingCharacter,phase:state.phase};
  });
  expect(result.defeated).toMatchObject({reward:30,cleared:1,dom:30});expect(result.defeated.review).toContain('阵式');expect(result.retried).toBe(true);
  expect(result.wave).toBe(0);expect(result.reward).toBe(0);expect(result.formulas).toEqual([]);expect(result.active).toContain(result.incomingCharacter);expect(result.reserve).toContain(result.outgoingCharacter);expect(result.phase).not.toBe('done');
});

test('defensive formulas only protect allies and camp or fusion costs are exact', async ({ page }) => {
  await loadGame(page);
  const result=await page.evaluate(() => {
    resetGame();window.SC.setAutoBattle(false);window.SC.selectFormationStyle('alchemy');window.SC.startBattle();let state=window.SC.state;state.battleToken++;
    state.run.formulas=['thorned_aegis'];state.run.triggerUsage={};const ally=state.allies[0],attacker=state.enemies[0];attacker.shield=100;
    const allyBefore=ally.curHp;window.SC.applyDamageToUnit(attacker,200,ally);const enemyShieldReflection=allyBefore-ally.curHp;
    state.run.triggerUsage={};ally.shield=100;const attackerBefore=attacker.curHp;window.SC.applyDamageToUnit(ally,200,attacker,{noCounter:true});const playerShieldReflection=attackerBefore-attacker.curHp;
    state.wave=1;state.run.clearedWaves=1;state.enemies=[];state.phase='anim';window.SC.completeWave();ally.energy=10;ally.debuffs.push({type:'overload',turns:2});window.SC.chooseCampOption('charge');window.SC.applyCampCharge(ally.uid);state.battleToken++;
    const chargedEnergy=ally.energy;

    resetGame();window.SC.setAutoBattle(false);window.SC.selectFormationStyle('alchemy');window.SC.startBattle();state=window.SC.state;state.battleToken++;
    const actor=state.allies[0],assistants=state.allies.filter(unit=>unit!==actor&&!unit.isSummon);actor.energy=actor.maxEnergy;assistants.forEach(unit=>{unit.energy=0;});state.turnOrder=[actor];state.curIdx=0;state.phase='player';actor._acted=false;
    window.SC.openFusion();const disabled=[...state.fusionCtx.chips].every(chip=>chip.disabled);window.SC.toggleFuse(0);window.SC.confirmFusion();const actorAfterRejected=actor.energy;closeFusion();
    assistants[0].energy=10;state.phase='player';actor._acted=false;actor.energy=actor.maxEnergy;window.SC.openFusion();const eligibleIndex=state.fusionCtx.chips.findIndex(chip=>!chip.disabled),payer=state.fusionCtx.chips[eligibleIndex]._opt.unit,cost=state.fusionCtx.assistCost;window.SC.toggleFuse(eligibleIndex);window.SC.confirmFusion();state.battleToken++;
    return {enemyShieldReflection,playerShieldReflection,chargedEnergy,disabled,actorAfterRejected,cost,payerEnergy:payer.energy,actorEnergy:actor.energy,discountUsed:state.run.fusionAssistDiscountUsed};
  });
  expect(result).toEqual({enemyShieldReflection:0,playerShieldReflection:35,chargedEnergy:50,disabled:true,actorAfterRejected:100,cost:10,payerEnergy:0,actorEnergy:0,discountUsed:true});
});

test('wave rewards are idempotent and failure review names the decisive threat', async ({ page }) => {
  await loadGame(page);
  const result=await page.evaluate(() => {
    window.SC.startBattle();let state=window.SC.state;state.battleToken++;state.enemies=[];state.phase='anim';const first=window.SC.completeWave(),firstReward=state.run.reward,duplicateFirst=window.SC.completeWave();window.SC.chooseFormula(state.run.formulaOffers[0].id);state.battleToken++;
    state.enemies=[];state.phase='anim';const second=window.SC.completeWave(),secondReward=state.run.reward,duplicateSecond=window.SC.completeWave();window.SC.chooseCampOption('recover');state.battleToken++;
    state.enemies=[];state.phase='anim';const third=window.SC.completeWave(),thirdReward=state.run.reward,duplicateThird=window.SC.completeWave(),won=document.querySelector('#result-screen').classList.contains('active');
    resetGame();window.SC.startBattle();state=window.SC.state;state.battleToken++;const victim=state.allies[0],threat=state.enemies[0];window.SC.applyDamageToUnit(victim,victim.curHp+999,threat,{skillName:'毁灭冲击'});endBattle(false);const review=document.querySelector('#result-review').textContent;state.battleToken++;
    return {first,firstReward,duplicateFirst,second,secondReward,duplicateSecond,third,thirdReward,duplicateThird,won,review,threat:threat.name,victim:victim.name};
  });
  expect(result).toMatchObject({first:true,firstReward:30,duplicateFirst:false,second:true,secondReward:65,duplicateSecond:false,third:true,thirdReward:100,duplicateThird:false,won:true});
  expect(result.review).toContain(result.threat);expect(result.review).toContain(result.victim);expect(result.review).toContain('毁灭冲击');expect(result.review).toContain('预留控制、护盾或换位');
});

test('mandatory intermission traps keyboard focus until a choice is made', async ({ page }) => {
  await loadGame(page);
  await page.evaluate(() => {window.SC.startBattle();const state=window.SC.state;state.battleToken++;state.enemies=[];state.phase='anim';window.SC.completeWave();});
  await expect(page.locator('#intermission-modal')).toBeVisible();
  expect(await page.evaluate(() => document.querySelector('#battle-screen').inert&&document.querySelector('#intermission-modal').contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Shift+Tab');
  for(let index=0;index<5;index++){expect(await page.evaluate(() => document.querySelector('#intermission-modal').contains(document.activeElement))).toBe(true);await page.keyboard.press('Tab');}
  await page.keyboard.press('Escape');await expect(page.locator('#intermission-modal')).toBeVisible();
  await page.locator('#intermission-options .intermission-option').first().click();
  await expect(page.locator('#intermission-modal')).toBeHidden();expect(await page.evaluate(() => document.querySelector('#battle-screen').inert)).toBe(false);
});

test('summon duration counts completed summon actions instead of its creation round', async ({ page }) => {
  await loadGame(page);
  const result=await page.evaluate(() => {
    window.SC.startBattle();const state=window.SC.state;state.battleToken++;const summon=window.SC.makeUnit(window.SC.SUMMONS.skeleton,false,window.SC.SUMMONS.skeleton);state.allies.push(summon);
    summon._acted=false;processDOT();state.battleToken++;const created={rounds:summon.remainingRounds,alive:summon.alive};
    const actions=[];for(let count=0;count<3;count++){summon._acted=true;processDOT();state.battleToken++;actions.push({rounds:summon.remainingRounds,alive:summon.alive});}
    return {created,actions};
  });
  expect(result.created).toEqual({rounds:3,alive:true});expect(result.actions).toEqual([{rounds:2,alive:true},{rounds:1,alive:true},{rounds:0,alive:false}]);
});

test('battle canvas paints the current Image2 scene and keeps portrait targeting clickable', async ({ page }) => {
  await loadGame(page);
  const result = await page.evaluate(async () => {
    window.SC.setTeam([1, 2, 8, 10]);
    window.SC.startBattle();
    await window.SC.preloadArt([
      window.SC.ART.backgrounds.battle[0],
      ...window.SC.state.allies.map(unit => unit.art),
      ...window.SC.state.enemies.map(unit => unit.art),
    ]);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const state = window.SC.state;
    const actor = state.allies[0], target = state.enemies[0];
    state.turnOrder = [actor]; state.curIdx = 0; state.phase = 'player'; actor._acted = false;
    renderAll(); window.SC.playerSelectSkill(0);
    const hit = { ...target._hit }, before = target.curHp;
    const canvas = document.querySelector('#battle-canvas'), rect = canvas.getBoundingClientRect();
    const x = (hit.left + hit.right) / 2, y = (hit.top + hit.bottom) / 2;
    canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: rect.left + x, clientY: rect.top + y }));
    const pixels = canvas.getContext('2d').getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;
    state.battleToken++;
    return {
      sceneReady: window.SC.artStatus().some(item => item.src === window.SC.ART.backgrounds.battle[state.wave] && item.status === 'loaded'),
      unitArtReady: !!actor.art && !!target.art,
      hitContainsCenter: window.SC.unitContainsPoint(target, x, y),
      targetDamaged: target.curHp < before,
      painted: pixels[3] > 0,
    };
  });
  expect(result).toEqual({ sceneReady: true, unitArtReady: true, hitContainsCenter: true, targetDamaged: true, painted: true });
});

test('energy grows naturally and unlocks ultimate or fusion', async ({ page }) => {
  await loadGame(page);
  const result = await page.evaluate(() => {
    window.SC.setTeam([0, 1, 2, 3]); window.SC.startBattle();
    const state = window.SC.state;
    const actor = state.allies.find(unit => unit.name.includes('艾拉'));
    const target = window.SC.makeUnit({ name: '训练傀儡', element: 'dark', hp: 100000, atk: 1, def: 200, spd: 1, res: 100, skills: [{ name: '等待', type: 'attack', mult: 0 }] }, true);
    state.enemies = [target]; state.turnOrder = [actor]; state.curIdx = 0;
    for (let i = 0; i < 5; i++) {
      state.phase = 'player'; actor._acted = false;
      window.SC.playerSelectSkill(0); window.SC.resolveTarget(target);
    }
    state.phase = 'player'; actor._acted = false; renderSkillBar();
    const result = {
      energy: actor.energy,
      ultimateEnabled: !document.querySelectorAll('#skill-bar .skill-btn')[3].disabled,
      fusionVisible: !!document.querySelector('#skill-bar .skill-btn.fuse'),
    };
    state.battleToken++;
    return result;
  });
  expect(result).toEqual({ energy: 100, ultimateEnabled: true, fusionVisible: true });
});

test('defense reduces damage and raw shield handling is consistent', async ({ page }) => {
  await loadGame(page);
  const result = await page.evaluate(() => {
    window.SC.setRandomSource(() => 0.99);
    const source = window.SC.makeUnit(window.SC.CHARACTERS[0], false);
    const low = window.SC.makeUnit({ name: '低防', element: 'dark', hp: 1000, atk: 1, def: 10, spd: 1, skills: [] }, true);
    const high = window.SC.makeUnit({ name: '高防', element: 'dark', hp: 1000, atk: 1, def: 200, spd: 1, skills: [] }, true);
    const lowDamage = window.SC.dealDamage(source, { mult: 1 }, low, true);
    const highDamage = window.SC.dealDamage(source, { mult: 1 }, high, true);
    window.SC.resetRandomSource();
    return { lowDamage, highDamage };
  });
  expect(result).toEqual({ lowDamage: 152, highDamage: 61 });
});

test('configured passives affect resistance, opening speed, and shock attacks', async ({ page }) => {
  await loadGame(page);
  const result = await page.evaluate(() => {
    const arthur = window.SC.makeUnit(window.SC.CHARACTERS[3], false);
    window.SC.setTeam([5, 1, 2, 3]); window.SC.selectFormationStyle('alchemy'); window.SC.startBattle();
    const sebas = window.SC.state.allies.find(unit => unit.name.includes('赛巴斯'));
    const haste = sebas.buffs.find(buff => buff.type === 'haste');
    const nina = window.SC.makeUnit(window.SC.CHARACTERS[7], false);
    const target = window.SC.makeUnit({ name: '抗性靶', element: 'dark', hp: 5000, atk: 1, def: 20, spd: 1, res: 1, skills: [] }, true);
    const rolls = [0.99, 0.1, 0.99];
    window.SC.setRandomSource(() => rolls.shift() ?? 0.99);
    window.SC.dealDamage(nina, nina.skills[0], target, true);
    window.SC.resetRandomSource();
    const zak = window.SC.makeUnit(window.SC.CHARACTERS[6], false);
    zak.debuffs.push({ type: 'stun', turns: 1 });
    window.SC.state.allies = [zak]; window.SC.state.enemies = [target];
    window.SC.state.turnOrder = [zak, target]; window.SC.state.curIdx = 0; window.SC.state.phase = 'idle';
    window.SC.processTurn();
    const firstActionPreserved = !zak._hasActedEver;
    window.SC.state.battleToken++;
    return {
      arthurResistance: window.SC.effRes(arthur),
      hasteValue: haste && haste.val,
      sebasSpeed: window.SC.effSpd(sebas),
      shockApplied: window.SC.hasStatus(target, 'stun'),
      firstActionPreserved,
    };
  });
  expect(result.arthurResistance).toBeCloseTo(68.75, 5);
  expect(result.hasteValue).toBe(0.2);
  expect(result.sebasSpeed).toBeCloseTo(93.6, 5);
  expect(result.shockApplied).toBe(true);
  expect(result.firstActionPreserved).toBe(true);
});

test('single-target healing waits for and respects the chosen ally', async ({ page }) => {
  await loadGame(page);
  const result = await page.evaluate(() => {
    window.SC.setTeam([10, 1, 2, 3]); window.SC.startBattle();
    const state = window.SC.state;
    const healer = state.allies.find(unit => unit.name.includes('艾琳'));
    const chosen = state.allies.find(unit => unit.name.includes('洛恩'));
    const lower = state.allies.find(unit => unit.name.includes('汐'));
    chosen.curHp -= 500; lower.curHp = 1;
    state.turnOrder = [healer]; state.curIdx = 0; state.phase = 'player'; healer._acted = false;
    const chosenBefore = chosen.curHp, lowerBefore = lower.curHp;
    window.SC.playerSelectSkill(1);
    const pendingSide = state.target && state.target.side;
    const targetCount = document.querySelectorAll('#target-chips .tgt').length - 1;
    window.SC.resolveTarget(chosen);
    state.battleToken++;
    return { pendingSide, targetCount, chosenGain: chosen.curHp - chosenBefore, lowerGain: lower.curHp - lowerBefore, energy: healer.energy };
  });
  expect(result.pendingSide).toBe('ally');
  expect(result.targetCount).toBe(4);
  expect(result.chosenGain).toBeGreaterThan(0);
  expect(result.lowerGain).toBe(0);
  expect(result.energy).toBe(15);
});

test('fusion DOT keeps source mastery and ice storm uses frostbite', async ({ page }) => {
  await loadGame(page);
  const result = await page.evaluate(() => {
    window.SC.setTeam([0, 2, 4, 1]); window.SC.startBattle();
    const state = window.SC.state;
    const fire = state.allies.find(unit => unit.element === 'fire');
    const water = state.allies.find(unit => unit.element === 'water');
    const wind = state.allies.find(unit => unit.element === 'wind');
    window.SC.setRandomSource(() => 0.99);
    window.SC.FUSION2['fire+water'].apply(fire);
    const burn = state.enemies[0].debuffs.find(status => status.type === 'burn');
    state.enemies = window.SC.ENEMIES[0].map(enemy => window.SC.makeUnit(enemy, true));
    window.SC.FUSION2['water+wind'].apply(water);
    const frostbite = state.enemies[0].debuffs.find(status => status.type === 'frostbite');
    const hasBurn = state.enemies[0].debuffs.some(status => status.type === 'burn');
    window.SC.FUSION2['wind+thunder'].apply(wind);
    const criticalDamageBuffs = state.allies.filter(unit => unit.alive && !unit.isSummon).map(unit => unit.buffs.find(buff => buff.type === 'ctd')?.val);
    window.SC.resetRandomSource(); state.battleToken++;
    return {
      burnSource: burn && { uid: burn.sourceUid, em: burn.sourceEm }, fire: { uid: fire.uid, em: fire.em },
      frostbiteSource: frostbite && { uid: frostbite.sourceUid, em: frostbite.sourceEm }, water: { uid: water.uid, em: water.em },
      hasBurn, criticalDamageBuffs,
    };
  });
  expect(result.burnSource).toEqual(result.fire);
  expect(result.frostbiteSource).toEqual(result.water);
  expect(result.hasBurn).toBe(false);
  expect(result.criticalDamageBuffs).toEqual([0.3, 0.3, 0.3, 0.3]);
});

test('revived units already marked acted are skipped without locking the turn', async ({ page }) => {
  await loadGame(page);
  const result = await page.evaluate(() => {
    window.SC.setTeam([10, 1, 2, 3]); window.SC.startBattle();
    const state = window.SC.state;
    const healer = state.allies[0], fallen = state.allies[1], enemy = state.enemies[0];
    fallen.alive = false; fallen.curHp = 0; fallen._acted = false;
    state.turnOrder = [healer, fallen, enemy]; state.curIdx = 1; state.phase = 'anim';
    window.SC.reviveTeam(); window.SC.processTurn();
    const result = { revived: fallen.alive, acted: fallen._acted, curIdx: state.curIdx, phase: state.phase };
    state.battleToken++;
    return result;
  });
  expect(result).toEqual({ revived: true, acted: true, curIdx: 2, phase: 'enemy' });
});

test('all configured fusions are discoverable regardless of key order', async ({ page }) => {
  await loadGame(page);
  const counts = await page.evaluate(() => ({
    dual: Object.keys(window.SC.FUSION2).filter(key => window.SC.fusionInfo(key.split('+'))).length,
    triple: Object.keys(window.SC.FUSION3).filter(key => window.SC.fusionInfo(key.split('+'))).length,
  }));
  expect(counts).toEqual({ dual: 15, triple: 4 });
});

test('Karl ultimate performs AOE and summons two skeletons', async ({ page }) => {
  await loadGame(page);
  const result = await page.evaluate(async () => {
    window.SC.setTeam([9, 0, 2, 1]);
    window.SC.startBattle();
    const state = window.SC.state;
    const karl = state.allies.find(unit => unit.name.includes('卡尔'));
    state.turnOrder = [karl]; state.curIdx = 0; state.phase = 'player'; karl.energy = 100;
    const before = state.enemies.reduce((sum, enemy) => sum + enemy.curHp, 0);
    window.SC.playerSelectSkill(3);
    const summons = state.allies.filter(unit => unit.isSummon && unit.alive);
    return { before, after: state.enemies.reduce((sum, enemy) => sum + enemy.curHp, 0), summons: summons.length, summonPositions: summons.map(unit => unit.pos) };
  });
  expect(result.after).toBeLessThan(result.before);
  expect(result.summons).toBe(2);
  expect(result.summonPositions).toEqual(['front', 'front']);
});

test('reset isolates sessions and clears battle interaction', async ({ page }) => {
  await loadGame(page);
  const result = await page.evaluate(() => {
    window.SC.startBattle();
    const oldToken = window.SC.state.battleToken;
    resetGame();
    return { oldToken, newToken: window.SC.state.battleToken, phase: window.SC.state.phase, allies: window.SC.state.allies.length, enemies: window.SC.state.enemies.length };
  });
  expect(result.newToken).toBeGreaterThan(result.oldToken);
  expect(result).toMatchObject({ phase: 'idle', allies: 0, enemies: 0 });
  await expect(page.locator('#title-screen')).toHaveClass(/active/);
});

test('critical controls fit the current viewport', async ({ page }) => {
  await loadGame(page);
  await page.evaluate(() => { window.SC.setTeam([1, 2, 8, 10]); window.SC.startBattle(); });
  await expect(page.locator('#battle-screen')).toHaveClass(/active/);
  const layout = await page.evaluate(() => {
    const viewport = { width: innerWidth, height: innerHeight };
    const canvas = document.querySelector('#battle-canvas').getBoundingClientRect();
    const ui = document.querySelector('#battle-ui').getBoundingClientRect();
    const banner = document.querySelector('#turn-banner').getBoundingClientRect();
    const auto = document.querySelector('#auto-battle-btn').getBoundingClientRect();
    const report = document.querySelector('#battle-report-btn').getBoundingClientRect();
    const stageTargets=[...window.SC.state.allies,...window.SC.state.enemies].map(unit=>unit._hit).filter(Boolean);
    return {
      viewport, canvas, ui, banner, auto, report,
      actionsInside: auto.left >= 0 && report.right <= innerWidth && auto.top >= 0 && report.bottom <= innerHeight,
      actionsSeparate: auto.right <= report.left,
      targetsUncovered:stageTargets.every(hit=>canvas.top+hit.bottom<ui.top),
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
  expect(layout.canvas.height).toBeGreaterThanOrEqual(150);
  expect(layout.ui.height).toBeGreaterThanOrEqual(40);expect(layout.ui.height).toBeLessThanOrEqual(248);
  expect(layout.ui.bottom).toBeLessThanOrEqual(layout.viewport.height + 1);
  expect(layout.banner.top).toBeGreaterThanOrEqual(layout.ui.top);expect(layout.banner.bottom).toBeLessThanOrEqual(layout.viewport.height+1);
  expect(layout.actionsInside).toBe(true);
  expect(layout.actionsSeparate).toBe(true);
  expect(layout.targetsUncovered).toBe(true);
  expect(layout.overflow).toBe(false);
  await page.locator('#battle-settings summary').click();await expect(page.locator('.battle-top-actions .danger')).toBeVisible();
});

test('title, town, roster, formation and modals stay usable at supported viewports', async ({ page }) => {
  await loadGame(page);
  const inspect = async (screen, selectors) => page.evaluate(({ screen, selectors }) => {
    const root = document.querySelector(screen), viewport = { width: innerWidth, height: innerHeight };
    const bad = selectors.flatMap(selector => [...root.querySelectorAll(selector)]).filter(element => {
      const style = getComputedStyle(element), rect = element.getBoundingClientRect();
      if (style.display === 'none' || style.visibility === 'hidden' || rect.width === 0 || rect.height === 0) return false;
      return rect.left < -1 || rect.right > viewport.width + 1 || rect.top < -1 || rect.bottom > viewport.height + 1;
    }).map(element => element.textContent.trim().slice(0, 24));
    return { bad, horizontalOverflow: root.scrollWidth > root.clientWidth + 1 };
  }, { screen, selectors });

  expect(await inspect('#title-screen', ['.start-btn', '.title-btns .btn'])).toEqual({ bad: [], horizontalOverflow: false });
  await page.getByRole('button', { name: /进\s*入\s*城\s*镇/ }).click();
  expect(await inspect('#town-screen', ['.screen-header .btn', '.town-main-action'])).toEqual({ bad: [], horizontalOverflow: false });
  await page.getByRole('button', { name: /角色阁/ }).click();
  expect(await inspect('#roster-screen', ['.screen-header .btn'])).toEqual({ bad: [], horizontalOverflow: false });
  await page.locator('.char-card').first().click();
  const detail = await page.locator('.detail-card').evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: innerWidth, height: innerHeight, scrollable: element.scrollHeight > element.clientHeight ? getComputedStyle(element).overflowY === 'auto' : true };
  });
  expect(detail.left).toBeGreaterThanOrEqual(0); expect(detail.right).toBeLessThanOrEqual(detail.width + 1);
  expect(detail.top).toBeGreaterThanOrEqual(0); expect(detail.bottom).toBeLessThanOrEqual(detail.height + 1); expect(detail.scrollable).toBe(true);
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: /组队/ }).click();
  expect(await inspect('#formation-screen', ['.screen-header .btn'])).toEqual({ bad: [], horizontalOverflow: false });
  await page.evaluate(() => openHelp());
  const help = await page.locator('.help-card').evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { inside: rect.left >= 0 && rect.right <= innerWidth + 1 && rect.top >= 0 && rect.bottom <= innerHeight + 1, overflow: getComputedStyle(element).overflowY };
  });
  expect(help.inside).toBe(true); expect(help.overflow).toBe('auto');
});

test.describe('Slice C persistent progression', () => {
  test.describe.configure({ timeout: 90_000 });

  test('wave rewards are persisted once and only active expedition participants gain mastery', async ({ page }) => {
    await loadGame(page);
    const result = await page.evaluate(() => {
      window.SC.resetProgression();
      const tiers = [0, 1, 2, 3].map(clearedWaves => window.SC.progressionRewardFor(clearedWaves));
      const settlements = [];
      for (const clearedWaves of [1, 2, 3]) {
        resetGame();
        window.SC.setAutoBattle(false);
        window.SC.startBattle();
        const state = window.SC.state;
        state.battleToken++;
        state.run.clearedWaves = clearedWaves;
        const participants = [...state.run.participantIds];
        const reserveIds = window.SC.reserveFormationIndices().map(index => window.SC.CHARACTERS[index].id);
        endBattle(clearedWaves === 3);
        const afterSettlement = JSON.parse(JSON.stringify(window.SC.progression));
        const duplicate = window.SC.awardExpeditionProgression();
        const afterDuplicate = JSON.parse(JSON.stringify(window.SC.progression));
        settlements.push({ clearedWaves, participants, reserveIds, afterSettlement, afterDuplicate, duplicate });
      }
      return {
        tiers,
        settlements,
        rewardText: document.querySelector('#result-progression-reward')?.textContent,
        rewardVisible: !document.querySelector('#result-progression-reward')?.hidden,
      };
    });

    expect(result.tiers).toEqual([
      { clearedWaves: 0, ink: 0, elementDust: 0, essence: 0, masteryXp: 0 },
      { clearedWaves: 1, ink: 45, elementDust: 8, essence: 4, masteryXp: 1 },
      { clearedWaves: 2, ink: 100, elementDust: 17, essence: 9, masteryXp: 2 },
      { clearedWaves: 3, ink: 180, elementDust: 25, essence: 15, masteryXp: 3 },
    ]);
    expect(result.settlements.map(item => item.afterSettlement.resources)).toEqual([
      { ink: 45, elementDust: 8, essence: 4 },
      { ink: 145, elementDust: 25, essence: 13 },
      { ink: 325, elementDust: 50, essence: 28 },
    ]);
    for (const settlement of result.settlements) {
      expect(settlement.afterDuplicate).toEqual(settlement.afterSettlement);
      expect(settlement.duplicate.persisted).toBe(true);
    }
    const final = result.settlements.at(-1).afterSettlement;
    expect(final.stats).toEqual({ runs: 3, wins: 1, bestClearedWaves: 3 });
    for (const id of result.settlements[0].participants) expect(final.characters[id].masteryXp).toBe(6);
    for (const id of result.settlements[0].reserveIds) expect(final.characters[id].masteryXp).toBe(0);
    expect(result.rewardVisible).toBe(true);
    expect(result.rewardText).toContain('灵墨 +180');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#title-screen')).toHaveClass(/active/);
    expect(await page.evaluate(() => window.SC.progression)).toEqual(final);
  });

  test('shared codex upgrade survives reload and changes new heroes without scaling enemies', async ({ page }) => {
    await loadGame(page);
    const before = await page.evaluate(() => {
      window.SC.resetProgression();
      const hero = window.SC.makeUnit(window.SC.CHARACTERS[0], false);
      const enemy = window.SC.makeUnit(window.SC.ENEMIES[0][0], true);
      window.SC.state.progression.resources.ink = window.SC.codexUpgradeCost();
      window.SC.saveProgression();
      const upgraded = window.SC.upgradeCodex();
      return {
        upgraded,
        level: window.SC.progression.codexLevel,
        ink: window.SC.progression.resources.ink,
        hero: { hp: hero.maxHp, atk: hero.atk, def: hero.def },
        enemy: { hp: enemy.maxHp, atk: enemy.atk, def: enemy.def },
      };
    });
    expect(before).toMatchObject({ upgraded: true, level: 2, ink: 0 });

    await page.reload({ waitUntil: 'domcontentloaded' });
    const after = await page.evaluate(() => {
      window.SC.setAutoBattle(false);
      window.SC.setTeam([0, 1, 2, 4]);
      window.SC.startBattle();
      window.SC.state.battleToken++;
      const hero = window.SC.state.allies.find(unit => unit.characterIndex === 0);
      const enemy = window.SC.state.enemies[0];
      const source = window.SC.CHARACTERS[0], rarity = window.SC.RARITY[source.rarity].mult;
      return {
        level: window.SC.progression.codexLevel,
        ink: window.SC.progression.resources.ink,
        hero: { hp: hero.maxHp, atk: hero.atk, def: hero.def, codexLevel: hero.codexLevel },
        expected: {
          hp: Math.floor(source.hp * rarity * 1.02),
          atk: Math.floor(source.atk * rarity * 1.02),
          def: Math.floor(source.def * rarity * 1.02),
        },
        enemy: { hp: enemy.maxHp, atk: enemy.atk, def: enemy.def },
      };
    });
    expect(after).toMatchObject({ level: 2, ink: 0 });
    expect(after.hero).toMatchObject({ ...after.expected, codexLevel: 2 });
    expect(after.hero.hp).toBeGreaterThan(before.hero.hp);
    expect(after.hero.atk).toBeGreaterThan(before.hero.atk);
    expect(after.hero.def).toBeGreaterThan(before.hero.def);
    expect(after.enemy).toEqual(before.enemy);
  });

  test('skill refinement changes the runtime multiplier and cooldown and rejects an unaffordable repeat', async ({ page }) => {
    await loadGame(page);
    const result = await page.evaluate(() => {
      window.SC.resetProgression();
      const character = window.SC.CHARACTERS[0];
      const baseActor = window.SC.makeUnit(character, false);
      const baseSkill = { ...baseActor.skills[1] };
      window.SC.state.progression.resources.elementDust = 275;
      window.SC.saveProgression();
      const first = window.SC.upgradeSkill(0, 1);
      const second = window.SC.upgradeSkill(0, 1);
      const balanceAfterTwo = window.SC.progression.resources.elementDust;
      const rejected = window.SC.upgradeSkill(0, 1);
      const upgradedActor = window.SC.makeUnit(character, false);
      const targetData = { name: '强化靶', element: 'wind', hp: 99999, atk: 1, def: 40, spd: 1, res: 100, skills: [] };
      const baseTarget = window.SC.makeUnit(targetData, true);
      const upgradedTarget = window.SC.makeUnit(targetData, true);
      window.SC.setRandomSource(() => 0.99);
      const baseDamage = window.SC.dealDamage(baseActor, baseSkill, baseTarget, true);
      const upgradedDamage = window.SC.dealDamage(upgradedActor, upgradedActor.skills[1], upgradedTarget, true);
      window.SC.resetRandomSource();
      return {
        first, second, rejected, balanceAfterTwo,
        finalBalance: window.SC.progression.resources.elementDust,
        level: window.SC.characterProgress(0).skillLevels[1],
        baseSkill: { mult: baseSkill.mult, cooldown: baseSkill.cooldown },
        upgradedSkill: { mult: upgradedActor.skills[1].mult, cooldown: upgradedActor.skills[1].cooldown },
        baseDamage, upgradedDamage,
      };
    });
    expect(result).toMatchObject({ first: true, second: true, rejected: false, balanceAfterTwo: 0, finalBalance: 0, level: 2 });
    expect(result.baseSkill).toEqual({ mult: 1.5, cooldown: 2 });
    expect(result.upgradedSkill).toEqual({ mult: 1.8, cooldown: 1 });
    expect(result.upgradedDamage).toBeGreaterThan(result.baseDamage * 1.19);

    await page.reload({ waitUntil: 'domcontentloaded' });
    expect(await page.evaluate(() => ({
      level: window.SC.characterProgress(0).skillLevels[1],
      skill: window.SC.buildProgressedSkills(window.SC.CHARACTERS[0])[1],
    }))).toMatchObject({ level: 2, skill: { mult: 1.8, cooldown: 1, upgradeLevel: 2 } });
  });

  test('four core heroes expose two merged branches and their combat hooks are observable', async ({ page }) => {
    await loadGame(page);
    const result = await page.evaluate(() => {
      window.SC.resetProgression();
      window.SC.state.progression.codexLevel = 10;
      const indexes = Object.fromEntries(window.SC.CHARACTERS.map((character, index) => [character.id, index]));
      const merged = {};
      for (const [characterId, branches] of Object.entries(window.SC.EVOLUTION_BRANCHES)) {
        merged[characterId] = branches.map(branch => {
          const progress = window.SC.state.progression.characters[characterId];
          progress.unlockedBranches = [branch.id];
          progress.activeBranch = branch.id;
          const skill = window.SC.buildProgressedSkills(window.SC.CHARACTERS[indexes[characterId]])[branch.skillIndex];
          return { id: branch.id, skillIndex: branch.skillIndex, skill };
        });
      }

      const prepare = (characterId, branchId) => {
        resetGame();
        window.SC.setAutoBattle(false);
        const index = indexes[characterId];
        const progress = window.SC.state.progression.characters[characterId];
        progress.unlockedBranches = [branchId];
        progress.activeBranch = branchId;
        const team = [index, 0, 1, 2, 4].filter((value, position, values) => values.indexOf(value) === position).slice(0, 4);
        window.SC.setTeam(team);
        window.SC.startBattle();
        const state = window.SC.state;
        state.battleToken++;
        const actor = state.allies.find(unit => unit.characterIndex === index);
        state.turnOrder = [actor]; state.curIdx = 0; state.phase = 'player'; actor._acted = false;
        return { state, actor };
      };

      let battle = prepare('H1', 'h1_wildfire');
      const wildfireBefore = battle.state.enemies.map(enemy => enemy.curHp);
      window.SC.playerSelectSkill(1);
      const wildfire = {
        damagedAll: battle.state.enemies.every((enemy, index) => enemy.curHp < wildfireBefore[index]),
        burnedAll: battle.state.enemies.every(enemy => window.SC.hasStatus(enemy, 'burn')),
      };

      battle = prepare('H2', 'h2_bulwark');
      window.SC.playerSelectSkill(1);
      const buffedTarget = battle.state.allies.find(unit => unit.characterIndex === 0);
      const unbuffedTarget = { ...buffedTarget, uid: -1001, curHp: buffedTarget.maxHp, shield: 0, buffs: [], debuffs: [], alive: true };
      const attacker = battle.state.enemies[0];
      window.SC.setRandomSource(() => 0.99);
      const unbuffedDamage = window.SC.dealDamage(attacker, { name: '减伤校验', mult: 1 }, unbuffedTarget, false, { ignoreShield: true, noCounter: true });
      const buffedDamage = window.SC.dealDamage(attacker, { name: '减伤校验', mult: 1 }, buffedTarget, false, { ignoreShield: true, noCounter: true });
      window.SC.resetRandomSource();
      const bulwark = {
        shieldedAll: battle.state.allies.filter(unit => !unit.isSummon).every(unit => unit.shield > 0),
        defenseBuffedAll: battle.state.allies.filter(unit => !unit.isSummon).every(unit => unit.buffs.some(buff => buff.type === 'def' && buff.val === 0.15)),
        unbuffedDamage,
        buffedDamage,
      };

      battle = prepare('W1', 'w1_frost');
      window.SC.setRandomSource(() => 0.99);
      window.SC.playerSelectSkill(2);
      window.SC.resetRandomSource();
      const frost = { slowedAll: battle.state.enemies.every(enemy => window.SC.hasStatus(enemy, 'slow')) };

      battle = prepare('A1', 'a1_eagles');
      window.SC.playerSelectSkill(1);
      const summons = battle.state.allies.filter(unit => unit.alive && unit.isSummon);
      const eagles = {
        count: summons.length,
        allStrengthened: summons.every(unit => unit.atk > window.SC.SUMMONS.wind_eagle.atk),
        durations: summons.map(unit => unit.remainingRounds),
      };

      battle = prepare('H1', 'h1_windhunt');
      const windhuntTarget = window.SC.makeUnit({ name: '追猎靶', element: 'dark', hp: 99999, atk: 1, def: 40, spd: 1, res: 0, skills: [] }, true);
      const windhuntProbe = window.SC.makeUnit({ name: '单段靶', element: 'dark', hp: 99999, atk: 1, def: 40, spd: 1, res: 0, skills: [] }, true);
      battle.state.enemies = [windhuntTarget];
      window.SC.setRandomSource(() => 0.5);
      const windhuntSingle = window.SC.dealDamage(battle.actor, { ...battle.actor.skills[1], hits: 1 }, windhuntProbe, true);
      window.SC.playerSelectSkill(1); window.SC.resolveTarget(windhuntTarget);
      window.SC.resetRandomSource();
      const windhunt = { single: windhuntSingle, actual: windhuntTarget.maxHp - windhuntTarget.curHp };

      battle = prepare('H2', 'h2_vanguard');
      const vanguardBefore = battle.state.enemies.map(enemy => enemy.curHp);
      window.SC.setRandomSource(() => 0.99);
      window.SC.playerSelectSkill(2);
      window.SC.resetRandomSource();
      const vanguard = {
        damagedAll: battle.state.enemies.every((enemy, index) => enemy.curHp < vanguardBefore[index]),
        brokenAll: battle.state.enemies.every(enemy => window.SC.hasStatus(enemy, 'defBreak')),
      };

      battle = prepare('W1', 'w1_spring');
      const springBefore = battle.state.allies.map(unit => {
        unit.curHp = Math.max(1, unit.curHp - 100);
        unit.debuffs.push({ type: 'slow', turns: 2 });
        return unit.curHp;
      });
      window.SC.playerSelectSkill(1);
      const spring = {
        healedAll: battle.state.allies.every((unit, index) => unit.curHp > springBefore[index]),
        cleansedAll: battle.state.allies.every(unit => unit.debuffs.length === 0),
      };

      battle = prepare('A1', 'a1_hunt');
      battle.state.enemies = [0, 1, 2].map(index => window.SC.makeUnit({ name: `猎杀靶${index}`, element: 'thunder', hp: 99999, atk: 1, def: 40, spd: 1, res: 0, skills: [] }, true));
      const huntProbe = window.SC.makeUnit({ name: '单段风刃靶', element: 'thunder', hp: 99999, atk: 1, def: 40, spd: 1, res: 0, skills: [] }, true);
      const huntBefore = battle.state.enemies.map(enemy => enemy.curHp);
      window.SC.setRandomSource(() => 0.5);
      const huntSingle = window.SC.dealDamage(battle.actor, { ...battle.actor.skills[2], hits: 1, status: null }, huntProbe, true);
      window.SC.playerSelectSkill(2);
      window.SC.resetRandomSource();
      const hunt = {
        single: huntSingle,
        firstActual: huntBefore[0] - battle.state.enemies[0].curHp,
        damagedAll: battle.state.enemies.every((enemy, index) => enemy.curHp < huntBefore[index]),
        slowedAll: battle.state.enemies.every(enemy => window.SC.hasStatus(enemy, 'slow')),
      };
      battle.state.battleToken++;
      return { merged, wildfire, bulwark, frost, eagles, windhunt, vanguard, spring, hunt };
    });

    expect(Object.keys(result.merged).sort()).toEqual(['A1', 'H1', 'H2', 'W1']);
    for (const branches of Object.values(result.merged)) expect(branches).toHaveLength(2);
    expect(result.merged.H1[0]).toMatchObject({ id: 'h1_wildfire', skill: { type: 'aoe', mult: 1.1, dot: 'burn' } });
    expect(result.merged.H1[1]).toMatchObject({ id: 'h1_windhunt', skill: { type: 'attack', mult: 0.85, hits: 2 } });
    expect(result.merged.H2[0]).toMatchObject({ id: 'h2_bulwark', skill: { shieldPct: 0.25, buff: { type: 'def', val: 0.15, turns: 2 } } });
    expect(result.merged.H2[1]).toMatchObject({ id: 'h2_vanguard', skill: { type: 'aoe', status: 'defBreak' } });
    expect(result.merged.W1[0]).toMatchObject({ id: 'w1_spring', skill: { healPct: 0.24, cleanse: true } });
    expect(result.merged.W1[1]).toMatchObject({ id: 'w1_frost', skill: { evolutionControl: 'frostwave' } });
    expect(result.merged.A1[0]).toMatchObject({ id: 'a1_eagles', skill: { summonCount: 2, summonAtkMultiplier: 1.25, summonDurationDelta: 1 } });
    expect(result.merged.A1[1]).toMatchObject({ id: 'a1_hunt', skill: { type: 'aoe', mult: 0.7, hits: 2 } });
    expect(result.wildfire).toEqual({ damagedAll: true, burnedAll: true });
    expect(result.bulwark.shieldedAll).toBe(true);
    expect(result.bulwark.defenseBuffedAll).toBe(true);
    expect(result.bulwark.buffedDamage).toBeLessThan(result.bulwark.unbuffedDamage);
    expect(result.frost).toEqual({ slowedAll: true });
    expect(result.eagles).toEqual({ count: 2, allStrengthened: true, durations: [4, 4] });
    expect(result.windhunt.actual).toBe(result.windhunt.single * 2);
    expect(result.vanguard).toEqual({ damagedAll: true, brokenAll: true });
    expect(result.spring).toEqual({ healedAll: true, cleansedAll: true });
    expect(result.hunt.firstActual).toBe(result.hunt.single * 2);
    expect(result.hunt).toMatchObject({ damagedAll: true, slowedAll: true });
  });

  test('evolution purchase API is atomic and UI comparison does not charge before confirmation', async ({ page }) => {
    await loadGame(page);
    const api = await page.evaluate(() => {
      window.SC.resetProgression();
      window.SC.state.progression.codexLevel = 10;
      window.SC.state.progression.resources.essence = 220;
      window.SC.saveProgression();
      const first = window.SC.chooseEvolution(0, 'h1_wildfire');
      const afterFirst = window.SC.progression.resources.essence;
      const duplicate = window.SC.chooseEvolution(0, 'h1_wildfire');
      const afterDuplicate = window.SC.progression.resources.essence;
      const second = window.SC.chooseEvolution(0, 'h1_windhunt');
      const afterSecond = window.SC.progression.resources.essence;
      const switched = window.SC.chooseEvolution(0, 'h1_wildfire');
      const afterSwitch = window.SC.progression.resources.essence;
      const duplicateSwitch = window.SC.chooseEvolution(0, 'h1_wildfire');
      const afterDuplicateSwitch = window.SC.progression.resources.essence;
      const unaffordable = window.SC.chooseEvolution(1, 'h2_bulwark');
      return {
        first, duplicate, second, switched, duplicateSwitch, unaffordable,
        balances: [afterFirst, afterDuplicate, afterSecond, afterSwitch, afterDuplicateSwitch, window.SC.progression.resources.essence],
        active: window.SC.characterProgress(0).activeBranch,
        unlocked: [...window.SC.characterProgress(0).unlockedBranches],
      };
    });
    expect(api).toEqual({
      first: true, duplicate: false, second: true, switched: true, duplicateSwitch: false, unaffordable: false,
      balances: [120, 120, 20, 10, 10, 10],
      active: 'h1_wildfire', unlocked: ['h1_wildfire', 'h1_windhunt'],
    });

    await page.evaluate(() => {
      window.SC.resetProgression();
      window.SC.state.progression.codexLevel = 10;
      window.SC.state.progression.resources.essence = 100;
      window.SC.saveProgression();
      window.SC.openProgression(0);
    });
    await expect(page.locator('#progression-screen')).toHaveClass(/active/);
    const branch = page.locator('.evolution-branch[data-branch-id="h1_wildfire"]');
    await branch.click();
    expect(await page.evaluate(() => ({
      essence: window.SC.progression.resources.essence,
      active: window.SC.characterProgress(0).activeBranch,
      pending: window.SC.state.progressionPendingBranchId,
    }))).toEqual({ essence: 100, active: null, pending: 'h1_wildfire' });
    await expect(page.locator('#evolution-cost')).toContainText('100');
    await expect(page.locator('#confirm-evolution-btn')).toBeEnabled();
    await page.locator('#confirm-evolution-btn').click();
    expect(await page.evaluate(() => ({
      essence: window.SC.progression.resources.essence,
      active: window.SC.characterProgress(0).activeBranch,
      unlocked: window.SC.characterProgress(0).unlockedBranches,
    }))).toEqual({ essence: 0, active: 'h1_wildfire', unlocked: ['h1_wildfire'] });
  });

  test('retry and reset clear only the run while keeping earned cross-run progression', async ({ page }) => {
    await loadGame(page);
    const result = await page.evaluate(() => {
      window.SC.resetProgression();
      window.SC.state.progression.resources.ink = 77;
      window.SC.saveProgression();
      window.SC.setAutoBattle(false);
      window.SC.startBattle();
      window.SC.state.battleToken++;
      window.SC.state.run.clearedWaves = 1;
      endBattle(false);
      const earned = JSON.parse(JSON.stringify(window.SC.progression));
      const retried = window.SC.retryBattle(false);
      window.SC.state.battleToken++;
      const afterRetry = JSON.parse(JSON.stringify(window.SC.progression));
      resetGame();
      const afterReset = JSON.parse(JSON.stringify(window.SC.progression));
      return { earned, retried, afterRetry, afterReset, runAfterReset: window.SC.state.run };
    });
    expect(result.earned.resources.ink).toBe(122);
    expect(result.retried).toBe(true);
    expect(result.afterRetry).toEqual(result.earned);
    expect(result.afterReset).toEqual(result.earned);
    expect(result.runAfterReset).toBeNull();

    await page.reload({ waitUntil: 'domcontentloaded' });
    expect(await page.evaluate(() => window.SC.progression)).toEqual(result.earned);
  });

  test('progression remains horizontally contained and actionable at 360 by 640', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await loadGame(page);
    await page.evaluate(() => {
      window.SC.resetProgression();
      window.SC.state.progression.codexLevel = 10;
      Object.assign(window.SC.state.progression.resources, { ink: 500, elementDust: 500, essence: 200 });
      window.SC.saveProgression();
      window.SC.openProgression(0);
    });
    await expect(page.locator('#progression-screen')).toHaveClass(/active/);
    await expect(page.locator('#progression-roster .progression-character')).toHaveCount(12);
    const lastCharacterName = await page.evaluate(() => window.SC.CHARACTERS.at(-1).name);
    await page.locator('#progression-roster .progression-character').last().click();
    await expect(page.locator('#progression-name')).toHaveText(lastCharacterName);
    await page.locator('#progression-roster .progression-character').nth(1).click();
    await expect(page.locator('#progression-name')).toContainText('洛恩');
    const levelBefore = await page.evaluate(() => window.SC.progression.codexLevel);
    await page.locator('#upgrade-codex-btn').click();
    expect(await page.evaluate(() => window.SC.progression.codexLevel)).toBe(levelBefore + 1);

    const layout = await page.evaluate(() => {
      const root = document.querySelector('#progression-screen');
      const roster = document.querySelector('#progression-roster'), rosterRect = roster.getBoundingClientRect();
      const controls = [...root.querySelectorAll('.screen-header .btn, #upgrade-codex-btn, .skill-upgrade-btn, .evolution-branch, #confirm-evolution-btn')]
        .filter(element => {
          const style = getComputedStyle(element), rect = element.getBoundingClientRect();
          return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        });
      return {
        screenOverflow: root.scrollWidth > root.clientWidth + 1,
        documentOverflow: document.documentElement.scrollWidth > innerWidth + 1,
        rosterScroller: {
          contained: rosterRect.left >= -1 && rosterRect.right <= innerWidth + 1,
          hasOverflow: roster.scrollWidth > roster.clientWidth,
          overflowX: getComputedStyle(roster).overflowX,
        },
        clipped: controls.filter(element => {
          const rect = element.getBoundingClientRect();
          return rect.left < -1 || rect.right > innerWidth + 1;
        }).map(element => element.id || element.dataset.branchId || element.dataset.characterIndex || element.className),
      };
    });
    expect(layout).toEqual({
      screenOverflow: false,
      documentOverflow: false,
      rosterScroller: { contained: true, hasOverflow: true, overflowX: 'auto' },
      clipped: [],
    });
  });
});

test.describe('Slice D expedition rules and tactical auto battle', () => {
  test.describe.configure({ timeout: 90_000 });

  test('three difficulties, six contracts and three auto strategies form a validated rule set with a hard contract cap', async ({ page }) => {
    await loadGame(page);
    const result = await page.evaluate(() => {
      window.SC.resetProgression();
      const difficultyIds = window.SC.EXPEDITION_DIFFICULTIES.map(item => item.id);
      const contractIds = window.SC.EXPEDITION_CONTRACTS.map(item => item.id);
      const strategyIds = window.SC.AUTO_STRATEGIES.map(item => item.id);
      const selected = contractIds.slice(0, 3).map(id => window.SC.toggleExpeditionContract(id));
      const rejectedFourth = window.SC.toggleExpeditionContract(contractIds[3]);
      const rejectedUnknown = window.SC.toggleExpeditionContract('unknown-contract');
      const challenge = window.SC.setDifficulty('challenge');
      const alchemy = window.SC.setAutoStrategy('alchemy');
      return {
        difficultyIds, contractIds, strategyIds, selected, rejectedFourth, rejectedUnknown, challenge, alchemy,
        settings: JSON.parse(JSON.stringify(window.SC.progression.settings)),
        currentDifficulty: window.SC.currentDifficulty().id,
        currentContracts: window.SC.currentContracts().map(item => item.id),
        rewardMultiplier: window.SC.expeditionRewardMultiplier(),
        summary: document.querySelector('#expedition-config-summary')?.textContent,
        contractSummary: document.querySelector('#contract-summary')?.textContent,
      };
    });

    expect(result.difficultyIds).toEqual(['story', 'standard', 'challenge']);
    expect(result.contractIds).toEqual(['ironhide', 'enemy_haste', 'scarce_healing', 'fragile_shields', 'burning_ground', 'sealed_arts']);
    expect(result.strategyIds).toEqual(['assault', 'steady', 'alchemy']);
    expect(result.selected).toEqual([true, true, true]);
    expect(result).toMatchObject({ rejectedFourth: false, rejectedUnknown: false, challenge: true, alchemy: true });
    expect(result.settings).toMatchObject({
      difficultyId: 'challenge',
      contractIds: ['ironhide', 'enemy_haste', 'scarce_healing'],
      autoStrategyId: 'alchemy',
    });
    expect(result.currentDifficulty).toBe('challenge');
    expect(result.currentContracts).toEqual(result.settings.contractIds);
    expect(result.rewardMultiplier).toBe(1.931);
    expect(result.summary).toContain('挑战');
    expect(result.summary).toContain('炼成');
    expect(result.contractSummary).toContain('3/3');
  });

  test('difficulty and enemy-stat contracts scale real spawned enemies while the run snapshots its reward rules', async ({ page }) => {
    await loadGame(page);
    const result = await page.evaluate(() => {
      window.SC.resetProgression();
      const source = window.SC.ENEMIES[0][0];
      const base = window.SC.makeUnit(source, true);
      const scaled = {};
      for (const id of ['story', 'standard', 'challenge']) {
        window.SC.setDifficulty(id);
        const enemy = window.SC.makeExpeditionEnemy(source);
        scaled[id] = { hp: enemy.maxHp, atk: enemy.atk, def: enemy.def, spd: enemy.spd };
      }

      window.SC.toggleExpeditionContract('ironhide');
      window.SC.toggleExpeditionContract('enemy_haste');
      window.SC.setAutoBattle(false);
      window.SC.startBattle();
      const state = window.SC.state;
      state.battleToken++;
      const spawned = state.enemies[0];
      const snapshot = JSON.parse(JSON.stringify(state.run.expeditionConfig));
      const multiplier = window.SC.expeditionRewardMultiplier(snapshot);
      const reward = window.SC.progressionRewardFor(3, multiplier);
      const mutationsDuringBattle = {
        difficulty: window.SC.setDifficulty('story'),
        contract: window.SC.toggleExpeditionContract('scarce_healing'),
        seedMode: window.SC.setSeedMode('daily'),
      };
      return {
        base: { hp: base.maxHp, atk: base.atk, def: base.def, spd: base.spd },
        scaled,
        spawned: { hp: spawned.maxHp, atk: spawned.atk, def: spawned.def, spd: spawned.spd },
        snapshot, multiplier, reward, mutationsDuringBattle,
      };
    });

    const { base } = result;
    expect(result.scaled.story).toEqual({
      hp: Math.floor(base.hp * 0.82), atk: Math.floor(base.atk * 0.85), def: Math.floor(base.def * 0.90), spd: Math.floor(base.spd * 0.96),
    });
    expect(result.scaled.standard).toEqual(base);
    expect(result.scaled.challenge).toEqual({
      hp: Math.floor(base.hp * 1.25), atk: Math.floor(base.atk * 1.20), def: Math.floor(base.def * 1.10), spd: Math.floor(base.spd * 1.08),
    });
    expect(result.snapshot).toEqual({ difficultyId: 'challenge', contractIds: ['ironhide', 'enemy_haste'], seedMode: 'random' });
    expect(result.spawned).toEqual({
      hp: Math.floor(base.hp * 1.25 * 1.25),
      atk: Math.floor(base.atk * 1.20 * 1.10),
      def: Math.floor(base.def * 1.10),
      spd: Math.floor(base.spd * 1.08 * 1.18),
    });
    expect(result.multiplier).toBe(1.823);
    expect(result.reward).toEqual({ clearedWaves: 3, ink: 328, elementDust: 46, essence: 27, masteryXp: 3 });
    expect(result.mutationsDuringBattle).toEqual({ difficulty: false, contract: false, seedMode: false });
  });

  test('daily expedition seed and seeded random streams reproduce the same actual run offers', async ({ page }) => {
    await loadGame(page);
    const result = await page.evaluate(() => {
      window.SC.resetProgression();
      const sequence = seed => {
        const next = window.SC.createSeededRandom(seed);
        return Array.from({ length: 8 }, () => next());
      };
      const captureFirstChoice = () => {
        const state = window.SC.state;
        state.battleToken++;
        state.enemies = [];
        state.phase = 'anim';
        window.SC.completeWave();
        return {
          seedInfo: JSON.parse(JSON.stringify(state.run.seedInfo)),
          offers: state.run.formulaOffers.map(item => item.id),
          intents: state.allies.map(unit => unit.uid),
        };
      };
      resetGame();
      window.SC.setSeedMode('daily');
      window.SC.setAutoBattle(false);
      window.SC.startBattle();
      const first = captureFirstChoice();
      endBattle(false);
      const retried = window.SC.retryBattle(false);
      const retry = captureFirstChoice();
      endBattle(false);
      resetGame();
      window.SC.setAutoBattle(false);
      window.SC.startBattle();
      const fresh = captureFirstChoice();
      return {
        fixedKey: window.SC.dailySeedKey('2026-09-05'),
        a: sequence(0xC0FFEE),
        b: sequence(0xC0FFEE),
        c: sequence(0xC0FFEF),
        first, retry, fresh, retried,
      };
    });

    expect(result.fixedKey).toBe('2026-09-05');
    expect(result.a).toEqual(result.b);
    expect(result.c).not.toEqual(result.a);
    expect(result.retried).toBe(true);
    expect(result.first.seedInfo).toEqual(result.retry.seedInfo);
    expect(result.first.seedInfo).toEqual(result.fresh.seedInfo);
    expect(result.first.seedInfo.mode).toBe('daily');
    expect(result.first.offers).toEqual(result.retry.offers);
    expect(result.first.offers).toEqual(result.fresh.offers);
    expect(result.first.offers).toHaveLength(3);
  });

  test('healing, shield and cooldown contracts alter their real shared combat pipelines', async ({ page }) => {
    await loadGame(page);
    const result = await page.evaluate(() => {
      const probe = contractId => {
        resetGame();
        window.SC.resetProgression();
        if (contractId) window.SC.toggleExpeditionContract(contractId);
        window.SC.setAutoBattle(false);
        window.SC.setTeam([1, 2, 8, 10]);
        window.SC.startBattle();
        const state = window.SC.state;
        state.battleToken++;
        const healer = state.allies.find(unit => unit.characterIndex === 2);
        const target = state.allies.find(unit => unit.characterIndex === 1);
        state.turnOrder = [healer]; state.curIdx = 0; state.phase = 'player'; healer._acted = false;
        state.allies.filter(unit => !unit.isSummon).forEach(unit => { unit.curHp = Math.floor(unit.maxHp * 0.4); });
        const hpBefore = target.curHp;
        window.SC.playerSelectSkill(1);
        const healed = target.curHp - hpBefore;
        const cooldown = window.SC.skillCooldown(healer, healer.skills[1], 1);
        const shieldTarget = state.allies.find(unit => unit.characterIndex === 8);
        shieldTarget.shield = 0;
        const shieldRequested = Math.floor(shieldTarget.maxHp * 0.2);
        const shielded = window.SC.addShieldToUnit(shieldTarget, shieldRequested);
        state.battleToken++;
        return { healed, cooldown, shielded, shieldRequested };
      };
      return {
        baseline: probe(null),
        scarceHealing: probe('scarce_healing'),
        fragileShields: probe('fragile_shields'),
        sealedArts: probe('sealed_arts'),
      };
    });

    expect(result.scarceHealing.healed).toBe(Math.floor(result.baseline.healed * 0.7));
    expect(result.fragileShields.shielded).toBe(Math.floor(result.baseline.shielded * 0.7));
    expect(result.baseline.cooldown).toBe(2);
    expect(result.sealedArts.cooldown).toBe(3);
    expect(result.fragileShields.healed).toBe(result.baseline.healed);
    expect(result.scarceHealing.shielded).toBe(result.baseline.shielded);
  });

  test('fusion lock lasts two round endings and a triple fusion is limited to once per expedition', async ({ page }) => {
    await loadGame(page);
    const result = await page.evaluate(() => {
      window.SC.resetProgression();
      window.SC.setAutoBattle(false);
      window.SC.setTeam([0, 2, 4, 1]);
      window.SC.startBattle();
      const state = window.SC.state;
      state.battleToken++;
      const actor = state.allies.find(unit => unit.characterIndex === 0);
      actor.energy = actor.maxEnergy;
      state.allies.filter(unit => unit !== actor && !unit.isSummon).forEach(unit => { unit.energy = unit.maxEnergy; });
      state.turnOrder = [actor]; state.curIdx = 0; state.phase = 'player'; actor._acted = false;
      const before = window.SC.listFusionActions(actor);
      const triple = before.find(action => action.assistantUids.length === 2);
      const validBefore = window.SC.validateFusionAction(triple);
      const executed = window.SC.executeFusionAction(triple, { source: 'manual' });
      const afterUse = {
        lock: state.run.fusionLockRounds,
        tripleUsed: state.run.tripleFusionUsed,
        fusions: state.run.stats.fusions,
        actorEnergy: actor.energy,
        assistantEnergy: triple.assistantUids.map(uid => state.allies.find(unit => unit.uid === uid).energy),
      };

      actor._acted = false; actor.energy = actor.maxEnergy; state.phase = 'player';
      const duringLock = window.SC.listFusionActions(actor).length;
      processDOT();
      const afterOneRound = { lock: state.run.fusionLockRounds, actions: window.SC.listFusionActions(actor).length };
      processDOT();
      const afterTwoRounds = window.SC.listFusionActions(actor);
      const staleTripleValid = window.SC.validateFusionAction(triple);
      state.battleToken++;
      return {
        beforeCount: before.length,
        tripleAssistants: triple?.assistantUids.length,
        validBefore, executed, afterUse, duringLock, afterOneRound,
        afterTwoRounds: { lock: state.run.fusionLockRounds, count: afterTwoRounds.length, assistantCounts: afterTwoRounds.map(action => action.assistantUids.length) },
        staleTripleValid,
      };
    });

    expect(result.beforeCount).toBeGreaterThan(0);
    expect(result).toMatchObject({ tripleAssistants: 2, validBefore: true, executed: true, duringLock: 0, staleTripleValid: false });
    expect(result.afterUse).toEqual({ lock: 2, tripleUsed: true, fusions: 1, actorEnergy: 0, assistantEnergy: [80, 80] });
    expect(result.afterOneRound).toEqual({ lock: 1, actions: 0 });
    expect(result.afterTwoRounds.lock).toBe(0);
    expect(result.afterTwoRounds.count).toBeGreaterThan(0);
    expect(result.afterTwoRounds.assistantCounts.every(count => count === 1)).toBe(true);
  });

  test('assault, steady and alchemy produce distinct legal decisions and alchemy performs a real auto fusion', async ({ page }) => {
    await loadGame(page);
    const result = await page.evaluate(() => {
      window.SC.resetProgression();
      const prepare = strategyId => {
        resetGame();
        window.SC.setAutoBattle(false);
        window.SC.setAutoStrategy(strategyId);
        window.SC.setTeam([1, 2, 8, 10]);
        window.SC.startBattle();
        const state = window.SC.state;
        state.battleToken++;
        const actor = state.allies.find(unit => unit.characterIndex === 1);
        state.turnOrder = [actor]; state.curIdx = 0; state.phase = 'player'; actor._acted = false;
        actor.cooldowns = actor.cooldowns.map(() => 0); actor.energy = 0;
        state.allies.forEach(unit => { unit.curHp = unit.maxHp; unit.shield = 0; });
        const injured = state.allies.find(unit => unit !== actor && !unit.isSummon);
        injured.curHp = Math.floor(injured.maxHp * 0.9);
        renderAll();
        return { state, actor };
      };

      let battle = prepare('assault');
      const assault = window.SC.chooseAutoAction(battle.actor);
      const assaultChoice = { index: assault?.index, type: assault?.skill?.type, name: assault?.skill?.name };

      battle = prepare('steady');
      const steady = window.SC.chooseAutoAction(battle.actor);
      const steadyChoice = { index: steady?.index, type: steady?.skill?.type, name: steady?.skill?.name };

      battle = prepare('alchemy');
      battle.actor.energy = battle.actor.maxEnergy;
      battle.state.allies.filter(unit => unit.alive && !unit.isSummon && unit !== battle.actor).forEach(unit => { unit.energy = unit.maxEnergy; });
      const fusionActions = window.SC.listFusionActions(battle.actor);
      window.SC.setAutoBattle(true);
      const ran = window.SC.runAutoDecision(battle.actor, window.SC.autoDecisionToken);
      const alchemy = {
        ran,
        actionCount: fusionActions.length,
        actorEnergy: battle.actor.energy,
        actorActed: battle.actor._acted,
        fusions: battle.state.run.stats.fusions,
        autoFusions: battle.state.run.stats.autoFusions,
        assistantsBelowFull: battle.state.allies.filter(unit => unit !== battle.actor && !unit.isSummon).filter(unit => unit.energy < unit.maxEnergy).length,
        criticalModalOpen: !document.querySelector('#critical-decision-modal').hidden,
      };
      battle.state.battleToken++;
      return { assaultChoice, steadyChoice, alchemy };
    });

    expect(result.assaultChoice).toMatchObject({ index: 2, type: 'attack', name: '爆燃冲锋' });
    expect(result.steadyChoice).toMatchObject({ index: 1, type: 'shield', name: '熔岩护盾' });
    expect(result.alchemy).toMatchObject({
      ran: true, actorEnergy: 0, actorActed: true, fusions: 1, autoFusions: 1, criticalModalOpen: false,
    });
    expect(result.alchemy.actionCount).toBeGreaterThan(0);
    expect(result.alchemy.assistantsBelowFull).toBeGreaterThan(0);
  });

  test('assault preserves the legacy ultimate path even when fusion is legal', async ({ page }) => {
    await loadGame(page);
    const result = await page.evaluate(() => {
      window.SC.resetProgression();
      window.SC.setAutoBattle(false);
      window.SC.setAutoStrategy('assault');
      window.SC.setTeam([0, 2, 8, 10]);
      window.SC.startBattle();
      const state = window.SC.state;
      state.battleToken++;
      const actor = state.allies.find(unit => unit.characterIndex === 0);
      state.turnOrder = [actor]; state.curIdx = 0; state.phase = 'player'; actor._acted = false;
      actor.energy = actor.maxEnergy;
      state.allies.filter(unit => unit !== actor && !unit.isSummon).forEach(unit => { unit.energy = unit.maxEnergy; });
      const legalFusions = window.SC.listFusionActions(actor).length;
      const enemyHpBefore = state.enemies.reduce((sum, enemy) => sum + enemy.curHp, 0);
      window.SC.setAutoBattle(true);
      const ran = window.SC.runAutoDecision(actor, window.SC.autoDecisionToken);
      const snapshot = {
        ran,
        legalFusions,
        actorActed: actor._acted,
        actorEnergy: actor.energy,
        enemyHpBefore,
        enemyHpAfter: state.enemies.reduce((sum, enemy) => sum + enemy.curHp, 0),
        fusions: state.run.stats.fusions,
        autoFusions: state.run.stats.autoFusions,
        modalOpen: !document.querySelector('#critical-decision-modal').hidden,
      };
      state.battleToken++;
      return snapshot;
    });

    expect(result.legalFusions).toBeGreaterThan(0);
    expect(result).toMatchObject({ ran: true, actorActed: true, actorEnergy: 0, fusions: 0, autoFusions: 0, modalOpen: false });
    expect(result.enemyHpAfter).toBeLessThan(result.enemyHpBefore);
  });

  test('steady strategy pauses at a boss critical node and all three resolutions are executable', async ({ page }) => {
    await loadGame(page);
    const result = await page.evaluate(() => {
      window.SC.resetProgression();
      const prepare = () => {
        resetGame();
        window.SC.setAutoBattle(false);
        window.SC.setAutoStrategy('steady');
        window.SC.setTeam([0, 2, 8, 10]);
        window.SC.startBattle();
        const state = window.SC.state;
        state.battleToken++;
        const actor = state.allies.find(unit => unit.characterIndex === 0);
        actor.energy = actor.maxEnergy;
        state.allies.filter(unit => unit !== actor && !unit.isSummon).forEach(unit => { unit.energy = unit.maxEnergy; });
        const boss = window.SC.makeExpeditionEnemy(window.SC.ENEMIES[2][0]);
        boss.charging = { skillIndex: 1, turns: 1 };
        boss.plannedIntent = { skillIndex: 1, label: '蓄力中：混沌风暴', type: 'release', targetRule: 'allEnemies', isRelease: true };
        state.enemies = [boss]; state.turnOrder = [actor]; state.curIdx = 0; state.phase = 'player'; actor._acted = false;
        renderAll();
        const detected = window.SC.detectCriticalDecision(actor);
        window.SC.setAutoBattle(true);
        const paused = window.SC.runAutoDecision(actor, window.SC.autoDecisionToken);
        return { state, actor, detected, paused };
      };

      let battle = prepare();
      const beforeManual = {
        detected: !!battle.detected,
        paused: battle.paused,
        actorActed: battle.actor._acted,
        modalOpen: !document.querySelector('#critical-decision-modal').hidden,
        pauses: battle.state.run.stats.criticalPauses,
      };
      const manualResolved = window.SC.resolveCriticalDecision('manual');
      const manual = {
        resolved: manualResolved,
        autoBattle: window.SC.autoBattle,
        actorActed: battle.actor._acted,
        modalOpen: !document.querySelector('#critical-decision-modal').hidden,
      };
      battle.state.battleToken++;

      battle = prepare();
      window.SC.setAutoBattle(true);
      window.SC.runAutoDecision(battle.actor, window.SC.autoDecisionToken);
      const recommendedResolved = window.SC.resolveCriticalDecision('recommended');
      const recommended = {
        resolved: recommendedResolved,
        actorActed: battle.actor._acted,
        fusions: battle.state.run.stats.fusions,
        autoFusions: battle.state.run.stats.autoFusions,
        modalOpen: !document.querySelector('#critical-decision-modal').hidden,
      };
      battle.state.battleToken++;

      battle = prepare();
      window.SC.setAutoBattle(true);
      window.SC.runAutoDecision(battle.actor, window.SC.autoDecisionToken);
      const continueResolved = window.SC.resolveCriticalDecision('continue');
      const continued = {
        resolved: continueResolved,
        autoBattle: window.SC.autoBattle,
        actorActed: battle.actor._acted,
        fusions: battle.state.run.stats.fusions,
        modalOpen: !document.querySelector('#critical-decision-modal').hidden,
      };
      battle.state.battleToken++;
      return { beforeManual, manual, recommended, continued };
    });

    expect(result.beforeManual).toEqual({ detected: true, paused: true, actorActed: false, modalOpen: true, pauses: 1 });
    expect(result.manual).toEqual({ resolved: true, autoBattle: false, actorActed: false, modalOpen: false });
    expect(result.recommended).toEqual({ resolved: true, actorActed: true, fusions: 1, autoFusions: 0, modalOpen: false });
    expect(result.continued).toEqual({ resolved: true, autoBattle: true, actorActed: true, fusions: 0, modalOpen: false });
  });

  test('audit: conductive tide extends only its matching water-thunder fusion lock from two to three round endings', async ({ page }) => {
    await loadGame(page);
    const result = await page.evaluate(() => {
      window.SC.resetProgression();
      const probe = withFormula => {
        resetGame();
        window.SC.setAutoBattle(false);
        window.SC.setTeam([3, 6, 1, 2]);
        window.SC.startBattle();
        const state = window.SC.state;
        state.battleToken++;
        if (withFormula) state.run.formulas = ['conductive_tide'];
        const actor = state.allies.find(unit => unit.characterIndex === 3);
        const assistant = state.allies.find(unit => unit.characterIndex === 6);
        actor.energy = actor.maxEnergy; assistant.energy = assistant.maxEnergy;
        state.turnOrder = [actor]; state.curIdx = 0; state.phase = 'player'; actor._acted = false;
        const action = window.SC.listFusionActions(actor).find(item => item.key === 'water+thunder');
        const executed = window.SC.executeFusionAction(action, { source: 'manual' });
        const overloadTurns = [...actor.buffs, ...actor.debuffs].find(status => status.type === 'overload')?.turns || 0;
        const snapshot = { executed, key: action?.key, lock: state.run.fusionLockRounds, overloadTurns };
        state.battleToken++;
        return snapshot;
      };
      return { baseline: probe(false), conductive: probe(true) };
    });

    expect(result.baseline).toEqual({ executed: true, key: 'water+thunder', lock: 2, overloadTurns: 1 });
    expect(result.conductive).toEqual({ executed: true, key: 'water+thunder', lock: 3, overloadTurns: 2 });
  });

  test('audit: critical interrupt recommendations respect boss control immunity and only include effects that truly stop a charge', async ({ page }) => {
    await loadGame(page);
    const result = await page.evaluate(() => {
      window.SC.resetProgression();
      window.SC.setAutoStrategy('steady');
      const probe = (characterIndex, controlResistTurns = 0) => {
        resetGame();
        window.SC.setAutoBattle(false);
        const team = [characterIndex, 0, 1, 2, 3, 6].filter((value, index, values) => values.indexOf(value) === index).slice(0, 4);
        window.SC.setTeam(team);
        window.SC.startBattle();
        const state = window.SC.state;
        state.battleToken++;
        const actor = state.allies.find(unit => unit.characterIndex === characterIndex);
        actor.energy = 0;
        const boss = window.SC.makeExpeditionEnemy(window.SC.ENEMIES[2][0]);
        boss.controlResistTurns = controlResistTurns;
        boss.charging = { skillIndex: 1, turns: 1 };
        boss.plannedIntent = { skillIndex: 1, label: '蓄力中：混沌风暴', type: 'release', targetRule: 'allEnemies', isRelease: true };
        state.enemies = [boss]; state.turnOrder = [actor]; state.curIdx = 0; state.phase = 'player'; actor._acted = false;
        window.SC.setAutoBattle(true);
        const decision = window.SC.detectCriticalDecision(actor);
        window.SC.setAutoBattle(false);
        state.battleToken++;
        return decision ? { type: decision.type, actionKind: decision.action.kind, skillIndex: decision.action.skillIndex, name: decision.action.name } : null;
      };
      return {
        iceShield: probe(2, 0),
        immuneStun: probe(6, 2),
        slowOnly: probe(3, 0),
        defenseBreakOnly: probe(1, 0),
      };
    });

    expect(result.iceShield).toEqual({ type: 'boss-charge', actionKind: 'skill', skillIndex: 2, name: '冰霜护盾' });
    expect(result.immuneStun).toBeNull();
    expect(result.slowOnly).toBeNull();
    expect(result.defenseBreakOnly).toBeNull();
  });

  test('audit: formation style is snapshotted for a run and cannot change that run through the battle-time selector API', async ({ page }) => {
    await loadGame(page);
    const result = await page.evaluate(() => {
      window.SC.resetProgression();
      window.SC.setAutoBattle(false);
      window.SC.selectFormationStyle('gale');
      window.SC.startBattle();
      const state = window.SC.state;
      state.battleToken++;
      const target = state.allies.find(unit => !unit.isSummon);
      const amount = Math.floor(target.maxHp * 0.2);
      target.shield = 0;
      const shieldBefore = window.SC.addShieldToUnit(target, amount);
      target.shield = 0;
      const selectionResult = window.SC.selectFormationStyle('bulwark');
      const shieldAfter = window.SC.addShieldToUnit(target, amount);
      const snapshot = {
        runStyleId: state.run.formationStyleId,
        currentDuringRun: window.SC.currentFormation().id,
        configuredStyleId: state.formationStyleId,
        selectionResult,
        shieldBefore,
        shieldAfter,
        expectedGaleShield: Math.floor(amount * 0.85),
      };
      state.battleToken++;
      return snapshot;
    });

    expect(result.runStyleId).toBe('gale');
    expect(result.currentDuringRun).toBe('gale');
    expect(result.shieldBefore).toBe(result.expectedGaleShield);
    expect(result.shieldAfter).toBe(result.shieldBefore);
  });

  test('audit: pending auto timers are invalidated across rapid strategy changes before one manual action commits', async ({ page }) => {
    await loadGame(page);
    const initial = await page.evaluate(() => {
      window.SC.resetProgression();
      window.SC.setAutoBattle(false);
      window.SC.setTeam([0, 2, 8, 10]);
      window.SC.startBattle();
      const state = window.SC.state;
      state.battleToken++;
      const actor = state.allies.find(unit => unit.characterIndex === 0);
      const target = window.SC.makeUnit({ name: '自动竞态木桩', element: 'dark', hp: 99999, atk: 1, def: 40, spd: 1, res: 100, skills: [] }, true);
      state.enemies = [target]; state.turnOrder = [actor]; state.curIdx = 0; state.phase = 'player'; actor._acted = false; actor.energy = 0;
      window.SC.setRandomSource(() => 0.99);
      const tokenBefore = window.SC.autoDecisionToken;
      window.SC.setAutoBattle(true);
      window.SC.setAutoStrategy('assault');
      window.SC.setAutoStrategy('alchemy');
      window.SC.setAutoStrategy('steady');
      window.SC.setAutoBattle(false);
      window.SC.playerSelectSkill(0);
      window.SC.resolveTarget(target);
      const afterManual = target.maxHp - target.curHp;
      const snapshot = {
        targetUid: target.uid,
        afterManual,
        damageRecorded: state.run.stats.damageDealt,
        actorActed: actor._acted,
        autoBattle: window.SC.autoBattle,
        tokenBefore,
        tokenAfter: window.SC.autoDecisionToken,
        matchingLogs: state.log.filter(entry => entry.includes('炎棘箭')).length,
      };
      state.battleToken++;
      return snapshot;
    });

    expect(initial.afterManual).toBeGreaterThan(0);
    expect(initial).toMatchObject({ actorActed: true, autoBattle: false, matchingLogs: 1 });
    expect(initial.damageRecorded).toBe(initial.afterManual);
    expect(initial.tokenAfter).toBeGreaterThan(initial.tokenBefore);
    await page.waitForTimeout(750);
    const settled = await page.evaluate(targetUid => {
      const target = window.SC.state.enemies.find(unit => unit.uid === targetUid);
      const result = {
        damage: target.maxHp - target.curHp,
        damageRecorded: window.SC.state.run.stats.damageDealt,
        matchingLogs: window.SC.state.log.filter(entry => entry.includes('炎棘箭')).length,
        autoBattle: window.SC.autoBattle,
      };
      window.SC.resetRandomSource();
      return result;
    }, initial.targetUid);
    expect(settled).toEqual({ damage: initial.afterManual, damageRecorded: initial.afterManual, matchingLogs: 1, autoBattle: false });
  });

  test('balance audit: story contract rewards stay below standard while three-wave mastery scales only with difficulty', async ({ page }) => {
    await loadGame(page);
    const result = await page.evaluate(() => {
      const contractIds = window.SC.EXPEDITION_CONTRACTS.map(contract => contract.id);
      const triples = [];
      for (let first = 0; first < contractIds.length - 2; first++) {
        for (let second = first + 1; second < contractIds.length - 1; second++) {
          for (let third = second + 1; third < contractIds.length; third++) {
            const ids = [contractIds[first], contractIds[second], contractIds[third]];
            triples.push({ ids, multiplier: window.SC.expeditionRewardMultiplier({ difficultyId: 'story', contractIds: ids }) });
          }
        }
      }
      const standardNone = window.SC.expeditionRewardMultiplier({ difficultyId: 'standard', contractIds: [] });
      const lowerRiskContracts = ['scarce_healing', 'fragile_shields', 'sealed_arts'];
      const standardLowerRisk = window.SC.expeditionRewardMultiplier({ difficultyId: 'standard', contractIds: lowerRiskContracts });
      const challengeNone = window.SC.expeditionRewardMultiplier({ difficultyId: 'challenge', contractIds: [] });
      const mastery = ['story', 'standard', 'challenge'].map(difficultyId => {
        const none = { difficultyId, contractIds: [] };
        const contracted = { difficultyId, contractIds: lowerRiskContracts };
        const noneMultiplier = window.SC.expeditionMasteryMultiplier(none);
        const contractedMultiplier = window.SC.expeditionMasteryMultiplier(contracted);
        return {
          difficultyId,
          noneMultiplier,
          contractedMultiplier,
          noneMasteryXp: window.SC.progressionRewardFor(3, 1, noneMultiplier).masteryXp,
          contractedMasteryXp: window.SC.progressionRewardFor(3, 1, contractedMultiplier).masteryXp,
        };
      });
      return {
        tripleCount: triples.length,
        storyTriplesAtOrBelowStandard: triples.every(entry => entry.multiplier <= standardNone),
        storyMaximum: Math.max(...triples.map(entry => entry.multiplier)),
        standardNone,
        standardLowerRisk,
        challengeNone,
        mastery,
      };
    });

    expect(result.tripleCount).toBe(20);
    expect(result.storyTriplesAtOrBelowStandard).toBe(true);
    expect(result.storyMaximum).toBeLessThanOrEqual(result.standardNone);
    expect(result.standardLowerRisk).toBeLessThan(result.challengeNone);
    expect(result.mastery.map(entry => entry.noneMultiplier)).toEqual([2 / 3, 1, 4 / 3]);
    expect(result.mastery.map(entry => entry.contractedMultiplier)).toEqual(result.mastery.map(entry => entry.noneMultiplier));
    expect(result.mastery.map(entry => entry.noneMasteryXp)).toEqual([2, 3, 4]);
    expect(result.mastery.map(entry => entry.contractedMasteryXp)).toEqual([2, 3, 4]);
  });

  test('compact expedition configuration and critical-decision modal remain visible and operable at 360 by 640', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await loadGame(page);
    await enterFormation(page);
    await page.evaluate(() => SC.navigatePreparation('expedition'));
    await expect(page.locator('#difficulty-options .difficulty-option')).toHaveCount(3);
    await expect(page.locator('#contract-options .contract-option')).toHaveCount(6);
    await expect(page.locator('#auto-strategy-options .auto-strategy-option')).toHaveCount(3);

    await page.locator('[data-difficulty="challenge"]').click();
    for (const id of ['ironhide', 'enemy_haste', 'scarce_healing']) await page.locator(`[data-contract="${id}"]`).click();
    await page.locator('[data-contract="fragile_shields"]').click();
    await expect(page.locator('[data-contract="fragile_shields"]')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#contract-summary')).toContainText('3/3');
    await page.locator('[data-seed-mode="daily"]').click();
    await page.locator('[data-auto-strategy="steady"]').click();

    const configLayout = await page.evaluate(() => {
      const screen = document.querySelector('#preparation-expedition');
      const panel = document.querySelector('#expedition-config-panel');
      const panelRect = panel.getBoundingClientRect();
      const controls = [...panel.querySelectorAll('button')];
      return {
        documentOverflow: document.documentElement.scrollWidth > innerWidth + 1,
        screenOverflow: screen.scrollWidth > screen.clientWidth + 1,
        panelOverflow: panel.scrollWidth > panel.clientWidth + 1,
        panelContained: panelRect.left >= -1 && panelRect.right <= innerWidth + 1,
        clippedControls: controls.filter(button => {
          const rect = button.getBoundingClientRect();
          return rect.left < -1 || rect.right > innerWidth + 1;
        }).map(button => button.dataset.difficulty || button.dataset.contract || button.dataset.seedMode || button.dataset.autoStrategy),
      };
    });
    expect(configLayout).toEqual({ documentOverflow: false, screenOverflow: false, panelOverflow: false, panelContained: true, clippedControls: [] });

    await page.evaluate(() => {
      window.SC.setAutoBattle(false);
      window.SC.setAutoStrategy('steady');
      window.SC.setTeam([0, 2, 8, 10]);
      window.SC.startBattle();
      const state = window.SC.state;
      state.battleToken++;
      const actor = state.allies.find(unit => unit.characterIndex === 0);
      actor.energy = actor.maxEnergy;
      state.allies.filter(unit => unit !== actor && !unit.isSummon).forEach(unit => { unit.energy = unit.maxEnergy; });
      const boss = window.SC.makeExpeditionEnemy(window.SC.ENEMIES[2][0]);
      boss.charging = { skillIndex: 1, turns: 1 };
      state.enemies = [boss]; state.turnOrder = [actor]; state.curIdx = 0; state.phase = 'player'; actor._acted = false;
      renderAll();
      window.SC.setAutoBattle(true);
      window.SC.runAutoDecision(actor, window.SC.autoDecisionToken);
    });

    const modal = page.locator('#critical-decision-modal');
    await expect(modal).toBeVisible();
    await expect(page.locator('#critical-use-recommendation')).toBeFocused();
    for (const selector of ['#critical-use-recommendation', '#critical-manual', '#critical-continue-auto']) await expect(page.locator(selector)).toBeVisible();
    const modalLayout = await page.evaluate(() => {
      const overlay = document.querySelector('#critical-decision-modal');
      const card = overlay.querySelector('.critical-decision-card');
      const rect = card.getBoundingClientRect();
      const buttons = [...overlay.querySelectorAll('button')];
      return {
        hidden: overlay.hidden,
        cardInside: rect.left >= -1 && rect.right <= innerWidth + 1 && rect.top >= -1 && rect.bottom <= innerHeight + 1,
        cardOverflowX: card.scrollWidth > card.clientWidth + 1,
        buttonsInside: buttons.every(button => {
          const buttonRect = button.getBoundingClientRect();
          return buttonRect.left >= -1 && buttonRect.right <= innerWidth + 1;
        }),
        buttonHeights: buttons.map(button => Math.round(button.getBoundingClientRect().height)),
      };
    });
    expect(modalLayout).toMatchObject({ hidden: false, cardInside: true, cardOverflowX: false, buttonsInside: true });
    expect(Math.min(...modalLayout.buttonHeights)).toBeGreaterThanOrEqual(44);
    await page.locator('#critical-manual').click();
    await expect(modal).toBeHidden();
    await expect(page.locator('#auto-battle-btn')).toHaveText('手动');
  });
});
