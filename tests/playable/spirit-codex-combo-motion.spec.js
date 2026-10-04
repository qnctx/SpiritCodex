const { test, expect } = require('@playwright/test');

async function loadMotionPreview(page, { clocked = false } = {}) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    const audit = window.comboRuntimeAudit = { draws: 0, bitmaps: [], frameMeshes: [], meshDraws: 0 };
    for (const name of ['ComboStageVFX', 'ComboArtRig']) {
      let renderer;
      Object.defineProperty(window, name, { configurable: true,
        get: () => renderer,
        set: value => {
          renderer = value && typeof value.draw === 'function' ? { ...value, draw(...args) {
            audit.draws++; return value.draw.apply(value, args);
          } } : value;
        },
      });
    }
    const contexts = new WeakMap(), lineage = new WeakMap(), bitmapKinds = new Set();
    const ownStage = context => context.canvas.classList?.contains('combo-cinematic-canvas');
    const stateFor = context => {
      if (!contexts.has(context)) contexts.set(context, { path: [], triangle: null, stack: [] });
      return contexts.get(context);
    };
    const coordinates = (context, x, y) => {
      const matrix = context.getTransform();
      return { x: matrix.a * x + matrix.c * y + matrix.e, y: matrix.b * x + matrix.d * y + matrix.f };
    };
    for (const method of ['save', 'restore', 'beginPath', 'moveTo', 'lineTo', 'clip', 'clearRect']) {
      const original = CanvasRenderingContext2D.prototype[method];
      CanvasRenderingContext2D.prototype[method] = function (...args) {
        if (ownStage(this)) {
          const state = stateFor(this);
          if (method === 'save') state.stack.push(state.triangle);
          else if (method === 'restore') state.triangle = state.stack.pop() || null;
          else if (method === 'beginPath') state.path = [];
          else if (method === 'moveTo' || method === 'lineTo') state.path.push(coordinates(this, args[0], args[1]));
          else if (method === 'clip') {
            const points = state.path;
            const closed = points.length === 4 && Math.hypot(points[0].x - points[3].x, points[0].y - points[3].y) < .001;
            state.triangle = points.length === 3 || closed ? points.slice(0, 3).map(point => ({ ...point })) : null;
          } else if (method === 'clearRect') audit.frameMeshes = [];
        }
        return original.apply(this, args);
      };
    }
    const original = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (source, ...args) {
      const nativeWidth = source.naturalWidth || source.videoWidth || source.width, nativeHeight = source.naturalHeight || source.videoHeight || source.height;
      const [sx, sy, sw, sh, dx, dy, width, height] = args.length === 8 ? args : [0, 0, nativeWidth, nativeHeight,
        args[0], args[1], args.length === 4 ? args[2] : nativeWidth, args.length === 4 ? args[3] : nativeHeight];
      const directSource = source.getAttribute?.('src') || source.src || '';
      const origins = directSource ? [{ source: directSource, sx, sy, sw, sh, width: nativeWidth, height: nativeHeight }] : lineage.get(source) || [];
      if (!ownStage(this)) {
        if (origins.length) {
          const existing = lineage.get(this.canvas) || [];
          for (const origin of origins) if (!existing.some(item => JSON.stringify(item) === JSON.stringify(origin))) existing.push(origin);
          lineage.set(this.canvas, existing);
        }
      } else {
        const matrix = this.getTransform(), triangle = stateFor(this).triangle;
        const coverage = Math.abs(matrix.a * matrix.d - matrix.b * matrix.c) * width * height / (this.canvas.width * this.canvas.height);
        const triangleArea = triangle ? Math.abs((triangle[1].x - triangle[0].x) * (triangle[2].y - triangle[0].y) -
          (triangle[1].y - triangle[0].y) * (triangle[2].x - triangle[0].x)) / 2 : 0;
        const bitmap = { source: directSource, origins, coverage, triangleCoverage: triangleArea / (this.canvas.width * this.canvas.height), mesh: !!triangle };
        // Keep all distinct rendering modes, but avoid retaining hundreds of thousands of
        // equivalent draw calls while a genuine dense rig animates across several previews.
        const kind = JSON.stringify([directSource, origins, !!triangle, coverage > .25]);
        if (!bitmapKinds.has(kind)) { bitmapKinds.add(kind); audit.bitmaps.push(bitmap); }
        if (triangle && !directSource && origins.length && this.globalAlpha > .05) {
          const inverse = matrix.inverse(), box = this.canvas.getBoundingClientRect();
          const vertices = triangle.map(point => {
            const local = inverse.transformPoint(point);
            return { u: (sx + (local.x - dx) / width * sw) / nativeWidth, v: (sy + (local.y - dy) / height * sh) / nativeHeight,
              x: box.left + point.x / this.canvas.width * box.width, y: box.top + point.y / this.canvas.height * box.height };
          });
          const u = vertices.reduce((sum, point) => sum + point.u, 0) / 3, v = vertices.reduce((sum, point) => sum + point.v, 0) / 3;
          const scaleX = box.width / this.canvas.width, scaleY = box.height / this.canvas.height;
          const baseX = dx - sx / sw * width, baseY = dy - sy / sh * height;
          audit.frameMeshes.push({ key: `${u.toFixed(5)}:${v.toFixed(5)}`, u, v, vertices, origins, texture: source,
            source: source.dataset?.rigSource || '', frame: source.dataset?.rigFrame ?? null,
            x: vertices.reduce((sum, point) => sum + point.x, 0) / 3, y: vertices.reduce((sum, point) => sum + point.y, 0) / 3,
            uvToScreen: { a: matrix.a * nativeWidth / sw * width * scaleX, b: matrix.b * nativeWidth / sw * width * scaleY,
              c: matrix.c * nativeHeight / sh * height * scaleX, d: matrix.d * nativeHeight / sh * height * scaleY,
              e: box.left + (matrix.a * baseX + matrix.c * baseY + matrix.e) * scaleX,
              f: box.top + (matrix.b * baseX + matrix.d * baseY + matrix.f) * scaleY },
            coverage: bitmap.triangleCoverage });
          audit.meshDraws++;
        }
      }
      return original.call(this, source, ...args);
    };
    const textureSamples = new WeakMap();
    const inspectTexture = texture => {
      if (textureSamples.has(texture)) return textureSamples.get(texture);
      const sample = document.createElement('canvas'); sample.width = 128; sample.height = 128;
      const context = sample.getContext('2d', { willReadFrequently: true });
      context.drawImage(texture, 0, 0, 128, 128);
      const pixels = context.getImageData(0, 0, 128, 128).data; let edgePixels = 0, darkEdges = 0;
      for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
        const edge = Math.min(x, y, 127 - x, 127 - y) / 128;
        if (edge < .025 || edge > .075) continue;
        edgePixels++; const offset = (y * 128 + x) * 4;
        if (pixels[offset + 3] > 24 && Math.max(pixels[offset], pixels[offset + 1], pixels[offset + 2]) <= 8) darkEdges++;
      }
      const result = { pixels, darkBorderRatio: darkEdges / edgePixels, nativePixels: null };
      textureSamples.set(texture, result); return result;
    };
    audit.classifyDarkPixels = (pixels, width, height, box) => {
      const meshes = audit.frameMeshes.filter(triangle => triangle.source && triangle.origins.some(origin => origin.source.endsWith(triangle.source)));
      const unique = [...new Map(meshes.map(triangle => [triangle.texture, triangle])).values()];
      const sourceBorders = unique.map(triangle => ({ source: triangle.source, frame: triangle.frame, darkBorderRatio: inspectTexture(triangle.texture).darkBorderRatio }));
      const footprint = Math.max(box.width / width, box.height / height) * .75;
      let darkPixels = 0, referenceDarkPixels = 0, unexpectedDarkPixels = 0; const evidence = [];
      for (let offset = 0; offset < pixels.length; offset += 4) {
        if (pixels[offset + 3] <= 24 || Math.max(pixels[offset], pixels[offset + 1], pixels[offset + 2]) > 8) continue;
        darkPixels++;
        const index = offset / 4, x = box.left + (index % width + .5) / width * box.width, y = box.top + (Math.floor(index / width) + .5) / height * box.height;
        const candidates = [];
        const explained = meshes.some(triangle => {
          const points = triangle.vertices, orientation = Math.sign((points[1].x - points[0].x) * (points[2].y - points[0].y) - (points[1].y - points[0].y) * (points[2].x - points[0].x));
          if (!orientation || points.some((point, i) => {
            const next = points[(i + 1) % 3];
            return orientation * ((next.x - point.x) * (y - point.y) - (next.y - point.y) * (x - point.x)) < -footprint * Math.hypot(next.x - point.x, next.y - point.y);
          })) return false;
          const m = triangle.uvToScreen, determinant = m.a * m.d - m.b * m.c;
          if (Math.abs(determinant) < 1e-8) return false;
          const u = (m.d * (x - m.e) - m.c * (y - m.f)) / determinant, v = (-m.b * (x - m.e) + m.a * (y - m.f)) / determinant;
          if (u < -.01 || u > 1.01 || v < -.01 || v > 1.01) return false;
          const reference = inspectTexture(triangle.texture).pixels;
          const candidate = { source: triangle.source, frame: triangle.frame, u, v, maxDarkAlpha: 0 };
          candidates.push(candidate);
          for (let py = Math.max(0, Math.floor(v * 128) - 2); py <= Math.min(127, Math.floor(v * 128) + 2); py++) {
            for (let px = Math.max(0, Math.floor(u * 128) - 2); px <= Math.min(127, Math.floor(u * 128) + 2); px++) {
              const sample = (py * 128 + px) * 4;
              if (Math.max(reference[sample], reference[sample + 1], reference[sample + 2]) <= 24) candidate.maxDarkAlpha = Math.max(candidate.maxDarkAlpha, reference[sample + 3]);
              if (reference[sample + 3] >= 16 && Math.max(reference[sample], reference[sample + 1], reference[sample + 2]) <= 24) return true;
            }
          }
          // Downsampling a fine dark feather strand can erase its alpha while
          // the actual deformed texture still paints it. Verify the same UV
          // neighbourhood at the original cached-cell resolution, with exactly
          // the same alpha/color thresholds, before calling it unexplained matte.
          const texture = triangle.texture, inspected = inspectTexture(texture);
          inspected.nativePixels ||= texture.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, texture.width, texture.height).data;
          const radiusX = Math.ceil(texture.width * 2 / 128), radiusY = Math.ceil(texture.height * 2 / 128);
          candidate.maxNativeDarkAlpha = 0;
          for (let py = Math.max(0, Math.floor(v * texture.height) - radiusY); py <= Math.min(texture.height - 1, Math.floor(v * texture.height) + radiusY); py++) {
            for (let px = Math.max(0, Math.floor(u * texture.width) - radiusX); px <= Math.min(texture.width - 1, Math.floor(u * texture.width) + radiusX); px++) {
              const sample = (py * texture.width + px) * 4, native = inspected.nativePixels;
              if (Math.max(native[sample], native[sample + 1], native[sample + 2]) > 24) continue;
              candidate.maxNativeDarkAlpha = Math.max(candidate.maxNativeDarkAlpha, native[sample + 3]);
              if (native[sample + 3] >= 16) return true;
            }
          }
          return false;
        });
        if (explained) referenceDarkPixels++; else { unexpectedDarkPixels++; evidence.push({ x, y, rgba: Array.from(pixels.slice(offset, offset + 4)), candidates }); }
      }
      return { darkPixels, referenceDarkPixels, unexpectedDarkPixels, sourceBorders, evidence };
    };
  });
  if (clocked) {
    await page.clock.install({ time: new Date('2026-09-05T12:00:00Z') });
    await page.clock.pauseAt(new Date('2026-09-05T12:01:00Z'));
  }
  await page.goto('/playable/spirit-codex.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#title-screen')).toHaveClass(/active/);
  await page.evaluate(() => { SC.resetProgression(); SC.setAutoBattle(false); });
  await page.getByRole('button', { name: /进\s*入\s*城\s*镇/ }).click();
  await page.locator('#town-screen .primary-building').click();
  await expect(page.locator('#formation-screen')).toHaveClass(/active/);
  await page.evaluate(() => SC.navigatePreparation('combos'));
  await expect(page.locator('#preparation-combos')).toBeVisible();
  return errors;
}

