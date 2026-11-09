//◆岩を掘る・記憶の禁書・土を置く・掘る狙い : 2.10.21参照
//◆岩を掘るここから
//◆掘れる岩の数（土・石・硬岩・堅岩・宝箱・木箱。外周と内側の岩盤は数えない）。階を始める時に 1 回だけ数え、壊す・置くたびに dlAdd で増減する。
//◆「100 階以降で一つの階の掘れる岩を全部掘る」（実績）の元。毎フレームは数えない
function diggableCount(state) {
  const g = state.grid;
  let n = 0;
  if (g) for (let k = 0; k < g.length; k++) if (g[k] >= BLOCK.DIRT) n++;
  return n;
}
//◆掘れる岩の残りを d だけ動かす。0 になったら本当に 0 か数え直し（食い違いがあれば直す）、100 階以降なら実績の印 run.bucket を立てる
function dlAdd(state, d) {
  if (typeof state.dl !== "number") { state.dl = diggableCount(state); return; }
  state.dl += d;
  if (state.dl > 0) return;
  state.dl = diggableCount(state);
  if (state.dl === 0 && (state.floor | 0) >= BUCKET_FROM && !(state.run.bucket | 0)) state.run.bucket = 1;
}
//◆岩 1 セルにダメージ。掘り抜いたら true。byPlayer=1 なら成果に数える。quiet=1 なら clank を出さない
function damageBlock(state, cxi, cyi, pow, byPlayer, quiet) {
  if (!inGrid(state, cxi, cyi)) return false;
  const k = cyi * state.gw + cxi, b = state.grid[k];
  if (b < BLOCK.DIRT) return false;
  const def = BLOCK_DEF[b];
  const px = cxi * CELL + CELL / 2, py = cyi * CELL + CELL / 2;
  if (def.minPow > pow) { if (!quiet) ev(state, ["clank", px, py]); return false; }
  const o = state.ore[k];
  const maxhp = def.hp * (o ? 1.5 : 1);
  state.bhp[k] = r2(state.bhp[k] - pow);
  if (state.bhp[k] > 0) { ev(state, ["dig", cxi, cyi, r2(state.bhp[k] / maxhp)]); return false; }
  state.grid[k] = 0; state.bhp[k] = 0; state.ore[k] = 0;
  state.flowTick = -999;
  dlAdd(state, -1);   //◆掘れる岩の残り
  ev(state, ["break", cxi, cyi, b, o]);
  const p = state.players[0], luck = p && p.stats ? p.stats.luck : 0;
  if (byPlayer) state.run.dug++;
  const pdirt = byPlayer && b === BLOCK.DIRT && Array.isArray(state.placed) && state.placed.some((pl) => pl[0] === k);   //◆石積みが置いた土
  if (pdirt) state.run.pdug = (state.run.pdug | 0) + 1;   //◆実績（石積みが置いた土を掘った）
  const pst = p && p.stats ? p.stats : {};   //◆掘り出し物・精錬・宝探し（特性）
  //◆石積みの置き土では掘り出し物のコイン・豊穣の回復を引かない（置かせて掘るだけで稼げた）
  if (byPlayer && !pdirt && (pst.digCoin || 0) > 0 && b !== BLOCK.CHEST && rnd(state) * 100 < pst.digCoin) dropItem(state, ITEM_KIND.COIN, px, py, 1 + Math.floor(state.floor / 10));
  if (byPlayer && !pdirt && (pst.digHeal || 0) > 0 && b !== BLOCK.CHEST && b !== BLOCK.CRATE && isAlive(p) && p.hp < p.maxhp && rnd(state) * 100 < pst.digHeal) {   //◆豊穣（特性）。岩で HP 1（満タンなら引かない）
    p.hp = Math.min(p.maxhp, p.hp + 1); ev(state, ["heal", p.id, 1]);
  }
  if (o) {
    const ol = p ? pv(p.stats, "orelucky") : 0;   //◆鉱石運（特性＋スキル）
    let n = 1 + (rnd(state) < 0.35 ? 1 : 0) + (rnd(state) < luck ? 1 : 0) + (ol > 0 && rnd(state) < ol / 100 ? 1 : 0);
    let ot = o - 1;
    if ((pst.oreUp || 0) > 0 && rnd(state) * 100 < pst.oreUp) ot = Math.min(ORE_COUNT - 1, ot + 1);   //◆1 段上の鉱石
    for (let i = 0; i < n; i++) dropItem(state, ITEM_KIND.ORE, px, py, ot);
  }
  if (b === BLOCK.CHEST) {
    let tier = state.chestTier[k] | 0;
    if ((pst.chestUp || 0) > 0 && rnd(state) * 100 < pst.chestUp) tier = Math.min(EQUIP_TIERS - 1, tier + 1);   //◆宝箱の段階 +1
    const eq = rollEquip(() => rnd(state), state.floor, luck);
    eq.tier = tier;
    dropItem(state, ITEM_KIND.EQUIP, px, py, eq.tier, eq);
    dropItem(state, ITEM_KIND.COIN, px, py, 5 + 3 * state.floor);
    state.chestTier[k] = 0;
    state.run.chests++;
    ev(state, ["chest", cxi, cyi, tier]);
    ev(state, ["drop", eq]);
  } else if (b === BLOCK.CRATE) {
    dropItem(state, ITEM_KIND.COIN, px, py, 1 + Math.floor(rnd(state) * 3));
    if (rnd(state) < heartRate(p, 0.12)) dropItem(state, ITEM_KIND.HEART, px, py, 1);
  } else if (byPlayer && state.bk) bookRoll(state, px, py);   //◆記憶の禁書（自分で掘った岩だけ。宝箱・木箱は除く）
  return true;
}
//◆岩を掘るここまで
//◆記憶の禁書ここから
//◆記憶の禁書の抽選（撃破・採掘 1 回ごと）。state.bk がある時だけ（createRun が opts.books から作る）。
//◆rng32(hash32(hash32(seed, 階, 塩), 数え, 塩 + 1)) で引く（rnd の列を動かさない）。1 階に 1 冊・この冒険で min(left, BOOK_RUN_MAX) 冊まで
//◆（届いたら数えない）・最後の本から BOOK_PITY 回を超えたら次で必ず（数えは冒険をまたぐ。落ちたら 0 から）。落ちた本は消えない（隙間の鏡と同じ）
function bookRoll(state, x, y) {
  const B = state.bk;
  if (!B || B.n >= Math.min(B.left, BOOK_RUN_MAX)) return;
  B.c++;
  if (B.f === state.floor) return;
  const R = rng32(hash32(hash32(state.seed, state.floor, BOOK_SALT), B.c, BOOK_SALT + 1));
  R();   //◆最初の 1 個は種と相関が残るので捨てる
  if (!(R() < BOOK_RATE || B.c > BOOK_PITY)) return;
  B.n++; B.f = state.floor; B.c = 0;
  const a = R() * Math.PI * 2, sp = 120 + R() * 100;
  state.items.push({ id: state.nextId++, kind: ITEM_KIND.BOOK, x, y, px: x, py: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, v: B.n, dieTick: state.tick + 1e9, born: state.tick });
  ev(state, ["bookDrop", B.n]);
}
//◆拾った禁書を数える（run.books と ["book", この冒険で何冊目か]）。stepItems と bookSweep から
function bookGot(state) { state.run.books = (state.run.books | 0) + 1; ev(state, ["book", state.run.books]); }
//◆床に残った記憶の禁書を拾った扱いにする（階を降りる時＝startFloor・帰還＝leave・倒れた＝over・client の endRun）。
//◆本が無ければ何もしない（opts.books の無い冒険は本が出ない）。戻り値は拾った数
function bookSweep(state) {
  if (!state || !state.bk || !Array.isArray(state.items)) return 0;
  let n = 0;
  for (let i = 0; i < state.items.length; i++) if (state.items[i].kind === ITEM_KIND.BOOK) n++;
  if (!n) return 0;
  const p = state.players[0];
  state.items = state.items.filter((it) => {
    if (it.kind !== ITEM_KIND.BOOK) return true;
    bookGot(state);
    ev(state, ["pickup", p ? p.id : 0, it.kind, it.v]);
    return false;
  });
  return n;
}
//◆記憶の禁書ここまで
//◆土を置くここから
//◆土を置けるか。内側の床で、自機・敵（自分も）・落ち物・湧く予定の所と重ならず、ハッチ（候補すべて）の 1 セル以内でないこと
function canPlaceAt(state, cxi, cyi) {
  const gw = state.gw | 0, gh = state.gh | 0;
  if (!state.grid || cxi <= 0 || cyi <= 0 || cxi >= gw - 1 || cyi >= gh - 1) return false;
  if (state.grid[cyi * gw + cxi] !== 0) return false;
  const ps = state.players;
  for (let i = 0; i < ps.length; i++) if (distToCell(ps[i].x, ps[i].y, cxi, cyi) < PLAYER_R + 4) return false;
  const es = state.enemies;
  for (let i = 0; i < es.length; i++) { const a = es[i]; if (!a.gone && distToCell(a.x, a.y, cxi, cyi) < a.r + 2) return false; }
  const its = state.items;
  for (let i = 0; i < its.length; i++) if (distToCell(its[i].x, its[i].y, cxi, cyi) < ITEM_R + 2) return false;
  const q = state.wave ? state.wave.queue : null;
  if (q) for (let i = 0; i < q.length; i++) { if (q[i][3] > 0 && distToCell(q[i][1], q[i][2], cxi, cyi) < (KINDS[q[i][0]] ? KINDS[q[i][0]].r : 16) + 2) return false; }
  const near = (x, y) => Math.abs(Math.floor(x / CELL) - cxi) <= 1 && Math.abs(Math.floor(y / CELL) - cyi) <= 1;
  const hc = state.hatchCands || [];
  for (let i = 0; i < hc.length; i++) if (near(hc[i].x, hc[i].y)) return false;
  if (state.hatch && state.hatch.open && near(state.hatch.x, state.hatch.y)) return false;
  return true;
}
//◆土を置く（canPlaceAt を通った所だけ）。PLACED_LIFE 後に stepPlaced が床へ戻す。["place", cx, cy, 岩の種類, 置いた敵の id]
function placeBlock(state, cxi, cyi, eid) {
  const k = cyi * state.gw + cxi;
  state.grid[k] = BLOCK.DIRT; state.bhp[k] = BLOCK_DEF[BLOCK.DIRT].hp; state.ore[k] = 0;
  state.flowTick = -999;
  dlAdd(state, 1);   //◆置いた土も掘れる岩
  if (!Array.isArray(state.placed)) state.placed = [];
  state.placed = state.placed.filter((pl) => pl[0] !== k);   //◆同じセルの古い控え（掘られた後の物）は捨てる
  state.placed.push([k, state.tick + PLACED_LIFE]);
  ev(state, ["place", cxi, cyi, BLOCK.DIRT, eid | 0]);
}
//◆寿命の来た置き土を床へ戻す（まだ土のままの所だけ。詰み防止）。["unplace", cx, cy]
function stepPlaced(state) {
  const P = state.placed;
  if (!Array.isArray(P) || !P.length) return;
  const tick = state.tick, grid = state.grid, gw = state.gw | 0;
  const keep = [];
  for (let i = 0; i < P.length; i++) {
    const k = P[i][0];
    if (tick < P[i][1]) { keep.push(P[i]); continue; }
    if (grid[k] !== BLOCK.DIRT) continue;
    grid[k] = 0; state.bhp[k] = 0; state.ore[k] = 0;
    state.flowTick = -999;
    dlAdd(state, -1);
    ev(state, ["unplace", k % gw, (k - k % gw) / gw]);
  }
  state.placed = keep;
}
//◆土を置くここまで
//◆掘る狙いここから
//◆セルの最寄り点までの距離
function distToCell(x, y, cxi, cyi) {
  const bx = cxi * CELL, by = cyi * CELL;
  const qx = x < bx ? bx : (x > bx + CELL ? bx + CELL : x), qy = y < by ? by : (y > by + CELL ? by + CELL : y);
  return dist(x, y, qx, qy);
}
//◆ねらい (ax,ay) から「いま掘れるセル」を決める
function digTarget(state, ax, ay) {
  const p = state.players[0];
  if (!p || p.dead || !state.grid) return null;
  const reach = p.stats.reach;
  let dx = ax - p.x, dy = ay - p.y, d = Math.sqrt(dx * dx + dy * dy);
  let ux, uy;
  if (d < 0.001) { ux = Math.cos(p.aim); uy = Math.sin(p.aim); } else { ux = dx / d; uy = dy / d; }
  const stepPx = 8, steps = Math.ceil(reach / stepPx);
  let lastK = -1;
  for (let i = 1; i <= steps; i++) {
    const t = Math.min(reach, i * stepPx), x = p.x + ux * t, y = p.y + uy * t;
    const cxi = Math.floor(x / CELL), cyi = Math.floor(y / CELL), k = cyi * state.gw + cxi;
    if (k === lastK) continue;
    lastK = k;
    const b = blockAt(state, cxi, cyi);
    if (b === BLOCK.BEDROCK) return null;
    if (b >= BLOCK.DIRT) return { cx: cxi, cy: cyi };
  }
  const cxi = Math.floor(ax / CELL), cyi = Math.floor(ay / CELL), b = blockAt(state, cxi, cyi);
  if (b >= BLOCK.DIRT && distToCell(p.x, p.y, cxi, cyi) <= reach) return { cx: cxi, cy: cyi };
  return null;
}
function applyDig(state, p, dig) {
  if (!dig || typeof dig !== "object" || !isNum(dig.cx) || !isNum(dig.cy) || !isAlive(p)) return;
  const cxi = Math.floor(dig.cx), cyi = Math.floor(dig.cy), tick = state.tick;
  const b = blockAt(state, cxi, cyi);
  if (b < BLOCK.DIRT) return;
  if (distToCell(p.x, p.y, cxi, cyi) > p.stats.reach + 2) return;
  if (tick < p.dig.next) return;
  p.dig.next = tick + p.stats.digCd; p.dig.swing = tick; p.dig.cx = cxi; p.dig.cy = cyi;
  p.aim = Math.atan2(cyi * CELL + CELL / 2 - p.y, cxi * CELL + CELL / 2 - p.x);
  ev(state, ["swing", p.id, cxi, cyi]);
  damageBlock(state, cxi, cyi, p.stats.digPow, 1, 0);
  if (p.stats.splash > 0) {
    //◆ハンマー：十字 4 マスは ×splash、四隅 4 マスは ×splash×0.5
    //◆素手を 0.5・土／石／宝箱／木箱の minPow を 0.5 にしたので、四隅も「十字の半分」のまま削れる（段階 0 で 0.5）
    const sp = r2(p.stats.digPow * p.stats.splash), sp2 = r2(p.stats.digPow * p.stats.splash * HAMMER_CORNER);
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]], nc = [[1, 1], [-1, 1], [1, -1], [-1, -1]];
    for (let i = 0; i < nb.length; i++) { const nx = cxi + nb[i][0], ny = cyi + nb[i][1]; if (blockAt(state, nx, ny) >= BLOCK.DIRT) damageBlock(state, nx, ny, sp, 1, 1); }
    for (let i = 0; i < nc.length; i++) { const nx = cxi + nc[i][0], ny = cyi + nc[i][1]; if (blockAt(state, nx, ny) >= BLOCK.DIRT) damageBlock(state, nx, ny, sp2, 1, 1); }
  }
}
//◆掘る狙いここまで
