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
  const { esc, dataAction, dataOn } = host.h;
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

  // ── Resource trackers (Rage / Ki / slots / hit dice…). ± is a live-play action
  //    (available in view); naming, max and add/remove are modification mode. ──
  function pips(cur, max) {
    if (max <= 0 || max > 12) return '';
    let html = '';
    for (let i = 0; i < max; i++) html += `<span style="display:inline-block;width:.7rem;height:.7rem;border-radius:50%;border:1px solid var(--accent-gold);background:${i < cur ? 'var(--accent-gold)' : 'transparent'};margin-right:3px"></span>`;
    return `<span style="display:inline-flex;align-items:center">${html}</span>`;
  }
  function trackerRow(c, r, edit) {
    const cur = num(r.current, 0), max = num(r.max, 0);
    const minus = `<button class="inline-create-btn" title="${esc(t('tracker.minus'))}"${dataAction(host.action('resourceAdjust'), c.id, r.id, -1)}>−</button>`;
    const plus = `<button class="inline-create-btn" title="${esc(t('tracker.plus'))}"${dataAction(host.action('resourceAdjust'), c.id, r.id, 1)}>＋</button>`;
    const count = max > 0
      ? `<strong style="color:var(--text-parchment);font-variant-numeric:tabular-nums">${esc(String(cur))}<span style="color:var(--text-muted)"> / ${esc(String(max))}</span></strong>`
      : `<strong style="color:var(--text-parchment);font-variant-numeric:tabular-nums">${esc(String(cur))}</strong>`;
    const pipsHtml = (!edit && pips(cur, max)) || '';
    if (!edit) {
      const reset = max > 0 ? `<button class="inline-create-btn" title="${esc(t('tracker.reset'))}"${dataAction(host.action('resourceSet'), c.id, r.id, 'current', max)}>↺</button>` : '';
      return `<div style="display:flex;align-items:center;gap:var(--space-2);padding:var(--space-2);border-bottom:1px solid var(--border-subtle)">
        <span style="flex:1;color:var(--text-light);font-size:var(--text-sm)">${esc(r.name || t('misc.unnamed'))}</span>
        ${pipsHtml}${minus}${count}${plus}${reset}</div>`;
    }
    return `<div style="display:flex;align-items:center;gap:var(--space-1);padding:var(--space-1) var(--space-2);border-bottom:1px solid var(--border-subtle)">
      <input class="edit-input" style="flex:1;min-width:6rem" value="${esc(r.name || '')}" placeholder="${esc(t('tracker.name'))}"${dataOn('change', host.action('resourceSet'), c.id, r.id, 'name', '$value')}>
      ${minus}${count}${plus}
      <span style="color:var(--text-muted)">/</span>
      <input class="edit-input" type="number" min="0" style="width:3.5rem" value="${esc(String(max))}" title="${esc(t('tracker.max'))}"${dataOn('change', host.action('resourceSet'), c.id, r.id, 'max', '$value')}>
      <button class="inline-create-btn" title="${esc(t('action.remove'))}"${dataAction(host.action('resourceDel'), c.id, r.id)}>✕</button>
    </div>`;
  }
  function trackers(c, s, edit) {
    const list = s.resources || [];
    if (!list.length && !edit) return '';
    const add = edit ? `<button class="inline-create-btn"${dataAction(host.action('resourceAdd'), c.id)}>＋ ${esc(t('tracker.add'))}</button>` : '';
    const body = list.length
      ? list.map((r) => trackerRow(c, r, edit)).join('')
      : `<div style="color:var(--text-muted);font-size:var(--text-sm)">${esc(t('tracker.empty'))}</div>`;
    const hint = edit ? `<div style="color:var(--text-muted);font-size:var(--text-xs);margin-top:var(--space-1)">${esc(t('tracker.hint'))}</div>` : '';
    return section(t('tracker.title'), body + hint, { icon: '🎲', right: add });
  }

  function panelSheet(c, s, edit, comp, engine) {
    const engineAttacks = attacksBlock(comp);   // '' when no comp.weapons
    const attacks = engineAttacks
      || section(t('combat.title'), readiedList(c, s), { icon: '⚔️' });

    return `<div style="display:flex;flex-direction:column;gap:var(--space-5)">
      <div style="color:var(--text-muted);font-size:var(--text-xs)">${esc(t('combat.weaponsHint'))}</div>
      ${attacks}
      ${trackers(c, s, edit)}
    </div>`;
  }

  return { panelSheet };
}
