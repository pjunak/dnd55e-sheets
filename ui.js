// ═══════════════════════════════════════════════════════════════
//  ui.js — shared render primitives used across the tab panels.
//
//  Every function returns an HTML string built through host.h (esc) with design
//  tokens only. The most-repeated inline style blocks are hoisted into named
//  const strings (S.*) so the visual language lives in one place and can't drift
//  between call sites (M8).
//
//  The visual system (2024 redesign):
//    • section(title, body)   a titled group — a gold tick + label + hairline,
//                             then the body. The one section header everywhere,
//                             so hierarchy reads consistently across tabs.
//    • card(body)             a boxed surface (bg-surface) for nested groups.
//    • heroTile / abilityTile the two stat-tile shapes (vitals vs. abilities).
//    • profRow                a saving-throw / skill line (trained dot + total).
//    • overrideControls       the engine-mode "type a manual value / ↺ auto" pair,
//                             shared by the header vitals and any panel.
//
//  `makeUI(ctx)` binds host.h + t + the pipeline pieces it needs (viewModel
//  fields are passed in by callers, not pulled here).
// ═══════════════════════════════════════════════════════════════

export function makeUI(ctx) {
  const { host, t, num, signed } = ctx;
  const { esc } = host.h;

  // ── Hoisted style strings (M8) — tokens only, reused verbatim. ────
  const S = {
    // Layout
    column: 'display:flex;flex-direction:column;gap:var(--space-4)',
    // Titled section
    sectionHead: 'display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-3);padding-bottom:var(--space-1);border-bottom:1px solid var(--border-subtle)',
    sectionTick: 'width:3px;height:.9rem;border-radius:var(--radius-pill);background:var(--accent-gold);flex:none',
    sectionTitle: 'font-size:var(--text-sm);font-weight:600;color:var(--text-light);letter-spacing:.04em;text-transform:uppercase',
    // Boxed surface
    card: 'background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);padding:var(--space-3) var(--space-4)',
    // Vital stat tile
    heroTile: 'flex:1 1 5rem;min-width:5rem;background:var(--bg-raised);border:1px solid var(--border-subtle);border-radius:var(--radius);padding:var(--space-2) var(--space-3);text-align:center',
    tileLabel: 'font-size:var(--text-xs);color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;white-space:nowrap',
    tileValue: 'font-size:var(--text-xl);color:var(--text-parchment);font-weight:700;line-height:1.15',
    // Ability tile
    abilTile: 'background:var(--bg-raised);border:1px solid var(--border-subtle);border-radius:var(--radius);padding:var(--space-2) var(--space-1);text-align:center',
    abilAbbr: 'font-size:var(--text-xs);color:var(--text-muted);letter-spacing:.08em;font-weight:600',
    abilMod: 'font-size:var(--text-2xl);color:var(--text-parchment);font-weight:700;line-height:1.1',
    abilScore: 'display:inline-block;margin-top:var(--space-1);min-width:1.75rem;padding:0 var(--space-1);background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-pill);font-size:var(--text-xs);color:var(--text-light)',
    // Proficiency row (save / skill)
    profRow: 'display:flex;align-items:center;gap:var(--space-2);padding:var(--space-1) var(--space-2);border-radius:var(--radius-sm)',
    profLabel: 'flex:1;color:var(--text-light);font-size:var(--text-sm)',
    profTotal: 'color:var(--text-parchment);font-weight:600;font-variant-numeric:tabular-nums',
    abilityTag: 'color:var(--text-muted);font-size:var(--text-xs);text-transform:uppercase;letter-spacing:.03em',
    // Misc labels
    sectionLabel: 'font-size:var(--text-xs);color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:var(--space-2)',
    subLabel: 'color:var(--text-muted);font-size:var(--text-xs);text-transform:uppercase;letter-spacing:.04em;margin-bottom:var(--space-1)',
    chip: 'display:flex;align-items:center;gap:var(--space-1);border-radius:var(--radius-sm);padding:var(--space-1) var(--space-2);min-width:8.5rem',
    // Legacy compact tiles (Builder summary still uses these)
    statBox: 'background:var(--bg-raised);border-radius:var(--radius);padding:var(--space-2) var(--space-3);min-width:4.5rem;text-align:center',
    statBoxLabel: 'font-size:var(--text-xs);color:var(--text-muted)',
    statBoxValue: 'font-size:var(--text-lg);color:var(--text-parchment);font-weight:600',
    miniStat: 'background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:var(--space-1) var(--space-2);text-align:center;min-width:3.5rem',
    miniStatValue: 'color:var(--text-parchment);font-weight:600;font-size:var(--text-sm)',
  };

  // ── Titled section + boxed card — the two grouping primitives. ────
  // `section` is a header rule + body (no box); `right` is optional header-right
  // HTML (a count, an add button…). `card` is a bordered surface for nesting.
  function section(title, body, opts) {
    opts = opts || {};
    const right = opts.right ? `<div style="margin-left:auto;display:flex;align-items:center;gap:var(--space-2)">${opts.right}</div>` : '';
    const icon = opts.icon ? `<span style="font-size:var(--text-sm)">${esc(opts.icon)}</span>` : `<span style="${S.sectionTick}"></span>`;
    return `<section style="display:flex;flex-direction:column">
      <div style="${S.sectionHead}">${icon}<span style="${S.sectionTitle}">${esc(title)}</span>${right}</div>
      <div>${body}</div></section>`;
  }
  function card(body, opts) {
    opts = opts || {};
    const extra = opts.danger ? ';border-color:var(--color-danger-bd)' : opts.accent ? ';border-color:rgba(var(--accent-gold-rgb),.35)' : '';
    return `<div style="${S.card}${extra}${opts.style ? ';' + opts.style : ''}">${body}</div>`;
  }

  function sectionLabel(text) { return `<div style="${S.sectionLabel}">${esc(text)}</div>`; }
  function subLabel(text) { return `<div style="${S.subLabel}">${esc(text)}</div>`; }

  // ── Vital stat tile (HP / AC / Init / Speed / Proficiency / Passive). ──
  // `valueHtml` is pre-rendered (may carry colour); `sub` a small line under it
  // (temp HP, "auto" note); `editHtml` the edit-mode controls beneath. `accent`
  // gives a faint gold ring (used on HP/AC — the two you read most).
  function heroTile(label, valueHtml, opts) {
    opts = opts || {};
    const ring = opts.accent ? ';border-color:rgba(var(--accent-gold-rgb),.35);box-shadow:inset 0 0 0 1px rgba(var(--accent-gold-rgb),.08)' : '';
    const grow = opts.wide ? ';flex-grow:2;min-width:8rem' : '';
    const sub = opts.sub ? `<div style="font-size:var(--text-xs);color:var(--text-muted);margin-top:1px">${opts.sub}</div>` : '';
    const edit = opts.editHtml ? `<div style="margin-top:var(--space-1)">${opts.editHtml}</div>` : '';
    return `<div style="${S.heroTile}${ring}${grow}" title="${esc(opts.title || label)}">
      <div style="${S.tileLabel}">${esc(label)}</div>
      <div style="${S.tileValue}">${valueHtml}</div>${sub}${edit}</div>`;
  }

  // ── Ability tile — abbr · big modifier · score pill. `scoreHtml` is either the
  //    plain score or an <input> (edit mode). `bonusHtml` shows a grant delta. ──
  function abilityTile(abbr, modText, scoreHtml, opts) {
    opts = opts || {};
    const scoreCell = opts.rawScore
      ? `<div style="margin-top:var(--space-1)">${scoreHtml}</div>`
      : `<div style="${S.abilScore}">${scoreHtml}</div>`;
    return `<div style="${S.abilTile}" title="${esc(opts.title || abbr)}">
      <div style="${S.abilAbbr}">${esc(abbr)}</div>
      <div style="${S.abilMod}">${esc(modText)}</div>
      ${scoreCell}${opts.bonusHtml || ''}</div>`;
  }

  // ── Saving-throw / skill line. `state` ∈ none|prof|exp drives the trained dot.
  //    `dotAttr` (optional) makes the dot a clickable toggle (standalone edit). ──
  function profDot(state, dotAttr) {
    const sym = state === 'exp' ? '◉' : state === 'prof' ? '●' : '○';
    const col = state === 'none' ? 'var(--text-muted)' : 'var(--accent-gold)';
    const title = state === 'exp' ? t('misc.expertise') : state === 'prof' ? t('misc.proficient') : t('misc.notProficient');
    if (dotAttr) {
      return `<button class="dse-dot" title="${esc(title)}" style="background:none;border:none;cursor:pointer;padding:0;font-size:var(--text-base);line-height:1;color:${col}"${dotAttr}>${sym}</button>`;
    }
    return `<span title="${esc(title)}" style="color:${col};font-size:var(--text-base);line-height:1">${sym}</span>`;
  }
  function profRow(state, labelHtml, totalText, opts) {
    opts = opts || {};
    return `<div style="${S.profRow}">
      ${profDot(state, opts.dotAttr)}<span style="${S.profLabel}">${labelHtml}</span>
      <strong style="${S.profTotal}">${esc(totalText)}</strong></div>`;
  }
  // Legacy alias kept for any remaining caller (maps prof/exp booleans → state).
  function rowLine(prof, labelHtml, totalText, exp) {
    return profRow(exp ? 'exp' : prof ? 'prof' : 'none', labelHtml, totalText);
  }

  // ── Engine-mode "manual override" control pair (ARCH-3). Type a value to beat
  //    the computed one; ↺ clears back to auto; a faint line flags divergence. ──
  function overrideControls(cid, field, label, numeric, autoVal, isOver) {
    const input = `<input type="number" inputmode="numeric" class="edit-input"
        style="width:4rem;text-align:center;padding:var(--space-1)"
        title="${esc(t('override.edit'))}" aria-label="${esc(label)}"
        value="${isOver ? esc(String(num(numeric))) : ''}" placeholder="${esc(String(num(autoVal)))}"
        ${host.h.dataOn('change', host.action('setOverrideValue'), cid, field, '$value')}>`;
    const clrBtn = isOver
      ? `<button class="inline-create-btn" title="${esc(t('override.auto'))}"${host.h.dataAction(host.action('clearOverride'), cid, field)}>↺</button>`
      : '';
    const diverge = (isOver && num(numeric) !== num(autoVal))
      ? `<div style="font-size:var(--text-xs);color:var(--accent-gold);margin-top:var(--space-1)">${esc(t('override.diverge', { manual: num(numeric), auto: num(autoVal) }))}</div>`
      : '';
    return `${diverge}<div style="display:flex;gap:var(--space-1);justify-content:center;align-items:center">${input}${clrBtn}</div>`;
  }

  // ── Statboxes the Builder summary still uses. ─────────────────────
  function statBox(label, value) {
    return `<div style="${S.statBox}"><div style="${S.statBoxLabel}">${esc(label)}</div>
      <div style="${S.statBoxValue}">${esc(String(value))}</div></div>`;
  }
  function miniStat(label, value) {
    return `<div style="${S.miniStat}"><div style="${S.statBoxLabel}">${esc(label)}</div>
      <div style="${S.miniStatValue}">${esc(String(value))}</div></div>`;
  }

  // Native <select>. Read-only renders the chosen label as text.
  function selectBox(value, options, actionAttr, placeholder, ro) {
    if (ro) { const sel = options.find((o) => String(o.value) === String(value)); return `<span style="color:var(--text-parchment)">${esc(sel ? sel.label : (value || t('misc.notSet')))}</span>`; }
    const opts = (placeholder != null ? `<option value="">${esc(placeholder)}</option>` : '')
      + options.map((o) => `<option value="${esc(o.value)}"${String(o.value) === String(value) ? ' selected' : ''}>${esc(o.label)}</option>`).join('');
    return `<select class="edit-input" ${actionAttr}>${opts}</select>`;
  }
  function fieldRow(label, control) {
    return `<div style="display:grid;grid-template-columns:8rem 1fr;gap:var(--space-2);align-items:center;padding:var(--space-1) 0">
      <label class="edit-label" style="margin:0">${esc(label)}</label><div>${control}</div></div>`;
  }
  function choiceBlock(label, control, hint) {
    return `<div style="background:var(--bg-raised);border:1px solid var(--border-subtle);border-radius:var(--radius);padding:var(--space-2) var(--space-3)">
      <div style="font-size:var(--text-sm);color:var(--text-light);margin-bottom:var(--space-1)">${esc(label)}</div>
      ${control}${hint ? `<div style="color:var(--text-muted);font-size:var(--text-xs);margin-top:var(--space-1)">${esc(hint)}</div>` : ''}</div>`;
  }

  function spellChip(name, sub, opts) {
    opts = opts || {};
    const color = opts.danger ? 'var(--color-danger)' : 'var(--text-parchment)';
    const bd = opts.danger ? 'var(--color-danger)' : 'var(--border-subtle)';
    const badge = opts.badge ? `<span title="${esc(opts.badgeTitle || '')}">${esc(opts.badge)}</span>` : '';
    const right = opts.removeAttr
      ? `<button class="inline-create-btn" title="${esc(t('action.remove'))}"${opts.removeAttr}>✕</button>`
      : (opts.locked ? `<span title="${esc(t('spell.alwaysPrepared'))}" style="color:var(--accent-gold)">🔒</span>` : '');
    return `<div title="${esc(opts.title || '')}" style="${S.chip};background:var(--bg-raised);border:1px solid ${bd}">
      ${badge}<div style="flex:1"><div style="color:${color};font-size:var(--text-sm)">${esc(name)}</div>${sub ? `<div style="color:var(--text-muted);font-size:var(--text-xs)">${esc(sub)}</div>` : ''}</div>${right}</div>`;
  }

  // A subtle "auto-calculated by the rules engine" banner + any engine warnings.
  // Renders nothing in standalone (vm.auto false).
  function engineBanner(vm, warnings) {
    if (!vm || !vm.auto) return '';
    const warns = (warnings || []).slice(0, 4);
    const warnHtml = warns.length
      ? `<div style="margin-top:var(--space-1);color:var(--color-danger);font-size:var(--text-xs)">${warns.map((w) => '⚠ ' + esc(String(w))).join('<br>')}</div>`
      : '';
    return `
      <div style="background:rgba(var(--accent-gold-rgb),.06);border:1px solid rgba(var(--gold-muted),.18);border-radius:var(--radius);padding:var(--space-1) var(--space-3);color:var(--text-muted);font-size:var(--text-xs)">
        ✨ ${esc(t('engine.auto'))}
        ${warnHtml}
      </div>`;
  }

  // Combat attacks from equipped/ready weapons (engine-computed, EQ-5). Renders
  // nothing in standalone (no comp.weapons).
  function attacksBlock(comp) {
    const weapons = (comp && comp.weapons) || [];
    if (!weapons.length) return '';
    const rows = weapons.map((w) => {
      const mastery = w.mastery
        ? ` <span title="${esc(t('combat.mastery'))}" style="color:${w.masteryActive ? 'var(--accent-gold)' : 'var(--text-muted)'};font-size:var(--text-xs)">${w.masteryActive ? '★' : ''}${esc(w.mastery)}</span>`
        : '';
      const profMark = w.proficient ? '' : ` <span title="${esc(t('combat.notProficient'))}" style="color:var(--color-danger);font-size:var(--text-xs)">⚠</span>`;
      return `<div style="display:flex;align-items:center;gap:var(--space-2);padding:var(--space-2);border-bottom:1px solid var(--border-subtle)">
        <span style="flex:1;color:var(--text-light);font-size:var(--text-sm)">${esc(w.name)}${mastery}${profMark}</span>
        <strong style="color:var(--text-parchment);font-variant-numeric:tabular-nums">${esc(signed(num(w.attackBonus)))}</strong>
        <span style="color:var(--text-muted);font-size:var(--text-sm);min-width:6rem;text-align:right">${esc(w.damage)}${w.damageType ? ' ' + esc(w.damageType) : ''}</span>
      </div>`;
    }).join('');
    return section(t('combat.title'), rows);
  }

  return {
    S, section, card, sectionLabel, subLabel,
    heroTile, abilityTile, profDot, profRow, rowLine, overrideControls,
    statBox, miniStat,
    selectBox, fieldRow, choiceBlock, spellChip, engineBanner, attacksBlock,
  };
}
