//◆敵の追い方（chase）・掘る敵（digger）・石積み・戦い方（掘る・置く）の動き : 2.10.19参照
//◆追う・掘るここから
function chase(state, e, tx, ty, speed, dt, noTurn) {
  const dx = tx - e.x, dy = ty - e.y, d = Math.sqrt(dx * dx + dy * dy);
  if (d < 1e-4) return;
  if (!e.boss) speed *= rushMul(state);
  if (e.buffUntil > state.tick) speed *= 1.25;                       //◆warden の鼓舞
  const sp = state.players[0], sa = sp ? (sp.stats.slowAura | 0) : 0;   //◆slowAura スキル：自機から 160px 内の敵は遅く
  if (sa > 0 && isAlive(sp) && dist2(e.x, e.y, sp.x, sp.y) < SLOW_AURA_R * SLOW_AURA_R) speed *= 1 - sa / 100;
  const u = e.beh === "phaser" ? [dx / d, dy / d] : steerFor(state, e, dx, dy, d);
  const stepLen = Math.min(d, speed * dt);
  let nx = e.x + u[0] * stepLen, ny = e.y + u[1] * stepLen;
  if (e.beh !== "phaser" && hitsWall(state, nx, ny, e.r)) {
    if (u[0] !== 0 && !hitsWall(state, e.x + u[0] * stepLen, e.y, e.r)) { nx = e.x + u[0] * stepLen; ny = e.y; }
    else if (u[1] !== 0 && !hitsWall(state, e.x, e.y + u[1] * stepLen, e.r)) { nx = e.x; ny = e.y + u[1] * stepLen; }
    else {
      const ccx = Math.floor(e.x / CELL) * CELL + CELL / 2, ccy = Math.floor(e.y / CELL) * CELL + CELL / 2;
      const rx = ccx - e.x, ry = ccy - e.y, rd = Math.sqrt(rx * rx + ry * ry);
      nx = e.x; ny = e.y;
      if (rd > 0.5) { const s2 = Math.min(rd, stepLen), tx2 = e.x + rx / rd * s2, ty2 = e.y + ry / rd * s2; if (!hitsWall(state, tx2, ty2, e.r)) { nx = tx2; ny = ty2; } }
      if (nx === e.x && ny === e.y) {
        for (let k = 0; k < 8; k++) { const a2 = k * (Math.PI / 4), tx3 = e.x + Math.cos(a2) * stepLen, ty3 = e.y + Math.sin(a2) * stepLen; if (!hitsWall(state, tx3, ty3, e.r)) { nx = tx3; ny = ty3; break; } }
      }
    }
  }
  if (nx !== e.x || ny !== e.y) e.vf |= EFLAGS.MOVING;
  e.x = nx; e.y = ny;
  if (!noTurn) turnTo(e, Math.atan2(u[1], u[0]));
}
function lineClear(state, x1, y1, x2, y2, r) { return !segHitsWall(state, x1, y1, x2, y2, r); }

