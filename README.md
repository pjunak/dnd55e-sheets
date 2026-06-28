# dnd55e-sheets

A **fully hand-fillable D&D 5.5e (2024) character sheet** addon for
[ttrpg-codex](https://github.com/pjunak/ttrpg-codex) (the *O Barvách Draků* CodexHost
framework). Addon id: `dnd55e-sheets`.

The sheet renders on every character page and stores its data per character in
`character.addonData['dnd55e-sheets']` — it does **not** own a collection.

## What it does (M1)

- **Article section** on each character page: identity summary, ability scores with
  modifiers, combat block with live **HP +/-**, saving throws and skills with proficiency
  totals, passive perception, and Markdown notes.
- **Editor fields** on the character editor: a full decision form — identity (class,
  subclass, species, background, alignment, player, level), the six ability scores, combat
  numbers (Max/Current/Temp HP, AC, initiative, speed, proficiency bonus), save & skill
  proficiency toggles, and notes.
- **Settings tab**: a small info panel.

Everything is entered by hand. The only math done here is universal D&D arithmetic that
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
