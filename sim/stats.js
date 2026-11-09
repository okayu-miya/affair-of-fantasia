//◆自機のステータスの合算・装備の名前と値段・階ごとの装備の段階 : 2.10.7参照
//◆自機のステータスここから
//◆stats にスキルの効果 id があればその合計、無ければ 0（trv と同じ流儀。特別な武器の crit/vampire/boomKill も足してある）
function skv(stats, id) { const sk = stats && stats.sk; return sk ? (Number(sk[id]) || 0) : 0; }
//◆特性とスキルの両方にある効果（vampire / bossdmg / potion / descend / orelucky）の合計
function pv(stats, id) { return trv(stats, id) + skv(stats, id); }
//◆loadout = { weapon, pick, armor, charm, charm2 }（equip か null）→ 自機のステータス。
//◆opts = { best: そのキャラの最深階（特性の Lv）, pendant: 想起のペンダントで引き継ぐキャラ, pendantBest: そのキャラの最深階,
//◆         lv: キャラのレベル, xp: 累計経験値, skills: 取得済みスキル { id: 1 } }
//◆同じ特性を 2 つの経路で持つときは高い方の Lv。ペンダントが今のキャラと同じなら何もしない。ペンダントは pendantTraitIds（3 つ目は本人だけ）。
//◆順序：装備 → レベルの基礎能力（ELEM.levelStats）→ 特性 → スキル。
//◆戻り値に elem（キャラの行式＋スキルの val）・guard（守りの行 or null）・wgyo（武器の行 or null）・lv・sk（スキルの効果の合計）・
//◆crit / regen / thorns / guardN（各階の最初の被弾を無効にする回数）/ slowAura / boomKill / vampire も持たせる。
function playerStats(loadout, charaKey, opts) {
  const L = (loadout && typeof loadout === "object") ? loadout : {};
  const O = (opts && typeof opts === "object") ? opts : {};
  const st = Object.assign({}, BASE);
  st.fl = 0; st.wk = 0; st.fx = EQUIP_KINDS.ofuda.fx; st.splash = 0; st.orb = 0;
  let wgyo = EQUIP_KINDS.ofuda.gyo || null, spCrit = 0, spVamp = 0, spBoom = 0;
  const forgeE = {};   //◆鍛造の特性の効果（武器と服。スキルの効果と同じ名前で足す）
  const tr = {};   //◆特性 id → Lv
  const ck = (typeof charaKey === "string" && charaKey) ? clampChara(charaKey) : null;
  if (ck) { const lv = traitLevel(O.best); for (const id of charaTraitIds(ck)) tr[id] = Math.max(tr[id] | 0, lv); }
  if (ck && typeof O.pendant === "string" && O.pendant && clampChara(O.pendant) === O.pendant && O.pendant !== ck) {
    const lv = traitLevel(O.pendantBest);
    for (const id of pendantTraitIds(O.pendant)) tr[id] = Math.max(tr[id] | 0, lv);   //◆3 つ目の表（本人だけ）は引き継がない
  }
  for (let i = 0; i < SLOTS.length; i++) {
    const s = SLOTS[i], ef = equipEffect(L[s]);
    if (!ef || ef.slot !== slotKind(s)) continue;
    if (ef.forge) for (const k in ef.forge) { if (k === "fl") forgeE.fl = (forgeE.fl | 0) | (ef.forge[k] | 0); else forgeE[k] = (forgeE[k] || 0) + ef.forge[k]; }
    if (s === "weapon") {
      st.dmg = ef.dmg; st.cdMs = ef.cdMs; st.ways = ef.ways; st.spread = ef.spread; st.bspeed = ef.bspeed; st.life = ef.life;
      st.fl = ef.fl | 0; st.wk = WEAPON_LIST.indexOf(ef.base || ef.kind); st.fx = ef.fx; st.orb = ef.orb | 0;
      wgyo = ef.gyo || null;
      if (ef.kb > 0) st.kb *= ef.kb;
      if (ef.crit) spCrit += ef.crit; if (ef.vampire) spVamp += ef.vampire; if (ef.boomKill) spBoom += ef.boomKill;
    } else if (s === "pick") {
      st.digPow = ef.digPow; st.digCd = ef.digCd; st.reach = ef.reach;
      if (ef.sense) st.sense += ef.sense;
      if (ef.splash) st.splash = ef.splash;
    } else {
      if (ef.hp) st.maxhp += ef.hp;
      if (ef.speed) st.speed += ef.speed;
      if (ef.iframe) st.iframe += ef.iframe;
      if (ef.dashCdT) st.dashCdT += ef.dashCdT;
      if (ef.magnet) st.magnet += ef.magnet;
      if (ef.coinMul) st.coinMul += ef.coinMul;
      if (ef.luck) st.luck += ef.luck;
      if (ef.sense) st.sense += ef.sense;
    }
  }
  //◆レベルの基礎能力（キャラ差なし。装備の後・特性の前。ELEM が無ければ Lv1）
  const lv = EL ? clampInt(O.lv === undefined ? 1 : O.lv, 1, LV_CAP) : 1;
  if (EL) { const LS = EL.levelStats(lv); st.maxhp += LS.hp; st.dmg *= LS.dmgMul; st.speed *= LS.speedMul; st.digPow *= LS.digMul; }
  //◆キャラの特性（数値のもの。Lv に応じた値は traitVal。特別なものは各所で trv(stats, id) を見る）
  const ids = Object.keys(tr);
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i], v = traitVal(id, tr[id]);
    switch (id) {
      case "hp": st.maxhp += v; break;
      case "speed": st.speed *= 1 + v / 100; break;
      case "dmg": st.dmg *= 1 + v / 100; break;
      case "rapid": st.cdMs /= 1 + v / 100; break;
      case "ways": st.ways += v; st.dmg *= 0.85; if (!(st.spread > 0)) st.spread = 8; break;
      case "range": st.life *= 1 + v / 100; break;
      case "bspeed": st.bspeed *= 1 + v / 100; break;
      case "magnet": st.magnet += v; break;
      case "coin": st.coinMul += v / 100; break;
      case "luck": st.luck += v / 100; break;
      case "iframe": st.iframe += v; break;
      case "dash": st.dashCdT *= 1 - v / 100; break;
      case "dig": st.digPow *= 1 + v / 100; break;
      case "digspeed": st.digCd *= 1 - v / 100; break;
      case "reach": st.reach += v; break;
      case "sense": st.sense += v; break;
      case "knock": st.kb *= 1 + v / 100; break;
      default: break;
    }
  }
  //◆スキル（ELEM.SKILLS。数値のものはここで畳む。特別なものは各所で skv(stats, id)）
  const tot = EL ? EL.skillTotals(O.skills, ck ? EL.charaElem(ck) : {}) : { eff: {}, val: {} };   //◆節の中身はキャラの木で決まる
  const E = Object.assign({}, tot.eff);
  for (const k in forgeE) { if (k === "fl") E.fl = (E.fl | 0) | (forgeE.fl | 0); else E[k] = (E[k] || 0) + forgeE[k]; }   //◆鍛造
  for (let i = 0; i < ids.length; i++) {   //◆データの特性（TRAITS_V010）。効果の名前はスキル・鍛造と同じで、ここで一緒に畳む
    const te = traitEff(ids[i], tr[ids[i]]);
    if (te) for (const k in te) { if (k === "fl") E.fl = (E.fl | 0) | (te.fl | 0); else E[k] = (E[k] || 0) + te[k]; }
  }
  const sk = Object.assign({}, E);
  if (spCrit) sk.crit = (sk.crit || 0) + spCrit;
  if (spVamp) sk.vampire = (sk.vampire || 0) + spVamp;
  if (spBoom) sk.boomKill = (sk.boomKill || 0) + spBoom;
  if (E.hp) st.maxhp += E.hp;
  if (E.hpPct) st.maxhp *= 1 + E.hpPct / 100;   //◆最大 HP +%（HP +n の後に掛ける）
  if (E.dmgPct) st.dmg *= 1 + E.dmgPct / 100;
  if (E.cdPct) st.cdMs *= 1 + Math.max(-75, E.cdPct) / 100;   //◆負で速く（木で重ねても −75% まで）
  if (E.ways) { const w0 = Math.min(8, Math.round(st.ways)); st.ways += E.ways; const w1 = Math.min(8, Math.round(st.ways)); st.dmg *= Math.pow(0.9, Math.max(0, w1 - w0)); if (!(st.spread > 0)) st.spread = 8; }   //◆上限（8）で増えない分は減らさない
  if (E.bspeedPct) st.bspeed *= 1 + E.bspeedPct / 100;
  if (E.lifePct) st.life *= 1 + E.lifePct / 100;
  if (E.speedPct) st.speed *= 1 + E.speedPct / 100;
  if (E.iframe) st.iframe += E.iframe;
  if (E.dashPct) st.dashCdT *= 1 - Math.min(75, E.dashPct) / 100;   //◆正で速く（間隔 −%。−75% まで）
  if (E.magnet) st.magnet += E.magnet;
  if (E.luckPct) st.luck += E.luckPct / 100;
  if (E.coinPct) st.coinMul += E.coinPct / 100;
  if (E.sense) st.sense += E.sense;
  if (E.digPct) st.digPow *= 1 + E.digPct / 100;
  if (E.digcdPct) st.digCd *= 1 + Math.max(-75, E.digcdPct) / 100;   //◆負で速く（−75% まで）
  if (E.reach) st.reach += E.reach;
  if (E.kbPct) st.kb *= 1 + E.kbPct / 100;
  if (E.fl) st.fl |= E.fl | 0;
  //◆行式（キャラの行式＋スキルの val）と守りの行
  const elem = EL ? EL.profileAdd(ck ? EL.charaElem(ck) : {}, tot.val) : {};
  const guard = EL ? EL.guardOf(elem) : null;
  const first = ck ? charaTraitIds(ck)[0] : "";
  //◆ダッシュの間隔は最短 2 × DASH_TICKS（瞬歩・身軽・装備・スキルを重ねても、連打で無敵になりきらない）
  const R = {
    trait: first, tr, traitLv: first ? tr[first] | 0 : 0,
    maxhp: Math.max(1, Math.round(st.maxhp)), speed: clamp(Math.round(st.speed), 80, SPEED_MAX),   //◆速さ・感知・無敵は上限
    dmg: Math.max(0.1, r2(st.dmg)), cdMs: Math.max(30, Math.round(st.cdMs)), ways: clamp(Math.round(st.ways), 1, 8),
    spread: r1(st.spread), life: Math.max(0.1, Math.round(st.life * 1000) / 1000), bspeed: Math.max(120, Math.round(st.bspeed)),
    magnet: Math.max(0, Math.round(st.magnet)), digPow: Math.max(BASE.digPow, r2(st.digPow)), digCd: Math.max(1, Math.round(st.digCd)),   //◆採掘力は素手（BASE.digPow）以上。素手は 0.5・土／石の minPow も 0.5 にして、銅のシャベル（0.7）が素手より強く、土も掘れる形にする
    reach: clamp(Math.round(st.reach), 24, REACH_MAX), sense: clamp(Math.round(st.sense), 0, SENSE_MAX), coinMul: Math.max(0.1, r2(st.coinMul)),
    dashCdT: Math.max(2 * DASH_TICKS, Math.round(st.dashCdT)), iframe: clamp(Math.round(st.iframe), 0, IFRAME_MAX), luck: r2(clamp(st.luck, 0, 0.9)), kb: r2(st.kb),
    fl: st.fl | 0, wk: st.wk < 0 ? 0 : st.wk, fx: st.fx, splash: st.splash, orb: st.orb,
    elem, guard, wgyo, lv, sk,
    crit: clamp(Math.round(sk.crit || 0), 0, 100), regen: Math.max(0, Math.round(sk.regen || 0)), thorns: Math.max(0, r2(sk.thorns || 0)),
    guardN: Math.max(0, Math.round(sk.guard || 0)), slowAura: clamp(Math.round(sk.slowAura || 0), 0, 90), boomKill: Math.max(0, Math.round(sk.boomKill || 0)),
    vampire: Math.max(0, Math.round(sk.vampire || 0)),
    critMul: Math.max(0, Math.round(sk.critMul || 0)), armor: clamp(Math.round(sk.armor || 0), 0, ARMOR_MAX), fullDmg: Math.max(0, Math.round(sk.fullDmg || 0)),   //◆会心の威力・受けるダメージ・満タン時の威力
  };
  //◆特性の新しい効果（TRAIT_FX）。0 の物は載せない（読む側は stats.X || 0）
  for (const k in TRAIT_FX) {
    const f = TRAIT_FX[k], v = Number(sk[k]) || 0;
    const r = clamp(f[2] ? Math.round(v * 10) / 10 : Math.round(v), f[0], f[1]);
    if (r > 0) R[k] = r;
  }
  return R;
}
//◆自機のステータスここまで
//◆装備の名前・行・値段ここから
function equipName(e) {
  const c = clampEquip(e);
  if (!c) return "？";
  const af = (EL && c.af && c.af.length) ? `〔${EL.forgeMarks(c.af)}〕` : "";   //◆鍛造
  if (c.kind === "sp") return specialOf(c.sp).name + (c.lv > 0 ? " +" + c.lv : "") + af;
  const md = modelOf(c.kind, c.tier);   //◆名前は型（短剣・長剣…）。種類（霊符など）は equipStatLines の「型」の行
  return TIER_NAMES[c.tier] + "の" + (md ? md.name : EQUIP_KINDS[c.kind].name) + (c.lv > 0 ? " +" + c.lv : "") + (c.q > 0 ? " " + "★".repeat(c.q) : "") + af;
}
//◆画面用のステータス行 [["威力","1.4"], ...]。武器は ["行", "火"] を先頭に、特別な武器は bonus の行も
function equipStatLines(e) {
  const ef = equipEffect(e);
  if (!ef) return [];
  const out = [];
  if (ef.kind !== "sp" && EQUIP_KINDS[ef.kind]) out.push(["種類", EQUIP_KINDS[ef.kind].name]);   //◆名前が型なので種類を別の行に
  if (ef.gyo && EL) out.push(["行", EL.GYO_JA[ef.gyo] || ef.gyo]);
  const order = ["dmg", "cdMs", "ways", "spread", "bspeed", "life", "digPow", "digCd", "reach", "sense", "hp", "speed", "iframe", "dashCdT", "magnet", "coinMul", "luck"];
  for (let i = 0; i < order.length; i++) {
    const k = order[i];
    if (ef[k] === undefined || ef[k] === 0) continue;
    let v = ef[k];
    let s;
    if (k === "cdMs") s = Math.round(v) + "ms";
    else if (k === "digCd") s = (v * TICK_DT).toFixed(2) + "s";
    else if (k === "life") s = v.toFixed(2) + "s";
    else if (k === "coinMul" || k === "luck") s = (v > 0 ? "+" : "") + Math.round(v * 100) + "%";
    else if (k === "ways") s = Math.round(v) + "";
    else s = (v > 0 && (k === "hp" || k === "speed" || k === "iframe" || k === "dashCdT" || k === "magnet" || k === "sense") ? "+" : "") + (Math.abs(v) >= 10 ? Math.round(v) : Math.round(v * 10) / 10);
    out.push([STAT_NAMES[k] || k, s]);
  }
  if (ef.fl & BF.PIERCE) out.push(["特性", "貫通"]);
  if (ef.fl & BF.HOME) out.push(["特性", "追尾"]);
  if (ef.fl & BF.BOOM) out.push(["特性", "爆発"]);
  if (ef.fl & BF.LASER) out.push(["特性", "レーザー"]);
  if (ef.fl & BF.BOUNCE) out.push(["特性", "跳弾"]);   //◆跳弾・渦巻き・弾ける輪の行
  if (ef.fl & BF.SPIRAL) out.push(["特性", "渦巻き"]);
  if (ef.fl & BF.RING) out.push(["特性", "弾ける輪"]);
  if (ef.orb) out.push(["特性", "追撃"]);
  if (ef.splash) out.push(["特性", "周囲も掘る"]);
  if (ef.kb > 0 && ef.kb !== 1) out.push(["ノックバック", "×" + (Math.round(ef.kb * 100) / 100)]);
  if (ef.crit) out.push(["会心", "+" + Math.round(ef.crit) + "%"]);
  if (ef.vampire) out.push(["吸血", "+" + Math.round(ef.vampire) + "%"]);
  if (ef.boomKill) out.push(["撃破爆発", "半径 " + Math.round(ef.boomKill)]);
  if (EL && ef.af) for (let i = 0; i < ef.af.length; i++) { const f = EL.forgeOf(ef.af[i]); if (f) out.push([`鍛造「${f.name}」`, f.desc]); }   //◆鍛造の特性の行
  //◆能力の上限（playerStats の SPEED_MAX・IFRAME_MAX・SENSE_MAX）。値が大きい装備だけ最後の行に添える（強化の見比べの行の並びを崩さないよう最後）
  if (ef.speed >= 100) out.push(["上限", "速さは 500 まで効く"]);   //◆500 = SPEED_MAX（字を + でつながない。v014_r2_E.mjs が突き合わせる）
  if (ef.iframe >= 21) out.push(["上限", "被弾後の無敵は合計 28 まで効く"]);   //◆28 = IFRAME_MAX
  if (ef.sense >= 13) out.push(["上限", "鉱脈感知は合計 16 まで効く"]);   //◆16 = SENSE_MAX
  return out;
}
//◆装備の強さの目安（並べ替え用）。特別な武器は (tier+1)*100 + 40 + lv*8
function equipScore(e) { const c = clampEquip(e); if (!c) return 0; const af = c.af ? c.af.length * 6 : 0; if (c.kind === "sp") return (c.tier + 1) * 100 + 40 + c.lv * 8 + af; return (c.tier + 1) * 100 + c.lv * 8 + c.q * 10 + af; }
function upgradeCost(e) {
  const c = clampEquip(e);
  if (!c || c.lv >= LV_MAX) return null;
  const t = c.tier, lv = c.lv;
  const magT = t <= TIER_HI ? Math.min(3, Math.floor(t / 2)) : magTierOfFloor(tierFloor(t));   //◆段階 8〜はその段階が出る階の魔石
  const out = { coins: Math.round(40 * (t + 1) * Math.pow(lv + 1, 1.4)), ore: [t, 1 + Math.floor(lv / 2)], mag: [magT, lv >= 3 ? 1 + Math.floor((lv - 3) / 3) : 0] };
  //◆素材（段階ごとの物。特別な武器はレシピの先頭の素材）。数は 1 + lv/5
  if (EL) {
    let key = UPGRADE_MATS[t];
    if (c.kind === "sp") { const SP = specialOf(c.sp); const ks = SP && SP.recipe && SP.recipe.mats ? Object.keys(SP.recipe.mats) : []; if (ks.length) key = ks[0]; }
    if (key && EL.MAT_MAP[key]) { out.mats = {}; out.mats[key] = 1 + Math.floor(lv / 5); }
    //◆段階 8 から上は村の延べ棒（その段階の物）も 1 + lv/10 本。足りない分はコインで払える（ELEM.ingotSplit）
    if (t >= EL.INGOT_FROM) out.ingot = [t, 1 + Math.floor(lv / 10)];
  }
  return out;
}
function sellPrice(e) { const c = clampEquip(e); if (!c) return 0; return Math.round(15 * (c.tier + 1) * (1 + c.lv * 0.3) * (1 + c.q * 0.5)) * (c.kind === "sp" ? 2 : 1); }
//◆装備の名前・行・値段ここまで
//◆階ごとの装備の段階ここから
//◆階 n の装備の段階の中心。B54 までは 6 階ごと（段階 0..7）、B55 からは鉱石の段階
function tierOfFloorRaw(n) { return n < ORES[TIER_HI + 1].floor ? clamp(Math.floor((n - 1) / 6), 0, TIER_HI) : clamp(oreTierOfFloor(n), TIER_HI, EQUIP_TIERS - 1); }
//◆段階 t が中心になる最初の階（tierOfFloorRaw の逆）。強化の素材・魔石の決まりに使う
function tierFloor(t) { t = clampInt(t, 0, EQUIP_TIERS - 1); return t <= TIER_HI ? 6 * t + 1 : ORES[t].floor; }
//◆装備の段階を抽選（中心 -1/+0/+1 = 15/70/15%。luck で +1 側に寄る）
function tierOfFloor(n, rndFn, luck) {
  const c = tierOfFloorRaw(n), r = rndFn ? rndFn() : 0.5, L = luck || 0;
  let t = c;
  if (r < 0.15 - L * 0.2) t = c - 1; else if (r > 0.85 - L * 0.4) t = c + 1;
  return clamp(t, 0, EQUIP_TIERS - 1);
}
function oreTierOfFloor(n) { let t = 0; for (let i = 0; i < ORES.length; i++) if (n >= ORES[i].floor) t = i; return t; }
function magTierOfFloor(n) { let t = 0; for (let i = 0; i < MAGS.length; i++) if (n >= MAGS[i].floor) t = i; return t; }
function rollEquip(rndFn, floor, luck, slotHint) {
  let kinds = EQUIP_KIND_LIST;
  if (slotHint) kinds = EQUIP_KIND_LIST.filter(k => EQUIP_KINDS[k].slot === slotHint);
  const kind = kinds[Math.floor(rndFn() * kinds.length)];
  const tier = tierOfFloor(floor, rndFn, luck);
  const qr = rndFn() + (luck || 0) * 0.3;
  const q = qr > 0.95 ? 2 : qr > 0.75 ? 1 : 0;
  return { id: 0, kind, tier, lv: 0, q };
}
//◆階ごとの装備の段階ここまで
