import { getRuntime } from './runtime.js';
import { loadPublicData } from './catalog.js';
import { categories } from './report-types.js';
import { distanceMeters } from './keeper-features.js';
import { hasCoordinates } from './bin-model.js';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KEY = /^[a-zA-Z0-9_-]{1,100}$/;
const stamp = () => ({ '.sv': 'timestamp' });
class RequestError extends Error {
    constructor(status, message) { super(message); this.status = status; }
}
const publicReport = (r, uid) => { const { owner_id, events, ...p } = r; return { ...p, latitude: r.latitude ?? null, longitude: r.longitude ?? null, isMine: owner_id === uid }; };
async function identity() { const B = getRuntime(); await B.authReady; const uid = B.auth.currentUser?.uid; if (!uid)
    throw new RequestError(401, '로그인 후 이용해 주세요.'); if (!navigator.onLine)
    throw new RequestError(503, '인터넷 연결을 확인해 주세요. 아직 서버에 저장되지 않았어요.'); return { B, uid }; }
async function createReport(options) {
    const { B, uid } = await identity(), { get, ref, update } = B.fb;
    const f = options.body;
    if (!(f instanceof FormData))
        throw new RequestError(400, '사진과 내용을 확인해 주세요.');
    const rid = String(f.get('id') || '');
    if (!UUID.test(rid))
        throw new RequestError(400, '제보 번호가 올바르지 않아요.');
    const prior = await get(ref(B.db, `${B.ROOT}/reports/${rid}`));
    if (prior.exists()) {
        if (prior.val().owner_id !== uid)
            throw new RequestError(403, '다시 시도해 주세요.');
        return Response.json({ report: publicReport(prior.val(), uid) });
    }
    const address = String(f.get('address') || '').trim(), description = String(f.get('description') || '').trim(), category = String(f.get('category') || ''), kind = String(f.get('kind') || 'observation');
    if (address.length < 3 || address.length > 200 || description.length > 1200 || !Object.hasOwn(categories, category) || !['observation', 'maintenance'].includes(kind) || f.get('consent') !== 'true')
        throw new RequestError(400, '제보 내용과 공개 동의를 확인해 주세요.');
    let issues;
    try {
        issues = JSON.parse(String(f.get('issues') || '{}'));
    }
    catch {
        throw new RequestError(400, '상태 선택을 확인해 주세요.');
    }
    if (!issues || Array.isArray(issues) || typeof issues !== 'object' || Object.entries(issues).some(([k, v]) => !['overflow', 'dumping', 'damage', 'no_label'].includes(k) || typeof v !== 'boolean'))
        throw new RequestError(400, '상태 선택을 확인해 주세요.');
    if (kind === 'maintenance' && (category !== 'normal' || Object.values(issues).some(Boolean) || f.get('maintenance_confirmed') !== 'true'))
        throw new RequestError(400, '정비 완료는 현장에서 양호 상태를 확인한 뒤 기록해 주세요.');
    const latitude = f.has('latitude') ? Number(f.get('latitude')) : null, longitude = f.has('longitude') ? Number(f.get('longitude')) : null;
    if ((latitude === null) !== (longitude === null) || (latitude !== null && (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180)))
        throw new RequestError(400, '위치 좌표를 확인해 주세요.');
    const all = Object.values((await get(ref(B.db, `${B.ROOT}/reports`))).val() || {});
    const requested = String(f.get('bin_id') || '');
    let bin_id = rid;
    if (requested) {
        if (!KEY.test(requested))
            throw new RequestError(400, '수거함 번호를 확인해 주세요.');
        let found;
        if (requested.startsWith('public-'))
            found = (await loadPublicData()).bins.find(b => b.id === requested);
        else {
            found = all.find(r => (r.bin_id || r.id) === requested);
            if (!found)
                found = (await get(ref(B.db, `${B.ROOT}/registry/${requested}`))).val();
            if (!found)
                found = (await get(ref(B.db, `${B.ROOT}/citizenBins/${requested}`))).val();
        }
        if (!found)
            throw new RequestError(409, '연결할 수거함을 다시 선택해 주세요.');
        if (hasCoordinates(found) && (latitude === null || distanceMeters([latitude, longitude], [found.latitude, found.longitude]) > 50))
            throw new RequestError(400, '선택한 수거함과 위치가 50m 이상 다르거나 위치가 지워졌어요. 수거함 연결을 다시 확인해 주세요.');
        bin_id = requested;
    }
    else if (kind === 'maintenance')
        throw new RequestError(400, '정비 이력을 남길 수거함을 선택해 주세요.');
    const photo = f.get('photo');
    if (!(photo instanceof Blob) || !photo.size || photo.size > 4 * 1024 * 1024)
        throw new RequestError(400, '확인한 현장 사진을 선택해 주세요.');
    const data = await B.photoData(photo);
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
    const photo_hash = [...new Uint8Array(hash)].map(x => x.toString(16).padStart(2, '0')).join('');
    if (all.some(r => r.owner_id === uid && r.photo_hash === photo_hash))
        throw new RequestError(409, '이미 올린 사진이에요. 정비 후 새로 찍은 사진을 올리거나 기존 제보를 확인해 주세요.');
    if (options.signal?.aborted)
        throw new DOMException('Aborted', 'AbortError');
    const status = kind === 'maintenance' ? 'resolved' : 'reported', eid = crypto.randomUUID();
    const record = { id: rid, owner_id: uid, address, description, category, issues, bin_id, photo_hash, kind, status, latitude, longitude, analysis: kind === 'maintenance' ? '직접 분류' : f.get('analysis') === 'clip' ? 'CLIP 제안 · 사용자 확인' : '직접 분류', created_at: stamp(), updated_at: stamp(), revision: 1, events: { [eid]: { id: eid, status, kind: 'status', created_at: stamp() } } };
    const changes = { [`reports/${rid}`]: record, [`photos/${rid}`]: { owner_id: uid, data } };
    if (bin_id === rid)
        changes[`citizenBins/${rid}`] = { id: rid, owner_id: uid, address, latitude, longitude, created_at: stamp() };
    await update(ref(B.db, B.ROOT), changes);
    const saved = await get(ref(B.db, `${B.ROOT}/reports/${rid}`));
    if (!saved.exists())
        throw new RequestError(503, '저장 결과를 확인하지 못했어요. 같은 요청으로 다시 확인해 주세요.');
    return Response.json({ report: publicReport(saved.val(), uid) }, { status: 201 });
}
export async function apiRequest(path, options = {}) { try {
    const u = new URL(path, location.origin), method = (options.method || 'GET').toUpperCase();
    if (u.pathname === '/api/reports' && method === 'POST')
        return await createReport(options);
    return await getRuntime().OriginalAPI(path, options);
}
catch (e) {
    if (e.name === 'AbortError')
        throw e;
    return Response.json({ error: e.status ? e.message : getRuntime().firebaseMessage(e) }, { status: e.status || 503 });
} }
export async function featureRequest(path, options) { const r = await apiRequest('/api/features/' + path, options), d = await r.json(); if (!r.ok)
    throw new Error(d.error || '요청을 마치지 못했어요.'); return d; }
