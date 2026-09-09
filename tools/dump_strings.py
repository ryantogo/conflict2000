import re, sys

path = sys.argv[1]
minlen = int(sys.argv[2]) if len(sys.argv) > 2 else 4
data = open(path, 'rb').read()
pat = re.compile(rb'[\x20-\x7e]{%d,}' % minlen)
for m in pat.finditer(data):
    print('%06x  %s' % (m.start(), m.group(0).decode('latin-1')))
