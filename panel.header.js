// ═══════════════════════════════════════════════════════════════
//  panel.header.js — the slim D&D vitals bar (shown on the mechanical tabs).
//
//  The host's native side-card already owns name / portrait / species / facts,
//  so this bar adds ONLY the D&D-specific bits the host doesn't have: a class /
//  level / alignment line and the vital stat strip (HP ± / AC / Initiative /
//  Speed / Proficiency / Passive Perception). No identity duplication, no
//  modification-mode toggle — editing is direct and gated purely by role
//  (`editable`): engine mode grows the ✎/↺ override pair, standalone grows plain
//  inputs, anonymous viewers see read-only.
// ═══════════════════════════════════════════════════════════════

export function makeHeaderPanel(ctx) {
  const { host, t, num, signed, ui, viewModel } = ctx;
  const { esc, dataAction, dataOn } = host.h;
  const { heroTile, overrideControls, engineBanner } = ui;

  const hpColor = (cur, max) => {
    if (max <= 0) return 'var(--text-parchment)';
    if (cur <= 0 || cur / max <= 0.35) return 'var(--color-danger)';
    if (cur / max <= 0.65) return 'var(--priority-medium)';
    return 'var(--text-parchment)';
  };

  function fieldInput(cid, field, value, min) {
    return `<input type="number" inputmode="numeric" class="edit-input"
      style="width:4rem;text-align:center;padding:var(--space-1)" value="${esc(String(value))}"${min != null ? ` min="${min}"` : ''}
      ${dataOn('change', host.action('setField'), cid, field, '$value')}>`;
  }

  // One vital tile across the three modes. Editing shows only for editors
  // (`editable`); `roEngine` keeps PB read-only in engine mode (computed).
  function vital(cid, label, field, autoField, display, numeric, vm, editable, acc, roEngine) {
    let editHtml = '';
    if (editable) {
      if (vm.auto && !roEngine) editHtml = overrideControls(cid, field, label, numeric, vm.autoVal[autoField], vm.overridden(field));
      else if (!vm.auto) editHtml = fieldInput(cid, field, numeric, field === 'speed' ? 0 : null);
    }
    const overMark = (vm.auto && vm.overridden(field)) ? ' <span title="' + esc(t('override.edit')) + '" style="color:var(--accent-gold);font-size:var(--text-xs)">✎</span>' : '';
    return heroTile(label, esc(String(display)) + overMark, { accent: acc, editHtml });
  }

  function vitalsBar(c, s, comp, editable, engine, warnings) {
    const vm = viewModel(s, comp);
    const cid = c.id;
    const cur = num(s.hp, 0), max = vm.maxHp, temp = num(s.tempHp, 0);

    // D&D identity line — class / level / subclass / alignment (NOT host fields).
    const clsBits = [s.className, s.subclass ? '(' + s.subclass + ')' : ''].filter(Boolean).join(' ');
    const dndLine = [
      clsBits ? t('sheet.summary', { level: num(s.level, 1), cls: clsBits }).trim() : '',
      s.alignment,
    ].filter(Boolean).join('  ·  ');
    const idHtml = dndLine
      ? `<div style="color:var(--text-light);font-size:var(--text-sm);font-weight:600;letter-spacing:.02em">${esc(dndLine)}</div>`
      : '';

    // HP tile — ratio colour, ± (editors), temp + max edit.
    const hpVal = `<span style="color:${hpColor(cur, max)}">${esc(String(cur))}</span>
      <span style="color:var(--text-muted);font-size:var(--text-lg)"> / ${esc(String(max))}</span>`;
    const tempSub = temp > 0 ? `<span style="color:var(--color-success)">+${esc(String(temp))} ${esc(t('stat.temp'))}</span>` : '';
    const hpBtns = editable
      ? `<div style="display:flex;gap:var(--space-1);justify-content:center">
           <button class="inline-create-btn" title="${esc(t('action.hpMinus'))}"${dataAction(host.action('hp'), cid, -1)}>−</button>
           <button class="inline-create-btn" title="${esc(t('action.hpPlus'))}"${dataAction(host.action('hp'), cid, 1)}>＋</button></div>`
      : '';
    let hpExtra = '';
    if (editable) {
      hpExtra = vm.auto
        ? overrideControls(cid, 'maxHp', t('stat.hp'), vm.maxHp, vm.autoVal.maxHp, vm.overridden('maxHp'))
        : `<div style="display:flex;gap:var(--space-1);justify-content:center;align-items:center">
             ${fieldInput(cid, 'maxHp', max, 0)}<span style="color:var(--text-muted);font-size:var(--text-xs)">${esc(t('stat.temp'))}</span>${fieldInput(cid, 'tempHp', temp, 0)}</div>`;
    }
    const hpTile = heroTile(t('stat.hp'), hpVal, { wide: true, accent: true, sub: tempSub, editHtml: [hpBtns, hpExtra].filter(Boolean).join('') });

    const strip = [
      hpTile,
      vital(cid, t('stat.ac'), 'ac', 'ac', vm.ac, vm.ac, vm, editable, true),
      vital(cid, t('stat.init'), 'initiative', 'init', signed(vm.init), vm.init, vm, editable, false),
      vital(cid, t('stat.speed'), 'speed', 'speed', vm.speed, vm.speed, vm, editable, false),
      vital(cid, t('stat.pb'), 'profBonus', null, signed(vm.pb), vm.pb, vm, editable, false, true),
      heroTile(t('stat.passivePercAbbr'), esc(String(vm.passivePerc)), { title: t('stat.passivePerc') }),
    ].join('');

    return `<div style="display:flex;flex-direction:column;gap:var(--space-3);margin-bottom:var(--space-4)">
      ${idHtml}
      <div style="display:flex;flex-wrap:wrap;gap:var(--space-2);align-items:flex-start">${strip}</div>
      ${engineBanner(vm, warnings)}
    </div>`;
  }

  return { vitalsBar };
}
