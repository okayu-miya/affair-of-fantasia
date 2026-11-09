//◆階を作る部品（部屋のラベル・距離・掘る・岩の硬さ・石造りの階・洞窟・階の広さ） : 2.10.12参照
//◆部屋のラベルと距離ここから
//◆4 近傍の塗りつぶしで部屋にラベルを付ける。戻り値 { label[], sizes[] }（label は 0 = 岩、1.. = 部屋）
function labelRooms(grid, gw, gh) {
  const N = gw * gh, label = new Array(N).fill(0), sizes = [0];
  let cur = 0;
  for (let k0 = 0; k0 < N; k0++) {
    if (grid[k0] !== 0 || label[k0]) continue;
    cur++; sizes.push(0);
    const q = [k0]; label[k0] = cur;
    let head = 0;
    while (head < q.length) {
      const k = q[head++]; sizes[cur]++;
      const x = k % gw, y = (k - x) / gw;
      if (x > 0 && grid[k - 1] === 0 && !label[k - 1]) { label[k - 1] = cur; q.push(k - 1); }
      if (x < gw - 1 && grid[k + 1] === 0 && !label[k + 1]) { label[k + 1] = cur; q.push(k + 1); }
      if (y > 0 && grid[k - gw] === 0 && !label[k - gw]) { label[k - gw] = cur; q.push(k - gw); }
      if (y < gh - 1 && grid[k + gw] === 0 && !label[k + gw]) { label[k + gw] = cur; q.push(k + gw); }
    }
  }
  return { label, sizes };
}
//◆床だけを通る幅優先の距離（開始セルが 0）。届かないところは -1
function floorDist(grid, gw, gh, sx, sy) {
  const N = gw * gh, d = new Array(N).fill(-1), q = [];
  const k0 = sy * gw + sx;
  if (grid[k0] !== 0) return d;
  d[k0] = 0; q.push(k0);
  let head = 0;
  while (head < q.length) {
    const k = q[head++], v = d[k] + 1, x = k % gw, y = (k - x) / gw;
    if (x > 0 && grid[k - 1] === 0 && d[k - 1] < 0) { d[k - 1] = v; q.push(k - 1); }
    if (x < gw - 1 && grid[k + 1] === 0 && d[k + 1] < 0) { d[k + 1] = v; q.push(k + 1); }
    if (y > 0 && grid[k - gw] === 0 && d[k - gw] < 0) { d[k - gw] = v; q.push(k - gw); }
    if (y < gh - 1 && grid[k + gw] === 0 && d[k + gw] < 0) { d[k + gw] = v; q.push(k + gw); }
  }
  return d;
}
//◆部屋のラベルと距離ここまで
//◆掘る・岩の硬さ・階の型ここから
function carveCell(grid, gw, gh, x, y) { if (x <= 0 || y <= 0 || x >= gw - 1 || y >= gh - 1) return; if (grid[y * gw + x] !== BLOCK.BEDROCK) grid[y * gw + x] = 0; }
//◆(x0,y0)→(x1,y1) を軸に沿った折れ線で掘る（bends 回曲がる）
function carveWinding(grid, gw, gh, R, x0, y0, x1, y1, bends) {
  let x = x0, y = y0;
  const pts = [];
  for (let i = 0; i < bends; i++) {
    const t = (i + 1) / (bends + 1);
    const wx = clamp(Math.round(x0 + (x1 - x0) * t + (R() * 2 - 1) * 5), 1, gw - 2), wy = clamp(Math.round(y0 + (y1 - y0) * t + (R() * 2 - 1) * 5), 1, gh - 2);
    pts.push([wx, wy]);
  }
  pts.push([x1, y1]);
  for (let i = 0; i < pts.length; i++) {
    const tx = pts[i][0], ty = pts[i][1];
    const horizFirst = R() < 0.5;
    if (horizFirst) { while (x !== tx) { x += tx > x ? 1 : -1; carveCell(grid, gw, gh, x, y); } while (y !== ty) { y += ty > y ? 1 : -1; carveCell(grid, gw, gh, x, y); } }
    else { while (y !== ty) { y += ty > y ? 1 : -1; carveCell(grid, gw, gh, x, y); } while (x !== tx) { x += tx > x ? 1 : -1; carveCell(grid, gw, gh, x, y); } }
  }
}
function carveDisc(grid, gw, gh, cxi, cyi, rx, ry) {
  for (let y = Math.floor(cyi - ry); y <= Math.ceil(cyi + ry); y++) for (let x = Math.floor(cxi - rx); x <= Math.ceil(cxi + rx); x++) {
    const dx = (x - cxi) / rx, dy = (y - cyi) / ry;
    if (dx * dx + dy * dy <= 1) carveCell(grid, gw, gh, x, y);
  }
}
//◆岩の硬さ（ノイズ）。外周 1 セルは岩盤。大迷宮・石造りの階と共用
function rockNoise(grid, gw, gh, seed, n) {
  const nseed = hash32(seed, n, 11) & 0x7fffffff;
  const shift = Math.min(0.25, 0.02 * n);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    const k = y * gw + x;
    if (x === 0 || y === 0 || x === gw - 1 || y === gh - 1) { grid[k] = BLOCK.BEDROCK; continue; }
    const v = fbm(x * 0.11, y * 0.11, nseed);
    if (v > 0.62 + shift * 0.5) grid[k] = BLOCK.DIRT;
    else if (n >= 8 && v < 0.16 + shift * 0.6) grid[k] = BLOCK.DENSE;
    else if (v < 0.30 + shift) grid[k] = BLOCK.HARD;
    else grid[k] = BLOCK.STONE;
  }
}
//◆石造りの階。10 マスの区画ごとに偶数の幅（4・6・8）の部屋を中央にそろえて置き、隣の区画とまっすぐな幅 2 の通路でつなぐ
//◆（深さ優先の木＋残りの辺の 3 割で輪）。8x8 の部屋の半分には柱を等間隔に 4 本。部屋に面した岩は切り出した石（B8 から硬岩）。戻り値は開始セル
function carveGrid(grid, gw, gh, R, n) {
  const S = 10, A = Math.max(1, Math.floor((gw - 2) / S)), B = Math.max(1, Math.floor((gh - 2) / S));
  const ox = Math.floor((gw - A * S) / 2), oy = Math.floor((gh - B * S) / 2), rooms = [];
  for (let b = 0; b < B; b++) for (let a = 0; a < A; a++) {
    const w = 4 + 2 * Math.floor(R() * 3), h = 4 + 2 * Math.floor(R() * 3);
    const cx = ox + a * S + S / 2, cy = oy + b * S + S / 2, x0 = cx - w / 2, y0 = cy - h / 2;
    rooms.push({ x0, y0, w, h, cx, cy });
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) carveCell(grid, gw, gh, x, y);
    if (w === 8 && h === 8 && R() < 0.5) for (const py of [y0 + 2, y0 + 5]) for (const px of [x0 + 2, x0 + 5]) grid[py * gw + px] = BLOCK.STONE;
  }
  //◆区画の木（深さ優先）＋輪
  const U = A * B, seen = new Array(U).fill(0), link = {}, st = [Math.floor(R() * U)];
  seen[st[0]] = 1;
  while (st.length) {
    const u = st[st.length - 1], a = u % A, b = (u - a) / A, nb = [];
    if (a < A - 1 && !seen[u + 1]) nb.push(u + 1);
    if (b < B - 1 && !seen[u + A]) nb.push(u + A);
    if (a > 0 && !seen[u - 1]) nb.push(u - 1);
    if (b > 0 && !seen[u - A]) nb.push(u - A);
    if (!nb.length) { st.pop(); continue; }
    const v = nb[Math.floor(R() * nb.length)];
    link[Math.min(u, v) + "," + Math.max(u, v)] = 1; seen[v] = 1; st.push(v);
  }
  for (let u = 0; u < U; u++) {
    const a = u % A;
    if (a < A - 1 && !link[u + "," + (u + 1)] && R() < 0.3) link[u + "," + (u + 1)] = 1;
    if (u + A < U && !link[u + "," + (u + A)] && R() < 0.3) link[u + "," + (u + A)] = 1;
  }
  for (const key of Object.keys(link)) {
    const pr = key.split(","), r1 = rooms[+pr[0]], r2 = rooms[+pr[1]];
    if (r2.cy === r1.cy) { for (let x = r1.x0 + r1.w; x < r2.x0; x++) { carveCell(grid, gw, gh, x, r1.cy - 1); carveCell(grid, gw, gh, x, r1.cy); } }
    else { for (let y = r1.y0 + r1.h; y < r2.y0; y++) { carveCell(grid, gw, gh, r1.cx - 1, y); carveCell(grid, gw, gh, r1.cx, y); } }
  }
  //◆部屋と通路に面した岩（8 近傍）は切り出した石
  const face = n >= 8 ? BLOCK.HARD : BLOCK.STONE;
  for (let y = 1; y < gh - 1; y++) for (let x = 1; x < gw - 1; x++) {
    const k = y * gw + x;
    if (grid[k] === 0 || grid[k] === BLOCK.BEDROCK) continue;
    let nf = false;
    for (let dy = -1; dy <= 1 && !nf; dy++) for (let dx = -1; dx <= 1; dx++) if (grid[k + dy * gw + dx] === 0) { nf = true; break; }
    if (nf) grid[k] = face;
  }
  const r0 = rooms[Math.floor(R() * rooms.length)];
  return { sx: r0.cx, sy: r0.cy };
}
//◆洞窟（セル・オートマトン）。12 セル未満の部屋は埋める
function carveCaves(grid, gw, gh, R) {
  const N = gw * gh;
  let open = new Uint8Array(N);   //◆0/1 を Uint8Array で持つ
  for (let y = 1; y < gh - 1; y++) for (let x = 1; x < gw - 1; x++) open[y * gw + x] = R() < 0.41 ? 1 : 0;
  for (let it = 0; it < 4; it++) {
    const nx = new Uint8Array(N);
    for (let y = 1; y < gh - 1; y++) for (let x = 1; x < gw - 1; x++) {
      let rock = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; if (!open[(y + dy) * gw + x + dx]) rock++; }
      nx[y * gw + x] = rock < 5 ? 1 : 0;
    }
    open = nx;
  }
  for (let k = 0; k < N; k++) if (open[k] && grid[k] !== BLOCK.BEDROCK) grid[k] = 0;
  {
    const L0 = labelRooms(grid, gw, gh);
    for (let k = 0; k < N; k++) if (grid[k] === 0 && L0.sizes[L0.label[k]] < 12) grid[k] = BLOCK.STONE;
  }
}
//◆掘る・岩の硬さ・階の型ここまで
//◆階の広さここから
//◆n 階の一辺 = round(40 × 2^(log10(n)/2))。1 階 40・10 階 57・100 階 80・1000 階 113（面積は 10 倍ごとに 2 倍）
function floorSide(n) { n = Math.max(1, Number(n) || 1); return Math.round(40 * Math.pow(2, Math.log10(n) / 2)); }
//◆広がる前の一辺（B25 から 56。数の密度の基準）
function floorSideOld(n) { return 40 + Math.min(16, 2 * Math.floor((n - 1) / 3)); }
//◆新しい一辺 s と基準の一辺 s0（どちらにも extra を足す＝ボス階の +8）の面積の比。同じ一辺なら 1
function areaGrow(s, s0, extra) { const a = s + (extra | 0), b = s0 + (extra | 0); return a === b ? 1 : (a * a) / (b * b); }
//◆数 w を面積の比 g で増やす。小数の端は R で切り上げ/下げ（g = 1 なら R を引かない＝乱数の列が動かない）
function growCount(w, g, R) { if (g === 1) return w; const v = w * g, f = Math.floor(v); return f + (R() < v - f ? 1 : 0); }
//◆階の広さここまで
