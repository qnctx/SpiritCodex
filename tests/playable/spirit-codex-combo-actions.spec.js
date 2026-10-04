const { test, expect } = require('@playwright/test');

async function loadActionPreview(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.clock.install({ time: new Date('2026-09-05T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-05T12:01:00Z'));
  await page.addInitScript(() => {
    const original = CanvasRenderingContext2D.prototype.drawImage, clear = CanvasRenderingContext2D.prototype.clearRect, lineage = new WeakMap();
    window.liveCastingDraws = [];
    CanvasRenderingContext2D.prototype.clearRect = function (...args) { if (this.canvas.id === 'battle-canvas') window.liveCastingDraws = []; return clear.apply(this, args); };
    CanvasRenderingContext2D.prototype.drawImage = function (image, ...args) {
      let origins = lineage.get(image) || [];
      if (image instanceof HTMLImageElement && /cast-.+-actions-v4\.png/.test(image.src)) origins = [{ source: image.src, sx: args.length === 8 ? args[0] : 0, sy: args.length === 8 ? args[1] : 0,
        sw: args.length === 8 ? args[2] : image.naturalWidth, sh: args.length === 8 ? args[3] : image.naturalHeight, width: image.naturalWidth, height: image.naturalHeight }];
      if (origins.length && this.canvas.id !== 'battle-canvas') lineage.set(this.canvas, origins);
      if (origins.length && this.canvas.id === 'battle-canvas') {
        const matrix = this.getTransform(), ratio = this.canvas.clientWidth / this.canvas.width;
        const point = (x, y) => ({ x: (matrix.a * x + matrix.c * y + matrix.e) * ratio, y: (matrix.b * x + matrix.d * y + matrix.f) * ratio });
        const start = args.length === 8 ? 4 : 0, [x, y, w = image.width, h = image.height] = args.slice(start);
        window.liveCastingDraws.push({ origins, a: point(x, y), b: point(x + w, y), c: point(x, y + h) });
      }
      return original.call(this, image, ...args);
    };
  });
  await page.goto('/playable/spirit-codex.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#title-screen')).toHaveClass(/active/);
  await page.evaluate(async () => {
    SC.resetProgression(); SC.setAutoBattle(false);
    await SC.preloadArt(SC.REQUIRED_ART);
  });
  await page.getByRole('button', { name: /进\s*入\s*城\s*镇/ }).click();
  await page.locator('#town-screen .primary-building').click();
  await page.evaluate(() => SC.navigatePreparation('combos'));
  await expect(page.locator('#preparation-combos')).toBeVisible();
  return errors;
}

