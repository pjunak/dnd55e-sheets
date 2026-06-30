// ═══════════════════════════════════════════════════════════════
//  panel.overview.js — the Character Sheet tab (the "stat block").
//
//  Ability scores, saving throws, skills and mechanical notes — the d20 core,
//  grouped the way a paper sheet's left column is. The host's side-card owns
//  name / portrait / species / lore, so this tab never repeats them; in
//  standalone it adds a small D&D identity block (class / level / background /
//  alignment — fields the host has no place for).
//
//  Editing is direct and role-gated (`edit` = the viewer is an editor): in
//  standalone, ability scores become inputs and save/skill dots become toggles;
//  in engine mode everything is computed and read-only (you change it in the
//  Builder). Anonymous viewers see a clean read-only sheet.
// ═══════════════════════════════════════════════════════════════

export function makeOverviewPanel(ctx) {
  const { host, t, ABILITIES, SKILLS, num, signed, abilityMod, ui, viewModel } = ctx;
  const { esc, renderMarkdown, dataAction, dataOn } = host.h;
  const { section, abilityTile, profRow } = ui;

  // A labelled free-text / number input that writes a flat field (standalone).
  function idField(cid, label, field, value, opts) {
    opts = opts || {};
    const input = opts.num
      ? `<input class="edit-input" type="number" inputmode="numeric"${opts.min != null ? ` min="${opts.min}"` : ''} value="${esc(String(value))}" ${dataOn('change', host.action('setField'), cid, field, '$value')}>`
      : `<input class="edit-input" value="${esc(value || '')}" ${dataOn('change', host.action('setField'), cid, field, '$value')}>`;
    return `<label style="display:flex;flex-direction:column;gap:2px;font-size:var(--text-xs);color:var(--text-muted)">
      <span style="text-transform:uppercase;letter-spacing:.03em">${esc(label)}</span>${input}</label>`;
  }

  function identitySection(c, s) {
    const cid = c.id;
    const grid = [
      idField(cid, t('field.class'), 'className', s.className),
      idField(cid, t('field.subclass'), 'subclass', s.subclass),
      idField(cid, t('field.level'), 'level', num(s.level, 1), { num: true, min: 1 }),
      idField(cid, t('field.background'), 'background', s.background),
      idField(cid, t('field.alignment'), 'alignment', s.alignment),
      idField(cid, t('field.player'), 'player', s.player),
    ].join('');
    return section(t('sheet.identity'),
      `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(8.5rem,1fr));gap:var(--space-2)">${grid}</div>`);
  }

  function panelOverview(c, s, edit, comp, engine) {
    const vm = viewModel(s, comp);
    const cid = c.id;
    const standaloneEdit = edit && !engine;     // ability/identity entry — editors, standalone
    const profEditable = edit && !engine;       // save/skill dot toggles — editors, standalone

    // ── Identity (standalone editors only — engine builds it in the Builder) ──
    const identity = standaloneEdit ? identitySection(c, s) : '';

    // ── Abilities ───────────────────────────────────────────────────
    const abilityCells = ABILITIES.map((a) => {
      const ca = comp && comp.abilities && comp.abilities[a];
      const score = ca ? num(ca.score, 10) : num(s.abilities[a], 10);
      const mod = ca ? num(ca.mod, abilityMod(score)) : abilityMod(s.abilities[a]);
      if (standaloneEdit) {
        const input = `<input class="edit-input" type="number" min="1" max="30" inputmode="numeric"
          style="width:3.25rem;text-align:center;padding:var(--space-1)" value="${esc(String(score))}"
          ${dataOn('change', host.action('setAbility'), cid, a, '$value')}>`;
        return abilityTile(a, signed(mod), input, { title: t('ability.' + a), rawScore: true });
      }
      return abilityTile(a, signed(mod), String(score), { title: t('ability.' + a) });
    }).join('');
    const abilities = section(t('sheet.abilities'),
      `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(4rem,1fr));gap:var(--space-2)">${abilityCells}</div>`);

    // ── Saving throws ───────────────────────────────────────────────
    const saveRows = ABILITIES.map((a) => {
      const sv = vm.save(a);
      const dotAttr = profEditable ? dataAction(host.action('toggleSave'), cid, a) : null;
      return profRow(sv.exp ? 'exp' : sv.prof ? 'prof' : 'none', esc(t('ability.' + a)), signed(sv.total), { dotAttr });
    }).join('');
    const saves = section(t('sheet.saves'), saveRows);

    // ── Skills (alphabetical, two-up on wide) ───────────────────────
    const skillRows = SKILLS
      .map((sk) => ({ sk, name: t('skill.' + sk.id) }))
      .sort((x, y) => x.name.localeCompare(y.name))
      .map(({ sk, name }) => {
        const sv = vm.skill(sk.id, sk.ability);
        const dotAttr = profEditable ? dataAction(host.action('toggleSkill'), cid, sk.id) : null;
        const label = `${esc(name)} <span style="color:var(--text-muted);font-size:var(--text-xs);text-transform:uppercase;letter-spacing:.03em">${esc(sk.ability)}</span>`;
        return profRow(sv.exp ? 'exp' : sv.prof ? 'prof' : 'none', label, signed(sv.total), { dotAttr });
      }).join('');
    const skills = section(t('sheet.skills'),
      `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(12rem,1fr));gap:0 var(--space-4)">${skillRows}</div>`);

    // ── Notes (mechanical — flavour/lore live in the host's description) ─────
    const notes = (edit || s.notes) ? section(t('sheet.notes'), edit
      ? `<textarea class="edit-input" rows="3" style="width:100%;resize:vertical" placeholder="${esc(t('sheet.notesHint'))}"
          ${dataOn('change', host.action('setField'), cid, 'notes', '$value')}>${esc(s.notes || '')}</textarea>`
      : `<div class="md-view">${renderMarkdown(s.notes)}</div>`) : '';

    return `<div style="display:flex;flex-direction:column;gap:var(--space-5)">
      ${identity}
      ${abilities}
      <div style="display:flex;flex-wrap:wrap;gap:var(--space-5)">
        <div style="flex:1 1 13rem;min-width:12rem">${saves}</div>
        <div style="flex:2 1 22rem;min-width:16rem">${skills}</div>
      </div>
      ${notes}
    </div>`;
  }

  return { panelOverview };
}
