//◆敵の物理（押し出し・ノックバック・接触）と線分・弾の追尾の小道具 : 2.10.25参照
//◆体が無い状態（跳躍中 7・転移中 4・burrower が潜っている 8/9）：押し出し・重なり・接触をしない
function noBody(e) { return e.st === 7 || e.st === 4 || e.st === 8 || e.st === 9; }
function stepEnemyPhysics(state, dt) {
  const es = state.enemies, tick = state.tick, f = Math.max(0, 1 - KB_DECAY * dt);
  for (let i = 0; i < es.length; i++) {
    const e = es[i];
    if (e.gone) continue;
    if (e.kbx !== 0 || e.kby !== 0) {
      if (!noBody(e)) {
        //◆岩に食い込む向きのノックバックは止める（押し出しで壁の向こう側へ抜けてしまうのを防ぐ）
        const mx = e.kbx * dt, my = e.kby * dt, nx = e.x + mx, ny = e.y + my;
        if (e.beh === "phaser") { e.x = nx; e.y = ny; }
        else {
          //◆大きいノックバックで 1 マスの壁を飛び越えないよう、CELL/4 ずつ進めて壁の手前で止める（1 刻みで済む時は前と同じ計算）
          const am = Math.max(mx < 0 ? -mx : mx, my < 0 ? -my : my), n = Math.min(256, Math.max(1, Math.ceil(am / (CELL / 4))));
          let lx = e.x, ly = e.y, hit = false;
          for (let s = 1; s <= n; s++) {
            const tx = s === n ? nx : e.x + mx * s / n, ty = s === n ? ny : e.y + my * s / n;
            if (hitsWall(state, tx, ty, e.r)) { hit = true; break; }
            lx = tx; ly = ty;
          }
          e.x = lx; e.y = ly;
          if (hit) { e.kbx = 0; e.kby = 0; }
        }
      }
      e.kbx *= f; e.kby *= f;
      if (Math.abs(e.kbx) < 0.5) e.kbx = 0;
      if (Math.abs(e.kby) < 0.5) e.kby = 0;
    }
    if (e.st === 4) e.vf |= EFLAGS.HIDDEN;
    if (tick < e.hurtUntil) e.vf |= EFLAGS.HURT;
    if (e.elite) e.vf |= EFLAGS.ELITE;
    if (e.boss) e.vf |= EFLAGS.BOSS;
    if (e.rank === 1) e.vf |= EFLAGS.VET; else if (e.rank === 3) e.vf |= EFLAGS.CHAMP;   //◆古参・覇者の札（client）
  }
  for (let i = 0; i < es.length; i++) {
    const a = es[i];
    if (a.gone || noBody(a)) continue;
    for (let j = i + 1; j < es.length; j++) {
      const b = es[j];
      if (b.gone || noBody(b)) continue;
      const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r, d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr) continue;
      const d = Math.sqrt(d2), ux = d > 0.0001 ? dx / d : 1, uy = d > 0.0001 ? dy / d : 0, ov = rr - d;
      a.x -= ux * ov * 0.5; a.y -= uy * ov * 0.5; b.x += ux * ov * 0.5; b.y += uy * ov * 0.5;
    }
  }
  for (let i = 0; i < es.length; i++) {
    const e = es[i];
    if (e.gone || noBody(e)) continue;
    if (e.beh !== "phaser") {
      const po = pushOut(state, e.x, e.y, e.r);
      //◆押し出しが「近くの入れるセル」へ跳ばした先が届かない場所なら、前 tick の位置へ戻す（壁抜け防止）
      if (dist2(po[0], po[1], e.x, e.y) > CELL * CELL * 0.5 && !reachablePx(state, po[0], po[1]) && reachablePx(state, e.px, e.py)) { e.x = e.px; e.y = e.py; e.kbx = 0; e.kby = 0; }
      else { e.x = po[0]; e.y = po[1]; }
    }
    e.x = cx(state, e.x, e.r); e.y = cy(state, e.y, e.r);
  }
  const ps = state.players;
  //◆実績「量子トンネル効果」。ダッシュの無敵の間に自機と重なった敵（同じ敵は 1 回）を数え、1 回のダッシュでの最高を run.tunnel に
  for (let j = 0; j < ps.length; j++) {
    const p = ps[j];
    if (!Array.isArray(p.tn) || tick >= (p.dashEnd | 0) || !isAlive(p)) continue;
    for (let i = 0; i < es.length; i++) {
      const e = es[i];
      if (e.gone || noBody(e) || p.tn.indexOf(e.id) >= 0) continue;
      if (dist2(e.x, e.y, p.x, p.y) >= (e.r + PLAYER_R) * (e.r + PLAYER_R)) continue;
      p.tn.push(e.id);
      if (p.tn.length > (state.run.tunnel | 0)) state.run.tunnel = p.tn.length;
    }
  }
  for (let i = 0; i < es.length; i++) {
    const e = es[i];
    if (e.gone || noBody(e)) continue;
    const dmg = (e.st === 3 || e.st === 12) ? e.dmg + eAtk(state, 1) : e.dmg;   //◆突進中（charger 3 / lancer 12）は +1（深い階では伸びる）
    if (dmg <= 0) continue;
    for (let j = 0; j < ps.length; j++) {
      const p = ps[j];
      if (!isAlive(p) || tick < p.contactUntil) continue;
      if (dist2(e.x, e.y, p.x, p.y) >= (e.r + PLAYER_R) * (e.r + PLAYER_R)) continue;
      if (damagePlayer(state, p, dmg, e.x, e.y, e.gyo)) {
        p.contactUntil = tick + CONTACT_CD_TICKS;
        //◆灼熱の肌（thorns）：触れた敵にダメージ（自機から見た向きへ軽く押す）
        const th = p.stats ? +p.stats.thorns || 0 : 0;
        if (th > 0 && !e.gone) { const d = dist(p.x, p.y, e.x, e.y); hurtEnemy(state, e, th, d > 0.0001 ? (e.x - p.x) / d : 1, d > 0.0001 ? (e.y - p.y) / d : 0, p.id, 0.5); }
      }
    }
  }
}
function segCircleT(x0, y0, x1, y1, ex, ey, r) {
  const dx = x1 - x0, dy = y1 - y0, len2 = dx * dx + dy * dy;
  let t = 0;
  if (len2 > 0.000001) { t = ((ex - x0) * dx + (ey - y0) * dy) / len2; if (t < 0) t = 0; else if (t > 1) t = 1; }
  const qx = x0 + dx * t - ex, qy = y0 + dy * t - ey;
  return (qx * qx + qy * qy < r * r) ? t : -1;
}
//◆線分が最初に触れる壁のセル [cx, cy, t]（t = 線分上の位置 0..1）。触れなければ null
function segFirstSolid(state, x0, y0, x1, y1, r) {
  const dx = x1 - x0, dy = y1 - y0, len = Math.sqrt(dx * dx + dy * dy), n = Math.max(1, Math.ceil(len / (CELL * 0.25)));
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = x0 + dx * t, y = y0 + dy * t;
    if (!hitsWall(state, x, y, r)) continue;
    const cx0 = Math.floor(x / CELL), cy0 = Math.floor(y / CELL);
    let best = null, bd = 1e9;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const cxi = cx0 + ox, cyi = cy0 + oy;
      if (!wallCell(state, cxi, cyi)) continue;
      const d = distToCell(x, y, cxi, cyi);
      if (d < bd) { bd = d; best = [cxi, cyi, t]; }
    }
    return best || [cx0, cy0, t];
  }
  return null;
}
function homeBullet(state, b) {
  const es = state.enemies;
  let bx = 0, by = 0, bd = Infinity;
  for (let j = 0; j < es.length; j++) { const e = es[j]; if (e.gone || e.st === 4 || e.st === 7 || e.st === 8) continue; const d = dist2(b.x, b.y, e.x, e.y); if (d < bd) { bd = d; bx = e.x; by = e.y; } }
  if (bd === Infinity) return;
  const sp = Math.sqrt(b.dx * b.dx + b.dy * b.dy) || 1, cur = Math.atan2(b.dy, b.dx), want = Math.atan2(by - b.y, bx - b.x);
  let da = want - cur;
  da = ((da + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  const lim = HOME_DEG * DEG, a = cur + clamp(da, -lim, lim);
  b.dx = Math.cos(a) * sp; b.dy = Math.sin(a) * sp;
}
