// Client self-test for dnd55e-sheets, run against the host's published test
// harness (the same one the host uses for its pre-activation smoke). Declared
// in addon.json as `tests.client`. Run standalone:
//   node --test tests/smoke.mjs
//
// NOTE: the harness import path assumes the host repo (ttrpg-codex) is checked
// out as a SIBLING of this addon repo — i.e. both under .../GitHub/. This is a
// dev-only test; the install green-gate is `tests.server` (none needed here).
//
// The sheet integrates by REPLACING the host's `characters:body` fragment with a
// tab strip (registerFragmentOp · replace) — the lore becomes the Overview tab and
// the D&D tabs follow. So these tests drive `rec.fragmentOps[].spec.render(html,
// ctx)` (ctx.entity = the character; html = the host lore), forcing the active tab
// via localStorage 'dse-tab:<cid>'. Editing is role-gated (editor by default;
// pass { isAnonymous: true } for the read-only path).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dryRunRegister, smokeRegistrations, createMockHost } from '../../ttrpg-codex/web/js/addon-test-harness.mjs';
import register from '../entry.js';

function mockLocalStorage(tab) {
  globalThis.localStorage = {
    getItem: (k) => (String(k).startsWith('dse-tab:') ? (tab || null) : null),
    setItem() {}, removeItem() {},
  };
}
function clearLocalStorage() { delete globalThis.localStorage; }

// Invoke the body-fragment render (the whole sheet). `lore` stands in for the
// host's rendered description; defaults to a marked block so the Overview tab can
// be asserted to pass it through.
function renderBody(rec, char, lore) {
  const frag = rec.fragmentOps.find((f) => f.target === 'characters:body');
  const html = lore != null ? lore : '<div class="md-view"><p>LORE_BODY</p></div>';
  return frag.spec.render(html, { entity: char, kind: 'characters', target: 'characters:body' });
}

const META = {
  id: 'dnd55e-sheets',
  permissions: ['ui:override', 'ui:action', 'ui:settings-tab', 'data:read:characters', 'data:write:characters.addonData'],
  optionalDependencies: { 'dnd55e-core-rules': { range: '>=0.1.0' } },
};

const FIGHTER = {
  id: 'c1', name: 'Thorin',
  addonData: { 'dnd55e-sheets': {
    className: 'Fighter', level: 5, profBonus: 3,
    abilities: { STR: 16, DEX: 12, CON: 15, INT: 10, WIS: 13, CHA: 8 },
    maxHp: 44, hp: 40, ac: 18, saveProf: { STR: true, CON: true },
    skillProf: { athletics: true, perception: true },
  } },
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
  assert.ok(rec.fragmentOps.some(f => f.target === 'characters:body' && f.spec.op === 'replace'), 'replaces the character body fragment');
  assert.ok(rec.actions.some(a => a.name === 'hp'), 'the hp action');
  assert.ok(rec.actions.some(a => a.name === 'tab'), 'the tab action');
  assert.ok(rec.settingsTabs.length >= 1, 'a settings tab');
  assert.ok(!rec.articleSections.length, 'no standalone article section (we own the body instead)');
  assert.ok(!rec.editorFields.length, 'no editor fields (the host edit form stays host-only)');
});

test('sheets: renderers survive the smoke pass (sparse entity)', () => {
  const { rec } = dryRunRegister(register, META);
  const smoke = smokeRegistrations(rec);
  assert.ok(smoke.ok, JSON.stringify(smoke.failures));
});

test('sheets: Overview tab is the host lore (reused, not duplicated)', () => {
  mockLocalStorage('overview');
  try {
    const { rec } = dryRunRegister(register, META);
    const out = renderBody(rec, FIGHTER, '<div class="md-view"><p>UNIQUE_LORE_MARKER</p></div>');
    assert.match(out, /UNIQUE_LORE_MARKER/, 'the host lore IS the Overview tab');
    assert.match(out, /Character Sheet/, 'the addon adds D&D tabs');
    assert.doesNotMatch(out, /Saving Throws/, 'D&D stat panels live on other tabs, not Overview');
  } finally { clearLocalStorage(); }
});

