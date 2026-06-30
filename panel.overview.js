// ═══════════════════════════════════════════════════════════════
//  panel.overview.js — the Overview tab (the "stat block").
//
//  Ability scores, saving throws, skills and notes — the numbers you reference
//  constantly, grouped together the way a paper sheet's left column is. Identity
//  and the vital stats moved to the persistent header, so this tab is no longer
//  a grab-bag: it's the d20 core.
//
//  Modes: in standalone modification mode the ability scores become inputs and
//  the save/skill dots become toggles (hand-fill). In engine mode everything is
//  computed and read-only — you change it in the Builder. Notes are free text in
//  both modes.
// ═══════════════════════════════════════════════════════════════

export function makeOverviewPanel(ctx) {
  const { host, t, ABILITIES, SKILLS, num, signed, abilityMod, ui, viewModel } = ctx;
  const { esc, renderMarkdown, dataAction, dataOn } = host.h;
  const { section, abilityTile, profRow } = ui;

  function panelOverview(c, s, edit, comp, engine) {
    const vm = viewModel(s, comp);
    const cid = c.id;
    const standaloneEdit = edit && !engine;

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
      const dotAttr = standaloneEdit ? dataAction(host.action('toggleSave'), cid, a) : null;
      return profRow(sv.exp ? 'exp' : sv.prof ? 'prof' : 'none', esc(t('ability.' + a)), signed(sv.total), { dotAttr });
    }).join('');
    const saves = section(t('sheet.saves'), saveRows);

    // ── Skills (alphabetical, two-up on wide) ───────────────────────
    const skillRows = SKILLS
      .map((sk) => ({ sk, name: t('skill.' + sk.id) }))
      .sort((x, y) => x.name.localeCompare(y.name))
      .map(({ sk, name }) => {
        const sv = vm.skill(sk.id, sk.ability);
        const dotAttr = standaloneEdit ? dataAction(host.action('toggleSkill'), cid, sk.id) : null;
        const label = `${esc(name)} <span style="color:var(--text-muted);font-size:var(--text-xs);text-transform:uppercase;letter-spacing:.03em">${esc(sk.ability)}</span>`;
        return profRow(sv.exp ? 'exp' : sv.prof ? 'prof' : 'none', label, signed(sv.total), { dotAttr });
      }).join('');
    const skills = section(t('sheet.skills'),
      `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(12rem,1fr));gap:0 var(--space-4)">${skillRows}</div>`);

    // ── Notes (free text, editable in either mode) ──────────────────
    const notes = section(t('sheet.notes'), edit
      ? `<textarea class="edit-input" rows="4" style="width:100%;resize:vertical" placeholder="${esc(t('field.notes'))}"
          ${dataOn('change', host.action('setField'), cid, 'notes', '$value')}>${esc(s.notes || '')}</textarea>`
      : (s.notes
          ? `<div class="md-view">${renderMarkdown(s.notes)}</div>`
          : `<div style="color:var(--text-muted);font-size:var(--text-sm)">${esc(t('sheet.notesEmpty'))}</div>`));

    return `<div style="display:flex;flex-direction:column;gap:var(--space-5)">
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
