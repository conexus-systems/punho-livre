"""Reescreve o APK alinhando entradas não comprimidas em 4 bytes (como o zipalign).

Uso:
  package.py <base.apk> <classes.dex> <saida.apk>   adiciona o classes.dex e alinha
  package.py --check <arquivo.apk>                   só confere o alinhamento
"""
import sys
import zipfile


def check(path):
    with zipfile.ZipFile(path) as z:
        for info in z.infolist():
            if info.compress_type == zipfile.ZIP_STORED:
                with open(path, 'rb') as f:
                    f.seek(info.header_offset + 26)
                    n, m = int.from_bytes(f.read(2), 'little'), int.from_bytes(f.read(2), 'little')
                start = info.header_offset + 30 + n + m
                if start % 4:
                    sys.exit(f'Entrada desalinhada: {info.filename}')


def rewrite(src, dst, dex=None):
    with zipfile.ZipFile(src) as zin, zipfile.ZipFile(dst, 'w') as zout:
        def add(name, data, ctype, date=(2008, 1, 1, 0, 0, 0)):
            zi = zipfile.ZipInfo(name, date_time=date)
            zi.compress_type = ctype
            if ctype == zipfile.ZIP_STORED:
                offset = zout.fp.tell() + 30 + len(name.encode())
                zi.extra = b'\0' * ((-offset) % 4)
            zout.writestr(zi, data)

        for info in zin.infolist():
            add(info.filename, zin.read(info.filename), info.compress_type, info.date_time)
        if dex:
            with open(dex, 'rb') as f:
                add('classes.dex', f.read(), zipfile.ZIP_DEFLATED)
    check(dst)


if sys.argv[1] == '--check':
    check(sys.argv[2])
else:
    rewrite(sys.argv[1], sys.argv[3], dex=sys.argv[2])
