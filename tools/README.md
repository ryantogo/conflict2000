# Tools

Scripts used to reverse-engineer the 1990 original, kept because the asset
formats are not documented anywhere else and you may want the art later.

Point them at the original game directory (`../../conflict`).

## `decode_assets.py`

```bash
python tools/decode_assets.py out/
```

Decodes both original binary formats and writes PNGs.

**`*.MP` — maps.** A flat list of 5-byte records, little-endian:

| offset | size | meaning                                 |
| ------ | ---- | --------------------------------------- |
| 0      | 1    | EGA colour index (0–15)                 |
| 1      | 2    | x, start of the span                    |
| 3      | 2    | y, scanline                             |

Each record starts a horizontal span that runs until the next record on the
same scanline, or one pixel if it is the last. The canvas is 640×350 — EGA
mode 10h. Text labels on the maps are drawn as spans too, so they decode as
part of the image rather than as strings.

Six maps ship with the game: `MDLEAST`, `ISRAEL`, `SYRIA`, `IRAQ`, `IRAQ1`,
`LIBYA`.

**`*.DAT` — unit art.** 4000 bytes of 1-bit-per-pixel bitmap, 160×200, MSB
first, no header. Each file holds a line drawing of the vehicle over a filled
silhouette of the same. Twenty of them, one per item in the 1980s arms
catalogue.

**`*.FNT` — fonts.** Not decoded. Small (486–1152 bytes), almost certainly
packed bitmap glyph sets.

## `dump_strings.py`

```bash
python tools/dump_strings.py ../conflict/Conflict.exe 5
```

Prints printable-ASCII runs with file offsets. The executable is a Zortech C
4.00 DOS binary and its whole data segment — menus, headlines, ladders,
newspaper mastheads, endings — sits in the clear from about `0x14700`.

## `reference/` (not in the repo)

Running the two scripts above against your own copy of the original produces
`manual-1990.txt` and `exe-strings-1990.txt` in `tools/reference/`. That
directory is gitignored: it is verbatim Virgin Mastertronic text and not ours
to redistribute. Everything needed to regenerate it is here.

The string dump is the primary source for the descriptive ladders in
`src/engine/ladders.ts` and the headline templates in `src/data/headlines.ts`.
See `../DESIGN.md` for what was carried across and what was changed.
