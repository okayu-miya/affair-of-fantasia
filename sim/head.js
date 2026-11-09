//◆sim.js の頭（UMD）。約束・部品の並びは 2.10 を見る : 2.10参照
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./catalog.js"), (function () { try { return require("./elem.js"); } catch (e) { return null; } })());
  else root.SIM = factory(root.DD_CATALOG, root.DD_ELEM || null);
})(typeof globalThis !== "undefined" ? globalThis : this, function (CAT, ELEM) {
"use strict";

