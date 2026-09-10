import { appAsset } from './runtime.js';
let worker = null, sequence = 0;
const pending = new Map();
function failWorker(message) {
    worker?.terminate();
    worker = null;
    for (const p of pending.values())
        p.fail(Error(message));
    pending.clear();
}
function getWorker() {
    if (!worker) {
        worker = new Worker(appAsset('region-worker.js'), { type: 'module' });
        worker.onmessage = ({ data }) => {
            const p = pending.get(data.id);
            if (!p)
                return;
            data.error ? p.fail(Error(data.error)) : p.done(data.result);
        };
        worker.onerror = () => failWorker('지역자료를 읽지 못했어요. 직접 입력해 주세요.');
        worker.onmessageerror = () => failWorker('지역자료를 읽지 못했어요. 직접 입력해 주세요.');
    }
    return worker;
}
export function lookupRegion(point, { signal } = {}) {
    if (signal?.aborted)
        return Promise.reject(new DOMException('Aborted', 'AbortError'));
    return new Promise((resolve, reject) => {
        const id = ++sequence;
        let timer;
        const clean = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); pending.delete(id); };
        const done = value => { clean(); resolve(value); }, fail = error => { clean(); reject(error); };
        const abort = () => fail(new DOMException('Aborted', 'AbortError'));
        pending.set(id, { done, fail });
        signal?.addEventListener('abort', abort, { once: true });
        timer = setTimeout(() => fail(Error('지역 확인 시간이 길어지고 있어요. 직접 입력하거나 다시 시도해 주세요.')), 70000);
        try {
            getWorker().postMessage({ id, point, baseURL: document.baseURI });
        }
        catch (e) {
            fail(Error('이 브라우저에서는 지역 자동 확인을 시작하지 못했어요. 직접 입력해 주세요.'));
        }
    });
}
