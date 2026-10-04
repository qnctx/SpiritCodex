const { test, expect } = require('@playwright/test');

const RECIPES = ['phoenix', 'leviathan', 'bastion', 'spring', 'eclipse', 'legion'];
// These UVs are painted anatomical landmarks, independently projected through
// the actual drawImage affine and triangular clip rather than getAnchor().
const OUTLETS = { phoenix: [[.22, .08], [.56, .16]], leviathan: [[.825, .315]],
  bastion: [[.5, .455]], spring: [[.5, .73]], eclipse: [[.16, .5], [.84, .5]], legion: [[.5, .58]] };
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

async function loadLiveBattle(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.clock.install({ time: new Date('2026-09-06T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-06T12:01:00Z'));
  await page.addInitScript(() => {
    const audit = window.liveBattlePaint = { images: [], paths: [], text: [], fills: [], writes: [] };
    const states = new WeakMap(), lineage = new WeakMap(), prototype = CanvasRenderingContext2D.prototype;
    const relevant = ctx => ctx.canvas.id === 'battle-canvas' || ctx.canvas === window.LiveCombo?.current?.canvas;
    const state = ctx => {
      if (!states.has(ctx)) states.set(ctx, { path: [], clip: null, stack: [] });
      return states.get(ctx);
    };
    const project = (ctx, x, y) => {
      const m = ctx.getTransform(), canvas = ctx.canvas;
      const box = canvas.id === 'battle-canvas' ? canvas.getBoundingClientRect() : window.LiveCombo.current.geometry;
      // The live effects buffer is composited at 0,0,BW,BH on the real battlefield.
      return { x: (m.a * x + m.c * y + m.e) * box.width / canvas.width,
        y: (m.b * x + m.d * y + m.f) * box.height / canvas.height };
    };
    for (const name of ['save', 'restore', 'clearRect', 'beginPath', 'moveTo', 'lineTo', 'arcTo', 'quadraticCurveTo', 'bezierCurveTo', 'clip', 'stroke', 'fill', 'fillRect', 'fillText']) {
      const original = prototype[name];
      prototype[name] = function (...args) {
        if (relevant(this)) {
          const s = state(this);
          if (name === 'save') s.stack.push(s.clip);
          else if (name === 'restore') s.clip = s.stack.pop() || null;
          else if (name === 'clearRect' && this.canvas.id === 'battle-canvas') { audit.images = []; audit.paths = []; audit.text = []; audit.fills = []; }
          else if (name === 'beginPath') s.path = [];
          else if (['moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo'].includes(name)) s.path.push(project(this, args.at(-2), args.at(-1)));
          else if (name === 'arcTo') { s.path.push(project(this, args[0], args[1])); s.path.push(project(this, args[2], args[3])); }
          else if (name === 'clip') {
            const p = s.path;
            s.clip = p.length === 3 || p.length === 4 && Math.hypot(p[0].x - p[3].x, p[0].y - p[3].y) < .01 ? p.slice(0, 3) : null;
          } else if (name === 'fillText') audit.text.push({ text: String(args[0]), ...project(this, args[1], args[2]), font: this.font, alpha: this.globalAlpha });
          else if (name === 'fillRect') audit.fills.push({ points: [project(this, args[0], args[1]), project(this, args[0] + args[2], args[1] + args[3])], style: String(this.fillStyle), alpha: this.globalAlpha });
          else if ((name === 'stroke' || name === 'fill') && this.globalAlpha > .05 && s.path.length > 1) {
            const drawn = { points: s.path.map(point => ({ ...point })), style: String(name === 'fill' ? this.fillStyle : this.strokeStyle), alpha: this.globalAlpha };
            audit.paths.push(drawn); if (name === 'fill') audit.fills.push(drawn);
          }
        }
        return original.apply(this, args);
      };
    }
    const originalDraw = prototype.drawImage;
    prototype.drawImage = function (source, ...args) {
      const width = source.naturalWidth || source.width, height = source.naturalHeight || source.height;
      const crop = args.length === 8 ? { sx: args[0], sy: args[1], sw: args[2], sh: args[3], dx: args[4], dy: args[5], dw: args[6], dh: args[7] }
        : { sx: 0, sy: 0, sw: width, sh: height, dx: args[0], dy: args[1], dw: args[2] ?? width, dh: args[3] ?? height };
      const origins = source instanceof HTMLImageElement ? [{ source: source.src, sx: crop.sx, sy: crop.sy, sw: crop.sw, sh: crop.sh, width, height }] : lineage.get(source) || [];
      if (!relevant(this) && origins.length) {
        const combined = [...(lineage.get(this.canvas) || []), ...origins];
        lineage.set(this.canvas, [...new Map(combined.map(origin => [JSON.stringify(origin), origin])).values()]);
      }
      if (relevant(this) && this.globalAlpha > .05) {
        const a = project(this, crop.dx - crop.sx * crop.dw / crop.sw, crop.dy - crop.sy * crop.dh / crop.sh);
        const u = project(this, crop.dx + (width - crop.sx) * crop.dw / crop.sw, crop.dy - crop.sy * crop.dh / crop.sh);
        const v = project(this, crop.dx - crop.sx * crop.dw / crop.sw, crop.dy + (height - crop.sy) * crop.dh / crop.sh);
        audit.images.push({ origins, source, crop, clip: state(this).clip,
          corners: [project(this, crop.dx, crop.dy), project(this, crop.dx + crop.dw, crop.dy), project(this, crop.dx + crop.dw, crop.dy + crop.dh), project(this, crop.dx, crop.dy + crop.dh)],
          affine: [u.x - a.x, u.y - a.y, v.x - a.x, v.y - a.y, a.x, a.y], alpha: this.globalAlpha });
      }
      return originalDraw.call(this, source, ...args);
    };
    for (const method of ['setItem', 'removeItem', 'clear']) {
      const original = Storage.prototype[method];
      Storage.prototype[method] = function (...args) {
        if (this === localStorage) audit.writes.push({ method, args: args.map(String) });
        return original.apply(this, args);
      };
    }
  });
  await page.goto('/playable/spirit-codex.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#title-screen')).toHaveClass(/active/);
  await page.evaluate(async () => { SC.resetProgression(); SC.setAutoBattle(false); await SC.preloadArt(SC.REQUIRED_ART); });
  return errors;
}

