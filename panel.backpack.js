// ═══════════════════════════════════════════════════════════════
//  panel.backpack.js — the Backpack (inventory + currency) tab.
//
//  Inventory grouped by carry location (equipped / ready / pack), compendium
//  add-pickers (weapon/armor → resolve for AC/attacks) + a free-text item, the
//  engine attunement counter, and the currency strip.
// ═══════════════════════════════════════════════════════════════

export function makeBackpackPanel(ctx) {
  const { host, t, COINS, LOCATIONS, num, ui } = ctx;
  const { esc, dataAction, dataOn } = host.h;
  const { sectionLabel } = ui;

  function panelBackpack(c, s, editable, comp, engine) {
    const groups = LOCATIONS.map((loc) => {
      const items = s.inventory.filter((it) => (it.location || 'pack') === loc);
      if (!items.length && !editable) return '';
      const rows = items.length
        ? items.map((it) => invRow(c, it, editable, engine)).join('')
        : `<div style="color:var(--text-muted);font-size:var(--text-xs);padding:var(--space-1) 0">${esc(t('backpack.empty'))}</div>`;
      return `<div>${sectionLabel(t('loc.' + loc))}${rows}</div>`;
    }).join('');

    // Add from the compendium (ref'd → AC/attacks resolve) + a free-text item.
    const addBar = editable ? `<div style="display:flex;flex-wrap:wrap;gap:var(--space-1);align-items:center">
      ${engine && engine.listWeapons ? addRefSelect(c, 'weapon', engine.listWeapons() || [], t('backpack.addWeapon')) : ''}
      ${engine && engine.listArmor ? addRefSelect(c, 'armor', engine.listArmor() || [], t('backpack.addArmor')) : ''}
      <button class="inline-create-btn"${dataAction(host.action('invAdd'), c.id)}>＋ ${esc(t('backpack.add'))}</button>
    </div>` : '';

    const att = comp && comp.attunement;
    const attHtml = att ? `<div style="color:${att.over ? 'var(--color-danger)' : 'var(--text-muted)'};font-size:var(--text-sm)">${esc(t('backpack.attunement', { n: att.count, limit: att.limit }))}${att.over ? ' ⚠' : ''}</div>` : '';

    return `
      <div style="display:flex;flex-direction:column;gap:var(--space-3)">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-2);flex-wrap:wrap">
          ${sectionLabel(t('tab.backpack'))}
          ${addBar}
        </div>
        ${attHtml}
        ${groups}
        ${currencyStrip(c, s, editable)}
      </div>`;
  }

  function addRefSelect(c, kind, list, placeholder) {
    if (!list.length) return '';
    const opts = `<option value="">${esc(placeholder)}</option>` + list.map((o) => `<option value="${esc(o.id)}">${esc(o.name)}</option>`).join('');
    return `<select class="edit-input" style="max-width:11rem"${dataOn('change', host.action('invAddRef'), c.id, kind, '$value')}>${opts}</select>`;
  }

  function invRow(c, it, editable, engine) {
    const loc = it.location || 'pack';
    const wrec = engine ? ((it.ref && engine.getItem && engine.getItem('weapon', it.ref)) || (it.name && engine.getItemByName && engine.getItemByName('weapon', it.name))) : null;
    const masteryTag = wrec && wrec.mastery ? `<span title="${esc(t('combat.mastery'))}" style="color:var(--text-muted);font-size:var(--text-xs)">${esc(wrec.mastery)}</span>` : '';
    if (!editable) {
      return `<div style="display:flex;align-items:center;gap:var(--space-2);padding:var(--space-1) 0;border-bottom:1px solid rgba(var(--gold-muted),.12)">
        <span style="flex:1;color:var(--text-light);font-size:var(--text-sm)">${it.attuned ? '✦ ' : ''}${esc(it.name || t('misc.unnamed'))}</span>
        ${masteryTag}
        ${num(it.qty, 1) !== 1 ? `<span style="color:var(--text-muted);font-size:var(--text-xs)">×${esc(String(num(it.qty, 1)))}</span>` : ''}
      </div>`;
    }
    return `<div style="display:flex;align-items:center;gap:var(--space-1);padding:var(--space-1) 0;border-bottom:1px solid rgba(var(--gold-muted),.12)">
      <input class="edit-input" style="flex:1;min-width:6rem" value="${esc(it.name || '')}" placeholder="${esc(t('backpack.name'))}"${dataOn('change', host.action('invSet'), c.id, it.id, 'name', '$value')}>
      ${masteryTag}
      <input class="edit-input" type="number" min="1" style="width:3.5rem" value="${esc(String(num(it.qty, 1)))}" title="${esc(t('backpack.qty'))}"${dataOn('change', host.action('invSet'), c.id, it.id, 'qty', '$value')}>
      <button class="inline-create-btn" title="${esc(t('backpack.attune'))}" style="color:${it.attuned ? 'var(--accent-gold)' : 'var(--text-muted)'}"${dataAction(host.action('invAttune'), c.id, it.id)}>${it.attuned ? '✦' : '☆'}</button>
      <button class="inline-create-btn" title="${esc(t('backpack.cycleLoc'))}"${dataAction(host.action('invCycle'), c.id, it.id)}>${esc(t('loc.' + loc + 'Abbr'))}</button>
      <button class="inline-create-btn" title="${esc(t('action.remove'))}"${dataAction(host.action('invDel'), c.id, it.id)}>✕</button>
    </div>`;
  }

  function currencyStrip(c, s, editable) {
    const cells = COINS.map((coin) => {
      const v = num(s.currency[coin], 0);
      if (!editable) return `<div style="text-align:center"><div style="font-size:var(--text-xs);color:var(--text-muted)">${esc(t('coin.' + coin))}</div><div style="color:var(--text-parchment)">${esc(String(v))}</div></div>`;
      return `<div style="text-align:center">
        <div style="font-size:var(--text-xs);color:var(--text-muted)">${esc(t('coin.' + coin))}</div>
        <input class="edit-input" type="number" min="0" style="width:4rem;text-align:center" value="${esc(String(v))}"${dataOn('change', host.action('currencySet'), c.id, coin, '$value')}>
      </div>`;
    }).join('');
    return `<div>${sectionLabel(t('backpack.currency'))}<div style="display:flex;gap:var(--space-2);flex-wrap:wrap">${cells}</div></div>`;
  }

  return { panelBackpack };
}
