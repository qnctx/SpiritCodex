const { test, expect } = require('@playwright/test');

async function loadCombos(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/playable/spirit-codex.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#title-screen')).toHaveClass(/active/);
  await page.evaluate(() => {
    SC.resetProgression(); SC.setAutoBattle(false);
    // Test fixture: keep the actual damage, status, persistence and action pipelines.
    window.prepareCombo = (id, trigger = true) => {
      resetGame(); SC.setAutoBattle(false); SC.setRandomSource(() => .5);
      const recipe = SC.COMBO_RECIPES.find(item => item.id === id);
      const pair = recipe.memberIds.map(memberId => SC.CHARACTERS.findIndex(unit => unit.id === memberId));
      const team = [...pair, ...SC.CHARACTERS.map((_, index) => index).filter(index => !pair.includes(index))].slice(0, 4);
      SC.setTeam(team); SC.startBattle();
      const state = SC.state; state.battleToken++;
      const actor = state.allies.find(unit => unit.characterIndex === pair[0]);
      const partner = state.allies.find(unit => unit.characterIndex === pair[1]);
      state.allies.forEach(unit => { unit.energy = 100; unit.crt = 0; unit.debuffs = []; });
      actor.energy = 60; partner.energy = 40; actor._acted = false;
      state.turnOrder = [actor]; state.curIdx = 0; state.phase = 'player';
      state.enemies.forEach(unit => { unit.maxHp = 100000; unit.curHp = 100000; unit.shield = 0; unit.res = 0; unit.debuffs = []; });
      if (trigger) {
        if (id === 'phoenix') SC.applyStatus(state.enemies[0], 'burn', actor, 1, 3);
        if (id === 'leviathan') SC.applyStatus(state.enemies[0], 'slow', actor, 1, 2);
        if (id === 'bastion') actor.shield = 1;
        if (id === 'spring') state.allies.find(unit => unit !== actor && unit !== partner).curHp = 1;
        if (id === 'eclipse') state.enemies[0].charging = { skillIndex: 1, turns: 1 };
        if (id === 'legion') SC.summonUnits(actor, { summon: 'skeleton' });
      }
      renderAll();
      return { state, actor, partner, recipe };
    };
    window.captureComboPresentation = id => {
      const original = window.LiveCombo;
      let presentation, duration;
      window.LiveCombo = { ...original, get current() { return original.current; }, play(...args) { presentation = JSON.parse(JSON.stringify(args[2])); const session = original.play(...args); duration = session.duration; return session; } };
      try { return { executed: SC.executeCombo(id), presentation, duration }; }
      finally { window.LiveCombo = original; }
    };
  });
  return errors;
}

