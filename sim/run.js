//◆ラン（1 回の探索）を作る・経験値・階の始まり : 2.10.15参照
//◆プレイヤーとイベントの小道具ここから
function findP(state, pid) { const ps = state.players; for (let i = 0; i < ps.length; i++) if (ps[i].id === pid) return ps[i]; return null; }
function isAlive(p) { return !!p && !p.dead; }
function aliveCount(state) { let n = 0; for (let i = 0; i < state.players.length; i++) if (isAlive(state.players[i])) n++; return n; }
function isOver(state) { return state.phase === PHASE.OVER; }
function ev(state, e) { state.events.push(e); }
function flushEvents(state) { const e = state.events; state.events = []; return e; }
function nearestAlive(state, x, y, exceptPid) {
  const ps = state.players;
  let best = null, bd = Infinity;
  for (let i = 0; i < ps.length; i++) { const p = ps[i]; if (!isAlive(p) || p.id === exceptPid) continue; const d = dist2(x, y, p.x, p.y); if (d < bd) { bd = d; best = p; } }
  return best;
}
//◆プレイヤーとイベントの小道具ここまで
//◆ランを作るここから
function makePlayer(loadout, charaKey, items, opts) {
  const O = (opts && typeof opts === "object") ? opts : {};
  const stats = playerStats(loadout, clampChara(charaKey), O);
  const it0 = (items && typeof items === "object") ? items : {};
  const it = { potion: clampInt(it0.potion, 0, ITEMS.potion.max), bomb: clampInt(it0.bomb, 0, ITEMS.bomb.max) };
  const si = trv(stats, "startitems");
  if (si > 0) { it.potion = Math.min(ITEMS.potion.max, it.potion + si); it.bomb = Math.min(ITEMS.bomb.max, it.bomb + si); }
  return {
    id: 1, chara: clampChara(charaKey), x: 0, y: 0, px: 0, py: 0, aim: 0, moving: 0, hp: stats.maxhp, maxhp: stats.maxhp, stats, dead: 0,
    invulnUntil: 0, contactUntil: 0, dashUntil: 0, dashCdUntil: 0, posTick: 0, shotTokens: 2, lastSeq: -1, kbx: 0, kby: 0,
    dig: { cx: -1, cy: -1, next: 0, swing: -99 },
    items: { potion: it.potion, bomb: it.bomb }, kills: 0,
    lv: stats.lv | 0, xp: EL ? clampInt(O.xp, 0, 1e12) : 0, guardLeft: 0,   //◆レベル・累計経験値・各階の最初の被弾を無効にする残り
  };
}
//◆loadout の複製（レベルアップ時の再計算用。clampEquip を通した物だけ）
function cloneLoadout(loadout) {
  const L = (loadout && typeof loadout === "object") ? loadout : {}, out = {};
  for (let i = 0; i < SLOTS.length; i++) out[SLOTS[i]] = clampEquip(L[SLOTS[i]]);
  return out;
}
//◆opts の複製（JSON に入る素の値だけ）
function cloneOpts(opts) {
  const O = (opts && typeof opts === "object") ? opts : {}, out = {};
  for (const k in O) { const v = O[k]; if (v === null || typeof v === "number" || typeof v === "string" || typeof v === "boolean") out[k] = v; else if (v && typeof v === "object") out[k] = JSON.parse(JSON.stringify(v)); }
  return out;
}
//◆ランを作る。loadout = { weapon, pick, armor, charm }、items = { potion, bomb }、hp0 = 持ち越す HP（0 以下なら全快）
//◆opts = statsOptsOf(save, key)（特性の Lv・ペンダント・lv / xp / skills）。state.lo / state.opts に複製を残す（レベルアップの再計算用）
function createRun(seed, loadout, charaKey, items, hp0, opts, startAt) {
  const s = (Number(seed) | 0) || 1, n0 = clampInt(startAt === undefined ? 1 : startAt, 1, 9999);   //◆隙間の鏡で選んだ階から
  const state = {
    ver: 1, seed: s, tick: 0, rs: (hash32(s, 1, 3) || 1) >>> 0, nextId: 1, nextBid: 0, hp0: Math.max(0, Math.floor(Number(hp0) || 0)),
    floor: 0, best: 0, startFloor: n0, phase: PHASE.FIGHT, transitLeft: 0, overTick: -1, leaveTick: -1,
    gw: 0, gh: 0, aw: 0, ah: 0, grid: null, bhp: null, ore: null, chestTier: null,
    start: { x: 0, y: 0 }, hatchCands: [], hatch: null, biome: 0, bossSpot: null,
    event: null, evOff: 0,   //◆イベント階層（今の階の { id, tier, t0, … }。evOff = 1 で抽選しない＝テスト用）
    sf: null,   //◆決戦・1000 階（{ id: "final" | "extra", … }。startFloor ごとに null へ戻す）
    wave: null, flow: null, flowTick: -999,
    enemies: [], bullets: [], ebullets: [], items: [], zones: [],
    players: [makePlayer(loadout, charaKey, items, opts)],
    lo: cloneLoadout(loadout), opts: cloneOpts(opts),
    run: { coins: 0, ore: fillN(null, ORE_COUNT), mag: fillN(null, MAG_COUNT), drops: [], kills: 0, maxChain: 0, dug: 0, mined: 0, floors: 0, chests: 0, bossKills: 0, xp: 0, lvUp: 0, mats: {}, mirrors: [],
      //◆実績の数（被弾・備品・ダッシュ・見切り・起死回生・石積みの土・無傷の階・覇者・石積み・瀬戸際）と印。fh = この階に着いた時の被弾数、it0 = 持ち込んだ備品の数
      hurt: 0, fh: 0, potions: 0, bombs: 0, dashes: 0, dodges: 0, revives: 0, pdug: 0, nohit: 0, nhs: 0, nhMax: 0, bossNoHit: 0, overlords: 0, masons: 0, clutch: 0, it0: 0,
      tea: 0, tunnel: 0, bucket: 0 },   //◆実績。tea = 敵を倒しきった階で HP 満タンになるポーションを飲んだ・tunnel = 一度のダッシュですり抜けた敵の数の最高・bucket = 100 階以降で一つの階の掘れる岩を全部掘った
    chain: 0, chainTick: -999, maxChain: 0, kills: 0, events: [], boomDepth: 0,
  };
  { const pi = state.players[0].items || {}; state.run.it0 = (pi.potion | 0) + (pi.bomb | 0); }
  //◆記憶の禁書（opts.books がある時だけ。n = この冒険で落とした数・c = 最後の本からの撃破と採掘の数え（since の続き）・f = 最後に落とした階・left = 落とせる数）
  { const bo = state.opts.books; if (bo && typeof bo === "object" && clampInt(bo.left, 0, 99) > 0) state.bk = { n: 0, c: clampInt(bo.since, 0, 1e6), f: 0, left: clampInt(bo.left, 0, 99) }; }
  startFloor(state, n0);
  return state;
}
//◆ランを作るここまで
//◆経験値を足す。レベルが上がったらその場で stats を作り直し、maxhp の差を hp にも足して ["levelup", pid, lv]
function addXp(state, p, n) {
  n = Math.max(0, Math.round(Number(n) || 0));
  if (!EL || !p || n <= 0) return;
  const xb = p.stats ? p.stats.xpPct || 0 : 0;   //◆博識・修行（特性）。経験値 +%（撃破・階クリアの両方）
  if (xb > 0) n = Math.round(n * (1 + xb / 100));
  p.xp = Math.min(1e12, Math.max(0, Math.floor(Number(p.xp) || 0)) + n);
  state.run.xp = Math.min(1e12, Math.max(0, Math.floor(Number(state.run.xp) || 0)) + n);
  while ((p.lv | 0) < LV_CAP && EL.levelOfXp(p.xp) > (p.lv | 0)) {
    p.lv = (p.lv | 0) + 1;
    state.run.lvUp = (state.run.lvUp | 0) + 1;
    const ns = playerStats(state.lo, p.chara, Object.assign({}, state.opts, { lv: p.lv }));
    const dh = ns.maxhp - p.maxhp;
    p.stats = ns; p.maxhp = ns.maxhp;
    if (dh > 0) p.hp = Math.min(p.maxhp, p.hp + dh); else p.hp = Math.min(p.maxhp, p.hp);
    ev(state, ["levelup", p.id, p.lv]);
    const lh = ns.lvHeal || 0;   //◆伸び盛り（特性）。レベルアップで回復
    if (lh > 0 && p.hp > 0 && p.hp < p.maxhp) { const h0 = p.hp; p.hp = Math.min(p.maxhp, p.hp + lh); ev(state, ["heal", p.id, Math.round((p.hp - h0) * 100) / 100]); }
  }
}
function resetHatch(state) { state.hatch = { open: 0, x: 0, y: 0, cnt: 0, openedTick: 0 }; }
//◆階の始まりここから
//◆実績。階に着いた時に決まる印（state.run）。fh = 着いた時の被弾数（無傷の階を数える元）。
//◆B1 から潜った時だけ：B30 までポーション無し（np30）・B20 までダッシュ無し（nd20）・備品を持たずに B20（nk20）・銅 +0 の武器で B30（cu30）・武器なしで B3（bare3）。
//◆始めた階から 10 階降りた tick（fast。runSummary → applyRun が 5 分以内かを見る）
function runFloorMarks(state, n) {
  const R = state.run, sf = state.startFloor | 0 || 1;
  if (!R) return;
  R.fh = R.hurt | 0;
  if (!R.fast && n - sf >= 10) R.fast = Math.max(1, state.tick | 0);
  if (sf !== 1 || n <= 1) return;
  const w = state.lo ? state.lo.weapon : null;
  if (n >= 30 && !(R.potions | 0)) R.np30 = 1;
  if (n >= 20 && !(R.dashes | 0)) R.nd20 = 1;
  if (n >= 20 && !(R.it0 | 0)) R.nk20 = 1;
  if (n >= 30 && w && w.kind !== "sp" && !(w.tier | 0) && !(w.lv | 0)) R.cu30 = 1;
  if (n >= 3 && !w) R.bare3 = 1;
}
//◆n 階を始める。evId = イベント階層（step の降下が rollEvent で決めて渡す。ボスの階では無視。省略でふつうの階）
function startFloor(state, n, evId) {
  bookSweep(state);   //◆前の階の床に残った禁書は拾った扱い（本が無ければ何もしない）
  const sfId = sfOf(state, n);   //◆決戦・1000 階（opts.fin が無ければ ""＝何も変わらない）
  const EV = !sfId && evId && EVENT_BY[evId] && n % BIOME_FLOORS !== 0 ? EVENT_BY[evId] : null;
  const L = genFloor(state.seed, n, sfId || (EV ? EV.id : "")), tick = state.tick;
  if (omakeOf(state) && !sfId) omakeHatches(L, state.seed, n);   //◆本当と嘘のハッチ・頁
  if (L.oh) state.oh = JSON.parse(JSON.stringify(L.oh)); else if (state.oh) state.oh = null;   //◆通常の探索では欄を足さない（state の JSON は変わらない）
  state.event = EV ? { id: EV.id, tier: EV.tier, t0: tick } : null;
  state.sf = null;
  if (EV && L.npc) Object.assign(state.event, { nx: L.npc.x, ny: L.npc.y, talked: 0, pick: 0 });   //◆スキマの階：紫の立つ所と話したか（1 話した・2 帰った）
  if (EV && EV.id === "horde") state.event.fam = hordeFam(state.seed, n);
  state.floor = n; state.best = Math.max(state.best, n); state.phase = PHASE.FIGHT; state.transitLeft = 0; state.overTick = -1;
  state.gw = L.gw; state.gh = L.gh; state.aw = L.aw; state.ah = L.ah;
  state.grid = L.grid; state.bhp = L.bhp; state.ore = L.ore; state.chestTier = L.chestTier;
  state.dl = diggableCount(state);   //◆この階の掘れる岩の残り（壊すたびに減らす。0 になった時だけ数え直して確かめる）
  state.start = { x: L.start.x, y: L.start.y };
  state.hatchCands = L.hatchCands.map(c => ({ x: c.x, y: c.y }));
  state.mb = L.mb && L.mb.length ? JSON.parse(JSON.stringify(L.mb)) : [];   //◆ミニバイオームの区画（絵の印。セーブには入れない）
  state.biome = L.biome; state.bossSpot = L.bossSpot ? { x: L.bossSpot.x, y: L.bossSpot.y } : null;
  resetHatch(state);
  state.wave = { i: 0, total: L.total, waves: L.waves, remaining: L.total, spawned: 0, startTick: tick, waveTick: tick, killTick: tick, cap: L.cap, queue: [] };
  state.enemies = []; state.bullets = []; state.ebullets = []; state.items = []; state.zones = [];
  state.placed = [];   //◆石積みが置いた土 [[k, 床へ戻る tick], …]
  state.flow = null; state.flowTick = -999;
  if (n > 1) state.run.floors = n - 1;
  runFloorMarks(state, n);   //◆実績（この階に着いた時に決まる印）
  ev(state, ["descend", n]);
  const ps = state.players;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    if (n === (state.startFloor || 1)) p.hp = state.hp0 > 0 ? Math.min(p.maxhp, state.hp0) : p.maxhp; else p.hp = Math.min(p.maxhp, p.hp + 1 + pv(p.stats, "descend"));
    p.dead = 0;
    p.x = state.start.x; p.y = state.start.y; p.px = p.x; p.py = p.y;
    p.invulnUntil = tick + FLOOR_INVULN_TICKS + Math.round((p.stats.floorInv || 0) * 1000 / TICK_MS);   //◆一番鶏（特性）は秒で延ばす
    p.contactUntil = 0; p.dashUntil = 0; p.dashEnd = 0; p.tn = null; p.posTick = tick; p.moving = 0; p.kbx = 0; p.kby = 0;
    p.dig.next = tick;
    p.guardLeft = p.stats.guardN | 0;   //◆guard スキル：各階の最初の被弾を無効にする回数
    ev(state, ["tp", p.id, p.x, p.y]);
  }
  if (EV) {   //◆実績の数（着いたイベント階層・上位・見た種類のビット）と client の帯
    const R = state.run;
    R.evFloors = (R.evFloors | 0) + 1;
    if (EV.tier) R.evUpper = (R.evUpper | 0) + 1;
    R.evMask = (R.evMask | 0) | (1 << EV.bit);
    ev(state, ["event", EV.id, EV.tier]);
    if (L.hatchOpen) openHatch(state);   //◆大迷宮：ハッチは最初から開いている
  }
  if (sfId) sfBegin(state, sfId, L, n);   //◆state.sf と ["sfloor", id, 鏡]
  return L;
}

//◆階の始まりここまで
