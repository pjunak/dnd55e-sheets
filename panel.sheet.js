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
  const { section, card, attacksBlock } = ui;

  const DIE_AVG = { d6: 4, d8: 5, d10: 6, d12: 7 };
  const RES_ORDER = { pool: 0, charge: 1, slot: 2, hitdice: 3 };
  function restState(cid) { try { return localStorage.getItem('dse-rest:' + cid); } catch (_) { return null; } }

  // "+1 on short rest, full on long rest" — what triggers a reset and by how much.
  function rechargeLabel(recharge) {
    return (recharge || []).map((rc) => {
      const amt = rc.amount === 'full' ? t('rest.amtFull')
        : rc.amount === 'halfLevel' ? t('rest.amtHalf')
        : (rc.amount && typeof rc.amount === 'object') ? ('+' + (rc.amount.abilityMod || 'mod'))
        : ('+' + num(rc.amount, 0));
      return t('rest.rechRule', { amt, on: rc.on === 'short' ? t('tracker.rechShort') : t('tracker.rechLong') });
    }).join(', ');
  }

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
  // Engine-built tracker (Rage / Ki / Second Wind…): the engine supplies name +
  // max + recharge from the build; the sheet stores only the current value per
  // resource key (defaults to full). ± is live play — no structural editing.
  function engineTrackerRow(c, s, r, editable) {
    const key = String(r.key);
    const max = num(r.max, 0);
    const uses = s.resourceUses || {};
    const cur = Object.prototype.hasOwnProperty.call(uses, key) ? num(uses[key], max) : max;
    const count = `<strong style="color:var(--text-parchment);font-variant-numeric:tabular-nums">${esc(String(cur))}<span style="color:var(--text-muted)"> / ${esc(String(max))}</span></strong>`;
    const rech = rechargeLabel(r.recharge);
    const rechTag = rech ? `<span style="color:var(--text-muted);font-size:var(--text-xs);white-space:nowrap">${esc(rech)}</span>` : '';
    const controls = editable
      ? `<button class="inline-create-btn" title="${esc(t('tracker.minus'))}"${dataAction(host.action('resourceUseAdjust'), c.id, key, -1, max)}>−</button>${count}<button class="inline-create-btn" title="${esc(t('tracker.plus'))}"${dataAction(host.action('resourceUseAdjust'), c.id, key, 1, max)}>＋</button><button class="inline-create-btn" title="${esc(t('tracker.reset'))}"${dataAction(host.action('resourceUseReset'), c.id, key)}>↺</button>`
      : count;
    return `<div style="display:flex;align-items:center;gap:var(--space-2);padding:var(--space-2);border-bottom:1px solid var(--border-subtle);flex-wrap:wrap">
      <span style="flex:1;min-width:8rem;color:var(--text-light);font-size:var(--text-sm)">${esc(r.name || key)}</span>
      ${rechTag}${pips(cur, max)}${controls}</div>`;
  }

  // The Rest wizard — spend hit dice for short-rest healing, then take a short or
  // long rest; the engine's recharge rules decide what resets and by how much.
  function restPanel(c, s, comp) {
    const cid = c.id;
    const resources = (comp && comp.resources) || [];
    const uses = s.resourceUses || {};
    const curOf = (r) => Object.prototype.hasOwnProperty.call(uses, r.key) ? num(uses[r.key], r.max) : r.max;
    const conMod = comp && comp.abilities && comp.abilities.CON ? num(comp.abilities.CON.mod, 0) : 0;
    const hdRows = resources.filter((r) => r.kind === 'hitdice').map((r) => {
      const cur = curOf(r);
      const heal = Math.max(1, (DIE_AVG[r.die] || 5) + conMod);
      const btn = cur > 0
        ? `<button class="inline-create-btn"${dataAction(host.action('restSpendHitDie'), cid, r.key)}>${esc(t('rest.spendDie', { die: r.die, heal }))}</button>`
        : `<span style="color:var(--text-muted);font-size:var(--text-xs)">${esc(t('rest.noneLeft'))}</span>`;
      return `<div style="display:flex;align-items:center;gap:var(--space-2);padding:var(--space-1) 0">
        <span style="flex:1;color:var(--text-light);font-size:var(--text-sm)">${esc(r.name)} <span style="color:var(--text-muted)">${esc(String(cur))}/${esc(String(r.max))}</span></span>${btn}</div>`;
    }).join('');
    const half = Math.max(1, Math.floor(num(comp && comp.totalLevel, num(s.level, 1)) / 2));
    const body = `
      <div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-2)">
        <span style="width:3px;height:.9rem;border-radius:var(--radius-pill);background:var(--accent-gold)"></span>
        <span style="font-size:var(--text-sm);font-weight:600;color:var(--text-light);text-transform:uppercase;letter-spacing:.04em">${esc(t('rest.title'))}</span>
        <button class="inline-create-btn" style="margin-left:auto" title="${esc(t('action.cancel'))}"${dataAction(host.action('restClose'), cid)}>✕</button>
      </div>
      <div style="color:var(--text-muted);font-size:var(--text-xs);margin-bottom:var(--space-1)">${esc(t('rest.hitDiceHint'))}</div>
      ${hdRows || `<div style="color:var(--text-muted);font-size:var(--text-xs)">${esc(t('rest.noHitDice'))}</div>`}
      <div style="display:flex;gap:var(--space-2);flex-wrap:wrap;margin-top:var(--space-3);align-items:center">
        <button class="inline-create-btn"${dataAction(host.action('restApply'), cid, 'short')}>☾ ${esc(t('rest.takeShort'))}</button>
        <button class="edit-save-btn"${dataAction(host.action('restApply'), cid, 'long')}>🌙 ${esc(t('rest.takeLong'))}</button>
      </div>
      <div style="color:var(--text-muted);font-size:var(--text-xs);margin-top:var(--space-2)">${esc(t('rest.longSummary', { half }))}</div>`;
    return card(body, { accent: true, style: 'margin-bottom:var(--space-3)' });
  }

  function trackers(c, s, edit, comp, engine) {
    // Engine mode: trackers are generated from the build (comp.resources) —
    // spend/regain only, no hand-adding, plus the Rest wizard.
    if (engine) {
      const list = ((comp && comp.resources) || []).slice().sort((a, b) => (RES_ORDER[a.kind] ?? 9) - (RES_ORDER[b.kind] ?? 9));
      const wizard = (restState(c.id) === 'open' && edit) ? restPanel(c, s, comp) : '';
      if (!list.length && !wizard) return '';
      const restBtn = (edit && list.length) ? `<button class="inline-create-btn"${dataAction(host.action('restOpen'), c.id)}>🌙 ${esc(t('rest.button'))}</button>` : '';
      const rows = list.length ? list.map((r) => engineTrackerRow(c, s, r, edit)).join('') : '';
      return section(t('tracker.title'), wizard + rows, { icon: '🎲', right: restBtn });
    }
    // Standalone: hand-managed trackers (no engine to derive them).
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
      ${trackers(c, s, edit, comp, engine)}
    </div>`;
  }

  return { panelSheet };
}
