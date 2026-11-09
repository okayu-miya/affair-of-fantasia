//◆乱数・ノイズ・幾何の道具（hash32・rng32・rnd・vnoise・fbm・clamp） : 2.10.4参照
function hash32(a, b, c) {
  let h = ((a | 0) ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ ((b | 0) + 0x7f4a7c15), 0x85ebca6b) >>> 0; h ^= h >>> 13;
  h = Math.imul(h ^ ((c | 0) + 0x165667b1), 0xc2b2ae35) >>> 0; h ^= h >>> 16;
  h = Math.imul(h, 0x27d4eb2f) >>> 0; h ^= h >>> 15;
  return h >>> 0;
}
//◆階生成専用の乱数（xorshift32）。0 以上 1 未満
function rng32(seed) {
  let s = (seed >>> 0) || 0x1234567;
  return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return (s >>> 0) / 4294967296; };
}
//◆ラン中の乱数。state.rs を進める
function rnd(state) {
  let s = (state.rs >>> 0) || 0x9e3779b9;
  s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
  state.rs = s;
  return s / 4294967296;
}
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
const DEG = Math.PI / 180;
const dist2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));
const isNum = v => typeof v === "number" && Number.isFinite(v);
const r1 = v => Math.round(v * 10) / 10;
const r2 = v => Math.round(v * 100) / 100;
//◆2D 値ノイズ（格子点のハッシュを smoothstep で補間）。0..1
function vnoise(x, y, seed) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const v = (i, j) => (hash32(seed, i, j) & 0xffff) / 65535;
  const a = v(x0, y0), b = v(x0 + 1, y0), c = v(x0, y0 + 1), d = v(x0 + 1, y0 + 1);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}
function fbm(x, y, seed) { return (vnoise(x, y, seed) * 0.55 + vnoise(x * 2, y * 2, seed + 1) * 0.3 + vnoise(x * 4, y * 4, seed + 2) * 0.15); }

