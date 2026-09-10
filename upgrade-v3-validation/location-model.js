import { hasCoordinates } from './bin-model.js';
export function validLocationPoint(p) {
    return Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180;
}
export function freshLocation(bin = null) {
    return { point: bin && hasCoordinates(bin) ? [bin.latitude, bin.longitude] : null,
        source: bin ? 'bin' : '', binId: bin?.id || '', address: bin?.address || '', addressKind: bin ? 'bin' : 'auto',
        region: null, status: 'idle', message: '', gps: 'idle', conflict: null, manual: !bin?.address, showMap: false,
        locating: false, accuracy: null, version: '' };
}
export function canContinueLocation(s) {
    return s.address.trim().length >= 3 && s.address.trim().length <= 200 && !s.conflict
        && !s.locating && (!s.point || validLocationPoint(s.point));
}
