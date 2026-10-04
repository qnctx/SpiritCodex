/*
 * Real-time gameplay capture, not an AI video-model output.
 * Requires the existing http://127.0.0.1:4173 server; never starts a server.
 * Usage: node tests/playable/ultimate-video-capture.cjs [--only=phoenix,spring] [--check-tools]
 * Every run uses fresh, non-persistent browser contexts, never a player's profile.
 */
'use strict';

const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const zlib = require('node:zlib');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT = path.join(ROOT, 'playable/assets/combos/videos');
const IDS = ['phoenix', 'leviathan', 'bastion', 'spring', 'eclipse', 'legion'];
const STAGES = ['charge', 'manifest', 'release', 'impact', 'aftershock', 'settle'];
const SIZE = { width: 1280, height: 720 };
const FPS = 25;
const DURATION = 8400;
const URL = process.env.SPIRIT_CODEX_URL || 'http://127.0.0.1:4173/playable/spirit-codex.html';

function findFfmpeg() {
  if (process.env.PLAYWRIGHT_FFMPEG) return process.env.PLAYWRIGHT_FFMPEG;
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'ms-playwright'),
    path.join(os.homedir(), '.cache/ms-playwright')].filter(Boolean);
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const folders = fs.readdirSync(root).filter(name => /^ffmpeg-\d+$/.test(name)).sort().reverse();
    for (const folder of folders) {
      for (const name of ['ffmpeg-win64.exe', 'ffmpeg-linux', 'ffmpeg-mac']) {
        const candidate = path.join(root, folder, name);
        if (fs.existsSync(candidate)) return candidate;
      }
    }
  }
  return 'ffmpeg';
}

const FFMPEG = findFfmpeg();
function ffmpeg(args, { inspect = false } = {}) {
  const result = spawnSync(FFMPEG, args, { encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  if (result.error || (!inspect && result.status !== 0)) {
    throw new Error(`ffmpeg failed: ${result.error?.message || result.stderr}`);
  }
  return `${result.stdout || ''}${result.stderr || ''}`;
}

// ffmpeg crops the setup marker to one RGB pixel. A one-pixel PNG has no left
// or previous row, so all standard PNG row filters yield the same RGB bytes.
function markerRgb(filename) {
  const buffer = fs.readFileSync(filename);
  const data = [];
  let channels;
  for (let offset = 8; offset + 12 <= buffer.length;) {
    const length = buffer.readUInt32BE(offset), type = buffer.toString('ascii', offset + 4, offset + 8);
    const chunk = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      assert.equal(chunk.readUInt32BE(0), 1); assert.equal(chunk.readUInt32BE(4), 1);
      assert.equal(chunk[8], 8, 'Marker PNG must use 8-bit color');
      channels = chunk[9] === 2 ? 3 : chunk[9] === 6 ? 4 : 0;
      assert.ok(channels, 'Marker PNG must use RGB/RGBA color');
    }
    if (type === 'IDAT') data.push(chunk);
    offset += length + 12;
  }
  const row = zlib.inflateSync(Buffer.concat(data));
  assert.equal(row.length, channels + 1);
  return [...row.subarray(1, 4)];
}

async function saveSnapshot(page) {
  return page.evaluate(() => JSON.stringify({
    storage: Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])),
    progression: SC.progression, run: SC.state.run, allies: SC.state.allies,
    enemies: SC.state.enemies, phase: SC.state.phase,
  }));
}

async function warmPreview(page, id) {
  await page.evaluate(async id => {
    const recipe = SC.comboRecipeById(id);
    const presentation = comboPreviewPresentation(recipe);
    const urls = new Set([COMBO_STAGE_ART.arena, COMBO_STAGE_ART.texture, COMBO_STAGE_ART.attack, recipe.casting.src, recipe.rig.src, recipe.rig.combat?.src,
      ...presentation.targets.map(target => target.art),
      ...recipe.memberIds.map(member => CHARACTERS.find(character => character.id === member).art)]);
    await SC.preloadArt([...urls].filter(Boolean));
    await Promise.all([...urls].filter(Boolean).map(src => new Promise((resolve, reject) => {
      const image = new Image(); image.onload = () => image.decode().then(resolve, reject);
      image.onerror = () => reject(new Error(`Could not preload ${src}`)); image.src = src;
    })));
  }, id);
}

