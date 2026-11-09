//◆敵の表（種・族・行動の置き換え・ボスの台本） : 2.10.3参照
//◆敵の種の表ここから
const EXTRA_SPECIES = [["mini", "ミニ", "chaser", 1, 8, 115, 1, 1, 0, "basic", "mon_001"],
  ["mason", "石積みゴブリン", "mason", 6, 13, 105, 1, 8, 3, "mine", "kit2"]];   //◆石積み：坑夫ゴブリンの絵を流用（client が石の色を重ねる）
const SPECIES = [];
for (let i = 0; i < CAT.SPECIES.length; i++) { const c = CAT.SPECIES[i]; SPECIES.push([c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7], c[8], c[9], c[0]]); }
for (let i = 0; i < EXTRA_SPECIES.length; i++) SPECIES.push(EXTRA_SPECIES[i].slice());
const KIND_LIST = [];
for (let i = 0; i < SPECIES.length; i++) KIND_LIST.push(SPECIES[i][0]);
const KIND_IDX = {};
for (let i = 0; i < KIND_LIST.length; i++) KIND_IDX[KIND_LIST[i]] = i;
//◆決戦の紫（SPECIES の末尾）。湧かない w = 0・どの層にも居ない族。KIND_LIST / KIND_IDX には入れない（番号・図鑑・行の表は動かさない）。絵は client が立ち絵の紫で描く
const FIN_KIND = "yukari_fin";
SPECIES.push([FIN_KIND, "紫", "final", 8, 18, 0, 0, 0, 0, "gap", "p_yukari"]);
//◆おまけの層の魔理沙（7 階）と魅魔（13 階）。FIN_KIND と同じ作り（湧かない・図鑑に入れない。絵は client が立ち絵で描く） : 2.10.11参照
const OM_MARISA = "marisa_om", OM_MIMA = "mima_om";
SPECIES.push([OM_MARISA, "魔理沙", "final", 8, 16, 0, 0, 0, 0, "gap", "p_yukari"]);
SPECIES.push([OM_MIMA, "魅魔", "final", 8, 18, 0, 0, 0, 0, "gap", "p_yukari"]);
const KINDS = {};
for (let i = 0; i < SPECIES.length; i++) {
  const r = SPECIES[i];
  KINDS[r[0]] = { name: r[1], beh: r[2], hp: r[3], r: r[4], speed: r[5], dmg: r[6], coin: r[7], w: r[8], fam: r[9], sprite: r[10], idx: i,
    shield: r[2] === "shielded" ? 60 : 0, bspeed: r[2] === "stationary" ? 190 : 170 };
}
const FAMILY_NAMES = CAT.FAMILY_NAMES, FAMILY_BOSSES = CAT.FAMILY_BOSSES, BIOMES = CAT.BIOME_TABLE, CHARAS = CAT.CHARAS;
const BOSS_FAM_KEYS = Object.keys(FAMILY_BOSSES);
for (let f = 0; f < BOSS_FAM_KEYS.length; f++) { const list = FAMILY_BOSSES[BOSS_FAM_KEYS[f]]; for (let i = 0; i < list.length; i++) if (KINDS[list[i]]) KINDS[list[i]].boss = 1; }
//◆敵の種の表ここまで
//◆行動の置き換えここから
//◆chaser の一部を族と名前のハッシュで新しい行動に置き換える（決定論。ボスは除外）
//◆mage/book/demon/chaos → healer か spinner、human/castle/pirate/egypt → sniper か lancer、
//◆forest/wild/beast/mine/ruin → burrower か orbiter、holy/myth/wa/final → warden か orbiter、他はそのまま
const BEH_SWAP = { mage: ["healer", "spinner"], book: ["healer", "spinner"], demon: ["healer", "spinner"], chaos: ["healer", "spinner"],
  human: ["sniper", "lancer"], castle: ["sniper", "lancer"], pirate: ["sniper", "lancer"], egypt: ["sniper", "lancer"],
  forest: ["burrower", "orbiter"], wild: ["burrower", "orbiter"], beast: ["burrower", "orbiter"], mine: ["burrower", "orbiter"], ruin: ["burrower", "orbiter"],
  holy: ["warden", "orbiter"], myth: ["warden", "orbiter"], wa: ["warden", "orbiter"], final: ["warden", "orbiter"] };
for (let i = 0; i < KIND_LIST.length; i++) {
  const k = KIND_LIST[i], K = KINDS[k];
  if (K.beh !== "chaser" || K.boss) continue;
  const h = hash32(strHash(k), 3, 7);
  if (h % 10 !== 0) continue;
  const sw = BEH_SWAP[K.fam];
  if (sw) K.beh = sw[hash32(strHash(k), 5, 7) & 1];
}
//◆保証：BEH_SWAP の族ごとに、2 つの行動がそれぞれ最低 1 種は居るようにする（hash の規則だけだと healer と warden が 1 種も出ない）。
//◆候補は「その族の chaser でボスでない種」を hash32(strHash(k), 5, 7) の小さい順に並べた物（決定論）
for (const fam in BEH_SWAP) {
  const sw = BEH_SWAP[fam];
  const cands = KIND_LIST.filter((k) => KINDS[k].fam === fam && !KINDS[k].boss && KINDS[k].beh === "chaser").sort((a, b) => hash32(strHash(a), 5, 7) - hash32(strHash(b), 5, 7) || (a < b ? -1 : 1));
  for (let j = 0; j < sw.length; j++) {
    if (KIND_LIST.some((k) => KINDS[k].fam === fam && KINDS[k].beh === sw[j])) continue;
    const k = cands.shift();
    if (k) KINDS[k].beh = sw[j];
  }
}
//◆行動の置き換えここまで
const BEHAVIORS = ["chaser", "hopper", "flyer", "shooter", "splitter", "shielded", "bomber", "thrower", "charger", "stalker", "phaser",
  "stationary", "summoner", "ringer", "teleporter", "swarm", "vase", "digger", "healer", "sniper", "orbiter", "spinner", "burrower", "lancer", "warden", "mason"];
