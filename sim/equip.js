//◆装備 1 点を整える・効果の表を作る（clampEquip・equipEffect） : 2.10.6参照
function clampInt(v, lo, hi) { v = Math.floor(Number(v) || 0); return v < lo ? lo : v > hi ? hi : v; }
//◆特別な武器の表の行（ELEM.SPECIALS[key]）。無ければ null（prototype の名前は通さない）
function specialOf(key) {
  if (!EL || !EL.SPECIALS || typeof key !== "string" || !Object.prototype.hasOwnProperty.call(EL.SPECIALS, key)) return null;
  const SP = EL.SPECIALS[key];
  return SP && EQUIP_KINDS[SP.base] && EQUIP_KINDS[SP.base].slot === "weapon" ? SP : null;
}
//◆装備 1 点を安全な形へ。壊れていれば null。特別な武器（kind "sp"）は表にあるときだけ有効・tier は表の値・q は 0
function clampEquip(e) {
  if (!e || typeof e !== "object") return null;
  if (e.kind === "sp") {
    const SP = specialOf(e.sp);
    if (!SP) return null;
    const o = { id: clampInt(e.id, 0, 1e9), kind: "sp", sp: e.sp, tier: clampInt(SP.tier, 0, EQUIP_TIERS - 1), lv: clampInt(e.lv, 0, LV_MAX), q: 0, lock: e.lock ? 1 : 0 };
    return withAf(o, e, "weapon");
  }
  const K = EQUIP_KINDS[e.kind];
  if (!K || e.kind === "sp") return null;
  const o = { id: clampInt(e.id, 0, 1e9), kind: e.kind, tier: clampInt(e.tier, 0, EQUIP_TIERS - 1), lv: clampInt(e.lv, 0, LV_MAX), q: clampInt(e.q, 0, 2), lock: e.lock ? 1 : 0 };
  return withAf(o, e, K.slot);
}
//◆鍛造の特性：武器と服だけ。中身は ELEM.clampAf で整える。無ければ付けない
function withAf(o, e, slot) {
  if (EL && Array.isArray(e.af) && e.af.length && (slot === "weapon" || slot === "armor")) { const af = EL.clampAf(e.af, slot, o.tier); if (af.length) o.af = af; }
  return o;
}
function equipSlotOf(e) { const K = e && EQUIP_KINDS[e.kind]; return K ? K.slot : null; }
//◆武器の行（"fire" など）。特別な武器は表の gyo。ツルハシ・服・お守り・壊れた物は null
function equipGyo(e) {
  const c = clampEquip(e);
  if (!c) return null;
  if (c.kind === "sp") return specialOf(c.sp).gyo || null;
  const K = EQUIP_KINDS[c.kind];
  return K.slot === "weapon" && K.gyo ? K.gyo : null;
}
//◆段階・強化・品質を反映した効果の表 { dmg, cdMs, hp, ... }。武器は gyo、特別な武器は sp/base と bonus（kb/crit/vampire/boomKill）も
function equipEffect(e) {
  const c = clampEquip(e);
  if (!c) return null;
  const SP = c.kind === "sp" ? specialOf(c.sp) : null;
  const K = SP ? EQUIP_KINDS[SP.base] : EQUIP_KINDS[c.kind], t = c.tier;
  const mainMul = (1 + 0.08 * c.lv) * (1 + 0.10 * c.q);
  const out = { slot: K.slot, kind: c.kind };
  const keys = {};
  for (const k in K.lo) keys[k] = 1;
  for (const k in K.hi) keys[k] = 1;
  for (const k in keys) {
    const lo = K.lo[k] !== undefined ? K.lo[k] : 0, hi = K.hi[k] !== undefined ? K.hi[k] : lo;
    let v = tierExtend(k, K, lo, hi, t);
    if (k === K.main) v *= mainMul;
    else if (k === "cdMs" || k === "digCd") v /= Math.sqrt(mainMul);   //◆連射・採掘速度は控えめに伸びる
    out[k] = v;
  }
  if (K.slot === "weapon") {
    if (out.ways === undefined) out.ways = K.ways;
    out.spread = K.spread; out.bspeed = K.bspeed; out.life = K.life; out.fl = K.fl; out.fx = K.fx; out.orb = K.orb ? 1 : 0;
    out.gyo = K.gyo || null;
  }
  if (K.splash) out.splash = K.splash;
  if (SP) {
    const B = (SP.bonus && typeof SP.bonus === "object") ? SP.bonus : {};
    out.sp = c.sp; out.base = SP.base; out.gyo = SP.gyo || null; out.tier = SP.tier;
    if (B.dmgMul > 0) out.dmg *= B.dmgMul;
    if (B.cdMul > 0) out.cdMs *= B.cdMul;
    if (B.lifeMul > 0) out.life *= B.lifeMul;
    if (B.bspeedMul > 0) out.bspeed *= B.bspeedMul;
    if (B.ways) out.ways += B.ways | 0;
    if (B.fl) out.fl |= B.fl | 0;
    if (B.kbMul > 0) out.kb = B.kbMul;
    if (B.crit) out.crit = B.crit;
    if (B.vampire) out.vampire = B.vampire;
    if (B.boomKill) out.boomKill = B.boomKill;
    if (B.orb) out.orb = 1;
  }
  if (EL && c.af && c.af.length) { out.af = c.af.slice(); out.forge = EL.forgeEff(c.af, K.slot); }   //◆鍛造の特性（playerStats がスキルと一緒に畳む）
  return out;
}
