//◆地形の問い合わせ（grid[k] !== 0 が壁。範囲外は壁）と、層・ボスの決まり : 2.10.5参照
//◆壁の問い合わせここから
function cellIndex(state, cxi, cyi) { return cyi * (state.gw | 0) + cxi; }
function cellOf(x, y) { return [Math.floor(x / CELL), Math.floor(y / CELL)]; }
function inGrid(state, cxi, cyi) { return cxi >= 0 && cyi >= 0 && cxi < (state.gw | 0) && cyi < (state.gh | 0); }
function blockAt(state, cxi, cyi) { return inGrid(state, cxi, cyi) ? state.grid[cyi * state.gw + cxi] : BLOCK.BEDROCK; }
function isSolid(state, cxi, cyi) { return blockAt(state, cxi, cyi) !== 0; }
function wallCell(state, cxi, cyi) {
  const g = state && state.grid;
  if (!g) return false;
  if (cxi < 0 || cyi < 0 || cxi >= (state.gw | 0) || cyi >= (state.gh | 0)) return true;
  return g[cyi * state.gw + cxi] !== 0;
}
function hitsWall(state, x, y, r) {
  if (!state || !state.grid) return false;
  const c0 = Math.floor((x - r) / CELL), c1 = Math.floor((x + r) / CELL);
  const r0 = Math.floor((y - r) / CELL), r1 = Math.floor((y + r) / CELL);
  for (let cyi = r0; cyi <= r1; cyi++) for (let cxi = c0; cxi <= c1; cxi++) {
    if (!wallCell(state, cxi, cyi)) continue;
    const bx = cxi * CELL, by = cyi * CELL;
    const qx = x < bx ? bx : (x > bx + CELL ? bx + CELL : x), qy = y < by ? by : (y > by + CELL ? by + CELL : y);
    const dx = x - qx, dy = y - qy;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}
//◆(x,y) に最も近い「届く床」（自機から距離場で届く）で半径 r が収まる所。半径 8 セルまで。無ければ null
function nearestReachableFree(state, x, y, r) {
  const cx0 = Math.floor(x / CELL), cy0 = Math.floor(y / CELL);
  for (let rad = 0; rad <= 8; rad++) for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
    const ax = dx < 0 ? -dx : dx, ay = dy < 0 ? -dy : dy;
    if ((ax > ay ? ax : ay) !== rad) continue;
    const cxi = cx0 + dx, cyi = cy0 + dy;
    if (wallCell(state, cxi, cyi) || !reachable(state, cxi, cyi)) continue;
    const px = cxi * CELL + CELL / 2, py = cyi * CELL + CELL / 2;
    if (!hitsWall(state, px, py, r)) return [px, py];
  }
  return null;
}
function nearestFree(state, x, y, r) {
  const cx0 = Math.floor(x / CELL), cy0 = Math.floor(y / CELL);
  for (let rad = 0; rad <= 40; rad++) for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
    const ax = dx < 0 ? -dx : dx, ay = dy < 0 ? -dy : dy;
    if ((ax > ay ? ax : ay) !== rad) continue;
    const cxi = cx0 + dx, cyi = cy0 + dy;
    if (wallCell(state, cxi, cyi)) continue;
    const px = cxi * CELL + CELL / 2, py = cyi * CELL + CELL / 2;
    if (!hitsWall(state, px, py, r)) return [px, py];
  }
  return [x, y];
}
function pushOut(state, x, y, r) {
  if (!state || !state.grid) return [x, y];
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    const c0 = Math.floor((x - r) / CELL), c1 = Math.floor((x + r) / CELL);
    const r0 = Math.floor((y - r) / CELL), r1 = Math.floor((y + r) / CELL);
    for (let cyi = r0; cyi <= r1; cyi++) for (let cxi = c0; cxi <= c1; cxi++) {
      if (!wallCell(state, cxi, cyi)) continue;
      const bx = cxi * CELL, by = cyi * CELL;
      const qx = x < bx ? bx : (x > bx + CELL ? bx + CELL : x), qy = y < by ? by : (y > by + CELL ? by + CELL : y);
      const dx = x - qx, dy = y - qy, d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;
      if (d2 > 0.000001) { const d = Math.sqrt(d2); x = qx + dx / d * r; y = qy + dy / d * r; }
      else {
        const le = x - bx, ri = bx + CELL - x, tp = y - by, bo = by + CELL - y, m = Math.min(le, ri, tp, bo);
        if (m === le) x = bx - r; else if (m === ri) x = bx + CELL + r; else if (m === tp) y = by - r; else y = by + CELL + r;
      }
      moved = true;
    }
    if (!moved) break;
  }
  if (hitsWall(state, x, y, r)) return nearestFree(state, x, y, r);
  return [x, y];
}
function segHitsWall(state, x0, y0, x1, y1, r) {
  if (!state || !state.grid) return false;
  const dx = x1 - x0, dy = y1 - y0, len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.0001) return hitsWall(state, x0, y0, r);
  const n = Math.ceil(len / (CELL * 0.5));
  for (let i = 0; i <= n; i++) { const t = i / n; if (hitsWall(state, x0 + dx * t, y0 + dy * t, r)) return true; }
  return false;
}
function steerDir(state, ex, ey, er, dx, dy, d) {
  if (d <= 0.0001) return [1, 0];
  const ux = dx / d, uy = dy / d, look = er + 34;
  if (!segHitsWall(state, ex, ey, ex + ux * look, ey + uy * look, er)) return [ux, uy];
  const S45 = 0.7071067811865476, C45 = 0.7071067811865476;
  for (let step = 1; step <= 3; step++) {
    const c = step === 1 ? C45 : (step === 2 ? 0 : -C45), sn = step === 1 ? S45 : (step === 2 ? 1 : S45);
    const rx = ux * c - uy * sn, ry = ux * sn + uy * c, lx = ux * c + uy * sn, ly = -ux * sn + uy * c;
    const rOk = !segHitsWall(state, ex, ey, ex + rx * look, ey + ry * look, er), lOk = !segHitsWall(state, ex, ey, ex + lx * look, ey + ly * look, er);
    if (rOk && lOk) return (rx * ux + ry * uy) >= (lx * ux + ly * uy) ? [rx, ry] : [lx, ly];
    if (rOk) return [rx, ry];
    if (lOk) return [lx, ly];
  }
  return [-ux, -uy];
}
const cx = (st, x, r) => clamp(x, CELL + r, (st && st.aw ? st.aw : 1280) - CELL - r);
const cy = (st, y, r) => clamp(y, CELL + r, (st && st.ah ? st.ah : 1280) - CELL - r);
//◆壁の問い合わせここまで
//◆層とボスの決まりここから

