// ═══════════════════════════════════════════════════════════════
//  panel.header.js — the slim D&D vitals bar (shown on the mechanical tabs).
//
//  The host's native side-card owns name / portrait / species / facts, so this
//  bar adds ONLY the D&D bits: a class / level line and the vital stat strip
//  (HP ± / AC / Initiative / Speed / Proficiency / Passive Perception).
//
//  Only HP is editable here (current ±, temp, and — standalone only — max). AC /
//  Init / Speed / Proficiency come from the build: in engine mode they're
//  computed and read-only (fill them in the Builder); in standalone they're
//  hand-editable inputs. Anonymous viewers see everything read-only.
// ═══════════════════════════════════════════════════════════════

export function makeHeaderPanel(ctx) {
  const { host, t, num, signed, ui, viewModel } = ctx;
  const { esc, dataAction, dataOn } = host.h;
  const { heroTile } = ui;

  const hpColor = (cur, max) => {
    if (max <= 0) return 'var(--text-parchment)';
    if (cur <= 0 || cur / max <= 0.35) return 'var(--color-danger)';
    if (cur / max <= 0.65) return 'var(--priority-medium)';
    return 'var(--text-parchment)';
  };

  function fieldInput(cid, field, value, min) {
    return `<input type="number" inputmode="numeric" class="edit-input"
      style="width:3.5rem;text-align:center;padding:var(--space-1)" value="${esc(String(value))}"${min != null ? ` min="${min}"` : ''}
      ${dataOn('change', host.action('setField'), cid, field, '$value')}>`;
  }

  // One vital tile. Editable ONLY in standalone (`!vm.auto`) — engine builds these,
  // so engine mode is read-only. `roAlways` keeps a field read-only even standalone
  // (unused today; reserved).
  function vital(cid, label, field, display, numeric, vm, editable, acc) {
    const editHtml = (editable && !vm.auto)
      ? `<div style="margin-top:var(--space-1);display:flex;justify-content:center">${fieldInput(cid, field, numeric, field === 'speed' ? 0 : null)}</div>`
      : '';
    return heroTile(label, esc(String(display)), { accent: acc, editHtml });
  }

  function vitalsBar(c, s, comp, editable, engine) {
    const vm = viewModel(s, comp);
    const cid = c.id;
    const cur = num(s.hp, 0), max = vm.maxHp, temp = num(s.tempHp, 0);

    // D&D identity line — class / level / subclass (NOT host fields).
    const clsBits = [s.className, s.subclass ? '(' + s.subclass + ')' : ''].filter(Boolean).join(' ');
    const dndLine = clsBits ? t('sheet.summary', { level: num(s.level, 1), cls: clsBits }).trim() : '';
    const idHtml = dndLine
      ? `<div style="color:var(--text-light);font-size:var(--text-sm);font-weight:600;letter-spacing:.02em">${esc(dndLine)}</div>`
      : '';

    // HP tile — current/max with ratio colour. ± (current) + temp are live-play
    // edits (both modes); max is editable only standalone (engine computes it).
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
      const lbl = (txt, input) => `<label style="display:inline-flex;align-items:center;gap:2px;font-size:var(--text-xs);color:var(--text-muted)">${esc(txt)} ${input}</label>`;
      const maxEd = !vm.auto ? lbl(t('field.maxHp'), fieldInput(cid, 'maxHp', max, 0)) : '';
      const tempEd = lbl(t('stat.temp'), fieldInput(cid, 'tempHp', temp, 0));
      hpExtra = `<div style="display:flex;gap:var(--space-2);justify-content:center;flex-wrap:wrap;margin-top:var(--space-1)">${maxEd}${tempEd}</div>`;
    }
    const hpTile = heroTile(t('stat.hp'), hpVal, { wide: true, accent: true, sub: tempSub, editHtml: [hpBtns, hpExtra].filter(Boolean).join('') });

    const strip = [
      hpTile,
      vital(cid, t('stat.ac'), 'ac', vm.ac, vm.ac, vm, editable, true),
      vital(cid, t('stat.init'), 'initiative', signed(vm.init), vm.init, vm, editable, false),
      vital(cid, t('stat.speed'), 'speed', vm.speed, vm.speed, vm, editable, false),
      vital(cid, t('stat.pb'), 'profBonus', signed(vm.pb), vm.pb, vm, editable, false),
      heroTile(t('stat.passivePercAbbr'), esc(String(vm.passivePerc)), { title: t('stat.passivePerc') }),
    ].join('');

    return `<div style="display:flex;flex-direction:column;gap:var(--space-3);margin-bottom:var(--space-4)">
      ${idHtml}
      <div style="display:flex;flex-wrap:wrap;gap:var(--space-2);align-items:flex-start">${strip}</div>
    </div>`;
  }

  return { vitalsBar };
}
