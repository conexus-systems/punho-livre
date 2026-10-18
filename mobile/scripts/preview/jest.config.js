// Renderiza cenas reais do jogo com o backend CanvasKit (WASM) do react-native-skia,
// fora do aparelho. Uso: npx jest -c scripts/preview/jest.config.js
const path = require("node:path");

module.exports = {
  rootDir: path.resolve(__dirname, "../.."),
  preset: "jest-expo",
  testEnvironment: "node",
  testMatch: ["<rootDir>/scripts/preview/**/*.preview.ts"],
  moduleNameMapper: {
    "^@shopify/react-native-skia$": "<rootDir>/scripts/preview/skia-node.ts",
  },
};
