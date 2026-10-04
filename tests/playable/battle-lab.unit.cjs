/* Run with: node --test tests/playable/battle-lab.unit.cjs
 * Isolated VM tests, no browser, server, user profile, or filesystem writes.
 * DOM/engine cleanup are stubs; persistence guards execute the real game source.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const project = path.resolve(__dirname, '../..');
const labSource = fs.readFileSync(path.join(project, 'playable/spirit-codex-battle-lab.js'), 'utf8');
const gameSource = fs.readFileSync(path.join(project, 'playable/spirit-codex-game.js'), 'utf8');

function gameFunction(name, next) {
  const start = gameSource.indexOf(`function ${name}(`);
  const end = gameSource.indexOf(`function ${next}(`, start + 1);
  assert.ok(start >= 0 && end > start, `Actual game function exists: ${name}`);
  return gameSource.slice(start, end);
}
function harness() {
  const writes = [], removals = [], uiCalls = [], formalRandom = () => .46, formalRunRandom = () => .73;
  const profile = { resources:{ink:19,elementDust:7,essence:4}, inventory:{ember:2,tide:1,soul:0},
    settings:{autoStrategyId:'steady'}, stats:{runs:8} };
  const ally = {uid:10, characterId:'H1', alive:true, art:'hero.png', energy:60};
  const formalState = {team:[1,2,3,4], formationSlots:{front:[1,2],back:[3,4],reserve:[null,null]},
    progression:profile, run:{flowEpoch:3,nested:{value:6}}, allies:[ally], enemies:[{uid:11,alive:true,art:'enemy.png'}],
    turnOrder:[ally], battleToken:7, phase:'idle'};
  const battle = {inert:false, classList:{contains:name => name === 'screen'}};
  const context = {
    state:formalState, autoBattle:true, inBattle:false, UID:20, randomOverride:formalRandom, runRandomSource:formalRunRandom,
    SC:{}, document:{querySelector:() => ({id:'town-screen'}),activeElement:null,
      getElementById:id => id === 'battle-screen' ? battle : null,body:{classList:{remove:name => uiCalls.push(['removeClass',name])}}},
    createDefaultProgression:() => ({resources:{ink:0,elementDust:0,essence:0},inventory:{ember:2,tide:2,soul:2},settings:{},stats:{runs:0}}),
    createSeededRandom:() => () => .2, hashSeed:() => 1,
    clearBattleSession:() => {
      // Cleanup deliberately mutates nested state to catch shallow-copy leaks.
      if (context.state.run) context.state.run.flowEpoch++;
      context.state.run = null; context.state.battleToken++; context.inBattle = false;
      context.runRandomSource = null;
      uiCalls.push(['clear',context.SC.BattleLab.isActive()]);
    },
    invalidateAutoDecision:() => uiCalls.push(['invalidate']), updateAutoBattleButton:() => uiCalls.push(['auto',context.autoBattle]),
    showScreen:screen => uiCalls.push(['screen',screen]),
    setProgressionSaveStatus:() => {}, renderProgression:() => {}, setProgressionMessage:() => {},
    normalizeProgression:value => JSON.parse(JSON.stringify(value)),
    PROGRESSION_RULES:{saveKey:'unit-test-only'},
    localStorage:{setItem:(key,value) => writes.push([key,value]),removeItem:key => removals.push(key)},
    COMBO_RECIPES:[{id:'phoenix',name:'炎羽天陨',itemId:'ember',casting:{src:'cast.png'},rig:{src:'rig.png',combat:{src:'side.png'}}}],
    COMBO_ITEMS:{ember:{id:'ember',name:'灰烬触媒'}},
    COMBO_STAGE_ART:{arena:'arena.png',texture:'texture.png',attack:'attack.png'},
    comboAvailability:() => ({ready:true,reasons:[]}),
    preloadArt:() => Promise.resolve(),
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(labSource, context, {filename:'spirit-codex-battle-lab.js'});
  const originals = {fields:{...context.state}, auto:context.autoBattle, random:formalRandom, runRandom:formalRunRandom, uid:20};
  return {context, lab:context.SC.BattleLab, originals, writes, removals, uiCalls, battle};
}

test('entry detaches the complete formal graph and preserves internal references', () => {
  const {context:c,lab,originals:o} = harness();
  assert.equal(lab.beforeEnter(), true);
  assert.equal(lab.isActive(), true);
  assert.notEqual(c.state.team, o.fields.team);
  assert.notEqual(c.state.formationSlots, o.fields.formationSlots);
  assert.notEqual(c.state.formationSlots.front, o.fields.formationSlots.front);
  assert.notEqual(c.state.run, o.fields.run);
  assert.notEqual(c.state.progression, o.fields.progression);
  assert.notEqual(c.state.allies[0], o.fields.allies[0]);
  assert.equal(c.state.allies[0], c.state.turnOrder[0], 'Training graph keeps unit identity');
  c.state.team[0] = 99; c.state.formationSlots.front[0] = 99;
  c.state.run.nested.value = 100; c.state.progression.resources.ink = 900;
  assert.deepEqual(o.fields.team, [1,2,3,4]);
  assert.equal(o.fields.run.nested.value, 6);
  assert.equal(o.fields.progression.resources.ink, 19);
  const trainingProfile = c.state.progression;
  assert.equal(lab.beforeEnter(), true);
  assert.equal(c.state.progression, trainingProfile, 'Repeated entry does not overwrite the original snapshot');
});

test('exit restores formal references, auto/RNG/UID and keeps callback tokens monotonic', () => {
  const {context:c,lab,originals:o,uiCalls} = harness();
  lab.beforeEnter(); c.state.run.nested.value = 100; c.UID = 900; c.autoBattle = false;
  c.state.battleToken = 50; c.state.trainingOnlyExtra = {value:1};
  assert.equal(lab.restore(), true);
  Object.entries(o.fields).filter(([key]) => key !== 'battleToken').forEach(([key,value]) => assert.equal(c.state[key], value, key));
  assert.equal(c.state.run.flowEpoch, 3, 'Cleanup mutated only the detached run');
  assert.equal(c.state.run.nested.value, 6);
  assert.equal(c.autoBattle, o.auto); assert.equal(c.randomOverride, o.random); assert.equal(c.runRandomSource, o.runRandom); assert.equal(c.UID, o.uid);
  assert.ok(c.state.battleToken > 50);
  assert.equal(Object.hasOwn(c.state, 'trainingOnlyExtra'), false);
  assert.equal(Object.hasOwn(c.state, 'training'), false);
  assert.ok(uiCalls.some(call => call[0] === 'clear' && call[1] === true), 'Save guard remains active during cleanup');
  assert.ok(uiCalls.some(call => call[0] === 'screen' && call[1] === 'town-screen'));
  assert.equal(lab.isActive(), false);
});

test('repeated exit is a no-op and an existing formal battle refuses entry', () => {
  const {context:c,lab,originals:o} = harness();
  c.inBattle = true;
  assert.equal(lab.beforeEnter(), false); assert.equal(lab.isActive(), false);
  assert.equal(c.state.progression, o.fields.progression); assert.equal(c.state.run, o.fields.run);
  c.inBattle = false; lab.beforeEnter(); lab.restore();
  const token = c.state.battleToken;
  assert.equal(lab.restore(), false); assert.equal(c.state.battleToken, token);
});

test('an originally nullable training flag is restored exactly', () => {
  const {context:c,lab} = harness();
  c.state.training = null;
  lab.beforeEnter(); assert.equal(c.state.training.active, true); lab.restore();
  assert.equal(Object.hasOwn(c.state, 'training'), true);
  assert.equal(c.state.training, null);
});

test('actual persistence functions commit only training memory, block reset and award no loot', () => {
  const {context:c,lab,originals:o,writes,removals} = harness();
  const declarations = [['persistProgression','saveProgression'],['saveProgression','commitProgression'],
    ['commitProgression','expeditionSettings'],['resetProgression','characterProgress'],['awardExpeditionProgression','createRunState']];
  declarations.forEach(([name,next]) => vm.runInContext(gameFunction(name,next), c, {filename:`actual-game-${name}.js`}));
  lab.beforeEnter();
  const training = c.state.progression;
  assert.equal(c.saveProgression(), true);
  assert.equal(c.commitProgression(draft => { draft.inventory.ember--; }), true);
  assert.notEqual(c.state.progression, training, 'Commit replaces only the disposable profile');
  assert.equal(c.state.progression.inventory.ember, 1);
  const committed = c.state.progression;
  assert.equal(c.commitProgression(draft => { draft.inventory.ember = 0; return false; }), false);
  assert.equal(c.state.progression, committed, 'Rejected mutation does not replace memory');
  assert.equal(c.resetProgression(), false);
  const reward = c.awardExpeditionProgression();
  assert.equal(reward.training, true);
  ['ink','elementDust','essence','masteryXp'].forEach(key => assert.equal(reward[key], 0));
  assert.equal(writes.length, 0); assert.equal(removals.length, 0);
  assert.equal(o.fields.progression.inventory.ember, 2);
  lab.restore();
  assert.equal(c.saveProgression(), true);
  assert.equal(writes.length, 1, 'Formal persistence works again after exit');
  assert.equal(JSON.parse(writes[0][1]).resources.ink, 19);
  assert.equal(JSON.parse(writes[0][1]).inventory.ember, 2);
});

test('closing during asynchronous art preload never executes or consumes a late combo', async () => {
  const {context:c,lab,originals:o,battle} = harness();
  let resolveArt, casts = 0;
  c.preloadArt = () => new Promise(resolve => { resolveArt = resolve; });
  c.SC.executeCombo = () => { casts++; return true; };
  lab.beforeEnter();
  c.autoBattle = false; // prepareCombo establishes manual mode in the full UI.
  const pending = lab.castCombo('phoenix');
  assert.equal(battle.inert, true);
  assert.equal(typeof resolveArt, 'function');
  lab.restore(); resolveArt();
  assert.equal(await pending, false);
  assert.equal(casts, 0);
  assert.equal(c.state.progression, o.fields.progression);
  assert.equal(c.state.progression.inventory.ember, 2);
});

test('late preload from an earlier lab session cannot execute in a reopened session', async () => {
  const {context:c,lab} = harness();
  let resolveOld, casts = 0;
  c.preloadArt = () => new Promise(resolve => { resolveOld = resolve; });
  c.SC.executeCombo = () => { casts++; return true; };
  lab.beforeEnter();
  c.autoBattle = false;
  const old = lab.castCombo('phoenix');
  lab.restore(); lab.beforeEnter();
  const reopened = c.state.progression;
  resolveOld();
  assert.equal(await old, false);
  assert.equal(casts, 0); assert.equal(c.state.progression, reopened);
  assert.equal(lab.isActive(), true);
  lab.restore();
});
