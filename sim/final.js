//◆決戦（501 階の紫の弾幕戦）と 1000 階（紫が祝いに来る静かな広間）の状態と流れ : 2.10.10参照
//◆決戦の定数ここから
const FIN_AUTO = 200;   //◆会話の答え（input.talk）が来なければ 200 tick で始める（ボット・テスト。client は会話の間 sim を止める）
const FIN_ARENA = 15, FIN_PAD = 2;   //◆広間の床 15×15 マス（480px）・外の岩盤 2 マス
const FIN_EBULLETS = 240, FIN_CARD_MAX = 180;   //◆決戦の弾の上限（満ちたら新しい弾を出さない）・どのカードもこの数以下に収める（test が見張る）
const FIN_SPD_MIN = 50, FIN_SPD_MAX = 220, FIN_AIM_MAX = 200, FIN_LIFE = 400;   //◆弾速（狙い撃ちは 200 まで）・弾の寿命（広間の外へ出れば先に消える）
const FIN_CORE = 4, FIN_HR = 4, FIN_SAFE = 64, FIN_RING_MAX = 16, FIN_WARN_MIN = 16;   //◆当たり＝芯 4px＋弾の hr・自機の 64px 以内に弾を出さない・輪は 16 個まで・光線とスキマの予告は 16 tick 以上
//◆紫の体から出る弾（輪・狙い撃ち。紫の中心から e.r の所）は、自機の FIN_SAFE_BODY（32px）より先なら出す。
//◆紫の体の当たりは中心どうし e.r + FIN_SAFE_BODY（56px）。
//◆紫の 20〜88px に寄り添っても、体のどちらかか弾のどちらかは来る（体から出る弾まで FIN_SAFE で消すと安全地帯ができる）。
//◆56px より内は体に当たり、外なら体から出る弾は自機の 32px より先から出る
const FIN_SAFE_BODY = 32;
const FIN_DECLARE = 40, FIN_DMG = 0.08, FIN_DPS_SEC = 15, FIN_BOSS_HP = 8;   //◆宣言の無敵・1 発の傷（最大 HP の 8%）・カードの HP の下限（推定 DPS × 15 秒）・紫の HP の元
const FIN_NET_SP = 15, FIN_NET_GAP = 56;   //◆結界の線：弾の間隔（2 ×（芯 + hr）より狭い＝抜け道の所でしか抜けられない）・抜け道の幅
const FIN_WIN_COIN = 30000, FIN_CAP_COIN = 3000, EXTRA_COIN = [100000, 10000];   //◆勝ち・カードを取った（× 番号）・1000 階の贈り物（初めて／二度目から）
//◆決戦の定数ここまで
//◆呪文カードの表ここから
//◆呪文カード。t = 時間切れまでの tick（宣言を含む）、hp = 紫の HP（finBaseHp）に掛ける倍率、sv = 耐久（ずっと無敵で、時間切れ＝勝ち）。名前は client（finalboss.js）
const FIN_CARDS = [
  { id: "normal", t: 900, hp: 0.6 },   //◆通常：16 方向の輪と狙いの 3 方向
  { id: "wave", t: 1000, hp: 0.8 },   //◆境符「波と粒の境界」：角速度が伸び続ける 5 本の渦
  { id: "net", t: 1000, hp: 0.8 },   //◆結界「光と闇の網目」：四方の壁から抜け道つきの弾の線
  { id: "ran", t: 1000, hp: 0.8 },   //◆式神「八雲藍」：駆け回る藍（当たらない）が弾を置いていく
  { id: "train", t: 1000, hp: 0.85 },   //◆廃線「ぶらり廃駅下車の旅」：予告つきの光線（電車）と、降りた乗客の弾
  { id: "hide", t: 1000, hp: 0.85 },   //◆罔両「八雲紫の神隠し」：紫はスキマで消え、自機の周りにスキマが開いて撃つ
  { id: "barrier", t: 1200, hp: 0, sv: 1 },   //◆紫奥義「弾幕結界」：60 秒の耐久。止まった輪が内へ走り出す
];
//◆呪文カードの表ここまで
//◆決戦の場に着く・会話ここから
//◆この階が決戦（"final"）か 1000 階（"extra"）か（""）。opts.fin が無ければいつも ""
function sfOf(state, n) {
  const O = state.opts;
  if (omakeOf(state)) return n === OMAKE_MARISA ? "marisa" : n === OMAKE_MIMA ? "mima" : "";   //◆おまけの層（決戦・1000 階は無い） : 2.10.11参照
  if (!O || !O.fin) return "";
  if (O.finBeat ? n === FINAL_FLOOR : n >= FINAL_FLOOR && !(state.run && state.run.finSeen)) return "final";
  return n === EXTRA_FLOOR ? "extra" : "";
}
//◆決戦の乱数（0..1）。seed・tick・k だけで決まる（rnd の列を動かさない）
function fr(state, k) { return hash32((state.seed | 0) ^ 0x6a09e667, state.tick | 0, k | 0) / 4294967296; }
//◆階に着いた（startFloor の最後）：state.sf を作る。501 に着いたら隙間の鏡 500 を足す（やり直しを軽く）。["sfloor", id, 鏡を足したか]
//◆sf.st：0 待っている・1 戦っている（1000 階は贈り物を渡した）・2 勝った・3 通してもらった。box（x0..y1）＝広間の床の外枠、yx / yy＝紫の立つ所
function sfBegin(state, id, L, n) {
  const R = state.run, b = L.box;
  const F = { id, t0: state.tick, st: 0, auto: 0, x0: b[0], y0: b[1], x1: b[2], y1: b[3], yx: L.npc.x, yy: L.npc.y, gm: 0 };
  if (id === "marisa" || id === "mima") { Object.assign(F, { card: -1, ct: 0, tm: 0, hp: 0, cap: 0, h0: 0, b0: 0, eid: 0, won: 0, k: 0, fam: [], hold: 0, ht: 0 }); }   //◆おまけの層のボス（hold＝最後のスペルの前の待ち） : 2.10.11参照
  else if (id === "final") { Object.assign(F, { card: -1, ct: 0, tm: 0, hp: 0, cap: 0, h0: 0, b0: 0, eid: 0, won: 0, k: 0, fam: [] }); R.finSeen = 1; }
  else F.big = 0;
  if (n === FINAL_FLOOR) {
    if (!Array.isArray(R.mirrors)) R.mirrors = [];
    if (R.mirrors.indexOf(FINAL_FLOOR - 1) < 0) { R.mirrors.push(FINAL_FLOOR - 1); F.gm = 1; }
  }
  state.sf = F;
  ev(state, ["sfloor", id, F.gm]);
}
//◆会話の答え（input.talk）。決戦：2 = 通してもらう（勝ったことがある時だけ。ハッチを開ける）、それ以外 = 戦う。1000 階：贈り物
function sfTalk(state, c) {
  const F = state.sf;
  if (!F || F.st || state.phase !== PHASE.FIGHT) return;
  if (F.id === "extra") { extraGift(state, 0); return; }
  if (F.id === "marisa" || F.id === "mima") {   //◆2 = 通る（魔理沙の二周目だけ。戦わずにハッチ）
    if ((c | 0) === 2 && F.id === "marisa" && omakeOf(state) === 2) { F.st = 3; ev(state, ["finPass"]); openHatch(state); return; }
    finStart(state, 0);
    return;
  }
  if ((c | 0) === 2 && state.opts && state.opts.finBeat) { F.st = 3; ev(state, ["finPass"]); openHatch(state); return; }
  finStart(state, 0);
}
//◆決戦の場に着く・会話ここまで
//◆戦いの流れここから
//◆紫の HP の元（B501 のボスと同じ式：K.hp × 9 × (1 + 0.1(n − 1)) × (1 + 0.3 × 周回)）
function finBaseHp(n) { n = n > 0 ? n : FINAL_FLOOR; const cyc = bossCycle(n); return Math.round(FIN_BOSS_HP * BOSS_HP_MUL * (1 + 0.1 * (n - 1)) * (1 + 0.3 * cyc)); }
//◆自機が紫に出せる DPS の見積もり（威力 × 弾数 × 行の倍率 × 連射。強い装備でカードを飛ばしすぎないため。state の中だけで決まる）
function finDps(state, e) {
  const p = state.players[0], s = p && p.stats;
  if (!s) return 0;
  const per = (Number(s.dmg) || 0) * Math.max(1, s.ways | 0) * elemMulE(e, gyoIdx(s.wgyo), wpnElemMul(s));
  return per * 1.25 * 1000 / Math.max(20, Number(s.cdMs) || 180);
}
//◆1 発の傷：最大 HP の 8%（0.25 刻み・最低 1）。damagePlayer を通す（守り・見切り・防具は効く）
function finDmg(p) { return Math.max(1, Math.round((p ? Number(p.maxhp) || 0 : 0) * FIN_DMG * 4) / 4); }
function finHit(state, p, sx, sy) { return damagePlayer(state, p, finDmg(p), sx, sy, null); }
//◆戦いの始め：紫を出して最初のカードへ
function finStart(state, auto) {
  const F = state.sf;
  F.st = 1; F.auto = auto ? 1 : 0;
  const e = makeEnemy(state, F.id === "marisa" ? OM_MARISA : F.id === "mima" ? OM_MIMA : FIN_KIND, F.yx, F.yy, 0, 0, 1);
  e.fin = 1; e.gyo = null; e.dmg = 0; e.coin = 0; e.speed = 0; e.tx = e.x; e.ty = e.y; e.n1 = 0; e.invUntil = 0;
  state.enemies.push(e);
  F.eid = e.id;
  ev(state, ["finStart", F.auto]);
  finCard(state, e, 0);
}
function finBoss(state) { const id = state.sf ? state.sf.eid : 0, es = state.enemies; for (let i = 0; i < es.length; i++) if (es[i].id === id && !es[i].gone) return es[i]; return null; }
//◆カードの始めの立ち位置（波と粒は広間の真ん中寄り・弾幕結界は少し下・ほかは上の真ん中）
function finHome(F, i) { const cx_ = (F.x0 + F.x1) / 2; if (F.id !== "final") return [cx_, F.yy]; return i === 1 ? [cx_, (F.y0 + F.y1) / 2 - 24] : i === 6 ? [cx_, F.y0 + 120] : [cx_, F.yy]; }
function finGlide(e, x, y, ticks) { e.tx = x; e.ty = y; e.n1 = Math.max(0.5, dist(e.x, e.y, x, y) / Math.max(1, ticks)); }
//◆i 枚目のカードを宣言：弾と光線を消し、HP を満たし、FIN_DECLARE の間は無敵（耐久はずっと）。["card", i]
function finCard(state, e, i) {
  const F = state.sf, C = finCardsOf(F)[i], tick = state.tick, R = state.run;
  F.card = i; F.ct = tick; F.tm = C.t; F.k = 0; F.fam = [];
  const hp = C.sv ? 1 : Math.max(Math.round(finBaseHp(F.id === "final" ? 0 : state.floor) * C.hp), Math.round(finDps(state, e) * FIN_DPS_SEC));
  e.hp = hp; e.maxhp = hp; F.hp = hp;
  e.invUntil = tick + (C.sv ? C.t + 1 : FIN_DECLARE);
  if (e.st === 4) { e.x = e.tx; e.y = e.ty; e.px = e.x; e.py = e.y; }   //◆スキマの中なら出てくる
  e.st = 0; e.stTick = tick;
  F.h0 = R.hurt | 0; F.b0 = R.bombs | 0;
  state.ebullets = []; state.zones = [];
  const h = finHome(F, i);
  finGlide(e, h[0], h[1], FIN_DECLARE);
  if (F.id === "mima" && omakeOf(state) === 1 && i === finCardsOf(F).length - 1) { F.hold = 1; F.ht = tick; }   //◆一周目の最後のスペルは、client の場面（宣言・止める／撃つ／疑う）が済むまで始めない : 2.10.11参照
  ev(state, ["card", i]);
}
//◆カードが終わった（broke = HP を削りきった。0 = 時間切れ）。被弾もボムも無く、削りきった（耐久は耐えた）なら取った。["spell", i, 取った, ボーナス]
function finNext(state, e, broke) {
  const F = state.sf, i = F.card, cards = finCardsOf(F), C = cards[i], R = state.run;
  const got = (broke || C.sv) && (R.hurt | 0) === F.h0 && (R.bombs | 0) === F.b0 ? 1 : 0;
  let bonus = 0;
  if (got && i > 0) { F.cap++; if (F.id === "final") { bonus = FIN_CAP_COIN * i; R.coins += bonus; } }   //◆おまけの層は取ってもコインは出ない
  ev(state, ["spell", i, got, bonus]);
  if (i + 1 < cards.length) finCard(state, e, i + 1); else if (F.id === "final") finWin(state, e); else omakeWin(state, e);
}
//◆勝ち：弾・光線を消し、紫は立ち止まる（client が勝ちの会話）。コインと装備は冒険の成果へ直に（すぐ帰るので床に落とさない）。隙間の鏡は出さない
function finWin(state, e) {
  const F = state.sf, R = state.run, p = state.players[0];
  F.st = 2; F.won = 1; F.yx = e.x; F.yy = e.y; F.fam = [];
  e.gone = 1; e.hp = 0;
  state.ebullets = []; state.zones = [];
  R.finalWin = 1; R.bossKills = (R.bossKills | 0) + 1; R.coins += FIN_WIN_COIN;
  const eq = rollEquip(() => rnd(state), state.floor + 3, p && p.stats ? p.stats.luck : 0);
  R.drops.push(eq); ev(state, ["drop", eq]);
  if (EL && p) addXp(state, p, EL.xpOfEnemy(baseHpOf(FIN_KIND, state.floor), 1, 0));
  openHatch(state);
  ev(state, ["finalWin", F.cap, FIN_WIN_COIN]);
}
//◆1000 階の贈り物（初めては大きい＝コイン・装備。opts.b1000Done なら小さい）。HP 全快・備品は持てるだけ。["fgift", コイン, 大きいか] → ハッチ
function extraGift(state, auto) {
  const F = state.sf, R = state.run, p = state.players[0];
  const big = state.opts && state.opts.b1000Done ? 0 : 1, coin = EXTRA_COIN[big ? 0 : 1];
  F.st = 1; F.auto = auto ? 1 : 0; F.big = big;
  R.b1000 = 1;   //◆1000 階の贈り物を受け取った（着いた時ではなく渡した時に立てる。会話の前に帰ると場面を見ないまま済みになるため。勝手に渡す時も含む）
  R.coins += coin;
  if (isAlive(p)) { p.hp = p.maxhp; p.items.potion = ITEMS.potion.max; p.items.bomb = ITEMS.bomb.max; }
  if (big) { const eq = rollEquip(() => rnd(state), EXTRA_FLOOR + 3, p && p.stats ? p.stats.luck : 0); R.drops.push(eq); ev(state, ["drop", eq]); }
  ev(state, ["fgift", coin, big]);
  openHatch(state);
}
//◆紫が受けた傷（hurtEnemy から。宣言の間・耐久・スキマの中は無敵。押されない）
function finHurt(state, e, dmg) {
  const F = state.sf;
  if (!F || F.st !== 1 || e.st === 4 || state.tick < (e.invUntil | 0) || !(dmg > 0)) return;
  e.hp = Math.round((e.hp - dmg) * 100) / 100;
  e.hurtUntil = state.tick + 2;
  if (e.hp <= 0) { e.hp = 0; finNext(state, e, 1); }
}
//◆戦いの流れここまで
