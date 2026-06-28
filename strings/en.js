// English UI strings for dnd55e-sheets — the source of truth.
//
// Flat key → string catalog, mirroring the host's /i18n/en.json shape. English
// is always present and is the universal fallback; other locales layer on top
// (drop a strings/<locale>.js and registerCatalog it in entry.js — no other
// change). {placeholders} are interpolated by i18n.t(). Keep this file English
// only; translations never live here.

export default {
  // ── Section headers ──────────────────────────────────────────────
  'sheet.title':      'Character Sheet',
  'sheet.identity':   'Identity',
  'sheet.abilities':  'Ability Scores',
  'sheet.combat':     'Combat',
  'sheet.saves':      'Saving Throws',
  'sheet.skills':     'Skills',
  'sheet.notes':      'Notes',
  'sheet.summary':    'Level {level} {cls}',

  // ── Identity fields ──────────────────────────────────────────────
  'field.player':     'Player',
  'field.class':      'Class',
  'field.subclass':   'Subclass',
  'field.race':       'Species',
  'field.background': 'Background',
  'field.alignment':  'Alignment',
  'field.level':      'Level',

  // ── Combat fields ────────────────────────────────────────────────
  'field.maxHp':      'Max HP',
  'field.hp':         'Current HP',
  'field.tempHp':     'Temp HP',
  'field.ac':         'Armor Class',
  'field.initiative': 'Initiative',
  'field.speed':      'Speed',
  'field.profBonus':  'Proficiency Bonus',
  'field.notes':      'Notes (Markdown)',

  // ── Compact stat labels (read view) ──────────────────────────────
  'stat.hp':          'HP',
  'stat.ac':          'AC',
  'stat.init':        'Init',
  'stat.speed':       'Speed',
  'stat.pb':          'PB',
  'stat.passivePerc': 'Passive Perception',

  // ── Ability full names (abbreviations STR/DEX/… are universal) ────
  'ability.STR':      'Strength',
  'ability.DEX':      'Dexterity',
  'ability.CON':      'Constitution',
  'ability.INT':      'Intelligence',
  'ability.WIS':      'Wisdom',
  'ability.CHA':      'Charisma',

  // ── Skills ───────────────────────────────────────────────────────
  'skill.acrobatics':     'Acrobatics',
  'skill.animalHandling': 'Animal Handling',
  'skill.arcana':         'Arcana',
  'skill.athletics':      'Athletics',
  'skill.deception':      'Deception',
  'skill.history':        'History',
  'skill.insight':        'Insight',
  'skill.intimidation':   'Intimidation',
  'skill.investigation':  'Investigation',
  'skill.medicine':       'Medicine',
  'skill.nature':         'Nature',
  'skill.perception':     'Perception',
  'skill.performance':    'Performance',
  'skill.persuasion':     'Persuasion',
  'skill.religion':       'Religion',
  'skill.sleightOfHand':  'Sleight of Hand',
  'skill.stealth':        'Stealth',
  'skill.survival':       'Survival',

  // ── Actions / misc ───────────────────────────────────────────────
  'action.hpMinus':   'Lose 1 HP',
  'action.hpPlus':    'Heal 1 HP',
  'misc.notSet':      '—',
  'misc.unnamed':     '(unnamed)',
  'misc.proficient':  'Proficient',

  // ── Settings / help ──────────────────────────────────────────────
  'settings.label':   'Character Sheets',
  'help.title':       'D&D 5.5e Character Sheets',
  'help.body':        'Adds a fully hand-fillable D&D 5.5e character sheet to every character page, stored per character. Works standalone; when the rules engine and compendium addons are installed it can auto-fill stats from class/species/background choices. Characters in the database: {count}.',
};
