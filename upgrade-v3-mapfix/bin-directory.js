import { h, Fragment, useState, useEffect, useMemo, useRef, RotateCw, Download, Upload } from './runtime.js';
import { useCatalog } from './catalog.js';
import { CatalogSummary, CatalogControls, BinCard, TrafficLegend, emptyFilters } from './bin-ui.js';
import { filterBins, hasCoordinates, maintenanceTime } from './bin-model.js';
import { downloadJSON } from './keeper-features.js';
import { featureRequest } from './api.js';
import MapCanvas from './map-canvas.js';
export default function BinDirectory({ onOpen }) {
    const catalog = useCatalog(), [filters, setFilters] = useState({ ...emptyFilters }), [page, setPage] = useState(1), [operator, setOperator] = useState(false), [error, setError] = useState(''), [importing, setImporting] = useState(false), input = useRef(null);
    useEffect(() => { let live = true; featureRequest('config').then(v => { if (live)
        setOperator(!!v.config?.operator); }).catch(() => { }); return () => { live = false; }; }, []);
    const bins = useMemo(() => filterBins(catalog.bins, filters).sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || (a.latest?.created_at ?? 0) - (b.latest?.created_at ?? 0) || a.address.localeCompare(b.address, 'ko')), [catalog.bins, filters]);
    useEffect(() => setPage(1), [filters]);
    const pages = Math.max(1, Math.ceil(bins.length / 24)), activePage = Math.min(page, pages), shown = bins.slice((activePage - 1) * 24, activePage * 24);
    async function importRows(file) { if (!file)
        return; setImporting(true); setError(''); try {
        if (file.size > 2 * 1024 * 1024)
            throw new Error('2MB 이하 JSON 파일을 선택해 주세요.');
        const rows = JSON.parse(await file.text());
        await featureRequest('registry', { method: 'PUT', body: JSON.stringify({ rows }) });
        await catalog.refresh();
    }
    catch (e) {
        setError(e.message || '공공자료를 가져오지 못했어요.');
    }
    finally {
        setImporting(false);
    } }
    return h(Fragment, null,
        h("div", { className: "page-heading" },
            h("div", null,
                h("div", { className: "eyebrow" }, "CARE, OVER TIME"),
                h("h1", null, "\uC218\uAC70\uD568\uBCC4 \uAE30\uB85D\uACFC \uCEE4\uBBA4\uB2C8\uD2F0"),
                h("p", null, "\uACF5\uACF5 \uC704\uCE58 \uC790\uB8CC \uC704\uC5D0 \uC2DC\uBBFC\uC758 \uAD00\uCC30, \uC815\uBE44, \uC758\uACAC\uC744 \uCC28\uACE1\uCC28\uACE1 \uBAA8\uC544\uC694.")),
            h("button", { className: "btn", onClick: catalog.refresh, disabled: catalog.syncing },
                h(RotateCw, { size: 16 }),
                "\uC0C8\uB85C\uACE0\uCE68")),
        h(CatalogSummary, { meta: catalog.meta, loading: catalog.loading, error: catalog.error, onRetry: () => { catalog.reloadData(); catalog.refresh(); } }),
        h(CatalogControls, { bins: catalog.bins, filters: filters, onChange: setFilters, showCoordinates: true }),
        h("div", { className: "directory-map" },
            h(MapCanvas, { bins: bins, onSelect: onOpen, focusKey: JSON.stringify(filters) })),
        h(TrafficLegend, null),
        h("div", { className: "directory-toolbar" },
            h("p", null,
                "\uAC80\uC0C9 \uACB0\uACFC ",
                h("b", null,
                    bins.length.toLocaleString(),
                    "\uACF3"),
                " \u00B7 \uC9C0\uB3C4 \uD45C\uC2DC \uAC00\uB2A5 ",
                bins.filter(hasCoordinates).length.toLocaleString(),
                "\uACF3"),
            h("button", { className: "btn", onClick: () => downloadJSON(bins.map(b => ({ bin_id: b.id, address: b.address, source: b.origin, score: b.score, status: b.level, reports: b.reportCount, last_observed: b.latest?.created_at ?? null, last_maintenance: maintenanceTime(b.lastMaintenance) || null, latitude: b.latitude, longitude: b.longitude })), '수거함-정비우선순위.json') },
                h(Download, { size: 16 }),
                "\uD604\uC7AC \uBAA9\uB85D \uC800\uC7A5")),
        h("p", { className: "field-hint" }, "\uB192\uC740 \uCC38\uACE0 \uC810\uC218\uBD80\uD130 \uD45C\uC2DC\uD569\uB2C8\uB2E4. \uC88C\uD45C \uBBF8\uC81C\uACF5 \uD56D\uBAA9\uB3C4 \uAC80\uC0C9\uD558\uACE0 \uAE30\uB85D\uD560 \uC218 \uC788\uC73C\uBA70, \uACF5\uACF5\uC790\uB8CC\uC5D0 \uC5C6\uB294 \uC218\uAC70\uD568\uC774\uB77C\uACE0 \uBD88\uBC95\uC73C\uB85C \uD310\uB2E8\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4."),
        !bins.length && !catalog.loading && h("div", { className: "empty-state" }, "\uC870\uAC74\uC5D0 \uB9DE\uB294 \uC218\uAC70\uD568\uC774 \uC5C6\uC5B4\uC694. \uC9C0\uC5ED\uC774\uB098 \uC704\uD5D8\uB3C4 \uD544\uD130\uB97C \uBC14\uAFD4 \uC8FC\uC138\uC694."),
        h("div", { className: "bin-card-grid" }, shown.map(b => h(BinCard, { key: b.id, bin: b, onOpen: onOpen }))),
        pages > 1 && h("nav", { className: "directory-pagination", "aria-label": "\uC218\uAC70\uD568 \uBAA9\uB85D \uD398\uC774\uC9C0" },
            h("button", { className: "btn", onClick: () => setPage(Math.max(1, activePage - 1)), disabled: activePage === 1 }, "\uC774\uC804"),
            h("span", null,
                activePage,
                " / ",
                pages,
                "\uD398\uC774\uC9C0 \u00B7 \uD55C \uD398\uC774\uC9C0 24\uACF3"),
            h("button", { className: "btn", onClick: () => setPage(Math.min(pages, activePage + 1)), disabled: activePage === pages }, "\uB2E4\uC74C")),
        operator && h("details", { className: "history-card registry-tools" },
            h("summary", null, "\uC6B4\uC601\uC790 \uACF5\uACF5 \uC704\uCE58 \uC790\uB8CC \uCD94\uAC00 \uC5F0\uACB0"),
            h("p", null, "\uC804\uAD6D \uD45C\uC900\uB370\uC774\uD130\uB294 \uAE30\uBCF8 \uD0D1\uC7AC\uB418\uC5B4 \uC788\uC5B4\uC694. \uCD94\uAC00\uB85C \uD655\uC778\uD55C \uACF5\uACF5\uC790\uB8CC\uB9CC \uAC00\uC838\uC624\uC138\uC694. \uAE30\uC874 ID\uB294 \uAC31\uC2E0\uD558\uBA70 \uB2E4\uB978 ID\uC640 \uC2DC\uBBFC \uAE30\uB85D\uC740 \uC720\uC9C0\uD569\uB2C8\uB2E4."),
            h("input", { ref: input, type: "file", hidden: true, accept: "application/json,.json", onChange: e => { importRows(e.target.files?.[0]); e.target.value = ''; } }),
            error && h("p", { className: "error-box", role: "alert" }, error),
            h("div", { className: "row wrap" },
                h("button", { className: "btn", disabled: importing, onClick: () => input.current?.click() },
                    h(Upload, { size: 16 }),
                    importing ? '가져오는 중…' : '공공자료 JSON 가져오기'),
                h("button", { className: "btn", onClick: () => downloadJSON([{ id: 'official-unique-id', address: '공식 자료의 실제 주소', latitude: 37.5, longitude: 127, source: 'https://www.data.go.kr/', checked: '2026-09-10' }], '공공자료-입력양식.json') }, "\uC785\uB825 \uC591\uC2DD \uBC1B\uAE30")),
            h("p", { className: "field-hint" }, "\uC591\uC2DD\uC758 \uC608\uC2DC \uC88C\uD45C\uB97C \uADF8\uB300\uB85C \uB4F1\uB85D\uD558\uC9C0 \uB9C8\uC138\uC694.")));
}
