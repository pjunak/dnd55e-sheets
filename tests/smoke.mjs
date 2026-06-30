// Client self-test for dnd55e-sheets, run against the host's published test
// harness (the same one the host uses for its pre-activation smoke). Declared
// in addon.json as `tests.client`. Run standalone:
//   node --test tests/smoke.mjs
//
// NOTE: the harness import path assumes the host repo (ttrpg-codex) is checked
// out as a SIBLING of this addon repo — i.e. both under .../GitHub/. This is a
// dev-only test; the install green-gate is `tests.server` (none needed here).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dryRunRegister, smokeRegistrations, createMockHost } from '../../ttrpg-codex/web/js/addon-test-harness.mjs';
import register from '../entry.js';

// localStorage mock — force the active tab AND (optionally) modification mode, so
// the edit-only surfaces (the Builder tab, the spell pool, the add pickers) render
// under test. The sheet keys these per character: 'dse-tab:<cid>' / 'dse-mode:<cid>'.
function mockLocalStorage(tab, mode) {
  globalThis.localStorage = {
    getItem: (k) => (String(k).startsWith('dse-mode:') ? (mode || null) : (tab || null)),
    setItem() {}, removeItem() {},
  };
}
function clearLocalStorage() { delete globalThis.localStorage; }

const META = {
  id: 'dnd55e-sheets',
  permissions: [
    'ui:article-section:characters', 'ui:editor-fields:characters',
    'ui:action', 'ui:settings-tab', 'data:read:characters', 'data:write:characters.addonData',
  ],
  optionalDependencies: { 'dnd55e-core-rules': { range: '>=0.1.0' } },
};

// A fake rules engine to exercise the soft-use consumption path (M4).
const FAKE_ENGINE = {
  apiVersion: 1,
  hydrate: () => ({
    sheet: {
      derived: { maxHp: 99, armorClass: 17, proficiencyBonus: 4, initiative: 5, speed: 25, passivePerception: 14 },
      saves: { STR: { proficient: true, total: 7 } },
      skills: { stealth: { ability: 'DEX', proficient: true, expertise: true, total: 11 } },
      spellcasting: { perClass: [{ classId: 'wizard', saveDC: 15, spellAttack: 7, preparedLimit: 6, ritual: true }], slots: [4, 3, 2] },
    },
    warnings: ['heads up'],
  }),
};

test('sheets: register is clean + wires the expected surface', () => {
  const { ok, rec, error } = dryRunRegister(register, META);
  assert.ok(ok, error);
  assert.ok(rec.articleSections.some(s => s.kind === 'characters'), 'an article section on characters');
  assert.ok(rec.editorFields.some(e => e.kind === 'characters'), 'editor fields on characters');
  assert.ok(rec.actions.some(a => a.name === 'hp'), 'the hp action');
  assert.ok(rec.settingsTabs.length >= 1, 'a settings tab');
});

test('sheets: renderers survive the smoke pass (sparse entity)', () => {
  const { rec } = dryRunRegister(register, META);
  const smoke = smokeRegistrations(rec);
  assert.ok(smoke.ok, JSON.stringify(smoke.failures));
});

test('sheets: article section renders with populated addonData', () => {
  const { rec } = dryRunRegister(register, META);
  const section = rec.articleSections.find(s => s.kind === 'characters');
  const out = section.fn({
    id: 'c1', name: 'Thorin',
    addonData: { 'dnd55e-sheets': {
      className: 'Fighter', race: 'Dwarf', level: 5, profBonus: 3,
      abilities: { STR: 16, DEX: 12, CON: 15, INT: 10, WIS: 13, CHA: 8 },
      maxHp: 44, hp: 40, ac: 18, saveProf: { STR: true, CON: true },
      skillProf: { athletics: true, perception: true },
    } },
  });
  assert.ok(out && typeof out.html === 'string', 'returns {title, html}');
  assert.match(out.html, /Fighter/, 'shows the class');
  assert.match(out.html, /\+3/, 'shows STR modifier (+3)');
  assert.doesNotMatch(out.html, /Builder/, 'no Builder tab in standalone (no engine)');
});

