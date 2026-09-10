// Extract coordinates only, before privacy masking / canvas re-encoding.
// Supported metadata containers: JPEG APP1, PNG eXIf, WebP EXIF.
// All malformed, absent or unsupported EXIF falls back to manual location.
function tiffGPS(view, start, end) {
    try {
        if (start + 8 > end)
            return null;
        const byteOrder = view.getUint16(start);
        if (![0x4949, 0x4d4d].includes(byteOrder))
            return null;
        const little = byteOrder === 0x4949;
        const check = (p, n) => { if (p < start || p + n > end)
            throw Error('EXIF bounds'); };
        const u16 = p => { check(p, 2); return view.getUint16(p, little); };
        const u32 = p => { check(p, 4); return view.getUint32(p, little); };
        if (u16(start + 2) !== 42)
            return null;
        const offset = u32(start + 4);
        if (offset < 8)
            return null;
        const root = start + offset, count = u16(root);
        if (count > 500)
            return null;
        check(root + 2, count * 12);
        let gps = 0;
        for (let i = 0; i < count; i++) {
            const entry = root + 2 + i * 12;
            if (u16(entry) === 0x8825 && u16(entry + 2) === 4 && u32(entry + 4) === 1)
                gps = start + u32(entry + 8);
        }
        if (!gps)
            return null;
        const n = u16(gps);
        if (n > 100)
            return null;
        check(gps + 2, n * 12);
        const fields = {};
        for (let i = 0; i < n; i++) {
            const e = gps + 2 + i * 12, tag = u16(e), type = u16(e + 2), num = u32(e + 4);
            if ((tag === 1 || tag === 3) && type === 2 && num >= 1 && num <= 4)
                fields[tag] = String.fromCharCode(view.getUint8(e + 8));
            if ((tag === 2 || tag === 4) && type === 5 && num === 3) {
                const at = start + u32(e + 8);
                check(at, 24);
                const dms = [];
                for (let j = 0; j < 3; j++) {
                    const denominator = u32(at + j * 8 + 4);
                    if (!denominator)
                        return null;
                    dms.push(u32(at + j * 8) / denominator);
                }
                if (dms[1] >= 60 || dms[2] >= 60)
                    return null;
                fields[tag] = dms[0] + dms[1] / 60 + dms[2] / 3600;
            }
        }
        if (!Number.isFinite(fields[2]) || !Number.isFinite(fields[4]) || !['N', 'S'].includes(fields[1]) || !['E', 'W'].includes(fields[3]))
            return null;
        const lat = fields[2] * (fields[1] === 'S' ? -1 : 1), lon = fields[4] * (fields[3] === 'W' ? -1 : 1);
        return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? [lat, lon] : null;
    }
    catch {
        return null;
    }
}
function exifBlock(v, start, end) {
    if (start + 6 <= end && v.getUint32(start) === 0x45786966 && v.getUint16(start + 4) === 0)
        start += 6;
    return tiffGPS(v, start, end);
}
export async function photoGPS(file) {
    try {
        if (!(file instanceof Blob) || file.size < 8 || file.size > 15 * 1024 * 1024)
            return null;
        const v = new DataView(await file.arrayBuffer()), end = v.byteLength;
        if (v.getUint16(0) === 0xffd8) {
            let o = 2;
            while (o + 4 <= end) {
                if (v.getUint8(o) !== 0xff)
                    return null;
                while (o + 1 < end && v.getUint8(o + 1) === 0xff)
                    o++;
                const marker = v.getUint8(o + 1);
                if (marker === 0xda || marker === 0xd9)
                    return null;
                if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
                    o += 2;
                    continue;
                }
                const size = v.getUint16(o + 2);
                if (size < 2 || o + 2 + size > end)
                    return null;
                if (marker === 0xe1 && size >= 8 && v.getUint32(o + 4) === 0x45786966 && v.getUint16(o + 8) === 0) {
                    const gps = tiffGPS(v, o + 10, o + 2 + size);
                    if (gps)
                        return gps;
                }
                o += 2 + size;
            }
        }
        else if (v.getUint32(0) === 0x89504e47 && v.getUint32(4) === 0x0d0a1a0a) {
            let o = 8;
            while (o + 12 <= end) {
                const size = v.getUint32(o), tag = v.getUint32(o + 4), next = o + 12 + size;
                if (next > end)
                    return null;
                if (tag === 0x65584966) {
                    const gps = exifBlock(v, o + 8, o + 8 + size);
                    if (gps)
                        return gps;
                }
                if (tag === 0x49454e44)
                    break;
                o = next;
            }
        }
        else if (end >= 12 && v.getUint32(0) === 0x52494646 && v.getUint32(8) === 0x57454250) {
            const limit = Math.min(end, v.getUint32(4, true) + 8);
            let o = 12;
            while (o + 8 <= limit) {
                const size = v.getUint32(o + 4, true), next = o + 8 + size;
                if (next > limit)
                    return null;
                if (v.getUint32(o) === 0x45584946) {
                    const gps = exifBlock(v, o + 8, next);
                    if (gps)
                        return gps;
                }
                o = next + (size % 2);
            }
        }
        return null;
    }
    catch {
        return null;
    }
}
