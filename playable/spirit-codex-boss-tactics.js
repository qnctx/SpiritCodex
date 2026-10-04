/* v14: a short, rule-backed punish window, not an extra resource system. */
(function(){
  'use strict';
  const config=u=>u?.boss&&u.intentConfig?.coreExposure;
  function open(u,reason){
    const rules=config(u);if(!rules||!u.alive||!['interrupted','released'].includes(reason))return false;
    const bonus=reason==='interrupted'?rules.interruptBonus:rules.releaseBonus;
    u.coreExposure={bonus,reason,visibleAt:window.BattleClock?.now()||0};
    const message=`${reason==='interrupted'?'蓄力打断':'风暴结束'} · 核心暴露，直接攻击伤害 +${Math.round(bonus*100)}%，至 Boss 下次行动`;
    spawnFloat(u,reason==='interrupted'?'打断成功 · 核心暴露':'核心暴露','#ffe6a0');pushLog(message);return true;
  }
  function beforeTurn(u){if(!config(u)||!u.coreExposure)return false;u.coreExposure=null;return true;}
  function multiplier(source,target){return source&&!source.isEnemy&&target?.alive&&config(target)&&target.coreExposure?1+target.coreExposure.bonus:1;}
  function describe(u){
    if(!config(u)||!u.alive)return '';
    if(u.coreExposure){const pending=(window.BattleClock?.now()||0)<u.coreExposure.visibleAt;return `${pending?'风暴释放中，命中后':'核心暴露：'}直接攻击 +${Math.round(u.coreExposure.bonus*100)}% · 至下次 Boss 行动`;}
    if(u.charging)return u.controlResistTurns>0?'风暴即将命中全队 · 当前免疫硬控，优先护盾或治疗':'风暴即将命中全队 · 可尝试冰冻/麻痹；打断后暴露 +35%';
    return '风暴蓄力 → 控制打断或护盾承伤 → 抓住核心暴露窗口';
  }
  function draw(ctx,now){
    for(const u of state.enemies){if(!u.alive||!u.coreExposure||now<u.coreExposure.visibleAt)continue;
      const pulse=.65+Math.sin(now/180)*.2,r=u._r||20;ctx.save();ctx.strokeStyle=`rgba(255,219,130,${pulse})`;ctx.lineWidth=3;
      ctx.beginPath();ctx.ellipse(u._x,u._y+r*.72,r*1.5,r*.46,0,0,Math.PI*2);ctx.stroke();ctx.restore();
    }
  }
  window.BossTactics=Object.freeze({open,beforeTurn,multiplier,describe,draw});
}());
