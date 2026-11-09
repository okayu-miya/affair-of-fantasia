//◆弾・ゾーン・アイテム・ハッチ・倒れ・回復の毎 tick の更新 : 2.10.26参照
//◆弾とゾーンここから
function stepBullets(state, dt) {
  const keep = [], es = state.enemies, src = state.bullets, shards = [];   //◆shards = 弾ける輪の欠片（次の tick から動く）
  state.bullets = [];
  for (let i = 0; i < src.length; i++) {
    const b = src[i];
    if (b.fl & BF.SPIRAL) { if (b.so) spiralBullet(b, dt); }   //◆渦巻きは追尾より先（向きは渦が決める）
    else if (b.fl & BF.HOME) homeBullet(state, b);
    const px = b.x, py = b.y;
    b.x += b.dx * dt; b.y += b.dy * dt; b.life--;
    if (b.life <= 0) continue;
    //◆地図の外へ出る弾も、捨てる前にこの tick の線分で壁・敵を見る（速すぎる弾が 1 tick で枠を越えて当たらずに消えていた。枠の外は wallCell で岩盤扱い）
    const out = b.x < 0 || b.x > state.aw || b.y < 0 || b.y > state.ah;
    //◆壁に当たるなら、当たる手前までの線分で敵を見る（密着した敵が壁に吸われないように）
    const wc = segFirstSolid(state, px, py, b.x, b.y, BULLET_R);
    const ex = wc ? px + (b.x - px) * wc[2] : b.x, ey = wc ? py + (b.y - py) * wc[2] : b.y;
    let used = false;
    for (let j = 0; j < es.length; j++) {
      const e = es[j];
      if (e.gone || e.st === 4 || e.st === 7 || e.st === 8) continue;   //◆転移中・跳躍中・潜っている burrower には当たらない
      const rr = e.r + BULLET_R, ht = segCircleT(px, py, ex, ey, e.x, e.y, rr);
      if (ht < 0) continue;
      if (b.ht && b.ht.indexOf(e.id) >= 0) continue;
      if (b.skip !== undefined && b.skip === e.id) continue;   //◆輪の欠片は弾けた元の敵に当たらない
      const hx = px + (ex - px) * ht, hy = py + (ey - py) * ht, K = KINDS[e.kind];
      const em = elemMulE(e, b.eg, b.em);   //◆行の倍率：2^P × compat(武器の行, 敵の行) / 2^ev
      if (K && K.shield && !e.boss) {
        let da = Math.atan2(hy - e.y, hx - e.x) - e.aim;
        da = ((da + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
        if (Math.abs(da) <= K.shield * DEG) {
          ev(state, ["clank", Math.round(hx), Math.round(hy)]);
          const sp2 = Math.sqrt(b.dx * b.dx + b.dy * b.dy) || 1;
          hurtEnemy(state, e, b.dmg * SHIELD_THROUGH * em, b.dx / sp2, b.dy / sp2, b.owner, b.kb * 0.3);
          used = true; break;
        }
      }
      const sp = Math.sqrt(b.dx * b.dx + b.dy * b.dy) || 1;
      ev(state, ["hit", e.id, Math.round(hx), Math.round(hy), b.wk, elemRelE(e, b.eg), b.crit | 0]);
      hurtEnemy(state, e, b.dmg * em, b.dx / sp, b.dy / sp, b.owner, b.kb);
      if (b.orb) boomEnemies(state, hx, hy, ORB_R, Math.round(b.dmg * 50) / 100, b.owner, e.id, b.eg, b.em);
      if (b.fl & BF.BOOM) boomEnemies(state, hx, hy, BOOM_R, b.dmg, b.owner, e.id, b.eg, b.em);
      if (b.rg) { b.rg = 0; ringShards(state, b, hx, hy, e.id, shards); }   //◆弾ける輪（貫通の弾も最初の 1 回だけ）
      if (b.ht && !(b.fl & BF.BOOM)) { b.ht.push(e.id); if (b.ht.length > 12) b.ht.shift(); continue; }
      used = true; break;
    }
    if (used) continue;
    if (wc) {
      if (b.bn > 0 && blockAt(state, wc[0], wc[1]) !== BLOCK.CRATE) {   //◆跳弾。壁の升の中心から見て近い軸で跳ね返り、この tick の始めの位置から続ける（渦巻きは回る向きと広がる向きを逆に）
        const ox = ex - (wc[0] + 0.5) * CELL, oy = ey - (wc[1] + 0.5) * CELL;
        if (b.so) { b.sw = -b.sw; b.sv = -(b.sv || 1); b.sr = dist(b.so[0], b.so[1], px, py) * (b.sr < 0 ? -1 : 1); } else if (Math.abs(ox) >= Math.abs(oy)) b.dx = -b.dx; else b.dy = -b.dy;
        b.bn--; b.x = px; b.y = py;   //◆当たる前の位置へ戻す（当たった所は壁に触れていて、次の tick もすぐ当たる）
        ev(state, ["wallhit", Math.round(ex), Math.round(ey), b.wk]);
        keep.push(b);
        continue;
      }
      if (blockAt(state, wc[0], wc[1]) === BLOCK.CRATE) damageBlock(state, wc[0], wc[1], 1, 1, 1);
      else ev(state, ["wallhit", Math.round(ex), Math.round(ey), b.wk]);
      if (b.fl & BF.BOOM) boomEnemies(state, ex, ey, BOOM_R, b.dmg, b.owner, null, b.eg, b.em);
      continue;
    }
    if (out) continue;
    keep.push(b);
  }
  for (let i = 0; i < keep.length; i++) state.bullets.push(keep[i]);
  for (let i = 0; i < shards.length; i++) state.bullets.push(shards[i]);
  state.bullets.sort((x, y) => x.id - y.id);
  while (state.bullets.length > MAX_BULLETS) {
    let mi = 0;
    for (let i = 1; i < state.bullets.length; i++) if (state.bullets[i].life < state.bullets[mi].life) mi = i;
    state.bullets.splice(mi, 1);
  }
}
function stepEBullets(state, dt) {
  if (state.sf) { stepFinBullets(state, dt); return; }   //◆決戦の弾（加速・曲がり・待ち・小さな当たり）
  const keep = [], ps = state.players, tick = state.tick;
  for (let i = 0; i < state.ebullets.length; i++) {
    const b = state.ebullets[i], px = b.x, py = b.y;
    b.x += b.dx * dt; b.y += b.dy * dt; b.life--;
    if (b.life <= 0 || b.x < 0 || b.x > state.aw || b.y < 0 || b.y > state.ah) continue;
    if (segHitsWall(state, px, py, b.x, b.y, EBULLET_R)) continue;
    let used = false;
    for (let j = 0; j < ps.length; j++) {
      const p = ps[j];
      if (!isAlive(p) || tick < p.invulnUntil) continue;
      if (dist2(b.x, b.y, p.x, p.y) >= (EBULLET_R + PLAYER_R) * (EBULLET_R + PLAYER_R)) continue;
      damagePlayer(state, p, eAtk(state, 1), px, py, b.gyo);   //◆敵弾の行 = 撃った敵の行（深い階では伸びる）
      used = true; break;
    }
    if (!used) keep.push(b);
  }
  state.ebullets = keep;
}
function stepZones(state) {
  const tick = state.tick, keep = [], ps = state.players, src = state.zones;   //◆src＝回している列（決戦の光線に当たった倍返しでカードが割れると、列が空に替わる）
  for (let i = 0; i < state.zones.length; i++) {
    const z = state.zones[i];
    if (z.fin) { if (stepFinZone(state, z)) keep.push(z); continue; }   //◆決戦の光線（LINE）とスキマ（GAP）
    if (z.kind === ZONE_KIND.LAVA && z.everyTick > 0 && tick >= z.nextTick) {
      z.nextTick = tick + z.everyTick;
      for (let j = 0; j < ps.length; j++) if (isAlive(ps[j]) && dist(z.x, z.y, ps[j].x, ps[j].y) < z.r) damagePlayer(state, ps[j], eAtk(state, 1), z.x, z.y, z.gyo);
    }
    if (tick >= z.until) {
      //◆投擲の着弾（thrower）：作った敵の行で爆発し、同じ行の輪を撒く
      if (z.act === 1) { ev(state, ["boom", Math.round(z.x), Math.round(z.y), z.r]); damageArea(state, z.x, z.y, z.r, eAtk(state, 1), z.gyo); ringAt(state, z.x, z.y, 6, 130, rnd(state) * Math.PI * 2, z.gyo); }
      continue;
    }
    keep.push(z);
  }
  if (state.zones === src) state.zones = keep;
}
//◆弾とゾーンここまで
//◆アイテム・ハッチ・倒れここから
function stepItems(state, dt) {
  const tick = state.tick, keep = [], p = state.players[0];
  for (let i = 0; i < state.items.length; i++) {
    const it = state.items[i];
    if (tick >= it.dieTick) continue;
    if (it.vx !== 0 || it.vy !== 0) {
      const nx = cx(state, it.x + it.vx * dt, ITEM_R), ny = cy(state, it.y + it.vy * dt, ITEM_R);
      if (!hitsWall(state, nx, ny, ITEM_R)) { it.x = nx; it.y = ny; } else { it.vx = 0; it.vy = 0; }
      it.vx *= 0.7; it.vy *= 0.7;
      if (Math.abs(it.vx) < 3) it.vx = 0;
      if (Math.abs(it.vy) < 3) it.vy = 0;
    }
    let got = false;
    if (p && isAlive(p) && !(it.kind === ITEM_KIND.HEART && p.hp >= p.maxhp)) {
      let bd = dist(it.x, it.y, p.x, p.y);
      //◆落ちてから ITEM_MAGNET_DELAY（1 秒）は磁力で吸われない（触れれば拾える）。全アイテム共通
      const fresh = tick - (it.born | 0) < ITEM_MAGNET_DELAY;
      const r = fresh ? PLAYER_R + ITEM_R : evIs(state, "tiny") ? 1e9 : it.kind === ITEM_KIND.BOOK && tick - (it.born | 0) >= BOOK_PULL_TICKS ? 1e9 : (it.kind === ITEM_KIND.EQUIP || it.kind === ITEM_KIND.BOOK ? Math.max(p.stats.magnet, 40) : p.stats.magnet);   //◆狭すぎる階は部屋じゅうが磁力の内（四隅の宝箱の中身を取りこぼさない）。禁書も装備と同じく少し遠くから。落ちて BOOK_PULL_TICKS たった禁書はどこからでも吸い寄せる（拾い損ねない）
      if (bd <= r) {
        if (bd > PLAYER_R + ITEM_R) { const s = Math.min(bd, MAGNET_SPEED * dt); it.x += (p.x - it.x) / bd * s; it.y += (p.y - it.y) / bd * s; bd = dist(it.x, it.y, p.x, p.y); }
        if (bd <= PLAYER_R + ITEM_R) {
          let v = it.v;
          if (it.kind === ITEM_KIND.COIN) { v = Math.max(1, Math.round(it.v * (p.stats.coinMul || 1))); state.run.coins += v; }
          else if (it.kind === ITEM_KIND.HEART) { const hh = 1 + (p.stats.heartHeal || 0); p.hp = Math.min(p.maxhp, p.hp + hh); ev(state, ["heal", p.id, hh]); }   //◆料理上手（特性）
          else if (it.kind === ITEM_KIND.ORE) { const t = clampInt(it.v, 0, ORE_COUNT - 1); state.run.ore[t]++; state.run.mined++; ev(state, ["mat", "ore", t]); }
          else if (it.kind === ITEM_KIND.MAG) { const t = clampInt(it.v, 0, MAG_COUNT - 1); state.run.mag[t]++; ev(state, ["mat", "mag", t]); }
          else if (it.kind === ITEM_KIND.EQUIP) { const eq = clampEquip(it.eq); if (eq) state.run.drops.push(eq); }
          else if (it.kind === ITEM_KIND.MAT) {   //◆素材：run.mats[key]++ と ["mat", "mat", key]
            const m = EL ? EL.matOf(it.v) : null;
            if (m) { if (!state.run.mats || typeof state.run.mats !== "object") state.run.mats = {}; state.run.mats[m.key] = (state.run.mats[m.key] | 0) + 1; ev(state, ["mat", "mat", m.key]); }
          }
          else if (it.kind === ITEM_KIND.MIRROR) {   //◆隙間の鏡：run.mirrors にその階を足す（同じ階は 1 つ）
            const f = clampInt(it.v, 1, 9999);
            if (!Array.isArray(state.run.mirrors)) state.run.mirrors = [];
            if (state.run.mirrors.indexOf(f) < 0) state.run.mirrors.push(f);
            ev(state, ["mirror", f]);
          }
          else if (it.kind === ITEM_KIND.BOOK) bookGot(state);   //◆記憶の禁書（この冒険で何冊目か。番号は client が opts.books.found から）
          ev(state, ["pickup", p.id, it.kind, v]);
          got = true;
        }
      }
    }
    if (!got) keep.push(it);
  }
  state.items = keep;
}
function openHatch(state) {
  const p = state.players[0];
  const gx = p ? p.x : state.aw / 2, gy = p ? p.y : state.ah / 2;
  let best = state.hatchCands[0] || { x: state.aw / 2, y: state.ah / 2 }, bd = -1;
  for (let i = 0; i < state.hatchCands.length; i++) { const c = state.hatchCands[i], d = dist2(c.x, c.y, gx, gy); if (d > bd) { bd = d; best = c; } }
  state.hatch = { open: 1, x: best.x, y: best.y, cnt: 0, openedTick: state.tick };
  if (state.oh && !state.oh.arena) { const oh = state.oh; state.hatch.x = oh.rx; state.hatch.y = oh.ry; state.hatch.fx = oh.fx; state.hatch.fy = oh.fy; state.hatch.fcnt = 0; best = { x: oh.rx, y: oh.ry }; }   //◆本当のハッチと、嘘のハッチ（fx, fy）
  state.phase = PHASE.HATCH;
  if (!evCalm(state) && !(state.sf && !state.sf.won)) { //◆実績。この階で被弾していなければ無傷の階（続けた数とボスの階も）。HP 1 以下で突破した回数（戦いの無いイベント階層は数えない。決戦・1000 階は勝った後に数える）
    const R = state.run;
    if ((R.hurt | 0) === (R.fh | 0)) { R.nohit = (R.nohit | 0) + 1; R.nhs = (R.nhs | 0) + 1; if (bossOf(state.floor) || state.sf) R.bossNoHit = (R.bossNoHit | 0) + 1; }
    else R.nhs = 0;
    if ((R.nhs | 0) > (R.nhMax | 0)) R.nhMax = R.nhs;
    if (p && isAlive(p) && p.hp <= 1) R.clutch = (R.clutch | 0) + 1;
  }
  ev(state, ["hatch", best.x, best.y]);
  if (state.hatch.fx !== undefined) ev(state, ["hatch2", state.hatch.fx, state.hatch.fy]);
  if (EL && p && !omakeOf(state)) addXp(state, p, EL.xpOfFloor(state.floor));   //◆階クリアの経験値（5 + 2n）
}
function beginDescend(state) {
  const n = state.floor;
  let bonus = 10 + 5 * n;
  if (bossOf(n)) bonus += 50;
  const p = state.players[0], fc = p && p.stats ? p.stats.floorCoin || 0 : 0;   //◆商売繁盛・倹約家（特性）。階ボーナス +%
  if (fc > 0) bonus = Math.round(bonus * (1 + fc / 100));
  if (omakeOf(state)) bonus = 0;   //◆おまけの層は階のボーナスが無い（嘘のハッチで往復して稼げない）
  state.run.coins += bonus;
  state.phase = PHASE.TRANSIT;
  state.transitLeft = TRANSIT_TICKS;
  ev(state, ["transit", n, bonus]);
}
function stepHatch(state) {
  const w = state.wave, h = state.hatch, tick = state.tick, p = state.players[0];
  if (state.phase === PHASE.FIGHT) {
    if (evHold(state)) return;   //◆紫と話すまで・狭すぎる階の宝箱を開けるまで閉じておく（待てば開く）
    if (w.spawned >= w.total && w.remaining === 0 && w.queue.length === 0 && liveCount(state) === 0) { openHatch(state); return; }
    const idle = tick - Math.max(w.killTick | 0, w.waveTick | 0, w.startTick | 0);
    //◆列が空でなくても（同時上限で湧きが詰まっていても）長く動きが無ければ救済する。列は捨てる
    if (idle >= STUCK_TICKS) { w.queue = []; ev(state, ["stuck"]); openHatch(state); }
    return;
  }
  if (state.phase !== PHASE.HATCH) return;
  const on = isAlive(p) && dist(p.x, p.y, h.x, h.y) <= HATCH_R + 12;
  const omLast = omakeOf(state) && state.floor >= OMAKE_FLOORS;   //◆13 階の先は無い（勝ったら帰る）
  if (on && !omLast) { if (h.cnt === 0) ev(state, ["board"]); h.cnt++; if (h.cnt >= HATCH_COUNT_TICKS) beginDescend(state); }
  else h.cnt = 0;
  if (h.fx !== undefined) {   //◆嘘のハッチ。乗って降りると 1 つ上の階（1 階なら同じ 1 階）へ戻される
    const on2 = isAlive(p) && dist(p.x, p.y, h.fx, h.fy) <= HATCH_R + 12;
    if (on2) { if (h.fcnt === 0) ev(state, ["board"]); h.fcnt++; if (h.fcnt >= HATCH_COUNT_TICKS) { state.nextFloor = Math.max(1, state.floor - 1); state.phase = PHASE.TRANSIT; state.transitLeft = TRANSIT_TICKS; ev(state, ["otransit", state.floor, state.nextFloor]); } }
    else h.fcnt = 0;
  }
}
function stepOver(state) {
  const tick = state.tick;
  if (aliveCount(state) === 0) { if (state.overTick < 0) state.overTick = tick + OVER_FREEZE_TICKS; }
  else if (state.overTick >= 0) state.overTick = -1;
  if (state.overTick >= 0 && tick >= state.overTick) { bookSweep(state); state.phase = PHASE.OVER; ev(state, ["over"]); }   //◆倒れても床の禁書は持ち帰る（成果は持ち帰る決まり）
}
//◆アイテム・ハッチ・倒れここまで
//◆regen スキル（火照り・光合成など）：REGEN_EVERY（600 tick = 30 秒）ごとに HP +n
function stepRegen(state) {
  const p = state.players[0];
  if (!p || !p.stats || !isAlive(p)) return;
  const rg = p.stats.regen | 0;
  if (rg <= 0 || state.tick <= 0 || state.tick % REGEN_EVERY !== 0 || p.hp >= p.maxhp) return;
  const h = Math.min(rg, r2(p.maxhp - p.hp));
  p.hp = r2(p.hp + h);
  ev(state, ["heal", p.id, h]);
}
