/* Shared game-time clock. Changing speed never replays a rule or skips a hit.
 * Only battle-owned timers belong here; menus and free previews use wall time. */
(function(){
  'use strict';
  let rate=1,realAnchor=0,gameAnchor=0,serial=0;
  const timers=new Map(),listeners=new Set(),pauses=new Set(),realNow=()=>performance.now();
  function now(real=realNow()){return pauses.size?gameAnchor:gameAnchor+(real-realAnchor)*rate;}
  function arm(job){
    clearTimeout(job.timer);
    if(pauses.size)return;
    job.timer=setTimeout(()=>{
      if(!timers.has(job.id))return;
      if(job.at-now()>.5){arm(job);return;}
      timers.delete(job.id);job.callback();
    },Math.max(0,(job.at-now())/rate));
  }
  function schedule(callback,delay=0){const job={id:++serial,at:now()+Math.max(0,Number(delay)||0),callback,timer:null};timers.set(job.id,job);arm(job);return job.id;}
  function cancel(id){const job=timers.get(id);if(!job)return false;clearTimeout(job.timer);timers.delete(id);return true;}
  function clear(){for(const id of timers.keys())cancel(id);}
  function pause(owner){if(!owner||pauses.has(owner))return false;if(!pauses.size){const real=realNow();gameAnchor=now(real);realAnchor=real;}pauses.add(owner);for(const job of timers.values())clearTimeout(job.timer);return true;}
  function resume(owner){if(!pauses.delete(owner))return false;if(!pauses.size){realAnchor=realNow();for(const job of timers.values())arm(job);}return true;}
  function setRate(value){if(value!==1&&value!==2)return false;if(value===rate)return rate;const real=realNow();gameAnchor=now(real);realAnchor=real;rate=value;for(const job of timers.values())arm(job);for(const fn of listeners)fn(rate);return rate;}
  function subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);}
  window.BattleClock=Object.freeze({now,schedule,cancel,clear,setRate,subscribe,pause,resume,get rate(){return rate;},get paused(){return pauses.size>0;},inspect:()=>({rate,time:now(),pending:timers.size,paused:pauses.size>0})});
}());
