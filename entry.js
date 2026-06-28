// ═══════════════════════════════════════════════════════════════
//  dnd55e-sheets — a fully hand-fillable D&D 5.5e character sheet.
//
//  Rides on the host's CORE `characters` entity (the sheet is NOT an addon
//  collection): all data lives in `character.addonData['dnd55e-sheets']`,
//  written via host.store.patchAddonData.
//
//   • registerArticleSection('characters') — renders the sheet on every
//        character page, with live HP +/- buttons.
//   • registerEditorFields('characters')   — the full decision form (identity,
//        ability scores, combat numbers, save/skill proficiencies, notes),
//        collected back into addonData on save.
//   • registerAction('hp')                  — the HP +/- buttons.
//   • registerSettingsTab                   — a small info panel.
//
//  M1 is standalone and rules-free: every value is entered by hand. The only
//  arithmetic done here is the UNIVERSAL D&D math that holds regardless of
//  content — ability modifiers ⌊(score-10)/2⌋ and proficiency totals
//  (mod + proficiency bonus when proficient). Content-driven derivation
//  (class/species/armor → stats) arrives later via the soft-used core-rules
//  addon; this file is built field-first so it never depends on it.
//
//  Style/safety contract: HTML only via host.h (esc/dataAction), never inline
//  onclick; colours/spacing only via design tokens var(--…); every display
//  string flows through i18n.t() so locales layer on with no rewrite.
// ═══════════════════════════════════════════════════════════════

import { t } from './i18n.js';

