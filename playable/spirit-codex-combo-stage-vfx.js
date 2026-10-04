/* Material-scale ultimate effects. Every position comes from the live stage geometry. */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = value => Math.max(0, Math.min(1, value));
  const ease = value => 1 - (1 - clamp(value)) ** 3;
  const noise = seed => { const value = Math.sin(seed * 17.137 + 4.27) * 43758.5453; return value - Math.floor(value); };
  const MATERIALS = Object.freeze({
    phoenix: { dark: '#9a2810', mid: '#ff851c', light: '#fff0b5', accent: '#79ba67' },
    tide: { dark: '#123a78', mid: '#298ae8', light: '#b5f7ff', accent: '#bca3ff' },
    bastion: { dark: '#62411f', mid: '#bd8c43', light: '#ead39b', accent: '#cd6737' },
    spring: { dark: '#285d50', mid: '#6ead90', light: '#d0e9c1', accent: '#799db5' },
    eclipse: { dark: '#332342', mid: '#896ba7', light: '#dfd1ea', accent: '#5967a0' },
    legion: { dark: '#163d38', mid: '#4d8e7e', light: '#bed7ba', accent: '#697f93' },
  });
  // The forging beat has a hotter local exposure; released and lingering effects keep their quieter palette.
  const FORMATION_MATERIALS = Object.freeze({
    phoenix: { dark: '#842810', mid: '#f67827', light: '#fff0ce', accent: '#f8b147' },
    tide: { dark: '#16455e', mid: '#399ccc', light: '#d9faff', accent: '#9dafff' },
    bastion: { dark: '#68421f', mid: '#c4964b', light: '#f4dda4', accent: '#f38532' },
    spring: { dark: '#286552', mid: '#6cbd96', light: '#e1f2cb', accent: '#63c4d1' },
    eclipse: { dark: '#39274e', mid: '#9c76bf', light: '#f4e8ff', accent: '#8b9edc' },
    legion: { dark: '#19483e', mid: '#5caa90', light: '#e1edce', accent: '#91b7c7' },
  });

  function rgba(hex, alpha) {
    const value = parseInt(hex.slice(1), 16);
    return `rgba(${value >> 16 & 255},${value >> 8 & 255},${value & 255},${clamp(alpha)})`;
  }

  function route(start, end, progress, curve) {
    const p = clamp(progress);
    return { x: start.x + (end.x - start.x) * p, y: start.y + (end.y - start.y) * p - Math.sin(p * Math.PI) * curve };
  }

  function samplePath(start, end, progress, curve, first = 0, count = 28) {
    const points = [];
    for (let index = 0; index <= count; index++) points.push(route(start, end, first + (progress - first) * index / count, curve));
    return points;
  }

  function glow(ctx, x, y, radius, color, alpha, squash = 1) {
    if (radius <= 0 || alpha <= 0) return;
    ctx.save();
    ctx.translate(x, y); ctx.scale(1, squash);
    const fill = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    fill.addColorStop(0, rgba(color, alpha)); fill.addColorStop(.35, rgba(color, alpha * .45)); fill.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(0, 0, radius, 0, TAU); ctx.fill(); ctx.restore();
  }

  function glint(ctx, points, color, width, alpha) {
    if (points.length < 2 || alpha <= 0) return;
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.globalAlpha = clamp(alpha);
    ctx.beginPath(); points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.stroke(); ctx.restore();
  }

  // A translucent body, a shaded edge, and one narrow reflection give each stream actual thickness.
  function ribbon(ctx, points, width, colors, alpha, reflected = true) {
    if (points.length < 2 || alpha <= 0) return;
    const left = [], right = [];
    points.forEach((point, index) => {
      const before = points[Math.max(0, index - 1)], after = points[Math.min(points.length - 1, index + 1)];
      const length = Math.max(.01, Math.hypot(after.x - before.x, after.y - before.y));
      const half = width * (.17 + .83 * Math.sin(index / (points.length - 1) * Math.PI) ** .65) / 2;
      const nx = -(after.y - before.y) / length * half, ny = (after.x - before.x) / length * half;
      left.push({ x: point.x + nx, y: point.y + ny }); right.push({ x: point.x - nx, y: point.y - ny });
    });
    const start = points[0], end = points[points.length - 1];
    const fill = ctx.createLinearGradient(start.x, start.y, end.x + .01, end.y + .01);
    fill.addColorStop(0, rgba(colors.dark, alpha * .25)); fill.addColorStop(.4, rgba(colors.mid, alpha * .8)); fill.addColorStop(.88, rgba(colors.light, alpha)); fill.addColorStop(1, rgba(colors.mid, alpha * .5));
    ctx.save(); ctx.fillStyle = fill; ctx.beginPath();
    [...left, ...right.reverse()].forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.closePath(); ctx.fill(); ctx.restore();
    if (reflected) glint(ctx, points, colors.light, Math.max(.8, width * .07), alpha * .5);
  }

  function feather(ctx, x, y, angle, length, breadth, colors, alpha) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    const fill = ctx.createLinearGradient(-length * .3, breadth, length, -breadth);
    fill.addColorStop(0, rgba(colors.dark, alpha * .15)); fill.addColorStop(.3, rgba(colors.mid, alpha * .85)); fill.addColorStop(.78, rgba(colors.light, alpha)); fill.addColorStop(1, rgba(colors.light, alpha * .2));
    ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(-length * .24, 0);
    ctx.bezierCurveTo(length * .12, -breadth * 1.45, length * .6, -breadth, length, -breadth * .22);
    ctx.bezierCurveTo(length * .56, breadth * .36, length * .19, breadth, -length * .24, 0);
    ctx.fill();
    glint(ctx, [{ x: -length * .12, y: 0 }, { x: length * .35, y: -breadth * .12 }, { x: length * .88, y: -breadth * .25 }], colors.light, .7, alpha * .45);
    ctx.restore();
  }

  function petal(ctx, x, y, angle, length, breadth, colors, alpha) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    const fill = ctx.createLinearGradient(0, 0, length, 0);
    fill.addColorStop(0, rgba(colors.dark, alpha * .25)); fill.addColorStop(.52, rgba(colors.mid, alpha)); fill.addColorStop(1, rgba(colors.light, alpha * .6));
    ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.bezierCurveTo(length * .2, -breadth, length * .75, -breadth * .9, length, 0);
    ctx.bezierCurveTo(length * .65, breadth, length * .3, breadth * .6, 0, 0); ctx.fill();
    glint(ctx, [{ x: 3, y: 0 }, { x: length * .4, y: -1 }, { x: length * .9, y: 0 }], colors.light, .65, alpha * .25);
    ctx.restore();
  }

  function blade(ctx, x, y, angle, length, thickness, colors, alpha) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    const fill = ctx.createLinearGradient(0, -thickness, 0, thickness);
    fill.addColorStop(0, rgba(colors.dark, alpha)); fill.addColorStop(.37, rgba(colors.mid, alpha)); fill.addColorStop(.51, rgba(colors.light, alpha)); fill.addColorStop(.61, rgba(colors.mid, alpha * .6)); fill.addColorStop(1, rgba(colors.dark, 0));
    ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(-length * .55, thickness * .2);
    ctx.quadraticCurveTo(0, -thickness * .85, length * .6, -thickness * .26);
    ctx.lineTo(length * .34, thickness * .28); ctx.quadraticCurveTo(-length * .1, thickness, -length * .55, thickness * .2); ctx.fill();
    glint(ctx, [{ x: -length * .51, y: thickness * .12 }, { x: 0, y: -thickness * .26 }, { x: length * .57, y: -thickness * .25 }], colors.light, 1.2, alpha * .8);
    ctx.restore();
  }

  function soul(ctx, x, y, scale, lean, colors, alpha) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(lean); ctx.scale(scale, scale);
    const fill = ctx.createLinearGradient(0, -22, 0, 40);
    fill.addColorStop(0, rgba(colors.light, alpha * .85)); fill.addColorStop(.26, rgba(colors.mid, alpha * .7)); fill.addColorStop(1, rgba(colors.dark, 0));
    ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(0, -16, 5.5, 8, -.12, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-5, -9); ctx.bezierCurveTo(-15, -6, -18, 17, -20, 29);
    ctx.lineTo(-8, 21); ctx.lineTo(-4, 38); ctx.lineTo(3, 25); ctx.lineTo(11, 33); ctx.lineTo(16, 20);
    ctx.bezierCurveTo(10, 8, 11, -5, 5, -9); ctx.closePath(); ctx.fill();
    ctx.fillStyle = rgba(colors.light, alpha * .7); ctx.fillRect(-3, -18, 1.5, 1.5); ctx.fillRect(1.5, -18, 1.5, 1.5);
    ctx.restore();
  }

  function shield(ctx, x, y, width, height, colors, alpha, time) {
    ctx.save(); ctx.translate(x, y);
    const fill = ctx.createLinearGradient(-width / 2, 0, width / 2, 0);
    fill.addColorStop(0, rgba(colors.mid, alpha * .06)); fill.addColorStop(.18, rgba(colors.light, alpha * .5)); fill.addColorStop(.45, rgba(colors.mid, alpha * .13)); fill.addColorStop(.82, rgba(colors.dark, alpha * .12)); fill.addColorStop(1, rgba(colors.light, alpha * .7));
    ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(-width * .37, -height * .47);
    ctx.bezierCurveTo(width * .1, -height * .63, width * .56, -height * .25, width * .5, height * .04);
    ctx.bezierCurveTo(width * .44, height * .34, width * .02, height * .6, -width * .34, height * .45);
    ctx.bezierCurveTo(-width * .16, height * .15, -width * .16, -height * .2, -width * .37, -height * .47); ctx.fill();
    const rim = ctx.createLinearGradient(-width / 2, -height / 2, width / 2, height / 2);
    rim.addColorStop(0, rgba(colors.dark, alpha * .7)); rim.addColorStop(.27, rgba(colors.light, alpha * .9)); rim.addColorStop(.54, rgba(colors.mid, alpha * .44)); rim.addColorStop(.8, rgba(colors.light, alpha * .75)); rim.addColorStop(1, rgba(colors.dark, alpha * .4));
    ctx.strokeStyle = rim; ctx.lineWidth = 5; ctx.stroke();
    ctx.strokeStyle = rgba(colors.light, alpha * .42); ctx.lineWidth = .8; ctx.stroke();
    ctx.save(); ctx.clip();
    // An oblique moving reflection and asymmetric engraving read as a refractive surface, not three schematic bars.
    const sweep = Math.sin(time / 1600) * width * .18;
    const reflection = ctx.createLinearGradient(sweep - 20, 0, sweep + 12, 0);
    reflection.addColorStop(0, rgba(colors.light, 0)); reflection.addColorStop(.7, rgba(colors.light, alpha * .19)); reflection.addColorStop(1, rgba(colors.light, 0));
    ctx.fillStyle = reflection; ctx.beginPath(); ctx.moveTo(sweep - width * .3, -height); ctx.lineTo(sweep + width * .1, -height); ctx.lineTo(sweep + width * .4, height); ctx.lineTo(sweep, height); ctx.fill();
    for (let engraving = 0; engraving < 4; engraving++) {
      const baseY = (engraving - 1.5) * height * .2;
      ctx.strokeStyle = rgba(colors.light, alpha * .24); ctx.lineWidth = .85;
      ctx.beginPath(); ctx.moveTo(-width * .1, baseY + 8); ctx.bezierCurveTo(width * .05, baseY - 11, width * .22, baseY + 15, width * .3, baseY - 7); ctx.stroke();
      petal(ctx, width * .09, baseY + 2, -.75, width * .17, 3, colors, alpha * .15);
    }
    ctx.restore();
    for (let shard = 0; shard < 7; shard++) {
      const phase = (time / 2100 + shard / 7) % 1, angle = shard / 7 * TAU;
      const sx = Math.cos(angle) * width * .57, sy = Math.sin(angle) * height * .55, r = 1.7 + Math.sin(phase * Math.PI) * 1.8;
      ctx.fillStyle = rgba(colors.light, alpha * Math.sin(phase * Math.PI) * .57); ctx.beginPath(); ctx.moveTo(sx, sy - r * 1.8); ctx.lineTo(sx + r * .55, sy); ctx.lineTo(sx, sy + r * 1.8); ctx.lineTo(sx - r * .55, sy); ctx.fill();
    }
    ctx.restore();
  }

  function pool(ctx, x, y, radius, colors, alpha, time) {
    ctx.save(); ctx.translate(x, y); ctx.scale(1, .36);
    const fill = ctx.createRadialGradient(-radius * .22, -radius * .2, 2, 0, 0, radius);
    fill.addColorStop(0, rgba(colors.mid, alpha * .4)); fill.addColorStop(.6, rgba(colors.dark, alpha * .65)); fill.addColorStop(.91, rgba(colors.mid, alpha * .45)); fill.addColorStop(1, rgba(colors.mid, 0));
    ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(0, 0, radius, 0, TAU); ctx.fill();
    for (let ring = 0; ring < 4; ring++) {
      const r = radius * (.35 + ((time / 3000 + ring * .17) % .64));
      ctx.strokeStyle = rgba(colors.light, alpha * (.22 + ring * .05)); ctx.lineWidth = 3 + ring;
      ctx.beginPath(); ctx.arc(0, 0, r, .18 + ring, 2.8 + ring); ctx.stroke();
    }
    ctx.restore();
  }

  function soulSeal(ctx, x, y, radius, colors, alpha, time) {
    ctx.save(); ctx.translate(x, y); ctx.scale(1, .35);
    glow(ctx, 0, 0, radius * 1.15, colors.dark, alpha * .55);
    for (let band = 0; band < 2; band++) {
      const outer = radius * (1 - band * .3), inner = outer - (band ? 3 : 6);
      ctx.fillStyle = rgba(band ? colors.light : colors.mid, alpha * (band ? .34 : .48));
      ctx.beginPath(); ctx.arc(0, 0, outer, 0, TAU); ctx.arc(0, 0, inner, 0, TAU, true); ctx.fill('evenodd');
    }
    for (let rune = 0; rune < 12; rune++) {
      const angle = rune / 12 * TAU + time / 7500;
      ctx.save(); ctx.rotate(angle); ctx.fillStyle = rgba(colors.light, alpha * (.35 + noise(rune) * .28));
      ctx.beginPath(); ctx.moveTo(radius * .7, -3); ctx.lineTo(radius * .78, 0); ctx.lineTo(radius * .7, 5); ctx.lineTo(radius * .65, 0); ctx.fill(); ctx.restore();
    }
    ctx.restore();
  }

  function brushFilter(session, color) {
    if (!session.root) return null;
    session.brushFilters ||= new Map();
    if (session.brushFilters.has(color)) return session.brushFilters.get(color);
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.style.position = 'absolute'; svg.style.pointerEvents = 'none'; svg.setAttribute('aria-hidden', 'true');
    const defs = document.createElementNS(ns, 'defs'), filter = document.createElementNS(ns, 'filter'), matrix = document.createElementNS(ns, 'feColorMatrix');
    const id = `combo-brush-luminance-${color.slice(1)}`, value = parseInt(color.slice(1), 16);
    filter.id = id; filter.setAttribute('color-interpolation-filters', 'sRGB'); filter.setAttribute('x', '0%'); filter.setAttribute('y', '0%'); filter.setAttribute('width', '100%'); filter.setAttribute('height', '100%');
    matrix.setAttribute('type', 'matrix'); matrix.setAttribute('values', `0 0 0 0 ${(value >> 16 & 255) / 255} 0 0 0 0 ${(value >> 8 & 255) / 255} 0 0 0 0 ${(value & 255) / 255} .3333 .3333 .3333 0 0`);
    filter.append(matrix); defs.append(filter); svg.append(defs); session.root.append(svg); session.brushFilters.set(color, id);
    return id;
  }

  function spark(session, x, y, size, angle, color, alpha, textureIndex = 6) {
    const { ctx, vfxTexture } = session;
    if (vfxTexture?.complete && vfxTexture.naturalWidth > 0 && size >= 3) {
      const sw = vfxTexture.naturalWidth / 4, sh = vfxTexture.naturalHeight / 2;
      const filter = brushFilter(session, color);
      ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.globalAlpha = clamp(alpha * .65); ctx.globalCompositeOperation = 'source-over';
      // The atlas is luminance on opaque black. Convert that luminance to alpha in the compositor; no pixel reads or edited image files.
      if (filter) ctx.filter = `url(#${filter})`;
      ctx.drawImage(vfxTexture, textureIndex % 4 * sw, Math.floor(textureIndex / 4) * sh, sw, sh, -size, -size, size * 2, size * 2); ctx.restore();
    } else {
      ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.fillStyle = rgba(color, alpha);
      ctx.beginPath(); ctx.ellipse(0, 0, size * .36, size, 0, 0, TAU); ctx.fill(); ctx.restore();
    }
  }

  function groundPoint(session, target, index) {
    if (target.ground) return target.ground;
    return { x: target.x, y: target.y + (session.targetNodes?.[index]?.figureHost?.clientHeight || 160) * .42 };
  }

  function charge(session, time, colors) {
    if (time >= 3500) return;
    const { ctx, geometry } = session, alpha = ease(time / 650) * (1 - clamp((time - 2900) / 600));
    const gather = ease((time - 850) / 1150), tension = ease((time - 2300) / 620);
    geometry.sources.forEach((source, index) => {
      const points = samplePath(source, geometry.fusion, ease(time / 1050), 14);
      ribbon(ctx, points, 5.5 + gather * 6 + tension * 2, colors, alpha * .76);
      // Two braided material layers share the same real weapon origin and convergence.
      for (const side of [-1, 1]) {
        const branch = samplePath(source, geometry.fusion, ease(time / 1050), 14 + side * (10 + gather * 10));
        ribbon(ctx, branch, 2.8 + gather * 2.6, { ...colors, mid: side < 0 ? session.motion === 'spring' ? '#63c4d1' : colors.accent : colors.mid }, alpha * gather * .42);
      }
      glow(ctx, source.x, source.y, 19 + gather * 8, colors.mid, alpha * .38);
      glow(ctx, source.x, source.y, 6 + tension * 2, colors.light, alpha * .64);
      for (let mote = 0; mote < 12; mote++) {
        const phase = ((time / (1550 - tension * 360) + mote / 12) % 1) * ease(time / 1050), point = route(source, geometry.fusion, phase, 14);
        const scatter = Math.sin(phase * Math.PI) * Math.sin(time / 480 + mote * 1.7 + index) * (5 + gather * 4);
        const direction = Math.atan2(geometry.fusion.y - source.y, geometry.fusion.x - source.x);
        if (mote % 3 === 0 && gather > 0) {
          const segment = samplePath(source, geometry.fusion, phase, 14, Math.max(0, phase - .13));
          ribbon(ctx, segment, 6 + gather * 5, colors, alpha * gather * .54);
        }
        spark(session, point.x, point.y + scatter, 1.8 + noise(mote) * 2.4, direction, colors.light, alpha * .65, session.motion === 'spring' ? 5 : session.motion === 'phoenix' ? 0 : session.motion === 'legion' ? 7 : 6);
      }
    });
  }

  function artMatte(session) {
    if (session.artMatteId) return session.artMatteId;
    const ns = 'http://www.w3.org/2000/svg', make = (name, attrs) => { const element = document.createElementNS(ns, name); Object.entries(attrs || {}).forEach(([key, value]) => element.setAttribute(key, value)); return element; };
    const svg = make('svg', { width: '0', height: '0', 'aria-hidden': 'true' }), defs = make('defs');
    svg.style.cssText = 'position:absolute;pointer-events:none;overflow:hidden';
    const filter = make('filter', { id: 'combo-art-matte-v7', x: '0%', y: '0%', width: '100%', height: '100%', 'color-interpolation-filters': 'sRGB' });
    // Runtime material only: derive coverage from the black-backed emission,
    // then intersect with original alpha. No image pixels are read or rewritten.
    filter.append(make('feColorMatrix', { in: 'SourceGraphic', type: 'matrix', values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2.4 2.4 2.4 0 -0.025', result: 'emissionAlpha' }));
    filter.append(make('feComposite', { in: 'SourceGraphic', in2: 'emissionAlpha', operator: 'in' }));
    defs.append(filter); svg.append(defs); session.root.append(svg);
    session.artMatteId = filter.id; return filter.id;
  }

  function artCell(session, frame) {
    const combat=frame===1&&session.rig?.combat;
    const rig=combat||session.rig,rigImage=combat?session.combatImage:session.rigImage;
    const sourceFrame=combat?0:frame;
    if (!rigImage?.complete || !rigImage.naturalWidth || !rig?.src) return null;
    session.rigCells ||= [];
    if (session.rigCells[frame]) return session.rigCells[frame];
    const cols = rig.columns || 3, rows = rig.rows || 2, sw = rigImage.naturalWidth / cols, sh = rigImage.naturalHeight / rows;
    const cell = document.createElement('canvas'); cell.width = Math.min(512,Math.round(sw)); cell.height = Math.min(512,Math.round(sh));
    cell.dataset.rigSource = rig.src; cell.dataset.rigFrame = String(sourceFrame);
    const material = cell.getContext('2d');
    if (rig.matte === 'luminance') material.filter = `url(#${artMatte(session)})`;
    material.drawImage(rigImage, sourceFrame % cols * sw, Math.floor(sourceFrame / cols) * sh, sw, sh, 0, 0, cell.width, cell.height);
    material.filter = 'none';
    const darkCore = rig.darkCores?.[frame];
    if (darkCore) {
      // The eclipse's painted black moon is intentional, unlike its square
      // backdrop. Restore only its soft interior from the unmodified original.
      const core = document.createElement('canvas'); core.width = cell.width; core.height = cell.height;
      const coreCtx = core.getContext('2d'), [u, v, r] = darkCore, x = u * core.width, y = v * core.height, radius = r * core.width;
      coreCtx.drawImage(rigImage, frame % cols * sw, Math.floor(frame / cols) * sh, sw, sh, 0, 0, core.width, core.height);
      coreCtx.globalCompositeOperation = 'destination-in';
      const mask = coreCtx.createRadialGradient(x, y, radius * .965, x, y, radius);
      mask.addColorStop(0, '#000'); mask.addColorStop(1, '#0000');
      coreCtx.fillStyle = mask; coreCtx.fillRect(0, 0, core.width, core.height);
      material.drawImage(core, 0, 0); cell.dataset.rigDarkCore = JSON.stringify(darkCore);
    }
    // A tiny cell-edge feather prevents an atlas neighbour or hard square edge
    // appearing when the mesh bends. Detailed material inside remains unchanged.
    material.globalCompositeOperation = 'destination-in';
    for (const horizontal of [true, false]) {
      const edge = material.createLinearGradient(0, 0, horizontal ? cell.width : 0, horizontal ? 0 : cell.height);
      edge.addColorStop(0, '#0000'); edge.addColorStop(.018, '#000'); edge.addColorStop(.982, '#000'); edge.addColorStop(1, '#0000');
      material.fillStyle = edge; material.fillRect(0, 0, cell.width, cell.height);
    }
    material.globalCompositeOperation = 'source-over';
    session.rigCells[frame] = cell; return cell;
  }

  function artPiece(session, time, frame, phase, box, alpha = 1, assembly = 1, segments, action = 0) {
    const material = artCell(session, frame);
    if (!material || !window.ComboArtRig?.draw || alpha <= .001) return false;
    const count = segments || (phase === 'manifest' ? (session.geometry.width < 701 ? 10 : 12) : 8);
    const result = window.ComboArtRig.draw(session.ctx, material, { x: 0, y: 0, width: material.width, height: material.height },
      { ...(phase==='manifest'?session.choreography?.caster?.rigOptions:{}), ...box, time, motion: session.motion, phase, alpha, assembly, action, segments: count });
    session.canvas.dataset.artRig = 'mesh-v7'; session.canvas.dataset.rigSource = material.dataset.rigSource;
    session.root.dataset.rigReady = 'true';
    return Boolean(result);
  }

  function manifestation(session, time, colors) {
    if (time < 380 || time >= 7500) return;
    const { fusion, manifestRadius: radius } = session.geometry;
    const performance = session.choreography?.caster;
    const chargeAlpha = ease((time - 380) / 650) * (1 - clamp((time - 1450) / 380));
    const chargeSize = radius * 1.36;
    artPiece(session, time, 0, 'charge', { x:fusion.x-chargeSize/2,y:fusion.y-chargeSize/2,width:chargeSize,height:chargeSize }, chargeAlpha*.85);
    if (!performance || time < 1250) return;
    const { box,alpha,assembly,action,anchors } = performance;
    glow(session.ctx, fusion.x, fusion.y, radius*.64, colors.mid, alpha*.12);
    // The same detailed entity stays here through attack and recovery.
    artPiece(session,time,1,'manifest',box,alpha,assembly,undefined,action);
    for (let mote=0;mote<12;mote++) {
      const p=(time/2100+mote/12)%1,angle=mote*2.399+time/2600,distance=radius*(1.05-p*.65);
      spark(session,fusion.x+Math.cos(angle)*distance,fusion.y+Math.sin(angle)*distance*.84,
        2+noise(mote)*2,angle,colors.light,Math.sin(p*Math.PI)*alpha*.48,session.motion==='spring'?5:6);
    }
    if (time<2600) return;
    const power=ease((time-2600)/600)*(1-ease((time-5650)/650)), ctx=session.ctx;
    if (session.motion==='phoenix') {
      for(const key of ['leftWing','rightWing']){
        const wing=anchors[key];
        glow(ctx,wing.x,wing.y,29,colors.mid,power*.38);
        for(let i=0;i<6;i++){
          const rise=(time/1000+i/6)%1;
          feather(ctx,wing.x+(key==='leftWing'?-1:1)*rise*25,wing.y-rise*55,
            -Math.PI/2,9+rise*12,3,colors,power*(1-rise)*.65);
        }
      }
    } else {
      const source=anchors.mouth||anchors.core;
      const radius=session.motion==='tide'?16:session.motion==='bastion'?23:18;
      glow(ctx,source.x,source.y,radius*2.2,colors.mid,power*.38);
      glow(ctx,source.x,source.y,radius*.7,colors.light,power*.68);
      // Orbital front/back highlights give the emission aperture depth.
      for(let ring=0;ring<3;ring++){
        ctx.save();ctx.translate(source.x,source.y);ctx.rotate(-.4+ring*.22);
        ctx.strokeStyle=rgba(colors.light,power*(.28+ring*.08));ctx.lineWidth=1.1+ring*.4;
        ctx.beginPath();ctx.ellipse(0,0,radius*(.65+ring*.3),radius*(.26+ring*.1),0,time/600+ring,time/600+ring+Math.PI*1.4);ctx.stroke();ctx.restore();
      }
    }
  }

  function attackPath(attack, progress=attack.progress, first=0, count=32) {
    return Array.from({length:count+1},(_,i)=>window.ComboChoreography.point(attack,first+(progress-first)*i/count));
  }

  function attackCell(session,frame) {
    if(session.attackCells[frame])return session.attackCells[frame];
    const image=session.attackImage;if(!image?.complete||!image.naturalWidth)return null;
    const cell=document.createElement('canvas'),size=image.naturalWidth/3;cell.width=size;cell.height=image.naturalHeight/2;
    cell.dataset.attackMaterial=String(frame);
    const ctx=cell.getContext('2d');ctx.drawImage(image,frame%3*size,Math.floor(frame/3)*cell.height,size,cell.height,0,0,size,cell.height);
    // The generated materials have emission haze. A soft runtime footprint and
    // screen compositing preserve their color without rectangular image plates.
    ctx.globalCompositeOperation='destination-in';
    const mask=ctx.createRadialGradient(size*.5,cell.height*.5,size*.2,size*.5,cell.height*.5,size*.53);
    mask.addColorStop(0,'#fff');mask.addColorStop(.65,'#ffff');mask.addColorStop(1,'#fff0');
    ctx.fillStyle=mask;ctx.fillRect(0,0,size,cell.height);session.attackCells[frame]=cell;return cell;
  }

  function materialTip(session,frame,head,angle,width,height,alpha,time) {
    const cell=attackCell(session,frame);if(!cell||alpha<=0)return;
    const ctx=session.ctx;ctx.save();ctx.translate(head.x,head.y);ctx.rotate(angle);ctx.globalCompositeOperation='screen';ctx.globalAlpha=clamp(alpha);
    // The hot point is at the leading edge; tails remain behind the hit front.
    ctx.drawImage(cell,0,0,cell.width,cell.height,-width*.965,-height/2,width,height*(1+Math.sin(time/110)*.055));ctx.restore();
  }

  function texturedBreath(session,attack,alpha,time) {
    const cell=attackCell(session,1);if(!cell||alpha<=0)return;
    const ctx=session.ctx,count=28,depth=session.geometry.width<701?56:76;
    ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=clamp(alpha*.88);
    // Actual curved, locally rippling strip mesh. The nozzle never detaches
    // from the animated mouth; no creature texture is used for the beam.
    for(let i=0;i<count;i++){
      const a=window.ComboChoreography.point(attack,attack.progress*i/count),b=window.ComboChoreography.point(attack,attack.progress*(i+1)/count);
      const length=Math.hypot(b.x-a.x,b.y-a.y);if(length<.05)continue;
      const thickness=depth*(.88+.12*Math.sin(time/105-i*.65));
      ctx.save();ctx.translate(a.x,a.y);ctx.rotate(Math.atan2(b.y-a.y,b.x-a.x));
      ctx.drawImage(cell,i/count*cell.width,0,cell.width/count,cell.height,0,-thickness/2,length+.75,thickness);ctx.restore();
    }
    ctx.restore();
  }

  // A perspective cone with separate shaded skin, refractive core and helices.
  // Its tip is always the same computed attack.head used by the target marker.
  function volumeStream(ctx,points,width,colors,alpha,time) {
    if(points.length<2||alpha<=0)return;
    const left=[],right=[];
    for(let i=0;i<points.length;i++){
      const p=points[i],a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];
      const length=Math.max(.01,Math.hypot(b.x-a.x,b.y-a.y)),q=i/(points.length-1);
      const radius=width*(.10+.90*q)*(.9+.1*Math.sin(q*19-time/105));
      left.push({x:p.x-(b.y-a.y)/length*radius,y:p.y+(b.x-a.x)/length*radius});
      right.push({x:p.x+(b.y-a.y)/length*radius,y:p.y-(b.x-a.x)/length*radius});
    }
    const first=points[0],last=points.at(-1),fill=ctx.createLinearGradient(first.x,first.y,last.x+.01,last.y+.01);
    fill.addColorStop(0,rgba(colors.light,alpha*.65));fill.addColorStop(.35,rgba(colors.mid,alpha*.7));fill.addColorStop(.8,rgba(colors.mid,alpha*.28));fill.addColorStop(1,rgba(colors.light,alpha*.10));
    ctx.save();ctx.fillStyle=fill;ctx.beginPath();[...left,...right.slice().reverse()].forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();ctx.restore();
    for(const side of [-1,1]){
      const strand=points.map((p,i)=>{
        const q=i/(points.length-1),a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],d=Math.max(.01,Math.hypot(b.x-a.x,b.y-a.y));
        const offset=Math.sin(q*15-time/125+side*Math.PI/2)*width*q*.52;
        return {x:p.x-(b.y-a.y)/d*offset,y:p.y+(b.x-a.x)/d*offset};
      });
      ribbon(ctx,strand,width*.28,colors,alpha*.68);
    }
    glint(ctx,points,colors.light,2.2,alpha*.7);
    glint(ctx,left,colors.light,1.2,alpha*.35);
  }

  function fallingFire(session,attack,time,colors) {
    const {ctx}=session;
    const guidePower=ease((time-2700)/300)*(1-ease((time-4200)/450));
    // Visible wing-to-sky energy causality precedes the falling salvo.
    if(attack.guideStart&&guidePower>0){
      const guide={start:attack.guideStart,end:attack.start,control:{x:(attack.start.x+attack.guideStart.x)/2,y:Math.min(attack.start.y,attack.guideStart.y)-38}};
      const points=attackPath(guide,ease((time-2700)/500));
      ribbon(ctx,points,7,colors,guidePower*.56);
      glint(ctx,points,colors.light,1,guidePower*.6);
    }
    const skyPower=ease((time-3200)/400)*(1-ease((time-5350)/650));
    glow(ctx,attack.start.x,attack.start.y,62,colors.mid,skyPower*.30,.3);
    for(let cloud=0;cloud<7;cloud++){
      const angle=cloud*.9+time/700;
      spark(session,attack.start.x+Math.cos(angle)*40,attack.start.y+Math.sin(angle)*8,8+cloud%3*3,angle,colors.mid,skyPower*.38,0);
    }
    // The first front lands precisely at strike. Follow-up burning fragments
    // are part of this one resolved hit, never extra hidden gameplay damage.
    for(let wave=0;wave<4;wave++){
      const launch=attack.launch+wave*260,duration=attack.strike-attack.launch;
      if(time<launch||time>attack.strike+wave*260+120)continue;
      const p=clamp((time-launch)/duration)**1.65;
      const offset=wave===0?0:(wave%2?1:-1)*(10+wave*4);
      const falling={...attack,start:{x:attack.start.x+offset,y:attack.start.y-wave*4},end:{x:attack.end.x+offset*.35,y:attack.end.y}};
      const head=window.ComboChoreography.point(falling,p),tail=attackPath(falling,p,Math.max(0,p-.34));
      const alpha=(1-ease((time-attack.strike-wave*260)/120))*(wave===0?1:.65);
      ribbon(ctx,tail,wave===0?24:15,colors,alpha*.8);
      glint(ctx,tail,colors.light,2.8,alpha*.92);
      const direction=Math.atan2(attack.end.y-attack.start.y,attack.end.x-attack.start.x);
      for(let ember=0;ember<8;ember++){
        const q=Math.max(0,p-ember*.02),point=window.ComboChoreography.point(falling,q);
        feather(ctx,point.x+Math.sin(time/80+ember)*4,point.y,direction,14+noise(ember)*16,3.5,colors,alpha*(1-ember/11)*.3);
      }
      glow(ctx,head.x,head.y,17,colors.mid,alpha*.48);
      spark(session,head.x,head.y,12,direction,colors.light,alpha*.85,0);
      materialTip(session,0,head,direction,85+wave*5,48,alpha,time+wave*90);
    }
  }

  function launch(session,target,time,colors) {
    if(time<2700||time>target.strike+1050)return;
    const {ctx}=session,attack=target,age=time-target.strike;
    if(attack.kind==='sky-fire'){fallingFire(session,attack,time,colors);return;}
    if(time<3200)return;
    const alpha=ease((time-3200)/200)*(1-ease((age-380)/650)),path=attackPath(attack),head=attack.head;
    const near=path[Math.max(0,path.length-2)],direction=Math.atan2(head.y-near.y,head.x-near.x);
    if(attack.kind==='dragon-breath'){
      for(let i=0;i<12;i++){
        const point=window.ComboChoreography.point(attack,attack.progress*i/11);
        glow(ctx,point.x,point.y,12+i*1.8,colors.mid,alpha*.17);
      }
      volumeStream(ctx,path,30,colors,alpha,time);
      texturedBreath(session,attack,alpha,time);
      for(let i=0;i<38;i++){
        const q=((time-3200)/510+i/38)%1*attack.progress,point=window.ComboChoreography.point(attack,q);
        const spin=time/140+i*2.4,spread=5+q*19;
        spark(session,point.x+Math.cos(spin)*spread*.38,point.y+Math.sin(spin)*spread,6+noise(i)*8,direction,colors.light,alpha*(.4+.4*q),2);
      }
      const bolt=path.filter((_,i)=>i%2===0).map((p,i,all)=>({x:p.x,y:p.y+(i&&i<all.length-1?Math.sin(time/75+i*5)*8:0)}));
      glint(ctx,bolt,colors.accent,2,alpha*.9);
      glow(ctx,head.x,head.y,32,colors.mid,alpha*.30);
    } else if(attack.kind==='solar-lance'){
      ribbon(ctx,path,16,colors,alpha*.42);
      glint(ctx,path,colors.light,2.5,alpha*.9);
      for(let ray=0;ray<3;ray++){
        const p=clamp((time-3200-ray*120)/(attack.strike-3200)),tip=window.ComboChoreography.point(attack,p);
        blade(ctx,tip.x,tip.y,direction,58,6,colors,alpha*(1-ray*.16));
        materialTip(session,2,tip,direction,90,44,alpha*(1-ray*.18),time+ray*100);
        spark(session,tip.x,tip.y,7,direction,colors.light,alpha*.8,6);
      }
    } else if(attack.kind==='crescent-cut'){
      for(const side of [-1,1]){
        const slash=side<0?{...attack,start:attack.secondaryStart,control:{x:attack.control.x,y:attack.control.y+72}}:attack;
        const trail=attackPath(slash),tip=window.ComboChoreography.point(slash,attack.progress);
        ribbon(ctx,trail,10,colors,alpha*.55);
        glint(ctx,trail,colors.light,1.5,alpha*.76);
        ctx.save();ctx.translate(tip.x,tip.y);ctx.rotate(direction+side*.45);
        ctx.strokeStyle=rgba(colors.mid,alpha*.66);ctx.lineWidth=12;
        ctx.beginPath();ctx.ellipse(-18,0,28,48,0,-1.25,1.25);ctx.stroke();
        ctx.strokeStyle=rgba(colors.light,alpha*.9);ctx.lineWidth=2;ctx.stroke();ctx.restore();
        materialTip(session,4,tip,direction+side*.45,82,96,alpha*.8,time);
      }
    } else if(attack.kind==='soul-volley'){
      ribbon(ctx,path,12,colors,alpha*.25);glint(ctx,path,colors.light,1.2,alpha*.55);
      for(let rank=0;rank<5;rank++){
        const p=clamp((time-3200-rank*105)/(attack.strike-3200));
        const point=window.ComboChoreography.point(attack,p),spread=Math.sin(p*Math.PI)*(rank%3-1)*15;
        blade(ctx,point.x,point.y+spread,direction,32+rank*3,4,colors,alpha*.85);
        materialTip(session,5,{x:point.x,y:point.y+spread},direction,64,37,alpha*.85,time+rank*50);
        const tail=attackPath(attack,p,Math.max(0,p-.14));
        ribbon(ctx,tail,5,colors,alpha*.65);
        spark(session,point.x,point.y+spread,5,direction,colors.light,alpha*.7,7);
      }
    } else {
      // Ward, lotus and summoned reinforcements go only to their beneficiary.
      const width=attack.kind==='petal-stream'?13:8;
      ribbon(ctx,path,width,colors,alpha*.55);
      glint(ctx,path,colors.light,1.3,alpha*.7);
      for(let i=0;i<14;i++){
        const q=((time-3200)/1100+i/14)%1*attack.progress,point=window.ComboChoreography.point(attack,q);
        if(attack.kind==='petal-stream')petal(ctx,point.x,point.y+Math.sin(time/220+i)*4,-.6+time/900+i,9+noise(i)*8,4,colors,alpha*.8);
        else spark(session,point.x,point.y,3+noise(i)*3,direction,colors.light,alpha*.75,attack.kind==='soul-gift'?7:6);
      }
      glow(ctx,head.x,head.y,19,colors.mid,alpha*.24);
      if(attack.kind==='petal-stream')materialTip(session,3,head,direction,72,50,alpha*.7,time);
    }
  }

  function fracture(ctx, x, y, radius, colors, alpha, time) {
    glow(ctx, x, y, radius * 1.15, colors.accent, alpha * .18, .34);
    for (let index = 0; index < 9; index++) {
      const angle = index / 9 * TAU, points = [];
      for (let part = 0; part <= 5; part++) { const r = part / 5 * radius, jitter = part && part < 5 ? (noise(index * 11 + part) - .5) * 16 : 0; points.push({ x: x + Math.cos(angle) * r + Math.sin(angle) * jitter, y: y + Math.sin(angle) * r * .38 + Math.cos(angle) * jitter * .3 }); }
      ribbon(ctx, points, 7 + noise(index) * 5, { ...colors, mid: colors.accent }, alpha * (.72 + Math.sin(time / 510 + index) * .12));
    }
  }

  function impact(session, target, index, time, colors) {
    if (time < target.strike || time >= 8400) return;
    const { ctx, motion } = session, ground = groundPoint(session, target, index);
    const body = target.bounds ? { x: target.bounds.x + target.bounds.width / 2, y: target.bounds.y + target.bounds.height * .52 } : { x: target.x, y: target.role === 'heal' || target.role === 'summon' ? ground.y - 70 : target.y };
    const age = time - target.strike, hit = 1 - clamp(age / 1450), linger = 1 - clamp((time - 7550) / 850);
    const radius = session.live ? Math.max(16,Math.min(95,target.bounds?.height*.48||40,target.bounds?.width*.85||40))
      : Math.min(112, Math.max(78, (session.targetNodes?.[index]?.figureHost?.clientWidth || 140) * .72));
    if (target.role === 'shield') {
      shield(ctx, target.x + 7, target.y, radius * .91, radius * 1.6, colors, ease(age / 470) * linger * (.73 + Math.sin(time / 630) * .055), time);
      glow(ctx, ground.x, ground.y, radius * .87, colors.mid, linger * .2, .28);
      return;
    }
    if (target.role === 'heal') {
      const grow = ease(age / 650), y = ground.y - 2;
      glow(ctx, body.x, body.y + 15, radius, colors.mid, grow * linger * .15, .85);
      ctx.save(); ctx.translate(ground.x, y); ctx.scale(1, .46);
      for (let layer = 0; layer < 2; layer++) for (let leaf = 0; leaf < 9; leaf++) petal(ctx, 0, 0, leaf / 9 * TAU + layer * .3 + Math.sin(time / 1700) * .025, radius * (layer ? .72 : 1) * grow, radius * .25, colors, linger * (layer ? .57 : .42));
      ctx.restore();
      for (let stream = 0; stream < 3; stream++) {
        const points = [];
        for (let part = 0; part <= 24; part++) { const p = part / 24; points.push({ x: target.x + (stream - 1) * 22 + Math.sin(time / 760 + p * 6 + stream) * 9 * Math.sin(p * Math.PI), y: ground.y - p * radius * 1.4 }); }
        ribbon(ctx, points, 5 + stream, colors, linger * grow * .44);
      }
      for (let leaf = 0; leaf < 12; leaf++) { const rise = ((time / 2700 + leaf / 12) % 1); petal(ctx, target.x + Math.sin(leaf * 2.3 + time / 1900) * radius * .56, ground.y - rise * radius * 1.6, -1 + Math.sin(time / 900 + leaf) * .5, 10, 4, colors, Math.sin(rise * Math.PI) * linger * .6); }
      return;
    }
    if (target.role === 'summon') {
      const appear = ease(age / 750);
      soulSeal(ctx, ground.x, ground.y, radius * .9, colors, appear * linger, time);
      glow(ctx, body.x, body.y + 15, radius * .72, colors.mid, appear * linger * .15, 1.1);
      for (let ghost = 0; ghost < 3; ghost++) soul(ctx, target.x + (ghost - 1) * 22, ground.y - appear * radius * (.38 + ghost * .15) + Math.sin(time / 780 + ghost) * 4, .7, (ghost - 1) * .13, colors, linger * .36 * (1 - appear * .45));
      return;
    }
    if (motion === 'phoenix') {
      glow(ctx, target.x, target.y, radius * .72, colors.mid, hit * .28);
      for (let featherIndex = 0; featherIndex < 26; featherIndex++) {
        const angle = featherIndex / 26 * TAU + time / 5000, burst = ease(age / 1000), orbit = radius * (.34 + noise(featherIndex) * .53) * (.4 + burst * .6);
        const x = target.x + Math.cos(angle) * orbit, y = target.y + Math.sin(angle) * orbit * .75 - Math.sin(time / 610 + featherIndex) * 7;
        feather(ctx, x, y, angle + Math.sin(time / 700 + featherIndex) * .2, 18 + noise(featherIndex + 40) * 23, 4 + noise(featherIndex + 50) * 6, colors, linger * (.34 + hit * .25));
      }
      glow(ctx, ground.x, ground.y, radius, colors.mid, linger * .17, .3);
    } else if (motion === 'tide') {
      pool(ctx, ground.x, ground.y, radius * 1.03, colors, linger * .85, time);
      for (let drop = 0; drop < 20; drop++) { const angle = drop / 20 * TAU, spread = (.3 + ease(age / 900) * .7) * radius; spark(session, target.x + Math.cos(angle) * spread, target.y + Math.sin(angle) * spread * .65 + Math.sin(time / 700 + drop) * 5, 3 + noise(drop) * 3, angle, colors.light, linger * (.2 + hit * .45), 2); }
      if (Math.sin(time / 150) > -.2) {
        const points = []; for (let part = 0; part <= 8; part++) points.push({ x: target.x + (part / 8 - .5) * radius * 1.25, y: target.y + Math.sin(part * 3.4 + time / 120) * 9 });
        glint(ctx, points, colors.light, 1.4, linger * .25);
      }
      glow(ctx, target.x, target.y, radius * .5, colors.mid, hit * .23);
    } else if (motion === 'bastion') {
      fracture(ctx, ground.x, ground.y, radius * 1.08, colors, linger * .93, time);
      glow(ctx, target.x, target.y, radius * .55, colors.accent, hit * .22);
      for (let ember = 0; ember < 14; ember++) { const rise = (time / 1900 + ember / 14) % 1; spark(session, ground.x + (noise(ember) - .5) * radius * 1.55, ground.y - rise * radius * .95, 2 + noise(ember + 10) * 3, .4, colors.accent, Math.sin(rise * Math.PI) * linger * .7, 0); }
    } else if (motion === 'eclipse') {
      if (hit > 0) for (const side of [-1, 1]) blade(ctx, target.x, target.y, side * (.64 + ease(age / 650) * .09), radius * 1.95, 22, colors, hit * .88);
      glow(ctx, target.x, target.y, radius * .83, colors.mid, linger * .16);
      for (let shard = 0; shard < 20; shard++) { const angle = shard / 20 * TAU + time / 8400, r = radius * (.54 + noise(shard) * .3); blade(ctx, target.x + Math.cos(angle) * r, target.y + Math.sin(angle) * r * .7, angle + .5, 13 + noise(shard + 30) * 23, 7, colors, linger * .44); }
      for (const side of [-1, 1]) { const points = []; for (let part = 0; part <= 24; part++) { const angle = part / 24 * Math.PI * 1.2 + time / 4200 + (side === 1 ? Math.PI : 0); points.push({ x: target.x + Math.cos(angle) * radius * .87, y: target.y + Math.sin(angle) * radius * .7 }); } ribbon(ctx, points, 9, colors, linger * .45); }
    } else if (motion === 'legion') {
      soulSeal(ctx, ground.x, ground.y, radius, colors, linger * .75, time);
      glow(ctx, target.x, target.y, radius * .66, colors.mid, linger * .17, 1.1);
      for (let ghost = 0; ghost < 5; ghost++) { const angle = ghost / 5 * TAU + time / 5300; soul(ctx, target.x + Math.cos(angle) * radius * .62, target.y + Math.sin(angle) * radius * .45, .95 + noise(ghost) * .28, Math.sin(time / 1200 + ghost) * .2, colors, linger * .41); }
    }
  }

  function excludeHud(session, width, height) {
    const { ctx, canvas, root } = session, rect = canvas.getBoundingClientRect();
    ctx.beginPath(); ctx.rect(0, 0, width, height);
    if (root) for (const element of root.querySelectorAll('.combo-target-hp,.combo-target-shield,.combo-target-name,.combo-target-tag,.combo-target-feedback,.combo-target-status,.combo-participant-name')) {
      if (!element.getClientRects().length || getComputedStyle(element).opacity === '0') continue;
      const box = element.getBoundingClientRect();
      ctx.rect(box.left - rect.left - 2, box.top - rect.top - 1, box.width + 4, box.height + 2);
    }
    ctx.clip('evenodd');
  }

  function draw(session, time) {
    if (!session?.ctx || !session.geometry) return false;
    const { ctx, canvas, geometry } = session, { width, height } = geometry;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) { canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
    canvas.dataset.materialRenderer = 'art-rig-v7';
    if (session.reduced || time >= 8400) return true;
    const colors = MATERIALS[session.motion] || MATERIALS.phoenix;
    ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    excludeHud(session, width, height);
    charge(session, time, colors); manifestation(session, time, colors);
    geometry.targets.forEach((target, index) => { launch(session, target, time, colors); impact(session, target, index, time, colors); });
    ctx.restore(); return true;
  }

  window.ComboStageVFX = Object.freeze({ draw, samplePath });
}());
