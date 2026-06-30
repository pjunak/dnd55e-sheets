// ═══════════════════════════════════════════════════════════════
//  panel.spellbook.js — the Spellbook tab.
//
//  Standalone → a simple editable spell-card list. Engine mode → an engine
//  summary (DC/attack/prepared/slots), per-class cantrip + prepared SLOTS with a
//  draggable available pool, choose-grant pickers (Magic Initiate / Fey Touched /
//  lineage cantrip), the always-prepared granted set, and an Extra/Copied group
//  with forced-duplicate colouring (SP-1..SP-12 / UI-4..6).
// ═══════════════════════════════════════════════════════════════

export function makeSpellbookPanel(ctx) {
  const { host, t, num, signed, titleize, ui } = ctx;
  const { esc, dataAction, dataOn } = host.h;
  const { sectionLabel, subLabel, spellChip } = ui;

  // Resolve a spell ref → {name, level, school}. A ref the compendium can't
  // resolve gets a neutral placeholder (not a slug-titleized id) — titleize is
  // reserved for known-clean keys (class/source ids), never raw refs.
  function spellInfo(engine, ref) {
    const r = engine && engine.getItem ? engine.getItem('spell', ref) : null;
    return r ? { name: r.name, level: num(r.level, 0), school: r.school || '' }
             : { name: t('misc.unknown'), level: null, school: '' };
  }
  function lvlLabel(level) { return level === 0 ? t('spellbook.cantrip') : level == null ? '' : t('spellbook.lvlN', { n: level }); }

  function panelSpellbook(c, s, editable, comp, engine) {
    const sc = comp && comp.spellcasting;
    if (!sc || !engine) return panelSpellbookManual(c, s, editable);

    const granted = sc.granted || [];
    const alwaysSet = new Set(granted.filter((g) => g.alwaysPrepared).map((g) => g.ref));
    const blocks = [spellcastingSummary(s, comp)];
    for (const p of (sc.perClass || [])) blocks.push(classSpellSection(c, s, p, comp, engine, editable, alwaysSet));
    const pending = sc.pendingChoices || [];
    if (pending.length) blocks.push(grantChoicesSection(c, s, pending, engine, editable));
    if (granted.length) blocks.push(grantedSection(granted));
    blocks.push(extraSection(c, s, editable, granted));

    return `<div style="display:flex;flex-direction:column;gap:var(--space-4)">
      ${sectionLabel(t('tab.spellbook'))}
      ${blocks.filter(Boolean).join('')}</div>`;
  }

  function panelSpellbookManual(c, s, editable) {
    const spells = s.spells.slice().sort((a, b) => num(a.level) - num(b.level) || String(a.name || '').localeCompare(String(b.name || '')));
    const cards = spells.length
      ? `<div style="display:flex;flex-wrap:wrap;gap:var(--space-2)">${spells.map((sp) => spellCard(c, sp, editable, false)).join('')}</div>`
      : `<div style="color:var(--text-muted);font-size:var(--text-sm)">${esc(t('spellbook.empty'))}</div>`;
    const adder = editable ? `<button class="inline-create-btn"${dataAction(host.action('spellAdd'), c.id)}>＋ ${esc(t('spellbook.add'))}</button>` : '';
    return `<div style="display:flex;flex-direction:column;gap:var(--space-3)">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-2)">${sectionLabel(t('tab.spellbook'))}${adder}</div>
      ${cards}</div>`;
  }

  // Engine-reported per-class save DC / attack / prepared count + slot pool.
  function spellcastingSummary(s, comp) {
    const sc = comp && comp.spellcasting;
    if (!sc || !Array.isArray(sc.perClass) || !sc.perClass.length) return '';
    const rows = sc.perClass.map((p) => {
      const prep = ((s.preparedSpells || {})[p.classId] || []).length;
      const bits = [
        t('spell.saveDC') + ' ' + num(p.saveDC),
        t('spell.attack') + ' ' + signed(num(p.spellAttack)),
        t('spell.prepared', { n: prep, limit: num(p.preparedLimit) }),
      ];
      if (p.ritual) bits.push(t('spell.ritual'));
      return `<div style="color:var(--text-light);font-size:var(--text-sm)"><strong style="color:var(--text-parchment)">${esc(titleize(p.classId))}</strong> · ${esc(bits.join(' · '))}</div>`;
    }).join('');
    const slots = (sc.slots || []).map((n, i) => n > 0 ? `<span style="background:var(--bg-raised);border-radius:var(--radius-sm);padding:0 var(--space-1)">${esc(t('spell.slotN', { lvl: i + 1 }))} ×${esc(String(n))}</span>` : '').filter(Boolean).join(' ');
    return `<div style="background:rgba(var(--accent-gold-rgb),.06);border:1px solid rgba(var(--gold-muted),.18);border-radius:var(--radius);padding:var(--space-2) var(--space-3);display:flex;flex-direction:column;gap:var(--space-1)">
      ${rows}
      ${slots ? `<div style="display:flex;flex-wrap:wrap;gap:var(--space-1);margin-top:var(--space-1);align-items:center"><span style="color:var(--text-muted);font-size:var(--text-xs)">${esc(t('spell.slots'))}:</span> ${slots}</div>` : ''}</div>`;
  }

  // Per-class cantrip + prepared SLOTS: drag a spell from the available pool into
  // a slot (or click it — pointer-free fallback); ✕ removes (SP-2/SP-7).
  function classSpellSection(c, s, p, comp, engine, editable, alwaysSet) {
    const cid = p.classId;
    const clsName = (engine.getItem('class', cid) || {}).name || titleize(cid);
    const pool = engine.listSpells ? (engine.listSpells({ class: cid }) || []) : [];
    const maxLvl = (comp.spellcasting.slots || []).length;
    const parts = [];

    if (num(p.cantripsKnown) > 0) {
      const chosen = (s.cantrips && s.cantrips[cid]) || [];
      const avail = pool.filter((sp) => num(sp.level) === 0 && !chosen.includes(sp.id));
      parts.push(spellSlotGroup(c, cid, 'cantrip', t('spell.cantripsN', { n: chosen.length, known: num(p.cantripsKnown) }), chosen, num(p.cantripsKnown), avail, engine, editable, null));
    }
    if (num(p.preparedLimit) > 0) {
      const chosen = (s.preparedSpells && s.preparedSpells[cid]) || [];
      const avail = pool.filter((sp) => num(sp.level) >= 1 && num(sp.level) <= Math.max(1, maxLvl) && !chosen.includes(sp.id) && !alwaysSet.has(sp.id));
      parts.push(spellSlotGroup(c, cid, 'prepared', t('spell.preparedN', { n: chosen.length, limit: num(p.preparedLimit) }), chosen, num(p.preparedLimit), avail, engine, editable, alwaysSet));
    }
    if (!parts.length) return '';
    return `<div style="background:var(--bg-surface);border:1px solid rgba(var(--gold-muted),.15);border-radius:var(--radius);padding:var(--space-2) var(--space-3);display:flex;flex-direction:column;gap:var(--space-3)">
      <div style="color:var(--text-parchment);font-weight:600;font-size:var(--text-sm)">${esc(clsName)}</div>${parts.join('')}</div>`;
  }

  // One slot group: a drop-zone of filled chips + empty slots, plus the
  // draggable available pool below it.
  function spellSlotGroup(c, cid, kind, label, chosen, limit, avail, engine, editable, alwaysSet) {
    const removeAct = kind === 'cantrip' ? 'unlearnCantrip' : 'unprepSpell';
    const slots = [];
    for (let i = 0; i < limit; i++) {
      const ref = chosen[i];
      if (ref) {
        const info = spellInfo(engine, ref);
        const dup = alwaysSet && alwaysSet.has(ref);
        slots.push(spellChip(info.name, lvlLabel(info.level), { danger: dup, title: dup ? t('spell.forcedDup') : '', removeAttr: editable ? dataAction(host.action(removeAct), c.id, cid, ref) : null }));
      } else if (editable) {
        slots.push(`<div style="border:1px dashed rgba(var(--gold-muted),.35);border-radius:var(--radius-sm);min-width:8.5rem;min-height:2.4rem;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:var(--text-xs)">${esc(t('spell.emptySlot'))}</div>`);
      }
    }
    const dropAttr = editable ? dataOn('drop', host.action('spellDrop'), c.id, cid, kind) : '';
    const zone = `<div ${dropAttr} style="display:flex;flex-wrap:wrap;gap:var(--space-1);min-height:2.4rem">${slots.join('') || `<span style="color:var(--text-muted);font-size:var(--text-xs)">${esc(t('misc.notSet'))}</span>`}</div>`;
    let poolHtml = '';
    if (editable && chosen.length < limit && avail.length) {
      poolHtml = `<div style="margin-top:var(--space-1)">
        <div style="color:var(--text-muted);font-size:var(--text-xs);margin-bottom:var(--space-1)">${esc(t('spell.available'))}</div>
        <div style="display:flex;flex-wrap:wrap;gap:var(--space-1)">${avail.map((sp) => spellPoolCard(c, cid, kind, sp)).join('')}</div></div>`;
    }
    return `<div>${subLabel(label)}${zone}${poolHtml}</div>`;
  }

  // A draggable + clickable available-spell card (drag into a slot, or click to add).
  function spellPoolCard(c, cid, kind, sp) {
    const addAct = kind === 'cantrip' ? 'learnCantrip' : 'prepSpell';
    return `<div draggable="true" title="${esc(t('spell.dragHint'))}"
      ${dataOn('dragstart', host.action('spellDragStart'), '$ev', sp.id)}
      ${dataAction(host.action(addAct), c.id, cid, sp.id)}
      style="cursor:grab;background:var(--bg-raised);border:1px solid rgba(var(--gold-muted),.2);border-radius:var(--radius-sm);padding:var(--space-1) var(--space-2);font-size:var(--text-sm);color:var(--text-light)">
      ${esc(sp.name)}${sp.level ? ` <span style="color:var(--text-muted);font-size:var(--text-xs)">${esc(String(sp.level))}</span>` : ''}</div>`;
  }

  // Always-prepared / granted spells, grouped visually by provenance (SP-2/SP-12).
  function grantedSection(granted) {
    const BADGE = { subclass: '✦', feat: '⚝', species: '◈', class: '🎓', item: '⚙' };
    const chips = granted.map((g) => {
      const src = (g.source && g.source.type) || '';
      const sub = [lvlLabel(g.level), g.free ? t('spell.free') : ''].filter(Boolean).join(' · ');
      return spellChip(g.name, sub, { locked: g.alwaysPrepared, badge: BADGE[src] || '•', badgeTitle: titleize((g.source && g.source.id) || src), title: t('spell.grantedBy', { src: titleize((g.source && g.source.id) || src) }) });
    }).join('');
    return `<div>${subLabel(t('spell.alwaysPreparedHdr'))}<div style="display:flex;flex-wrap:wrap;gap:var(--space-1)">${chips}</div></div>`;
  }

  // Choose-grants (SP-10/SP-20): a feat/lineage that grants "pick N spells matching
  // a filter" (Magic Initiate, Fey Touched's choose-1, High Elf's wizard cantrip).
  // Renders the picked chips + a filtered <select> to add more, capped at `choose`.
  // Picks persist in s.grantChoices[key]; the engine grants them. Pool filtered by
  // spell level (re-asserted here, not trusted to the engine) + class/school.
  function grantChoicesSection(c, s, pending, engine, editable) {
    const blocks = pending.map((pc) => {
      const picked = (s.grantChoices && s.grantChoices[pc.key]) || [];
      const chips = picked.map((ref) => {
        const info = spellInfo(engine, ref);
        return spellChip(info.name, lvlLabel(info.level), { removeAttr: editable ? dataAction(host.action('grantUnpick'), c.id, pc.key, ref) : null });
      }).join('');
      let adder = '';
      if (editable && picked.length < pc.choose) {
        const pool = (engine.listSpells ? (engine.listSpells({ level: pc.spellLevel }) || []) : []).filter((sp) => {
          if (num(sp.level) !== num(pc.spellLevel)) return false;   // re-assert the level filter ourselves
          if (picked.includes(sp.id)) return false;
          if (pc.from.class && pc.from.class.length) return (sp.classes || []).some((cl) => pc.from.class.includes(cl));
          if (pc.from.school && pc.from.school.length) return pc.from.school.map((x) => String(x).toLowerCase()).includes(String(sp.school || '').toLowerCase());
          return true;
        });
        adder = pool.length
          ? `<select class="edit-input" style="max-width:13rem"${dataOn('change', host.action('grantPick'), c.id, pc.key, '$value')}><option value="">${esc(t('builder.choose'))}</option>${pool.map((sp) => `<option value="${esc(sp.id)}">${esc(sp.name)}</option>`).join('')}</select>`
          : `<span style="color:var(--text-muted);font-size:var(--text-xs)">${esc(t('builder.contentPending'))}</span>`;
      }
      const fromLabel = (pc.from.class || pc.from.school || []).map(titleize).join('/');
      const what = (pc.spellLevel === 0 ? t('spellbook.cantrip') : t('spellbook.lvlN', { n: pc.spellLevel })) + (fromLabel ? ' · ' + fromLabel : '');
      const label = t('spell.chooseGrant', { src: titleize((pc.source && pc.source.id) || ''), n: pc.choose, what });
      return `<div>${subLabel(label)}<div style="display:flex;flex-wrap:wrap;gap:var(--space-1);align-items:center">${chips}${adder}</div></div>`;
    }).join('');
    return `<div style="background:var(--bg-surface);border:1px solid rgba(var(--gold-muted),.15);border-radius:var(--radius);padding:var(--space-2) var(--space-3);display:flex;flex-direction:column;gap:var(--space-3)">
      ${subLabel(t('spell.grantChoicesHdr'))}${blocks}</div>`;
  }

  // Extra (manual) + copied spells, separate from the granted set (SP-1/SP-15).
  function extraSection(c, s, editable, granted) {
    const gnames = new Set((granted || []).map((g) => String(g.name || '').toLowerCase()));
    const spells = (s.spells || []).slice().sort((a, b) => num(a.level) - num(b.level) || String(a.name || '').localeCompare(String(b.name || '')));
    if (!spells.length && !editable) return '';
    const cards = spells.map((sp) => spellCard(c, sp, editable, gnames.has(String(sp.name || '').toLowerCase()))).join('');
    const adders = editable
      ? `<div style="margin-top:var(--space-1);display:flex;gap:var(--space-1)">
           <button class="inline-create-btn"${dataAction(host.action('spellAdd'), c.id)}>＋ ${esc(t('spell.addExtra'))}</button>
           <button class="inline-create-btn"${dataAction(host.action('copySpell'), c.id)}>📖 ${esc(t('spell.copySpell'))}</button></div>`
      : '';
    return `<div>${subLabel(t('spell.extraSpells'))}<div style="display:flex;flex-wrap:wrap;gap:var(--space-2);align-items:flex-start">${cards}</div>${adders}</div>`;
  }

  function spellCard(c, sp, editable, dup) {
    const prepared = !!sp.prepared;
    const lvl = num(sp.level, 0);
    const lvlTxt = lvl === 0 ? t('spellbook.cantrip') : t('spellbook.lvlN', { n: lvl });
    const originBadge = sp.origin === 'copied' ? `<span title="${esc(t('spell.copied'))}">📖</span> ` : '';
    const dupBd = dup ? 'var(--color-danger)' : 'transparent';
    const star = `<span title="${esc(t('spellbook.prepared'))}" style="color:${prepared ? 'var(--accent-gold)' : 'var(--text-muted)'}">${prepared ? '★' : '☆'}</span>`;
    if (!editable) {
      return `<div title="${dup ? esc(t('spell.forcedDup')) : ''}" style="background:var(--bg-raised);border:1px solid ${dupBd};border-radius:var(--radius);padding:var(--space-2) var(--space-3);min-width:9rem">
        <div style="display:flex;align-items:center;gap:var(--space-2)">${star}<strong style="color:${dup ? 'var(--color-danger)' : 'var(--text-parchment)'}">${originBadge}${esc(sp.name || t('misc.unnamed'))}</strong></div>
        <div style="color:var(--text-muted);font-size:var(--text-xs);margin-top:var(--space-1)">${esc(lvlTxt)}${sp.school ? ' · ' + esc(sp.school) : ''}</div>
      </div>`;
    }
    return `<div title="${dup ? esc(t('spell.forcedDup')) : ''}" style="background:var(--bg-raised);border:1px solid ${dupBd};border-radius:var(--radius);padding:var(--space-2);min-width:11rem;display:flex;flex-direction:column;gap:var(--space-1)">
      <div style="display:flex;align-items:center;gap:var(--space-2)">
        <button title="${esc(t('spellbook.prepToggle'))}" style="background:none;border:none;cursor:pointer;font-size:var(--text-base)"${dataAction(host.action('spellSet'), c.id, sp.id, 'prepared', prepared ? '0' : '1')}>${prepared ? '★' : '☆'}</button>
        ${originBadge}
        <input class="edit-input" style="flex:1" value="${esc(sp.name || '')}" placeholder="${esc(t('spellbook.name'))}"${dataOn('change', host.action('spellSet'), c.id, sp.id, 'name', '$value')}>
        <button class="inline-create-btn" title="${esc(t('action.remove'))}"${dataAction(host.action('spellDel'), c.id, sp.id)}>✕</button>
      </div>
      <div style="display:flex;gap:var(--space-1);align-items:center">
        <input class="edit-input" type="number" min="0" max="9" style="width:3.5rem" value="${esc(String(lvl))}" title="${esc(t('spellbook.level'))}"${dataOn('change', host.action('spellSet'), c.id, sp.id, 'level', '$value')}>
        <input class="edit-input" style="flex:1" value="${esc(sp.school || '')}" placeholder="${esc(t('spellbook.school'))}"${dataOn('change', host.action('spellSet'), c.id, sp.id, 'school', '$value')}>
      </div>
    </div>`;
  }

  return { panelSpellbook };
}
