//◆ボスの 6 つの撃ち方・動き（輪・狙い撃ち・召喚・突進・転移・足元の円・跳躍）。gyo = 撃つ敵の行 : 2.10.17参照
function ringAt(state, x, y, count, speed, phase, gyo) { const sp = ebSpeed(state, speed); for (let i = 0; i < count; i++) addEBullet(state, x, y, phase + i * Math.PI * 2 / count, sp, gyo); }
function aimedAt(state, e, t, ways, spreadDeg, speed) {
  if (!t) return;
  const base = Math.atan2(t.y - e.y, t.x - e.x), sp = ebSpeed(state, speed);
  for (let i = 0; i < ways; i++) { const a = base + (i - (ways - 1) / 2) * spreadDeg * DEG; addEBullet(state, e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r, a, sp, e.gyo); }
}
function summon(state, e, kind, count, max) {
  if (state.phase !== PHASE.FIGHT) return;   //◆救済のハッチの後（HATCH）は列が回らないので、予告の円と音だけ出て敵が出ないのを防ぐ（乱数を使う前に止める）
  let k = kind;
  if (!k || !KINDS[k]) {
    const fam = KINDS[e.kind] ? KINDS[e.kind].fam : "basic";
    const list = FAM_MEMBERS[fam] || FAM_MEMBERS.basic;
    let pick = -1, tries = 0;
    while (tries++ < 12) { const c = list[Math.floor(rnd(state) * list.length)], K = SPECIES[c]; if (K && K[4] <= Math.max(12, e.r * 0.6) && K[2] !== "vase") { pick = c; break; } }
    k = pick >= 0 ? SPECIES[pick][0] : "mini";
  }
  if (countKind(state, k) >= max) return;
  //◆種を変えながら呼び続けると際限なく増えるので、同時に居る敵の総数でも止める（ウェーブの上限 +6）
  if (liveCount(state) + state.wave.queue.length >= state.wave.cap + 6) return;
  for (let i = 0; i < count; i++) {
    const a = rnd(state) * Math.PI * 2, d = e.r + 30 + rnd(state) * 30;
    telegraphSpawn(state, k, cx(state, e.x + Math.cos(a) * d, KINDS[k].r), cy(state, e.y + Math.sin(a) * d, KINDS[k].r), 0, 0);
  }
}
function startDash(state, e, t, windup, speed, ticks) {
  if (e.st !== 0 || !t) return;
  const dx = t.x - e.x, dy = t.y - e.y, d = Math.sqrt(dx * dx + dy * dy);
  if (d < 0.0001) return;
  e.dx = dx / d; e.dy = dy / d; e.aim = Math.atan2(dy, dx);
  e.st = 2; e.stTick = state.tick; e.n1 = speed; e.n2 = ticks; e.n3 = windup;
}
function startTeleport(state, e, t, dist_) {
  if (e.st !== 0) return;
  const ox = t ? t.x : e.x, oy = t ? t.y : e.y;
  let fx = e.x, fy = e.y, ok = false;
  for (let k = 0; k < 8 && !ok; k++) {
    const a = rnd(state) * Math.PI * 2, x = ox + Math.cos(a) * dist_, y = oy + Math.sin(a) * dist_;
    if (x < e.r || x > state.aw - e.r || y < e.r || y > state.ah - e.r) continue;
    if (hitsWall(state, x, y, e.r) || !reachablePx(state, x, y)) continue;
    ok = true; fx = x; fy = y;
  }
  if (!ok) return;
  e.tx = fx; e.ty = fy; e.st = 4; e.stTick = state.tick; e.n3 = 10;
  addZone(state, ZONE_KIND.TELEGRAPH, fx, fy, e.r, 10, 0, 0, 0);
  ev(state, ["warn", Math.round(fx), Math.round(fy), e.r, 10]);
}
function zoneAll(state, kindName, r, ticks, every, gyo) {
  const kind = kindName === "lava" ? ZONE_KIND.LAVA : ZONE_KIND.TELEGRAPH, ps = state.players;
  for (let i = 0; i < ps.length; i++) if (isAlive(ps[i])) addZone(state, kind, ps[i].x, ps[i].y, r, ticks, 0, every, 0, gyo);
}
function startLeap(state, e, t, windup, flight, scatter) {
  if (e.st !== 0 || !t) return;
  let tx = cx(state, t.x + (rnd(state) * 2 - 1) * scatter, e.r), ty = cy(state, t.y + (rnd(state) * 2 - 1) * scatter, e.r);
  if (hitsWall(state, tx, ty, e.r)) {
    let ok = false;
    for (let k = 8; k >= 1; k--) { const f = k / 9, qx = e.x + (tx - e.x) * f, qy = e.y + (ty - e.y) * f; if (!hitsWall(state, qx, qy, e.r)) { tx = qx; ty = qy; ok = true; break; } }
    if (!ok) { tx = e.x; ty = e.y; }
  }
  e.tx = tx; e.ty = ty; e.st = 6; e.stTick = state.tick; e.n1 = windup; e.n2 = flight;
}