test('sheets: Character Sheet tab shows class + ability mods (standalone)', () => {
  mockLocalStorage('stats');
  try {
    const { rec } = dryRunRegister(register, META);
    const out = renderBody(rec, FIGHTER);
    assert.match(out, /Fighter/, 'class line in the vitals bar');
    assert.match(out, /\+3/, 'STR modifier (+3)');
    assert.doesNotMatch(out, /Builder/, 'no Builder tab in standalone (no engine)');
  } finally { clearLocalStorage(); }
});

test('sheets: engine-computed vitals + Builder tab (editor, engine present)', () => {
  mockLocalStorage('stats');
  try {
    const { rec } = dryRunRegister(register, META, { deps: { 'dnd55e-core-rules': FAKE_ENGINE } });
    const out = renderBody(rec, { id: 'c9', name: 'Mage', addonData: { 'dnd55e-sheets': { className: 'Wizard', hp: 40, abilities: { CON: 14 } } } });
    assert.match(out, /Builder/, 'Builder tab appears (engine + editor)');
    assert.match(out, /99/, 'vitals bar shows the engine max HP (99)');
    assert.match(out, /17/, 'vitals bar shows the engine AC (17)');
  } finally { clearLocalStorage(); }
});

test('sheets: anonymous viewer gets a read-only sheet (no Builder, no inputs)', () => {
  mockLocalStorage('stats');
  try {
    const { rec } = dryRunRegister(register, META, { deps: { 'dnd55e-core-rules': FAKE_ENGINE }, isAnonymous: true });
    const out = renderBody(rec, { id: 'ca', name: 'Mage', addonData: { 'dnd55e-sheets': { className: 'Wizard' } } });
    assert.doesNotMatch(out, /Builder/, 'no Builder tab for an anonymous viewer');
    assert.doesNotMatch(out, /<input/, 'no edit inputs for an anonymous viewer');
    assert.doesNotMatch(out, /toggleSkill/, 'no prof toggles for an anonymous viewer');
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
  mockLocalStorage('builder');
  try {
    const { rec } = dryRunRegister(register, META, { deps: { 'dnd55e-core-rules': RICH_ENGINE } });
    const out = renderBody(rec, { id: 'cb', name: 'Hero', addonData: { 'dnd55e-sheets': { className: 'Wizard', abilities: { INT: 15 } } } });
    assert.match(out, /Ability Scores|Class & Levels|Progression/, 'shows Builder sections');
    assert.match(out, /Wizard/, 'class dropdown / resolved class');
    assert.match(out, /<select/, 'renders dropdowns');
  } finally { clearLocalStorage(); }
});

test('sheets: Builder choices resolve into engine inputs (skill prof + expertise)', () => {
  clearLocalStorage();
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
  // Rendering hydrates the resolved decisions — capture what the engine receives.
  renderBody(rec, { id: 'cw', name: 'Mage', addonData: { 'dnd55e-sheets': {
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
  let stored = {};
  host.store.patchAddonData = (_c, itemId, fn) => { stored = fn(stored) || stored; return { id: itemId, addonData: { 'dnd55e-sheets': stored } }; };
  register(host);
  const act = (name, ...args) => rec.actions.find((a) => a.name === name).fn(...args);
  const grantFor = (base) => (stored.abilityGrants || []).find((g) => g.id === base + ':featability');

  act('builderChoose', 'c1', 'asi:wizard:4:feat', 'great-weapon-master');
  assert.equal(grantFor('asi:wizard:4')?.assign.STR, 1, 'GWM auto-applies +1 STR');

  act('builderChoose', 'c1', 'asi:wizard:4:feat', 'fey-touched');
  assert.equal(grantFor('asi:wizard:4'), undefined, 'multi-option half-feat waits for the ability sub-pick');
  act('builderChoose', 'c1', 'asi:wizard:4:featability', 'CHA');
  assert.equal(grantFor('asi:wizard:4')?.assign.CHA, 1, 'sub-pick applies +1 CHA');

  act('builderChoose', 'c1', 'asi:wizard:4', 'asi');
  assert.equal(grantFor('asi:wizard:4'), undefined, 'mode switch clears the feat grant');
});

test('sheets: Spellbook separates granted from picks + colours forced duplicates', () => {
  mockLocalStorage('spellbook');
  try {
    const { rec } = dryRunRegister(register, META, { deps: { 'dnd55e-core-rules': RICH_ENGINE } });
    const out = renderBody(rec, { id: 'csp', name: 'Mage', addonData: { 'dnd55e-sheets': {
      className: 'Wizard',
      cantrips: { wizard: ['fire-bolt'] },
      preparedSpells: { wizard: ['fireball'] },
      spells: [{ id: 'x1', name: 'Counterspell', level: 3, origin: 'copied' }],
    } } });
    assert.match(out, /Always prepared/, 'granted section header');
    assert.match(out, /Bless/, 'granted (always-prepared) spell shown');
    assert.match(out, /Fireball/, 'prepared pick shown');
    assert.match(out, /Fire Bolt/, 'cantrip pick shown');
    assert.match(out, /Extra spells/, 'extra/copied section');
    assert.match(out, /Counterspell/, 'copied spell shown in extras');
    assert.match(out, /Mage Armor/, 'available (undrafted) spell in the pool');
    assert.match(out, /draggable="true"/, 'draggable spell cards');
    assert.match(out, /data-on-drop=/, 'drop zones for preparation');
  } finally { clearLocalStorage(); }
});

test('sheets: choose-grant picker renders a filtered pool + pick/unpick actions', () => {
  mockLocalStorage('spellbook');
  try {
    const { rec } = dryRunRegister(register, META, { deps: { 'dnd55e-core-rules': RICH_ENGINE } });
    const out = renderBody(rec, { id: 'cmi', name: 'Mage', addonData: { 'dnd55e-sheets': { className: 'Wizard' } } });
    assert.match(out, /Granted spell choices/, 'choices section header');
    assert.match(out, /Magic Initiate/, 'shows the grant source + count');
    assert.match(out, /<option value="fire-bolt">/, 'picker offers the matching level-0 wizard cantrip');
    assert.doesNotMatch(out, /<option value="fireball"/, 'a non-matching (level-3) spell is NOT an option in the cantrip picker');
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
  const ev = { dataTransfer: { setData() {} } };
  assert.doesNotThrow(() => act('spellDragStart', ev, 'mage-armor'));
  assert.doesNotThrow(() => act('spellDrop', 'c1', 'wizard', 'prepared'));
  assert.doesNotThrow(() => act('spellDrop', 'c1', 'wizard', 'cantrip'));
});

test('sheets: Combat tab shows engine-computed attacks from equipped weapons', () => {
  mockLocalStorage('combat');
  try {
    const { rec } = dryRunRegister(register, META, { deps: { 'dnd55e-core-rules': RICH_ENGINE } });
    const out = renderBody(rec, { id: 'ck', name: 'Knight', addonData: { 'dnd55e-sheets': { className: 'Fighter' } } });
    assert.match(out, /Attacks/, 'attacks block on the Combat tab');
    assert.match(out, /Longsword/, 'equipped weapon shown');
    assert.match(out, /\+5/, 'attack bonus');
    assert.match(out, /Sap/, 'weapon mastery property');
  } finally { clearLocalStorage(); }
});

test('sheets: Combat tab renders trackers; ± is a live-play control', () => {
  mockLocalStorage('combat');
  try {
    const { rec } = dryRunRegister(register, META);
    const out = renderBody(rec, { id: 'ct', name: 'Brn', addonData: { 'dnd55e-sheets': { className: 'Barbarian', resources: [{ id: 'r1', name: 'Rage', current: 2, max: 3 }] } } });
    assert.match(out, /Trackers/, 'trackers section on the Combat tab');
    assert.match(out, /Rage/, 'the tracker is shown');
    assert.match(out, /resourceAdjust/, '± live-play control present');
  } finally { clearLocalStorage(); }
});

const RES_ENGINE = { ...RICH_ENGINE, hydrate: () => {
  const h = RICH_ENGINE.hydrate();
  h.sheet.derived = { ...h.sheet.derived, maxHp: 40 };
  h.sheet.abilities = { ...h.sheet.abilities, CON: { mod: 2 } };
  h.sheet.totalLevel = 5;
  h.sheet.resources = [
    { key: 'rage', name: 'Rage', max: 3, kind: 'pool', recharge: [{ on: 'short', amount: 1 }, { on: 'long', amount: 'full' }] },
    { key: 'hit-dice-d12', name: 'Hit Dice (d12)', max: 5, kind: 'hitdice', die: 'd12', recharge: [{ on: 'long', amount: 'halfLevel' }] },
  ];
  return h;
} };

test('sheets: Combat tab auto-generates trackers + Rest button, with structured recharge', () => {
  mockLocalStorage('combat');
  try {
    const { rec } = dryRunRegister(register, META, { deps: { 'dnd55e-core-rules': RES_ENGINE } });
    const out = renderBody(rec, { id: 'cr', name: 'Brn', addonData: { 'dnd55e-sheets': { className: 'Barbarian' } } });
    assert.match(out, /Trackers/, 'trackers section on the Combat tab');
    assert.match(out, /Rage/, 'engine-built tracker name (from the build)');
    assert.match(out, /\+1 on short rest/, 'structured recharge label (amount + trigger)');
    assert.match(out, /full on long rest/, 'structured recharge label (full)');
    assert.match(out, /resourceUseAdjust/, '± live-play control');
    assert.match(out, /restOpen/, 'a Rest button');
    assert.doesNotMatch(out, /Add tracker/, 'no manual add button in engine mode');
  } finally { clearLocalStorage(); }
});

test('sheets: rest actions (open / spend hit die / short+long apply / close) do not throw', () => {
  const { rec } = dryRunRegister(register, META, { deps: { 'dnd55e-core-rules': RES_ENGINE } });
  const act = (name, ...args) => rec.actions.find((a) => a.name === name).fn(...args);
  assert.doesNotThrow(() => act('restOpen', 'c1'));
  assert.doesNotThrow(() => act('restSpendHitDie', 'c1', 'hit-dice-d12'));
  assert.doesNotThrow(() => act('restApply', 'c1', 'short'));
  assert.doesNotThrow(() => act('restApply', 'c1', 'long'));
  assert.doesNotThrow(() => act('restClose', 'c1'));
});

test('sheets: Backpack offers compendium pickers + attunement counter', () => {
  mockLocalStorage('backpack');
  try {
    const { rec } = dryRunRegister(register, META, { deps: { 'dnd55e-core-rules': RICH_ENGINE } });
    const out = renderBody(rec, { id: 'cb2', name: 'Knight', addonData: { 'dnd55e-sheets': { className: 'Fighter', inventory: [{ id: 'i1', ref: 'longsword', name: 'Longsword', location: 'equipped', attuned: true }] } } });
    assert.match(out, /Weapon…|Armor…/, 'compendium add pickers');
    assert.match(out, /Attuned 1\/3/, 'attunement counter from the engine');
    assert.match(out, /✦/, 'attunement toggle');
    assert.match(out, /Sap/, 'weapon mastery shown on the row');
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

test('sheets: proficiency dots are direct toggles for editors (standalone)', () => {
  mockLocalStorage('stats');
  try {
    const { rec } = dryRunRegister(register, META);
    const out = renderBody(rec, { id: 'pv', name: 'Rgr', addonData: { 'dnd55e-sheets': { className: 'Ranger' } } });
    assert.match(out, /toggleSkill/, 'skill dots toggle directly (editor)');
    assert.match(out, /toggleSave/, 'save dots toggle directly (editor)');
  } finally { clearLocalStorage(); }
});

test('sheets: no Spellbook tab for a non-caster with no spells (engine mode)', () => {
  const NONCASTER = { ...RICH_ENGINE, hydrate: () => ({ sheet: { derived: {}, abilities: {}, saves: {}, skills: {}, features: [], totalLevel: 1, spellcasting: { perClass: [], slots: [], granted: [] } }, warnings: [] }) };
  const { rec } = dryRunRegister(register, META, { deps: { 'dnd55e-core-rules': NONCASTER } });
  const out = renderBody(rec, { id: 'cf', name: 'Brute', addonData: { 'dnd55e-sheets': { className: 'Fighter' } } });
  assert.doesNotMatch(out, /Spellbook/, 'spellbook tab hidden for a non-caster');
});
