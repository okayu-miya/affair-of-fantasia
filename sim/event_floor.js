//◆イベント階層（抽選・階の効果・紫との会話） : 2.10.9参照
//◆次の階へ降りて着いた時だけ 7.5% → 上位 25%／下位 75% → その中から 1 つ（重みは同じ）。
//◆冒険の最初の階（隙間の鏡で始めた階も）・ボスの階には来ない。抽選は rng32(hash32(seed, n, 29))（state.rs を動かさない＝ふつうの階の乱数は変わらない）
const EVENT_RATE = 0.075, EVENT_UPPER_RATE = 0.25;
const YUKARI_WAIT = 1800, YUKARI_TALK_R = 160, TINY_WAIT = 1200, TINY_OPEN_DELAY = 30;   //◆紫は 90 秒で帰る・話せるのは 5 マス以内・狭すぎる階は 60 秒で床が開く（宝箱を開け終えたら 1.5 秒後）
const MAZE_AREA = 10, WIDE_AREA = 1.5, GALE_SPEED = 1.3, GOLD_COIN = 3, CHEST_EVENT_MUL = 5;
//◆イベントの表ここから
//◆tier 0 = 下位（銀）・1 = 上位（金）。calm = 戦いの無い階（無傷の階・瀬戸際に数えない）。
//◆並びは実績の印（evMask のビット）なので、足すときは末尾へ。name / desc は帯の文字（client が訳す）
const EVENTS = [
  { id: "elite", tier: 0, name: "精鋭の階", desc: "敵がすべて精鋭以上" },
  { id: "dirt", tier: 0, name: "土の階", desc: "岩がすべて土になっている" },
  { id: "wide", tier: 0, name: "広間の階", desc: "いつもより 1.5 倍広い" },
  { id: "yukari", tier: 0, name: "スキマの階", desc: "敵の気配が無い。誰かが待っている…", calm: 1 },
  { id: "gale", tier: 0, name: "疾風の階", desc: "敵の足がいつもより速い" },
  { id: "horde", tier: 0, name: "一族の階", desc: "一つの族ばかりが湧く" },
  { id: "ore", tier: 1, name: "鉱脈の階", desc: "すべての岩に鉱石が眠る" },
  { id: "double", tier: 1, name: "大群の階", desc: "敵の数がいつもの倍" },
  { id: "grid", tier: 1, name: "石造りの階", desc: "誰かが造った、まっすぐな部屋と通路" },
  { id: "chest", tier: 1, name: "宝物庫の階", desc: "宝箱がいつもの 5 倍" },
  { id: "maze", tier: 1, name: "大迷宮", desc: "10 倍の広さの迷路。ハッチは最初から開いている", calm: 1 },
  { id: "tiny", tier: 1, name: "狭すぎる階", desc: "5×5 の小部屋。宝箱を全部開けると床が開く", calm: 1 },
  { id: "gold", tier: 1, name: "黄金の階", desc: "敵が落とすコインが 3 倍" },
];
//◆イベントの表ここまで
const EVENT_BY = {}, EVENT_LOWER = [], EVENT_UPPER = [];
for (let i = 0; i < EVENTS.length; i++) { const E = EVENTS[i]; E.bit = i; EVENT_BY[E.id] = E; (E.tier ? EVENT_UPPER : EVENT_LOWER).push(E.id); }
//◆n 階に降りて着いた時のイベントの id（無ければ ""）。seed と階だけで決まる。ボスの階・B1 は ""
function rollEvent(seed, n) {
  if (n <= 1 || n % BIOME_FLOORS === 0 || n === FINAL_FLOOR) return "";   //◆501 階（決戦）にも来ない
  const R = rng32(hash32(seed, n, 29));
  R();   //◆最初の 1 個は種と相関が残るので捨てる
  if (R() >= EVENT_RATE) return "";
  const list = R() < EVENT_UPPER_RATE ? EVENT_UPPER : EVENT_LOWER;
  return list[Math.floor(R() * list.length)];
}
function evIs(state, id) { return !!state.event && state.event.id === id; }
function evCalm(state) { const E = state.event && EVENT_BY[state.event.id]; return !!(E && E.calm); }
//◆一族の階の族。その層に湧かない族のうち、この階の大きさで 2 種以上湧ける物から hash で 1 つ（変わった顔ぶれにする）
function hordeFam(seed, n) {
  const step = ((n - 1) % BIOME_FLOORS + BIOME_FLOORS) % BIOME_FLOORS, maxR = maxSizeOf(n), own = BIOMES[biomeOf(n)].fams, cand = [];
  for (const f of Object.keys(FAM_MEMBERS).sort()) {
    if (own.indexOf(f) >= 0) continue;
    let ok = 0;
    for (const i of FAM_MEMBERS[f]) if (spawnWeight(SPECIES[i], step, 0, maxR) > 0) ok++;
    if (ok >= 2) cand.push(f);
  }
  return cand.length ? cand[hash32(seed, n, 41) % cand.length] : own[0];
}
//◆湧く種（一族の階は決めた族の中から。それ以外は pickKind）
function evPickKind(state) {
  const E = state.event, list = E && E.id === "horde" ? FAM_MEMBERS[E.fam] : null;
  if (!list || !list.length) return pickKind(state);
  const n = state.floor, step = ((n - 1) % BIOME_FLOORS + BIOME_FLOORS) % BIOME_FLOORS, maxR = maxSizeOf(n);
  let sum = 0;
  for (let i = 0; i < list.length; i++) sum += spawnWeight(SPECIES[list[i]], step, 0, maxR);
  if (sum <= 0) return pickKind(state);
  let r = rnd(state) * sum;
  for (let i = 0; i < list.length; i++) { r -= spawnWeight(SPECIES[list[i]], step, 0, maxR); if (r < 0) return SPECIES[list[i]][0]; }
  return smallestOf(E.fam, maxR);
}
//◆湧く時の段階（精鋭の階は精鋭 2 以上。覇者 3 はそのまま）
function evRank(state, r) { return evIs(state, "elite") ? Math.max(2, r | 0) : r; }
//◆湧いた敵に階の効果（疾風＝速さ ×1.3・黄金＝コイン ×3）
function evSpawned(state, e) {
  if (!e || !state.event) return e;
  if (state.event.id === "gale") e.speed *= GALE_SPEED;
  else if (state.event.id === "gold") e.coin = Math.round(e.coin * GOLD_COIN);
  return e;
}
//◆宝箱の残り（狭すぎる階の床が開くまで）
function chestsLeft(state) { let c = 0; const g = state.grid; for (let k = 0; k < g.length; k++) if (g[k] === BLOCK.CHEST) c++; return c; }
//◆イベント階層でハッチを閉じておくか（stepHatch の最初）。
//◆紫の階は話し終えるまで（YUKARI_WAIT で待ちくたびれて帰る → ["evgone"]）、狭すぎる階は宝箱を全部開けて TINY_OPEN_DELAY 後、かつ落とし物を拾い終えるまで（TINY_WAIT で開く）
function evHold(state) {
  if (state.sf) return state.phase === PHASE.FIGHT;   //◆決戦・1000 階はハッチを sim が自分で開ける（勝った・通した・贈り物）。それまでは救済も止める : 2.10.10参照
  const E = state.event;
  if (!E || state.phase !== PHASE.FIGHT) return false;
  const el = state.tick - (E.t0 | 0);
  if (E.id === "yukari") {
    if (E.talked) return false;
    if (el < YUKARI_WAIT) return true;
    E.talked = 2; state.run.yWait = 1;
    ev(state, ["evgone", Math.round(E.nx), Math.round(E.ny)]);
    return false;
  }
  if (E.id === "tiny") {
    if (el >= TINY_WAIT) return false;
    if (chestsLeft(state) > 0) return true;
    if (!E.clearAt) E.clearAt = state.tick;
    return state.tick - E.clearAt < TINY_OPEN_DELAY || tinyLoot(state);   //◆落とし物を拾い終えるまでも（床は真ん中＝足元に開くので、拾う前に降りて消えないように）
  }
  return false;
}
//◆狭すぎる階の床にまだ拾える物があるか（満タンで拾えないハートは数えない。部屋じゅうが磁力の内なので、生きていればすぐ拾える）
function tinyLoot(state) { const its = state.items; for (let i = 0; i < its.length; i++) if (its[i].kind !== ITEM_KIND.HEART) return true; return false; }
//◆紫と話し終えた（input.talk = 選んだ答え 1..3）。近く（YUKARI_TALK_R）で、まだ話していない時だけ。
//◆答えで小さな贈り物：1 順調 → この階の鉱石 3〜5 個／2 大変 → HP 全快＋ポーション 1（持てるだけ）／3 金欠 → コイン 20 + 8n + 0..n+4。["gift", 種類, 値, 数]
//◆4 = 金欠と答えたが、所持コインが 10000 以上でたしなめられて断られた（client が決める。sim は貯金を知らない）→ 贈り物なし。["gift", "none", 0, 0]
function evTalk(state, c) {
  const E = state.event, p = state.players[0];
  if (!E || E.id !== "yukari" || E.talked || state.phase !== PHASE.FIGHT || !isAlive(p)) return;
  if (dist(p.x, p.y, E.nx, E.ny) > YUKARI_TALK_R) return;
  c = clampInt(c, 1, 4);
  E.talked = 1; E.pick = c;
  const n = state.floor, R = state.run;
  R.yTalk = (R.yTalk | 0) + 1;
  if (c === 1) {
    const t = oreTierOfFloor(n), k = 3 + Math.floor(rnd(state) * 3);
    R.ore[t] = Math.min(INV_MAX, (R.ore[t] | 0) + k);
    ev(state, ["gift", "ore", t, k]);
  } else if (c === 2) {
    const h0 = p.hp;
    p.hp = p.maxhp;
    const k = p.items.potion < ITEMS.potion.max ? 1 : 0;
    p.items.potion += k;
    ev(state, ["gift", "heal", Math.round((p.hp - h0) * 100) / 100, k]);
  } else if (c === 4) {
    ev(state, ["gift", "none", 0, 0]);
  } else {
    const k = 20 + 8 * n + Math.floor(rnd(state) * (n + 5));
    R.coins += k;
    ev(state, ["gift", "coin", k, 0]);
  }
}

