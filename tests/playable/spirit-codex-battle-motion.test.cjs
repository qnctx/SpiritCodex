const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Pure presentation checks; the live browser suite separately audits raster output and HUD pixels.
const source = fs.readFileSync(path.join(__dirname, '../../playable/spirit-codex-battle-motion.js'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const near = (a, b, epsilon = 1e-7) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
const cast = { src: 'cast-test.png', columns: 4, rows: 2, background: '#050f1a', members: [
  { id: 'H1', anchors: [[.72,.35],[.78,.31],[.89,.39],[.70,.42]] },
  { id: 'A1', anchors: [[.21,.33],[.38,.29],[.88,.42],[.68,.47]] }
] };
const transformPoint = (m, x, y) => ({ x: m.a*x + m.c*y + m.e, y: m.b*x + m.d*y + m.f });

class Context {
  constructor(canvas = { width: 1000, clientWidth: 1000 }) {
    this.canvas = canvas; this.m = { a:1,b:0,c:0,d:1,e:0,f:0 }; this.stack = [];
    this.globalAlpha = 1; this.shadowBlur = 0; this.draws = []; this.paths = []; this.path = [];
  }
  save() { this.stack.push({ m:{...this.m}, alpha:this.globalAlpha, shadow:this.shadowBlur }); }
  restore() { const s=this.stack.pop(); this.m=s.m; this.globalAlpha=s.alpha; this.shadowBlur=s.shadow; }
  getTransform() { return {...this.m}; }
  transform(a,b,c,d,e,f) { const p=this.m; this.m={a:p.a*a+p.c*b,b:p.b*a+p.d*b,c:p.a*c+p.c*d,d:p.b*c+p.d*d,e:p.a*e+p.c*f+p.e,f:p.b*e+p.d*f+p.f}; }
  translate(x,y) { this.transform(1,0,0,1,x,y); }
  scale(x,y) { this.transform(x,0,0,y,0,0); }
  rotate(r) { this.transform(Math.cos(r),Math.sin(r),-Math.sin(r),Math.cos(r),0,0); }
  beginPath() { this.path=[]; }
  moveTo(x,y) { this.path.push({kind:'move',...transformPoint(this.m,x,y)}); }
  lineTo(x,y) { this.path.push({kind:'line',...transformPoint(this.m,x,y)}); }
  quadraticCurveTo(...args) { this.path.push({kind:'quadratic',args}); }
  closePath() {}
  clip() {}
  rect(x,y,width,height) { this.path.push({kind:'rect',x,y,width,height}); }
  arc(x,y,radius) { this.path.push({kind:'arc',...transformPoint(this.m,x,y),radius}); }
  ellipse(x,y,rx,ry) { this.path.push({kind:'ellipse',...transformPoint(this.m,x,y),rx,ry}); }
  stroke() { this.paths.push({kind:'stroke',path:[...this.path],alpha:this.globalAlpha}); }
  fill() { this.paths.push({kind:'fill',path:[...this.path],alpha:this.globalAlpha}); }
  drawImage(image,...args) { this.draws.push({ image,args,m:{...this.m},shadow:this.shadowBlur }); }
  createLinearGradient() { return {addColorStop(){}}; }
  createRadialGradient() { return {addColorStop(){}}; }
}

function runtime() {
  let randomCalls = 0;
  const canvases = [], document = {
    body: { append() {} },
    createElementNS() { return {style:{},setAttribute(){},append(){},remove(){}}; },
    createElement(tag) {
      assert.equal(tag,'canvas'); const canvas={width:0,height:0,dataset:{}};
      const ctx=new Context(canvas);canvas.getContext=()=>ctx;canvases.push(canvas);return canvas;
    }
  };
  const math=Object.create(Math);math.random=()=>{randomCalls++;throw new Error('Presentation must not use random');};
  const scope={window:{SC:{COMBO_RECIPES:[{casting:cast}]}},document,performance:{now:()=>0},Math:math};
  vm.runInNewContext(source,scope);
  return { motion:scope.window.BattleMotion, canvases, randomCalls:()=>randomCalls };
}
function unit(uid, extra={}) {
  return {uid,characterId:'H1',curHp:1000,maxHp:1000,shield:0,alive:true,isEnemy:false,isSummon:false,
    skills:[{name:'Basic',type:'attack'}],buffs:[],debuffs:[],element:'fire',art:'idle.png',_x:100,_y:180,_r:25,...extra};
}
function setup(extra={}) {
  const r=runtime(),actor=unit('actor'),enemy=unit('enemy',{characterId:null,isEnemy:true,_x:750,...extra});
  return {...r,actor,enemy,units:[actor,enemy]};
}

test('snapshot is immutable and independent; only actual resolved recipients enter presentation',()=>{
  const {motion,actor,enemy,units,randomCalls}=setup();actor.buffs=[{type:'attack',value:2}];
  const before=motion.snapshot(units),frozen=JSON.stringify(before);actor.buffs[0].value=9;enemy.curHp=760;
  assert.equal(JSON.stringify(before),frozen);assert.ok(Object.isFrozen(before)&&Object.isFrozen(before[0]));
  const authoritative=JSON.stringify(units);assert.equal(motion.begin(actor,actor.skills[0],before,units,{now:100}),900);
  assert.deepEqual(motion.inspect(100).targets.map(t=>t.uid).sort().join(','),'actor,enemy');
  assert.equal(JSON.stringify(units),authoritative);assert.equal(randomCalls(),0);
  const untouched=motion.snapshot(units);motion.begin(actor,actor.skills[0],untouched,units,{now:200});
  assert.equal(motion.inspect(200).targets.length,0);
});

test('ordinary damage, shield break and lethal alive display change only at actual impact',()=>{
  const {motion,actor,enemy,units}=setup({shield:80});const before=motion.snapshot(units);
  enemy.curHp=0;enemy.shield=0;enemy.alive=false;motion.begin(actor,actor.skills[0],before,units,{now:1000});
  assert.equal(motion.inspect(1000).impactAt,1540);
  const prior=motion.pose(enemy,1539.99);assert.equal(prior.hp,1000);assert.equal(prior.shield,80);assert.equal(prior.alive,true);assert.equal(prior.flash,0);
  const contact=motion.pose(enemy,1540);assert.equal(contact.alive,false);assert.ok(contact.flash>0);assert.equal(contact.hp,1000);
  const after=motion.pose(enemy,1720);assert.equal(after.hp,0);assert.equal(after.shield,0);assert.equal(after.opacity,1);
  assert.equal(motion.pose(enemy,2000).hp,0);
});

test('healing, shielding and a newly resolved summon are delayed independently and never mutate resolution',()=>{
  const {motion,actor,enemy,units}=setup(),friend=unit('friend',{characterId:'W1',curHp:200,_x:220});units.push(friend);
  const before=motion.snapshot(units);friend.curHp=650;actor.shield=200;
  const summon=unit('summon',{characterId:null,isSummon:true,curHp:350,maxHp:350,_x:320});units.push(summon);
  const state=JSON.stringify(units);assert.equal(motion.begin(actor,{name:'Mend',type:'heal'},before,units,{now:0}),1100);
  const targets=motion.inspect(0).targets;assert.equal(targets.length,3);
  assert.equal(targets.find(t=>t.uid==='friend').kind,'heal');assert.equal(targets.find(t=>t.uid==='actor').kind,'shield');
  const born=targets.find(t=>t.uid==='summon');assert.equal(born.kind,'summon');
  assert.equal(motion.pose(summon,born.impactAt-1).opacity,0);assert.equal(motion.pose(summon,born.impactAt).opacity,1);
  for(const t of targets){assert.equal(motion.pose(units.find(u=>u.uid===t.uid),t.impactAt-1).hp,t.before.hp);}
  assert.equal(motion.pose(friend,950).hp,650);assert.equal(motion.pose(actor,1050).shield,200);assert.equal(JSON.stringify(units),state);
});

test('reduced motion is a 180 ms quiet handoff: no lunge, recoil, sheet switch or effect draws',()=>{
  const {motion,actor,enemy,units}=setup();const before=motion.snapshot(units);enemy.curHp=700;
  assert.equal(motion.begin(actor,{name:'Ultimate',ult:true,type:'aoe'},before,units,{now:100,reduced:true}),180);
  const ctx=new Context();assert.equal(motion.drawEffects(ctx,{width:1000,height:600},145),false);assert.equal(ctx.paths.length,0);
  for(const time of [100,130,159,160,200,279]){
    const p=motion.pose(actor,time);assert.deepEqual([p.dx,p.dy,p.rotation,p.scaleX,p.scaleY,p.actionFrame],[0,0,0,1,1,null]);
  }
  assert.equal(motion.pose(enemy,159).hp,1000);assert.equal(motion.pose(enemy,160).hp,700);
  assert.equal(motion.pose(enemy,160).flash,0);assert.equal(motion.inspect(280).active,false);
});

test('four-pose sprites preserve effective body height, lane width and exact mirrored weapon sockets',()=>{
  const {motion,canvases}=runtime(),image={naturalWidth:1774,naturalHeight:887};
  for(const [width,height,lane] of [[60,120,134*.95],[28,43,43*.95],[92,130,140]]){
    const actor=unit('caster',{characterId:'A1',_artWidth:lane}),rect={x:130,y:70,width,height};
    for(const facingX of [-1,1])for(const [progress,frame] of [[.1,0],[.25,1],[.47,2],[.85,3]]){
      const ctx=new Context(),p=motion.drawCast(ctx,actor,rect,cast,progress,()=>image,{facingX,now:123});
      assert.equal(p.drawn,true);assert.equal(p.actionFrame,frame);assert.equal(p.casting.row,1);assert.equal(p.uid,'caster');assert.equal(p.time,123);
      assert.ok(p.rect.width<=lane*1.12+1e-8);assert.ok(p.rect.height*.9>=height*.95,'person must not shrink back to portrait width');
      near(p.rect.y+p.rect.height*.95,rect.y+rect.height);near(p.rect.width,p.rect.height);
      const draw=ctx.draws[0],uv=cast.members[1].anchors[frame];
      const painted=transformPoint(draw.m,draw.args[0]+uv[0]*draw.args[2],draw.args[1]+uv[1]*draw.args[3]);
      near(p.anchor.x,painted.x);near(p.anchor.y,painted.y);
      assert.deepEqual(ctx.getTransform(),{a:1,b:0,c:0,d:1,e:0,f:0});
    }
  }
  assert.equal(canvases.length,4,'cache is reused across viewports and facing');
  assert.deepEqual(canvases.map(c=>c.dataset.battleCastingFrame).join(','),'0,1,2,3');
  assert.ok(canvases.every(c=>c.dataset.battleCastingRow==='1'));
});

test('unmatched enemy and summon images use non-folded local mesh motion, not a whole-image affine',()=>{
  const {motion,actor,enemy,units}=setup(),image={naturalWidth:400,naturalHeight:600};enemy.art='wolf.png';
  const before=motion.snapshot(units);actor.curHp=900;motion.begin(enemy,enemy.skills[0],before,units,{now:0});
  const rect={x:640,y:80,width:90,height:135},ctx=new Context();ctx.shadowBlur=20;
  assert.equal(motion.drawActor(ctx,enemy,rect,390,()=>image),true);assert.equal(ctx.draws.length,72);
  assert.ok(ctx.draws.every(draw=>draw.shadow===0));assert.equal(ctx.shadowBlur,20);
  const matrices=new Set();for(const draw of ctx.draws){const m=draw.m;assert.ok(m.a*m.d-m.b*m.c>0);matrices.add([m.a,m.b,m.c,m.d].map(n=>n.toFixed(7)).join(','));}
  assert.ok(matrices.size>10,'different regions must have genuinely different affine samples');
  const later=new Context();motion.drawActor(later,enemy,rect,510,()=>image);assert.notEqual(JSON.stringify(ctx.draws.map(d=>d.m)),JSON.stringify(later.draws.map(d=>d.m)));
});

test('effects depart from actually painted sockets, reach targets on time, and counter damage starts from opponent',()=>{
  const {motion,actor,enemy,units}=setup(),image={naturalWidth:1774,naturalHeight:887};
  const before=motion.snapshot(units);enemy.curHp=800;actor.curHp=970;motion.begin(actor,actor.skills[0],before,units,{now:0});
  const time=430,ctx=new Context(),rect={x:70,y:70,width:60,height:120};
  motion.drawActor(ctx,actor,rect,time,()=>image);motion.drawActor(ctx,enemy,{x:710,y:70,width:60,height:120},time,()=>image);
  const info=motion.inspect(time),main=info.targets.find(t=>t.uid==='enemy'),counter=info.targets.find(t=>t.uid==='actor');
  assert.ok(main.start.x<main.end.x);assert.ok(counter.start.x>counter.end.x);
  motion.drawEffects(ctx,{width:1000,height:600},time);
  const routes=ctx.paths.filter(p=>p.kind==='stroke'&&p.path.length===23);assert.equal(routes.length,4);
  near(routes[0].path[0].x,main.start.x);near(routes[0].path[22].x,main.head.x);near(routes[0].path[22].y,main.head.y);
  assert.equal(motion.pose(enemy,time).flash,0);assert.equal(motion.pose(actor,time).hp,1000);
  const at=motion.inspect(main.impactAt).targets.find(t=>t.uid==='enemy');near(at.head.x,at.end.x);near(at.head.y,at.end.y);
});

test('single-action replacement and clear invalidate presentation while preserving all game values',()=>{
  const {motion,actor,enemy,units,randomCalls}=setup();const before=motion.snapshot(units);enemy.curHp=750;
  assert.equal(motion.begin(actor,{name:'Ultimate',ult:true},before,units,{now:0}),1300);const first=motion.inspect(0).token;
  assert.equal(motion.begin(enemy,{name:'Tactic',type:'attack'},motion.snapshot(units),units,{now:25}),1100);
  assert.ok(motion.inspect(25).token>first);assert.equal(motion.inspect(25).actorUid,'enemy');
  const state=JSON.stringify(units);motion.clear();assert.equal(motion.inspect(30).active,false);assert.equal(motion.pose(enemy,30).hp,750);
  assert.equal(JSON.stringify(units),state);assert.equal(randomCalls(),0);assert.ok(Object.isFrozen(motion));
});
