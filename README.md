# dnd55e-sheets

A **fully hand-fillable D&D 5.5e (2024) character sheet** addon for
[ttrpg-codex](https://github.com/pjunak/ttrpg-codex) (the *O Barvách Draků* CodexHost
framework). Addon id: `dnd55e-sheets`.

The sheet renders on every character page and stores its data per character in
`character.addonData['dnd55e-sheets']` — it does **not** own a collection.

## What it does

Each character page gets a tabbed character sheet with a **persistent header** —
identity line plus the vital stat strip (HP with live **+/-**, AC, Initiative, Speed,
Proficiency, Passive Perception) that stays visible on every tab — over these tabs:

- **Overview** — ability scores, saving throws, skills and notes (the stat block).
- **Combat** — attacks from equipped/ready weapons + defenses.
- **Spellbook** — prepared/cantrip slots, granted & choose-grant sections, extras
  (shown only when the character has spells).
- **Backpack** — inventory grouped by carry location + currency.
- **Builder** — guided progression; appears only with the rules engine **and** in
  modification mode.

**Modification mode** is the play ↔ edit toggle (the **✎ Edit** button in the header).
*View* is the default: a clean, read-only sheet — the one live-play exception is HP +/-.
*Edit* reveals the building affordances: hand-editable tiles/rows (standalone) or the
Builder tab and stat overrides (engine), plus the spell/inventory editors. Anonymous
viewers never see it. There is also a consolidated **Editor** form on the character
editor overlay for bulk entry, and a small **Settings** info panel.

Everything can be entered by hand. The only math done here is universal D&D arithmetic that
holds regardless of content — ability modifiers `⌊(score−10)/2⌋` and proficiency totals
(`mod + PB` when proficient). It has **no dependencies** and works entirely standalone.

## Designed to grow

- **Rules in harmony (later):** the sheet *soft-uses* the `dnd55e-core-rules` engine (which
  reads `dnd55e-compendium` data) to auto-fill stats from class/species/background choices
  and to turn free-text fields into dropdowns. If those addons are absent, the sheet falls
  back to manual entry — installing/uninstalling them never breaks a sheet.
- **Localization:** all UI strings flow through a vendored `i18n.js` that mirrors the host's
  localization design (English source of truth, per-locale catalogs layered on top, browser
  default, per-key English fallback). v1 ships English only; adding a language is dropping a
  `strings/<locale>.js` and one `registerCatalog` call — no rewrite.

## Develop

No build step (browser ES modules). From a sibling checkout of the host:

```sh
node scripts/dev-install-addon.cjs ../dnd_5.5e_character_sheets_addon   # from the ttrpg-codex repo
```

Run the client smoke test (assumes the host repo is a sibling directory):

```sh
node --test tests/smoke.mjs
```

See [`AGENTS.md`](AGENTS.md) for the full addon authoring contract.
