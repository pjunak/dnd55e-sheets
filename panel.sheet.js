// ═══════════════════════════════════════════════════════════════
//  panel.sheet.js — the Combat tab.
//
//  Attacks from equipped/ready weapons, plus a defenses recap. The vital stat
//  strip (HP/AC/Init/Speed/PB/Passive) lives in the persistent header now, so
//  this tab no longer repeats it — it's the "what can I do in a fight" view:
//    • engine    → engine-computed attacks (to-hit, damage, mastery — EQ-5).
//    • standalone→ a plain list of equipped/ready weapons from the Backpack.
//  Weapons are added/equipped in the Backpack; this tab is read-only display.
// ═══════════════════════════════════════════════════════════════

export function makeSheetPanel(ctx) {
  const { host, t, LOCATIONS, num, ui } = ctx;
  const { esc } = host.h;
  const { section, attacksBlock } = ui;

  // Equipped/ready weapons from inventory (standalone, or engine with nothing
  // equipped). We can't compute to-hit without the engine, so show name + qty.
  function readiedList(c, s) {
    const readied = (s.inventory || []).filter((it) => {
      const loc = it.location || 'pack';
      return loc === 'equipped' || loc === 'ready';
    });
    if (!readied.length) {
      return `<div style="color:var(--text-muted);font-size:var(--text-sm)">${esc(t('combat.noWeapons'))}</div>`;
    }
    const rows = readied.map((it) => {
      const loc = it.location || 'pack';
      const qty = num(it.qty, 1);
      return `<div style="display:flex;align-items:center;gap:var(--space-2);padding:var(--space-2);border-bottom:1px solid var(--border-subtle)">
        <span style="color:${loc === 'equipped' ? 'var(--accent-gold)' : 'var(--text-muted)'};font-size:var(--text-xs);text-transform:uppercase;letter-spacing:.03em;min-width:3.5rem">${esc(t('loc.' + loc + 'Abbr'))}</span>
        <span style="flex:1;color:var(--text-light);font-size:var(--text-sm)">${esc(it.name || t('misc.unnamed'))}</span>
        ${qty !== 1 ? `<span style="color:var(--text-muted);font-size:var(--text-xs)">×${esc(String(qty))}</span>` : ''}
      </div>`;
    }).join('');
    return rows;
  }

  function panelSheet(c, s, edit, comp, engine) {
    const engineAttacks = attacksBlock(comp);   // '' when no comp.weapons
    const attacks = engineAttacks
      || section(t('combat.title'), readiedList(c, s), { icon: '⚔️' });

    return `<div style="display:flex;flex-direction:column;gap:var(--space-5)">
      <div style="color:var(--text-muted);font-size:var(--text-xs)">${esc(t('combat.weaponsHint'))}</div>
      ${attacks}
    </div>`;
  }

  return { panelSheet };
}
