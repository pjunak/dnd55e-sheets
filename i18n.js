// ═══════════════════════════════════════════════════════════════
//  i18n — vendored per-addon localization helper.
//
//  Mirrors the host's web/js/i18n.js so future languages are PURELY ADDITIVE:
//   • English is the source of truth and is always present (universal fallback).
//   • Resolution mirrors the host: explicit per-user choice
//     (localStorage 'codex_lang', shared with the host) → browser language
//     (primary subtag match) → English.
//   • Lookup falls back PER KEY: active locale → English → the key itself
//     (never throws, never blanks).
//
//  The host exposes NO addon-translation API and no locale on the facade
//  (AUTHORING.md §4 / invariant #10), so we read the host's shared
//  'codex_lang' key directly to follow the user's language automatically. The
//  host re-renders routes/sections on a language switch, so renderers re-run
//  and re-read t() — no language listener is needed.
//
//  Adding a language (e.g. Czech): create strings/cs.js (same flat shape as
//  strings/en.js) and, in entry.js:
//      import cs from './strings/cs.js';
//      import { registerCatalog } from './i18n.js';
//      registerCatalog('cs', cs);
//  …nothing else changes. (No-build-step note: catalogs are JS modules — the
//  idiomatic equivalent of the host's fetched /i18n/<locale>.json files.)
//
//  DOM-free safe: localStorage/navigator access is guarded, so this also runs
//  under `node --test` (the addon test harness), falling back to English.
// ═══════════════════════════════════════════════════════════════

import en from './strings/en.js';

const LS_KEY = 'codex_lang';
const CATALOGS = { en };

/** Register a locale catalog (flat key → string). en is built in. */
export function registerCatalog(id, catalog) {
  if (id && catalog) CATALOGS[id] = catalog;
}

/**
 * The locale to render in: explicit stored choice → first browser-preferred
 * language whose primary subtag we have a catalog for → 'en'. Only locales
 * with a registered catalog are eligible, so adding a catalog is all it takes.
 * @returns {string} an available locale id
 */
export function activeLocale() {
  const available = Object.keys(CATALOGS);
  let stored = null;
  try { stored = localStorage.getItem(LS_KEY); } catch (_) {}
  if (stored && available.includes(stored)) return stored;
  let langs = [];
  try {
    langs = (navigator.languages && navigator.languages.length)
      ? navigator.languages
      : (navigator.language ? [navigator.language] : []);
  } catch (_) {}
  for (const tag of langs) {
    const primary = String(tag || '').toLowerCase().split('-')[0];
    if (available.includes(primary)) return primary;
  }
  return 'en';
}

/**
 * Translate a key. Fallback chain: active locale → English → the key itself.
 * `{placeholder}` tokens in the string are filled from `params`. Returns PLAIN
 * text — callers esc() before innerHTML, exactly as for any literal.
 * @param {string} key
 * @param {Object<string,*>} [params]
 * @returns {string}
 */
export function t(key, params) {
  const loc = activeLocale();
  let s = CATALOGS[loc] ? CATALOGS[loc][key] : undefined;
  if (s == null) s = CATALOGS.en ? CATALOGS.en[key] : undefined;
  if (s == null) return key;
  if (params == null) return String(s);
  return String(s).replace(/\{(\w+)\}/g, (m, k) =>
    (Object.prototype.hasOwnProperty.call(params, k) ? String(params[k]) : m));
}
