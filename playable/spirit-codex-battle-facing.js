/* Authored image orientation is distinct from the side a unit fights for.
 * Keep artwork and its weapon/mouth socket under the SAME mirror transform. */
(function(){
  'use strict';
  const rows=[
    ['characters/char-h1-fire-ranger.png',1,.77,.42],['characters/char-h2-fire-guardian.png',-1,.20,.40],
    ['characters/char-w1-water-healer.png',1,.78,.39],['characters/char-w2-tide-warden.png',1,.21,.12],
    ['characters/char-a1-wind-ranger.png',1,.78,.40],['characters/char-a2-wind-alchemist.png',-1,.19,.16],
    ['characters/char-t1-thunder-warrior.png',1,.80,.80],['characters/char-t2-thunder-mage.png',-1,.14,.12],
    ['characters/char-d1-shadow-assassin.png',-1,.12,.56],['characters/char-d2-necromancer.png',1,.84,.21],
    ['characters/char-l1-light-priestess.png',1,.82,.32],['characters/char-l2-light-paladin.png',1,.56,.80],
    ['summons/summon-wind-eagle.png',-1,.405,.337],['summons/summon-skeleton-warrior.png',-1,.22,.52],
    ['enemies/enemy-shadow-wolf.png',-1,.24,.37],['enemies/enemy-shadow-bat.png',-1,.49,.60],
    ['enemies/enemy-flame-demon-soldier.png',-1,.77,.70],['enemies/enemy-frost-guardian.png',-1,.13,.74],
    ['enemies/enemy-storm-herald.png',1,.74,.30],['enemies/enemy-chaos-elemental.png',-1,.50,.36]
  ];
  const catalog=Object.freeze(Object.fromEntries(rows.map(([file,sourceFacing,u,v])=>['assets/'+file,Object.freeze({sourceFacing,socket:Object.freeze([u,v])})])));
  function art(unit){return catalog[unit?.art]||{sourceFacing:unit?.isEnemy?-1:1,socket:[unit?.isEnemy?.25:.75,.4]};}
  function direction(unit,target){const dx=(target?._x??0)-(unit?._x??0);return target&&target!==unit&&Math.abs(dx)>2?Math.sign(dx):unit?.isEnemy?-1:1;}
  function pose(unit,target){const source=art(unit),facing=direction(unit,target);return {facing,sourceFacing:source.sourceFacing,mirror:facing/source.sourceFacing,socket:source.socket};}
  function validate(units){return [...new Set(units.map(u=>u.art).filter(src=>src&&!catalog[src]))].map(src=>'战斗美术缺少朝向与出口配置：'+src);}
  window.BattleFacing=Object.freeze({catalog,art,direction,pose,validate});
}());
