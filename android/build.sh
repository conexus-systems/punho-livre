#!/usr/bin/env bash
# Gera o APK do Punho Livre sem precisar do Android SDK.
# O jogo é Rust compilado para WebAssembly (rust/). Toda a arte e os sons são gerados por
# ele mesmo ao abrir, então o APK leva só a pasta web/ (index.html, style.css, fonts/ e
# pkg/ com a cola JavaScript e o .wasm em base64).
#
# Requisitos: Rust com o alvo wasm32-unknown-unknown e o wasm-bindgen-cli (ver tools/build-wasm.sh),
# Java 11+ (java, javac, keytool), Maven, Python 3, curl, unzip.
# As ferramentas vêm do Maven Central e ficam em cache em android/.tools:
#   - aapt2 e o framework Android, embutidos no apktool-lib
#   - smali (monta o classes.dex a partir de android/smali)
#   - apksig (assinatura v2, por isso o mínimo é Android 7.0 / API 24)
#
# Variáveis opcionais:
#   FORMAT         apk (padrão), aab (para a Play Store) ou both
#   TARGET_SDK     versão de destino do Android (padrão: 36, exigida pela Play Store em 2026)
#   OUT            caminho do APK (padrão: dist/punho-livre.apk)
#   KEYSTORE (PKCS12), KEYSTORE_PASS, KEY_ALIAS   para assinar com a sua chave
#   VERSION_CODE, VERSION_NAME
#   SKIP_WASM=1    não recompila o Rust (usa o web/pkg que já existe)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AND="$ROOT/android"
TOOLS="$AND/.tools"
BUILD="$AND/build"
OUT="${OUT:-$ROOT/dist/punho-livre.apk}"
APKTOOL_VERSION=3.0.3
VERSION_CODE="${VERSION_CODE:-30000}"
VERSION_NAME="${VERSION_NAME:-3.0.0}"
TARGET_SDK="${TARGET_SDK:-36}"
FORMAT="${FORMAT:-apk}"

mkdir -p "$TOOLS"
if [ ! -x "$TOOLS/aapt2" ]; then
  echo "Baixando aapt2 e framework Android (apktool-lib $APKTOOL_VERSION)..."
  curl -fsSL -o "$TOOLS/apktool-lib.jar" \
    "https://repo1.maven.org/maven2/org/apktool/apktool-lib/$APKTOOL_VERSION/apktool-lib-$APKTOOL_VERSION.jar"
  unzip -oqj "$TOOLS/apktool-lib.jar" prebuilt/linux/aapt2 prebuilt/android-framework.jar -d "$TOOLS"
  chmod +x "$TOOLS/aapt2"
  rm "$TOOLS/apktool-lib.jar"
fi
if [ ! -d "$TOOLS/lib" ]; then
  echo "Baixando smali e apksig..."
  mvn -q -f "$AND/tools/pom.xml" dependency:copy-dependencies -DoutputDirectory="$TOOLS/lib"
fi
CP="$TOOLS/lib/*"

rm -rf "$BUILD"
mkdir -p "$BUILD/assets" "$BUILD/res"

if [ "${SKIP_WASM:-0}" != 1 ]; then
  echo "Compilando o jogo (Rust -> WebAssembly)..."
  "$ROOT/tools/build-wasm.sh" release
fi
[ -f "$ROOT/web/pkg/punho_wasm.js" ] || { echo "web/pkg não existe: rode tools/build-wasm.sh" >&2; exit 1; }

echo "Empacotando o jogo..."
cp -r "$ROOT/web/." "$BUILD/assets/"
# a WebView lê o jogo de file:///android_asset, onde o fetch do .wasm não funciona: o app usa o base64
rm -f "$BUILD/assets/pkg/punho_bg.wasm" "$BUILD/assets/README.md"
cp -r "$AND/res/." "$BUILD/res/"

echo "Compilando recursos..."
"$TOOLS/aapt2" compile --dir "$BUILD/res" -o "$BUILD/res.zip"
link() { # link <saida> [flags extras]
  local out="$1"; shift
  "$TOOLS/aapt2" link -o "$out" "$@" \
    -I "$TOOLS/android-framework.jar" \
    --manifest "$AND/AndroidManifest.xml" \
    -A "$BUILD/assets" \
    --min-sdk-version 24 --target-sdk-version "$TARGET_SDK" \
    --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" \
    "$BUILD/res.zip"
}