async function assertLabStorageUnchanged(page) {
  const result = await page.evaluate(() => ({ snapshot: JSON.stringify(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])),
    original: window.liveFormalSnapshot.storage, writes: window.liveBattlePaint.writes }));
  expect(result.snapshot, 'no formal profile or preference may change during a test-lab run').toBe(result.original);
  expect(result.writes, 'isolation must prevent writes, not restore a formal save after temporarily overwriting it').toEqual([]);
}

async function battlefieldFrame(page, id) {
  return page.evaluate(({ id, landmarks }) => {
    const canvas = document.getElementById('battle-canvas'), box = canvas.getBoundingClientRect(), audit = window.liveBattlePaint;
    const bounds = points => ({ left: Math.min(...points.map(p => p.x)), top: Math.min(...points.map(p => p.y)),
      right: Math.max(...points.map(p => p.x)), bottom: Math.max(...points.map(p => p.y)) });
    const units = [...SC.state.allies, ...SC.state.enemies].map(unit => {
      const hud = unit._hud, barWidth = Math.max(46, unit._r * 2.35);
      const fills = audit.fills.map(fill => ({ ...fill, box: bounds(fill.points) }));
      const bar = hud && fills.find(fill => ['#46c46a', '#e8a33d', '#e0493b'].includes(fill.style) && Math.abs(fill.box.bottom - fill.box.top - 6) < .1
        && Math.abs(fill.box.left - (unit._x - barWidth / 2)) < .2 && fill.box.top >= hud.top && fill.box.bottom <= hud.bottom);
      const images = audit.images.filter(image => image.origins.some(origin => origin.source.endsWith(unit.art) || /cast-.+-actions-v4\.png/.test(origin.source))
        && Math.hypot((image.corners[0].x + image.corners[2].x) / 2 - unit._x, (image.corners[0].y + image.corners[2].y) / 2 - (unit._artRect.y + unit._artRect.height / 2)) < unit._artRect.height * .7);
      return { uid: String(unit.uid), characterId: unit.characterId, enemy: unit.isEnemy, summon: unit.isSummon, hp: unit.curHp, maxHp: unit.maxHp,
        hpPaint: bar ? (bar.box.right - bar.box.left) / barWidth : null, x: unit._x, y: unit._y, art: unit.art,
        visual: unit._visual, rect: unit._artRect, hud, hit: unit._hit,
        images: images.map(image => ({ origins: image.origins, crop: image.crop, corners: image.corners })) };
    });
    const session = window.LiveCombo?.current, geometry = session?.geometry, recipe = id && SC.COMBO_RECIPES.find(recipe => recipe.id === id);
    const rig = recipe && (recipe.rig.combat || recipe.rig);
    const images = rig ? audit.images.filter(image => image.clip && image.origins.some(origin => origin.source.endsWith(rig.src))) : [];
    const project = (triangle, u, v) => ({ x: triangle.affine[0] * u + triangle.affine[2] * v + triangle.affine[4], y: triangle.affine[1] * u + triangle.affine[3] * v + triangle.affine[5] });
    const inside = (point, triangle) => {
      const cross = (a, b) => (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
      const sides = triangle.clip.map((a, index, all) => cross(a, all[(index + 1) % 3]));
      return sides.every(value => value >= -.5) || sides.every(value => value <= .5);
    };
    const outlets = (landmarks || []).map(([u, v]) => {
      const triangle = images.find(triangle => inside(project(triangle, u, v), triangle)); if (!triangle) return null;
      const point = project(triangle, u, v), sample = document.createElement('canvas'); sample.width = sample.height = 11;
      sample.getContext('2d').drawImage(triangle.source, u * triangle.source.width - 5, v * triangle.source.height - 5, 11, 11, 0, 0, 11, 11);
      const ink = sample.getContext('2d').getImageData(0, 0, 11, 11).data.filter((value, index, all) => index % 4 === 3 && value > 24 && Math.max(all[index - 1], all[index - 2], all[index - 3]) > 16).length;
      return { ...point, ink };
    });
    const sample = document.createElement('canvas'); sample.width = 96; sample.height = 64;
    sample.getContext('2d').drawImage(canvas, 0, 0, 96, 64); let hash = 2166136261;
    for (const value of sample.getContext('2d').getImageData(0, 0, 96, 64).data) hash = Math.imul(hash ^ value, 16777619) >>> 0;
    return { units, hash, width: box.width, height: box.height, motion: window.BattleMotion?.inspect(performance.now()), geometry, choreography: session?.choreography,
      elapsed: session?.elapsed, outlets, triangles: images.length, paths: audit.paths, text: audit.text, frames: images.flatMap(image => image.origins),
      composite: session ? audit.images.some(image => image.source === session.canvas) : false,
      overflow: document.documentElement.scrollWidth > innerWidth + 1 };
  }, { id, landmarks: OUTLETS[id] });
}

function assertPaintedHealth(frame, uid, expected) {
  const unit = frame.units.find(unit => unit.uid === String(uid));
  expect(unit, 'the real target remains on the original battlefield').toBeTruthy();
  expect(unit.visual.hp).toBe(expected);
  expect(unit.hpPaint, 'the actual Canvas HP fill uses presentation HP, not early resolved gameplay HP').not.toBeNull();
  expect(unit.hpPaint).toBeCloseTo(expected / unit.maxHp, 3);
}

async function prepareRealCombo(page, id) {
  return page.evaluate(id => {
    resetGame(); SC.resetProgression(); SC.setAutoBattle(false); SC.setRandomSource(() => .5);
    const recipe = SC.COMBO_RECIPES.find(recipe => recipe.id === id);
    const pair = recipe.memberIds.map(member => SC.CHARACTERS.findIndex(unit => unit.id === member));
    SC.setTeam([...pair, ...SC.CHARACTERS.map((_, index) => index).filter(index => !pair.includes(index))].slice(0, 4));
    SC.startBattle(); const state = SC.state; state.battleToken++;
    const actor = state.allies.find(unit => unit.characterIndex === pair[0]), partner = state.allies.find(unit => unit.characterIndex === pair[1]);
    state.allies.forEach(unit => { unit.energy = 100; unit.crt = 0; unit.debuffs = []; }); actor.energy = 60; partner.energy = 40;
    state.turnOrder = [actor, state.allies.find(unit => unit !== actor && unit !== partner)]; state.curIdx = 0; state.phase = 'player'; actor._acted = false;
    state.enemies.forEach(unit => { unit.maxHp = 100000; unit.curHp = 100000; unit.shield = 0; unit.res = 0; unit.debuffs = []; });
    if (id === 'phoenix') SC.applyStatus(state.enemies[0], 'burn', actor, 1, 3);
    if (id === 'leviathan') SC.applyStatus(state.enemies[0], 'slow', actor, 1, 2);
    if (id === 'bastion') actor.shield = 1;
    if (id === 'spring') state.allies.find(unit => unit !== actor && unit !== partner).curHp = 1;
    if (id === 'eclipse') state.enemies[0].charging = { skillIndex: 1, turns: 1 };
    if (id === 'legion') SC.summonUnits(actor, { summon: 'skeleton' });
    renderAll(); drawScene(performance.now());
    const before = SC.progression.inventory[recipe.itemId], executed = SC.executeCombo(id);
    return { executed, before, after: SC.progression.inventory[recipe.itemId], recipe: { id, motion: recipe.motion, rig: recipe.rig }, actor: actor.uid, partner: partner.uid,
      targets: JSON.parse(JSON.stringify(LiveCombo.current.targets)) };
  }, id);
}

test.describe('Real battlefield actions and isolated functional test lab', () => {
  test('enemy and summon attacks use real motion and resetting or leaving a lab cancels unrevealed damage and stale combo callbacks', async ({ page }) => {
    const errors = await loadLiveBattle(page);
    await page.evaluate(() => { openBattleLab(); SC.BattleLab.refill(); SC.BattleLab.resetTargets(); SC.setRandomSource(() => .5); });
    await page.locator('#battle-lab-tab-skills').click();
    await page.locator('#battle-lab-enemy').click();
    await page.clock.fastForward(420);
    const enemyAction = await page.evaluate(() => BattleMotion.inspect(performance.now()));
    const enemy = await page.evaluate(id => SC.state.enemies.find(unit => String(unit.uid) === id)?.isEnemy, enemyAction.actorUid);
    expect(enemyAction.active).toBe(true); expect(enemy).toBe(true);
    const victim = enemyAction.targets.find(target => target.kind === 'damage'); expect(victim).toBeTruthy();
    await page.clock.fastForward(enemyAction.impactAt - enemyAction.start - 20);
    assertPaintedHealth(await battlefieldFrame(page), victim.uid, victim.before.hp);
    await page.clock.fastForward(220);
    const hit = await battlefieldFrame(page); assertPaintedHealth(hit, victim.uid, victim.after.hp);
    expect(hit.units.find(unit => unit.uid === enemyAction.actorUid).images.length, 'real enemy artwork is actually drawn while attacking').toBeGreaterThan(0);
    await page.clock.fastForward(1000);
    await page.evaluate(() => SC.BattleLab.prepareCombo('legion'));
    const summonAction = await page.evaluate(() => {
      const summoned = SC.state.allies.find(unit => unit.isSummon && unit.alive);
      // Exercise the real summon action resolver/animator on the actual lab summon.
      SC.state.turnOrder = [summoned]; SC.state.curIdx = 0; SC.state.phase = 'anim'; summoned._acted = false;
      summonAction(summoned); return BattleMotion.inspect(performance.now());
    });
    expect(summonAction.active).toBe(true);
    const summon = await page.evaluate(id => SC.state.allies.find(unit => String(unit.uid) === id)?.isSummon, summonAction.actorUid);
    expect(summon).toBe(true);
    const recipient = summonAction.targets.find(target => target.kind === 'damage'); expect(recipient).toBeTruthy();
    await page.clock.fastForward(summonAction.impactAt - summonAction.start - 20);
    assertPaintedHealth(await battlefieldFrame(page), recipient.uid, recipient.before.hp);
    await page.clock.fastForward(220);
    const summonedHit = await battlefieldFrame(page); assertPaintedHealth(summonedHit, recipient.uid, recipient.after.hp);
    expect(summonedHit.units.find(unit => unit.uid === summonAction.actorUid).images.length).toBeGreaterThan(0);
    await page.clock.fastForward(1000);
    const lethal = await page.evaluate(() => {
      const summoned = SC.state.allies.find(unit => unit.isSummon && unit.alive), enemy = SC.state.enemies.find(unit => unit.alive);
      summoned.curHp = 1; summoned.shield = 0; enemy._acted = false;
      enemy.plannedIntent = { ...planEnemyIntent(enemy), skillIndex: 0, chargeTurns: 0, isRelease: false, targetUid: summoned.uid };
      SC.state.turnOrder = [enemy]; SC.state.curIdx = 0; SC.state.phase = 'enemy';
      enemyAction(enemy); return { uid: String(summoned.uid), alive: summoned.alive, action: BattleMotion.inspect(performance.now()) };
    });
    expect(lethal.alive, 'the authoritative lethal strike is already resolved once').toBe(false);
    await page.clock.fastForward(lethal.action.impactAt - lethal.action.start - 20);
    const pendingDeath = (await battlefieldFrame(page)).units.find(unit => unit.uid === lethal.uid);
    expect(pendingDeath.visual.alive, 'a dying summon remains visible until the actual incoming hit').toBe(true);
    expect(pendingDeath.images.length).toBeGreaterThan(0);
    await page.clock.fastForward(1200);
    await page.evaluate(() => { SC.BattleLab.selectCharacter('H1'); SC.BattleLab.refill(); });
    await page.locator('#battle-lab-basic').click(); await page.clock.fastForward(80);
    expect(await page.evaluate(() => SC.state.floats.some(event => event.revealAt > performance.now()))).toBe(true);
    await page.locator('#battle-lab-tab-tools').click();
    await page.locator('#battle-lab-targets').click();
    expect(await page.evaluate(() => ({ floats: SC.state.floats.length, particles: SC.state.particles.length, active: BattleMotion.inspect(performance.now()).active }))).toEqual({ floats: 0, particles: 0, active: false });
    await page.clock.fastForward(1500);
    expect((await battlefieldFrame(page)).text.some(item => /^-\d/.test(item.text))).toBe(false);
    await page.locator('#battle-lab-tab-combos').click();
    await page.locator('[data-lab-combo="phoenix"]').click(); await expect(page.locator('#live-combo')).toBeVisible();
    await page.clock.fastForward(2200);
    await page.evaluate(() => { window.liveStaleCompletion = LiveCombo.current.onComplete; });
    await page.locator('#battle-lab-tab-tools').click();
    await page.locator('#battle-lab-targets').click();
    expect(await page.evaluate(() => ({ live: LiveCombo.current, floats: SC.state.floats.length, particles: SC.state.particles.length,
      environment: ComboEnvironment.battleFrame(performance.now()) }))).toEqual({ live: null, floats: 0, particles: 0, environment: null });
    const reset = await page.evaluate(() => {
      // RAF keeps updating draw bounds and idle poses after a reset; retain every
      // authoritative field, including _acted, while excluding only render caches.
      window.liveGameplaySnapshot = () => JSON.stringify({ state: SC.snapshot(), profile: SC.progression }, (key, value) => /^_(x|y|r|hit|artHeight|artWidth|artRect|visual|hud|facing)$/.test(key) ? undefined : value);
      return window.liveGameplaySnapshot();
    });
    await page.evaluate(() => window.liveStaleCompletion({ reason: 'complete', duration: 8400, preview: false }));
    await page.clock.fastForward(10000);
    expect(await page.evaluate(() => window.liveGameplaySnapshot())).toBe(reset);
    await page.locator('#battle-lab-tab-combos').click();
    await page.locator('[data-lab-combo="leviathan"]').click(); await expect(page.locator('#live-combo')).toBeVisible();
    await page.clock.fastForward(2200); await page.locator('#live-combo-skip').click(); await page.clock.fastForward(200);
    expect(await page.evaluate(() => ({ live: LiveCombo.current, environment: ComboEnvironment.battleFrame(performance.now()), casts: SC.state.run.comboCasts,
      item: SC.progression.inventory.tide, phase: SC.state.phase }))).toEqual({ live: null, environment: null, casts: 1, item: 2, phase: 'player' });
    await page.locator('[data-lab-combo="bastion"]').click(); await expect(page.locator('#live-combo')).toBeVisible();
    await page.clock.fastForward(200); await page.locator('#battle-lab-close').click(); await page.clock.fastForward(10000);
    expect(await page.evaluate(() => ({ active: SC.BattleLab.isActive(), live: LiveCombo.current, motion: BattleMotion.inspect(performance.now()).active,
      environment: ComboEnvironment.battleFrame(performance.now()) }))).toEqual({ active: false, live: null, motion: false, environment: null });
    expect(errors).toEqual([]);
  });

  test('all six real ultimates stay on the original battlefield and send independently reconstructed anatomical outlets to actual unit bodies', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = await loadLiveBattle(page);
    for (const id of RECIPES) {
      const cast = await prepareRealCombo(page, id);
      expect(cast.executed).toBe(true); expect(cast.after).toBe(cast.before - 1);
      await expect(page.locator('#combo-cinematic')).toHaveCount(0);
      await expect(page.locator('#live-combo')).toBeVisible();
      await page.clock.fastForward(3900);
      const frame = await battlefieldFrame(page, id);
      expect(frame.composite, 'the animated art layer must be genuinely composited into the original battle canvas').toBe(true);
      expect(frame.triangles).toBeGreaterThanOrEqual(100);
      expect(frame.outlets.every(outlet => outlet && outlet.ink > 0), 'actual painted mouth/wing/lotus/gate UVs survive the mesh').toBe(true);
      expect(frame.choreography.attacks.length).toBe(cast.targets.length);
      for (const attack of frame.choreography.attacks) {
        const unit = frame.units.find(unit => unit.uid === String(attack.uid));
        expect(unit, 'effects target actual state units, not presentation stand-ins').toBeTruthy();
        expect(unit.enemy).toBe(attack.role === 'attack');
        const actual = { x: unit.rect.x + unit.rect.width / 2 + unit.visual.dx,
          y: unit.rect.y + unit.rect.height * (['heal', 'summon'].includes(attack.role) ? 1 : .45) + unit.visual.dy + unit.visual.bob };
        expect(distance(attack.end, actual), `${id}: real drawn target body/feet and projectile destination coincide`).toBeLessThan(3);
        expect(frame.paths.some(path => distance(path.points[0], attack.start) < 4 && distance(path.points.at(-1), attack.head) < 4), `${id}: a real Canvas route starts at the configured outlet and reaches its head`).toBe(true);
        if (id === 'phoenix' && attack.role === 'attack') {
          expect(attack.start.y).toBeLessThan(attack.end.y - 40);
          expect(frame.paths.some(path => frame.outlets.some(outlet => distance(path.points[0], outlet) < 4) && distance(path.points.at(-1), attack.start) < 4)).toBe(true);
        } else expect(Math.min(...frame.outlets.map(outlet => distance(outlet, attack.start))), `${id}: the actual mesh organ emits the attack`).toBeLessThan(4);
      }
      for (const target of cast.targets.filter(target => target.hpBefore > 0)) assertPaintedHealth(frame, target.uid, target.hpBefore);
      expect(await page.evaluate(() => ComboEnvironment.battleFrame(performance.now()).motion)).toBe(cast.recipe.motion);
      expect(frame.overflow).toBe(false);
      await page.clock.fastForward(700);
      const beforeHit = await battlefieldFrame(page, id);
      for (const target of cast.targets.filter(target => target.hpBefore > 0)) assertPaintedHealth(beforeHit, target.uid, target.hpBefore);
      await page.clock.fastForward(1900);
      const afterHit = await battlefieldFrame(page, id);
      for (const target of cast.targets.filter(target => target.hpAfter > 0)) assertPaintedHealth(afterHit, target.uid, target.hpAfter);
      expect(afterHit.hash).not.toBe(frame.hash);
      expect(await page.evaluate(() => SC.state.run.comboCasts)).toBe(1);
      await page.clock.fastForward(2100);
      await expect(page.locator('#live-combo')).toHaveCount(0);
      await expect(page.locator('#combo-cinematic')).toHaveCount(0);
      await page.evaluate(() => resetGame());
    }
    expect(errors).toEqual([]);
  });

  test('a normal attack articulates real character cells and moves its real target only when damage reaches the painted health bar', async ({ page }) => {
    const errors = await loadLiveBattle(page);
    await page.evaluate(() => { openBattleLab(); SC.BattleLab.selectCharacter('H1'); SC.BattleLab.refill(); SC.BattleLab.resetTargets(); });
    await page.clock.fastForward(32);
    const before = await battlefieldFrame(page);
    await page.locator('#battle-lab-basic').click();
    const action = await page.evaluate(() => BattleMotion.inspect(performance.now()));
    expect(action.active).toBe(true); expect(action.impactAt - action.start).toBe(540);
    const target = action.targets.find(target => target.after.hp < target.before.hp);
    expect(target, 'the actual basic skill produces a real damage target').toBeTruthy();
    const frames = []; let elapsed = 0;
    for (const time of [80, 220, 400, 520]) {
      await page.clock.fastForward(time - elapsed); elapsed = time;
      const frame = await battlefieldFrame(page); frames.push(frame);
      assertPaintedHealth(frame, target.uid, target.before.hp);
      expect(frame.text.some(item => /^-\d/.test(item.text)), 'damage floats cannot arrive before the actual strike').toBe(false);
    }
    const actorImages = frames.flatMap(frame => frame.units.find(unit => unit.uid === action.actorUid).images);
    const cells = new Set(actorImages.flatMap(image => image.origins.filter(origin => /cast-.+-actions-v4\.png/.test(origin.source)).map(origin => `${origin.source}:${origin.sx}:${origin.sy}`)));
    expect(cells.size, 'wind-up and release must use different real image cells, not only float an idle portrait').toBeGreaterThanOrEqual(3);
    const positions = actorImages.map(image => ({ x: (image.corners[0].x + image.corners[2].x) / 2, y: (image.corners[0].y + image.corners[2].y) / 2 }));
    expect(Math.max(...positions.map(point => distance(point, positions[0]))), 'the actual sprite transform includes an intentional action, beyond its idle bob').toBeGreaterThan(3);
    await page.clock.fastForward(80); elapsed += 80;
    const impact = await battlefieldFrame(page), victim = impact.units.find(unit => unit.uid === target.uid);
    expect(victim.visual.hp).toBeLessThan(target.before.hp); expect(victim.visual.hp).toBeGreaterThan(target.after.hp);
    expect(Math.abs(victim.visual.dx) + Math.abs(victim.visual.dy) + victim.visual.flash).toBeGreaterThan(.1);
    expect(impact.hash).not.toBe(before.hash);
    await page.clock.fastForward(180);
    const settled = await battlefieldFrame(page); assertPaintedHealth(settled, target.uid, target.after.hp);
    expect(settled.units.find(unit => unit.uid === target.uid).hp).toBe(target.after.hp);
    await page.locator('#battle-lab-close').click(); expect(errors).toEqual([]);
  });

  test('six lab presets execute the real combo rules once while all formal save writes remain blocked', async ({ page }) => {
    test.setTimeout(60_000);
    const errors = await loadLiveBattle(page);
    await page.evaluate(() => {
      window.liveFormalSnapshot = { storage: JSON.stringify(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])),
        profile: SC.progression, profileText: JSON.stringify(SC.progression), team: SC.state.team, slots: SC.state.formationSlots };
      window.liveBattlePaint.writes = [];
      openBattleLab();
    });
    await expect(page.locator('#battle-lab-panel')).toBeVisible();
    expect(await page.evaluate(() => SC.BattleLab.isActive())).toBe(true);
    for (const id of RECIPES) {
      await page.selectOption('#battle-lab-recipe', id);
      await page.locator('#battle-lab-prepare').click();
      const ready = await page.evaluate(id => {
        const recipe = SC.COMBO_RECIPES.find(recipe => recipe.id === id), actor = SC.state.turnOrder[SC.state.curIdx];
        const pair = recipe.memberIds.map(member => SC.state.allies.find(unit => unit.characterId === member));
        return { ready: SC.comboAvailability(id, actor).ready, energies: pair.map(unit => unit.energy), item: SC.progression.inventory[recipe.itemId],
          casts: SC.state.run.comboCasts || 0, profileDetached: SC.progression !== window.liveFormalSnapshot.profile };
      }, id);
      expect(ready).toEqual({ ready: true, energies: [60, 40], item: 3, casts: 0, profileDetached: true });
      await page.locator(`[data-lab-combo="${id}"]`).click();
      await expect(page.locator('#live-combo')).toBeVisible();
      await expect(page.locator('#combo-cinematic'), 'a real lab cast must remain in the actual battlefield, not open the preview scene').toHaveCount(0);
      await page.clock.fastForward(8400); await page.clock.fastForward(200);
      const result = await page.evaluate(id => {
        const recipe = SC.COMBO_RECIPES.find(recipe => recipe.id === id);
        return { casts: SC.state.run.comboCasts, used: SC.state.run.comboUsedIds, item: SC.progression.inventory[recipe.itemId],
          energies: recipe.memberIds.map(member => SC.state.allies.find(unit => unit.characterId === member).energy),
          again: SC.executeCombo(id), stats: SC.state.run.stats };
      }, id);
      expect(result).toMatchObject({ casts: 1, used: [id], item: 2, energies: [0, 0], again: false });
      if (id === 'spring') expect(result.stats.healing).toBeGreaterThan(0);
      else expect(result.stats.damageDealt).toBeGreaterThan(0);
      await assertLabStorageUnchanged(page);
    }
    await page.locator('#battle-lab-close').click();
    await page.clock.fastForward(10000);
    expect(await page.evaluate(() => ({ active: SC.BattleLab.isActive(), profile: SC.progression === window.liveFormalSnapshot.profile,
      profileText: JSON.stringify(SC.progression) === window.liveFormalSnapshot.profileText,
      team: SC.state.team === window.liveFormalSnapshot.team, slots: SC.state.formationSlots === window.liveFormalSnapshot.slots }))).toEqual({ active: false, profile: true, profileText: true, team: true, slots: true });
    await assertLabStorageUnchanged(page);
    await expect(page.locator('#battle-lab-panel')).toBeHidden();
    expect(errors).toEqual([]);
  });
});
