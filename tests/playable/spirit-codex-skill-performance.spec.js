const {test,expect}=require('@playwright/test');
test.afterEach(async({page})=>{await page.evaluate(()=>{if(window.SC?.BattleLab?.isActive())closeBattleLab();});await page.clock.resume();});
const IDS=['H1','H2','W1','W2','A1','A2','T1','T2','D1','D2','L1','L2'];
async function load(page){
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/playable/spirit-codex.html');await page.evaluate(()=>SC.preloadArt());
  await page.clock.install();await page.clock.pauseAt(Date.now()+1000);
  await page.evaluate(()=>openBattleLab());await page.clock.fastForward(32);return errors;
}
async function draw(page){return page.evaluate(()=>{
  const canvas=document.querySelector('#battle-canvas'),ctx=canvas.getContext('2d'),calls={images:0,arcs:0,ellipses:0,curves:0,lines:0,triangles:0};
  const originals={};for(const [method,key]of Object.entries({drawImage:'images',arc:'arcs',ellipse:'ellipses',quadraticCurveTo:'curves',lineTo:'lines',clip:'triangles'})){originals[method]=ctx[method];ctx[method]=function(...args){calls[key]++;return originals[method].apply(this,args);};}
  try{drawScene(performance.now());}finally{for(const [method,fn]of Object.entries(originals))ctx[method]=fn;}
  const probe=document.createElement('canvas');probe.width=128;probe.height=80;probe.getContext('2d').drawImage(canvas,0,0,128,80);let hash=2166136261;for(const value of probe.getContext('2d').getImageData(0,0,128,80).data)hash=Math.imul(hash^value,16777619)>>>0;
  return {calls,hash,action:BattleMotion.inspect(),units:[...SC.state.allies,...SC.state.enemies].map(u=>({uid:String(u.uid),enemy:u.isEnemy,summon:u.isSummon,actual:u.curHp,visual:u._visual,hud:u._hud,rect:u._artRect}))};
});}
test('all 48 skills have independent directions and do not derive their identity from multipliers',async({page})=>{
  await load(page);const data=await page.evaluate(()=>SC.CHARACTERS.flatMap(c=>c.skills.map((s,i)=>({id:c.id+':'+i,p:SkillPerformance.profileFor({characterId:c.id},s),same:SkillPerformance.profileFor({characterId:c.id},{...s,mult:99})?.id}))));
  expect(data).toHaveLength(48);expect(new Set(data.map(x=>x.p.effect)).size).toBe(48);expect(new Set(data.map(x=>x.p.gesture)).size).toBe(48);
  for(const item of data){expect(item.p.id).toBe(item.id);expect(item.same).toBe(item.id);}
});
for(const id of IDS)test(`${id}: four real skills animate against actual selected recipients with distinct painted motion`,async({page})=>{
  test.setTimeout(90000);const errors=await load(page);await page.evaluate(id=>SC.BattleLab.selectCharacter(id),id);
  const signatures=[];
  for(let index=0;index<4;index++){
    const setup=await page.evaluate(index=>{
      SC.BattleLab.prepareSkillTest();SC.BattleLab.selectTestTarget('enemy',SC.state.enemies[1].uid);
      const ally=SC.state.allies.find(u=>u.alive&&u!==SC.state.turnOrder[0]);if(ally)SC.BattleLab.selectTestTarget('ally',ally.uid);
      return {skill:{...SC.state.turnOrder[0].skills[index]},selected:String(SC.state.enemies[1].uid),before:SC.state.enemies.map(u=>({uid:String(u.uid),hp:u.curHp})),saved:localStorage.getItem(SC.PROGRESSION_RULES?.saveKey||'spirit-codex-progression-v1')};
    },index);
    await page.clock.fastForward(32);expect(await page.evaluate(index=>SC.BattleLab.useSkill(index),index)).toBe(true);
    const initial=await page.evaluate(()=>BattleMotion.inspect());expect(initial.profile.id).toBe(id+':'+index);
    if(setup.skill.type==='attack'){expect(initial.selectedTargetUid).toBe(setup.selected);expect(initial.targets.some(t=>t.uid===setup.selected)).toBe(true);if(!setup.skill.chain)expect(initial.targets.filter(t=>t.before.isEnemy&&t.kind==='damage').map(t=>t.uid)).toEqual([setup.selected]);}
    const elapsed=initial.duration*.45;await page.clock.fastForward(elapsed);const wind=await draw(page);
    expect(wind.calls.images).toBeGreaterThan(90);expect(wind.calls.triangles).toBeGreaterThan(90);
    const first=initial.targets.find(t=>t.kind==='damage'&&t.before.isEnemy);
    if(first&&elapsed<first.impactAt-initial.start)expect(wind.units.find(u=>u.uid===first.uid).visual.hp).toBe(first.before.hp);
    await page.clock.fastForward(initial.duration*.28);const release=await draw(page);
    expect(release.hash).not.toBe(wind.hash);signatures.push(JSON.stringify(release.calls)+release.hash);
    for(const target of release.action.targets){expect(Number.isFinite(target.end.x)).toBe(true);expect(Number.isFinite(target.end.y)).toBe(true);}
    await page.clock.fastForward(initial.duration*.27+180);expect(await page.evaluate(()=>SC.state.phase)).toBe('player');
    for(const target of initial.targets){const result=await page.evaluate(uid=>{const unit=[...SC.state.allies,...SC.state.enemies].find(u=>String(u.uid)===uid);return unit&&BattleMotion.pose(unit).hp;},target.uid);expect(result).toBe(target.after.hp);}
  }
  expect(new Set(signatures).size).toBe(4);expect(errors).toEqual([]);await page.evaluate(()=>closeBattleLab());
});
test('arrow rain has three real HP beats and chain lightning starts from the chosen second enemy',async({page})=>{
  const errors=await load(page);await page.evaluate(()=>{SC.BattleLab.selectCharacter('H1');SC.BattleLab.prepareSkillTest();});await page.clock.fastForward(32);
  await page.evaluate(()=>SC.BattleLab.useSkill(2));const action=await page.evaluate(()=>BattleMotion.inspect()),target=action.targets.find(t=>t.before.isEnemy);
  expect(target.contacts).toHaveLength(3);expect(target.contacts.map(b=>b.event.hpAfter)).toEqual([...target.contacts.map(b=>b.event.hpAfter)].sort((a,b)=>b-a));
  let elapsed=0;for(const beat of target.contacts){const at=Math.ceil(beat.at-action.start);await page.clock.fastForward(at+200-elapsed);elapsed=at+200;const frame=await draw(page);expect(frame.units.find(u=>u.uid===target.uid).visual.hp).toBe(beat.event.hpAfter);}
  await page.clock.fastForward(Math.ceil(action.duration-elapsed+200));
  await page.evaluate(()=>{SC.BattleLab.selectCharacter('T2');SC.BattleLab.prepareSkillTest();SC.BattleLab.selectTestTarget('enemy',SC.state.enemies[1].uid);});await page.clock.fastForward(32);await page.evaluate(()=>SC.BattleLab.useSkill(2));
  await page.clock.fastForward(2100);const frame=await draw(page),hits=frame.action.targets.filter(t=>t.before.isEnemy);
  expect(hits).toHaveLength(3);expect(hits[0].uid).toBe(frame.action.selectedTargetUid);
  hits.slice(1).forEach((hit,index)=>{const previous=hits[index],prev=frame.units.find(u=>u.uid===previous.uid);expect(hit.start.x).toBeCloseTo(prev.rect.x+prev.rect.width/2+prev.visual.dx,0);expect(hit.impactAt).toBeGreaterThan(previous.impactAt);});
  expect(errors).toEqual([]);
});
test('target controls preserve the chosen lethal recipient and full-health support has an honest visible recipient',async({page})=>{
  const errors=await load(page);await page.evaluate(()=>{SC.BattleLab.selectCharacter('H1');SC.BattleLab.prepareSkillTest();SC.state.enemies[1].curHp=1;});
  const uid=await page.evaluate(()=>String(SC.state.enemies[1].uid));await page.selectOption('#battle-lab-enemy-target',uid);await page.locator('#battle-lab-basic').click();
  await page.clock.fastForward(300);expect(await page.locator('#battle-lab-enemy-target').inputValue()).toBe(uid);
  const before=await draw(page);expect(before.units.find(u=>u.uid===uid).visual.alive).toBe(true);expect(before.action.selectedTargetUid).toBe(uid);
  await page.clock.fastForward(900);await page.evaluate(()=>{SC.BattleLab.selectCharacter('L1');SC.BattleLab.refill();});
  await page.locator('#battle-lab-ally-target').selectOption({index:1});const chosen=await page.locator('#battle-lab-ally-target').inputValue();
  await page.evaluate(()=>SC.BattleLab.useSkill(1));const heal=await page.evaluate(()=>BattleMotion.inspect());
  expect(heal.targets.map(t=>t.uid)).toContain(chosen);const beneficiary=heal.targets.find(t=>t.uid===chosen);expect(beneficiary.before.hp).toBe(beneficiary.after.hp);
  expect(heal.targets.filter(t=>t.before.isEnemy)).toHaveLength(0);expect(errors).toEqual([]);
});
test('preparing and cancelling individual skills does not write a formal save or leave a delayed attack',async({page})=>{
  const errors=await load(page);await page.evaluate(()=>{window.skillLabWrites=[];for(const method of ['setItem','removeItem','clear']){const fn=Storage.prototype[method];Storage.prototype[method]=function(...args){if(this===localStorage)window.skillLabWrites.push(method);return fn.apply(this,args);};}});
  for(const id of ['H1','D2','L1']){await page.evaluate(id=>{SC.BattleLab.selectCharacter(id);SC.BattleLab.prepareSkillTest();SC.BattleLab.useSkill(3);},id);await page.clock.fastForward(750);await page.evaluate(()=>SC.BattleLab.resetTargets());}
  await page.evaluate(()=>closeBattleLab());await page.clock.fastForward(10000);
  expect(await page.evaluate(()=>({writes:window.skillLabWrites,active:BattleMotion.inspect().active,lab:SC.BattleLab.isActive()}))).toEqual({writes:[],active:false,lab:false});expect(errors).toEqual([]);
});
