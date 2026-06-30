// ═══════════════════════════════════════════════════════════════
//  ui.js — shared render primitives used across the tab panels.
//
//  Every function returns an HTML string built through host.h (esc) with design
//  tokens only. The most-repeated inline style blocks are hoisted into named
//  const strings (S.*) so the visual language lives in one place and can't drift
//  between call sites (M8).
//
//  `makeUI(ctx)` binds host.h + t + the pipeline pieces it needs (viewModel
//  fields are passed in by callers, not pulled here).
// ═══════════════════════════════════════════════════════════════

export function makeUI(ctx) {
  const { host, t, num, signed } = ctx;
  const { esc } = host.h;

  // ── Hoisted style strings (M8) — tokens only, reused verbatim. ────
  const S = {
    statBox: 'background:var(--bg-raised);border-radius:var(--radius);padding:var(--space-2) var(--space-3);min-width:4.5rem;text-align:center',
    statBoxLabel: 'font-size:var(--text-xs);color:var(--text-muted)',
    statBoxValue: 'font-size:var(--text-lg);color:var(--text-parchment);font-weight:600',
    miniStat: 'background:var(--bg-surface);border:1px solid rgba(var(--gold-muted),.18);border-radius:var(--radius-sm);padding:var(--space-1) var(--space-2);text-align:center;min-width:3.5rem',
    miniStatValue: 'color:var(--text-parchment);font-weight:600;font-size:var(--text-sm)',
    rowLine: 'display:flex;align-items:center;gap:var(--space-2);padding:var(--space-1) 0;border-bottom:1px solid rgba(var(--gold-muted),.12)',
    rowLabel: 'flex:1;color:var(--text-light);font-size:var(--text-sm)',
    sectionLabel: 'font-size:var(--text-xs);color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:var(--space-2)',
    subLabel: 'color:var(--text-muted);font-size:var(--text-xs);text-transform:uppercase;letter-spacing:.04em;margin-bottom:var(--space-1)',
    chip: 'display:flex;align-items:center;gap:var(--space-1);border-radius:var(--radius-sm);padding:var(--space-1) var(--space-2);min-width:8.5rem',
    panelBox: 'background:var(--bg-surface);border:1px solid rgba(var(--gold-muted),.15);border-radius:var(--radius);padding:var(--space-2) var(--space-3);display:flex;flex-direction:column',
  };

  function sectionLabel(text) {
    return `<div style="${S.sectionLabel}">${esc(text)}</div>`;
  }
  function subLabel(text) {
    return `<div style="${S.subLabel}">${esc(text)}</div>`;
  }
  function statBox(label, value) {
    return `<div style="${S.statBox}">
      <div style="${S.statBoxLabel}">${esc(label)}</div>
      <div style="${S.statBoxValue}">${esc(String(value))}</div></div>`;
  }
  function miniStat(label, value) {
    return `<div style="${S.miniStat}">
      <div style="${S.statBoxLabel}">${esc(label)}</div>
      <div style="${S.miniStatValue}">${esc(String(value))}</div></div>`;
  }
  function rowLine(prof, labelHtml, totalText, exp) {
    const mark = exp
      ? `<span style="color:var(--accent-gold)" title="${esc(t('misc.expertise'))}">★</span>`
      : prof
        ? `<span style="color:var(--accent-gold)" title="${esc(t('misc.proficient'))}">●</span>`
        : `<span style="color:var(--text-muted)">○</span>`;
    return `<div style="${S.rowLine}">
      ${mark}<span style="${S.rowLabel}">${labelHtml}</span>
      <strong style="color:var(--text-parchment)">${esc(totalText)}</strong></div>`;
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
    return `<div style="background:var(--bg-raised);border-radius:var(--radius);padding:var(--space-2) var(--space-3)">
      <div style="font-size:var(--text-sm);color:var(--text-light);margin-bottom:var(--space-1)">${esc(label)}</div>
      ${control}${hint ? `<div style="color:var(--text-muted);font-size:var(--text-xs);margin-top:var(--space-1)">${esc(hint)}</div>` : ''}</div>`;
  }

  function spellChip(name, sub, opts) {
    opts = opts || {};
    const color = opts.danger ? 'var(--color-danger)' : 'var(--text-parchment)';
    const bd = opts.danger ? 'var(--color-danger)' : 'rgba(var(--gold-muted),.2)';
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
      return `<div style="${S.rowLine}">
        <span style="${S.rowLabel}">${esc(w.name)}${mastery}${profMark}</span>
        <strong style="color:var(--text-parchment)">${esc(signed(num(w.attackBonus)))}</strong>
        <span style="color:var(--text-muted);font-size:var(--text-sm);min-width:6rem;text-align:right">${esc(w.damage)}${w.damageType ? ' ' + esc(w.damageType) : ''}</span>
      </div>`;
    }).join('');
    return `<div>${sectionLabel(t('sheet.attacks'))}${rows}</div>`;
  }

  return {
    S, sectionLabel, subLabel, statBox, miniStat, rowLine,
    selectBox, fieldRow, choiceBlock, spellChip, engineBanner, attacksBlock,
  };
}
