// ═══════════════════════════════════════════════════════════════
//  legends.js — the "how did we get this number?" explainers (UX-7).
//
//  For every headline stat (abilities, saves, skills, AC, initiative, speed,
//  proficiency, passive perception, spell DC/attack, HP) this builds a small
//  legend object the UI renders into a floating hover card:
//     { title, desc, formula, terms:[{label,value}], total, totalLabel }
//  `terms` are the addends that sum to the value, so the card literally shows
//  the arithmetic the engine did. Works in BOTH modes: engine-mode pulls the
//  real breakdown from the computed sheet (ability grants, winning AC base,
//  hit-dice + CON split); standalone explains the same formula over the
//  hand-entered numbers. Pure presentation — no host/DOM coupling.
//
//  `makeLegends(ctx)` binds constants + i18n; call `legends(s, comp, vm)` once
//  per render to get the per-stat builders bound to that character's data.
// ═══════════════════════════════════════════════════════════════

export function makeLegends(ctx) {
  const { t, ABILITIES, num, abilityMod, signed } = ctx;

  // Bind the builders to one character's (stored, computed, viewModel) triple.
  function legends(s, comp, vm) {
    const abilrec = (a) => comp && comp.abilities && comp.abilities[a];
    const scoreOf = (a) => { const r = abilrec(a); return r ? num(r.score, 10) : num(s.abilities[a], 10); };
    const modOf = (a) => { const r = abilrec(a); return r ? num(r.mod, abilityMod(scoreOf(a))) : abilityMod(scoreOf(a)); };
    const pb = num(vm.pb, 0);
    const totalLevel = comp ? num(comp.totalLevel, num(s.level, 1)) : num(s.level, 1);

    // ── Ability score → modifier (base + grants). ──
    function ability(a) {
      const r = abilrec(a);
      const score = scoreOf(a), mod = modOf(a);
      const base = r ? num(r.base, score) : score;
      const bonus = r ? num(r.bonus, 0) : 0;
      const terms = bonus
        ? [{ label: t('legend.base'), value: base }, { label: t('legend.bonuses'), value: signed(bonus) }, { label: t('legend.score'), value: score }]
        : [{ label: t('legend.score'), value: score }];
      return {
        title: t('ability.' + a), desc: t('abilityDesc.' + a),
        formula: t('legend.fAbility'), terms,
        total: signed(mod), totalLabel: t('legend.modifier'),
        aria: t('ability.' + a) + ' ' + signed(mod),
      };
    }

    // ── Saving throw = ability mod + proficiency (if trained). ──
    function save(a) {
      const sv = vm.save(a);
      const mod = modOf(a), prof = !!sv.prof;
      const terms = [{ label: t('legend.abilMod', { a }), value: signed(mod) }];
      terms.push(prof
        ? { label: t('legend.proficiency'), value: signed(pb) }
        : { label: t('legend.notTrained'), value: signed(0) });
      return {
        title: t('legend.saveTitle', { a: t('ability.' + a) }), desc: t('legend.saveDesc', { a: t('ability.' + a) }),
        formula: t('legend.fSave'), terms,
        total: signed(num(sv.total)), totalLabel: t('legend.saveTitleShort'),
        aria: t('legend.saveTitle', { a: t('ability.' + a) }) + ' ' + signed(num(sv.total)),
      };
    }

    // ── Skill = ability mod + proficiency (doubled with expertise). ──
    function skill(id, ab) {
      const sv = vm.skill(id, ab);
      const mod = modOf(ab), prof = !!sv.prof, exp = !!sv.exp;
      const terms = [{ label: t('legend.abilMod', { a: ab }), value: signed(mod) }];
      if (exp) terms.push({ label: t('legend.expertise'), value: signed(2 * pb) });
      else if (prof) terms.push({ label: t('legend.proficiency'), value: signed(pb) });
      else terms.push({ label: t('legend.untrained'), value: signed(0) });
      return {
        title: t('skill.' + id), desc: t('skillDesc.' + id),
        formula: exp ? t('legend.fSkillExp') : t('legend.fSkill'), terms,
        total: signed(num(sv.total)), totalLabel: t('skill.' + id),
        aria: t('skill.' + id) + ' ' + signed(num(sv.total)),
      };
    }

    // ── Armor Class — best eligible base + shield + bonuses. ──
    function ac() {
      const over = vm.overridden && vm.overridden('ac');
      if (comp && comp.ac) {
        const acc = comp.ac;
        const shield = num(acc.shield, 0);
        const baseVal = num(acc.value, vm.ac) - shield;
        const terms = [{ label: t('legend.acBase', { src: acLabel(acc.base) }), value: baseVal }];
        if (shield) terms.push({ label: t('legend.shield'), value: signed(shield) });
        if (over) terms.push({ label: t('legend.manual'), value: vm.ac });
        return {
          title: t('field.ac'), desc: t('statDesc.ac'), formula: t('legend.fAc'),
          terms, total: vm.ac, totalLabel: t('stat.ac'), aria: t('field.ac') + ' ' + vm.ac,
        };
      }
      return { title: t('field.ac'), desc: t('statDesc.ac'), formula: t('legend.fAcSimple'),
        terms: [{ label: t('stat.ac'), value: vm.ac }], total: vm.ac, totalLabel: t('stat.ac') };
    }
    function acLabel(src) {
      if (!src) return t('legend.unarmored');
      if (src === 'unarmored' || src === 'Unarmored') return t('legend.unarmored');
      if (/^ud\b|unarmored/i.test(String(src))) return t('legend.unarmoredDefense');
      return String(src);
    }

    // ── Initiative = DEX modifier (+ features like Alert). ──
    function init() {
      const dex = modOf('DEX'), val = num(vm.init);
      const terms = [{ label: t('legend.abilMod', { a: 'DEX' }), value: signed(dex) }];
      const extra = val - dex;
      if (extra) terms.push({ label: t('legend.features'), value: signed(extra) });
      return { title: t('field.initiative'), desc: t('statDesc.init'), formula: t('legend.fInit'),
        terms, total: signed(val), totalLabel: t('stat.init'), aria: t('field.initiative') + ' ' + signed(val) };
    }

    // ── Proficiency bonus — from total level. ──
    function pbLegend() {
      return { title: t('field.profBonus'), desc: t('statDesc.pb'), formula: t('legend.fPb'),
        terms: [{ label: t('legend.totalLevel'), value: totalLevel }], total: signed(pb), totalLabel: t('stat.pb') };
    }

    // ── Speed (feet per turn). ──
    function speed() {
      return { title: t('field.speed'), desc: t('statDesc.speed'), formula: t('legend.fSpeed'),
        terms: [{ label: t('field.speed'), value: t('legend.feet', { n: num(vm.speed) }) }], total: t('legend.feet', { n: num(vm.speed) }), totalLabel: t('stat.speed') };
    }

    // ── Passive Perception = 10 + Perception total. ──
    function passive() {
      const perc = vm.skill('perception', 'WIS');
      return { title: t('stat.passivePerc'), desc: t('statDesc.passive'), formula: t('legend.fPassive'),
        terms: [{ label: t('legend.base10'), value: 10 }, { label: t('skill.perception'), value: signed(num(perc.total)) }],
        total: num(vm.passivePerc), totalLabel: t('stat.passivePercAbbr') };
    }

    // ── Hit Points — hit-dice + CON per level + species/feat bonuses. ──
    function hp() {
      const b = comp && comp.hp && comp.hp.breakdown;
      const max = num(vm.maxHp);
      if (b) {
        const terms = [{ label: t('legend.hitDice'), value: num(b.dice) }];
        if (b.conMod) terms.push({ label: t('legend.conPerLevel', { mod: signed(num(b.conMod)), lvl: num(b.level) }), value: signed(num(b.conTotal)) });
        if (b.miscTotal) terms.push({ label: t('legend.hpBonus'), value: signed(num(b.miscTotal)) });
        return { title: t('field.maxHp'), desc: t('statDesc.hp'), formula: t('legend.fHp'), terms, total: max, totalLabel: t('field.maxHp') };
      }
      return { title: t('field.maxHp'), desc: t('statDesc.hp'), formula: t('legend.fHpSimple'),
        terms: [{ label: t('field.maxHp'), value: max }], total: max, totalLabel: t('field.maxHp') };
    }

    // ── Spell save DC / attack (per casting class). ──
    function spellDC(p) {
      const mod = modOf(p.ability);
      return { title: t('spell.saveDC'), desc: t('statDesc.spellDC', { a: t('ability.' + p.ability) }), formula: t('legend.fSpellDC', { a: p.ability }),
        terms: [{ label: t('legend.base8'), value: 8 }, { label: t('legend.proficiency'), value: signed(pb) }, { label: t('legend.abilMod', { a: p.ability }), value: signed(mod) }],
        total: num(p.saveDC), totalLabel: t('spell.saveDC') };
    }
    function spellAtk(p) {
      const mod = modOf(p.ability);
      return { title: t('spell.attack'), desc: t('statDesc.spellAtk'), formula: t('legend.fSpellAtk', { a: p.ability }),
        terms: [{ label: t('legend.proficiency'), value: signed(pb) }, { label: t('legend.abilMod', { a: p.ability }), value: signed(mod) }],
        total: signed(num(p.spellAttack)), totalLabel: t('spell.attack') };
    }

    return { ability, save, skill, ac, init, pb: pbLegend, speed, passive, hp, spellDC, spellAtk };
  }

  return { legends };
}
