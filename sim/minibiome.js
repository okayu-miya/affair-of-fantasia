//◆ミニバイオーム（洞窟の階の中の小さな地帯）を置く部品 : 2.10.13参照
//◆区画の種類と出やすさここから
const MB_TYPES = ["fort", "garden", "mush", "mine", "cryst"];
const MB_NAMES = { fort: "廃れた要塞", garden: "地下庭園", mush: "キノコの森", mine: "古い坑道", cryst: "水晶の洞" };
const MB_MIN_FLOOR = 3;                  //◆1〜2 階（冒険の最初）には置かない
const MB_BLOB = { garden: 1, mush: 1, cryst: 1 };   //◆楕円の区画（要塞・坑道は長方形）
//◆層（族）ごとの出やすさ。どの層でも 1 点、合う族があれば足す
const MB_FAM_W = {
  fort: { castle: 4, ruin: 3, human: 2, wa: 2, mage: 1, book: 1, holy: 1, grave: 1, egypt: 2 },
  garden: { forest: 4, wild: 3, beast: 2, myth: 1, human: 1, were: 1 },
  mush: { forest: 3, grave: 2, beast: 1, goblin: 1, chaos: 1, demon: 1 },
  mine: { mine: 4, goblin: 3, basic: 1, pirate: 1, ride: 1, fire: 1 },
  cryst: { snow: 4, water: 3, sea: 1, myth: 2, holy: 1, dragon: 1, final: 1 },
};
function mbWeights(fams) {
  return MB_TYPES.map((t) => { let w = 1; for (const f of fams || []) w += (MB_FAM_W[t] && MB_FAM_W[t][f]) || 0; return w; });
}
//◆区画の種類と出やすさここまで
//◆区画の問い合わせここから
//◆区画 m が升 (x, y) を含むか（長方形は箱、楕円は箱に内接する楕円）
function mbHas(m, x, y) {
  if (x < m.x || y < m.y || x >= m.x + m.w || y >= m.y + m.h) return false;
  if (!MB_BLOB[m.type]) return true;
  const dx = (x + 0.5 - (m.x + m.w / 2)) / (m.w / 2), dy = (y + 0.5 - (m.y + m.h / 2)) / (m.h / 2);
  return dx * dx + dy * dy <= 1;
}
//◆升ごとの区画の種類（0 = 無し、1〜5 = MB_TYPES の番号 + 1）。client が絵を選ぶのに使う
function mbMap(mb, gw, gh) {
  const out = new Uint8Array(gw * gh);
  for (const m of mb || []) {
    const ti = MB_TYPES.indexOf(m.type) + 1;
    if (!ti) continue;
    for (let y = Math.max(0, m.y); y < Math.min(gh, m.y + m.h); y++) for (let x = Math.max(0, m.x); x < Math.min(gw, m.x + m.w); x++) if (mbHas(m, x, y)) out[y * gw + x] = ti;
  }
  return out;
}
//◆区画の問い合わせここまで
//◆区画を置くここから
//◆区画の大きさ（rm = ミニバイオーム専用の乱数。big = 一辺 90 以上の広い階）
function mbSize(type, rm, big) {
  if (type === "fort") { const k = 2 + (rm() < 0.5 ? 1 : 0) + (big && rm() < 0.5 ? 1 : 0), rh = rm() < 0.5 ? 4 : 3; return { w: 7 * k + 1, h: 2 * rh + 6, k, rh }; }
  if (type === "mine") { const bn = 3 + (big ? 1 : 0) + (rm() < 0.4 ? 1 : 0); return { w: 8 * bn + 4, h: 15 + (rm() < 0.5 ? 2 : 0), bn }; }
  const b = big ? 4 : 0;
  if (type === "garden") return { w: 18 + Math.floor(rm() * 7) + b, h: 14 + Math.floor(rm() * 5) + b };
  if (type === "mush") return { w: 16 + Math.floor(rm() * 7) + b, h: 14 + Math.floor(rm() * 5) + b };
  return { w: 14 + Math.floor(rm() * 7) + b, h: 12 + Math.floor(rm() * 5) + b };   //◆cryst
}
//◆楕円の中を開ける（縁はでこぼこ。残りの岩は pillar 割の柱）。中心の 2 マスの輪は必ず床
function mbCarveBlob(grid, gw, gh, m, nz, pillar, block) {
  const cx = m.x + m.w / 2, cy = m.y + m.h / 2, rx = m.w / 2, ry = m.h / 2;
  for (let y = m.y; y < m.y + m.h; y++) for (let x = m.x; x < m.x + m.w; x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, d2 = dx * dx + dy * dy;
    const lim = 0.62 + 0.38 * vnoise(x * 0.33, y * 0.33, nz);   //◆0.62〜1.0（1 を越えない＝楕円の外へは出ない）
    if (d2 > lim * lim) continue;
    const k = y * gw + x;
    if (grid[k] === BLOCK.BEDROCK) continue;
    const near = Math.abs(x + 0.5 - cx) <= 2 && Math.abs(y + 0.5 - cy) <= 2;
    grid[k] = (!near && d2 > 0.05 && (hash32(nz, x, y) % 100) < pillar) ? block : 0;
  }
}
//◆要塞：全部を壁にして、中央に幅 2 の通路（両端は外へ開く）、上と下に 6x rh の部屋を 7 マスおきに並べ、幅 2 の戸口でつなぐ。松明は壁、木箱は部屋の隅（市松に）
function mbCarveFort(grid, gw, gh, m, n, sz) {
  const face = n >= 8 ? BLOCK.HARD : BLOCK.STONE, x0 = m.x, y0 = m.y, k = sz.k, rh = sz.rh, ym = 1 + rh + 1;   //◆通路の上の行（y0 からの差）
  const at = (x, y) => (y0 + y) * gw + x0 + x;
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (grid[at(x, y)] !== BLOCK.BEDROCK) grid[at(x, y)] = face;
  for (let x = 0; x < m.w; x++) { grid[at(x, ym)] = 0; grid[at(x, ym + 1)] = 0; }   //◆通路（両端は外へ）
  const torches = [], crates = [];
  for (let i = 0; i < k; i++) {
    const rx = 1 + 7 * i;
    for (let r = 0; r < 2; r++) {
      const top = r === 0 ? 1 : ym + 3, door = r === 0 ? ym - 1 : ym + 2;   //◆部屋の一番上の行・戸口の行
      for (let y = top; y < top + rh; y++) for (let x = rx; x < rx + 6; x++) grid[at(x, y)] = 0;
      grid[at(rx + 2, door)] = 0; grid[at(rx + 3, door)] = 0;
      torches.push([x0 + rx + 1, y0 + top - 1]);   //◆部屋の天井の壁に 1 本（明かりは 1 つずつ可視多角形を求めるので、画面の中に 10 本ほどに抑える）
      if ((i + r) % 2 === 0) {   //◆木箱：奥の両隅（戸口から遠い側）
        const by = r === 0 ? top : top + rh - 1;
        crates.push([x0 + rx, y0 + by], [x0 + rx + 5, y0 + by]);
      }
    }
  }
  for (let i = 0; i <= k; i++) torches.push([x0 + 7 * i, y0 + ym - 1]);   //◆通路の天井の壁（部屋と部屋の間の柱）
  for (const c of crates) grid[c[1] * gw + c[0]] = BLOCK.CRATE;
  return { torches, gates: [[x0, y0 + ym], [x0 + m.w - 1, y0 + ym]], anchor: [x0 + 3, y0 + ym], ym };
}
//◆坑道：長方形を石で埋め、幅 2 の横坑 1 本と、8 マスおきの縦坑（幅 2・上下に抜ける）。鉱石は壁に（mbOres）。松明は横坑の天井
function mbCarveMine(grid, gw, gh, m, n, sz) {
  const x0 = m.x, y0 = m.y, ym = Math.floor(m.h / 2) - 1, bx = [];
  for (let j = 0; j < sz.bn; j++) bx.push(4 + 8 * j);
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) { const k = (y0 + y) * gw + x0 + x; if (grid[k] === 0) grid[k] = BLOCK.STONE; }
  for (let x = 0; x < m.w; x++) { grid[(y0 + ym) * gw + x0 + x] = 0; grid[(y0 + ym + 1) * gw + x0 + x] = 0; }
  for (const b of bx) for (let y = 0; y < m.h; y++) { grid[(y0 + y) * gw + x0 + b] = 0; grid[(y0 + y) * gw + x0 + b + 1] = 0; }
  const torches = [];
  for (let j = 1; j <= sz.bn; j++) torches.push([x0 + 8 * j, y0 + ym - 1]);   //◆縦坑と縦坑の間の天井
  return { torches, gates: [[x0, y0 + ym], [x0 + m.w - 1, y0 + ym]], anchor: [x0 + bx[0], y0 + ym], ym, bx };
}
//◆1 階にミニバイオームを置く。戻り値は区画の一覧 [{ type, x, y, w, h, t（松明の升）, … }]。grid を直に変える : 2.10.13参照
function placeMinis(grid, gw, gh, seed, n, sx, sy, hall) {
  const out = [];
  if (n < MB_MIN_FLOOR) return out;
  const rm = rng32(hash32(seed, n, 51)), N = gw * gh;
  const side = gw - (hall ? 8 : 0), big = side >= 90, cands = side >= 52 ? 2 : 1;
  const bi = biomeOf(n), W = mbWeights(BIOMES[bi] && BIOMES[bi].fams), WT = W.reduce((a, b) => a + b, 0);
  const nz = hash32(seed, n, 53) & 0x7fffffff;
  const count = (d) => { let c = 0; for (let k = 0; k < N; k++) if (d[k] >= 0) c++; return c; };
  let dst = floorDist(grid, gw, gh, sx, sy), reach = count(dst);
  for (let c = 0; c < cands; c++) {
    if (!(rm() < (c === 0 ? 0.5 : 0.35))) continue;
    let r = rm() * WT, ti = 0;
    for (; ti < MB_TYPES.length - 1; ti++) { if (r < W[ti]) break; r -= W[ti]; }
    const type = MB_TYPES[ti];
    const cand = [];
    for (let k = 0; k < N; k++) if (dst[k] >= 5) cand.push(k);
    for (let tries = 0; tries < 14; tries++) {
      const sz = mbSize(type, rm, big), w = sz.w, h = sz.h;
      if (w > gw - 8 || h > gh - 8) continue;
      //◆中心：届く床（開始から 5 マス以上）の中から
      let cx, cy;
      if (cand.length) { const k = cand[Math.floor(rm() * cand.length)]; cx = k % gw; cy = (k - cx) / gw; }
      else { cx = 4 + Math.floor(rm() * (gw - 8)); cy = 4 + Math.floor(rm() * (gh - 8)); }
      const x0 = clamp(cx - (w >> 1), 3, gw - w - 3), y0 = clamp(cy - (h >> 1), 3, gh - h - 3);
      if (x0 + w > gw - 3 || y0 + h > gh - 3) continue;
      if (x0 < sx + 7 && x0 + w > sx - 6 && y0 < sy + 7 && y0 + h > sy - 6) continue;   //◆開始の部屋（半径 3）の周り 3 マス
      if (hall) { const hx = hall.x, hy = hall.y, rr = hall.r + 6; if (x0 < hx + rr && x0 + w > hx - rr && y0 < hy + rr && y0 + h > hy - rr) continue; }   //◆ボスの広間の周り
      let hit = false;
      for (const o of out) if (x0 < o.x + o.w + 2 && x0 + w > o.x - 2 && y0 < o.y + o.h + 2 && y0 + h > o.y - 2) hit = true;
      if (hit) continue;
      const snap = grid.slice(), m = { type, x: x0, y: y0, w, h };
      let info;
      if (type === "fort") info = mbCarveFort(grid, gw, gh, m, n, sz);
      else if (type === "mine") info = mbCarveMine(grid, gw, gh, m, n, sz);
      else {
        mbCarveBlob(grid, gw, gh, m, nz + out.length, type === "garden" ? 13 : type === "mush" ? 9 : 14, type === "cryst" ? BLOCK.HARD : BLOCK.STONE);
        info = { anchor: [x0 + (w >> 1), y0 + (h >> 1)], gates: [] };
      }
      let d2 = floorDist(grid, gw, gh, sx, sy);
      const ak = info.anchor[1] * gw + info.anchor[0];
      if (d2[ak] < 0) {   //◆区画に入れない：区画の外で一番近い届く床まで道を掘る（要塞・坑道は両端の戸口の外から）
        const src = info.gates.length ? info.gates : [info.anchor];
        let bs = null, bt = null, bd = 1e9;
        for (let k = 0; k < N; k++) {
          if (d2[k] < 0) continue;
          const tx = k % gw, ty = (k - tx) / gw;
          if (tx >= x0 - 1 && tx <= x0 + w && ty >= y0 - 1 && ty <= y0 + h) continue;
          for (const s of src) { const d = Math.abs(s[0] - tx) + Math.abs(s[1] - ty); if (d < bd) { bd = d; bs = s; bt = [tx, ty]; } }
        }
        if (bs) {
          let fx = bs[0], fy = bs[1];
          if (info.gates.length) fx += bs[0] === x0 ? -1 : 1;   //◆戸口の 1 つ外から（要塞の壁をなぞらない）
          const base = grid.slice();
          for (let att = 0; att < 6; att++) {   //◆道が区画の中の壁を割らない（要塞・坑道）ように、割ったら戻して折れ方を変えてやり直す
            carveWinding(grid, gw, gh, rm, fx, fy, bt[0], bt[1], 1);
            if (info.gates.length) carveCell(grid, gw, gh, bs[0] + (bs[0] === x0 ? -1 : 1), bs[1]);
            let bad = false;
            if (info.gates.length) for (let y = y0; y < y0 + h && !bad; y++) for (let x = x0; x < x0 + w; x++) if (base[y * gw + x] !== 0 && grid[y * gw + x] === 0) { bad = true; break; }
            if (!bad) break;
            for (let k = 0; k < N; k++) grid[k] = base[k];
            if (att === 5) { for (let k = 0; k < N; k++) grid[k] = snap[k]; }
          }
          d2 = floorDist(grid, gw, gh, sx, sy);
        }
      }
      const r2 = count(d2);
      if (d2[ak] < 0 || r2 < Math.min(180, reach) || r2 < reach * 0.85) { for (let k = 0; k < N; k++) grid[k] = snap[k]; continue; }
      dst = d2; reach = r2;
      m.t = info.torches || [];
      if (info.ym !== undefined) m.ym = info.ym;
      if (info.bx) m.bx = info.bx;
      if (type === "fort") { m.k = sz.k; m.rh = sz.rh; }
      out.push(m);
      break;
    }
  }
  return out;
}
//◆区画を置くここまで
//◆鉱脈を置いた後：要塞の壁の鉱石は消す（レンガに鉱石は付けない）。坑道は壁（通路に面した岩）の 6 分の 1 に今の階の鉱石
function mbOres(mb, grid, ore, gw, n, seed) {
  for (const m of mb) {
    if (m.type === "fort") { for (let y = m.y; y < m.y + m.h; y++) for (let x = m.x; x < m.x + m.w; x++) ore[y * gw + x] = 0; }
    else if (m.type === "mine") {
      const t = oreTierOfFloor(n);
      for (let y = m.y; y < m.y + m.h; y++) for (let x = m.x; x < m.x + m.w; x++) {
        const k = y * gw + x;
        if (grid[k] < BLOCK.DIRT || grid[k] > BLOCK.DENSE || ore[k]) continue;
        if (grid[k - 1] !== 0 && grid[k + 1] !== 0 && grid[k - gw] !== 0 && grid[k + gw] !== 0) continue;
        if (hash32(seed, k, n + 61) % 6 === 0) ore[k] = 1 + (grid[k] === BLOCK.DENSE ? Math.min(ORE_COUNT - 1, t + 1) : t);
      }
    }
  }
}