async function capture(browser, id, temporary, qa) {
  const rawDir = path.join(temporary, id);
  fs.mkdirSync(rawDir, { recursive: true });
  const context = await browser.newContext({ viewport: SIZE, reducedMotion: 'no-preference',
    recordVideo: { dir: rawDir, size: SIZE } });
  const page = await context.newPage();
  const video = page.video();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let finished, stoppingAt;
  try {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.evaluate(() => SC.preloadArt());
    await page.evaluate(() => { showScreen('formation-screen'); SC.navigatePreparation('combos'); });
    await warmPreview(page, id);
    // Setup-only marker is removed before the first real preview frame. It is
    // never present in the exported clip and changes no game code or storage.
    await page.evaluate(() => {
      const marker = document.createElement('div'); marker.id = 'capture-setup-marker';
      marker.style.cssText = 'position:fixed;inset:0;background:#ff00ff;z-index:2147483647;pointer-events:none';
      document.getElementById('game').append(marker);
    });
    const before = await saveSnapshot(page);
    await page.screenshot({ path: path.join(rawDir, 'setup-slate.png') });
    await page.waitForTimeout(600);
    await page.evaluate(async id => {
      document.getElementById('capture-setup-marker').remove();
      if (!await SC.previewCombo(id)) throw new Error(`Cannot start ${id}`);
      const root = document.getElementById('combo-cinematic');
      if (root.dataset.preview !== 'true') throw new Error('Capture must be a free preview');
      if (!/演练|预览/.test(root.textContent)) throw new Error('Missing visible demo label');
      window.__ultimateCapture = { started: performance.now(), stages: [root.dataset.stage] };
      const observer = new MutationObserver(() => {
        const record = window.__ultimateCapture, stage = root.dataset.stage;
        if (record.stages.at(-1) !== stage) record.stages.push(stage);
        if (root.dataset.finished === 'true') {
          record.elapsed = Number(root.dataset.elapsed);
          record.wallDuration = performance.now() - record.started;
          record.finishedAt = performance.timeOrigin + performance.now();
          observer.disconnect();
        }
      });
      observer.observe(root, { attributes: true, attributeFilter: ['data-stage', 'data-finished'] });
    }, id);
    // Real wall-clock playback. Do not use page.clock or accelerate animation.
    await page.locator('#combo-cinematic[data-finished="true"]').waitFor({ timeout: 14000 });
    finished = await page.evaluate(() => window.__ultimateCapture);
    assert.equal(finished.elapsed, DURATION, 'The new 8.4-second effect must be installed before capture');
    assert.deepEqual(finished.stages, STAGES, 'All six real-time stages must have rendered');
    assert.ok(finished.wallDuration >= 8250, 'Playback unexpectedly skipped real time');
    assert.equal(await saveSnapshot(page), before, 'Free preview changed real game state or saved resources');
    assert.deepEqual(errors, [], 'The page reported a JavaScript error');
    // A new-document end slate reliably invalidates Chromium's screencast
    // surface after the animation stops. This is only the disposable capture
    // page, after all save/state checks, and is excluded from the exported clip.
    await page.goto('data:text/html,' + encodeURIComponent('<html style="background:#00ff00"><body style="margin:0;background:#00ff00"></body></html>'));
    await page.waitForTimeout(600);
  } finally {
    stoppingAt = Date.now();
    await context.close(); // Playwright finalizes its video only after context close.
  }

  const rawPath = await video.path();
  const markers = path.join(rawDir, 'marker-%05d.png');
  ffmpeg(['-hide_banner', '-loglevel', 'error', '-i', rawPath, '-an', '-vf', 'crop=16:16:0:0,scale=1:1',
    '-c:v', 'png', '-f', 'image2', markers]);
  const files = fs.readdirSync(rawDir).filter(name => /^marker-\d+\.png$/.test(name)).sort();
  let seenMarker = false, startFrame = -1, endFrame = -1;
  for (let index = 0; index < files.length; index++) {
    const [r, g, b] = markerRgb(path.join(rawDir, files[index]));
    const isMarker = r > 180 && g < 80 && b > 180;
    if (isMarker) { seenMarker = true; startFrame = -1; }
    else if (seenMarker && startFrame < 0) startFrame = index;
    const isEndSlate = r < 80 && g > 180 && b < 80;
    const isNavigationBlank = r > 220 && g > 220 && b > 220;
    if (startFrame >= 0 && (isEndSlate || isNavigationBlank)) { endFrame = index; break; }
  }
  assert.ok(startFrame >= 0, 'Could not locate the first preview frame; raw recording retained');
  if (endFrame < 0) {
    // Some Edge builds retain the last game surface instead of recording a
    // cross-document end slate. Remove only the measured post-completion tail;
    // both clocks are real epoch time, never a mocked/accelerated game clock.
    const tailFrames = Math.round(Math.max(0, stoppingAt - finished.finishedAt) / 1000 * FPS);
    endFrame = files.length - tailFrames;
    console.log(JSON.stringify({ id, endpoint: 'observed-completion-time', tailFrames }));
  }
  assert.ok(endFrame > startFrame, 'Could not locate the finished preview frame; raw recording retained');
  // Chromium screencast cadence can differ from the recorder's nominal 25fps.
  // Two excluded setup markers delimit the real 8.4-second action, so normalize
  // that captured frame span to its actual duration instead of cutting its tail.
  const sourceRate = (endFrame - startFrame) / (DURATION / 1000);
  const destination = path.join(OUTPUT, `ultimate-${id}-v9.webm`);
  ffmpeg(['-hide_banner', '-loglevel', 'error', '-r', sourceRate.toFixed(8), '-i', rawPath, '-ss', String(startFrame / sourceRate),
    '-t', String(DURATION / 1000), '-an', '-r', String(FPS), '-c:v', 'vp8', '-crf', '8',
    '-b:v', '1800k', '-deadline', 'good', '-cpu-used', '4', '-threads', '2', '-y', destination]);
  const metadata = ffmpeg(['-hide_banner', '-i', destination], { inspect: true });
  assert.match(metadata, /Duration: 00:00:08\.40/);
  assert.match(metadata, /1280x720/);
  for (const [label, second] of [['start', 0], ['charge', .4], ['manifest', 2.3], ['formed', 2.85], ['bloom', 3.1], ['release', 3.35], ['attack', 4.35], ['impact', 5.3], ['aftershock', 7], ['result', 8.1], ['end', 8.36]]) {
    ffmpeg(['-hide_banner', '-loglevel', 'error', '-i', destination, '-ss', String(second),
      '-frames:v', '1', '-c:v', 'png', '-f', 'image2', '-y', path.join(qa, `${id}-${label}.png`)]);
  }
  const bytes = fs.statSync(destination).size;
  console.log(JSON.stringify({ id, file: destination, bytes, duration: 8.4, fps: FPS, size: SIZE,
    stages: finished.stages, wallDuration: finished.wallDuration, sourceFrames: endFrame - startFrame, qa }));
  await video.delete();
  return { id, file: destination, bytes, seconds: 8.4, stages: finished.stages };
}

