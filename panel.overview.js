// ═══════════════════════════════════════════════════════════════
//  panel.overview.js — the Character Sheet tab (the "stat block").
//
//  Ability-centric layout (UX-2): one panel per ability score, and everything
//  that ability governs lives INSIDE it — the big modifier + score on the left,
//  the SAVING THROW integrated onto the ability's title line (obvious, compact),
//  and that ability's skills listed beneath. This is how a paper sheet groups
//  the d20 core, so it reads at a glance and the save is never hunting-distance
//  from its ability.
//
//  Every modifier, save and skill carries a hover/focus legend (UX-7) that
//  explains the stat, its formula, and the terms that sum to the number.
//
//  Editing is direct and role-gated (`edit`): in standalone, ability scores are
//  inputs and save/skill dots are toggles; in engine mode everything is computed
//  and read-only (change it in the Builder). Anonymous viewers get a clean sheet.
// ═══════════════════════════════════════════════════════════════

export function makeOverviewPanel(ctx) {
  const { host, t, ABILITIES, SKILLS, num, signed, abilityMod, ui, viewModel, legends } = ctx;
  const { esc, dataAction, dataOn } = host.h;
  const { section, card, profDot, statTip, numField, S } = ui;

  // A labelled free-text / number input that writes a flat field (standalone).
  function idField(cid, label, field, value, opts) {
    opts = opts || {};
    const input = opts.num
      ? numField(dataOn('change', host.action('setField'), cid, field, '$value'), value, { min: opts.min, ariaLabel: label })
      : `<input class="edit-input" value="${esc(value || '')}" ${dataOn('change', host.action('setField'), cid, field, '$value')}>`;
    return `<label style="display:flex;flex-direction:column;gap:2px;font-size:var(--text-xs);color:var(--text-muted)">
      <span style="text-transform:uppercase;letter-spacing:.03em">${esc(label)}</span>${input}</label>`;
  }

  function identitySection(c, s) {
    const cid = c.id;
    const grid = [
      idField(cid, t('field.class'), 'className', s.className),
      idField(cid, t('field.subclass'), 'subclass', s.subclass),
      idField(cid, t('field.level'), 'level', num(s.level, 1), { num: true, min: 1 }),
      idField(cid, t('field.background'), 'background', s.background),
      idField(cid, t('field.alignment'), 'alignment', s.alignment),
      idField(cid, t('field.player'), 'player', s.player),
    ].join('');
    return section(t('sheet.identity'),
      `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(9rem,1fr));gap:var(--space-2)">${grid}</div>`);
  }

  function panelOverview(c, s, edit, comp, engine) {
    const vm = viewModel(s, comp);
    const L = legends(s, comp, vm);
    const cid = c.id;
    const standaloneEdit = edit && !engine;     // ability entry — editors, standalone
    const profEditable = edit && !engine;       // save/skill dot toggles — editors, standalone

    const scoreOf = (a) => { const ca = comp && comp.abilities && comp.abilities[a]; return ca ? num(ca.score, 10) : num(s.abilities[a], 10); };
    const modOf = (a) => { const ca = comp && comp.abilities && comp.abilities[a]; return ca ? num(ca.mod, abilityMod(scoreOf(a))) : abilityMod(s.abilities[a]); };

    // One save/skill line: trained dot + label + total (total carries a legend).
    const line = (state, labelHtml, legend, dotAttr, saveRow) => {
      const dot = profDot(state, dotAttr);
      const total = statTip(`<strong style="${S.profTotal}">${esc(legend.total)}</strong>`, legend, { align: 'r' });
      const pad = saveRow ? '' : ';padding:var(--space-1) var(--space-2)';
      return `<div style="display:flex;align-items:center;gap:var(--space-2)${pad}">${dot}<span style="${S.profLabel}">${labelHtml}</span>${total}</div>`;
    };

    // One ability panel: mod/score tile · name + integrated save · skills.
    const abilityPanel = (a) => {
      const score = scoreOf(a), mod = modOf(a);
      const scoreCell = standaloneEdit
        ? numField(dataOn('change', host.action('setAbility'), cid, a, '$value'), score, { min: 1, max: 30, width: '3rem', ariaLabel: t('ability.' + a) })
        : `<div style="${S.abilScore}">${esc(String(score))}</div>`;
      const modBig = statTip(`<div style="${S.abilMod}">${esc(signed(mod))}</div>`, L.ability(a), { align: 'l' });
      const leftTile = `<div style="flex:none;text-align:center;background:var(--bg-raised);border:1px solid var(--border-subtle);border-radius:var(--radius);padding:var(--space-2);min-width:4.25rem">
        <div style="${S.abilAbbr}">${esc(a)}</div>${modBig}<div style="margin-top:var(--space-1)">${scoreCell}</div></div>`;

      // Save integrated onto the ability's title line (🛡 + dot + total).
      const sv = vm.save(a);
      const saveState = sv.exp ? 'exp' : sv.prof ? 'prof' : 'none';
      const saveDot = profEditable ? dataAction(host.action('toggleSave'), cid, a) : null;
      const saveTotal = statTip(`<strong style="${S.profTotal}">${esc(signed(sv.total))}</strong>`, L.save(a), { align: 'r' });
      const titleRow = `<div style="display:flex;align-items:center;gap:var(--space-2);padding-bottom:var(--space-1);border-bottom:1px solid var(--border-subtle);margin-bottom:var(--space-1)">
        <span style="color:var(--text-parchment);font-weight:600;font-size:var(--text-sm);letter-spacing:.03em;flex:1">${esc(t('ability.' + a))}</span>
        <span title="${esc(t('sheet.saves'))}" style="color:var(--accent-gold);font-size:var(--text-xs)">🛡 ${esc(t('sheet.saveTag'))}</span>
        ${profDot(saveState, saveDot)}${saveTotal}</div>`;

      // Skills governed by this ability (alphabetical).
      const skillsFor = SKILLS.filter((sk) => sk.ability === a)
        .map((sk) => ({ sk, name: t('skill.' + sk.id) }))
        .sort((x, y) => x.name.localeCompare(y.name));
      const skillRows = skillsFor.length
        ? skillsFor.map(({ sk, name }) => {
            const kv = vm.skill(sk.id, sk.ability);
            const state = kv.exp ? 'exp' : kv.prof ? 'prof' : 'none';
            const dotAttr = profEditable ? dataAction(host.action('toggleSkill'), cid, sk.id) : null;
            return line(state, esc(name), L.skill(sk.id, sk.ability), dotAttr);
          }).join('')
        : `<div style="color:var(--text-muted);font-size:var(--text-xs);padding:var(--space-1) var(--space-2)">${esc(t('sheet.noSkills'))}</div>`;

      return card(`<div style="display:flex;gap:var(--space-3);align-items:flex-start">
        ${leftTile}
        <div style="flex:1;min-width:0">${titleRow}${skillRows}</div>
      </div>`, { style: 'padding:var(--space-3)' });
    };

    const grid = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(16rem,1fr));gap:var(--space-3)">${ABILITIES.map(abilityPanel).join('')}</div>`;
    const identity = standaloneEdit ? identitySection(c, s) : '';

    return `<div style="display:flex;flex-direction:column;gap:var(--space-5)">
      ${identity}
      ${section(t('sheet.abilities'), grid)}
    </div>`;
  }

  return { panelOverview };
}
