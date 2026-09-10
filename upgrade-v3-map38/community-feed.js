import { h, Fragment, useState, useEffect, useMemo, Camera, ArrowRight, RotateCw, MapPin, Check, LoaderCircle } from './runtime.js';
import { useCatalog } from './catalog.js';
import { buildActivityFeed, filterActivities, regionChoices, activityKinds } from './community-model.js';
import { subscribeActivityMessages } from './community-service.js';
import { levels, relativeTime, displayTime } from './bin-model.js';
import { stateText } from './keeper-features.js';
import { topics } from './api.js';
import ReportPhoto from './report-photo.js';
import EmpathyButton from './empathy-button.js';
import { MessageIcon } from './community-icons.js';
const blankFilters = () => ({ q: '', province: '', district: '', dong: '', kind: 'all' });
export default function CommunityFeed({ onOpenBin, onFindBins, onReport }) {
    const catalog = useCatalog();
    const [messages, setMessages] = useState({}), [loading, setLoading] = useState(true), [error, setError] = useState(''), [retry, setRetry] = useState(0), [filters, setFilters] = useState(blankFilters), [limit, setLimit] = useState(20);
    useEffect(() => {
        let live = true;
        setLoading(true);
        setError('');
        const off = subscribeActivityMessages(data => { if (live) {
            setMessages(data);
            setLoading(false);
            setError('');
        } }, e => { if (live) {
            setError(e);
            setLoading(false);
        } });
        return () => { live = false; off(); };
    }, [retry]);
    const feed = useMemo(() => buildActivityFeed(catalog.reports, messages, catalog.byId), [catalog.reports, messages, catalog.byId]);
    const filtered = useMemo(() => filterActivities(feed, filters), [feed, filters]);
    const choices = useMemo(() => regionChoices(catalog.bins, filters), [catalog.bins, filters.province, filters.district]);
    const counts = useMemo(() => {
        const regional = filterActivities(feed, { ...filters, kind: 'all' });
        return { all: regional.length, ...Object.fromEntries(['report', 'maintenance', 'opinion'].map(k => [k, regional.filter(i => i.kind === k).length])) };
    }, [feed, filters]);
    const firstLoading = catalog.loading || (!catalog.synced && catalog.syncing) || loading;
    function change(next) { setFilters(old => ({ ...old, ...next })); setLimit(20); }
    function refresh() { setRetry(n => n + 1); catalog.refresh(); }
    return h("section", { className: "community-feed", "aria-labelledby": "community-title" },
        h("div", { className: "page-heading" },
            h("div", null,
                h("div", { className: "eyebrow" }, "NEIGHBORHOOD STORIES"),
                h("h1", { id: "community-title" }, "\uC218\uAC70\uD568 \uCEE4\uBBA4\uB2C8\uD2F0"),
                h("p", null, "\uC81C\uBCF4\uBD80\uD130 \uC815\uBE44\uAE4C\uC9C0, \uB3D9\uB124 \uC218\uAC70\uD568\uC758 \uBCC0\uD654\uB97C \uD568\uAED8 \uAE30\uB85D\uD574\uC694.")),
            h("button", { className: "btn", onClick: refresh, disabled: loading || catalog.syncing },
                h(RotateCw, { size: 17, className: loading || catalog.syncing ? 'spin' : '' }),
                "\uC0C8\uB85C\uACE0\uCE68")),
        h("div", { className: "community-intro" },
            h("span", { className: "community-intro-icon" },
                h(MessageIcon, { size: 23 })),
            h("div", null,
                h("strong", null, "\uAC19\uC740 \uC218\uAC70\uD568, \uD558\uB098\uB85C \uC774\uC5B4\uC9C0\uB294 \uC774\uC57C\uAE30"),
                h("p", null, "\uC9C0\uB3C4\uC640 \uCEE4\uBBA4\uB2C8\uD2F0\uAC00 \uAC19\uC740 \uAE30\uB85D\uC744 \uBCF4\uC5EC\uC918\uC694. \uACF5\uAC10\uC740 \uAD00\uC2EC \uD45C\uD604\uC77C \uBFD0, \uC704\uD5D8\uB3C4\uB098 \uC815\uBE44 \uC0C1\uD0DC\uB97C \uBC14\uAFB8\uC9C0 \uC54A\uC544\uC694."))),
        h("div", { className: "community-filters" },
            h("label", { className: "community-search" },
                h("span", { className: "sr-only" }, "\uCEE4\uBBA4\uB2C8\uD2F0 \uAC80\uC0C9"),
                h("input", { type: "search", className: "text-input", placeholder: "\uC8FC\uC18C\u00B7\uC218\uAC70\uD568\u00B7\uAC8C\uC2DC\uAE00 \uB0B4\uC6A9 \uAC80\uC0C9", value: filters.q, maxLength: 200, onChange: e => change({ q: e.target.value }) })),
            h("select", { className: "text-input", "aria-label": "\uCEE4\uBBA4\uB2C8\uD2F0 \uC2DC\uB3C4", value: filters.province, onChange: e => change({ province: e.target.value, district: '', dong: '' }) },
                h("option", { value: "" }, "\uC804\uAD6D \u00B7 \uBAA8\uB4E0 \uC2DC\uB3C4"),
                choices.provinces.map(p => h("option", { key: p, value: p }, p))),
            h("select", { className: "text-input", "aria-label": "\uCEE4\uBBA4\uB2C8\uD2F0 \uC2DC\uAD70\uAD6C", value: filters.district, onChange: e => change({ district: e.target.value, dong: '' }) },
                h("option", { value: "" }, "\uBAA8\uB4E0 \uC2DC\uAD70\uAD6C"),
                choices.districts.map(d => h("option", { key: d, value: d }, d))),
            h("select", { className: "text-input", "aria-label": "\uCEE4\uBBA4\uB2C8\uD2F0 \uB3D9\uC74D\uBA74", value: filters.dong, onChange: e => change({ dong: e.target.value }) },
                h("option", { value: "" }, "\uBAA8\uB4E0 \uB3D9\u00B7\uC74D\u00B7\uBA74"),
                choices.dongs.map(d => h("option", { key: d, value: d }, d))),
            h("button", { className: "text-button", onClick: () => { setFilters(blankFilters()); setLimit(20); } }, "\uCD08\uAE30\uD654")),
        h("div", { className: "activity-filter-bar" },
            h("div", { className: "activity-filter-buttons", role: "group", "aria-label": "\uCEE4\uBBA4\uB2C8\uD2F0 \uAE30\uB85D \uC885\uB958" }, Object.entries(activityKinds).map(([key, label]) => h("button", { type: "button", key: key, "aria-pressed": filters.kind === key, className: filters.kind === key ? 'selected' : '', onClick: () => change({ kind: key }) },
                label,
                h("span", null, firstLoading ? '—' : counts[key])))),
            h("span", { className: "activity-order" }, "\uCD5C\uADFC \uD65C\uB3D9\uC21C \u00B7 \uACF5\uAC10 \uC218\uC640 \uBB34\uAD00")),
        error && h("div", { className: "error-banner", role: "alert" },
            h("div", null,
                h("b", null, "\uAC8C\uC2DC\uAE00 \uC5F0\uACB0\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694."),
                h("p", null, "\uC77C\uBD80 \uAE00\uC774 \uBAA9\uB85D\uC5D0\uC11C \uBE60\uC9C8 \uC218 \uC788\uC5B4\uC694. \uCEE4\uBBA4\uB2C8\uD2F0\uC6A9 Firebase \uADDC\uCE59\uC744 \uC801\uC6A9\uD55C \uB4A4 \uB2E4\uC2DC \uC5F0\uACB0\uD574 \uC8FC\uC138\uC694."),
                h("small", null, error)),
            h("button", { className: "text-button", onClick: refresh }, "\uB2E4\uC2DC \uC5F0\uACB0")),
        catalog.error && h("div", { className: "error-banner", role: "alert" },
            h("div", null,
                catalog.error,
                h("p", null, "\uC218\uAC70\uD568\u00B7\uC81C\uBCF4 \uBAA9\uB85D\uC774 \uC77C\uBD80 \uB204\uB77D\uB418\uC5C8\uC744 \uC218 \uC788\uC5B4\uC694.")),
            h("button", { className: "text-button", onClick: refresh }, "\uB2E4\uC2DC \uBD88\uB7EC\uC624\uAE30")),
        h("div", { className: "community-layout" },
            h("div", { className: "activity-list", "aria-live": "polite", "aria-busy": firstLoading },
                firstLoading && !feed.length ? h("div", { className: "activity-empty", role: "status" },
                    h(LoaderCircle, { className: "spin", size: 24 }),
                    h("h2", null, "\uB3D9\uB124 \uAE30\uB85D\uC744 \uBD88\uB7EC\uC624\uACE0 \uC788\uC5B4\uC694")) :
                    !filtered.length ? h("div", { className: "activity-empty" },
                        h(MessageIcon, { size: 34 }),
                        h("h2", null, error || catalog.error ? '기록을 아직 확인할 수 없어요' : feed.length ? '조건에 맞는 기록이 없어요' : '동네의 첫 이야기를 기다려요'),
                        h("p", null, error || catalog.error ? '연결을 복구한 뒤 다시 불러와 주세요.' : feed.length ? '지역이나 검색어를 바꿔 보세요. 주소에 동 이름이 없는 기록은 동 필터에서 빠질 수 있어요.' : '아직 제보·정비 기록·게시글이 없어요. 지도에서 수거함을 찾고 첫 의견을 남겨 보세요.'),
                        h("div", { className: "activity-empty-actions" },
                            h("button", { className: "btn", onClick: onFindBins },
                                h(MapPin, { size: 17 }),
                                "\uC8FC\uBCC0 \uC218\uAC70\uD568 \uCC3E\uAE30"),
                            h("button", { className: "btn primary", onClick: onReport },
                                h(Camera, { size: 17 }),
                                "\uC0AC\uC9C4\uC73C\uB85C \uC81C\uBCF4\uD558\uAE30"))) :
                        filtered.slice(0, limit).map(item => h(ActivityCard, { key: item.key, item: item, onOpen: onOpenBin })),
                !!filtered.length && h("div", { className: "activity-pagination" },
                    h("p", null,
                        "\uAC80\uC0C9 \uACB0\uACFC ",
                        filtered.length.toLocaleString(),
                        "\uAC74 \uC911 ",
                        Math.min(limit, filtered.length).toLocaleString(),
                        "\uAC74 \uD45C\uC2DC"),
                    filtered.length > limit && h("button", { className: "btn", onClick: () => setLimit(n => n + 20) }, "\uC774\uC804 \uC18C\uC2DD 20\uAC74 \uB354 \uBCF4\uAE30"))),
            h("aside", { className: "community-sidebar" },
                h("div", { className: "report-cta" },
                    h("span", { className: "icon-tile" },
                        h(Camera, { size: 25 })),
                    h("h2", null,
                        "\uC9C0\uAE08 \uBCF8 \uBAA8\uC2B5\uC774",
                        h("br", null),
                        "\uB3D9\uB124\uC758 \uAE30\uB85D\uC774 \uB3FC\uC694."),
                    h("p", null,
                        "\uD604\uC7A5 \uC0AC\uC9C4\uC740 \uC81C\uBCF4\uB85C,",
                        h("br", null),
                        "\uAD00\uB9AC \uC0C1\uD669\uC740 \uC218\uAC70\uD568 \uAC8C\uC2DC\uD310\uC5D0 \uB0A8\uACA8\uC694."),
                    h("button", { className: "btn primary", onClick: onReport },
                        "\uC0AC\uC9C4\uC73C\uB85C \uC81C\uBCF4\uD558\uAE30",
                        h(ArrowRight, { size: 17 })),
                    h("button", { className: "btn", onClick: onFindBins },
                        "\uC218\uAC70\uD568 \uCC3E\uC544 \uC758\uACAC \uB0A8\uAE30\uAE30",
                        h(MessageIcon, { size: 17 }))),
                h("div", { className: "community-help" },
                    h("h3", null, "\uD568\uAED8 \uAE30\uB85D\uD558\uB294 \uBC29\uBC95"),
                    h("p", null,
                        h("b", null, "\uACF5\uAC10"),
                        "\uC740 \uAD00\uC2EC\uC744 \uD45C\uD604\uD574\uC694.",
                        h("br", null),
                        h("b", null, "\uB313\uAE00"),
                        "\uC740 \uAE30\uC874 \uAE00\uC5D0 \uC758\uACAC\uC744 \uB354\uD574\uC694.",
                        h("br", null),
                        h("b", null, "\uC815\uBE44 \uC644\uB8CC"),
                        "\uB294 \uC0C8 \uC0AC\uC9C4\uC73C\uB85C \uB0A8\uACA8\uC694."),
                    h("p", { className: "field-hint" }, "\uC815\uBE44 \uC644\uB8CC \uAC8C\uC2DC\uAE00\uACFC \uC2E4\uC81C \uC815\uBE44 \uAE30\uB85D\uC740 \uB2EC\uB77C\uC694. \uAE30\uAD00 \uD655\uC778\uACFC \uC2DC\uBBFC \uD655\uC778\uB3C4 \uAD6C\uBD84\uD574\uC11C \uD45C\uC2DC\uD574\uC694."),
                    h("button", { className: "text-button", onClick: onFindBins },
                        "\uC9C0\uB3C4\uC5D0\uC11C \uAC19\uC740 \uAE30\uB85D \uBCF4\uAE30",
                        h(ArrowRight, { size: 15 }))))));
}
function ActivityCard({ item, onOpen }) {
    const { bin, post, report } = item;
    const isPost = item.kind === 'opinion', maintenance = item.kind === 'maintenance';
    const label = isPost ? '의견' : maintenance ? '정비 완료' : '현장 제보';
    function open(tab = 'overview') { onOpen(bin, { tab, postId: isPost ? post.id : '', reportId: report?.id || '' }); }
    return h("article", { className: 'activity-card activity-' + item.kind, "data-activity-id": item.key },
        h("div", { className: "activity-meta" },
            h("span", { className: 'activity-kind ' + item.kind },
                maintenance ? h(Check, { size: 13 }) : isPost ? h(MessageIcon, { size: 13 }) : h(Camera, { size: 13 }),
                " ",
                label),
            h("span", { className: "activity-author" }, isPost ? post.nickname || '이웃' : maintenance ? '시민 사진 확인' : '시민 관찰 기록'),
            h("time", { dateTime: new Date(item.activityAt).toISOString(), title: displayTime(item.activityAt) },
                item.updatedByReply ? '댓글 ' : '',
                relativeTime(item.activityAt))),
        h("div", { className: 'activity-main' + (!isPost ? ' has-photo' : '') },
            !isPost && h("div", { className: "activity-photo" },
                h(ReportPhoto, { id: report.id, alt: item.title + ' 현장 사진' })),
            h("div", { className: "activity-copy" },
                h("h2", null,
                    h("button", { type: "button", onClick: () => open('overview') }, item.title)),
                h("p", { className: "activity-address" },
                    h(MapPin, { size: 13 }),
                    bin.address),
                isPost && h("span", { className: "community-topic" }, topics[post.topic] || topics.general),
                h("p", { className: "activity-text" }, item.text || (!isPost ? stateText(report) : '')),
                !isPost && report.status === 'resolved' && !maintenance && h("p", { className: "activity-note" }, "\uC81C\uBCF4\uC790\uAC00 \uD574\uACB0 \uC0C1\uD0DC\uB97C \uD45C\uC2DC\uD588\uC5B4\uC694. \uC0C8 \uC815\uBE44 \uC0AC\uC9C4 \uAE30\uB85D\uACFC\uB294 \uAD6C\uBD84\uD569\uB2C8\uB2E4."),
                h("span", { className: 'activity-current ' + bin.level },
                    h("i", { style: { background: levels[bin.level].color } }),
                    "\uC218\uAC70\uD568 \uD604\uC7AC \uC0C1\uD0DC: ",
                    bin.score == null ? '상태 미확인' : `${bin.score}점 · ${levels[bin.level].label}`))),
        h("div", { className: "activity-actions" },
            h(EmpathyButton, { binId: item.binId, type: item.targetType, id: item.targetId }),
            h("button", { type: "button", className: "activity-action", onClick: () => open('community') },
                h(MessageIcon, { size: 17 }),
                isPost ? `댓글 ${item.replyCount}` : `수거함 의견 ${item.binDiscussionCount}`),
            h("span", { className: "activity-spacer" }),
            !isPost && h("button", { type: "button", className: "activity-action", onClick: () => open('photos') }, maintenance ? '전후 사진 보기' : '사진 보기'),
            h("button", { type: "button", className: "activity-action activity-detail", onClick: () => open(isPost ? 'community' : 'history') },
                isPost ? '게시글 보기' : '기록 보기',
                h(ArrowRight, { size: 15 }))));
}
