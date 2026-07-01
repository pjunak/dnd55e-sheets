// ═══════════════════════════════════════════════════════════════
//  panel.overview.js — the Character Sheet tab (the "stat block").
//
//  Full-width layout (UX): the six ability scores live in a vertical RAIL on the
//  left (shared with Combat — panel.rail.js), each with its SAVING THROW
//  integrated (🛡) and a hover legend. The main area holds the SKILLS, grouped
//  by their governing ability so they still read "under" the scores, flowing in
//  responsive columns. Every save/skill total carries a legend explaining the
//  formula and the terms that sum to it (UX-7).
//
//  Editing is direct and role-gated (`edit`): standalone turns ability scores
//  into inputs and save/skill dots into toggles; engine mode is computed and
//  read-only (change it in the Builder). Anonymous viewers get a clean sheet.
// ═══════════════════════════════════════════════════════════════

export function makeOverviewPanel(ctx) {
  const { host, t, ABILITIES, SKILLS, num, signed, ui, viewModel, legends, abilityRail } = ctx;
  const { esc, dataAction, dataOn } = host.h;
  const { section, profDot, statTip, numField, S } = ui;

  // A labelled free-text / number input that writes a flat field (standalone).
  function idField(cid, label, field, value, opts) {
    opts = opts || {};
    const input = opts.num
      ? numField(dataOn('change', host.action('setField'), cid, field, '$value'), value, { min: opts.min, ariaLabel: label })
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
      `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(9rem,1fr));gap:var(--space-2)">${grid}</div>`);
  }

  function panelOverview(c, s, edit, comp, engine) {
    const vm = viewModel(s, comp);
    const L = legends(s, comp, vm);
    const cid = c.id;
    const standaloneEdit = edit && !engine;
    const profEditable = edit && !engine;

    // One skill line: trained dot + name + total (total carries a legend).
    const line = (state, labelHtml, legend, dotAttr) => {
      const dot = profDot(state, dotAttr);
      const total = statTip(`<strong style="${S.profTotal}">${esc(legend.total)}</strong>`, legend, { align: 'r' });
      return `<div style="display:flex;align-items:center;gap:var(--space-2);padding:var(--space-1) var(--space-2)">${dot}<span style="${S.profLabel}">${labelHtml}</span>${total}</div>`;
    };

    // Skills grouped under their governing ability (abilities with none — CON — are skipped).
    const skillGroup = (a) => {
      const skillsFor = SKILLS.filter((sk) => sk.ability === a)
        .map((sk) => ({ sk, name: t('skill.' + sk.id) }))
        .sort((x, y) => x.name.localeCompare(y.name));
      if (!skillsFor.length) return '';
      const rows = skillsFor.map(({ sk, name }) => {
        const kv = vm.skill(sk.id, sk.ability);
        const state = kv.exp ? 'exp' : kv.prof ? 'prof' : 'none';
        const dotAttr = profEditable ? dataAction(host.action('toggleSkill'), cid, sk.id) : null;
        return line(state, esc(name), L.skill(sk.id, sk.ability), dotAttr);
      }).join('');
      return `<div style="break-inside:avoid">
        <div style="color:var(--accent-gold);font-size:var(--text-xs);text-transform:uppercase;letter-spacing:.05em;font-weight:600;padding:0 var(--space-2) 2px;border-bottom:1px solid var(--border-subtle);margin-bottom:var(--space-1)">${esc(t('ability.' + a))}</div>
        ${rows}</div>`;
    };
    const skillsGrid = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(13rem,1fr));gap:var(--space-4) var(--space-4);align-items:start">${ABILITIES.map(skillGroup).filter(Boolean).join('')}</div>`;

    const identity = standaloneEdit ? identitySection(c, s) : '';

    return `<div style="display:flex;flex-direction:column;gap:var(--space-5)">
      ${identity}
      <div class="dse-cols">
        <div class="dse-rail">${abilityRail(c, s, comp, edit)}</div>
        <div class="dse-cols-main">${section(t('sheet.skills'), skillsGrid)}</div>
      </div>
    </div>`;
  }

  return { panelOverview };
}
