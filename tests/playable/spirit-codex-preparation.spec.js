const { test, expect } = require('@playwright/test');

const VIEWS = ['team', 'combos', 'expedition', 'supplies'];

async function openPreparation(page) {
  await page.goto('/playable/spirit-codex.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { SC.resetProgression(); SC.setAutoBattle(false); });
  await page.getByRole('button', { name: /进\s*入\s*城\s*镇/ }).click();
  await page.locator('#town-screen .primary-building').click();
  await expect(page.locator('#formation-screen')).toHaveClass(/active/);
}

test('preparation has four exclusive readable pages with reachable navigation and no horizontal clipping', async ({ page }) => {
  await openPreparation(page);
  await expect(page.locator('#preparation-team')).toBeVisible();
  for (const id of VIEWS) {
    await page.locator(`[data-preparation-tab="${id}"]`).click();
    for (const candidate of VIEWS) {
      if (candidate === id) await expect(page.locator(`#preparation-${candidate}`)).toBeVisible();
      else await expect(page.locator(`#preparation-${candidate}`)).toBeHidden();
    }
    const layout = await page.locator(`#preparation-${id}`).evaluate(view => {
      const visible = element => element.getClientRects().length && !element.closest('[hidden],[aria-hidden="true"]') && getComputedStyle(element).visibility !== 'hidden';
      const text = [...view.querySelectorAll('*')].filter(element => visible(element) && [...element.childNodes].some(node => node.nodeType === Node.TEXT_NODE && /[\u3400-\u9fff]/.test(node.textContent)));
      const navigation = [...document.querySelectorAll('[data-preparation-tab]')].filter(visible);
      const controls = [...view.querySelectorAll('button'), ...navigation].filter(visible);
      return {
        textCount: text.length,
        undersized: [...text, ...controls].filter(element => parseFloat(getComputedStyle(element).fontSize) < 14).map(element => element.textContent.trim().slice(0, 32)),
        documentOverflow: document.documentElement.scrollWidth > innerWidth + 1,
        viewOverflow: view.scrollWidth > view.clientWidth + 1,
        clipped: controls.filter(button => { const rect = button.getBoundingClientRect(); return rect.left < -1 || rect.right > innerWidth + 1; }).map(button => button.textContent.trim().slice(0, 32)),
        navOnscreen: navigation.every(button => { const rect = button.getBoundingClientRect(); return rect.top >= -1 && rect.bottom <= innerHeight + 1; }),
      };
    });
    expect(layout.textCount).toBeGreaterThan(0);
    expect(layout).toMatchObject({ undersized: [], documentOverflow: false, viewOverflow: false, clipped: [], navOnscreen: true });
  }
  await expect(page.locator('#err-overlay')).not.toHaveClass(/show/);
});

test('page navigation preserves both active pairs and reserves while expedition settings and supplies form a real loop', async ({ page }) => {
  await openPreparation(page);
  const before = await page.evaluate(() => {
    SC.setTeam([0, 4, 8, 7, 1, 2]);
    Object.assign(SC.progression.resources, { ink: 40, elementDust: 6 }); SC.saveProgression(); SC.renderComboFormation();
    return { team: [...SC.state.team], slots: JSON.parse(JSON.stringify(SC.state.formationSlots)), active: SC.activeFormationIndices(), reserves: SC.reserveFormationIndices() };
  });
  await page.locator('[data-preparation-tab="combos"]').click();
  await expect(page.locator('#combo-formation-list .combo-recipe-card')).toHaveCount(6);
  await page.locator('[data-preparation-tab="expedition"]').click();
  await page.locator('[data-difficulty="challenge"]').click();
  await page.locator('[data-contract="ironhide"]').click();
  await page.locator('[data-seed-mode="daily"]').click();
  await expect(page.locator('#preparation-expedition')).toBeVisible();
  await page.locator('[data-preparation-tab="supplies"]').click();
  await expect(page.locator('#combo-inventory')).toBeVisible();
  await expect(page.locator('[data-craft-combo="ember"]')).toBeEnabled();
  await page.locator('[data-craft-combo="ember"]').click();
  const purchase = await page.evaluate(() => ({ inventory: { ...SC.progression.inventory }, resources: { ...SC.progression.resources } }));
  expect(purchase).toMatchObject({ inventory: { ember: 3, tide: 2, soul: 2 }, resources: { ink: 20, elementDust: 3 } });
  for (const id of ['team', 'combos', 'supplies', 'expedition', 'team']) await page.locator(`[data-preparation-tab="${id}"]`).click();
  const after = await page.evaluate(() => ({ team: [...SC.state.team], slots: JSON.parse(JSON.stringify(SC.state.formationSlots)), active: SC.activeFormationIndices(), reserves: SC.reserveFormationIndices(), settings: SC.expeditionSettings(), inventory: SC.progression.inventory, resources: SC.progression.resources }));
  expect({ team: after.team, slots: after.slots, active: after.active, reserves: after.reserves }).toEqual(before);
  expect(after.settings).toMatchObject({ difficultyId: 'challenge', contractIds: ['ironhide'], seedMode: 'daily' });
  expect(after.inventory).toEqual(purchase.inventory); expect(after.resources).toEqual(purchase.resources);
  expect(before.active).toHaveLength(4); expect(before.reserves).toHaveLength(2);
  expect(await page.evaluate(() => SC.previewCombo('phoenix'))).toBe(false);
  await page.reload({ waitUntil: 'domcontentloaded' });
  expect(await page.evaluate(() => ({ inventory: SC.progression.inventory, resources: SC.progression.resources }))).toEqual(purchase);
});
