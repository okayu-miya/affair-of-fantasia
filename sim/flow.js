//◆距離場（自機から歩いて届く距離）と wasm の受け口、敵の向き・進む向き : 2.10.18参照
//◆wasm の受け口ここから
//◆wasm（native/core.c）の受け口。使えれば距離場を wasm で作る。無ければ JS（結果は同じ。useWasm は使えるようになったかを返す） : 2.10.18参照
let WASM = null;
function useWasm(inst) {
  const ex = inst && typeof inst === "object" ? (inst.exports && typeof inst.exports === "object" ? inst.exports : inst) : null;
  WASM = (ex && ex.memory && typeof ex.fs_alloc === "function" && typeof ex.fs_reset === "function" && typeof ex.flow_bfs === "function") ? ex : null;
  return !!WASM;
}
function hasWasm() { return !!WASM; }
//◆wasm で距離場を作る（起点は 1 人ぶん）。失敗したら false（JS へ）
function rebuildFlowWasm(state, f, gw, gh, sx, sy) {
  const n = gw * gh, grid = state.grid;
  try {
    WASM.fs_reset();
    const op = WASM.fs_alloc(n * 4), gp = WASM.fs_alloc(n);
    if (!(op > 0) || !(gp > 0) || (op & 3) !== 0) return false;   //◆fs_alloc は失敗で 0 を返す（0 番地へ書かない）
    const g8 = new Uint8Array(WASM.memory.buffer, gp, n);
    for (let i = 0; i < n; i++) g8[i] = grid[i] !== 0 ? 1 : 0;
    WASM.flow_bfs(gw, gh, gp, op, sx, sy);
    const out = new Int32Array(WASM.memory.buffer, op, n);
    for (let i = 0; i < n; i++) f[i] = out[i];
    return true;
  } catch (e) { return false; }
}
//◆wasm の受け口ここまで
//◆距離場と進む向きここから
function rebuildFlow(state) {
  const gw = state.gw | 0, gh = state.gh | 0, grid = state.grid;
  if (!grid || gw <= 0 || gh <= 0) { state.flow = null; return; }
  const n = gw * gh;
  let f = state.flow;
  if (!f || f.length !== n) { f = []; for (let i = 0; i < n; i++) f.push(-1); state.flow = f; }
  else for (let i = 0; i < n; i++) f[i] = -1;
  const q = [], ps = state.players;
  //◆wasm：起点が 1 人（players[0]）のときだけ。自機が壁の中・範囲外なら JS と同じく何もしない（全部 -1）
  if (WASM && ps.length === 1) {
    const p = ps[0];
    if (!isAlive(p)) { state.flowTick = state.tick; return; }
    const cxi = Math.floor(p.x / CELL), cyi = Math.floor(p.y / CELL);
    if (cxi < 0 || cyi < 0 || cxi >= gw || cyi >= gh || grid[cyi * gw + cxi] !== 0) { state.flowTick = state.tick; return; }
    if (rebuildFlowWasm(state, f, gw, gh, cxi, cyi)) { state.flowTick = state.tick; return; }
  }
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    if (!isAlive(p)) continue;
    const cxi = Math.floor(p.x / CELL), cyi = Math.floor(p.y / CELL);
    if (cxi < 0 || cyi < 0 || cxi >= gw || cyi >= gh) continue;
    const k = cyi * gw + cxi;
    if (grid[k] !== 0 || f[k] === 0) continue;
    f[k] = 0; q.push(k);
  }
  let head = 0;
  while (head < q.length) {
    const k = q[head++], v = f[k] + 1, x = k % gw, y = (k - x) / gw;
    if (x > 0) { const j = k - 1; if (f[j] < 0 && grid[j] === 0) { f[j] = v; q.push(j); } }
    if (x < gw - 1) { const j = k + 1; if (f[j] < 0 && grid[j] === 0) { f[j] = v; q.push(j); } }
    if (y > 0) { const j = k - gw; if (f[j] < 0 && grid[j] === 0) { f[j] = v; q.push(j); } }
    if (y < gh - 1) { const j = k + gw; if (f[j] < 0 && grid[j] === 0) { f[j] = v; q.push(j); } }
  }
  state.flowTick = state.tick;
}
function ensureFlow(state) { if (!state.flow || state.flowTick < 0 || state.flow.length !== state.gw * state.gh) rebuildFlow(state); }
function reachable(state, cxi, cyi) { ensureFlow(state); if (!state.flow || !inGrid(state, cxi, cyi)) return false; return state.flow[cyi * state.gw + cxi] >= 0; }
function reachablePx(state, x, y) { return reachable(state, Math.floor(x / CELL), Math.floor(y / CELL)); }
function flowDir(state, e) {
  const f = state.flow, grid = state.grid;
  if (!f || !grid) return null;
  const gw = state.gw | 0, gh = state.gh | 0, cxi = Math.floor(e.x / CELL), cyi = Math.floor(e.y / CELL);
  if (cxi < 0 || cyi < 0 || cxi >= gw || cyi >= gh) return null;
  const here = f[cyi * gw + cxi];
  let best = -1, bx = 0, by = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (dx === 0 && dy === 0) continue;
    const nx = cxi + dx, ny = cyi + dy;
    if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
    const k = ny * gw + nx;
    if (grid[k] !== 0) continue;
    if (dx !== 0 && dy !== 0 && (grid[cyi * gw + nx] !== 0 || grid[ny * gw + cxi] !== 0)) continue;
    const v = f[k];
    if (v < 0) continue;
    if (best < 0 || v < best) { best = v; bx = nx; by = ny; }
  }
  if (best < 0) return null;
  if (here >= 0 && best >= here) return null;
  const tx = bx * CELL + CELL / 2, ty = by * CELL + CELL / 2, ux = tx - e.x, uy = ty - e.y, d = Math.sqrt(ux * ux + uy * uy);
  if (d < 0.0001) return null;
  return [ux / d, uy / d];
}
function steerFor(state, e, dx, dy, d) {
  if (d <= 0.0001) return [1, 0];
  if (!segHitsWall(state, e.x, e.y, e.x + dx, e.y + dy, e.r)) return [dx / d, dy / d];
  const f = flowDir(state, e);
  if (f) return f;
  return steerDir(state, e.x, e.y, e.r, dx, dy, d);
}
function rushMul(state) {
  const w = state.wave;
  if (!w || w.remaining > 5) return 1;
  const idle = state.tick - (w.killTick | 0);
  if (idle < 300) return 1;
  const k = 1 + (idle - 300) / 600;
  return k > 2 ? 2 : k;
}
const TURN_DEG = { shielded: 6, charger: 10, stationary: 8 };
function turnTo(e, want) {
  const lim = (TURN_DEG[e.beh] || 24) * DEG;
  let da = want - e.aim;
  da = ((da + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  e.aim += clamp(da, -lim, lim);
}
//◆距離場と進む向きここまで
