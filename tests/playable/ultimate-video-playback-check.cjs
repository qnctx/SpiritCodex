/* Read-only browser verification of the six exported gameplay WebM clips.
 * Run only after capture/export finishes; this script does not record or alter files.
 */
const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');

const IDS = ['phoenix', 'leviathan', 'bastion', 'spring', 'eclipse', 'legion'];
const BASE = process.env.SPIRIT_CODEX_URL || 'http://127.0.0.1:4173/playable/spirit-codex.html';
const only = process.argv.find(argument => argument.startsWith('--only='))?.slice(7);
const selected = only ? only.split(',') : IDS;
assert.ok(selected.every(id => IDS.includes(id)) && new Set(selected).size === selected.length, 'Select known, nonrepeated video IDs with --only=id,id');

async function verifyClip(browser, id) {
  const source = new URL(`assets/combos/videos/ultimate-${id}-v9.webm`, BASE).href;
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage(), errors = [], responses = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.url() === source) responses.push(response.status()); });
  try {
    await page.setContent('<!doctype html><meta charset="utf-8"><title>SpiritCodex video playback validation</title><video muted playsinline preload="auto" width="1280" height="720"></video>');
    const result = await page.evaluate(source => new Promise((resolve, reject) => {
      const video = document.querySelector('video'), times = [], mediaErrors = [];
      video.muted = true;
      let metadata, playing = false, finished = false;
      const timeout = setTimeout(() => finish(new Error('Video metadata or real playback did not advance within 12 seconds')), 12000);
      function finish(error) {
        if (finished) return; finished = true; clearTimeout(timeout);
        const quality = video.getVideoPlaybackQuality?.();
        const report = { ...metadata, currentTime: video.currentTime, timeupdates: times.length,
          firstTime: times[0], lastTime: times.at(-1), playing,
          decodedFrames: quality?.totalVideoFrames ?? video.webkitDecodedFrameCount ?? 0,
          mediaErrors, errorCode: video.error?.code ?? null };
        video.pause();
        if (error) reject(error); else resolve(report);
      }
      video.addEventListener('error', () => {
        mediaErrors.push({ code: video.error?.code, message: video.error?.message || 'media error' });
        finish(new Error(`Video decoding/playback failed: ${JSON.stringify(mediaErrors)}`));
      });
      video.addEventListener('playing', () => { playing = true; });
      video.addEventListener('timeupdate', () => {
        times.push(video.currentTime);
        if (playing && !video.paused && times.length >= 3 && times.at(-1) - times[0] >= .35) finish();
      });
      video.addEventListener('loadedmetadata', async () => {
        metadata = { duration: video.duration, width: video.videoWidth, height: video.videoHeight };
        try { await video.play(); }
        catch (error) { finish(new Error(`video.play() rejected: ${error.message}`)); }
      }, { once: true });
      video.src = source; video.load();
    }), source);
    assert.ok(responses.length > 0 && responses.every(status => status === 200 || status === 206), `${id}: video request failed`);
    assert.ok(Math.abs(result.duration - 8.4) <= .08, `${id}: unexpected duration ${result.duration}`);
    assert.equal(result.width, 1280); assert.equal(result.height, 720);
    assert.equal(result.playing, true); assert.ok(result.timeupdates >= 3);
    assert.ok(result.lastTime - result.firstTime >= .35); assert.ok(result.decodedFrames > 1);
    assert.equal(result.errorCode, null); assert.deepEqual(result.mediaErrors, []); assert.deepEqual(errors, []);
    return { id, source, ...result, responseStatuses: responses, pageErrors: errors };
  } finally { await context.close(); }
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const results = [];
  try {
    for (const id of selected) {
      const result = await verifyClip(browser, id);
      results.push(result); console.log(JSON.stringify(result));
    }
  } finally { await browser.close(); }
  console.log(JSON.stringify({ kind: 'read-only WebM browser playback verification', passed: results.length, expected: selected.length, results }));
})().catch(error => { console.error(error); process.exitCode = 1; });
