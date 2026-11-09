//◆キャラの特性の続き（追加の 30 種・効果の上限・キャラごとの割り当て） : 2.10.2参照
//◆追加の特性（30 種）ここから
//◆作りは TRAITS_V010 と同じ。新しい効果 7 個：chainDmg（合奏）・depthDmg（地底の力）・lowHpArmor（不撓不屈）・
//◆stealCoin（手癖）・hurtBoom（倍返し）・digHeal（豊穣）・dashDmg（疾風）。残り 23 種は今ある効果の新しい組み合わせ
const TRAITS_V011 = {
  //◆新しい効果 1 つ
  //◆小数 1 桁（四捨五入で Lv1 と Lv2 が同じにならないように）。1.5・2.3・3・3.8・4.5・5（Lv6 以上で最大 +100%）
  ensemble:   { name: "合奏",       val: (m) => Math.min(5, Math.round(1.5 * m * 10) / 10), eff: (v) => ({ chainDmg: v }) },   //◆チェイン 1 つごと（CHAIN_MAX = 20 まで）
  abyss:      { name: "地底の力",   val: (m) => tcap(4, m),         eff: (v) => ({ depthDmg: v }) },   //◆10 階ごと（B300 まで 30 回）→ 最大 +120%
  tenacious:  { name: "不撓不屈",   val: (m) => tcap(40, 10 * m),   eff: (v) => ({ lowHpArmor: v }) },   //◆armor と合わせて ARMOR_MAX まで
  pilfer:     { name: "手癖",       val: (m) => tcap(30, 6 * m),    eff: (v) => ({ stealCoin: v }) },   //◆当てるたびに引き、1 体から 1 度だけ（撃破のコインの半分）
  payback:    { name: "倍返し",     val: (m) => tcap(800, 150 * m), eff: (v) => ({ hurtBoom: v }) },   //◆威力の %・半径 3 マス
  harvest:    { name: "豊穣",       val: (m) => tcap(6, 2 * m),     eff: (v) => ({ digHeal: v }) },
  gale:       { name: "疾風",       val: (m) => Math.round(25 * m), eff: (v) => ({ dashDmg: v }) },   //◆ダッシュの始めから 1 秒（DASH_DMG_TICKS）
  //◆今ある効果の組み合わせ（1 つ目が主の値）
  fusion:     { name: "核融合",     val: (m, lv) => Math.max(10, 45 - 5 * lv), eff: (v) => ({ fl: BF.BOOM, bspeedPct: -v }) },   //◆重い弾：Lv が上がるほど遅くならない（Lv1 −40% → Lv7 から −10%）
  barrier:    { name: "結界",       val: (m) => tcap(30, 5 * m),    eff: (v) => ({ guard: 1, armor: v }) },
  gap:        { name: "スキマ",     val: (m) => Math.round(40 * m), eff: (v, m) => ({ magnet: v, reach: Math.round(8 * m) }) },
  timeStop:   { name: "時間停止",   val: (m) => tcap(6, 2 * m),     eff: (v, m) => ({ dashInv: v, floorInv: Math.min(6, m) }) },   //◆ダッシュの無敵は TRAIT_FX と applyInputs の上限の中
  glutton:    { name: "大食い",     val: (m) => tcap(8, m),         eff: (v, m) => ({ heartHeal: v, hpPct: Math.round(8 * m) }) },
  drinker:    { name: "酒豪",       val: (m) => tcap(5, m),         eff: (v, m) => ({ regen: v, armor: tcap(20, 3 * m) }) },
  miracle:    { name: "奇跡",       val: (m) => tcap(60, 20 * m),   eff: (v, m) => ({ revive: v, luckPct: Math.round(4 * m) }) },
  faith:      { name: "信仰",       val: (m) => Math.round(30 * m), eff: (v, m) => ({ floorCoin: v, xpPct: Math.round(10 * m) }) },
  shikigami:  { name: "式神",       val: (m) => tcap(30, 5 * m),    eff: (v) => ({ ways: 1, cdPct: -v }) },
  thunder:    { name: "迅雷",       val: (m) => Math.round(20 * m), eff: (v, m) => ({ bspeedPct: v, crit: tcap(25, 4 * m) }) },
  lunatic:    { name: "狂気の波長", val: (m) => tcap(40, 8 * m),    eff: (v, m) => ({ slowAura: v, dodge: tcap(20, 3 * m) }) },
  fate:       { name: "運命操作",   val: (m) => tcap(30, 5 * m),    eff: (v, m) => ({ crit: v, luckPct: Math.round(5 * m) }) },
  ruin:       { name: "破壊の目",   val: (m) => tcap(25, 6 * m),    eff: (v, m) => ({ execute: v, digPct: Math.round(20 * m) }) },
  qigong:     { name: "気功",       val: (m) => tcap(5, m),         eff: (v, m) => ({ regen: v, kbPct: Math.round(30 * m) }) },
  kappaTech:  { name: "河童の発明", val: (m) => Math.round(40 * m), eff: (v, m) => ({ bombDmg: v, reach: Math.round(8 * m) }) },
  surprise:   { name: "うらめしや", val: (m) => Math.round(30 * m), eff: (v, m) => ({ freshDmg: v, slowAura: tcap(30, 5 * m) }) },
  purity:     { name: "純化",       val: (m) => Math.round(25 * m), eff: (v, m) => ({ fullDmg: v, crit: tcap(20, 3 * m) }) },
  oneRest:    { name: "一回休み",   val: (m) => tcap(50, 15 * m),   eff: (v, m) => ({ revive: v, speedPct: tcap(30, 5 * m) }) },
  greed:      { name: "強欲",       val: (m) => Math.round(15 * m), eff: (v, m) => ({ coinPct: v, matPct: Math.round(25 * m) }) },
  kamioroshi: { name: "神降ろし",   val: (m) => Math.round(8 * m),  eff: (v, m) => ({ dmgPct: v, crit: tcap(20, 3 * m) }) },
  mindRead:   { name: "読心",       val: (m) => tcap(25, 4 * m),    eff: (v, m) => ({ dodge: v, crit: tcap(20, 3 * m) }) },
  nightKin:   { name: "夜の眷属",   val: (m) => tcap(40, 8 * m),    eff: (v, m) => ({ vampire: v, speedPct: tcap(30, 5 * m) }) },   //◆付けたしの速さは +30% まで
  bookworm:   { name: "本の虫",     val: (m) => Math.round(12 * m), eff: (v, m) => ({ xpPct: v, sense: Math.round(m) }) },
};
for (const k in TRAITS_V011) TRAITS[k] = TRAITS_V011[k];
//◆追加の特性（30 種）ここまで
//◆特性の効果の上限と取り出しここから
//◆特性で増えた新しい効果 → stats に載せるときの [下限, 上限, 小数（1 = 0.1 刻み）]。0 の物は載せない（stats.X | 0 で読む）
const TRAIT_FX = { dodge: [0, 60], lowHpDmg: [0, 999], revive: [0, 100], eliteDmg: [0, 999], execute: [0, 50], xpPct: [0, 999], floorCoin: [0, 999],
  digCoin: [0, 100], heartPct: [0, 999], matPct: [0, 999], chestUp: [0, 100], floorInv: [0, 30, 1], dashInv: [0, 10], bombDmg: [0, 999],
  heartHeal: [0, 20], lvHeal: [0, 50], oreUp: [0, 100], freshDmg: [0, 999], nearDmg: [0, 999], farDmg: [0, 999],
  //◆合奏・地底の力などの新しい効果
  chainDmg: [0, 10, 1], depthDmg: [0, 10], lowHpArmor: [0, 60], stealCoin: [0, 60], hurtBoom: [0, 2000], digHeal: [0, 15], dashDmg: [0, 999] };
