//◆定数と表（時間・大きさ・敵・弾・岩・鉱石・装備・アイテム） : 2.10.1参照
//◆基本の定数ここから
const VER = "0.7";
//◆elem.js（無ければ null）。行式・レベル・スキル・素材・特別な武器はここを通す
const EL = (ELEM && typeof ELEM === "object" && Array.isArray(ELEM.GYO)) ? ELEM : null;
const LV_CAP = EL ? EL.LV_CAP : 60;
const REGEN_EVERY = 600;   //◆regen スキル：600 tick（30 秒）ごと
const ITEM_MAGNET_DELAY = 20;   //◆落ちてから磁力で吸われるまで（触れれば拾える）
const SLOW_AURA_R = 160;   //◆slowAura スキルの半径
const CHAMP_RING_EVERY = 100;   //◆覇者（rank 3）の輪の周期
const RANK_MUL = [ { hp: 1, r: 1, speed: 1, coin: 1 }, { hp: 1.6, r: 1, speed: 1.05, coin: 1.5 }, { hp: 3, r: 1.35, speed: 0.9, coin: 3 }, { hp: 5, r: 1.5, speed: 1, coin: 6 } ];
const CHAMP_FROM = 25, CHAMP_RATE = 0.04;   //◆覇者（rank 3）：B25 以上で 4%
const VET_FROM = 8, VET_RATE = 0.15;   //◆古参（rank 1）：B8 以上で 15%（精鋭は ELITE_FROM / eliteRate）
const CRIT_MUL = 1.5;   //◆会心の威力（critMul スキルで +%）
const ARMOR_MAX = 60;   //◆armor スキル（受けるダメージ −%）の上限
const HAMMER_CORNER = 0.5;   //◆ハンマーの四隅は十字の半分（splash × 0.5）
//◆行の名前 → 添字（弾の eg）。ELEM が無ければ -1
function gyoIdx(g) { return EL && typeof g === "string" ? EL.GYO.indexOf(g) : -1; }
function gyoOf(i) { return EL && i >= 0 && i < EL.GYO.length ? EL.GYO[i] : null; }
const TICK_MS = 50, TICK_DT = 0.05, CELL = 32;
const PLAYER_R = 12, BULLET_R = 5, EBULLET_R = 6, ITEM_R = 8, HATCH_R = 40;
const FLOW_EVERY = 10, MAX_EBULLETS = 80, MAX_BULLETS = 280;
const HURT_INVULN_TICKS = 12, CONTACT_CD_TICKS = 14, FLOOR_INVULN_TICKS = 40;
const DASH_TICKS = 4, DASH_CD_TICKS = 20, DASH_SPEED = 560;
const BUCKET_FROM = 100, TUNNEL_N = 5;   //◆実績「バケットホイールエクスカベーター」は 100 階以降・「量子トンネル効果」は一度のダッシュで 5 体
const CHAIN_TICKS = 30, CHAIN_MAX = 20, CHAIN_STEP = 0.05;
const ITEM_LIFE_TICKS = 600, MAGNET_SPEED = 600, HEART_DROP = 0.10;
const KB_IMPULSE = 60, KB_DECAY = 8, SHIELD_THROUGH = 0.25, ELITE_FROM = 11, ELITE_RATE = 0.10;
const FIRST_WAVE_TICKS = 60, TELEGRAPH_TICKS = 14, WAVE_TIMEOUT_TICKS = 400, WAVE_NEXT_ALIVE = 3;
const EBULLET_LIFE_TICKS = 80, EBULLET_MIN_SPEED = 130, EBULLET_MAX_SPEED = 260;
const STUCK_TICKS = 2400, OVER_FREEZE_TICKS = 30, TRANSIT_TICKS = 24, HATCH_COUNT_TICKS = 40;
const BOMB_R = 200, BOMB_DMG = 6, BOMB_CLEAR_R = 260, BOMB_DIG_R = 2.5;
const BIOME_FLOORS = 5, CYCLE_BIOMES = 24, BOSS_HP_MUL = 9, BOSS_R_MUL = 1.35, BOSS_COIN_MUL = 14;
const FINAL_FLOOR = 501, EXTRA_FLOOR = 1000;   //◆決戦（紫の弾幕戦）と 1000 階（紫が祝いに来る）。opts.fin がある時だけ : 2.10.10参照
const INV_MAX = 1e9, EQUIP_TIERS = 32, ORE_COUNT = 32, MAG_COUNT = 8, LV_MAX = 30;   //◆500 階ぶんの段階・鉱石・魔石
const TIER_HI = 7;   //◆装備の lo→hi は段階 0..TIER_HI（B45 まで）。その先は tierGrow で伸ばす
const POS_MAX_SPEED = 700;
const MAT_DROP_RATE = 0.14, EQUIP_DROP_RATE = 0.03, EQUIP_DROP_ELITE = 0.12;
const DIGGER_BUDGET = 14, DIGGER_EVERY = 20, DIGGER_POW = 3;
//◆石積み（mason）：届かない・遠回りなら掘って迫り、飛んで来る自弾の手前に土を置いて防ぐ（置いた土は PLACED_LIFE で床へ戻る）
const MASON_DIG_BUDGET = 10, MASON_PLACE_BUDGET = 6, MASON_PLACE_CD = 30, MASON_LOOK = 8, MASON_REACH = 2.5, MASON_BUILD_SHOW = 8;
const PLACED_LIFE = 400, PLACED_MAX = 24, MASON_DEEP_FROM = 16, MASON_DEEP_RATE = 0.012;
//◆戦い方（style）：種ではなく、どの敵にも付く「岩の扱い方」。1 = 掘る（掘り屋）・2 = 置く（積み屋）・3 = 両方（石工。上位互換）
//◆添字 = style。3 は石積みゴブリン（いつも 3）と同じ値で、1・2 より予算が多く・置く間隔が短い
const STYLE_DIG = [0, 8, 0, MASON_DIG_BUDGET], STYLE_PLACE = [0, 0, 4, MASON_PLACE_BUDGET], STYLE_CD = [0, 0, 40, MASON_PLACE_CD];
//◆付きやすさ [この階から, 付く率, 付いた内の「両方」の割合]。B3 から 4% で始め、深いほど上がる（最後の行で頭打ち）
const STYLE_TABLE = [[3, 0.04, 0], [6, 0.07, 0.10], [11, 0.10, 0.15], [21, 0.14, 0.20], [31, 0.18, 0.25], [51, 0.22, 0.30], [101, 0.26, 0.35], [201, 0.30, 0.40]];
//◆付かない行動（壺・潜る・壁抜け）と、掘らない行動（動かない砲台・もともと掘る digger は「置く」だけが付く）
const STYLE_NONE = ["vase", "burrower", "phaser"], STYLE_PLACE_ONLY = ["stationary", "digger"];
//◆1 マスの坑道に入れる体の大きさ（半径）。これより大きい敵は体の幅で掘り進む（styleDigWide）
const STYLE_SLIM = CELL / 2 - 2, STYLE_STUCK_T = 40;   //◆STYLE_STUCK_T = 詰まりを見る間隔（tick。この間に 6px も動かなければ掘る理由になる）
//◆掘る番で STYLE_GIVEUP_T tick 進めない（標的へ 4px も寄れず岩も叩けない）なら諦め、STYLE_REST_T × 2^(続けて諦めた数。3 まで) tick は
//◆ふだんの行動にする（堅岩の前で 2 マスを往復し続ける・人混みに押し返され続けて、回り道も技も使わなくなるのを防ぐ）
const STYLE_GIVEUP_T = 60, STYLE_REST_T = 160;
const REACH_MAX = 160;
//◆遊びが壊れる能力だけの上限（playerStats の最後で掛ける。火力などの伸びは上限なし）
//◆歩く速さ＝ダッシュ（DASH_SPEED 560）より遅く／被弾後の無敵の足し＝28 tick（HURT_INVULN_TICKS と合わせて 2 秒）／鉱脈感知＝16 マス
const SPEED_MAX = DASH_SPEED - 60, IFRAME_MAX = 28, SENSE_MAX = 16;
//◆基本の定数ここまで

