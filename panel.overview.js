// ═══════════════════════════════════════════════════════════════
//  panel.overview.js — the Overview tab.
//  Identity line, ability-score grid, an at-a-glance combat strip, notes.
// ═══════════════════════════════════════════════════════════════

export function makeOverviewPanel(ctx) {
  const { host, t, ABILITIES, num, signed, abilityMod, ui, viewModel } = ctx;
  const { esc, renderMarkdown } = host.h;
  const { sectionLabel, miniStat } = ui;

  function panelOverview(c, s, comp) {
    const vm = viewModel(s, comp);
    const clsBits = [s.className, s.subclass ? '(' + s.subclass + ')' : ''].filter(Boolean).join(' ');
    const summary = t('sheet.summary', { level: num(s.level, 1), cls: clsBits || '' }).trim();
    const idBits = [
      s.race, s.background, s.alignment,
      s.player ? t('field.player') + ': ' + s.player : '',
    ].filter(Boolean).map(esc).join('  ·  ');

    const abilityCells = ABILITIES.map((a) => {
      const ca = comp && comp.abilities && comp.abilities[a];
      const score = ca ? num(ca.score, 10) : num(s.abilities[a], 10);
      const m = ca ? num(ca.mod, abilityMod(score)) : abilityMod(s.abilities[a]);
      return `
        <div style="background:var(--bg-raised);border-radius:var(--radius);padding:var(--space-2);text-align:center" title="${esc(t('ability.' + a))}">
          <div style="font-size:var(--text-xs);color:var(--text-muted);letter-spacing:.05em">${esc(a)}</div>
          <div style="font-size:var(--text-xl);color:var(--text-parchment);font-weight:700">${esc(signed(m))}</div>
          <div style="font-size:var(--text-sm);color:var(--text-light)">${esc(String(score))}</div>
        </div>`;
    }).join('');

    const glance = [
      [t('stat.hp'), `${num(s.hp, 0)} / ${vm.maxHp}`],
      [t('stat.ac'), vm.ac],
      [t('stat.init'), signed(vm.init)],
      [t('stat.speed'), vm.speed],
      [t('stat.pb'), signed(vm.pb)],
    ].map(([l, v]) => miniStat(l, v)).join('');

    const notesHtml = s.notes
      ? `<div>${sectionLabel(t('sheet.notes'))}<div class="md-view">${renderMarkdown(s.notes)}</div></div>`
      : '';

    return `
      <div style="display:flex;flex-direction:column;gap:var(--space-4)">
        <div>
          <div style="color:var(--text-parchment);font-weight:600;font-size:var(--text-lg)">${esc(summary)}</div>
          ${idBits ? `<div style="color:var(--text-muted);font-size:var(--text-sm);margin-top:var(--space-1)">${idBits}</div>` : ''}
        </div>
        <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:var(--space-2)">${abilityCells}</div>
        <div style="display:flex;flex-wrap:wrap;gap:var(--space-2)">${glance}</div>
        ${notesHtml}
      </div>`;
  }

  return { panelOverview };
}
