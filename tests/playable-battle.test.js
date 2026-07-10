const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadBattle() {
  const html = fs.readFileSync('playable/spirit-codex.html', 'utf8');
  const match = html.match(/<script>([\s\S]*)<\/script>/);
  assert.ok(match, 'inline battle script exists');

  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) {
      elements.set(id, {
        id,
        innerHTML: '',
        textContent: '',
        className: '',
        disabled: false,
        style: {},
        classList: { add() {}, remove() {}, contains() { return true; } },
        appendChild() {},
        remove() {},
        getBoundingClientRect() { return { width: 800, height: 600 }; },
        getContext() { return {}; },
        parentElement: { clientWidth: 800, clientHeight: 600, getBoundingClientRect() { return { width: 800, height: 600 }; } },
      });
    }
    return elements.get(id);
  }

  const listeners = [];
  const context = vm.createContext({
    console,
    Math: Object.create(Math),
    document: {
      getElementById: element,
      querySelectorAll() { return []; },
      createElement() { return element(Symbol('created')); },
    },
    window: { addEventListener(type, handler) { listeners.push({ type, handler }); } },
    requestAnimationFrame() {},
    setTimeout() {},
  });
  context.Math.random = () => 0.99;
  const expose = `\n;globalThis.__battle = { CHARACTERS, ENEMIES, makeBattleChar, playerAction, enemyAction, processDOT, endBattle, initBattleCanvas, setState(value) { state = value; }, getState() { return state; } };`;
  new vm.Script(match[1] + expose, { filename: 'playable/spirit-codex.html' }).runInContext(context);
  vm.runInContext('spawnFloatText=()=>{}; renderBattle=()=>{}; updateHUD=()=>{}; updateTurnOrder=()=>{}; spawnSkillParticles=()=>{};', context);
  return { battle: context.__battle, element, listeners };
}

function baseState(allies, enemies, current = allies[0]) {
  return {
    team: [], wave: 0, turn: 1, turnOrder: [current], currentTurnIdx: 0,
    allies, enemies, battlePhase: 'player', selectedSkill: null, particles: [],
    floatTexts: [], totalKills: 0,
  };
}

test('healing ultimate heals by each ally max HP, cleanses, and spends energy', () => {
  const { battle } = loadBattle();
  const healer = battle.makeBattleChar(battle.CHARACTERS[3], false);
  healer.curHp = 160;
  healer.energy = 100;
  const ally = { ...battle.makeBattleChar(battle.CHARACTERS[0], false), hp: 500, maxHp: 500, curHp: 100, debuffs: [{ type: 'atkBreak', turns: 2 }], dot: [{ type: 'burn', turns: 2 }] };
  const enemy = battle.makeBattleChar(battle.ENEMIES[0][0], true);
  battle.setState(baseState([healer, ally], [enemy], healer));

  battle.playerAction(2);

  assert.equal(healer.curHp, 288);
  assert.equal(ally.curHp, 300);
  assert.equal(ally.debuffs.length, 0);
  assert.equal(ally.dot.length, 0);
  assert.equal(healer.energy, 0);
  assert.equal(enemy.curHp, enemy.maxHp);
});

test('shield-and-heal ultimate applies both effects without damaging the enemy', () => {
  const { battle } = loadBattle();
  const support = battle.makeBattleChar(battle.CHARACTERS[11], false);
  support.curHp = 100;
  support.energy = 100;
  const ally = battle.makeBattleChar(battle.CHARACTERS[0], false);
  ally.curHp = 100;
  const enemy = battle.makeBattleChar(battle.ENEMIES[0][0], true);
  battle.setState(baseState([support, ally], [enemy], support));

  battle.playerAction(2);

  assert.equal(support.curHp, 166);
  assert.equal(ally.curHp, 156);
  assert.equal(support.shield, 174);
  assert.equal(ally.shield, 174);
  assert.equal(support.energy, 0);
  assert.equal(enemy.curHp, enemy.maxHp);
});