// Record commands which genuinely reach Canvas, applying its current transform at command time.
// DOM source/target alignment is independent of geometry data. The v8 release origin
// contract is additionally checked against actual texture-triangle outlets in choreography.spec.
async function installCanvasTrace(page) {
  await page.evaluate(() => {
    if (window.actionCanvasTrace) return;
    const trace = window.actionCanvasTrace = { paths: [], arcs: [], current: [] };
    const prototype = CanvasRenderingContext2D.prototype;
    const relevant = context => context.canvas.classList.contains('combo-cinematic-canvas');
    const point = (context, x, y) => {
      const matrix = context.getTransform(), canvas = context.canvas, rect = canvas.getBoundingClientRect();
      return { x: rect.left + (matrix.a * x + matrix.c * y + matrix.e) * rect.width / canvas.width,
        y: rect.top + (matrix.b * x + matrix.d * y + matrix.f) * rect.height / canvas.height };
    };
    for (const name of ['clearRect', 'beginPath', 'moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'arc', 'ellipse', 'stroke', 'fill']) {
      const original = prototype[name];
      prototype[name] = function (...args) {
        if (relevant(this)) {
          if (name === 'clearRect') { trace.paths = []; trace.arcs = []; trace.current = []; }
          else if (name === 'beginPath') trace.current = [];
          else if (['moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo'].includes(name)) {
            const end = args.length - 2; trace.current.push({ ...point(this, args[end], args[end + 1]), command: name });
          } else if (name === 'arc' || name === 'ellipse') {
            trace.current.push({ ...point(this, args[0], args[1]), command: name, radius: args[2] });
          } else if (this.globalAlpha > .1 && trace.current.length) {
            const path = { points: trace.current.map(item => ({ ...item })), alpha: this.globalAlpha, paint: name };
            trace.paths.push(path);
            trace.arcs.push(...path.points.filter(item => item.command === 'arc' || item.command === 'ellipse'));
          }
        }
        return original.apply(this, args);
      };
    }
  });
}

async function readStageGeometry(page) {
  return page.locator('#combo-cinematic').evaluate(root => {
    const center = element => {
      const box = element.getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    };
    const canvas = root.querySelector('.combo-cinematic-canvas'), rect = canvas.getBoundingClientRect();
    const arena = root.querySelector('.combo-combat-arena'), arenaRect = arena.getBoundingClientRect();
    const releases = JSON.parse(root.dataset.geometry).targets.map(target => ({ uid: String(target.uid),
      x: arenaRect.left + target.start.x - arena.scrollLeft, y: arenaRect.top + target.start.y - arena.scrollTop }));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const pixelsNear = (point, requestedSize = 13) => {
      const x = Math.round((point.x - rect.left) / rect.width * canvas.width), y = Math.round((point.y - rect.top) / rect.height * canvas.height);
      const size = Math.min(requestedSize, canvas.width, canvas.height), half = Math.floor(size / 2);
      const left = Math.max(0, Math.min(canvas.width - size, x - half)), top = Math.max(0, Math.min(canvas.height - size, y - half));
      const data = context.getImageData(left, top, size, size).data;
      return [...data].filter((_, index) => index % 4 === 3 && data[index] > 24).length;
    };
    return {
      paths: window.actionCanvasTrace.paths, arcs: window.actionCanvasTrace.arcs, releases,
      sources: [...root.querySelectorAll('.combo-cast-emitter')].map(element => ({ ...center(element), id: element.closest('.combo-caster').dataset.characterId, pixels: pixelsNear(center(element)) })),
      fusion: center(root.querySelector('.combo-fusion-anchor')),
      fusionPixels: pixelsNear(center(root.querySelector('.combo-fusion-anchor'))),
      heads: [...root.querySelectorAll('.combo-flight-head')].map(element => ({ ...center(element), uid: element.dataset.targetUid, role: element.dataset.effectRole, pixels: pixelsNear(center(element)) })),
      targets: [...root.querySelectorAll('.combo-target')].map(element => {
        const host = element.querySelector('.combo-target-figure-host'), box = host.getBoundingClientRect(), body = center(host);
        const role = element.dataset.effectRole, point = { x: body.x, y: role === 'heal' || role === 'summon' ? box.bottom - 8 : body.y };
        return { ...point, impactPixels: pixelsNear(point, 55),
          uid: element.dataset.targetUid, side: element.dataset.side, hp: Number(element.querySelector('.combo-target-hp').getAttribute('aria-valuenow')),
          shield: Number(element.querySelector('.combo-target-shield')?.getAttribute('aria-valuenow') || 0) };
      }),
    };
  });
}

const distance = (first, second) => Math.hypot(first.x - second.x, first.y - second.y);
const connects = (path, start, end, tolerance = 3) => path.paint === 'stroke' && path.points.length > 1 &&
  distance(path.points[0], start) < tolerance && distance(path.points.at(-1), end) < tolerance;

function assertReleaseAlignment(geometry) {
  expect(geometry.heads.length).toBeGreaterThan(0);
  for (const head of geometry.heads) {
    expect(geometry.targets.some(target => target.uid === head.uid)).toBe(true);
    expect(geometry.paths.some(path => path.paint === 'stroke' && path.points.length > 1 && distance(path.points.at(-1), head) < 4), `${head.uid} visible flight head matches a real Canvas trail`).toBe(true);
    expect(head.pixels, `${head.uid} flight head is painted, not a debug-only point`).toBeGreaterThan(0);
  }
}

async function captureCastingPose(page) {
  return page.locator('#combo-cinematic .combo-caster').evaluateAll(async casters => Promise.all(casters.map(async caster => {
    const sprite = caster.querySelector('.combo-casting-sprite'), picture = sprite.querySelector('img'), emitter = caster.querySelector('.combo-cast-emitter');
    await picture.decode();
    const recipe = SC.COMBO_RECIPES.find(item => item.casting.src === picture.getAttribute('src'));
    const member = recipe.casting.members.find(item => item.id === caster.dataset.characterId);
    const pose = Number(sprite.dataset.pose), row = Number(sprite.dataset.castingRow), style = getComputedStyle(picture);
    const spriteTransform = getComputedStyle(sprite).transform;
    const columns = recipe.casting.columns, rows = recipe.casting.rows;
    const width = picture.naturalWidth / columns, height = picture.naturalHeight / rows;
    const sample = document.createElement('canvas'); sample.width = 64; sample.height = 80;
    const context = sample.getContext('2d', { willReadFrequently: true });
    context.drawImage(picture, pose * width, row * height, width, height, 0, 0, sample.width, sample.height);
    const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
    let hash = 2166136261;
    for (const value of pixels) hash = Math.imul(hash ^ value, 16777619);
    const box = sprite.getBoundingClientRect(), point = emitter.getBoundingClientRect();
    const anchor = member.anchors[pose];
    let anchorInk = 0;
    for (let y = Math.max(0, Math.floor(anchor[1] * sample.height) - 3); y <= Math.min(sample.height - 1, Math.ceil(anchor[1] * sample.height) + 3); y++) {
      for (let x = Math.max(0, Math.floor(anchor[0] * sample.width) - 3); x <= Math.min(sample.width - 1, Math.ceil(anchor[0] * sample.width) + 3); x++) {
        const offset = (y * sample.width + x) * 4;
        if (pixels[offset + 3] > 24 && Math.max(pixels[offset], pixels[offset + 1], pixels[offset + 2]) > 35) anchorInk++;
      }
    }
    // Reconstruct the rendered image axes independently from the emitter: a recoil rotation must not
    // turn an axis-aligned bounding-box fraction into a false report of a detached weapon point.
    let axes = new DOMMatrix();
    for (let element = sprite; element instanceof HTMLElement; element = element.parentElement) {
      const transform = getComputedStyle(element).transform;
      if (transform !== 'none') { const matrix = new DOMMatrix(transform); matrix.e = 0; matrix.f = 0; axes = matrix.multiply(axes); }
    }
    const localWidth = parseFloat(getComputedStyle(sprite).width), localHeight = parseFloat(getComputedStyle(sprite).height);
    const corners = [[0, 0], [localWidth, 0], [0, localHeight], [localWidth, localHeight]].map(([x, y]) => axes.transformPoint({ x, y }));
    const weapon = axes.transformPoint({ x: localWidth * anchor[0], y: localHeight * anchor[1] });
    return { id: caster.dataset.characterId, source: picture.getAttribute('src'), name: caster.querySelector('.combo-participant-name').textContent,
      pose, row, expectedRow: recipe.casting.members.indexOf(member), hash: hash >>> 0, anchorInk,
      // clientWidth/clientHeight round fractional CSS pixels on 360px screens; the image
      // offsets are fractional, so compare each crop against the same unrounded local axes.
      cropX: -parseFloat(style.left) / localWidth, cropY: -parseFloat(style.top) / localHeight,
      naturalWidth: picture.naturalWidth, naturalHeight: picture.naturalHeight, overflow: getComputedStyle(sprite).overflow,
      displayedAspect: localWidth / localHeight, cellAspect: width / height,
      facingX: spriteTransform === 'none' ? 1 : new DOMMatrix(spriteTransform).a,
      nameTransform: getComputedStyle(caster.querySelector('.combo-participant-name')).transform,
      emitter: { x: point.left + point.width / 2, y: point.top + point.height / 2 },
      expectedEmitter: { x: box.left + weapon.x - Math.min(...corners.map(corner => corner.x)), y: box.top + weapon.y - Math.min(...corners.map(corner => corner.y)) },
    };
  })));
}

test.describe('Character actions and anchored combination trajectories', () => {
  test('six pairings show eight real identity-mapped poses and emit from each pose weapon anchor', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = await loadActionPreview(page);
    const recipes = await page.evaluate(() => SC.COMBO_RECIPES.map(recipe => ({ id: recipe.id, ids: recipe.memberIds, casting: recipe.casting })));
    for (const recipe of recipes) {
      expect(recipe.casting).toMatchObject({ src: `assets/combos/cast-${recipe.id}-actions-v4.png`, columns: 4, rows: 2 });
      expect(recipe.casting.members.map(member => member.id)).toEqual(recipe.ids);
      expect(await page.evaluate(id => SC.previewCombo(id), recipe.id)).toBe(true);
      const seen = new Map(); let elapsed = 0;
      for (const [time, pose] of [[800, 0], [2200, 1], [3800, 2], [8000, 3]]) {
        await page.clock.fastForward(time - elapsed); elapsed = time;
        const frames = await captureCastingPose(page);
        expect(frames.map(frame => frame.id).sort()).toEqual([...recipe.ids].sort());
        for (const [index, frame] of frames.entries()) {
          expect(frame).toMatchObject({ source: recipe.casting.src, pose, row: frame.expectedRow, overflow: 'hidden' });
          expect(frame.cropX).toBeCloseTo(pose, 2); expect(frame.cropY).toBeCloseTo(frame.expectedRow, 2);
          expect(frame.naturalWidth).toBeGreaterThanOrEqual(1024); expect(frame.naturalHeight).toBeGreaterThanOrEqual(512);
          expect(frame.displayedAspect, `${recipe.id} ${frame.id} art is not stretched`).toBeCloseTo(frame.cellAspect, 2);
          expect(frame.facingX).toBe(page.viewportSize().width <= 700 && index === 1 ? -1 : 1);
          expect(frame.nameTransform, 'mirroring a caster must not reverse its Chinese name').toBe('none');
          expect(distance(frame.emitter, frame.expectedEmitter), `${recipe.id} ${frame.id} pose ${pose} weapon anchoring`).toBeLessThan(3);
          expect(frame.anchorInk, `${recipe.id} ${frame.id} pose ${pose} anchor must not be in empty image background`).toBeGreaterThan(0);
          const previous = seen.get(frame.id) || []; previous.push(frame.hash); seen.set(frame.id, previous);
        }
      }
      expect(new Set([...seen.values()].flat()).size, `${recipe.id} uses genuinely distinct art in all eight cells`).toBe(8);
      for (const hashes of seen.values()) expect(new Set(hashes).size).toBe(4);
      await page.locator('#combo-preview-replay').click();
      await page.clock.fastForward(800);
      for (const frame of await captureCastingPose(page)) {
        expect(frame).toMatchObject({ source: recipe.casting.src, row: frame.expectedRow, pose: 0 });
        expect(frame.hash).toBe(seen.get(frame.id)[0]);
      }
      await page.locator('#combo-preview-close').click();
    }
    expect(errors).toEqual([]);
  });

  test('real Canvas energy meets at the manifestation then follows attack or support lanes and hits before HUD results change', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = await loadActionPreview(page); await installCanvasTrace(page);
    const examples = [
      ['phoenix', { 'demo-enemy': 'attack' }], ['leviathan', { 'demo-enemy': 'attack' }],
      ['bastion', { 'demo-enemy': 'attack', 'demo-ally': 'shield' }],
      ['spring', { 'demo-ally': 'heal', 'demo-revived': 'heal' }],
      ['eclipse', { 'demo-enemy': 'attack' }], ['legion', { 'demo-enemy': 'attack', 'demo-summon': 'summon' }],
    ];
    for (const [id, roles] of examples) {
      expect(await page.evaluate(id => SC.previewCombo(id), id)).toBe(true);
      await page.clock.fastForward(2200);
      const gathered = await readStageGeometry(page);
      expect(gathered.sources).toHaveLength(2);
      for (const source of gathered.sources) {
        expect(gathered.paths.some(path => connects(path, source, gathered.fusion)), `${id} ${source.id} energy actually reaches fusion`).toBe(true);
        expect(source.pixels).toBeGreaterThan(0);
      }
      expect(gathered.fusionPixels, `${id} shared fusion point contains genuinely painted energy at the actual shared source`).toBeGreaterThan(0);
      await page.clock.fastForward(1100);
      const launched = await readStageGeometry(page);
      assertReleaseAlignment(launched);
      for (const head of launched.heads) {
        expect(head.role).toBe(roles[head.uid]);
        const outlet = launched.releases.find(release => release.uid === head.uid);
        expect(launched.paths.some(path => connects(path, outlet, head, 4)), `${id} the real release trail starts at its resident summon outlet or guided sky origin`).toBe(true);
        if (head.role === 'attack') expect(launched.targets.find(target => target.uid === head.uid).side).toBe('enemy');
        else expect(launched.targets.find(target => target.uid === head.uid).side).toBe(head.role === 'summon' ? 'summon' : 'ally');
      }
      await page.clock.fastForward(600);
      const flying = await readStageGeometry(page); assertReleaseAlignment(flying);
      for (const head of flying.heads) {
        expect(distance(head, launched.heads.find(item => item.uid === head.uid)), `${id} projectile really travels`).toBeGreaterThan(5);
      }
      await page.clock.fastForward(790);
      const beforeHit = await readStageGeometry(page);
      expect(beforeHit.targets.map(({ uid, hp, shield }) => ({ uid, hp, shield }))).toEqual(gathered.targets.map(({ uid, hp, shield }) => ({ uid, hp, shield })));
      const firstTarget = beforeHit.targets[0];
      // The new filled ribbons do not have the old shader's arbitrary 36-subdivision side lanes.
      // Preserve the spatial contract against an actual painted route, without prescribing its shape.
      expect(beforeHit.paths.some(path => path.paint === 'stroke' && path.points.length > 1 && distance(path.points.at(-1), firstTarget) < 10), `${id} the real release route reaches the first hit target`).toBe(true);
      // Assert the first 4.7s contact independently of the later impact snapshot: the 110ms
      // stagger must not make a second recipient lose HP, gain HP or gain a shield early.
      await page.clock.fastForward(40);
      const firstContact = await readStageGeometry(page);
      expect(firstContact.targets[0].hp !== gathered.targets[0].hp || firstContact.targets[0].shield !== gathered.targets[0].shield,
        `${id} the first recipient changes only once the 4.7s contact has occurred`).toBe(true);
      for (const target of firstContact.targets.slice(1)) {
        const initial = gathered.targets.find(candidate => candidate.uid === target.uid);
        expect({ hp: target.hp, shield: target.shield }, `${id} ${target.uid} waits for its own staggered arrival`).toEqual({ hp: initial.hp, shield: initial.shield });
      }
      expect(distance(firstContact.heads.find(head => head.uid === firstTarget.uid), firstTarget), `${id} the 4.7s flight actually arrived before its first HP/SH change`).toBeLessThan(3);
      await page.clock.fastForward(570);
      const impacted = await readStageGeometry(page);
      for (const target of impacted.targets) {
        // A local material impact need not be a generic diagnostic circle. Read its actual pixels
        // at the independently measured torso/foot location instead of prescribing arc() commands.
        expect(target.impactPixels, `${id} ${target.uid} visibly receives its body/foot effect`).toBeGreaterThan(8);
        const before = gathered.targets.find(item => item.uid === target.uid);
        if (roles[target.uid] === 'attack') expect(target.hp).toBeLessThan(before.hp);
        else if (roles[target.uid] === 'shield') expect(target.shield).toBeGreaterThan(before.shield);
        else expect(target.hp).toBeGreaterThan(before.hp);
      }
      await page.locator('#combo-preview-close').click();
    }
    expect(errors).toEqual([]);
  });

  test('manual camera scrolling and a live responsive resize preserve real Canvas to DOM alignment', async ({ page }) => {
    const errors = await loadActionPreview(page); await installCanvasTrace(page);
    expect(await page.evaluate(() => SC.previewCombo('bastion'))).toBe(true);
    await page.clock.fastForward(3300);
    assertReleaseAlignment(await readStageGeometry(page));
    const original = page.viewportSize();
    await page.setViewportSize({ width: original.width <= 700 ? 860 : 360, height: 700 });
    await page.clock.fastForward(32);
    assertReleaseAlignment(await readStageGeometry(page));
    const facing = await page.locator('#combo-cinematic .combo-casting-sprite').evaluateAll(sprites => sprites.map(sprite => {
      const transform = getComputedStyle(sprite).transform;
      return transform === 'none' ? 1 : new DOMMatrix(transform).a;
    }));
    expect(facing).toEqual([1, original.width <= 700 ? 1 : -1]);
    // Exercise an actual wheel event, then choose a nonzero content offset independent of platform wheel amount.
    const arena = page.locator('#combo-cinematic .combo-combat-arena');
    await arena.hover(); await page.mouse.wheel(0, 130);
    await arena.evaluate(element => { element.scrollTop = Math.min(140, element.scrollHeight - element.clientHeight); });
    await page.clock.fastForward(32);
    await expect(page.locator('#combo-cinematic')).toHaveAttribute('data-camera-manual', 'true');
    const manualOffset = await arena.evaluate(element => element.scrollTop);
    assertReleaseAlignment(await readStageGeometry(page));
    await page.clock.fastForward(200);
    expect(await arena.evaluate(element => element.scrollTop)).toBe(manualOffset);
    assertReleaseAlignment(await readStageGeometry(page));
    await page.locator('#combo-preview-close').click();
    expect(errors).toEqual([]);
  });

  test('either real partner can lead without swapping character action-sheet rows or spending twice', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = await loadActionPreview(page);
    const recipes = await page.evaluate(() => SC.COMBO_RECIPES.map(recipe => ({ id: recipe.id, ids: recipe.memberIds })));
    for (const recipe of recipes) {
      const result = await page.evaluate(id => {
        resetGame(); SC.resetProgression(); SC.setAutoBattle(false); SC.setRandomSource(() => .5);
        const recipe = SC.COMBO_RECIPES.find(item => item.id === id), indices = recipe.memberIds.map(member => SC.CHARACTERS.findIndex(character => character.id === member));
        SC.setTeam([...indices, ...SC.CHARACTERS.map((_, index) => index).filter(index => !indices.includes(index))].slice(0, 4));
        SC.startBattle(); const state = SC.state; state.battleToken++;
        const actor = state.allies.find(unit => unit.characterId === recipe.memberIds[1]), partner = state.allies.find(unit => unit.characterId === recipe.memberIds[0]);
        state.allies.forEach(unit => { unit.energy = 100; unit.debuffs = []; unit._acted = false; });
        actor.energy = 60; partner.energy = 40; state.turnOrder = [actor]; state.curIdx = 0; state.phase = 'player';
        state.enemies.forEach(unit => { unit.curHp = unit.maxHp = 100000; unit.res = 0; unit.debuffs = []; });
        if (id === 'phoenix') SC.applyStatus(state.enemies[0], 'burn', actor, 1, 3);
        if (id === 'leviathan') SC.applyStatus(state.enemies[0], 'slow', actor, 1, 3);
        if (id === 'bastion') actor.shield = 1;
        if (id === 'spring') {
          const others = state.allies.filter(unit => unit !== actor && unit !== partner);
          others[0].curHp = 1; others[1].curHp = 0; others[1].alive = false; others[1]._acted = true;
        }
        if (id === 'eclipse') state.enemies[0].charging = { skillIndex: 1, turns: 1 };
        if (id === 'legion') SC.summonUnits(actor, { summon: 'skeleton' });
        const before = JSON.stringify(SC.progression.inventory), original = window.LiveCombo;
        let presentation, executed;
        window.LiveCombo = { ...original, get current() { return original.current; }, play(recipe, participants, options) { presentation = options; return original.play(recipe, participants, options); } };
        try { executed = SC.executeCombo(id); } finally { window.LiveCombo = original; }
        return { executed, before, after: JSON.stringify(SC.progression.inventory), leader: actor.characterId, partner: partner.characterId,
          energies: [actor.energy, partner.energy], casts: state.run.comboCasts,
          affected: presentation.targets.map(target => ({ uid: String(target.uid), side: target.side, hpBefore: target.hpBefore, hpAfter: target.hpAfter,
            aliveBefore: target.aliveBefore, aliveAfter: target.aliveAfter, labels: target.labels })) };
      }, recipe.id);
      expect(result).toMatchObject({ executed: true, leader: recipe.ids[1], partner: recipe.ids[0], energies: [0, 0], casts: 1 });
      expect(result.after).not.toBe(result.before);
      await page.clock.fastForward(2200);
      const frames = await page.evaluate(() => LiveCombo.current.participants.map(unit => {
        const session = LiveCombo.current, row = session.casting.members.findIndex(member => member.id === unit.characterId), rect = unit._artRect;
        const center = draw => ({ x: (draw.b.x + draw.c.x) / 2, y: (draw.b.y + draw.c.y) / 2 });
        const draw = window.liveCastingDraws.filter(draw => draw.origins.some(origin => origin.source.endsWith(session.casting.src)))
          .sort((a, b) => Math.hypot(center(a).x - unit._x, center(a).y - (rect.y + rect.height / 2)) - Math.hypot(center(b).x - unit._x, center(b).y - (rect.y + rect.height / 2)))[0];
        if (!draw) return { id: unit.characterId, row: -1 };
        const origin = draw.origins[0], actualRow = Math.round(origin.sy / (origin.height / 2)), frame = Math.round(origin.sx / (origin.width / 4));
        const anchor = session.casting.members[row].anchors[frame], emitter = session.geometry.sources.find(source => source.uid === unit.uid);
        return { id: unit.characterId, row: actualRow, emitter, expectedEmitter: { x: draw.a.x + (draw.b.x - draw.a.x) * anchor[0] + (draw.c.x - draw.a.x) * anchor[1],
          y: draw.a.y + (draw.b.y - draw.a.y) * anchor[0] + (draw.c.y - draw.a.y) * anchor[1] } };
      }));
      expect(frames.map(frame => frame.id)).toEqual([recipe.ids[1], recipe.ids[0]]);
      expect(frames.map(frame => frame.row)).toEqual([1, 0]);
      for (const frame of frames) expect(distance(frame.emitter, frame.expectedEmitter)).toBeLessThan(3);
      await expect(page.locator('#combo-cinematic')).toHaveCount(0);
      const displayed = await page.evaluate(() => LiveCombo.current.geometry.targets.map(target => ({ uid: String(target.uid), side: target.side, role: target.role })));
      expect(displayed.length, 'the real battlefield must retain every actual recipient rather than the old three-card presentation limit').toBe(result.affected.length);
      for (const target of displayed) expect(result.affected.some(actual => actual.uid === target.uid && actual.side === target.side)).toBe(true);
      if (recipe.id === 'bastion') {
        expect(displayed.some(target => target.role === 'attack' && target.side === 'enemy')).toBe(true);
        expect(displayed.some(target => target.role === 'shield' && target.side === 'ally')).toBe(true);
      } else if (recipe.id === 'legion') {
        const summoned = result.affected.find(target => target.labels.includes('召唤入场'));
        expect(summoned).toBeTruthy(); expect(displayed).toContainEqual({ uid: summoned.uid, side: 'summon', role: 'summon' });
      } else if (recipe.id === 'spring') {
        const revived = result.affected.find(target => !target.aliveBefore && target.aliveAfter);
        expect(revived).toBeTruthy(); expect(displayed).toContainEqual({ uid: revived.uid, side: 'ally', role: 'heal' });
        expect(displayed.every(target => target.role === 'heal' && target.side === 'ally')).toBe(true);
      } else expect(displayed.every(target => target.role === 'attack' && target.side === 'enemy')).toBe(true);
      await page.evaluate(() => { SC.state.battleToken++; LiveCombo.clear(); });
      await page.clock.fastForward(10000);
      expect(await page.evaluate(() => SC.state.run.comboCasts)).toBe(1);
    }
    await page.evaluate(() => { SC.resetRandomSource(); resetGame(); });
    expect(errors).toEqual([]);
  });
});
