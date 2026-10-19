#!/usr/bin/env node
// Orçamento de tamanho (docs/DEVICE_LAB.md § Tamanho). Mede o export Android do
// Expo (bundle Hermes + assets), agrupa os assets por origem e compara com os
// limites de size-budget.json; sai com código 1 se algum limite estourar.
//
//   npm run size                       # roda `expo export --platform android` num diretório temporário
//   npm run size -- --dir dist         # mede um export já feito
//   npm run size -- --apk app.apk      # também mede um APK/AAB (por pasta: lib/, assets/, res/, dex)
//   npm run size -- --json out.json    # grava o relatório
//   npm run size -- --budget outro.json # outro arquivo de limites
//
// O export NÃO é o download da loja: falta a parte nativa (Hermes, React Native,
// Skia, AdMob…), que só um build EAS mostra. Por isso o relatório separa o que é
// medido do que é estimado (`native_estimate_mb` no size-budget.json).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const MB = 1024 * 1024;
const mb = (n) => Math.round((n / MB) * 100) / 100;

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const budget = JSON.parse(readFileSync(arg("--budget") ?? path.join(root, "size-budget.json"), "utf8"));

// ------------------------------------------------------------------ export
let dir = arg("--dir");
if (!dir) {
  dir = path.join(mkdtempSync(path.join(os.tmpdir(), "mugen-size-")), "dist");
  console.log(`expo export --platform android → ${dir}`);
  execFileSync("npx", ["expo", "export", "--platform", "android", "--dump-assetmap", "--output-dir", dir], {
    cwd: root,
    stdio: ["ignore", "ignore", "inherit"],
    env: { ...process.env, CI: "1" },
  });
}
dir = path.resolve(dir);

function walk(d) {
  const out = [];
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push({ path: p, size: statSync(p).size });
  }
  return out;
}

const files = walk(dir).filter((f) => !/assetmap\.json$/.test(f.path));
const total = files.reduce((s, f) => s + f.size, 0);
const meta = JSON.parse(readFileSync(path.join(dir, "metadata.json"), "utf8"));
const bundleRel = meta.fileMetadata?.android?.bundle;
const bundle = bundleRel ? statSync(path.join(dir, bundleRel)).size : 0;
const sizeOf = new Map(files.map((f) => [path.relative(dir, f.path), f.size]));

const byExt = {};
for (const a of meta.fileMetadata?.android?.assets ?? []) byExt[a.ext] = (byExt[a.ext] ?? 0) + (sizeOf.get(a.path) ?? 0);
const assetsTotal = Object.values(byExt).reduce((s, n) => s + n, 0);

/** Origem do asset (characters/kaze, assets/stages, node_modules/expo-router…). */
function origin(loc) {
  const norm = loc.replace(/\\/g, "/");
  const nm = norm.lastIndexOf("/node_modules/");
  if (nm >= 0) return norm.slice(nm + 1).split("/").slice(0, norm.slice(nm + 1).startsWith("node_modules/@") ? 3 : 2).join("/");
  const rel = path.relative(root, loc).replace(/\\/g, "/");
  return rel.split("/").slice(0, 2).join("/");
}
const byOrigin = {};
const mapFile = path.join(dir, "assetmap.json");
if (existsSync(mapFile)) {
  for (const a of Object.values(JSON.parse(readFileSync(mapFile, "utf8")))) {
    const o = origin(a.fileSystemLocation);
    for (const h of a.fileHashes ?? []) byOrigin[o] = (byOrigin[o] ?? 0) + (sizeOf.get(`assets/${h}`) ?? 0);
  }
}
const group = (o) => (o.startsWith("characters/") ? "characters/*" : o);
const byGroup = {};
for (const [o, n] of Object.entries(byOrigin)) byGroup[group(o)] = (byGroup[group(o)] ?? 0) + n;
const topCharacters = Object.entries(byOrigin)
  .filter(([o]) => o.startsWith("characters/"))
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5);

