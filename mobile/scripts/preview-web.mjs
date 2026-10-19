#!/usr/bin/env node
// Visualização/QA das telas no navegador (react-native-web + CanvasKit) com capturas em PNG.
// Não substitui teste em aparelho. Uso: npm run preview:web [-- pasta-de-saida]
import { execFileSync, spawn } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const out = path.resolve(process.argv[2] ?? path.join(root, "..", "docs", "screenshots"));
const dist = path.join(root, "dist-web");

execFileSync("npx", ["expo", "export", "--platform", "web", "--output-dir", dist], { cwd: root, stdio: "inherit", env: { ...process.env, CI: "1" } });
copyFileSync(path.join(path.dirname(require.resolve("canvaskit-wasm/bin/full/canvaskit.js")), "canvaskit.wasm"), path.join(dist, "canvaskit.wasm"));

const server = spawn("npx", ["serve", "-s", dist, "-l", "4319"], { cwd: root, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 2500));
const { chromium } = await import("playwright");
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
mkdirSync(out, { recursive: true });
const shots = [
  ["/", "w10m-iniciar"],
  ["/select", "w10m-selecao"],
  ["/settings", "w10m-ajustes"],
  ["/roster", "w10m-personagens"],
  ["/profile", "w10m-perfil"],
  ["/online", "w10m-online"],
];
try {
  for (const [route, name] of shots) {
    await page.goto(`http://localhost:4319${route}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1800);
    await page.screenshot({ path: path.join(out, `${name}.png`) });
    console.log(`${name}.png`);
  }
  // percurso real até a luta: Iniciar → Versus CPU → Próximo → Lutar
  await page.goto("http://localhost:4319/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Versus CPU" }).click();
  await page.getByRole("button", { name: "Próximo" }).click();
  await page.getByRole("button", { name: "Escolher Titã" }).click();
  await page.getByRole("button", { name: "Lutar" }).click();
  await page.waitForTimeout(5000);
  await page.screenshot({ path: path.join(out, "w10m-luta.png") });
  console.log("w10m-luta.png");
} finally {
  await browser.close();
  server.kill();
}
