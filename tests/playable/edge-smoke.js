const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const root = fs.realpathSync(path.resolve(__dirname, '..', '..'));
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const serverPort = Number(process.env.EDGE_SMOKE_PORT || 4174);
const debugPort = Number(process.env.EDGE_SMOKE_DEBUG_PORT || 9223);
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp'
};
let server;
let browser;
let profile;

function request(url) {
  return new Promise((resolve, reject) => http.get(url, response => {
    let data = '';
    response.on('data', chunk => data += chunk);
    response.on('end', () => resolve(JSON.parse(data)));
  }).on('error', reject));
}

async function waitFor(fn, timeout = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try { const result = await fn(); if (result) return result; } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Timed out waiting for browser');
}

async function main() {
  profile = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-codex-edge-'));
  server = http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end('Method not allowed'); return; }
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    const file = path.resolve(root, '.' + pathname);
    if ((file !== root && !file.startsWith(root + path.sep)) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    const realFile = fs.realpathSync(file);
    if (realFile !== root && !realFile.startsWith(root + path.sep)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(realFile)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(realFile).pipe(res);
  }).listen(serverPort, '127.0.0.1');

  browser = spawn(edge, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`,
    `http://127.0.0.1:${serverPort}/playable/spirit-codex.html`,
  ], { stdio: 'ignore' });

  const target = await waitFor(async () => {
    const targets = await request(`http://127.0.0.1:${debugPort}/json`);
    return targets.find(item => item.type === 'page' && item.url.includes('spirit-codex.html'));
  });
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0;
  const pending = new Map();
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
  };
  const send = (method, params = {}) => new Promise(resolve => {
    const current = ++id; pending.set(current, resolve); socket.send(JSON.stringify({ id: current, method, params }));
  });
  await send('Runtime.enable');
  await waitFor(async () => {
    const result = await send('Runtime.evaluate', { expression: 'document.readyState !== "loading" && !!window.SC' });
    return result.result.result.value;
  });
  await send('Runtime.evaluate', { expression: `(() => {
    const nativeSetTimeout=window.setTimeout.bind(window);
    window.setTimeout=(callback,delay,...args)=>nativeSetTimeout(callback,Math.min(Number(delay)||0,12),...args);
  })()` });
  console.log('[edge-smoke] browser ready');
  const expression = `(async () => {
    const out = {};
    out.autoDefault=SC.autoBattle&&document.querySelector('#auto-battle-btn').textContent==='自动：开';
    SC.setAutoBattle(false);
    const waitImages=images=>Promise.all([...images].map(image=>image.complete?true:new Promise(resolve=>{image.addEventListener('load',resolve,{once:true});image.addEventListener('error',resolve,{once:true});})));
    out.valid = SC.validateGameData();
    out.requiredArt=SC.REQUIRED_ART.length;
    out.manifestPaths=SC.REQUIRED_ART.every(src=>src.startsWith('assets/')&&src.endsWith('.png'));
    await waitImages(document.querySelectorAll('#title-emblem img'));
    out.titleEmblem=!!document.querySelector('#title-emblem .loaded img');
    document.querySelector('.start-btn').click();
    out.startDestination=document.querySelector('#town-screen').classList.contains('active');
    await waitImages(document.querySelectorAll('#town-screen .building-art img'));
    out.townSeals=document.querySelectorAll('#town-screen .building-art.loaded img').length;
    document.querySelectorAll('#town-screen .town-building')[1].click();
    await waitImages(document.querySelectorAll('.char-card img'));
    out.cards = document.querySelectorAll('.char-card').length;
    out.rosterArt=document.querySelectorAll('.char-card .roster-art.loaded img').length;
    out.hiddenScreensBlocked=[...document.querySelectorAll('.screen:not(.active)')].every(s=>getComputedStyle(s).display==='none'&&getComputedStyle(s).pointerEvents==='none');
    showScreen('town-screen');
    document.querySelector('#town-screen .primary-building').click();
    out.townToFormation=document.querySelector('#formation-screen').classList.contains('active');
    out.exitButton=!!document.querySelector('.battle-top-actions .btn');
    resetGame();
    SC.setRandomSource(() => 0.99);
    const source = SC.makeUnit(SC.CHARACTERS[0], false);
    const low = SC.makeUnit({name:'low',element:'dark',hp:1000,atk:1,def:10,spd:1,skills:[]}, true);
    const high = SC.makeUnit({name:'high',element:'dark',hp:1000,atk:1,def:200,spd:1,skills:[]}, true);
    out.lowDamage = SC.dealDamage(source,{mult:1},low,true);
    out.highDamage = SC.dealDamage(source,{mult:1},high,true);
    out.dual = Object.keys(SC.FUSION2).filter(k => SC.fusionInfo(k.split('+'))).length;
    out.triple = Object.keys(SC.FUSION3).filter(k => SC.fusionInfo(k.split('+'))).length;
    SC.setTeam([9,0,2,1]); SC.startBattle();
    const karl=SC.state.allies.find(u=>u.name.includes('卡尔'));
    SC.state.turnOrder=[karl];SC.state.curIdx=0;SC.state.phase='player';karl.energy=100;
    const before=SC.state.enemies.reduce((s,e)=>s+e.curHp,0);SC.playerSelectSkill(3);
    out.karlDamage=before-SC.state.enemies.reduce((s,e)=>s+e.curHp,0);
    const summons=SC.state.allies.filter(u=>u.isSummon&&u.alive);
    out.summons=summons.length;
    out.summonPositions=summons.map(u=>u.pos);
    out.errorVisible=document.querySelector('#err-overlay').classList.contains('show');
    return out;
  })()`;
  const evaluated = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  console.log('[edge-smoke] navigation and art checks complete');
  const remote = evaluated.result.result;
  if (remote.exceptionDetails || remote.subtype === 'error' || !remote.value) {
    throw new Error('Browser evaluation failed: ' + JSON.stringify(evaluated.result));
  }
  const result = remote.value;
  const failures = [];
  if (!result.valid || result.cards !== 12 || result.requiredArt !== 48 || !result.manifestPaths) failures.push('data, art manifest, or roster validation failed');
  if(!result.autoDefault)failures.push('auto battle default failed');
  if(!result.titleEmblem||result.townSeals!==6||result.rosterArt!==12)failures.push('Image2 DOM art failed');
  if(!result.startDestination||!result.townToFormation||!result.exitButton||!result.hiddenScreensBlocked)failures.push('navigation controls failed');
  if (result.lowDamage !== 180 || result.highDamage !== 73) failures.push('defense formula failed');
  if (result.dual !== 15 || result.triple !== 4) failures.push('fusion lookup failed');
  if (!(result.karlDamage > 0) || result.summons !== 2 || result.summonPositions.some(pos=>pos!=='front')) failures.push('Karl combo skill failed');
  if (result.errorVisible) failures.push('runtime error overlay visible');
  const longRun = await send('Runtime.evaluate', { expression: `(async () => {
    resetGame(); SC.setAutoBattle(false); SC.setTeam([1,2,8,10]); SC.startBattle();
    const started=performance.now(); let actions=0; let lastTurn=-1; let stagnant=0;
    while(SC.state.phase!=='done'&&performance.now()-started<20000){
      if(SC.state.phase==='player'){
        const actor=SC.state.turnOrder[SC.state.curIdx];
        if(actor&&!actor.isSummon){
          const index=actor.energy>=actor.maxEnergy?actor.skills.findIndex(s=>s.ult):0;
          SC.playerSelectSkill(index<0?0:index);
          if(SC.state.target){const target=SC.state.enemies.find(e=>e.alive);if(target)SC.resolveTarget(target);}
          actions++;
        }
      }
      if(lastTurn===SC.state.turn)stagnant++;else{lastTurn=SC.state.turn;stagnant=0;}
      if(stagnant>500)break;
      await new Promise(r=>setTimeout(r,50));
    }
    return {phase:SC.state.phase,wave:SC.state.wave,turn:SC.state.turn,kills:SC.state.kills,actions,stagnant,negativeHp:[...SC.state.allies,...SC.state.enemies].some(u=>u.curHp<0)};
  })()`, returnByValue: true, awaitPromise: true });
  console.log('[edge-smoke] automated battle complete');
  result.longRun=longRun.result.result.value;
  if(result.longRun.phase!=='done'||result.longRun.negativeHp||result.longRun.stagnant>500)failures.push('automated full battle failed');
  const viewportChecks=[];
  for(const [width,height] of [[1366,768],[1024,768],[390,844],[360,640]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});
    const layoutEval=await send('Runtime.evaluate',{expression:`(async () => {
      resetGame(); SC.setAutoBattle(false); SC.setTeam([1,2,8,10]); SC.startBattle();
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const canvas=document.querySelector('#battle-canvas').getBoundingClientRect();
      const ui=document.querySelector('#battle-ui').getBoundingClientRect();
      const auto=document.querySelector('#auto-battle-btn').getBoundingClientRect();
      const exit=document.querySelector('.battle-top-actions .danger').getBoundingClientRect();
      return {width:innerWidth,height:innerHeight,canvasHeight:canvas.height,uiBottom:ui.bottom,actionsInside:auto.left>=0&&exit.right<=innerWidth&&auto.top>=0&&exit.bottom<=innerHeight,actionsSeparate:auto.right<=exit.left,overflow:document.documentElement.scrollWidth>innerWidth};
    })()`,returnByValue:true,awaitPromise:true});
    viewportChecks.push(layoutEval.result.result.value);
  }
  console.log('[edge-smoke] viewport checks complete');
  result.viewports=viewportChecks;
  if(viewportChecks.some(v=>v.canvasHeight<150||v.uiBottom>v.height+1||!v.actionsInside||!v.actionsSeparate||v.overflow))failures.push('responsive battle layout failed');
  console.log(JSON.stringify(result, null, 2));
  if (failures.length) throw new Error(failures.join('; '));
  socket.close();
}

main().catch(error => { console.error(error.stack || error); process.exitCode = 1; }).finally(() => {
  if (browser) browser.kill();
  if (server) server.close();
  if (profile) { try { fs.rmSync(profile, { recursive: true, force: true }); } catch (_) {} }
});