//◆旗・落とし物・岩・弾の定数ここから
const PHASE = { FIGHT: 0, HATCH: 1, TRANSIT: 2, OVER: 3, LEAVE: 4 };
const EFLAGS = { HURT: 1, TELEGRAPH: 2, STUN: 4, SHIELD: 8, ELITE: 16, HIDDEN: 32, FUSE: 64, BOSS: 128, POISON: 256, MOVING: 512, DIGGING: 1024, CHAMP: 2048, VET: 4096, AURA: 8192, BUILD: 16384 };   //◆BUILD = 石積みが土を置いた直後
const ITEM_KIND = { COIN: 0, HEART: 1, ORE: 2, MAG: 3, EQUIP: 4, MAT: 5, MIRROR: 6, BOOK: 7 };   //◆MIRROR = 隙間の鏡（ボスが落とす）・BOOK = 記憶の禁書（消えない）
const MIRROR_RATE = 0.10;   //◆ボスが隙間の鏡を落とす率
//◆記憶の禁書（opts.books = { left, found, since } がある時だけ）。撃破・採掘 1 回ごとに BOOK_RATE、1 階に 1 冊まで。
//◆抽選は rng32(hash32(…, BOOK_SALT))（rnd の列は動かさない）。
//◆数えは冒険をまたぐ（since = 最後の本からの数。save.story.bc）。BOOK_PITY 回を超えたら次で必ず・
//◆1 回の冒険で BOOK_RUN_MAX 冊まで（届いたら数えるのも止める）。平均はおよそ 1970 回に 1 冊。
//◆落ちた本は BOOK_PULL_TICKS たつと、どこからでも主人公へ吸い寄せられる。階を降りる・冒険を終える時に床に残った本は拾った扱い（bookSweep）
const BOOK_RATE = 0.0002, BOOK_PITY = 2500, BOOK_SALT = 71, BOOK_RUN_MAX = 2, BOOK_PULL_TICKS = 40;
//◆強化に要る素材（段階ごと。その段階の装備が出る階までに落ちる物だけ。test 31 が見張る）
const UPGRADE_MATS = ["bone", "feather", "cloth", "fang", "soul", "petal", "dust", "dust",
  //◆段階 8..31（B55〜）。その段階が出る階までに落ちる物（test が見張る）
  "scale", "horn", "eye", "shell", "ice", "ember", "tentacle", "gear", "page", "sand", "mushroom", "web",
  "fur", "claw", "slime", "dragonbone", "star", "soul", "petal", "dust", "feather", "fang", "cloth", "star"];
