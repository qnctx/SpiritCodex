const { test, expect } = require('@playwright/test');

// These are art landmarks, not coordinates returned by the choreography/rig implementation.
// Actual Canvas texture transforms below project them through the triangle which was drawn.
const OUTLETS = {
  phoenix: [[.22, .08], [.56, .16]], leviathan: [[.825, .315]], bastion: [[.50, .455]],
  spring: [[.50, .73]], eclipse: [[.16, .50], [.84, .50]], legion: [[.50, .58]],
};
const KINDS = { phoenix: 'sky-fire', leviathan: 'dragon-breath', bastion: 'solar-lance',
  spring: 'petal-stream', eclipse: 'crescent-cut', legion: 'soul-volley' };
// A lotus opens its petals around a deliberately stable healing centre. Test the
// painted petals/crown for action, while independently testing the centre as its outlet.
const ACTION_POINTS = { spring: [[.25, .72], [.75, .72], [.50, .25]] };
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

async function loadChoreography(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.clock.install({ time: new Date('2026-09-05T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-05T12:01:00Z'));
  await page.addInitScript(() => {
    const audit = window.choreographyPaint = { paths: [], images: [] };
    const states = new WeakMap(), lineage = new WeakMap(), prototype = CanvasRenderingContext2D.prototype;
    const relevant = ctx => ctx.canvas.classList.contains('combo-cinematic-canvas');
    const state = ctx => {
      if (!states.has(ctx)) states.set(ctx, { path: [], clip: null, stack: [] });
      return states.get(ctx);
    };
    const project = (ctx, x, y) => {
      const m = ctx.getTransform(), box = ctx.canvas.getBoundingClientRect();
      return { x: box.left + (m.a * x + m.c * y + m.e) * box.width / ctx.canvas.width,
        y: box.top + (m.b * x + m.d * y + m.f) * box.height / ctx.canvas.height };
    };
    for (const name of ['save', 'restore', 'clearRect', 'beginPath', 'moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'clip', 'stroke']) {
      const original = prototype[name];
      prototype[name] = function (...args) {
        if (relevant(this)) {
          const s = state(this);
          if (name === 'save') s.stack.push(s.clip);
          else if (name === 'restore') s.clip = s.stack.pop() || null;
          else if (name === 'clearRect') { audit.paths = []; audit.images = []; }
          else if (name === 'beginPath') s.path = [];
          else if (['moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo'].includes(name)) s.path.push(project(this, args.at(-2), args.at(-1)));
          else if (name === 'clip') {
            const p = s.path;
            s.clip = p.length === 3 || p.length === 4 && Math.hypot(p[0].x - p[3].x, p[0].y - p[3].y) < .01 ? p.slice(0, 3) : null;
          } else if (name === 'stroke' && this.globalAlpha > .1 && s.path.length > 1) {
            audit.paths.push(s.path.map(point => ({ ...point })));
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
      let origins = lineage.get(source) || [];
      if (source instanceof HTMLImageElement && /(?:reference-.*-v7|ultimate-.*-sequence-v3|phoenix-combat-facing-v9)\.png(?:$|\?)/.test(source.src)) {
        origins = [{ source: source.src, sx: crop.sx, sy: crop.sy, sw: crop.sw, sh: crop.sh, width, height }];
      }
      if (!relevant(this) && origins.length) {
        const combined = [...(lineage.get(this.canvas) || []), ...origins];
        lineage.set(this.canvas, [...new Map(combined.map(origin => [JSON.stringify(origin), origin])).values()]);
      }
      if (relevant(this) && origins.length && this.globalAlpha > .05) {
        const a = project(this, crop.dx - crop.sx * crop.dw / crop.sw, crop.dy - crop.sy * crop.dh / crop.sh);
        const u = project(this, crop.dx + (width - crop.sx) * crop.dw / crop.sw, crop.dy - crop.sy * crop.dh / crop.sh);
        const v = project(this, crop.dx - crop.sx * crop.dw / crop.sw, crop.dy + (height - crop.sy) * crop.dh / crop.sh);
        audit.images.push({ origins, source, clip: state(this).clip,
          affine: [u.x - a.x, u.y - a.y, v.x - a.x, v.y - a.y, a.x, a.y] });
      }
      return originalDraw.call(this, source, ...args);
    };
  });
  await page.goto('/playable/spirit-codex.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#title-screen')).toHaveClass(/active/);
  await page.evaluate(async () => { SC.resetProgression(); SC.setAutoBattle(false); await SC.preloadArt(SC.REQUIRED_ART); });
  await page.getByRole('button', { name: /进\s*入\s*城\s*镇/ }).click();
  await page.locator('#town-screen .primary-building').click();
  await page.evaluate(() => SC.navigatePreparation('combos'));
  await expect(page.locator('#preparation-combos')).toBeVisible();
  return errors;
}

async function captureChoreography(page, id) {
  return page.locator('#combo-cinematic').evaluate((root, { id, landmarks, actionPoints }) => {
    const recipe = SC.COMBO_RECIPES.find(recipe => recipe.id === id), rig = recipe.rig.combat || recipe.rig, arena = root.querySelector('.combo-combat-arena');
    const area = arena.getBoundingClientRect(), canvas = root.querySelector('.combo-cinematic-canvas'), box = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const content = point => ({ x: point.x - area.left + arena.scrollLeft, y: point.y - area.top + arena.scrollTop });
    const center = node => { const r = node.getBoundingClientRect(); return { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 }; };
    const near = (point, size = 15) => {
      const x = Math.round((point.x - box.left) * canvas.width / box.width), y = Math.round((point.y - box.top) * canvas.height / box.height);
      if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return null;
      const left = Math.max(0, x - size), top = Math.max(0, y - size), right = Math.min(canvas.width, x + size + 1), bottom = Math.min(canvas.height, y + size + 1);
      const data = ctx.getImageData(left, top, right - left, bottom - top).data;
      return data.filter((value, index) => index % 4 === 3 && value > 24).length;
    };
    const project = (triangle, u, v) => ({ x: triangle.affine[0] * u + triangle.affine[2] * v + triangle.affine[4],
      y: triangle.affine[1] * u + triangle.affine[3] * v + triangle.affine[5] });
    const inside = (point, triangle) => {
      if (!triangle.clip) return false;
      const cross = (a, b) => (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
      const sides = triangle.clip.map((a, index, all) => cross(a, all[(index + 1) % 3]));
      return sides.every(value => value >= -.5) || sides.every(value => value <= .5);
    };
    const images = window.choreographyPaint.images.filter(image => image.origins.some(origin => origin.source.endsWith(rig.src)));
    const expectedFrame = recipe.rig.combat ? 0 : 1;
    const frame = origin => Math.round(origin.sx / (origin.width / rig.columns)) + Math.round(origin.sy / (origin.height / rig.rows)) * rig.columns;
    const sourceFrames = [...new Set(images.flatMap(image => image.origins.map(frame)))];
    const triangles = images.filter(image => image.clip && image.origins.every(origin => frame(origin) === expectedFrame));
    const vertices = triangles.flatMap(triangle => triangle.clip).map(content);
    const bounds = vertices.length ? { left: Math.min(...vertices.map(p => p.x)), right: Math.max(...vertices.map(p => p.x)),
      top: Math.min(...vertices.map(p => p.y)), bottom: Math.max(...vertices.map(p => p.y)) } : null;
    if (bounds) { bounds.x = (bounds.left + bounds.right) / 2; bounds.y = (bounds.top + bounds.bottom) / 2; bounds.width = bounds.right - bounds.left; bounds.height = bounds.bottom - bounds.top; }
    const projected = [...landmarks, ...actionPoints].map(([u, v]) => {
      const triangle = triangles.find(triangle => inside(project(triangle, u, v), triangle));
      if (!triangle) return null;
      const point = project(triangle, u, v), sample = document.createElement('canvas'); sample.width = sample.height = 11;
      sample.getContext('2d').drawImage(triangle.source, u * triangle.source.width - 5, v * triangle.source.height - 5, 11, 11, 0, 0, 11, 11);
      const ink = sample.getContext('2d').getImageData(0, 0, 11, 11).data.filter((value, index, all) => index % 4 === 3 && value > 24 && Math.max(all[index - 1], all[index - 2], all[index - 3]) > 16).length;
      return { ...content(point), ink, painted: near(point) };
    });
    const outlets = projected.slice(0, landmarks.length), actionLandmarks = projected.slice(landmarks.length);
    const targets = [...root.querySelectorAll('.combo-target')].map(target => {
      const host = target.querySelector('.combo-target-figure-host'), r = host.getBoundingClientRect(), body = center(host), role = target.dataset.effectRole;
      const point = { x: body.x, y: ['heal', 'summon'].includes(role) ? r.bottom - 8 : body.y };
      return { ...content(point), uid: target.dataset.targetUid, role, side: target.dataset.side, pixels: near(point, 27),
        hp: Number(target.querySelector('.combo-target-hp').getAttribute('aria-valuenow')),
        shield: Number(target.querySelector('.combo-target-shield')?.getAttribute('aria-valuenow') || 0) };
    });
    const hudPollution = [];
    for (const node of root.querySelectorAll('.combo-target-hp,.combo-target-shield,.combo-target-name,.combo-target-tag,.combo-target-feedback,.combo-target-status,.combo-participant-name')) {
      const r = node.getBoundingClientRect(), style = getComputedStyle(node);
      if (!r.width || !r.height || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
      const left = Math.max(0, Math.ceil((r.left + 1 - box.left) * canvas.width / box.width));
      const right = Math.min(canvas.width, Math.floor((r.right - 1 - box.left) * canvas.width / box.width));
      const top = Math.max(0, Math.ceil((r.top + 1 - box.top) * canvas.height / box.height));
      const bottom = Math.min(canvas.height, Math.floor((r.bottom - 1 - box.top) * canvas.height / box.height));
      if (right > left && bottom > top && ctx.getImageData(left, top, right - left, bottom - top).data.some((value, index) => index % 4 === 3 && value > 24)) hudPollution.push(node.className);
    }
    const geometry = JSON.parse(root.dataset.geometry), elapsed = Number(root.dataset.elapsed);
    return { sourceFrames, expectedFrame, columns: rig.columns, rows: rig.rows, triangles: triangles.length, unmeshed: images.filter(image => !image.clip).length,
      crops: images.flatMap(image => image.origins.map(origin => ({ width: origin.sw, height: origin.sh, sheetWidth: origin.width, sheetHeight: origin.height }))),
      bounds, outlets, actionLandmarks, targets, paths: window.choreographyPaint.paths.map(path => path.map(content)),
      heads: [...root.querySelectorAll('.combo-flight-head')].map(node => ({ ...content(center(node)), uid: node.dataset.targetUid, pixels: near(center(node)) })),
      sample: window.ComboChoreography?.sample(geometry, recipe.motion, elapsed, { artVariant: recipe.rig.combat?.variant,
        facingState: { targetUid: geometry.choreography?.caster?.facingTargetUid, facingX: geometry.choreography?.caster?.facingX } }), elapsed, hudPollution,
      fusion: content(center(root.querySelector('.combo-fusion-anchor'))),
      stage: { width: arena.clientWidth, height: arena.scrollHeight }, overflow: root.scrollWidth > root.clientWidth + 1 };
  }, { id, landmarks: OUTLETS[id], actionPoints: ACTION_POINTS[id] || OUTLETS[id] });
}

function assertResidentArt(frame, id, initial) {
  expect(frame.sourceFrames, `${id}: only the formed creature/caster cell is painted; no travelling or impact sheet entity`).toEqual([frame.expectedFrame]);
  expect(frame.unmeshed).toBe(0);
  expect(frame.triangles, `${id}: the resident original art remains genuinely texture-meshed`).toBeGreaterThanOrEqual(100);
  expect(frame.crops.every(crop => crop.width <= crop.sheetWidth / frame.columns && crop.height <= crop.sheetHeight / frame.rows)).toBe(true);
  expect(frame.bounds.width).toBeGreaterThan(100);
  expect(frame.bounds.width * frame.bounds.height).toBeLessThan(frame.stage.width * frame.stage.height * .30);
  expect(frame.outlets.every(Boolean), `${id}: painted firing landmarks remain in the resident mesh`).toBe(true);
  expect(distance(frame.bounds, frame.fusion), `${id}: summoned figure stays near its own stage position`).toBeLessThan(frame.bounds.width * .35);
  if (initial) expect(distance(frame.bounds, initial.bounds), `${id}: firing does not send the entire painted figure into the enemy`).toBeLessThan(initial.bounds.width * .30);
  expect(frame.hudPollution).toEqual([]); expect(frame.overflow).toBe(false);
}

function assertOutletRoutes(frame, id) {
  expect(frame.sample?.version).toBe(9);
  expect(frame.sample?.attacks.length).toBe(frame.targets.length);
  expect(frame.outlets.every(Boolean), `${id}: weapon landmarks occur on real drawn texture triangles`).toBe(true);
  expect(frame.outlets.every(outlet => outlet.ink > 0), `${id}: declared outlets refer to painted organs, not empty corners`).toBe(true);
  for (const [index, attack] of frame.sample.attacks.entries()) {
    const target = frame.targets.find(target => target.uid === String(attack.uid)), head = frame.heads.find(head => head.uid === String(attack.uid));
    expect(target).toBeTruthy(); expect(head).toBeTruthy();
    expect(attack.strike).toBe(4700 + index * 110);
    expect(distance(attack.end, target), `${id}: effect destination agrees with the real target torso/foot`).toBeLessThan(3);
    expect(distance(attack.head, head), `${id}: visible head agrees with rendered choreography`).toBeLessThan(3);
    expect(frame.paths.some(path => distance(path[0], attack.start) < 4 && distance(path.at(-1), head) < 4), `${id}: an actual painted route joins its outlet to the moving effect head`).toBe(true);
    if (head.pixels !== null) expect(head.pixels).toBeGreaterThan(0);
    if (target.role === 'attack') {
      expect(target.side).toBe('enemy'); expect(attack.kind).toBe(KINDS[id]);
    } else expect(target.side).toBe(target.role === 'summon' ? 'summon' : 'ally');
    if (id === 'phoenix' && target.role === 'attack') {
      expect(attack.start.y, 'phoenix rains down sky-fire instead of ramming the bird into a target').toBeLessThan(target.y - 60);
      expect(Math.abs(attack.start.x - target.x), 'the sky origin remains over the recipient lane').toBeLessThan(Math.min(100, frame.bounds.width * .4));
      expect(frame.paths.some(path => frame.outlets.some(outlet => distance(path[0], outlet) < 4) && distance(path.at(-1), attack.start) < 4), 'real wing-tip guidance reaches the sky-fire origin').toBe(true);
    } else expect(Math.min(...frame.outlets.map(outlet => distance(outlet, attack.start))), `${id}: attack starts on a separately reconstructed mesh mouth/core/blade/gate`).toBeLessThan(4);
  }
}

test.describe('Resident summons and skill-specific ranged choreography', () => {
  test('six original formed figures stay in place while their internal action and separate attacks continue', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = await loadChoreography(page);
    for (const id of Object.keys(OUTLETS)) {
      expect(await page.evaluate(id => SC.previewCombo(id), id)).toBe(true);
      let elapsed = 0, initial; const localShapes = [];
      for (const time of [2200, 3150, 3600, 4200, 5200]) {
        await page.clock.fastForward(time - elapsed); elapsed = time;
        const frame = await captureChoreography(page, id); assertResidentArt(frame, id, initial); initial ||= frame;
        // Normalise away the body's translation/size. Its actual painted outlet must
        // still articulate; moving or shrinking a single rigid image cannot satisfy this.
        expect(frame.actionLandmarks.every(point => point && point.ink > 0), `${id}: internal-action landmarks lie on actual painted anatomy`).toBe(true);
        localShapes.push(frame.actionLandmarks.map(point => point && ({ x: (point.x - frame.bounds.left) / frame.bounds.width,
          y: (point.y - frame.bounds.top) / frame.bounds.height })));
      }
      const articulation = Math.max(...localShapes.slice(1).flatMap(shape => shape.map((point, index) => distance(point, localShapes[0][index]))));
      expect(articulation, `${id}: the visible firing organ really acts inside the stationary original artwork`).toBeGreaterThan(.003);
      await page.locator('#combo-preview-close').click();
    }
    expect(errors).toEqual([]);
  });

  test('each ranged skill leaves its real deformed art outlet and waits for individual target contact before showing results', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = await loadChoreography(page);
    const before = await page.evaluate(() => {
      window.choreographyRandomAudit = { game: 0, math: 0, original: Math.random };
      Math.random = () => { window.choreographyRandomAudit.math++; return .413; };
      SC.setRandomSource(() => { window.choreographyRandomAudit.game++; return .617; });
      return JSON.stringify({ profile: SC.progression, battle: SC.snapshot(), uid: UID, storage: Object.entries(localStorage).sort() });
    });
    for (const id of Object.keys(OUTLETS)) {
      expect(await page.evaluate(id => SC.previewCombo(id), id)).toBe(true);
      await page.clock.fastForward(3300);
      const launched = await captureChoreography(page, id); assertOutletRoutes(launched, id);
      await page.clock.fastForward(600);
      const firing = await captureChoreography(page, id); assertOutletRoutes(firing, id);
      for (const head of firing.heads) expect(distance(head, launched.heads.find(item => item.uid === head.uid))).toBeGreaterThan(5);
      await page.clock.fastForward(790);
      const beforeHit = await captureChoreography(page, id);
      const meters = frame => frame.targets.map(({ uid, hp, shield }) => ({ uid, hp, shield }));
      expect(meters(beforeHit)).toEqual(meters(launched));
      await page.clock.fastForward(40);
      const firstHit = await captureChoreography(page, id), target = firstHit.targets[0];
      expect(target.hp !== launched.targets[0].hp || target.shield !== launched.targets[0].shield, `${id}: first target responds after 4.7s, not before contact`).toBe(true);
      expect(distance(firstHit.heads.find(head => head.uid === target.uid), target)).toBeLessThan(3);
      expect(meters(firstHit).slice(1), 'later beneficiaries still wait for their 110ms stagger').toEqual(meters(launched).slice(1));
      await page.clock.fastForward(570);
      const impact = await captureChoreography(page, id); assertResidentArt(impact, id, launched);
      for (const target of impact.targets) {
        const previous = launched.targets.find(item => item.uid === target.uid);
        if (target.role === 'attack') expect(target.hp).toBeLessThan(previous.hp);
        else if (target.role === 'shield') expect(target.shield).toBeGreaterThan(previous.shield);
        else expect(target.hp).toBeGreaterThan(previous.hp);
        if (target.pixels !== null) expect(target.pixels).toBeGreaterThan(8);
      }
      await page.locator('#combo-preview-close').click();
    }
    const result = await page.evaluate(() => {
      const audit = window.choreographyRandomAudit;
      const snapshot = JSON.stringify({ profile: SC.progression, battle: SC.snapshot(), uid: UID, storage: Object.entries(localStorage).sort() });
      Math.random = audit.original; SC.resetRandomSource();
      return { snapshot, game: audit.game, math: audit.math };
    });
    expect(result).toEqual({ snapshot: before, game: 0, math: 0 }); expect(errors).toEqual([]);
  });

  test('live resize and manual camera movement keep mesh outlets, ranged effects and reachable controls aligned', async ({ page }) => {
    const errors = await loadChoreography(page);
    expect(await page.evaluate(() => SC.previewCombo('leviathan'))).toBe(true);
    await page.clock.fastForward(3600);
    assertOutletRoutes(await captureChoreography(page, 'leviathan'), 'leviathan');
    const original = page.viewportSize();
    await page.setViewportSize({ width: original.width <= 700 ? 860 : 360, height: 700 });
    await page.clock.fastForward(32);
    assertOutletRoutes(await captureChoreography(page, 'leviathan'), 'leviathan');
    const arena = page.locator('#combo-cinematic .combo-combat-arena');
    await arena.hover(); await page.mouse.wheel(0, 140);
    await arena.evaluate(element => { element.scrollTop = Math.min(140, element.scrollHeight - element.clientHeight); });
    await page.clock.fastForward(32);
    const scroll = await arena.evaluate(element => element.scrollTop);
    const manual = await captureChoreography(page, 'leviathan'); assertOutletRoutes(manual, 'leviathan');
    expect(manual.hudPollution).toEqual([]); expect(manual.overflow).toBe(false);
    await page.clock.fastForward(200);
    expect(await arena.evaluate(element => element.scrollTop)).toBe(scroll);
    assertOutletRoutes(await captureChoreography(page, 'leviathan'), 'leviathan');
    await expect(page.locator('#combo-preview-replay')).toBeInViewport();
    await page.locator('#combo-preview-replay').click();
    await page.clock.fastForward(3600);
    assertOutletRoutes(await captureChoreography(page, 'leviathan'), 'leviathan');
    await page.locator('#combo-preview-close').click();
    await expect(page.locator('#combo-cinematic')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
