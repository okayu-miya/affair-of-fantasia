//◆キャラの特性（Lv・値・説明。最初の 26 種とデータの 56 種） : 2.10.2参照
//◆最初の 26 種の特性ここから
//◆ふつうのキャラは 1 つ、旧作（キー 92hu_*）のキャラは 2 つ持つ（全員にもう 1 つ：CHARA_TRAITS_EXTRA → 新作 2・旧作 3）
//◆特性の Lv = 1 + floor(そのキャラの最深階 / 20)（B0 で Lv1、B20 で Lv2 …）。効果は Lv ごとに 1.5 倍、2 倍 … と伸びる（TRAIT_MAG）
//◆数値のものは playerStats で乗る。特別なものは各所で trv(stats, id)（Lv に応じた値。無ければ 0）を見る
const TRAIT_MAG = (lv) => 1 + 0.5 * (Math.max(1, lv | 0) - 1);
function traitLevel(best) { return 1 + Math.floor(Math.max(0, Math.floor(Number(best) || 0)) / 20); }
//◆特性の値（説明文も sim の効果もここから）。m = TRAIT_MAG(lv)
const TRAIT_VAL = {
  hp: (m) => Math.round(2 * m), speed: (m) => Math.round(12 * m), dmg: (m) => Math.round(15 * m), rapid: (m) => Math.round(12 * m),
  ways: (m, lv) => 1 + Math.floor((lv - 1) / 3), range: (m) => Math.round(30 * m), bspeed: (m) => Math.round(25 * m), magnet: (m) => Math.round(80 * m),
  coin: (m) => Math.round(25 * m), luck: (m) => Math.round(12 * m), iframe: (m) => Math.round(4 * m), dash: (m) => Math.min(70, Math.round(40 * m)),
  dig: (m) => Math.round(40 * m), digspeed: (m) => Math.min(75, Math.round(30 * m)), reach: (m) => Math.round(24 * m), sense: (m) => Math.round(3 * m),
  knock: (m) => Math.round(50 * m), vampire: (m) => Math.min(60, Math.round(12 * m)), bossdmg: (m) => Math.round(30 * m), orelucky: (m) => Math.min(90, Math.round(35 * m)),
  magrate: (m) => Math.round((1 + 0.5 * m) * 10) / 10, potion: (m) => Math.round(2 * m), bomb: (m) => Math.round(30 * m), chain: (m) => Math.round((1 + m) * 10) / 10,
  startitems: (m) => Math.round(m), descend: (m) => Math.round(2 * m),
};
const TRAITS = {
  hp:         { name: "頑健",       desc: (v) => "HP +" + v },
  speed:      { name: "俊足",       desc: (v) => "移動速度 +" + v + (v >= 90 ? "%（効くのは速さ 500 まで）" : "%") },   //◆500 = SPEED_MAX。元の 200 に Lv と装備を合わせて越える辺りから添える。「+546%（…合計 500）」は % と読み違えるので、能力の欄の名「速さ」で言う
  dmg:        { name: "剛力",       desc: (v) => "威力 +" + v + "%" },
  rapid:      { name: "速射",       desc: (v) => "連射 +" + v + "%" },
  ways:       { name: "分裂弾",     desc: (v) => v > 7 ? "弾数 +" + v + "（威力 -15%・効くのは 8 発まで）" : "弾数 +" + v + "（威力 -15%）" },   //◆上限（playerStats の ways ≤ 8）を越える値には上限を添える
  range:      { name: "遠射",       desc: (v) => "射程 +" + v + "%" },
  bspeed:     { name: "高速弾",     desc: (v) => "弾速 +" + v + "%" },
  magnet:     { name: "引き寄せ",   desc: (v) => "磁力 +" + v },
  coin:       { name: "商才",       desc: (v) => "コイン +" + v + "%" },
  luck:       { name: "幸運",       desc: (v) => "幸運 +" + v + (v > 90 ? "%（装備・魔石が落ちやすい。効くのは 90% まで）" : "%（装備・魔石が落ちやすい）") },
  iframe:     { name: "不屈",       desc: (v) => "被弾後の無敵 +" + v + (v > 28 ? "（効くのは合計 28 まで）" : "") },   //◆28 = IFRAME_MAX
  dash:       { name: "瞬歩",       desc: (v) => "ダッシュの間隔 -" + v + "%" },
  dig:        { name: "怪力",       desc: (v) => "採掘力 +" + v + "%" },
  digspeed:   { name: "早掘り",     desc: (v) => "採掘速度 +" + v + "%" },
  reach:      { name: "長腕",       desc: (v) => "採掘距離 +" + v + (v > 120 ? "（効くのは合計 160 まで）" : "") },   //◆160 = REACH_MAX（いちばん短い道具 40 に足して越える時だけ添える）
  sense:      { name: "鉱脈の勘",   desc: (v) => "鉱脈感知 +" + v + (v > 12 ? "（岩の中の鉱石が見える。効くのは合計 16 まで）" : "（岩の中の鉱石が見える）") },   //◆16 = SENSE_MAX（鉱脈灯の 3〜9 と合わせて越える辺りから添える）
  knock:      { name: "吹き飛ばし", desc: (v) => "ノックバック +" + v + "%" },
  vampire:    { name: "吸血",       desc: (v) => "敵を倒すと " + v + "% で HP 1 回復" },
  bossdmg:    { name: "弱点看破",   desc: (v) => "ボスへの威力 +" + v + "%" },
  orelucky:   { name: "鉱石運",     desc: (v) => "掘った鉱石が " + v + "% で 1 個増える" },
  magrate:    { name: "魔石集め",   desc: (v) => "魔石の落ちる率 ×" + v },
  potion:     { name: "薬学",       desc: (v) => "ポーションの回復 +" + v },
  bomb:       { name: "爆薬使い",   desc: (v) => "ばくだんの範囲 +" + v + "%" },
  chain:      { name: "連鎖の名手", desc: (v) => "チェインの猶予 ×" + v },
  startitems: { name: "備え",       desc: (v) => "出発時にポーションとばくだん +" + v + (v > 5 ? "（持てるのは 5 つまで）" : "") },   //◆5 = ITEMS の max
  descend:    { name: "深呼吸",     desc: (v) => "降下時の回復 +" + v },
};
//◆最初の 26 種。表に無いキャラのハッシュの割り当てはこれで固定（種類を足しても誰の特性も黙って変わらない）
const TRAIT_LIST_V09 = Object.keys(TRAITS);
//◆最初の 26 種の特性ここまで
//◆データの特性（56 種）ここから
//◆データで持つ特性。val(m, lv) = 主の値、eff(v, m, lv) = 効果（スキル・鍛造と同じ名前。playerStats が E に足して畳む）
//◆説明は ELEM.effParts(eff) から作る（訳は効果の 1 行ずつ。2 つの組み合わせは tools/lang_parts/traits.py に丸ごと）
//◆新しい効果（dodge・revive など。TRAIT_FX）は stats.X に載り、各所で見る。乱数は値が 0 より大きいときだけ引く
const tcap = (hi, v) => Math.min(hi, Math.round(v));
const TRAITS_V010 = {
  //◆新しい効果 1 つ
  evade:       { name: "見切り",       val: (m) => tcap(40, 6 * m),     eff: (v) => ({ dodge: v }) },
  lastStand:   { name: "背水の陣",     val: (m) => Math.round(30 * m),  eff: (v) => ({ lowHpDmg: v }) },
  undying:     { name: "起死回生",     val: (m) => tcap(100, 30 * m),   eff: (v) => ({ revive: v }) },
  eliteHunt:   { name: "精鋭狩り",     val: (m) => Math.round(30 * m),  eff: (v) => ({ eliteDmg: v }) },
  finisher:    { name: "とどめの一撃", val: (m) => tcap(30, 8 * m),     eff: (v) => ({ execute: v }) },
  scholar:     { name: "博識",         val: (m) => Math.round(20 * m),  eff: (v) => ({ xpPct: v }) },
  prosper:     { name: "商売繁盛",     val: (m) => Math.round(50 * m),  eff: (v) => ({ floorCoin: v }) },
  treasureDig: { name: "掘り出し物",   val: (m) => tcap(40, 8 * m),     eff: (v) => ({ digCoin: v }) },
  share:       { name: "おすそ分け",   val: (m) => Math.round(60 * m),  eff: (v) => ({ heartPct: v }) },
  appraise:    { name: "目利き",       val: (m) => Math.round(40 * m),  eff: (v) => ({ matPct: v }) },
  treasure:    { name: "宝探し",       val: (m) => tcap(90, 30 * m),    eff: (v) => ({ chestUp: v }) },
  dawn:        { name: "一番鶏",       val: (m) => Math.min(10, 2 * m), eff: (v) => ({ floorInv: v }) },
  slip:        { name: "すり抜け",     val: (m) => tcap(10, 3 * m),     eff: (v) => ({ dashInv: v }) },   //◆ダッシュの無敵は全部で 10 tick まで（連打で無敵になりきらない）
  blaster:     { name: "発破",         val: (m) => Math.round(50 * m),  eff: (v) => ({ bombDmg: v }) },
  cook:        { name: "料理上手",     val: (m) => Math.round(m),       eff: (v) => ({ heartHeal: v }) },
  growth:      { name: "伸び盛り",     val: (m) => Math.round(2 * m),   eff: (v) => ({ lvHeal: v }) },
  refine:      { name: "精錬",         val: (m) => tcap(60, 12 * m),    eff: (v) => ({ oreUp: v }) },
  firstStrike: { name: "先手必勝",     val: (m) => Math.round(40 * m),  eff: (v) => ({ freshDmg: v }) },
  brawler:     { name: "接近戦",       val: (m) => Math.round(25 * m),  eff: (v) => ({ nearDmg: v }) },
  sniper:      { name: "狙撃",         val: (m) => Math.round(25 * m),  eff: (v) => ({ farDmg: v }) },
  //◆今ある効果 1 つ
  keen:        { name: "鋭眼",         val: (m) => tcap(40, 8 * m),     eff: (v) => ({ crit: v }) },
  vitalPoint:  { name: "急所狙い",     val: (m) => Math.round(40 * m),  eff: (v, m) => ({ critMul: v, crit: tcap(20, 4 * m) }) },   //◆会心が無いと効かないので少し付ける
  renew:       { name: "自然治癒",     val: (m) => Math.round(m),       eff: (v) => ({ regen: v }) },
  spiky:       { name: "棘の身",       val: (m) => m,                   eff: (v) => ({ thorns: v }) },
  chill:       { name: "冷気",         val: (m) => tcap(60, 12 * m),    eff: (v) => ({ slowAura: v }) },
  burst:       { name: "爆裂",         val: (m) => tcap(120, 30 + 10 * m), eff: (v) => ({ boomKill: v }) },
  sturdy:      { name: "堅牢",         val: (m) => tcap(40, 8 * m),     eff: (v) => ({ armor: v }) },
  perfect:     { name: "万全",         val: (m) => Math.round(30 * m),  eff: (v) => ({ fullDmg: v }) },
  physique:    { name: "体格",         val: (m) => Math.round(12 * m),  eff: (v) => ({ hpPct: v }) },
  rhythm:      { name: "お調子者",     val: (m) => Math.round(5 * m) / 10, eff: (v) => ({ chainx: v }) },
  homing:      { name: "誘導弾",       val: (m) => Math.round(10 * m),  eff: (v) => ({ fl: BF.HOME, lifePct: v }) },
  piercing:    { name: "貫通弾",       val: (m) => Math.round(10 * m),  eff: (v) => ({ fl: BF.PIERCE, bspeedPct: v }) },
  //◆2 つの組み合わせ（1 つ目が主の値）
  fortune:     { name: "金運",         val: (m) => Math.round(15 * m),  eff: (v, m) => ({ coinPct: v, luckPct: Math.round(5 * m) }) },
  nimble:      { name: "身軽",         val: (m) => Math.round(8 * m),   eff: (v, m) => ({ speedPct: v, dashPct: tcap(50, 15 * m) }) },
  marksman:    { name: "精密射撃",     val: (m) => Math.round(15 * m),  eff: (v, m) => ({ lifePct: v, crit: tcap(30, 5 * m) }) },
  fortress:    { name: "要塞",         val: (m) => Math.round(2 * m),   eff: (v, m) => ({ hp: v, armor: tcap(30, 4 * m) }) },
  miner:       { name: "坑夫",         val: (m) => Math.round(20 * m),  eff: (v, m) => ({ digPct: v, digcdPct: -tcap(40, 10 * m) }) },
  prospector:  { name: "山師",         val: (m) => tcap(90, 20 * m),    eff: (v, m) => ({ orelucky: v, sense: Math.round(m) }) },
  collector:   { name: "収集家",       val: (m) => Math.round(50 * m),  eff: (v, m) => ({ magnet: v, luckPct: Math.round(5 * m) }) },
  medic:       { name: "救急箱",       val: (m) => Math.round(m),       eff: (v) => ({ potion: v, regen: 1 }) },
  frenzy:      { name: "乱れ撃ち",     val: (m) => tcap(40, 6 * m),     eff: (v, m) => ({ cdPct: -v, crit: tcap(30, 4 * m) }) },
  dancer:      { name: "紙一重",       val: (m) => tcap(30, 4 * m),     eff: (v, m) => ({ dodge: v, iframe: Math.round(2 * m) }) },
  ascetic:     { name: "修行",         val: (m) => Math.round(10 * m),  eff: (v, m) => ({ xpPct: v, hp: Math.round(m) }) },
  blessed:     { name: "天運",         val: (m) => Math.round(6 * m),   eff: (v, m) => ({ luckPct: v, chestUp: tcap(60, 15 * m) }) },
  miasma:      { name: "毒の霧",       val: (m) => tcap(50, 8 * m),     eff: (v, m) => ({ slowAura: v, thorns: m / 2 }) },
  guardian:    { name: "身代わり",     val: (m) => Math.round(3 * m),   eff: (v) => ({ guard: 1, iframe: v }) },
  giant:       { name: "巨体",         val: (m) => Math.round(10 * m),  eff: (v, m) => ({ hpPct: v, kbPct: Math.round(30 * m) }) },
  oniPower:    { name: "怪力乱神",     val: (m) => Math.round(10 * m),  eff: (v, m) => ({ dmgPct: v, kbPct: Math.round(40 * m) }) },
  sage:        { name: "七曜の魔法",   val: (m) => tcap(40, 6 * m),     eff: (v, m) => ({ cdPct: -v, lifePct: Math.round(12 * m) }) },
  godspeed:    { name: "神速",         val: (m) => Math.round(10 * m),  eff: (v, m) => ({ speedPct: v, cdPct: -tcap(40, 5 * m) }) },
  desperate:   { name: "捨て身",       val: (m) => Math.round(20 * m),  eff: (v, m) => ({ lowHpDmg: v, speedPct: Math.round(5 * m) }) },
  hunter:      { name: "狩人",         val: (m) => Math.round(15 * m),  eff: (v, m) => ({ eliteDmg: v, bossdmg: Math.round(15 * m) }) },
  thrift:      { name: "倹約家",       val: (m) => Math.round(25 * m),  eff: (v, m) => ({ floorCoin: v, coinPct: Math.round(8 * m) }) },
  alchemy:     { name: "錬金術",       val: (m) => tcap(40, 8 * m),     eff: (v, m) => ({ oreUp: v, orelucky: tcap(60, 10 * m) }) },
  feast:       { name: "宴会好き",     val: (m) => Math.round(m),       eff: (v, m) => ({ heartHeal: v, heartPct: Math.round(30 * m) }) },
  phantom:     { name: "幽体",         val: (m) => tcap(8, 2 * m),      eff: (v, m) => ({ dashInv: v, dashPct: tcap(20, 10 * m) }) },   //◆間隔 −20% まで：単独なら無敵 +8 が全部効く（applyInputs の「間隔 − ダッシュ 2 回分」に収まる）
};
for (const k in TRAITS_V010) TRAITS[k] = TRAITS_V010[k];
//◆データの特性（56 種）ここまで
