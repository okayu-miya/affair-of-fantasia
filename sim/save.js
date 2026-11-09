//◆セーブの形・読み込み（migrateSave）・強化・探索の成果の足し込み : 2.10.8参照
//◆新しいセーブの形ここから
function fillN(a, n) { const out = []; for (let i = 0; i < n; i++) out.push(Array.isArray(a) && isNum(a[i]) ? Math.max(0, Math.floor(a[i])) : 0); return out; }
function newSave() {
  return {
    ver: 1, coins: 0, ore: fillN(null, ORE_COUNT), mag: fillN(null, MAG_COUNT), inv: [], nextId: 4,
    equip: { weapon: { id: 1, kind: "ofuda", tier: 0, lv: 0, q: 0 }, pick: { id: 2, kind: "pickaxe", tier: 0, lv: 0, q: 0 }, armor: { id: 3, kind: "miko", tier: 0, lv: 0, q: 0 }, charm: null },
    items: { potion: 1, bomb: 1 }, best: 0, chara: "2hu_reimu", kills: 0, runs: 0, seen: {},
    settings: { sfx: 1, shake: 1, autoAim: 1, zoom: 1, gl: 1, bgm: 1, bgmVol: 6, talk: 1 },   //◆talk = 会話の音（台詞の字ごとの電子音。効果音が OFF なら鳴らない）、gl = WebGL の明かり、bgm = 曲（bgmVol は 0..10）
    town: null,   //◆村（日数・HP・開拓資金・畑）。中身は town.js の migrateTown が整える
    charBest: {},   //◆キャラごとの最深階（特性の Lv の元）
    pendant: null,   //◆想起のペンダントで特性を引き継ぐキャラ（B100 で解禁）
    charas: [],   //◆追加で持っているキャラ（旧作キャラはもう新しくは手に入らないので、既に持っている分だけここに残る）
    lang: "",   //◆表示する言語（"" = まだ選んでいない。"ja" / "en" / "de"）
    charLv: {},   //◆キャラごとのレベル（key → 1..LV_CAP）
    charXp: {},   //◆キャラごとの累計経験値
    charSk: {},   //◆キャラごとの取得済みスキル（key → { skillId: 1 }）
    mats: {},   //◆素材の所持数（key → 個数）
    mirrors: [],   //◆隙間の鏡を拾った階（探索の開始階に選べる）
    ach: {},   //◆実績（id → 取った日 = town.day）。表と判定は achievements.js
    life: {},   //◆実績のための通算の数・印（key → 数）。探索の分は applyRun が足し、村の分は画面が足す
    story: storyNew(),   //◆物語の進み（済んだ場面・禁書・聞き込み。形は story.js の fresh / ensure）
    gst: gstOf(null),   //◆お客さん（今日のチップ・問いかけ・吹き出しの数え。形は guests.js の clean と同じ）
    booDay: 0,   //◆小傘が最後に驚かした日（town.day。0 = まだ一度も。21 日たつまで出ない。chatter.js の booReady）
    gq: "",   //◆答えたお客さんの問い（guestlines の ASK の並び順の番号のビットを 16 進の文字列に。1 つの問いにチップは一度きり。guests.js の qDone）
    gv: "",   //◆最後に書いた版（client の GAME_VER。"" = 分からない＝0.13.1 以前）。印だけで、読み込みの判定には使わない
  };
}
//◆save.gst を整える（guests.js の clean と同じ形。{ d その日, n チップの回数 ≤3, c チップの合計 ≤60, a 答えた客のビット, b 吹き出しの回数 ≤10 }）
function gstOf(o) {
  const g = { d: 0, n: 0, c: 0, a: 0, b: 0 };
  if (!o || typeof o !== "object" || Array.isArray(o)) return g;
  g.d = clampInt(o.d, 0, 999999); g.n = clampInt(o.n, 0, 3); g.c = clampInt(o.c, 0, 60); g.a = clampInt(o.a, 0, 0x3fffffff); g.b = clampInt(o.b, 0, 10);
  return g;
}
//◆save.gq（答えたお客さんの問いのビット。16 進の文字列・最大 64 字＝256 問・末尾の 0 は落とす）。形の合わない物は ""
function gqOf(v) { return (typeof v === "string" && /^[0-9a-f]{1,64}$/.test(v)) ? v.replace(/0+$/, "") : ""; }
//◆セーブを書いた版（"0.14"・"0.13.1" の形。数字で始まり、英数字・点・ハイフンで 16 字まで）。知らない形は ""
function gvOf(v) { return (typeof v === "string" && /^[0-9][0-9A-Za-z.\-]{0,15}$/.test(v)) ? v : ""; }
//◆新しいセーブの形ここまで
//◆物語・村の部品の取り出しここから
//◆story.js（Node は require、ブラウザは後から読まれる window.DD_STORY を使う時に引く）。無ければ null
let STORY0;
function storyApi() {
  if (STORY0 === undefined) { STORY0 = null; if (typeof module === "object" && module && module.exports && typeof require === "function") { try { STORY0 = require("./story.js"); } catch (e) { STORY0 = null; } } }
  return STORY0 || (typeof globalThis !== "undefined" && globalThis.DD_STORY) || null;
}
function storyNew() { const SA = storyApi(); return SA && typeof SA.fresh === "function" ? SA.fresh() : null; }
//◆物語・村の部品の取り出しここまで
//◆キャラの解禁ここから
function clampChara(key) {
  if (typeof key === "string") for (let i = 0; i < CHARAS.length; i++) if (CHARAS[i][0] === key) return key;
  return CHARAS[0][0];
}
//◆解禁済みのキャラ。旧作（92hu_）はもう階層では解禁されず、save.charas に載っている分だけ使える
function unlockedCharas(best, save) {
  const b = Math.max(0, Math.floor(Number(best) || 0)), out = [];
  const own = (save && Array.isArray(save.charas)) ? save.charas : null;
  for (let i = 0; i < CHARAS.length; i++) {
    const k = CHARAS[i][0];
    if (OLD_RE.test(k)) { if (own && own.indexOf(k) >= 0) out.push(k); continue; }
    if (CHARAS[i][2] <= b) out.push(k);
  }
  return out;
}
//◆旧作キャラを閉じる前から解禁していた人の分（古いセーブの引き継ぎ用）
function grandfatheredCharas(best) {
  const b = Math.max(0, Math.floor(Number(best) || 0)), out = [];
  for (let i = 0; i < CHARAS.length; i++) if (OLD_RE.test(CHARAS[i][0]) && CHARAS[i][2] <= b) out.push(CHARAS[i][0]);
  return out;
}
//◆キャラの解禁ここまで
//◆セーブの読み込み（migrateSave）ここから
function migrateSave(obj) {
  const s = newSave();
  if (!obj || typeof obj !== "object") return s;
  s.coins = Math.max(0, Math.floor(Number(obj.coins) || 0));
  s.ore = fillN(obj.ore, ORE_COUNT); s.mag = fillN(obj.mag, MAG_COUNT);
  s.nextId = Math.max(4, Math.floor(Number(obj.nextId) || 4));
  s.inv = [];
  if (Array.isArray(obj.inv)) for (let i = 0; i < obj.inv.length && s.inv.length < INV_MAX; i++) { const e = clampEquip(obj.inv[i]); if (e) { if (!e.id) e.id = s.nextId++; s.inv.push(e); } }
  const eq = (obj.equip && typeof obj.equip === "object") ? obj.equip : {};
  for (let i = 0; i < SLOTS.length; i++) {
    const sl = SLOTS[i];
    const e = eq[sl] === undefined ? s.equip[sl] : clampEquip(eq[sl]);
    s.equip[sl] = (e && EQUIP_KINDS[e.kind].slot === slotKind(sl)) ? e : null;
    if (s.equip[sl] && !s.equip[sl].id) s.equip[sl].id = s.nextId++;
  }
  const it = (obj.items && typeof obj.items === "object") ? obj.items : {};
  for (let i = 0; i < ITEM_KEYS.length; i++) { const k = ITEM_KEYS[i]; s.items[k] = clampInt(it[k] === undefined ? s.items[k] : it[k], 0, ITEMS[k].max); }
  s.best = clampInt(obj.best, 0, 9999); s.kills = clampInt(obj.kills, 0, 1e9); s.runs = clampInt(obj.runs, 0, 1e9);
  s.chara = clampChara(obj.chara);
  //◆旧作キャラ：obj.charas があればそれ、無ければ「その最深階なら昔は解禁されていた分」を引き継ぐ
  s.charas = [];
  if (Array.isArray(obj.charas)) { for (const k of obj.charas) if (typeof k === "string" && clampChara(k) === k && s.charas.indexOf(k) < 0) s.charas.push(k); }
  else s.charas = grandfatheredCharas(s.best);
  if (unlockedCharas(s.best, s).indexOf(s.chara) < 0) s.chara = CHARAS[0][0];
  if (obj.seen && typeof obj.seen === "object") s.seen = Object.assign({}, obj.seen);
  const st = (obj.settings && typeof obj.settings === "object") ? obj.settings : {};
  for (const k in s.settings) if (st[k] !== undefined) s.settings[k] = (k === "zoom") ? clamp(Number(st[k]) || 1, 0.5, 2) : (k === "bgmVol") ? clampInt(st[k], 0, 10) : (st[k] ? 1 : 0);
  s.town = (obj.town && typeof obj.town === "object") ? JSON.parse(JSON.stringify(obj.town)) : null;   //◆村の分は town.js に任せる（そのまま渡す）
  s.charBest = {};
  if (obj.charBest && typeof obj.charBest === "object") for (const k in obj.charBest) if (clampChara(k) === k) s.charBest[k] = clampInt(obj.charBest[k], 0, 9999);
  if (Object.keys(s.charBest).length === 0 && s.best > 0) s.charBest[s.chara] = s.best;   //◆古いセーブ：それまでの最深は今のキャラの物とみなす
  s.pendant = (typeof obj.pendant === "string" && obj.pendant && clampChara(obj.pendant) === obj.pendant) ? obj.pendant : null;
  s.lang = (obj.lang === "ja" || obj.lang === "en" || obj.lang === "de") ? obj.lang : "";
  //◆レベル・経験値・スキル・素材（知らないキャラ・知らないスキル id・前提の無いスキルは捨てる）
  s.charLv = {}; s.charXp = {}; s.charSk = {}; s.mats = {};
  if (obj.charLv && typeof obj.charLv === "object") for (const k in obj.charLv) if (clampChara(k) === k) { const v = clampInt(obj.charLv[k], 1, LV_CAP); if (v > 1) s.charLv[k] = v; }
  if (obj.charXp && typeof obj.charXp === "object") for (const k in obj.charXp) if (clampChara(k) === k) { const v = clampInt(obj.charXp[k], 0, 1e12); if (v > 0) s.charXp[k] = v; }
  if (EL && obj.charSk && typeof obj.charSk === "object") for (const k in obj.charSk) if (clampChara(k) === k) { const sk = EL.clampSkills(obj.charSk[k], EL.charaElem(k)); if (Object.keys(sk).length) s.charSk[k] = sk; }
  if (EL) s.mats = EL.clampMats(obj.mats);
  s.mirrors = clampMirrors(obj.mirrors);   //◆隙間の鏡
  s.ach = clampNumMap(obj.ach, 1e7); s.life = clampNumMap(obj.life, 1e12);   //◆実績（知らない id・key を捨てるのは achievements.js の ensure）
  //◆物語。形を整えるのは story.js の ensure（story の無い古いセーブは、ここで一度だけ済んだはずの場面に印を付ける）。
  //◆エクストラの欄（story.ex・lie・trust・trustYk・exEnd・exLoop）も ensure が足す・直す（newSave の story は story.js の fresh）
  s.story = (obj.story && typeof obj.story === "object" && !Array.isArray(obj.story)) ? JSON.parse(JSON.stringify(obj.story)) : null;
  { const SA = storyApi(); if (SA && typeof SA.ensure === "function") SA.ensure(s); }
  s.gst = gstOf(obj.gst);   //◆お客さん（古いセーブには無い → 空の形）
  s.gv = gvOf(obj.gv);   //◆書いた版の印（形の合わない物は "" に）
  s.booDay = clampInt(obj.booDay, 0, 999999);   //◆小傘が最後に驚かした日
  s.gq = gqOf(obj.gq);   //◆答えたお客さんの問い
  return s;
}
//◆セーブの読み込み（migrateSave）ここまで
//◆セーブから渡す物と強化ここから
//◆セーブ → loadout。2 つ目のお守り枠は B50 までは無いものとして扱う
function loadoutOf(save) {
  const L = {};
  for (let i = 0; i < SLOTS.length; i++) L[SLOTS[i]] = save && save.equip ? clampEquip(save.equip[SLOTS[i]]) : null;
  if (!save || (save.best | 0) < CHARM2_FLOOR) L.charm2 = null;
  return L;
}
//◆createRun / playerStats に渡す opts（特性の Lv とペンダント、レベル・経験値・スキル）をセーブから作る
function statsOptsOf(save, charaKey) {
  const ck = clampChara(charaKey || (save && save.chara));
  const pd = save && typeof save.pendant === "string" && (save.best | 0) >= PENDANT_FLOOR ? save.pendant : null;
  return { best: charaBest(save, ck), pendant: pd, pendantBest: pd ? charaBest(save, pd) : 0,
    lv: EL ? EL.charaLv(save, ck) : 1, xp: EL ? EL.charaXp(save, ck) : 0, skills: EL ? EL.charaSkills(save, ck) : {} };
}
function canUpgrade(save, e) {
  const c = upgradeCost(e);
  if (!c || !save) return false;
  if (c.mats) { const have = EL ? EL.clampMats(save.mats) : {}; for (const k in c.mats) if ((have[k] | 0) < c.mats[k]) return false; }   //◆素材
  const coins = c.coins + (c.ingot && EL ? EL.ingotSplit(save, c.ingot).coins : 0);   //◆延べ棒の足りない分はコイン
  return save.coins >= coins && (save.ore[c.ore[0]] | 0) >= c.ore[1] && (c.mag[1] === 0 || (save.mag[c.mag[0]] | 0) >= c.mag[1]);
}
//◆強化を適用（e は save の中の実体でも、コピーでもよい。戻り値は新しい lv の装備）
function applyUpgrade(save, e) {
  if (!canUpgrade(save, e)) return null;
  const c = upgradeCost(e);
  save.coins -= c.coins; save.ore[c.ore[0]] -= c.ore[1]; if (c.mag[1] > 0) save.mag[c.mag[0]] -= c.mag[1];
  if (c.ingot && EL) save.coins -= EL.ingotPay(save, c.ingot);   //◆村の延べ棒（足りない分はコイン）
  if (c.mats && EL) { const have = EL.clampMats(save.mats); for (const k in c.mats) { have[k] -= c.mats[k]; if (have[k] <= 0) delete have[k]; } save.mats = have; }
  e.lv = Math.min(LV_MAX, (e.lv | 0) + 1);
  return e;
}
//◆セーブから渡す物と強化ここまで
//◆探索の成果の足し込みここから
//◆ランの成果をセーブへ足す（帰還・全滅どちらでも呼ぶ）
function applyRun(save, sum) {
  if (!save || !sum) return save;
  save.coins += Math.max(0, Math.floor(sum.coins || 0));
  for (let i = 0; i < ORE_COUNT; i++) save.ore[i] += Math.max(0, Math.floor((sum.ore && sum.ore[i]) || 0));
  for (let i = 0; i < MAG_COUNT; i++) save.mag[i] += Math.max(0, Math.floor((sum.mag && sum.mag[i]) || 0));
  const drops = Array.isArray(sum.drops) ? sum.drops : [];
  const lost = [];
  for (let i = 0; i < drops.length; i++) {
    const e = clampEquip(drops[i]);
    if (!e) continue;
    e.id = save.nextId++;
    if (save.inv.length < INV_MAX) save.inv.push(e); else lost.push(e);
  }
  save.best = Math.max(save.best | 0, sum.best | 0, sum.floor | 0);
  if (!save.charBest || typeof save.charBest !== "object") save.charBest = {};
  const ck = clampChara(typeof sum.chara === "string" ? sum.chara : save.chara);
  save.charBest[ck] = Math.max(save.charBest[ck] | 0, sum.best | 0, sum.floor | 0);
  save.kills += Math.max(0, Math.floor(sum.kills || 0));
  save.runs += 1;
  if (sum.items && typeof sum.items === "object") for (let i = 0; i < ITEM_KEYS.length; i++) { const k = ITEM_KEYS[i]; if (isNum(sum.items[k])) save.items[k] = clampInt(sum.items[k], 0, ITEMS[k].max); }
  //◆レベル・経験値（大きい方）・素材（足す）
  if (!save.charLv || typeof save.charLv !== "object") save.charLv = {};
  if (!save.charXp || typeof save.charXp !== "object") save.charXp = {};
  if (isNum(sum.xp) && sum.xp > 0) save.charXp[ck] = Math.min(1e12, Math.max(Math.floor(Number(save.charXp[ck]) || 0), Math.floor(sum.xp)));
  if (isNum(sum.lv) && sum.lv > 1) save.charLv[ck] = Math.max(save.charLv[ck] | 0, clampInt(sum.lv, 1, LV_CAP));
  if (EL) {
    const have = EL.clampMats(save.mats), got = EL.clampMats(sum.mats);
    for (const k in got) have[k] = Math.min(1e9, (have[k] | 0) + got[k]);
    save.mats = have;
  }
  //◆隙間の鏡（拾った階。重ねて持たない・昇順）
  save.mirrors = clampMirrors((Array.isArray(save.mirrors) ? save.mirrors : []).concat(Array.isArray(sum.mirrors) ? sum.mirrors : []));
  //◆実績の通算（save.life）。sum.life（その探索の数と印）があるときだけ。開発用のずる（DD.warp / DD.god）の探索は client が null にして数えない
  if (sum.life && typeof sum.life === "object") addRunLife(save, sum);
  return lost;
}
//◆探索の成果の足し込みここまで
//◆実績の通算ここから
//◆実績の通算（数）と印（1）の安全な形。key は英数字と _ だけ・400 個まで・正の整数だけ残す（max で頭打ち）
function clampNumMap(o, max) {
  const out = {};
  if (!o || typeof o !== "object" || Array.isArray(o)) return out;
  let n = 0;
  for (const k in o) {
    if (n >= 400) break;
    if (!/^[A-Za-z0-9_]{1,32}$/.test(k)) continue;
    const v = Math.floor(Number(o[k]) || 0);
    if (v > 0) { out[k] = Math.min(max, v); n++; }
  }
  return out;
}
//◆探索中の実績の数（state.run の中。runSummary の life に載る）。足すだけの物
const RUN_LIFE_ADD = ["hurt", "potions", "bombs", "dashes", "dodges", "revives", "pdug", "nohit", "bossNoHit", "overlords", "masons", "clutch", "evFloors", "evUpper", "yTalk"];   //◆イベント階層（着いた数・上位・紫と話した）
//◆town.js（Node は require、ブラウザは後から読まれる globalThis.TOWN。天気だけ引く）。無ければ null
let TOWN0;
function townApi() {
  if (TOWN0 === undefined) { TOWN0 = null; if (typeof module === "object" && module && module.exports && typeof require === "function") { try { TOWN0 = require("./town.js"); } catch (e) { TOWN0 = null; } } }
  return TOWN0 || (typeof globalThis !== "undefined" && globalThis.TOWN) || null;
}
//◆霊夢の版（story.js の CID_KEYS.reimu と同じ。2hu_reimu・永夜抄・青・靈異伝・緑）
const REIMU_KEYS = ["2hu_reimu", "th080_reimu", "p_ao-reimu", "92hu_rei_reimu", "92hu_greenReimu"];
//◆いい天気の天気と主人公の条件：その日（town.day）が晴れで、探索に出たのが霊夢（の版）。セーブと要約だけで決まる（決定論）
function teaOk(save, sum) {
  const T_ = townApi(), day = save && save.town && typeof save.town === "object" ? Math.floor(Number(save.town.day) || 0) : 0;
  if (!T_ || typeof T_.weatherOf !== "function" || day < 1) return false;
  return REIMU_KEYS.indexOf(sum.chara) >= 0 && T_.weatherOf(day) === "sunny";
}
//◆探索 1 回ぶんを save.life へ。足す（通算）・大きい方（1 回の最高）・印（1 = やった）の 3 通り。
//◆key の名前は achievements.js の LIFE と同じ。結果（sum.result）で決まる印は本当に終わった時だけ（探索中の見込みは result = ""）
function addRunLife(save, sum) {
  if (!save.life || typeof save.life !== "object" || Array.isArray(save.life)) save.life = {};
  const L = save.life, R = sum.life;
  const n = (v) => { v = Math.floor(Number(v) || 0); return v > 0 ? v : 0; };
  const add = (k, v) => { v = n(v); if (v > 0) L[k] = Math.min(1e12, n(L[k]) + v); };
  const top = (k, v) => { v = n(v); if (v > n(L[k])) L[k] = v; };
  const flag = (k, c) => { if (c) L[k] = 1; };
  const sf = Math.max(1, n(sum.startFloor)), fl = n(sum.floor), res = sum.result, down = Math.max(0, fl - sf);
  add("dug", sum.dug); add("mined", sum.mined); add("chests", sum.chests); add("boss", sum.bossKills);
  top("chainMax", sum.maxChain); top("runFloors", down); top("runKills", sum.kills);
  if (res === "over") add("deaths", 1); else if (res === "leave") add("leaves", 1); else if (res === "run") add("giveups", 1);   //◆"run" = 途中で撤退
  if (sf > 1) add("mirrorDives", 1);
  for (let i = 0; i < RUN_LIFE_ADD.length; i++) add(RUN_LIFE_ADD[i], R[RUN_LIFE_ADD[i]]);
  top("nhStreak", R.nhMax); top("pdugMax", R.pdug);   //◆1 回の探索で石積みの土を崩した数の最高
  top("tunnel", R.tunnel);   //◆一度のダッシュですり抜けた敵の数の最高
  flag("bucket", R.bucket);   //◆100 階以降で一つの階の掘れる岩を全部掘った
  flag("tea", n(R.tea) > 0 && teaOk(save, sum));   //◆いい天気（晴れの日の霊夢が洞窟で、敵を倒しきって HP 満タンのポーション）
  const drops = Array.isArray(sum.drops) ? sum.drops : [];
  for (let i = 0; i < drops.length; i++) { const e = clampEquip(drops[i]); if (e) top("tierMax", e.tier); }
  //◆探索中に決まる印（その階に着いた時にもう決まっている＝見込みでも本番でも同じ）
  flag("fast10", n(R.fast) > 0 && n(R.fast) * TICK_MS <= 300000);   //◆潜ってから 5 分以内に 10 階降りた
  flag("noPotion", R.np30); flag("noDash", R.nd20); flag("naked", R.nk20); flag("cu30", R.cu30); flag("bare3", R.bare3); flag("bomb5", R.bomb5);
  flag("yWait", R.yWait); if (n(R.evMask) > 0) L.evMask = (n(L.evMask) | n(R.evMask)) & ((1 << EVENTS.length) - 1);   //◆紫を待たせて帰らせた・見たイベント階層の種類（OR）
  //◆結果で決まる印
  flag("reviveHome", res === "leave" && n(R.revives) > 0);
  flag("cleanRun", res === "leave" && n(R.hurt) === 0 && down >= 10);
  flag("b1death", res === "over" && fl === 1);
  flag("potionDeath", res === "over" && !!sum.items && n(sum.items.potion) >= ITEMS.potion.max);
  flag("quick", res === "run" && fl === sf && isNum(sum.ticks) && sum.ticks * TICK_MS <= 10000);
}
//◆実績の通算ここまで
//◆隙間の鏡と開始階ここから
//◆隙間の鏡の一覧を安全な形へ（1..9999 の整数・重複なし・昇順）
function clampMirrors(arr) {
  const out = [];
  if (!Array.isArray(arr)) return out;
  for (let i = 0; i < arr.length; i++) { const v = Math.floor(Number(arr[i]) || 0); if (v >= 1 && v <= 9999 && out.indexOf(v) < 0) out.push(v); }   //◆範囲外は捨てる（丸めない）
  out.sort((a, b) => a - b);
  return out.slice(0, 2000);
}
//◆探索を始められる階の一覧（1 と、隙間の鏡を拾った階）
function startFloors(save) { const out = [1]; const m = save ? clampMirrors(save.mirrors) : []; for (let i = 0; i < m.length; i++) if (out.indexOf(m[i]) < 0) out.push(m[i]); return out; }
//◆隙間の鏡と開始階ここまで
//◆探索の要約ここから
function runSummary(state) {
  const r = state.run, p = state.players[0];
  const lvUp = r.lvUp | 0;
  const out = { coins: r.coins, ore: r.ore.slice(), mag: r.mag.slice(), drops: r.drops.map(e => Object.assign({}, e)), kills: r.kills, floor: state.floor, best: state.best, chara: p ? p.chara : "",
    maxChain: state.maxChain, dug: r.dug, mined: r.mined, chests: r.chests, bossKills: r.bossKills, items: p ? Object.assign({}, p.items) : null,
    xp: p ? Math.max(0, Math.floor(Number(p.xp) || 0)) : 0, lv: p ? p.lv | 0 : 1, lvUp, lv0: p ? Math.max(1, (p.lv | 0) - lvUp) : 1, xpGain: Math.max(0, Math.floor(Number(r.xp) || 0)), mats: Object.assign({}, r.mats || {}),
    mirrors: Array.isArray(r.mirrors) ? r.mirrors.slice() : [], startFloor: state.startFloor | 0 || 1,
    result: state.phase === PHASE.OVER ? "over" : state.phase === PHASE.LEAVE ? "leave" : "run",
    ticks: state.tick | 0, life: runLifeOf(r),   //◆実績（探索の長さと、探索中の数・印）
    finalWin: r.finalWin ? 1 : 0, b1000: r.b1000 ? 1 : 0,   //◆決戦に勝った・1000 階に着いた（opts.fin の時だけ立つ）
    books: r.books | 0 };   //◆拾った記憶の禁書の数（番号を付けて save.story へ足すのは story.js の afterRun）
  if (omakeOf(state)) { out.omake = omakeOf(state); out.mirrors = []; out.life = null; out.books = 0; out.finalWin = 0; out.b1000 = 0; out.omakeWin = r.omakeWin | 0; }   //◆おまけの層は鏡・実績の通算・禁書・決戦の勝ちに数えない : 2.10.11参照
  if (state.bk) out.bookSince = state.bk.c | 0;   //◆最後の本からの数え（story.js の afterRun が save.story.bc へ。禁書の抽選が無い冒険では付けない）
  return out;
}
//◆state.run の実績の数と印だけを抜き出す（無い欄は 0）
function runLifeOf(r) {
  const out = {};
  for (let i = 0; i < RUN_LIFE_ADD.length; i++) out[RUN_LIFE_ADD[i]] = r[RUN_LIFE_ADD[i]] | 0;
  for (const k of ["nhMax", "fast", "np30", "nd20", "nk20", "cu30", "bare3", "bomb5", "tea", "tunnel", "bucket"]) out[k] = r[k] | 0;   //◆tea・tunnel・bucket
  out.evMask = r.evMask | 0; out.yWait = r.yWait | 0;   //◆イベント階層（見た種類のビット・紫を待たせて帰らせた）
  return out;
}

//◆探索の要約ここまで
