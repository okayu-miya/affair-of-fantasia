//◆敵の生成・ダメージ・撃破・ドロップ : 2.10.16参照
//◆敵の強さの伸びここから
function spdMulOf(n) { return Math.min(1.4, 1 + 0.02 * (n - 1)); }
//◆階 n の敵の攻撃の伸びの倍率（ATK_FROM 階まで 1。ATK_FROM・ATK_PER・ATK_MAX。土台の EATK_BASE は eAtk で掛ける）
function atkMulOf(n) { n = Number(n) || 0; return n <= ATK_FROM ? 1 : Math.min(ATK_MAX, 1 + (n - ATK_FROM) / ATK_PER); }
//◆敵の攻撃 v を今の階で伸ばす：v × EATK_BASE × atkMulOf(階)（0.25 刻み・最低 0.25）
function eAtk(state, v) { return Math.max(0.25, Math.round(v * EATK_BASE * atkMulOf(state.floor) * 4) / 4); }
function ebSpeed(state, base) { return clamp(base * spdMulOf(state.floor), EBULLET_MIN_SPEED, EBULLET_MAX_SPEED); }
//◆種の HP × 階の倍率（エリート・ボスの倍率を掛ける前。経験値の元）
function baseHpOf(kind, n) { const K = KINDS[kind]; return K ? Math.round(K.hp * (1 + 0.1 * (n - 1))) : 1; }
//◆敵の強さの伸びここまで
//◆敵を作る・置くここから
//◆敵を作る。rank = 強さの段階（0 ふつう / 1 古参 / 2 精鋭（e.elite = 1）/ 3 覇者）。ボスは 0。
//◆e.gyo = 敵の行（ELEM.enemyGyo。無ければ null）、e.ev = 行の値（自弾の威力を 2^-ev にする）
function makeEnemy(state, kind, x, y, cnt, rank, isBoss) {
  const K = KINDS[kind], n = state.floor;
  let hp = baseHpOf(kind, n), r = K.r, speed = K.speed * spdMulOf(n), coin = K.coin, dmg = K.dmg;
  const boss = isBoss ? 1 : 0;
  rank = boss ? 0 : clampInt(rank, 0, 3);
  if (boss) {
    const cycle = bossCycle(n);
    hp = Math.round(K.hp * BOSS_HP_MUL * (1 + 0.1 * (n - 1)) * (1 + 0.3 * cycle));
    r = Math.round(K.r * BOSS_R_MUL); speed = K.speed * 0.8 * Math.min(1.3, 1 + 0.05 * cycle); coin = Math.round(K.coin * BOSS_COIN_MUL);
    dmg = Math.max(2, K.dmg);
  }
  if (rank > 0) { const M = RANK_MUL[rank]; r = Math.round(r * M.r); hp = Math.round(hp * M.hp); speed *= M.speed; coin = Math.round(coin * M.coin); if (rank === 3) dmg += 1; }
  if (dmg > 0) dmg = eAtk(state, dmg);   //◆体当たりは階に応じて伸びる（どの階も EATK_BASE 倍。決戦・おまけのボスは K.dmg 0 → finStart が e.dmg = 0 にする）
  const elite = rank >= 2 ? 1 : 0;
  //◆戦い方。ボスは無し・石積みはいつも 3・ほかはウェーブの敵（cnt）だけ抽選（召喚・分裂の子は無し）
  const id = state.nextId++, style = boss ? 0 : K.beh === "mason" ? 3 : cnt ? rollStyle(state, kind, id) : 0;
  return {
    id, kind, beh: K.beh, x, y, px: x, py: y, hp, maxhp: hp, r, speed, dmg, style,
    coin, aim: 0, elite, rank, cnt: cnt ? 1 : 0,
    st: 0, stTick: state.tick, born: state.tick, kbx: 0, kby: 0, hurtUntil: 0, stunUntil: 0, target: 0, targetTick: -999,
    phaseA: 0, boss, vf: 0, tx: 0, ty: 0, dx: 0, dy: 0, sx: 0, sy: 0, n1: 0, n2: 0, n3: 0,
    digBudget: K.beh === "digger" ? DIGGER_BUDGET : styleDigBudget(style, r), digAt: -999,   //◆掘る予算は戦い方から（石積み = 3 = MASON_DIG_BUDGET）
    placeBudget: STYLE_PLACE[style], placeAt: -999,   //◆土を置ける残りと、最後に置いた tick
    gyo: EL ? EL.enemyGyo(kind, K.fam) : null, ev: EL ? EL.enemyElemVal(n, boss) : 0, buffUntil: 0,
  };
}
//◆敵を配置（押し出し）して配列末尾へ。届かない場所なら距離場で選び直す
function spawnAt(state, kind, x, y, cnt, rank, isBoss) {
  const e = makeEnemy(state, kind, x, y, cnt, rank, isBoss);
  let po = pushOut(state, cx(state, x, e.r), cy(state, y, e.r), e.r);
  if (!reachablePx(state, po[0], po[1]) && e.beh !== "phaser") { const pt = spawnSpot(state, e.r); po = [pt[0], pt[1]]; }
  e.x = po[0]; e.y = po[1]; e.px = e.x; e.py = e.y;
  state.enemies.push(e);
  return e;
}
function countKind(state, kind) { let n = 0; for (let i = 0; i < state.enemies.length; i++) if (state.enemies[i].kind === kind && !state.enemies[i].gone) n++; return n; }
function liveCount(state) { let n = 0; for (let i = 0; i < state.enemies.length; i++) if (!state.enemies[i].gone) n++; return n; }
//◆ゾーン。gyo = 作った敵の行（lava / bomb の被弾に効く。無ければ null）
function addZone(state, kind, x, y, r, ticks, ownerPid, everyTick, act, gyo) {
  const z = { id: state.nextId++, kind, x, y, r, t0: state.tick, until: state.tick + ticks, ownerPid: ownerPid | 0, everyTick: everyTick | 0, nextTick: state.tick + (everyTick | 0), act: act | 0, gyo: typeof gyo === "string" ? gyo : null };
  state.zones.push(z);
  return z;
}
//◆敵弾。gyo = 撃った敵の行（無ければ null）、life = 寿命 tick（省略で EBULLET_LIFE_TICKS）
function addEBullet(state, x, y, a, speed, gyo, life) {
  if (state.ebullets.length >= (state.sf ? FIN_EBULLETS : MAX_EBULLETS)) state.ebullets.shift();   //◆決戦の階は 240（決戦の弾は finShot）
  state.ebullets.push({ id: state.nextId++, x, y, px: x, py: y, dx: Math.cos(a) * speed, dy: Math.sin(a) * speed, speed, life: life > 0 ? life | 0 : EBULLET_LIFE_TICKS, kind: 0, gyo: typeof gyo === "string" ? gyo : null });
}
//◆アイテム。born = 落ちた tick（ITEM_MAGNET_DELAY の間は磁力で吸われない。触れれば拾える）
function dropItem(state, kind, x, y, v, eq) {
  const a = rnd(state) * Math.PI * 2, sp = 120 + rnd(state) * 100;
  const it = { id: state.nextId++, kind, x, y, px: x, py: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, v, dieTick: state.tick + (kind === ITEM_KIND.MIRROR ? 1e9 : kind >= ITEM_KIND.ORE ? ITEM_LIFE_TICKS * 3 : ITEM_LIFE_TICKS), born: state.tick };
  if (eq) it.eq = eq;
  state.items.push(it);
  return it;
}
function telegraphSpawn(state, kind, x, y, cnt, rank) {
  const K = KINDS[kind];
  x = cx(state, x, K.r); y = cy(state, y, K.r);
  state.wave.queue.push([kind, x, y, state.tick + TELEGRAPH_TICKS, cnt ? 1 : 0, clampInt(rank, 0, 3)]);
  addZone(state, ZONE_KIND.TELEGRAPH, x, y, 26, TELEGRAPH_TICKS, 0, 0, 0);
  ev(state, ["spawn", Math.round(x), Math.round(y)]);
}
//◆敵を作る・置くここまで
//◆ダメージと相性ここから
//◆敵 → 自機のダメージ（接触・敵弾・ゾーン・ボマー・着地）。gyo = 攻撃側の行（無ければ null）。
//◆raw = dmg × compatIn(gyo, guard)、DEF = A × DEF_PER（A = 自機の <gyo>_a。攻撃側の行 gyo の動物式だけが効く。gyo が無い無属性は DEF 0）、
//◆v = max(raw × DEF_FLOOR, raw − DEF)。その後 armor −% → 0.25 刻みに丸め、最低 0.25
//◆compatIn は守り用の相性：同じ輪の中の相剋だけ（輪が違う行は 1）。攻撃側の compat は輪どうしも「互いに剋す」だが、
//◆それを守りにも使うと「守りの行を持つだけで他の輪の敵 全部から 1.5 倍」になり、守りが無い方がましになるため。
//◆guard スキル（p.guardLeft > 0）があればその階の最初の被弾を無効にして ["guard", pid]。当たった扱い（true）にはする。
function damagePlayer(state, p, dmg, sx, sy, gyo) {
  if (!isAlive(p) || state.tick < p.invulnUntil || dmg <= 0) return false;
  let ux = p.x - sx, uy = p.y - sy;
  const d = Math.sqrt(ux * ux + uy * uy);
  if (d > 0.0001) { ux /= d; uy /= d; } else { ux = 0; uy = -1; }
  if ((p.guardLeft | 0) > 0) {
    p.guardLeft--;
    p.invulnUntil = state.tick + HURT_INVULN_TICKS + (p.stats.iframe | 0);
    ev(state, ["guard", p.id, r2(ux), r2(uy)]);
    return true;
  }
  const dg = p.stats ? p.stats.dodge || 0 : 0;   //◆見切り（特性）。確率でかわし、被弾と同じだけ無敵
  if (dg > 0 && rnd(state) * 100 < dg) {
    p.invulnUntil = state.tick + HURT_INVULN_TICKS + (p.stats.iframe | 0);
    ev(state, ["dodge", p.id]);
    state.run.dodges = (state.run.dodges | 0) + 1;   //◆実績の数
    return true;
  }
  let v = dmg;
  if (EL && typeof gyo === "string" && p.stats && p.stats.elem) {
    const raw = dmg * compatIn(gyo, p.stats.guard), def = EL.profileVal(p.stats.elem, gyo, "a") * DEF_PER;   //◆動物式 A ＝ その行の防御力（引き算）
    v = Math.max(raw * DEF_FLOOR, raw - def);
  }
  //◆armor スキル：受けるダメージ −%（丸めの前）。不撓不屈（特性）は HP 半分以下の時だけ足す（合わせて ARMOR_MAX まで）
  const ar = p.stats ? (p.stats.armor | 0) + ((p.stats.lowHpArmor || 0) > 0 && p.hp * 2 <= p.maxhp ? p.stats.lowHpArmor : 0) : 0;
  if (ar > 0) v *= 1 - Math.min(ARMOR_MAX, ar) / 100;
  v = Math.max(0.25, Math.round(v * 4) / 4);
  p.hp = Math.round((p.hp - v) * 100) / 100;
  p.invulnUntil = state.tick + HURT_INVULN_TICKS + (p.stats.iframe | 0);
  ev(state, ["hurt", p.id, v, r2(ux), r2(uy)]);
  state.run.hurt = (state.run.hurt | 0) + 1;   //◆実績（被弾の数。無傷の階はこれで見る）
  if (p.hp <= 0 && !p.revUsed && p.stats && (p.stats.revive || 0) > 0) {   //◆起死回生（特性）。1 回の冒険で 1 度だけ HP revive% で起き上がる
    p.revUsed = 1;
    p.hp = Math.max(1, Math.round(p.maxhp * p.stats.revive / 100));
    p.invulnUntil = state.tick + FLOOR_INVULN_TICKS;
    ev(state, ["revive", p.id, p.hp]);
    state.run.revives = (state.run.revives | 0) + 1;
  }
  const hb = p.stats ? p.stats.hurtBoom || 0 : 0;   //◆倍返し（特性）。被弾して立っていれば、周り 3 マスの敵に威力の hb% で反撃（無属性）
  if (hb > 0 && p.hp > 0) boomEnemies(state, p.x, p.y, NEAR_PX, Math.round((p.stats.dmg || 0) * hb) / 100, p.id);
  if (p.hp <= 0) killPlayer(state, p);
  return true;
}
function killPlayer(state, p) {
  p.hp = 0; p.dead = 1; p.dashUntil = 0; p.moving = 0;
  ev(state, ["dead", p.id, r1(p.x), r1(p.y)]);
}
//◆守り用の相性（敵の行 a → 自機の守りの行 g）。同じ輪の中の相剋だけ効く。輪が違えば 1
function compatIn(a, g) { if (!EL || !EL.isGyo(a) || !EL.isGyo(g) || EL.RING[a] !== EL.RING[g]) return 1; return EL.compat(a, g); }
//◆自弾 → 敵の行の倍率：em（= 2^P）× compat(武器の行, 敵の行) / 2^ev。eg < 0（無属性）なら em と 2^-ev だけ
function elemMulE(e, eg, em) {
  let m = em > 0 ? em : 1;
  if (!EL) return m;
  if (e.ev > 0) m /= Math.pow(2, e.ev | 0);
  const g = gyoOf(eg | 0);
  if (g && e.gyo) m *= EL.compat(g, e.gyo);
  return m;
}
//◆自弾の行（添字 eg）→ 敵の行の関係（1 = 弱点、-1 = いまいち、0 = ふつう）。hit イベントの rel
function elemRelE(e, eg) { if (!EL) return 0; const g = gyoOf(eg | 0); return g && e.gyo ? EL.rel(g, e.gyo) : 0; }
//◆自機の武器の em（= 2^P。P = 武器の行の植物式の値）。武器に行が無ければ 1
function wpnElemMul(stats) { return EL && stats && stats.wgyo ? Math.pow(2, EL.profileVal(stats.elem, stats.wgyo, "p")) : 1; }
//◆範囲攻撃（自弾の爆発・追撃・撃破爆発）。eg / em = 弾の行と 2^P（省略で無属性）。ばくだんはここを通らない（無属性）
function boomEnemies(state, x, y, r, dmg, byPid, skipId, eg, em) {
  if ((state.boomDepth | 0) >= BOOM_DEPTH_MAX) return;
  state.boomDepth = (state.boomDepth | 0) + 1;
  ev(state, ["boom", Math.round(x), Math.round(y), Math.round(r)]);
  const es = state.enemies, len = es.length;
  for (let i = 0; i < len; i++) {
    const e = es[i];
    if (e.gone || e.st === 4 || e.st === 8) continue;
    if (skipId !== undefined && skipId !== null && e.id === skipId) continue;
    const d = dist(x, y, e.x, e.y);
    if (d >= r + e.r) continue;
    const ux = d > 0.0001 ? (e.x - x) / d : 1, uy = d > 0.0001 ? (e.y - y) / d : 0;
    hurtEnemy(state, e, dmg * elemMulE(e, eg === undefined ? -1 : eg, em === undefined ? 1 : em), ux, uy, byPid, 1);
  }
  state.boomDepth = Math.max(0, (state.boomDepth | 0) - 1);
}
function damageArea(state, x, y, r, dmg, gyo) {
  const ps = state.players;
  for (let i = 0; i < ps.length; i++) { const p = ps[i]; if (isAlive(p) && dist(x, y, p.x, p.y) < r + PLAYER_R) damagePlayer(state, p, dmg, x, y, gyo); }
}
function hurtEnemy(state, e, dmg, ux, uy, byPid, kbMul) {
  if (e.gone) return;
  if (e.boss && byPid) { const bd = pv(state.players[0].stats, "bossdmg"); if (bd > 0) dmg *= 1 + bd / 100; }     //◆弱点看破
  const bp = byPid ? state.players[0] : null;
  if (bp && bp.stats) dmg *= traitDmgMul(bp, e, state);   //◆条件つきの威力の特性（背水・精鋭狩り・先手必勝・接近戦・狙撃・合奏・地底の力・疾風）
  const sc = bp && bp.stats ? bp.stats.stealCoin || 0 : 0;   //◆手癖（特性）。当てるたびに sc% で、1 体から 1 度だけコイン（撃破の半分）を盗む
  if (sc > 0 && !e.rob && (e.coin || 0) > 0 && rnd(state) * 100 < sc) { e.rob = 1; dropItem(state, ITEM_KIND.COIN, e.x, e.y, Math.max(1, Math.round(e.coin * STEAL_COIN))); }
  if (e.fin) { finHurt(state, e, dmg); return; }   //◆決戦の紫はカードの HP（宣言の間は無敵・押されない・0 で次のカードへ）
  e.hp = Math.round((e.hp - dmg) * 100) / 100;
  e.hurtUntil = state.tick + 2;
  const k = (e.boss ? KB_IMPULSE / 4 : KB_IMPULSE) * (kbMul > 0 ? kbMul : 1);
  e.kbx += ux * k; e.kby += uy * k;
  const ex = bp && bp.stats ? bp.stats.execute || 0 : 0;   //◆とどめ（ボス以外。残り HP が execute% 以下なら倒しきる）
  if (ex > 0 && !e.boss && e.hp > 0 && e.hp * 100 <= e.maxhp * ex) e.hp = 0;
  if (e.hp <= 0) killEnemy(state, e, byPid);
}
//◆特性の条件つきの威力の倍率（足し算）。HP 半分以下・精鋭と覇者・無傷の敵・近い（3 マス以内）/ 遠い（7 マスより先）。
//◆合奏＝続いているチェイン 1 つごと（CHAIN_MAX まで）・地底の力＝10 階ごと（30 回まで）・疾風＝ダッシュの始めから 1 秒
function traitDmgMul(p, e, state) {
  const st = p.stats;
  let m = 1;
  if (state) {
    if ((st.chainDmg || 0) > 0 && state.tick - state.chainTick <= chainWin(state)) m += st.chainDmg * Math.min(state.chain | 0, CHAIN_MAX) / 100;
    if ((st.depthDmg || 0) > 0) m += st.depthDmg * Math.min(DEPTH_STEPS_MAX, Math.floor((state.floor | 0) / DEPTH_STEP)) / 100;
    if ((st.dashDmg || 0) > 0 && (p.dashUntil | 0) > 0 && state.tick <= p.dashUntil - DASH_TICKS + DASH_DMG_TICKS) m += st.dashDmg / 100;
  }
  if ((st.lowHpDmg || 0) > 0 && p.hp * 2 <= p.maxhp) m += st.lowHpDmg / 100;
  if ((st.eliteDmg || 0) > 0 && e.elite) m += st.eliteDmg / 100;
  if ((st.freshDmg || 0) > 0 && e.hp >= e.maxhp) m += st.freshDmg / 100;
  if ((st.nearDmg || 0) > 0 || (st.farDmg || 0) > 0) {
    const d = dist(p.x, p.y, e.x, e.y) - e.r;
    if (d <= NEAR_PX) m += (st.nearDmg || 0) / 100; else if (d > FAR_PX) m += (st.farDmg || 0) / 100;
  }
  return m;
}
//◆ダメージと相性ここまで
//◆撃破とドロップここから
//◆チェインの猶予（連鎖の名手なら 2 倍。日輪スキルの chainx は「足す」）
function chainWin(state) { const p = state.players[0]; const c = p ? trv(p.stats, "chain") : 0, cx_ = p ? skv(p.stats, "chainx") : 0; return Math.round(CHAIN_TICKS * (c > 0 ? c : 1) * (1 + cx_)); }
//◆ハートの落ちる率（おすそ分けの特性 heartPct で +%。1 まで）
function heartRate(p, base) { const h = p && p.stats ? p.stats.heartPct || 0 : 0; return h > 0 ? Math.min(1, base * (1 + h / 100)) : base; }
function killEnemy(state, e, byPid) {
  if (e.gone) return;
  e.gone = 1;
  const x = Math.round(e.x), y = Math.round(e.y), K = KINDS[e.kind];
  ev(state, ["kill", kindIndex(e.kind), x, y, e.elite, e.boss, e.rank | 0]);
  if (e.cnt) state.wave.remaining = Math.max(0, state.wave.remaining - 1);
  if (state.tick - state.chainTick <= chainWin(state)) state.chain++; else state.chain = 1;
  state.chainTick = state.tick;
  if (state.chain > state.maxChain) state.maxChain = state.chain;
  if (state.chain === 10 || state.chain === 20 || state.chain === 30) ev(state, ["chain", state.chain]);
  const bp = state.players[0];
  const luck = bp && bp.stats ? bp.stats.luck : 0;
  const mult = 1 + Math.min(state.chain, CHAIN_MAX) * CHAIN_STEP;
  dropItem(state, ITEM_KIND.COIN, e.x, e.y, Math.max(1, Math.round(e.coin * mult)));
  if (rnd(state) < heartRate(bp, HEART_DROP)) dropItem(state, ITEM_KIND.HEART, e.x, e.y, 1);
  state.kills++; state.run.kills++;
  if (e.rank === 3) state.run.overlords = (state.run.overlords | 0) + 1;   //◆実績の数（覇者・石積み）
  if (e.kind === "mason") state.run.masons = (state.run.masons | 0) + 1;
  if (bp) bp.kills++;
  state.wave.killTick = state.tick;
  //◆魔石（分裂の子は除く。覇者は確定）
  const vp = bp ? pv(bp.stats, "vampire") : 0, mr = bp ? (trv(bp.stats, "magrate") || 1) + skv(bp.stats, "magrate") : 1;
  if (vp > 0 && bp.hp < bp.maxhp && rnd(state) < vp / 100) { bp.hp = Math.min(bp.maxhp, bp.hp + 1); ev(state, ["heal", bp.id, 1]); }
  if (e.kind !== "mini" && (e.rank === 3 || rnd(state) < (MAT_DROP_RATE + luck * 0.3) * (e.elite ? 2 : 1) * (e.boss ? 3 : 1) * (mr > 0 ? mr : 1))) {
    let mt = magTierOfFloor(state.floor);
    if (rnd(state) < 0.10) mt = Math.min(MAG_COUNT - 1, mt + 1);
    dropItem(state, ITEM_KIND.MAG, e.x, e.y, mt);
  }
  //◆素材（ELEM.MAT_DROP + luck×0.2。エリート ×2、ボス 3 個確定、覇者 2 個確定。mini は落とさない）
  if (EL && e.kind !== "mini" && K) {
    let n = 0;
    const mp = bp && bp.stats ? bp.stats.matPct || 0 : 0;   //◆目利き（特性）
    if (e.boss) n = 3; else if (e.rank === 3) n = 2; else if (rnd(state) < (EL.MAT_DROP + luck * 0.2) * (e.elite ? 2 : 1) * (1 + mp / 100)) n = 1;
    for (let i = 0; i < n; i++) { const key = EL.matDropPick(K.fam, () => rnd(state)), mi = EL.matIdx(key); if (mi >= 0) dropItem(state, ITEM_KIND.MAT, e.x, e.y, mi); }
  }
  //◆装備
  if (e.kind !== "mini" && (e.boss || rnd(state) < (e.elite ? EQUIP_DROP_ELITE : EQUIP_DROP_RATE) + luck * 0.08)) {
    const eq = rollEquip(() => rnd(state), state.floor + (e.boss ? 3 : 0), luck);
    dropItem(state, ITEM_KIND.EQUIP, e.x, e.y, eq.tier, eq);
    ev(state, ["drop", eq]);
  }
  if (e.boss) {
    state.run.bossKills++;
    if (rnd(state) < heartRate(bp, 0.5)) dropItem(state, ITEM_KIND.HEART, e.x, e.y, 1);
    if (!omakeOf(state) && rnd(state) < MIRROR_RATE) { dropItem(state, ITEM_KIND.MIRROR, e.x, e.y, state.floor); ev(state, ["mirrorDrop", state.floor]); }   //◆隙間の鏡（消えない）
  }
  if (state.bk && e.kind !== "mini") bookRoll(state, e.x, e.y);   //◆記憶の禁書（opts.books の時だけ。rnd を使わない）
  //◆経験値（mini は 0）
  if (EL && bp && e.kind !== "mini") addXp(state, bp, EL.xpOfEnemy(baseHpOf(e.kind, state.floor), e.boss, e.rank | 0));
  //◆撃破爆発（燃え移り・地割れ・特別な武器）：半径 boomKill、威力の半分、武器の行
  if (bp && byPid && (bp.stats.boomKill | 0) > 0) boomEnemies(state, e.x, e.y, bp.stats.boomKill, Math.round(bp.stats.dmg * 50) / 100, byPid, e.id, gyoIdx(bp.stats.wgyo), wpnElemMul(bp.stats));
  if (e.beh === "splitter") {
    for (let k = -1; k <= 1; k += 2) { const a = e.aim + k * 60 * DEG; spawnAt(state, "mini", e.x + Math.cos(a) * (e.r + 6), e.y + Math.sin(a) * (e.r + 6), 0, 0); }
  } else if (e.beh === "bomber") {
    ev(state, ["boom", x, y, 50]);
    damageArea(state, e.x, e.y, 50, eAtk(state, 1), e.gyo);
  }
}

//◆撃破とドロップここまで
