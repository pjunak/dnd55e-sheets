// ═══════════════════════════════════════════════════════════════
//  helpers.js — domain constants + pure helpers, shared by every module.
//
//  No host/DOM coupling except `uid`, which uses host.store.generateId for
//  stable ids (with a safe random fallback). `makeHelpers(host)` binds that one
//  dependency; everything else is a free pure function exported directly.
// ═══════════════════════════════════════════════════════════════

// ── Domain constants ─────────────────────────────────────────────
export const ABILITIES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
export const COINS = ['pp', 'gp', 'ep', 'sp', 'cp'];
export const LOCATIONS = ['equipped', 'ready', 'pack']; // carry state (EQ-1)
// Each skill maps to its governing ability (D&D 2024).
export const SKILLS = [
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
export const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
export const abilityMod = (score) => Math.floor((num(score, 10) - 10) / 2);
export const signed = (n) => (n >= 0 ? '+' + n : String(n));
export const titleize = (id) => String(id || '').replace(/[-_:]/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());

/** HP clamp — one rule for all sites. With a max>0, clamp into [0, max];
 *  with no max set (0), only floor at 0 (the ± action stays usable). */
export const clampHp = (hp, maxHp) => {
  const h = num(hp, 0), m = num(maxHp, 0);
  return m > 0 ? Math.max(0, Math.min(m, h)) : Math.max(0, h);
};

/** A blank sheet — the v2 shape stored under addonData[NS]. Only player
 *  decisions are stored; in standalone (no engine) the entered numbers ARE
 *  the decisions. The future engine layers computed values + overrides over
 *  this without reshaping it. New collections (spells/inventory/currency) are
 *  ADDED over the v1 shape — v1 blobs migrate forward losslessly (just gain
 *  the empty arrays). Multiclass `classes[]` arrives with the Builder. */
export const blank = () => ({
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
  grantChoices: {},   // engine mode: { '<src>:<id>:<grantId>': [spellRef,…] } resolved choose-grants (SP-10)
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

/**
 * Bind the host-dependent helpers (just `uid` + `sheetOf`, which needs NS).
 * Returns `{ uid, sheetOf }`. `uid(seed)` makes a stable id via
 * host.store.generateId, falling back to a random suffix if that throws.
 */
export function makeHelpers(host) {
  const NS = host.id;

  const uid = (seed) => {
    try { return host.store.generateId(seed || 'row'); }
    catch (_) { return String(seed || 'row') + '_' + Math.random().toString(36).slice(2, 8); }
  };

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
      grantChoices: { ...(s.grantChoices || {}) },
      inventory: Array.isArray(s.inventory) ? s.inventory : [],
      baseStats: s.baseStats || null,
      classes:   Array.isArray(s.classes) ? s.classes : [],
      abilityGrants: Array.isArray(s.abilityGrants) ? s.abilityGrants : [],
      featureChoices: { ...(s.featureChoices || {}) },
      feats:     Array.isArray(s.feats) ? s.feats : [],
    };
  };

  return { uid, sheetOf };
}