test('sheets: shows engine-computed values + Builder tab (modification mode)', () => {
  mockLocalStorage(null, 'edit');   // default tab (overview) + modification mode
  try {
    const { rec } = dryRunRegister(register, META, { deps: { 'dnd55e-core-rules': FAKE_ENGINE } });
    const section = rec.articleSections.find(s => s.kind === 'characters');
    const out = section.fn({ id: 'c9', name: 'Mage', addonData: { 'dnd55e-sheets': { className: 'Wizard', hp: 40, abilities: { CON: 14 } } } });
    assert.match(out.html, /Builder/, 'Builder tab appears with the engine in modification mode');
    assert.match(out.html, /99/, 'header vital strip shows the engine max HP (99)');
    assert.match(out.html, /17/, 'header vital strip shows the engine AC (17)');
  } finally { clearLocalStorage(); }
});

test('sheets: Builder tab is hidden in view mode (engine present, not modifying)', () => {
  mockLocalStorage(null, null);   // default tab, view mode (no modification)
  try {
    const { rec } = dryRunRegister(register, META, { deps: { 'dnd55e-core-rules': FAKE_ENGINE } });
    const section = rec.articleSections.find(s => s.kind === 'characters');
    const out = section.fn({ id: 'c9b', name: 'Mage', addonData: { 'dnd55e-sheets': { className: 'Wizard' } } });
    assert.doesNotMatch(out.html, /Builder/, 'no Builder tab until you enter modification mode');
    assert.match(out.html, /✎ Edit/, 'the Edit (modification-mode) toggle is offered');
  } finally { clearLocalStorage(); }
});

// A fuller fake engine (data API + hydrate) for the Builder + Spellbook.
const SPELLS = [
  { id: 'fire-bolt', name: 'Fire Bolt', level: 0, school: 'Evocation', classes: ['wizard'] },
  { id: 'mage-armor', name: 'Mage Armor', level: 1, school: 'Abjuration', classes: ['wizard'] },
  { id: 'fireball', name: 'Fireball', level: 3, school: 'Evocation', classes: ['wizard'] },
];
const WEAPONS = [
  { id: 'longsword', name: 'Longsword', kind: 'weapon', category: 'martial', range: 'melee', damage: '1d8', damageType: 'slashing', properties: ['versatile'], mastery: 'Sap' },
  { id: 'dagger', name: 'Dagger', kind: 'weapon', category: 'simple', range: 'melee', damage: '1d4', damageType: 'piercing', properties: ['finesse', 'light'], mastery: 'Nick' },
];
const ARMOR = [{ id: 'leather', name: 'Leather Armor', kind: 'armor', armorType: 'light', baseAC: 11, dexCap: null }];
const WIZ_REC = { id: 'wizard', name: 'Wizard', hitDie: 'd6', subclassLevel: 3, grants: { choices: [] } };
const RICH_ENGINE = {
  apiVersion: 1,
  listClasses: () => [{ id: 'wizard', name: 'Wizard' }, { id: 'fighter', name: 'Fighter' }],
  listSpecies: () => [{ id: 'elf', name: 'Elf' }],
  listBackgrounds: () => [{ id: 'sage', name: 'Sage' }],
  listSubclasses: () => [],
  listFeats: () => [{ id: 'alert', name: 'Alert' }],
  listWeapons: () => WEAPONS.map((w) => ({ id: w.id, name: w.name })),
  listArmor: () => ARMOR.map((a) => ({ id: a.id, name: a.name })),
  listSpells: (q) => SPELLS.filter((sp) => (!q || q.level == null || sp.level === q.level) && (!q || !q.class || sp.classes.includes(q.class))),
  getItem: (kind, id) => kind === 'class' && id === 'wizard' ? WIZ_REC
    : kind === 'spell' ? SPELLS.find((sp) => sp.id === id) || null
    : kind === 'weapon' ? WEAPONS.find((w) => w.id === id) || null
    : kind === 'armor' ? ARMOR.find((a) => a.id === id) || null : null,
  getItemByName: (kind, name) => kind === 'class' && String(name).toLowerCase() === 'wizard' ? WIZ_REC : null,
  hydrate: () => ({
    sheet: {
      derived: { maxHp: 8, armorClass: 10, proficiencyBonus: 2, initiative: 0, speed: 30, passivePerception: 10 },
      abilities: { STR: { base: 10, score: 10, mod: 0 }, INT: { base: 15, score: 15, mod: 2 } },
      saves: {}, skills: {}, features: [], totalLevel: 1,
      weaponMastery: { slots: 3, chosen: ['longsword'] },
      weapons: [{ ref: 'longsword', name: 'Longsword', attackBonus: 5, damage: '1d8 +3', damageType: 'slashing', properties: ['versatile'], mastery: 'Sap', masteryActive: true, proficient: true }],
      attunement: { count: 1, limit: 3, over: false },
      spellcasting: {
        perClass: [{ classId: 'wizard', ability: 'INT', prepares: 'list', ritual: false, saveDC: 13, spellAttack: 5, preparedLimit: 3, cantripsKnown: 2 }],
        slots: [4, 3, 2], casterLevel: 5,
        granted: [{ ref: 'bless', name: 'Bless', level: 1, school: 'Enchantment', source: { type: 'subclass', id: 'life-domain' }, alwaysPrepared: true }],
        pendingChoices: [{ key: 'feat:magic-initiate:mi-cantrips', source: { type: 'feat', id: 'magic-initiate' }, choose: 2, spellLevel: 0, from: { class: ['wizard'] }, alwaysPrepared: true, picked: [] }],
      },
    },
    warnings: [],
  }),
};

