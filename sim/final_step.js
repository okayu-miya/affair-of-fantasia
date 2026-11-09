//◆決戦の動き（紫の AI・弾と光線とスキマ・カードごとの弾幕・毎 tick） : 2.10.10参照
//◆紫の動きと弾の出し方ここから
//◆紫の動き（enemyAI から）：スキマの転移（st 4）・目当て（tx, ty）へ滑る・体に触れたら 1 発
function finalAI(state, e, t) {
  const tick = state.tick;
  if (e.st === 4) { e.vf |= EFLAGS.HIDDEN; if (tick - e.stTick >= e.n3) { e.x = e.tx; e.y = e.ty; e.px = e.x; e.py = e.y; e.st = 0; e.stTick = tick; } return; }
  const dx = e.tx - e.x, dy = e.ty - e.y, d = Math.sqrt(dx * dx + dy * dy);
  if (d > 0.01) { const s = Math.min(d, e.n1 > 0 ? e.n1 : d); e.x += dx / d * s; e.y += dy / d * s; e.vf |= EFLAGS.MOVING; }
  const rr = Math.max(e.r * 0.6 + FIN_CORE, e.r + FIN_SAFE_BODY);   //◆寄り添うと当たる（56px）
  if (t && isAlive(t) && dist2(t.x, t.y, e.x, e.y) < rr * rr) finHit(state, t, e.x, e.y);
}
//◆決戦の弾。acc = 1 tick ごとの速さの足し、turn = 1 tick ごとに曲がる角、wait = 動き出すまでの tick（止まったまま当たる）、hr = 当たりの半径、c = 色と形（client）。
//◆広間の外・自機の FIN_SAFE 以内・上限（FIN_EBULLETS）では出さない。速さは FIN_SPD_MIN..FIN_SPD_MAX
function finShot(state, x, y, a, sp, acc, turn, wait, hr, c, safe) {
  const F = state.sf, p = state.players[0];
  if (!F || state.ebullets.length >= FIN_EBULLETS) return null;
  if (!(x >= F.x0 + 2 && x <= F.x1 - 2 && y >= F.y0 + 2 && y <= F.y1 - 2)) return null;
  const sd = safe > 0 ? safe : FIN_SAFE;   //◆紫の体から出る弾は FIN_SAFE_BODY
  if (p && isAlive(p) && dist2(x, y, p.x, p.y) < sd * sd) return null;   //◆公平：自機のすぐそばに湧かせない
  sp = clamp(sp, FIN_SPD_MIN, FIN_SPD_MAX);
  const b = { id: state.nextId++, x, y, px: x, py: y, dx: Math.cos(a) * sp, dy: Math.sin(a) * sp, speed: sp, life: FIN_LIFE, kind: 0, gyo: null,
    acc: acc || 0, turn: turn || 0, wait: wait | 0, hr: hr > 0 ? hr : FIN_HR, c: c | 0 };
  state.ebullets.push(b);
  return b;
}
//◆輪（n は FIN_RING_MAX まで。自機の 64px の所でも隙間は 2 × (芯 + hr) + 8 より広い）。r0 = 中心からの半径、inward = 中心へ向けて撃つ、turn = みな同じだけ曲がる（輪は渦になるが隙間は変わらない）
function finRing(state, x, y, n, sp, ph, r0, acc, wait, hr, c, inward, turn, safe) {
  n = Math.min(FIN_RING_MAX, Math.max(1, n | 0));
  for (let k = 0; k < n; k++) { const a = ph + k * Math.PI * 2 / n; finShot(state, x + Math.cos(a) * r0, y + Math.sin(a) * r0, inward ? a + Math.PI : a, sp, acc, turn || 0, wait, hr, c, safe); }
}
//◆(tx, ty) を狙う ways 方向（広がり spread 度）。狙い撃ちの速さは FIN_AIM_MAX まで
function finAimed(state, x, y, tx, ty, ways, spread, sp, hr, c, r0, safe) {
  const base = Math.atan2(ty - y, tx - x);
  for (let k = 0; k < ways; k++) { const a = base + (k - (ways - 1) / 2) * spread * DEG; finShot(state, x + Math.cos(a) * r0, y + Math.sin(a) * r0, a, Math.min(sp, FIN_AIM_MAX), 0, 0, 0, hr, c, safe); }
}
//◆光線（電車）：warn tick の予告（FIN_WARN_MIN 以上）の後、beam tick だけ幅 w で当たる。消えた時に線の上へ乗客の弾（act 2）
function finLine(state, x, y, x2, y2, warn, beam, w) {
  const wt = Math.max(FIN_WARN_MIN, warn | 0);
  const z = addZone(state, ZONE_KIND.LINE, x, y, w / 2, wt + beam, 0, 0, 2, null);
  z.fin = 1; z.x2 = x2; z.y2 = y2; z.w = w; z.on = state.tick + wt;
  return z;
}
//◆スキマ：warn tick 開いてから、(tx, ty)（開いた時の自機の所）へ n 方向を every tick おきに vol 回
function finGap(state, x, y, tx, ty, warn, vol, every, n, spread, sp, c) {
  const wt = Math.max(FIN_WARN_MIN, warn | 0);
  const z = addZone(state, ZONE_KIND.GAP, x, y, 18, wt + (vol - 1) * every + 14, 0, every, 0, null);
  z.fin = 1; z.on = state.tick + wt; z.nextTick = z.on; z.tx = tx; z.ty = ty; z.vol = vol; z.n = n; z.spr = spread; z.sp = sp; z.c = c;
  return z;
}
//◆点 (px, py) と線分の距離
function segPtDist(x0, y0, x1, y1, px, py) {
  const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy;
  let t = l2 > 1e-9 ? ((px - x0) * dx + (py - y0) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return dist(x0 + dx * t, y0 + dy * t, px, py);
}
//◆stepZones から（z.fin）。残すなら true
function stepFinZone(state, z) {
  const tick = state.tick, p = state.players[0];
  if (z.kind === ZONE_KIND.LINE) {
    if (tick >= z.until) { if (z.act === 2) finRiders(state, z); return false; }
    if (tick >= z.on && p && isAlive(p) && segPtDist(z.x, z.y, z.x2, z.y2, p.x, p.y) < z.w / 2 + FIN_CORE) finHit(state, p, p.x, p.y);
    return true;
  }
  if (z.kind === ZONE_KIND.GAP && z.vol > 0 && tick >= z.nextTick) {
    finAimed(state, z.x, z.y, z.tx, z.ty, z.n, z.spr, z.sp, FIN_HR, z.c, 0);
    z.vol--; z.nextTick = tick + z.everyTick;
  }
  return tick < z.until;
}
//◆電車が通り過ぎた線路に、降りた乗客（線の両側へゆっくり歩き出す弾）
function finRiders(state, z) {
  const dx = z.x2 - z.x, dy = z.y2 - z.y, n = Math.floor(Math.sqrt(dx * dx + dy * dy) / 40), a = Math.atan2(dy, dx);
  for (let i = 1; i < n; i++) { const x = z.x + dx * i / n, y = z.y + dy * i / n; finShot(state, x, y, a - Math.PI / 2, 50, 2, 0, 10, FIN_HR, 3); finShot(state, x, y, a + Math.PI / 2, 50, 2, 0, 10, FIN_HR, 3); }
}
//◆結界の線：side 0 上・1 左・2 下・3 右の壁から、向かいへ進む弾の線。g（0..1）の所に FIN_NET_GAP の抜け道
function finNet(state, side, g) {
  const F = state.sf, hz = side === 0 || side === 2, lo = (hz ? F.x0 : F.y0) + 12, hi = (hz ? F.x1 : F.y1) - 12;
  const gc = lo + 30 + g * (hi - lo - 60), a = [Math.PI / 2, 0, -Math.PI / 2, Math.PI][side];
  const at = side === 0 ? F.y0 + 10 : side === 1 ? F.x0 + 10 : side === 2 ? F.y1 - 10 : F.x1 - 10;
  for (let s = lo; s <= hi; s += FIN_NET_SP) {
    if (Math.abs(s - gc) < FIN_NET_GAP / 2) continue;
    finShot(state, hz ? s : at, hz ? at : s, a, 72, 0, 0, 14, FIN_HR, side & 1 ? 5 : 4);
  }
}
//◆紫の動きと弾の出し方ここまで
//◆毎 tick の流れとカードの弾幕ここから
//◆毎 tick（step の stepWaves の後）：待ち（FIN_AUTO で自動）・カードの時間切れ・弾幕
function stepFinal(state) {
  const F = state.sf;
  if (!F || state.phase !== PHASE.FIGHT) return;
  const tick = state.tick;
  if (F.st === 0) { if (tick - F.t0 >= FIN_AUTO) { if (F.id === "extra") extraGift(state, 1); else finStart(state, 1); } return; }
  if ((F.id !== "final" && F.id !== "marisa" && F.id !== "mima") || F.st !== 1) return;
  const e = finBoss(state);
  if (!e) return;
  if (F.hold) {   //◆最後のスペルの前の待ち（client が ogo を送る。送られなければ OMAKE_HOLD_AUTO tick で始める＝ボット・テスト） : 2.10.11参照
    F.ct = tick; e.invUntil = tick + FIN_DECLARE;
    if (tick - F.ht >= OMAKE_HOLD_AUTO) omakeGo(state);
    return;
  }
  for (let i = 0; i < F.fam.length; i++) { F.fam[i].px = F.fam[i].x; F.fam[i].py = F.fam[i].y; }
  const el = tick - F.ct;
  if (el >= F.tm) { finNext(state, e, 0); return; }
  if (el >= FIN_DECLARE) finPattern(state, e, el - FIN_DECLARE);
}
//◆カードの弾幕（u = 宣言が終わってからの tick）
function finPattern(state, e, u) {
  const F = state.sf, id = finCardsOf(F)[F.card].id, p0 = state.players[0], p = p0 && isAlive(p0) ? p0 : null;
  if (F.id !== "final") { omakePattern(state, e, u, id, p); return; }   //◆魔理沙・魅魔 : 2.10.11参照
  const W = F.x1 - F.x0, H = F.y1 - F.y0, cx_ = (F.x0 + F.x1) / 2, cy_ = (F.y0 + F.y1) / 2, TAU = Math.PI * 2, vis = e.st !== 4;
  if (id === "normal") {
    if (u % 120 === 0) finGlide(e, F.x0 + 110 + fr(state, 1) * (W - 220), F.yy + (fr(state, 2) - 0.5) * 60, 70);
    if (u % 14 === 0) { F.k++; finRing(state, e.x, e.y, 16, F.k & 1 ? 120 : 88, F.k * Math.PI / 21, e.r, 0, 0, FIN_HR, 0, 0, 0, FIN_SAFE_BODY); }
    if (u % 36 === 18 && p) finAimed(state, e.x, e.y, p.x, p.y, 3, 14, 170, 3, 1, e.r, FIN_SAFE_BODY);
  } else if (id === "wave") {
    if (u % 2 === 0) { const a0 = 0.00024 * u * u; for (let k = 0; k < 5; k++) { const a = a0 + k * TAU / 5; finShot(state, e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r, a, 105, 0, 0, 0, FIN_HR, 2, FIN_SAFE_BODY); } }
    if (u % 90 === 45 && p) finAimed(state, e.x, e.y, p.x, p.y, 1, 0, 120, 7, 1, e.r, FIN_SAFE_BODY);
  } else if (id === "net") {
    if (u % 36 === 0) finNet(state, (u / 36) % 4, fr(state, 3));
    if (u % 60 === 30) finRing(state, e.x, e.y, 12, 70, fr(state, 4) * TAU, e.r, 0, 0, FIN_HR, 3, 0, 0, FIN_SAFE_BODY);
    if (u % 150 === 75) finGlide(e, F.x0 + 140 + fr(state, 5) * (W - 280), F.yy, 60);
  } else if (id === "ran") {
    if (!F.fam.length) F.fam.push({ x: e.x, y: e.y, px: e.x, py: e.y, sx: e.x, sy: e.y, tx: e.x, ty: e.y });
    const f = F.fam[0], q = u % 40;
    if (q === 0) {   //◆次の行き先（今の所から 150px 以上）
      let tx = F.x0 + 48 + fr(state, 10) * (W - 96), ty = F.y0 + 48 + fr(state, 20) * (H - 96);
      for (let k = 1; k < 6 && dist(tx, ty, f.x, f.y) < 150; k++) { tx = F.x0 + 48 + fr(state, 10 + k) * (W - 96); ty = F.y0 + 48 + fr(state, 20 + k) * (H - 96); }
      f.sx = f.x; f.sy = f.y; f.tx = tx; f.ty = ty;
    }
    if (q < 24) {   //◆駆ける（なめらかに）。2 tick ごとに進む向きの左右へ弾を置く（しばらく止まってから走り出す）
      const k = (q + 1) / 24, s = k * k * (3 - 2 * k), d = Math.atan2(f.ty - f.sy, f.tx - f.sx);
      f.x = f.sx + (f.tx - f.sx) * s; f.y = f.sy + (f.ty - f.sy) * s;
      if (q % 2 === 0) { finShot(state, f.x, f.y, d - Math.PI / 2, 50, 3, 0, 18, FIN_HR, 6); finShot(state, f.x, f.y, d + Math.PI / 2, 50, 3, 0, 18, FIN_HR, 6); }
    }
    if (q === 26) finRing(state, f.x, f.y, 12, 70, fr(state, 30) * TAU, 8, 2, 8, FIN_HR, 6, 0, ((u / 40) & 1 ? 1 : -1) * 0.02);   //◆止まった所で渦を巻く輪（右回り・左回りを交互に）
    if (u % 50 === 25 && p) finAimed(state, e.x, e.y, p.x, p.y, 5, 12, 150, 3, 1, e.r, FIN_SAFE_BODY);
    if (u % 60 === 55) finRing(state, e.x, e.y, 16, 75, fr(state, 32) * TAU, e.r, 0, 0, FIN_HR, 0, 0, 0, FIN_SAFE_BODY);
    if (u % 160 === 80) finGlide(e, F.x0 + 140 + fr(state, 31) * (W - 280), F.yy, 60);
  } else if (id === "train") {
    if (u % 40 === 0 && p) {   //◆自機の近くを通る線路（横と縦を交互に。どちらの端から来るかは fr）
      const j = (fr(state, 40) - 0.5) * 80, fwd = fr(state, 41) < 0.5;
      if (((u / 40) & 1) === 0) { const y = clamp(p.y + j, F.y0 + 20, F.y1 - 20); finLine(state, fwd ? F.x0 : F.x1, y, fwd ? F.x1 : F.x0, y, 24, 14, 30); }
      else { const x = clamp(p.x + j, F.x0 + 20, F.x1 - 20); finLine(state, x, fwd ? F.y0 : F.y1, x, fwd ? F.y1 : F.y0, 24, 14, 30); }
    }
    if (u % 40 === 20) finRing(state, e.x, e.y, 12, 85, fr(state, 42) * TAU, e.r, 0, 0, FIN_HR, 0, 0, 0, FIN_SAFE_BODY);
    if (u % 180 === 90) finGlide(e, F.x0 + 140 + fr(state, 43) * (W - 280), F.yy, 80);
  } else if (id === "hide") {
    if (u % 140 === 70 && vis) {   //◆スキマに消えて、上の方の別の所（自機から 140px 以上）へ
      let x = F.x0 + 80 + fr(state, 44) * (W - 160), y = F.y0 + 60 + fr(state, 45) * 120;
      for (let k = 1; k < 6 && p && dist(x, y, p.x, p.y) < 140; k++) { x = F.x0 + 80 + fr(state, 44 + 2 * k) * (W - 160); y = F.y0 + 60 + fr(state, 45 + 2 * k) * 120; }
      e.st = 4; e.stTick = state.tick; e.n3 = 30; e.tx = x; e.ty = y; e.n1 = 0;
    }
    if (u % 32 === 0 && p) {   //◆自機の周り（150〜190px）に 4 つのスキマ。開いた時の自機の所を 2 回撃つ
      const base = fr(state, 50) * TAU;
      for (let k = 0; k < 4; k++) {
        const a = base + k * TAU / 4, r = 150 + fr(state, 51 + k) * 40;
        const gx = clamp(p.x + Math.cos(a) * r, F.x0 + 24, F.x1 - 24), gy = clamp(p.y + Math.sin(a) * r, F.y0 + 24, F.y1 - 24);
        if (dist2(gx, gy, p.x, p.y) >= (FIN_SAFE + 32) * (FIN_SAFE + 32)) finGap(state, gx, gy, p.x, p.y, 22, 2, 10, 3, 10, 95, 7);
      }
    }
    if (u % 40 === 20 && vis) finRing(state, e.x, e.y, 14, 80, fr(state, 55) * TAU, e.r, 0, 0, FIN_HR, 0, 0, 0, FIN_SAFE_BODY);
  } else if (id === "barrier") {
    const iv = u < 540 ? 72 : 56;   //◆後半は輪が速く来る
    if (u % iv === 0 && p) finRing(state, p.x, p.y, 16, 50, fr(state, 60) * TAU, 205, 3, 30, FIN_HR, 0, 1);   //◆自機を囲む輪：止まってから内へ
    if (u % iv === iv / 2) finRing(state, cx_, cy_, 16, 60, fr(state, 61) * TAU, 225, 3, 24, FIN_HR, 2, 1);   //◆広間いっぱいの輪：止まってから内へ
    if (u % 24 === 12) finRing(state, e.x, e.y, 8, 65, u * 0.13, e.r, 0, 0, FIN_HR, 3, 0, 0, FIN_SAFE_BODY);   //◆紫から外へゆっくり
  }
}
//◆毎 tick の流れとカードの弾幕ここまで
//◆決戦の弾を進めるここから
//◆決戦の弾を進める（stepEBullets から）。待ち → 曲がり・加速（速さは 50..220）→ 広間の外で消える。当たりは線分で見る（芯 + hr）
function stepFinBullets(state, dt) {
  const F = state.sf, keep = [], p = state.players[0], tick = state.tick, src = state.ebullets;
  let hitOk = !!(p && isAlive(p) && tick >= p.invulnUntil);
  for (let i = 0; i < src.length; i++) {
    const b = src[i], px = b.x, py = b.y;
    if ((b.wait | 0) > 0) b.wait--;
    else {
      if (b.turn) { const c = Math.cos(b.turn), s = Math.sin(b.turn), dx = b.dx * c - b.dy * s; b.dy = b.dx * s + b.dy * c; b.dx = dx; }
      if (b.acc) { const sp = clamp(b.speed + b.acc, FIN_SPD_MIN, FIN_SPD_MAX), k = sp / (b.speed || sp); b.dx *= k; b.dy *= k; b.speed = sp; }
      b.x += b.dx * dt; b.y += b.dy * dt;
    }
    if (--b.life <= 0 || b.x < F.x0 - 8 || b.x > F.x1 + 8 || b.y < F.y0 - 8 || b.y > F.y1 + 8) continue;
    if (hitOk && segCircleT(px, py, b.x, b.y, p.x, p.y, FIN_CORE + (b.hr || FIN_HR)) >= 0) {
      finHit(state, p, px, py);
      hitOk = isAlive(p) && tick >= p.invulnUntil;
      continue;
    }
    keep.push(b);
  }
  if (state.ebullets === src) state.ebullets = keep;   //◆被弾の倍返し（特性）でカードが割れた時は、次のカードの空の列のまま（前のカードの弾を戻さない）
}


//◆決戦の弾を進めるここまで
