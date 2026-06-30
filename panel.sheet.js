// ═══════════════════════════════════════════════════════════════
//  panel.sheet.js — the Sheet (combat / saves / skills) tab.
//
//  Combat strip (HP +/-, AC, Init, Speed, PB), the engine attacks block, saving
//  throws and skills, plus passive perception. In engine mode each derived combat
//  stat (maxHp/ac/initiative/speed) carries an inline manual-override affordance
//  (ARCH-3): an ✎ to set a manual value (wins over the computed one) and a ↺ to
//  clear it, with a subtle "manual N · auto M" when they diverge.
// ═══════════════════════════════════════════════════════════════

export function makeSheetPanel(ctx) {
  const { host, t, ABILITIES, SKILLS, num, signed, ui, viewModel } = ctx;
  const { esc, dataAction, dataOn } = host.h;
  const { S, sectionLabel, statBox, rowLine, engineBanner, attacksBlock } = ui;

  // The ✎ set / ↺ clear control pair + divergence line for one overridable
  // field. `display` is the already-formatted value (may be signed), `numeric`
  // the raw number for the divergence compare/prompt.
  function overrideControls(cid, field, label, numeric, autoVal, isOver) {
    // Inline number input (no native window.prompt): type a value to override,
    // blank it to fall back to auto. Placeholder shows the computed value.
    const input = `<input type="number" inputmode="numeric" class="edit-input"
        style="width:4.5rem;text-align:center;padding:var(--space-1)"
        title="${esc(t('override.edit'))}" aria-label="${esc(label)}"
        value="${isOver ? esc(String(num(numeric))) : ''}" placeholder="${esc(String(num(autoVal)))}"
        ${dataOn('change', host.action('setOverrideValue'), cid, field, '$value')}>`;
    const clrBtn = isOver
      ? `<button class="inline-create-btn" title="${esc(t('override.auto'))}"${dataAction(host.action('clearOverride'), cid, field)}>↺</button>`
      : '';
    const diverge = (isOver && num(numeric) !== num(autoVal))
      ? `<div style="font-size:var(--text-xs);color:var(--accent-gold);margin-top:var(--space-1)">${esc(t('override.diverge', { manual: num(numeric), auto: num(autoVal) }))}</div>`
      : '';
    return `${diverge}<div style="display:flex;gap:var(--space-1);justify-content:center;align-items:center;margin-top:var(--space-1)">${input}${clrBtn}</div>`;
  }

  // An override-aware stat box. Standalone (vm.auto false) or read-only → a plain
  // statBox. Engine mode + editable → adds ✎/↺ + divergence. `field` is the
  // overrides key, `autoField` the matching vm.autoVal key, `numeric` the raw
  // value behind the (possibly signed) `display`.
  function statBoxOver(cid, label, field, autoField, display, numeric, vm, editable) {
    if (!vm.auto || !editable) return statBox(label, display);
    const isOver = vm.overridden(field);
    const mark = isOver ? ' <span title="' + esc(t('override.edit')) + '" style="color:var(--accent-gold);font-size:var(--text-xs)">✎</span>' : '';
    return `<div style="${S.statBox}">
      <div style="${S.statBoxLabel}">${esc(label)}</div>
      <div style="${S.statBoxValue}">${esc(String(display))}${mark}</div>
      ${overrideControls(cid, field, label, numeric, vm.autoVal[autoField], isOver)}
    </div>`;
  }

  function panelSheet(c, s, editable, comp, warnings) {
    const vm = viewModel(s, comp);
    const cid = c.id;
    const pb = vm.pb;

    const hpControls = editable
      ? `<div style="display:flex;gap:var(--space-1);margin-top:var(--space-1);justify-content:center">
           <button class="inline-create-btn" title="${esc(t('action.hpMinus'))}"${dataAction(host.action('hp'), cid, -1)}>−</button>
           <button class="inline-create-btn" title="${esc(t('action.hpPlus'))}"${dataAction(host.action('hp'), cid, 1)}>＋</button>
         </div>`
      : '';
    const tempBit = num(s.tempHp, 0) > 0 ? ` <span style="color:var(--color-success)">(+${esc(String(num(s.tempHp, 0)))})</span>` : '';
    // The HP box keeps its current/max display + ± controls; in engine mode the
    // maxHp override ✎/↺ sit underneath so the editable max is reachable too.
    const maxOver = (vm.auto && editable)
      ? overrideControls(cid, 'maxHp', t('stat.hp'), vm.maxHp, vm.autoVal.maxHp, vm.overridden('maxHp'))
      : '';
    const hpBox = `
      <div style="background:var(--bg-raised);border-radius:var(--radius);padding:var(--space-2) var(--space-3);min-width:6rem;text-align:center">
        <div style="font-size:var(--text-xs);color:var(--text-muted)">${esc(t('stat.hp'))}</div>
        <div style="font-size:var(--text-lg);color:var(--text-parchment);font-weight:600">
          ${esc(String(num(s.hp, 0)))} <span style="color:var(--text-muted)">/ ${esc(String(vm.maxHp))}</span>${tempBit}
        </div>
        ${hpControls}
        ${maxOver}
      </div>`;
    const combat = hpBox
      + statBoxOver(cid, t('stat.ac'), 'ac', 'ac', vm.ac, vm.ac, vm, editable)
      + statBoxOver(cid, t('stat.init'), 'initiative', 'init', signed(vm.init), vm.init, vm, editable)
      + statBoxOver(cid, t('stat.speed'), 'speed', 'speed', vm.speed, vm.speed, vm, editable)
      + statBox(t('stat.pb'), signed(pb));

    const savesRows = ABILITIES.map((a) => {
      const sv = vm.save(a);
      return rowLine(sv.prof, esc(t('ability.' + a)), signed(sv.total), sv.exp);
    }).join('');

    const skillsRows = SKILLS
      .map((sk) => ({ sk, name: t('skill.' + sk.id) }))
      .sort((x, y) => x.name.localeCompare(y.name))
      .map(({ sk, name }) => {
        const sv = vm.skill(sk.id, sk.ability);
        return rowLine(sv.prof, esc(name) + ` <span style="color:var(--text-muted);font-size:var(--text-xs)">${esc(sk.ability)}</span>`, signed(sv.total), sv.exp);
      }).join('');

    return `
      <div style="display:flex;flex-direction:column;gap:var(--space-4)">
        ${engineBanner(vm, warnings)}
        <div style="display:flex;flex-wrap:wrap;gap:var(--space-2);align-items:flex-start">${combat}</div>
        ${attacksBlock(comp)}
        <div style="display:grid;grid-template-columns:1fr 2fr;gap:var(--space-4)">
          <div>${sectionLabel(t('sheet.saves'))}${savesRows}</div>
          <div>
            ${sectionLabel(t('sheet.skills'))}${skillsRows}
            <div style="margin-top:var(--space-2);color:var(--text-muted);font-size:var(--text-sm)">
              ${esc(t('stat.passivePerc'))}: <strong style="color:var(--text-parchment)">${esc(String(vm.passivePerc))}</strong>
            </div>
          </div>
        </div>
      </div>`;
  }

  return { panelSheet };
}
