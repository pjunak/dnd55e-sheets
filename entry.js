// ═══════════════════════════════════════════════════════════════
//  dnd55e-sheets — a fully hand-fillable D&D 5.5e (2024) character sheet.
//
//  Rides on the host's CORE `characters` entity (the sheet is NOT an addon
//  collection): all data lives in `character.addonData['dnd55e-sheets']`,
//  written via host.store.patchAddonData.
//
//  The sheet has a persistent HEADER (identity + the vital stat strip: HP ± / AC /
//  Init / Speed / Proficiency / Passive — always visible, on every tab) above a
//  TABBED body, inside the one article section the host gives us:
//    • Overview   — ability scores, saving throws, skills, notes (the stat block).
//    • Combat     — attacks from equipped/ready weapons + defenses (id 'sheet').
//    • Spellbook  — prepared/cantrip slots, granted/choose-grant, extras (UI-4).
//    • Backpack   — inventory grouped by carry location + currency.
//    • Builder    — guided progression; engine mode + MODIFICATION MODE only.
//
//  ── Modification mode (the play ↔ edit toggle) ──
//  A per-character flag (localStorage 'dse-mode:<cid>'); view is the default. View
//  is a clean, read-only sheet — the one live-play exception is HP ±. Edit reveals
//  the building affordances: the Builder tab (engine) or hand-editable tiles/rows
//  (standalone), the vitals' ✎/↺ overrides, and the spell/inventory editors.
//  Anonymous users never enter edit mode. See docs/RULES_EDGE_CASES.md (UI-7).
//
//  ── Module layout (decomposed; native ES modules, no build step) ──
//    helpers.js          pure constants + helpers (num/abilityMod/signed/uid/
//                        titleize/clampHp/blank/sheetOf).
//    engine.js           decision/derivation pipeline + viewModel + mutators.
//    ui.js               shared render primitives (section/heroTile/abilityTile/…).
//    panel.header.js     the persistent identity + vital-stat header + mode toggle.
//    panel.overview.js   ┐
//    panel.sheet.js      │  one render module per tab.
//    panel.spellbook.js  │
//    panel.backpack.js   │
//    panel.builder.js    ┘
//    editor.js           registerEditorFields form + collect.
//  This file is the thin orchestrator: it builds a shared `ctx`, wires the
//  modules into it, and registers the article section / actions / settings tab.
//
//  Style/safety contract: HTML only via host.h (esc/dataAction/dataOn), never
//  inline onclick; colours/spacing only via design tokens var(--…); every
//  display string flows through i18n.t() so locales layer on with no rewrite.
// ═══════════════════════════════════════════════════════════════

import { t } from './i18n.js';
import {
  ABILITIES, COINS, LOCATIONS, SKILLS,
  num, abilityMod, signed, titleize, clampHp, blank, makeHelpers,
} from './helpers.js';
import { makeEngine } from './engine.js';
import { makeUI } from './ui.js';
import { makeHeaderPanel } from './panel.header.js';
import { makeOverviewPanel } from './panel.overview.js';
import { makeSheetPanel } from './panel.sheet.js';
import { makeSpellbookPanel } from './panel.spellbook.js';
import { makeBackpackPanel } from './panel.backpack.js';
import { makeBuilderPanel } from './panel.builder.js';
import { registerEditor } from './editor.js';

