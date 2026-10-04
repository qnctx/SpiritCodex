'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=name=>fs.readFileSync(path.join(__dirname,'../../playable',name),'utf8');
function harness(){
  let wall=0,id=0;const jobs=new Map(),ctx={performance:{now:()=>wall},setTimeout:(fn,delay)=>{jobs.set(++id,{fn,at:wall+delay});return id;},clearTimeout:key=>jobs.delete(key)};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(source('spirit-codex-battle-clock.js'),ctx);
  return {clock:ctx.BattleClock,advance(ms){const end=wall+ms;let safety=1000;while(safety--){const item=[...jobs].filter(([,j])=>j.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!item)break;wall=item[1].at;jobs.delete(item[0]);item[1].fn();}assert.ok(safety>0);wall=end;},wall:()=>wall,jobs};
}
test('mid-action speed changes preserve game-time continuity and only remaining time is accelerated',()=>{
  const h=harness(),c=h.clock,hits=[];c.schedule(()=>hits.push(h.wall()),1000);h.advance(300);assert.equal(c.now(),300);
  assert.equal(c.setRate(2),2);assert.equal(c.now(),300);h.advance(200);assert.equal(c.now(),700);assert.deepEqual(hits,[]);
  c.setRate(1);assert.equal(c.now(),700);h.advance(299);assert.deepEqual(hits,[]);h.advance(1);assert.deepEqual(hits,[800]);h.advance(5000);assert.equal(hits.length,1);
});
test('all multi-hit beats, completion, and callback-scheduled turns share the same double-speed clock',()=>{
  const h=harness(),c=h.clock,events=[];c.setRate(2);for(const at of [100,600,700,1000])c.schedule(()=>events.push([at,h.wall()]),at);
  c.schedule(()=>c.schedule(()=>events.push(['turn',h.wall()]),120),1000);h.advance(560);
  assert.deepEqual(events,[[100,50],[600,300],[700,350],[1000,500],['turn',560]]);assert.equal(c.inspect().pending,0);
});
test('cancel and clear invalidate callbacks even after repeated speed toggles; invalid rates cannot alter state',()=>{
  const h=harness(),c=h.clock;let fired=0;const id=c.schedule(()=>fired++,500);c.schedule(()=>fired++,500);
  assert.equal(c.cancel(id),true);assert.equal(c.cancel(id),false);for(let i=0;i<100;i++){h.advance(1);c.setRate(i%2+1);}const time=c.now();
  for(const rate of [0,-1,3,NaN,'2',null])assert.equal(c.setRate(rate),false);assert.equal(c.now(),time);c.clear();h.advance(10000);assert.equal(fired,0);assert.equal(h.jobs.size,0);
});
function facing(){const ctx={};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(source('spirit-codex-battle-facing.js'),ctx);return ctx.BattleFacing;}
test('inspection pause freezes the clock and resumes only the remaining part of a double-speed action',()=>{
  const h=harness(),c=h.clock,hits=[];c.setRate(2);c.schedule(()=>hits.push(h.wall()),1000);h.advance(200);
  assert.equal(c.pause('report'),true);assert.equal(c.now(),400);assert.equal(c.paused,true);assert.equal(h.jobs.size,0);
  h.advance(5000);assert.equal(c.now(),400);assert.deepEqual(hits,[]);assert.equal(c.resume('report'),true);
  h.advance(299);assert.deepEqual(hits,[]);h.advance(1);assert.deepEqual(hits,[5500]);h.advance(1000);assert.equal(hits.length,1);
});
test('pause owners are independent, duplicate and unknown owners cannot release another pause',()=>{
  const h=harness(),c=h.clock;let fired=0;c.schedule(()=>fired++,10);assert.equal(c.pause('report'),true);assert.equal(c.pause('report'),false);assert.equal(c.pause('other'),true);
  assert.equal(c.resume('unknown'),false);c.resume('report');assert.equal(c.paused,true);h.advance(100);assert.equal(fired,0);
  c.resume('other');assert.equal(c.paused,false);h.advance(10);assert.equal(fired,1);
});
test('scheduling and changing speed while paused do not start callbacks or advance game time',()=>{
  const h=harness(),c=h.clock,events=[];h.advance(30);c.pause('report');c.schedule(()=>{events.push(c.now());c.schedule(()=>events.push(c.now()),100);},100);
  c.setRate(2);h.advance(10000);assert.equal(c.now(),30);assert.equal(h.jobs.size,0);c.resume('report');h.advance(100);assert.deepEqual(events,[130,230]);
});
test('clearing a paused session cannot leak callbacks after resume or a new battle',()=>{
  const h=harness(),c=h.clock;let fired=0;c.schedule(()=>fired++,0);c.pause('report');c.clear();h.advance(500);c.resume('report');h.advance(500);assert.equal(fired,0);
  c.schedule(()=>fired++,1);h.advance(1);assert.equal(fired,1);assert.equal(c.inspect().pending,0);
});
test('every hero, enemy and summon artwork in the real data has explicit validated source-facing and socket',()=>{
  const f=facing(),arts=[...new Set([...source('spirit-codex-data.js').matchAll(/art:'(assets\/(?:characters|summons|enemies)\/[^']+)'/g)].map(x=>x[1]))];
  assert.equal(arts.length,20);assert.equal(f.validate(arts.map(art=>({art}))).length,0);
  for(const art of arts){const row=f.catalog[art];assert.ok([-1,1].includes(row.sourceFacing));assert.equal(row.socket.length,2);assert.ok(row.socket.every(v=>v>0&&v<1));}
  assert.equal(f.validate([{art:'assets/summons/new-pet.png'}]).length,1);
});
test('left-authored wind eagle mirrors towards right-hand foes, including its actual beak, and reverses for left-hand foes',()=>{
  const f=facing(),eagle={art:'assets/summons/summon-wind-eagle.png',_x:200},enemy={isEnemy:true,_x:700};
  const right=f.pose(eagle,enemy);assert.equal(right.facing,1);assert.equal(right.mirror,-1);assert.equal(1-right.socket[0],.595);
  enemy._x=20;const left=f.pose(eagle,enemy);assert.equal(left.facing,-1);assert.equal(left.mirror,1);
  assert.equal(f.pose(eagle,null).mirror,-1);enemy._x=eagle._x;assert.equal(f.direction(eagle,enemy),1);
});
test('art-space mirror multiplied by source-facing always equals intended combat direction',()=>{
  const f=facing();for(const art of Object.keys(f.catalog))for(const isEnemy of [true,false])for(const x of [0,100,500]){
    const unit={art,isEnemy,_x:100},target={_x:x};const p=f.pose(unit,target);assert.equal(p.mirror*p.sourceFacing,p.facing);assert.equal(p.facing,x===100?isEnemy?-1:1:Math.sign(x-100));
  }
});