async function captureMotionFrame(page) {
  return page.locator('#combo-cinematic').evaluate(root => {
    const canvas = root.querySelector('.combo-cinematic-canvas');
    const light = root.querySelector('.combo-stage-radiance'), lightBox = light?.getBoundingClientRect(), lightStyle = light && getComputedStyle(light);
    const track = root.querySelector('.combo-stage-progress'), meter = track?.matches('[role="progressbar"]') ? track : track?.querySelector('[role="progressbar"]');
    // A small spatial sample catches real motion without reading millions of device pixels per frame.
    const sample = document.createElement('canvas'); sample.width = 96; sample.height = 54;
    const context = sample.getContext('2d', { willReadFrequently: true });
    context.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, sample.width, sample.height);
    const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
    let hash = 2166136261, occupancyHash = 2166136261, visiblePixels = 0, solidPixels = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3]) visiblePixels++;
      if (pixels[index + 3] >= 24) solidPixels++;
      // Binary alpha preserves spatial paths without mistaking a palette swap for a different trajectory.
      occupancyHash = Math.imul(occupancyHash ^ Number(pixels[index + 3] >= 24), 16777619);
      hash = Math.imul(hash ^ pixels[index], 16777619);
      hash = Math.imul(hash ^ pixels[index + 1], 16777619);
      hash = Math.imul(hash ^ pixels[index + 2], 16777619);
      hash = Math.imul(hash ^ pixels[index + 3], 16777619);
    }
    const darkness = window.comboRuntimeAudit.classifyDarkPixels(pixels, sample.width, sample.height, canvas.getBoundingClientRect());
    return { hash: hash >>> 0, occupancyHash: occupancyHash >>> 0, visiblePixels, darkMattePixels: darkness.unexpectedDarkPixels,
      referenceDarkPixels: darkness.referenceDarkPixels, sourceBorders: darkness.sourceBorders, solidCoverage: solidPixels / (sample.width * sample.height), width: canvas.width, height: canvas.height,
      stage: root.dataset.stage, frame: Number(root.dataset.frame), elapsed: Number(root.dataset.elapsed),
      radianceVisible: !!(lightBox?.width && lightBox.height && lightStyle.display !== 'none' && lightStyle.visibility !== 'hidden' && Number(lightStyle.opacity) > 0),
      runtimeDraws: window.comboRuntimeAudit.draws,
      progress: meter ? Number(meter.getAttribute('aria-valuenow')) / Number(meter.getAttribute('aria-valuemax')) : null };
  });
}

async function captureFormationContour(page) {
  return page.locator('#combo-cinematic').evaluate(root => {
    const canvas = root.querySelector('.combo-cinematic-canvas'), box = canvas.getBoundingClientRect();
    const anchor = root.querySelector('.combo-fusion-anchor').getBoundingClientRect();
    const radiance = root.querySelector('.combo-stage-radiance'), light = radiance?.getBoundingClientRect();
    const lightStyle = radiance && getComputedStyle(radiance);
    // Follow the real DOM fusion point, not geometry debug data. A proportional neighborhood
    // accommodates all six silhouettes and DPRs without prescribing their painted vertices.
    const diameter = Math.min(320, box.width * .84);
    const x = anchor.left + anchor.width / 2 - diameter / 2, y = anchor.top + anchor.height / 2 - diameter / 2;
    const sample = document.createElement('canvas'); sample.width = 80; sample.height = 80;
    const context = sample.getContext('2d', { willReadFrequently: true });
    context.drawImage(canvas, (x - box.left) * canvas.width / box.width, (y - box.top) * canvas.height / box.height,
      diameter * canvas.width / box.width, diameter * canvas.height / box.height, 0, 0, sample.width, sample.height);
    const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
    let hash = 2166136261, occupancyHash = 2166136261, count = 0;
    let left = sample.width, right = -1, top = sample.height, bottom = -1;
    for (let index = 0; index < pixels.length; index += 4) {
      const painted = pixels[index + 3] >= 24, offset = index / 4;
      occupancyHash = Math.imul(occupancyHash ^ Number(painted), 16777619);
      for (let channel = 0; channel < 4; channel++) hash = Math.imul(hash ^ pixels[index + channel], 16777619);
      if (!painted) continue;
      count++; const px = offset % sample.width, py = Math.floor(offset / sample.width);
      left = Math.min(left, px); right = Math.max(right, px); top = Math.min(top, py); bottom = Math.max(bottom, py);
    }
    const darkness = window.comboRuntimeAudit.classifyDarkPixels(pixels, sample.width, sample.height, { left: x, top: y, width: diameter, height: diameter });
    return { hash: hash >>> 0, occupancyHash: occupancyHash >>> 0, density: count / (sample.width * sample.height),
      darkMattePixels: darkness.unexpectedDarkPixels, referenceDarkPixels: darkness.referenceDarkPixels, sourceBorders: darkness.sourceBorders, darkEvidence: darkness.evidence,
      radiance: light ? { opacity: Number(lightStyle.opacity), pointerEvents: lightStyle.pointerEvents,
        coverage: light.width * light.height / (box.width * box.height),
        offsetX: light.left + light.width / 2 - anchor.left - anchor.width / 2,
        offsetY: light.top + light.height / 2 - anchor.top - anchor.height / 2, diameter } : null,
      widthRatio: count ? (right - left + 1) / sample.width : 0, heightRatio: count ? (bottom - top + 1) / sample.height : 0 };
  });
}