export default function register(host) {
  const { esc } = host.h;
  const NS = host.id; // 'dnd55e-sheets'
  const { uid, sheetOf } = makeHelpers(host);

  // ── Shared context handed to every module. Built progressively: pure pieces
  //    first, then the engine pipeline, then the UI primitives, then panels. ──
  const ctx = {
    host, t, NS,
    ABILITIES, COINS, LOCATIONS, SKILLS,
    num, abilityMod, signed, titleize, clampHp, blank, uid, sheetOf,
  };
  ctx.engine = makeEngine(ctx);
  ctx.viewModel = ctx.engine.viewModel;     // hot path — promote for panel destructuring
  ctx.ui = makeUI(ctx);
  ctx.panels = {
    ...makeHeaderPanel(ctx),
    ...makeOverviewPanel(ctx),
    ...makeSheetPanel(ctx),
    ...makeSpellbookPanel(ctx),
    ...makeBackpackPanel(ctx),
    ...makeBuilderPanel(ctx),
  };

  const { getRules, safeHydrate, decisionsOf, mutate } = ctx.engine;
  const { panelHeader, panelOverview, panelSheet, panelSpellbook, panelBackpack, panelBuilder } = ctx.panels;

  // ── Modification mode ────────────────────────────────────────────
  //  A per-character "are we modifying or playing" flag (localStorage). View is
  //  the default: a clean, read-only sheet (HP ± is the one live-play exception).
  //  Edit exposes the building affordances — and ONLY in edit mode does the
  //  Builder tab appear (engine) or the tabs become hand-editable (standalone).
  //  Anonymous users can never enter edit mode.
  const modeKey = (cid) => 'dse-mode:' + cid;
  const inEditMode = (cid, editable) => {
    if (!editable) return false;
    try { return localStorage.getItem(modeKey(cid)) === 'edit'; } catch (_) { return false; }
  };

  // ── Tab model ────────────────────────────────────────────────────
  //  Content tabs are always present; the Spellbook only when the character has
  //  spells (UI-4); the Builder only in engine mode AND modification mode.
  const visibleTabs = (engine, hasSpells, edit) => {
    const tabs = [
      { id: 'overview',  icon: '🪪', label: t('tab.overview'),  hint: t('tab.overviewHint') },
      { id: 'sheet',     icon: '⚔️', label: t('tab.sheet'),     hint: t('tab.sheetHint') },
    ];
    if (hasSpells) tabs.push({ id: 'spellbook', icon: '📖', label: t('tab.spellbook'), hint: t('tab.spellbookHint') });
    tabs.push({ id: 'backpack', icon: '🎒', label: t('tab.backpack'), hint: t('tab.backpackHint') });
    if (engine && edit) tabs.push({ id: 'builder', icon: '🛠️', label: t('tab.builder'), hint: t('tab.builderHint'), tool: true });
    return tabs;
  };
  const tabKey = (id) => 'dse-tab:' + id;
  const currentTab = (cid, tabs) => {
    let stored = null;
    try { stored = localStorage.getItem(tabKey(cid)); } catch (_) {}
    return tabs.some((tb) => tb.id === stored) ? stored : tabs[0].id;
  };
  const panelId = (cid) => 'dse-panel-' + cid;
  const tabBtnId = (cid, tabId) => 'dse-tab-' + cid + '-' + tabId;

  // ════════════════════════════════════════════════════════════════
  //  Article section — the tabbed sheet on a character page
  // ════════════════════════════════════════════════════════════════
  host.registerArticleSection('characters', (c) => {
    if (!c) return null;
    const s = sheetOf(c);
    const editable = !host.role.isAnonymous();
    const edit = inEditMode(c.id, editable);
    const engine = getRules();
    // Hydrate first (we need the computed sheet to decide tab visibility).
    const result = engine ? safeHydrate(engine, decisionsOf(s, engine)) : null;
    const comp = result && result.sheet;
    const warnings = (result && result.warnings) || [];
    const hasSpells = !engine
      || !!(comp && comp.spellcasting && ((comp.spellcasting.perClass || []).length || (comp.spellcasting.granted || []).length))
      || (Array.isArray(s.spells) && s.spells.length > 0);
    const tabs = visibleTabs(engine, hasSpells, edit);
    const active = currentTab(c.id, tabs);
    const pid = panelId(c.id);

    // ── Tab bar — full ARIA tablist: each tab links role=tab + aria-selected +
    //    aria-controls to the panel, Left/Right arrows move between tabs. The
    //    Builder (a build tool, not content) is pushed to the right with a tint.
    const tabBtn = (tb) => {
      const on = tb.id === active;
      const tint = tb.tool
        ? (on ? 'background:rgba(var(--accent-gold-rgb),.16);color:var(--accent-gold)' : 'background:rgba(var(--accent-gold-rgb),.05);color:var(--text-light)')
        : (on ? 'background:rgba(var(--accent-gold-rgb),.12);color:var(--text-parchment)' : 'background:transparent;color:var(--text-muted)');
      return `<button role="tab" id="${esc(tabBtnId(c.id, tb.id))}" aria-selected="${on}" aria-controls="${esc(pid)}" tabindex="${on ? '0' : '-1'}"
        title="${esc(tb.hint || tb.label)}"
        style="${tint};border:none;border-bottom:3px solid ${on ? 'var(--accent-gold)' : 'transparent'};${tb.tool ? 'margin-left:auto;' : ''}padding:var(--space-2) var(--space-3);font-size:var(--text-sm);font-weight:${on ? '600' : '500'};cursor:pointer;border-radius:var(--radius) var(--radius) 0 0;display:inline-flex;align-items:center;gap:var(--space-1);white-space:nowrap"
        ${host.h.dataAction(host.action('tab'), c.id, tb.id)}
        ${host.h.dataOn('keydown', host.action('tabKey'), '$ev', c.id, tb.id)}><span aria-hidden="true">${esc(tb.icon)}</span> ${esc(tb.label)}</button>`;
    };
    const tabBar = `<div role="tablist" aria-label="${esc(t('sheet.title'))}" style="display:flex;flex-wrap:wrap;gap:var(--space-1);border-bottom:1px solid var(--border-subtle);margin-bottom:var(--space-4)">${tabs.map(tabBtn).join('')}</div>`;

    let panel = '';
    if (active === 'overview') panel = panelOverview(c, s, edit, comp, engine);
    else if (active === 'sheet') panel = panelSheet(c, s, edit, comp, engine);
    else if (active === 'spellbook') panel = panelSpellbook(c, s, edit, comp, engine);
    else if (active === 'backpack') panel = panelBackpack(c, s, edit, comp, engine);
    else if (active === 'builder') panel = panelBuilder(c, s, edit, comp, warnings, engine);

    return {
      title: '🎲 ' + t('sheet.title'),
      html: `<div class="addon-dnd55e-sheets" style="display:flex;flex-direction:column;gap:var(--space-4)">
        ${panelHeader(c, s, comp, editable, edit, engine, warnings)}
        <div>${tabBar}
          <div role="tabpanel" id="${esc(pid)}" aria-labelledby="${esc(tabBtnId(c.id, active))}" tabindex="0">${panel}</div></div></div>`,
    };
  });

  // Register the standalone editor-overlay form (+ collect).
  registerEditor(ctx);

  // ════════════════════════════════════════════════════════════════
  //  Actions
  // ════════════════════════════════════════════════════════════════
  host.registerAction('tab', (cid, tabId) => {
    try { localStorage.setItem(tabKey(cid), String(tabId)); } catch (_) {}
    host.ui.rerender();
  });

  // Roving-tabindex keyboard nav across the tablist (Left/Right/Home/End).
  host.registerAction('tabKey', (ev, cid, tabId) => {
    const key = ev && ev.key;
    if (key !== 'ArrowLeft' && key !== 'ArrowRight' && key !== 'Home' && key !== 'End') return;
    if (ev.preventDefault) ev.preventDefault();
    const engine = getRules();
    const s = sheetOf(host.store.getCharacters().find((x) => x && x.id === cid) || {});
    const result = engine ? safeHydrate(engine, decisionsOf(s, engine)) : null;
    const comp = result && result.sheet;
    const hasSpells = !engine
      || !!(comp && comp.spellcasting && ((comp.spellcasting.perClass || []).length || (comp.spellcasting.granted || []).length))
      || (Array.isArray(s.spells) && s.spells.length > 0);
    const editable = !host.role.isAnonymous();
    const tabs = visibleTabs(engine, hasSpells, inEditMode(cid, editable));
    const ids = tabs.map((tb) => tb.id);
    const cur = ids.indexOf(tabId);
    if (cur < 0) return;
    let next = cur;
    if (key === 'ArrowLeft') next = (cur - 1 + ids.length) % ids.length;
    else if (key === 'ArrowRight') next = (cur + 1) % ids.length;
    else if (key === 'Home') next = 0;
    else if (key === 'End') next = ids.length - 1;
    try { localStorage.setItem(tabKey(cid), String(ids[next])); } catch (_) {}
    host.ui.rerender();
    // Move focus to the newly-active tab after the re-render paints.
    try {
      const focusId = tabBtnId(cid, ids[next]);
      setTimeout(() => { const el = document.getElementById(focusId); if (el) el.focus(); }, 0);
    } catch (_) {}
  });

  // ── Modification mode toggle (per character, localStorage). Anonymous users
  //    can't enter it. Removing the key (not writing 'view') keeps storage clean. ──
  host.registerAction('setMode', (cid, mode) => {
    if (host.role.isAnonymous()) return;
    try {
      if (String(mode) === 'edit') localStorage.setItem(modeKey(cid), 'edit');
      else localStorage.removeItem(modeKey(cid));
    } catch (_) {}
    host.ui.rerender();
  });

  // ── Standalone inline edit (modification mode, no engine). These write the flat
  //    decision fields the standalone viewModel reads. In engine mode the same
  //    fields are computed, so these controls aren't rendered (the Builder owns
  //    them) — the actions stay guarded/harmless regardless. ──
  const STR_FIELDS = { player: 1, className: 1, subclass: 1, race: 1, background: 1, alignment: 1, notes: 1 };
  const NUM_FIELDS = { level: 1, maxHp: 1, hp: 1, tempHp: 1, ac: 1, initiative: 1, speed: 1, profBonus: 1 };
  const SKILL_IDS = new Set(SKILLS.map((sk) => sk.id));
  host.registerAction('setField', (cid, field, value) => {
    if (!STR_FIELDS[field] && !NUM_FIELDS[field]) return;
    mutate(cid, (s) => {
      if (STR_FIELDS[field]) { s[field] = String(value == null ? '' : value); return s; }
      let n = num(value, 0);
      if (field === 'level') n = Math.max(1, n);
      else if (field === 'maxHp' || field === 'tempHp' || field === 'speed') n = Math.max(0, n);
      s[field] = n;
      if (field === 'maxHp') s.hp = clampHp(num(s.hp, 0), n);
      else if (field === 'hp') s.hp = clampHp(n, num(s.maxHp, 0));
      return s;
    });
  });
  host.registerAction('setAbility', (cid, ability, value) => {
    if (ABILITIES.indexOf(ability) < 0) return;
    mutate(cid, (s) => { s.abilities = { ...s.abilities, [ability]: Math.max(1, Math.min(30, num(value, 10))) }; return s; });
  });
  host.registerAction('toggleSave', (cid, ability) => {
    if (ABILITIES.indexOf(ability) < 0) return;
    mutate(cid, (s) => { s.saveProf = { ...s.saveProf, [ability]: !s.saveProf[ability] }; return s; });
  });
  host.registerAction('toggleSkill', (cid, skillId) => {
    if (!SKILL_IDS.has(skillId)) return;
    mutate(cid, (s) => { s.skillProf = { ...s.skillProf, [skillId]: !s.skillProf[skillId] }; return s; });
  });

  // HP +/- → one clamp rule (clampHp): with a max>0 clamp into [0,max], else floor at 0.
  host.registerAction('hp', (id, delta) => {
    mutate(id, (s) => {
      const maxHp = num(s.maxHp, 0);
      s.hp = clampHp(num(s.hp, maxHp) + Number(delta), maxHp);
      return s;
    });
  });

  // ── Manual overrides (engine mode, ARCH-3) — a typed value beats the computed
  //    one; ↺ clears back to auto. Written via plain `mutate` so we don't
  //    re-materialize; viewModel.pick() always prefers overrides[field]. ──
  const OVERRIDE_FIELDS = { maxHp: 1, ac: 1, initiative: 1, speed: 1 };
  host.registerAction('setOverrideValue', (cid, field, raw) => {
    if (!OVERRIDE_FIELDS[field]) return;
    const txt = String(raw == null ? '' : raw).trim();
    mutate(cid, (s) => {
      const ov = { ...(s.overrides || {}) };
      if (txt === '') delete ov[field];      // blank ⇒ back to auto
      else ov[field] = num(txt, 0);
      s.overrides = ov;
      return s;
    });
  });
  host.registerAction('clearOverride', (cid, field) => {
    if (!OVERRIDE_FIELDS[field]) return;
    mutate(cid, (s) => { const ov = { ...(s.overrides || {}) }; delete ov[field]; s.overrides = ov; return s; });
  });

  // Spellbook — manual/extra entries (s.spells).
  host.registerAction('spellAdd', (cid) => {
    mutate(cid, (s) => { s.spells = s.spells.concat([{ id: uid('spell'), name: '', level: 0, school: '', prepared: false, origin: 'manual' }]); return s; });
  });
  host.registerAction('copySpell', (cid) => {
    mutate(cid, (s) => { s.spells = s.spells.concat([{ id: uid('spell'), name: '', level: 1, school: '', prepared: false, origin: 'copied' }]); return s; });
  });
  host.registerAction('spellDel', (cid, sid) => {
    mutate(cid, (s) => { s.spells = s.spells.filter((sp) => sp.id !== sid); return s; });
  });
  // Engine-mode preparation (per class): cantrips + prepared picks.
  const addRef = (s, bag, classId, ref) => { const cur = (s[bag][classId] || []).slice(); if (ref && !cur.includes(ref)) cur.push(ref); s[bag] = { ...s[bag], [classId]: cur }; };
  const delRef = (s, bag, classId, ref) => { s[bag] = { ...s[bag], [classId]: (s[bag][classId] || []).filter((r) => r !== ref) }; };
  host.registerAction('learnCantrip', (cid, classId, ref) => { mutate(cid, (s) => { addRef(s, 'cantrips', classId, ref); return s; }); });
  host.registerAction('unlearnCantrip', (cid, classId, ref) => { mutate(cid, (s) => { delRef(s, 'cantrips', classId, ref); return s; }); });
  host.registerAction('prepSpell', (cid, classId, ref) => { mutate(cid, (s) => { addRef(s, 'preparedSpells', classId, ref); return s; }); });
  host.registerAction('unprepSpell', (cid, classId, ref) => { mutate(cid, (s) => { delRef(s, 'preparedSpells', classId, ref); return s; }); });
  // Drag-and-drop prep via the host drag seam: dragstart stashes the ref + primes
  // dataTransfer (Firefox needs it to start the drag); drop consumes it.
  let _dragRef = null;
  host.registerAction('spellDragStart', (ev, ref) => {
    _dragRef = ref != null ? String(ref) : null;
    try { if (ev && ev.dataTransfer) { ev.dataTransfer.effectAllowed = 'copy'; ev.dataTransfer.setData('text/plain', _dragRef || ''); } } catch (_) {}
  });
  host.registerAction('spellDrop', (cid, classId, kind) => {
    const ref = _dragRef; _dragRef = null;
    if (!ref) return;
    mutate(cid, (s) => { addRef(s, kind === 'cantrip' ? 'cantrips' : 'preparedSpells', classId, ref); return s; });
  });
  // Choose-grant picks (Magic Initiate / Fey Touched's choose-1 / lineage cantrip).
  // Keyed by the engine's grant key (`<src>:<id>:<grantId>`); the engine caps to
  // the choose count on read, so an extra pick is harmless.
  host.registerAction('grantPick', (cid, key, ref) => {
    if (!ref) return;
    mutate(cid, (s) => { const cur = (s.grantChoices[key] || []).slice(); if (!cur.includes(ref)) cur.push(ref); s.grantChoices = { ...s.grantChoices, [key]: cur }; return s; });
  });
  host.registerAction('grantUnpick', (cid, key, ref) => {
    mutate(cid, (s) => { s.grantChoices = { ...s.grantChoices, [key]: (s.grantChoices[key] || []).filter((r) => r !== ref) }; return s; });
  });
  host.registerAction('spellSet', (cid, sid, field, value) => {
    mutate(cid, (s) => {
      s.spells = s.spells.map((sp) => {
        if (sp.id !== sid) return sp;
        if (field === 'level') return { ...sp, level: Math.max(0, Math.min(9, num(value, 0))) };
        if (field === 'prepared') return { ...sp, prepared: value === '1' || value === true };
        return { ...sp, [field]: String(value) };
      });
      return s;
    });
  });

  // Backpack.
  host.registerAction('invAdd', (cid) => {
    mutate(cid, (s) => { s.inventory = s.inventory.concat([{ id: uid('item'), name: '', qty: 1, location: 'pack' }]); return s; });
  });
  host.registerAction('invDel', (cid, iid) => {
    mutate(cid, (s) => { s.inventory = s.inventory.filter((it) => it.id !== iid); return s; });
  });
  host.registerAction('invSet', (cid, iid, field, value) => {
    mutate(cid, (s) => {
      s.inventory = s.inventory.map((it) => {
        if (it.id !== iid) return it;
        if (field === 'qty') return { ...it, qty: Math.max(1, num(value, 1)) };
        return { ...it, [field]: String(value) };
      });
      return s;
    });
  });
  host.registerAction('invCycle', (cid, iid) => {
    mutate(cid, (s) => {
      s.inventory = s.inventory.map((it) => {
        if (it.id !== iid) return it;
        const i = LOCATIONS.indexOf(it.location || 'pack');
        return { ...it, location: LOCATIONS[(i + 1) % LOCATIONS.length] };
      });
      return s;
    });
  });
  host.registerAction('currencySet', (cid, coin, value) => {
    mutate(cid, (s) => { s.currency = { ...s.currency, [coin]: Math.max(0, num(value, 0)) }; return s; });
  });
  // Add a compendium-backed item (carries a `ref` so the engine resolves it for
  // AC / attacks); armor defaults to equipped, weapons to ready.
  host.registerAction('invAddRef', (cid, kind, ref) => {
    if (!ref) return;
    const engine = getRules();
    const rec = engine && engine.getItem ? engine.getItem(kind, ref) : null;
    const location = kind === 'armor' ? 'equipped' : 'ready';
    mutate(cid, (s) => { s.inventory = s.inventory.concat([{ id: uid('item'), ref: String(ref), name: rec ? rec.name : String(ref), qty: 1, location, attuned: false }]); return s; });
  });
  host.registerAction('invAttune', (cid, iid) => {
    mutate(cid, (s) => { s.inventory = s.inventory.map((it) => (it.id === iid ? { ...it, attuned: !it.attuned } : it)); return s; });
  });

  // ── Resource trackers (Rage / Ki / slots / hit dice…). Manual, work in both
  //    modes: ± is a live-play action (view), add/rename/set-max is modification.
  //    Clamp current into [0, max] when max>0, else just floor at 0. ──
  const clampRes = (cur, max) => (num(max, 0) > 0 ? Math.max(0, Math.min(num(max, 0), num(cur, 0))) : Math.max(0, num(cur, 0)));
  host.registerAction('resourceAdd', (cid) => {
    mutate(cid, (s) => { s.resources = s.resources.concat([{ id: uid('res'), name: '', current: 0, max: 0 }]); return s; });
  });
  host.registerAction('resourceDel', (cid, rid) => {
    mutate(cid, (s) => { s.resources = s.resources.filter((r) => r.id !== rid); return s; });
  });
  host.registerAction('resourceAdjust', (cid, rid, delta) => {
    mutate(cid, (s) => { s.resources = s.resources.map((r) => (r.id === rid ? { ...r, current: clampRes(num(r.current, 0) + Number(delta), r.max) } : r)); return s; });
  });
  host.registerAction('resourceSet', (cid, rid, field, value) => {
    mutate(cid, (s) => {
      s.resources = s.resources.map((r) => {
        if (r.id !== rid) return r;
        if (field === 'name') return { ...r, name: String(value) };
        if (field === 'max') { const max = Math.max(0, num(value, 0)); return { ...r, max, current: clampRes(r.current, max) }; }
        if (field === 'current') return { ...r, current: clampRes(value, r.max) };
        return r;
      });
      return s;
    });
  });

  // ── Builder (engine mode) — edit the rich decision model + materialize ────
  const { builderMutate } = ctx.engine;
  const parseAssign = (str) => { const a = {}; String(str || '').split(',').forEach((p) => { const [k, v] = p.split(':'); if (k && v) a[k.trim()] = num(v); }); return a; };
  const removeGrant = (s, id) => { s.abilityGrants = (s.abilityGrants || []).filter((g) => g.id !== id); };
  const upsertGrant = (s, id, source, assign) => { removeGrant(s, id); if (assign && Object.keys(assign).length) s.abilityGrants = (s.abilityGrants || []).concat([{ id, source, assign }]); };

  host.registerAction('builderField', (cid, field, value) => {
    builderMutate(cid, (s) => {
      s[field] = String(value);
      if (field === 'race') s.lineage = '';
      if (field === 'background') { delete s.featureChoices['bgasi']; removeGrant(s, 'bgasi'); }   // re-pick ASI for the new background
    });
  });
  host.registerAction('builderAbility', (cid, ability, value) => {
    builderMutate(cid, (s) => { s.baseStats = { ...(s.baseStats || {}), [ability]: Math.max(1, Math.min(30, num(value, 10))) }; });
  });
  host.registerAction('builderClassSet', (cid, idx, classId) => {
    builderMutate(cid, (s) => { if (s.classes[idx]) { s.classes[idx] = { ...s.classes[idx], classId: String(classId), subclass: '' }; } });
  });
  host.registerAction('builderLevelSet', (cid, idx, value) => {
    builderMutate(cid, (s) => { if (s.classes[idx]) s.classes[idx] = { ...s.classes[idx], level: Math.max(1, Math.min(20, num(value, 1))) }; });
  });
  host.registerAction('builderSubclassSet', (cid, idx, subclass) => {
    builderMutate(cid, (s) => { if (s.classes[idx]) s.classes[idx] = { ...s.classes[idx], subclass: String(subclass) }; });
  });
  host.registerAction('builderAddClass', (cid) => {
    builderMutate(cid, (s) => { s.classes = s.classes.concat([{ classId: '', level: 1, subclass: '' }]); });
  });
  host.registerAction('builderRemoveClass', (cid, idx) => {
    builderMutate(cid, (s) => { if (s.classes.length > 1) s.classes = s.classes.filter((_, i) => i !== idx); });
  });
  host.registerAction('builderBgAsi', (cid, value) => {
    builderMutate(cid, (s) => {
      if (!value) { delete s.featureChoices['bgasi']; removeGrant(s, 'bgasi'); return; }
      s.featureChoices['bgasi'] = String(value);
      upsertGrant(s, 'bgasi', { type: 'background' }, parseAssign(value));
    });
  });
  // Generic choice resolution (enumerated / expertise / mastery / ASI mode +
  // ASI ability / feat). Ability-affecting keys maintain an abilityGrant.
  host.registerAction('builderChoose', (cid, key, value) => {
    builderMutate(cid, (s, engine) => {
      const k = String(key);
      if (value === '' || value == null) delete s.featureChoices[k];
      else s.featureChoices[k] = String(value);
      if (/:featability$/.test(k)) {
        // a half-feat's chosen ability (+1) — AB-2. (Checked before :ability so the
        // longer suffix wins.)
        upsertGrant(s, k, { type: 'feat' }, value ? { [String(value)]: 1 } : null);
      } else if (/:ability$/.test(k)) {
        // an ASI "+2 to one ability" pick
        upsertGrant(s, k, { type: 'asi' }, value ? { [String(value)]: 2 } : null);
      } else if (/:feat$/.test(k)) {
        // a feat chosen at an ASI level → wire its half-feat ability bump: a
        // single-option bump applies directly; a choice waits for the sub-pick.
        const abilKey = k.replace(/:feat$/, '') + ':featability';
        removeGrant(s, abilKey); delete s.featureChoices[abilKey];
        const feat = value && engine ? engine.getItem('feat', String(value)) : null;
        const asi = feat && feat.grants && feat.grants.abilityScoreIncrease;
        if (asi && Array.isArray(asi.from) && asi.from.length === 1) {
          upsertGrant(s, abilKey, { type: 'feat' }, { [asi.from[0]]: num(asi.amount, 1) });
        }
      } else if (/^asi:[^:]+:\d+$/.test(k)) {
        // the ASI mode switched → clear the dependent grant/choice for the other branch
        if (value !== 'asi') { removeGrant(s, k + ':ability'); delete s.featureChoices[k + ':ability']; }
        if (value !== 'feat') { delete s.featureChoices[k + ':feat']; delete s.featureChoices[k + ':featability']; removeGrant(s, k + ':featability'); }
      }
    });
  });

  // ── Info tab (Settings → 🎲 Character Sheets) ─────────────────────
  host.registerSettingsTab({
    id: 'info', label: t('settings.label'), icon: '🎲',
    render: () => `
      <div class="settings-editor-head"><h2>🎲 ${esc(t('help.title'))}</h2></div>
      <div class="settings-panel">
        <p class="settings-hint">${esc(t('help.body', { count: host.store.getCharacters().length }))}</p>
      </div>`,
  });
}