// ------------------------------------------------------------------ APK/AAB (opcional)
/** Lê o diretório central de um zip (APK/AAB) e soma os tamanhos comprimidos por pasta. */
function zipBreakdown(file) {
  const buf = readFileSync(file);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error(`${file} não parece um zip`);
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const parts = {};
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const comp = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    const segs = name.split("/");
    const key = segs[0] === "lib" || (segs[0] === "base" && segs[1] === "lib") ? segs.slice(0, segs[0] === "base" ? 3 : 2).join("/") : /\.dex$/.test(name) ? "*.dex" : segs.length > 1 ? `${segs[0]}/` : name;
    parts[key] = (parts[key] ?? 0) + comp;
    p += 46 + nameLen + extraLen + commentLen;
  }
  return { file: path.basename(file), size_mb: mb(buf.length), parts_mb: Object.fromEntries(Object.entries(parts).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, mb(v)])) };
}
const apkFile = arg("--apk");
const apk = apkFile ? zipBreakdown(apkFile) : null;

// ------------------------------------------------------------------ relatório
const estimate = mb(total) + (budget.native_estimate_mb ?? 0);
const report = {
  format: "mugen-arena-size/1",
  measured_at: new Date().toISOString(),
  export_dir: dir,
  export_total_mb: mb(total),
  js_bundle_mb: mb(bundle),
  assets_mb: mb(assetsTotal),
  assets_by_ext_mb: Object.fromEntries(Object.entries(byExt).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, mb(v)])),
  assets_by_origin_mb: Object.fromEntries(Object.entries(byGroup).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, mb(v)])),
  top_characters_mb: Object.fromEntries(topCharacters.map(([k, v]) => [k, mb(v)])),
  native_estimate_mb: budget.native_estimate_mb ?? null,
  download_estimate_mb: Math.round(estimate * 100) / 100,
  apk,
  budget,
};

const checks = [
  ["export (bundle + assets)", report.export_total_mb, budget.export_total_mb],
  ["bundle JS (Hermes)", report.js_bundle_mb, budget.js_bundle_mb],
  ["assets", report.assets_mb, budget.assets_mb],
  ["download estimado (export + nativo)", report.download_estimate_mb, budget.download_target_mb],
];
if (apk) checks.push([`${apk.file} (medido)`, apk.size_mb, budget.download_target_mb]);

console.log("\nTamanho do app (MB = MiB)");
for (const [k, v] of Object.entries({ "bundle JS": report.js_bundle_mb, ...Object.fromEntries(Object.entries(report.assets_by_origin_mb).map(([k2, v2]) => [`assets ${k2}`, v2])) }))
  console.log(`  ${k.padEnd(44)} ${String(v).padStart(8)}`);
console.log("  por tipo: " + Object.entries(report.assets_by_ext_mb).map(([k, v]) => `${k} ${v}`).join(" · "));
if (apk) console.log(`  ${apk.file}: ` + Object.entries(apk.parts_mb).slice(0, 8).map(([k, v]) => `${k} ${v}`).join(" · "));
console.log("");
let failed = false;
for (const [label, value, limit] of checks) {
  if (typeof limit !== "number") continue;
  const ok = value <= limit;
  failed ||= !ok;
  console.log(`${ok ? "ok  " : "FALHA"} ${label.padEnd(40)} ${String(value).padStart(8)} / ${limit} MB`);
}
if (budget.native_estimate_mb) console.log(`(nativo = ${budget.native_estimate_mb} MB estimados em size-budget.json, não medidos)`);

const jsonOut = arg("--json") ?? process.env.SIZE_JSON;
if (jsonOut) {
  mkdirSync(path.dirname(path.resolve(jsonOut)), { recursive: true });
  writeFileSync(jsonOut, JSON.stringify(report, null, 2) + "\n");
}
process.exit(failed ? 1 : 0);
