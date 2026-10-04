const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function runtime(){const scope={window:{},performance:{now:()=>0},Math:Object.assign(Object.create(Math),{random(){throw Error('visuals consumed battle RNG');}})};for(const file of ['spirit-codex-skill-performance.js','spirit-codex-battle-motion.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../playable',file),'utf8'),scope);return {sp:scope.window.SkillPerformance,motion:scope.window.BattleMotion};}
const unit=(uid,extra={})=>({uid,characterId:'H1',curHp:1000,maxHp:1000,shield:0,alive:true,isEnemy:false,buffs:[],debuffs:[],_artHeight:120,_artRect:{x:100,y:150,width:70,height:120},...extra});
test('48 articulated meshes keep feet fixed and every sampled triangle has positive area',()=>{
  const {sp}=runtime();for(const profile of Object.values(sp.profiles).flat())for(const p of [.15,.3,.45,.6,.75,.9]){
    const n=7,vertices=[];for(let row=0;row<=n;row++)for(let col=0;col<=n;col++){const q=sp.deform(profile,col/n,row/n,p,[.78,.35]);assert.ok(Number.isFinite(q.u)&&Number.isFinite(q.v));if(row===n){assert.ok(Math.abs(q.u-col/n)<1e-10);assert.ok(Math.abs(q.v-1)<1e-10);}vertices.push(q);}
    for(let r=0;r<n;r++)for(let c=0;c<n;c++){const a=r*(n+1)+c,b=a+1,d=a+n+2;for(const ids of [[a,b,d],[a,d,a+n+1]]){const [x,y,z]=ids.map(i=>vertices[i]);assert.ok((y.u-x.u)*(z.v-x.v)-(y.v-x.v)*(z.u-x.u)>0,profile.id);}}
  }
});
test('melee approaches selected target, faces either direction and returns to its starting lane',()=>{
  const {sp}=runtime(),actor=unit('actor',{characterId:'H2'}),far=unit('first',{isEnemy:true,_artRect:{x:800,y:80,width:70,height:120}}),chosen=unit('chosen',{isEnemy:true,_artRect:{x:650,y:350,width:70,height:120}});
  const action={actor,profile:sp.profiles.H2[2],start:0,duration:2500,selectedTargetUid:'chosen',targets:[{uid:'first',unit:far,kind:'damage'},{uid:'chosen',unit:chosen,kind:'damage'}]};
  const contact=sp.actorPose(action,1500);assert.ok(contact.dx>400);assert.ok(contact.dy>150);assert.equal(contact.facingX,1);assert.equal(sp.actorPose(action,2500).dx,0);
  chosen._artRect.x=-500;assert.equal(sp.actorPose(action,1500).facingX,-1);assert.ok(sp.actorPose(action,1500).dx< -500);
});
test('multi-hit timeline shows each actual HP/shield transition and recoil without changing rules',()=>{
  const {sp,motion}=runtime(),actor=unit('actor'),enemy=unit('target',{isEnemy:true,shield:50}),units=[actor,enemy],before=motion.snapshot(units);
  enemy.curHp=650;enemy.shield=0;const events=[{uid:'target',sourceUid:'actor',hpAfter:950,shieldAfter:0},{uid:'target',sourceUid:'actor',hpAfter:800,shieldAfter:0},{uid:'target',sourceUid:'actor',hpAfter:650,shieldAfter:0}];
  motion.begin(actor,{name:sp.profiles.H1[2].name},before,units,{now:0,hitEvents:events});const target=motion.inspect(0).targets[0],state=JSON.stringify(units);
  assert.equal(target.contacts.length,3);assert.equal(motion.pose(enemy,target.contacts[0].at-1).hp,1000);
  for(const beat of target.contacts){assert.equal(motion.pose(enemy,beat.at+180).hp,beat.event.hpAfter);assert.ok(motion.pose(enemy,beat.at+30).flash>.5);}
  assert.equal(JSON.stringify(units),state);
});
test('full-health intended heal stays visible without inventing a health delta',()=>{
  const {sp,motion}=runtime(),actor=unit('actor',{characterId:'L1'}),ally=unit('ally'),units=[actor,ally],before=motion.snapshot(units);
  motion.begin(actor,{name:sp.profiles.L1[1].name,type:'heal'},before,units,{now:0,selectedTargetUid:'ally',expectedTargetUids:['ally']});
  const target=motion.inspect(0).targets[0];assert.equal(target.uid,'ally');assert.equal(target.after.hp,target.before.hp);assert.equal(target.kind,'blessing');
});
test('new summons enter from sky or ground and settle in the real summon slot',()=>{
  const {sp,motion}=runtime();for(const id of ['A1','D2']){
    const actor=unit('actor',{characterId:id}),born=unit('born',{isSummon:true}),before=motion.snapshot([actor]);motion.begin(actor,{name:sp.profiles[id][1].name,type:'summon'},before,[actor,born],{now:0});
    const t=motion.inspect(0).targets[0];assert.equal(motion.pose(born,t.impactAt-1).opacity,0);const midway=motion.pose(born,t.impactAt+160);assert.ok(midway.opacity>0&&midway.opacity<1);assert.ok(id==='A1'?midway.dy<0:midway.dy>0);assert.ok(Math.abs(motion.pose(born,t.impactAt+700).dy)<1e-10);
  }
});
test('profiled reduced motion and cancellation retain exact outcome with no displacement',()=>{
  const {sp,motion}=runtime(),actor=unit('actor',{characterId:'D1'}),enemy=unit('enemy',{isEnemy:true}),before=motion.snapshot([actor,enemy]);enemy.curHp=450;
  assert.equal(motion.begin(actor,{name:sp.profiles.D1[3].name},before,[actor,enemy],{now:0,reduced:true}),180);assert.equal(motion.pose(actor,90).dx,0);assert.equal(motion.pose(enemy,90).hp,450);assert.equal(motion.pose(enemy,90).flash,0);motion.clear();assert.equal(motion.inspect(100).active,false);assert.equal(enemy.curHp,450);
});
