#!/usr/bin/env python3
"""
Builds the embedded PDF font for FiberModeler.

Takes a TrueType font and produces a reduced copy that keeps only the glyphs
used by the interface languages (Latin + Cyrillic + punctuation + a few
symbols).  Glyph ids are preserved (no renumbering), unused glyphs become
empty, which keeps the file small while staying a valid TTF.

Usage:
    python3 tools/subset_font.py /usr/share/fonts/truetype/dejavu/DejaVuSans.ttf \
        app/assets/fonts/fibersans.js
"""
import base64
import json
import struct
import sys


def read_tables(data):
    num_tables = struct.unpack(">H", data[4:6])[0]
    tables = {}
    for i in range(num_tables):
        offset = 12 + i * 16
        tag, checksum, off, length = struct.unpack(">4sIII", data[offset:offset + 16])
        tables[tag.decode("latin-1")] = (off, length)
    return tables


def table(data, tables, tag):
    if tag not in tables:
        return b""
    off, length = tables[tag]
    return data[off:off + length]


def parse_cmap(data):
    """Returns {codepoint: glyph_id} from format 4 and format 12 subtables."""
    mapping = {}
    num = struct.unpack(">H", data[2:4])[0]
    subtables = []
    for i in range(num):
        platform, encoding, offset = struct.unpack(">HHI", data[4 + i * 8:12 + i * 8])
        subtables.append((platform, encoding, offset))
    for platform, encoding, offset in subtables:
        fmt = struct.unpack(">H", data[offset:offset + 2])[0]
        if fmt == 4:
            seg_x2 = struct.unpack(">H", data[offset + 6:offset + 8])[0]
            seg = seg_x2 // 2
            ends = struct.unpack(">%dH" % seg, data[offset + 14:offset + 14 + seg_x2])
            starts_off = offset + 16 + seg_x2
            starts = struct.unpack(">%dH" % seg, data[starts_off:starts_off + seg_x2])
            deltas_off = starts_off + seg_x2
            deltas = struct.unpack(">%dh" % seg, data[deltas_off:deltas_off + seg_x2])
            ranges_off = deltas_off + seg_x2
            ranges = struct.unpack(">%dH" % seg, data[ranges_off:ranges_off + seg_x2])
            for i in range(seg):
                for code in range(starts[i], min(ends[i], 0xFFFF) + 1):
                    if ranges[i] == 0:
                        gid = (code + deltas[i]) & 0xFFFF
                    else:
                        gi_off = ranges_off + i * 2 + ranges[i] + (code - starts[i]) * 2
                        if gi_off + 2 > len(data):
                            continue
                        gid = struct.unpack(">H", data[gi_off:gi_off + 2])[0]
                        if gid:
                            gid = (gid + deltas[i]) & 0xFFFF
                    if gid:
                        mapping.setdefault(code, gid)
        elif fmt == 12:
            ngroups = struct.unpack(">I", data[offset + 12:offset + 16])[0]
            for i in range(ngroups):
                s, e, gid = struct.unpack(">III", data[offset + 16 + i * 12:offset + 28 + i * 12])
                for code in range(s, min(e, 0x2FFFF) + 1):
                    mapping.setdefault(code, gid + (code - s))
    return mapping


def wanted_codepoints():
    codes = set()
    codes.update(range(0x20, 0x7F))            # basic latin
    codes.update(range(0xA0, 0x180))           # latin-1 + latin extended A
    codes.update(range(0x400, 0x460))          # cyrillic
    codes.update([0x490, 0x491, 0x2010, 0x2011, 0x2012, 0x2013, 0x2014, 0x2018, 0x2019,
                  0x201C, 0x201D, 0x201E, 0x2020, 0x2022, 0x2026, 0x2030, 0x2039, 0x203A,
                  0x20AC, 0x2116, 0x2190, 0x2191, 0x2192, 0x2193, 0x21B5, 0x2212, 0x2248,
                  0x2260, 0x2264, 0x2265, 0x25A0, 0x25B6, 0x25C0, 0x2713, 0x2714, 0x2717,
                  0x00B0, 0x00B1, 0x00D7, 0x00F7, 0x2022])
    return codes


