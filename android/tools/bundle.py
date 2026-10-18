"""Monta o módulo base de um Android App Bundle (.aab) a partir da saída do aapt2.

Uso: bundle.py <base-proto.apk> <classes.dex> <saida.aab> [versão-do-bundletool]

O bundletool oficial faz o mesmo e mais (validações, divisão por ABI/densidade).
Este script existe para o build funcionar sem baixar o bundletool; quando o
bundletool está disponível, o build.sh o usa no lugar deste script.
"""
import sys
import zipfile


def varint(n):
    out = bytearray()
    while True:
        b = n & 0x7F
        n >>= 7
        if n:
            out.append(b | 0x80)
        else:
            out.append(b)
            return bytes(out)


def field_bytes(num, payload):
    return varint((num << 3) | 2) + varint(len(payload)) + payload


def bundle_config(version):
    # BundleConfig { Bundletool bundletool = 1 { string version = 2 } }
    return field_bytes(1, field_bytes(2, version.encode()))


def main():
    apk, dex, out = sys.argv[1:4]
    version = sys.argv[4] if len(sys.argv) > 4 else '1.17.2'
    with zipfile.ZipFile(apk) as zin, zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as zout:
        zout.writestr('BundleConfig.pb', bundle_config(version))
        for info in zin.infolist():
            name = info.filename
            if name == 'AndroidManifest.xml':
                dest = 'base/manifest/AndroidManifest.xml'
            elif name == 'resources.pb' or name.startswith(('res/', 'assets/')):
                dest = 'base/' + name
            else:
                continue
            zout.writestr(dest, zin.read(name))
        with open(dex, 'rb') as f:
            zout.writestr('base/dex/classes.dex', f.read())


main()
