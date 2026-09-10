import { categories } from './report-types.js';
export const issueWeights = { overflow: 30, dumping: 30, damage: 20, no_label: 20 };
export const issueLabels = { overflow: '수거함 넘침', dumping: '주변 적치', damage: '파손·노후', no_label: '관리자 표시 확인 어려움' };
export function reportIssues(r) { return r.issues && Object.values(r.issues).some(v => v === true) ? Object.keys(r.issues).filter(k => r.issues?.[k] === true) : r.category in issueWeights ? [r.category] : []; }
export function riskScore(r) {
    if (r.category === 'uncertain' && !reportIssues(r).length)
        return null;
    return reportIssues(r).reduce((n, k) => n + issueWeights[k], 0);
}
export function riskLabel(score) { return score === null ? '판단 보류' : score <= 30 ? '관찰' : score <= 60 ? '정비 권고' : '정비 시급'; }
export function stateText(r) { return reportIssues(r).map(k => issueLabels[k]).join(' · ') || categories[r.category].label; }
export const guidanceSource = 'https://www.gwangjin.go.kr/portal/main/contents.do?menuNo=201332';
export function departmentFor(address) { const known = /(서울.*광진구|^광진구)/.test(address); return { known, name: known ? '광진구청 청소과' : '담당 부서 확인 필요', phone: known ? '02-450-7624' : '', source: known ? guidanceSource : '', text: known ? '광진구 공식 안내는 가득 찬 수거함에 대해 표시된 연락처 또는 청소과로 문의하도록 안내합니다.' : '이 지역은 공식 담당 부서 자료가 연결되지 않았어요. 관할 지자체 안내를 확인해 주세요.' }; }
export const intakeLabels = { internal_received: '서비스 내부 접수', queued: '기관 전송 대기', sending: '기관 응답 확인 중', external_received: '연계 기관 수신 확인', delivery_unknown: '기관 수신 확인 필요', delivery_rejected: '전송하지 못함' };
export const handlingLabels = { received: "접수 대기", reviewing: "검토 중", assigned: "담당자 배정", resolved: "처리 완료" };
export function distanceMeters(a, b) { const rad = Math.PI / 180, dlat = (b[0] - a[0]) * rad, dlon = (b[1] - a[1]) * rad; const h = Math.sin(dlat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dlon / 2) ** 2; return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h))); }
export function groupBins(reports) {
    const groups = new Map();
    for (const r of [...reports].sort((a, b) => a.created_at - b.created_at || a.id.localeCompare(b.id))) {
        const key = r.bin_id || r.id;
        const group = groups.get(key);
        if (group) {
            group.history.unshift(r);
            group.latest = r;
        }
        else
            groups.set(key, { id: key, latest: r, history: [r] });
    }
    return [...groups.values()].sort((a, b) => (riskScore(b.latest) ?? -1) - (riskScore(a.latest) ?? -1) || a.latest.created_at - b.latest.created_at);
}
export function downloadJSON(value, name) { const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
