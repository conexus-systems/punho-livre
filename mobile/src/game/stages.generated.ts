/* eslint-disable */
// GERADO por scripts/stages/paint-stages.mjs — não edite à mão.

import type { StageArt } from "./stages";

export const STAGE_ART: Record<string, StageArt> = {
  "dojo": {
    sky: ["#3B1D4E","#FCD9A0"],
    layers: [
      { name: "sky", parallax: 0.15, x: -374.5, y: -260, w: 749.0, h: 270, pw: 1873, ph: 675, bob: 0, module: require("../../assets/stages/dojo-sky.jpg") },
      { name: "wall", parallax: 0.75, x: -512.5, y: -250, w: 1025.0, h: 252, pw: 2563, ph: 630, bob: 0, module: require("../../assets/stages/dojo-wall.png") },
      { name: "crowd", parallax: 0.88, x: -542.4, y: -60, w: 1084.8, h: 62, pw: 2712, ph: 155, bob: 0, module: require("../../assets/stages/dojo-crowd.png") },
      { name: "floor", parallax: 1, x: -570.0, y: -4, w: 1140.0, h: 64, pw: 2850, ph: 160, bob: 0, module: require("../../assets/stages/dojo-floor.jpg") },
    ],
  },
  "pelourinho": {
    sky: ["#1E6FD9","#BFE6FF"],
    layers: [
      { name: "sky", parallax: 0.15, x: -374.5, y: -260, w: 749.0, h: 270, pw: 1873, ph: 675, bob: 0, module: require("../../assets/stages/pelourinho-sky.jpg") },
      { name: "far", parallax: 0.4, x: -432.0, y: -250, w: 864.0, h: 252, pw: 2160, ph: 630, bob: 0, module: require("../../assets/stages/pelourinho-far.png") },
      { name: "houses", parallax: 0.75, x: -512.5, y: -235, w: 1025.0, h: 237, pw: 2563, ph: 593, bob: 0, module: require("../../assets/stages/pelourinho-houses.png") },
      { name: "crowd", parallax: 0.9, x: -547.0, y: -70, w: 1094.0, h: 72, pw: 2735, ph: 180, bob: 0.8, module: require("../../assets/stages/pelourinho-crowd.png") },
      { name: "floor", parallax: 1, x: -570.0, y: -4, w: 1140.0, h: 64, pw: 2850, ph: 160, bob: 0, module: require("../../assets/stages/pelourinho-floor.jpg") },
    ],
  },
  "metro": {
    sky: ["#050816","#B5367B"],
    layers: [
      { name: "sky", parallax: 0.1, x: -363.0, y: -260, w: 726.0, h: 270, pw: 1815, ph: 675, bob: 0, module: require("../../assets/stages/metro-sky.jpg") },
      { name: "far", parallax: 0.3, x: -409.0, y: -290, w: 818.0, h: 292, pw: 2045, ph: 730, bob: 0, module: require("../../assets/stages/metro-far.png") },
      { name: "street", parallax: 0.7, x: -501.0, y: -250, w: 1002.0, h: 252, pw: 2505, ph: 630, bob: 0, module: require("../../assets/stages/metro-street.png") },
      { name: "crowd", parallax: 0.9, x: -547.0, y: -70, w: 1094.0, h: 72, pw: 2735, ph: 180, bob: 0.8, module: require("../../assets/stages/metro-crowd.png") },
      { name: "floor", parallax: 1, x: -570.0, y: -4, w: 1140.0, h: 64, pw: 2850, ph: 160, bob: 0, module: require("../../assets/stages/metro-floor.jpg") },
    ],
  },
};
