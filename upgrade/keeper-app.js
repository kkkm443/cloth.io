import { h, Fragment } from './runtime.js';
import { CatalogProvider, useCatalog } from './catalog.js';
import { filterBins, hasCoordinates } from './bin-model.js';
import { CatalogSummary, CatalogControls, TrafficLegend, BinCard, emptyFilters } from './bin-ui.js';
import BinDetail from './bin-detail.js';
"use client";
import { IntakeHistory } from './runtime.js';
import { OperatorGate } from './runtime.js';
import BinDirectory from './bin-directory.js';
import { riskScore, riskLabel } from './keeper-features.js';
import { apiRequest } from "./api.js";
import { appHome, watchReports } from "./runtime.js";
import { useCallback, useEffect, useMemo, useState, useRef } from './runtime.js';
import { Shirt, Plus, ArrowUpRight, Camera, MapPin, LocateFixed, ArrowRight, Search, RotateCw, Check, Box, Leaf, ClipboardList, ScanLine, ChevronRight, BookOpen, Inbox, LoaderCircle } from './runtime.js';
import { toast } from './runtime.js';
import { Toaster } from './runtime.js';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './runtime.js';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './runtime.js';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from './runtime.js';
import { Skeleton } from './runtime.js';
import { categories, statuses, samples } from './report-types.js';
import MapCanvas from './map-canvas.js';
import ReportForm from './report-form.js';
import { ReportDetail } from './runtime.js';
function age(r) {
    if (r.sample)
        return '예시 제보';
    const n = Date.now() - r.created_at;
    if (n < 60000)
        return '방금 전';
    if (n < 3600000)
        return `${Math.floor(n / 60000)}분 전`;
    if (n < 86400000)
        return `${Math.floor(n / 3600000)}시간 전`;
    return new Date(r.created_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' });
}
function InnerKeeperApp() {
    const catalog = useCatalog();
    const [binFilters, setBinFilters] = useState({ ...emptyFilters }), [selectedBin, setSelectedBin] = useState(null), [draftBin, setDraftBin] = useState(null), [maintenance, setMaintenance] = useState(false);
    const mappedBins = useMemo(() => filterBins(catalog.bins, binFilters), [catalog.bins, binFilters]);
    const previewBins = useMemo(() => [...mappedBins].sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.address.localeCompare(b.address, 'ko')).slice(0, 6), [mappedBins]);
    const [reports, setReports] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [view, setView] = useState('neighborhood'), [mode, setMode] = useState('actual'), [category, setCategory] = useState('all'), [status, setStatus] = useState('all'), [query, setQuery] = useState(''), [form, setForm] = useState(false), [selected, setSelected] = useState(null), [center, setCenter] = useState(null), [locating, setLocating] = useState(false);
    const [nextCursor, setNextCursor] = useState(null), [total, setTotal] = useState(0), [summary, setSummary] = useState({ total: 0, open: 0, resolved: 0 }), [loadingMore, setLoadingMore] = useState(false), [lastSynced, setLastSynced] = useState(null);
    const requestId = useRef(0), pending = useRef(null);
    const load = useCallback(async (append = false) => {
        const request = ++requestId.current;
        pending.current?.abort();
        const ac = new AbortController();
        pending.current = ac;
        if (append)
            setLoadingMore(true);
        else {
            setLoading(true);
            setLoadingMore(false);
        }
        setError('');
        try {
            const params = new URLSearchParams({ mine: String(view === 'mine'), q: query, category, status });
            if (append && nextCursor)
                params.set('cursor', nextCursor);
            const r = await apiRequest('/api/reports?' + params, { cache: 'no-store', signal: ac.signal });
            const d = await r.json();
            if (!r.ok)
                throw new Error(d.error || '제보를 불러오지 못했어요.');
            if (request !== requestId.current)
                return;
            setReports(prev => append ? [...prev, ...d.reports.filter(x => !prev.some(y => y.id === x.id))] : d.reports);
            setNextCursor(d.nextCursor);
            setTotal(d.total);
            setSummary(d.summary);
            setLastSynced(Date.now());
        }
        catch (e) {
            if (e.name !== 'AbortError' && request === requestId.current)
                setError(e.message || '연결을 확인한 뒤 다시 시도해 주세요.');
        }
        finally {
            if (request === requestId.current) {
                setLoading(false);
                setLoadingMore(false);
            }
        }
    }, [view, query, category, status, nextCursor]);
    const latestLoad = useRef(load);
    latestLoad.current = load;
    useEffect(() => {
        if (mode === 'example' || view === 'guide')
            return;
        pending.current?.abort();
        setLoading(true);
        const t = setTimeout(() => latestLoad.current(), 250);
        return () => { clearTimeout(t); pending.current?.abort(); };
    }, [view, mode, query, category, status]);
    useEffect(() => () => { pending.current?.abort(); }, []);
    useEffect(() => watchReports(() => {
        if (!form && !selected && mode === 'actual')
            latestLoad.current();
    }), [form, selected, mode]);
    const source = mode === 'example' && view !== 'mine' ? samples : reports;
    const scoped = useMemo(() => view === 'mine' ? source.filter(r => r.isMine) : source, [source, view]);
    const filtered = useMemo(() => scoped.filter(r => (category === 'all' || r.category === category) && (status === 'all' || r.status === status) && `${r.address} ${r.description} ${categories[r.category].label}`.toLowerCase().includes(query.trim().toLowerCase())), [scoped, category, status, query]);
    const openCount = mode === 'actual' ? catalog.bins.filter(b => b.score !== null && b.score > 0 && b.latest?.status !== 'resolved').length : scoped.filter(r => r.status !== 'resolved').length, resolvedCount = mode === 'actual' ? summary.resolved : scoped.filter(r => r.status === 'resolved').length;
    function locate() {
        if (!navigator.geolocation) {
            toast.error('위치를 지원하지 않는 브라우저예요.');
            return;
        }
        setLocating(true);
        navigator.geolocation.getCurrentPosition(p => { setCenter([p.coords.latitude, p.coords.longitude]); setLocating(false); }, () => { setLocating(false); toast.error('위치를 가져오지 못했어요. 브라우저의 위치 권한을 확인해 주세요.'); }, { timeout: 12000 });
    }
    function startReport(bin = null, done = false) { setDraftBin(bin); setMaintenance(done); setSelectedBin(null); setSelected(null); setForm(true); }
    function openBin(bin) { setSelected(null); setSelectedBin(bin.id); }
    function changeView(v) {
        setView(v);
        setCategory('all');
        setStatus('all');
        setQuery('');
        if (v === 'mine')
            setMode('actual');
    }
    function updated(r) { setReports(prev => prev.map(x => x.id === r.id ? r : x)); setSelected(r); latestLoad.current(); }
    const cards = h(Fragment, null,
        error && mode === 'actual' && !reports.length ? h(Empty, { className: "empty-state" },
            h(EmptyHeader, null,
                h(EmptyTitle, null, "\uC800\uC7A5\uB41C \uC81C\uBCF4\uB97C \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694"),
                h(EmptyDescription, null, "\uC5F0\uACB0\uC744 \uD655\uC778\uD55C \uB4A4 \uB2E4\uC2DC \uBD88\uB7EC\uC640 \uC8FC\uC138\uC694.")),
            h("button", { className: "btn", onClick: () => load() }, "\uB2E4\uC2DC \uBD88\uB7EC\uC624\uAE30")) : loading && mode === 'actual' ? h("div", { className: "report-grid" }, [1, 2, 3].map(n => h(Skeleton, { key: n, className: "h-48 rounded-2xl" }))) : filtered.length ? h("div", { className: "report-grid" }, filtered.map(r => h("button", { key: r.id, className: "report-card", onClick: () => setSelected(r) },
            h("div", { className: "report-card-top" },
                h("span", { className: `report-symbol ${r.category}` }, r.category === 'normal' ? h(Check, { size: 23 }) : r.category === 'damage' ? h(Box, { size: 23 }) : h(Shirt, { size: 23 })),
                h("span", { className: `status-label ${r.status}` }, statuses[r.status]),
                h(ChevronRight, { size: 17 })),
            h("span", { className: `category-text ${r.category}` }, categories[r.category].label),
            h("h3", null, r.address),
            h("p", null, r.description || categories[r.category].description),
            h("div", { className: "card-risk" },
                riskLabel(riskScore(r)),
                " \u00B7 ",
                riskScore(r) ?? "—",
                "\uC810"),
            h("div", { className: "card-bottom" },
                h("span", null, age(r)),
                r.isMine ? h("span", { className: "mine-label" }, "\uB0B4 \uC81C\uBCF4") : r.sample ? h("span", null, "\uAC00\uC0C1 \uC704\uCE58\u00B7\uB0B4\uC6A9") : h("span", null, "\uC2DC\uBBFC \uC81C\uBCF4"))))) : h(Empty, { className: "empty-state" },
            h(EmptyHeader, null,
                h(Inbox, { size: 30 }),
                h(EmptyTitle, null, query || category !== 'all' || status !== 'all' ? '조건에 맞는 제보가 없어요' : view === 'mine' ? '아직 남긴 제보가 없어요' : '우리 동네의 첫 제보를 기다려요'),
                h(EmptyDescription, null, query || category !== 'all' || status !== 'all' ? '검색어나 상태 필터를 바꿔 보세요.' : '수거함 사진 한 장으로 동네에 작은 변화를 만들어 보세요.')),
            h("button", { className: "btn primary", onClick: () => {
                    if (query || category !== 'all' || status !== 'all') {
                        setQuery('');
                        setCategory('all');
                        setStatus('all');
                    }
                    else
                        startReport();
                } },
                query || category !== 'all' || status !== 'all' ? '필터 초기화' : '첫 제보 남기기',
                h(ArrowRight, { size: 16 }))),
        mode === 'actual' && !loading && !error && h(Fragment, null,
            h("p", { className: "result-note" },
                "\uC804\uCCB4 \uAC80\uC0C9 \uACB0\uACFC ",
                total,
                "\uAC74 \uC911 ",
                reports.length,
                "\uAC74\uC744 \uBD88\uB7EC\uC654\uC5B4\uC694."),
            nextCursor && h("div", { className: "load-more" },
                h("button", { className: "btn", disabled: loadingMore, onClick: () => load(true) },
                    loadingMore ? h(LoaderCircle, { className: "spin", size: 16 }) : h(Plus, { size: 16 }),
                    "\uC81C\uBCF4 \uB354 \uBD88\uB7EC\uC624\uAE30"))));
    return h("div", { className: "app-shell" },
        h(Toaster, { richColors: true, position: "bottom-center", theme: "light" }),
        h("header", { className: "topbar" },
            h("a", { className: "brand", href: appHome() },
                h("span", { className: "brand-icon" },
                    h(Shirt, { size: 23 })),
                h("span", null,
                    "\uC758\uB958\uC218\uAC70\uD568 ",
                    h("b", null, "\uC9C0\uD0B4\uC774"))),
            h("span", { className: "header-caption" }, "\uD568\uAED8 \uB3CC\uBCF4\uB294 \uC6B0\uB9AC \uB3D9\uB124"),
            h("button", { className: "btn primary header-report", onClick: () => startReport() },
                h(Plus, { size: 18 }),
                h("span", null, "\uC0C8 \uC81C\uBCF4"))),
        h(Tabs, { value: view, onValueChange: changeView, className: "main-tabs" },
            h("div", { className: "nav-wrap" },
                h(TabsList, { variant: "line", className: "main-nav" },
                    h(TabsTrigger, { value: "neighborhood" },
                        h(MapPin, { size: 17 }),
                        "\uC6B0\uB9AC \uB3D9\uB124"),
                    h(TabsTrigger, { value: "mine" },
                        h(ClipboardList, { size: 17 }),
                        "\uB0B4 \uC81C\uBCF4"),
                    h(TabsTrigger, { value: "bins" },
                        h(Box, { size: 17 }),
                        "\uC218\uAC70\uD568 \uAD00\uB9AC"),
                    h(TabsTrigger, { value: "intakes" },
                        h(Inbox, { size: 17 }),
                        "\uC811\uC218 \uB0B4\uC5ED"),
                    h(TabsTrigger, { value: "admin" },
                        h(ClipboardList, { size: 17 }),
                        "\uC6B4\uC601\uC790"),
                    h(TabsTrigger, { value: "guide" },
                        h(BookOpen, { size: 17 }),
                        "\uC774\uC6A9 \uC548\uB0B4")),
                h("span", { className: "nav-note" },
                    h(Leaf, { size: 14 }),
                    "\uC791\uC740 \uAD00\uC2EC\uC774 \uB9CC\uB4DC\uB294 \uAE68\uB057\uD55C \uB3D9\uB124")),
            h("main", { className: "main" },
                h(TabsContent, { value: "neighborhood" },
                    h("div", { className: "page-heading" },
                        h("div", null,
                            h("div", { className: "eyebrow" }, "OUR NEIGHBORHOOD"),
                            h("h1", null, "\uC6B0\uB9AC \uB3D9\uB124 \uC218\uAC70\uD568"),
                            h("p", null, "\uC9C0\uB098\uCE58\uB358 \uC218\uAC70\uD568\uC5D0, \uC791\uC740 \uAD00\uC2EC\uC744 \uB354\uD574\uC694.")),
                        h(Tabs, { value: mode, onValueChange: v => { setMode(v); setCategory('all'); setStatus('all'); setQuery(''); } },
                            h(TabsList, { className: "mode-switch" },
                                h(TabsTrigger, { value: "actual" }, "\uC2E4\uC81C \uC81C\uBCF4"),
                                h(TabsTrigger, { value: "example" }, "\uC608\uC2DC \uB458\uB7EC\uBCF4\uAE30")))),
                    error && h("div", { className: "error-banner", role: "alert" },
                        h("span", null, error),
                        h("button", { className: "text-button", onClick: () => load() },
                            h(RotateCw, { size: 15 }),
                            "\uB2E4\uC2DC \uBD88\uB7EC\uC624\uAE30")),
                    mode === 'example' && h("div", { className: "example-banner" },
                        h("span", null,
                            h("span", { className: "sample-tag" }, "\uB458\uB7EC\uBCF4\uAE30"),
                            "\uC544\uB798 4\uAC74\uC740 \uC774\uC6A9 \uBC29\uBC95\uC744 \uBCF4\uC5EC\uC8FC\uB294 \uAC00\uC0C1 \uC81C\uBCF4\uC608\uC694."),
                        h("button", { onClick: () => { setMode('actual'); startReport(); } },
                            "\uB0B4 \uB3D9\uB124 \uC81C\uBCF4 \uB0A8\uAE30\uAE30",
                            h(ArrowRight, { size: 14 }))),
                    mode === 'actual' && lastSynced && h("p", { className: "connection-state" },
                        h(Check, { size: 13 }),
                        "\uC800\uC7A5\uC18C\uC5D0\uC11C \uBD88\uB7EC\uC634 \u00B7 ",
                        new Date(lastSynced).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                        error ? ' · 연결 재확인 필요' : ''),
                    h("div", { className: "stats-strip" },
                        h("div", null,
                            h("span", { className: "stat-icon" },
                                h(MapPin, { size: 21 })),
                            h("span", null,
                                "\uBAA8\uC544 \uBCF8 \uC81C\uBCF4",
                                h("strong", null,
                                    mode === 'actual' && (loading || (!lastSynced && !!error)) ? '—' : mode === 'actual' ? summary.total : scoped.length,
                                    h("small", null, "\uAC74")))),
                        h("div", null,
                            h("span", { className: "stat-icon orange" },
                                h(Box, { size: 21 })),
                            h("span", null,
                                "\uAD00\uC2EC\uC774 \uD544\uC694\uD55C \uACF3",
                                h("strong", null,
                                    mode === 'actual' && (loading || (!lastSynced && !!error)) ? '—' : openCount,
                                    h("small", null, "\uACF3")))),
                        h("div", null,
                            h("span", { className: "stat-icon green" },
                                h(Check, { size: 21 })),
                            h("span", null,
                                "\uC81C\uBCF4\uC790\uAC00 \uD655\uC778\uD55C \uD574\uACB0",
                                h("strong", null,
                                    mode === 'actual' && (loading || (!lastSynced && !!error)) ? '—' : resolvedCount,
                                    h("small", null, "\uAC74")))),
                        h("span", { className: "stats-caption" }, mode === 'example' ? '예시 제보 기준' : '전체 저장 제보 기준')),
                    mode === 'actual' && h(Fragment, null,
                        h(CatalogSummary, { meta: catalog.meta, loading: catalog.loading, error: catalog.error, onRetry: () => { catalog.reloadData(); catalog.refresh(); } }),
                        h(CatalogControls, { bins: catalog.bins, filters: binFilters, onChange: setBinFilters })),
                    h("section", { className: "workspace" },
                        h("div", { className: "map-panel" },
                            mode === 'actual' ? h(MapCanvas, { bins: mappedBins, onBinSelect: openBin, center: center, focusKey: JSON.stringify(binFilters) }) : h(MapCanvas, { reports: filtered, onSelect: setSelected, center: center }),
                            h("div", { className: "map-top-label" },
                                h(MapPin, { size: 16 }),
                                mode === 'example' ? '서울 마포구 · 예시 위치' : '공공자료 + 시민 기록',
                                h("span", null,
                                    (mode === 'actual' ? mappedBins.filter(hasCoordinates).length : filtered.filter(r => r.latitude !== null).length).toLocaleString(),
                                    "\uACF3")),
                            h("button", { className: "map-locate", title: "\uD604\uC7AC \uC704\uCE58\uB85C \uC774\uB3D9", "aria-label": "\uD604\uC7AC \uC704\uCE58\uB85C \uC774\uB3D9", disabled: locating, onClick: locate }, locating ? h(LoaderCircle, { size: 19, className: "spin" }) : h(LocateFixed, { size: 19 })),
                            h(TrafficLegend, null),
                            mode === 'actual' && !catalog.loading && !mappedBins.some(hasCoordinates) && h("div", { className: "map-empty-notice" },
                                "\uC9C0\uB3C4\uC5D0 \uD45C\uC2DC\uD560 \uC88C\uD45C\uAC00 \uC5C6\uC5B4\uC694.",
                                h("br", null),
                                h("span", null, "\uAC80\uC0C9 \uC870\uAC74\uC744 \uBC14\uAFB8\uAC70\uB098 \uC218\uAC70\uD568 \uAE30\uB85D\uC5D0\uC11C \uC88C\uD45C \uBBF8\uC81C\uACF5 \uD56D\uBAA9\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694."))),
                        h("aside", { className: "right-column" },
                            h("div", { className: "report-cta" },
                                h("span", { className: "icon-tile" },
                                    h(Camera, { size: 27 })),
                                h("h2", null,
                                    "\uBC1C\uACAC\uD588\uB098\uC694?",
                                    h("br", null),
                                    "\uC0AC\uC9C4 \uD55C \uC7A5\uC774\uBA74 \uB3FC\uC694."),
                                h("p", null,
                                    "\uB118\uCE5C \uC637, \uC8FC\uBCC0 \uC4F0\uB808\uAE30, \uD30C\uC190\uB41C \uC218\uAC70\uD568.",
                                    h("br", null),
                                    "\uC9C0\uAE08 \uBCF8 \uBAA8\uC2B5\uC744 \uC54C\uB824 \uC8FC\uC138\uC694."),
                                h("button", { className: "btn primary", onClick: () => startReport() },
                                    "\uC0AC\uC9C4\uC73C\uB85C \uC81C\uBCF4\uD558\uAE30",
                                    h(ArrowUpRight, { size: 18 })),
                                h("div", { className: "cta-footnote" }, "\uC0AC\uC9C4 \uD655\uC778\uBD80\uD130 \uBBFC\uC6D0 \uCD08\uC548\uAE4C\uC9C0")),
                            h("button", { className: "guide-shortcut", onClick: () => changeView('guide') },
                                h("span", { className: "small-guide-icon" },
                                    h(ClipboardList, { size: 21 })),
                                h("div", null,
                                    h("b", null, "\uBBFC\uC6D0 \uC811\uC218, \uC5B4\uB5BB\uAC8C \uD558\uB098\uC694?"),
                                    h("span", null, "\uCC28\uADFC\uCC28\uADFC \uC54C\uB824\uB4DC\uB9B4\uAC8C\uC694")),
                                h(ChevronRight, { size: 18 })))),
                    mode === 'actual' && h("section", { className: "bin-preview-section" },
                        h("div", { className: "section-heading" },
                            h("h2", null,
                                "\uC218\uAC70\uD568\uBCC4 \uAE30\uB85D ",
                                h("span", null,
                                    mappedBins.length.toLocaleString(),
                                    "\uACF3")),
                            h("button", { className: "text-button", onClick: () => changeView('bins') },
                                "\uC804\uCCB4 \uBAA9\uB85D\u00B7\uCEE4\uBBA4\uB2C8\uD2F0 \uBCF4\uAE30 ",
                                h(ArrowRight, { size: 16 }))),
                        h("div", { className: "report-grid" }, previewBins.map(b => h(BinCard, { key: b.id, bin: b, onOpen: openBin }))),
                        h("p", { className: "field-hint" }, "\uACF5\uACF5\uC790\uB8CC\uB294 \uC6D0\uBCF8 CSV\uC758 15\uAC1C \uC2DC\uB3C4\u00B738\uAC1C \uC2DC\uAD70\uAD6C \uC218\uB85D \uBC94\uC704\uC785\uB2C8\uB2E4. \uC790\uB8CC\uC5D0 \uC5C6\uB2E4\uB294 \uC774\uC720\uB9CC\uC73C\uB85C \uBBF8\uB4F1\uB85D\u00B7\uBD88\uBC95 \uC218\uAC70\uD568\uC73C\uB85C \uD310\uB2E8\uD558\uC9C0 \uC54A\uC544\uC694.")),
                    " ",
                    h("section", { className: "reports-section" },
                        h("div", { className: "section-heading" },
                            h("h2", null,
                                "\uB3D9\uB124 \uC81C\uBCF4 ",
                                h("span", null, mode === 'actual' ? total : filtered.length)),
                            h("button", { className: "text-button", onClick: () => load(), disabled: loading },
                                h(RotateCw, { size: 15, className: loading ? 'spin' : '' }),
                                "\uC0C8\uB85C\uACE0\uCE68")),
                        h("div", { className: "filter-bar" },
                            h("div", { className: "search-field" },
                                h(Search, { size: 18 }),
                                h("input", { "aria-label": "\uC8FC\uC18C \uB610\uB294 \uC81C\uBCF4 \uB0B4\uC6A9 \uAC80\uC0C9", placeholder: "\uC8FC\uC18C\uB098 \uC81C\uBCF4 \uB0B4\uC6A9\uC73C\uB85C \uCC3E\uC544\uBCF4\uC138\uC694", maxLength: 200, value: query, onChange: e => setQuery(e.target.value) }),
                                query && h("button", { "aria-label": "\uAC80\uC0C9\uC5B4 \uC9C0\uC6B0\uAE30", onClick: () => setQuery('') }, "\u00D7")),
                            h(Select, { value: category, onValueChange: setCategory },
                                h(SelectTrigger, { "aria-label": "\uC218\uAC70\uD568 \uC0C1\uD0DC \uD544\uD130", className: "filter-select" },
                                    h(SelectValue, null)),
                                h(SelectContent, null,
                                    h(SelectItem, { value: "all" }, "\uBAA8\uB4E0 \uC218\uAC70\uD568 \uC0C1\uD0DC"),
                                    Object.entries(categories).map(([k, c]) => h(SelectItem, { key: k, value: k }, c.label)))),
                            h(Select, { value: status, onValueChange: setStatus },
                                h(SelectTrigger, { "aria-label": "\uC9C4\uD589 \uC0C1\uD0DC \uD544\uD130", className: "filter-select" },
                                    h(SelectValue, null)),
                                h(SelectContent, null,
                                    h(SelectItem, { value: "all" }, "\uBAA8\uB4E0 \uC9C4\uD589 \uC0C1\uD0DC"),
                                    Object.entries(statuses).map(([k, v]) => h(SelectItem, { key: k, value: k }, v))))),
                        cards)),
                h(TabsContent, { value: "mine" },
                    h("div", { className: "page-heading" },
                        h("div", null,
                            h("div", { className: "eyebrow" }, "MY SMALL ACTIONS"),
                            h("h1", null, "\uB0B4\uAC00 \uB0A8\uAE34 \uC81C\uBCF4"),
                            h("p", null, "\uB0B4 \uC81C\uBCF4\uC758 \uBCC0\uD654\uC640 \uBBFC\uC6D0 \uCD08\uC548\uC744 \uD55C\uACF3\uC5D0\uC11C \uD655\uC778\uD574\uC694.")),
                        h("button", { className: "btn primary", onClick: () => startReport() },
                            h(Plus, { size: 17 }),
                            "\uC81C\uBCF4 \uB0A8\uAE30\uAE30")),
                    error && h("div", { className: "error-banner", role: "alert" },
                        error,
                        h("button", { className: "text-button", onClick: () => load() }, "\uB2E4\uC2DC \uBD88\uB7EC\uC624\uAE30")),
                    cards),
                h(TabsContent, { value: "bins" },
                    h(BinDirectory, { onSelect: setSelected, onOpen: openBin })),
                h(TabsContent, { value: "intakes" },
                    h(IntakeHistory, null)),
                h(TabsContent, { value: "admin" },
                    h(OperatorGate, null,
                        h(IntakeHistory, { admin: true }))),
                h(TabsContent, { value: "guide" },
                    h("div", { className: "page-heading" },
                        h("div", null,
                            h("div", { className: "eyebrow" }, "A LITTLE HELP"),
                            h("h1", null, "\uC81C\uBCF4\uC5D0\uC11C \uBBFC\uC6D0 \uC811\uC218\uAE4C\uC9C0"),
                            h("p", null, "\uC0AC\uC9C4\uC740 \uC27D\uAC8C, \uC811\uC218\uB294 \uC815\uD655\uD558\uAC8C. \uC138 \uB2E8\uACC4\uB85C \uD568\uAED8\uD574\uC694."))),
                    h("div", { className: "guide-grid" }, [{ n: '01', icon: Camera, title: '사진과 위치를 남겨요', text: '수거함과 주변이 함께 보이는 사진을 올려 주세요. 주소를 입력하고, 원하면 지도에 위치도 표시할 수 있어요.' }, { n: '02', icon: ScanLine, title: '수거함 상태를 확인해요', text: '사진 모델이 넘침, 주변 적치, 파손·노후, 양호 상태를 비교해요. 제안이 맞는지 확인하고 필요하면 직접 수정해 주세요.' }, { n: '03', icon: ClipboardList, title: '저장과 동시에 자동 접수해요', text: '마지막 단계에서 자동 작성된 민원을 확인하면 제보 저장과 함께 운영자 접수함에 등록돼요. 연계가 준비된 지역은 기관 자동 접수도 가능해요. 결과와 접수번호는 접수 내역에서 확인해요.' }].map(x => h("article", { className: "guide-card", key: x.n },
                        h("span", { className: "guide-number" }, x.n),
                        h(x.icon, { size: 29 }),
                        h("h2", null, x.title),
                        h("p", null, x.text)))),
                    h("div", { className: "guide-bottom" },
                        h("div", null,
                            h("h2", null, "\uC0AC\uC9C4\uB9CC\uC73C\uB85C \uC54C \uC218 \uC5C6\uB294 \uAC83\uB3C4 \uC788\uC5B4\uC694."),
                            h("p", null, "\uC0AC\uC9C4 \uBD84\uB958\uB294 \uBC94\uC6A9 CLIP \uBAA8\uB378\uC744 \uD65C\uC6A9\uD55C \uC2E4\uD5D8\uC801 \uC81C\uC548\uC774\uC5D0\uC694. \uC124\uCE58 \uD5C8\uAC00 \uC5EC\uBD80, \uAD00\uB9AC \uC8FC\uCCB4, \uBD88\uBC95 \uC5EC\uBD80\uB294 \uD310\uB2E8\uD558\uC9C0 \uC54A\uC544\uC694. \uACB0\uACFC\uB97C \uD604\uC7A5 \uC0C1\uD669\uACFC \uBE44\uAD50\uD574 \uC8FC\uC138\uC694."),
                            h("p", null, "\uC790\uB3D9 \uBD84\uB958\uAC00 \uB290\uB9AC\uAC70\uB098 \uC2E4\uD589\uB418\uC9C0 \uC54A\uC73C\uBA74 \uC9C1\uC811 \uC0C1\uD0DC\uB97C \uC120\uD0DD\uD560 \uC218 \uC788\uC5B4\uC694. \uCCAB \uC774\uC6A9 \uC2DC \uBAA8\uB378 \uD30C\uC77C\uC744 \uB0B4\uB824\uBC1B\uC73C\uBBC0\uB85C Wi-Fi \uC774\uC6A9\uC744 \uAD8C\uC7A5\uD574\uC694."),
                            h("a", { className: "text-button", href: "https://huggingface.co/Xenova/clip-vit-base-patch32", target: "_blank", rel: "noreferrer" },
                                "\uC0AC\uC9C4 \uBD84\uB958 \uBAA8\uB378 \uC815\uBCF4",
                                h(ArrowUpRight, { size: 16 }))),
                        h("div", { className: "guide-privacy" },
                            h("h3", null, "\uC81C\uBCF4\uD560 \uB54C \uAE30\uC5B5\uD574 \uC8FC\uC138\uC694"),
                            h("ul", null,
                                h("li", null, "\uC0AC\uC9C4 \uC120\uD0DD \uC2DC \uC5BC\uAD74\u00B7\uBB38\uC790\uB97C \uC790\uB3D9\uC73C\uB85C \uAC00\uB824\uC694. \uB193\uCE5C \uBD80\uBD84\uC740 \uC800\uC7A5 \uC804 \uD655\uC778\uD558\uACE0 \uCD94\uAC00\uB85C \uAC00\uB824 \uC8FC\uC138\uC694."),
                                h("li", null, "\uC0AC\uC9C4\uACFC \uC8FC\uC18C, \uBA54\uBAA8\uB294 \uC0AC\uC774\uD2B8 \uC774\uC6A9\uC790\uC5D0\uAC8C \uBCF4\uC5EC\uC694."),
                                h("li", null, "\uB0B4 \uC81C\uBCF4\uC5D0\uC11C \uC0C1\uD0DC \uBCC0\uACBD\uACFC \uC0AD\uC81C\uAC00 \uAC00\uB2A5\uD574\uC694."),
                                h("li", null, "\uC571 \uC800\uC7A5\uACFC \uAE30\uAD00 \uBBFC\uC6D0 \uC811\uC218\uB294 \uBCC4\uAC1C\uC608\uC694.")),
                            h("button", { className: "btn primary", onClick: () => startReport() },
                                "\uC0AC\uC9C4\uC73C\uB85C \uC81C\uBCF4 \uC2DC\uC791",
                                h(ArrowRight, { size: 17 }))))),
                h("footer", { className: "footer" },
                    h("span", null,
                        h(Shirt, { size: 16 }),
                        "\uC758\uB958\uC218\uAC70\uD568 \uC9C0\uD0B4\uC774"),
                    h("p", null, "\uC6B0\uB9AC \uB3D9\uB124\uB97C \uBC14\uAFB8\uB294 \uAC74, \uC791\uC740 \uAD00\uC2EC \uD558\uB098."),
                    h("span", { className: "footer-right" }, "\uC2DC\uBBFC \uAD00\uCC30 \uAE30\uB85D \u00B7 \uAE30\uAD00 \uC811\uC218\uB294 \uBCC4\uB3C4")))),
        h(ReportForm, { open: form, initialBin: draftBin, maintenance: maintenance, onOpenChange: setForm, onSaved: (r, intakeSaved) => {
                catalog.refresh();
                if (draftBin && !intakeSaved) {
                    setSelectedBin(r.bin_id || draftBin.id);
                    setSelected(null);
                    latestLoad.current();
                    return;
                }
                setReports(prev => [r, ...prev.filter(x => x.id !== r.id)]);
                setMode('actual');
                setCategory('all');
                setStatus('all');
                setQuery('');
                setView(intakeSaved ? 'intakes' : 'mine');
                setSelected(intakeSaved ? null : r);
                if (view === 'mine')
                    latestLoad.current();
            } }),
        h(BinDetail, { id: selectedBin, onClose: () => setSelectedBin(null), onReport: b => startReport(b, false), onMaintenance: b => startReport(b, true), onReportSelect: r => { setSelectedBin(null); setSelected(r); } }),
        h(ReportDetail, { report: selected, onClose: () => setSelected(null), onUpdated: updated, onDeleted: id => { setReports(prev => prev.filter(r => r.id !== id)); latestLoad.current(); } }));
}
export default function KeeperApp() { return h(CatalogProvider, null,
    h(InnerKeeperApp, null)); }