test.describe('Character combination ultimates', () => {
  test('six distinct recipes have real art and require the advertised setup', async ({ page, request }) => {
    const errors = await loadCombos(page);
    const result = await page.evaluate(() => {
      const paths = SC.COMBO_RECIPES.map(recipe => recipe.art);
      const setup = SC.COMBO_RECIPES.map(recipe => {
        const { actor } = prepareCombo(recipe.id, false);
        const before = SC.comboAvailability(recipe.id, actor);
        const ready = prepareCombo(recipe.id);
        return { id: recipe.id, blocked: !before.ready, reasons: before.reasons, ready: SC.comboAvailability(recipe.id, ready.actor).ready };
      });
      SC.state.battleToken++;
      return { paths, setup, inventory: { ...SC.progression.inventory }, valid: SC.validateGameData() };
    });
    expect(result.setup.map(item => item.id)).toEqual(['phoenix', 'leviathan', 'bastion', 'spring', 'eclipse', 'legion']);
    expect(result.setup.every(item => item.blocked && item.reasons.length && item.ready)).toBe(true);
    expect(result.inventory).toEqual({ ember: 2, tide: 2, soul: 2 });
    expect(result.valid).toBe(true);
    expect(new Set(result.paths).size).toBe(6);
    for (const path of result.paths) {
      expect(path).toMatch(/^assets\/combos\/combo-.+\.png$/);
      expect((await request.get(`/playable/${path}`)).ok()).toBe(true);
    }
    expect(errors).toEqual([]);
  });

  test('phoenix burns the enemy team, consumes exactly one ember and debits both participants', async ({ page }) => {
    await loadCombos(page);
    const result = await page.evaluate(() => {
      const { state, actor, partner } = prepareCombo('phoenix');
      const before = state.enemies.map(unit => ({ uid: unit.uid, hpBefore: unit.curHp, shieldBefore: unit.shield }));
      const { executed, presentation } = captureComboPresentation('phoenix');
      state.battleToken++;
      return { executed, hp: state.enemies.map(unit => unit.curHp), burns: state.enemies.map(unit => unit.debuffs.find(status => status.type === 'burn')?.turns),
        energy: [actor.energy, partner.energy], inventory: { ...SC.progression.inventory }, lock: state.run.fusionLockRounds, used: state.run.comboUsedIds, casts: state.run.comboCasts,
        presentation, actualTargets: state.enemies.map(unit => ({ ...before.find(item => item.uid === unit.uid), hpAfter: unit.curHp, shieldAfter: unit.shield, maxHp: unit.maxHp, side: 'enemy' })) };
    });
    expect(result).toMatchObject({ executed: true, energy: [0, 0], inventory: { ember: 1, tide: 2, soul: 2 }, lock: 2, used: ['phoenix'], casts: 1 });
    expect(result.hp.every(hp => hp < 100000)).toBe(true);
    expect(result.burns.every(turns => turns === 3)).toBe(true);
    expect(result.presentation.preview).not.toBe(true);
    expect(result.presentation.targets).toHaveLength(result.actualTargets.length);
    result.actualTargets.forEach(target => expect(result.presentation.targets.find(item => item.uid === target.uid)).toMatchObject(target));
    expect(result.presentation.summary).toEqual({ damage: result.actualTargets.reduce((sum, target) => sum + target.hpBefore - target.hpAfter, 0), healing: 0, shieldGain: 0, revived: 0, summonsAdded: 0 });
  });

  test('leviathan converts slow into area control while respecting boss immunity', async ({ page }) => {
    await loadCombos(page);
    const result = await page.evaluate(() => {
      const { state } = prepareCombo('leviathan');
      const boss = SC.makeExpeditionEnemy(SC.ENEMIES[2][0]);
      boss.curHp = boss.maxHp = 100000; boss.res = 0; boss.controlResistTurns = 2;
      boss.charging = { skillIndex: 1, turns: 1 }; state.enemies.push(boss);
      const executed = SC.executeCombo('leviathan'); state.battleToken++;
      return { executed, damaged: state.enemies.every(unit => unit.curHp < 100000), stuns: state.enemies.filter(unit => !unit.boss).map(unit => SC.hasStatus(unit, 'stun')),
        bossStun: SC.hasStatus(boss, 'stun'), bossCharging: !!boss.charging, inventory: SC.progression.inventory.tide };
    });
    expect(result).toMatchObject({ executed: true, damaged: true, bossStun: false, bossCharging: true, inventory: 1 });
    expect(result.stuns.every(Boolean)).toBe(true);
    const openingBonus = await page.evaluate(() => {
      SC.resetProgression();
      return [false, true].map(alreadyActed => {
        const { state, actor, partner } = prepareCombo('leviathan');
        // Let Zack lead: his real first-action passive must resolve before the action is marked spent.
        state.turnOrder = [partner]; partner.energy = 60; actor.energy = 40; partner._acted = false; partner._hasActedEver = alreadyActed;
        const executed = SC.executeCombo('leviathan'); state.battleToken++;
        return { executed, damage: 100000 - state.enemies[0].curHp, actionSpent: partner._hasActedEver };
      });
    });
    expect(openingBonus.every(item => item.executed && item.actionSpent)).toBe(true);
    expect(openingBonus[0].damage).toBeGreaterThan(openingBonus[1].damage);
  });

  test('bastion deals area damage and grants clean shields only to formal allies', async ({ page }) => {
    await loadCombos(page);
    const result = await page.evaluate(() => {
      const { state, actor } = prepareCombo('bastion');
      state.allies.forEach(unit => SC.applyStatus(unit, 'burn', state.enemies[0], 1, 2));
      SC.summonUnits(actor, { summon: 'skeleton' });
      const summon = state.allies.find(unit => unit.isSummon);
      const before = [...state.enemies, ...state.allies].map(unit => ({ uid: unit.uid, hpBefore: unit.curHp, shieldBefore: unit.shield }));
      const { executed, presentation } = captureComboPresentation('bastion'); state.battleToken++;
      return { executed, damaged: state.enemies.every(unit => unit.curHp < 100000), shields: state.allies.filter(unit => !unit.isSummon).map(unit => unit.shield),
        debuffs: state.allies.filter(unit => !unit.isSummon).map(unit => unit.debuffs.length), summonShield: summon.shield,
        presentation, actualTargets: [...state.enemies, ...state.allies.filter(unit => !unit.isSummon)].map(unit => ({ ...before.find(item => item.uid === unit.uid), hpAfter: unit.curHp, shieldAfter: unit.shield, maxHp: unit.maxHp, side: unit.isEnemy ? 'enemy' : 'ally' })) };
    });
    expect(result).toMatchObject({ executed: true, damaged: true, debuffs: [0, 0, 0, 0], summonShield: 0 });
    expect(result.shields.every(shield => shield > 0)).toBe(true);
    expect(result.presentation.preview).not.toBe(true);
    expect(result.presentation.targets).toHaveLength(result.actualTargets.length);
    result.actualTargets.forEach(target => expect(result.presentation.targets.find(item => item.uid === target.uid)).toMatchObject(target));
    expect(result.presentation.summary).toEqual({
      damage: result.actualTargets.filter(target => target.side === 'enemy').reduce((sum, target) => sum + target.hpBefore - target.hpAfter, 0),
      shieldGain: result.actualTargets.filter(target => target.side === 'ally').reduce((sum, target) => sum + target.shieldAfter - target.shieldBefore, 0),
      healing: 0, revived: 0, summonsAdded: 0,
    });
  });

  test('spring heals living heroes and revives a fallen hero at forty percent without double healing', async ({ page }) => {
    await loadCombos(page);
    const result = await page.evaluate(() => {
      const { state, actor, partner } = prepareCombo('spring');
      const others = state.allies.filter(unit => unit !== actor && unit !== partner);
      const injured = others[0], fallen = others[1]; injured.curHp = Math.floor(injured.maxHp * .2);
      fallen.alive = false; fallen.curHp = 0; fallen._acted = true;
      state.allies.forEach(unit => unit.debuffs.push({ type: 'burn', turns: 2 }));
      const before = injured.curHp, maximum = injured.maxHp;
      const executed = SC.executeCombo('spring'); state.battleToken++;
      return { executed, before, maximum, healed: injured.curHp, revived: fallen.alive, revivedHp: fallen.curHp,
        expectedRevived: Math.floor(fallen.maxHp * .4), stillActed: fallen._acted, debuffs: state.allies.map(unit => unit.debuffs.length) };
    });
    expect(result).toMatchObject({ executed: true, revived: true, stillActed: true, debuffs: [0, 0, 0, 0] });
    expect(result.healed).toBeGreaterThan(result.before);
    expect(result.healed).toBeLessThanOrEqual(result.maximum);
    expect(result.revivedHp).toBe(result.expectedRevived);
  });

  test('eclipse prioritizes a charging target and bypasses its shield without pretending to interrupt', async ({ page }) => {
    await loadCombos(page);
    const result = await page.evaluate(() => {
      const { state } = prepareCombo('eclipse');
      const target = state.enemies[0]; target.shield = 4000;
      const other = state.enemies[1]; other.curHp = 2000;
      const executed = SC.executeCombo('eclipse'); state.battleToken++;
      return { executed, targetHp: target.curHp, shield: target.shield, breakTurns: target.debuffs.find(status => status.type === 'defBreak')?.turns,
        stillCharging: !!target.charging, otherHp: other.curHp };
    });
    expect(result).toMatchObject({ executed: true, shield: 4000, breakTurns: 2, stillCharging: true, otherHp: 2000 });
    expect(result.targetHp).toBeLessThan(100000);
  });

  test('legion reinforces the summon lane, extends duration and obeys the two-summon cap', async ({ page }) => {
    await loadCombos(page);
    const result = await page.evaluate(() => {
      const { state } = prepareCombo('legion');
      const existing = state.allies.find(unit => unit.isSummon), before = existing.remainingRounds;
      const executed = SC.executeCombo('legion'); state.battleToken++;
      const summons = state.allies.filter(unit => unit.alive && unit.isSummon);
      return { executed, count: summons.length, extended: existing.remainingRounds - before,
        buffs: summons.map(unit => unit.buffs.find(buff => buff.type === 'atk')), damaged: state.enemies.every(unit => unit.curHp < 100000) };
    });
    expect(result).toMatchObject({ executed: true, count: 2, extended: 2, damaged: true });
    expect(result.buffs.every(buff => buff?.val === .35 && buff.turns === 3)).toBe(true);
  });

  test('absent, reserve, disabled, wrong-turn and underfunded participants cannot spend a catalyst', async ({ page }) => {
    await loadCombos(page);
    const result = await page.evaluate(() => {
      const cases = ['absent', 'reserve', 'actorFrozen', 'partnerStunned', 'partnerDead', 'wrongTurn', 'actorEnergy', 'partnerEnergy', 'noEnemies', 'noItem'];
      return cases.map(kind => {
        const { state, actor, partner } = prepareCombo('phoenix');
        if (kind === 'absent') state.allies = state.allies.filter(unit => unit !== partner);
        if (kind === 'reserve') { state.allies = state.allies.filter(unit => unit !== partner); state.reserveUnits.push(partner); }
        if (kind === 'actorFrozen') actor.debuffs.push({ type: 'freeze', turns: 1 });
        if (kind === 'partnerStunned') partner.debuffs.push({ type: 'stun', turns: 1 });
        if (kind === 'partnerDead') { partner.alive = false; partner.curHp = 0; }
        if (kind === 'wrongTurn') state.turnOrder = [state.allies.find(unit => unit !== actor && unit !== partner)];
        if (kind === 'actorEnergy') actor.energy = 59;
        if (kind === 'partnerEnergy') partner.energy = 39;
        if (kind === 'noEnemies') state.enemies.forEach(unit => { unit.alive = false; unit.curHp = 0; });
        if (kind === 'noItem') SC.progression.inventory.ember = 0;
        const before = JSON.stringify({ inventory: SC.progression.inventory, energy: [actor.energy, partner.energy], hp: state.enemies.map(unit => unit.curHp) });
        const availability = SC.comboAvailability('phoenix', actor), executed = SC.executeCombo('phoenix');
        const after = JSON.stringify({ inventory: SC.progression.inventory, energy: [actor.energy, partner.energy], hp: state.enemies.map(unit => unit.curHp) });
        state.battleToken++;
        return { kind, ready: availability.ready, reasons: availability.reasons.length, executed, unchanged: before === after };
      });
    });
    expect(result.every(item => !item.executed && item.unchanged)).toBe(true);
    expect(result.filter(item => item.kind !== 'wrongTurn').every(item => !item.ready && item.reasons > 0)).toBe(true);
  });

  test('crafting and casting are atomic when browser storage rejects a write', async ({ page }) => {
    await loadCombos(page);
    const result = await page.evaluate(() => {
      Object.assign(SC.progression.resources, { ink: 100, elementDust: 30 }); SC.saveProgression();
      const beforeCraft = JSON.stringify(SC.progression);
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = () => { throw new Error('test storage unavailable'); };
      let craft;
      try { craft = SC.craftComboItem('ember'); } finally { Storage.prototype.setItem = original; }
      const craftUnchanged = beforeCraft === JSON.stringify(SC.progression);
      const { state, actor, partner } = prepareCombo('phoenix');
      const beforeCast = JSON.stringify({ profile: SC.progression, energy: [actor.energy, partner.energy], hp: state.enemies.map(unit => unit.curHp), lock: state.run.fusionLockRounds, used: state.run.comboUsedIds, casts: state.run.comboCasts });
      Storage.prototype.setItem = () => { throw new Error('test storage unavailable'); };
      let cast;
      try { cast = SC.executeCombo('phoenix'); } finally { Storage.prototype.setItem = original; }
      const afterCast = JSON.stringify({ profile: SC.progression, energy: [actor.energy, partner.energy], hp: state.enemies.map(unit => unit.curHp), lock: state.run.fusionLockRounds, used: state.run.comboUsedIds, casts: state.run.comboCasts });
      state.battleToken++;
      return { craft, craftUnchanged, cast, castUnchanged: beforeCast === afterCast };
    });
    expect(result).toEqual({ craft: false, craftUnchanged: true, cast: false, castUnchanged: true });
  });

  test('crafting has exact costs, a storage cap and cannot be used during an expedition', async ({ page }) => {
    await loadCombos(page);
    const result = await page.evaluate(() => {
      Object.assign(SC.progression.resources, { ink: 40, elementDust: 6 }); SC.saveProgression();
      const first = SC.craftComboItem('ember'), second = SC.craftComboItem('tide'), noFunds = SC.craftComboItem('soul');
      const balances = { ...SC.progression.resources }, inventory = { ...SC.progression.inventory };
      Object.assign(SC.progression.resources, { ink: 100, elementDust: 30 }); SC.progression.inventory.soul = 99; SC.saveProgression();
      const beforeCap = JSON.stringify(SC.progression), capped = SC.craftComboItem('soul'), capUnchanged = beforeCap === JSON.stringify(SC.progression);
      prepareCombo('phoenix'); const inBattle = SC.craftComboItem('ember'); SC.state.battleToken++;
      return { first, second, noFunds, balances, inventory, capped, capUnchanged, inBattle };
    });
    expect(result).toMatchObject({ first: true, second: true, noFunds: false, balances: { ink: 0, elementDust: 0 }, inventory: { ember: 3, tide: 3, soul: 2 }, capped: false, capUnchanged: true, inBattle: false });
  });

  test('spent catalysts survive reload and zero-wave retries never replenish them', async ({ page }) => {
    await loadCombos(page);
    await page.evaluate(() => { prepareCombo('phoenix'); SC.executeCombo('phoenix'); SC.state.battleToken++; });
    await page.reload({ waitUntil: 'domcontentloaded' });
    const result = await page.evaluate(() => {
      const afterReload = { ...SC.progression.inventory }; SC.setAutoBattle(false); SC.startBattle(); SC.state.battleToken++;
      const attempts = [];
      for (let index = 0; index < 3; index++) { endBattle(false); SC.retryBattle(false); SC.state.battleToken++; attempts.push({ ...SC.progression.inventory }); }
      return { afterReload, attempts };
    });
    expect(result.afterReload).toEqual({ ember: 1, tide: 2, soul: 2 });
    expect(result.attempts.every(stock => JSON.stringify(stock) === JSON.stringify(result.afterReload))).toBe(true);
  });

  test('wave milestones award cumulative catalysts exactly once at settlement', async ({ page }) => {
    await loadCombos(page);
    const result = await page.evaluate(() => [0, 1, 2, 3].map(waves => {
      SC.resetProgression(); prepareCombo('phoenix'); const state = SC.state;
      state.run.clearedWaves = waves;
      SC.awardExpeditionProgression(); const first = { ...SC.progression.inventory };
      SC.awardExpeditionProgression(); endBattle(waves === 3);
      const again = { ...SC.progression.inventory }; state.battleToken++;
      return { waves, first, again };
    }));
    const expected = [{ ember: 2, tide: 2, soul: 2 }, { ember: 3, tide: 2, soul: 2 }, { ember: 3, tide: 3, soul: 2 }, { ember: 3, tide: 3, soul: 3 }];
    result.forEach((item, index) => { expect(item.first).toEqual(expected[index]); expect(item.again).toEqual(expected[index]); });
    await expect(page.locator('#result-progression-reward')).toContainText('灰烬触媒 +1');
    await expect(page.locator('#result-progression-reward')).toContainText('潮汐棱晶 +1');
    await expect(page.locator('#result-progression-reward')).toContainText('魂契封印 +1');
    await page.evaluate(() => { SC.resetProgression(); prepareCombo('phoenix'); SC.executeCombo('phoenix'); SC.state.battleToken++; SC.state.run.clearedWaves = 1; endBattle(false); });
    await expect(page.locator('#result-review')).toContainText('契约合击 1 次【炎羽天陨】');
  });

  test('signature combos share the ordinary fusion lock and enforce per-recipe and per-run limits', async ({ page }) => {
    await loadCombos(page);
    const result = await page.evaluate(() => {
      const { state, actor, partner } = prepareCombo('phoenix');
      SC.executeCombo('phoenix');
      actor._acted = false; actor.energy = 100; partner.energy = 100; state.phase = 'player';
      const ordinaryWhileLocked = SC.listFusionActions(actor).length;
      processDOT(); const firstLock = state.run.fusionLockRounds; processDOT();
      const secondLock = state.run.fusionLockRounds, repeat = SC.executeCombo('phoenix'), ordinaryAfter = SC.listFusionActions(actor).length;
      const used = [...state.run.comboUsedIds]; state.battleToken++;
      const next = prepareCombo('leviathan'); next.state.run.comboCasts = 2;
      const before = SC.progression.inventory.tide, third = SC.executeCombo('leviathan'), after = SC.progression.inventory.tide; next.state.battleToken++;
      return { ordinaryWhileLocked, firstLock, secondLock, repeat, ordinaryAfter, used, third, before, after };
    });
    expect(result).toMatchObject({ ordinaryWhileLocked: 0, firstLock: 1, secondLock: 0, repeat: false, used: ['phoenix'], third: false });
    expect(result.ordinaryAfter).toBeGreaterThan(0); expect(result.after).toBe(result.before);
  });

  test('automatic strategies never consume a catalyst even when a signature combo is ready', async ({ page }) => {
    await loadCombos(page);
    const result = await page.evaluate(() => ['assault', 'steady', 'alchemy'].map(strategy => {
      const { state, actor, partner } = prepareCombo('phoenix');
      SC.setAutoStrategy(strategy); actor.energy = 100; partner.energy = 100;
      const before = { ...SC.progression.inventory }; SC.setAutoBattle(true);
      const direct = SC.executeCombo('phoenix'); SC.runAutoDecision(actor, SC.autoDecisionToken);
      const after = { ...SC.progression.inventory }; SC.setAutoBattle(false); state.battleToken++;
      return { strategy, direct, before, after, casts: state.run.comboCasts };
    }));
    expect(result.every(item => !item.direct && item.casts === 0 && JSON.stringify(item.before) === JSON.stringify(item.after))).toBe(true);
  });

  test('formation freedom changes available combinations and a reserve cannot satisfy a partner requirement', async ({ page }) => {
    await loadCombos(page);
    const result = await page.evaluate(() => {
      const idx = id => SC.CHARACTERS.findIndex(character => character.id === id);
      SC.setTeam(['H1', 'H2', 'W1', 'W2', 'A1'].map(idx));
      const partnerIndex = idx('A1');
      const slot = ['front', 'back'].flatMap(zone => SC.state.formationSlots[zone].map((value, slotIndex) => ({ zone, slotIndex, value }))).find(item => item.value !== idx('H1'));
      // Force the exact reserve position through the user-facing slot API, then swap it in.
      SC.moveFormationCharacter(partnerIndex, { zone: 'reserve', slotIndex: 0 });
      const reserveReady = SC.comboAvailability('phoenix', null, { formationOnly: true }).ready;
      const moved = SC.moveFormationCharacter(partnerIndex, { zone: slot.zone, slotIndex: slot.slotIndex });
      const activeReady = SC.comboAvailability('phoenix', null, { formationOnly: true }).ready;
      return { reserveReady, moved, activeReady, active: SC.activeFormationIndices() };
    });
    expect(result.reserveReady).toBe(false); expect(result.moved).toBe(true); expect(result.activeReady).toBe(true); expect(result.active).toHaveLength(4);
  });

  test('combo dialog pauses play, cancellation is free and a deliberate card click spends once', async ({ page }) => {
    await loadCombos(page);
    await page.evaluate(() => { const { state, actor } = prepareCombo('phoenix'); state.target = state.enemies[0]; state.selSkill = actor.skills[0]; SC.openComboModal(); });
    const modal = page.locator('#combo-modal');
    await expect(modal).toBeVisible();
    expect(await page.evaluate(() => ({ target: SC.state.target, skill: SC.state.selSkill, inert: document.querySelector('#battle-screen').inert }))).toEqual({ target: null, skill: null, inert: true });
    const before = await page.evaluate(() => ({ stock: { ...SC.progression.inventory }, hp: SC.state.enemies.map(unit => unit.curHp), energy: SC.state.turnOrder[0].energy }));
    await page.waitForTimeout(450);
    const paused = await page.evaluate(() => ({ stock: { ...SC.progression.inventory }, hp: SC.state.enemies.map(unit => unit.curHp), energy: SC.state.turnOrder[0].energy }));
    expect(paused).toEqual(before);
    await page.locator('#combo-modal-close').click();
    await expect(modal).toBeHidden();
    expect(await page.evaluate(() => document.querySelector('#battle-screen').inert)).toBe(false);
    expect(await page.evaluate(() => SC.progression.inventory)).toEqual(before.stock);
    await page.evaluate(() => SC.openComboModal());
    const cast = modal.locator('[data-combo="phoenix"] .combo-cast-btn');
    await expect(cast).toBeEnabled(); await cast.click();
    await expect(modal).toBeHidden();
    expect(await page.evaluate(() => SC.progression.inventory.ember)).toBe(1);
    await page.evaluate(() => { SC.state.battleToken++; });
  });

  test('one-click pairing equips the actual main team and either partner can lead the signature cast', async ({ page }) => {
    await loadCombos(page);
    await page.getByRole('button', { name: /进\s*入\s*城\s*镇/ }).click();
    await page.locator('#town-screen .primary-building').click();
    await page.evaluate(() => SC.navigatePreparation('combos'));
    await page.locator('[data-equip-combo="eclipse"]').click();
    const equipped = await page.evaluate(() => SC.activeFormationIndices().map(index => SC.CHARACTERS[index].id));
    expect(equipped).toContain('D1'); expect(equipped).toContain('T2'); expect(equipped).toHaveLength(4);
    await page.locator('[data-equip-combo="phoenix"]').click();
    const pairedTeam = await page.evaluate(() => SC.activeFormationIndices().map(index => SC.CHARACTERS[index].id).sort());
    expect(pairedTeam).toEqual(['A1', 'D1', 'H1', 'T2']);
    await page.locator('[data-equip-combo="legion"]').click();
    const revisedPairs = await page.evaluate(() => SC.activeFormationIndices().map(index => SC.CHARACTERS[index].id).sort());
    expect(revisedPairs).toEqual(['A1', 'A2', 'D2', 'H1']);
    const result = await page.evaluate(() => {
      const { state, actor, partner } = prepareCombo('phoenix', false);
      SC.summonUnits(partner, { summon: 'wind_eagle' });
      actor.energy = 40; partner.energy = 60; partner._acted = false; state.turnOrder = [partner];
      const ready = SC.comboAvailability('phoenix', partner).ready, executed = SC.executeCombo('phoenix');
      state.battleToken++;
      return { ready, executed, energy: [actor.energy, partner.energy], ember: SC.progression.inventory.ember };
    });
    expect(result).toEqual({ ready: true, executed: true, energy: [0, 0], ember: 1 });
  });

  test('each actual cast selects a different real-field effect and reduced motion preserves immediate combat results', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await loadCombos(page);
    const presentations = await page.evaluate(() => SC.COMBO_RECIPES.map(recipe => {
      const { state } = prepareCombo(recipe.id); const { duration } = captureComboPresentation(recipe.id); state.battleToken++;
      const session = LiveCombo.current, root = document.querySelector('#live-combo');
      return { id: recipe.id, title: root.querySelector('strong').textContent, name: recipe.name, motion: session.motion, renderer: session.recipe.id,
        singleBattlefield: !document.querySelector('#combo-cinematic') && root.parentElement.id === 'battle-ui', duration };
    }));
    expect(new Set(presentations.map(item => item.motion)).size).toBe(6);
    expect(new Set(presentations.map(item => item.renderer)).size).toBe(6);
    expect(presentations.every(item => item.title === item.name && item.renderer === item.id && item.singleBattlefield && item.duration === 8400)).toBe(true);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const reduced = await page.evaluate(() => {
      SC.resetProgression(); const { state } = prepareCombo('phoenix'); const { executed, duration } = captureComboPresentation('phoenix'); state.battleToken++;
      const session = LiveCombo.current;
      return { executed, damaged: state.enemies.every(unit => unit.curHp < 100000), ember: SC.progression.inventory.ember,
        duration, reduced: session.reduced, overlay: Boolean(document.querySelector('#combo-cinematic')) };
    });
    expect(reduced).toEqual({ executed: true, damaged: true, ember: 1, duration: 1800, reduced: true, overlay: false });
    await expect(page.locator('#combo-cinematic')).toHaveCount(0);
  });

  test('combination cards, close and cast controls stay reachable without horizontal overflow', async ({ page }) => {
    await loadCombos(page);
    await page.getByRole('button', { name: /进\s*入\s*城\s*镇/ }).click();
    await page.locator('#town-screen .primary-building').click();
    await page.evaluate(() => SC.navigatePreparation('combos'));
    await expect(page.locator('#combo-formation-panel')).toBeVisible();
    const formation = await page.locator('#combo-formation-panel').evaluate(panel => ({
      overflow: panel.scrollWidth > panel.clientWidth + 1,
      cards: panel.querySelectorAll('.combo-recipe-card').length,
      controlsClipped: [...panel.querySelectorAll('button')].some(button => { const rect = button.getBoundingClientRect(); return rect.left < -1 || rect.right > innerWidth + 1; }),
    }));
    expect(formation).toEqual({ overflow: false, cards: 6, controlsClipped: false });
    await page.evaluate(() => { prepareCombo('phoenix'); SC.openComboModal(); });
    const modal = page.locator('#combo-modal'); await expect(modal).toBeVisible();
    const layout = await modal.evaluate(overlay => {
      const card = overlay.querySelector('.combo-modal-card'), rect = card.getBoundingClientRect();
      return { contained: rect.left >= -1 && rect.right <= innerWidth + 1 && rect.top >= -1 && rect.bottom <= innerHeight + 1,
        overflow: card.scrollWidth > card.clientWidth + 1, documentOverflow: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    expect(layout).toEqual({ contained: true, overflow: false, documentOverflow: false });
    const cast = modal.locator('[data-combo="phoenix"] .combo-cast-btn'); await cast.scrollIntoViewIfNeeded();
    await expect(cast).toBeVisible();
    const clickTarget = await cast.evaluate(button => { const r = button.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return button === hit || button.contains(hit); });
    expect(clickTarget).toBe(true);
    await page.keyboard.press('Escape'); await expect(modal).toBeHidden();
  });
});