async function assertLiveStage(page) {
  const result = await page.locator('#combo-cinematic').evaluate(async root => {
    const retired = [...root.querySelectorAll('.combo-ultimate-entity,.combo-ultimate-sequence-image,.combo-impact-sprite,.combo-phase-track,.combo-phase-step,.combo-cinematic-image')].map(element => element.className);
    // Source sheets are required again by the user. Reject unrigged DOM planes, not the
    // references themselves: the corresponding single-cell Canvas meshes are checked below.
    const unriggedImages = [...root.querySelectorAll('img')].map(image => image.getAttribute('src')).filter(src => /reference-.+-v7|ultimate-.+-sequence|phoenix-combat-facing-v9|combo-impact-atlas/.test(src));
    const targets = await Promise.all([...root.querySelectorAll('.combo-target')].map(async target => {
      const picture = target.querySelector('.combo-target-art'), figure = target.querySelector('.combo-target-figure');
      await picture.decode();
      const style = getComputedStyle(picture), cardStyle = getComputedStyle(target), figureStyle = getComputedStyle(figure);
      return { uid: target.dataset.targetUid, source: picture.getAttribute('src'), loaded: picture.complete && picture.naturalWidth > 0,
        fit: style.objectFit, cardBorders: [cardStyle.borderTopWidth, cardStyle.borderRightWidth, cardStyle.borderBottomWidth, cardStyle.borderLeftWidth].map(parseFloat),
        figureBorders: [figureStyle.borderTopWidth, figureStyle.borderRightWidth, figureStyle.borderBottomWidth, figureStyle.borderLeftWidth].map(parseFloat) };
    }));
    const track = root.querySelector('.combo-stage-progress'), meter = track?.matches('[role="progressbar"]') ? track : track?.querySelector('[role="progressbar"]');
    const isReference = source => /reference-.+-v7|ultimate-.+-sequence|phoenix-combat-facing-v9/.test(source);
    const cropValid = origin => origin.sw <= origin.width / (/phoenix-combat-facing-v9/.test(origin.source) ? 1 : 3) + 1 &&
      origin.sh <= origin.height / (/phoenix-combat-facing-v9/.test(origin.source) ? 1 : 2) + 1;
    const forbiddenBitmaps = window.comboRuntimeAudit.bitmaps.filter(bitmap => {
      const reference = bitmap.origins.some(origin => isReference(origin.source));
      return /combo-impact-atlas/.test(bitmap.source) || isReference(bitmap.source) ||
        reference && (!bitmap.mesh || bitmap.triangleCoverage > .025 || bitmap.origins.some(origin => isReference(origin.source) &&
          !cropValid(origin))) ||
        bitmap.coverage > .25 && !(reference && bitmap.mesh && bitmap.triangleCoverage <= .025);
    });
    return { retired, unriggedImages, targets, renderer: root.dataset.renderer,
      rendererAvailable: typeof window.ComboArtRig?.draw === 'function',
      stageLabels: root.querySelectorAll('.combo-current-stage').length,
      progress: meter ? { min: Number(meter.getAttribute('aria-valuemin')), max: Number(meter.getAttribute('aria-valuemax')), value: Number(meter.getAttribute('aria-valuenow')), height: track.getBoundingClientRect().height } : null,
      draws: window.comboRuntimeAudit.draws, forbiddenBitmaps };
  });
  expect(result.retired).toEqual([]); expect(result.unriggedImages).toEqual([]); expect(result.forbiddenBitmaps).toEqual([]);
  expect(result.renderer).toBe('art-rig-v7'); expect(result.stageLabels).toBe(1);
  expect(result.progress).not.toBeNull(); expect(result.progress.height).toBeLessThanOrEqual(8);
  expect(result.progress.max).toBeGreaterThan(result.progress.min);
  expect(result.progress.value).toBeGreaterThanOrEqual(result.progress.min); expect(result.progress.value).toBeLessThanOrEqual(result.progress.max);
  expect(result.rendererAvailable).toBe(true); expect(result.draws).toBeGreaterThan(0);
  expect(result.targets.length).toBeGreaterThan(0);
  for (const target of result.targets) {
    expect(target.loaded, `${target.uid} real full-body target art decoded`).toBe(true);
    expect(target.fit, `${target.uid} must not be cover-cropped into a portrait card`).toBe('contain');
    expect(target.cardBorders).toEqual([0, 0, 0, 0]); expect(target.figureBorders).toEqual([0, 0, 0, 0]);
  }
}

async function captureArtMesh(page, id) {
  return page.locator('#combo-cinematic').evaluate((root, id) => {
    const recipe = SC.COMBO_RECIPES.find(recipe => recipe.id === id), rig = recipe.rig.combat || recipe.rig, source = rig.src;
    const triangles = window.comboRuntimeAudit.frameMeshes.filter(triangle => triangle.origins.some(origin => origin.source.endsWith(source)));
    const counts = new Map(), samples = new Map();
    triangles.forEach(triangle => counts.set(triangle.frame, (counts.get(triangle.frame) || 0) + 1));
    const charge = recipe.rig.combat ? window.comboRuntimeAudit.frameMeshes.filter(triangle => triangle.origins.some(origin => origin.source.endsWith(recipe.rig.src))) : [];
    return { source, columns: rig.columns, rows: rig.rows, expectedFrame: recipe.rig.combat ? 0 : 1,
      chargeOrigins: charge.flatMap(triangle => triangle.origins.filter(origin => origin.source.endsWith(recipe.rig.src))),
      triangles: triangles.map(triangle => {
      // The renderer expands triangle clips by a fraction of a pixel to prevent seams.
      // Recover its regular UV-cell centroid from the actual draw count, then project that
      // same texture coordinate with the measured Canvas affine transform in every frame.
      // Clip overlap must not masquerade as internal movement or break correspondence.
      const grid = Math.round(Math.sqrt(counts.get(triangle.frame) / 2));
      const u = Math.round(triangle.u * grid * 3) / (grid * 3), v = Math.round(triangle.v * grid * 3) / (grid * 3), matrix = triangle.uvToScreen;
      if (!samples.has(triangle.texture)) {
        const sample = document.createElement('canvas'); sample.width = 64; sample.height = 64;
        const context = sample.getContext('2d', { willReadFrequently: true });
        context.drawImage(triangle.texture, 0, 0, 64, 64); samples.set(triangle.texture, context.getImageData(0, 0, 64, 64).data);
      }
      const pixels = samples.get(triangle.texture); let ink = 0;
      for (let py = Math.max(0, Math.floor(v * 64) - 1); py <= Math.min(63, Math.floor(v * 64) + 1); py++) {
        for (let px = Math.max(0, Math.floor(u * 64) - 1); px <= Math.min(63, Math.floor(u * 64) + 1); px++) {
          const offset = (py * 64 + px) * 4;
          if (pixels[offset + 3] >= 40 && Math.max(pixels[offset], pixels[offset + 1], pixels[offset + 2]) > 16) ink++;
        }
      }
      const { texture, ...measured } = triangle;
      return { ...measured, ink, key: `${triangle.frame}:${Math.round(u * grid * 3)}:${Math.round(v * grid * 3)}`,
        x: matrix.a * u + matrix.c * v + matrix.e, y: matrix.b * u + matrix.d * v + matrix.f };
    }), calls: window.comboRuntimeAudit.meshDraws };
  }, id);
}

function assertArtMesh(mesh, stage = 1) {
  const requestedStages = Array.isArray(stage) ? stage : [stage], stages = mesh.expectedFrame === 0 ? [0] : requestedStages;
  if (!requestedStages.includes(0)) expect(mesh.chargeOrigins, 'the original charge illustration ends before the formed combat body').toEqual([]);
  for (const origin of mesh.chargeOrigins) {
    expect([origin.sx, origin.sy]).toEqual([0, 0]);
    expect(origin.sw).toBeLessThanOrEqual(origin.width / 3 + 1); expect(origin.sh).toBeLessThanOrEqual(origin.height / 2 + 1);
  }
  expect(mesh.triangles.length, 'the art is actually drawn through a dense triangular mesh').toBeGreaterThanOrEqual(100);
  const problems = new Set();
  for (const triangle of mesh.triangles) {
    if (triangle.source !== mesh.source) problems.add('cache provenance does not match actual source image');
    if (!stages.includes(Number(triangle.frame))) problems.add('cache is not a permitted current/adjacent storyboard frame');
    if (triangle.coverage >= .025) problems.add('a clipped triangle occupies a giant image plane');
    for (const point of triangle.vertices) {
      if (![point.u, point.v, point.x, point.y].every(Number.isFinite)) problems.add('triangle has non-finite UV or destination coordinates');
      if (point.u < -.01 || point.u > 1.01 || point.v < -.01 || point.v > 1.01) problems.add('texture coordinates leave their cropped single cell');
    }
    for (const origin of triangle.origins.filter(origin => origin.source.endsWith(mesh.source))) {
      if (origin.sw > origin.width / mesh.columns + 1 || origin.sh > origin.height / mesh.rows + 1) problems.add('texture crops more than one configured art cell');
      const cell = Math.floor(origin.sx / (origin.width / mesh.columns)) + mesh.columns * Math.floor(origin.sy / (origin.height / mesh.rows));
      if (cell !== Number(triangle.frame) || !stages.includes(cell)) problems.add('actual drawImage source crop is not the declared current/adjacent storyboard frame');
    }
  }
  expect(mesh.triangles.filter(triangle => triangle.ink > 0).length, 'many actual textured regions participate, not just transparent grid cells').toBeGreaterThanOrEqual(12);
  expect(new Set(mesh.triangles.map(triangle => triangle.frame)).size, 'at most two individual storyboard cells can crossfade').toBeLessThanOrEqual(2);
  expect([...problems], 'real triangle clips and texture source coordinates are valid').toEqual([]);
}

function relativeMeshMotion(first, second) {
  const latter = new Map(second.triangles.filter(triangle => triangle.ink > 0).map(triangle => [triangle.key, triangle]));
  const pairs = first.triangles.filter(triangle => triangle.ink > 0 && latter.has(triangle.key)).map(triangle => [triangle, latter.get(triangle.key)]);
  expect(pairs.length, 'matching visible painted regions persist across adjacent frames').toBeGreaterThanOrEqual(12);
  const squared = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const a = pairs[0], b = pairs.reduce((best, pair) => squared(pair[0], a[0]) > squared(best[0], a[0]) ? pair : best, pairs[1]);
  const c = pairs.reduce((best, pair) => Math.abs(cross(a[0], b[0], pair[0])) > Math.abs(cross(a[0], b[0], best[0])) ? pair : best, pairs[1]);
  const determinant = cross(a[0], b[0], c[0]); expect(Math.abs(determinant)).toBeGreaterThan(1);
  // Fit the best possible whole-plane motion through three widely separated actual draw
  // points. A mere translate/rotate/scale/shear of a subdivided static sheet leaves zero
  // residual; different wings, tails, coils or petals moving locally cannot fit that plane.
  const residuals = pairs.map(([before, after]) => {
    const u = cross(a[0], before, c[0]) / determinant, v = cross(a[0], b[0], before) / determinant;
    const predicted = { x: a[1].x + u * (b[1].x - a[1].x) + v * (c[1].x - a[1].x),
      y: a[1].y + u * (b[1].y - a[1].y) + v * (c[1].y - a[1].y) };
    return Math.sqrt(squared(predicted, after));
  });
  const extent = Math.sqrt(Math.max(...pairs.map(pair => squared(a[0], pair[0]))));
  return { maximum: Math.max(...residuals) / extent, movingFraction: residuals.filter(value => value / extent > .002).length / residuals.length };
}

