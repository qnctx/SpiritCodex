const {test,expect}=require('@playwright/test');

async function load(page){
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/playable/spirit-codex.html');
  await page.evaluate(()=>SC.preloadArt(SC.CHARACTERS.map(character=>character.art)));
  return errors;
}

async function inspectPortraits(page,selector){
  return page.locator(selector).evaluateAll(nodes=>nodes.map(node=>{
    const image=node.querySelector('img'),frame=node.getBoundingClientRect(),rect=image?.getBoundingClientRect();
    const x=Number(node.style.getPropertyValue('--portrait-x')),y=Number(node.style.getPropertyValue('--portrait-y'));
    return {id:node.dataset.characterArt,src:image?.getAttribute('src'),loaded:!!image?.naturalWidth,
      undistorted:!!rect&&Math.abs(rect.width/rect.height-image.naturalWidth/image.naturalHeight)<.01,
      faceInside:!!rect&&rect.left+rect.width*x>=frame.left&&rect.left+rect.width*x<=frame.right&&rect.top+rect.height*y>=frame.top&&rect.top+rect.height*y<=frame.bottom};
  }));
}

test('all twelve portraits retain their roster identity, show the face and preserve the source aspect ratio',async({page})=>{
  const errors=await load(page),characters=await page.evaluate(()=>SC.CHARACTERS.map(({id,art})=>({id,art})));
  await page.evaluate(()=>showScreen('roster-screen'));
  await expect(page.locator('.roster-art.loaded img')).toHaveCount(12);
  expect(await page.locator('.roster-art img').evaluateAll(images=>images.map(image=>image.getAttribute('src')))).toEqual(characters.map(character=>character.art));
  await page.evaluate(()=>openProgression());
  await expect(page.locator('.progression-roster-art.loaded img')).toHaveCount(12);
  for(const portrait of await inspectPortraits(page,'.progression-roster-art')){
    expect(portrait.src).toBe(characters.find(character=>character.id===portrait.id).art);
    expect(portrait.loaded&&portrait.undistorted&&portrait.faceInside,portrait.id).toBe(true);
  }
  for(let index=0;index<characters.length;index++){
    await page.locator('.progression-character').nth(index).click();
    await expect(page.locator('.progression-main-art img')).toHaveAttribute('src',characters[index].art);
    await expect(page.locator('.progression-main-art.loaded img')).toHaveCount(1);
    expect((await inspectPortraits(page,'.progression-main-art'))[0].undistorted).toBe(true);
  }
  expect(errors).toEqual([]);
});

test('roster cards open the matching detail with the keyboard and readable unclipped names',async({page})=>{
  const errors=await load(page);await page.evaluate(()=>showScreen('roster-screen'));
  const card=page.locator('.char-card').first();await card.focus();await card.press('Enter');
  await expect(page.locator('#detail-modal')).toHaveClass(/show/);
  await expect(page.locator('.detail-art img')).toHaveAttribute('src',await page.evaluate(()=>SC.CHARACTERS[0].art));
  await expect(page.locator('.detail-art.loaded img')).toHaveCount(1);
  expect((await inspectPortraits(page,'.detail-art'))[0].undistorted).toBe(true);
  await page.getByRole('button',{name:'关闭',exact:true}).click();
  expect(await page.locator('.char-card .nm').evaluateAll(nodes=>nodes.every(node=>parseFloat(getComputedStyle(node).fontSize)>=14&&node.scrollWidth<=node.clientWidth+1))).toBe(true);
  expect(await page.locator('#roster-screen').evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
  expect(errors).toEqual([]);
});

test('formation replacement updates portraits and the same art reaches the real battle report',async({page})=>{
  const errors=await load(page);await page.evaluate(()=>{SC.setAutoBattle(false);showScreen('formation-screen');});
  await page.locator('.slot[data-zone="reserve"]').first().click();
  await page.locator('.mini').nth(11).click();
  await expect(page.locator('.slot[data-zone="reserve"]').first().locator('img')).toHaveAttribute('src',await page.evaluate(()=>SC.CHARACTERS[11].art));
  await expect(page.locator('.slot-art.loaded img')).toHaveCount(6);
  expect((await inspectPortraits(page,'.slot-art')).every(portrait=>portrait.loaded&&portrait.undistorted&&portrait.faceInside)).toBe(true);
  await page.locator('#start-battle-btn').click();
  await expect(page.locator('#battle-screen')).toHaveClass(/active/);
  await page.locator('#battle-report-btn').click();
  await expect(page.locator('#battle-report-modal')).toBeVisible();
  await page.locator('#battle-report-tab-team').click();
  await expect(page.locator('.member-art.loaded img')).toHaveCount(4);
  const active=await page.evaluate(()=>SC.state.allies.map(unit=>({id:unit.characterId,art:unit.art})));
  for(const portrait of await inspectPortraits(page,'.member-art')){
    expect(portrait.src).toBe(active.find(character=>character.id===portrait.id).art);
    expect(portrait.undistorted&&portrait.faceInside).toBe(true);
  }
  await page.locator('#battle-report-close').click();
  await expect(page.locator('#battle-report-modal')).not.toBeVisible();expect(errors).toEqual([]);
});
