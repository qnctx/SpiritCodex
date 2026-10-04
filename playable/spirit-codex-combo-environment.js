/* Shared, deterministic background atmosphere. Draw before actors/HUD, under the caller's clip. */
(function () {
  'use strict';

  const DURATION = 8400, RELEASE_DURATION = 900, TAU = Math.PI * 2;
  const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
  const clamp = value => Math.max(0, Math.min(1, value));
  const smooth = value => { const p = clamp(value); return p * p * (3 - 2 * p); };
  const fract = value => value - Math.floor(value);
  const seed = (index, salt = 0) => fract(Math.sin((index + 1) * 127.1 + (salt + 1) * 311.7) * 43758.5453);
  const THEMES = Object.freeze({
    phoenix: Object.freeze({ top:'#291117', sky:'#8f3623', light:'#efae58', particle:'#f6d299', ground:'#ae5b2c', weather:'ash', wind:.35 }),
    tide: Object.freeze({ top:'#08182b', sky:'#214b70', light:'#609bbc', particle:'#abd8e8', ground:'#366c88', weather:'rain', wind:.65 }),
    bastion: Object.freeze({ top:'#292316', sky:'#78603a', light:'#e0bd79', particle:'#f0daa5', ground:'#a88b4d', weather:'gold-dust', wind:.14 }),
    spring: Object.freeze({ top:'#102720', sky:'#32634c', light:'#89ba94', particle:'#d5e3b9', ground:'#548666', weather:'petals', wind:.22 }),
    eclipse: Object.freeze({ top:'#130d23', sky:'#3d2c58', light:'#977cb6', particle:'#d3c1e8', ground:'#625076', weather:'stars', wind:.09 }),
    legion: Object.freeze({ top:'#0b2022', sky:'#24504a', light:'#679e92', particle:'#b4d4bf', ground:'#3c7465', weather:'soul-dust', wind:.18 }),
  });
  const motionName = motion => motion === 'leviathan' ? 'tide' : Object.hasOwn(THEMES, motion) ? motion : 'phoenix';
  const rgba = (hex, alpha) => {
    const color = parseInt(hex.slice(1), 16);
    return `rgba(${color >> 16},${color >> 8 & 255},${color & 255},${clamp(alpha)})`;
  };

  function sample(motion, time, { reduced = false } = {}) {
    const name = motionName(motion), theme = THEMES[name], elapsed = Math.max(0, finite(time));
    let strength = 0, phase = 'idle';
    if (!reduced && elapsed < DURATION) {
      if (elapsed < 1400) { phase = 'charge'; strength = .26 * smooth(elapsed / 1400); }
      else if (elapsed < 3200) { phase = 'manifest'; strength = .26 + .36 * smooth((elapsed - 1400) / 1800); }
      else if (elapsed < 4700) { phase = 'release'; strength = .62 + .20 * smooth((elapsed - 3200) / 1500); }
      else if (elapsed < 5400) { phase = 'impact'; strength = .82 + .12 * smooth((elapsed - 4700) / 700); }
      else if (elapsed < 6200) { phase = 'impact'; strength = .94 - .10 * smooth((elapsed - 5400) / 800); }
      else if (elapsed < 7600) { phase = 'aftershock'; strength = .84 - .36 * smooth((elapsed - 6200) / 1400); }
      else { phase = 'settle'; strength = .48 * (1 - smooth((elapsed - 7600) / 800)); }
    }
    const active = strength > 0;
    return { motion:name, phase, elapsed, reduced:Boolean(reduced), active, strength,
      skyStrength:strength * .90,
      groundStrength:strength * (.24 + .48 * smooth((elapsed - 600) / 2600)),
      palette:theme,
      weather:{ kind:theme.weather, intensity:strength * (name === 'tide' ? .90 : .72), wind:active ? theme.wind : 0 } };
  }

  function glow(ctx, x, y, rx, ry, color, alpha) {
    if (alpha <= 0 || rx <= 0 || ry <= 0) return;
    ctx.save();
    try {
      ctx.translate(x, y); ctx.scale(rx, ry);
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      gradient.addColorStop(0, rgba(color, alpha));
      gradient.addColorStop(.48, rgba(color, alpha * .43));
      gradient.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.fill();
    } finally { ctx.restore(); }
  }

  function sky(ctx, width, skyHeight, frame, seconds) {
    const { palette:p, skyStrength:s, motion } = frame;
    const shade = ctx.createLinearGradient(0, 0, 0, skyHeight);
    shade.addColorStop(0, rgba(p.top, s * .64));
    shade.addColorStop(.53, rgba(p.sky, s * .24));
    shade.addColorStop(1, rgba(p.sky, 0));
    ctx.fillStyle = shade; ctx.fillRect(0, 0, width, skyHeight);
    // Broad translucent layers move slowly; there are no flashes or foreground figures.
    for (let layer = 0; layer < 6; layer++) {
      const drift = Math.sin(seconds * (.075 + layer * .006) + layer * 1.73);
      const x = width * (.04 + layer * .185 + drift * .045);
      const y = skyHeight * (.12 + seed(layer, 4) * .27);
      const rx = width * (.23 + seed(layer, 3) * .12), ry = skyHeight * (.12 + seed(layer, 7) * .10);
      glow(ctx, x, y, rx, ry, layer % 2 ? p.sky : p.light, s * (layer % 2 ? .17 : .075));
    }
    if (motion === 'phoenix') {
      glow(ctx, width * .54, skyHeight * .20, width * .38, skyHeight * .17, p.light, s * .13);
      for (let cloud = 0; cloud < 4; cloud++) {
        glow(ctx, width * (.15 + cloud * .25), skyHeight * (.21 + Math.sin(seconds * .18 + cloud) * .025),
          width * .22, skyHeight * .085, p.ground, s * .17);
      }
    } else if (motion === 'tide') {
      for (let bank = 0; bank < 4; bank++) {
        glow(ctx, width * (.08 + bank * .3), skyHeight * (.12 + bank % 2 * .11), width * .29, skyHeight * .13, p.top, s * .24);
      }
    } else if (motion === 'bastion') {
      const sunX = width * .32, sunY = skyHeight * .04;
      glow(ctx, sunX, sunY, width * .24, skyHeight * .31, p.light, s * .18);
      for (let ray = 0; ray < 6; ray++) {
        const end = width * (.05 + ray * .19 + Math.sin(seconds * .08 + ray) * .018);
        const light = ctx.createLinearGradient(sunX, sunY, end, skyHeight);
        light.addColorStop(0, rgba(p.light, s * .09)); light.addColorStop(1, rgba(p.light, 0));
        ctx.fillStyle = light; ctx.beginPath(); ctx.moveTo(sunX - 4, sunY); ctx.lineTo(sunX + 4, sunY);
        ctx.lineTo(end + width * .035, skyHeight); ctx.lineTo(end - width * .035, skyHeight); ctx.closePath(); ctx.fill();
      }
    } else if (motion === 'spring') {
      glow(ctx, width * .28, skyHeight * .66, width * .40, skyHeight * .26, p.light, s * .12);
      glow(ctx, width * .78, skyHeight * .51, width * .32, skyHeight * .33, p.sky, s * .16);
    } else if (motion === 'eclipse') {
      const x = width * .70, y = skyHeight * .24, radius = Math.min(width * .16, skyHeight * .23);
      glow(ctx, x, y, radius * 1.8, radius * 1.1, p.light, s * .16);
      ctx.strokeStyle = rgba(p.light, s * .16); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y, radius, radius * .74, -.3, seconds * .035 + .3, seconds * .035 + Math.PI * 1.62); ctx.stroke();
      glow(ctx, x - radius * .13, y, radius * .81, radius * .71, p.top, s * .25);
    } else {
      for (let fog = 0; fog < 4; fog++) {
        glow(ctx, width * (.12 + fog * .27 + Math.sin(seconds * .11 + fog) * .05),
          skyHeight * (.43 + fog % 2 * .17), width * .30, skyHeight * .20, p.sky, s * .20);
      }
    }
  }

  function ground(ctx, width, height, groundY, frame, seconds) {
    const { palette:p, groundStrength:s, motion } = frame, depth = Math.max(1, height - groundY);
    const wash = ctx.createLinearGradient(0, groundY, 0, height);
    wash.addColorStop(0, rgba(p.ground, s * .05)); wash.addColorStop(.52, rgba(p.ground, s * .25));
    wash.addColorStop(1, rgba(p.ground, s * .08));
    ctx.fillStyle = wash; ctx.fillRect(0, groundY, width, depth);
    glow(ctx, width * .52, groundY + depth * .43, width * .51, depth * .45, p.light, s * .14);
    if (motion === 'tide' || motion === 'spring') {
      for (let ring = 0; ring < 5; ring++) {
        const phase = fract(seconds * .095 + ring / 5), fade = Math.sin(phase * Math.PI);
        ctx.strokeStyle = rgba(p.light, s * fade * (motion === 'tide' ? .30 : .22)); ctx.lineWidth = 1.1 + phase * 1.4;
        ctx.beginPath(); ctx.ellipse(width * .52, groundY + depth * .37, width * (.08 + phase * .49),
          depth * (.035 + phase * .22), 0, 0, TAU); ctx.stroke();
      }
    } else if (motion === 'phoenix') {
      for (let band = 0; band < 5; band++) {
        ctx.strokeStyle = rgba(p.light, s * (.08 + band * .015)); ctx.lineWidth = 2 + band * .5;
        ctx.beginPath();
        for (let step = 0; step <= 24; step++) {
          const x = width * step / 24, y = groundY + depth * (.2 + band * .14) + Math.sin(step * .72 + seconds * .65 + band) * (2 + band);
          if (step) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
    } else if (motion === 'bastion') {
      for (let strip = 0; strip < 6; strip++) {
        const x = width * (.08 + strip * .17), spread = width * .035;
        ctx.fillStyle = rgba(p.light, s * (.035 + seed(strip, 5) * .04));
        ctx.beginPath(); ctx.moveTo(width * .42 + strip * 4, groundY); ctx.lineTo(x + spread, height);
        ctx.lineTo(x - spread, height); ctx.closePath(); ctx.fill();
      }
    } else if (motion === 'eclipse') {
      glow(ctx, width * .57, groundY + depth * .41, width * .31, depth * .26, p.sky, s * .23);
      ctx.strokeStyle = rgba(p.light, s * .13); ctx.lineWidth = 1.4; ctx.beginPath();
      ctx.ellipse(width * .57, groundY + depth * .41, width * .25, depth * .18, 0, .25 + seconds * .04, Math.PI * 1.25 + seconds * .04); ctx.stroke();
    } else {
      for (let fog = 0; fog < 5; fog++) {
        glow(ctx, width * (.02 + fog * .25 + Math.sin(seconds * .18 + fog) * .055),
          groundY + depth * (.18 + seed(fog, 2) * .3), width * .25, depth * .20, p.light, s * .10);
      }
    }
  }

  function weather(ctx, width, height, groundY, frame, seconds) {
    const { palette:p, weather:w, motion } = frame;
    const count = Math.max(24, Math.min(72, Math.round(width / 20))) * (motion === 'tide' ? 2 : 1);
    for (let index = 0; index < count; index++) {
      const phase = fract(seed(index, 8) + seconds * (motion === 'tide' ? .37 : .045 + seed(index, 6) * .027));
      const edgeFade = Math.sin(phase * Math.PI), drift = Math.sin(seconds * .25 + index * 2.4);
      const x = fract(seed(index, 1) + seconds * w.wind * .014) * width + drift * (motion === 'tide' ? 0 : 7);
      const y = motion === 'tide' ? phase * height : (1 - phase) * (groundY + (height - groundY) * .25);
      const size = .8 + seed(index, 3) * 1.9, alpha = w.intensity * edgeFade * (.18 + seed(index, 7) * .23);
      if (motion === 'tide') {
        const length = 11 + size * 7;
        ctx.strokeStyle = rgba(p.particle, alpha); ctx.lineWidth = .7 + size * .23;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + length * .34, y + length); ctx.stroke();
      } else if (motion === 'spring') {
        ctx.save();
        try {
          ctx.translate(x, y); ctx.rotate(seconds * .36 + index * 1.7);
          ctx.fillStyle = rgba(p.particle, alpha); ctx.beginPath(); ctx.moveTo(-size * 2.2, 0);
          ctx.bezierCurveTo(-size, -size * 1.8, size * 1.5, -size, size * 2.4, 0);
          ctx.bezierCurveTo(size, size * 1.4, -size, size, -size * 2.2, 0); ctx.fill();
        } finally { ctx.restore(); }
      } else if (motion === 'legion') {
        ctx.strokeStyle = rgba(p.light, alpha * .60); ctx.lineWidth = size * .8;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + drift * 3, y + size * 3, x - drift * 2, y + size * 6); ctx.stroke();
        ctx.fillStyle = rgba(p.particle, alpha); ctx.beginPath(); ctx.arc(x, y, size, 0, TAU); ctx.fill();
      } else {
        ctx.fillStyle = rgba(p.particle, alpha); ctx.beginPath(); ctx.arc(x, y, size * (motion === 'eclipse' ? .70 : 1), 0, TAU); ctx.fill();
        if (motion === 'bastion' || motion === 'eclipse') {
          ctx.strokeStyle = rgba(p.particle, alpha * .55); ctx.lineWidth = .7;
          ctx.beginPath(); ctx.moveTo(x - size * 2, y); ctx.lineTo(x + size * 2, y);
          ctx.moveTo(x, y - size * 2); ctx.lineTo(x, y + size * 2); ctx.stroke();
        }
      }
    }
  }

  function draw(ctx, { width, height, groundY } = {}, frame, time) {
    width = Math.max(0, finite(width)); height = Math.max(0, finite(height));
    if (!ctx || !frame || frame.reduced || !frame.active || frame.strength <= 0 || !width || !height) return false;
    const floor = Math.max(0, Math.min(height, finite(groundY, height * .72)));
    const seconds = Math.max(0, finite(time, frame.elapsed)) / 1000;
    ctx.save();
    try {
      ctx.beginPath(); ctx.rect(0, 0, width, height); ctx.clip();
      // Parent alpha, transform and clipping are retained; no DOM/UI geometry is measured here.
      sky(ctx, width, Math.max(1, floor), frame, seconds);
      ground(ctx, width, height, floor, frame, seconds);
      weather(ctx, width, height, floor, frame, seconds);
    } finally { ctx.restore(); }
    return true;
  }

  // Optional battle bridge. No timers/RAF: the owner drives it from its render loop.
  let record = null, serial = 0;
  const nowTime = () => window.BattleClock?.now()??(typeof performance !== 'undefined' ? performance.now() : Date.now());
  const clock = value => Number.isFinite(value) ? value : nowTime();
  const owns = token => record && (token === undefined || token === record.token);

  function beginBattle(motion, { reduced = false, now } = {}) {
    const token = ++serial;
    record = reduced ? null : { token, motion:motionName(motion), elapsed:0, syncedAt:clock(now),
      releaseAt:null, releaseSample:null, lastSample:null, awaitingRelease:false };
    return token;
  }

  function syncBattle(motion, time, { token, reduced = false, now } = {}) {
    if (!owns(token) || motionName(motion) !== record.motion) return false;
    if (reduced) { record = null; return true; }
    if (record.releaseAt !== null || record.awaitingRelease) return false;
    const elapsed = Math.max(0, finite(time));
    if (elapsed < record.elapsed) return false;
    record.elapsed = elapsed; record.syncedAt = clock(now);
    const frame = sample(record.motion, elapsed);
    if (frame.strength >= .06) record.lastSample = frame;
    if (elapsed >= DURATION) record.awaitingRelease = true;
    return true;
  }

  function faded(frame, factor) {
    return { ...frame, active:frame.strength * factor > 0, strength:frame.strength * factor,
      skyStrength:frame.skyStrength * factor, groundStrength:frame.groundStrength * factor,
      weather:{ ...frame.weather, intensity:frame.weather.intensity * factor } };
  }

  function battleFrame(now) {
    if (!record) return null;
    const current = clock(now);
    if (record.releaseAt !== null) {
      const age = Math.max(0, current - record.releaseAt);
      if (age >= RELEASE_DURATION) { record = null; return null; }
      return { ...faded(record.releaseSample, 1 - smooth(age / RELEASE_DURATION)), token:record.token, releasing:true };
    }
    const elapsed = record.elapsed + Math.max(0, current - record.syncedAt);
    if (elapsed >= DURATION) {
      // The owner's final render can sync 8400 before its completion callback releases us.
      // Keep only a short non-drawing hand-off window, never an unbounded stale effect.
      record.awaitingRelease = true;
      if (elapsed >= DURATION + RELEASE_DURATION) record = null;
      return null;
    }
    const frame = sample(record.motion, elapsed);
    if (frame.strength >= .06) record.lastSample = frame;
    return { ...frame, token:record.token, releasing:false };
  }

  function releaseBattle({ cancelled = false, token, now } = {}) {
    if (!owns(token)) return false;
    if (cancelled) { record = null; return true; }
    if (record.releaseAt !== null) return true;
    const current = clock(now), elapsed = record.elapsed + Math.max(0, current - record.syncedAt);
    if (elapsed >= DURATION + RELEASE_DURATION) { record = null; return false; }
    let frame = sample(record.motion, elapsed);
    if (elapsed >= DURATION) {
      const recent = record.lastSample || sample(record.motion, 7600);
      frame = { ...faded(recent, .12 / recent.strength), phase:'settle', elapsed:DURATION };
    }
    if (frame.strength <= 0) { record = null; return true; }
    record.releaseAt = current; record.releaseSample = frame;
    return true;
  }

  window.ComboEnvironment = Object.freeze({ sample, draw, beginBattle, syncBattle, releaseBattle, battleFrame });
}());
