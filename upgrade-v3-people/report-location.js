import { h, Fragment, useEffect, useRef, useState, MapPin, LocateFixed, LoaderCircle, Check, appAsset } from './runtime.js';
import MapCanvas from './map-canvas.js';
import { lookupRegion } from './region-client.js';
import { hasCoordinates, nearbyBins as findNearby } from './bin-model.js';
import { distanceMeters } from './keeper-features.js';
import { validLocationPoint, freshLocation, canContinueLocation } from './location-model.js';
const EMPTY_REPORTS = [];
const sourceLabels = { photo: '사진 GPS', device: '현재 기기 위치', map: '지도에서 선택', bin: '선택한 수거함', manual: '직접 입력' };
export function useReportLocation({ open, initialBin }) {
    const [state, setState] = useState(() => freshLocation(initialBin));
    const current = useRef(state), alive = useRef(false), revision = useRef(0), photoToken = useRef(0), deviceToken = useRef(0), request = useRef(null);
    function commit(next) {
        if (!alive.current)
            return;
        const value = typeof next === 'function' ? next(current.current) : next;
        current.current = value;
        setState(value);
    }
    function cancelLookup() { ++revision.current; request.current?.abort(); request.current = null; }
    function cancelDevice() { ++deviceToken.current; }
    function resolvePoint(point) {
        cancelLookup();
        if (!validLocationPoint(point))
            return;
        const token = revision.current, controller = new AbortController();
        request.current = controller;
        commit(s => ({ ...s, status: 'loading', region: null, message: '' }));
        lookupRegion(point, { signal: controller.signal }).then(result => {
            if (!alive.current || revision.current !== token)
                return;
            commit(s => {
                const keepAddress = s.addressKind === 'manual' || s.addressKind === 'bin';
                const resolved = result.status === 'done';
                return { ...s, status: result.status, region: result.region || null, version: result.version || '',
                    address: keepAddress ? s.address : resolved ? result.region.name : '',
                    manual: keepAddress ? s.manual : !resolved,
                    message: resolved ? '' : result.status === 'ambiguous' ?
                        '행정구역 경계에 걸리거나 여러 지역과 겹쳐요. 지역을 직접 확인해 주세요.' :
                        '이 좌표의 행정동을 확인하지 못했어요. 지도 위치를 확인하거나 지역을 입력해 주세요.' };
            });
        }).catch(e => {
            if (e.name === 'AbortError' || !alive.current || revision.current !== token)
                return;
            commit(s => ({ ...s, status: 'error', region: null, manual: !s.address || s.manual, message: e.message }));
        });
    }
    function applyPoint(point, source = 'map', { bin = null, accuracy = null } = {}) {
        cancelDevice();
        cancelLookup();
        ++photoToken.current;
        if (point !== null && !validLocationPoint(point)) {
            commit(s => ({ ...s, message: '좌표 형식이 올바르지 않아요. 지도에서 다시 선택해 주세요.' }));
            return;
        }
        commit(s => ({ ...s, point, source, binId: bin?.id || '', address: bin?.address || '', addressKind: bin ? 'bin' : 'auto',
            conflict: null, region: null, status: 'idle', message: '', manual: !point && !bin?.address,
            showMap: source === 'map' || s.showMap, accuracy, locating: false }));
        if (point)
            resolvePoint(point);
    }
    useEffect(() => {
        alive.current = true;
        cancelLookup();
        cancelDevice();
        ++photoToken.current;
        const next = freshLocation(initialBin);
        current.current = next;
        setState(next);
        if (open && next.point)
            resolvePoint(next.point);
        if (!open)
            alive.current = false;
        return () => { alive.current = false; cancelLookup(); cancelDevice(); ++photoToken.current; };
    }, [open, initialBin?.id]);
    return {
        state, linkedBinId: state.binId, canContinue: canContinueLocation(state),
        beginPhoto() {
            cancelLookup();
            cancelDevice();
            const token = ++photoToken.current;
            commit(s => s.source === 'photo' ? { ...freshLocation(), gps: 'reading' } :
                { ...s, gps: 'reading', conflict: null, locating: false, status: s.status === 'loading' ? 'idle' : s.status });
            return token;
        },
        photoResult(gps, token) {
            if (!alive.current || token !== photoToken.current)
                return;
            const usable = validLocationPoint(gps) && !(gps[0] === 0 && gps[1] === 0);
            if (!usable) {
                commit(s => ({ ...s, gps: gps ? 'invalid' : 'missing', manual: !s.address, showMap: !s.point || s.showMap }));
                const s = current.current;
                if (s.point && s.status === 'idle')
                    resolvePoint(s.point);
                return;
            }
            const s = current.current;
            if (s.point && s.source !== 'photo') {
                const distance = distanceMeters(gps, s.point);
                commit(v => ({ ...v, gps: 'found', conflict: distance > 50 ? { point: gps, distance } : null }));
                if (s.status === 'idle')
                    resolvePoint(s.point);
            }
            else {
                applyPoint(gps, 'photo');
                commit(v => ({ ...v, gps: 'found', showMap: false }));
            }
        },
        photoFailed(token) {
            if (token === photoToken.current)
                commit(s => ({ ...s, gps: 'idle' }));
        },
        pickPoint(point) { applyPoint(point, 'map'); },
        selectBin(bin) {
            if (!bin) {
                applyPoint(current.current.point, 'map');
                return;
            }
            applyPoint(hasCoordinates(bin) ? [bin.latitude, bin.longitude] : current.current.point, 'bin', { bin });
        },
        editAddress(value) { commit(s => ({ ...s, address: value, addressKind: 'manual' })); },
        showManual() { commit(s => ({ ...s, manual: true })); },
        toggleMap() { commit(s => ({ ...s, showMap: !s.showMap })); },
        addressOnly() {
            applyPoint(null, 'manual');
            commit(s => ({ ...s, manual: true, showMap: false }));
        },
        retry() { if (current.current.point)
            resolvePoint(current.current.point); },
        keepLocation() { commit(s => ({ ...s, conflict: null })); },
        usePhotoLocation() { const p = current.current.conflict?.point; if (p) {
            applyPoint(p, 'photo');
            commit(s => ({ ...s, gps: 'found' }));
        } },
        locate() {
            if (!navigator.geolocation) {
                commit(s => ({ ...s, message: '위치 기능을 지원하지 않는 브라우저예요. 지도나 지역 입력을 이용해 주세요.', manual: !s.address }));
                return;
            }
            const token = ++deviceToken.current;
            commit(s => ({ ...s, locating: true, message: '' }));
            navigator.geolocation.getCurrentPosition(p => {
                if (!alive.current || token !== deviceToken.current)
                    return;
                applyPoint([p.coords.latitude, p.coords.longitude], 'device', { accuracy: p.coords.accuracy });
            }, () => {
                if (!alive.current || token !== deviceToken.current)
                    return;
                commit(s => ({ ...s, locating: false, message: '현재 위치를 가져오지 못했어요. 지도에서 선택하거나 지역을 입력해 주세요.', manual: !s.address, showMap: !s.point || s.showMap }));
            }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
        }
    };
}
export function PhotoLocationHint({ location }) {
    const s = location.state;
    if (s.gps === 'idle')
        return h("p", { className: "field-hint gps-before-upload" }, "\uC0AC\uC9C4\uC5D0 GPS\uAC00 \uC788\uC73C\uBA74 \uB3D9\u00B7\uAD6C\uB97C \uC790\uB3D9\uC73C\uB85C \uD655\uC778\uD574\uC694. \uC5C6\uC73C\uBA74 \uB2E4\uC74C \uB2E8\uACC4\uC5D0\uC11C \uC9C0\uB3C4\uB098 \uC9C0\uC5ED \uC785\uB825\uC744 \uC774\uC6A9\uD558\uC138\uC694.");
    return h("div", { className: "gps-photo-hint", "aria-live": "polite" },
        h(MapPin, { size: 17 }),
        h("span", null, s.gps === 'reading' ? '사진의 GPS 정보를 확인하고 있어요.' :
            s.conflict ? '사진 GPS와 선택한 위치가 달라요. 다음 단계에서 확인해 주세요.' :
                s.gps === 'found' ? (s.status === 'done' ? `사진 GPS 확인 · ${s.region?.name || s.address}` : '사진 GPS를 찾았어요. 다음 단계에서 수거함 위치를 확인해 주세요.') :
                    s.source === 'bin' ? '사진 GPS가 없어 선택한 수거함 위치를 사용해요.' :
                        s.point ? '사진 GPS가 없어 직접 선택한 위치를 유지했어요.' :
                            '사진에 사용할 GPS가 없어요. 다음 단계에서 지도나 지역 입력으로 위치를 알려 주세요.'));
}
export default function ReportLocation({ location, catalog }) {
    const s = location.state, linkedBin = catalog.byId.get(s.binId), nearby = findNearby(catalog.bins, s.point);
    return h("section", { className: "report-location", "aria-label": "\uC218\uAC70\uD568 \uC704\uCE58 \uC790\uB3D9 \uD655\uC778" },
        h("div", { className: "field-label-row" },
            h("h3", { className: "field-label" },
                "\uC218\uAC70\uD568 \uC704\uCE58 ",
                h("span", null, "\uD544\uC218")),
            h("button", { className: "text-button", type: "button", disabled: s.locating, onClick: location.locate },
                s.locating ? h(LoaderCircle, { size: 16, className: "spin" }) : h(LocateFixed, { size: 16 }),
                "\uD604\uC7AC \uC704\uCE58")),
        s.conflict && h("div", { className: "location-conflict", role: "alert" },
            h("b", null,
                "\uC0AC\uC9C4 GPS\uC640 \uC120\uD0DD\uD55C \uC704\uCE58\uAC00 \uC57D ",
                Math.round(s.conflict.distance).toLocaleString(),
                "m \uB5A8\uC5B4\uC838 \uC788\uC5B4\uC694."),
            h("p", null, "\uB2E4\uB978 \uC218\uAC70\uD568 \uAE30\uB85D\uC5D0 \uC798\uBABB \uC5F0\uACB0\uB418\uC9C0 \uC54A\uB3C4\uB85D \uC2E4\uC81C \uD604\uC7A5 \uC704\uCE58\uB97C \uACE8\uB77C \uC8FC\uC138\uC694."),
            h("div", { className: "row wrap" },
                h("button", { type: "button", className: "btn", onClick: location.keepLocation }, "\uC120\uD0DD\uD55C \uC704\uCE58 \uC720\uC9C0"),
                h("button", { type: "button", className: "btn primary", onClick: location.usePhotoLocation }, "\uC0AC\uC9C4 \uC704\uCE58 \uC0AC\uC6A9"))),
        h("div", { className: `location-result ${s.status === 'done' ? 'located' : ''}`, "aria-live": "polite" },
            h("span", { className: "location-source" },
                h(MapPin, { size: 15 }),
                sourceLabels[s.source] || '위치 확인 대기',
                s.status === 'loading' && h(LoaderCircle, { size: 14, className: "spin" })),
            h("strong", null, s.address || (s.status === 'loading' ? '좌표로 동·구를 확인하고 있어요' : '수거함이 있는 지역을 알려 주세요')),
            s.status === 'done' && h("p", null,
                h(Check, { size: 14 }),
                "\uD589\uC815\uB3D9 \uAE30\uC900 \uC790\uB3D9 \uD655\uC778 \u00B7 ",
                s.region?.name),
            s.point && h("small", null,
                "\uC704\uB3C4 ",
                s.point[0].toFixed(6),
                " \u00B7 \uACBD\uB3C4 ",
                s.point[1].toFixed(6),
                Number.isFinite(s.accuracy) ? ` · 기기 위치 오차 약 ${Math.round(s.accuracy)}m` : ''),
            s.source === 'device' && h("p", null, "\uD604\uC7AC \uAE30\uAE30 \uC704\uCE58\uC608\uC694. \uC608\uC804\uC5D0 \uCC0D\uC740 \uC0AC\uC9C4\uC758 \uCD2C\uC601 \uC704\uCE58\uC640\uB294 \uB2E4\uB97C \uC218 \uC788\uC5B4\uC694."),
            s.status === 'loading' && h("p", null, "\uCCAB \uC870\uD68C\uB294 \uACF5\uAC1C \uACBD\uACC4\uC790\uB8CC \uB2E4\uC6B4\uB85C\uB4DC\uB85C \uC2DC\uAC04\uC774 \uAC78\uB9B4 \uC218 \uC788\uC5B4\uC694. \uAE30\uB2E4\uB9AC\uC9C0 \uC54A\uACE0 \uC9C0\uC5ED\uC744 \uC9C1\uC811 \uC785\uB825\uD574\uB3C4 \uB3FC\uC694."),
            s.message && h("p", { className: "location-warning" }, s.message),
            ['error', 'outside', 'ambiguous'].includes(s.status) && s.point && h("button", { type: "button", className: "text-button", onClick: location.retry }, "\uC9C0\uC5ED \uC790\uB3D9 \uD655\uC778 \uB2E4\uC2DC \uC2DC\uB3C4"),
            !s.point && h("p", null, "\uC0AC\uC9C4\uC5D0 GPS\uAC00 \uC5C6\uAC70\uB098 \uC704\uCE58\uB97C \uC9C0\uC6E0\uC5B4\uC694. \uC9C0\uB3C4\uC5D0\uC11C \uC815\uD655\uD55C \uACF3\uC744 \uACE0\uB974\uAC70\uB098 \uC9C0\uC5ED\uB9CC \uC785\uB825\uD560 \uC218 \uC788\uC5B4\uC694.")),
        h("div", { className: "location-actions row wrap" },
            h("button", { type: "button", className: "btn", "aria-expanded": s.showMap, onClick: location.toggleMap }, s.showMap ? '지도 접기' : s.point ? '지도에서 확인·수정' : '지도에서 위치 선택'),
            !s.manual && h("button", { type: "button", className: "text-button", onClick: location.showManual }, "\uC9C0\uC5ED \uC9C1\uC811 \uC785\uB825\u00B7\uC218\uC815"),
            s.point && h("button", { type: "button", className: "text-button", onClick: location.addressOnly }, "\uC88C\uD45C \uC9C0\uC6B0\uACE0 \uC9C0\uC5ED\uB9CC \uC785\uB825")),
        s.showMap && h(Fragment, null,
            h("div", { className: "pick-map" },
                h(MapCanvas, { compact: true, reports: EMPTY_REPORTS, point: s.point, onPick: location.pickPoint })),
            h("p", { className: "field-hint" }, "\uC9C0\uB3C4\uB97C \uB204\uB974\uBA74 \uADF8 \uC704\uCE58\uC758 \uB3D9\u00B7\uAD6C\uB97C \uB2E4\uC2DC \uD655\uC778\uD574\uC694. \uD604\uC7AC \uC704\uCE58 \uAD8C\uD55C\uC740 \uC704 \uBC84\uD2BC\uC744 \uB204\uB97C \uB54C\uB9CC \uC694\uCCAD\uD574\uC694.")),
        s.manual && h("div", { className: "location-manual" },
            h("label", { className: "field-label", htmlFor: "address" }, "\uC9C0\uC5ED \uB610\uB294 \uC8FC\uC18C"),
            h("input", { id: "address", className: "text-input", maxLength: 200, value: s.address, onChange: e => location.editAddress(e.target.value), placeholder: "\uC608: \uC11C\uC6B8\uD2B9\uBCC4\uC2DC \uB9C8\uD3EC\uAD6C \uC5F0\uB0A8\uB3D9", autoComplete: "street-address" }),
            h("p", { className: "field-hint" }, s.point ? '선택한 좌표는 유지하고 지역 표기를 수정해요. 다른 장소라면 지도 위치도 바꿔 주세요.' :
                '지역만 입력하면 정확한 수거함 좌표를 알 수 없어 지도에 임의의 핀을 찍거나 기존 수거함과 자동 연결하지 않아요.')),
        (nearby.length > 0 || linkedBin) && h("div", { className: "location-bin-match" },
            h("label", { className: "field-label", htmlFor: "bin-link" }, "\uAC00\uAE4C\uC6B4 \uAE30\uC874 \uC218\uAC70\uD568\uACFC \uC5F0\uACB0"),
            h("select", { id: "bin-link", className: "text-input", value: s.binId, onChange: e => location.selectBin(catalog.byId.get(e.target.value) || null) },
                h("option", { value: "" }, "\uAC19\uC740 \uC218\uAC70\uD568 \uC5C6\uC74C \u00B7 \uC0C8 \uC218\uAC70\uD568\uC73C\uB85C \uAE30\uB85D"),
                linkedBin && !nearby.some(b => b.id === linkedBin.id) && h("option", { value: linkedBin.id },
                    linkedBin.address,
                    " \u00B7 \uC120\uD0DD\uD55C \uC218\uAC70\uD568"),
                nearby.slice(0, 30).map(b => h("option", { key: b.id, value: b.id },
                    b.address,
                    " \u00B7 ",
                    b.origin === 'citizen' ? '시민 발견' : '공공자료',
                    " \u00B7 \uC57D ",
                    Math.round(b.distance),
                    "m"))),
            h("p", { className: "field-hint" }, "50m \uC774\uB0B4 \uD6C4\uBCF4\uC608\uC694. \uAC19\uC740 \uC218\uAC70\uD568\uC778\uC9C0 \uD655\uC778\uD558\uACE0 \uC120\uD0DD\uD558\uBA74 \uB4F1\uB85D\uB41C \uC704\uCE58\uB97C \uC0AC\uC6A9\uD558\uACE0, \uADF8 \uC218\uAC70\uD568\uC758 \uC81C\uBCF4\u00B7\uB313\uAE00\u00B7\uC815\uBE44 \uC774\uB825\uC5D0 \uC5F0\uACB0\uB3FC\uC694. \uAC70\uB9AC\uAC00 \uAC00\uAE5D\uB2E4\uB294 \uC774\uC720\uB9CC\uC73C\uB85C \uC790\uB3D9 \uBCD1\uD569\uD558\uC9C0 \uC54A\uC544\uC694.")),
        s.point && nearby.length === 0 && !linkedBin && !catalog.loading && h("p", { className: "field-hint" }, "50m \uC774\uB0B4 \uC5F0\uACB0 \uD6C4\uBCF4\uAC00 \uC5C6\uC5B4\uC694. \uACF5\uACF5\uC790\uB8CC\uC5D0 \uC5C6\uB294 \uC0C8 \uC218\uAC70\uD568\uC73C\uB85C \uAE30\uB85D\uD560 \uC218 \uC788\uC5B4\uC694."),
        h("small", { className: "location-attribution" },
            "\uD589\uC815\uB3D9\u00B7\uC74D\u00B7\uBA74 \uACBD\uACC4: SGIS / vuski\u00B7admdongkor \u00B7 ",
            s.version || '2026-07-01',
            " \uAE30\uC900 \u00B7 ",
            h("a", { href: appAsset('data/REGION-SOURCES.md'), target: "_blank", rel: "noreferrer" }, "\uC790\uB8CC\u00B7\uC774\uC6A9 \uC870\uAC74"),
            h("br", null),
            "\uBC95\uC815\uB3D9\u00B7\uB3C4\uB85C\uBA85 \uC0C1\uC138\uC8FC\uC18C\uC640 \uB2E4\uB97C \uC218 \uC788\uC5B4\uC694. \uC790\uB3D9 \uC9C0\uC5ED \uD655\uC778\uC744 \uC704\uD574 \uC0AC\uC9C4\uC774\uB098 \uC88C\uD45C\uB97C \uACBD\uACC4\uC790\uB8CC \uC11C\uBC84\uC5D0 \uBCF4\uB0B4\uC9C0 \uC54A\uC544\uC694."));
}
