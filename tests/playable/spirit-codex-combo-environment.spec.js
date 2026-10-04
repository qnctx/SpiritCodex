const { test, expect } = require('@playwright/test');

const THEMES = { phoenix: 'ash', leviathan: 'rain', bastion: 'gold-dust', spring: 'petals', eclipse: 'stars', legion: 'soul-dust' };

async function loadEnvironment(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.clock.install({ time: new Date('2026-09-05T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-05T12:01:00Z'));
  await page.addInitScript(() => {
    const audit = window.environmentPaint = { records: {}, calls: [], order: [], enabled: true };
    const pixels = canvas => {
      const sample = document.createElement('canvas'); sample.width = 80; sample.height = 60;
      const ctx = sample.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, 80, 60);
      return ctx.getImageData(0, 0, 80, 60).data;
    };
    const compare = (before, after) => {
      let hash = 2166136261;
      const bands = { sky: { changed: 0, count: 0, columns: [0, 0, 0, 0] }, ground: { changed: 0, count: 0, columns: [0, 0, 0, 0] } };
      for (let i = 0; i < after.length; i += 4) {
        const y = Math.floor(i / 4 / 80), x = i / 4 % 80;
        const changed = [0, 1, 2, 3].some(channel => Math.abs(after[i + channel] - before[i + channel]) > 1);
        for (let channel = 0; channel < 4; channel++) hash = Math.imul(hash ^ (after[i + channel] - before[i + channel] + 255), 16777619);
        const band = y < 27 ? bands.sky : y >= 45 ? bands.ground : null;
        if (band) { band.count++; if (changed) { band.changed++; band.columns[Math.floor(x / 20)]++; } }
      }
      return { hash: hash >>> 0, sky: bands.sky, ground: bands.ground };
    };
    const prototype = CanvasRenderingContext2D.prototype, drawImage = prototype.drawImage, clearRect = prototype.clearRect, fillText = prototype.fillText;
    prototype.clearRect = function (...args) { if (this.canvas.id === 'battle-canvas') audit.order = []; return clearRect.apply(this, args); };
    prototype.drawImage = function (image, ...args) {
      if (this.canvas.id === 'battle-canvas' && image instanceof HTMLImageElement) audit.order.push({ type: /bg-battle-wave-/.test(image.src) ? 'background' : 'art', source: image.src });
      return drawImage.call(this, image, ...args);
    };
    prototype.fillText = function (...args) { if (this.canvas.id === 'battle-canvas') audit.order.push({ type: 'hud', text: String(args[0]) }); return fillText.apply(this, args); };
    let exposed;
    Object.defineProperty(window, 'ComboEnvironment', { configurable: true, get: () => exposed, set: api => {
      exposed = { ...api };
      for (const method of ['beginBattle', 'syncBattle', 'releaseBattle']) exposed[method] = (...args) => {
        const value = api[method](...args); audit.calls.push({ method, args: structuredClone(args), value }); return value;
      };
      exposed.draw = (ctx, region, frame, time) => {
        const key = ctx.canvas.id === 'battle-canvas' ? 'battle' : ctx.canvas.classList.contains('combo-environment-canvas') ? 'cinematic' : null;
        if (!key || !audit.enabled) return api.draw(ctx, region, frame, time);
        const before = pixels(ctx.canvas), order = key === 'battle' ? audit.order.slice() : [];
        if (key === 'battle') audit.order.push({ type: 'environment' });
        const result = api.draw(ctx, region, frame, time), after = pixels(ctx.canvas);
        audit.records[key] = { frame: structuredClone(frame), time, region: { ...region }, result, ...compare(before, after), order };
        return result;
      };
    } });
  });
  await page.goto('/playable/spirit-codex.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#title-screen')).toHaveClass(/active/);
  await page.evaluate(async () => { SC.resetProgression(); SC.setAutoBattle(false); await SC.preloadArt(SC.REQUIRED_ART); });
  await page.getByRole('button', { name: /进\s*入\s*城\s*镇/ }).click();
  await page.locator('#town-screen .primary-building').click();
  await page.evaluate(() => SC.navigatePreparation('combos'));
  return errors;
}