async function prepareMotionBattle(page, { observeResume = false } = {}) {
  return page.evaluate(({ observeResume }) => {
    window.LiveCombo?.clear(); window.BattleMotion?.clear();
    resetGame(); SC.resetProgression(); SC.setAutoBattle(false); SC.setTeam([0, 4, 1, 2]); SC.startBattle();
    const state = SC.state; state.battleToken++; SC.setRandomSource(() => .5);
    const actor = state.allies.find(unit => unit.characterId === 'H1'), partner = state.allies.find(unit => unit.characterId === 'A1');
    const next = state.allies.find(unit => unit !== actor && unit !== partner);
    state.allies.forEach(unit => { unit._acted = false; unit.debuffs = []; unit.energy = 100; });
    actor.energy = 60; partner.energy = 40;
    // A real next manual hero keeps the continuation observable without running extra enemy or DOT actions.
    state.turnOrder = [actor, next]; state.curIdx = 0; state.phase = 'player';
    state.enemies.forEach(unit => { unit.curHp = unit.maxHp = 100000; unit.res = 0; unit.debuffs = []; });
    SC.applyStatus(state.enemies[0], 'burn', actor, 1, 3); renderAll();
    if (observeResume) {
      window.epicResumeCalls = 0;
      window.epicOriginalAfterPlayer = window.epicOriginalAfterPlayer || afterPlayer;
      afterPlayer = (...args) => { window.epicResumeCalls++; return window.epicOriginalAfterPlayer(...args); };
    }
    return { actorUid: actor.uid, nextUid: next.uid, token: state.battleToken };
  }, { observeResume });
}

async function castAndCaptureCompletion(page) {
  return page.evaluate(() => {
    const original = window.LiveCombo;
    const descriptors = Object.getOwnPropertyDescriptors(original);
    descriptors.play = { value: (recipe, participants, options) => {
      window.epicCapturedCompletion = options.onComplete;
      window.epicCompletionEvents = [];
      return original.play(recipe, participants, { ...options, onComplete: event => {
        window.epicCompletionEvents.push(event); options.onComplete(event);
      } });
    }, configurable: true };
    window.LiveCombo = Object.create(null, descriptors);
    try { return SC.executeCombo('phoenix'); }
    finally { window.LiveCombo = original; }
  });
}

async function captureLiveMotionFrame(page) {
  return page.evaluate(() => {
    const session = window.LiveCombo.current;
    if (!session) throw new Error('Expected an active live battle effect');
    const canvas = session.canvas, pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let hash = 2166136261, visiblePixels = 0;
    for (let i = 0; i < pixels.length; i += 16) {
      if (pixels[i + 3] >= 24) visiblePixels++;
      for (let c = 0; c < 4; c++) hash = Math.imul(hash ^ pixels[i + c], 16777619) >>> 0;
    }
    const battle = document.getElementById('battle-canvas'), box = battle.getBoundingClientRect();
    return { hash, visiblePixels, motion: session.motion, elapsed: session.elapsed,
      actualBattle: battle.dataset.liveCombo === session.recipe.id, width: box.width, height: box.height };
  });
}

async function beginPreviewAudit(page) {
  return page.evaluate(() => {
    window.epicPreviewAudit = { gameCalls: 0, mathCalls: 0, originalMath: Math.random };
    Math.random = () => { window.epicPreviewAudit.mathCalls++; return .413; };
    SC.setRandomSource(() => { window.epicPreviewAudit.gameCalls++; return .617; });
    return JSON.stringify({ profile: SC.progression, battle: SC.snapshot(), uid: UID, storage: Object.entries(localStorage).sort() });
  });
}

async function endPreviewAudit(page, before) {
  const result = await page.evaluate(() => {
    const audit = window.epicPreviewAudit;
    const snapshot = JSON.stringify({ profile: SC.progression, battle: SC.snapshot(), uid: UID, storage: Object.entries(localStorage).sort() });
    Math.random = audit.originalMath; SC.resetRandomSource();
    return { snapshot, gameCalls: audit.gameCalls, mathCalls: audit.mathCalls };
  });
  expect(result).toEqual({ snapshot: before, gameCalls: 0, mathCalls: 0 });
}

async function assertCameraSubject(page, stage) {
  const selectors = stage === 'charge' ? '.combo-caster-figure' : stage === 'manifest' ? '.combo-fusion-anchor' : '.combo-target-hp';
  const visible = await page.locator('#combo-cinematic').evaluate((root, selectors) => {
    const arena = root.querySelector('.combo-combat-arena').getBoundingClientRect();
    return [...root.querySelectorAll(selectors)].map(node => {
      const box = node.getBoundingClientRect(), x = box.left + box.width / 2, y = box.top + box.height / 2;
      return box.width > 0 && box.height > 0 && x >= arena.left && x <= arena.right && y >= arena.top && y <= arena.bottom && y >= 0 && y <= innerHeight;
    });
  }, selectors);
  expect(visible.length).toBeGreaterThan(0); expect(visible.every(Boolean)).toBe(true);
}

async function assertReadablePreview(page) {
  const issues = await page.locator('#combo-cinematic').evaluate(root => {
    const problems = [], rect = node => node.getBoundingClientRect();
    const visible = node => {
      const box = rect(node), style = getComputedStyle(node);
      return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && Number(style.opacity) > 0;
    };
    const overlaps = (first, second) => {
      const a = rect(first), b = rect(second);
      return Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2;
    };
    for (const node of root.querySelectorAll('*')) {
      if (!visible(node)) continue;
      const ownText = [...node.childNodes].filter(child => child.nodeType === Node.TEXT_NODE && /[\u3400-\u9fff\d]/.test(child.textContent));
      if (!ownText.length && node.tagName !== 'BUTTON') continue;
      const style = getComputedStyle(node), label = `${node.className}: ${node.textContent.trim().slice(0, 32)}`;
      if (parseFloat(style.fontSize) < 14) problems.push(`small text ${label} (${style.fontSize})`);
      for (const text of ownText) {
        const range = document.createRange(); range.selectNodeContents(text);
        const box = rect(node);
        for (const line of range.getClientRects()) {
          if (line.left < box.left - 2 || line.right > box.right + 2 || line.top < box.top - 2 || line.bottom > box.bottom + 2) problems.push(`clipped text ${label}`);
        }
      }
    }
    const header = root.querySelector('.combo-impact-header'), arena = root.querySelector('.combo-combat-arena'), footer = root.querySelector('.combo-impact-footer');
    for (const [a, b] of [[header, arena], [arena, footer], [root.querySelector('.combo-caster-team'), root.querySelector('.combo-target-team')]]) {
      if (overlaps(a, b)) problems.push(`overlap ${a.className} / ${b.className}`);
    }
    for (const target of root.querySelectorAll('.combo-target')) {
      if (overlaps(target.querySelector('.combo-target-figure-host'), target.querySelector('.combo-target-hp'))) problems.push(`figure covers health ${target.dataset.targetUid}`);
    }
    for (const node of root.querySelectorAll('.combo-caster,.combo-target')) {
      const box = rect(node), area = rect(arena);
      const contentTop = box.top - area.top + arena.scrollTop, contentBottom = box.bottom - area.top + arena.scrollTop;
      if (box.left < area.left - 2 || box.right > area.right + 2 || contentTop < -2 || contentBottom > arena.scrollHeight + 2) problems.push(`arena clips ${node.className}`);
      if (box.bottom > area.bottom + 2) {
        if (!['auto', 'scroll'].includes(getComputedStyle(arena).overflowY)) problems.push(`arena hides content without scrolling ${node.className}`);
        const originalScroll = arena.scrollTop;
        arena.scrollTop += box.bottom - area.bottom + 2;
        if (rect(node).bottom > rect(arena).bottom + 2) problems.push(`unreachable arena content ${node.className}`);
        arena.scrollTop = originalScroll;
      }
    }
    if (root.scrollWidth > root.clientWidth + 1) problems.push('horizontal overflow');
    const canvas = root.querySelector('.combo-cinematic-canvas'), canvasBox = rect(canvas);
    if (canvas.width && canvas.height && canvasBox.width && canvasBox.height) {
      const context = canvas.getContext('2d', { willReadFrequently: true });
      for (const label of root.querySelectorAll('.combo-target-hp,.combo-target-shield,.combo-target-name,.combo-target-tag,.combo-target-feedback,.combo-target-status,.combo-participant-name')) {
        if (!visible(label)) continue;
        const box = rect(label), scaleX = canvas.width / canvasBox.width, scaleY = canvas.height / canvasBox.height;
        const left = Math.max(0, Math.ceil((box.left + 1 - canvasBox.left) * scaleX));
        const top = Math.max(0, Math.ceil((box.top + 1 - canvasBox.top) * scaleY));
        const right = Math.min(canvas.width, Math.floor((box.right - 1 - canvasBox.left) * scaleX));
        const bottom = Math.min(canvas.height, Math.floor((box.bottom - 1 - canvasBox.top) * scaleY));
        if (right <= left || bottom <= top) continue;
        const pixels = context.getImageData(left, top, right - left, bottom - top).data;
        if (pixels.some((value, index) => index % 4 === 3 && value > 24)) problems.push(`live effect paints over HUD ${label.className}`);
      }
    }
    return [...new Set(problems)];
  });
  expect(issues).toEqual([]);
}

