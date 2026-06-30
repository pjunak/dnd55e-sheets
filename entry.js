// ═══════════════════════════════════════════════════════════════
//  dnd55e-sheets — a fully hand-fillable D&D 5.5e (2024) character sheet.
//
//  Rides on the host's CORE `characters` entity (the sheet is NOT an addon
//  collection): all data lives in `character.addonData['dnd55e-sheets']`,
//  written via host.store.patchAddonData.
//
//  The sheet is presented as TABS inside the one article section the host
//  gives us:
//    • Overview   — identity, ability scores, an at-a-glance combat strip, notes.
//    • Sheet      — combat block (HP +/-), saving throws, skills, passives.
//    • Spellbook  — editable spell cards (prepared toggle). Provenance + drag-
//                   drop preparation land in a later increment.
//    • Backpack   — editable inventory grouped by carry location + currency.
//    • Builder    — appears ONLY when the core-rules + compendium addons are
//                   present (guided progression). Hidden in standalone, where
//                   every tab is hand-editable instead. See docs/RULES_EDGE_CASES.md.
//
//  Standalone & rules-free: every value is entered by hand. The only arithmetic
//  is the UNIVERSAL D&D math that holds regardless of content — ability
//  modifiers ⌊(score-10)/2⌋ and proficiency totals. Content-driven derivation
//  (class/species/armor → stats) arrives later via the soft-used core-rules
//  addon; this file is built field-first so it never depends on it.
//
//  Style/safety contract: HTML only via host.h (esc/dataAction/dataOn), never
//  inline onclick; colours/spacing only via design tokens var(--…); every
//  display string flows through i18n.t() so locales layer on with no rewrite.
// ═══════════════════════════════════════════════════════════════

import { t } from './i18n.js';