test('three-turn attack break survives exactly three target actions', () => {
  const { battle } = loadBattle();
  const caster = battle.makeBattleChar(battle.CHARACTERS[9], false);
  const enemy = battle.makeBattleChar(battle.ENEMIES[0][0], true);
  battle.setState(baseState([caster], [enemy], caster));
  battle.playerAction(1);
  assert.equal(enemy.debuffs.find(item => item.type === 'atkBreak').turns, 3);

  const target = battle.makeBattleChar(battle.CHARACTERS[0], false);
  battle.setState(baseState([target], [enemy], enemy));
  battle.enemyAction(enemy);
  assert.equal(enemy.debuffs[0].turns, 2);
  battle.enemyAction(enemy);
  assert.equal(enemy.debuffs[0].turns, 1);
  battle.enemyAction(enemy);
  assert.equal(enemy.debuffs.length, 0);
});

test('regular percentage healing uses each target max HP', () => {
  const { battle } = loadBattle();
  const healer = battle.makeBattleChar(battle.CHARACTERS[3], false);
  healer.curHp = 100;
  const ally = battle.makeBattleChar(battle.CHARACTERS[0], false);
  ally.curHp = 100;
  const enemy = battle.makeBattleChar(battle.ENEMIES[0][0], true);
  battle.setState(baseState([healer, ally], [enemy], healer));

  battle.playerAction(1);

  assert.equal(healer.curHp, 164);
  assert.equal(ally.curHp, 156);
});

test('damage applies target DEF', () => {
  const { battle } = loadBattle();
  const attacker = battle.makeBattleChar(battle.CHARACTERS[0], false);
  const target = { ...battle.makeBattleChar(battle.ENEMIES[1][2], true), hp: 1000, maxHp: 1000, curHp: 1000, def: 40 };
  battle.setState(baseState([attacker], [target], attacker));

  battle.playerAction(0);

  assert.equal(target.curHp, 869); // floor(95 * 1.2 * 1.5) - 40
});

test('control skips one target action and timed debuffs then expire', () => {
  const { battle } = loadBattle();
  const unit = battle.makeBattleChar(battle.ENEMIES[0][0], true);
  const target = battle.makeBattleChar(battle.CHARACTERS[0], false);
  unit.debuffs = [{ type: 'frozen', turns: 1 }, { type: 'atkBreak', turns: 2, val: 0.2 }];
  battle.setState(baseState([target], [unit], unit));

  battle.enemyAction(unit);
  assert.equal(target.curHp, target.maxHp);
  assert.deepEqual(unit.debuffs.map(item => [item.type, item.turns]), [['atkBreak', 1]]);

  battle.enemyAction(unit);
  assert.ok(target.curHp < target.maxHp);
  assert.equal(unit.debuffs.length, 0);
});

test('battle result reports cumulative kills across waves', () => {
  const { battle, element } = loadBattle();
  const deadBoss = battle.makeBattleChar(battle.ENEMIES[2][0], true);
  deadBoss.alive = false;
  battle.setState({ ...baseState([], [deadBoss], deadBoss), wave: 2, totalKills: 7 });

  battle.endBattle(true);

  assert.match(element('result-detail').textContent, /击败7个敌人/);
});

test('battle canvas registers one resize listener across repeated starts', () => {
  const { battle, listeners } = loadBattle();

  battle.initBattleCanvas();
  battle.initBattleCanvas();

  assert.equal(listeners.filter(item => item.type === 'resize').length, 1);
});

test('DropSystem checks materialCountText before dereferencing it', () => {
  const source = fs.readFileSync('LingsuMVP/Assets/Scripts/DropSystem.cs', 'utf8');
  const method = source.slice(source.indexOf('private void PlayMaterialFlyEffect'), source.indexOf('private Sprite GetMaterialIconSprite'));
  assert.ok(method.indexOf('materialCountText == null') < method.indexOf('materialCountText.GetComponentInParent<Canvas>()'));
});