async function prepareCast(page, id, wave = 0) {
  return page.evaluate(({ id, wave }) => {
    resetGame(); SC.resetProgression(); SC.setAutoBattle(false); SC.setRandomSource(() => .5);
    const recipe = SC.COMBO_RECIPES.find(recipe => recipe.id === id), indices = recipe.memberIds.map(id => SC.CHARACTERS.findIndex(character => character.id === id));
    SC.setTeam([...indices, ...SC.CHARACTERS.map((_, index) => index).filter(index => !indices.includes(index))].slice(0, 4));
    SC.startBattle(); const state = SC.state; state.battleToken++; state.wave = wave;
    const actor = state.allies.find(unit => unit.characterId === recipe.memberIds[0]), partner = state.allies.find(unit => unit.characterId === recipe.memberIds[1]);
    const next = state.allies.find(unit => unit !== actor && unit !== partner);
    state.allies.forEach(unit => { unit.energy = 100; unit.debuffs = []; unit._acted = false; });
    actor.energy = 60; partner.energy = 40; state.turnOrder = [actor, next]; state.curIdx = 0; state.phase = 'player';
    state.enemies.forEach(unit => { unit.curHp = unit.maxHp = 100000; unit.res = 0; unit.debuffs = []; });
    if (id === 'phoenix') SC.applyStatus(state.enemies[0], 'burn', actor, 1, 3);
    if (id === 'leviathan') SC.applyStatus(state.enemies[0], 'slow', actor, 1, 3);
    if (id === 'bastion') actor.shield = 1;
    if (id === 'spring') { next.curHp = 1; }
    if (id === 'eclipse') state.enemies[0].charging = { skillIndex: 1, turns: 1 };
    if (id === 'legion') SC.summonUnits(actor, { summon: 'skeleton' });
    renderAll();
    const before = SC.progression.inventory[recipe.itemId], cast = SC.executeCombo(id);
    return { cast, item: recipe.itemId, before, after: SC.progression.inventory[recipe.itemId], casts: state.run.comboCasts,
      background: SC.ART.backgrounds.battle[wave], energies: [actor.energy, partner.energy] };
  }, { id, wave });
}

async function paintedEnvironment(page, key) {
  return page.evaluate(key => {
    const audit = window.environmentPaint, record = audit.records[key];
    return { ...record, orderAfter: audit.order, bridge: ComboEnvironment.battleFrame(performance.now()),
      expected: record && ComboEnvironment.sample(record.frame.motion, record.frame.elapsed, { reduced: record.frame.reduced }),
      lastSync: audit.calls.findLast(call => call.method === 'syncBattle'), count: audit.calls.length };
  }, key);
}

function assertFullEnvironment(record, id, stage) {
  expect(record?.result).toBe(true);
  expect(record.frame).toMatchObject({ motion: id === 'leviathan' ? 'tide' : id, phase: stage, weather: { kind: THEMES[id] } });
  expect(record.frame.strength).toBeGreaterThan(0);
  for (const field of ['strength', 'skyStrength', 'groundStrength']) expect(record.frame[field]).toBeCloseTo(record.expected[field], 6);
  expect(record.sky.changed / record.sky.count, `${id}: real sky pixels change across the scene`).toBeGreaterThan(.2);
  expect(record.ground.changed / record.ground.count, `${id}: real ground pixels respond, not just a local spell decal`).toBeGreaterThan(.1);
  expect(record.sky.columns.filter(count => count > 10).length).toBe(4);
  expect(record.ground.columns.filter(count => count > 10).length).toBe(4);
}

