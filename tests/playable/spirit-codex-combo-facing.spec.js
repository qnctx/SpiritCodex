const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// These focused tests execute the same shipped modules without a browser or a player profile.
// The existing choreography specs separately inspect the real on-stage Canvas and source artwork.
function runtime() {
  const scope = { window: {} }; vm.createContext(scope);
  for (const filename of ['spirit-codex-combo-art-rig.js', 'spirit-codex-combo-choreography.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../../playable', filename), 'utf8'), scope);
  }
  return { rig: scope.window.ComboArtRig, choreography: scope.window.ComboChoreography };
}

function geometry(targets, extra = {}) {
  return { width: 1100, height: 600, fusion: { x: 550, y: 270 }, manifestRadius: 125,
    primaryUid: targets[0]?.uid, targets: targets.map((target, index) => ({ strike: 4700 + index * 110, ...target })), ...extra };
}

const enemy = (uid, x, y = 300) => ({ uid, x, y, role: 'attack', side: 'enemy', aliveBefore: true });
const friend = (uid, x, role = 'heal', y = 330) => ({ uid, x, y, role, side: role === 'summon' ? 'summon' : 'ally', aliveBefore: true });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

test.describe('Facing, aimed anatomy and shared transformed art sockets', () => {
  test('locks a legal enemy through ordering and dead zones; both mouth and breath reverse together', () => {
    const { choreography } = runtime(), state = {};
    const left = enemy('enemy-left', 180), right = enemy('enemy-right', 900), ally = friend('ally', 100, 'shield');
    const first = choreography.sample(geometry([ally, left, right], { primaryUid: left.uid }), 'tide', 2800, { facingState: state });
    expect(first.caster.facingTargetUid).toBe(left.uid); expect(first.caster.facingX).toBe(-1);
    expect(first.caster.anchors.mouth.x).toBeLessThan(first.caster.anchors.core.x);
    expect(first.attacks.find(attack => attack.uid === left.uid).control.x).toBeLessThan(first.caster.anchors.mouth.x);
    const reordered = choreography.sample(geometry([right, ally, left], { primaryUid: right.uid }), 'tide', 3300, { facingState: state });
    expect(reordered.caster.facingTargetUid).toBe(left.uid);
    const centered = choreography.sample(geometry([{ ...left, x: 552, y: 600 }, right]), 'tide', 3500, { facingState: state });
    expect(centered.caster.facingX, 'near-vertical aim keeps the last intentional horizontal facing').toBe(-1);
    const gone = choreography.sample(geometry([right]), 'tide', 3700, { facingState: state });
    expect(gone.caster.facingTargetUid).toBe(right.uid); expect(gone.caster.facingX).toBe(1);
    expect(gone.caster.anchors.mouth.x).toBeGreaterThan(gone.caster.anchors.core.x);
    expect(gone.attacks[0].control.x).toBeGreaterThan(gone.attacks[0].start.x);
    const replay = choreography.sample(geometry([left]), 'tide', 1250, { facingState: state });
    expect(replay.caster.facingTargetUid).toBe(left.uid); expect(replay.caster.facingX).toBe(-1);
  });

  test('friendly-only trees face beneficiaries, while mixed wards and gates keep their independent recipient roles', () => {
    const { choreography } = runtime(), hostile = enemy('enemy', 970);
    const revived = { ...friend('revived', 130), aliveBefore: false, aliveAfter: true, hpBefore: 0, hpAfter: 180 };
    const healed = { ...friend('healed', 270), hpBefore: 50, hpAfter: 400 };
    const tree = choreography.sample(geometry([hostile, healed, revived], { primaryUid: hostile.uid }), 'spring', 3100);
    expect(tree.caster.facingTargetUid).toBe(revived.uid); expect(tree.caster.facingX).toBe(-1);
    expect(tree.caster.yaw).toBeLessThan(0);
    expect(tree.attacks.map(attack => attack.uid).sort()).toEqual(['healed', 'revived']);
    expect(tree.attacks.every(attack => attack.kind === 'petal-stream' && attack.role === 'heal')).toBe(true);
    for (const [motion, role, supportKind] of [['bastion', 'shield', 'ward-stream'], ['legion', 'summon', 'soul-gift']]) {
      const beneficiary = friend('beneficiary', 130, role);
      const mixed = choreography.sample(geometry([beneficiary, hostile], { primaryUid: beneficiary.uid }), motion, 3500);
      expect(mixed.caster.facingTargetUid).toBe(hostile.uid); expect(mixed.caster.facingX).toBe(1);
      expect(mixed.attacks.find(attack => attack.uid === beneficiary.uid).kind).toBe(supportKind);
      expect(mixed.attacks.find(attack => attack.uid === hostile.uid).role).toBe('attack');
    }
    const noRecipient = choreography.sample(geometry([hostile]), 'spring', 3500);
    expect(noRecipient.caster.facingTargetUid).toBeNull(); expect(noRecipient.attacks).toHaveLength(0);
  });

  test('vertical mobile targets pitch a head instead of rolling the whole creature, and mirrored sockets still aim correctly', () => {
    const { rig, choreography } = runtime();
    for (const motion of ['phoenix', 'tide']) for (const targetY of [30, 680]) {
      const options = { artVariant: motion === 'phoenix' ? 'phoenix-side' : '', facingState: { facingX: -1 } };
      const sample = choreography.sample(geometry([enemy('vertical', 180, targetY)], {
        width: 360, fusion: { x: 180, y: 300 }, manifestRadius: 104,
      }), motion, 3400, options);
      const { caster } = sample;
      expect(caster.facingX).toBe(-1);
      expect(Math.abs(caster.aimPitch)).toBeLessThanOrEqual(.26);
      expect(Math.sign(caster.aimPitch)).toBe(Math.sign(targetY - 300));
      const mesh = rig.getMesh(caster.rigOptions), topLeftUV = mesh.vertices[0], topRightUV = mesh.vertices[mesh.columns];
      expect(topLeftUV.y).toBeCloseTo(caster.box.y, 8); expect(topRightUV.y).toBeCloseTo(caster.box.y, 8);
      expect(topLeftUV.x).toBeGreaterThan(topRightUV.x);
      const uv = motion === 'phoenix' ? [.8, .41] : [.825, .315];
      const noPitch = rig.getAnchor({ ...caster.rigOptions, aimPitch: 0 }, ...uv), aimed = rig.getAnchor(caster.rigOptions, ...uv);
      expect((aimed.y - noPitch.y) * Math.sign(targetY - 300)).toBeGreaterThan(.1);
      expect(caster.anchors.mouth.x).toBeLessThan(caster.anchors.core.x);
    }
  });

  test('every supported facing and aim preserves mesh winding; the side phoenix articulates its wings around a stable chest', () => {
    const { rig } = runtime();
    for (const motion of ['phoenix', 'tide', 'bastion', 'spring', 'eclipse', 'legion']) for (const segments of [10, 12]) {
      for (const time of [1250, 2200, 2800, 3500, 5200, 7100]) for (const facingX of [-1, 1]) {
        const options = { x: 20, y: 30, width: 250, height: 250, motion, time, segments, facingX,
          artVariant: motion === 'phoenix' ? 'phoenix-side' : '', aimPitch: facingX * .26, yaw: facingX * .38,
          assembly: Math.min(1, Math.max(0, (time - 1250) / 1150)), action: time < 2800 ? .3 : 1 };
        const mesh = rig.getMesh(options), base = options.width * options.height / (segments * segments);
        let smallest = Infinity;
        for (const indices of mesh.triangles) {
          const [a, b, c] = indices.map(index => mesh.vertices[index]);
          smallest = Math.min(smallest, cross(a, b, c) * facingX / base);
        }
        expect(smallest, `${motion}/${time}/${segments}: no local fold behind a global mirror`).toBeGreaterThan(.15);
      }
    }
    const base = { x: 0, y: 0, width: 280, height: 280, motion: 'phoenix', artVariant: 'phoenix-side',
      phase: 'manifest', time: 3300, assembly: 1, segments: 12 };
    const points = [[.22, .08], [.56, .16], [.62, .47], [.33, .85]].map(uv => ({
      before: rig.getAnchor({ ...base, action: 0 }, ...uv), after: rig.getAnchor({ ...base, action: 1 }, ...uv),
    }));
    const movements = points.map(point => distance(point.before, point.after));
    const wingTurns = points.slice(0, 2).map(point =>
      Math.atan2(point.after.y - points[2].after.y, point.after.x - points[2].after.x)
      - Math.atan2(point.before.y - points[2].before.y, point.before.x - points[2].before.x));
    expect(movements[0]).toBeGreaterThan(3);
    expect(Math.abs(wingTurns[0] - wingTurns[1]), 'near and far wing rotate by different angles around the chest, not one rigid image rotation').toBeGreaterThan(.015);
    expect(movements[2], 'the painted chest remains the wing hinge').toBeLessThan(movements[0] * .4);
    expect(movements[3], 'tail follows the downstroke separately').toBeGreaterThan(.5);
  });

  test('getAnchor agrees with the actual triangle affine draw calls under mirror, yaw, pitch and an inherited canvas transform', () => {
    const { rig } = runtime();
    const parent = [1.7, .08, -.06, 1.7, 31, -12];
    const multiply = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
      m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
      m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
    const project = (m, x, y) => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] });
    for (const facingX of [-1, 1]) {
      const draws = [], stack = []; let matrix = [...parent], activePath = [], clip = null;
      const ctx = { globalAlpha: .8,
        getTransform: () => ({ a: matrix[0], b: matrix[1], c: matrix[2], d: matrix[3], e: matrix[4], f: matrix[5] }),
        save() { stack.push({ matrix: [...matrix], clip, alpha: this.globalAlpha }); },
        restore() { const state = stack.pop(); matrix = state.matrix; clip = state.clip; this.globalAlpha = state.alpha; },
        beginPath() { activePath = []; }, closePath() {},
        moveTo(x, y) { activePath.push(project(matrix, x, y)); }, lineTo(x, y) { activePath.push(project(matrix, x, y)); },
        rect(x, y, w, h) { activePath.push(...[[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(p => project(matrix, ...p))); },
        clip() { clip = [...activePath]; }, transform(...next) { matrix = multiply(matrix, next); },
        drawImage(source, ...args) { draws.push({ matrix: [...matrix], clip: [...clip], args }); },
      };
      const options = { x: 70, y: 90, width: 250, height: 250, time: 3550, motion: 'phoenix',
        artVariant: 'phoenix-side', assembly: 1, action: .8, facingX, aimPitch: .24, yaw: facingX * .3, segments: 12 };
      const result = rig.draw(ctx, { width: 600, height: 600 }, { x: 32, y: 48, width: 400, height: 300 }, options);
      expect(result.triangles).toBe(288); expect(draws).toHaveLength(288); expect(stack).toHaveLength(0);
      expect(matrix).toEqual(parent); expect(ctx.globalAlpha).toBe(.8);
      for (const uv of [[.8, .41], [.22, .08], [.56, .16], [.62, .47], [.33, .85]]) {
        const anchor = rig.getAnchor(options, ...uv), expected = project(parent, anchor.x, anchor.y);
        const candidates = draws.map(draw => ({ point: project(draw.matrix, uv[0] * 400, uv[1] * 300), clip: draw.clip }))
          .filter(({ point, clip }) => {
            const sides = clip.map((a, index) => cross(a, clip[(index + 1) % clip.length], point));
            return sides.every(side => side >= -.01) || sides.every(side => side <= .01);
          });
        expect(candidates.length).toBeGreaterThan(0);
        expect(Math.min(...candidates.map(candidate => distance(candidate.point, expected)))).toBeLessThan(1e-7);
      }
    }
  });
});
