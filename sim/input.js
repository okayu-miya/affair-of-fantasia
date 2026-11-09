//◆入力を state に反映する（位置・向き・撃つ・ダッシュ・アイテム・会話・帰還） : 2.10.23参照
function applyPos(state, pid, x, y, a, m) {
  const p = findP(state, pid);
  if (!p || p.dead) return false;
  if (!isNum(x) || !isNum(y)) return false;
  x = cx(state, x, PLAYER_R); y = cy(state, y, PLAYER_R);
  const po = pushOut(state, x, y, PLAYER_R);
  x = po[0]; y = po[1];
  const dtTicks = Math.max(1, state.tick - p.posTick);
  const capSpeed = Math.max(POS_MAX_SPEED, (p.stats.speed || 0) + 140);
  const maxD = capSpeed * TICK_DT * dtTicks + 20;
  const d = dist(p.x, p.y, x, y);
  if (d > maxD) { x = p.x + (x - p.x) * maxD / d; y = p.y + (y - p.y) * maxD / d; }
  if (!hitsWall(state, p.x, p.y, PLAYER_R) && segHitsWall(state, p.x, p.y, x, y, PLAYER_R)) {
    if (!segHitsWall(state, p.x, p.y, x, p.y, PLAYER_R)) y = p.y;
    else if (!segHitsWall(state, p.x, p.y, p.x, y, PLAYER_R)) x = p.x;
    else {
      let lo = 0, hi = 1;
      for (let k = 0; k < 5; k++) { const mid = (lo + hi) / 2; if (segHitsWall(state, p.x, p.y, p.x + (x - p.x) * mid, p.y + (y - p.y) * mid, PLAYER_R)) hi = mid; else lo = mid; }
      x = p.x + (x - p.x) * lo; y = p.y + (y - p.y) * lo;
    }
  }
  p.x = x; p.y = y;
  if (isNum(a)) p.aim = a;
  p.moving = m ? 1 : 0;
  p.posTick = state.tick;
  return true;
}
function applyInputs(state, inp) {
  const tick = state.tick, p = state.players[0];
  p.shotTokens = Math.min(2, p.shotTokens + (TICK_MS / p.stats.cdMs) * 1.25);
  if (!inp || typeof inp !== "object") return;
  const canAct = isAlive(p);
  if (inp.pos && typeof inp.pos === "object") applyPos(state, p.id, +inp.pos.x, +inp.pos.y, +inp.pos.a, inp.pos.m);
  if (inp.dash && canAct && tick >= p.dashCdUntil) {
    p.dashUntil = tick + DASH_TICKS; p.dashCdUntil = tick + (p.stats.dashCdT || DASH_CD_TICKS);
    //◆すり抜け・幽体（特性）でダッシュの無敵を延ばす（速さ・間隔は変えない）。
    //◆延ばす分は「間隔 − ダッシュ 2 回分」まで＝連打しても毎回 DASH_TICKS 以上は無敵でない時間が残る（間隔を縮める装備・特性と重ねても無敵になりきらない）
    const di = p.dashUntil + Math.min(p.stats.dashInv | 0, Math.max(0, (p.stats.dashCdT || DASH_CD_TICKS) - 2 * DASH_TICKS));
    if (p.invulnUntil < di) p.invulnUntil = di;
    p.dashEnd = di; p.tn = [];   //◆このダッシュの無敵の終わり tick と、その間に重なった敵の id（量子トンネル効果）
    ev(state, ["dash", p.id]);
    state.run.dashes = (state.run.dashes | 0) + 1;   //◆実績の数
  }
  if (Array.isArray(inp.shots) && canAct) {
    for (let k = 0; k < inp.shots.length; k++) {
      const s = inp.shots[k];
      if (!s || !isNum(s.seq) || !isNum(s.a)) continue;
      const seq = Math.floor(s.seq);
      if (seq <= p.lastSeq && seq > p.lastSeq - 4096) continue;
      p.lastSeq = seq;
      if (p.shotTokens < 1) continue;
      p.shotTokens -= 1;
      fireBullets(state, p, seq, s.a);
    }
  }
  if (inp.dig && canAct && state.phase !== PHASE.TRANSIT) applyDig(state, p, inp.dig);
  if (Array.isArray(inp.uses)) for (let k = 0; k < inp.uses.length; k++) useItem(state, p, inp.uses[k]);
  if (inp.talk) evTalk(state, inp.talk);   //◆スキマの階で紫と話し終えた（選んだ答え 1..3）
  if (inp.talk && state.sf) sfTalk(state, inp.talk);   //◆決戦（1 戦う・2 通してもらう）・1000 階（贈り物）
  if (inp.ogo && state.sf && state.sf.hold) omakeGo(state);   //◆一周目の魅魔、最後のスペルの前の待ちを終える
  if (inp.oend && omakeOf(state) && state.phase !== PHASE.LEAVE && state.phase !== PHASE.OVER) { bookSweep(state); state.phase = PHASE.LEAVE; state.leaveTick = tick; ev(state, ["leave"]); }   //◆「止める」で探索を切り上げる
  if (inp.leave && state.phase === PHASE.HATCH) { bookSweep(state); state.phase = PHASE.LEAVE; state.leaveTick = tick; ev(state, ["leave"]); }   //◆帰る前に床の禁書を拾った扱い（["book"] が ["leave"] より先）
}