const DEPTH_STEP = 10, DEPTH_STEPS_MAX = 30, DASH_DMG_TICKS = 20, STEAL_COIN = 0.5;   //◆地底の力（10 階ごと・30 回まで）・疾風（1 秒）・手癖（撃破のコインの半分）
const NEAR_PX = 3 * CELL, FAR_PX = 7 * CELL;   //◆接近戦（3 マス以内）・狙撃（7 マスより遠い）
const TRAIT_LIST = Object.keys(TRAITS);
function traitVal(id, lv) { const T = TRAITS[id], f = (T && T.val) || TRAIT_VAL[id]; lv = Math.max(1, lv | 0); return f ? f(TRAIT_MAG(lv), lv) : 0; }
//◆データの特性の効果 { dmgPct: 10, ... }。最初の 26 種は null
function traitEff(id, lv) { const T = TRAITS[id]; if (!T || !T.eff) return null; lv = Math.max(1, lv | 0); return T.eff(traitVal(id, lv), TRAIT_MAG(lv), lv); }
function traitDesc(id, lv) { const T = TRAITS[id]; if (!T) return ""; if (T.desc) return T.desc(traitVal(id, lv)); return EL ? EL.effParts(traitEff(id, lv)).join("・") : ""; }
//◆stats に特性 id があればその Lv での値、無ければ 0
function trv(stats, id) { const lv = stats && stats.tr ? (stats.tr[id] | 0) : 0; return lv > 0 ? traitVal(id, lv) : 0; }
//◆特性の効果の上限と取り出しここまで
//◆キャラごとの特性の割り当てここから
//◆旧作（PC-98）のキャラ。特性を 2 つ持つ
const OLD_RE = /^92hu_/;
const CHARA_TRAITS2 = {
  "92hu_yuka_old": "hp", "92hu_rika": "bomb", "92hu_mai": "magnet", "92hu_elly": "iframe", "92hu_elis": "luck", "92hu_rei_mima": "range",
  "92hu_yuugenmagan": "ways", "92hu_kotohime": "startitems", "92hu_yumeko": "dash", "92hu_chiyuri": "digspeed", "92hu_rikako": "reach", "92hu_ellen": "descend",
  "92hu_huma_mima": "bossdmg", "92hu_marisa": "magrate", "92hu_luize": "coin", "92hu_whiteMarisa_w": "rapid", "92hu_shinki": "hp", "92hu_noroiko": "chain", "92hu_huma_mima_ee": "dmg",
  //◆旧作（2 つ目の続き）
  "92hu_gengetu": "keen", "92hu_greenReimu": "homing", "92hu_konngara": "sturdy", "92hu_sariel": "burst", "92hu_meira": "keen", "92hu_lolice": "rhythm",
  "92hu_kurumi": "vampire", "92hu_singyoku_n": "guardian", "92hu_yuki": "blaster", "92hu_singyoku_p": "knock", "92hu_kana": "feast", "92hu_rei_reimu": "blessed",
  "92hu_kikuri": "physique", "92hu_ayana": "share", "92hu_okazaki": "alchemy", "92hu_rika_ex": "fortress", "92hu_lolice_ex": "fortune", "92hu_matenshi": "evade",
  "92hu_ru-koto": "refine", "92hu_makomo": "cook", "92hu_yuka_ee": "spiky", "92hu_mugetu": "cook", "92hu_sara": "eliteHunt", "92hu_huma_marisa": "treasure",
};
//◆手で決めた分（全員。無いキャラは名前のハッシュで TRAIT_LIST_V09 から選ぶ）
const CHARA_TRAITS = {
  "2hu_reimu": "luck", "2hu_marisa": "dmg", "p_sakuya": "rapid", "p_youmu": "dash", "p_sanae": "magrate", "p_cirno": "hp", "p_alice": "ways",
  "p_remilia": "vampire", "p_flandre": "bossdmg", "p_patchouli": "range", "p_nitori": "dig", "p_yukari": "reach", "p_meirin": "iframe", "p_eirin": "potion",
  "p_tewi": "luck", "p_yuka": "knock", "th075_suika": "dmg", "th080_mokou": "iframe", "th080_kaguya_5q": "descend", "th080_reisen": "bspeed", "th070_yuyuko": "magrate",
  "th070_ran": "rapid", "p_chen": "speed", "th060_rumia": "sense", "p_letty": "hp", "p_wriggle": "ways", "p_mystia": "speed", "p_keine": "iframe",
  "th090_komachi": "reach", "th090_eiki": "bossdmg", "th095_aya": "speed", "p_momizi": "iframe", "th100_hina": "luck", "th100_kanako": "dmg", "th100_suwako": "dig",
  "p_satori": "sense", "th110_koishi": "dash", "th110_rin": "coin", "th110_utsuho": "bomb", "th110_parsee": "magrate", "th110_yamame": "orelucky", "th110_kisume": "digspeed",
  "th120_byakuren": "rapid", "p_nue": "ways", "p_shou": "coin", "p_nazrin": "orelucky", "p_murasa": "knock", "th120_ichirin": "dmg", "th120_kogasa_0": "startitems",
  "th130_mamizou": "coin", "p_miko_1": "rapid", "p_futo": "bomb", "th130_toziko": "bspeed", "th130_seiga": "reach", "th130_yoshika": "hp", "th135_kokoro": "chain",
  "th140_seija": "luck", "p_shinmyoumaru": "dig", "th140_sekibanki": "range", "th140_wakasagi-hime": "magnet", "p_kagerou": "speed", "p_benben": "chain", "p_yatsuhashi": "chain",
  "p_raiko": "rapid", "p_sumireko": "sense", "th150_junko_1": "dmg", "p_hecatia": "hp", "p_clownpiece": "bomb", "p_doremy": "descend", "p_sagume": "luck",
  "p_seiran": "bspeed", "p_ringo": "potion", "p_eternity-larva_1": "speed", "p_nemuno": "dig", "p_aun": "iframe", "p_narumi": "descend", "p_okina_r": "reach", "p_okina_ex": "reach",
  "p_tenshi": "iframe", "p_iku": "bspeed", "th175_yuma": "vampire", "th180_chimata": "coin", "th155_shion": "orelucky", "th155_joon": "coin", "p_kasen_3": "knock",
  "p_kyouko": "range", "th170_keiki": "dig", "th170_mayumi_2": "hp", "th170_yachie_1": "bossdmg", "th170_saki": "speed", "th170_urumi": "magnet", "th170_eika": "chain",
  "th180_momoyo_1": "orelucky", "th180_takane": "dig", "th180_misumaru": "sense", "th180_tsukasa_2": "luck", "th180_megumu": "rapid", "th180_mike": "coin",
  "th190_zanmu": "bossdmg", "th190_hisami": "dash", "th190_chiyari": "vampire", "th190_biten": "speed", "th190_enoko": "ways",
  "th_kourindou_rinnosuke": "orelucky", "th_suzunaan_kosuzu": "chain", "th_yougaku_akyuu": "sense", "p_lunachild": "magnet", "p_sunnymilk": "range", "p_starsapphire": "sense",
  "th070_lilywhite": "descend", "th090_lilyblack": "descend", "th070_lunasa": "chain", "th070_merlin": "chain", "th070_lyrica": "chain", "th090_medicine": "potion",
  "th100_minoriko": "coin", "th100_shizuha": "coin", "th125_hatate": "speed", "th100_aya": "speed", "th080_marisa": "dmg", "th080_reimu": "luck", "92hu_marisa": "dmg",
  //◆旧作（1 つ目。2 つ目は CHARA_TRAITS2）
  "92hu_yuka_old": "knock", "92hu_rika": "dig", "92hu_mai": "bspeed", "92hu_elly": "range", "92hu_elis": "vampire", "92hu_rei_mima": "dmg",
  "92hu_yuugenmagan": "sense", "92hu_kotohime": "coin", "92hu_yumeko": "rapid", "92hu_chiyuri": "speed", "92hu_rikako": "sense", "92hu_ellen": "potion",
  "92hu_huma_mima": "dmg", "92hu_luize": "magnet", "92hu_whiteMarisa_w": "luck", "92hu_shinki": "ways", "92hu_noroiko": "orelucky", "92hu_huma_mima_ee": "bossdmg",
  //◆83 体の分（足した特性を人柄・能力に合わせて配る。上の 140 体は変えない）
  "th135_byakuren": "physique", "th200_ariya": "fortress", "th_kourindou_tokiko": "scholar", "th_suityouka_miyoi": "prosper", "th170_niwatari": "dawn", "thbook_ibarakasen_kasen": "renew",
  "thb_chireikiden_mizuchi": "hunter", "th_bougetsushou_toyohime": "blaster", "thb_sangetsusei_cirno_s": "chill", "th_hourai_shintou": "guardian", "p_satsuki_1": "share", "th180_komakusa": "prospector",
  "th200_yuiman": "sniper", "th2nd_sugarsatella": "rhythm", "th175_yugi": "oniPower", "th200_ubame": "appraise", "th200_nareko": "nimble", "thb_chireikiden_mizuchi_miko": "homing",
  "p_maribel": "treasure", "p_patchouli_ex": "sage", "thbook_ibarakasen_kasen_b": "medic", "th105_reisen": "sniper", "th200_chimi": "treasureDig", "thb_chireikiden_onryo_reimu": "desperate",
  "th075_aka-marisa": "burst", "p_teireida": "growth", "th060_greater-fairy_d": "phantom", "th060_greater-fairy": "slip", "th_hourai_hangon": "undying", "p_shanhai": "piercing",
  "th123_goriath-doll": "giant", "th_hourai_label-girl": "fortune", "p_little_devil": "collector", "th200_toyohime": "blessed", "p_hourai-doll": "undying", "p_renko": "marksman",
  "th200_nina": "keen", "th_bougetsushou_reisen_2nd": "evade", "th135_ichirin": "firstStrike", "thb_chireikiden_seidai-no-miko": "share", "th090_medicine_2p": "miasma", "p_nishida": "growth",
  "th080_keine-ex": "vitalPoint", "th_bougetsushou_yorihime": "eliteHunt", "th145_byakuren_turbo": "godspeed", "th075_yukari": "slip", "th2nd_layla_4th": "rhythm", "th_hourai_hakusan-shugen": "ascetic",
  "th175_joon": "fortune", "th175_shion": "lastStand", "p_oka-misty": "cook", "p_ao-reimu": "homing", "thvar_kanata_maga-reimu": "perfect", "th175_flandre": "finisher",
  "p_yugi_1": "brawler", "th080_yukari_lw": "dancer", "th175_murasa": "sturdy", "thb_chireikiden_chen": "nimble", "th_hourai_jacket-girl": "thrift",
  //◆同じく旧作（1 つ目。2 つ目は CHARA_TRAITS2）
  "92hu_gengetu": "frenzy", "92hu_greenReimu": "evade", "92hu_konngara": "vitalPoint", "92hu_sariel": "finisher", "92hu_meira": "firstStrike", "92hu_lolice": "collector",
  "92hu_kurumi": "desperate", "92hu_singyoku_n": "ascetic", "92hu_yuki": "burst", "92hu_singyoku_p": "fortress", "92hu_kana": "phantom", "92hu_rei_reimu": "homing",
  "92hu_kikuri": "spiky", "92hu_ayana": "nimble", "92hu_okazaki": "scholar", "92hu_rika_ex": "blaster", "92hu_lolice_ex": "keen", "92hu_matenshi": "vitalPoint",
  "92hu_ru-koto": "miner", "92hu_makomo": "growth", "92hu_yuka_ee": "perfect", "92hu_mugetu": "dancer", "92hu_sara": "dawn", "92hu_huma_marisa": "godspeed",
};
//◆全員にもう 1 つ（新作 2 つ・旧作 3 つ目）。人柄・能力に合わせて手で決めた（今の 1 つ目・2 つ目とは別の物。112 種すべてが誰かに付く）
//◆想起のペンダントはこれを引き継がない（pendantTraitIds）：その人を使った時だけの「素の個性」
const CHARA_TRAITS_EXTRA = {
  //◆紅魔郷〜永夜抄の顔ぶれ
  "2hu_reimu": "sense", "2hu_marisa": "pilfer", "p_sakuya": "timeStop", "p_youmu": "gale", "p_sanae": "miracle", "p_cirno": "chill", "p_alice": "guardian",   //◆霊夢の勘・借りていくぜ・時を止める・上海人形が身代わり
  "p_remilia": "fate", "p_flandre": "ruin", "p_patchouli": "bookworm", "p_nitori": "kappaTech", "p_yukari": "gap", "p_meirin": "qigong", "p_eirin": "scholar",
  "p_tewi": "pilfer", "p_yuka": "oniPower", "th075_suika": "drinker", "th080_mokou": "undying", "th080_kaguya_5q": "timeStop", "th080_reisen": "lunatic", "th070_yuyuko": "glutton",
  "th070_ran": "shikigami", "p_chen": "shikigami", "th060_rumia": "nightKin", "p_letty": "chill", "p_wriggle": "miasma", "p_mystia": "ensemble", "p_keine": "guardian",
  "th090_komachi": "renew", "th090_eiki": "finisher", "th095_aya": "gale", "p_momizi": "sniper", "th100_hina": "spiky", "th100_kanako": "faith", "th100_suwako": "harvest",
  //◆地霊殿〜
  "p_satori": "mindRead", "th110_koishi": "surprise", "th110_rin": "abyss", "th110_utsuho": "fusion", "th110_parsee": "hunter", "th110_yamame": "miasma", "th110_kisume": "surprise",
  "th120_byakuren": "ascetic", "p_nue": "lunatic", "p_shou": "treasure", "p_nazrin": "treasure", "p_murasa": "abyss", "th120_ichirin": "giant", "th120_kogasa_0": "surprise",
  "th130_mamizou": "thrift", "p_miko_1": "mindRead", "p_futo": "blaster", "th130_toziko": "thunder", "th130_seiga": "slip", "th130_yoshika": "undying", "th135_kokoro": "dancer",
  "th140_seija": "payback", "p_shinmyoumaru": "giant", "th140_sekibanki": "shikigami", "th140_wakasagi-hime": "renew", "p_kagerou": "nightKin", "p_benben": "ensemble", "p_yatsuhashi": "ensemble",
  "p_raiko": "thunder", "p_sumireko": "homing", "th150_junko_1": "purity", "p_hecatia": "undying", "p_clownpiece": "lunatic", "p_doremy": "glutton", "p_sagume": "fate",
  "p_seiran": "frenzy", "p_ringo": "cook", "p_eternity-larva_1": "oneRest", "p_nemuno": "harvest", "p_aun": "barrier", "p_narumi": "sturdy", "p_okina_r": "blessed", "p_okina_ex": "faith",
  "p_tenshi": "payback", "p_iku": "thunder", "th175_yuma": "glutton", "th180_chimata": "appraise", "th155_shion": "tenacious", "th155_joon": "greed", "p_kasen_3": "oniPower",
  "p_kyouko": "ensemble", "th170_keiki": "shikigami", "th170_mayumi_2": "sturdy", "th170_yachie_1": "hunter", "th170_saki": "gale", "th170_urumi": "oniPower", "th170_eika": "tenacious",
  "th180_momoyo_1": "miner", "th180_takane": "greed", "th180_misumaru": "refine", "th180_tsukasa_2": "pilfer", "th180_megumu": "gale", "th180_mike": "fortune",
  "th190_zanmu": "abyss", "th190_hisami": "firstStrike", "th190_chiyari": "abyss", "th190_biten": "brawler", "th190_enoko": "eliteHunt",
  "th_kourindou_rinnosuke": "appraise", "th_suzunaan_kosuzu": "bookworm", "th_yougaku_akyuu": "scholar", "p_lunachild": "surprise", "p_sunnymilk": "evade", "p_starsapphire": "oneRest",
  "th070_lilywhite": "dawn", "th090_lilyblack": "oneRest", "th070_lunasa": "ensemble", "th070_merlin": "ensemble", "th070_lyrica": "ensemble", "th090_medicine": "miasma",
  "th100_minoriko": "harvest", "th100_shizuha": "evade", "th125_hatate": "sniper", "th100_aya": "gale", "th080_marisa": "collector", "th080_reimu": "barrier",
  //◆手で決めた 83 体
  "th135_byakuren": "brawler", "th200_ariya": "undying", "th_kourindou_tokiko": "bookworm", "th_suityouka_miyoi": "drinker", "th170_niwatari": "barrier", "thbook_ibarakasen_kasen": "ascetic",
  "thb_chireikiden_mizuchi": "abyss", "th_bougetsushou_toyohime": "gap", "thb_sangetsusei_cirno_s": "oneRest", "th_hourai_shintou": "faith", "p_satsuki_1": "ensemble", "th180_komakusa": "miasma",
  "th200_yuiman": "thunder", "th2nd_sugarsatella": "oneRest", "th175_yugi": "drinker", "th200_ubame": "greed", "th200_nareko": "gale", "thb_chireikiden_mizuchi_miko": "barrier",
  "p_maribel": "gap", "p_patchouli_ex": "scholar", "thbook_ibarakasen_kasen_b": "qigong", "th105_reisen": "lunatic", "th200_chimi": "harvest", "thb_chireikiden_onryo_reimu": "payback",
  "th075_aka-marisa": "blaster", "p_teireida": "dancer", "th060_greater-fairy_d": "oneRest", "th060_greater-fairy": "oneRest", "th_hourai_hangon": "renew", "p_shanhai": "guardian",
  "th123_goriath-doll": "sturdy", "th_hourai_label-girl": "share", "p_little_devil": "bookworm", "th200_toyohime": "gap", "p_hourai-doll": "piercing", "p_renko": "scholar",
  "th200_nina": "firstStrike", "th_bougetsushou_reisen_2nd": "marksman", "th135_ichirin": "oniPower", "thb_chireikiden_seidai-no-miko": "barrier", "th090_medicine_2p": "spiky", "p_nishida": "rhythm",
  "th080_keine-ex": "scholar", "th_bougetsushou_yorihime": "kamioroshi", "th145_byakuren_turbo": "gale", "th075_yukari": "gap", "th2nd_layla_4th": "ensemble", "th_hourai_hakusan-shugen": "faith",
  "th175_joon": "greed", "th175_shion": "tenacious", "p_oka-misty": "thrift", "p_ao-reimu": "faith", "thvar_kanata_maga-reimu": "ruin", "th175_flandre": "ruin",
  "p_yugi_1": "drinker", "th080_yukari_lw": "barrier", "th175_murasa": "miner", "thb_chireikiden_chen": "shikigami", "th_hourai_jacket-girl": "collector",
  //◆旧作（3 つ目）
  "92hu_yuka_old": "perfect", "92hu_rika": "kappaTech", "92hu_mai": "chill", "92hu_elly": "finisher", "92hu_elis": "nightKin", "92hu_rei_mima": "payback",
  "92hu_yuugenmagan": "marksman", "92hu_kotohime": "collector", "92hu_yumeko": "keen", "92hu_chiyuri": "kappaTech", "92hu_rikako": "bookworm", "92hu_ellen": "fortune",
  "92hu_huma_mima": "phantom", "92hu_marisa": "nimble", "92hu_luize": "appraise", "92hu_whiteMarisa_w": "thunder", "92hu_shinki": "faith", "92hu_noroiko": "spiky", "92hu_huma_mima_ee": "sage",
  "92hu_gengetu": "purity", "92hu_greenReimu": "barrier", "92hu_konngara": "abyss", "92hu_sariel": "ruin", "92hu_meira": "brawler", "92hu_lolice": "blessed",
  "92hu_kurumi": "nightKin", "92hu_singyoku_n": "faith", "92hu_yuki": "fusion", "92hu_singyoku_p": "giant", "92hu_kana": "surprise", "92hu_rei_reimu": "sense",
  "92hu_kikuri": "abyss", "92hu_ayana": "feast", "92hu_okazaki": "sage", "92hu_rika_ex": "fusion", "92hu_lolice_ex": "treasure", "92hu_matenshi": "payback",
  "92hu_ru-koto": "sturdy", "92hu_makomo": "harvest", "92hu_yuka_ee": "oniPower", "92hu_mugetu": "lunatic", "92hu_sara": "guardian", "92hu_huma_marisa": "pilfer",
};
function strHash(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
//◆キャラの特性の id の一覧（新作 2 つ・旧作 3 つ。同じ物は選ばない）。知らないキャラは先頭キャラの扱い。
//◆最後の 1 つが CHARA_TRAITS_EXTRA（本人だけ。ペンダントは pendantTraitIds）
function charaTraitIds(key) {
  const k = clampChara(key);
  const ids = pendantTraitIds(k);
  let id3 = CHARA_TRAITS_EXTRA[k];
  if (!id3 || !TRAITS[id3] || ids.indexOf(id3) >= 0) {   //◆控え（今は全員が表にある。test が見張る）：ハッシュで最初の 26 種から、重なれば次
    const L = TRAIT_LIST_V09;
    let i = hash32(strHash(k), 13, 17) % L.length;
    while (ids.indexOf(L[i]) >= 0) i = (i + 1) % L.length;
    id3 = L[i];
  }
  ids.push(id3);
  return ids;
}
//◆最初の 2 つまでの特性の id（ふつう 1 つ、旧作は 2 つ）。想起のペンダントはこれだけを引き継ぐ
function pendantTraitIds(key) {
  const k = clampChara(key);
  const L = TRAIT_LIST_V09;   //◆控えのハッシュは最初の 26 種で固定（今は全員が表にある。test が見張る）
  let id = CHARA_TRAITS[k];
  if (!id || !TRAITS[id]) id = L[hash32(strHash(k), 5, 9) % L.length];
  const ids = [id];
  if (OLD_RE.test(k)) {
    let id2 = CHARA_TRAITS2[k];
    if (!id2 || !TRAITS[id2]) id2 = L[hash32(strHash(k), 7, 11) % L.length];
    if (id2 === id) id2 = L[(Math.max(0, L.indexOf(id)) + 1) % L.length];
    ids.push(id2);
  }
  return ids;
}
//◆キャラの特性の一覧 [{ id, name, lv, desc, own }]。best はそのキャラの最深階（特性の Lv を決める）。own = 1 はペンダントで引き継がない物
function charaTraits(key, best) { const lv = traitLevel(best), ids = charaTraitIds(key); return ids.map((id, i) => ({ id, name: TRAITS[id].name, lv, desc: traitDesc(id, lv), own: i === ids.length - 1 ? 1 : 0 })); }
//◆互換：1 つ目の特性 { id, name, desc }（Lv1 の説明）
function charaTrait(key) { const t = charaTraits(key, 0)[0]; return { id: t.id, name: t.name, desc: t.desc }; }
//◆セーブからキャラの最深階（そのキャラで到達した階。特性の Lv の元）
function charaBest(save, key) { const cb = save && save.charBest; return cb && typeof cb === "object" ? Math.max(0, cb[key] | 0) : 0; }

//◆キャラごとの特性の割り当てここまで
