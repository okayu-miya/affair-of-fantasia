//◆おまけの層（13 階の別の探索・魔理沙と魅魔の弾幕・頁） : 2.10.11参照
const OMAKE_FLOORS = 13, OMAKE_MARISA = 7, OMAKE_MIMA = 13;
const OMAKE_HOLD_AUTO = 300;   //◆最後のスペルの前の待ちは、answer（input.ogo）が来なければ 300 tick で始める（client は場面の間 sim を止める）
const OMAKE_PAGE_R = 30;   //◆頁に触れて拾う半径
//◆魔理沙と魅魔のカードの表ここから
//◆魔理沙のスペルカード（4 枚）。星・星の渦・レーザー・マスタースパーク
const MARISA_CARDS = [
  { id: "m_normal", t: 900, hp: 0.6 },   //◆通常：星の輪と狙いの星
  { id: "m_stardust", t: 1000, hp: 0.8 },   //◆魔符「スターダストレヴァリエ」：色とりどりの星が渦を巻く
  { id: "m_laser", t: 1000, hp: 0.85 },   //◆恋符「ノンディレクショナルレーザー」：回る予告つきのレーザー
  { id: "m_spark", t: 1200, hp: 0.9 },   //◆恋符「マスタースパーク」：太い光線と星の雨
];
//◆魅魔のスペルカード（4 枚）。最後がトワイライトスパーク。一周目は最後の前で止まる（F.hold）
const MIMA_CARDS = [
  { id: "x_normal", t: 900, hp: 0.6 },   //◆通常：紫の輪と狙い
  { id: "x_crescent", t: 1000, hp: 0.8 },   //◆三日月の杖：曲がる三日月の弾の扇
  { id: "x_lightdark", t: 1000, hp: 0.85 },   //◆光と闇：光の線と闇の線が交互に壁から来る
  { id: "x_twilight", t: 1200, hp: 0.9 },   //◆トワイライトスパーク：太い光線と光と闇の弾
];
//◆魔理沙と魅魔のカードの表ここまで
//◆階の作りと広間ここから
function omakeOf(state) { const o = state && state.opts ? state.opts.omake | 0 : 0; return o === 1 || o === 2 ? o : 0; }
function finCardsOf(F) { return F && F.id === "marisa" ? MARISA_CARDS : F && F.id === "mima" ? MIMA_CARDS : FIN_CARDS; }
//◆頁の番号（1..6）。階 1〜6 は階の数、7〜12 は逆順（7 → 6 … 12 → 1）。13 階は頁が無い（0）
function omakePageNo(n) { return n >= 1 && n <= 6 ? n : n >= 7 && n <= 12 ? 13 - n : 0; }
//◆ふつうの階（genFloor の結果 L）に、本当と嘘のハッチ・頁・地の文の種類を足す（L.hatchCands を 2 つにする）。
//◆本当と嘘は、遠い候補（genFloor が 6 個まで選ぶ）の中から hash32(seed, n, 0x0a11) で。左右に 3 マス以上離れた組を先に探す
function omakeHatches(L, seed, n) {
  const hc = L.hatchCands.slice(), H = hash32(seed, n, 0x0a11);
  let a = H % hc.length, b = -1;
  for (let k = 1; k < hc.length && b < 0; k++) { const j = (a + k * (1 + (H >>> 8) % 3)) % hc.length; if (j !== a && Math.abs(hc[j].x - hc[a].x) >= 3 * CELL) b = j; }
  if (b < 0) for (let j = 0; j < hc.length && b < 0; j++) if (j !== a && Math.abs(hc[j].x - hc[a].x) >= CELL) b = j;
  let real = hc[a], fake = b >= 0 ? hc[b] : { x: L.start.x + CELL * 3, y: L.start.y };
  if (b < 0 && real.x < fake.x + CELL && real.x > fake.x - CELL) fake = { x: real.x + CELL * 3, y: real.y };
  const side = real.x <= fake.x ? 0 : 1;
  //◆頁：本当のハッチのそば（床で、体が入る所）
  let pg = { x: real.x, y: real.y };
  const test = { gw: L.gw, gh: L.gh, grid: L.grid };
  const offs = [[1.6, 0], [-1.6, 0], [0, 1.6], [0, -1.6], [1.6, 1.6], [-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6]];
  const o0 = (H >>> 4) % offs.length;
  for (let k = 0; k < offs.length; k++) { const o = offs[(o0 + k) % offs.length], x = real.x + o[0] * CELL, y = real.y + o[1] * CELL; if (!hitsWall(test, x, y, 12)) { pg = { x, y }; break; } }
  L.hatchCands = [{ x: real.x, y: real.y }, { x: fake.x, y: fake.y }];
  const R = hash32(seed, n, 0x0a12);
  L.oh = { rx: real.x, ry: real.y, fx: fake.x, fy: fake.y, px: pg.x, py: pg.y, side, pg: omakePageNo(n), nk: R & 3, ni: (R >>> 2) & 0xffff, got: 0 };
  return L;
}
//◆魔理沙・魅魔の広間（決戦の広間と同じ作り。npc＝ボスが立つ上の真ん中。ハッチは真ん中で、勝つ（通る）と開く）。頁は 7 階の広間にだけ落ちている
function genOmakeArena(seed, n) {
  const L = genFinal(seed, n);
  if (n === OMAKE_MARISA) {
    const p = omakePageNo(n), c = L.hatchCands[0];
    L.oh = { rx: c.x, ry: c.y, fx: c.x, fy: c.y, px: c.x + CELL * 3, py: c.y + CELL * 2, side: 0, pg: p, nk: 3, ni: 0, got: 0, arena: 1 };
  }
  return L;
}
function omakeGo(state) {
  const F = state.sf, e = finBoss(state);
  if (!F || !F.hold) return false;
  F.hold = 0; F.ct = state.tick; if (e) e.invUntil = state.tick + FIN_DECLARE;
  ev(state, ["cardgo", F.card]);
  return true;
}
function omakeWin(state, e) {
  const F = state.sf, R = state.run;
  F.st = 2; F.won = 1; F.yx = e.x; F.yy = e.y; F.fam = [];
  e.gone = 1; e.hp = 0;
  state.ebullets = []; state.zones = [];
  R.omakeWin = (R.omakeWin | 0) | (F.id === "marisa" ? 1 : 2); R.bossKills = (R.bossKills | 0) + 1;
  openHatch(state);
  ev(state, ["omakeWin", F.id, F.cap]);
}
//◆階の作りと広間ここまで
//◆頁・光線・弾幕ここから
//◆頁に触れたら拾う（毎 tick）。["opage", 頁の番号]
function stepOmake(state) {
  const oh = state.oh, p = state.players[0];
  if (!oh || oh.got || !p || !isAlive(p) || state.phase === PHASE.TRANSIT) return;
  if (dist2(p.x, p.y, oh.px, oh.py) <= OMAKE_PAGE_R * OMAKE_PAGE_R) { oh.got = 1; ev(state, ["opage", oh.pg]); }
}
//◆光線（細かい違いは予告の長さ・幅だけ。act 0＝降りてくる客なし）。ms＝マスタースパーク風（client が白い光線で描く）
function omakeLine(state, x, y, ang, warn, beam, w, ms) {
  const F = state.sf, len = 900, x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len, wt = Math.max(FIN_WARN_MIN, warn | 0);
  const z = addZone(state, ZONE_KIND.LINE, x, y, w / 2, wt + beam, 0, 0, 0, null);
  z.fin = 1; z.x2 = x2; z.y2 = y2; z.w = w; z.on = state.tick + wt; z.ms = ms ? 1 : 0; z.c = F && F.id === "mima" ? 1 : 0;
  return z;
}
//◆魔理沙・魅魔のカードの弾幕（u = 宣言が終わってからの tick。色 c：8 黄の星・9 青の星・10 桃の星・11 三日月。4 光・5 闇）
function omakePattern(state, e, u, id, p) {
  const F = state.sf, W = F.x1 - F.x0, H = F.y1 - F.y0, cx_ = (F.x0 + F.x1) / 2, TAU_ = Math.PI * 2;
  const away = () => finGlide(e, F.x0 + 110 + fr(state, 1) * (W - 220), F.yy + (fr(state, 2) - 0.5) * 70, 70);
  if (id === "m_normal") {
    if (u % 120 === 0) away();
    if (u % 18 === 0) { F.k++; finRing(state, e.x, e.y, 12, F.k & 1 ? 110 : 80, F.k * 0.31, e.r, 0, 0, FIN_HR, F.k & 1 ? 8 : 9, 0, 0, FIN_SAFE_BODY); }
    if (u % 40 === 20 && p) finAimed(state, e.x, e.y, p.x, p.y, 3, 16, 170, 3, 8, e.r, FIN_SAFE_BODY);
  } else if (id === "m_stardust") {
    if (u % 3 === 0) { const a0 = 0.0002 * u * u + u * 0.012; for (let k = 0; k < 4; k++) { const a = a0 + k * TAU_ / 4; finShot(state, e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r, a, 95, 0, 0, 0, FIN_HR, 8 + ((u / 3 + k) % 3), FIN_SAFE_BODY); } }
    if (u % 70 === 35) finRing(state, e.x, e.y, 16, 55, fr(state, 4) * TAU_, e.r, 1, 0, FIN_HR, 9, 0, 0, FIN_SAFE_BODY);
    if (u % 150 === 75) away();
  } else if (id === "m_laser") {
    if (u % 100 === 10) {   //◆3 本の予告つきレーザー。回しながら
      F.k++;
      const base = F.k * 0.55 + fr(state, 6) * 0.4;
      for (let k = 0; k < 3; k++) omakeLine(state, e.x, e.y, base + k * TAU_ / 3, 30, 14, 24, 0);
    }
    if (u % 50 === 25) finRing(state, e.x, e.y, 10, 75, fr(state, 7) * TAU_, e.r, 0, 0, FIN_HR, 8, 0, 0, FIN_SAFE_BODY);
    if (u % 45 === 0 && p) finAimed(state, e.x, e.y, p.x, p.y, 2, 10, 150, 3, 9, e.r, FIN_SAFE_BODY);
    if (u % 160 === 80) away();
  } else if (id === "m_spark") {
    if (u % 160 === 20 && p) {   //◆自機を狙う太い光線（予告は 40 tick）。後ろの 2 本は少し遅れて両脇から
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      omakeLine(state, e.x, e.y, a, 40, 16, 58, 1);
      omakeLine(state, e.x, e.y, a + 0.42, 56, 12, 38, 1);
      omakeLine(state, e.x, e.y, a - 0.42, 56, 12, 38, 1);
    }
    if (u % 8 === 0) finShot(state, F.x0 + 14 + fr(state, 8 + (u >> 3) % 7) * (W - 28), F.y0 + 6, Math.PI / 2, 80, 0, 0, 0, FIN_HR, 8 + (u >> 3) % 3);
    if (u % 60 === 40) finRing(state, e.x, e.y, 8, 70, u * 0.1, e.r, 0, 0, FIN_HR, 9, 0, 0, FIN_SAFE_BODY);
    if (u % 160 === 100) away();
  } else if (id === "x_normal") {
    if (u % 120 === 0) away();
    if (u % 16 === 0) { F.k++; finRing(state, e.x, e.y, 14, F.k & 1 ? 105 : 80, F.k * 0.27, e.r, 0, 0, FIN_HR, 10, 0, 0, FIN_SAFE_BODY); }
    if (u % 36 === 18 && p) finAimed(state, e.x, e.y, p.x, p.y, 5, 12, 160, 3, 1, e.r, FIN_SAFE_BODY);
  } else if (id === "x_crescent") {
    if (u % 34 === 0 && p) {   //◆三日月＝曲がる弾の扇（左右から巻き込む）
      const base = Math.atan2(p.y - e.y, p.x - e.x), sg = (u / 34) & 1 ? 1 : -1;
      for (let k = 0; k < 9; k++) { const a = base + (k - 4) * 0.17; finShot(state, e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r, a, 120, 0, sg * 0.014, 0, FIN_HR, 11, FIN_SAFE_BODY); }
    }
    if (u % 68 === 50) finRing(state, e.x, e.y, 12, 70, fr(state, 9) * TAU_, e.r, 0, 0, FIN_HR, 10, 0, 0, FIN_SAFE_BODY);
    if (u % 150 === 75) away();
  } else if (id === "x_lightdark") {
    if (u % 40 === 0) finNet(state, (u / 40) % 4, fr(state, 3));
    if (u % 24 === 12) finRing(state, e.x, e.y, 10, 70, u * 0.17, e.r, 0, 0, FIN_HR, (u / 24) & 1 ? 4 : 5, 0, 0, FIN_SAFE_BODY);
    if (u % 150 === 75) away();
  } else if (id === "x_twilight") {
    if (u % 150 === 20 && p) {
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      omakeLine(state, e.x, e.y, a, 40, 16, 60, 1);
      omakeLine(state, e.x, e.y, a + Math.PI * 0.5, 60, 12, 30, 1);
      omakeLine(state, e.x, e.y, a - Math.PI * 0.5, 60, 12, 30, 1);
    }
    if (u % 20 === 0) finRing(state, e.x, e.y, 10, 72, u * 0.09, e.r, 0, 0, FIN_HR, (u / 20) & 1 ? 4 : 5, 0, 0, FIN_SAFE_BODY);
    if (u % 90 === 60 && p) finAimed(state, e.x, e.y, p.x, p.y, 3, 14, 150, 5, 10, e.r, FIN_SAFE_BODY);
    if (u % 160 === 100) away();
  }
}

//◆頁・光線・弾幕ここまで