(async () => {
  console.log(ffmpeg(['-version']).split(/\r?\n/)[0]);
  if (process.argv.includes('--check-tools')) { console.log(`ffmpeg: ${FFMPEG}`); return; }
  const only = process.argv.find(arg => arg.startsWith('--only='))?.slice(7);
  const selected = only ? only.split(',') : IDS;
  if (selected.some(id => !IDS.includes(id)) || new Set(selected).size !== selected.length) {
    throw new Error(`Unknown or repeated combo: ${only}`);
  }
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-codex-ultimate-v9-record-'));
  const qa = path.join(os.tmpdir(), 'spirit-codex-ultimate-video-v9-qa');
  fs.mkdirSync(OUTPUT, { recursive: true }); fs.mkdirSync(qa, { recursive: true });
  console.log(`Temporary recordings: ${temporary}`);
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const results = [];
  try {
    for (const id of selected) results.push(await capture(browser, id, temporary, qa));
  } finally { await browser.close(); }
  console.log(JSON.stringify({ kind: '游戏实时特效实录', totalBytes: results.reduce((sum, result) => sum + result.bytes, 0), results }));
  // This exact directory was uniquely created above; never remove other temp data.
  assert.equal(path.dirname(temporary), path.resolve(os.tmpdir()));
  assert.ok(path.basename(temporary).startsWith('spirit-codex-ultimate-v9-record-'));
  fs.rmSync(temporary, { recursive: true });
})().catch(error => { console.error(error); process.exitCode = 1; });
