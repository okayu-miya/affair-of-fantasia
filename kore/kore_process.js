//◆コア：処理。state を進める。ctx は触らない（子は client.js） : 2.1参照
//◆処理の 1 フレームここから : 2.1参照
function koreProcess(dt, t) {
  const held = storyHolds();
  if (simMayRun(held)) koreSimFrame(dt, t);
  evFrameCall(dt, t);
  fbFrameCall(dt, t);
}
function koreSimFrame(dt, t) {
  updateMe(dt, t);
  simTicks(dt);
  tickAlpha();
  updateCamera(dt, t);
  updateParticles(dt);
  updateDebris(dt);
  updateTimers(dt, t);
  ambientCaveStep(dt, t);
  mbWatch();
  townClockAdd(dt);
  colonyClockStep(dt);
}
//◆処理の 1 フレームここまで : 2.1参照

//◆1 tick ここから : 2.1参照
function stepSim() {
  const input = buildInput();
  const evs = simStep(input);
  if (simFailed(evs)) return;
  flushSimEvents();
  godModeKeep();
  handleEventsSafe(evs);
  postTick();
}
//◆1 tick ここまで : 2.1参照