test('sheets: Builder tab renders the guided form when the engine is present', () => {
  mockLocalStorage('builder', 'edit');   // force the Builder tab (edit-only)
  try {
    const { rec } = dryRunRegister(register, META, { deps: { 'dnd55e-core-rules': RICH_ENGINE } });
    const section = rec.articleSections.find(s => s.kind === 'characters');
    const out = section.fn({ id: 'cb', name: 'Hero', addonData: { 'dnd55e-sheets': { className: 'Wizard', abilities: { INT: 15 } } } });
    assert.match(out.html, /Ability Scores|Class & Levels|Progression/, 'shows Builder sections');
    assert.match(out.html, /Wizard/, 'class dropdown / resolved class');
    assert.match(out.html, /<select/, 'renders dropdowns');
  } finally { clearLocalStorage(); }
});

test('sheets: Builder choices resolve into engine inputs (skill prof + expertise)', () => {
  const WIZ = {
    id: 'wizard', name: 'Wizard', hitDie: 'd6', subclassLevel: 3,
    startingProficiencies: { skills: { choose: 2, from: ['arcana', 'history', 'stealth'] } },
    grants: { choices: [{ id: 'wiz-exp', type: 'expertise', count: 1, source: 'wizard:1' }] },
  };
  let captured = null;
  const eng = {
    ...RICH_ENGINE,
    getItem: (kind, id) => (kind === 'class' && id === 'wizard') ? WIZ : RICH_ENGINE.getItem(kind, id),
    getItemByName: (kind, name) => (kind === 'class' && /wizard/i.test(name)) ? WIZ : RICH_ENGINE.getItemByName(kind, name),
    hydrate: (cd) => { captured = cd; return RICH_ENGINE.hydrate(cd); },
  };
  const { rec } = dryRunRegister(register, META, { deps: { 'dnd55e-core-rules': eng } });
  const section = rec.articleSections.find(s => s.kind === 'characters');
  // Rendering hydrates the resolved decisions — capture what the engine receives.
  section.fn({ id: 'cw', name: 'Mage', addonData: { 'dnd55e-sheets': {
    className: 'Wizard',
    featureChoices: { 'skills:wizard#0': 'arcana', 'skills:wizard#1': 'stealth', 'wiz-exp': 'stealth' },
  } } });
  assert.ok(captured, 'engine.hydrate was called');
  assert.deepEqual([...captured.skillProficiencies].sort(), ['arcana', 'stealth'], 'class skill picks resolved');
  assert.equal(captured.skillExpertise.stealth, true, 'expertise pick resolved');
});

