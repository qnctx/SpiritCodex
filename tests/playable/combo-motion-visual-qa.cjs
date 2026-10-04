// Reproducible visual review. Start tests/playable/server.js first; no player profile is used.
const { chromium } = require('@playwright/test');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

(async () => {
  const output = path.join(os.tmpdir(), 'spirit-codex-facing-v9-qa');
  fs.mkdirSync(output, { recursive: true });
  const comboIds = ['phoenix', 'leviathan', 'bastion', 'spring', 'eclipse', 'legion'];
  const only = process.argv.find(value => value.startsWith('--only='))?.slice(7);
  if (only && !comboIds.includes(only)) throw new Error(`Unknown combo: ${only}`);
  const formationsOnly = process.argv.includes('--formation-only');
  const onlyViewport = process.argv.find(value => value.startsWith('--viewport='))?.slice(11);
  if (onlyViewport && !['desktop','compact'].includes(onlyViewport)) throw new Error(`Unknown viewport: ${onlyViewport}`);
  const targetUrl = process.argv.includes('--file')
    ? pathToFileURL(path.resolve(__dirname, '../../playable/spirit-codex.html')).href
    : 'http://127.0.0.1:4173/playable/spirit-codex.html';
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const viewport of [{ width: 1366, height: 768 }, { width: 360, height: 640 }]) {
      const label = viewport.width > 500 ? 'desktop' : 'compact';
      if (onlyViewport && onlyViewport !== label) continue;
      const context = await browser.newContext({ viewport, reducedMotion: 'no-preference' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(targetUrl);
      await page.evaluate(() => SC.preloadArt());
      await page.evaluate(() => showScreen('formation-screen'));
      for (const view of formationsOnly ? ['combos'] : ['team','expedition','supplies','combos']) {
        await page.evaluate(view => SC.navigatePreparation(view), view);
        await page.screenshot({ path: path.join(output, `${label}-preparation-${view}.png`) });
      }
      await page.locator('[data-preview-combo="phoenix"]').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, `${label}-preview-button.png`) });
      console.log(label, 'formation ready');
      if (process.argv.includes('--preparation-only')) { console.log(label, JSON.stringify({ errors })); await context.close(); continue; }
      await page.clock.install({ time: new Date('2026-09-05T00:00:00Z') });
      await page.clock.pauseAt(new Date('2026-09-05T00:00:01Z'));
      for (const id of only ? [only] : comboIds) {
        await page.evaluate(id => SC.previewCombo(id), id);
        let elapsed = 0;
        const moments = formationsOnly ? [['assembling',1600],['manifest',2200],['formed',2850],['bloom',3100]] : [['charge',1000],['manifest',2200],['formed',2850],['bloom',3100],['release-pose',3350],['release',3900],['travel',4400],['impact',5300],['aftershock',7100],['settle',8100],['result',8500]];
        for (const [stage, time] of moments) {
          await page.clock.runFor(time - elapsed);
          elapsed = time;
          await page.screenshot({ path: path.join(output, `${label}-${id}-${stage}.png`) });
        }
        const layout = await page.locator('#combo-cinematic').evaluate(root => ({
          stage: root.dataset.stage,
          preview: root.dataset.preview,
          actionSprites: root.querySelectorAll('.combo-casting-sheet').length,
          canvas: Boolean(root.querySelector('canvas')),
          overflow: document.documentElement.scrollWidth > innerWidth,
        }));
        console.log(label, id, JSON.stringify(layout));
        await page.evaluate(() => clearComboCinematic());
      }
      if (formationsOnly) { console.log(label, JSON.stringify({ errors })); await context.close(); continue; }
      const actual = await page.evaluate(() => {
        SC.setAutoBattle(false); SC.setTeam([0,4,1,2]); SC.startBattle();
        const state=SC.state; state.battleToken++; SC.setRandomSource(() => .5);
        const actor=state.allies.find(unit=>unit.characterId==='H1'),partner=state.allies.find(unit=>unit.characterId==='A1');
        actor.energy=60; partner.energy=40; actor._acted=false;
        state.turnOrder=[actor]; state.curIdx=0; state.phase='player';
        state.enemies.forEach(unit=>{unit.curHp=unit.maxHp=10000;unit.res=0;});
        SC.applyStatus(state.enemies[0],'burn',actor,1,3);
        const before=state.enemies.map(unit=>unit.curHp),cast=SC.executeCombo('phoenix');
        return {cast,before,after:state.enemies.map(unit=>unit.curHp),inventory:SC.progression.inventory.ember};
      });
      await page.clock.runFor(5300);
      await page.screenshot({path:path.join(output,`${label}-actual-phoenix-impact.png`)});
      await page.clock.runFor(2800);
      await page.screenshot({path:path.join(output,`${label}-actual-phoenix-result.png`)});
      await page.clock.runFor(420);
      await page.screenshot({path:path.join(output,`${label}-actual-phoenix-environment-tail.png`)});
      await page.clock.runFor(1000);
      await page.screenshot({path:path.join(output,`${label}-actual-phoenix-environment-cleared.png`)});
      console.log(label,'actual',JSON.stringify(actual));
      console.log(label, JSON.stringify({ errors }));
      await context.close();
    }
  } finally { await browser.close(); }
  console.log(output);
})().catch(error => { console.error(error); process.exitCode = 1; });
