import os, struct, zlib, sys

D = r'C:\Users\ryant\Documents\conflict\conflict'
OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)

EGA = [
    (0, 0, 0), (0, 0, 170), (0, 170, 0), (0, 170, 170),
    (170, 0, 0), (170, 0, 170), (170, 85, 0), (170, 170, 170),
    (85, 85, 85), (85, 85, 255), (85, 255, 85), (85, 255, 255),
    (255, 85, 85), (255, 85, 255), (255, 255, 85), (255, 255, 255),
]


def write_png(path, w, h, rgb_rows):
    raw = b''.join(b'\x00' + bytes(r) for r in rgb_rows)
    def chunk(t, d):
        c = struct.pack('>I', len(d)) + t + d
        return c + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw, 9))
    png += chunk(b'IEND', b'')
    open(path, 'wb').write(png)


def render_mp(name):
    b = open(os.path.join(D, name), 'rb').read()
    recs = []
    for i in range(0, len(b) - 4, 5):
        col = b[i]
        x = b[i+1] | (b[i+2] << 8)
        y = b[i+3] | (b[i+4] << 8)
        recs.append((col, x, y))
    maxx = max(r[1] for r in recs)
    maxy = max(r[2] for r in recs)
    W, H = maxx + 2, maxy + 2
    grid = [[0] * W for _ in range(H)]
    # group by y, spans run from x to next x on same scanline
    by_y = {}
    for col, x, y in recs:
        by_y.setdefault(y, []).append((x, col))
    for y, spans in by_y.items():
        spans.sort()
        for j, (x, col) in enumerate(spans):
            xe = spans[j+1][0] if j + 1 < len(spans) else x + 1
            for xx in range(x, min(xe, W)):
                grid[y][xx] = col
    rows = []
    for y in range(H):
        row = bytearray()
        for x in range(W):
            row += bytes(EGA[grid[y][x] & 15])
        rows.append(row)
    p = os.path.join(OUT, name.replace('.MP', '') + '_map.png')
    write_png(p, W, H, rows)
    print('%-14s %dx%d  recs=%d  colors=%s' % (
        name, W, H, len(recs), sorted({r[0] for r in recs})))


def render_dat(name, w):
    b = open(os.path.join(D, name), 'rb').read()
    h = len(b) * 8 // w
    rows = []
    for y in range(h):
        row = bytearray()
        for x in range(w):
            byte = b[(y * w + x) // 8]
            bit = (byte >> (7 - (x % 8))) & 1
            v = 255 if bit else 0
            row += bytes((v, v, v))
        rows.append(row)
    p = os.path.join(OUT, name.replace('.DAT', '') + '_%d.png' % w)
    write_png(p, w, h, rows)
    print('%-14s %dx%d' % (name, w, h))


for f in sorted(os.listdir(D)):
    if f.endswith('.MP'):
        render_mp(f)

for w in (160, 200, 320):
    render_dat('M1.DAT', w)
