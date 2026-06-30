// ═══════════════════════════════════════════════════════════════
//  editor.js — the scalar decision form on the character editor overlay.
//
//  Identity / abilities / combat / saves / skills / notes. Standalone-only: in
//  engine mode the form is a pointer to the 🛠️ Builder tab and `collect` preserves
//  the stored decisions untouched. Collections (spells/inventory/currency) are
//  edited inline in their tabs; this form round-trips them via {...prev}.
// ═══════════════════════════════════════════════════════════════

export function registerEditor(ctx) {
  const { host, t, ABILITIES, SKILLS, num, clampHp, sheetOf, engine: E } = ctx;
  const { esc } = host.h;
  const { getRules } = E;

  host.registerEditorFields('characters', {
    fields: (c) => {
      // Engine mode: editing flows through the 🛠️ Builder tab (decision #4) —
      // the flat overlay form is standalone-only.
      if (getRules()) {
        return `<div class="edit-section">
          <div class="edit-section-title">🎲 ${esc(t('sheet.title'))}</div>
          <p class="settings-hint">${esc(t('builder.editHere'))}</p></div>`;
      }
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

    collect: (scope, c) => {
      const prev = sheetOf(c);
      if (getRules()) return prev;   // engine mode: the overlay shows no fields → preserve decisions
      const q = (sel) => scope.querySelector(sel);
      const sval = (sel) => (q(sel)?.value ?? '').trim();
      const ival = (sel, d) => { const n = parseInt(q(sel)?.value, 10); return Number.isFinite(n) ? n : d; };
      const chk = (sel) => !!q(sel)?.checked;

      const next = {
        ...prev, // preserves spells / inventory / currency untouched
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
      next.hp = clampHp(next.hp, next.maxHp);   // one clamp rule everywhere
      return next;
    },
  });
}
