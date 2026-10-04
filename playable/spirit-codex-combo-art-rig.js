/* Animate the original painted artwork by deforming its texture mesh; never redraw the subject. */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = value => Math.max(0, Math.min(1, value));
  const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
  const smooth = value => { const p = clamp(value); return p * p * (3 - 2 * p); };
  const band = (value, start, end) => smooth((value - start) / (end - start));
  const bell = (value, center, radius) => Math.exp(-(((value - center) / radius) ** 2));
  const rotated = (u, v, x, y, angle) => {
    const dx = u - x, dy = v - y, c = Math.cos(angle), s = Math.sin(angle);
    return { x: dx * c - dy * s - dx, y: dx * s + dy * c - dy };
  };

  function phaseStrength(phase, time) {
    if (phase === 'charge') return .55 + smooth(time / 1400) * .45;
    if (phase === 'settle') return 1 - smooth((time - 7600) / 800) * .65;
    return 1;
  }

  function phoenix(u, v, t, assembly, phase) {
    if (phase === 'release') {
      // The flying cell faces right: keep its head fixed and articulate the trailing wing/tail.
      const wing = band(.68 - u, .025, .34) * (1 - band(v, .47, .71));
      const flap = Math.sin(t * 4.25 - (.63 - u) * 2.6);
      const turn = rotated(u, v, .63, .48, .09 * flap);
      const tail = (1 - band(u, .43, .78)) * band(v, .4, .75);
      return {
        x: turn.x * wing + Math.sin(t * 3.1 + u * 8) * .019 * tail - wing * (1 - assembly) * .025,
        y: turn.y * wing + Math.sin(t * 3.5 + u * 10) * .032 * tail - wing * (1 - assembly) * .018,
      };
    }
    const side = u < .5 ? -1 : 1, distance = Math.abs(u - .5);
    const wing = band(distance, .07, .23) * (1 - band(v, .53, .76)) * band(v, .015, .09);
    const lag = distance * 2.9 + side * .17, flap = Math.sin(t * 4.25 - lag);
    const turn = rotated(u, v, .5, .44, side * (.105 * flap + .028 * Math.sin(t * 2.1)));
    let x = turn.x * wing, y = turn.y * wing;
    // Outer feathers lag behind the shoulder. The chest and wing roots remain much steadier.
    x += side * Math.sin(t * 4.25 - lag - .6) * .014 * wing * band(distance, .2, .42);
    y += Math.sin(t * 4.25 - lag - .9) * .014 * wing * band(distance, .13, .4);
    const tail = band(v, .53, .91) * bell(u, .5, .3);
    x += Math.sin(t * 3.5 - (v - .53) * 9 + (u - .5) * 4) * .031 * tail;
    y += Math.sin(t * 2.8 - (v - .53) * 7) * .012 * tail;
    const neck = bell(u, .5, .095) * (1 - band(v, .27, .48));
    x += Math.sin(t * 2.05 + .5) * .008 * neck;
    y += Math.sin(t * 2.05) * .004 * neck;
    x += side * wing * (1 - assembly) * .04;
    y -= wing * (1 - assembly) * distance * .04;
    return { x, y };
  }

  function phoenixSide(u, v, t, assembly) {
    // This combat painting has a large near wing behind the chest and a smaller,
    // higher far wing. They are not the symmetric wings of the codex-facing cell.
    const near = bell(u, .34, .29) * (1 - band(v, .43, .62));
    const far = bell(u, .56, .12) * (1 - band(v, .28, .46));
    const nearTurn = rotated(u, v, .62, .47, Math.sin(t * 4.1 - (.62 - u) * 2) * .086);
    const farTurn = rotated(u, v, .64, .44, Math.sin(t * 4.1 - .62) * .06);
    const total = Math.max(1, near + far);
    let x = (nearTurn.x * near + farTurn.x * far) / total;
    let y = (nearTurn.y * near + farTurn.y * far) / total;
    const outer = band(.62 - u, .12, .42) * near;
    y += Math.sin(t * 4.1 - (.62 - u) * 4.2 - .9) * .012 * outer;
    const tail = band(v, .56, .9) * (1 - band(u, .52, .78));
    x += Math.sin(t * 3.05 - v * 8.7 + u * 3) * .027 * tail;
    y += Math.sin(t * 2.7 - v * 7.5) * .012 * tail;
    const neck = bell(u, .76, .16) * bell(v, .40, .13);
    x += Math.sin(t * 2.05) * .006 * neck;
    y += Math.sin(t * 2.05 + .5) * .004 * neck;
    y -= (1 - assembly) * .022 * near;
    return { x, y };
  }

  function tide(u, v, t, assembly, phase) {
    // The manifest dragon's head is in the upper-right; the launch cell faces right.
    const horizontal = phase === 'release', hx = horizontal ? .79 : .74, hy = horizontal ? .45 : .24;
    const head = bell(u, hx, .21) * bell(v, hy, horizontal ? .21 : .18);
    const spine = bell(u, .5 + Math.sin(v * 7.1) * .12, .31);
    const tail = band(v, .45, .92);
    const turn = rotated(u, v, hx - .08, hy + .10, Math.sin(t * 2.35 + .3) * .082);
    let x = Math.sin(t * 3.15 - v * 8.4) * (.016 + tail * .017) * spine * (1 - head * .76);
    let y = Math.sin(t * 3.15 - v * 8.4 + 1.1) * .013 * spine * (1 - head * .76);
    x += turn.x * head + Math.sin(t * 2.35 + .3) * .009 * head;
    y += turn.y * head + Math.sin(t * 2.35 - .8) * .006 * head;
    const water = band(Math.abs(u - .5), .15, .41) * band(v, .15, .47);
    x += Math.sin(t * 3.7 - v * 10 + u * 3) * .012 * water;
    y += Math.sin(t * 3.1 + u * 10) * .016 * water;
    if (horizontal) {
      y += Math.sin(t * 3.15 - u * 8.4) * .021 * (1 - head * .8) * bell(v, .48, .3);
    }
    x += Math.sin(v * 8) * (1 - assembly) * .032 * spine;
    return { x, y };
  }

  function bastion(u, v, t, assembly) {
    let x = 0, y = 0, weight = 0;
    // Nine overlapping rigid influences let individual painted blocks settle independently,
    // without cutting rectangular holes or cracking a continuous painted shield surface.
    for (let row = 0; row < 3; row++) for (let column = 0; column < 3; column++) {
      const cx = .23 + column * .27, cy = .23 + row * .27, index = row * 3 + column;
      const w = bell(u, cx, .145) * bell(v, cy, .145);
      const assembled = clamp(assembly * 1.2 - Math.abs(column - 1) * .08 - row * .03);
      const scatter = (1 - assembled) * (.14 + index % 3 * .025);
      const outwardX = (cx - .5) * scatter, outwardY = (cy - .53) * scatter;
      const bob = Math.sin(t * (1.75 + row * .13) + index * 1.17);
      const turn = rotated(u, v, cx, cy, (1 - assembly) * (index % 2 ? .044 : -.044) + Math.sin(t * 1.4 + index) * .009);
      x += (outwardX + turn.x + Math.sin(t * 1.62 + index * 1.7) * .006) * w;
      y += (outwardY + turn.y + bob * .009) * w;
      weight += w;
    }
    return { x: x / Math.max(.1, weight), y: y / Math.max(.1, weight) };
  }

  function spring(u, v, t, assembly) {
    const crown = (1 - band(v, .5, .76)) * band(v, .005, .12), trunk = bell(u, .5, .12);
    const sway = rotated(u, v, .5, .77, Math.sin(t * 1.55) * .025);
    const branch = band(Math.abs(u - .5), .06, .32) * crown;
    let x = sway.x * crown + Math.sin(t * 2.3 + u * 6 - v * 3) * .012 * branch;
    let y = sway.y * crown + Math.sin(t * 2.65 + u * 8) * .009 * branch;
    x += Math.sin(t * 1.55) * .004 * trunk * (1 - v);
    const lotus = band(v, .63, .84), side = u < .5 ? -1 : 1;
    const petal = rotated(u, v, .5 + side * .045, .79, side * Math.sin(t * 2.45 + Math.abs(u - .5) * 2) * .046);
    x += petal.x * lotus;
    y += petal.y * lotus;
    const stream = (1 - trunk) * band(v, .28, .67);
    x += Math.sin(t * 3.2 - v * 11 + u * 5) * .009 * stream;
    y += Math.sin(t * 2.9 - v * 9) * .007 * stream;
    y += (1 - assembly) * .022 * crown;
    return { x, y };
  }

  function eclipse(u, v, t, assembly, phase) {
    // In the original manifest cell the blades flank the moon vertically, not diagonally.
    if (phase === 'manifest' || phase === 'charge') {
      const left = bell(u, .22, .145) * (1 - bell(u, .5, .16));
      const right = bell(u, .78, .145) * (1 - bell(u, .5, .16));
      const leftTurn = rotated(u, v, .22, .53, Math.sin(t * 2.8) * .105 + (1 - assembly) * .075);
      const rightTurn = rotated(u, v, .78, .53, -Math.sin(t * 2.8 + .35) * .105 - (1 - assembly) * .075);
      return {
        x: leftTurn.x * left + rightTurn.x * right + (right - left) * (1 - assembly) * .035,
        y: leftTurn.y * left + rightTurn.y * right + Math.sin(t * 2.8 + .8) * .011 * (left - right),
      };
    }
    const a = bell(v - u, 0, .2), b = bell(v + u, 1, .2), total = Math.max(.1, a + b);
    const distance = Math.hypot(u - .5, v - .5), freeTip = band(distance, .035, .28);
    const turnA = rotated(u, v, .5, .5, Math.sin(t * 2.8) * .081 + (1 - assembly) * .075);
    const turnB = rotated(u, v, .5, .5, -Math.sin(t * 2.8 + .28) * .081 - (1 - assembly) * .075);
    return {
      x: (turnA.x * a + turnB.x * b) / total * freeTip + Math.sin(t * 2.1 + v * 7) * .004 * freeTip,
      y: (turnA.y * a + turnB.y * b) / total * freeTip + Math.sin(t * 2.1 + u * 7) * .004 * freeTip,
    };
  }

  function legion(u, v, t, assembly) {
    const distance = Math.abs(u - .5), side = u < .5 ? -1 : 1;
    const column = bell(distance, .27, .14) * (1 - band(v, .69, .94));
    const arch = (1 - band(v, .22, .45)) * bell(u, .5, .35);
    let x = Math.sin(t * 1.8 + side * .4) * .008 * column * side;
    let y = Math.sin(t * 1.9 + u * 5) * .006 * arch;
    // Each rank has a separate breathing/advancing phase while the lower seal stays grounded.
    for (let rank = 0; rank < 3; rank++) {
      const center = .28 + rank * .22, soul = bell(u, center, .105) * bell(v, .66, .21);
      x += Math.sin(t * 2.1 + rank * 2.1) * .007 * soul;
      y += Math.sin(t * 2.55 + rank * 1.8) * .018 * soul;
    }
    const seal = band(v, .75, .95), pulse = Math.sin(t * 2.3);
    x += (u - .5) * pulse * .022 * seal;
    y += Math.sin(u * 8 + t * 2.3) * .004 * seal;
    y += (1 - assembly) * .03 * (1 - seal) * (column + arch * .4);
    return { x, y };
  }

  const DEFORMERS = Object.freeze({ phoenix, tide, leviathan: tide, bastion, spring, eclipse, legion });

  /** Attack progress: 0 is idle, .3 is loaded, .7 is the strike, 1 holds the follow-through. */
  function attackPose(u, v, motion, action, artVariant) {
    if (!action) return { x: 0, y: 0, damping: 0 };
    const load = smooth(action / .3), fire = smooth((action - .3) / .4);
    const side = u < .5 ? -1 : 1, distance = Math.abs(u - .5);
    if (motion === 'phoenix') {
      if (artVariant === 'phoenix-side') {
        const near = bell(u, .34, .29) * (1 - band(v, .43, .62));
        const far = bell(u, .56, .12) * (1 - band(v, .28, .46));
        const farFire = smooth((action - .36) / .42), weight = Math.max(1, near + far);
        const nearTurn = rotated(u, v, .62, .47, .10 * load - .19 * fire);
        const farTurn = rotated(u, v, .64, .44, .064 * load - .12 * farFire);
        const tail = band(v, .6, .91) * (1 - band(u, .5, .74));
        const neck = bell(u, .75, .16) * bell(v, .41, .13);
        return { x: (nearTurn.x * near + farTurn.x * far) / weight + .008 * fire * neck,
          y: (nearTurn.y * near + farTurn.y * far) / weight + (.01 * load - .014 * fire) * tail,
          damping: Math.min(1, near + far) * load * .62 };
      }
      const wing = band(distance, .07, .23) * (1 - band(v, .53, .76)) * band(v, .015, .09);
      // A deliberate downstroke followed by a raised-wing follow-through; the chest is pinned.
      const turn = rotated(u, v, .5, .44, side * (.16 * load - .26 * fire));
      const tail = band(v, .56, .91) * bell(u, .5, .3);
      return { x: turn.x * wing, y: turn.y * wing + (.012 * load - .018 * fire) * tail,
        damping: wing * load * .72 };
    }
    if (motion === 'tide' || motion === 'leviathan') {
      const head = bell(u, .76, .235) * bell(v, .27, .19);
      const neck = bell(u, .65, .18) * bell(v, .37, .21);
      const turn = rotated(u, v, .67, .35, -.095 * load + .17 * fire);
      // Lower-jaw influence stays beneath the painted mouth, independent of skull/neck motion.
      const jaw = bell(u, .80, .13) * band(v, .275, .37) * (1 - band(v, .40, .51));
      const open = smooth((action - .23) / .35), lower = rotated(u, v, .755, .29, open * .16 - load * .035);
      return { x: turn.x * head + (-.020 * load + .043 * fire) * neck + lower.x * jaw,
        y: turn.y * head + (-.013 * load + .018 * fire) * neck + (lower.y - .009 * load + .028 * open) * jaw,
        damping: head * load * .7 };
    }
    if (motion === 'bastion') {
      const crown = (1 - band(v, .30, .50)) * band(v, .03, .14);
      const tower = bell(u, .24, .13) + bell(u, .76, .13), center = bell(u, .5, .12);
      return { x: side * .010 * fire * tower * crown,
        y: (.012 * load - .032 * fire) * crown * Math.min(1, tower + center * .8), damping: crown * load * .45 };
    }
    if (motion === 'spring') {
      const petals = band(v, .55, .72) * (1 - band(v, .90, .98)) * band(distance, .025, .20);
      const turn = rotated(u, v, .5, .76, side * (.025 * load - .09 * fire));
      return { x: turn.x * petals + side * .025 * fire * petals,
        y: turn.y * petals - .008 * fire * (1 - band(v, .35, .55)), damping: petals * load * .5 };
    }
    if (motion === 'eclipse') {
      const left = bell(u, .22, .145) * (1 - bell(u, .5, .16));
      const right = bell(u, .78, .145) * (1 - bell(u, .5, .16));
      const angle = -.035 * load + .17 * fire;
      const l = rotated(u, v, .22, .53, angle), r = rotated(u, v, .78, .53, -angle);
      return { x: l.x * left + r.x * right + (left - right) * .008 * fire,
        // Keep the painted blades' independent idle arcs alive while adding the attack pose.
        y: l.y * left + r.y * right, damping: Math.min(1, left + right) * load * .20 };
    }
    if (motion === 'legion') {
      const door = bell(distance, .27, .14) * (1 - band(v, .67, .86));
      const hinge = side < 0 ? .12 : .88;
      const ranks = bell(v, .67, .18) * bell(u, .5, .32);
      return { x: (side * .014 - (u - hinge) * .10) * fire * door,
        y: .014 * fire * ranks - .005 * load * door, damping: door * load * .5 };
    }
    return { x: 0, y: 0, damping: 0 };
  }

  function meshSettings(options) {
    const width = Math.max(0, finite(options.width)), height = Math.max(0, finite(options.height));
    const segments = Math.max(4, Math.min(20, Math.round(finite(options.segments, 12))));
    const time = Math.max(0, finite(options.time));
    return { width, height, x: finite(options.x), y: finite(options.y), time,
      columns: Math.max(4, Math.min(20, Math.round(finite(options.columns, segments)))),
      rows: Math.max(4, Math.min(20, Math.round(finite(options.rows, segments)))),
      motion: options.motion || 'phoenix', phase: options.phase || 'manifest', artVariant: options.artVariant || '',
      facingX: finite(options.facingX, 1) < 0 ? -1 : 1,
      aimPitch: Math.max(-.26, Math.min(.26, finite(options.aimPitch))),
      yaw: Math.max(-.38, Math.min(.38, finite(options.yaw))),
      strength: phaseStrength(options.phase, time), assembly: clamp(finite(options.assembly, 1)),
      action: clamp(finite(options.action)), deform: options.motion === 'phoenix' && options.artVariant === 'phoenix-side' ? phoenixSide : DEFORMERS[options.motion] || phoenix };
  }

  function orientVertex(settings, u, v, pu, pv, edge) {
    const { motion, artVariant, facingX, aimPitch, yaw } = settings;
    // A vertical target changes the neck's pitch, not the whole texture's roll.
    // Work in the painting's canonical right-facing coordinates, then mirror once.
    if (aimPitch && (motion === 'phoenix' || motion === 'tide' || motion === 'leviathan')) {
      const phoenixCombat = motion === 'phoenix' && artVariant === 'phoenix-side';
      const head = motion === 'phoenix'
        ? bell(u, phoenixCombat ? .76 : .5, phoenixCombat ? .19 : .13) * bell(v, phoenixCombat ? .40 : .29, .17)
        : bell(u, .77, .24) * bell(v, .28, .20);
      const pivotX = phoenixCombat ? .65 : motion === 'phoenix' ? .5 : .65;
      const pivotY = phoenixCombat ? .49 : motion === 'phoenix' ? .43 : .38;
      const turn = rotated(pu, pv, pivotX, pivotY, aimPitch);
      pu += turn.x * head * edge; pv += turn.y * head * edge;
    }
    // Neutral trees, gates, moons and shields retain an upright base. A small
    // perspective compression/shear reveals a directed front without inventing a back view.
    const canonicalYaw = yaw * facingX, squeeze = 1 - Math.abs(yaw) * .27;
    pu = .5 + (pu - .5) * squeeze + canonicalYaw * .055 * (.72 - pv) * edge;
    if (motion !== 'phoenix' && motion !== 'tide' && motion !== 'leviathan') pv += aimPitch * .025 * (pu - .5) * edge;
    return { x: .5 + facingX * (pu - .5), y: pv };
  }

  function meshVertex(settings, column, row) {
    const { columns, rows, deform, motion, phase, artVariant, time, assembly, action, strength, x, y, width, height } = settings;
    const u = column / columns, v = row / rows, offset = deform(u, v, time / 1000, assembly, phase);
    const attack = attackPose(u, v, motion, action, artVariant), edge = smooth(Math.min(u, v, 1 - u, 1 - v) / .15);
    const posed = orientVertex(settings, u, v,
      u + (offset.x * (1 - attack.damping) + attack.x) * strength * edge,
      v + (offset.y * (1 - attack.damping) + attack.y) * strength * edge, edge);
    return { u, v, x: x + posed.x * width, y: y + posed.y * height };
  }

  /** Pure normalized-UV mesh. x/y are the destination's top-left, not its center. */
  function getMesh(options = {}) {
    const settings = meshSettings(options), { width, height, columns, rows } = settings;
    const vertices = [], triangles = [];
    if (!width || !height) return { vertices, triangles, columns, rows };
    for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
      // Original cells include a safe dark/transparent border. Pin only its very outside edge.
      vertices.push(meshVertex(settings, column, row));
    }
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      const a = row * (columns + 1) + column, b = a + 1, c = a + columns + 1, d = c + 1;
      // Alternating diagonals avoid a uniform directional crease through the painted figure.
      if ((row + column) % 2) triangles.push([a, b, c], [b, d, c]);
      else triangles.push([a, b, d], [a, d, c]);
    }
    return { vertices, triangles, columns, rows };
  }

  /** Exact texture anchor in the same destination coordinate system as draw, before parent CTM. */
  function getAnchor(options = {}, u = .5, v = .5) {
    const settings = meshSettings(options), { columns, rows, x, y, width, height } = settings;
    if (!width || !height) return { x, y };
    const px = clamp(finite(u, .5)) * columns, py = clamp(finite(v, .5)) * rows;
    const column = Math.min(columns - 1, Math.floor(px)), row = Math.min(rows - 1, Math.floor(py));
    const s = px - column, t = py - row;
    let corners, weights;
    if ((row + column) % 2) {
      if (s + t <= 1) { corners = [[column, row], [column + 1, row], [column, row + 1]]; weights = [1 - s - t, s, t]; }
      else { corners = [[column + 1, row], [column + 1, row + 1], [column, row + 1]]; weights = [1 - t, s + t - 1, 1 - s]; }
    } else if (s >= t) {
      corners = [[column, row], [column + 1, row], [column + 1, row + 1]]; weights = [1 - s, s - t, t];
    } else {
      corners = [[column, row], [column + 1, row + 1], [column, row + 1]]; weights = [1 - t, s, t - s];
    }
    const points = corners.map(([c, r]) => meshVertex(settings, c, r));
    return { x: points.reduce((sum, point, index) => sum + point.x * weights[index], 0),
      y: points.reduce((sum, point, index) => sum + point.y * weights[index], 0) };
  }

  function affine(a, b, c, sourceWidth, sourceHeight) {
    const u0 = a.u * sourceWidth, v0 = a.v * sourceHeight, u1 = b.u * sourceWidth, v1 = b.v * sourceHeight, u2 = c.u * sourceWidth, v2 = c.v * sourceHeight;
    const denominator = u0 * (v1 - v2) + u1 * (v2 - v0) + u2 * (v0 - v1);
    if (Math.abs(denominator) < 1e-8) return null;
    const coefficient = field => [
      (a[field] * (v1 - v2) + b[field] * (v2 - v0) + c[field] * (v0 - v1)) / denominator,
      (a[field] * (u2 - u1) + b[field] * (u0 - u2) + c[field] * (u1 - u0)) / denominator,
      (a[field] * (u1 * v2 - u2 * v1) + b[field] * (u2 * v0 - u0 * v2) + c[field] * (u0 * v1 - u1 * v0)) / denominator,
    ];
    const horizontal = coefficient('x'), vertical = coefficient('y');
    return [horizontal[0], vertical[0], horizontal[1], vertical[1], horizontal[2], vertical[2]];
  }

  function clipTriangle(ctx, a, b, c, overlap) {
    const cx = (a.x + b.x + c.x) / 3, cy = (a.y + b.y + c.y) / 3;
    ctx.beginPath();
    [a, b, c].forEach((point, index) => {
      const dx = point.x - cx, dy = point.y - cy, length = Math.max(.01, Math.hypot(dx, dy));
      const px = point.x + dx / length * overlap, py = point.y + dy / length * overlap;
      if (index) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    });
    ctx.closePath(); ctx.clip();
  }

  /** sourceRect selects exactly one original frame; accepts an Image or pre-matted Canvas. */
  function draw(ctx, image, sourceRect, options = {}) {
    const imageWidth = image?.naturalWidth || image?.width || 0, imageHeight = image?.naturalHeight || image?.height || 0;
    const empty = { triangles: 0, columns: 0, rows: 0 };
    if (!ctx || !imageWidth || !imageHeight || options.alpha === 0) return empty;
    const sx = Math.max(0, finite(sourceRect?.x)), sy = Math.max(0, finite(sourceRect?.y));
    const sw = Math.min(imageWidth - sx, Math.max(0, finite(sourceRect?.width, imageWidth)));
    const sh = Math.min(imageHeight - sy, Math.max(0, finite(sourceRect?.height, imageHeight)));
    if (sw <= 0 || sh <= 0) return empty;
    const mesh = getMesh(options), alpha = clamp(finite(options.alpha, 1));
    if (!mesh.triangles.length || alpha <= 0) return { ...empty, columns: mesh.columns, rows: mesh.rows };
    const transform = ctx.getTransform(), scale = Math.max(.1, Math.hypot(transform.a, transform.b), Math.hypot(transform.c, transform.d));
    const overlap = .35 / scale;
    let rendered = 0;
    ctx.save();
    try {
      ctx.globalAlpha *= alpha; ctx.imageSmoothingEnabled = true;
      // The outer UV border is pinned. Internal anti-seam overlap must not bleed beyond it.
      ctx.beginPath(); ctx.rect(finite(options.x), finite(options.y), Math.max(0, finite(options.width)), Math.max(0, finite(options.height))); ctx.clip();
      for (const triangle of mesh.triangles) {
        const a = mesh.vertices[triangle[0]], b = mesh.vertices[triangle[1]], c = mesh.vertices[triangle[2]], mapping = affine(a, b, c, sw, sh);
        if (!mapping) continue;
        ctx.save();
        try {
          clipTriangle(ctx, a, b, c, overlap); ctx.transform(...mapping);
          ctx.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
          rendered++;
        } finally { ctx.restore(); }
      }
    } finally {
      ctx.restore();
    }
    return { triangles: rendered, columns: mesh.columns, rows: mesh.rows };
  }

  window.ComboArtRig = Object.freeze({ draw, getMesh, getAnchor });
}());