//◆digger：追えないときは標的の向きの隣の岩を掘る
function diggerAI(state, e, t, dt) {
  if (!t) return;
  const tick = state.tick, dx = t.x - e.x, dy = t.y - e.y;
  const seeLine = !segHitsWall(state, e.x, e.y, t.x, t.y, e.r);
  if (seeLine || e.digBudget <= 0 || flowDir(state, e)) { chase(state, e, t.x, t.y, e.speed, dt); return; }
  const exi = Math.floor(e.x / CELL), eyi = Math.floor(e.y / CELL);
  const ax = dx > 0 ? 1 : -1, ay = dy > 0 ? 1 : -1;
  const first = Math.abs(dx) >= Math.abs(dy);
  const cands = first ? [[exi + ax, eyi], [exi, eyi + ay]] : [[exi, eyi + ay], [exi + ax, eyi]];
  for (let i = 0; i < cands.length; i++) {
    const tx = cands[i][0], ty = cands[i][1], b = blockAt(state, tx, ty);
    if (b === 0) { chase(state, e, tx * CELL + CELL / 2, ty * CELL + CELL / 2, e.speed, dt); return; }   //◆空いている隣へ進む
    //◆岩盤・宝箱・木箱・掘れない硬さ（堅岩）は掘らない。石積みの置き土は掘る
    if (!styleDiggable(b, null, 0)) continue;
    e.vf |= EFLAGS.DIGGING; e.aim = Math.atan2(dy, dx);
    if (tick - e.digAt >= DIGGER_EVERY) {
      e.digAt = tick;
      damageBlock(state, tx, ty, DIGGER_POW, 0);
      if (blockAt(state, tx, ty) === 0) e.digBudget--;
    }
    return;
  }
  chase(state, e, t.x, t.y, e.speed, dt);
}
//◆追う・掘るここまで
//◆石積みと戦い方ここから
//◆石積み（mason）：
//◆(b) 防ぐ … MASON_LOOK tick 以内に体へ届く自弾があれば、弾の通り道で体の手前のセルに土を置く（予算 MASON_PLACE_BUDGET・間隔 MASON_PLACE_CD）
//◆(a) 迫る … 標的が見えず、届かないか距離場の歩数が直線の 2 倍を超える遠回りなら、標的の向きの隣の岩を掘る（宝箱・木箱・岩盤・掘れない硬さは避ける）
//◆どちらも rnd を使わない（弾・敵は配列順に見る）
//◆中身は戦い方の styleAI（両方 = 3）。石積みは「両方」を必ず持つ敵
function masonAI(state, e, t, dt) {
  if (!styleAI(state, e, t, dt, (e.style | 0) || 3) && t) chase(state, e, t.x, t.y, e.speed, dt);
}
//◆戦い方（s = e.style）の AI。行動の前に呼び、この tick を使ったら true（ふだんの行動は飛ばす）
//◆置く（s & 2）… masonGuard：飛んで来る自弾の手前に土（予算 STYLE_PLACE・間隔 STYLE_CD）
//◆掘る（s & 1）… 標的が見えず、届かないか遠回り（masonWantsDig）なら標的の向きの隣の岩を掘る（予算 STYLE_DIG・DIGGER_EVERY ごと）
//◆置いた直後（間隔の間）は掘らない：自分の土の陰に隠れてから掘り抜いて迫る（細い坑道で置いてすぐ壊すのを防ぐ）。digger は自分の掘り方を使う
function styleAI(state, e, t, dt, s) {
  const tick = state.tick, placeAt = isNum(e.placeAt) ? e.placeAt : -999, cd = STYLE_CD[s] || MASON_PLACE_CD;
  if (s & 2) {
    if (tick - placeAt < MASON_BUILD_SHOW) e.vf |= EFLAGS.BUILD;
    if ((e.placeBudget | 0) > 0 && tick - placeAt >= cd && masonGuard(state, e)) return true;
  }
  if (!(s & 1) || !t || e.beh === "digger") return false;
  if (tick < (isNum(e.sOff) ? e.sOff : -1)) { e.sGo = 0; return false; }   //◆諦めて休む間（STYLE_REST_T）はふだんの行動
  //◆詰まりの見張り：STYLE_STUCK_T tick ごとに位置を控え、6px も動いていなければ「詰まっている」（大きい体が狭い隙間の先へ行けない・角に引っかかる等。
  //◆距離場では届くが体が通れない時も、見えない標的へ掘る理由になる）
  if (tick - (isNum(e.sT) ? e.sT : -1e9) >= STYLE_STUCK_T) { e.sStk = e.speed > 0 && isNum(e.sX) && dist(e.x, e.y, e.sX, e.sY) < 6 ? 1 : 0; e.sX = e.x; e.sY = e.y; e.sT = tick; }
  const dx = t.x - e.x, dy = t.y - e.y;
  if (((s & 2) && tick - placeAt < cd) || (e.digBudget | 0) <= 0 || !segHitsWall(state, e.x, e.y, t.x, t.y, e.r) || !(e.sStk || masonWantsDig(state, e, t))) { e.sGo = 0; e.sP = -1; return false; }
  //◆進み具合の見張り（e.sP = 最後に進んだ tick・(e.sPX, e.sPY) = その時の位置。sP -1 = 掘る番ではない）：今の標的から見て、その位置より
  //◆4px 以上寄ったか岩を叩けば進んだ（標的が寄って来た分は数えない）。STYLE_GIVEUP_T 進めなければ諦めて休む（続けて諦めるほど長く。岩を崩せたら数え直す）
  if (!(e.sP >= 0) || dist(e.sPX, e.sPY, t.x, t.y) - dist(e.x, e.y, t.x, t.y) >= 4) { e.sP = tick; e.sPX = e.x; e.sPY = e.y; }
  else if (tick - e.sP >= STYLE_GIVEUP_T) { const n = Math.min(3, e.sN | 0); e.sN = n + 1; e.sOff = tick + STYLE_REST_T * (1 << n); e.sGo = 0; e.sP = -1; return false; }
  if (e.r > STYLE_SLIM) return styleDigWide(state, e, dx, dy, dt);   //◆1 マスの坑道に入らない体
  const gw = state.gw | 0, exi = Math.floor(e.x / CELL), eyi = Math.floor(e.y / CELL);
  //◆行き先（掘る・進む隣のセル）は着くまで変えない（斜めの標的で x と y の向きが毎 tick 入れ替わって揺れるのを防ぐ）
  let gx = -1, gy = -1;
  if ((e.sGo | 0) > 0) {
    const k = (e.sGo | 0) - 1;
    gx = k % gw; gy = (k - gx) / gw;
    const b = blockAt(state, gx, gy);
    if (Math.abs(gx - exi) + Math.abs(gy - eyi) > 1 || (b !== 0 && !styleDiggable(b, state, k))) gx = -1;
  }
  if (gx < 0) {
    const ax = dx > 0 ? 1 : -1, ay = dy > 0 ? 1 : -1;
    const cands = Math.abs(dx) >= Math.abs(dy) ? [[exi + ax, eyi], [exi, eyi + ay]] : [[exi, eyi + ay], [exi + ax, eyi]];
    for (let i = 0; i < cands.length && gx < 0; i++) { const b = blockAt(state, cands[i][0], cands[i][1]); if (b === 0 || styleDiggable(b, state, cands[i][1] * gw + cands[i][0])) { gx = cands[i][0]; gy = cands[i][1]; } }
    if (gx < 0) { e.sGo = 0; return false; }   //◆掘れる隣が無い（岩盤・宝箱・木箱・硬すぎる岩）：ふだんの行動（石積みは追う）
    e.sGo = gy * gw + gx + 1;
  }
  if (blockAt(state, gx, gy) === 0) {   //◆空いている隣へ進む（中心線へ寄ってから真っすぐ。chase は届かない所では角に引っかかる）
    if (!styleStepTo(state, e, gx, gy, dt)) { e.sGo = 0; chase(state, e, gx * CELL + CELL / 2, gy * CELL + CELL / 2, e.speed, dt); }
    return true;
  }
  e.vf |= EFLAGS.DIGGING; e.aim = Math.atan2(dy, dx);
  if (tick - (isNum(e.digAt) ? e.digAt : -999) >= DIGGER_EVERY) {
    e.digAt = tick; e.sP = tick;
    damageBlock(state, gx, gy, DIGGER_POW, 0);
    if (blockAt(state, gx, gy) === 0) { e.digBudget = (e.digBudget | 0) - 1; e.sN = 0; }
  }
  return true;
}
//◆敵が掘ってよい岩（土・石・硬岩。岩盤・宝箱・木箱・DIGGER_POW で割れない硬さは掘らない）。
//◆k（セルの番号）を渡すと、敵が置いた土（state.placed）も掘らない（味方の壁。寿命で崩れる）
function styleDiggable(b, state, k) {
  if (!(b >= BLOCK.DIRT && b < BLOCK.CHEST && BLOCK_DEF[b].minPow <= DIGGER_POW)) return false;
  const P = state && state.placed;
  if (Array.isArray(P)) for (let i = 0; i < P.length; i++) if (P[i][0] === k) return false;
  return true;
}
//◆石積み（と戦い方の「掘る」）が掘りたいか：自分のセルが距離場で届かない、または歩数が標的までのマンハッタン距離の 2 倍＋4 を超える
function masonWantsDig(state, e, t) {
  const f = state.flow, gw = state.gw | 0;
  if (!f) return true;
  const exi = Math.floor(e.x / CELL), eyi = Math.floor(e.y / CELL), txi = Math.floor(t.x / CELL), tyi = Math.floor(t.y / CELL);
  if (!inGrid(state, exi, eyi)) return false;
  const here = f[eyi * gw + exi];
  return here < 0 || here > (Math.abs(exi - txi) + Math.abs(eyi - tyi)) * 2 + 4;
}
//◆掘る予算（セル数）。1 マスの坑道に入らない大きい体は、同じ長さを掘れるよう体の幅（セル数）を掛ける
function styleDigBudget(s, r) { return (STYLE_DIG[s] | 0) * (r > STYLE_SLIM ? Math.ceil(2 * r / CELL + 0.5) : 1); }
//◆小さい体が隣のセル (gx, gy) の中心へ 1 tick 進む。通り道の中心線からずれていれば先に寄り、それから真っすぐ（行き過ぎない）。
//◆着いたら行き先（e.sGo）を消す。壁で動けなければ false
function styleStepTo(state, e, gx, gy, dt) {
  const stp = e.speed * dt;
  if (!(stp > 0)) return false;
  const tx = gx * CELL + CELL / 2, ty = gy * CELL + CELL / 2, exi = Math.floor(e.x / CELL), eyi = Math.floor(e.y / CELL);
  const alongX = gx !== exi ? true : gy !== eyi ? false : Math.abs(tx - e.x) >= Math.abs(ty - e.y);
  const mv = (d) => (d > 0 ? Math.min(d, stp) : Math.max(d, -stp));
  const off = alongX ? ty - e.y : tx - e.x;
  let nx = e.x, ny = e.y;
  if (Math.abs(off) > 1) { if (alongX) ny += mv(off); else nx += mv(off); }
  else if (alongX) { nx += mv(tx - e.x); ny = ty; }
  else { ny += mv(ty - e.y); nx = tx; }
  if (hitsWall(state, nx, ny, e.r)) return false;
  if (nx !== e.x || ny !== e.y) { e.vf |= EFLAGS.MOVING; turnTo(e, Math.atan2(ny - e.y, nx - e.x)); }
  e.x = nx; e.y = ny;
  if (Math.abs(e.x - tx) < 0.5 && Math.abs(e.y - ty) < 0.5) e.sGo = 0;   //◆着いた
  return true;
}
//◆大きい体（r > STYLE_SLIM）の「掘る」。標的の向き（主の軸 → 従の軸）へ 1 歩進み、塞がれていれば次の位置で体に当たる岩を
//◆1 つずつ掘る（中心線に近い物から。体の幅の坑道になる）。当たる岩に掘れない物（岩盤・宝箱・木箱・硬すぎる岩）があればその向きはやめる
function styleDigWide(state, e, dx, dy, dt) {
  const tick = state.tick, stp = e.speed * dt, gw = state.gw | 0;
  if (!(stp > 0)) return false;
  const hx = dx > 0 ? 1 : -1, hy = dy > 0 ? 1 : -1;
  //◆主の軸は、前に選んだ軸（e.sAx 1 = x・2 = y）をその向きの残りが半マスを切るまで続ける（L 字に掘る。斜めで毎 tick 入れ替わらない）
  const ax = (e.sAx === 1 && Math.abs(dx) > CELL / 2) || (e.sAx === 2 && Math.abs(dy) > CELL / 2) ? e.sAx : (Math.abs(dx) >= Math.abs(dy) ? 1 : 2);
  e.sAx = ax;
  const dirs = ax === 1 ? [[hx, 0], [0, hy]] : [[0, hy], [hx, 0]];
  for (let i = 0; i < 2; i++) {
    const sx = dirs[i][0], sy = dirs[i][1], nx = e.x + sx * stp, ny = e.y + sy * stp;
    if (!hitsWall(state, nx, ny, e.r)) { e.x = nx; e.y = ny; e.vf |= EFLAGS.MOVING; turnTo(e, Math.atan2(sy, sx)); return true; }
    const c0 = Math.floor((nx - e.r) / CELL), c1 = Math.floor((nx + e.r) / CELL), r0 = Math.floor((ny - e.r) / CELL), r1 = Math.floor((ny + e.r) / CELL);
    let best = -1, bd = 1e9, bad = false;
    for (let cyi = r0; cyi <= r1 && !bad; cyi++) for (let cxi = c0; cxi <= c1; cxi++) {
      if (!wallCell(state, cxi, cyi) || distToCell(nx, ny, cxi, cyi) >= e.r) continue;
      if (!styleDiggable(blockAt(state, cxi, cyi), state, cyi * gw + cxi)) { bad = true; break; }
      const off = sx ? Math.abs(cyi * CELL + CELL / 2 - e.y) : Math.abs(cxi * CELL + CELL / 2 - e.x);
      if (off < bd) { bd = off; best = cyi * gw + cxi; }
    }
    if (bad || best < 0) continue;
    const bx = best % gw, by = (best - bx) / gw;
    e.vf |= EFLAGS.DIGGING; e.aim = Math.atan2(dy, dx);
    if (tick - (isNum(e.digAt) ? e.digAt : -999) >= DIGGER_EVERY) {
      e.digAt = tick; e.sP = tick;
      damageBlock(state, bx, by, DIGGER_POW, 0);
      if (blockAt(state, bx, by) === 0) { e.digBudget = (e.digBudget | 0) - 1; e.sN = 0; }
    }
    return true;
  }
  return false;
}
//◆石積みの防御：最初に「危ない」自弾（state.bullets は id 順）の通り道へ土を置けたら true
function masonGuard(state, e) {
  if (!Array.isArray(state.placed)) state.placed = [];
  if (state.placed.length >= PLACED_MAX) return false;
  const bs = state.bullets, gw = state.gw | 0, rr = e.r + BULLET_R + 2;
  for (let i = 0; i < bs.length; i++) {
    const b = bs[i], vx = b.dx, vy = b.dy, v2 = vx * vx + vy * vy;
    if (!(v2 >= 1)) continue;
    const rx = e.x - b.x, ry = e.y - b.y, tc = (rx * vx + ry * vy) / v2;   //◆最接近の時刻（秒）
    if (tc <= 0) continue;
    const qx = rx - vx * tc, qy = ry - vy * tc, dm2 = qx * qx + qy * qy;
    if (dm2 >= rr * rr) continue;
    const v = Math.sqrt(v2), sHit = v * tc - Math.sqrt(rr * rr - dm2);        //◆弾が体に触れるまでの道のり（px）
    if (sHit < 10 || sHit > v * Math.min(MASON_LOOK, b.life | 0) * TICK_DT) continue;
    const ux = vx / v, uy = vy / v;
    if (segHitsWall(state, b.x, b.y, b.x + ux * sHit, b.y + uy * sHit, BULLET_R)) continue;   //◆もう岩が守っている
    //◆触れる点の 6px 手前から弾の側へ 8px 刻みで、最初に置けるセル（弾の中心線が通るので必ず当たる）
    let last = -1;
    for (let s = sHit - 6; s >= 0; s -= 8) {
      const cxi = Math.floor((b.x + ux * s) / CELL), cyi = Math.floor((b.y + uy * s) / CELL), k = cyi * gw + cxi;
      if (k === last) continue;
      last = k;
      if (distToCell(e.x, e.y, cxi, cyi) > CELL * MASON_REACH) break;   //◆手が届かない
      if (!canPlaceAt(state, cxi, cyi)) continue;
      placeBlock(state, cxi, cyi, e.id);
      e.placeAt = state.tick; e.placeBudget = (e.placeBudget | 0) - 1;
      e.vf |= EFLAGS.BUILD; e.aim = Math.atan2(-uy, -ux);
      return true;
    }
  }
  return false;
}

//◆石積みと戦い方ここまで