test.describe('Shared battlefield and cinematic environment', () => {
  test('six themes visibly transform sky and ground with the same preview and real-battle phase model', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = await loadEnvironment(page), signatures = [];
    for (const [index, id] of Object.keys(THEMES).entries()) {
      await page.evaluate(() => { resetGame(); showScreen('formation-screen'); SC.navigatePreparation('combos'); });
      expect(await page.evaluate(id => SC.previewCombo(id), id)).toBe(true);
      const preview = []; let elapsed = 0;
      for (const [time, phase] of [[2200, 'manifest'], [3900, 'release'], [5300, 'impact'], [7000, 'aftershock']]) {
        await page.clock.fastForward(time - elapsed); elapsed = time;
        const frame = await paintedEnvironment(page, 'cinematic'); assertFullEnvironment(frame, id, phase);
        expect(frame.bridge, 'a free preview never creates or advances the actual battle atmosphere').toBeNull();
        preview.push(frame);
      }
      expect(new Set(preview.map(frame => frame.hash)).size).toBe(4); signatures.push(preview[1].hash);
      await page.locator('#combo-preview-close').click();
      const cast = await prepareCast(page, id, index % 3);
      expect(cast).toMatchObject({ cast: true, after: cast.before - 1, casts: 1, energies: [0, 0] });
      elapsed = 0; let sharedClockOrigin;
      for (const [sampleIndex, [time, phase]] of [[2200, 'manifest'], [3900, 'release'], [5300, 'impact'], [7000, 'aftershock']].entries()) {
        await page.clock.fastForward(time - elapsed); elapsed = time;
        const battle = await paintedEnvironment(page, 'battle');
        assertFullEnvironment(battle, id, phase);
        const sync = battle.lastSync;
        expect(sync?.args[2]?.now, 'the actual bridge uses an explicit common RAF time anchor').toEqual(expect.any(Number));
        const clockOrigin = sync.args[2].now - sync.args[1];
        if (sharedClockOrigin === undefined) sharedClockOrigin = clockOrigin;
        expect(clockOrigin, 'layout/render work must not move the shared cinematic clock origin').toBeCloseTo(sharedClockOrigin, 6);
        expect(battle.bridge).toMatchObject({ motion: preview[sampleIndex].frame.motion, phase });
        for (const field of ['strength', 'skyStrength', 'groundStrength']) {
          expect(Math.abs(battle.frame[field] - preview[sampleIndex].frame[field]), `the actual battlefield and preview share the same ${field} timeline`).toBeLessThan(.02);
        }
        const background = battle.order.find(event => event.type === 'background');
        expect(background?.source.endsWith(cast.background), 'environment overlays the current wave, not an unrelated default scene').toBe(true);
        const order = battle.orderAfter.map(event => event.type), at = order.indexOf('environment');
        expect(at).toBeGreaterThan(order.indexOf('background')); expect(order.slice(at + 1)).toContain('art'); expect(order.slice(at + 1)).toContain('hud');
        await expect(page.locator('#combo-cinematic'), 'actual effects no longer create a second presentation battlefield').toHaveCount(0);
        expect(await page.evaluate(() => Boolean(LiveCombo.current))).toBe(true);
      }
      await page.evaluate(() => LiveCombo.clear());
      expect(await page.evaluate(() => ComboEnvironment.battleFrame(performance.now()))).toBeNull();
      expect(await page.evaluate(item => SC.progression.inventory[item], cast.item)).toBe(cast.after);
    }
    expect(new Set(signatures).size, 'six actual weather/color fields differ, not six dataset labels').toBe(6);
    expect(errors).toEqual([]);
  });

  test('natural battle completion leaves a short visible environment tail and then restores the original battlefield', async ({ page }) => {
    const errors = await loadEnvironment(page), cast = await prepareCast(page, 'phoenix', 2);
    expect(cast.cast).toBe(true);
    await page.clock.fastForward(8400);
    await expect(page.locator('#combo-cinematic')).toHaveCount(0);
    expect(await page.evaluate(() => LiveCombo.current)).toBeNull();
    await page.clock.fastForward(32);
    const early = await paintedEnvironment(page, 'battle');
    expect(early.bridge).toMatchObject({ motion: 'phoenix', releasing: true });
    expect(early.bridge.strength).toBeGreaterThan(0); expect(early.bridge.strength).toBeLessThan(.2);
    expect(early.sky.changed).toBeGreaterThan(0); expect(early.ground.changed).toBeGreaterThan(0);
    await page.clock.fastForward(400);
    const middle = await paintedEnvironment(page, 'battle');
    expect(middle.bridge.strength).toBeGreaterThan(0); expect(middle.bridge.strength).toBeLessThan(early.bridge.strength);
    await page.clock.fastForward(500);
    expect(await page.evaluate(() => ComboEnvironment.battleFrame(performance.now()))).toBeNull();
    // At the same render time, suppressing the environment implementation must
    // produce exactly the same real battlefield after the tail is gone.
    const restored = await page.evaluate(() => {
      const canvas = document.getElementById('battle-canvas'), ctx = canvas.getContext('2d');
      SC.state.particles = []; SC.state.floats = [];
      const time = performance.now(); drawScene(time); const first = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const original = ComboEnvironment.draw; ComboEnvironment.draw = () => false;
      try { drawScene(time); } finally { ComboEnvironment.draw = original; }
      const second = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      return { same: first.every((value, index) => value === second[index]), item: SC.progression.inventory.ember, casts: SC.state.run.comboCasts };
    });
    expect(restored).toEqual({ same: true, item: cast.after, casts: 1 }); expect(errors).toEqual([]);
    // A rapid, genuine intermission choice must not carry the dying sky into the next wave.
    await prepareCast(page, 'phoenix'); await page.clock.fastForward(8400);
    const advanced = await page.evaluate(() => {
      const tail = ComboEnvironment.battleFrame(performance.now());
      SC.state.enemies = []; SC.completeWave();
      const offer = SC.state.run.formulaOffers[0];
      const chosen = SC.chooseFormula(offer.id);
      return { hadTail: Boolean(tail?.releasing), chosen, wave: SC.state.wave, environment: ComboEnvironment.battleFrame(performance.now()) };
    });
    expect(advanced).toMatchObject({ hadTail: true, chosen: true, wave: 1, environment: null });
  });

  test('preview replay, close and reduced motion neither leak atmosphere nor consume items or random draws', async ({ page }) => {
    const errors = await loadEnvironment(page);
    const before = await page.evaluate(() => {
      window.environmentRng = { original: Math.random, game: 0, math: 0 };
      Math.random = () => { window.environmentRng.math++; return .413; }; SC.setRandomSource(() => { window.environmentRng.game++; return .617; });
      return JSON.stringify({ profile: SC.progression, battle: SC.snapshot(), uid: UID, storage: Object.entries(localStorage).sort() });
    });
    expect(await page.evaluate(() => SC.previewCombo('leviathan'))).toBe(true);
    await page.clock.fastForward(3900);
    assertFullEnvironment(await paintedEnvironment(page, 'cinematic'), 'leviathan', 'release');
    await page.evaluate(() => { window.oldEnvironmentCanvas = document.querySelector('.combo-environment-canvas'); window.oldEnvironmentPixels = window.oldEnvironmentCanvas.toDataURL(); });
    await page.locator('#combo-preview-replay').click(); await page.clock.fastForward(2200);
    expect(await page.evaluate(() => window.oldEnvironmentCanvas.toDataURL() === window.oldEnvironmentPixels), 'replay stops painting the detached old layer').toBe(true);
    await expect(page.locator('.combo-environment-canvas')).toHaveCount(1);
    await page.locator('#combo-motion-reduced').click(); await page.clock.fastForward(250);
    const reduced = await page.locator('.combo-environment-canvas').evaluate(canvas => {
      const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      return { ink: data.filter((value, index) => index % 4 === 3 && value > 0).length, bridge: ComboEnvironment.battleFrame(performance.now()) };
    });
    expect(reduced).toEqual({ ink: 0, bridge: null });
    await page.locator('#combo-preview-close').click();
    await page.clock.fastForward(10000);
    await expect(page.locator('.combo-environment-canvas')).toHaveCount(0);
    const unchanged = await page.evaluate(() => {
      const audit = window.environmentRng, snapshot = JSON.stringify({ profile: SC.progression, battle: SC.snapshot(), uid: UID, storage: Object.entries(localStorage).sort() });
      Math.random = audit.original; SC.resetRandomSource();
      return { snapshot, game: audit.game, math: audit.math, bridge: ComboEnvironment.battleFrame(performance.now()) };
    });
    expect(unchanged.snapshot, 'accessibility and replay preserve progression, battle state, UID and storage').toBe(before);
    expect(unchanged).toMatchObject({ game: 0, math: 0, bridge: null }); expect(errors).toEqual([]);
  });

  test('skip, reset and stale battle tokens clear or reject atmosphere without replaying a cast', async ({ page }) => {
    const errors = await loadEnvironment(page), cast = await prepareCast(page, 'phoenix');
    await page.clock.fastForward(3900);
    const stale = await page.evaluate(() => ComboEnvironment.battleFrame(performance.now()).token);
    await page.locator('#live-combo-skip').click();
    expect(await page.evaluate(() => ComboEnvironment.battleFrame(performance.now()))).toBeNull();
    expect(await page.evaluate(() => SC.progression.inventory.ember)).toBe(cast.after);
    await prepareCast(page, 'leviathan'); await page.clock.fastForward(2200);
    const rejected = await page.evaluate(stale => {
      const before = ComboEnvironment.battleFrame(performance.now());
      const sync = ComboEnvironment.syncBattle('phoenix', 5300, { token: stale });
      const clear = ComboEnvironment.releaseBattle({ token: stale, cancelled: true });
      return { sync, clear, before, after: ComboEnvironment.battleFrame(performance.now()) };
    }, stale);
    expect(rejected.sync).toBe(false); expect(rejected.clear).toBe(false); expect(rejected.after).toEqual(rejected.before);
    await page.evaluate(() => resetGame()); await page.clock.fastForward(10000);
    expect(await page.evaluate(() => ComboEnvironment.battleFrame(performance.now()))).toBeNull();
    await expect(page.locator('.combo-environment-canvas')).toHaveCount(0);
    await page.evaluate(() => setComboCinematicMotion('reduced'));
    const reducedCast = await prepareCast(page, 'phoenix');
    expect(reducedCast.cast).toBe(true); await page.clock.fastForward(1000);
    expect(await page.evaluate(() => ComboEnvironment.battleFrame(performance.now()))).toBeNull();
    await page.clock.fastForward(1000); await expect(page.locator('#combo-cinematic')).toHaveCount(0);
    expect(await page.evaluate(() => SC.progression.inventory.ember)).toBe(reducedCast.after);
    expect(errors).toEqual([]);
  });
});
