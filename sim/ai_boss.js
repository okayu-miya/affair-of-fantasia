//◆ボスの行動台本を回す（bossAI）。台本の表は enemy_table.js : 2.10.17参照
function bossScript(e) { return BOSS_SCRIPTS[e.beh] || BOSS_SCRIPTS.default; }
function bossAI(state, e, t, dt) {
  const B = bossScript(e);
  const half = e.hp * 2 <= e.maxhp;
  e.phaseA = half ? 1 : 0;
  const bt = state.tick - e.born;
  for (let i = 0; i < B.script.length; i++) {
    const row = B.script[i];
    if (row.phase2 && !half) continue;
    const every = (half && row.every2) ? row.every2 : row.every;
    //◆at は every2 以上でもよい（summoner の aimed は at 70・every2 60）。% every で揃える（第 1 段階は at < every なので変わらない）
    if (bt % every !== row.at % every) continue;
    const a = row.args;
    switch (row.act) {
      case "leap": startLeap(state, e, t, a[0], a[1], a[2]); break;
      case "ring": ringAt(state, e.x, e.y, a[0], a[1], rnd(state) * Math.PI * 2, e.gyo); break;
      case "aimed": aimedAt(state, e, t, a[0], a[1], a[2]); break;
      case "summon": summon(state, e, a[0], a[1], a[2]); break;
      case "dash": startDash(state, e, t, a[0], a[1] * spdMulOf(state.floor), a[2]); break;
      case "teleport": startTeleport(state, e, t, a[0]); break;
      case "zoneAll": zoneAll(state, a[0], a[1], a[2], a[3], e.gyo); break;
      default: break;
    }
  }
  if (e.st === 0 && t) {
    if (e.beh === "digger" && e.digBudget > 0 && segHitsWall(state, e.x, e.y, t.x, t.y, e.r) && !flowDir(state, e)) diggerAI(state, e, t, dt);
    else { chase(state, e, t.x, t.y, e.speed, dt, 1); turnTo(e, Math.atan2(t.y - e.y, t.x - e.x)); }
  }
}

