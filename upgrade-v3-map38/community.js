import { h, Fragment, useEffect, useState, useRef, toast, LoaderCircle, Trash2 } from './runtime.js';
import { subscribeCommunity, sendCommunity, deleteCommunity, topics, featureRequest } from './api.js';
import { displayTime } from './bin-model.js';
import EmpathyButton from './empathy-button.js';
export default function Community({ bin, onMaintenance, focusPostId = '' }) {
    const [items, setItems] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [retry, setRetry] = useState(0), [text, setText] = useState(''), [topic, setTopic] = useState('general'), [busy, setBusy] = useState(false), [limit, setLimit] = useState(20), [operator, setOperator] = useState(false);
    const requestId = useRef(crypto.randomUUID());
    useEffect(() => { setLoading(true); setError(''); return subscribeCommunity(bin.id, d => { setItems(d); setLoading(false); setError(''); }, e => { setError(e); setLoading(false); }); }, [bin.id, retry]);
    useEffect(() => { let active = true; featureRequest('config').then(d => { if (active)
        setOperator(!!d.config?.operator); }).catch(() => { }); return () => { active = false; }; }, []);
    useDraftGuard(text, busy);
    const posts = items.filter(x => !x.parent_id);
    useEffect(() => { if (!focusPostId || loading)
        return; const index = posts.findIndex(p => p.id === focusPostId); if (index >= 0) {
        setLimit(n => Math.max(n, index + 1));
        const t = setTimeout(() => document.getElementById('post-' + focusPostId)?.scrollIntoView({ block: 'nearest' }), 150);
        return () => clearTimeout(t);
    } }, [focusPostId, loading, items]);
    async function send(e) { e.preventDefault(); if (busy)
        return; setBusy(true); setError(''); try {
        await sendCommunity({ binId: bin.id, text, topic, id: requestId.current });
        requestId.current = crypto.randomUUID();
        setText('');
        setTopic('general');
        toast.success('이 수거함의 게시판에 저장했어요.');
    }
    catch (e) {
        setError(e.message);
    }
    finally {
        setBusy(false);
    } }
    return h("section", { className: "bin-community" },
        h("div", { className: "section-heading" },
            h("h3", null,
                "\uC218\uAC70\uD568\uBCC4 \uCEE4\uBBA4\uB2C8\uD2F0 ",
                h("span", null, loading ? '—' : posts.filter(p => !p.deleted).length)),
            h("span", { className: "field-hint" }, "\uAC19\uC740 \uC218\uAC70\uD568\uC758 \uAE00\u00B7\uB313\uAE00\uC774 \uBAA8\uC5EC\uC694")),
        h("p", { className: "field-hint" }, "\uC758\uACAC\uB9CC\uC73C\uB85C \uC704\uD5D8\uB3C4\uB098 \uC815\uBE44 \uC0C1\uD0DC\uAC00 \uC790\uB3D9 \uBCC0\uACBD\uB418\uC9C0\uB294 \uC54A\uC544\uC694. \uD604\uC7A5\uC774 \uC815\uB9AC\uB418\uC5C8\uB2E4\uBA74 \uC0C8 \uC0AC\uC9C4\uACFC \uD568\uAED8 \uC815\uBE44 \uC644\uB8CC\uB97C \uAE30\uB85D\uD574 \uC8FC\uC138\uC694."),
        h("div", { className: "community-topics" }, Object.entries(topics).filter(([k]) => k !== 'general').map(([k, label]) => h("button", { key: k, className: topic === k ? 'selected' : '', disabled: busy, onClick: () => { setTopic(k); if (!text || Object.values(topics).includes(text))
                setText(label); } }, label))),
        h("form", { onSubmit: send },
            h("label", { className: "field-label", htmlFor: "bin-community-text" }, "\uAC8C\uC2DC\uAE00 \uB0A8\uAE30\uAE30"),
            h("textarea", { id: "bin-community-text", className: "text-input", value: text, disabled: busy, onChange: e => setText(e.target.value), maxLength: 1200, rows: 3, placeholder: "\uC9C0\uAE08 \uBCF8 \uBAA8\uC2B5\uC774\uB098 \uAD00\uB9AC \uC0C1\uD669\uC744 \uC774\uC6C3\uC5D0\uAC8C \uC54C\uB824 \uC8FC\uC138\uC694. \uAC1C\uC778\uC815\uBCF4\uB294 \uC801\uC9C0 \uB9D0\uC544 \uC8FC\uC138\uC694." }),
            h("div", { className: "community-compose-footer" },
                h("span", null,
                    text.length,
                    " / 1,200"),
                h("button", { className: "btn primary", disabled: busy || text.trim().length < 2 || loading },
                    busy ? h(LoaderCircle, { size: 16, className: "spin" }) : null,
                    busy ? '서버에 저장 중' : '게시글 등록'))),
        topic === 'cleaned' && h("button", { className: "btn", onClick: onMaintenance }, "\uC0C8 \uC0AC\uC9C4\uC73C\uB85C \uC815\uBE44 \uC644\uB8CC \uAE30\uB85D\uD558\uAE30"),
        error && h("div", { className: "error-box", role: "alert" },
            error,
            h("p", null, "\uC0C8 \uBC84\uC804\uC758 Firebase \uADDC\uCE59\uC774 \uC801\uC6A9\uB418\uC5C8\uB294\uC9C0 \uD655\uC778\uD574 \uC8FC\uC138\uC694. \uC2E4\uD328\uD55C \uAE00\uC740 \uC785\uB825\uCC3D\uC5D0 \uB0A8\uACA8 \uB450\uC5C8\uC5B4\uC694."),
            h("button", { className: "text-button", onClick: () => setRetry(x => x + 1) }, "\uAC8C\uC2DC\uD310 \uB2E4\uC2DC \uC5F0\uACB0")),
        loading ? h("p", { role: "status" }, "\uC774 \uC218\uAC70\uD568\uC758 \uAC8C\uC2DC\uAE00\uC744 \uBD88\uB7EC\uC624\uACE0 \uC788\uC5B4\uC694\u2026") : !posts.length && !error ? h("div", { className: "community-empty" }, "\uC544\uC9C1 \uC758\uACAC\uC774 \uC5C6\uC5B4\uC694. \uC774 \uC218\uAC70\uD568\uC758 \uCCAB \uAE30\uB85D\uC744 \uB0A8\uACA8 \uC8FC\uC138\uC694.") : null,
        h("div", { className: "community-posts" }, posts.slice(0, limit).map(post => h(CommunityPost, { key: post.id, post: post, replies: items.filter(x => x.parent_id === post.id).reverse(), binId: bin.id, operator: operator, focused: post.id === focusPostId }))),
        posts.length > limit && h("button", { className: "btn", onClick: () => setLimit(n => n + 20) }, "\uC774\uC804 \uAC8C\uC2DC\uAE00 \uB354 \uBCF4\uAE30"));
}
function CommunityPost({ post, replies, binId, operator, focused = false }) {
    const [open, setOpen] = useState(focused), [text, setText] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const requestId = useRef(crypto.randomUUID());
    useDraftGuard(text, busy);
    useEffect(() => { if (focused)
        setOpen(true); }, [focused]);
    async function reply(e) { e.preventDefault(); if (busy)
        return; setBusy(true); setError(''); try {
        await sendCommunity({ binId, text, parentId: post.id, id: requestId.current });
        requestId.current = crypto.randomUUID();
        setText('');
    }
    catch (e) {
        setError(e.message);
    }
    finally {
        setBusy(false);
    } }
    async function remove(item) { if (!window.confirm('이 글의 내용을 삭제할까요? 기존 댓글은 남습니다.'))
        return; setBusy(true); setError(''); try {
        await deleteCommunity(binId, item.id);
    }
    catch (e) {
        setError(e.message);
    }
    finally {
        setBusy(false);
    } }
    return h("article", { id: 'post-' + post.id, className: 'community-post' + (focused ? ' activity-focused' : '') },
        h("div", { className: "between" },
            h("span", { className: "community-author" },
                post.nickname,
                post.isMine ? ' · 내 글' : ''),
            h("time", null, displayTime(post.created_at))),
        post.deleted ? h("p", { className: "deleted-post" }, "\uC0AD\uC81C\uB41C \uAC8C\uC2DC\uAE00\uC785\uB2C8\uB2E4.") : h(Fragment, null,
            h("span", { className: "community-topic" }, topics[post.topic] || topics.general),
            h("p", { className: "community-body" }, post.text)),
        h("div", { className: "community-actions" },
            !post.deleted && h(EmpathyButton, { binId: binId, type: "posts", id: post.id }),
            h("button", { className: "text-button", onClick: () => setOpen(!open) },
                "\uB313\uAE00 ",
                replies.filter(x => !x.deleted).length,
                "\uAC1C ",
                open ? '접기' : '보기 · 남기기'),
            !post.deleted && (post.isMine || operator) && h("button", { className: "text-button", "aria-label": "\uAC8C\uC2DC\uAE00 \uC0AD\uC81C", disabled: busy, onClick: () => remove(post) },
                h(Trash2, { size: 13 }),
                "\uC0AD\uC81C")),
        open && h("div", { className: "community-replies" },
            replies.map(reply => h("article", { className: "community-reply", key: reply.id },
                h("div", { className: "between" },
                    h("b", null,
                        reply.nickname,
                        reply.isMine ? ' · 나' : ''),
                    h("time", null, displayTime(reply.created_at))),
                h("p", { className: reply.deleted ? 'deleted-post' : 'community-body' }, reply.deleted ? '삭제된 댓글입니다.' : reply.text),
                !reply.deleted && (reply.isMine || operator) && h("button", { className: "text-button", "aria-label": "\uB313\uAE00 \uC0AD\uC81C", disabled: busy, onClick: () => remove(reply) }, "\uC0AD\uC81C"))),
            !post.deleted && h("form", { onSubmit: reply },
                h("label", { className: "field-label", htmlFor: 'reply-' + post.id }, "\uB313\uAE00 \uB0A8\uAE30\uAE30"),
                h("textarea", { id: 'reply-' + post.id, className: "text-input", value: text, maxLength: 1200, rows: 2, disabled: busy, onChange: e => setText(e.target.value), placeholder: "\uC774 \uAE00\uC5D0 \uB313\uAE00\uC744 \uB0A8\uACA8\uC694" }),
                h("button", { className: "btn", disabled: busy || text.trim().length < 2 }, busy ? '저장 중' : '댓글 등록'))),
        error && h("p", { className: "error-box", role: "alert" }, error));
}
function useDraftGuard(text, busy) { useEffect(() => { if (!text && !busy)
    return; const block = e => { e.preventDefault(); e.returnValue = ''; }; const close = e => { if (busy) {
    e.preventDefault();
    toast.error('서버 저장 결과를 확인한 뒤 이동해 주세요.');
}
else if (text && !window.confirm('작성 중인 글을 저장하지 않고 이동할까요?'))
    e.preventDefault(); }; window.addEventListener('beforeunload', block); window.addEventListener('keeper-before-signout', block); window.addEventListener('keeper-bin-before-close', close); return () => { window.removeEventListener('beforeunload', block); window.removeEventListener('keeper-before-signout', block); window.removeEventListener('keeper-bin-before-close', close); }; }, [text, busy]); }
