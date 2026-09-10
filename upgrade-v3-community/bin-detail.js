import { h, Fragment, useState, useEffect, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, Camera, Plus, Check, MapPin } from './runtime.js';
import { useCatalog } from './catalog.js';
import { levels, originLabel, hasCoordinates, maintenanceTime, relativeTime, displayTime, observationScore, defaultComparison } from './bin-model.js';
import { riskScore, stateText } from './keeper-features.js';
import ReportPhoto from './report-photo.js';
import Community from './community.js';
import EmpathyButton from './empathy-button.js';
export default function BinDetail({ id, onClose, onReport, onMaintenance, onReportSelect, initialTab = 'overview', focusPostId = '', focusReportId = '' }) {
    const { byId } = useCatalog(), bin = byId.get(id);
    const [tab, setTab] = useState('overview');
    useEffect(() => setTab(['overview', 'photos', 'history', 'community'].includes(initialTab) ? initialTab : 'overview'), [id, initialTab, focusPostId, focusReportId]);
    useEffect(() => { if (tab !== 'history' || !focusReportId)
        return; const t = setTimeout(() => document.getElementById('history-' + focusReportId)?.scrollIntoView({ block: 'nearest' }), 120); return () => clearTimeout(t); }, [tab, focusReportId, bin]);
    function close() { if (window.dispatchEvent(new Event('keeper-bin-before-close', { cancelable: true })))
        onClose(); }
    function leave(action) { if (window.dispatchEvent(new Event('keeper-bin-before-close', { cancelable: true })))
        action(); }
    return h(Dialog, { open: !!id, onOpenChange: open => { if (!open)
            close(); } },
        h(DialogContent, { className: "report-dialog bin-detail-dialog", onInteractOutside: e => e.preventDefault() },
            h(DialogHeader, null,
                h("div", { className: "eyebrow" }, "ONE BIN, EVERY STORY"),
                h(DialogTitle, { className: "dialog-title" }, bin?.title || '수거함 기록'),
                h(DialogDescription, null, bin?.address || '수거함 정보를 확인하고 있어요.')),
            bin && h(Fragment, null,
                h("div", { className: "bin-detail-scroll" },
                    h("div", { className: "bin-detail-overview" },
                        h("div", { className: `bin-risk-large ${bin.level}` },
                            h("span", null, levels[bin.level].emoji),
                            h("b", null, bin.score == null ? '점수 미확인' : `${bin.score}점`),
                            h("span", null,
                                "\u00B7 ",
                                levels[bin.level].label)),
                        h("span", { className: `bin-source-tag ${bin.origin === 'citizen' ? 'citizen' : ''}` }, originLabel(bin)),
                        h("div", { className: "bin-detail-metrics" },
                            h("div", null,
                                h("b", null,
                                    bin.recentCount,
                                    "\uAC74"),
                                h("span", null, "\uCD5C\uADFC 30\uC77C \uC81C\uBCF4")),
                            h("div", null,
                                h("b", null, bin.lastMaintenance ? relativeTime(maintenanceTime(bin.lastMaintenance)) : '이력 없음'),
                                h("span", null, "\uB9C8\uC9C0\uB9C9 \uC815\uBE44\u00B7\uD574\uACB0 \uAE30\uB85D")),
                            h("div", null,
                                h("b", null,
                                    bin.history.length,
                                    "\uAC74"),
                                h("span", null, "\uB204\uC801 \uAD00\uCC30\u00B7\uC815\uBE44"))),
                        h("p", { className: "field-hint" }, bin.latest ? `최근 상태 기록: ${displayTime(bin.latest.created_at)} · ${bin.latest.kind === 'maintenance' ? '시민이 사진으로 정비 완료를 기록했어요.' : bin.latest.status === 'resolved' ? '기존 제보자가 해결 상태를 표시했어요.' : stateText(bin.latest)}` : '공공 위치만 확인된 수거함이에요. 제보 전에는 위험도나 안전 여부를 판단하지 않아요.'),
                        h("p", { className: "risk-disclaimer" }, "\uB118\uCE68 30 + \uC8FC\uBCC0 \uC801\uCE58 30 + \uD30C\uC190 20 + \uD45C\uC2DC \uD655\uC778 20\uC810. 0~30\uC810 \uAD00\uCC30 / 31~60\uC810 \uC815\uBE44 \uAD8C\uACE0 / 61~100\uC810 \uC815\uBE44 \uC2DC\uAE09. \uACF5\uC778 \uC704\uD5D8\uB3C4\uB098 \uAE30\uAD00\uC758 \uC815\uBE44 \uD655\uC778\uC774 \uC544\uB2CC \uC2DC\uBBFC \uAD00\uCC30 \uCC38\uACE0 \uC810\uC218\uC785\uB2C8\uB2E4.")),
                    h("div", { className: "bin-detail-tabs", role: "tablist", "aria-label": "\uC218\uAC70\uD568 \uC0C1\uC138 \uBA54\uB274" }, [['overview', '기본 정보'], ['photos', '사진 비교'], ['history', '위험도·정비 이력'], ['community', '게시글·댓글']].map(([value, label]) => h("button", { key: value, role: "tab", "aria-selected": tab === value, className: tab === value ? 'active' : '', onClick: () => leave(() => setTab(value)) }, label))),
                    tab === 'overview' && h("section", { className: "bin-info" },
                        h("h3", null, "\uC218\uAC70\uD568 \uAE30\uBCF8 \uC815\uBCF4"),
                        h("dl", null,
                            h("dt", null, "\uC790\uB8CC \uAD6C\uBD84"),
                            h("dd", null, originLabel(bin)),
                            h("dt", null, "\uC124\uCE58 \uC7A5\uC18C"),
                            h("dd", null, bin.name || '현장 제보 주소 기준'),
                            h("dt", null, "\uC0C1\uC138 \uC704\uCE58"),
                            h("dd", null, bin.detail || '등록된 상세 설명 없음'),
                            h("dt", null, "\uAD00\uB9AC\uAE30\uAD00"),
                            h("dd", null, bin.manager || '공공자료에서 확인되지 않음'),
                            h("dt", null, "\uAD00\uB9AC \uC5F0\uB77D\uCC98"),
                            h("dd", null, bin.phone ? h("a", { href: 'tel:' + bin.phone.replace(/[^\d+]/g, '') }, bin.phone) : '공공자료에 연락처 없음 · 현장 표시를 확인해 주세요'),
                            h("dt", null, "\uC790\uB8CC \uAE30\uC900\uC77C"),
                            h("dd", null, bin.checked || '시민 관찰 기록 기준'),
                            h("dt", null, "\uC704\uCE58 \uC815\uBCF4"),
                            h("dd", null, hasCoordinates(bin) ? `${bin.latitude.toFixed(6)}, ${bin.longitude.toFixed(6)}${bin.coordinateStatus === 'citizen' ? ' · 시민이 확인한 위치' : ''}` : '좌표 미제공 · 주소로 찾고 제보 시 실제 위치를 확인해 주세요'),
                            h("dt", null, "\uC218\uAC70\uD568 ID"),
                            h("dd", { className: "bin-id" }, bin.id)),
                        bin.origin === 'public' && h("p", { className: "field-hint" },
                            "\uCD9C\uCC98: \uACF5\uACF5\uB370\uC774\uD130\uD3EC\uD138 \u300C\uC804\uAD6D\uC758\uB958\uC218\uAC70\uD568\uD45C\uC900\uB370\uC774\uD130\u300D \uC5C5\uB85C\uB4DC \uD30C\uC77C. \uC81C\uACF5\uAE30\uAD00: ",
                            bin.provider,
                            ". \uC704\uCE58 \uC790\uB8CC\uC758 \uAE30\uC900\uC77C \uC774\uD6C4 \uC774\uC804\u00B7\uCCA0\uAC70\uB418\uC5C8\uC744 \uC218 \uC788\uC5B4\uC694."),
                        bin.origin === 'registry' && bin.source && h("a", { className: "text-button", href: bin.source, target: "_blank", rel: "noreferrer" }, "\uC6B4\uC601\uC790\uAC00 \uC5F0\uACB0\uD55C \uACF5\uACF5\uC790\uB8CC \uCD9C\uCC98"),
                        bin.origin === 'citizen' && h("p", { className: "soft-notice" }, "\uC774 \uC218\uAC70\uD568\uC740 \uC2DC\uBBFC\uC774 \uBC1C\uACAC\uD588\uC73C\uBA70 \uACF5\uACF5\uC790\uB8CC\uC640 \uC5F0\uACB0\uB418\uC9C0 \uC54A\uC558\uC5B4\uC694. \uC790\uB8CC \uB204\uB77D\u00B7\uAC31\uC2E0 \uCC28\uC774\uC77C \uC218 \uC788\uC73C\uBBC0\uB85C \uBBF8\uB4F1\uB85D \uB610\uB294 \uBD88\uBC95 \uC218\uAC70\uD568\uC73C\uB85C \uB2E8\uC815\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4."),
                        hasCoordinates(bin) && h("a", { className: "btn", href: `https://www.openstreetmap.org/?mlat=${bin.latitude}&mlon=${bin.longitude}#map=18/${bin.latitude}/${bin.longitude}`, target: "_blank", rel: "noreferrer" },
                            h(MapPin, { size: 16 }),
                            "\uC704\uCE58 \uD06C\uAC8C \uBCF4\uAE30")),
                    tab === 'photos' && h(ComparePhotos, { key: bin.id + ':' + focusReportId, bin: bin, focusReportId: focusReportId }),
                    tab === 'history' && h("section", { className: "bin-history" },
                        h("h3", null, "\uC704\uD5D8\uB3C4 \uBCC0\uD654\uC640 \uC815\uBE44 \uC774\uB825"),
                        h("p", { className: "field-hint" }, "\uC0C8 \uC0AC\uC9C4 \uAD00\uCC30\uC774 \uC313\uC774\uB294 \uC21C\uC11C\uC608\uC694. \uAC00\uC7A5 \uCD5C\uADFC\uC5D0 \uC791\uC131\uB41C \uAD00\uCC30\uC774 \uD604\uC7AC \uC0C1\uD0DC\uC5D0 \uBC18\uC601\uB429\uB2C8\uB2E4. \uB313\uAE00\uC740 \uC810\uC218\uB97C \uBC14\uAFB8\uC9C0 \uC54A\uC544\uC694."),
                        !bin.history.length ? h("div", { className: "community-empty" }, "\uC544\uC9C1 \uAD00\uCC30\u00B7\uC815\uBE44 \uAE30\uB85D\uC774 \uC5C6\uC5B4\uC694.") : bin.history.map(r => h("article", { id: 'history-' + r.id, className: `bin-history-entry ${r.kind === 'maintenance' ? 'maintenance' : ''} ${focusReportId === r.id ? 'activity-focused' : ''}`, key: r.id },
                            h("div", { className: "between" },
                                h("b", null, r.kind === 'maintenance' ? '✓ 정비 완료 · 시민 확인' : r.status === 'resolved' ? '제보자 해결 표시' : '현장 제보'),
                                h("time", null, displayTime(r.created_at))),
                            h("div", { className: "history-score" },
                                h("span", null, observationScore(r) == null ? '미확인' : `${observationScore(r)}점`),
                                h("div", { className: "history-score-track" },
                                    h("i", { style: { width: `${observationScore(r) || 0}%` } }))),
                            r.status === 'resolved' && r.kind !== 'maintenance' && h("p", { className: "field-hint" },
                                "\uB2F9\uC2DC \uC81C\uBCF4 \uC810\uC218 ",
                                riskScore(r) ?? '미확인',
                                " \u00B7 \uD574\uACB0 \uD45C\uC2DC ",
                                displayTime(r.updated_at),
                                " (\uC0C8 \uC815\uBE44 \uC0AC\uC9C4 \uAE30\uB85D\uACFC \uAD6C\uBD84)"),
                            h("p", null, r.description || stateText(r)),
                            h("div", { className: "history-activity-actions" },
                                h(EmpathyButton, { binId: bin.id, type: "reports", id: r.id }),
                                h("button", { className: "text-button", onClick: () => leave(() => onReportSelect(r)) }, "\uC0AC\uC9C4\u00B7\uC81C\uBCF4 \uC0C1\uC138 \uBCF4\uAE30 \u2192"))))),
                    tab === 'community' && h(Community, { key: bin.id, bin: bin, focusPostId: focusPostId, onMaintenance: () => leave(() => onMaintenance(bin)) })),
                h("div", { className: "bin-detail-actions" },
                    h("button", { className: "btn", onClick: () => leave(() => setTab('photos')) },
                        h(Camera, { size: 17 }),
                        "\uC0AC\uC9C4 \uBCF4\uAE30"),
                    h("button", { className: "btn", onClick: () => leave(() => onReport(bin)) },
                        h(Plus, { size: 17 }),
                        "\uC81C\uBCF4\uD558\uAE30"),
                    h("button", { className: "btn primary", onClick: () => leave(() => onMaintenance(bin)) },
                        h(Check, { size: 17 }),
                        "\uC815\uBE44 \uC644\uB8CC")))));
}
function ComparePhotos({ bin, focusReportId = '' }) {
    const focused = bin.history.find(r => r.id === focusReportId), initial = focused ? { after: focused.id, before: bin.history.find(r => r.id !== focused.id && r.created_at <= focused.created_at)?.id || '' } : defaultComparison(bin.history), [before, setBefore] = useState(initial.before), [after, setAfter] = useState(initial.after);
    const history = bin.history;
    const older = history.find(r => r.id === before), newer = history.find(r => r.id === after);
    if (!history.length)
        return h("div", { className: "community-empty" }, "\uC544\uC9C1 \uC0AC\uC9C4\uC774 \uC5C6\uC5B4\uC694. \uCCAB \uC81C\uBCF4\uB97C \uB0A8\uAE30\uBA74 \uC5EC\uAE30\uC5D0 \uBAA8\uC5EC\uC694.");
    function changeAfter(id) { setAfter(id); const chosen = history.find(r => r.id === id); if (!older || before === id || older.created_at > chosen.created_at)
        setBefore(history.find(r => r.id !== id && r.created_at <= chosen.created_at)?.id || ''); }
    return h("section", { className: "photo-comparison" },
        h("h3", null, "\uAE30\uC874 \uC0AC\uC9C4\uACFC \uCD5C\uADFC \uC0AC\uC9C4 \uBE44\uAD50"),
        h("p", { className: "field-hint" }, "\uAC01 \uC0AC\uC9C4\uC758 \uC2E4\uC81C \uC81C\uBCF4 \uC2DC\uAC01\uC744 \uBE44\uAD50\uD574\uC694. \uC815\uBE44 \uAE30\uB85D\uC774 \uC788\uC73C\uBA74 \uCD5C\uADFC \uC815\uBE44 \uC804\uD6C4 \uC0AC\uC9C4\uC744 \uC6B0\uC120 \uC120\uD0DD\uD569\uB2C8\uB2E4."),
        h("div", { className: "photo-compare-grid" }, [['기존 사진', before, older], ['최근 사진', after, newer]].map(([label, value, r], index) => h("div", { className: "compare-pane", key: label },
            h("label", { className: "field-label", htmlFor: 'compare-' + index }, label),
            h("select", { id: 'compare-' + index, className: "text-input", value: value, onChange: e => index ? changeAfter(e.target.value) : setBefore(e.target.value) },
                !value && h("option", { value: "" }, "\uBE44\uAD50\uD560 \uC774\uC804 \uC0AC\uC9C4 \uC5C6\uC74C"),
                history.filter(x => index || x.id !== after && x.created_at <= (newer?.created_at || Infinity)).map(x => h("option", { key: x.id, value: x.id },
                    displayTime(x.created_at),
                    " \u00B7 ",
                    x.kind === 'maintenance' ? '정비 완료' : stateText(x)))),
            r ? h(Fragment, null,
                h("div", { className: "compare-image" },
                    h(ReportPhoto, { id: r.id, alt: `${label} · ${displayTime(r.created_at)} · ${stateText(r)}` })),
                h("p", null,
                    r.kind === 'maintenance' ? '시민 정비 완료 기록' : stateText(r),
                    " \u00B7 ",
                    observationScore(r) == null ? '점수 미확인' : `${observationScore(r)}점`),
                h(ReportPhoto, { id: r.id, download: true })) : h("div", { className: "compare-image empty" }, "\uC774\uC804 \uC0AC\uC9C4\uC774 \uC544\uC9C1 \uC5C6\uC5B4\uC694.")))),
        history.length === 1 && h("p", { className: "field-hint" }, "\uC0AC\uC9C4\uC774 1\uC7A5\uBFD0\uC774\uC5D0\uC694. \uB2E4\uC74C \uC81C\uBCF4\uB098 \uC815\uBE44 \uC644\uB8CC \uC0AC\uC9C4\uC774 \uCD94\uAC00\uB418\uBA74 \uC804\uD6C4 \uBE44\uAD50\uAC00 \uAC00\uB2A5\uD569\uB2C8\uB2E4."));
}
