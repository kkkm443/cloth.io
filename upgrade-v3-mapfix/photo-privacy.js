export function canSavePhoto(state, reviewed, processing, editing) {
    return (state === 'done' || state === 'manual') && reviewed && !processing && !editing;
}
// A new isolated worker for each photo; cancellation discards stale results and raw pixels.
export function startPhotoMask(photo, workerUrl, onProgress) {
    const worker = new Worker(workerUrl);
    let finished = false;
    let rejectJob = () => { };
    let timer;
    const cleanup = () => { clearTimeout(timer); worker.terminate(); };
    const result = new Promise((resolve, reject) => {
        rejectJob = reject;
        const fail = () => {
            if (finished)
                return;
            finished = true;
            cleanup();
            reject(new Error('자동 가리기를 완료하지 못했어요. 연결을 확인해 다시 시도하거나 직접 가려 주세요.'));
        };
        timer = setTimeout(fail, 180000);
        worker.onerror = fail;
        worker.onmessage = ({ data }) => {
            if (finished)
                return;
            if (data.type === 'error')
                return fail();
            if (data.type === 'progress') {
                onProgress(String(data.text), Math.max(0, Math.min(100, Number(data.progress) || 0)));
                return;
            }
            if (data.type === 'result') {
                if (!(data.photo instanceof Blob) || data.photo.type !== 'image/jpeg' || !data.photo.size || !Number.isInteger(data.faces) || data.faces < 0 || !Number.isInteger(data.texts) || data.texts < 0)
                    return fail();
                finished = true;
                cleanup();
                resolve({ photo: data.photo, faces: data.faces, texts: data.texts });
            }
        };
        worker.postMessage({ type: 'mask', photo });
    });
    return { result, cancel() {
            if (finished)
                return;
            finished = true;
            cleanup();
            rejectJob(new DOMException('Photo changed', 'AbortError'));
        } };
}
