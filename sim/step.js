//◆1 tick を進める step と、その前の位置の控え（savePrev） : 2.10.27参照
function savePrev(state) {
  const es = state.enemies; for (let i = 0; i < es.length; i++) { es[i].px = es[i].x; es[i].py = es[i].y; }
  const bs = state.bullets; for (let i = 0; i < bs.length; i++) { bs[i].px = bs[i].x; bs[i].py = bs[i].y; }
  const eb = state.ebullets; for (let i = 0; i < eb.length; i++) { eb[i].px = eb[i].x; eb[i].py = eb[i].y; }
  const its = state.items; for (let i = 0; i < its.length; i++) { its[i].px = its[i].x; its[i].py = its[i].y; }
  const p = state.players[0]; p.px = p.x; p.py = p.y;
}
function step(state, input) {
  const s0 = state.events.length, dt = TICK_DT;
  if (state.phase === PHASE.OVER || state.phase === PHASE.LEAVE) { state.tick++; return state.events.slice(s0); }
  savePrev(state);
  applyInputs(state, input && typeof input === "object" ? input : {});
  if (state.phase === PHASE.LEAVE) { state.tick++; return state.events.slice(s0); }
  if (state.phase === PHASE.TRANSIT) {
    state.transitLeft--;
    if (state.transitLeft <= 0) {
      const up = state.nextFloor | 0; if (up) state.nextFloor = 0;   //◆嘘のハッチ（おまけの層）は 1 つ上の階へ
      const nx = up > 0 ? up : state.floor + 1;
      startFloor(state, nx, state.evOff || omakeOf(state) ? "" : rollEvent(state.seed, nx));   //◆着いた階がイベント階層か
    }
    state.tick++;
    return state.events.slice(s0);
  }
  if (!state.flow || state.flowTick < 0 || (state.tick - (state.flowTick | 0)) >= FLOW_EVERY) rebuildFlow(state);
  stepWaves(state);
  if (state.sf) stepFinal(state);   //◆決戦（待ち・カードの時間・弾幕）と 1000 階
  if (state.oh) stepOmake(state);   //◆焼け残った頁を拾う
  const es = state.enemies, len = es.length;
  for (let i = 0; i < len; i++) if (!es[i].gone) enemyAI(state, es[i], dt);
  stepPlaced(state);   //◆石積みの置き土の寿命
  stepEnemyPhysics(state, dt);
  stepBullets(state, dt);
  state.enemies = state.enemies.filter(e => !e.gone);
  stepEBullets(state, dt);
  stepZones(state);
  stepItems(state, dt);
  stepRegen(state);
  stepHatch(state);
  if (state.chain > 0 && state.tick - state.chainTick > chainWin(state)) state.chain = 0;
  stepOver(state);
  state.tick++;
  return state.events.slice(s0);
}