const ZONE_KIND = { TELEGRAPH: 0, LAVA: 1, MARK: 2, BOMB_WARN: 3, LINE: 4, GAP: 5 };   //◆LINE = 決戦の光線（予告 → 本体）・GAP = スキマ（予告の後に撃つ）
const BLOCK = { FLOOR: 0, BEDROCK: 1, DIRT: 2, STONE: 3, HARD: 4, DENSE: 5, CHEST: 6, CRATE: 7 };
const BLOCK_DEF = [
  null,
  { name: "岩盤", hp: 1e9, minPow: 99 },
  { name: "土", hp: 2, minPow: 0.5 },
  { name: "石", hp: 5, minPow: 0.5 },
  { name: "硬岩", hp: 12, minPow: 2 },
  { name: "堅岩", hp: 30, minPow: 4 },
  { name: "宝箱", hp: 1, minPow: 0.5 },
  { name: "木箱", hp: 1, minPow: 0.5 },
];
const BF = { PIERCE: 1, HOME: 2, BOOM: 4, LASER: 8, BOUNCE: 16, SPIRAL: 32, RING: 64 };   //◆跳弾・渦巻き・弾ける輪（elem.js の BF と同じ値）
const HOME_DEG = 4, BOOM_R = 74, ORB_R = 36, BOOM_DEPTH_MAX = 2;
//◆BOUNCE = 壁で BOUNCE_MAX 回まで跳ね返る。SPIRAL = 撃った所を中心に渦を巻いて広がる
//◆（外へ弾速 × SPIRAL_VR、回る向きへ弾速 × SPIRAL_VT。向きは弾ごとに交互）。RING = 最初に当たった所で RING_N 個の欠片に弾ける
//◆（欠片は威力 × RING_DMG・弾速 × 0.7・寿命 RING_LIFE tick・旗なし。当たった敵には当たらない）。どれも乱数を引かない
const BOUNCE_MAX = 2, SPIRAL_VR = 0.6, SPIRAL_VT = 0.8, SPIRAL_R0 = 24, RING_N = 6, RING_DMG = 0.35, RING_LIFE = 6;
//◆深い階の敵の攻撃の伸び。ATK_FROM 階までは 1、その先は (1 + (階 − ATK_FROM) / ATK_PER) 倍で ATK_MAX 倍まで。
//◆体当たり（e.dmg）・敵弾・溶岩・爆発に掛け、0.25 刻みに丸める。決戦（B501）の弾は finDmg（最大 HP の 8%）のままで掛けない
//◆EATK_BASE = どの階でも敵の攻撃に掛ける土台の倍率（1.5）。植物式（攻めの 2^P）が強いので敵の攻撃を全体に上げてある。
//◆伸びは B20 から B620 で 6 倍（土台と合わせて最大 9 倍）。決戦の finDmg・おまけの魔理沙・魅魔の弾幕は eAtk を通さない
const ATK_FROM = 20, ATK_PER = 120, ATK_MAX = 6, EATK_BASE = 1.5;
//◆守りの式。動物式 A ＝ その行の防御力（DEF = A × DEF_PER。攻撃側の行 gyo の A だけが効く）。
//◆v = max(raw × DEF_FLOOR, raw − DEF)（引き算。防御で削れるのは最大 75% まで）
//◆DEF_PER = 0.75：A1 の序盤（B1 の敵 1.5 → 0.75）が EATK_BASE と同じ 1.5 倍の痛さに収まり、A4 は B300 まで 60% 以上減・A6 以上は B1000 でも 50% 減る
const DEF_PER = 0.75, DEF_FLOOR = 0.25;
//◆旗・落とし物・岩・弾の定数ここまで

