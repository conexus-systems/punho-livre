#!/usr/bin/env bash
# Gera dist/mugen-brawl.apk sem precisar do Android SDK.
#
# Requisitos: Java 11+ (java, javac, keytool), Maven, Node, Python 3, curl, unzip.
# As ferramentas vêm do Maven Central e ficam em cache em android/.tools:
#   - aapt2 e o framework Android, embutidos no apktool-lib
#   - smali (monta o classes.dex a partir de android/smali)
#   - apksig (assinatura v2, por isso o mínimo é Android 7.0 / API 24)
#
# Variáveis opcionais para assinar com a sua chave:
#   KEYSTORE (PKCS12), KEYSTORE_PASS, KEY_ALIAS
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AND="$ROOT/android"
TOOLS="$AND/.tools"
BUILD="$AND/build"
APKTOOL_VERSION=3.0.3
VERSION_CODE="${VERSION_CODE:-1}"
VERSION_NAME="${VERSION_NAME:-1.0}"

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
mkdir -p "$BUILD/assets"

echo "Empacotando o jogo..."
node "$ROOT/tools/build.mjs" --android "$BUILD/assets" > /dev/null

echo "Compilando recursos..."
"$TOOLS/aapt2" compile --dir "$AND/res" -o "$BUILD/res.zip"
"$TOOLS/aapt2" link -o "$BUILD/base.apk" \
  -I "$TOOLS/android-framework.jar" \
  --manifest "$AND/AndroidManifest.xml" \
  -A "$BUILD/assets" \
  --min-sdk-version 24 --target-sdk-version 34 \
  --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" \
  "$BUILD/res.zip"

echo "Montando classes.dex..."
java -cp "$CP" org.jf.smali.Main assemble --api 24 -o "$BUILD/classes.dex" "$AND/smali"

python3 "$AND/tools/package.py" "$BUILD/base.apk" "$BUILD/classes.dex" "$BUILD/aligned.apk"

if [ -z "${KEYSTORE:-}" ]; then
  KEYSTORE="$TOOLS/debug.p12"
  KEYSTORE_PASS=android
  KEY_ALIAS=mugen
  if [ ! -f "$KEYSTORE" ]; then
    echo "Criando chave de assinatura local..."
    keytool -genkeypair -storetype PKCS12 -keystore "$KEYSTORE" -storepass "$KEYSTORE_PASS" \
      -alias "$KEY_ALIAS" -keyalg RSA -keysize 2048 -validity 10000 \
      -dname "CN=Mugen Brawl, O=tantoniazi, C=BR" 2> /dev/null
  fi
fi

echo "Assinando..."
javac -d "$BUILD/sign" -cp "$CP" "$AND/tools/Sign.java"
mkdir -p "$ROOT/dist"
java --add-exports java.base/sun.security.x509=ALL-UNNAMED --add-exports java.base/sun.security.pkcs=ALL-UNNAMED \
  -cp "$BUILD/sign:$CP" Sign "$BUILD/aligned.apk" "$ROOT/dist/mugen-brawl.apk" "$KEYSTORE" "$KEYSTORE_PASS" "$KEY_ALIAS"
python3 "$AND/tools/package.py" --check "$ROOT/dist/mugen-brawl.apk"
echo "Pronto: dist/mugen-brawl.apk ($(du -h "$ROOT/dist/mugen-brawl.apk" | cut -f1))"
