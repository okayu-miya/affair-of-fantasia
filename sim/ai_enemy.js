//◆敵の行動（enemyAI。行動の種類ごとの動きと弾） : 2.10.20参照
function enemyAI(state, e, dt) {
  const tick = state.tick;
  e.vf = 0;
  if (e.beh === "vase") return;
  const t = nearestAlive(state, e.x, e.y, 0);
  e.target = t ? t.id : 0;
  if (e.fin) { finalAI(state, e, t); return; }   //◆決戦の紫（動き・スキマの転移・体の当たり。弾幕は stepFinal）
  if (e.st === 2) { e.vf |= EFLAGS.TELEGRAPH; if (tick - e.stTick >= e.n3) { e.st = 3; e.stTick = tick; } return; }
  if (e.st === 3) {
    const nx = e.x + e.dx * e.n1 * dt, ny = e.y + e.dy * e.n1 * dt;
    let hit = nx < e.r || nx > state.aw - e.r || ny < e.r || ny > state.ah - e.r;
    if (!hit && e.beh !== "phaser") hit = hitsWall(state, nx, ny, e.r);
    if (hit) { e.st = 5; e.stTick = tick; e.stunUntil = tick + 16; }
    else { e.x = nx; e.y = ny; e.vf |= EFLAGS.MOVING; if (tick - e.stTick >= e.n2) { e.st = 0; e.stTick = tick; } }
    return;
  }
  if (e.st === 5) { e.vf |= EFLAGS.STUN; if (tick >= e.stunUntil) { e.st = 0; e.stTick = tick; } return; }
  if (e.st === 4) { e.vf |= EFLAGS.HIDDEN; if (tick - e.stTick >= e.n3) { e.x = e.tx; e.y = e.ty; e.px = e.x; e.py = e.y; e.st = 0; e.stTick = tick; } return; }
  if (e.st === 6) {
    e.vf |= EFLAGS.TELEGRAPH;
    if (tick - e.stTick >= e.n1) {
      e.st = 7; e.stTick = tick; e.sx = e.x; e.sy = e.y;
      addZone(state, ZONE_KIND.TELEGRAPH, e.tx, e.ty, e.r, e.n2, 0, 0, 0);
      ev(state, ["warn", Math.round(e.tx), Math.round(e.ty), e.r, e.n2]);
    }
    return;
  }
  if (e.st === 7) {
    const k = Math.min(1, (tick - e.stTick + 1) / e.n2);
    e.x = e.sx + (e.tx - e.sx) * k; e.y = e.sy + (e.ty - e.sy) * k; e.vf |= EFLAGS.MOVING;
    if (k >= 1) {
      const B = bossScript(e), half = e.hp * 2 <= e.maxhp, ring = B && (half && B.landRing2 ? B.landRing2 : B.landRing);
      if (ring) ringAt(state, e.x, e.y, ring[0], ring[1], rnd(state) * Math.PI * 2, e.gyo);
      ev(state, ["boom", Math.round(e.x), Math.round(e.y), e.r]);
      damageArea(state, e.x, e.y, e.r + 6, e.dmg, e.gyo);
      e.st = 0; e.stTick = tick;
    }
    return;
  }
  //◆覇者（rank 3）：100 tick ごとに輪
  if (e.rank === 3 && (tick - e.born) % CHAMP_RING_EVERY === CHAMP_RING_EVERY - 1) ringAt(state, e.x, e.y, 8, 150, rnd(state) * Math.PI * 2, e.gyo);
  if (e.boss) { bossAI(state, e, t, dt); return; }
  //◆戦い方（掘る・置く）はふだんの状態（st 0）の時だけ行動の前に割り込む（石積みは masonAI の中で）
  if ((e.style | 0) > 0 && e.st === 0 && e.beh !== "mason" && styleAI(state, e, t, dt, e.style | 0)) return;
  const K = KINDS[e.kind];
  switch (e.beh) {
    case "hopper": {
      if (e.st === 0) {
        if (tick - e.stTick >= 5) e.vf |= EFLAGS.TELEGRAPH;
        if (tick - e.stTick >= 9 && t) {
          const dx = t.x - e.x, dy = t.y - e.y, d = Math.sqrt(dx * dx + dy * dy), u = steerFor(state, e, dx, dy, d);
          e.dx = u[0]; e.dy = u[1]; e.aim = Math.atan2(u[1], u[0]); e.st = 1; e.stTick = tick;
        }
      } else {
        const sp = e.speed * 16 / 7;
        const nx = e.x + e.dx * sp * dt, ny = e.y + e.dy * sp * dt;
        if (!hitsWall(state, nx, ny, e.r)) { e.x = nx; e.y = ny; e.vf |= EFLAGS.MOVING; }
        if (tick - e.stTick >= 7) { e.st = 0; e.stTick = tick; }
      }
      break;
    }
    case "flyer": {
      if (!t) break;
      const dx = t.x - e.x, dy = t.y - e.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d < 0.0001) break;
      const u = steerFor(state, e, dx, dy, d), w = Math.PI * 6, ph = (tick - e.born) * dt * w, off = 20 * Math.sin(ph) - 20 * Math.sin(ph - dt * w);
      const nx = e.x + u[0] * e.speed * dt - u[1] * off, ny = e.y + u[1] * e.speed * dt + u[0] * off;
      if (!hitsWall(state, nx, ny, e.r)) { e.x = nx; e.y = ny; } else chase(state, e, t.x, t.y, e.speed, dt, 1);
      e.vf |= EFLAGS.MOVING; e.aim = Math.atan2(u[1], u[0]);
      break;
    }
    case "shooter": {
      const c = (tick - e.born) % 36;
      if (c >= 28) e.vf |= EFLAGS.TELEGRAPH;
      if (t) {
        const d = dist(e.x, e.y, t.x, t.y);
        if (d > 360) chase(state, e, t.x, t.y, e.speed, dt);
        else if (d < 260) chase(state, e, e.x - (t.x - e.x), e.y - (t.y - e.y), e.speed, dt);
        e.aim = Math.atan2(t.y - e.y, t.x - e.x);
        if (c === 35 && lineClear(state, e.x, e.y, t.x, t.y, EBULLET_R)) addEBullet(state, e.x + Math.cos(e.aim) * e.r, e.y + Math.sin(e.aim) * e.r, e.aim, ebSpeed(state, K.bspeed), e.gyo);
      }
      break;
    }
    case "stationary": {
      const c = (tick - e.born) % 90;
      if (c >= 80) e.vf |= EFLAGS.TELEGRAPH;
      if (t) { turnTo(e, Math.atan2(t.y - e.y, t.x - e.x)); if (c === 89) aimedAt(state, e, t, 3, 12, K.bspeed); }
      break;
    }
    case "shielded":
      e.vf |= EFLAGS.SHIELD;
      if (t) { chase(state, e, t.x, t.y, e.speed, dt, 1); turnTo(e, Math.atan2(t.y - e.y, t.x - e.x)); }
      break;
    case "bomber": {
      if (e.st === 1) {
        e.vf |= EFLAGS.FUSE;
        if (tick - e.stTick >= 12) {
          e.gone = 1;
          if (e.cnt) state.wave.remaining = Math.max(0, state.wave.remaining - 1);
          ev(state, ["boom", Math.round(e.x), Math.round(e.y), 70]);
          damageArea(state, e.x, e.y, 70, eAtk(state, 2), e.gyo);
        }
      } else if (t) {
        if (dist(e.x, e.y, t.x, t.y) <= 45 + e.r) { e.st = 1; e.stTick = tick; }
        else chase(state, e, t.x, t.y, e.speed, dt);
      }
      break;
    }
    case "thrower": {
      const c = (tick - e.born) % 64;
      if (c >= 55) e.vf |= EFLAGS.TELEGRAPH;
      if (t) {
        chase(state, e, t.x, t.y, e.speed, dt);
        if (c === 63) { addZone(state, ZONE_KIND.BOMB_WARN, t.x, t.y, 34, 24, 0, 0, 1, e.gyo); ev(state, ["warn", Math.round(t.x), Math.round(t.y), 34, 24]); }
      }
      break;
    }
    case "charger": {
      if (!t) break;
      const d = dist(e.x, e.y, t.x, t.y);
      if (tick - e.stTick >= 20 && d <= 380 && lineClear(state, e.x, e.y, t.x, t.y, e.r)) startDash(state, e, t, 14, 420 * spdMulOf(state.floor), 12);
      else chase(state, e, t.x, t.y, e.speed, dt);
      break;
    }
    case "stalker": {
      if (t) { if (dist(e.x, e.y, t.x, t.y) >= 250) e.vf |= EFLAGS.HIDDEN; chase(state, e, t.x, t.y, e.speed, dt); }
      break;
    }
    case "phaser": {
      if (t) { chase(state, e, t.x, t.y, e.speed, dt); if (dist(e.x, e.y, t.x, t.y) >= 260) e.vf |= EFLAGS.HIDDEN; }
      break;
    }
    case "summoner": {
      const c = (tick - e.born) % 210;
      if (c >= 200) e.vf |= EFLAGS.TELEGRAPH;
      if (c === 209) summon(state, e, "", 2, 8);
      if (t) chase(state, e, t.x, t.y, e.speed * 0.85, dt);
      break;
    }
    case "ringer": {
      const c = (tick - e.born) % 150;
      if (c >= 138) e.vf |= EFLAGS.TELEGRAPH;
      if (c === 149) ringAt(state, e.x, e.y, 8, 150, rnd(state) * Math.PI * 2, e.gyo);   //◆深さの倍率は ringAt の中で 1 回だけ掛かる
      if (t) chase(state, e, t.x, t.y, e.speed * 0.9, dt);
      break;
    }
    case "teleporter": {
      const c = (tick - e.born) % 170;
      if (c === 169 && t) startTeleport(state, e, t, 200);
      else if (c === 40 && t) aimedAt(state, e, t, 3, 14, K.bspeed);
      else if (t) chase(state, e, t.x, t.y, e.speed, dt);
      break;
    }
    case "swarm": {
      if (!t) break;
      const dx = t.x - e.x, dy = t.y - e.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d < 0.0001) break;
      const u = steerFor(state, e, dx, dy, d), ph = (tick - e.born + e.id * 7) * 0.5, off = 9 * Math.sin(ph) - 9 * Math.sin(ph - 0.5);
      const nx = e.x + u[0] * e.speed * dt - u[1] * off, ny = e.y + u[1] * e.speed * dt + u[0] * off;
      if (!hitsWall(state, nx, ny, e.r)) { e.x = nx; e.y = ny; } else chase(state, e, t.x, t.y, e.speed, dt, 1);
      e.vf |= EFLAGS.MOVING; e.aim = Math.atan2(u[1], u[0]);
      break;
    }
    case "digger": diggerAI(state, e, t, dt); break;
    case "mason": masonAI(state, e, t, dt); break;   //◆石積み
    case "healer": {
      //◆標的と 200〜300px を保つ。120 tick ごと（100〜119 は TELEGRAPH）に 160px 内の味方（自分以外・ボス以外）の HP を maxhp の 15% 回復
      const c = (tick - e.born) % 120;
      if (c >= 100) e.vf |= EFLAGS.TELEGRAPH;
      if (t) {
        const d = dist(e.x, e.y, t.x, t.y);
        if (d > 300) chase(state, e, t.x, t.y, e.speed, dt);
        else if (d < 200) chase(state, e, e.x - (t.x - e.x), e.y - (t.y - e.y), e.speed, dt);
        e.aim = Math.atan2(t.y - e.y, t.x - e.x);
      }
      if (c === 119) {
        const es = state.enemies;
        for (let j = 0; j < es.length; j++) {
          const a = es[j];
          if (a.gone || a.boss || a.id === e.id || a.hp >= a.maxhp) continue;
          if (dist2(e.x, e.y, a.x, a.y) > 160 * 160) continue;
          const heal = Math.round(Math.min(a.maxhp - a.hp, a.maxhp * 0.15) * 100) / 100;
          if (heal <= 0) continue;
          a.hp = Math.round((a.hp + heal) * 100) / 100;
          ev(state, ["heal_e", a.id, heal]);
        }
      }
      break;
    }
    case "sniper": {
      //◆300〜420px を保つ。90 tick 周期：at 60 で 20 tick の照準線（ZONE_KIND.MARK を自機の位置に。e.tx,e.ty に狙い点）、at 80 で狙い点へ速い弾（×1.8）
      if (!t) break;
      const c = (tick - e.born) % 90, d = dist(e.x, e.y, t.x, t.y), see = lineClear(state, e.x, e.y, t.x, t.y, EBULLET_R);
      if (c === 60) {
        if (see) { e.tx = t.x; e.ty = t.y; e.n1 = 1; addZone(state, ZONE_KIND.MARK, t.x, t.y, 8, 20, 0, 0, 0, e.gyo); ev(state, ["warn", Math.round(t.x), Math.round(t.y), 8, 20]); }
        else e.n1 = 0;
      }
      if (c >= 60 && c < 80 && e.n1) { e.vf |= EFLAGS.TELEGRAPH; e.aim = Math.atan2(e.ty - e.y, e.tx - e.x); }
      else {
        if (!see || d > 420) chase(state, e, t.x, t.y, e.speed, dt);
        else if (d < 300) chase(state, e, e.x - (t.x - e.x), e.y - (t.y - e.y), e.speed, dt);
        e.aim = Math.atan2(t.y - e.y, t.x - e.x);
      }
      if (c === 80 && e.n1) {
        const a = Math.atan2(e.ty - e.y, e.tx - e.x);
        addEBullet(state, e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r, a, ebSpeed(state, K.bspeed) * 1.8, e.gyo);
        e.n1 = 0;
      }
      break;
    }
    case "orbiter": {
      //◆自機の周りを半径 150px で時計回りに回る（接線方向の点を chase で追う）。60 tick ごとに aimedAt(1, 0)
      if (!t) break;
      const c = (tick - e.born) % 60;
      if (c >= 52) e.vf |= EFLAGS.TELEGRAPH;
      const dx = e.x - t.x, dy = e.y - t.y, d = Math.sqrt(dx * dx + dy * dy);
      const a0 = d > 1e-4 ? Math.atan2(dy, dx) : (e.id % 8) * Math.PI / 4, a1 = a0 + 0.35;
      chase(state, e, t.x + Math.cos(a1) * 150, t.y + Math.sin(a1) * 150, e.speed, dt, 1);
      e.aim = Math.atan2(t.y - e.y, t.x - e.x);
      if (c === 59) aimedAt(state, e, t, 1, 0, K.bspeed);
      break;
    }
    case "spinner": {
      //◆ゆっくり追う（×0.7）。4 tick ごとに 1 発、角度は e.n1 += 23°（螺旋）。弾の寿命は 40 tick
      if (t) chase(state, e, t.x, t.y, e.speed * 0.7, dt, 1);
      if ((tick - e.born) % 4 === 0) {
        e.n1 = (e.n1 + 23) % 360;
        const a = e.n1 * DEG;
        e.aim = a;
        addEBullet(state, e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r, a, ebSpeed(state, K.bspeed), e.gyo, EBULLET_LIFE_TICKS / 2);
      }
      break;
    }
    case "burrower": {
      //◆st 8 潜っている（HIDDEN・接触なし・弾に当たらない・壁を無視して 1.3 倍速）→ 自機から 60px 以内で st 9（10 tick の TELEGRAPH）→ st 10 浮上して 60 tick 追う → また潜る
      if (e.st === 0) { e.st = 8; e.stTick = tick; e.vf |= EFLAGS.HIDDEN; break; }   //◆潜った tick は動かない
      if (e.st === 8) {
        e.vf |= EFLAGS.HIDDEN;
        if (!t) break;
        const dx = t.x - e.x, dy = t.y - e.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d <= 60) {
          //◆浮上先：壁の中なら押し出し、届かない所なら少し（40 tick）潜ったまま近づき、それでも駄目なら「届く床のうち最寄り」へ浮上する
          //◆（自機が掘った細い坑道に居ると、押し出し先が孤立した空洞になって永遠に潜ったまま＝倒せない敵になる）
          e.n1 = (e.n1 | 0) + 1;
          let po = pushOut(state, e.x, e.y, e.r);
          if (!reachablePx(state, po[0], po[1]) && e.n1 >= 40) { const pt = nearestReachableFree(state, t.x, t.y, e.r) || spawnSpot(state, e.r); po = [pt[0], pt[1]]; }
          if (reachablePx(state, po[0], po[1])) {
            e.n1 = 0;
            e.x = po[0]; e.y = po[1]; e.st = 9; e.stTick = tick;
            addZone(state, ZONE_KIND.TELEGRAPH, e.x, e.y, e.r, 10, 0, 0, 0);
            ev(state, ["warn", Math.round(e.x), Math.round(e.y), e.r, 10]);
            break;
          }
        } else e.n1 = 0;
        if (d > 1e-4) { const s = Math.min(d, e.speed * 1.3 * dt); e.x = cx(state, e.x + dx / d * s, e.r); e.y = cy(state, e.y + dy / d * s, e.r); e.vf |= EFLAGS.MOVING; e.aim = Math.atan2(dy, dx); }
      } else if (e.st === 9) {
        e.vf |= EFLAGS.HIDDEN | EFLAGS.TELEGRAPH;
        if (tick - e.stTick >= 10) { e.st = 10; e.stTick = tick; ev(state, ["burst", Math.round(e.x), Math.round(e.y), 1]); }
      } else if (e.st === 10) {
        if (t) chase(state, e, t.x, t.y, e.speed, dt);
        if (tick - e.stTick >= 60) { e.st = 8; e.stTick = tick; }
      }
      break;
    }
    case "lancer": {
      //◆charger の変種：3 回の短い突進（windup 8・speed 360・12 tick）を 6 tick 間隔で続ける。突進のたびに向きを取り直す（e.n3 = 残り回数）
      //◆st 11 = 構え（TELEGRAPH）、12 = 突進、13 = 間。壁に当たったら st 5（よろけ）
      if (!t) break;
      if (e.st === 0) {
        const d = dist(e.x, e.y, t.x, t.y);
        if (tick - e.stTick >= 20 && d <= 380 && lineClear(state, e.x, e.y, t.x, t.y, e.r)) { e.n3 = 3; e.st = 11; e.stTick = tick; }
        else chase(state, e, t.x, t.y, e.speed, dt);
      } else if (e.st === 11) {
        e.vf |= EFLAGS.TELEGRAPH;
        e.aim = Math.atan2(t.y - e.y, t.x - e.x);
        if (tick - e.stTick >= 8) {
          const dx = t.x - e.x, dy = t.y - e.y, d = Math.sqrt(dx * dx + dy * dy);
          //◆標的の真上に居るときは今の向きへ突進する（止めない）
          if (d >= 1e-4) { e.dx = dx / d; e.dy = dy / d; e.aim = Math.atan2(dy, dx); } else { e.dx = Math.cos(e.aim); e.dy = Math.sin(e.aim); }
          e.n1 = 360 * spdMulOf(state.floor); e.n2 = 12; e.n3--;
          e.st = 12; e.stTick = tick;
        }
      } else if (e.st === 12) {
        const nx = e.x + e.dx * e.n1 * dt, ny = e.y + e.dy * e.n1 * dt;
        const hit = nx < e.r || nx > state.aw - e.r || ny < e.r || ny > state.ah - e.r || hitsWall(state, nx, ny, e.r);
        if (hit) { e.st = 5; e.stTick = tick; e.stunUntil = tick + 16; e.n3 = 0; }
        else { e.x = nx; e.y = ny; e.vf |= EFLAGS.MOVING; if (tick - e.stTick >= e.n2) { e.st = e.n3 > 0 ? 13 : 0; e.stTick = tick; } }
      } else if (e.st === 13) {
        if (tick - e.stTick >= 6) { e.st = e.n3 > 0 ? 11 : 0; e.stTick = tick; }
      } else { e.st = 0; e.stTick = tick; }
      break;
    }
    case "warden": {
      //◆ふつうに追う。200px 内の味方（自分以外）の速度 +25%（e.buffUntil を付け、chase が見る）。自分は AURA
      e.vf |= EFLAGS.AURA;
      const es = state.enemies;
      for (let j = 0; j < es.length; j++) { const a = es[j]; if (a.gone || a.id === e.id) continue; if (dist2(e.x, e.y, a.x, a.y) <= 200 * 200) a.buffUntil = tick + 2; }
      if (t) chase(state, e, t.x, t.y, e.speed, dt);
      break;
    }
    case "vase": break;
    default: if (t) chase(state, e, t.x, t.y, e.speed, dt);
  }
}