def composite_components(glyph_data):
    """Glyph ids referenced by a composite glyph."""
    if len(glyph_data) < 10:
        return []
    num_contours = struct.unpack(">h", glyph_data[0:2])[0]
    if num_contours >= 0:
        return []
    out = []
    pos = 10
    while True:
        if pos + 4 > len(glyph_data):
            break
        flags, glyph_index = struct.unpack(">HH", glyph_data[pos:pos + 4])
        out.append(glyph_index)
        pos += 4
        pos += 4 if flags & 0x0001 else 2      # ARG_1_AND_2_ARE_WORDS
        if flags & 0x0008:
            pos += 2                            # WE_HAVE_A_SCALE
        elif flags & 0x0040:
            pos += 4                            # X_AND_Y_SCALE
        elif flags & 0x0080:
            pos += 8                            # TWO_BY_TWO
        if not flags & 0x0020:                  # MORE_COMPONENTS
            break
    return out


def build(font_path, out_path):
    data = open(font_path, "rb").read()
    tables = read_tables(data)
    head = bytearray(table(data, tables, "head"))
    maxp = bytearray(table(data, tables, "maxp"))
    hhea = bytearray(table(data, tables, "hhea"))
    hmtx = table(data, tables, "hmtx")
    glyf = table(data, tables, "glyf")
    loca_raw = table(data, tables, "loca")
    os2 = bytearray(table(data, tables, "OS/2"))

    units_per_em = struct.unpack(">H", head[18:20])[0]
    index_to_loc = struct.unpack(">h", head[50:52])[0]
    num_glyphs = struct.unpack(">H", maxp[4:6])[0]
    num_h_metrics = struct.unpack(">H", hhea[34:36])[0]

    if index_to_loc == 0:
        loca = [v * 2 for v in struct.unpack(">%dH" % (len(loca_raw) // 2), loca_raw)]
    else:
        loca = list(struct.unpack(">%dI" % (len(loca_raw) // 4), loca_raw))

    cmap = parse_cmap(table(data, tables, "cmap"))
    codes = {c: cmap[c] for c in sorted(wanted_codepoints()) if c in cmap}

    needed = {0}
    stack = list(codes.values())
    while stack:
        gid = stack.pop()
        if gid in needed or gid >= num_glyphs:
            continue
        needed.add(gid)
        start, end = loca[gid], loca[gid + 1]
        for comp in composite_components(glyf[start:end]):
            if comp not in needed:
                stack.append(comp)

    max_gid = max(needed) + 1

    def advance(gid):
        if gid < num_h_metrics:
            return struct.unpack(">H", hmtx[gid * 4:gid * 4 + 2])[0]
        if num_h_metrics == 0:
            return 0
        return struct.unpack(">H", hmtx[(num_h_metrics - 1) * 4:(num_h_metrics - 1) * 4 + 2])[0]

    # ---- glyf + loca ----
    new_glyf = bytearray()
    new_loca = [0]
    for gid in range(max_gid):
        if gid in needed:
            start, end = loca[gid], loca[gid + 1]
            chunk = glyf[start:end]
            if len(chunk) % 4:
                chunk = chunk + b"\0" * (4 - len(chunk) % 4)
            new_glyf += chunk
        new_loca.append(len(new_glyf))

    # ---- hmtx ----
    new_hmtx = bytearray()
    for gid in range(max_gid):
        lsb = 0
        if gid < num_h_metrics:
            lsb = struct.unpack(">h", hmtx[gid * 4 + 2:gid * 4 + 4])[0]
        new_hmtx += struct.pack(">Hh", advance(gid), lsb)

    # ---- cmap (format 4) ----
    segments = []
    for code in sorted(codes):
        gid = codes[code]
        if segments and segments[-1][1] == code - 1 and segments[-1][2] + (code - segments[-1][0]) == gid:
            segments[-1] = (segments[-1][0], code, segments[-1][2])
        else:
            segments.append((code, code, gid))
    segments = [s for s in segments if s[0] <= 0xFFFF]
    segments.append((0xFFFF, 0xFFFF, 0))
    seg_count = len(segments)
    ends, starts, deltas, ranges = [], [], [], []
    for start, end, gid in segments:
        starts.append(start)
        ends.append(min(end, 0xFFFF))
        deltas.append((gid - start) & 0xFFFF if start != 0xFFFF else 1)
        ranges.append(0)
    sub = struct.pack(">HHHHHHH", 4, 16 + seg_count * 8, 0, seg_count * 2,
                      2 ** (seg_count.bit_length() - 1) * 2,
                      seg_count.bit_length() - 1,
                      seg_count * 2 - 2 ** (seg_count.bit_length() - 1) * 2)
    sub += struct.pack(">%dH" % seg_count, *ends)
    sub += struct.pack(">H", 0)
    sub += struct.pack(">%dH" % seg_count, *starts)
    sub += struct.pack(">%dh" % seg_count, *[d - 0x10000 if d > 0x7FFF else d for d in deltas])
    sub += struct.pack(">%dH" % seg_count, *ranges)
    new_cmap = struct.pack(">HHHHI", 0, 1, 3, 1, 12) + sub

    # ---- updated headers ----
    struct.pack_into(">h", head, 50, 1)                 # long loca
    struct.pack_into(">H", maxp, 4, max_gid)
    struct.pack_into(">H", hhea, 34, max_gid)
    new_post = struct.pack(">IIhhIIIII", 0x00030000, 0, 0, 0, 0, 0, 0, 0, 0)

    out_tables = {
        "OS/2": bytes(os2),
        "cmap": new_cmap,
        "glyf": bytes(new_glyf),
        "head": bytes(head),
        "hhea": bytes(hhea),
        "hmtx": bytes(new_hmtx),
        "loca": struct.pack(">%dI" % len(new_loca), *new_loca),
        "maxp": bytes(maxp),
        "name": table(data, tables, "name"),
        "post": new_post,
    }
    out_tables = {k: v for k, v in out_tables.items() if v}

    tags = sorted(out_tables)
    count = len(tags)
    search_range = 2 ** (count.bit_length() - 1) * 16
    header = struct.pack(">IHHHH", 0x00010000, count, search_range,
                         count.bit_length() - 1, count * 16 - search_range)
    offset = 12 + count * 16
    records = b""
    body = b""
    for tag in tags:
        payload = out_tables[tag]
        padded = payload + b"\0" * ((4 - len(payload) % 4) % 4)
        checksum = sum(struct.unpack(">%dI" % (len(padded) // 4), padded)) & 0xFFFFFFFF
        records += struct.pack(">4sIII", tag.encode("latin-1"), checksum, offset, len(payload))
        body += padded
        offset += len(padded)
    font = header + records + body

    ascent = struct.unpack(">h", hhea[4:6])[0]
    descent = struct.unpack(">h", hhea[6:8])[0]
    x_min, y_min, x_max, y_max = struct.unpack(">hhhh", head[36:44])

    payload = {
        "name": "FiberSans",
        "unitsPerEm": units_per_em,
        "ascent": ascent,
        "descent": descent,
        "bbox": [x_min, y_min, x_max, y_max],
        "capHeight": int(units_per_em * 0.72),
        "numGlyphs": max_gid,
        "gid": {str(c): g for c, g in codes.items()},
        "widths": {str(c): advance(g) for c, g in codes.items()},
    }
    js = (
        "// Generated by tools/subset_font.py - do not edit by hand.\n"
        "// Subset of DejaVu Sans (public domain / Bitstream Vera license) used to embed\n"
        "// real vector text with Cyrillic support into exported PDF files.\n"
        "export const FIBER_SANS = %s;\n"
        "export const FIBER_SANS_TTF_BASE64 = '%s';\n"
    ) % (json.dumps(payload, ensure_ascii=False, separators=(",", ":")), base64.b64encode(font).decode("ascii"))
    open(out_path, "w", encoding="utf-8").write(js)
    print("glyphs kept: %d / %d, font %d bytes, module %d bytes" %
          (len(needed), num_glyphs, len(font), len(js)))


if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    dst = sys.argv[2] if len(sys.argv) > 2 else "app/assets/fonts/fibersans.js"
    build(src, dst)