//◆鉱石と魔石の表ここから
const ORES = [
  { key: "copper",  name: "銅鉱石", color: "#c8763c", floor: 1 },
  { key: "iron",    name: "鉄鉱石", color: "#8fa2b3", floor: 3 },
  { key: "silver",  name: "銀鉱石", color: "#e6edf5", floor: 7 },
  { key: "gold",    name: "金鉱石", color: "#ffd23a", floor: 12 },
  { key: "crystal", name: "水晶",   color: "#7fe0ff", floor: 18 },
  { key: "mithril", name: "秘銀",   color: "#7ff0c0", floor: 25 },
  { key: "dragon",  name: "竜晶",   color: "#ff5a7a", floor: 34 },
  { key: "star",    name: "星屑",   color: "#c9b6ff", floor: 45 },
  //◆B55〜B490（500 階ぶん）。color は画面の文字にも使うので暗い石も明るめ
  { key: "kurogane",  name: "黒鉄鉱",   color: "#8a90a8", floor: 55 },
  { key: "platinum",  name: "白金鉱",   color: "#eef6ff", floor: 70 },
  { key: "moonstone", name: "月長石",   color: "#b8d0ff", floor: 85 },
  { key: "hihiiro",   name: "緋緋色金", color: "#ff6a4a", floor: 100 },
  { key: "jade",      name: "翡翠",     color: "#4fd08f", floor: 115 },
  { key: "sapphire",  name: "蒼玉",     color: "#5a8aff", floor: 130 },
  { key: "ruby",      name: "紅玉",     color: "#ff4060", floor: 145 },
  { key: "meteor",    name: "隕鉄",     color: "#a898b8", floor: 160 },
  { key: "spirit",    name: "霊石",     color: "#a0f0e0", floor: 180 },
  { key: "celestite", name: "天青石",   color: "#80c8ff", floor: 200 },
  { key: "obsidian",  name: "黒曜石",   color: "#9a80c0", floor: 220 },
  { key: "thunder",   name: "雷晶",     color: "#fff060", floor: 240 },
  { key: "youkai",    name: "妖鉄",     color: "#c070ff", floor: 260 },
  { key: "oni",       name: "鬼鉄",     color: "#ff7050", floor: 280 },
  { key: "phantom",   name: "幻銀",     color: "#e8dcff", floor: 300 },
  { key: "divine",    name: "神鉄",     color: "#ffe8a0", floor: 320 },
  { key: "nether",    name: "冥鉱",     color: "#9070d0", floor: 345 },
  { key: "heaven",    name: "天鉱",     color: "#b0f0ff", floor: 370 },
  { key: "makai",     name: "魔界銀",   color: "#ff70a8", floor: 395 },
  { key: "dream",     name: "夢幻石",   color: "#b8bcff", floor: 415 },
  { key: "void",      name: "虚空晶",   color: "#8888dd", floor: 435 },
  { key: "sun",       name: "日輪石",   color: "#ffaa30", floor: 455 },
  { key: "samsara",   name: "輪廻石",   color: "#80ffd0", floor: 472 },
  { key: "origin",    name: "根源石",   color: "#ffffff", floor: 490 },
];
const MAGS = [
  { key: "mag0", name: "小魔石", floor: 1,  color: "#b06cff" },
  { key: "mag1", name: "中魔石", floor: 10, color: "#7a5aff" },
  { key: "mag2", name: "大魔石", floor: 25, color: "#ff5ad0" },
  { key: "mag3", name: "極魔石", floor: 45, color: "#ffffff" },
  { key: "mag4", name: "霊魔石", floor: 100, color: "#60ffd0" },
  { key: "mag5", name: "神魔石", floor: 200, color: "#ffe070" },
  { key: "mag6", name: "冥魔石", floor: 300, color: "#a070ff" },
  { key: "mag7", name: "根源魔石", floor: 400, color: "#ff6080" },
];
//◆鉱石と魔石の表ここまで
//◆装備の枠と種類ここから
const TIER_NAMES = ["銅", "鉄", "銀", "金", "水晶", "秘銀", "竜晶", "星屑",
  "黒鉄", "白金", "月長石", "緋緋色金", "翡翠", "蒼玉", "紅玉", "隕鉄", "霊石", "天青石", "黒曜石", "雷晶",
  "妖鉄", "鬼鉄", "幻銀", "神鉄", "冥鉱", "天鉱", "魔界銀", "夢幻石", "虚空晶", "日輪石", "輪廻石", "根源石"];
