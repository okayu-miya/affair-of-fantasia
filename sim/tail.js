//◆公開する物（ブラウザは globalThis.SIM、Node は module.exports） : 2.10参照
return {
  VER, TICK_MS, TICK_DT, CELL, PLAYER_R, BULLET_R, EBULLET_R, ITEM_R, HATCH_R, FLOW_EVERY, MAX_EBULLETS, MAX_BULLETS,
  HURT_INVULN_TICKS, CONTACT_CD_TICKS, FLOOR_INVULN_TICKS, DASH_TICKS, DASH_CD_TICKS, DASH_SPEED, CHAIN_TICKS, CHAIN_MAX, CHAIN_STEP,
  ITEM_LIFE_TICKS, MAGNET_SPEED, HEART_DROP, KB_IMPULSE, KB_DECAY, SHIELD_THROUGH, ELITE_FROM, ELITE_RATE,
  FIRST_WAVE_TICKS, TELEGRAPH_TICKS, WAVE_TIMEOUT_TICKS, WAVE_NEXT_ALIVE, EBULLET_LIFE_TICKS, STUCK_TICKS, OVER_FREEZE_TICKS, TRANSIT_TICKS, HATCH_COUNT_TICKS,
  BOMB_R, BOMB_DMG, BOMB_CLEAR_R, BOMB_DIG_R, BIOME_FLOORS, BOSS_HP_MUL, BOSS_R_MUL, BOSS_COIN_MUL, INV_MAX, EQUIP_TIERS, ORE_COUNT, MAG_COUNT, LV_MAX, REACH_MAX,
  PHASE, EFLAGS, ITEM_KIND, ZONE_KIND, BLOCK, BLOCK_DEF, BF, BOOM_R, ORB_R, ORES, MAGS, TIER_NAMES, TIER_COLORS, SLOTS, SLOT_NAMES, EQUIP_KINDS, EQUIP_KIND_LIST, WEAPON_LIST, STAT_NAMES, BASE, ITEMS, ITEM_KEYS,
  SPECIES, KIND_LIST, KINDS, FAMILY_NAMES, FAMILY_BOSSES, BIOMES, CHARAS, BEHAVIORS, BOSS_SCRIPTS, TRAITS, TRAIT_LIST, TRAIT_LIST_V09, TRAIT_FX, traitEff, traitDmgMul, heartRate, beginDescend, CHARA_TRAITS, CHARA_TRAITS2, charaTrait,
  CHARA_TRAITS_EXTRA, TRAITS_V011, pendantTraitIds, DEPTH_STEP, DEPTH_STEPS_MAX, DASH_DMG_TICKS, STEAL_COIN,   //◆特性の 3 つ目の表・30 種
  CHARM2_FLOOR, PENDANT_FLOOR, slotKind, TRAIT_MAG, traitLevel, traitVal, traitDesc, trv, charaTraitIds, charaTraits, charaBest, statsOptsOf,
  chainWin,   //◆チェインの窓の長さ（HUD の残りの棒）
  hash32, rng32, rnd, clamp, vnoise, fbm,
  cellIndex, cellOf, inGrid, blockAt, isSolid, wallCell, hitsWall, pushOut, segHitsWall, steerDir,
  biomeOf, bossOf, bossTitle, kindIndex, speciesName,
  MB_TYPES, MB_NAMES, MB_MIN_FLOOR, mbHas, mbMap, placeMinis, mbWeights,   //◆ミニバイオーム
  BIOME_FROM, CYCLE_BIOMES, bossCycle, floorSide, floorSideOld, areaGrow,   //◆層の始まりの階・ボスの強さの段・階の一辺
  TIER_HI, EQUIP_MODELS, modelOf, tierFloor, tierGrow,   //◆装備の型と段階
  BOUNCE_MAX, SPIRAL_VR, SPIRAL_VT, SPIRAL_R0, RING_N, RING_DMG, RING_LIFE, ATK_FROM, ATK_PER, ATK_MAX, EATK_BASE, DEF_PER, DEF_FLOOR, atkMulOf, eAtk, shotMode, stepBullets,   //◆撃ち方・敵の攻撃の伸び
  clampEquip, equipSlotOf, equipEffect, playerStats, equipName, equipStatLines, equipScore, upgradeCost, sellPrice, tierOfFloor, oreTierOfFloor, magTierOfFloor, rollEquip,
  newSave, migrateSave, loadoutOf, canUpgrade, applyUpgrade, applyRun, runSummary, clampChara, unlockedCharas, grandfatheredCharas,
  MIRROR_RATE, UPGRADE_MATS, clampMirrors, startFloors, withAf,   //◆隙間の鏡・強化の素材・鍛造
  BOOK_RATE, BOOK_PITY, BOOK_SALT, BOOK_RUN_MAX, BOOK_PULL_TICKS, bookRoll, bookSweep, storyApi,   //◆記憶の禁書・物語（story.js）
  genFloor, createRun, startFloor, step, flushEvents, isAlive, isOver, aliveCount,
  digTarget, damageBlock, reachable, reachablePx, rebuildFlow, shotAngles, bulletId, muzzle, applyPos, spawnSpot,
  //◆行式・レベル・スキル・素材・特別な武器・敵の段階・wasm
  ELEM: EL, LV_CAP, REGEN_EVERY, ITEM_MAGNET_DELAY, SLOW_AURA_R, CHAMP_RING_EVERY, RANK_MUL, CHAMP_FROM, CHAMP_RATE, VET_FROM, VET_RATE, CRIT_MUL, ARMOR_MAX, HAMMER_CORNER, BEH_SWAP, KIND_IDX, FAM_MEMBERS,
  strHash, gyoIdx, gyoOf, specialOf, equipGyo, skv, pv, addXp, baseHpOf, makeEnemy, spawnAt, dropItem, damagePlayer, hurtEnemy, killEnemy, boomEnemies, eliteRate, rollRank,
  //◆石積み（掘って迫り、土を置いて自弾を防ぐ敵）
  MASON_DIG_BUDGET, MASON_PLACE_BUDGET, MASON_PLACE_CD, MASON_LOOK, MASON_REACH, PLACED_LIFE, PLACED_MAX, MASON_DEEP_FROM, MASON_DEEP_RATE, canPlaceAt, placeBlock, masonDeepW, pickKind,
  //◆戦い方（1 掘る・2 置く・3 両方）
  STYLE_DIG, STYLE_PLACE, STYLE_CD, STYLE_TABLE, STYLE_NONE, STYLE_PLACE_ONLY, STYLE_SLIM, styleRateOf, styleFor, rollStyle, styleAI, styleDigBudget,
  STYLE_GIVEUP_T, STYLE_REST_T,
  useWasm, hasWasm,
  //◆イベント階層
  EVENTS, EVENT_BY, EVENT_LOWER, EVENT_UPPER, EVENT_RATE, EVENT_UPPER_RATE, YUKARI_WAIT, YUKARI_TALK_R, TINY_WAIT, TINY_OPEN_DELAY, MAZE_AREA, WIDE_AREA, GALE_SPEED, GOLD_COIN, CHEST_EVENT_MUL,
  rollEvent, hordeFam, evHold, evTalk, chestsLeft,
  //◆決戦（501 階の紫）と 1000 階
  FINAL_FLOOR, EXTRA_FLOOR, FIN_KIND, FIN_CARDS, FIN_AUTO, FIN_ARENA, FIN_EBULLETS, FIN_CARD_MAX, FIN_SPD_MIN, FIN_SPD_MAX, FIN_AIM_MAX, FIN_CORE, FIN_HR, FIN_SAFE, FIN_RING_MAX, FIN_WARN_MIN,
  FIN_DECLARE, FIN_DMG, FIN_DPS_SEC, FIN_NET_SP, FIN_NET_GAP, FIN_WIN_COIN, FIN_CAP_COIN, EXTRA_COIN,
  genFinal, genExtra, sfOf, finDmg, finBaseHp, finDps, segPtDist,
  //◆おまけの層（13 階・魔理沙 7 階・魅魔 13 階）
  OMAKE_FLOORS, OMAKE_MARISA, OMAKE_MIMA, OMAKE_HOLD_AUTO, OM_MARISA, OM_MIMA, MARISA_CARDS, MIMA_CARDS, omakeOf, omakePageNo, omakeHatches, genOmakeArena, finCardsOf,
  //◆能力の上限・紫の体から出る弾の守り
  SPEED_MAX, IFRAME_MAX, SENSE_MAX, FIN_SAFE_BODY,
};
});