export default function register(host) {
  const { esc, dataAction, dataOn, renderMarkdown } = host.h;
  const NS = host.id; // 'dnd55e-sheets'

  // ── Domain constants ─────────────────────────────────────────────
  const ABILITIES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
  const COINS = ['pp', 'gp', 'ep', 'sp', 'cp'];
  const LOCATIONS = ['equipped', 'ready', 'pack']; // carry state (EQ-1)
  // Each skill maps to its governing ability (D&D 2024).
  const SKILLS = [
    { id: 'acrobatics', ability: 'DEX' }, { id: 'animalHandling', ability: 'WIS' },
    { id: 'arcana', ability: 'INT' },     { id: 'athletics', ability: 'STR' },
    { id: 'deception', ability: 'CHA' },  { id: 'history', ability: 'INT' },
    { id: 'insight', ability: 'WIS' },    { id: 'intimidation', ability: 'CHA' },
    { id: 'investigation', ability: 'INT' }, { id: 'medicine', ability: 'WIS' },
    { id: 'nature', ability: 'INT' },     { id: 'perception', ability: 'WIS' },
    { id: 'performance', ability: 'CHA' }, { id: 'persuasion', ability: 'CHA' },
    { id: 'religion', ability: 'INT' },   { id: 'sleightOfHand', ability: 'DEX' },
    { id: 'stealth', ability: 'DEX' },    { id: 'survival', ability: 'WIS' },
  ];

  // ── Pure helpers ─────────────────────────────────────────────────
  const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
  const abilityMod = (score) => Math.floor((num(score, 10) - 10) / 2);
  const signed = (n) => (n >= 0 ? '+' + n : String(n));
  const uid = (seed) => { try { return host.store.generateId(seed || 'row'); } catch (_) { return String(seed || 'row') + '_' + Math.random().toString(36).slice(2, 8); } };

  /** A blank sheet — the v2 shape stored under addonData[NS]. Only player
   *  decisions are stored; in standalone (no engine) the entered numbers ARE
   *  the decisions. The future engine layers computed values + overrides over
   *  this without reshaping it. New collections (spells/inventory/currency) are
   *  ADDED over the v1 shape — v1 blobs migrate forward losslessly (just gain
   *  the empty arrays). Multiclass `classes[]` arrives with the Builder. */
  const blank = () => ({
    v: 2,
    ruleset: '2024',
    player: '', className: '', subclass: '', race: '', background: '', alignment: '',
    level: 1,
    abilities: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
    maxHp: 0, hp: 0, tempHp: 0, ac: 10, initiative: 0, speed: 30, profBonus: 2,
    saveProf: {}, skillProf: {},
    spells: [],      // manual/extra + copied spell entries [{id,name,level,school,origin}] (SP-1/SP-15)
    preparedSpells: {}, // engine mode: { <classId>: [spellRef,…] } prepared picks (SP-2)
    cantrips: {},       // engine mode: { <classId>: [spellRef,…] } cantrip picks (SP-7)
    inventory: [],   // [{id, name, qty, location, notes}]
    currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
    overrides: {},   // engine-mode manual overrides (ARCH-3)
    // ── Builder decision model (engine mode). The flat fields above are kept as
    //    the DEG-1 fallback: each Builder edit materializes the computed sheet
    //    INTO them, so removing the engine degrades to a hand-filled sheet. ──
    baseStats: null,        // {STR..CHA} base scores before ASIs; null → migrate from `abilities`
    classes: [],            // ordered [{classId, level, subclass}] (MC-1)
    lineage: '',            // species sub-choice id (SB-3)
    abilityGrants: [],      // [{id, source, assign:{STR:+2,…}}] background ASI / half-feats (AB-1)
    featureChoices: {},     // { <choiceId>: <value> } generic choice resolutions (ARCH-9/FE-1)
    feats: [],              // [{featId, source}] chosen feats
    notes: '',
  });

  /** Read this addon's namespace off a character, merged over defaults so every
   *  field/sub-object is present (renderers/collect/actions never hit undefined).
   *  Acts as the forward migration: missing collections become empty. */
  const sheetOf = (c) => {
    const s = (c && c.addonData && c.addonData[NS]) || {};
    const b = blank();
    return {
      ...b, ...s,
      abilities: { ...b.abilities, ...(s.abilities || {}) },
      saveProf:  { ...(s.saveProf || {}) },
      skillProf: { ...(s.skillProf || {}) },
      currency:  { ...b.currency, ...(s.currency || {}) },
      overrides: { ...(s.overrides || {}) },
      spells:    Array.isArray(s.spells) ? s.spells : [],
      preparedSpells: { ...(s.preparedSpells || {}) },
      cantrips:  { ...(s.cantrips || {}) },
      inventory: Array.isArray(s.inventory) ? s.inventory : [],
      baseStats: s.baseStats || null,
      classes:   Array.isArray(s.classes) ? s.classes : [],
      abilityGrants: Array.isArray(s.abilityGrants) ? s.abilityGrants : [],
      featureChoices: { ...(s.featureChoices || {}) },
      feats:     Array.isArray(s.feats) ? s.feats : [],
    };
  };

  /** Normalize a stored sheet into the Builder's working model, deriving the
   *  rich shape from the flat fields on first use (MC-1 migration). `engine` is
   *  used to resolve a free-text className → a compendium class id. Returns
   *  { classes, baseStats } — does NOT mutate; the actions persist edits. */
  const builderModel = (s, engine) => {
    const baseStats = (s.baseStats && Object.keys(s.baseStats).length)
      ? { ...s.baseStats }
      : { ...s.abilities };               // first Builder open: current scores become the base
    let classes = Array.isArray(s.classes) && s.classes.length ? s.classes.map((c) => ({ ...c })) : null;
    if (!classes) {
      const cid = s.className && engine && engine.getItemByName ? (engine.getItemByName('class', s.className) || {}).id : '';
      classes = s.className
        ? [{ classId: cid || '', level: Math.max(1, num(s.level, 1)), subclass: s.subclass || '' }]
        : [{ classId: '', level: 1, subclass: '' }];
    }
    return { baseStats, classes };
  };

  /** The choice descriptors for a build — the SINGLE source used by BOTH the
   *  Builder UI (to render pickers) and resolveChoices (to apply resolutions),
   *  so the two never drift. Background ASI is handled separately (its split UI).
   *  kind ∈ skills | expertise | weaponMastery | feat | enumerated | asiMode. */
  const collectChoices = (classes, engine) => {
    const out = [];
    for (const cl of classes) {
      const rec = cl.classId ? engine.getItem('class', cl.classId) : null;
      if (!rec) continue;
      const clvl = num(cl.level, 1);
      const sk = rec.startingProficiencies && rec.startingProficiencies.skills;
      if (sk && sk.choose) out.push({ id: 'skills:' + cl.classId, kind: 'skills', count: num(sk.choose, 1), from: sk.from || [], source: { type: 'class', id: cl.classId, level: 1 } });
      for (const ch of (rec.grants && rec.grants.choices) || []) {
        const srcLevel = num(String(ch.source || '').split(':')[1], 1);
        if (srcLevel > clvl) continue;
        let kind = 'enumerated';
        if (ch.type === 'expertise') kind = 'expertise';
        else if (ch.type === 'weaponMastery') kind = 'weaponMastery';
        else if (!Array.isArray(ch.from) && (ch.type === 'feat' || ch.category)) kind = 'feat';
        out.push({ id: ch.id, kind, count: num(ch.count, 1), from: ch.from, category: ch.category, prompt: ch.prompt, source: { type: 'class', id: cl.classId, level: srcLevel } });
      }
      for (const lvl of [4, 8, 12, 16, 19]) if (lvl <= clvl) out.push({ id: 'asi:' + cl.classId + ':' + lvl, kind: 'asiMode', classId: cl.classId, level: lvl, source: { type: 'class', id: cl.classId, level: lvl } });
    }
    return out;
  };

  /** Map featureChoices resolutions → the canonical input fields the engine
   *  reads (skill proficiencies, expertise, feats, weapon-mastery picks). The
   *  background ASI is already an abilityGrant; ASI-level "+2" picks too. */
  const resolveChoices = (s, classes, engine) => {
    const fc = s.featureChoices || {};
    const skillProficiencies = [], feats = [], weaponMasteryChoices = [];
    const skillExpertise = {};
    const valsOf = (ch) => {
      if (num(ch.count, 1) > 1) { const a = []; for (let i = 0; i < ch.count; i++) { const v = fc[ch.id + '#' + i]; if (v) a.push(v); } return a; }
      const v = fc[ch.id]; return v ? [v] : [];
    };
    const bgRec = s.background ? (engine.getItemByName('background', s.background) || engine.getItem('background', s.background)) : null;
    if (bgRec && bgRec.originFeat) feats.push(bgRec.originFeat);
    for (const ch of collectChoices(classes, engine)) {
      const vals = valsOf(ch);
      if (ch.kind === 'skills') skillProficiencies.push(...vals);
      else if (ch.kind === 'expertise') vals.forEach((v) => { skillExpertise[v] = true; });
      else if (ch.kind === 'weaponMastery') weaponMasteryChoices.push(...vals);
      else if (ch.kind === 'feat') feats.push(...vals);
      else if (ch.kind === 'asiMode') { if (fc[ch.id] === 'feat' && fc[ch.id + ':feat']) feats.push(fc[ch.id + ':feat']); }
    }
    return { skillProficiencies, skillExpertise, feats: feats.map((f) => ({ featId: f })), weaponMasteryChoices };
  };

  /** The decisions object the engine hydrates: the Builder's rich model + the
   *  resolved choices, merged over the stored sheet (so the engine sees
   *  classes[]/baseStats/grants AND the applied skill/expertise/feat picks). */
  const decisionsOf = (s, engine) => {
    const m = builderModel(s, engine);
    const resolved = engine ? resolveChoices(s, m.classes, engine) : {};
    return { ...s, classes: m.classes, baseStats: m.baseStats, ...resolved };
  };

  /** DEG-1: write the engine-computed sheet INTO the flat fallback fields, so
   *  removing the engine later degrades to this last-computed snapshot (a
   *  fully-functional hand-filled sheet) rather than blank/broken. Mutates `s`. */
  const materializeInto = (s, engine) => {
    const r = safeHydrate(engine, decisionsOf(s, engine));
    if (!r || !r.sheet) return;
    const cs = r.sheet, d = cs.derived || {};
    const m = builderModel(s, engine);
    const first = m.classes[0] || {};
    const firstRec = first.classId ? engine.getItem('class', first.classId) : null;
    s.className = firstRec ? firstRec.name : s.className;
    s.subclass = first.subclass || '';
    s.level = num(cs.totalLevel, num(s.level, 1));
    for (const a of ABILITIES) if (cs.abilities && cs.abilities[a]) s.abilities[a] = num(cs.abilities[a].score, num(s.abilities[a], 10));
    s.maxHp = num(d.maxHp, s.maxHp);
    if (num(s.hp, 0) > s.maxHp) s.hp = s.maxHp;
    s.ac = num(d.armorClass, s.ac);
    s.initiative = num(d.initiative, s.initiative);
    s.speed = num(d.speed, s.speed);
    s.profBonus = num(d.proficiencyBonus, s.profBonus);
    s.saveProf = {};
    for (const a of ABILITIES) s.saveProf[a] = !!(cs.saves && cs.saves[a] && cs.saves[a].proficient);
    s.skillProf = {};
    for (const id of Object.keys(cs.skills || {})) s.skillProf[id] = !!cs.skills[id].proficient;
  };

  /** Builder mutation: seed the rich model (migration) if needed, apply `fn`,
   *  then materialize the DEG-1 fallback. Persists + re-renders via `mutate`. */
  const builderMutate = (cid, fn) => {
    const engine = getRules();
    mutate(cid, (s) => {
      const m = builderModel(s, engine);
      if (!Array.isArray(s.classes) || !s.classes.length) s.classes = m.classes;
      if (!s.baseStats || !Object.keys(s.baseStats).length) s.baseStats = m.baseStats;
      fn(s, engine);
      if (engine) materializeInto(s, engine);
      return s;
    });
  };

  /** Run the rules engine over the stored decisions (error-isolated). Returns
   *  the engine result { sheet, warnings } or null in standalone / on failure —
   *  so a broken engine never breaks the sheet (ARCH-4/ARCH-5). */
  const safeHydrate = (engine, s) => {
    try { const r = engine && engine.hydrate && engine.hydrate(s); return (r && r.sheet) ? r : null; }
    catch (_) { return null; }
  };

  /** One value source for the read tabs: computed values from the engine when
   *  present (ARCH-1 — derive, don't store), else the hand-filled flat fields. A
   *  stored override always wins (ARCH-3). The `auto` flag drives the badge. */
  const viewModel = (s, comp) => {
    const flatPb = num(s.profBonus, 0);
    const ov = s.overrides || {};
    if (comp) {
      const d = comp.derived || {};
      const pick = (field, computed) => (ov[field] != null ? num(ov[field]) : num(computed));
      return {
        auto: true,
        overridden: (f) => ov[f] != null,
        pb: num(d.proficiencyBonus, flatPb),
        maxHp: pick('maxHp', d.maxHp),
        ac: pick('ac', d.armorClass),
        init: pick('initiative', d.initiative),
        speed: pick('speed', d.speed),
        passivePerc: num(d.passivePerception, 10),
        save: (a) => { const x = (comp.saves && comp.saves[a]) || {}; return { prof: !!x.proficient, exp: false, total: num(x.total, abilityMod(s.abilities[a])) }; },
        skill: (id, ab) => { const x = (comp.skills && comp.skills[id]) || {}; return { prof: !!x.proficient, exp: !!x.expertise, total: num(x.total, abilityMod(s.abilities[ab])) }; },
      };
    }
    return {
      auto: false,
      overridden: () => false,
      pb: flatPb,
      maxHp: num(s.maxHp, 0),
      ac: num(s.ac, 10),
      init: num(s.initiative, 0),
      speed: num(s.speed, 30),
      passivePerc: 10 + abilityMod(s.abilities.WIS) + (s.skillProf.perception ? flatPb : 0),
      save: (a) => { const prof = !!s.saveProf[a]; return { prof, exp: false, total: abilityMod(s.abilities[a]) + (prof ? flatPb : 0) }; },
      skill: (id, ab) => { const prof = !!s.skillProf[id]; return { prof, exp: false, total: abilityMod(s.abilities[ab]) + (prof ? flatPb : 0) }; },
    };
  };

  /** Soft-probe the rules engine. Lazily, per render, try/caught — so installing
   *  or removing core-rules never breaks the sheet (ARCH-4). core-rules is a
   *  manifest `optionalDependencies` entry: the host permits host.use() for it
   *  and load-orders it before us WHEN present, but never blocks us when it's
   *  absent (then use() throws → null → standalone). So the Builder tab appears
   *  only once core-rules is installed and provides an apiVersion≥1 API. */
  const getRules = () => {
    try {
      const r = host.use && host.use('dnd55e-core-rules');
      return (r && r.apiVersion >= 1) ? r : null;
    } catch (_) { return null; }
  };

  // ── Tab model ────────────────────────────────────────────────────
  //  Standalone exposes every tab in editable form; the Builder appears only
  //  with the engine (and then becomes the sole edit surface — a later step).
  //  Standalone exposes every tab (incl. Spellbook) so it's all hand-editable.
  //  In engine mode the Spellbook appears only if the character actually has
  //  spells (caster / granted / manual) — UI-4.
  const visibleTabs = (engine, hasSpells) => {
    const tabs = [
      { id: 'overview',  icon: '🪪', label: t('tab.overview') },
      { id: 'sheet',     icon: '⚔️', label: t('tab.sheet') },
    ];
    if (hasSpells) tabs.push({ id: 'spellbook', icon: '📖', label: t('tab.spellbook') });
    tabs.push({ id: 'backpack', icon: '🎒', label: t('tab.backpack') });
    if (engine) tabs.push({ id: 'builder', icon: '🛠️', label: t('tab.builder') });
    return tabs;
  };
  const tabKey = (id) => 'dse-tab:' + id;
  const currentTab = (cid, tabs) => {
    let stored = null;
    try { stored = localStorage.getItem(tabKey(cid)); } catch (_) {}
    return tabs.some((tb) => tb.id === stored) ? stored : tabs[0].id;
  };

  // ── Mutators (all route through patchAddonData → this NS only) ────
  const mutate = (cid, fn) => {
    host.store.patchAddonData('characters', cid, (raw) => {
      const s = sheetOf({ addonData: { [NS]: raw } });
      const out = fn(s) || s;
      return out;
    });
    host.ui.rerender();
  };

  // ════════════════════════════════════════════════════════════════
  //  Article section — the tabbed sheet on a character page
  // ════════════════════════════════════════════════════════════════
  host.registerArticleSection('characters', (c) => {
    if (!c) return null;
    const s = sheetOf(c);
    const editable = !host.role.isAnonymous();
    const engine = getRules();
    // Hydrate first (we need the computed sheet to decide tab visibility).
    const result = engine ? safeHydrate(engine, decisionsOf(s, engine)) : null;
    const comp = result && result.sheet;
    const warnings = (result && result.warnings) || [];
    const hasSpells = !engine
      || !!(comp && comp.spellcasting && ((comp.spellcasting.perClass || []).length || (comp.spellcasting.granted || []).length))
      || (Array.isArray(s.spells) && s.spells.length > 0);
    const tabs = visibleTabs(engine, hasSpells);
    const active = currentTab(c.id, tabs);

    const tabBar = `
      <div role="tablist" style="display:flex;flex-wrap:wrap;gap:var(--space-1);border-bottom:1px solid rgba(var(--gold-muted),.25);margin-bottom:var(--space-3)">
        ${tabs.map((tb) => {
          const on = tb.id === active;
          return `<button role="tab" aria-selected="${on}"
            style="background:${on ? 'rgba(var(--accent-gold-rgb),.12)' : 'transparent'};color:${on ? 'var(--text-parchment)' : 'var(--text-muted)'};border:none;border-bottom:2px solid ${on ? 'var(--accent-gold)' : 'transparent'};padding:var(--space-2) var(--space-3);font-size:var(--text-sm);font-weight:${on ? '600' : '400'};cursor:pointer;border-radius:var(--radius-sm) var(--radius-sm) 0 0"
            ${dataAction(host.action('tab'), c.id, tb.id)}>${esc(tb.icon)} ${esc(tb.label)}</button>`;
        }).join('')}
      </div>`;

    let panel = '';
    if (active === 'overview') panel = panelOverview(c, s, comp);
    else if (active === 'sheet') panel = panelSheet(c, s, editable, comp, warnings);
    else if (active === 'spellbook') panel = panelSpellbook(c, s, editable, comp, engine);
    else if (active === 'backpack') panel = panelBackpack(c, s, editable, comp, engine);
    else if (active === 'builder') panel = panelBuilder(c, s, editable, comp, warnings, engine);

    return {
      title: '🎲 ' + t('sheet.title'),
      html: `<div class="addon-dnd55e-sheets" style="display:flex;flex-direction:column">${tabBar}${panel}</div>`,
    };
  });

  // ── Panel: Overview ──────────────────────────────────────────────
  function panelOverview(c, s, comp) {
    const vm = viewModel(s, comp);
    const clsBits = [s.className, s.subclass ? '(' + s.subclass + ')' : ''].filter(Boolean).join(' ');
    const summary = t('sheet.summary', { level: num(s.level, 1), cls: clsBits || '' }).trim();
    const idBits = [
      s.race, s.background, s.alignment,
      s.player ? t('field.player') + ': ' + s.player : '',
    ].filter(Boolean).map(esc).join('  ·  ');

    const abilityCells = ABILITIES.map((a) => {
      const ca = comp && comp.abilities && comp.abilities[a];
      const score = ca ? num(ca.score, 10) : num(s.abilities[a], 10);
      const m = ca ? num(ca.mod, abilityMod(score)) : abilityMod(s.abilities[a]);
      return `
        <div style="background:var(--bg-raised);border-radius:var(--radius);padding:var(--space-2);text-align:center" title="${esc(t('ability.' + a))}">
          <div style="font-size:var(--text-xs);color:var(--text-muted);letter-spacing:.05em">${esc(a)}</div>
          <div style="font-size:var(--text-xl);color:var(--text-parchment);font-weight:700">${esc(signed(m))}</div>
          <div style="font-size:var(--text-sm);color:var(--text-light)">${esc(String(score))}</div>
        </div>`;
    }).join('');

    const glance = [
      [t('stat.hp'), `${num(s.hp, 0)} / ${vm.maxHp}`],
      [t('stat.ac'), vm.ac],
      [t('stat.init'), signed(vm.init)],
      [t('stat.speed'), vm.speed],
      [t('stat.pb'), signed(vm.pb)],
    ].map(([l, v]) => miniStat(l, v)).join('');

    const notesHtml = s.notes
      ? `<div>${sectionLabel(t('sheet.notes'))}<div class="md-view">${renderMarkdown(s.notes)}</div></div>`
      : '';

    return `
      <div style="display:flex;flex-direction:column;gap:var(--space-4)">
        <div>
          <div style="color:var(--text-parchment);font-weight:600;font-size:var(--text-lg)">${esc(summary)}</div>
          ${idBits ? `<div style="color:var(--text-muted);font-size:var(--text-sm);margin-top:var(--space-1)">${idBits}</div>` : ''}
        </div>
        <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:var(--space-2)">${abilityCells}</div>
        <div style="display:flex;flex-wrap:wrap;gap:var(--space-2)">${glance}</div>
        ${notesHtml}
      </div>`;
  }

  // ── Panel: Sheet (combat / saves / skills) ───────────────────────
  function panelSheet(c, s, editable, comp, warnings) {
    const vm = viewModel(s, comp);
    const pb = vm.pb;

    const hpControls = editable
      ? `<div style="display:flex;gap:var(--space-1);margin-top:var(--space-1);justify-content:center">
           <button class="inline-create-btn" title="${esc(t('action.hpMinus'))}"${dataAction(host.action('hp'), c.id, -1)}>−</button>
           <button class="inline-create-btn" title="${esc(t('action.hpPlus'))}"${dataAction(host.action('hp'), c.id, 1)}>＋</button>
         </div>`
      : '';
    const tempBit = num(s.tempHp, 0) > 0 ? ` <span style="color:var(--color-success)">(+${esc(String(num(s.tempHp, 0)))})</span>` : '';
    const hpBox = `
      <div style="background:var(--bg-raised);border-radius:var(--radius);padding:var(--space-2) var(--space-3);min-width:6rem;text-align:center">
        <div style="font-size:var(--text-xs);color:var(--text-muted)">${esc(t('stat.hp'))}</div>
        <div style="font-size:var(--text-lg);color:var(--text-parchment);font-weight:600">
          ${esc(String(num(s.hp, 0)))} <span style="color:var(--text-muted)">/ ${esc(String(vm.maxHp))}</span>${tempBit}
        </div>
        ${hpControls}
      </div>`;
    const combat = hpBox
      + statBox(t('stat.ac'), vm.ac)
      + statBox(t('stat.init'), signed(vm.init))
      + statBox(t('stat.speed'), vm.speed)
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

  // ── Panel: Spellbook ─────────────────────────────────────────────
  //  v1: editable spell cards with a prepared toggle. Provenance grouping
  //  (granted vs copied vs manual), forced-duplicate colouring, and drag-drop
  //  preparation into boxes are the NEXT increment (SP-1..SP-7 / UI-5/6).
  // Standalone → simple editable list. Engine mode → granted (always-prepared)
  // spells separated from the player's picks, per-class cantrip + prepared slots
  // (click-to-prepare — true drag-drop needs a host drag event-kind), an
  // Extra/Copied group, and forced-duplicate colouring (SP-1..SP-7).
  function panelSpellbook(c, s, editable, comp, engine) {
    const sc = comp && comp.spellcasting;
    if (!sc || !engine) return panelSpellbookManual(c, s, editable);

    const granted = sc.granted || [];
    const alwaysSet = new Set(granted.filter((g) => g.alwaysPrepared).map((g) => g.ref));
    const blocks = [spellcastingSummary(s, comp)];
    for (const p of (sc.perClass || [])) blocks.push(classSpellSection(c, s, p, comp, engine, editable, alwaysSet));
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

  // resolve a spell ref → {name, level, school} via the compendium.
  function spellInfo(engine, ref) {
    const r = engine && engine.getItem ? engine.getItem('spell', ref) : null;
    return r ? { name: r.name, level: num(r.level, 0), school: r.school || '' } : { name: titleize(ref), level: null, school: '' };
  }
  function lvlLabel(level) { return level === 0 ? t('spellbook.cantrip') : level == null ? '' : t('spellbook.lvlN', { n: level }); }
  function subLabel(text) { return `<div style="color:var(--text-muted);font-size:var(--text-xs);text-transform:uppercase;letter-spacing:.04em;margin-bottom:var(--space-1)">${esc(text)}</div>`; }

  function spellChip(name, sub, opts) {
    opts = opts || {};
    const color = opts.danger ? 'var(--color-danger)' : 'var(--text-parchment)';
    const bd = opts.danger ? 'var(--color-danger)' : 'rgba(var(--gold-muted),.2)';
    const badge = opts.badge ? `<span title="${esc(opts.badgeTitle || '')}">${esc(opts.badge)}</span>` : '';
    const right = opts.removeAttr
      ? `<button class="inline-create-btn" title="${esc(t('action.remove'))}"${opts.removeAttr}>✕</button>`
      : (opts.locked ? `<span title="${esc(t('spell.alwaysPrepared'))}" style="color:var(--accent-gold)">🔒</span>` : '');
    return `<div title="${esc(opts.title || '')}" style="display:flex;align-items:center;gap:var(--space-1);background:var(--bg-raised);border:1px solid ${bd};border-radius:var(--radius-sm);padding:var(--space-1) var(--space-2);min-width:8.5rem">
      ${badge}<div style="flex:1"><div style="color:${color};font-size:var(--text-sm)">${esc(name)}</div>${sub ? `<div style="color:var(--text-muted);font-size:var(--text-xs)">${esc(sub)}</div>` : ''}</div>${right}</div>`;
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

  // Extra (manual) + copied spells, separate from the granted set (SP-1/SP-15).
  function extraSection(c, s, editable, granted) {
    const gnames = new Set((granted || []).map((g) => String(g.name || '').toLowerCase()));
    const spells = (s.spells || []).slice().sort((a, b) => num(a.level) - num(b.level));
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

  // ── Panel: Backpack (inventory + currency) ───────────────────────
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

  // ════════════════════════════════════════════════════════════════
  //  Panel: Builder — the guided progression + edit surface (engine mode).
  //  Writes the rich decision model (classes[]/baseStats/grants/choices); every
  //  edit re-hydrates + materializes the DEG-1 fallback. Reached only when the
  //  engine is present (the tab is gated on it).
  // ════════════════════════════════════════════════════════════════
  function panelBuilder(c, s, editable, comp, warnings, engine) {
    if (!engine) return panelBuilderStub();
    const ro = !editable;
    const model = builderModel(s, engine);
    const classes = model.classes;
    const base = model.baseStats;
    const totalLevel = classes.reduce((n, cl) => n + Math.max(1, num(cl.level, 1)), 0);
    const d = (comp && comp.derived) || {};

    const summary = [
      miniStat(t('stat.hp'), num(d.maxHp, 0)),
      miniStat(t('stat.ac'), num(d.armorClass, 10)),
      miniStat(t('stat.pb'), signed(num(d.proficiencyBonus, 2))),
      miniStat(t('builder.totalLevel'), totalLevel),
    ].join('');

    return `
      <div style="display:flex;flex-direction:column;gap:var(--space-4)">
        ${engineBanner(viewModel(s, comp), warnings)}
        <div style="display:flex;flex-wrap:wrap;gap:var(--space-2)">${summary}</div>
        ${builderAbilities(c, base, comp, ro)}
        ${builderIdentity(c, s, engine, ro)}
        ${builderClasses(c, classes, engine, ro)}
        ${builderChoices(c, s, classes, engine, comp, ro)}
        ${builderLog(classes, engine, comp)}
      </div>`;
  }

  function panelBuilderStub() {
    return `<div style="color:var(--text-muted);font-size:var(--text-sm)">${esc(t('builder.soon'))}</div>`;
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

  // Base ability scores → final (base + grants) preview.
  function builderAbilities(c, base, comp, ro) {
    const cells = ABILITIES.map((a) => {
      const b = num(base[a], 10);
      const fin = comp && comp.abilities && comp.abilities[a] ? num(comp.abilities[a].score, b) : b;
      const bonus = fin - b;
      const input = ro
        ? `<div style="color:var(--text-parchment);font-weight:700;font-size:var(--text-lg)">${esc(String(b))}</div>`
        : `<input class="edit-input" type="number" min="1" max="30" style="width:3.5rem;text-align:center" value="${esc(String(b))}"${dataOn('change', host.action('builderAbility'), c.id, a, '$value')}>`;
      return `<div style="text-align:center;background:var(--bg-raised);border-radius:var(--radius);padding:var(--space-2)">
        <div style="font-size:var(--text-xs);color:var(--text-muted)">${esc(a)}</div>
        ${input}
        <div style="font-size:var(--text-xs);color:var(--text-muted);margin-top:var(--space-1)">→ <strong style="color:var(--text-parchment)">${esc(String(fin))}</strong> ${esc(signed(abilityMod(fin)))}${bonus ? ` <span style="color:var(--color-success)">${esc(signed(bonus))}</span>` : ''}</div>
      </div>`;
    }).join('');
    return `<div>${sectionLabel(t('builder.abilities'))}
      <div style="color:var(--text-muted);font-size:var(--text-xs);margin-bottom:var(--space-2)">${esc(t('builder.baseHint'))}</div>
      <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:var(--space-2)">${cells}</div></div>`;
  }

  // Identity: species (+lineage), background, alignment, player.
  function builderIdentity(c, s, engine, ro) {
    const speciesOpts = (engine.listSpecies() || []).map((o) => ({ value: o.name, label: o.name }));
    const bgOpts = (engine.listBackgrounds() || []).map((o) => ({ value: o.name, label: o.name }));
    const speciesRec = s.race ? (engine.getItemByName('species', s.race) || engine.getItem('species', s.race)) : null;
    const lineageOpts = (speciesRec && speciesRec.lineages || []).map((l) => ({ value: l.id, label: l.name }));
    const rows = [
      fieldRow(t('field.player'), ro
        ? `<span style="color:var(--text-parchment)">${esc(s.player || t('misc.notSet'))}</span>`
        : `<input class="edit-input" value="${esc(s.player || '')}"${dataOn('change', host.action('builderField'), c.id, 'player', '$value')}>`),
      fieldRow(t('field.race'), selectBox(s.race, speciesOpts, dataOn('change', host.action('builderField'), c.id, 'race', '$value'), t('builder.choose'), ro)),
    ];
    if (lineageOpts.length) rows.push(fieldRow(t('builder.lineage'), selectBox(s.lineage, lineageOpts, dataOn('change', host.action('builderField'), c.id, 'lineage', '$value'), t('builder.choose'), ro)));
    rows.push(fieldRow(t('field.background'), selectBox(s.background, bgOpts, dataOn('change', host.action('builderField'), c.id, 'background', '$value'), t('builder.choose'), ro)));
    rows.push(fieldRow(t('field.alignment'), ro
      ? `<span style="color:var(--text-parchment)">${esc(s.alignment || t('misc.notSet'))}</span>`
      : `<input class="edit-input" value="${esc(s.alignment || '')}"${dataOn('change', host.action('builderField'), c.id, 'alignment', '$value')}>`));
    return `<div>${sectionLabel(t('builder.identity'))}${rows.join('')}</div>`;
  }

  // Classes: ordered classes[] with class / level / subclass + add/remove.
  function builderClasses(c, classes, engine, ro) {
    const classOpts = (engine.listClasses() || []).map((o) => ({ value: o.id, label: o.name }));
    const rows = classes.map((cl, idx) => {
      const rec = cl.classId ? engine.getItem('class', cl.classId) : null;
      const subLevel = rec ? num(rec.subclassLevel, 3) : 3;
      const subOpts = (engine.listSubclasses(cl.classId) || []).map((o) => ({ value: o.id, label: o.name }));
      const showSub = rec && num(cl.level, 1) >= subLevel;
      const levelCtl = ro
        ? `<span style="color:var(--text-parchment)">${esc(String(num(cl.level, 1)))}</span>`
        : `<input class="edit-input" type="number" min="1" max="20" style="width:3.5rem" value="${esc(String(num(cl.level, 1)))}"${dataOn('change', host.action('builderLevelSet'), c.id, idx, '$value')}>`;
      const removeBtn = (!ro && classes.length > 1) ? `<button class="inline-create-btn" title="${esc(t('action.remove'))}"${dataAction(host.action('builderRemoveClass'), c.id, idx)}>✕</button>` : '';
      return `<div style="display:flex;flex-wrap:wrap;gap:var(--space-2);align-items:center;padding:var(--space-1) 0;border-bottom:1px solid rgba(var(--gold-muted),.12)">
        <div style="min-width:9rem">${selectBox(cl.classId, classOpts, dataOn('change', host.action('builderClassSet'), c.id, idx, '$value'), t('builder.choose'), ro)}</div>
        <span style="color:var(--text-muted);font-size:var(--text-xs)">${esc(t('field.level'))}</span> ${levelCtl}
        ${showSub ? `<div style="min-width:9rem">${selectBox(cl.subclass, subOpts, dataOn('change', host.action('builderSubclassSet'), c.id, idx, '$value'), t('builder.subclass'), ro)}</div>` : ''}
        ${removeBtn}
      </div>`;
    }).join('');
    const addBtn = ro ? '' : `<button class="inline-create-btn" style="margin-top:var(--space-2)"${dataAction(host.action('builderAddClass'), c.id)}>＋ ${esc(t('builder.addClass'))}</button>`;
    return `<div>${sectionLabel(t('builder.classes'))}${rows}${addBtn}</div>`;
  }

  // Choices: background ASI + per-class grant choices + ASI-level feat/ASI.
  // Collected from the build; resolutions persist in featureChoices / grants.
  function builderChoices(c, s, classes, engine, comp, ro) {
    const blocks = [];

    // Background ASI (AB-1).
    const bgRec = s.background ? (engine.getItemByName('background', s.background) || engine.getItem('background', s.background)) : null;
    if (bgRec && Array.isArray(bgRec.abilityScores) && bgRec.abilityScores.length) {
      const abil = bgRec.abilityScores;
      const splits = [];
      for (const x of abil) for (const y of abil) if (x !== y) splits.push({ value: `${x}:2,${y}:1`, label: `+2 ${x}, +1 ${y}` });
      splits.push({ value: abil.map((a) => a + ':1').join(','), label: '+1 ' + abil.join(', +1 ') });
      const cur = s.featureChoices['bgasi'] || '';
      blocks.push(choiceBlock(t('builder.bgAsi', { bg: bgRec.name }), selectBox(cur, splits, dataOn('change', host.action('builderBgAsi'), c.id, '$value'), t('builder.choose'), ro)));
      if (bgRec.originFeat) blocks.push(`<div style="color:var(--text-muted);font-size:var(--text-xs)">${esc(t('builder.originFeat', { feat: titleize(bgRec.originFeat) }))}</div>`);
    }

    // Per-class choices (skills / grants / ASI levels) from the shared collector.
    for (const ch of collectChoices(classes, engine)) blocks.push(renderDescriptor(c, s, ch, engine, ro));

    if (!blocks.length) return '';
    return `<div>${sectionLabel(t('builder.choices'))}<div style="display:flex;flex-direction:column;gap:var(--space-2)">${blocks.join('')}</div></div>`;
  }

  function choiceBlock(label, control, hint) {
    return `<div style="background:var(--bg-raised);border-radius:var(--radius);padding:var(--space-2) var(--space-3)">
      <div style="font-size:var(--text-sm);color:var(--text-light);margin-bottom:var(--space-1)">${esc(label)}</div>
      ${control}${hint ? `<div style="color:var(--text-muted);font-size:var(--text-xs);margin-top:var(--space-1)">${esc(hint)}</div>` : ''}</div>`;
  }

  // Render one choice descriptor from collectChoices (skills / expertise /
  // weaponMastery / feat / enumerated; asiMode delegates to renderAsiLevel).
  function renderDescriptor(c, s, ch, engine, ro) {
    if (ch.kind === 'asiMode') return renderAsiLevel(c, s, ch, engine, ro);
    const count = Math.max(1, num(ch.count, 1));
    let options = null;
    let label = ch.prompt || titleize(ch.id);
    if (ch.kind === 'skills' || ch.kind === 'expertise') {
      const pool = (ch.kind === 'skills' && Array.isArray(ch.from) && ch.from.length) ? ch.from : SKILLS.map((sk) => sk.id);
      options = pool.map((id) => ({ value: id, label: t('skill.' + id) }));
      label = ch.kind === 'skills' ? t('builder.skillProfs') : t('builder.expertise');
    } else if (Array.isArray(ch.from)) {
      options = ch.from.map((v) => ({ value: v, label: titleize(v) }));
    } else if (ch.kind === 'weaponMastery') {
      options = (engine.listWeapons() || []).map((w) => ({ value: w.id, label: w.name }));
      label = t('builder.weaponMastery');
    } else if (ch.kind === 'feat') {
      options = (engine.listFeats(ch.category ? { category: ch.category } : undefined) || []).map((f) => ({ value: f.id, label: f.name }));
    }
    if (!options || !options.length) {
      return choiceBlock(label, `<span style="color:var(--text-muted);font-size:var(--text-xs)">${esc(t('builder.contentPending'))}</span>`);
    }
    const pickers = [];
    for (let i = 0; i < count; i++) {
      const key = count > 1 ? ch.id + '#' + i : ch.id;
      pickers.push(`<div style="min-width:9rem">${selectBox(s.featureChoices[key] || '', options, dataOn('change', host.action('builderChoose'), c.id, key, '$value'), t('builder.choose'), ro)}</div>`);
    }
    return choiceBlock(count > 1 ? label + ' (' + count + ')' : label, `<div style="display:flex;flex-wrap:wrap;gap:var(--space-1)">${pickers.join('')}</div>`);
  }

  // ASI-vs-Feat at an ability-score-improvement level (descriptor kind asiMode).
  function renderAsiLevel(c, s, ch, engine, ro) {
    const key = ch.id;   // 'asi:<classId>:<level>'
    const mode = s.featureChoices[key] || '';
    const modeOpts = [
      { value: 'asi', label: t('builder.asiOption') },
      { value: 'feat', label: t('builder.featOption') },
    ];
    const label = t('builder.asiLevel', { cls: (engine.getItem('class', ch.classId) || {}).name || ch.classId, lvl: ch.level });
    let detail = '';
    if (mode === 'asi') {
      const abilKey = key + ':ability';
      detail = `<div style="margin-top:var(--space-1);min-width:9rem">${selectBox(s.featureChoices[abilKey] || '', ABILITIES.map((a) => ({ value: a, label: t('ability.' + a) })), dataOn('change', host.action('builderChoose'), c.id, abilKey, '$value'), t('builder.asiAbility'), ro)}</div>`;
    } else if (mode === 'feat') {
      const featKey = key + ':feat';
      const chosenFeat = s.featureChoices[featKey] || '';
      const featOpts = (engine.listFeats({ category: 'general' }) || []).map((f) => ({ value: f.id, label: f.name }));
      detail = `<div style="margin-top:var(--space-1);min-width:12rem">${selectBox(chosenFeat, featOpts, dataOn('change', host.action('builderChoose'), c.id, featKey, '$value'), t('builder.choose'), ro)}</div>`;
      // Half-feat with a CHOICE of ability → ability sub-pick (AB-2). A fixed
      // single-option bump is auto-applied in builderChoose; granted spells +
      // the applied bump flow through the engine via abilityGrants.
      const featRec = chosenFeat ? engine.getItem('feat', chosenFeat) : null;
      const asi = featRec && featRec.grants && featRec.grants.abilityScoreIncrease;
      if (asi && Array.isArray(asi.from) && asi.from.length > 1) {
        const abilKey = key + ':featability';
        detail += `<div style="margin-top:var(--space-1);min-width:9rem">${selectBox(s.featureChoices[abilKey] || '', asi.from.map((a) => ({ value: a, label: t('ability.' + a) })), dataOn('change', host.action('builderChoose'), c.id, abilKey, '$value'), t('builder.asiAbility'), ro)}</div>`;
      }
    }
    return choiceBlock(label, `${selectBox(mode, modeOpts, dataOn('change', host.action('builderChoose'), c.id, key, '$value'), t('builder.choose'), ro)}${detail}`);
  }

  // Progression log — what each level granted (the "when did I choose what").
  function builderLog(classes, engine, comp) {
    const features = (comp && comp.features) || [];
    const rows = [];
    let charLvl = 0;
    for (const cl of classes) {
      const rec = cl.classId ? engine.getItem('class', cl.classId) : null;
      const clsName = rec ? rec.name : (cl.classId || '?');
      for (let l = 1; l <= num(cl.level, 1); l++) {
        charLvl++;
        const feats = features.filter((f) => f.source && f.source.id === cl.classId && num(f.source.level) === l).map((f) => f.name || titleize(f.id));
        rows.push(`<div style="display:flex;gap:var(--space-2);padding:var(--space-1) 0;border-bottom:1px solid rgba(var(--gold-muted),.1);font-size:var(--text-sm)">
          <span style="color:var(--text-muted);min-width:2.5rem">L${esc(String(charLvl))}</span>
          <span style="color:var(--text-light);min-width:7rem">${esc(clsName)} ${esc(String(l))}</span>
          <span style="color:var(--text-parchment);flex:1">${feats.length ? esc(feats.join(', ')) : '<span style="color:var(--text-muted)">—</span>'}</span>
        </div>`);
      }
    }
    if (!rows.length) return '';
    return `<div>${sectionLabel(t('builder.progression'))}${rows.join('')}</div>`;
  }

  const titleize = (id) => String(id || '').replace(/[-_:]/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());

  // ── Shared render helpers ────────────────────────────────────────
  function sectionLabel(text) {
    return `<div style="font-size:var(--text-xs);color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:var(--space-2)">${esc(text)}</div>`;
  }
  function statBox(label, value) {
    return `<div style="background:var(--bg-raised);border-radius:var(--radius);padding:var(--space-2) var(--space-3);min-width:4.5rem;text-align:center">
      <div style="font-size:var(--text-xs);color:var(--text-muted)">${esc(label)}</div>
      <div style="font-size:var(--text-lg);color:var(--text-parchment);font-weight:600">${esc(String(value))}</div></div>`;
  }
  function miniStat(label, value) {
    return `<div style="background:var(--bg-surface);border:1px solid rgba(var(--gold-muted),.18);border-radius:var(--radius-sm);padding:var(--space-1) var(--space-2);text-align:center;min-width:3.5rem">
      <div style="font-size:var(--text-xs);color:var(--text-muted)">${esc(label)}</div>
      <div style="color:var(--text-parchment);font-weight:600;font-size:var(--text-sm)">${esc(String(value))}</div></div>`;
  }
  function rowLine(prof, labelHtml, totalText, exp) {
    const mark = exp
      ? `<span style="color:var(--accent-gold)" title="${esc(t('misc.expertise'))}">★</span>`
      : prof
        ? `<span style="color:var(--accent-gold)" title="${esc(t('misc.proficient'))}">●</span>`
        : `<span style="color:var(--text-muted)">○</span>`;
    return `<div style="display:flex;align-items:center;gap:var(--space-2);padding:var(--space-1) 0;border-bottom:1px solid rgba(var(--gold-muted),.12)">
      ${mark}<span style="flex:1;color:var(--text-light);font-size:var(--text-sm)">${labelHtml}</span>
      <strong style="color:var(--text-parchment)">${esc(totalText)}</strong></div>`;
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
      return `<div style="display:flex;align-items:center;gap:var(--space-2);padding:var(--space-1) 0;border-bottom:1px solid rgba(var(--gold-muted),.12)">
        <span style="flex:1;color:var(--text-light);font-size:var(--text-sm)">${esc(w.name)}${mastery}${profMark}</span>
        <strong style="color:var(--text-parchment)">${esc(signed(num(w.attackBonus)))}</strong>
        <span style="color:var(--text-muted);font-size:var(--text-sm);min-width:6rem;text-align:right">${esc(w.damage)}${w.damageType ? ' ' + esc(w.damageType) : ''}</span>
      </div>`;
    }).join('');
    return `<div>${sectionLabel(t('sheet.attacks'))}${rows}</div>`;
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

  // ════════════════════════════════════════════════════════════════
  //  Actions
  // ════════════════════════════════════════════════════════════════
  host.registerAction('tab', (cid, tabId) => {
    try { localStorage.setItem(tabKey(cid), String(tabId)); } catch (_) {}
    host.ui.rerender();
  });

  // HP +/- → clamp to [0, maxHp].
  host.registerAction('hp', (id, delta) => {
    mutate(id, (s) => {
      const maxHp = num(s.maxHp, 0);
      let next = num(s.hp, maxHp) + Number(delta);
      s.hp = Math.max(0, maxHp > 0 ? Math.min(maxHp, next) : next);
      return s;
    });
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

  // ── Builder (engine mode) — edit the rich decision model + materialize ────
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

  // ════════════════════════════════════════════════════════════════
  //  Editor fields — the scalar decision form on the character editor
  //  overlay (identity / abilities / combat / saves / skills / notes).
  //  Collections (spells, inventory, currency) are edited INLINE in their
  //  tabs; this form preserves them untouched via {...prev}.
  // ════════════════════════════════════════════════════════════════
  host.registerEditorFields('characters', {
    fields: (c) => {
      // Engine mode: editing flows through the 🛠️ Builder tab (decision #4) —
      // the flat overlay form is standalone-only.
      if (getRules()) {
        return `<div class="edit-section">
          <div class="edit-section-title">🎲 ${esc(t('sheet.title'))}</div>
          <p class="settings-hint">${esc(t('builder.editHere'))}</p></div>`;
      }
      const s = sheetOf(c);
      const text = (id, label, val) =>
        `<label class="edit-label">${esc(label)}</label>
         <input id="${id}" class="edit-input" value="${esc(val || '')}">`;
      const numField = (id, label, val, min) =>
        `<label class="edit-label">${esc(label)}</label>
         <input id="${id}" class="edit-input" type="number"${min != null ? ` min="${min}"` : ''} value="${esc(String(val))}">`;

      const abilityInputs = ABILITIES.map((a) => `
        <div style="text-align:center">
          <label class="edit-label" title="${esc(t('ability.' + a))}">${esc(a)}</label>
          <input id="dse-ab-${a}" class="edit-input" type="number" min="1" style="text-align:center"
                 value="${esc(String(num(s.abilities[a], 10)))}">
        </div>`).join('');

      const saveChecks = ABILITIES.map((a) => checkbox('dse-save-' + a, t('ability.' + a), !!s.saveProf[a])).join('');
      const skillChecks = SKILLS
        .map((sk) => ({ sk, name: t('skill.' + sk.id) }))
        .sort((x, y) => x.name.localeCompare(y.name))
        .map(({ sk, name }) => checkbox('dse-skill-' + sk.id, name + ' (' + sk.ability + ')', !!s.skillProf[sk.id]))
        .join('');

      return `
        <div class="edit-section">
          <div class="edit-section-title">🎲 ${esc(t('sheet.title'))} · ${esc(t('sheet.identity'))}</div>
          ${text('dse-player', t('field.player'), s.player)}
          ${text('dse-class', t('field.class'), s.className)}
          ${text('dse-subclass', t('field.subclass'), s.subclass)}
          ${text('dse-race', t('field.race'), s.race)}
          ${text('dse-background', t('field.background'), s.background)}
          ${text('dse-alignment', t('field.alignment'), s.alignment)}
          ${numField('dse-level', t('field.level'), num(s.level, 1), 1)}
        </div>

        <div class="edit-section">
          <div class="edit-section-title">${esc(t('sheet.abilities'))}</div>
          <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:var(--space-2)">${abilityInputs}</div>
        </div>

        <div class="edit-section">
          <div class="edit-section-title">${esc(t('sheet.combat'))}</div>
          ${numField('dse-maxhp', t('field.maxHp'), num(s.maxHp, 0), 0)}
          ${numField('dse-hp', t('field.hp'), num(s.hp, 0), 0)}
          ${numField('dse-temphp', t('field.tempHp'), num(s.tempHp, 0), 0)}
          ${numField('dse-ac', t('field.ac'), num(s.ac, 10), 0)}
          ${numField('dse-init', t('field.initiative'), num(s.initiative, 0))}
          ${numField('dse-speed', t('field.speed'), num(s.speed, 30), 0)}
          ${numField('dse-pb', t('field.profBonus'), num(s.profBonus, 2), 0)}
        </div>

        <div class="edit-section">
          <div class="edit-section-title">${esc(t('sheet.saves'))}</div>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:var(--space-1)">${saveChecks}</div>
        </div>

        <div class="edit-section">
          <div class="edit-section-title">${esc(t('sheet.skills'))}</div>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:var(--space-1)">${skillChecks}</div>
        </div>

        <div class="edit-section">
          <div class="edit-section-title">${esc(t('sheet.notes'))}</div>
          <label class="edit-label">${esc(t('field.notes'))}</label>
          <textarea id="dse-notes" class="edit-input" rows="4">${esc(s.notes || '')}</textarea>
        </div>`;

      function checkbox(id, label, checked) {
        return `<label style="display:flex;align-items:center;gap:var(--space-2);color:var(--text-light);font-size:var(--text-sm);cursor:pointer">
          <input id="${id}" type="checkbox"${checked ? ' checked' : ''}> ${esc(label)}</label>`;
      }
    },

    collect: (scope, c) => {
      const prev = sheetOf(c);
      if (getRules()) return prev;   // engine mode: the overlay shows no fields → preserve decisions
      const q = (sel) => scope.querySelector(sel);
      const sval = (sel) => (q(sel)?.value ?? '').trim();
      const ival = (sel, d) => { const n = parseInt(q(sel)?.value, 10); return Number.isFinite(n) ? n : d; };
      const chk = (sel) => !!q(sel)?.checked;

      const next = {
        ...prev, // preserves spells / inventory / currency untouched
        player: sval('#dse-player'),
        className: sval('#dse-class'),
        subclass: sval('#dse-subclass'),
        race: sval('#dse-race'),
        background: sval('#dse-background'),
        alignment: sval('#dse-alignment'),
        level: Math.max(1, ival('#dse-level', prev.level)),
        abilities: {},
        maxHp: Math.max(0, ival('#dse-maxhp', prev.maxHp)),
        hp: Math.max(0, ival('#dse-hp', prev.hp)),
        tempHp: Math.max(0, ival('#dse-temphp', prev.tempHp)),
        ac: ival('#dse-ac', prev.ac),
        initiative: ival('#dse-init', prev.initiative),
        speed: Math.max(0, ival('#dse-speed', prev.speed)),
        profBonus: ival('#dse-pb', prev.profBonus),
        saveProf: {},
        skillProf: {},
        notes: q('#dse-notes')?.value ?? prev.notes,
      };
      ABILITIES.forEach((a) => { next.abilities[a] = Math.max(1, ival('#dse-ab-' + a, prev.abilities[a])); });
      ABILITIES.forEach((a) => { next.saveProf[a] = chk('#dse-save-' + a); });
      SKILLS.forEach((sk) => { next.skillProf[sk.id] = chk('#dse-skill-' + sk.id); });
      if (next.maxHp > 0 && next.hp > next.maxHp) next.hp = next.maxHp;
      return next;
    },
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