echo "Montando classes.dex..."
java -cp "$CP" org.jf.smali.Main assemble --api 24 -o "$BUILD/classes.dex" "$AND/smali"

if [ -z "${KEYSTORE:-}" ]; then
  KEYSTORE="$TOOLS/punholivre.p12"
  KEYSTORE_PASS=android
  KEY_ALIAS=punholivre
  if [ ! -f "$KEYSTORE" ]; then
    echo "Criando chave de assinatura local..."
    keytool -genkeypair -storetype PKCS12 -keystore "$KEYSTORE" -storepass "$KEYSTORE_PASS" \
      -alias "$KEY_ALIAS" -keyalg RSA -keysize 2048 -validity 10000 \
      -dname "CN=Punho Livre, O=Conexus Systems, C=BR" 2> /dev/null
  fi
fi

build_apk() {
  link "$BUILD/base.apk"
  python3 "$AND/tools/package.py" "$BUILD/base.apk" "$BUILD/classes.dex" "$BUILD/aligned.apk"
  echo "Assinando o APK..."
  javac -d "$BUILD/sign" -cp "$CP" "$AND/tools/Sign.java"
  mkdir -p "$(dirname "$OUT")"
  java --add-exports java.base/sun.security.x509=ALL-UNNAMED --add-exports java.base/sun.security.pkcs=ALL-UNNAMED \
    -cp "$BUILD/sign:$CP" Sign "$BUILD/aligned.apk" "$OUT" "$KEYSTORE" "$KEYSTORE_PASS" "$KEY_ALIAS"
  python3 "$AND/tools/package.py" --check "$OUT"
  echo "Pronto: $OUT ($(du -h "$OUT" | cut -f1))"
}

build_aab() {
  local aab="${OUT_AAB:-${OUT%.apk}.aab}"
  link "$BUILD/base-proto.apk" --proto-format
  mkdir -p "$(dirname "$aab")"
  rm -f "$aab"
  local BT="$TOOLS/bundletool.jar"
  if [ ! -f "$BT" ]; then
    curl -fsSL -m 120 -o "$BT" "https://github.com/google/bundletool/releases/download/1.18.1/bundletool-all-1.18.1.jar" 2> /dev/null || rm -f "$BT"
  fi
  if [ -f "$BT" ]; then
    echo "Gerando o AAB com o bundletool..."
    python3 - "$BUILD" <<'PY'
import sys, zipfile
b = sys.argv[1]
with zipfile.ZipFile(b + '/base-proto.apk') as zin, zipfile.ZipFile(b + '/base.zip', 'w', zipfile.ZIP_DEFLATED) as zout:
    for i in zin.infolist():
        n = i.filename
        if n == 'AndroidManifest.xml': zout.writestr('manifest/AndroidManifest.xml', zin.read(n))
        elif n == 'resources.pb' or n.startswith(('res/', 'assets/')): zout.writestr(n, zin.read(n))
    zout.write(b + '/classes.dex', 'dex/classes.dex')
PY
    java -jar "$BT" build-bundle --modules="$BUILD/base.zip" --output="$aab"
  else
    echo "bundletool indisponível: montando o AAB com o script embutido (confira depois com 'bundletool validate')."
    python3 "$AND/tools/bundle.py" "$BUILD/base-proto.apk" "$BUILD/classes.dex" "$aab"
  fi
  echo "Assinando o AAB..."
  jarsigner -keystore "$KEYSTORE" -storepass "$KEYSTORE_PASS" -sigalg SHA256withRSA -digestalg SHA-256 "$aab" "$KEY_ALIAS" > /dev/null
  jarsigner -verify "$aab" > /dev/null
  echo "Pronto: $aab ($(du -h "$aab" | cut -f1))"
}

case "$FORMAT" in
  apk) build_apk ;;
  aab) build_aab ;;
  both) build_apk; build_aab ;;
  *) echo "FORMAT deve ser apk, aab ou both" >&2; exit 1 ;;
esac
