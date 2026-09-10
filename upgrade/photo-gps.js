// Read only JPEG EXIF GPS. All EXIF is discarded by canvas re-encoding afterwards.
export async function photoGPS(file) {
    try {
        const view = new DataView(await file.slice(0, 512 * 1024).arrayBuffer());
        if (view.getUint16(0) !== 0xffd8)
            return null;
        let o = 2;
        while (o + 4 < view.byteLength) {
            const marker = view.getUint16(o), size = view.getUint16(o + 2);
            if (size < 2 || o + 2 + size > view.byteLength)
                return null;
            if (marker === 0xffe1 && view.getUint32(o + 4) === 0x45786966) {
                const t = o + 10, end = o + 2 + size, little = view.getUint16(t) === 0x4949;
                if (!little && view.getUint16(t) !== 0x4d4d)
                    return null;
                const u16 = (n) => {
                    if (n < t || n + 2 > end)
                        throw Error();
                    return view.getUint16(n, little);
                }, u32 = (n) => {
                    if (n < t || n + 4 > end)
                        throw Error();
                    return view.getUint32(n, little);
                };
                if (u16(t + 2) !== 42)
                    return null;
                const root = t + u32(t + 4), count = u16(root);
                if (count > 300)
                    return null;
                let gps = 0;
                for (let i = 0; i < count; i++) {
                    const e = root + 2 + i * 12;
                    if (u16(e) === 0x8825)
                        gps = t + u32(e + 8);
                }
                if (!gps)
                    return null;
                const n = u16(gps);
                if (n > 100)
                    return null;
                const fields = {};
                for (let i = 0; i < n; i++) {
                    const e = gps + 2 + i * 12, tag = u16(e), type = u16(e + 2), num = u32(e + 4);
                    if ((tag === 1 || tag === 3) && type === 2 && num <= 4)
                        fields[tag] = String.fromCharCode(view.getUint8(e + 8));
                    if ((tag === 2 || tag === 4) && type === 5 && num === 3) {
                        const start = t + u32(e + 8);
                        let d = 0;
                        for (let j = 0; j < 3; j++) {
                            const den = u32(start + j * 8 + 4);
                            if (!den)
                                return null;
                            d += u32(start + j * 8) / den / [1, 60, 3600][j];
                        }
                        fields[tag] = d;
                    }
                }
                if (typeof fields[2] !== 'number' || typeof fields[4] !== 'number' || !['N', 'S'].includes(String(fields[1])) || !['E', 'W'].includes(String(fields[3])))
                    return null;
                const lat = fields[2] * (fields[1] === 'S' ? -1 : 1), lon = fields[4] * (fields[3] === 'W' ? -1 : 1);
                return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? [lat, lon] : null;
            }
            if (marker === 0xffda || marker === 0xffd9)
                return null;
            o += 2 + size;
        }
        return null;
    }
    catch {
        return null;
    }
}
