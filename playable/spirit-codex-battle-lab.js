/* Functional battle lab: real engine actions against isolated, disposable state. */
(function () {
  'use strict';
  let session = null;
  const isActive = () => Boolean(session);
  const el = id => document.getElementById(id);
  const heroes = () => state.allies.filter(unit => !unit.isSummon);
  const selectedActor = () => heroes().find(unit => unit.characterId === session?.characterId) || heroes().find(unit => unit.alive) || heroes()[0];
  const recipeFor = id => COMBO_RECIPES.find(recipe => recipe.id === id);

  // Preserve reference identity in the formal state; detach the entire graph
  // before invoking any engine cleanup that could mutate a nested run/unit.
  function cloneGraph(value, seen = new Map()) {
    if (!value || typeof value !== 'object') return value;
    if (seen.has(value)) return seen.get(value);
    const copy = Array.isArray(value) ? [] : {};
    seen.set(value, copy);
    Object.keys(value).forEach(key => { copy[key] = cloneGraph(value[key], seen); });
    return copy;
  }
  function beforeEnter() {
    if (session) return true;
    if (inBattle) return false;
    const snapshot = { state:{...state}, autoBattle, randomOverride, runRandomSource, uid:UID, battleSpeed:window.BattleClock?.rate || 1,
      screen:document.querySelector('.screen.active')?.id || 'town-screen', focus:document.activeElement };
    session = { snapshot, initializing:true, closing:false, operation:0, loading:false, recipeId:'phoenix', pendingRecipeId:'phoenix',
      characterId:'H1',enemyUid:null,allyUid:null,tab:'combos',message:'训练资源仅在内存中，退出即丢弃。', rounds:0, expanded:true, observer:null, panel:null, allowEnemy:false };
    Object.assign(state, cloneGraph(state));
    state.training = { active:true, mode:'manual', recipeId:'phoenix', cycles:0 };
    state.progression = createDefaultProgression();
    state.progression.settings.seedMode = 'daily';
    state.progression.settings.contractIds = [];
    state.progression.settings.autoStrategyId = 'assault';
    randomOverride = createSeededRandom(hashSeed('SpiritCodex:functional-battle-lab'));
    runRandomSource = null;
    return true;
  }
  function say(message) {
    if (!session) return;
    session.message = message;
    const status = el('battle-lab-message');
    if (status) status.textContent = message;
  }
  function cancelPending({cinematic = true} = {}) {
    if (!session) return;
    window.BattleDecision?.reset();window.BattleHUD?.closeReport({restoreFocus:false});
    session.operation++; session.loading = false;
    state.battleToken++; invalidateAutoDecision();
    window.BattleClock?.clear();
    if (state.run) state.run.flowEpoch++;
    if (cinematic) window.clearComboCinematic?.();
    window.LiveCombo?.clear(); window.BattleMotion?.clear();
    state.particles = []; state.floats = [];
    window.ComboEnvironment?.releaseBattle({cancelled:true});
    closeComboModal({resume:false}); closeFusion(); closeIntermission(); closeCriticalDecision();
    const battle = el('battle-screen'); if (battle) battle.inert = false;
    state.target = null; state.selSkill = null;
    if (el('target-chips')) el('target-chips').innerHTML = '';
    if (battleCanvas) battleCanvas.style.cursor = 'default';
  }
  function closeBattleLab({screen} = {}) {
    if (!session || session.closing) return false;
    const current = session; current.closing = true; current.operation++;
    // Keep the save guard active throughout engine cleanup and restoration.
    clearBattleSession();
    const token = state.battleToken;
    current.observer?.disconnect(); current.panel?.remove();
    document.body.classList.remove('battle-lab-active');
    el('game')?.style.removeProperty('--battle-lab-panel-height');
    Object.keys(state).forEach(key => { if (!Object.hasOwn(current.snapshot.state, key)) delete state[key]; });
    Object.assign(state, current.snapshot.state, {battleToken:Math.max(token, current.snapshot.state.battleToken) + 1});
    randomOverride = current.snapshot.randomOverride; runRandomSource = current.snapshot.runRandomSource; UID = current.snapshot.uid;
    autoBattle = current.snapshot.autoBattle; invalidateAutoDecision();
    window.BattleClock?.setRate(current.snapshot.battleSpeed);
    if(typeof updateBattleSpeedButton==='function')updateBattleSpeedButton();
    session = null;
    updateAutoBattleButton();
    const destination = typeof screen === 'string' && el(screen)?.classList.contains('screen') ? screen : current.snapshot.screen;
    showScreen(destination === 'battle-screen' ? 'town-screen' : destination);
    if (current.snapshot.focus?.isConnected && current.snapshot.focus.getClientRects().length) current.snapshot.focus.focus({preventScroll:true});
    return true;
  }
  function fillHeroes({energy = true} = {}) {
    state.allies.forEach(unit => {
      unit.alive = true; unit.curHp = unit.maxHp; unit.debuffs = []; unit.buffs = []; unit.shield = 0;
      unit.cooldowns = unit.skills.map(() => 0); unit._acted = false;
      if (energy) unit.energy = unit.maxEnergy;
      if (unit.isSummon) unit.remainingRounds = 3;
    });
  }
  function makeTargets(durable = true) {
    state.enemies = ENEMIES[state.wave].map(makeExpeditionEnemy);
    if (durable) state.enemies.forEach((unit, index) => {
      unit.name = `训练靶 ${index + 1} · ${unit.name}`;
      unit.maxHp = 10000; unit.curHp = unit.maxHp;
    });
    preloadWaveArt(state.wave); planEnemyIntents();
  }
  function selectTurn(actor, {cleanControl = false} = {}) {
    if (!session || !actor) return false;
    if (cleanControl) actor.debuffs = actor.debuffs.filter(status => status.type !== 'freeze' && status.type !== 'stun');
    state.target = null; state.selSkill = null; state.curIdx = 0; state.turnOrder = [actor];
    actor._acted = false;
    const controlled = hasStatus(actor, 'freeze') || hasStatus(actor, 'stun');
    state.phase = actor.alive && !controlled ? 'player' : 'lab-paused';
    if (el('target-chips')) el('target-chips').innerHTML = '';
    setBanner(!actor.alive ? '测试场 · 队员已倒下' : controlled ? '测试场 · 当前队员受控制' : `测试场 · ${actor.name}`, 'player');
    setTip(actor.alive && !controlled ? '单步模式：使用技能或测试面板；数值真实结算，不领取奖励。' : '点击「回满生命 / 能量 / 冷却」或选择其他角色继续训练。');
    renderAll();
    window.BattleDecision?.onPlayerTurn();
    return actor.alive;
  }
  function beforeProcessTurn() {
    if (!session) return false;
    if (session.initializing || session.closing) return true;
    if (session.allowEnemy) { session.allowEnemy = false; return false; }
    if (autoBattle) { state.training.mode = 'auto'; return false; }
    state.training.mode = 'manual';
    selectTurn(selectedActor());
    return true;
  }
  function setTeam(ids) {
    const indices = [...new Set(ids)].map(id => CHARACTERS.findIndex(character => character.id === id)).filter(index => index >= 0);
    state.team = indices.slice(0, 4);
    normalizeFormationSlots(state.team, {reset:true});
  }
  function prepareCombo(id = session?.recipeId || 'phoenix') {
    const recipe = recipeFor(id);
    if (!session || session.closing || !recipe) return false;
    session.initializing = true; cancelPending(); setAutoBattle(false);
    session.recipeId = id; session.pendingRecipeId = id; session.characterId = recipe.memberIds[0];
    state.training.recipeId = id; state.training.mode = 'manual';
    const fillers = ['H2', 'L2', 'W1', 'L1', 'H1', 'A1'].filter(member => !recipe.memberIds.includes(member));
    setTeam([...recipe.memberIds, ...fillers.slice(0, 2)]);
    state.progression.inventory = Object.fromEntries(Object.keys(COMBO_ITEMS).map(key => [key, 3]));
    if (!startBattle()) { session.initializing = false; say('训练编队无法启动，请退出后重试。'); return false; }
    // startBattle is the real engine initializer; training fixtures only prepare
    // the resulting disposable units, never an alternate damage implementation.
    makeTargets(true); fillHeroes();
    const actor = heroes().find(unit => unit.characterId === recipe.memberIds[0]);
    const partner = heroes().find(unit => unit.characterId === recipe.memberIds[1]);
    actor.energy = 60; partner.energy = 40;
    const others = heroes().filter(unit => unit !== actor && unit !== partner);
    switch (id) {
      case 'phoenix': addStatus(state.enemies[0], 'burn', 3, 0, actor); break;
      case 'leviathan': addStatus(state.enemies[0], 'slow', 3, 0, actor); break;
      case 'bastion': addShieldToUnit(actor, Math.floor(actor.maxHp * .2)); break;
      case 'spring':
        others[0].curHp = Math.max(1, Math.floor(others[0].maxHp * .35));
        others[1].alive = false; others[1].curHp = 0;
        addStatus(others[0], 'burn', 3, 0, null); break;
      case 'eclipse': addStatus(state.enemies[0], 'slow', 3, 0, actor); break;
      case 'legion': {
        const summon = makeUnit(SUMMONS.skeleton, false, SUMMONS.skeleton);
        state.allies.push(summon); loadArt(summon.art); break;
      }
    }
    state.run.comboUsedIds = []; state.run.comboCasts = 0; state.run.fusionLockRounds = 0;
    session.initializing = false;
    selectTurn(actor);
    say(`已准备「${recipe.name}」：60 / 40 能量、${COMBO_ITEMS[recipe.itemId].name} 3 件，前置已满足。确认施放才消耗临时资源。`);
    refresh();
    return true;
  }
  async function castCombo(id = session?.recipeId) {
    if (!session || session.loading || session.closing || autoBattle || !recipeFor(id)) return false;
    const availability = comboAvailability(id);
    if (!availability.ready) { say(availability.reasons.join('；')); return false; }
    const current = session, operation = ++current.operation, run = state.run, recipe = recipeFor(id);
    current.loading = true;
    const battle = el('battle-screen'); if (battle) battle.inert = true;
    say('正在加载真实演出素材；尚未扣除训练道具。'); refresh();
    try {
      await preloadArt([COMBO_STAGE_ART.arena, COMBO_STAGE_ART.texture, COMBO_STAGE_ART.attack,
        recipe.casting?.src, recipe.rig?.src, recipe.rig?.combat?.src, ...state.allies.map(unit => unit.art), ...state.enemies.map(unit => unit.art)].filter(Boolean));
      if (session !== current || current.operation !== operation || state.run !== run || current.closing) return false;
      current.loading = false; if (battle) battle.inert = false;
      const result = SC.executeCombo(id);
      say(result ? `真实施放「${recipe.name}」：已扣除 1 件临时道具及 60 / 40 能量；演出后保留结果，可重新准备再次测试。` : comboAvailability(id).reasons.join('；'));
      refresh(); return result;
    } finally {
      if (session === current && current.operation === operation) {
        current.loading = false; if (battle) battle.inert = false; refresh();
      }
    }
  }
  async function prepareAndCast(id) { return prepareCombo(id) ? castCombo(id) : false; }
  function selectCharacter(id) {
    if (!session || session.loading || session.closing || state.phase === 'anim') return false;
    const index = CHARACTERS.findIndex(character => character.id === id); if (index < 0) return false;
    cancelPending(); setAutoBattle(false);
    let actor = heroes().find(unit => unit.characterId === id);
    if (!actor) {
      const previous = selectedActor() || heroes()[0], position = previous?.pos || 'front';
      actor = makeUnit(CHARACTERS[index], false); actor.characterIndex = index; actor.pos = position; actor.energy = actor.maxEnergy;
      const slot = findRunFormationSlot(previous.characterIndex);
      state.allies[state.allies.indexOf(previous)] = actor;
      if (slot) { state.run.formationSlots[slot.zone][slot.slotIndex] = index; state.formationSlots[slot.zone][slot.slotIndex] = index; }
      syncTeamFromFormation(); state.run.participantIds = heroes().map(unit => unit.characterId); loadArt(actor.art);
    }
    session.characterId = id;
    selectTab('skills');
    preloadArt([actor.art, ...COMBO_RECIPES.filter(recipe => recipe.memberIds.includes(id)).map(recipe => recipe.casting?.src)].filter(Boolean));
    selectTurn(actor);
    say(`当前测试 ${actor.name}；四个技能使用正式战斗规则。合击成员不足时，请重新准备对应配方。`);
    refresh(); return true;
  }
  function useSkill(index) {
    if (!session || session.loading || autoBattle || state.phase !== 'player') return false;
    const actor = selectedActor(), skill = actor?.skills[index];
    if (!actor || !skill || currentPlayerActor() !== actor || !isSkillReady(actor, skill, index)) {
      say('技能不可用：请检查行动角色、能量及冷却，或使用回满按钮。'); return false;
    }
    if (hasStatus(actor, 'freeze') || hasStatus(actor, 'stun')) { say('该角色受控制，请先回满净化或选择其他角色。'); return false; }
    state.selSkill = null; state.target = null;
    SC.playerSelectSkill(index);
    if (state.target) {
      const candidates = targetCandidates(state.target.side);
      const selected=state.target.side==='ally'?session.allyUid:session.enemyUid;
      const target=candidates.find(unit=>String(unit.uid)===String(selected))||(state.target.side === 'ally' ? [...candidates].sort((a, b) => a.curHp / a.maxHp - b.curHp / b.maxHp)[0] : candidates[0]);
      if (!target) { say('没有合法目标，请重置靶子。'); return false; }
      SC.resolveTarget(target);
    }
    const result = actor._acted;
    const direction=window.SkillPerformance?.profileFor(actor,skill);
    say(result ? `「${skill.name}」${direction?.description||'执行实际技能'}；结束后暂停，保留数值和冷却。` : '该技能暂时无法产生效果。');
    refresh(); return result;
  }
  function selectTestTarget(side,value){
    if(!session||state.phase==='anim'||!['enemy','ally'].includes(side))return false;const units=side==='enemy'?state.enemies:heroes(),unit=units.find(u=>u.alive&&String(u.uid)===String(value));
    if(!unit)return false;session[side==='enemy'?'enemyUid':'allyUid']=unit.uid;refresh();return true;
  }
  function prepareSkillTest(){
    if(!session||session.loading||state.phase==='anim')return false;
    const enemyIndex=state.enemies.findIndex(unit=>unit.uid===session.enemyUid);
    cancelPending();setAutoBattle(false);state.allies=heroes();fillHeroes();makeTargets(true);
    session.enemyUid=state.enemies[Math.max(0,enemyIndex)]?.uid;
    state.enemies.forEach(unit=>{unit.maxHp=2400;unit.curHp=2400;});
    const actor=selectedActor(),others=heroes().filter(unit=>unit!==actor);
    others.forEach(unit=>{unit.curHp=Math.floor(unit.maxHp*.40);addStatus(unit,'burn',2,0,actor);});
    if(actor.characterId==='L1'&&others.length>1){others[1].alive=false;others[1].curHp=0;}
    state.particles=[];state.floats=[];selectTurn(actor);
    say('技能测试已备好：满能量、清冷却、2400生命训练靶、受伤队友、空召唤位。可明确选敌/选友；施放仍按正式技能结算。');refresh();return true;
  }
  function enemyStep() {
    if (!session || session.loading || state.phase === 'anim') return false;
    cancelPending(); setAutoBattle(false);
    const enemy = state.enemies.find(unit => unit.alive);
    if (!enemy || !heroes().some(unit => unit.alive)) { say('需要存活敌人与队员，请重置靶子并回满队伍。'); return false; }
    enemy.cooldowns = enemy.cooldowns.map(value => Math.max(0, value - 1));
    enemy._acted = false; state.turnOrder = [enemy]; state.curIdx = 0; state.phase = 'enemy';
    enemy.plannedIntent = planEnemyIntent(enemy);
    // Enter the real turn gate too: frozen/stunned enemies must be skipped,
    // not executed just because the user requested one training step.
    session.allowEnemy = true; processTurn();
    say('敌方真实行动一次，完成后停回手动测试角色；不会自动追加下一名敌人的行动。'); refresh(); return true;
  }
  function prepareBossScenario(kind='interrupt'){
    if(!session||session.loading||state.phase==='anim'||!['interrupt','guard','opportunity'].includes(kind))return false;
    if(kind==='opportunity'){
      if(!prepareCombo('phoenix'))return false;
      const enemy=state.enemies[0];enemy._acted=false;state.turnOrder=[enemy,selectedActor()];state.curIdx=0;state.phase='enemy';
      autoBattle=true;updateAutoBattleButton();session.allowEnemy=true;processTurn();
      say('合击机会测试：敌方将先行动。点击战场「合击条件已备 · 接管」，等待己方回合，再确认施放；接管本身不扣道具。');selectTab('tools');refresh();return true;
    }
    if(!prepareCombo('bastion'))return false;
    const previous=heroes().find(u=>u.characterId==='W1')||heroes().find(u=>!['H2','L2'].includes(u.characterId));
    const index=CHARACTERS.findIndex(c=>c.id==='T1'),mage=makeUnit(CHARACTERS[index],false);mage.characterIndex=index;mage.pos=previous.pos;
    const slot=findRunFormationSlot(previous.characterIndex);state.allies[state.allies.indexOf(previous)]=mage;
    if(slot){state.run.formationSlots[slot.zone][slot.slotIndex]=index;state.formationSlots[slot.zone][slot.slotIndex]=index;}syncTeamFromFormation();state.run.participantIds=heroes().map(u=>u.characterId);
    state.wave=2;state.run.waveRound=1;state.run.comboCasts=0;state.run.comboUsedIds=[];state.run.fusionLockRounds=0;
    const boss=makeExpeditionEnemy(ENEMIES[2][0]);state.enemies=[boss];boss.charging={skillIndex:1,turns:1};boss.controlResistTurns=kind==='guard'?2:0;boss.plannedIntent=null;planEnemyIntent(boss,true);
    fillHeroes();heroes().forEach(u=>{u.energy=60;u.shield=0;});const tank=heroes().find(u=>u.characterId==='H2');
    const actor=kind==='interrupt'?mage:tank;session.characterId=actor.characterId;session.enemyUid=boss.uid;state.particles=[];state.floats=[];
    selectTurn(actor);preloadArt([mage.art,boss.art,ART.backgrounds.battle[2]]);updateBattleExpeditionStatus();selectTab('tools');
    say(kind==='interrupt'?'Boss 已蓄力且无免控。选择扎克「电磁脉冲」查看实际打断概率；成功麻痹后点「敌人行动一次」验证打断与 +35% 暴露。概率失败可重试，本测试不保证控制成功。':'Boss 已蓄力且免疫硬控。先用洛恩「熔岩护盾」，再点「敌人行动一次」，观察护盾吸收与 +20% 暴露；随后可选择雷欧用合击反打。');refresh();return true;
  }
  function refill() {
    if (!session || session.loading || state.phase === 'anim') return false;
    cancelPending(); setAutoBattle(false); fillHeroes(); selectTurn(selectedActor());
    say('训练队伍生命、能量及技能冷却已回满，负面已净化；道具与本局合击次数不重置。'); refresh(); return true;
  }
  function resetTargets() {
    if (!session || session.closing) return false;
    cancelPending(); setAutoBattle(false); makeTargets(true);
    selectTurn(selectedActor());
    say('已重置当前波训练靶，保留队伍状态、道具与合击次数。要重新铺好合击条件，请使用「准备条件」。'); refresh(); return true;
  }
  function setAutomatic(enabled) {
    if (!session || session.closing || session.loading) return false;
    if (!enabled) {
      cancelPending(); setAutoBattle(false); state.training.mode = 'manual'; selectTurn(selectedActor());
      say('已停止自动连战，转为单步测试；现有生命、资源及冷却保留。'); refresh(); return true;
    }
    if (state.phase === 'anim') return false;
    if (autoBattle) return true;
    cancelPending(); fillHeroes(); makeTargets(false);
    state.training.mode = 'auto'; state.phase = 'idle'; autoBattle = true; updateAutoBattleButton();
    say('自动连战：使用普通敌人生命，按真实AI推进三波；波间自动补给，结束重开训练，不领取正式奖励，不自动消耗合击道具。');
    nextTurn(); refresh(); return true;
  }
  function continueTrainingWave() {
    if (!session || session.closing) return;
    cancelPending(); fillHeroes(); makeTargets(false); state.turnOrder = []; state.curIdx = 0; state.phase = 'idle';
    if (state.run) state.run.waveRound = 0;
    scheduleBattle(nextTurn, 420); renderAll();
  }
  function onWaveComplete() {
    if (!session) return false;
    if (!autoBattle) {
      say('训练靶已全部倒下。不会结算奖励；点击「重置靶子」或重新准备合击继续。');
      selectTurn(selectedActor()); return true;
    }
    state.wave = (state.wave + 1) % ENEMIES.length;
    if (!state.wave) { session.rounds++; state.training.cycles = session.rounds; }
    say(`自动训练继续：第 ${state.wave + 1} 波，已完成 ${session.rounds} 轮三波训练；无正式奖励。`);
    continueTrainingWave(); return true;
  }
  function onBattleEnd(won) {
    if (!session) return false;
    if (autoBattle) {
      state.wave = 0;
      say(won ? '本轮训练完成，自动准备下一轮；不领取奖励。' : '训练队伍倒下，自动恢复并重开训练；不扣除正式资源。');
      continueTrainingWave();
    } else {
      state.phase = 'lab-paused'; renderAll();
      say('训练已暂停，不领取奖励；回满队伍、重置靶子或重新准备配方即可继续。');
    }
    return true;
  }
  function button(id, text, action, attributes = {}) {
    const node = document.createElement('button'); node.id = id; node.type = 'button'; node.className = 'btn'; node.textContent = text;
    node.dataset.testid = id; Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    node.onclick = action; return node;
  }
  function selectTab(id){
    if(!session||!['skills','combos','tools'].includes(id))return false;
    session.tab=id;
    session.panel?.querySelectorAll('[data-lab-tab]').forEach(node=>{const active=node.dataset.labTab===id;node.setAttribute('aria-selected',String(active));node.tabIndex=active?0:-1;});
    session.panel?.querySelectorAll('[data-lab-panel]').forEach(node=>{node.hidden=node.dataset.labPanel!==id;});
    if(el('battle-lab-controls'))el('battle-lab-controls').scrollTop=0;
    resizePanel();return true;
  }
  function buildPanel() {
    const panel = document.createElement('aside'); panel.id = 'battle-lab-panel'; panel.dataset.testid = panel.id; panel.setAttribute('aria-label', '功能测试场控制台');
    const header = document.createElement('header'); header.className = 'battle-lab-header';
    const heading = document.createElement('div'); heading.innerHTML = '<strong>功能测试场</strong><span>临时资源 · 无奖励 · 不写存档</span>';
    const toggle = button('battle-lab-toggle', '收起', () => {
      session.expanded = !session.expanded; panel.dataset.expanded = String(session.expanded);
      toggle.setAttribute('aria-expanded', String(session.expanded)); toggle.textContent = session.expanded ? '收起' : '展开';
      resizePanel();
    }, {'aria-expanded':'true', 'aria-controls':'battle-lab-controls'});
    const speed=button('battle-lab-speed','×1',()=>toggleBattleSpeed(),{'aria-pressed':'false','data-compact':'true'});speed.classList.add('battle-speed-btn');
    header.append(heading, speed, toggle, button('battle-lab-close', '退出', () => closeBattleLab()));
    const message = document.createElement('p'); message.id = 'battle-lab-message'; message.className = 'battle-lab-message'; message.setAttribute('role', 'status');
    const controls = document.createElement('div'); controls.id = 'battle-lab-controls';
    const comboSection = document.createElement('section'); comboSection.innerHTML = '<h3>六种合击 · 一键真实施放</h3><p>自动编队、铺好条件并消耗临时资源；不是视频或免费预览。</p>';
    const grid = document.createElement('div'); grid.className = 'battle-lab-combos';
    COMBO_RECIPES.forEach(recipe => grid.append(button(`battle-lab-combo-${recipe.id}`, recipe.name, () => prepareAndCast(recipe.id), {'data-lab-combo':recipe.id})));
    const manual = document.createElement('div'); manual.className = 'battle-lab-prepare';
    const recipeLabel = document.createElement('label'); recipeLabel.textContent = '分步验证配方';
    const recipeSelect = document.createElement('select'); recipeSelect.id = 'battle-lab-recipe'; recipeSelect.dataset.testid = recipeSelect.id;
    COMBO_RECIPES.forEach(recipe => { const option = document.createElement('option'); option.value = recipe.id; option.textContent = recipe.name; recipeSelect.append(option); });
    recipeSelect.onchange = () => { session.pendingRecipeId = recipeSelect.value; refresh(); };
    recipeLabel.append(recipeSelect); manual.append(recipeLabel, button('battle-lab-prepare', '准备条件', () => prepareCombo(recipeSelect.value)), button('battle-lab-cast', '确认真实施放', () => castCombo(recipeSelect.value)));
    const inventory = document.createElement('p'); inventory.id = 'battle-lab-inventory'; inventory.className = 'battle-lab-readout';
    comboSection.append(grid, manual, inventory);
    const skillSection = document.createElement('section'); skillSection.innerHTML = '<h3>48 技能 · 独立动作演练</h3><p>先选施法者和目标。单体技能命中选定目标；范围技能覆盖真实敌阵；治疗、护盾和召唤作用于己方。</p>';
    const actorLabel = document.createElement('label'); actorLabel.textContent = '测试角色（可替换当前主战槽）';
    const actorSelect = document.createElement('select'); actorSelect.id = 'battle-lab-character'; actorSelect.dataset.testid = actorSelect.id;
    CHARACTERS.forEach(character => { const option = document.createElement('option'); option.value = character.id; option.textContent = character.name; actorSelect.append(option); });
    actorSelect.onchange = () => selectCharacter(actorSelect.value); actorLabel.append(actorSelect);
    const skills = document.createElement('div'); skills.id = 'battle-lab-skills'; skills.className = 'battle-lab-grid';
    [0,1,2,3].forEach(index => skills.append(button(index ? `battle-lab-skill-${index}` : 'battle-lab-basic', '', () => useSkill(index), {'data-lab-skill':String(index)})));
    const targets=document.createElement('div');targets.className='battle-lab-grid';
    for(const [side,title]of [['enemy','攻击目标'],['ally','单体治疗目标']]){
      const label=document.createElement('label');label.textContent=title;const select=document.createElement('select');select.id=`battle-lab-${side}-target`;select.onchange=()=>selectTestTarget(side,select.value);label.append(select);targets.append(label);
    }
    skillSection.append(actorLabel,targets,button('battle-lab-skill-prepare','准备技能测试 · 满能 / 伤员 / 空召唤位',prepareSkillTest), skills, button('battle-lab-enemy', '敌人行动一次', enemyStep));
    const utilities = document.createElement('section'); utilities.innerHTML = '<h3>恢复与自动测试</h3>';
    const utilityGrid = document.createElement('div'); utilityGrid.className = 'battle-lab-grid';
    utilityGrid.append(button('battle-lab-refill', '回满生命 / 能量 / 冷却', refill), button('battle-lab-targets', '重置靶子', resetTargets), button('battle-lab-auto', '开启自动连战', () => setAutomatic(!autoBattle)), button('battle-lab-report', '暂停查看战况', () => window.BattleHUD?.openReport()));
    const status = document.createElement('p'); status.id = 'battle-lab-status'; status.className = 'battle-lab-readout';
    utilities.append(utilityGrid, status);
    const scenarioTitle=document.createElement('h3');scenarioTitle.textContent='战术验证 · 无需准备条件';
    const scenarios=document.createElement('div');scenarios.id='battle-lab-boss-presets';
    [['interrupt','Boss：尝试打断'],['guard','Boss：护盾承伤'],['opportunity','自动：合击接管']].forEach(([id,label])=>scenarios.append(button('battle-lab-scenario-'+id,label,()=>prepareBossScenario(id),{'data-boss-scenario':id})));
    utilities.append(scenarioTitle,scenarios);
    const tabs=document.createElement('nav');tabs.className='battle-lab-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','测试类别');
    const entries=[['skills','技能',skillSection],['combos','合击',comboSection],['tools','工具',utilities]];
    entries.forEach(([id,title,section],index)=>{
      const tab=button(`battle-lab-tab-${id}`,title,()=>selectTab(id),{'role':'tab','data-lab-tab':id,'aria-controls':`battle-lab-page-${id}`});
      tab.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?2:(index+(event.key==='ArrowRight'?1:2))%3;selectTab(entries[next][0]);el(`battle-lab-tab-${entries[next][0]}`).focus();};
      section.id=`battle-lab-page-${id}`;section.dataset.labPanel=id;section.setAttribute('role','tabpanel');section.setAttribute('aria-labelledby',tab.id);tabs.append(tab);controls.append(section);
    });
    panel.append(header, message, tabs, controls); panel.dataset.expanded = 'true';
    el('game').append(panel); session.panel = panel;
    document.body.classList.add('battle-lab-active');
    selectTab(session.tab);updateBattleSpeedButton();
    if (typeof ResizeObserver !== 'undefined') { session.observer = new ResizeObserver(resizePanel); session.observer.observe(panel); }
    resizePanel();
  }
  function resizePanel() {
    if (!session?.panel) return;
    el('game')?.style.setProperty('--battle-lab-panel-height', `${Math.ceil(session.panel.getBoundingClientRect().height)}px`);
  }
  function refresh() {
    if (!session?.panel || session.closing) return;
    const actor = selectedActor(), busy = session.loading || state.phase === 'anim';
    if (state.training) state.training.mode = autoBattle ? 'auto' : 'manual';
    session.panel.dataset.mode = autoBattle ? 'auto' : 'manual'; session.panel.dataset.loading = String(session.loading);
    el('battle-lab-character').value = actor?.characterId || session.characterId;
    el('battle-lab-recipe').value = session.pendingRecipeId;
    el('battle-lab-message').textContent = session.message;
    el('battle-lab-inventory').textContent = Object.values(COMBO_ITEMS).map(item => `${item.name} ${state.progression.inventory[item.id]}`).join(' · ');
    el('battle-lab-status').textContent = `${autoBattle ? '自动连战' : '手动单步'} · ${actor?.name || '无角色'} ${actor?.energy ?? 0} 能量 · 合击 ${state.run?.comboCasts || 0}/2 · 锁 ${state.run?.fusionLockRounds || 0} 回合`;
    for(const side of ['enemy','ally']){
      const node=el(`battle-lab-${side}-target`),field=side==='enemy'?'enemyUid':'allyUid',units=(side==='enemy'?state.enemies:heroes()).filter(unit=>unit.alive||busy&&unit.uid===session[field]);
      if(!units.some(unit=>unit.uid===session[field]))session[field]=side==='ally'?[...units].sort((a,b)=>a.curHp/a.maxHp-b.curHp/b.maxHp)[0]?.uid:units[0]?.uid;
      const signature=units.map(unit=>unit.uid+unit.name).join('|');
      if(node.dataset.units!==signature){node.replaceChildren();units.forEach((unit,index)=>{const option=document.createElement('option');option.value=String(unit.uid);option.textContent=`${index+1} · ${unit.name.replace(/^训练靶\s*\d+\s*·\s*/,'')}`;node.append(option);});node.dataset.units=signature;}
      node.value=String(session[field]);node.disabled=busy;
    }
    el('battle-lab-skill-prepare').disabled=busy;
    session.panel.querySelectorAll('[data-boss-scenario]').forEach(node=>{node.disabled=busy;});
    session.panel.querySelectorAll('[data-lab-skill]').forEach(node => {
      const index = Number(node.dataset.labSkill), skill = actor?.skills[index];
      node.textContent = skill ? `${index ? skill.ult ? '大招' : `技能 ${index}` : '普攻'} · ${skill.name}` : '无技能';
      const direction=window.SkillPerformance?.profileFor(actor,skill);node.title=direction?`${direction.description} · ${direction.duration/1000} 秒` : '';
      node.disabled = busy || autoBattle || state.phase !== 'player' || !actor?.alive || !skill || !isSkillReady(actor, skill, index);
    });
    el('battle-lab-character').disabled = busy;
    el('battle-lab-cast').disabled = busy || autoBattle || !comboAvailability(el('battle-lab-recipe').value).ready;
    ['battle-lab-enemy', 'battle-lab-refill'].forEach(id => { el(id).disabled = busy; });
    el('battle-lab-auto').disabled = session.loading || (busy && !autoBattle);
    el('battle-lab-auto').textContent = autoBattle ? '停止自动连战' : '开启自动连战';
    el('battle-lab-auto').setAttribute('aria-pressed', String(autoBattle));
    const reward = el('hud-reward'); if (reward) reward.textContent = '训练无奖励';
  }
  function openBattleLab() {
    if (session) { session.panel?.querySelector('button')?.focus(); return true; }
    if (!beforeEnter()) return false;
    try {
      buildPanel();
      if (!prepareCombo('phoenix')) { closeBattleLab(); return false; }
      el('battle-lab-toggle')?.focus({preventScroll:true});
      return true;
    } catch (error) { closeBattleLab(); throw error; }
  }
  const api = Object.freeze({isActive, beforeEnter, restore:closeBattleLab, prepareCombo, castCombo, prepareAndCast,
    selectCharacter,selectTab,useSkill,selectTestTarget,prepareSkillTest,prepareBossScenario,targetUid:()=>session?.enemyUid,enemyStep, refill, resetTargets, setAutomatic, beforeProcessTurn, onWaveComplete, onBattleEnd, refresh});
  window.openBattleLab = openBattleLab; window.closeBattleLab = closeBattleLab;
  Object.assign(window.SC, {BattleLab:api, openBattleLab, closeBattleLab});
}());
