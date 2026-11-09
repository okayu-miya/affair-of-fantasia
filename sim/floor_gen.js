//◆階の生成 genFloor と、特別な階（大迷宮・狭すぎる階・決戦の広間・1000 階）の作り : 2.10.14参照
//◆階を作る。evId = イベント階層（ボスの階では無視）：maze / tiny は別の作り（genMaze / genTiny）、
//◆grid は洞窟の代わりに部屋と通路、wide は面積 1.5 倍、ore は全部の岩に鉱石、chest は宝箱 5 倍、dirt は岩を全部土に、
//◆double は敵の数と同時の上限を倍、yukari は敵なしで紫の立つ所（L.npc）。evId が無ければ乱数の列は変わらない
//◆o.mini === false ならミニバイオームを置かない（テストが「ミニバイオームが無い時の盤面」を比べる用。ふつうは渡さない）
function genFloor(seed, n, evId, o) {
  if (evId === "final") return genFinal(seed, n);   //◆決戦の広間・1000 階（startFloor が opts.fin を見て渡す）
  if (evId === "extra") return genExtra(seed, n);
  if (evId === "marisa" || evId === "mima") return genOmakeArena(seed, n);   //◆おまけの層の魔理沙（7 階）・魅魔（13 階）の広間
  const boss = n % BIOME_FLOORS === 0;
  const ev = !boss && evId && EVENT_BY[evId] ? String(evId) : "";
  if (ev === "maze") return genMaze(seed, n);
  if (ev === "tiny") return genTiny(seed, n);
  //◆一辺 = floorSide(n)（1 階 40・10 階 57・100 階 80・1000 階 113）。ボス階は +8、広間の階は面積 1.5 倍。
  //◆敵・鉱脈・宝箱・木箱の数は面積あたりの密度が変わらないよう grow（= 基準の一辺との面積の比。広間の 1.5 倍は別）で増やす
  let gw = floorSide(n);
  const grow = areaGrow(gw, floorSideOld(n), boss ? 8 : 0);
  if (boss) gw += 8;
  if (ev === "wide") gw = Math.round(gw * Math.sqrt(WIDE_AREA));   //◆広間の階：面積 1.5 倍（B1 40 → 49、B25〜 56 → 69）
  const gh = gw, N = gw * gh;
  const R = rng32(hash32(seed, n, 7));
  const grid = new Array(N), bhp = new Array(N).fill(0), ore = new Array(N).fill(0), chestTier = new Array(N).fill(0);
  rockNoise(grid, gw, gh, seed, n);   //◆岩の硬さ
  let sx, sy;
  if (ev === "grid") { const g = carveGrid(grid, gw, gh, R, n); sx = g.sx; sy = g.sy; }   //◆石造りの階：部屋と通路
  else {
    carveCaves(grid, gw, gh, R);   //◆洞窟
    //◆開始の部屋
    sx = 4 + Math.floor(R() * (gw - 8)); sy = 4 + Math.floor(R() * (gh - 8));
    carveDisc(grid, gw, gh, sx, sy, 3, 3);
  }
  //◆ボス階は中央の広間
  let bossSpot = null;
  if (boss) {
    const bx = Math.floor(gw / 2), by = Math.floor(gh / 2), rr = Math.floor(gw / 6);
    carveDisc(grid, gw, gh, bx, by, rr, Math.floor(rr * 0.85));
    carveWinding(grid, gw, gh, R, sx, sy, bx, by, 2);
    bossSpot = { x: bx * CELL + CELL / 2, y: by * CELL + CELL / 2 };
  }
  //◆ミニバイオーム（ふつうの階だけ。専用の乱数なので R は動かない） : 2.10.13参照
  const mb = !ev && !(o && o.mini === false) ? placeMinis(grid, gw, gh, seed, n, sx, sy, boss ? { x: Math.floor(gw / 2), y: Math.floor(gh / 2), r: Math.floor(gw / 6) } : null) : [];
  //◆到達性：届く床が 180 未満なら大きい部屋へ道を掘って繋ぐ
  let dst = floorDist(grid, gw, gh, sx, sy);
  let reach = 0;
  for (let k = 0; k < N; k++) if (dst[k] >= 0) reach++;
  for (let tries = 0; tries < 6 && reach < 180; tries++) {
    const L1 = labelRooms(grid, gw, gh);
    const startLabel = L1.label[sy * gw + sx];
    let best = -1, bs = 0;
    for (let l = 1; l < L1.sizes.length; l++) if (l !== startLabel && L1.sizes[l] > bs) { bs = L1.sizes[l]; best = l; }
    if (best < 0) break;
    //◆目標部屋のセルと、届く床のセルで最も近い組を探す（間引いて O(n) に）
    let bk = -1, ak = -1, bd = 1e9;
    for (let k = 0; k < N; k += 3) {
      if (L1.label[k] !== best) continue;
      const x = k % gw, y = (k - x) / gw;
      for (let j = 0; j < N; j += 3) {
        if (dst[j] < 0) continue;
        const x2 = j % gw, y2 = (j - x2) / gw, d = Math.abs(x - x2) + Math.abs(y - y2);
        if (d < bd) { bd = d; bk = k; ak = j; }
      }
    }
    if (bk < 0) break;
    carveWinding(grid, gw, gh, R, ak % gw, Math.floor(ak / gw), bk % gw, Math.floor(bk / gw), 1 + Math.floor(R() * 2));
    dst = floorDist(grid, gw, gh, sx, sy);
    reach = 0;
    for (let k = 0; k < N; k++) if (dst[k] >= 0) reach++;
  }
  const L = { gw, gh, aw: gw * CELL, ah: gh * CELL, grid, bhp, ore, chestTier, start: { x: sx * CELL + CELL / 2, y: sy * CELL + CELL / 2 }, hatchCands: [], bossSpot, biome: biomeOf(n), reach, mb };
  //◆ハッチ候補：遠い順に 6 個（4 セル以上離す。半径 20 の体が入る床）
  {
    const order = [];
    for (let k = 0; k < N; k++) if (dst[k] > 4) order.push(k);
    order.sort((a, b) => dst[b] - dst[a] || a - b);
    const picked = [];
    for (let i = 0; i < order.length && picked.length < 6; i++) {
      const k = order[i], x = k % gw, y = (k - x) / gw;
      let ok = !hitsWall(L, x * CELL + CELL / 2, y * CELL + CELL / 2, 20);
      for (let j = 0; j < picked.length && ok; j++) { const p = picked[j]; if (Math.abs(p[0] - x) < 4 && Math.abs(p[1] - y) < 4) ok = false; }
      if (ok) picked.push([x, y]);
    }
    if (!picked.length) picked.push([sx, sy]);
    for (let i = 0; i < picked.length; i++) L.hatchCands.push({ x: picked[i][0] * CELL + CELL / 2, y: picked[i][1] * CELL + CELL / 2 });
  }
  //◆スキマの階。紫は開始の部屋（半径 3 の円は必ず床）の中、開始から √5 マスの所に立つ（向きは hash）
  let npcX = -99, npcY = -99;
  if (ev === "yukari") {
    const o = hash32(seed, n, 37) & 3;
    npcX = sx + (o & 1 ? 2 : -2); npcY = sy + (o & 2 ? 1 : -1);
    L.npc = { x: npcX * CELL + CELL / 2, y: npcY * CELL + CELL / 2 };
  }
  //◆鉱脈（ランダムウォーク）。広間の階は面積に合わせて 1.5 倍、鉱脈の階は残りの岩にも全部
  placeVeins(grid, ore, gw, gh, R, n, Math.round(Math.min(44, 12 + n) * (ev === "wide" ? WIDE_AREA : 1) * grow));
  if (ev === "ore") fillOre(grid, ore, R, n);
  if (mb.length) mbOres(mb, grid, ore, gw, n, seed);   //◆要塞の壁の鉱石を消す・坑道の壁に鉱石
  //◆宝箱：床から 2〜5 セル離れた岩の中（宝物庫の階は 5 倍）
  {
    const mul = ev === "chest" ? CHEST_EVENT_MUL : 1;
    const want = growCount((Math.min(4, 1 + Math.floor(n / 6)) + (boss ? 1 : 0)) * mul, grow, R);
    let placed = 0;
    for (let tries = 0; tries < 400 * mul * Math.ceil(grow) && placed < want; tries++) {
      const x = 2 + Math.floor(R() * (gw - 4)), y = 2 + Math.floor(R() * (gh - 4)), k = y * gw + x;
      if (grid[k] < BLOCK.DIRT || grid[k] > BLOCK.DENSE) continue;
      let nearFloor = false, farFloor = false;
      //◆「隣に床が無い」と「5 セル以内に床がある」の両方を最後まで見る（途中で抜けると隣の床を見落とす）
      for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= gw || yy >= gh || grid[yy * gw + xx] !== 0) continue;
        const cd = Math.max(Math.abs(dx), Math.abs(dy));
        if (cd <= 1) nearFloor = true; else farFloor = true;
      }
      if (nearFloor || !farFloor) continue;
      grid[k] = BLOCK.CHEST; ore[k] = 0;
      chestTier[k] = clamp(tierOfFloorRaw(n) + (boss || R() < 0.35 ? 1 : 0), 0, EQUIP_TIERS - 1);
      placed++;
    }
  }
  //◆木箱：届く床の上に 4〜8 個（開始から 3 セル以上、ハッチ候補の上は避ける）
  {
    const reach0 = reach;
    const want = growCount(4 + Math.floor(R() * 5), grow, R);
    let placed = 0;
    for (let tries = 0; tries < 300 * Math.ceil(grow) && placed < want; tries++) {
      const x = 2 + Math.floor(R() * (gw - 4)), y = 2 + Math.floor(R() * (gh - 4)), k = y * gw + x;
      if (grid[k] !== 0 || dst[k] < 3) continue;
      //◆通路をふさがないよう、周り 8 マスのうち 6 マス以上が床の開けた所だけ
      let openN = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && grid[(y + dy) * gw + x + dx] === 0) openN++;
      if (openN < 6) continue;
      let onHatch = false;
      for (let i = 0; i < L.hatchCands.length; i++) if (Math.abs(L.hatchCands[i].x - (x * CELL + CELL / 2)) < CELL * 2 && Math.abs(L.hatchCands[i].y - (y * CELL + CELL / 2)) < CELL * 2) onHatch = true;
      if (onHatch || (Math.abs(x - npcX) <= 1 && Math.abs(y - npcY) <= 1)) continue;   //◆紫の足元にも置かない
      if (bossSpot && Math.abs(bossSpot.x - (x * CELL + CELL / 2)) <= CELL * 2 && Math.abs(bossSpot.y - (y * CELL + CELL / 2)) <= CELL * 2) continue;   //◆ボスの湧く広間の真ん中（2 マス以内）にも置かない
      //◆置いても届く床が減らない（部屋と部屋の「戸口」をふさがない）ことを確かめる
      grid[k] = BLOCK.CRATE;
      const d2 = floorDist(grid, gw, gh, sx, sy);
      let reach2 = 0;
      for (let j = 0; j < N; j++) if (d2[j] >= 0) reach2++;
      if (reach2 !== reach - 1 || reach2 < Math.min(180, reach0)) { grid[k] = 0; continue; }   //◆木箱の数は面積の比で増えるので、置いた後も届く床が 180 を割らない
      reach = reach2; dst = d2; placed++;
    }
  }
  if (ev === "dirt") for (let k = 0; k < N; k++) if (grid[k] >= BLOCK.DIRT && grid[k] <= BLOCK.DENSE) grid[k] = BLOCK.DIRT;   //◆土の階（鉱石・宝箱・木箱はそのまま）
  setBhp(grid, bhp, ore);   //◆岩の HP
  //◆敵の数
  //◆総数は面積に比例（上限 44 は 56 マス四方のもの）。同時に出る数 cap は √面積比で伸ばす（敵は自機へ集まるので、画面の混み方は面積ほどは変わらない）
  let total = Math.round(Math.min(44, 6 + Math.round(n * 1.3)) * grow);
  if (boss) total = Math.round(total * 0.7);
  L.total = total; L.waves = clamp(2 + Math.floor(n / 4), 2, 5); L.cap = Math.round(clamp(6 + Math.floor(n / 3), 6, 14) * Math.sqrt(grow));
  if (ev === "double") { L.total *= 2; L.cap *= 2; }   //◆大群の階（最大 44 → 88 体・同時 14 → 28 体。ウェーブの数は同じ）
  else if (ev === "yukari") { L.total = 0; L.waves = 1; }   //◆スキマの階は敵なし
  return L;
}
//◆鉱脈・岩の HP ここから
//◆鉱脈（ランダムウォーク）。本数 veins、段階は階の周辺（下の段階も 30%）。堅岩の中は 1 段上
function placeVeins(grid, ore, gw, gh, R, n, veins) {
  const base = oreTierOfFloor(n);
  for (let v = 0; v < veins; v++) {
    let t = base;
    if (base > 0 && R() < 0.30) t = Math.floor(R() * base);
    //◆岩の上から歩き始める（床の上に始まると 1 個も置けない）
    let x = 1 + Math.floor(R() * (gw - 2)), y = 1 + Math.floor(R() * (gh - 2));
    for (let tries = 0; tries < 20 && !(grid[y * gw + x] >= BLOCK.DIRT && grid[y * gw + x] <= BLOCK.DENSE); tries++) { x = 1 + Math.floor(R() * (gw - 2)); y = 1 + Math.floor(R() * (gh - 2)); }
    const len = 3 + Math.floor(R() * 7);
    let placed = 0;
    for (let i = 0; i < len * 3 && placed < len; i++) {
      const k = y * gw + x;
      if (grid[k] >= BLOCK.DIRT && grid[k] <= BLOCK.DENSE && !ore[k]) { ore[k] = 1 + (grid[k] === BLOCK.DENSE ? Math.min(ORE_COUNT - 1, t + 1) : t); placed++; }
      const dir = Math.floor(R() * 4);
      x = clamp(x + (dir === 0 ? 1 : dir === 1 ? -1 : 0), 1, gw - 2); y = clamp(y + (dir === 2 ? 1 : dir === 3 ? -1 : 0), 1, gh - 2);
    }
  }
}
//◆鉱脈の階。鉱脈の入っていない残りの岩（土〜堅岩）にも全部、鉱脈と同じ決まりで段階を振る
function fillOre(grid, ore, R, n) {
  const base = oreTierOfFloor(n);
  for (let k = 0; k < grid.length; k++) {
    if (ore[k] || grid[k] < BLOCK.DIRT || grid[k] > BLOCK.DENSE) continue;
    let t = base;
    if (base > 0 && R() < 0.30) t = Math.floor(R() * base);
    ore[k] = 1 + (grid[k] === BLOCK.DENSE ? Math.min(ORE_COUNT - 1, t + 1) : t);
  }
}
//◆岩の HP（鉱石入りは 1.5 倍。床と岩盤は 0）
function setBhp(grid, bhp, ore) {
  for (let k = 0; k < grid.length; k++) {
    const b = grid[k];
    if (b === 0 || b === BLOCK.BEDROCK) { bhp[k] = 0; continue; }
    bhp[k] = BLOCK_DEF[b].hp * (ore[k] ? 1.5 : 1);
  }
}
//◆鉱脈・岩の HP ここまで
//◆大迷宮ここから
//◆大迷宮。面積はその階のふつうの広さの 10 倍（B1 40² → 127²、B25〜 56² → 178²）。
//◆区画（床 2x2）と壁 1 マスの迷路を深さ優先で掘り、行き止まりの 35% を隣へ抜いて輪を作る（歩いて 600〜900 マス）。
//◆壁はふつうの岩（掘って近道もできる）。開始は隅の区画、ハッチは反対の隅の 3 分の 1 で一番遠い区画（最初から開く：L.hatchOpen）。
//◆敵は出ない。宝箱と木箱は行き止まりの奥、鉱脈は 4 倍
function genMaze(seed, n) {
  const g0 = floorSide(n), grow = areaGrow(g0, floorSideOld(n), 0);   //◆基準の一辺は floorSide(n)。宝箱・木箱・鉱脈は面積の比で増やす
  const M = Math.round((g0 * Math.sqrt(MAZE_AREA) - 1) / 3), gw = 3 * M + 1, gh = gw, N = gw * gh, U = M * M;
  const R = rng32(hash32(seed, n, 31));
  const grid = new Array(N), bhp = new Array(N).fill(0), ore = new Array(N).fill(0), chestTier = new Array(N).fill(0);
  rockNoise(grid, gw, gh, seed, n);
  //◆区画の道（ビット：1 右・2 下・4 左・8 上）
  const E = new Array(U).fill(0), seen = new Array(U).fill(0), step = (u, d) => d === 0 ? u + 1 : d === 1 ? u + M : d === 2 ? u - 1 : u - M;
  const free = (u, d) => { const x = u % M, y = (u - x) / M; return d === 0 ? x < M - 1 : d === 1 ? y < M - 1 : d === 2 ? x > 0 : y > 0; };
  const st = [Math.floor(R() * U)];
  seen[st[0]] = 1;
  while (st.length) {
    const u = st[st.length - 1], nb = [];
    for (let d = 0; d < 4; d++) if (free(u, d) && !seen[step(u, d)]) nb.push(d);
    if (!nb.length) { st.pop(); continue; }
    const d = nb[Math.floor(R() * nb.length)], v = step(u, d);
    E[u] |= 1 << d; E[v] |= 1 << ((d + 2) % 4); seen[v] = 1; st.push(v);
  }
  const deg = (u) => (E[u] & 1) + ((E[u] >> 1) & 1) + ((E[u] >> 2) & 1) + ((E[u] >> 3) & 1);
  for (let u = 0; u < U; u++) {
    if (deg(u) !== 1 || R() >= 0.35) continue;
    const nb = [];
    for (let d = 0; d < 4; d++) if (free(u, d) && !(E[u] & (1 << d))) nb.push(d);
    if (!nb.length) continue;
    const d = nb[Math.floor(R() * nb.length)], v = step(u, d);
    E[u] |= 1 << d; E[v] |= 1 << ((d + 2) % 4);
  }
  for (let u = 0; u < U; u++) {
    const ux = u % M, uy = (u - ux) / M, x0 = 1 + 3 * ux, y0 = 1 + 3 * uy;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) grid[(y0 + dy) * gw + x0 + dx] = 0;
    if (E[u] & 1) { grid[y0 * gw + x0 + 2] = 0; grid[(y0 + 1) * gw + x0 + 2] = 0; }
    if (E[u] & 2) { grid[(y0 + 2) * gw + x0] = 0; grid[(y0 + 2) * gw + x0 + 1] = 0; }
  }
  //◆開始は隅（c のビット：1 右・2 下）から 2 区画以内、ハッチは反対の隅の 3 分の 1 で道のりが一番遠い区画
  const c = Math.floor(R() * 4);
  const sux = (c & 1) ? M - 1 - Math.floor(R() * 2) : Math.floor(R() * 2), suy = (c & 2) ? M - 1 - Math.floor(R() * 2) : Math.floor(R() * 2), su = suy * M + sux;
  const D = new Array(U).fill(-1), q = [su];
  D[su] = 0;
  for (let h = 0; h < q.length; h++) { const u = q[h]; for (let d = 0; d < 4; d++) if (E[u] & (1 << d)) { const v = step(u, d); if (D[v] < 0) { D[v] = D[u] + 1; q.push(v); } } }
  let hu = -1, hd = -1;
  for (let u = 0; u < U; u++) {
    const x = u % M, y = (u - x) / M;
    if (!((c & 1) ? x < M / 3 : x >= M * 2 / 3) || !((c & 2) ? y < M / 3 : y >= M * 2 / 3)) continue;
    if (D[u] > hd) { hd = D[u]; hu = u; }
  }
  const upx = (u) => (2 + 3 * (u % M)) * CELL, upy = (u) => (2 + 3 * Math.floor(u / M)) * CELL;   //◆区画の真ん中（床 4 マスの角）
  //◆行き止まり（開始とハッチ以外）の奥のマスに宝箱、その次に木箱
  const dead = [];
  for (let u = 0; u < U; u++) if (deg(u) === 1 && u !== su && u !== hu) dead.push(u);
  for (let i = dead.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)), t = dead[i]; dead[i] = dead[j]; dead[j] = t; }
  const wantChest = growCount(Math.min(16, 6 + Math.floor(n / 8)), grow, R), wantCrate = growCount(6 + Math.floor(R() * 5), grow, R);
  for (let i = 0; i < dead.length && i < wantChest + wantCrate; i++) {
    const u = dead[i], ux = u % M, uy = (u - ux) / M, open = E[u];
    //◆口と反対側の 2 マスのどちらか
    const bx = (open & 1) ? 0 : (open & 4) ? 1 : Math.floor(R() * 2), by = (open & 2) ? 0 : (open & 8) ? 1 : Math.floor(R() * 2);
    const k = (1 + 3 * uy + by) * gw + 1 + 3 * ux + bx;
    if (i < wantChest) { grid[k] = BLOCK.CHEST; chestTier[k] = clamp(tierOfFloorRaw(n) + (R() < 0.5 ? 1 : 0), 0, EQUIP_TIERS - 1); }
    else grid[k] = BLOCK.CRATE;
  }
  placeVeins(grid, ore, gw, gh, R, n, Math.round(Math.min(44, 12 + n) * 4 * grow));
  setBhp(grid, bhp, ore);
  const sx0 = 1 + 3 * sux, sy0 = 1 + 3 * suy, dst = floorDist(grid, gw, gh, sx0, sy0);
  let reach = 0;
  for (let k = 0; k < N; k++) if (dst[k] >= 0) reach++;
  return { gw, gh, aw: gw * CELL, ah: gh * CELL, grid, bhp, ore, chestTier, start: { x: upx(su), y: upy(su) }, hatchCands: [{ x: upx(hu), y: upy(hu) }], bossSpot: null, biome: biomeOf(n), reach,
    total: 0, waves: 1, cap: 6, hatchOpen: 1, mazePath: hd * 3 };
}
//◆大迷宮ここまで
//◆狭すぎる階ここから
//◆狭すぎる階。33x33 の岩盤（画面の外まで岩で埋まって見える大きさ）の真ん中に 5x5 の部屋だけ（掘れる岩は無い）。
//◆四隅に良い宝箱（その階の段階 +2）、敵は出ない。宝箱を全部開けると真ん中に床が開く（evHold。開けずにいても TINY_WAIT で開く）
function genTiny(seed, n) {
  const gw = 33, gh = 33, N = gw * gh, a = 14, b = 18, mid = 16;
  const grid = new Array(N).fill(BLOCK.BEDROCK), bhp = new Array(N).fill(0), ore = new Array(N).fill(0), chestTier = new Array(N).fill(0);
  for (let y = a; y <= b; y++) for (let x = a; x <= b; x++) grid[y * gw + x] = 0;
  for (const [x, y] of [[a, a], [b, a], [a, b], [b, b]]) { const k = y * gw + x; grid[k] = BLOCK.CHEST; chestTier[k] = clamp(tierOfFloorRaw(n) + 2, 0, EQUIP_TIERS - 1); }
  setBhp(grid, bhp, ore);
  const c = { x: mid * CELL + CELL / 2, y: mid * CELL + CELL / 2 };
  return { gw, gh, aw: gw * CELL, ah: gh * CELL, grid, bhp, ore, chestTier, start: { x: c.x, y: c.y }, hatchCands: [{ x: c.x, y: c.y }], bossSpot: null, biome: biomeOf(n), reach: 21,
    total: 0, waves: 1, cap: 6 };
}
//◆狭すぎる階ここまで
//◆決戦の広間と 1000 階ここから
//◆決戦の広間。岩盤だけ（掘れる岩・鉱石・宝箱・木箱なし）で、真ん中に FIN_ARENA² マス（15×15 = 480px）の床。外は岩盤 FIN_PAD マス。
//◆紫（npc）は上の真ん中、自機は下の真ん中から。ハッチは真ん中（勝つか通してもらうと開く）。box = 床の外枠 [x0, y0, x1, y1]（決戦の弾はこの外で消える）
function genFinal(seed, n) {
  const A = FIN_ARENA, P = FIN_PAD, gw = A + 2 * P, gh = gw, N = gw * gh, mid = P + (A >> 1);
  const grid = new Array(N).fill(BLOCK.BEDROCK), bhp = new Array(N).fill(0), ore = new Array(N).fill(0), chestTier = new Array(N).fill(0);
  for (let y = P; y < P + A; y++) for (let x = P; x < P + A; x++) grid[y * gw + x] = 0;
  const at = (x, y) => ({ x: x * CELL + CELL / 2, y: y * CELL + CELL / 2 });
  return { gw, gh, aw: gw * CELL, ah: gh * CELL, grid, bhp, ore, chestTier, start: at(mid, P + A - 2), hatchCands: [at(mid, mid)], bossSpot: null, biome: biomeOf(n), reach: A * A,
    total: 0, waves: 1, cap: 6, npc: at(mid, P + 2), box: [P * CELL, P * CELL, (P + A) * CELL, (P + A) * CELL] };
}
//◆1000 階。敵のいない丸い広間（半径 10.5 マス。岩盤の柱 8 本を真上・真下からずらして立てる）。掘れる岩・宝箱は無い。
//◆紫は上の方で待っていて、話す（input.talk）か FIN_AUTO tick で贈り物を渡し、真ん中のハッチを開ける（extraGift）。花火は client だけ
function genExtra(seed, n) {
  const gw = 27, gh = 27, N = gw * gh, c = 13, RR = 10.5 * 10.5;
  const grid = new Array(N).fill(BLOCK.BEDROCK), bhp = new Array(N).fill(0), ore = new Array(N).fill(0), chestTier = new Array(N).fill(0);
  for (let y = 1; y < gh - 1; y++) for (let x = 1; x < gw - 1; x++) if ((x - c) * (x - c) + (y - c) * (y - c) <= RR) grid[y * gw + x] = 0;
  for (let i = 0; i < 8; i++) { const a = (i + 0.5) * Math.PI / 4; grid[Math.round(c + Math.sin(a) * 7.5) * gw + Math.round(c + Math.cos(a) * 7.5)] = BLOCK.BEDROCK; }
  let reach = 0;
  for (let k = 0; k < N; k++) if (grid[k] === 0) reach++;
  const at = (x, y) => ({ x: x * CELL + CELL / 2, y: y * CELL + CELL / 2 });
  return { gw, gh, aw: gw * CELL, ah: gh * CELL, grid, bhp, ore, chestTier, start: at(c, c + 7), hatchCands: [at(c, c)], bossSpot: null, biome: biomeOf(n), reach,
    total: 0, waves: 1, cap: 6, npc: at(c, c - 4), box: [(c - 10) * CELL, (c - 10) * CELL, (c + 11) * CELL, (c + 11) * CELL] };
}

//◆決戦の広間と 1000 階ここまで
