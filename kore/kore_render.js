//◆コア：描画。今の state を絵にする。state は変えない（子は client.js） : 3.1参照
//◆描画の 1 フレームここから : 3.1参照
function koreRender(t) {
  if (!renderReady()) return;
  renderBegin(t);
  //◆地面の層ここから
  drawFloor();
  drawSenseOre(t);
  drawTorches(t);
  drawZones(t);
  drawHatch(t);
  drawOmakePages(t);
  drawMbTall(false);
  drawSukimaFloor(t);
  drawDebris();
  pf("floor");
  //◆地面の層ここまで
  //◆物と体の層ここから
  drawItems(t);
  pf("items");
  drawBullets(t);
  pf("bullets");
  drawEnemies(t);
  drawPlayer(t);
  drawMbTall(true);
  pf("enemies");
  //◆物と体の層ここまで
  //◆効果の層ここから
  drawEBulletsUnlessFinal(t);
  drawFxs(t);
  drawParticles();
  drawFloaters(t);
  pf("fx");
  //◆効果の層ここまで
  drawLight(t);
  pf("light");
  //◆明かりの上ここから : 3.1参照
  xfWorld();
  drawFinalOverLight(t);
  drawMbGlow(t);
  drawAmbientCave(t);
  pf("ambient");
  drawCursor(t);
  drawMinimap();
  drawHUD(t);
  drawEvHud(t);
  drawFbHud(t);
  pf("hud");
  //◆明かりの上ここまで : 3.1参照
  profFlush(t);
  drawProfBox();
}
//◆描画の 1 フレームここまで : 3.1参照
