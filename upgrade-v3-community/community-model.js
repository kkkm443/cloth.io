// Feed is a projection of existing records, never a second store or risk input.
import { binTitle } from './bin-model.js';
export const activityKinds = { all: '전체', report: '현장 제보', maintenance: '정비 완료', opinion: '의견' };
const objectValues = value => value && typeof value === 'object' ? Object.values(value) : [];
const time = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const provinces = {
    '서울': '서울특별시', '서울시': '서울특별시', '부산': '부산광역시', '부산시': '부산광역시',
    '대구': '대구광역시', '대구시': '대구광역시', '인천': '인천광역시', '인천시': '인천광역시',
    '광주': '광주광역시', '대전': '대전광역시', '대전시': '대전광역시',
    '울산': '울산광역시', '울산시': '울산광역시', '세종': '세종특별자치시', '세종시': '세종특별자치시',
    '경기': '경기도', '강원': '강원특별자치도', '강원도': '강원특별자치도', '충북': '충청북도',
    '충남': '충청남도', '전북': '전북특별자치도', '전라북도': '전북특별자치도',
    '전남': '전라남도', '경북': '경상북도', '경남': '경상남도', '제주': '제주특별자치도', '제주도': '제주특별자치도',
};
export function communityRegion(bin = {}) {
    const address = String(bin.landAddress || bin.address || '').trim();
    const tokens = address.split(/\s+/).filter(Boolean);
    const first = tokens[0] || '';
    const province = provinces[bin.province] || bin.province || provinces[first] ||
        (/^(?:.+특별시|.+광역시|.+특별자치시|.+도)$/.test(first) ? first : '');
    const rest = province && first && (provinces[first] === province || first === province) ? tokens.slice(1) : tokens;
    const district = rest.filter((t, i) => i < 2 && /[시군구]$/.test(t) && !t.endsWith('특별자치시')).join(' ') || bin.district || '';
    // Only address-position tokens or an address parenthesis; never building names/titles.
    let adminEnd = 0;
    while (adminEnd < 2 && rest[adminEnd] && /[시군구]$/.test(rest[adminEnd]))
        adminEnd++;
    const direct = (rest[adminEnd] || '').match(/^([가-힣][가-힣0-9·]*(?:동(?:[0-9]+가)?|읍|면))(?=[0-9-]|$)/)?.[1] || '';
    const parenthesized = address.match(/\(([가-힣][가-힣0-9·]*(?:동(?:[0-9]+가)?|읍|면))(?=[,\s)])/)?.[1] || '';
    const dong = direct || parenthesized;
    return { province, district, dong };
}
export function buildActivityFeed(reports = [], messagesByBin = {}, byId = new Map()) {
    const feed = [];
    const discussions = new Map();
    for (const [binId, raw] of Object.entries(messagesByBin || {})) {
        const bin = byId.get(binId);
        if (!bin)
            continue; // Do not fabricate a detached bin or expose an orphaned post.
        const messages = objectValues(raw).filter(m => m && m.bin_id === binId && typeof m.id === 'string');
        const live = messages.filter(m => !m.deleted);
        discussions.set(binId, live.length);
        const repliesByParent = new Map();
        for (const m of live)
            if (m.parent_id) {
                const list = repliesByParent.get(m.parent_id) || [];
                list.push(m);
                repliesByParent.set(m.parent_id, list);
            }
        for (const post of live.filter(m => !m.parent_id)) {
            const replies = repliesByParent.get(post.id) || [];
            const activityAt = Math.max(time(post.created_at), ...replies.map(r => time(r.created_at)));
            feed.push({
                key: `posts:${binId}:${post.id}`, targetType: 'posts', targetId: post.id, binId, bin,
                kind: 'opinion', createdAt: time(post.created_at), activityAt, post,
                title: bin.title || binTitle(bin), text: String(post.text || ''), replyCount: replies.length,
                updatedByReply: activityAt > time(post.created_at), region: communityRegion(bin),
                searchText: [post.text, ...replies.map(r => r.text)].join(' ')
            });
        }
    }
    for (const report of reports) {
        if (!report || report.sample || !report.id)
            continue;
        const binId = report.bin_id || report.id, bin = byId.get(binId);
        if (!bin)
            continue;
        const maintenance = report.kind === 'maintenance';
        feed.push({
            key: `reports:${binId}:${report.id}`, targetType: 'reports', targetId: report.id, binId, bin,
            kind: maintenance ? 'maintenance' : 'report', createdAt: time(report.created_at),
            activityAt: report.status === 'resolved' ? Math.max(time(report.created_at), time(report.updated_at)) : time(report.created_at),
            title: bin.title || binTitle(bin), text: String(report.description || ''), report,
            binDiscussionCount: discussions.get(binId) || 0, region: communityRegion(bin)
        });
    }
    // Identity, not position, defines a row. Reactions never change this order.
    return feed.sort((a, b) => b.activityAt - a.activityAt || b.key.localeCompare(a.key));
}
export function filterActivities(items, { kind = 'all', province = '', district = '', dong = '', q = '' } = {}) {
    const search = q.trim().toLowerCase();
    return items.filter(item => (kind === 'all' || item.kind === kind) &&
        (!province || item.region.province === province) && (!district || item.region.district === district) &&
        (!dong || item.region.dong === dong) && (!search ||
        `${item.title} ${item.bin.address || ''} ${item.bin.landAddress || ''} ${item.bin.name || ''} ${item.text} ${item.searchText || ''}`.toLowerCase().includes(search)));
}
export function regionChoices(bins, filters = {}) {
    const regions = bins.map(communityRegion);
    const unique = (list, key) => [...new Set(list.map(r => r[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));
    return {
        provinces: unique(regions, 'province'),
        districts: unique(regions.filter(r => !filters.province || r.province === filters.province), 'district'),
        dongs: unique(regions.filter(r => (!filters.province || r.province === filters.province) && (!filters.district || r.district === filters.district)), 'dong'),
    };
}
export function reactionSummary(value, uid) {
    const entries = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return { count: Object.values(entries).filter(v => v === true).length, mine: !!uid && entries[uid] === true };
}
export function isReactionTarget(type, id, binId) {
    return ['posts', 'reports'].includes(type) && /^[a-zA-Z0-9_-]{1,100}$/.test(binId || '') &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id || '');
}