test('sheets: Builder actions mutate the model + materialize without throwing', () => {
  const { rec } = dryRunRegister(register, META, { deps: { 'dnd55e-core-rules': RICH_ENGINE } });
  const act = (name, ...args) => rec.actions.find(a => a.name === name).fn(...args);
  assert.doesNotThrow(() => act('builderAbility', 'c1', 'STR', '15'));
  assert.doesNotThrow(() => act('builderClassSet', 'c1', 0, 'wizard'));
  assert.doesNotThrow(() => act('builderLevelSet', 'c1', 0, '5'));
  assert.doesNotThrow(() => act('builderAddClass', 'c1'));
  assert.doesNotThrow(() => act('builderBgAsi', 'c1', 'STR:2,DEX:1'));
  assert.doesNotThrow(() => act('builderChoose', 'c1', 'asi:wizard:4:ability', 'CON'));
});

test('sheets: a half-feat chosen at an ASI level applies its ability bump (AB-2)', () => {
  // A feat-aware engine: GWM is a single-option half-feat (+1 STR), Fey Touched a
  // CHOICE (+1 of INT/WIS/CHA → needs the sub-pick).
  const FEATS = {
    'great-weapon-master': { id: 'great-weapon-master', name: 'Great Weapon Master', grants: { abilityScoreIncrease: { choose: 1, amount: 1, from: ['STR'] } } },
    'fey-touched': { id: 'fey-touched', name: 'Fey Touched', grants: { abilityScoreIncrease: { choose: 1, amount: 1, from: ['INT', 'WIS', 'CHA'] }, spells: [{ ids: ['misty-step'], alwaysPrepared: true }] } },
  };
  const FEAT_ENGINE = {
    ...RICH_ENGINE,
    listFeats: () => Object.values(FEATS).map((f) => ({ id: f.id, name: f.name })),
    getItem: (kind, id) => (kind === 'feat' ? (FEATS[id] || null) : RICH_ENGINE.getItem(kind, id)),
  };
  const { host, rec } = createMockHost(META, { deps: { 'dnd55e-core-rules': FEAT_ENGINE } });
  let stored = {};   // stateful capture so successive edits accumulate like prod
  host.store.patchAddonData = (_c, itemId, fn) => { stored = fn(stored) || stored; return { id: itemId, addonData: { 'dnd55e-sheets': stored } }; };
  register(host);
  const act = (name, ...args) => rec.actions.find((a) => a.name === name).fn(...args);
  const grantFor = (base) => (stored.abilityGrants || []).find((g) => g.id === base + ':featability');

  // Single-option half-feat → bump applied immediately on feat selection.
  act('builderChoose', 'c1', 'asi:wizard:4:feat', 'great-weapon-master');
  assert.equal(grantFor('asi:wizard:4')?.assign.STR, 1, 'GWM auto-applies +1 STR');

  // Switch to a CHOICE half-feat → the auto grant clears, awaiting the sub-pick…
  act('builderChoose', 'c1', 'asi:wizard:4:feat', 'fey-touched');
  assert.equal(grantFor('asi:wizard:4'), undefined, 'multi-option half-feat waits for the ability sub-pick');
  // …then the sub-pick applies the +1 to the chosen ability.
  act('builderChoose', 'c1', 'asi:wizard:4:featability', 'CHA');
  assert.equal(grantFor('asi:wizard:4')?.assign.CHA, 1, 'sub-pick applies +1 CHA');

  // Flipping the ASI level back to the +2 mode clears the feat ability grant.
  act('builderChoose', 'c1', 'asi:wizard:4', 'asi');
  assert.equal(grantFor('asi:wizard:4'), undefined, 'mode switch clears the feat grant');
});

test('sheets: Spellbook separates granted from picks + colours forced duplicates', () => {
  mockLocalStorage('spellbook', 'edit');   // force the Spellbook tab + modification mode
  try {
    const { rec } = dryRunRegister(register, META, { deps: { 'dnd55e-core-rules': RICH_ENGINE } });
    const section = rec.articleSections.find(s => s.kind === 'characters');
    const out = section.fn({ id: 'csp', name: 'Mage', addonData: { 'dnd55e-sheets': {
      className: 'Wizard',
      cantrips: { wizard: ['fire-bolt'] },
      preparedSpells: { wizard: ['fireball'] },
      spells: [{ id: 'x1', name: 'Counterspell', level: 3, origin: 'copied' }],
    } } });
    assert.match(out.html, /Always prepared/, 'granted section header');
    assert.match(out.html, /Bless/, 'granted (always-prepared) spell shown');
    assert.match(out.html, /Fireball/, 'prepared pick shown');
    assert.match(out.html, /Fire Bolt/, 'cantrip pick shown');
    assert.match(out.html, /Extra spells/, 'extra/copied section');
    assert.match(out.html, /Counterspell/, 'copied spell shown in extras');
    assert.match(out.html, /Mage Armor/, 'available (undrafted) spell in the pool');
    assert.match(out.html, /draggable="true"/, 'draggable spell cards');
    assert.match(out.html, /data-on-drop=/, 'drop zones for preparation');
  } finally { clearLocalStorage(); }
});