test.describe('Combination motion and free previews', () => {
  test('all six formation previews show both characters without charging, unlocking or advancing either random source', async ({ page }) => {
    const errors = await loadMotionPreview(page, { clocked: true });
    const recipes = await page.evaluate(() => {
      Object.keys(SC.progression.inventory).forEach(id => { SC.progression.inventory[id] = 0; });
      SC.saveProgression(); SC.renderComboFormation();
      window.motionGameRandomCalls = 0; window.motionMathRandomCalls = 0;
      window.motionOriginalRandom = Math.random;
      Math.random = () => { window.motionMathRandomCalls++; return .413; };
      SC.setRandomSource(() => { window.motionGameRandomCalls++; return .617; });
      window.motionBefore = JSON.stringify({ profile: SC.progression, battle: SC.snapshot(), uid: UID, storage: Object.entries(localStorage).sort() });
      return SC.COMBO_RECIPES.map(recipe => ({ id: recipe.id, name: recipe.name, motion: recipe.motion,
        casting: recipe.casting, memberIds: recipe.memberIds }));
    });

    for (const recipe of recipes) {
      await page.locator(`[data-preview-combo="${recipe.id}"]`).click();
      const cinematic = page.locator('#combo-cinematic');
      await expect(cinematic).toHaveAttribute('data-preview', 'true');
      await expect(cinematic).toHaveAttribute('data-motion', recipe.motion);
      await expect(cinematic).toContainText('不消耗');
      await expect(cinematic.locator('.combo-cinematic-title')).toHaveText(recipe.name);
      const portraits = await cinematic.locator('.combo-caster .combo-participant-art').evaluateAll(images => images.map(image => ({ source: image.getAttribute('src'), id: image.closest('.combo-caster').dataset.characterId })));
      expect(portraits.map(portrait => portrait.source)).toEqual([recipe.casting.src, recipe.casting.src]);
      expect(portraits.map(portrait => portrait.id).sort()).toEqual([...recipe.memberIds].sort());
      await assertLiveStage(page);
      await page.evaluate(() => clearComboCinematic());
    }

    const result = await page.evaluate(() => {
      const unchanged = window.motionBefore === JSON.stringify({ profile: SC.progression, battle: SC.snapshot(), uid: UID, storage: Object.entries(localStorage).sort() });
      Math.random = window.motionOriginalRandom; SC.resetRandomSource();
      return { unchanged, gameRandomCalls: window.motionGameRandomCalls, mathRandomCalls: window.motionMathRandomCalls };
    });
    expect(result).toEqual({ unchanged: true, gameRandomCalls: 0, mathRandomCalls: 0 });
    expect(errors).toEqual([]);
  });

  test('all six reference-art stages animate distinct spatial paths without undivided image planes and remain active after seven seconds', async ({ page }) => {
    test.setTimeout(60_000);
    const errors = await loadMotionPreview(page, { clocked: true });
    const ids = await page.evaluate(() => SC.COMBO_RECIPES.map(recipe => recipe.id));
    const paths = [];
    for (const id of ids) {
      expect(await page.evaluate(id => SC.previewCombo(id), id)).toBe(true);
      await expect(page.locator('#combo-cinematic')).toHaveAttribute('data-stage', 'charge');
      const frames = [];
      let elapsed = 0;
      for (const [time, stage] of [[1000, 'charge'], [2200, 'manifest'], [3900, 'release'], [5300, 'impact'], [7000, 'aftershock'], [8000, 'settle']]) {
        await page.clock.fastForward(time - elapsed); elapsed = time;
        const frame = await captureMotionFrame(page);
        expect(frame.stage).toBe(stage); expect(frame.width).toBeGreaterThan(0); expect(frame.height).toBeGreaterThan(0);
        expect(frame.darkMattePixels, `${id} ${stage}: dark pixels must be explained by original art, not black matte squares`).toBe(0);
        expect(frame.sourceBorders.filter(source => source.darkBorderRatio >= .15), `${id} ${stage}: cropped art has no opaque dark perimeter`).toEqual([]);
        await assertLiveStage(page);
        frames.push(frame);
        if (stage !== 'release') await assertCameraSubject(page, stage);
        if (stage === 'aftershock') {
          expect(frame.elapsed).toBeGreaterThanOrEqual(6900);
          expect(frame.visiblePixels).toBeGreaterThan(75);
          await expect(page.locator('#combo-cinematic')).not.toHaveAttribute('data-finished', 'true');
          await page.clock.fastForward(250); elapsed += 250;
          const continuing = await captureMotionFrame(page);
          expect(continuing.stage).toBe('aftershock'); expect(continuing.visiblePixels).toBeGreaterThan(75);
          expect(continuing.hash).not.toBe(frame.hash);
        }
      }
      expect(frames.every((frame, index) => index === 0 || frame.frame > frames[index - 1].frame && frame.elapsed > frames[index - 1].elapsed)).toBe(true);
      expect(frames.every((frame, index) => frame.runtimeDraws > 0 && (index === 0 || frame.runtimeDraws > frames[index - 1].runtimeDraws))).toBe(true);
      for (const frame of frames) expect(Math.abs(frame.progress - frame.elapsed / 8400), 'the single compact progress bar follows actual elapsed time').toBeLessThan(.02);
      expect(new Set(frames.map(frame => frame.hash)).size).toBe(6);
      expect(frames[2].visiblePixels).toBeGreaterThan(8); expect(frames[3].visiblePixels).toBeGreaterThan(8);
      paths.push(`${frames[2].occupancyHash}:${frames[4].occupancyHash}`);
      await page.clock.fastForward(500);
      await expect(page.locator('#combo-cinematic')).toHaveAttribute('data-finished', 'true');
      const finalFrame = await page.locator('#combo-cinematic').getAttribute('data-frame');
      await page.clock.fastForward(1000);
      await expect(page.locator('#combo-cinematic')).toHaveAttribute('data-frame', finalFrame);
      await page.locator('#combo-preview-close').click();
      await expect(page.locator('#combo-cinematic')).toHaveCount(0);
    }
    expect(new Set(paths).size).toBe(6);
    expect(errors).toEqual([]);
  });

  test('six reference-art formations deform independent local regions through real texture triangles without flooding the stage or obscuring HUD', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = await loadMotionPreview(page, { clocked: true });
    const before = await beginPreviewAudit(page), silhouettes = [];
    const ids = await page.evaluate(() => SC.COMBO_RECIPES.map(recipe => recipe.id));
    for (const id of ids) {
      expect(await page.evaluate(id => SC.previewCombo(id), id)).toBe(true);
      const frames = [], meshes = []; let elapsed = 0;
      for (const time of [1600, 2200, 2800, 3150]) {
        await page.clock.fastForward(time - elapsed); elapsed = time;
        const stage = await captureMotionFrame(page), contour = await captureFormationContour(page), mesh = await captureArtMesh(page, id);
        assertArtMesh(mesh, time === 1600 ? [0, 1] : 1); meshes.push(mesh);
        expect(stage.stage).toBe('manifest');
        expect(stage.darkMattePixels, `${id} ${time}ms stage has no unexplained black brush background`).toBe(0);
        expect(contour.darkMattePixels, `${id} ${time}ms local formation has no unexplained black brush background ${JSON.stringify(contour.darkEvidence)}`).toBe(0);
        expect(stage.sourceBorders.filter(source => source.darkBorderRatio >= .15), `${id} ${time}ms source borders are transparent, not a black square`).toEqual([]);
        if (id === ids[0] && time === 1600) {
          const unexpected = await page.locator('.combo-cinematic-canvas').evaluate(canvas => {
            const box = canvas.getBoundingClientRect();
            return window.comboRuntimeAudit.classifyDarkPixels(new Uint8ClampedArray([0, 0, 0, 255]), 1, 1,
              { left: box.left - 100, top: box.top - 100, width: 1, height: 1 }).unexpectedDarkPixels;
          });
          expect(unexpected, 'a black pixel with no reference-art provenance is still rejected').toBe(1);
        }
        // These broad normalized bounds reject an empty pinprick or an opaque full-screen plane,
        // while allowing feathers, coils, shields, blossoms, crescent blades and portals to differ.
        expect(stage.solidCoverage, `${id} ${time}ms leaves the majority of the stage readable`).toBeLessThan(.6);
        expect(contour.density, `${id} ${time}ms genuinely paints around the shared source`).toBeGreaterThan(.005);
        expect(contour.density, `${id} ${time}ms is a silhouette, not a solid square`).toBeLessThan(.8);
        expect(stage.radianceVisible, `${id} ${time}ms lights the local stage`).toBe(true);
        expect(contour.radiance.pointerEvents).toBe('none');
        expect(contour.radiance.coverage, `${id} ${time}ms environmental light stays local`).toBeLessThan(.25);
        expect(Math.abs(contour.radiance.offsetX), `${id} ${time}ms light follows the actual fusion point`).toBeLessThan(2);
        expect(contour.radiance.offsetY).toBeGreaterThan(0);
        expect(contour.radiance.offsetY).toBeLessThan(contour.radiance.diameter / 2);
        if (time >= 2800) {
          expect(contour.density, `${id} ${time}ms mature formation has discernible material area`).toBeGreaterThan(.035);
          expect(contour.widthRatio, `${id} ${time}ms mature contour has width`).toBeGreaterThan(.32);
          expect(contour.heightRatio, `${id} ${time}ms mature contour has height`).toBeGreaterThan(.22);
        }
        await assertLiveStage(page); await assertReadablePreview(page); await assertCameraSubject(page, 'manifest');
        frames.push(contour);
      }
      expect(new Set(frames.map(frame => frame.hash)).size, `${id} all four formation moments genuinely animate`).toBe(4);
      expect(new Set(frames.map(frame => frame.occupancyHash)).size, `${id} material shape changes, not merely its tint`).toBeGreaterThanOrEqual(3);
      // Verify that the detector rejects even a subdivided whole-image rotate/scale/shear.
      // Its synthetic control is derived from this real mesh, not used in place of the render.
      const wholePlane = { triangles: meshes[1].triangles.map(triangle => ({ ...triangle,
        x: triangle.x * 1.12 + triangle.y * .17 + 23, y: triangle.y * .91 - triangle.x * .09 - 11 })) };
      expect(relativeMeshMotion(meshes[1], wholePlane).maximum).toBeLessThan(1e-8);
      for (const [from, to] of [[1, 2], [2, 3]]) {
        const motion = relativeMeshMotion(meshes[from], meshes[to]);
        expect(motion.maximum, `${id} ${[1600, 2200, 2800, 3150][from]}→${[1600, 2200, 2800, 3150][to]}ms wings/tail/coils/petals do not share one whole-image affine motion`).toBeGreaterThan(.005);
        expect(motion.movingFraction, `${id} ${[1600, 2200, 2800, 3150][from]}→${[1600, 2200, 2800, 3150][to]}ms a meaningful portion of the art moves locally after formation`).toBeGreaterThan(.15);
      }
      silhouettes.push(frames.map(frame => frame.occupancyHash).join(':'));
      await page.locator('#combo-preview-close').click();
    }
    expect(new Set(silhouettes).size, 'all six formations keep distinct spatial signatures').toBe(6);
    await endPreviewAudit(page, before); expect(errors).toEqual([]);
  });

  test('repeated previews stop old canvases, keep replay and close clickable, and release the background after closing', async ({ page }) => {
    const errors = await loadMotionPreview(page, { clocked: true });
    const before = await beginPreviewAudit(page);
    const latest = await page.evaluate(async () => {
      const requests = ['phoenix', 'eclipse', 'legion'].map(id => SC.previewCombo(id));
      await Promise.all(requests);
      window.replacedCinematic = document.querySelector('#combo-cinematic');
      return { count: document.querySelectorAll('#combo-cinematic').length, motion: window.replacedCinematic?.dataset.motion };
    });
    expect(latest).toEqual({ count: 1, motion: 'legion' });
    await page.clock.fastForward(500);
    expect(await page.evaluate(() => SC.previewCombo('spring'))).toBe(true);
    await expect(page.locator('#combo-cinematic')).toHaveAttribute('data-motion', 'spring');
    expect(await page.evaluate(() => window.replacedCinematic.isConnected)).toBe(false);
    await expect(page.locator('#combo-cinematic')).toHaveCount(1);
    const oldFrame = await page.evaluate(() => Number(window.replacedCinematic.dataset.frame));
    await page.clock.fastForward(100);
    expect(await page.evaluate(() => Number(window.replacedCinematic.dataset.frame))).toBe(oldFrame);

    const equip = page.locator('[data-equip-combo="spring"]');
    expect(await equip.evaluate(button => !!button.closest('[inert]'))).toBe(true);
    await page.locator('#combo-preview-skip').click();
    await expect(page.locator('#combo-cinematic')).toHaveAttribute('data-finished', 'true');
    const skippedFrame = await page.locator('#combo-cinematic').getAttribute('data-frame');
    await page.clock.fastForward(9000);
    await expect(page.locator('#combo-cinematic')).toHaveAttribute('data-frame', skippedFrame);
    expect(await page.evaluate(() => JSON.stringify({ profile: SC.progression, battle: SC.snapshot(), uid: UID, storage: Object.entries(localStorage).sort() }))).toBe(before);
    for (const selector of ['#combo-preview-close', '#combo-preview-replay']) {
      const button = page.locator(selector); await button.scrollIntoViewIfNeeded();
      expect(await button.evaluate(node => {
        const rect = node.getBoundingClientRect(), hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return node === hit || node.contains(hit);
      })).toBe(true);
    }
    await page.locator('#combo-preview-replay').click();
    await expect(page.locator('#combo-cinematic')).toHaveAttribute('data-stage', 'charge');
    await expect(page.locator('#combo-cinematic')).not.toHaveAttribute('data-finished', 'true');
    if (page.viewportSize().width <= 700) {
      await expect(page.locator('#combo-cinematic')).toHaveAttribute('data-camera-manual', 'false');
      await assertCameraSubject(page, 'charge');
      await page.clock.fastForward(5300);
      await assertCameraSubject(page, 'impact');
      const arena = page.locator('#combo-cinematic .combo-combat-arena'), followed = await arena.evaluate(node => node.scrollTop);
      expect(followed).toBeGreaterThan(0);
      const box = await arena.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(0, -10000);
      await page.clock.fastForward(32);
      await expect(page.locator('#combo-cinematic')).toHaveAttribute('data-camera', 'manual');
      await expect(page.locator('#combo-cinematic')).toHaveAttribute('data-camera-manual', 'true');
      await expect.poll(() => arena.evaluate(node => node.scrollTop)).toBeLessThan(followed);
      const manual = await arena.evaluate(node => node.scrollTop);
      await page.clock.fastForward(1700);
      expect(await arena.evaluate(node => node.scrollTop)).toBe(manual);
      await page.locator('#combo-preview-replay').click();
      await expect(page.locator('#combo-cinematic')).toHaveAttribute('data-camera-manual', 'false');
      await expect(page.locator('#combo-cinematic')).toHaveAttribute('data-stage', 'charge');
      await assertCameraSubject(page, 'charge');
    }
    const stoppedFrame = await page.evaluate(() => { window.clearedCinematic = document.querySelector('#combo-cinematic'); return Number(window.clearedCinematic.dataset.frame); });
    await page.locator('#combo-preview-close').click();
    expect(await equip.evaluate(button => !!button.closest('[inert]'))).toBe(false);
    await endPreviewAudit(page, before);
    await equip.click();
    const active = await page.evaluate(() => SC.activeFormationIndices().map(index => SC.CHARACTERS[index].id));
    expect(active).toContain('W1'); expect(active).toContain('L1');
    await page.clock.fastForward(10000);
    await expect(page.locator('#combo-cinematic')).toHaveCount(0);
    expect(await page.evaluate(() => Number(window.clearedCinematic?.dataset.frame))).toBe(stoppedFrame);
    expect(errors).toEqual([]);
  });

  test('system reduced motion stays static while an explicit full-motion choice plays the complete epic without charging', async ({ page }) => {
    const errors = await loadMotionPreview(page, { clocked: true });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await page.evaluate(() => SC.getComboCinematicMotion())).toBe('system');
    const before = await beginPreviewAudit(page);
    expect(await page.evaluate(() => SC.previewCombo('leviathan'))).toBe(true);
    const cinematic = page.locator('#combo-cinematic');
    await expect(cinematic).toHaveAttribute('data-stage', 'settle');
    const first = await captureMotionFrame(page);
    expect(first.progress).toBe(1); expect(first.visiblePixels).toBe(0); expect(first.radianceVisible).toBe(false);
    await page.clock.fastForward(800);
    const later = await captureMotionFrame(page);
    expect(later.hash).toBe(first.hash); expect(later.frame).toBe(first.frame);
    expect(later.progress).toBe(1); expect(later.visiblePixels).toBe(0); expect(later.radianceVisible).toBe(false);
    const animationNames = await cinematic.evaluate(root => [...root.querySelectorAll('*')].map(node => getComputedStyle(node).animationName));
    expect(animationNames.every(name => name === 'none')).toBe(true);
    await page.clock.fastForward(1100);
    await expect(cinematic).toHaveAttribute('data-finished', 'true');
    await expect(cinematic).toHaveCount(1);
    await page.locator('#combo-motion-full').click();
    expect(await page.evaluate(() => SC.getComboCinematicMotion())).toBe('full');
    await expect(cinematic).toHaveAttribute('data-stage', 'charge');
    await page.clock.fastForward(2200);
    const manifest = await captureMotionFrame(page);
    expect(manifest.stage).toBe('manifest'); expect(manifest.visiblePixels).toBeGreaterThan(8);
    await page.clock.fastForward(4800);
    const aftershock = await captureMotionFrame(page);
    expect(aftershock.stage).toBe('aftershock'); expect(aftershock.hash).not.toBe(manifest.hash);
    await expect(cinematic).not.toHaveAttribute('data-finished', 'true');
    await page.clock.fastForward(1500);
    await expect(cinematic).toHaveAttribute('data-finished', 'true');
    await page.locator('#combo-motion-reduced').click();
    expect(await page.evaluate(() => SC.getComboCinematicMotion())).toBe('reduced');
    await expect(cinematic).toHaveAttribute('data-stage', 'settle');
    const reducedAgain = await captureMotionFrame(page);
    expect(reducedAgain.progress).toBe(1); expect(reducedAgain.visiblePixels).toBe(0); expect(reducedAgain.radianceVisible).toBe(false);
    await page.keyboard.press('Escape'); await expect(cinematic).toHaveCount(0);
    expect(await page.evaluate(() => SC.progression.inventory)).toEqual({ ember: 2, tide: 2, soul: 2 });
    await endPreviewAudit(page, before);
    await page.evaluate(() => SC.setComboCinematicMotion('system'));
    expect(errors).toEqual([]);
  });

  test('complete previews visibly hit targets, change the correct health or shield bars and leave real resources untouched', async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    const errors = await loadMotionPreview(page, { clocked: true });
    const before = await page.evaluate(() => {
      window.completePreviewRandomCalls = 0; SC.setRandomSource(() => { window.completePreviewRandomCalls++; return .5; });
      window.completePreviewMathCalls = 0; window.completePreviewOriginalMath = Math.random;
      Math.random = () => { window.completePreviewMathCalls++; return .413; };
      return JSON.stringify({ profile: SC.progression, battle: SC.snapshot(), uid: UID, storage: Object.entries(localStorage).sort() });
    });
    const examples = [
      { id: 'phoenix', targets: [['demo-enemy', 1200, 460, 1200, 0]], feedback: '灼烧' },
      { id: 'leviathan', targets: [['demo-enemy', 1200, 600, 1200, 0]], feedback: '麻痹' },
      { id: 'bastion', targets: [['demo-enemy', 1200, 850, 1200, 0], ['demo-ally', 350, 350, 1000, 300]], feedback: '护盾' },
      { id: 'spring', targets: [['demo-ally', 350, 800, 1000, 0], ['demo-revived', 0, 400, 1000, 0]], feedback: '复苏' },
      { id: 'eclipse', targets: [['demo-enemy', 1200, 120, 1200, 0]], feedback: '破防' },
      { id: 'legion', targets: [['demo-enemy', 1200, 650, 1200, 0], ['demo-summon', 0, 640, 640, 0]], feedback: '召唤' },
    ];
    const readTargets = () => page.locator('#combo-cinematic .combo-target').evaluateAll(targets => targets.map(target => {
      const hp = target.querySelector('.combo-target-hp'), fill = hp.querySelector('.combo-target-hp-fill'), shield = target.querySelector('.combo-target-shield');
      return { uid: target.dataset.targetUid, hp: Number(hp.getAttribute('aria-valuenow')), max: Number(hp.getAttribute('aria-valuemax')),
        ratio: fill.getBoundingClientRect().width / Math.max(1, hp.clientWidth), shield: Number(shield?.getAttribute('aria-valuenow') || 0),
        shieldWidth: target.querySelector('.combo-target-shield-fill')?.getBoundingClientRect().width || 0 };
    }));
    for (const [index, example] of examples.entries()) {
      expect(await page.evaluate(id => SC.previewCombo(id), example.id)).toBe(true);
      const initial = await readTargets();
      for (const [uid, hpBefore, , max] of example.targets) {
        const target = initial.find(target => target.uid === uid); expect(target).toBeTruthy();
        expect(target).toMatchObject({ hp: hpBefore, max }); expect(target.ratio).toBeCloseTo(hpBefore / max, 1);
      }
      await page.clock.fastForward(5300);
      await expect(page.locator('#combo-cinematic')).toHaveAttribute('data-stage', 'impact');
      await assertReadablePreview(page);
      await assertLiveStage(page);
      expect((await captureMotionFrame(page)).visiblePixels).toBeGreaterThan(8);
      await page.clock.fastForward(3200);
      const settled = await readTargets();
      for (const [uid, , hpAfter, max, shieldAfter] of example.targets) {
        const target = settled.find(target => target.uid === uid);
        expect(target).toMatchObject({ hp: hpAfter, max, shield: shieldAfter }); expect(target.ratio).toBeCloseTo(hpAfter / max, 1);
        if (shieldAfter) expect(target.shieldWidth).toBeGreaterThan(0);
      }
      await expect(page.locator('#combo-cinematic-summary')).toContainText('演示');
      await expect(page.locator('#combo-cinematic')).toContainText(example.feedback);
      await expect(page.locator('#combo-cinematic')).toHaveAttribute('data-finished', 'true');
      await assertReadablePreview(page);
      await page.locator('#combo-preview-close').click();
    }
    const result = await page.evaluate(() => {
      const snapshot = JSON.stringify({ profile: SC.progression, battle: SC.snapshot(), uid: UID, storage: Object.entries(localStorage).sort() });
      const calls = window.completePreviewRandomCalls, mathCalls = window.completePreviewMathCalls;
      SC.resetRandomSource(); Math.random = window.completePreviewOriginalMath; return { snapshot, calls, mathCalls };
    });
    expect(result.snapshot).toBe(before); expect(result.calls).toBe(0); expect(result.mathCalls).toBe(0); expect(errors).toEqual([]);
    if (testInfo.project.name === 'desktop') {
      // Resize regenerates decorative title particles; audit the video preview itself, not that unrelated resize handler.
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.clock.fastForward(32);
      const videoBefore = await beginPreviewAudit(page);
      for (const id of ['phoenix', 'bastion']) {
        expect(await page.evaluate(id => SC.previewCombo(id), id)).toBe(true);
        await page.clock.fastForward(8500);
        await assertReadablePreview(page);
        if (id === 'phoenix') await expect(page.locator('.combo-target-status')).toContainText('灼烧');
        else {
          await expect(page.locator('.combo-target[data-side="ally"] .combo-target-status')).toContainText('护盾展开');
          const gaps = await page.locator('#combo-cinematic').evaluate(root => {
            const bottom = root.querySelector('.combo-combat-arena').getBoundingClientRect().bottom;
            return [...root.querySelectorAll('.combo-target-hp,.combo-target-shield,.combo-target-status')]
              .filter(node => { const box = node.getBoundingClientRect(); return box.width > 0 && box.height > 0; })
              .map(node => ({ kind: node.className, side: node.closest('.combo-target').dataset.side, gap: bottom - node.getBoundingClientRect().bottom }));
          });
          expect(gaps).toHaveLength(5); // Two HP bars, one real shield bar and both status rows remain displayed.
          for (const result of gaps) expect(result.gap, `${result.side} ${result.kind} bottom clearance`).toBeGreaterThanOrEqual(4);
        }
        await page.locator('#combo-preview-close').click();
      }
      await endPreviewAudit(page, videoBefore);
    }
  });

  test('leaving the combos page cancels a playing preview and delayed loading even after navigating back', async ({ page }) => {
    const errors = await loadMotionPreview(page, { clocked: true });
    expect(await page.evaluate(() => SC.previewCombo('phoenix'))).toBe(true);
    await expect(page.locator('#combo-cinematic')).toHaveCount(1);
    await page.evaluate(() => SC.navigatePreparation('expedition'));
    await expect(page.locator('#combo-cinematic')).toHaveCount(0);
    const delayed = await page.evaluate(async () => {
      SC.navigatePreparation('combos');
      const original = preloadArt;
      let release, firstLoad = true;
      preloadArt = () => {
        if (!firstLoad) return Promise.resolve([]);
        firstLoad = false;
        return new Promise(resolve => { release = resolve; });
      };
      try {
        const pending = SC.previewCombo('eclipse');
        SC.navigatePreparation('supplies'); SC.navigatePreparation('combos');
        release([]);
        const played = await pending;
        return { played, roots: document.querySelectorAll('#combo-cinematic').length, combos: document.querySelector('#preparation-combos').getBoundingClientRect().height > 0 };
      } finally { preloadArt = original; }
    });
    expect(delayed).toEqual({ played: false, roots: 0, combos: true });
    await page.clock.fastForward(10000);
    await expect(page.locator('#combo-cinematic')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('battle rejects free preview but a confirmed cast uses the same dynamic pipeline and clears on reset', async ({ page }) => {
    const errors = await loadMotionPreview(page, { clocked: true });
    await prepareMotionBattle(page);
    const setup = await page.evaluate(async () => {
      const state = SC.state;
      const actor = state.allies.find(unit => unit.characterId === 'H1'), partner = state.allies.find(unit => unit.characterId === 'A1');
      const before = JSON.stringify({ inventory: SC.progression.inventory, energy: [actor.energy, partner.energy], hp: state.enemies.map(unit => unit.curHp) });
      const preview = await SC.previewCombo('phoenix');
      const after = JSON.stringify({ inventory: SC.progression.inventory, energy: [actor.energy, partner.energy], hp: state.enemies.map(unit => unit.curHp) });
      SC.openComboModal();
      return { preview, unchanged: before === after, buttons: document.querySelectorAll('#combo-modal [data-preview-combo]').length };
    });
    expect(setup).toEqual({ preview: false, unchanged: true, buttons: 0 });
    await page.locator('#combo-modal [data-cast-combo="phoenix"]').click();
    const cinematic = page.locator('#live-combo');
    await expect(cinematic).toBeVisible();
    await expect(page.locator('#combo-cinematic')).toHaveCount(0);
    expect(await page.evaluate(() => LiveCombo.current.recipe.id)).toBe('phoenix');
    await page.evaluate(() => SC.cancelComboPreview());
    await expect(cinematic).toHaveCount(1);
    await page.clock.fastForward(3900);
    const release = await captureLiveMotionFrame(page);
    await page.clock.fastForward(1400);
    const impact = await captureLiveMotionFrame(page);
    expect(impact.hash).not.toBe(release.hash);
    expect(release.visiblePixels).toBeGreaterThan(8); expect(impact.visiblePixels).toBeGreaterThan(8);
    expect(release.actualBattle && impact.actualBattle).toBe(true);
    await expect(page.locator('#live-combo-skip')).toBeInViewport();
    const result = await page.evaluate(() => ({ ember: SC.progression.inventory.ember,
      energies: ['H1', 'A1'].map(id => SC.state.allies.find(unit => unit.characterId === id).energy),
      damaged: SC.state.enemies.every(unit => unit.curHp < 100000), casts: SC.state.run.comboCasts }));
    expect(result).toEqual({ ember: 1, energies: [0, 0], damaged: true, casts: 1 });
    await page.clock.fastForward(2700);
    const healthLabels = await page.evaluate(() => {
      const canvas = document.getElementById('battle-canvas'), ctx = canvas.getContext('2d'), originalRect = rrect, originalFill = ctx.fill;
      let lastRect, drawn;
      rrect = (...args) => { lastRect = { x: args[1], y: args[2], width: args[3], height: args[4] }; return originalRect(...args); };
      ctx.fill = function (...args) { if (['#46c46a', '#e8a33d', '#e0493b'].includes(this.fillStyle)) drawn = { ...lastRect }; return originalFill.apply(this, args); };
      try {
        return SC.state.enemies.map(unit => {
          drawn = null; drawUnitHud(ctx, unit, true, performance.now());
          const fullWidth = Math.max(46, unit._r * 2.35), hud = unit._hud;
          return { current: unit.curHp, max: unit.maxHp, renderedRatio: drawn?.width / fullWidth,
            bounded: !!hud && hud.left >= 0 && hud.right <= BW && hud.top >= 0 && hud.bottom <= BH };
        });
      } finally { rrect = originalRect; ctx.fill = originalFill; }
    });
    expect(healthLabels.length).toBeGreaterThan(0);
    for (const label of healthLabels) {
      expect(label.bounded).toBe(true); expect(label.max).toBe(100000); expect(label.current).toBeLessThan(label.max);
      expect(label.renderedRatio).toBeCloseTo(label.current / label.max, 5);
    }
    await page.clock.fastForward(500);
    await expect(cinematic).toHaveCount(0);
    await page.evaluate(() => resetGame());
    await page.clock.fastForward(10000);
    await expect(cinematic).toHaveCount(0);
    await expect(page.locator('#title-screen')).toHaveClass(/active/);
    expect(errors).toEqual([]);
  });

  test('an epic cast never resumes at the old five-second clamp and natural completion or skip resumes exactly once', async ({ page }) => {
    test.setTimeout(60_000);
    const errors = await loadMotionPreview(page, { clocked: true });
    for (const mode of ['natural', 'skip', 'deadline-skip']) {
      const setup = await prepareMotionBattle(page, { observeResume: true });
      expect(await castAndCaptureCompletion(page)).toBe(true);
      const committed = await page.evaluate(() => JSON.stringify({ inventory: SC.progression.inventory, hp: SC.state.enemies.map(unit => unit.curHp),
        energy: SC.state.allies.map(unit => unit.energy), casts: SC.state.run.comboCasts }));
      if (mode === 'natural') {
        await page.clock.fastForward(5200);
        expect(await page.evaluate(() => ({ calls: window.epicResumeCalls, phase: SC.state.phase, index: SC.state.curIdx }))).toEqual({ calls: 0, phase: 'anim', index: 0 });
        await page.clock.fastForward(1800);
        expect(await page.evaluate(() => LiveCombo.current.elapsed)).toBeGreaterThanOrEqual(6900);
        expect((await captureLiveMotionFrame(page)).visiblePixels).toBeGreaterThan(8);
        expect(await page.evaluate(() => ({ calls: window.epicResumeCalls, phase: SC.state.phase, index: SC.state.curIdx }))).toEqual({ calls: 0, phase: 'anim', index: 0 });
        await page.clock.fastForward(1400);
      } else {
        await page.clock.fastForward(mode === 'skip' ? 2200 : 8390);
        await page.locator('#live-combo-skip').click();
        await page.clock.fastForward(200);
      }
      await expect(page.locator('#live-combo')).toHaveCount(0);
      // fastForward dispatches due callbacks at the destination; advance the newly scheduled 120 ms handoff separately.
      await page.clock.fastForward(200);
      const continued = await page.evaluate(() => ({ calls: window.epicResumeCalls, phase: SC.state.phase, index: SC.state.curIdx,
        current: SC.state.turnOrder[SC.state.curIdx]?.uid, events: window.epicCompletionEvents }));
      expect(continued).toMatchObject({ calls: 1, phase: 'player', index: 1, current: setup.nextUid });
      expect(continued.events).toEqual([{ reason: mode === 'natural' ? 'complete' : 'skipped', duration: 8400, preview: false }]);
      // A duplicate renderer signal and its old timer must not create a second action or another cost.
      await page.evaluate(() => { window.epicCapturedCompletion({ reason: 'complete', duration: 8400, preview: false }); window.epicCapturedCompletion({ reason: 'skipped', duration: 8400, preview: false }); });
      await page.clock.fastForward(10000);
      expect(await page.evaluate(() => window.epicResumeCalls)).toBe(1);
      expect(await page.evaluate(() => JSON.stringify({ inventory: SC.progression.inventory, hp: SC.state.enemies.map(unit => unit.curHp),
        energy: SC.state.allies.map(unit => unit.energy), casts: SC.state.run.comboCasts }))).toBe(committed);
      expect(await page.evaluate(() => ({ ember: SC.progression.inventory.ember, casts: SC.state.run.comboCasts }))).toEqual({ ember: 1, casts: 1 });
    }
    for (const failure of ['missing', 'throwing']) {
      const setup = await prepareMotionBattle(page, { observeResume: true });
      const executed = await page.evaluate(failure => {
        const original = window.LiveCombo;
        const descriptors = Object.getOwnPropertyDescriptors(original);
        descriptors.play = { value: () => { throw new Error('test renderer unavailable'); }, configurable: true };
        window.LiveCombo = failure === 'missing' ? undefined : Object.create(null, descriptors);
        try { return SC.executeCombo('phoenix'); }
        finally { window.LiveCombo = original; }
      }, failure);
      expect(executed).toBe(true);
      await page.clock.fastForward(1300);
      expect(await page.evaluate(() => window.epicResumeCalls)).toBe(0);
      await page.clock.fastForward(100);
      await page.clock.fastForward(200);
      expect(await page.evaluate(() => ({ calls: window.epicResumeCalls, current: SC.state.turnOrder[SC.state.curIdx]?.uid,
        ember: SC.progression.inventory.ember, casts: SC.state.run.comboCasts }))).toEqual({ calls: 1, current: setup.nextUid, ember: 1, casts: 1 });
      await page.clock.fastForward(10000);
      expect(await page.evaluate(() => window.epicResumeCalls)).toBe(1);
    }
    await page.evaluate(() => { afterPlayer = window.epicOriginalAfterPlayer; resetGame(); });
    expect(errors).toEqual([]);
  });

  test('canceling an epic or leaving its run prevents stale completion from resuming or spending again', async ({ page }) => {
    const errors = await loadMotionPreview(page, { clocked: true });
    await prepareMotionBattle(page, { observeResume: true });
    expect(await castAndCaptureCompletion(page)).toBe(true);
    await page.clock.fastForward(2200);
    await page.evaluate(() => LiveCombo.clear());
    await page.clock.fastForward(10000);
    expect(await page.evaluate(() => ({ calls: window.epicResumeCalls, events: window.epicCompletionEvents.length,
      index: SC.state.curIdx, phase: SC.state.phase, ember: SC.progression.inventory.ember }))).toEqual({ calls: 0, events: 0, index: 0, phase: 'anim', ember: 1 });
    await prepareMotionBattle(page, { observeResume: true });
    expect(await castAndCaptureCompletion(page)).toBe(true);
    await page.clock.fastForward(2200);
    await page.evaluate(() => resetGame());
    await page.clock.fastForward(10000);
    expect(await page.evaluate(() => ({ calls: window.epicResumeCalls, events: window.epicCompletionEvents.length, ember: SC.progression.inventory.ember }))).toEqual({ calls: 0, events: 0, ember: 1 });
    await expect(page.locator('#title-screen')).toHaveClass(/active/);
    // A new run must also reject the first run's captured completion, even if a late signal arrives explicitly.
    await page.evaluate(() => {
      resetGame(); SC.startBattle(); SC.state.battleToken++; SC.setAutoBattle(false);
      window.epicStableSnapshot = () => JSON.stringify(SC.snapshot(), (key, value) => /^_(x|y|r|hit|artHeight|artWidth|artRect|visual|hud)$/.test(key) ? undefined : value);
      window.epicNewRunSnapshot = window.epicStableSnapshot();
      window.epicCapturedCompletion({ reason: 'complete', duration: 8400, preview: false });
    });
    await page.clock.fastForward(10000);
    expect(await page.evaluate(() => ({ calls: window.epicResumeCalls, unchanged: window.epicNewRunSnapshot === window.epicStableSnapshot(), ember: SC.progression.inventory.ember }))).toEqual({ calls: 0, unchanged: true, ember: 1 });
    await page.evaluate(() => { afterPlayer = window.epicOriginalAfterPlayer; resetGame(); });
    await expect(page.locator('#combo-cinematic')).toHaveCount(0);
    await expect(page.locator('#live-combo')).toHaveCount(0);
    await expect(page.locator('#title-screen')).toHaveClass(/active/);
    expect(errors).toEqual([]);
  });
});
