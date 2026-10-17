const assert = require('node:assert/strict');
module.exports = async function checkSpellAttacks(page) {
  await page.evaluate(() => {
    SPELL_LIB = [
      { name: 'Attack Test', spellAttack: ['R'] },
      { name: 'Save Test', savingThrow: ['dexterity'] },
      { name: 'Utility Test' },
    ].map(sp => parseSpell({ ...sp, level: 0, source: 'PHB', school: 'V', time: [{ number: 1, unit: 'action' }],
      classes: { fromClassList: [{ name: 'Wizard', source: 'PHB' }, { name: 'Cleric', source: 'PHB' }] }, entries: ['Test'] }));
    applyState({ fields: { 'score-int': '16', 'score-wis': '14', 'spell-ability': 'wis', 'spell-atk-misc': '+1+1d4' },
      classes: [{ name: 'Wizard', lvl: 2 }, { name: 'Cleric', lvl: 1 }],
      spells: [{ name: 'Attack Test', cls: 'Wizard', lvl: 0 }, { name: 'Attack Test', cls: 'Cleric', lvl: 0 },
        { name: 'Save Test', cls: 'Cleric', lvl: 0 }, { name: 'Utility Test', cls: 'Wizard', lvl: 0 }] });
    window.spellAttackCalls = [];
    window.spellAttackOriginalRoll = runRoll;
    runRoll = (...args) => { spellAttackCalls.push(args); return spellAttackOriginalRoll(...args); };
  });
  try {
    const attack = page.locator('#sb-sections .sb-row[data-detail="0|Attack Test"]');
    const wizard = attack.locator('.sb-atk-roll[data-ability="int"]');
    const cleric = attack.locator('.sb-atk-roll[data-ability="wis"]');
    assert.equal(await wizard.innerText(), '+6');
    assert.equal(await cleric.innerText(), '+5');
    const save = page.locator('#sb-sections .sb-row[data-detail="0|Save Test"]');
    assert.equal(await save.locator('td').nth(4).innerText(), 'DEX 12');
    assert.equal(await save.locator('td').nth(4).locator('button').count(), 0);
    assert.equal(await page.locator('#sb-sections .sb-row[data-detail="0|Utility Test"] td').nth(4).innerText(), '-');
    await wizard.click();
    let call = await page.evaluate(() => spellAttackCalls.at(-1));
    assert.match(call[0], /^1d20\+6\+1d4 Attack Test \(Wizard\)/);
    assert.equal(call[2].attack, true);
    await cleric.click({ modifiers: ['Shift'] });
    call = await page.evaluate(() => spellAttackCalls.at(-1));
    assert.match(call[0], /^1d20\+5\+1d4 Attack Test \(Cleric\)/);
    assert.equal(call[1], 'adv');
    await wizard.click({ modifiers: ['Control'] });
    assert.equal(await page.evaluate(() => spellAttackCalls.at(-1)[1]), 'dis');
    await wizard.click({ button: 'right' });
    await page.locator('#rollmenu > div').filter({ hasText: /^Advantage$/ }).click();
    assert.equal(await page.evaluate(() => spellAttackCalls.at(-1)[1]), 'adv');
    await page.evaluate(() => { document.getElementById('spell-atk-misc').value = '+2'; recompute(); });
    assert.equal(await wizard.innerText(), '+7');
    await wizard.click();
    assert.match(await page.evaluate(() => spellAttackCalls.at(-1)[0]), /^1d20\+7 Attack Test/);
    // Identical modifiers share a button, with all source labels retained.
    await page.evaluate(() => { document.getElementById('score-wis').value = '16'; recompute(); });
    assert.equal(await attack.locator('.sb-atk-roll').count(), 1);
    assert.match(await attack.locator('.sb-atk-roll').getAttribute('title'), /Wizard/);
    assert.match(await attack.locator('.sb-atk-roll').getAttribute('title'), /Cleric/);
  } finally { await page.evaluate(() => { runRoll = spellAttackOriginalRoll; }); }
  console.log('Spell attacks: per-class modifiers, misc dice, live updates, advantage/disadvantage, context menu, merged sources and plain save DCs passed.');
};