export default function register(host) {
  const { esc, dataAction, renderMarkdown } = host.h;
  const NS = host.id; // 'dnd55e-sheets'

  // ── Domain constants ─────────────────────────────────────────────
  const ABILITIES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
  // Each skill maps to its governing ability (D&D 2024).
  const SKILLS = [
    { id: 'acrobatics', ability: 'DEX' }, { id: 'animalHandling', ability: 'WIS' },
    { id: 'arcana', ability: 'INT' },     { id: 'athletics', ability: 'STR' },
    { id: 'deception', ability: 'CHA' },  { id: 'history', ability: 'INT' },
    { id: 'insight', ability: 'WIS' },    { id: 'intimidation', ability: 'CHA' },
    { id: 'investigation', ability: 'INT' }, { id: 'medicine', ability: 'WIS' },
    { id: 'nature', ability: 'INT' },     { id: 'perception', ability: 'WIS' },
    { id: 'performance', ability: 'CHA' }, { id: 'persuasion', ability: 'CHA' },
    { id: 'religion', ability: 'INT' },   { id: 'sleightOfHand', ability: 'DEX' },
    { id: 'stealth', ability: 'DEX' },    { id: 'survival', ability: 'WIS' },
  ];

  // ── Pure helpers ─────────────────────────────────────────────────
  const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
  const abilityMod = (score) => Math.floor((num(score, 10) - 10) / 2);
  const signed = (n) => (n >= 0 ? '+' + n : String(n));

  /** A blank sheet — the v1 shape stored under addonData[NS]. Only player
   *  decisions are stored; in M1 (no engine) the entered numbers ARE the
   *  decisions. The future engine layers computed values + overrides over this. */
  const blank = () => ({
    v: 1,
    player: '', className: '', subclass: '', race: '', background: '', alignment: '',
    level: 1,
    abilities: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
    maxHp: 0, hp: 0, tempHp: 0, ac: 10, initiative: 0, speed: 30, profBonus: 2,
    saveProf: {}, skillProf: {}, notes: '',
  });

  /** Read this addon's namespace off a character, merged over defaults so every
   *  field/sub-object is present (renderers/collect never hit undefined). */
  const sheetOf = (c) => {
    const s = (c && c.addonData && c.addonData[NS]) || {};
    const b = blank();
    return {
      ...b, ...s,
      abilities: { ...b.abilities, ...(s.abilities || {}) },
      saveProf:  { ...(s.saveProf || {}) },
      skillProf: { ...(s.skillProf || {}) },
    };
  };

  // ════════════════════════════════════════════════════════════════
  //  Article section — the rendered sheet on a character page
  // ════════════════════════════════════════════════════════════════
  host.registerArticleSection('characters', (c) => {
    if (!c) return null;
    const s = sheetOf(c);
    const editable = !host.role.isAnonymous();
    const pb = num(s.profBonus, 0);

    // Identity summary line.
    const clsBits = [s.className, s.subclass ? '(' + s.subclass + ')' : '']
      .filter(Boolean).join(' ');
    const summary = t('sheet.summary', { level: num(s.level, 1), cls: clsBits || '' }).trim();
    const idBits = [
      s.race, s.background, s.alignment,
      s.player ? t('field.player') + ': ' + s.player : '',
    ].filter(Boolean).map(esc).join('  ·  ');

    // Ability grid.
    const abilityCells = ABILITIES.map((a) => {
      const m = abilityMod(s.abilities[a]);
      return `
        <div style="background:var(--bg-raised);border-radius:var(--radius);padding:var(--space-2);text-align:center"
             title="${esc(t('ability.' + a))}">
          <div style="font-size:var(--text-xs);color:var(--text-muted);letter-spacing:.05em">${esc(a)}</div>
          <div style="font-size:var(--text-xl);color:var(--text-parchment);font-weight:700">${esc(signed(m))}</div>
          <div style="font-size:var(--text-sm);color:var(--text-light)">${esc(String(num(s.abilities[a], 10)))}</div>
        </div>`;
    }).join('');

    // Combat stat boxes.
    const statBox = (label, value) => `
      <div style="background:var(--bg-raised);border-radius:var(--radius);padding:var(--space-2) var(--space-3);min-width:4.5rem;text-align:center">
        <div style="font-size:var(--text-xs);color:var(--text-muted)">${esc(label)}</div>
        <div style="font-size:var(--text-lg);color:var(--text-parchment);font-weight:600">${esc(String(value))}</div>
      </div>`;

    const hpControls = editable
      ? `<div style="display:flex;gap:var(--space-1);margin-top:var(--space-1);justify-content:center">
           <button class="inline-create-btn" title="${esc(t('action.hpMinus'))}"${dataAction(host.action('hp'), c.id, -1)}>−</button>
           <button class="inline-create-btn" title="${esc(t('action.hpPlus'))}"${dataAction(host.action('hp'), c.id, 1)}>＋</button>
         </div>`
      : '';
    const tempBit = num(s.tempHp, 0) > 0 ? ` <span style="color:var(--color-success)">(+${esc(String(num(s.tempHp, 0)))})</span>` : '';
    const hpBox = `
      <div style="background:var(--bg-raised);border-radius:var(--radius);padding:var(--space-2) var(--space-3);min-width:6rem;text-align:center">
        <div style="font-size:var(--text-xs);color:var(--text-muted)">${esc(t('stat.hp'))}</div>
        <div style="font-size:var(--text-lg);color:var(--text-parchment);font-weight:600">
          ${esc(String(num(s.hp, 0)))} <span style="color:var(--text-muted)">/ ${esc(String(num(s.maxHp, 0)))}</span>${tempBit}
        </div>
        ${hpControls}
      </div>`;

    const combat = hpBox
      + statBox(t('stat.ac'), num(s.ac, 10))
      + statBox(t('stat.init'), signed(num(s.initiative, 0)))
      + statBox(t('stat.speed'), num(s.speed, 30))
      + statBox(t('stat.pb'), signed(pb));

    // Saving throws.
    const savesRows = ABILITIES.map((a) => {
      const prof = !!s.saveProf[a];
      const total = abilityMod(s.abilities[a]) + (prof ? pb : 0);
      return rowLine(prof, esc(t('ability.' + a)), signed(total));
    }).join('');

    // Skills (sorted by localized name for a stable, readable list).
    const skillsRows = SKILLS
      .map((sk) => ({ sk, name: t('skill.' + sk.id) }))
      .sort((x, y) => x.name.localeCompare(y.name))
      .map(({ sk, name }) => {
        const prof = !!s.skillProf[sk.id];
        const total = abilityMod(s.abilities[sk.ability]) + (prof ? pb : 0);
        return rowLine(prof, esc(name) + ` <span style="color:var(--text-muted);font-size:var(--text-xs)">${esc(sk.ability)}</span>`, signed(total));
      }).join('');

    // Passive Perception = 10 + Perception total.
    const percProf = !!s.skillProf.perception;
    const passivePerc = 10 + abilityMod(s.abilities.WIS) + (percProf ? pb : 0);

    const notesHtml = s.notes
      ? `<div><div style="font-size:var(--text-xs);color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:var(--space-1)">${esc(t('sheet.notes'))}</div>
           <div class="md-view">${renderMarkdown(s.notes)}</div></div>`
      : '';

    const html = `
      <div class="addon-dnd55e-sheets" style="display:flex;flex-direction:column;gap:var(--space-4)">
        <div>
          <div style="color:var(--text-parchment);font-weight:600">${esc(summary)}</div>
          ${idBits ? `<div style="color:var(--text-muted);font-size:var(--text-sm);margin-top:var(--space-1)">${idBits}</div>` : ''}
        </div>

        <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:var(--space-2)">${abilityCells}</div>

        <div style="display:flex;flex-wrap:wrap;gap:var(--space-2);align-items:flex-start">${combat}</div>

        <div style="display:grid;grid-template-columns:1fr 2fr;gap:var(--space-4)">
          <div>
            ${sectionLabel(t('sheet.saves'))}
            ${savesRows}
          </div>
          <div>
            ${sectionLabel(t('sheet.skills'))}
            ${skillsRows}
            <div style="margin-top:var(--space-2);color:var(--text-muted);font-size:var(--text-sm)">
              ${esc(t('stat.passivePerc'))}: <strong style="color:var(--text-parchment)">${esc(String(passivePerc))}</strong>
            </div>
          </div>
        </div>

        ${notesHtml}
      </div>`;

    return { title: '🎲 ' + t('sheet.title'), html };

    // local render helpers --------------------------------------------------
    function sectionLabel(text) {
      return `<div style="font-size:var(--text-xs);color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:var(--space-2)">${esc(text)}</div>`;
    }
    function rowLine(prof, labelHtml, totalText) {
      const mark = prof
        ? `<span style="color:var(--accent-gold)" title="${esc(t('misc.proficient'))}">●</span>`
        : `<span style="color:var(--text-muted)">○</span>`;
      return `<div style="display:flex;align-items:center;gap:var(--space-2);padding:var(--space-1) 0;border-bottom:1px solid rgba(var(--gold-muted),.12)">
        ${mark}<span style="flex:1;color:var(--text-light);font-size:var(--text-sm)">${labelHtml}</span>
        <strong style="color:var(--text-parchment)">${esc(totalText)}</strong></div>`;
    }
  });

  // ── HP +/- → patch ONLY this addon's namespace, clamped to [0, maxHp] ─────
  host.registerAction('hp', (id, delta) => {
    host.store.patchAddonData('characters', id, (s) => {
      const maxHp = num(s.maxHp, 0);
      const cur = num(s.hp, maxHp);
      let next = cur + Number(delta);
      next = Math.max(0, maxHp > 0 ? Math.min(maxHp, next) : next);
      return { ...s, hp: next };
    });
    host.ui.rerender();
  });

  // ════════════════════════════════════════════════════════════════
  //  Editor fields — the decision form on the character editor
  // ════════════════════════════════════════════════════════════════
  host.registerEditorFields('characters', {
    fields: (c) => {
      const s = sheetOf(c);
      const text = (id, label, val) =>
        `<label class="edit-label">${esc(label)}</label>
         <input id="${id}" class="edit-input" value="${esc(val || '')}">`;
      const numField = (id, label, val, min) =>
        `<label class="edit-label">${esc(label)}</label>
         <input id="${id}" class="edit-input" type="number"${min != null ? ` min="${min}"` : ''} value="${esc(String(val))}">`;

      const abilityInputs = ABILITIES.map((a) => `
        <div style="text-align:center">
          <label class="edit-label" title="${esc(t('ability.' + a))}">${esc(a)}</label>
          <input id="dse-ab-${a}" class="edit-input" type="number" min="1" style="text-align:center"
                 value="${esc(String(num(s.abilities[a], 10)))}">
        </div>`).join('');

      const saveChecks = ABILITIES.map((a) => checkbox('dse-save-' + a, t('ability.' + a), !!s.saveProf[a])).join('');
      const skillChecks = SKILLS
        .map((sk) => ({ sk, name: t('skill.' + sk.id) }))
        .sort((x, y) => x.name.localeCompare(y.name))
        .map(({ sk, name }) => checkbox('dse-skill-' + sk.id, name + ' (' + sk.ability + ')', !!s.skillProf[sk.id]))
        .join('');

      return `
        <div class="edit-section">
          <div class="edit-section-title">🎲 ${esc(t('sheet.title'))} · ${esc(t('sheet.identity'))}</div>
          ${text('dse-player', t('field.player'), s.player)}
          ${text('dse-class', t('field.class'), s.className)}
          ${text('dse-subclass', t('field.subclass'), s.subclass)}
          ${text('dse-race', t('field.race'), s.race)}
          ${text('dse-background', t('field.background'), s.background)}
          ${text('dse-alignment', t('field.alignment'), s.alignment)}
          ${numField('dse-level', t('field.level'), num(s.level, 1), 1)}
        </div>

        <div class="edit-section">
          <div class="edit-section-title">${esc(t('sheet.abilities'))}</div>
          <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:var(--space-2)">${abilityInputs}</div>
        </div>

        <div class="edit-section">
          <div class="edit-section-title">${esc(t('sheet.combat'))}</div>
          ${numField('dse-maxhp', t('field.maxHp'), num(s.maxHp, 0), 0)}
          ${numField('dse-hp', t('field.hp'), num(s.hp, 0), 0)}
          ${numField('dse-temphp', t('field.tempHp'), num(s.tempHp, 0), 0)}
          ${numField('dse-ac', t('field.ac'), num(s.ac, 10), 0)}
          ${numField('dse-init', t('field.initiative'), num(s.initiative, 0))}
          ${numField('dse-speed', t('field.speed'), num(s.speed, 30), 0)}
          ${numField('dse-pb', t('field.profBonus'), num(s.profBonus, 2), 0)}
        </div>

        <div class="edit-section">
          <div class="edit-section-title">${esc(t('sheet.saves'))}</div>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:var(--space-1)">${saveChecks}</div>
        </div>

        <div class="edit-section">
          <div class="edit-section-title">${esc(t('sheet.skills'))}</div>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:var(--space-1)">${skillChecks}</div>
        </div>

        <div class="edit-section">
          <div class="edit-section-title">${esc(t('sheet.notes'))}</div>
          <label class="edit-label">${esc(t('field.notes'))}</label>
          <textarea id="dse-notes" class="edit-input" rows="4">${esc(s.notes || '')}</textarea>
        </div>`;

      function checkbox(id, label, checked) {
        return `<label style="display:flex;align-items:center;gap:var(--space-2);color:var(--text-light);font-size:var(--text-sm);cursor:pointer">
          <input id="${id}" type="checkbox"${checked ? ' checked' : ''}> ${esc(label)}</label>`;
      }
    },

    // scope = this addon's editor section; c = the in-progress save (its
    // addonData already carries the existing namespace to merge over).
    collect: (scope, c) => {
      const prev = sheetOf(c);
      const q = (sel) => scope.querySelector(sel);
      const sval = (sel) => (q(sel)?.value ?? '').trim();
      const ival = (sel, d) => { const n = parseInt(q(sel)?.value, 10); return Number.isFinite(n) ? n : d; };
      const chk = (sel) => !!q(sel)?.checked;

      const next = {
        ...prev,
        player: sval('#dse-player'),
        className: sval('#dse-class'),
        subclass: sval('#dse-subclass'),
        race: sval('#dse-race'),
        background: sval('#dse-background'),
        alignment: sval('#dse-alignment'),
        level: Math.max(1, ival('#dse-level', prev.level)),
        abilities: {},
        maxHp: Math.max(0, ival('#dse-maxhp', prev.maxHp)),
        hp: Math.max(0, ival('#dse-hp', prev.hp)),
        tempHp: Math.max(0, ival('#dse-temphp', prev.tempHp)),
        ac: ival('#dse-ac', prev.ac),
        initiative: ival('#dse-init', prev.initiative),
        speed: Math.max(0, ival('#dse-speed', prev.speed)),
        profBonus: ival('#dse-pb', prev.profBonus),
        saveProf: {},
        skillProf: {},
        notes: q('#dse-notes')?.value ?? prev.notes,
      };
      ABILITIES.forEach((a) => { next.abilities[a] = Math.max(1, ival('#dse-ab-' + a, prev.abilities[a])); });
      ABILITIES.forEach((a) => { next.saveProf[a] = chk('#dse-save-' + a); });
      SKILLS.forEach((sk) => { next.skillProf[sk.id] = chk('#dse-skill-' + sk.id); });
      // Keep current HP within the (possibly changed) max.
      if (next.maxHp > 0 && next.hp > next.maxHp) next.hp = next.maxHp;
      return next;
    },
  });

  // ── Info tab (Settings → 🎲 Character Sheets) ─────────────────────
  host.registerSettingsTab({
    id: 'info', label: t('settings.label'), icon: '🎲',
    render: () => `
      <div class="settings-editor-head"><h2>🎲 ${esc(t('help.title'))}</h2></div>
      <div class="settings-panel">
        <p class="settings-hint">${esc(t('help.body', { count: host.store.getCharacters().length }))}</p>
      </div>`,
  });
}