test('sheets: choose-grant picker renders a filtered pool + pick/unpick actions', () => {
  mockLocalStorage('spellbook', 'edit');
  try {
    const { rec } = dryRunRegister(register, META, { deps: { 'dnd55e-core-rules': RICH_ENGINE } });
    const section = rec.articleSections.find((s) => s.kind === 'characters');
    const out = section.fn({ id: 'cmi', name: 'Mage', addonData: { 'dnd55e-sheets': { className: 'Wizard' } } });
    assert.match(out.html, /Granted spell choices/, 'choices section header');
    assert.match(out.html, /Magic Initiate/, 'shows the grant source + count');
    assert.match(out.html, /<option value="fire-bolt">/, 'picker offers the matching level-0 wizard cantrip');
    assert.doesNotMatch(out.html, /<option value="fireball"/, 'a non-matching (level-3) spell is NOT an option in the cantrip picker');
  } finally { clearLocalStorage(); }
  const { rec } = dryRunRegister(register, META, { deps: { 'dnd55e-core-rules': RICH_ENGINE } });
  const act = (name, ...args) => rec.actions.find((a) => a.name === name).fn(...args);
  assert.doesNotThrow(() => act('grantPick', 'c1', 'feat:magic-initiate:mi-cantrips', 'fire-bolt'));
  assert.doesNotThrow(() => act('grantUnpick', 'c1', 'feat:magic-initiate:mi-cantrips', 'fire-bolt'));
});

test('sheets: spellbook prepare/cantrip/copy + drag-drop actions do not throw', () => {
  const { rec } = dryRunRegister(register, META, { deps: { 'dnd55e-core-rules': RICH_ENGINE } });
  const act = (name, ...args) => rec.actions.find(a => a.name === name).fn(...args);
  assert.doesNotThrow(() => act('prepSpell', 'c1', 'wizard', 'fireball'));
  assert.doesNotThrow(() => act('learnCantrip', 'c1', 'wizard', 'fire-bolt'));
  assert.doesNotThrow(() => act('unprepSpell', 'c1', 'wizard', 'fireball'));
  assert.doesNotThrow(() => act('copySpell', 'c1'));
  // drag seam: dragstart stashes the ref (+ primes dataTransfer), drop consumes it.
  const ev = { dataTransfer: { setData() {} } };
  assert.doesNotThrow(() => act('spellDragStart', ev, 'mage-armor'));
  assert.doesNotThrow(() => act('spellDrop', 'c1', 'wizard', 'prepared'));
  assert.doesNotThrow(() => act('spellDrop', 'c1', 'wizard', 'cantrip'));   // nothing stashed → no-op
});

test('sheets: Sheet tab shows engine-computed attacks from equipped weapons', () => {
  mockLocalStorage('sheet', null);   // Combat tab; attacks are read-only (no edit mode needed)
  try {
    const { rec } = dryRunRegister(register, META, { deps: { 'dnd55e-core-rules': RICH_ENGINE } });
    const section = rec.articleSections.find(s => s.kind === 'characters');
    const out = section.fn({ id: 'ck', name: 'Knight', addonData: { 'dnd55e-sheets': { className: 'Fighter' } } });
    assert.match(out.html, /Attacks/, 'attacks block on the Sheet tab');
    assert.match(out.html, /Longsword/, 'equipped weapon shown');
    assert.match(out.html, /\+5/, 'attack bonus');
    assert.match(out.html, /Sap/, 'weapon mastery property');
  } finally { clearLocalStorage(); }
});

