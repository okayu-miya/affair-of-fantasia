//◆自弾の撃ち方（扇・銃口・跳弾・渦巻き・弾ける輪）とアイテム（ポーション・ばくだん）の使い方 : 2.10.22参照
//◆自弾を撃つここから
function spreadAngles(ways, aim) {
  if (ways <= 1) return [aim];
  const out = [], step = 10 * DEG;
  for (let i = 0; i < ways; i++) out.push(aim + (i - (ways - 1) / 2) * step);
  return out;
}
function shotAngles(stats, aim) {
  const st = (stats && typeof stats === "object") ? stats : {};
  const ways = clamp(Math.round(Number(st.ways) || 1), 1, 8), sp = Number(st.spread) || 0;
  if (!(sp > 0) || ways <= 1) return spreadAngles(ways, aim);
  const out = [];
  for (let i = 0; i < ways; i++) out.push(aim + (i - (ways - 1) / 2) * sp * DEG);
  return out;
}
function bulletId(pid, seq, k) { return pid * 16777216 + (seq % 1048576) * 16 + k; }
//◆銃口 = 中心 + ねらい方向 18px。狭い坑道で銃口が岩に埋まるときは手前へ寄せる（弾が出た瞬間に消えないように）
function muzzle(x, y, a, state) {
  for (let d = 18; d >= 0; d -= 6) {
    const mx = x + Math.cos(a) * d, my = y + Math.sin(a) * d;
    if (!state || !hitsWall(state, mx, my, BULLET_R)) return [mx, my];
  }
  return [x, y];
}
function insertBullet(state, b) {
  if (state.bullets.length >= MAX_BULLETS) {
    let mi = 0;
    for (let i = 1; i < state.bullets.length; i++) if (state.bullets[i].life < state.bullets[mi].life) mi = i;
    state.bullets.splice(mi, 1);
  }
  let i = state.bullets.length;
  while (i > 0 && state.bullets[i - 1].id > b.id) i--;
  state.bullets.splice(i, 0, b);
}
//◆自弾。eg = 武器の行の添字（-1 = 無属性）、em = 2^P（自機のその行の植物式の値）、crit = 会心（威力は既に ×1.5 済み）
function makeBullet(id, owner, x, y, a, speed, dmg, life, fl, kb, wk, orb, eg, em, crit) {
  return { id, owner, x, y, px: x, py: y, dx: Math.cos(a) * speed, dy: Math.sin(a) * speed, life, dmg, fl: fl | 0, sp0: speed, kb: kb > 0 ? kb : 1, wk: wk | 0, orb: orb | 0,
    eg: eg === undefined || eg === null ? -1 : eg | 0, em: em > 0 ? em : 1, crit: crit ? 1 : 0, ht: (fl & BF.PIERCE) ? [] : null };
}
function fireBullets(state, p, seq, aim) {
  const st = p.stats, angs = shotAngles(st, aim), life = Math.round(st.life / TICK_DT);
  const eg = gyoIdx(st.wgyo), em = wpnElemMul(st), crit = st.crit | 0;
  const dmg = (st.fullDmg | 0) > 0 && p.hp >= p.maxhp ? r2(st.dmg * (1 + st.fullDmg / 100)) : st.dmg;   //◆fullDmg：HP 満タンなら威力 +%
  const cm = CRIT_MUL + (st.critMul | 0) / 100;
  for (let k = 0; k < angs.length; k++) {
    const a = angs[k], m = muzzle(p.x, p.y, a, state);
    const c = crit > 0 && rnd(state) * 100 < crit ? 1 : 0;   //◆会心：弾ごとに抽選、威力 ×(1.5 + critMul)
    const b = makeBullet(bulletId(p.id, seq, k), p.id, m[0], m[1], a, st.bspeed, c ? r2(dmg * cm) : dmg, life, st.fl, st.kb, st.wk, st.orb, eg, em, c);
    if (st.fl & (BF.BOUNCE | BF.SPIRAL | BF.RING)) shotMode(b, p, a, seq, k);   //◆旗が無ければ弾は素の形のまま
    insertBullet(state, b);
  }
  ev(state, ["shot", p.id, angs.length]);
}
//◆新しい撃ち方の欄を弾に付ける（旗がある時だけ）。bn = 残りの跳ね返り、
//◆so = 渦の中心 [x, y]・sa = 渦の今の角・sr = 中心からの距離・sw = 回る向き（弾ごとに交互）・sv = 広がる向き（1 = 外へ。壁で跳ねると -1）、rg = まだ輪に弾けていない
function shotMode(b, p, a, seq, k) {
  if (b.fl & BF.BOUNCE) b.bn = BOUNCE_MAX;
  if (b.fl & BF.SPIRAL) { b.so = [p.x, p.y]; b.sa = a; b.sr = dist(p.x, p.y, b.x, b.y); b.sw = ((seq + k) & 1) ? -1 : 1; b.sv = 1; }
  if (b.fl & BF.RING) b.rg = 1;
}
//◆渦巻き：中心から外へ・回る向きへ進める（dx / dy は当たりの向きと絵の向きのため、1 tick の移動から作り直す）。
//◆壁で跳ねた弾（sv = -1）は内へ戻り、中心を過ぎると sr が負になって向こう側へ抜ける（cos・sin がそのまま反対側を指す）
function spiralBullet(b, dt) {
  const sp = b.sp0 || 1, r0 = b.sr;
  b.sr = r0 + (b.sv || 1) * sp * SPIRAL_VR * dt;
  b.sa += b.sw * sp * SPIRAL_VT * dt / Math.max(SPIRAL_R0, Math.abs(r0));
  const nx = b.so[0] + Math.cos(b.sa) * b.sr, ny = b.so[1] + Math.sin(b.sa) * b.sr;
  b.dx = (nx - b.x) / dt; b.dy = (ny - b.y) / dt;
}
//◆弾ける輪：当たった所から RING_N 個の欠片（旗なし・当たった敵 skip には当たらない）。id は state.nextId から
function ringShards(state, b, x, y, skip, out) {
  const sp = (b.sp0 || 1) * 0.7, a0 = Math.atan2(b.dy, b.dx), d = r2(b.dmg * RING_DMG);
  for (let i = 0; i < RING_N; i++) {
    const s = makeBullet(state.nextId++, b.owner, x, y, a0 + (i + 0.5) * Math.PI * 2 / RING_N, sp, d, RING_LIFE, 0, b.kb * 0.5, b.wk, 0, b.eg, b.em, 0);
    s.sh = 1; s.skip = skip;
    out.push(s);
  }
}
//◆自弾を撃つここまで
//◆アイテムを使うここから
function useItem(state, p, kind) {
  if (!isAlive(p)) return;
  if (kind === "potion") {
    //◆実績「いい天気」＝その階の敵を湧き切って全部倒した後（生きている敵 0）に、HP が満タンのままポーションを飲む（お茶の代わり）。
    //◆満タンで飲めるのはこの「静かな時」だけ（戦いの最中に満タンで押して無駄にしないよう飲めない）。天気・主人公は applyRun（addRunLife）が照らす
    const w = state.wave, calm = !!(w && w.total > 0 && w.spawned >= w.total && w.remaining === 0 && w.queue.length === 0 && liveCount(state) === 0);
    const full = p.hp >= p.maxhp;
    if (p.items.potion <= 0 || (full && !calm)) return;
    p.items.potion--;
    state.run.potions = (state.run.potions | 0) + 1;   //◆実績の数
    const heal = 3 + pv(p.stats, "potion");   //◆薬学（特性）＋清流などのスキル
    p.hp = Math.min(p.maxhp, p.hp + heal);
    if (full && calm) state.run.tea = 1;
    ev(state, ["use", p.id, "potion"]); ev(state, ["heal", p.id, heal]);
  } else if (kind === "bomb") {
    if (p.items.bomb <= 0) return;
    p.items.bomb--;
    state.run.bombs = (state.run.bombs | 0) + 1;   //◆実績の数。k0 = 投げる前の撃破数（1 発で 5 体 = 一網打尽）
    const k0 = state.run.kills | 0;
    ev(state, ["use", p.id, "bomb"]);
    const bb = trv(p.stats, "bomb"), bm = 1 + bb / 100, BR = BOMB_R * bm, BDR = BOMB_DIG_R + (bb >= 60 ? 2 : bb > 0 ? 1 : 0);
    ev(state, ["boom", Math.round(p.x), Math.round(p.y), BR]);
    const es = state.enemies, len = es.length;
    for (let i = 0; i < len; i++) {
      const e = es[i];
      if (e.gone || e.st === 4 || e.st === 8) continue;   //◆転移中・潜っている burrower には当たらない
      const d = dist(p.x, p.y, e.x, e.y);
      if (d >= BR + e.r) continue;
      const ux = d > 0.0001 ? (e.x - p.x) / d : 1, uy = d > 0.0001 ? (e.y - p.y) / d : 0;
      hurtEnemy(state, e, BOMB_DMG * (1 + (p.stats.bombDmg || 0) / 100), ux, uy, p.id);   //◆発破（特性）で威力 +%
    }
    if ((state.run.kills | 0) - k0 >= 5) state.run.bomb5 = 1;   //◆実績の印
    state.ebullets = state.ebullets.filter(b => dist(p.x, p.y, b.x, b.y) >= BOMB_CLEAR_R * bm);
    //◆岩を掘り抜く（岩盤以外）
    const pcx = Math.floor(p.x / CELL), pcy = Math.floor(p.y / CELL), rr = Math.ceil(BDR);
    for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) {
      if (dx * dx + dy * dy > BDR * BDR) continue;
      const cxi = pcx + dx, cyi = pcy + dy;
      if (blockAt(state, cxi, cyi) >= BLOCK.DIRT) damageBlock(state, cxi, cyi, 50, 1, 1);
    }
  }
}
//◆アイテムを使うここまで
