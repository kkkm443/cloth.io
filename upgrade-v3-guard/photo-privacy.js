export function canSavePhoto(state, reviewed, processing, editing) {
    return (state === 'done' || state === 'manual') && reviewed && !processing && !editing;
}
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
            reject(new Error('\uc790\ub3d9 \uc0ac\ub78c \uac00\ub9ac\uae30\ub97c \uc644\ub8cc\ud558\uc9c0 \ubabb\ud588\uc5b4\uc694. \ub2e4\uc2dc \uc2dc\ub3c4\ud558\uac70\ub098 \uc9c1\uc811 \uc0ac\ub78c\uc744 \uac00\ub9b0 \ub4a4 \ud655\uc778\ud574 \uc8fc\uc138\uc694.'));
        };
        timer = setTimeout(fail, 180000);
        worker.onerror = fail;
        worker.onmessageerror = fail;
        worker.onmessage = ({ data }) => {
            if (finished || !data)
                return;
            if (data.type === 'error')
                return fail();
            if (data.type === 'progress') {
                onProgress(String(data.text), Math.max(0, Math.min(100, Number(data.progress) || 0)));
                return;
            }
            if (data.type === 'result') {
                const validSize = Number.isInteger(data.width) && data.width > 0 && Number.isInteger(data.height) && data.height > 0 && data.width * data.height <= 2560000;
                const validRegions = validSize && Array.isArray(data.regions) && data.regions.length <= 500 && data.regions.every((b) => b && ['person', 'face'].includes(b.kind) && [b.x, b.y, b.w, b.h].every(Number.isFinite) && b.x >= 0 && b.y >= 0 && b.w > 0 && b.h > 0 && b.x + b.w <= data.width && b.y + b.h <= data.height);
                if (data.policy !== 'people-only-v1' || !(data.photo instanceof Blob) || data.photo.type !== 'image/jpeg' || !data.photo.size || !validRegions || data.texts !== 0 || data.persons !== data.regions.filter((b) => b.kind === 'person').length || data.faces !== data.regions.filter((b) => b.kind === 'face').length)
                    return fail();
                finished = true;
                cleanup();
                resolve({ photo: data.photo, persons: data.persons, faces: data.faces, texts: 0, width: data.width, height: data.height, regions: data.regions });
            }
        };
        try {
            worker.postMessage({ type: 'mask', photo });
        }
        catch {
            fail();
        }
    });
    return { result, cancel() {
            if (finished)
                return;
            finished = true;
            cleanup();
            rejectJob(new DOMException('Photo changed', 'AbortError'));
        } };
}
