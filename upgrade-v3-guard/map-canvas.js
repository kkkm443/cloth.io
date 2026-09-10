import { h, Fragment, useEffect, useRef, useState, getRuntime, MapPin } from './runtime.js';
import { levels, hasCoordinates } from './bin-model.js';
const EMPTY = [];
export default function MapCanvas(props) { return props.compact || props.bins === undefined ? h(getRuntime().OriginalMapCanvas, props) : h(BinMap, { ...props }); }
function BinMap({ bins = EMPTY, onBinSelect, onSelect, center, focusKey = '' }) {
    const el = useRef(null), map = useRef(null), api = useRef(null), layer = useRef(null), latest = useRef(bins), actions = useRef(onBinSelect), draw = useRef(() => { }), initialFit = useRef(false), lastFocus = useRef(null);
    latest.current = bins;
    actions.current = onBinSelect || onSelect;
    const [ready, setReady] = useState(false), [error, setError] = useState(false), [visible, setVisible] = useState(0);
    useEffect(() => {
        let disposed = false, observer;
        getRuntime().loadLeaflet().then(L => {
            if (disposed || !el.current)
                return;
            api.current = L;
            const m = L.map(el.current, { zoomControl: false, scrollWheelZoom: true, preferCanvas: true }).setView([36.2, 127.6], 7);
            map.current = m;
            // Leaflet 1.9.x leaves a 250ms zoom-transition callback queued after remove().
            // Reset its flag on unload so rapid tab changes retain smooth zoom without
            // allowing the stale callback to access the removed map pane.
            m.on('unload', () => { m._animatingZoom = false; });
            L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>' }).addTo(m).on('tileerror', () => setError(true));
            L.control.zoom({ position: 'bottomright' }).addTo(m);
            layer.current = L.layerGroup().addTo(m);
            draw.current = () => {
                if (!layer.current)
                    return;
                layer.current.clearLayers();
                const bounds = m.getBounds().pad(.12), zoom = m.getZoom(), size = zoom < 12 ? 64 : zoom < 16 ? 46 : 18;
                const groups = new Map();
                let count = 0;
                for (const b of latest.current) {
                    if (!hasCoordinates(b) || !bounds.contains([b.latitude, b.longitude]))
                        continue;
                    count++;
                    const p = m.project([b.latitude, b.longitude], zoom), key = `${Math.floor(p.x / size)}:${Math.floor(p.y / size)}`;
                    if (!groups.has(key))
                        groups.set(key, []);
                    groups.get(key).push(b);
                }
                setVisible(count);
                for (const list of groups.values()) {
                    const lat = list.reduce((s, b) => s + b.latitude, 0) / list.length, lon = list.reduce((s, b) => s + b.longitude, 0) / list.length;
                    const rank = { unknown: 0, observe: 1, recommend: 2, urgent: 3 }, level = list.reduce((best, b) => rank[b.level] > rank[best] ? b.level : best, 'unknown'), color = levels[level].color, multiple = list.length > 1, citizen = !multiple && list[0].origin === 'citizen';
                    const icon = L.divIcon({ className: multiple ? 'traffic-map-marker bin-cluster' : `traffic-map-marker bin-single ${citizen ? 'citizen' : ''}`, html: multiple ? `<span style="--traffic:${color}">${list.length.toLocaleString('ko-KR')}</span>` : `<span style="--traffic:${color}"></span>`, iconSize: multiple ? [42, 42] : [23, 23], iconAnchor: multiple ? [21, 21] : [11, 11] });
                    const title = multiple ? `수거함 ${list.length}곳 · ${levels[level].label} 포함` : `${list[0].title} · ${list[0].score == null ? '상태 미확인' : list[0].score + '점 ' + levels[level].label}`;
                    const marker = L.marker([lat, lon], { icon, title, keyboard: true, zIndexOffset: multiple ? 0 : rank[level] * 10 }).addTo(layer.current);
                    marker.on('click', () => {
                        if (!multiple) {
                            actions.current?.(list[0]);
                            return;
                        }
                        const box = L.latLngBounds(list.map(b => [b.latitude, b.longitude]));
                        if (m.getZoom() < 18) {
                            m.fitBounds(box, { padding: [45, 45], maxZoom: Math.max(m.getZoom() + 2, 16) });
                            return;
                        }
                        const panel = document.createElement('div');
                        panel.className = 'coincident-bin-list';
                        const heading = document.createElement('strong');
                        heading.textContent = `겹쳐 표시된 수거함 ${list.length}곳`;
                        panel.append(heading);
                        let amount = 0;
                        const more = document.createElement('button');
                        more.textContent = '더 보기';
                        more.type = 'button';
                        const add = () => { for (const b of list.slice(amount, amount + 25)) {
                            const button = document.createElement('button');
                            button.type = 'button';
                            button.textContent = `${b.title} · ${b.address} · ${levels[b.level].label}`;
                            button.addEventListener('click', () => { m.closePopup(); actions.current?.(b); });
                            panel.insertBefore(button, more);
                        } amount += 25; more.hidden = amount >= list.length; };
                        panel.append(more);
                        more.onclick = add;
                        add();
                        L.popup({ maxWidth: 320 }).setLatLng([lat, lon]).setContent(panel).openOn(m);
                    });
                }
            };
            m.on('moveend zoomend', () => draw.current());
            observer = new ResizeObserver(() => { m.invalidateSize(); draw.current(); });
            observer.observe(el.current);
            setReady(true);
            draw.current();
        }).catch(() => setError(true));
        return () => { disposed = true; observer?.disconnect(); map.current?.remove(); map.current = null; };
    }, []);
    useEffect(() => { if (!ready || !map.current || !api.current)
        return; const valid = bins.filter(hasCoordinates); if (valid.length && (!initialFit.current || lastFocus.current !== focusKey)) {
        initialFit.current = true;
        lastFocus.current = focusKey;
        map.current.fitBounds(api.current.latLngBounds(valid.map(b => [b.latitude, b.longitude])), { padding: [50, 50], maxZoom: 16 });
    } draw.current(); }, [ready, bins, focusKey]);
    useEffect(() => { if (ready && center && map.current)
        map.current.setView(center, 16); }, [ready, center]);
    return h("div", { className: "map-wrap" },
        h("div", { ref: el, className: "leaflet-surface", "aria-label": "\uC804\uAD6D \uC758\uB958\uC218\uAC70\uD568 \uC9C0\uB3C4" }),
        !ready && h("div", { className: "map-loading" },
            h(MapPin, null),
            h("span", null, error ? '지도를 불러오지 못했어요' : '수거함 지도를 준비하고 있어요')),
        ready && error && h("div", { className: "map-network-note" }, "\uBC30\uACBD \uC9C0\uB3C4 \uC5F0\uACB0\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694. \uC218\uAC70\uD568 \uBAA9\uB85D\uACFC \uAE30\uB85D\uC740 \uACC4\uC18D \uC774\uC6A9\uD560 \uC218 \uC788\uC5B4\uC694."),
        h("span", { className: "map-viewport-note" },
            "\uD604\uC7AC \uD654\uBA74 ",
            visible.toLocaleString(),
            "\uACF3 \u00B7 \uC22B\uC790\uB97C \uB20C\uB7EC \uD655\uB300"));
}
