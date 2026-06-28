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
import { dryRunRegister, smokeRegistrations } from '../../ttrpg-codex/web/js/addon-test-harness.mjs';
import register from '../entry.js';

const META = {
  id: 'dnd55e-sheets',
  permissions: [
    'ui:article-section:characters', 'ui:editor-fields:characters',
    'ui:action', 'ui:settings-tab', 'data:read:characters', 'data:write:characters.addonData',
  ],
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
});
