/* Summons act; only their emitted material travels. Coordinates are shared by
 * the painted rig, live attacks, target markers, and viewport-follow camera. */
(function () {
  'use strict';
  const clamp = n => Math.max(0, Math.min(1, n));
  const ease = n => 1 - (1 - clamp(n)) ** 3;
  const SOCKETS = Object.freeze({
    phoenix: { core: [.5,.44], leftWing: [.10,.13], rightWing: [.90,.11] },
    tide: { mouth: [.825,.315], core: [.67,.34] },
    bastion: { core: [.5,.455], crown: [.5,.15] },
    spring: { core: [.5,.73], crown: [.5,.25] },
    eclipse: { core: [.5,.52], leftBlade: [.16,.50], rightBlade: [.84,.50] },
    legion: { core: [.5,.58], leftGate: [.31,.57], rightGate: [.69,.57] },
  });
  const KINDS = Object.freeze({ phoenix:'sky-fire', tide:'dragon-breath', bastion:'solar-lance', spring:'petal-stream', eclipse:'crescent-cut', legion:'soul-volley' });
  const PHOENIX_COMBAT_SOCKETS = Object.freeze({ core:[.62,.47], mouth:[.80,.41], leftWing:[.22,.08], rightWing:[.56,.16] });
  const supportRole = role => role === 'heal' || role === 'shield' || role === 'summon';

  function facing(geometry, motion, time, options) {
    const valid = (geometry.targets || []).filter(target => Number.isFinite(target.x) && Number.isFinite(target.y));
    const enemies = motion === 'spring' ? [] : valid.filter(target => target.role === 'attack' && target.side !== 'ally' && target.side !== 'summon' && target.aliveBefore !== false);
    const beneficiaries = valid.filter(target => supportRole(target.role) && target.side !== 'enemy');
    const candidates = enemies.length ? enemies : beneficiaries;
    const state = options.facingState && typeof options.facingState === 'object' ? options.facingState : {};
    if (Number.isFinite(state.lastTime) && time < state.lastTime) { delete state.targetUid; delete state.facingX; }
    // Keep the same legal target even if rendering order changes. Never use a
    // cosmetic enemy as the facing subject of a friendly-only tree or ward.
    const importance = target => (!target.aliveBefore && target.aliveAfter ? 1e6 : 0)
      + Math.max(0, (target.hpAfter || 0) - (target.hpBefore || 0))
      + Math.max(0, (target.shieldAfter || 0) - (target.shieldBefore || 0));
    const ordered = [...candidates].sort((a,b) => importance(b) - importance(a) || String(a.uid).localeCompare(String(b.uid)));
    const target = candidates.find(target => String(target.uid) === String(state.targetUid))
      || candidates.find(target => String(target.uid) === String(geometry.primaryUid)) || ordered[0];
    const dx = target ? target.x - geometry.fusion.x : 0, dy = target ? target.y - geometry.fusion.y : 0;
    const deadZone = Math.max(16, (geometry.manifestRadius || 100) * .18);
    const facingX = Math.abs(dx) > deadZone ? Math.sign(dx) : state.facingX === -1 ? -1 : 1;
    const orient = ease((time - 1200) / 650), distance = Math.max(1, Math.hypot(dx,dy));
    const aimPitch = target ? Math.max(-.26, Math.min(.26, Math.atan2(dy, Math.max(deadZone, Math.abs(dx))))) * orient : 0;
    const neutral = motion !== 'phoenix' && motion !== 'tide' && motion !== 'leviathan';
    const yaw = target && neutral ? facingX * (.18 + Math.min(1, Math.abs(dx) / distance) * .18) * orient : 0;
    state.targetUid = target?.uid ?? null; state.facingX = facingX; state.lastTime = time;
    return { facingTargetUid:target?.uid ?? null, facingX, aimPitch, yaw };
  }

  function point(attack, progress) {
    const p = clamp(progress), q = 1 - p, a = attack.start, b = attack.end;
    if (attack.kind === 'sky-fire') return { x:a.x+(b.x-a.x)*p, y:a.y+(b.y-a.y)*p };
    const c = attack.control;
    return { x:q*q*a.x+2*q*p*c.x+p*p*b.x, y:q*q*a.y+2*q*p*c.y+p*p*b.y };
  }

  function sample(geometry, motion, time, options = {}) {
    const { fusion, manifestRadius: radius } = geometry;
    const assembly = ease((time - 1250) / 1150), size = radius * 2.04 * (.88 + assembly * .12);
    const attackBeat = ease((time-2650)/550) * (1-ease((time-5650)/900));
    const action = motion === 'phoenix' ? attackBeat * (.62 + .38 * Math.sin((time-3200)/260)) : attackBeat;
    // A small lift and recoil are local performance, never travel to the victim.
    const lift = ease((time-2700)/700) * (motion === 'phoenix' ? 18 : motion === 'tide' ? 9 : 0);
    const box = { x:fusion.x-size/2, y:fusion.y-size/2-lift, width:size, height:size };
    const orientation = facing(geometry, motion, time, options), artVariant = options.artVariant || '';
    const rigOptions = { ...box, time, motion, phase:'manifest', assembly, action, artVariant, ...orientation, segments:geometry.width<701?10:12 };
    const sockets = motion === 'phoenix' && artVariant === 'phoenix-side' ? PHOENIX_COMBAT_SOCKETS : SOCKETS[motion] || SOCKETS.phoenix;
    const anchors = Object.fromEntries(Object.entries(sockets).map(([name,uv]) => [name,
      window.ComboArtRig?.getAnchor ? window.ComboArtRig.getAnchor(rigOptions,...uv) : {x:box.x+uv[0]*size,y:box.y+uv[1]*size}]));
    const caster = { box, frame:1, phase:'manifest', alpha:ease((time-1250)/350)*(1-ease((time-6300)/1200)), assembly, action, anchors, rigOptions, ...orientation };
    const attacks = geometry.targets.filter(target => motion !== 'spring' || supportRole(target.role) && target.side !== 'enemy').map((target,index) => {
      const kind = target.role==='shield'?'ward-stream':target.role==='heal'?'petal-stream':target.role==='summon'?'soul-gift':KINDS[motion];
      const socket = kind==='dragon-breath'?'mouth':kind==='crescent-cut'?'rightBlade':'core';
      let start = {...(anchors[socket] || anchors.core)}, end = {x:target.x,y:target.y};
      // Wing energy opens an overhead bank. Only burning feathers fall from it.
      if(kind==='sky-fire') start=geometry.layout==='opposed'
        ? {x:Math.max(12,Math.min(geometry.width-12,target.x-orientation.facingX*35)),y:Math.max(6,Math.min(target.y-50,box.y+10))}
        : geometry.width<701
        ? {x:Math.max(18,Math.min(geometry.width-18,target.x+orientation.facingX*65)),y:Math.max(box.y+box.height*.88,target.y-155)}
        : {x:Math.max(18,Math.min(geometry.width-18,target.x-orientation.facingX*65)),y:Math.max(16,Math.min(target.y-165,box.y+18))};
      const progress = clamp((time-3200)/(target.strike-3200));
      const travel = kind==='sky-fire'?progress**1.65:progress;
      const reach = Math.min(Math.hypot(end.x-start.x,end.y-start.y)*.6,Math.max(34,Math.abs(end.x-start.x)*.55));
      const control = kind==='dragon-breath'?{x:start.x+orientation.facingX*Math.cos(orientation.aimPitch)*reach,y:start.y+Math.sin(orientation.aimPitch)*reach}:
        {x:(start.x+end.x)/2,y:(start.y+end.y)/2-(kind==='petal-stream'?48:kind==='crescent-cut'?42:18)};
      const attack = {uid:target.uid,kind,role:target.role,index,socket,start,end,control,progress:travel,strike:target.strike,launch:3200};
      attack.head = point(attack,travel);
      if(kind==='sky-fire') attack.guideStart = {...anchors[index%2?'leftWing':'rightWing']};
      if(kind==='crescent-cut') attack.secondaryStart = {...anchors.leftBlade};
      return attack;
    });
    return {version:9,caster,attacks};
  }
  window.ComboChoreography = Object.freeze({ sample, point, sockets:SOCKETS });
}());
