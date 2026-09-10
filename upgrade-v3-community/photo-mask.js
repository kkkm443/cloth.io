import { h, Fragment } from './runtime.js';
"use client";
import { useEffect, useRef, useState } from './runtime.js';
// Only the current unsaved photo is editable. Its clean pixels never leave this device.
export default function PhotoMask({ url, initialRegions = [], onApply, onCancel }) {
    const canvas = useRef(null), base = useRef(null), start = useRef(null), alive = useRef(false);
    const [rects, setRects] = useState([]), [history, setHistory] = useState([]), [mode, setMode] = useState('add');
    const [error, setError] = useState(''), [busy, setBusy] = useState(false), [ready, setReady] = useState(false), [zoom, setZoom] = useState(1), [inspected, setInspected] = useState(false);
    function draw(boxes = rects) {
        const c = canvas.current, im = base.current;
        if (!c || !im)
            return;
        const ctx = c.getContext('2d');
        if (!ctx)
            return;
        ctx.drawImage(im, 0, 0, c.width, c.height);
        ctx.fillStyle = '#273b36';
        for (const b of boxes)
            ctx.fillRect(b.x, b.y, b.w, b.h);
    }
    useEffect(() => {
        alive.current = true;
        let live = true;
        const im = new Image();
        setReady(false);
        setRects([]);
        setHistory([]);
        setInspected(false);
        setError('');
        setZoom(1);
        im.onload = () => {
            if (!live)
                return;
            const c = canvas.current;
            if (!c)
                return;
            base.current = im;
            c.width = im.naturalWidth;
            c.height = im.naturalHeight;
            const boxes = initialRegions.filter(b => b && [b.x, b.y, b.w, b.h].every(Number.isFinite) && b.x >= 0 && b.y >= 0 && b.w > 0 && b.h > 0 && b.x + b.w <= c.width && b.y + b.h <= c.height).map(b => ({ ...b }));
            setRects(boxes);
            draw(boxes);
            setReady(true);
        };
        im.onerror = () => {
            if (live)
                setError('사진을 열지 못했어요. 닫고 다시 시도해 주세요.');
        };
        im.src = url;
        return () => { live = false; alive.current = false; im.onload = null; im.onerror = null; base.current = null; start.current = null; };
    }, [url]);
    useEffect(() => { draw(); }, [rects]);
    function change(next) { setHistory(old => [...old.slice(-49), rects]); setRects(next); setInspected(false); }
    function point(e) { const c = e.currentTarget, b = c.getBoundingClientRect(); return [Math.max(0, Math.min(c.width, (e.clientX - b.left) * c.width / b.width)), Math.max(0, Math.min(c.height, (e.clientY - b.top) * c.height / b.height))]; }
    function box(a, b) { return { x: Math.floor(Math.min(a[0], b[0])), y: Math.floor(Math.min(a[1], b[1])), w: Math.floor(Math.abs(b[0] - a[0])), h: Math.floor(Math.abs(b[1] - a[1])), kind: 'manual' }; }
    function apply() {
        if (!ready || !inspected || busy)
            return;
        const c = canvas.current;
        if (!c)
            return;
        setBusy(true);
        draw();
        c.toBlob(b => {
            if (!alive.current)
                return;
            setBusy(false);
            if (b)
                onApply(b, rects.map(r => ({ ...r })));
            else
                setError('사진을 저장하지 못했어요.');
        }, 'image/jpeg', .9);
    }
    return h("div", { className: "photo-editor people-mask-editor" },
        h("h3", null, '사람 가리기 확인·수정'),
        h("p", null, '놓친 사람은 드래그해 가려 주세요. 잘못 가린 부분은 지우기로 전환한 뒤 눌러 제거할 수 있어요.'),
        h("div", { className: "row wrap", role: "group", "aria-label": "\uAC00\uB9AC\uAE30 \uD3B8\uC9D1 \uB3C4\uAD6C" },
            h("button", { type: "button", className: 'btn ' + (mode === 'add' ? 'primary' : ''), "aria-pressed": mode === 'add', disabled: busy, onClick: () => { start.current = null; setMode('add'); } }, '가리기 추가'),
            h("button", { type: "button", className: 'btn ' + (mode === 'remove' ? 'primary' : ''), "aria-pressed": mode === 'remove', disabled: busy, onClick: () => { start.current = null; setMode('remove'); } }, '잘못 가린 영역 지우기')),
        h("label", { className: "photo-zoom" },
            '사진 확대 ',
            zoom.toFixed(1),
            '배',
            h("input", { type: "range", min: "1", max: "3", step: ".25", value: zoom, onChange: e => setZoom(Number(e.target.value)) })),
        h("div", { className: "photo-editor-scroll" },
            h("canvas", { ref: canvas, style: { width: `${zoom * 100}%`, touchAction: 'none', cursor: mode === 'remove' ? 'pointer' : 'crosshair' }, "aria-label": "\uC0AC\uB78C \uAC00\uB9AC\uAE30 \uD3B8\uC9D1\uAE30", onPointerDown: e => {
                    if (!ready || busy)
                        return;
                    const p = point(e);
                    if (mode === 'remove') {
                        const index = rects.findLastIndex(b => p[0] >= b.x && p[0] <= b.x + b.w && p[1] >= b.y && p[1] <= b.y + b.h);
                        if (index >= 0)
                            change(rects.filter((_, i) => i !== index));
                        return;
                    }
                    setInspected(false);
                    start.current = p;
                    e.currentTarget.setPointerCapture(e.pointerId);
                }, onPointerMove: e => {
                    if (start.current)
                        draw([...rects, box(start.current, point(e))]);
                }, onPointerUp: e => {
                    if (start.current) {
                        const b = box(start.current, point(e));
                        start.current = null;
                        if (b.w > 3 && b.h > 3 && rects.length < 500)
                            change([...rects, b]);
                        else
                            draw();
                    }
                }, onPointerCancel: () => { start.current = null; draw(); } })),
        h("p", { className: "field-hint", "aria-live": "polite" },
            '가리는 영역 ',
            rects.length,
            '곳 · 저장하기 전의 사진에서만 수정할 수 있어요.'),
        rects.length > 0 && h("details", { className: "people-mask-list" },
            h("summary", null, '영역별로 지우기'),
            h("div", { className: "row wrap" }, rects.map((b, i) => h("button", { type: "button", className: "btn", disabled: busy, key: i, onClick: () => change(rects.filter((_, n) => n !== i)) },
                b.kind === 'person' ? '사람' : b.kind === 'face' ? '얼굴' : '직접',
                " ",
                i + 1,
                " ",
                '×')))),
        h("label", { className: "consent" },
            h("input", { type: "checkbox", disabled: !ready || busy, checked: inspected, onChange: e => setInspected(e.target.checked) }),
            h("span", null, '사진 전체를 살펴보고 사람을 필요한 만큼 가렸어요. 사람이 없는 경우에도 직접 확인했어요.')),
        h("div", { className: "row wrap" },
            h("button", { type: "button", className: "btn", disabled: busy || !history.length, onClick: () => { setRects(history.at(-1)); setHistory(h => h.slice(0, -1)); setInspected(false); } }, '한 단계 되돌리기'),
            h("button", { type: "button", className: "btn", disabled: busy, onClick: onCancel }, '취소'),
            h("button", { type: "button", className: "btn primary", disabled: busy || !ready || !inspected, onClick: apply }, '수정한 사진 적용')),
        error && h("p", { role: "alert" }, error));
}
