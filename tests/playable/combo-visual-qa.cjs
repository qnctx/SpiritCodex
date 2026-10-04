// Manual visual QA capture, intentionally not a Playwright spec.
// Run with the local playable server on port 4173; screenshots go to the OS temp directory.
const { chromium } = require('@playwright/test');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');

(async () => {
  const output = path.join(os.tmpdir(), 'spirit-codex-combo-visual-qa');
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  for (const viewport of [{ width: 1366, height: 768 }, { width: 360, height: 640 }]) {
    const label = viewport.width === 1366 ? 'desktop' : 'compact';
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:4173/playable/spirit-codex.html', { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      SC.resetProgression(); SC.setAutoBattle(false); showScreen('formation-screen');
    });
    await page.locator('#combo-formation-panel').evaluate(panel => panel.scrollIntoView({ block: 'start' }));
    await page.locator('.combo-recipe-art').evaluateAll(images => images.forEach(image => { image.loading = 'eager'; }));
    await page.waitForFunction(() => Array.from(document.querySelectorAll('#combo-formation-list img')).every(image => image.complete && image.naturalWidth > 0));
    await page.screenshot({ path: path.join(output, `${label}-formation.png`) });
    await page.locator('#combo-formation-list [data-combo="phoenix"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, `${label}-recipe.png`) });
    await page.evaluate(() => {
      window.prepareVisualCombo = id => {
        resetGame(); SC.setAutoBattle(false); SC.setRandomSource(() => .5);
        const recipe = SC.COMBO_RECIPES.find(item => item.id === id);
        const pair = recipe.memberIds.map(memberId => SC.CHARACTERS.findIndex(unit => unit.id === memberId));
        SC.setTeam([...pair, ...SC.CHARACTERS.map((_, index) => index).filter(index => !pair.includes(index))].slice(0, 4));
        SC.startBattle();
        const state = SC.state; state.battleToken++;
        const actor = state.allies.find(unit => unit.characterIndex === pair[0]);
        const partner = state.allies.find(unit => unit.characterIndex === pair[1]);
        state.allies.forEach(unit => { unit.energy = 100; unit.crt = 0; unit.debuffs = []; });
        actor.energy = 60; partner.energy = 40; actor._acted = false;
        state.turnOrder = [actor]; state.curIdx = 0; state.phase = 'player';
        state.enemies.forEach(unit => { unit.maxHp = 100000; unit.curHp = 100000; unit.shield = 0; unit.res = 0; unit.debuffs = []; });
        if (id === 'phoenix') SC.applyStatus(state.enemies[0], 'burn', actor, 1, 3);
        if (id === 'leviathan') SC.applyStatus(state.enemies[0], 'slow', actor, 1, 2);
        if (id === 'bastion') actor.shield = 1;
        if (id === 'spring') state.allies.find(unit => unit !== actor && unit !== partner).curHp = 1;
        if (id === 'eclipse') state.enemies[0].charging = { skillIndex: 1, turns: 1 };
        if (id === 'legion') SC.summonUnits(actor, { summon: 'skeleton' });
        renderAll();
        return { recipe, actor, partner };
      };
      prepareVisualCombo('phoenix');
    });
    await page.locator('#combo-battle-btn').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, `${label}-battle.png`) });
    await page.locator('#combo-battle-btn').click();
    await page.screenshot({ path: path.join(output, `${label}-modal.png`) });
    await page.locator('#combo-modal [data-cast-combo="phoenix"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, `${label}-modal-confirm.png`) });
    const layout = await page.evaluate(() => ({
      documentOverflow: document.documentElement.scrollWidth > innerWidth,
      modalOverflow: document.querySelector('.combo-modal-card').scrollWidth > document.querySelector('.combo-modal-card').clientWidth,
      art: Array.from(document.querySelectorAll('#combo-modal img')).map(img => ({ loaded: img.complete && img.naturalWidth > 0, path: img.getAttribute('src') }))
    }));
    console.log(label, JSON.stringify({ layout, errors }));
    for (const id of ['phoenix', 'leviathan', 'bastion', 'spring', 'eclipse', 'legion']) {
      await page.evaluate(id => {
        SC.closeComboModal();
        const prepared = prepareVisualCombo(id);
        SC.executeCombo(id);
        // Freeze only the visual CSS at 700ms for a repeatable image review.
        const cinematic = document.getElementById('combo-cinematic');
        if (!cinematic) throw new Error(`No cinematic for ${id}`);
        cinematic.getAnimations({ subtree: true }).forEach(animation => { animation.pause(); animation.currentTime = 700; });
      }, id);
      await page.screenshot({ path: path.join(output, `${label}-fx-${id}.png`) });
    }
    await context.close();
  }
  await browser.close();
  console.log(output);
})().catch(error => { console.error(error); process.exitCode = 1; });
