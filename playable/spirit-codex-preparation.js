/* Four preparation views share the original formation and persistent inventory. */
(() => {
  const views=['team','combos','expedition','supplies'];
  let selected='team';
  function renderPreparationSummary(){
    if(!state.progression)return;
    const settings=expeditionSettings(),difficulty=EXPEDITION_DIFFICULTIES.find(item=>item.id===settings.difficultyId),strategy=currentAutoStrategy();
    const run=$('preparation-run-summary');
    if(run){
      const contracts=settings.contractIds.map(id=>EXPEDITION_CONTRACTS.find(item=>item.id===id)?.name).filter(Boolean);
      run.innerHTML=`<dl class="preparation-summary-list"><div><dt>挑战难度</dt><dd>${escapeHtml(difficulty?.name||'标准')}</dd></div><div><dt>远征序列</dt><dd>${settings.seedMode==='daily'?'每日挑战':'普通随机'}</dd></div><div><dt>自动策略</dt><dd>${escapeHtml(strategy.name)}</dd></div><div><dt>图谱契约</dt><dd>${contracts.length?escapeHtml(contracts.join('、')):'未启用'}</dd></div><div><dt>基础奖励</dt><dd>×${expeditionRewardMultiplier()}</dd></div></dl><button type="button" class="btn" data-preparation-link="expedition">调整远征设置</button>`;
    }
    const combo=$('preparation-combo-summary');
    if(combo){
      const active=new Set(activeFormationIndices().map(index=>CHARACTERS[index]?.id));
      const available=COMBO_RECIPES.filter(recipe=>recipe.memberIds.every(id=>active.has(id)));
      combo.innerHTML=available.length?available.map(recipe=>`<div class="preparation-combo-entry"><span>${escapeHtml(recipe.name)}</span><span>${escapeHtml(COMBO_ITEMS[recipe.itemId].name)} ×${comboInventoryCount(recipe.itemId)}</span></div>`).join('')+'<p>成员已齐；实战仍需能量与配方前置。自动不会消耗触媒。</p>':'<p>还没有完整的双人合击。前往合击图鉴，可免费演练或一键加入指定搭档。</p>';
      combo.innerHTML+='<button type="button" class="btn" data-preparation-link="combos">查看合击图鉴</button>';
    }
    const materials=$('preparation-materials');
    if(materials){const resources=state.progression.resources;materials.innerHTML=`<span>灵墨 <strong>${resources.ink}</strong></span><span>元素尘 <strong>${resources.elementDust}</strong></span><span>合成 1 件：20 灵墨 + 3 元素尘</span>`;}
  }
  function navigatePreparation(view,{focus=false}={}){
    if(!views.includes(view)||inBattle)return false;
    cancelComboPreview();
    if(view!==selected)setComboMessage('');
    selected=view;
    const screen=$('formation-screen');if(screen)screen.dataset.preparationView=view;
    document.querySelectorAll('[data-preparation-view]').forEach(panel=>{if(panel!==screen)panel.hidden=panel.dataset.preparationView!==view;});
    document.querySelectorAll('[data-preparation-tab]').forEach(button=>{
      const active=button.dataset.preparationTab===view;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;
      if(active&&focus)button.focus({preventScroll:true});
    });
    renderPreparationSummary();
    const content=screen?.querySelector('.preparation-content,.preparation-body,.formation-body');if(content)content.scrollTop=0;
    return true;
  }
  document.addEventListener('click',event=>{
    const link=event.target.closest('[data-preparation-tab],[data-preparation-link]');
    if(link)navigatePreparation(link.dataset.preparationTab||link.dataset.preparationLink,{focus:true});
  });
  document.addEventListener('keydown',event=>{
    const tab=event.target.closest('[data-preparation-tab]');if(!tab)return;
    const index=views.indexOf(tab.dataset.preparationTab);let next;
    if(event.key==='ArrowRight'||event.key==='ArrowDown')next=(index+1)%views.length;
    if(event.key==='ArrowLeft'||event.key==='ArrowUp')next=(index+views.length-1)%views.length;
    if(event.key==='Home')next=0;if(event.key==='End')next=views.length-1;
    if(next!==undefined){event.preventDefault();navigatePreparation(views[next],{focus:true});}
  });
  window.navigatePreparation=navigatePreparation;
  window.currentPreparationView=()=>selected;
  window.renderPreparationSummary=renderPreparationSummary;
  Object.assign(window.SC,{navigatePreparation,currentPreparationView:window.currentPreparationView,renderPreparationSummary});
  navigatePreparation('team');
})();