const TIER_COLORS = ORES.map(o => o.color);
const SLOTS = ["weapon", "pick", "armor", "charm", "charm2"];
const SLOT_NAMES = { weapon: "武器", pick: "ツルハシ", armor: "服", charm: "お守り", charm2: "お守り２" };
const CHARM2_FLOOR = 50;   //◆2 つ目のお守り枠が開く最深階（第 1 章）
const PENDANT_FLOOR = 100;   //◆想起のペンダント（宿屋で他のキャラの特性を引き継ぐ）が開く最深階
//◆スロット → そこに入る装備の種類（charm2 には charm の装備が入る）
function slotKind(sl) { return sl === "charm2" ? "charm" : sl; }

//◆装備の種類。lo = 段階 0 の値、hi = 段階 7 の値（線形補間）。主効果（main）は lv +8%/★ +10% の対象
//◆fx = 弾の絵の名前（client 用）。gyo = 武器の行（ツルハシ・服・お守りは無し）
//◆sp = 特別な武器（ELEM.SPECIALS の表。base の武器種の効果に bonus を掛ける／足す。rollEquip は抽選しない）
const EQUIP_KINDS = {
  ofuda:   { slot: "weapon", name: "霊符",   main: "dmg", lo: { dmg: 1.0, cdMs: 180 }, hi: { dmg: 4.0, cdMs: 120 }, ways: 1, spread: 0, bspeed: 480, life: 0.8, fl: 0, fx: "mag6", gyo: "sun" },
  orb:     { slot: "weapon", name: "魔法弾", main: "dmg", lo: { dmg: 2.2, cdMs: 420 }, hi: { dmg: 9.0, cdMs: 300 }, ways: 1, spread: 0, bspeed: 380, life: 0.9, fl: 0, fx: "mag8", orb: 1, gyo: "earth" },
  needle:  { slot: "weapon", name: "針",     main: "dmg", lo: { dmg: 0.5, cdMs: 70, ways: 2 }, hi: { dmg: 2.0, cdMs: 45, ways: 3 }, spread: 6, bspeed: 700, life: 0.5, fl: 0, fx: "mag7", gyo: "metal" },
  scatter: { slot: "weapon", name: "散符",   main: "dmg", lo: { dmg: 0.8, cdMs: 300, ways: 5 }, hi: { dmg: 3.2, cdMs: 200, ways: 7 }, spread: 12, bspeed: 460, life: 0.35, fl: 0, fx: "wind_ball", gyo: "wood" },
  star:    { slot: "weapon", name: "星弾",   main: "dmg", lo: { dmg: 0.9, cdMs: 200 }, hi: { dmg: 3.4, cdMs: 140 }, ways: 1, spread: 0, bspeed: 420, life: 0.9, fl: BF.HOME, fx: "mag9", gyo: "moon" },
  fire:    { slot: "weapon", name: "火球",   main: "dmg", lo: { dmg: 1.6, cdMs: 320 }, hi: { dmg: 6.0, cdMs: 220 }, ways: 1, spread: 0, bspeed: 300, life: 1.0, fl: BF.BOOM, fx: "meteor", gyo: "fire" },
  ice:     { slot: "weapon", name: "氷刃",   main: "dmg", lo: { dmg: 1.2, cdMs: 220 }, hi: { dmg: 4.6, cdMs: 150 }, ways: 1, spread: 0, bspeed: 520, life: 1.0, fl: BF.PIERCE, fx: "mag4", gyo: "water" },
  bolt:    { slot: "weapon", name: "雷矢",   main: "dmg", lo: { dmg: 1.4, cdMs: 160 }, hi: { dmg: 5.4, cdMs: 110 }, ways: 1, spread: 0, bspeed: 900, life: 0.45, fl: BF.LASER | BF.PIERCE, fx: "bolt_arrow", gyo: "metal" },
  sp:      { slot: "weapon", name: "特別な武器", main: "dmg" },
  pickaxe: { slot: "pick", name: "つるはし", main: "digPow", lo: { digPow: 1, digCd: 7, reach: 46 }, hi: { digPow: 8, digCd: 5, reach: 62 } },
  hammer:  { slot: "pick", name: "ハンマー", main: "digPow", lo: { digPow: 2, digCd: 11, reach: 40 }, hi: { digPow: 14, digCd: 8, reach: 40 }, splash: 0.5 },
  drill:   { slot: "pick", name: "ドリル",   main: "digPow", lo: { digPow: 0.7, digCd: 3, reach: 40 }, hi: { digPow: 5, digCd: 2, reach: 40 } },
  rod:     { slot: "pick", name: "掘削杖",   main: "digPow", lo: { digPow: 1, digCd: 8, reach: 80, sense: 2 }, hi: { digPow: 7, digCd: 6, reach: 120, sense: 5 } },
  miko:    { slot: "armor", name: "巫女服", main: "hp", lo: { hp: 1 }, hi: { hp: 8 } },
  witch:   { slot: "armor", name: "魔女帽", main: "hp", lo: { hp: 0, speed: 15 }, hi: { hp: 4, speed: 60 } },
  mail:    { slot: "armor", name: "鎧",     main: "hp", lo: { hp: 2, speed: -20, iframe: 2 }, hi: { hp: 14, speed: -20, iframe: 8 } },
  cloak:   { slot: "armor", name: "マント", main: "hp", lo: { hp: 0, dashCdT: -2, iframe: 1 }, hi: { hp: 5, dashCdT: -10, iframe: 4 } },
  magnet:  { slot: "charm", name: "磁石",   main: "magnet", lo: { magnet: 40 }, hi: { magnet: 220 } },
  cat:     { slot: "charm", name: "招き猫", main: "coinMul", lo: { coinMul: 0.2 }, hi: { coinMul: 1.4 } },
  feather: { slot: "charm", name: "羽",     main: "speed", lo: { speed: 10, dashCdT: -3 }, hi: { speed: 40, dashCdT: -8 } },
  clover:  { slot: "charm", name: "幸運",   main: "luck", lo: { luck: 0.05 }, hi: { luck: 0.35 } },
  lantern: { slot: "charm", name: "鉱脈灯", main: "sense", lo: { sense: 3, magnet: 20 }, hi: { sense: 9, magnet: 20 } },
};
//◆装備の枠と種類ここまで
//◆装備の型ここから
//◆装備の型（見た目と名前）。種類 → [[絵の元, 名前], ...]。段階 t の型は modelIdx = floor(t × 型の数 / EQUIP_TIERS)
//◆絵の元：w<n> = 武器パック（craftpix 155909）の形 n、a<行>:<列> = アイコンパック（craftpix 701182）の防具の形
//◆絵は tools/build_gear_art.py が作る（assets/equip/<kind>_<tier>.png）。EQUIP_MODELS の塊は厳密な JSON（ツールが `const EQUIP_MODELS = {…};` をそのまま読む）
const EQUIP_MODELS = {
  "ofuda":   [["w0", "短剣"], ["w3", "錐刀"], ["w2", "曲短刀"], ["w1", "鉈"], ["w6", "小剣"], ["w4", "ジャマダハル"], ["w5", "鉤爪"]],
  "orb":     [["w49", "小杖"], ["w48", "王笏"], ["w56", "宝杖"], ["w50", "月杖"], ["w57", "双宝杖"]],
  "needle":  [["w9", "細剣"], ["w12", "刺突剣"], ["w19", "短槍"], ["w13", "太刀"], ["w20", "長槍"], ["w22", "薙刀"], ["w21", "三叉槍"]],
  "scatter": [["w60", "木のブーメラン"], ["w61", "ブーメラン"], ["w62", "投げ刃"], ["w63", "手裏剣"]],
  "star":    [["w27", "棍棒"], ["w28", "小槌"], ["w32", "戦槌"], ["w33", "フレイル"], ["w34", "モーニングスター"]],
  "fire":    [["w23", "手斧"], ["w24", "斧"], ["w25", "戦斧"], ["w31", "鉞"], ["w26", "大斧"]],
  "ice":     [["w7", "長剣"], ["w10", "曲刀"], ["w11", "三日月刀"], ["w14", "広刃剣"], ["w15", "段平"], ["w8", "大剣"]],
  "bolt":    [["w42", "短弓"], ["w43", "長弓"], ["w40", "弩"], ["w41", "重弩"], ["w58", "竪琴"], ["w59", "弓琴"]],
  "pickaxe": [["w17", "つるはし"], ["w18", "鶴嘴斧"]],
  "hammer":  [["w35", "ウォーハンマー"], ["w36", "大槌"]],
  "drill":   [["w29", "シャベル"], ["w30", "フォーク"], ["w39", "熊手"], ["w37", "三つ又"], ["w38", "大熊手"]],
  "rod":     [["w53", "細杖"], ["w54", "杖"], ["w51", "環杖"], ["w52", "曲杖"], ["w55", "長杖"]],
  "miko":    [["a1:4", "胸飾り"], ["a1:8", "肩掛け"], ["a1:9", "法衣"], ["a1:11", "頭巾"]],
  "witch":   [["a1:10", "フード"], ["a0:3", "兜"], ["a0:4", "面頬兜"], ["a0:5", "大兜"]],
  "mail":    [["a0:0", "胸当て"], ["a0:1", "胴鎧"], ["a0:2", "鎧"]],
  "cloak":   [["a1:5", "外套"], ["a1:6", "マント"], ["a1:7", "ケープ"]],
  "magnet":  [["a0:12", "指輪"], ["a0:14", "耳飾り"], ["a0:15", "双環"], ["a0:13", "宝石の指輪"]],
  "cat":     [["a0:6", "手袋"], ["a0:9", "籠手"], ["a0:10", "鎖籠手"]],
  "feather": [["a0:7", "靴"], ["a0:8", "長靴"]],
  "clover":  [["a1:3", "首輪"], ["a1:2", "数珠"], ["a1:1", "ロザリオ"], ["a1:0", "首飾り"]],
  "lantern": [["a1:12", "面"], ["a1:13", "鬼面"], ["a1:14", "髑髏面"], ["a1:15", "鉄仮面"]]
};
//◆段階 t の型 { src, name, idx }（無ければ null）
function modelOf(kind, tier) {
  const L = Object.prototype.hasOwnProperty.call(EQUIP_MODELS, kind) ? EQUIP_MODELS[kind] : null;
  if (!L || !L.length) return null;
  const idx = clamp(Math.floor(clampInt(tier, 0, EQUIP_TIERS - 1) * L.length / EQUIP_TIERS), 0, L.length - 1);
  return { src: L[idx][0], name: L[idx][1], idx };
}
//◆装備の型ここまで
const EQUIP_KIND_LIST = ["ofuda", "orb", "needle", "scatter", "star", "fire", "ice", "bolt",
  "pickaxe", "hammer", "drill", "rod", "miko", "witch", "mail", "cloak", "magnet", "cat", "feather", "clover", "lantern"];
