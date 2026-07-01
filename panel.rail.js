// ═══════════════════════════════════════════════════════════════
//  panel.rail.js — the ability CARDS column (UX: full-width sheet layout).
//
//  One card per ability, stacked vertically down the left of the Character Sheet
//  and Combat tabs (in the space the host side-card used to hold). Each card is
//  the "attribute with its skills" block: a mod/score tile, the SAVING THROW
//  integrated on the ability's title line (🛡), and that ability's skills listed
//  beneath — so a skill reads directly under the score it keys off. Every value
//  carries the same hover legend (UX-7). Editable in standalone (score input +
//  save/skill toggles); computed + read-only in engine mode.
//
//  Shared by both tabs (bound onto ctx before the panels) so they present the
//  ability block identically; the tab-specific content sits in the column beside.
// ═══════════════════════════════════════════════════════════════

export function makeRail(ctx) {
  const { host, t, ABILITIES, SKILLS, num, signed, abilityMod, ui, viewModel, legends } = ctx;
  const { esc, dataAction } = host.h;
  const { card, statTip, numField, profDot, S } = ui;

  // One save/skill line: trained dot + label + total (total carries a legend).
  // Tight vertical padding keeps the stacked cards compact.
  function line(state, labelHtml, legend, dotAttr) {
    const dot = profDot(state, dotAttr);
    const total = statTip(`<strong style="${S.profTotal}">${esc(legend.total)}</strong>`, legend, { align: 'r' });
    return `<div style="display:flex;align-items:center;gap:var(--space-2);padding:2px var(--space-2)">${dot}<span style="${S.profLabel}">${labelHtml}</span>${total}</div>`;
  }

  function abilityCard(c, s, comp, a, editable, vm, L) {
    const standaloneEdit = editable && !comp;
    const score = comp && comp.abilities && comp.abilities[a] ? num(comp.abilities[a].score, 10) : num(s.abilities[a], 10);
    const mod = comp && comp.abilities && comp.abilities[a] ? num(comp.abilities[a].mod, abilityMod(score)) : abilityMod(s.abilities[a]);

    // Mod/score tile (left of the card).
    const scoreCell = standaloneEdit
      ? numField(host.h.dataOn('change', host.action('setAbility'), c.id, a, '$value'), score, { min: 1, max: 30, width: '2.75rem', ariaLabel: t('ability.' + a) })
      : `<div style="${S.abilScore}">${esc(String(score))}</div>`;
    // Compact mod/score tile — the ability's name in the title row identifies it,
    // so the abbreviation is dropped to save vertical height.
    const modBig = statTip(`<div style="${S.abilMod}">${esc(signed(mod))}</div>`, L.ability(a), { align: 'l' });
    const leftTile = `<div style="flex:none;text-align:center;background:var(--bg-raised);border:1px solid var(--border-subtle);border-radius:var(--radius);padding:var(--space-1) var(--space-2);min-width:3.5rem">
      ${modBig}<div style="margin-top:1px">${scoreCell}</div></div>`;

    // Save integrated onto the ability's title line (🛡 + dot + total).
    const sv = vm.save(a);
    const saveState = sv.exp ? 'exp' : sv.prof ? 'prof' : 'none';
    const saveDot = standaloneEdit ? dataAction(host.action('toggleSave'), c.id, a) : null;
    const saveTotal = statTip(`<strong style="${S.profTotal}">${esc(signed(sv.total))}</strong>`, L.save(a), { align: 'r' });
    const titleRow = `<div style="display:flex;align-items:center;gap:var(--space-2);padding-bottom:var(--space-1);border-bottom:1px solid var(--border-subtle);margin-bottom:var(--space-1)">
      <span style="color:var(--text-parchment);font-weight:600;font-size:var(--text-sm);letter-spacing:.03em;flex:1">${esc(t('ability.' + a))}</span>
      <span title="${esc(t('sheet.saves'))}" style="color:var(--accent-gold);font-size:var(--text-xs)">🛡 ${esc(t('sheet.saveTag'))}</span>
      ${profDot(saveState, saveDot)}${saveTotal}</div>`;

    // Skills governed by this ability (alphabetical), beneath the title.
    const skillsFor = SKILLS.filter((sk) => sk.ability === a)
      .map((sk) => ({ sk, name: t('skill.' + sk.id) }))
      .sort((x, y) => x.name.localeCompare(y.name));
    const skillRows = skillsFor.length
      ? skillsFor.map(({ sk, name }) => {
          const kv = vm.skill(sk.id, sk.ability);
          const state = kv.exp ? 'exp' : kv.prof ? 'prof' : 'none';
          const dotAttr = standaloneEdit ? dataAction(host.action('toggleSkill'), c.id, sk.id) : null;
          return line(state, esc(name), L.skill(sk.id, sk.ability), dotAttr);
        }).join('')
      : `<div style="color:var(--text-muted);font-size:var(--text-xs);padding:var(--space-1) var(--space-2)">${esc(t('sheet.noSkills'))}</div>`;

    return card(`<div style="display:flex;gap:var(--space-2);align-items:flex-start">
      ${leftTile}<div style="flex:1;min-width:0">${titleRow}${skillRows}</div></div>`, { style: 'padding:var(--space-2) var(--space-3)' });
  }

  // The stacked ability cards. Callers wrap in `.dse-cards`.
  function abilityRail(c, s, comp, editable) {
    const vm = viewModel(s, comp);
    const L = legends(s, comp, vm);
    return ABILITIES.map((a) => abilityCard(c, s, comp, a, editable, vm, L)).join('');
  }

  return { abilityRail };
}