export const topics = { general: '자유 의견', not_collected: '수거가 안 되고 있어요', trash: '주변 쓰레기가 계속 쌓여요', contact: '관리자 연락처가 확인되지 않아요', cleaned: '방금 정리된 것 같아요' };
export function subscribeCommunity(binId, onData, onError) { if (!KEY.test(binId))
    throw new Error('수거함 번호를 확인해 주세요.'); const B = getRuntime(); return B.fb.onValue(B.fb.ref(B.db, `${B.ROOT}/community/${binId}`), s => onData(Object.values(s.val() || {}).map(m => ({ ...m, isMine: m.author_id === B.auth.currentUser?.uid })).sort((a, b) => b.created_at - a.created_at || b.id.localeCompare(a.id))), e => onError(B.firebaseMessage(e))); }
export async function sendCommunity({ binId, text, topic = 'general', parentId = '', id }) {
    const { B, uid } = await identity();
    if (!KEY.test(binId) || !UUID.test(id) || !Object.hasOwn(topics, topic) || typeof text !== 'string' || text.trim().length < 2 || text.trim().length > 1200 || (parentId && !UUID.test(parentId)))
        throw new Error('의견을 2~1,200자로 입력해 주세요.');
    const path = `${B.ROOT}/community/${binId}/${id}`;
    const old = await B.fb.get(B.fb.ref(B.db, path));
    if (old.exists()) {
        if (old.val().author_id !== uid)
            throw new Error('저장 번호를 다시 확인해 주세요.');
        return;
    }
    if (parentId) {
        const parent = (await B.fb.get(B.fb.ref(B.db, `${B.ROOT}/community/${binId}/${parentId}`))).val();
        if (!parent || parent.parent_id || parent.deleted)
            throw new Error('삭제되었거나 없는 글에는 댓글을 달 수 없어요.');
    }
    await B.fb.update(B.fb.ref(B.db, `${B.ROOT}/community/${binId}`), { [id]: { id, bin_id: binId, author_id: uid, nickname: '이웃 ' + uid.slice(0, 6), topic, text: text.trim(), parent_id: parentId, created_at: stamp(), updated_at: stamp(), deleted: false } });
}
export async function deleteCommunity(binId, id) { const { B } = await identity(); if (!KEY.test(binId) || !UUID.test(id))
    throw new Error('글 번호가 올바르지 않아요.'); await B.fb.update(B.fb.ref(B.db, `${B.ROOT}/community/${binId}/${id}`), { text: '', deleted: true, updated_at: stamp() }); }