test('sheets: Backpack offers compendium pickers + attunement counter', () => {
  mockLocalStorage('backpack', 'edit');
  try {
    const { rec } = dryRunRegister(register, META, { deps: { 'dnd55e-core-rules': RICH_ENGINE } });
    const section = rec.articleSections.find(s => s.kind === 'characters');
    const out = section.fn({ id: 'cb2', name: 'Knight', addonData: { 'dnd55e-sheets': { className: 'Fighter', inventory: [{ id: 'i1', ref: 'longsword', name: 'Longsword', location: 'equipped', attuned: true }] } } });
    assert.match(out.html, /Weapon…|Armor…/, 'compendium add pickers');
    assert.match(out.html, /Attuned 1\/3/, 'attunement counter from the engine');
    assert.match(out.html, /✦/, 'attunement toggle');
    assert.match(out.html, /Sap/, 'weapon mastery shown on the row');
  } finally { clearLocalStorage(); }
});

test('sheets: Backpack add-item + attune actions do not throw', () => {
  const { rec } = dryRunRegister(register, META, { deps: { 'dnd55e-core-rules': RICH_ENGINE } });
  const act = (name, ...args) => rec.actions.find(a => a.name === name).fn(...args);
  assert.doesNotThrow(() => act('invAddRef', 'c1', 'weapon', 'longsword'));
  assert.doesNotThrow(() => act('invAddRef', 'c1', 'armor', 'leather'));
  assert.doesNotThrow(() => act('invAttune', 'c1', 'someid'));
});

test('sheets: resource tracker actions mutate without throwing', () => {
  const { rec } = dryRunRegister(register, META);
  const act = (name, ...args) => rec.actions.find((a) => a.name === name).fn(...args);
  assert.doesNotThrow(() => act('resourceAdd', 'c1'));
  assert.doesNotThrow(() => act('resourceSet', 'c1', 'x', 'name', 'Rage'));
  assert.doesNotThrow(() => act('resourceSet', 'c1', 'x', 'max', '3'));
  assert.doesNotThrow(() => act('resourceAdjust', 'c1', 'x', -1));
  assert.doesNotThrow(() => act('resourceDel', 'c1', 'x'));
});

test('sheets: Combat tab renders trackers; ± works in view mode (live play)', () => {
  mockLocalStorage('sheet', null);   // Combat tab, VIEW mode (not modifying)
  try {
    const { rec } = dryRunRegister(register, META);
    const section = rec.articleSections.find((s) => s.kind === 'characters');
    const out = section.fn({ id: 'ct', name: 'Brn', addonData: { 'dnd55e-sheets': { className: 'Barbarian', resources: [{ id: 'r1', name: 'Rage', current: 2, max: 3 }] } } });
    assert.match(out.html, /Trackers/, 'trackers section on the Combat tab');
    assert.match(out.html, /Rage/, 'the tracker is shown');
    assert.match(out.html, /resourceAdjust/, '± live-play control present in view mode');
  } finally { clearLocalStorage(); }
});

test('sheets: proficiency dots are quick-toggles in view mode (standalone)', () => {
  mockLocalStorage('overview', null);   // Overview, VIEW mode (not modifying)
  try {
    const { rec } = dryRunRegister(register, META);
    const section = rec.articleSections.find((s) => s.kind === 'characters');
    const out = section.fn({ id: 'pv', name: 'Rgr', addonData: { 'dnd55e-sheets': { className: 'Ranger' } } });
    assert.match(out.html, /toggleSkill/, 'skill dots toggle without entering modification mode');
    assert.match(out.html, /toggleSave/, 'save dots toggle without entering modification mode');
  } finally { clearLocalStorage(); }
});

test('sheets: no Spellbook tab for a non-caster with no spells (engine mode)', () => {
  const NONCASTER = { ...RICH_ENGINE, hydrate: () => ({ sheet: { derived: {}, abilities: {}, saves: {}, skills: {}, features: [], totalLevel: 1, spellcasting: { perClass: [], slots: [], granted: [] } }, warnings: [] }) };
  const { rec } = dryRunRegister(register, META, { deps: { 'dnd55e-core-rules': NONCASTER } });
  const section = rec.articleSections.find(s => s.kind === 'characters');
  const out = section.fn({ id: 'cf', name: 'Brute', addonData: { 'dnd55e-sheets': { className: 'Fighter' } } });
  assert.doesNotMatch(out.html, /📖 Spellbook|>Spellbook</, 'spellbook tab hidden for a non-caster');
});