const FAM_MEMBERS = {};
for (let i = 0; i < CAT.SPECIES.length; i++) { const fam = CAT.SPECIES[i][9]; if (!FAM_MEMBERS[fam]) FAM_MEMBERS[fam] = []; FAM_MEMBERS[fam].push(i); }
FAM_MEMBERS.mine.push(KIND_IDX.mason);   //◆石積みは坑道の民（B1〜15）。EXTRA の行でここに入るのは mason だけ（mini は召喚候補に入れない）

//◆ボスの行動台本ここから
//◆ボスの行動台本（followus 3.7 章のまま）
const BOSS_SCRIPTS = {
  hopper: { script: [{ every: 80, every2: 60, at: 0, act: "leap", args: [12, 14, 30] }, { every: 180, at: 90, act: "summon", args: ["", 2, 6] }], landRing: [10, 160], landRing2: [14, 160] },
  splitter: { script: [{ every: 80, every2: 60, at: 0, act: "leap", args: [12, 14, 30] }, { every: 150, at: 70, act: "summon", args: ["", 3, 8] }], landRing: [10, 160], landRing2: [14, 160] },
  shooter: { script: [{ every: 120, at: 0, act: "aimed", args: [3, 10, 200] }, { every: 120, at: 6, act: "aimed", args: [3, 10, 200] }, { every: 120, at: 12, act: "aimed", args: [3, 10, 200] },
    { every: 120, at: 50, act: "teleport", args: [250] }, { every: 120, at: 80, act: "summon", args: ["", 2, 6] }, { every: 120, at: 100, act: "ring", args: [12, 170], phase2: 1 }] },
  summoner: { script: [{ every: 150, at: 0, act: "summon", args: ["", 3, 9] }, { every: 90, at: 40, act: "ring", args: [9, 150] }, { every: 90, every2: 60, at: 70, act: "aimed", args: [3, 14, 190] }] },
  ringer: { script: [{ every: 70, every2: 50, at: 0, act: "ring", args: [12, 165] }, { every: 140, at: 60, act: "aimed", args: [5, 12, 200] }, { every: 200, at: 120, act: "zoneAll", args: ["lava", 44, 110, 14], phase2: 1 }] },
  charger: { script: [{ every: 110, every2: 80, at: 0, act: "dash", args: [14, 430, 14] }, { every: 160, at: 80, act: "ring", args: [10, 150] }] },
  shielded: { script: [{ every: 130, every2: 100, at: 0, act: "dash", args: [16, 380, 14] }, { every: 170, at: 60, act: "summon", args: ["", 2, 6] }, { every: 170, at: 120, act: "ring", args: [10, 150], phase2: 1 }] },
  flyer: { script: [{ every: 100, at: 0, act: "aimed", args: [5, 14, 210] }, { every: 100, at: 40, act: "teleport", args: [280] }, { every: 160, every2: 110, at: 80, act: "ring", args: [14, 175] }] },
  phaser: { script: [{ every: 120, at: 0, act: "teleport", args: [220] }, { every: 120, at: 20, act: "ring", args: [10, 160] }, { every: 180, at: 90, act: "summon", args: ["", 3, 8] }] },
  stalker: { script: [{ every: 110, at: 0, act: "teleport", args: [240] }, { every: 110, at: 24, act: "aimed", args: [3, 16, 205] }, { every: 220, every2: 150, at: 60, act: "dash", args: [12, 420, 12] }] },
  teleporter: { script: [{ every: 90, at: 0, act: "teleport", args: [260] }, { every: 90, at: 18, act: "aimed", args: [5, 10, 200] }, { every: 180, at: 120, act: "ring", args: [12, 165], phase2: 1 }] },
  stationary: { script: [{ every: 60, every2: 44, at: 0, act: "ring", args: [11, 160] }, { every: 130, at: 30, act: "aimed", args: [5, 12, 205] }, { every: 190, at: 90, act: "summon", args: ["", 3, 9] }] },
  thrower: { script: [{ every: 90, at: 0, act: "zoneAll", args: ["warn", 40, 100, 0] }, { every: 140, at: 50, act: "ring", args: [10, 155] }, { every: 200, at: 120, act: "summon", args: ["", 2, 6] }] },
  bomber: { script: [{ every: 100, every2: 70, at: 0, act: "dash", args: [12, 400, 12] }, { every: 100, at: 50, act: "ring", args: [12, 160] }] },
  swarm: { script: [{ every: 120, at: 0, act: "summon", args: ["", 4, 12] }, { every: 80, every2: 60, at: 40, act: "aimed", args: [3, 20, 195] }] },
  digger: { script: [{ every: 110, every2: 80, at: 0, act: "dash", args: [14, 400, 12] }, { every: 170, at: 70, act: "summon", args: ["", 2, 6] }, { every: 170, at: 130, act: "ring", args: [10, 150], phase2: 1 }] },
  default: { script: [{ every: 90, every2: 70, at: 0, act: "leap", args: [12, 14, 30] }, { every: 150, at: 60, act: "ring", args: [10, 160] }, { every: 210, at: 120, act: "summon", args: ["", 2, 6] }], landRing: [8, 150], landRing2: [12, 155] },
};
//◆ボスの行動台本ここまで