//◆層の始まりの階（BIOMES[i].from。1〜120 階は 5 階ごとの 24 層、121 階からは 10・20・25・50・100 階ごとの 41 層）。
//◆from が無い表は 5 階ごと。2000 階より先は最後の層のまま
const BIOME_FROM = BIOMES.map((b, i) => (b && (b.from | 0) > 0) ? b.from | 0 : i * BIOME_FLOORS + 1);
function biomeOf(n) {
  let lo = 0, hi = BIOME_FROM.length - 1;
  if (!(n >= BIOME_FROM[0])) return 0;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (BIOME_FROM[mid] <= n) lo = mid; else hi = mid - 1; }
  return lo;
}
//◆ボスの強さの段（称号・HP・速さ・決戦の HP の元）。層の数ではなく、24 層（CYCLE_BIOMES = 120 階）で数える＝層を足しても釣り合いは変わらない
function bossCycle(n) { return Math.floor((n / BIOME_FLOORS - 1) / CYCLE_BIOMES); }
function bossOf(n) {
  if (n <= 0 || n % BIOME_FLOORS !== 0 || n === EXTRA_FLOOR) return null;   //◆1000 階は紫が祝いに来る階（ボスなし）
  const bi = biomeOf(n), fam = BIOMES[bi].boss, list = FAMILY_BOSSES[fam];
  if (!list || !list.length) return null;
  //◆10 階以上の層には 5 階ごとにボスが何度も来る。層の中の何番目か（j）だけ族の表をずらして、同じ種が続かないように（1〜120 階は j = 0）
  const j = Math.max(0, Math.floor((n - BIOME_FROM[bi]) / BIOME_FLOORS));
  const k = list[(bossCycle(n) + j) % list.length];
  return KINDS[k] ? k : list[0];
}
function bossTitle(n) { return ["", "闇の", "深淵の", "終焉の", "永劫の"][clamp(bossCycle(n), 0, 4)]; }
function kindIndex(kind) { const i = KIND_IDX[kind]; return i === undefined ? -1 : i; }
function speciesName(kind, floor) { const K = KINDS[kind]; if (!K) return "？"; if (floor && K.boss) return bossTitle(floor) + K.name; return K.name; }

//◆層とボスの決まりここまで