const WEAPON_LIST = ["ofuda", "orb", "needle", "scatter", "star", "fire", "ice", "bolt"];
//◆段階 TIER_HI より先の伸び方。main_dmg = 威力は「その段階が出る階の敵 HP の倍率」に合わせる、
//◆slow = HP・採掘力・お守りの主効果はゆるやかに、それ以外（連射・射程・弾数・速さの罰など）は hi のまま
function tierGrow(t) {
  if (t <= TIER_HI) return 1;
  const f = (n) => 1 + 0.1 * (n - 1);   //◆baseHpOf と同じ式
  return f(tierFloor(t)) / f(tierFloor(TIER_HI));
}
function tierExtend(k, K, lo, hi, t) {
  if (t <= TIER_HI) return lo + (hi - lo) * t / TIER_HI;
  const over = t - TIER_HI, step = (hi - lo) / TIER_HI;
  if (k === K.main && k === "dmg") return hi * tierGrow(t);
  if (k === K.main && k === "digPow") return hi * (1 + 0.04 * over);
  if (k === K.main || k === "hp") return step > 0 ? hi + step * over * 0.4 : hi;
  return hi;
}
const STAT_NAMES = { hp: "HP", speed: "速さ", dmg: "威力", cdMs: "連射", ways: "弾数", spread: "拡散", bspeed: "弾速", life: "射程",
  magnet: "磁力", digPow: "採掘力", digCd: "採掘速度", reach: "採掘距離", sense: "鉱脈感知", coinMul: "コイン", dashCdT: "ダッシュ", iframe: "無敵", luck: "幸運" };

const BASE = { maxhp: 6, speed: 200, dmg: 1, cdMs: 180, ways: 1, spread: 0, life: 0.8, bspeed: 480, magnet: 70,
  digPow: 0.5, digCd: 7, reach: 46, sense: 0, coinMul: 1, dashCdT: 20, iframe: 0, luck: 0, kb: 1 };

const ITEMS = {
  potion: { name: "ポーション", price: 60, max: 5, desc: "HP +3" },
  bomb:   { name: "ばくだん",   price: 90, max: 5, desc: "周りの敵に 6 ダメージ・敵弾を消す・岩を掘り抜く" },
};
const ITEM_KEYS = ["potion", "bomb"];

