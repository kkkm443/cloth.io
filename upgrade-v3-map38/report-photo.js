import { h, Fragment } from './runtime.js';
"use client";
import { useEffect, useState } from './runtime.js';
import { apiRequest } from './api.js';
export default function ReportPhoto({ id, alt, download = false }) {
    const [url, setUrl] = useState(''), [error, setError] = useState(''), [retry, setRetry] = useState(0);
    useEffect(() => {
        let alive = true, u = '';
        const ac = new AbortController();
        setUrl('');
        setError('');
        apiRequest(`/api/photos/${id}`, { signal: ac.signal }).then(async (r) => {
            if (!r.ok)
                throw new Error('사진을 불러오지 못했어요.');
            const blob = await r.blob();
            if (alive) {
                u = URL.createObjectURL(blob);
                setUrl(u);
            }
        }).catch(e => {
            if (alive && e.name !== 'AbortError')
                setError(e.message);
        });
        return () => {
            alive = false;
            ac.abort();
            if (u)
                URL.revokeObjectURL(u);
        };
    }, [id, retry]);
    if (error)
        return h("button", { className: "text-button", onClick: () => setRetry(x => x + 1) },
            error,
            " \uB2E4\uC2DC \uC2DC\uB3C4");
    if (download)
        return url ? h("a", { className: "text-button download-photo", href: url, download: "\uC758\uB958\uC218\uAC70\uD568-\uD604\uC7A5\uC0AC\uC9C4.jpg" }, "\uD604\uC7A5 \uC0AC\uC9C4 \uB0B4\uB824\uBC1B\uAE30") : h("span", { className: "field-hint" }, "\uC0AC\uC9C4\uC744 \uC900\uBE44\uD558\uACE0 \uC788\uC5B4\uC694\u2026");
    return url ? h("img", { src: url, alt: alt || '수거함 현장 사진' }) : h("div", { className: "sample-photo" }, "\uC0AC\uC9C4\uC744 \uBD88\uB7EC\uC624\uACE0 \uC788\uC5B4\uC694\u2026");
}
