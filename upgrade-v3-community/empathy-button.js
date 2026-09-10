import { h, Fragment, useEffect, useState, useRef, LoaderCircle } from './runtime.js';
import { subscribeEmpathy, setEmpathy } from './community-service.js';
import { EmpathyIcon } from './community-icons.js';
export default function EmpathyButton({ binId, type, id }) {
    const [state, setState] = useState({ count: 0, mine: false }), [loading, setLoading] = useState(true), [error, setError] = useState(''), [busy, setBusy] = useState(false), [retry, setRetry] = useState(0);
    const lock = useRef(false), alive = useRef(true);
    useEffect(() => {
        alive.current = true;
        setLoading(true);
        setError('');
        setState({ count: 0, mine: false });
        const off = subscribeEmpathy(binId, type, id, s => { if (alive.current) {
            setState(s);
            setLoading(false);
            setError('');
        } }, e => { if (alive.current) {
            setError(e);
            setLoading(false);
        } });
        return () => { alive.current = false; off(); };
    }, [binId, type, id, retry]);
    useEffect(() => {
        if (!busy)
            return;
        const block = e => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', block);
        window.addEventListener('keeper-before-signout', block);
        return () => { window.removeEventListener('beforeunload', block); window.removeEventListener('keeper-before-signout', block); };
    }, [busy]);
    async function press() {
        if (lock.current || loading)
            return;
        lock.current = true;
        setBusy(true);
        setError('');
        try {
            await setEmpathy({ binId, type, id, active: !state.mine });
        }
        catch (e) {
            if (alive.current)
                setError(e.message);
        }
        finally {
            lock.current = false;
            if (alive.current)
                setBusy(false);
        }
    }
    return h("span", { className: "empathy-control", "data-target": type + ':' + id },
        h("button", { type: "button", className: 'empathy-button' + (state.mine ? ' is-active' : ''), "aria-pressed": state.mine, "aria-label": busy ? '공감 저장 중' : `공감 ${state.count}개${state.mine ? ' · 취소하기' : ''}`, title: "\uACF5\uAC10\uC740 \uAD00\uC2EC \uD45C\uD604\uC774\uBA70 \uD604\uC7A5 \uD655\uC778\uC774\uB098 \uC704\uD5D8\uB3C4 \uD3C9\uAC00\uAC00 \uC544\uB2C8\uC5D0\uC694.", disabled: loading || busy || !!error, onClick: press },
            busy ? h(LoaderCircle, { size: 16, className: "spin" }) : h(EmpathyIcon, { filled: state.mine }),
            h("span", null, busy ? '저장 중' : '공감'),
            h("b", null, loading ? '…' : error ? '—' : state.count)),
        error && h("span", { className: "empathy-error", role: "alert" },
            "\uACF5\uAC10\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694.",
            h("button", { type: "button", className: "text-button", title: error + ' 새 커뮤니티 Firebase 규칙을 확인해 주세요.', onClick: () => setRetry(n => n + 1) }, "\uB2E4\uC2DC \uC5F0\uACB0")));
}
