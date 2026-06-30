// ═══════════════════════════════════════════════════════════════
//  panel.header.js — the persistent sheet header (above the tab bar).
//
//  Always visible, on every tab: the character's identity line and the vital
//  stat strip (HP ± / AC / Initiative / Speed / Proficiency / Passive Perception),
//  plus the modification-mode toggle. Promoting these out of the tabs means the
//  numbers you reference constantly never move, and the per-tab panels stop
//  repeating them (the old Overview "glance strip" + Sheet "combat strip" are
//  gone — they lived here all along).
//
//  Edit affordances follow the mode:
//    • view             read-only, but HP keeps its ± (live play, not building).
//    • standalone + edit identity + vitals become inputs (hand-fill).
//    • engine    + edit vitals grow the ✎/↺ manual-override pair; identity is
//                       read-only (you change it in the Builder tab).
// ═══════════════════════════════════════════════════════════════

export function makeHeaderPanel(ctx) {
  const { host, t, num, signed, ui, viewModel } = ctx;
  const { esc } = host.h;
  const { dataAction, dataOn } = host.h;
  const { heroTile, overrideControls, engineBanner } = ui;

  const hpColor = (cur, max) => {
    if (max <= 0) return 'var(--text-parchment)';
    if (cur <= 0 || cur / max <= 0.35) return 'var(--color-danger)';
    if (cur / max <= 0.65) return 'var(--priority-medium)';
    return 'var(--text-parchment)';
  };

  // A centred number input that writes a flat field (standalone hand-fill).
  function fieldInput(cid, field, value, min) {
    return `<input type="number" inputmode="numeric" class="edit-input"
      style="width:4rem;text-align:center;padding:var(--space-1)" value="${esc(String(value))}"${min != null ? ` min="${min}"` : ''}
      ${dataOn('change', host.action('setField'), cid, field, '$value')}>`;
  }
  function textField(cid, label, field, value) {
    return `<label style="display:flex;flex-direction:column;gap:2px;font-size:var(--text-xs);color:var(--text-muted)">
      <span style="text-transform:uppercase;letter-spacing:.03em">${esc(label)}</span>
      <input class="edit-input" value="${esc(value || '')}"${dataOn('change', host.action('setField'), cid, field, '$value')}></label>`;
  }

  // One vital tile resolving the three modes. `field`/`autoField` key the override
  // (engine) or the flat setter (standalone). `display` is pre-formatted (signed
  // where relevant); `numeric` the raw value; `acc` gives the gold ring.
  function vital(cid, label, field, autoField, display, numeric, vm, editable, edit, acc, roEngine) {
    let editHtml = '';
    if (edit && editable) {
      if (vm.auto && !roEngine) editHtml = overrideControls(cid, field, label, numeric, vm.autoVal[autoField], vm.overridden(field));
      else if (!vm.auto) editHtml = fieldInput(cid, field, numeric, field === 'speed' ? 0 : null);
    }
    const overMark = (vm.auto && vm.overridden(field)) ? ' <span title="' + esc(t('override.edit')) + '" style="color:var(--accent-gold);font-size:var(--text-xs)">✎</span>' : '';
    return heroTile(label, esc(String(display)) + overMark, { accent: acc, editHtml });
  }

  function panelHeader(c, s, comp, editable, edit, engine, warnings) {
    const vm = viewModel(s, comp);
    const cid = c.id;
    const cur = num(s.hp, 0), max = vm.maxHp, temp = num(s.tempHp, 0);

    // ── HP tile — current/max with ratio colour, ± (live play), temp + max edit.
    const hpVal = `<span style="color:${hpColor(cur, max)}">${esc(String(cur))}</span>
      <span style="color:var(--text-muted);font-size:var(--text-lg)"> / ${esc(String(max))}</span>`;
    const tempSub = temp > 0 ? `<span style="color:var(--color-success)">+${esc(String(temp))} ${esc(t('stat.temp'))}</span>` : '';
    const hpBtns = editable
      ? `<div style="display:flex;gap:var(--space-1);justify-content:center">
           <button class="inline-create-btn" title="${esc(t('action.hpMinus'))}"${dataAction(host.action('hp'), cid, -1)}>−</button>
           <button class="inline-create-btn" title="${esc(t('action.hpPlus'))}"${dataAction(host.action('hp'), cid, 1)}>＋</button></div>`
      : '';
    let hpExtra = '';
    if (edit && editable) {
      hpExtra = vm.auto
        ? overrideControls(cid, 'maxHp', t('stat.hp'), vm.maxHp, vm.autoVal.maxHp, vm.overridden('maxHp'))
        : `<div style="display:flex;gap:var(--space-1);justify-content:center;align-items:center">
             ${fieldInput(cid, 'maxHp', max, 0)}<span style="color:var(--text-muted);font-size:var(--text-xs)">${esc(t('stat.temp'))}</span>${fieldInput(cid, 'tempHp', temp, 0)}</div>`;
    }
    const hpTile = heroTile(t('stat.hp'), hpVal, { wide: true, accent: true, sub: tempSub, editHtml: [hpBtns, hpExtra].filter(Boolean).join('') });

    const strip = [
      hpTile,
      vital(cid, t('stat.ac'), 'ac', 'ac', vm.ac, vm.ac, vm, editable, edit, true),
      vital(cid, t('stat.init'), 'initiative', 'init', signed(vm.init), vm.init, vm, editable, edit, false),
      vital(cid, t('stat.speed'), 'speed', 'speed', vm.speed, vm.speed, vm, editable, edit, false),
      vital(cid, t('stat.pb'), 'profBonus', null, signed(vm.pb), vm.pb, vm, editable, edit, false, true),
      heroTile(t('stat.passivePercAbbr'), esc(String(vm.passivePerc)), { title: t('stat.passivePerc') }),
    ].join('');

    return `<div style="display:flex;flex-direction:column;gap:var(--space-3)">
      ${identity(c, s, editable, edit, engine)}
      <div style="display:flex;flex-wrap:wrap;gap:var(--space-2);align-items:flex-start">${strip}</div>
      ${engineBanner(vm, warnings)}
    </div>`;
  }

  // Identity line (+ mode toggle). Standalone edit → labeled inputs; engine edit →
  // read-only line + a pointer to the Builder.
  function identity(c, s, editable, edit, engine) {
    const cid = c.id;
    const clsBits = [s.className, s.subclass ? '(' + s.subclass + ')' : ''].filter(Boolean).join(' ');
    const title = clsBits
      ? t('sheet.summary', { level: num(s.level, 1), cls: clsBits }).trim()
      : t('header.noClass');
    const idBits = [s.race, s.background, s.alignment, s.player ? t('field.player') + ': ' + s.player : '']
      .filter(Boolean).map(esc).join('  ·  ');

    const editingPill = edit
      ? `<span style="background:rgba(var(--accent-gold-rgb),.14);color:var(--accent-gold);border-radius:var(--radius-pill);padding:0 var(--space-2);font-size:var(--text-xs);font-weight:600;letter-spacing:.04em">✎ ${esc(t('mode.editing'))}</span>`
      : '';
    const toggle = editable
      ? (edit
          ? `<button class="edit-save-btn" title="${esc(t('mode.doneTitle'))}"${dataAction(host.action('setMode'), cid, 'view')}>✓ ${esc(t('mode.done'))}</button>`
          : `<button class="inline-create-btn" title="${esc(t('mode.editTitle'))}"${dataAction(host.action('setMode'), cid, 'edit')}>✎ ${esc(t('mode.edit'))}</button>`)
      : '';

    const titleBlock = (edit && editable && !engine)
      ? identityForm(cid, s)
      : `<div>
           <div style="color:var(--text-parchment);font-weight:700;font-size:var(--text-xl);line-height:1.2">${esc(title)}</div>
           ${idBits ? `<div style="color:var(--text-muted);font-size:var(--text-sm);margin-top:2px">${idBits}</div>` : ''}
           ${(edit && engine) ? `<div style="color:var(--text-muted);font-size:var(--text-xs);margin-top:var(--space-1)">↓ ${esc(t('mode.builderHint'))}</div>` : ''}
         </div>`;

    return `<div style="display:flex;flex-wrap:wrap;gap:var(--space-3);align-items:flex-start;justify-content:space-between">
      <div style="flex:1;min-width:14rem;display:flex;align-items:flex-start;gap:var(--space-2)">${titleBlock}</div>
      <div style="display:flex;align-items:center;gap:var(--space-2)">${editingPill}${toggle}</div>
    </div>`;
  }

  function identityForm(cid, s) {
    const grid = [
      textField(cid, t('field.player'), 'player', s.player),
      textField(cid, t('field.class'), 'className', s.className),
      textField(cid, t('field.subclass'), 'subclass', s.subclass),
      textField(cid, t('field.race'), 'race', s.race),
      textField(cid, t('field.background'), 'background', s.background),
      textField(cid, t('field.alignment'), 'alignment', s.alignment),
      `<label style="display:flex;flex-direction:column;gap:2px;font-size:var(--text-xs);color:var(--text-muted)">
        <span style="text-transform:uppercase;letter-spacing:.03em">${esc(t('field.level'))}</span>
        ${fieldInput(cid, 'level', num(s.level, 1), 1)}</label>`,
    ].join('');
    return `<div style="flex:1;display:grid;grid-template-columns:repeat(auto-fit,minmax(8.5rem,1fr));gap:var(--space-2)">${grid}</div>`;
  }

  return { panelHeader };
}
