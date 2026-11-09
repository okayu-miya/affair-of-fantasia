//◆ウェーブ（敵の湧き）：強さの段階・戦い方・種の抽選と、湧き位置（距離場で必ず届く床） : 2.10.24参照
//◆湧く敵の抽選ここから
function eliteRate(n) { return Math.min(0.30, ELITE_RATE + Math.max(0, n - ELITE_FROM) * 0.004); }
//◆強さの段階の抽選（湧きごと。ボスは通らない）：B25 以上で 4% → 3、そうでなく B11 以上で eliteRate → 2、そうでなく B8 以上で 15% → 1、それ以外 0
function rollRank(state) {
  const n = state.floor;
  if (n >= CHAMP_FROM && rnd(state) < CHAMP_RATE) return 3;
  if (n >= ELITE_FROM && rnd(state) < eliteRate(n)) return 2;
  if (n >= VET_FROM && rnd(state) < VET_RATE) return 1;
  return 0;
}
//◆その階の戦い方の [付く率, 付いた内の「両方」の割合]（STYLE_TABLE。B3 より上は [0, 0]）
function styleRateOf(n) {
  let row = null;
  for (let i = 0; i < STYLE_TABLE.length; i++) if (n >= STYLE_TABLE[i][0]) row = STYLE_TABLE[i];
  return row ? [row[1], row[2]] : [0, 0];
}
//◆戦い方を決める（u = 0..1 の一様な値）。u < 付く率 なら付き、その中を「両方」の割合 → 残りを掘る・置くで半分ずつ。
//◆石積みはいつも 3。付かない行動は 0、掘らない行動は「置く」の部分だけ残す（1 → 0・3 → 2）
function styleFor(kind, n, u) {
  const K = KINDS[kind];
  if (!K) return 0;
  if (K.beh === "mason") return 3;
  if (STYLE_NONE.indexOf(K.beh) >= 0) return 0;
  const R = styleRateOf(n);
  if (!(u < R[0])) return 0;
  const v = u / R[0];
  let s = v < R[1] ? 3 : (v - R[1]) / (1 - R[1]) < 0.5 ? 1 : 2;
  if (STYLE_PLACE_ONLY.indexOf(K.beh) >= 0) s &= 2;
  return s;
}
//◆湧いた敵の戦い方。seed・敵の id・階の hash で決める（rnd を進めない＝戦い方の無い階の乱数列は動かない）
function rollStyle(state, kind, id) { return styleFor(kind, state.floor, hash32((state.seed | 0) ^ 0x5d1e57, id | 0, state.floor | 0) / 4294967296); }
function maxSizeOf(n) { return 15 + n * 1.3; }
function spawnWeight(sp, step, famIdx, maxR) {
  let w = sp[8];
  if (w <= 0) return 0;
  const r = sp[4];
  if (r > maxR) return 0;
  if (step === 0 && r >= 26) return 0;
  if (r >= 26) w *= (step >= 3 ? 1 : 0.4);
  else if (r >= 20) w *= (step >= 2 ? 1 : 0.6);
  else if (r <= 12) w *= (step >= 3 ? 0.7 : 1);
  return famIdx === 0 ? w : w * 0.7;
}
function smallestOf(fam, maxR) {
  const list = FAM_MEMBERS[fam] || [];
  let best = "mini", br = 1e9;
  for (let i = 0; i < list.length; i++) { const sp = SPECIES[list[i]]; if (sp[8] > 0 && sp[4] < br) { br = sp[4]; best = sp[0]; } }
  return best;
}
function pickKind(state) {
  const n = state.floor, B = BIOMES[biomeOf(n)];
  const step = ((n - 1) % BIOME_FLOORS + BIOME_FLOORS) % BIOME_FLOORS, maxR = maxSizeOf(n), fams = B.fams;
  let sum = 0;
  for (let f = 0; f < fams.length; f++) { const list = FAM_MEMBERS[fams[f]] || []; for (let i = 0; i < list.length; i++) sum += spawnWeight(SPECIES[list[i]], step, f, maxR); }
  if (sum <= 0) return smallestOf(fams[0], maxR);
  const mw = masonDeepW(n, fams, sum);   //◆坑道の民が居ない深い階にも石積みが少しだけ混ざる（表の最後に足す）
  let r = rnd(state) * (sum + mw);
  for (let f = 0; f < fams.length; f++) {
    const list = FAM_MEMBERS[fams[f]] || [];
    for (let i = 0; i < list.length; i++) { const sp = SPECIES[list[i]]; r -= spawnWeight(sp, step, f, maxR); if (r < 0) return sp[0]; }
  }
  if (mw > 0 && r < mw) return "mason";
  return smallestOf(fams[0], maxR);
}
//◆深い階（MASON_DEEP_FROM 以上で mine 族の無い層）の石積みの重み。その層の重みの合計 × MASON_DEEP_RATE（湧きの約 1.2%）
function masonDeepW(n, fams, sum) { return n >= MASON_DEEP_FROM && fams.indexOf("mine") < 0 ? sum * MASON_DEEP_RATE : 0; }
//◆湧く敵の抽選ここまで
//◆湧き位置ここから
//◆距離場で lo..hi セルの届く床から 1 つ選ぶ
function pickFlowCell(state, r, lo, hi) {
  const f = state.flow, grid = state.grid, gw = state.gw | 0, gh = state.gh | 0;
  if (!f) return null;
  const cand = [];
  for (let k = 0; k < f.length; k++) {
    if (f[k] < lo || f[k] > hi || grid[k] !== 0) continue;
    const x = k % gw, y = (k - x) / gw;
    if (x <= 0 || y <= 0 || x >= gw - 1 || y >= gh - 1) continue;
    cand.push(k);
  }
  for (let tries = 0; tries < 12 && cand.length; tries++) {
    const k = cand[Math.floor(rnd(state) * cand.length)], x = k % gw, y = (k - x) / gw;
    const px = x * CELL + CELL / 2, py = y * CELL + CELL / 2;
    if (!hitsWall(state, px, py, r)) return [px, py];
  }
  //◆体が大きくて入らない：中心のセルだけ床なら押し出しに任せる
  if (cand.length) { const k = cand[Math.floor(rnd(state) * cand.length)], x = k % gw, y = (k - x) / gw; return [x * CELL + CELL / 2, y * CELL + CELL / 2]; }
  return null;
}
//◆岩を割って出てくる：岩盤・宝箱以外を通れるとみなした BFS で 4〜7 歩の岩を選び、そこまでの岩を床にする
function burstSpot(state, r) {
  const p = state.players[0], gw = state.gw | 0, gh = state.gh | 0, grid = state.grid;
  const pcx = Math.floor(p.x / CELL), pcy = Math.floor(p.y / CELL);
  const N = gw * gh, d = new Array(N).fill(-1), par = new Array(N).fill(-1), q = [];
  const k0 = pcy * gw + pcx;
  if (!inGrid(state, pcx, pcy)) return pushOut(state, p.x, p.y, r);
  d[k0] = 0; q.push(k0);
  let head = 0;
  const cand = [];
  while (head < q.length) {
    const k = q[head++], v = d[k] + 1, x = k % gw, y = (k - x) / gw;
    if (v > 7) continue;
    const nb = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
    for (let i = 0; i < 4; i++) {
      const nx = nb[i][0], ny = nb[i][1];
      if (nx <= 0 || ny <= 0 || nx >= gw - 1 || ny >= gh - 1) continue;
      const j = ny * gw + nx, b = grid[j];
      if (d[j] >= 0 || b === BLOCK.BEDROCK || b === BLOCK.CHEST) continue;
      d[j] = v; par[j] = k; q.push(j);
      if (b >= BLOCK.DIRT && v >= 4) cand.push(j);
    }
  }
  if (!cand.length) { const po = pushOut(state, p.x, p.y, r); return [po[0], po[1]]; }
  let k = cand[Math.floor(rnd(state) * cand.length)];
  const kx = k % gw, ky = (k - kx) / gw;
  while (k >= 0 && k !== k0) {
    if (grid[k] >= BLOCK.DIRT) { const b = grid[k]; grid[k] = 0; state.bhp[k] = 0; state.ore[k] = 0; dlAdd(state, -1); ev(state, ["break", k % gw, Math.floor(k / gw), b, 0]); }
    k = par[k];
  }
  state.flowTick = -999;
  rebuildFlow(state);
  const px = kx * CELL + CELL / 2, py = ky * CELL + CELL / 2;
  ev(state, ["burst", px, py]);
  return [px, py];
}
function spawnSpot(state, r) {
  ensureFlow(state);
  let s = pickFlowCell(state, r, 8, 22);
  if (!s) s = pickFlowCell(state, r, 3, 1e9);
  if (s) return s;
  return burstSpot(state, r);
}
//◆湧き位置ここまで
//◆ウェーブを進めるここから
function stepWaves(state) {
  if (state.phase !== PHASE.FIGHT) return;   //◆救済（stuck）で列を捨てた後、HATCH 中に次のウェーブを積み直さない
  const w = state.wave, tick = state.tick;
  if (w.i < w.waves && w.spawned < w.total) {
    let go = false;
    if (w.i === 0) go = tick - w.startTick >= FIRST_WAVE_TICKS;
    else if (w.queue.length === 0) go = liveCount(state) <= WAVE_NEXT_ALIVE || tick - w.waveTick >= WAVE_TIMEOUT_TICKS;
    if (go) {
      const per = Math.ceil(w.total / w.waves);
      const n = (w.i === w.waves - 1) ? w.total - w.spawned : Math.min(per, w.total - w.spawned);
      for (let k = 0; k < n; k++) w.queue.push([evPickKind(state), 0, 0, 0, 1, 0]);   //◆一族の階は決めた族から
      w.spawned += n; w.i++; w.waveTick = tick;
      if (w.i === 1) {
        const bk = bossOf(state.floor);
        if (bk && KINDS[bk]) {
          let bx, by;
          if (state.bossSpot) { bx = state.bossSpot.x; by = state.bossSpot.y; }
          else { bx = 0; by = 0; for (let i = 0; i < state.hatchCands.length; i++) { bx += state.hatchCands[i].x; by += state.hatchCands[i].y; } const m = Math.max(1, state.hatchCands.length); bx /= m; by /= m; }
          const e = spawnAt(state, bk, bx, by, 0, 0, 1);
          ev(state, ["boss", kindIndex(bk), Math.round(e.x), Math.round(e.y)]);
        }
      }
    }
  }
  let active = liveCount(state);
  for (let i = 0; i < w.queue.length; i++) if (w.queue[i][3] > 0) active++;
  for (let i = 0; i < w.queue.length; i++) {
    const q = w.queue[i];
    if (q[3] !== 0) continue;
    if (active >= w.cap) break;
    const K = KINDS[q[0]], pt = spawnSpot(state, K.r), x = pt[0], y = pt[1];
    q[1] = x; q[2] = y; q[3] = tick + TELEGRAPH_TICKS; q[5] = rollRank(state);
    addZone(state, ZONE_KIND.TELEGRAPH, x, y, 26, TELEGRAPH_TICKS, 0, 0, 0);
    ev(state, ["spawn", Math.round(x), Math.round(y)]);
    active++;
  }
  if (w.queue.length) {
    const keep = [];
    //◆イベント階層の効果は湧く所で（ウェーブも召喚も）：精鋭の階は段階 2 以上、疾風・黄金は湧いた敵に掛ける
    for (let i = 0; i < w.queue.length; i++) { const q = w.queue[i]; if (q[3] > 0 && tick >= q[3]) evSpawned(state, spawnAt(state, q[0], q[1], q[2], q[4], evRank(state, q[5]))); else keep.push(q); }
    w.queue = keep;
  }
}

//◆ウェーブを進めるここまで
