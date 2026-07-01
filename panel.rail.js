// ═══════════════════════════════════════════════════════════════
//  panel.rail.js — the ability RAIL (UX: full-width sheet layout).
//
//  Once the addon takes over the character body the tabs span the full article
//  width (the host drops its side-card column). The Character Sheet and Combat
//  tabs use that reclaimed left strip for a vertical stack of the six ability
//  scores — each tile shows the big modifier, the score, and the ability's
//  SAVING THROW integrated on the abbreviation line. Every value carries the
//  same hover legend as elsewhere (UX-7). Editable in standalone (score input +
//  save toggle); computed + read-only in engine mode.
//
//  Shared by both tabs (bound onto ctx before the panels), so the two present
//  the ability block identically.
// ═══════════════════════════════════════════════════════════════

export function makeRail(ctx) {
  const { host, t, ABILITIES, num, signed, abilityMod, ui, viewModel, legends } = ctx;
  const { esc, dataAction } = host.h;
  const { statTip, numField, profDot, S } = ui;

  function railTile(c, s, comp, a, editable, vm, L) {
    const standaloneEdit = editable && !comp;
    const score = comp && comp.abilities && comp.abilities[a] ? num(comp.abilities[a].score, 10) : num(s.abilities[a], 10);
    const mod = comp && comp.abilities && comp.abilities[a] ? num(comp.abilities[a].mod, abilityMod(score)) : abilityMod(s.abilities[a]);
    const sv = vm.save(a);
    const saveState = sv.exp ? 'exp' : sv.prof ? 'prof' : 'none';
    const saveDot = standaloneEdit ? dataAction(host.action('toggleSave'), c.id, a) : null;

    const modBig = statTip(`<span style="${S.abilMod}">${esc(signed(mod))}</span>`, L.ability(a), { align: 'l' });
    const saveTotal = statTip(`<strong style="color:var(--text-parchment);font-variant-numeric:tabular-nums;font-size:var(--text-sm)">${esc(signed(sv.total))}</strong>`, L.save(a), { align: 'r' });
    const scoreCell = standaloneEdit
      ? numField(host.h.dataOn('change', host.action('setAbility'), c.id, a, '$value'), score, { min: 1, max: 30, width: '2.75rem', ariaLabel: t('ability.' + a) })
      : `<span style="${S.abilScore}">${esc(String(score))}</span>`;

    return `<div style="background:var(--bg-raised);border:1px solid var(--border-subtle);border-radius:var(--radius);padding:var(--space-2) var(--space-3)">
      <div style="display:flex;align-items:center;gap:var(--space-2);border-bottom:1px solid var(--border-subtle);padding-bottom:var(--space-1);margin-bottom:var(--space-1)">
        <span style="${S.abilAbbr};flex:1">${esc(a)}</span>
        <span title="${esc(t('sheet.saves'))}" style="color:var(--accent-gold);font-size:var(--text-xs)">🛡</span>${profDot(saveState, saveDot)}${saveTotal}
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-2)">
        ${modBig}${scoreCell}
      </div>
    </div>`;
  }

  // The rail — six ability tiles stacked. Callers wrap it in `.dse-rail`.
  function abilityRail(c, s, comp, editable) {
    const vm = viewModel(s, comp);
    const L = legends(s, comp, vm);
    return ABILITIES.map((a) => railTile(c, s, comp, a, editable, vm, L)).join('');
  }

  return { abilityRail };
}
