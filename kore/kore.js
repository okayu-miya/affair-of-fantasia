//◆コア：1 フレームの流れ。ここは子を呼ぶだけ（子は client.js） : 1.1参照
//◆1 フレームここから : 1.1参照
function frame(t) {
  requestAnimationFrame(frame);
  const dt = frameDt(t);
  frameHead(dt, t);
  if (runLive()) return frameRun(dt, t);
  if (townLive()) return villageFrameSafe(dt, t);
  frameBlank();
}
//◆1 フレームここまで : 1.1参照

//◆探索の 1 フレームここから : 1.2参照
function frameRun(dt, t) {
  koreProcess(dt, t);
  if (runShown()) koreRender(t);
}
//◆探索の 1 フレームここまで : 1.2参照

//◆起動ここから : 1.3参照
function koreBoot() {
  boot();
  requestAnimationFrame(frame);
  if (selftestWanted()) setTimeout(runSelftest, 50);
}
//◆起動ここまで : 1.3参照

koreBoot();
