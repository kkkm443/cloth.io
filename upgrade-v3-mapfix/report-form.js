import { h, Fragment } from './runtime.js';
import { useCatalog } from './catalog.js';
import { originLabel } from './bin-model.js';
import ReportLocation, { useReportLocation, PhotoLocationHint } from './report-location.js';
"use client";
import { apiRequest } from "./api.js";
import { useEffect, useRef, useState, useMemo, appAsset } from './runtime.js';
import { Camera, ArrowRight, ArrowLeft, MapPin, LocateFixed, Check, LoaderCircle, ScanLine, ImagePlus } from './runtime.js';
import { toast } from './runtime.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './runtime.js';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './runtime.js';
import { Checkbox } from './runtime.js';
import { Progress } from './runtime.js';
import { categories, complaintText } from './report-types.js';
import { photoGPS } from './photo-gps.js';
import { PhotoMask } from './runtime.js';
import { startPhotoMask, canSavePhoto } from './photo-privacy.js';
import { IntakeReceipt } from './runtime.js';
import { saveReportAndIntake } from './automatic-intake.js';
import { issueLabels, issueWeights, riskScore, riskLabel } from './keeper-features.js';
async function preparePhoto(file) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
        throw new Error('JPG, PNG, WebP 사진을 선택해 주세요. HEIC는 JPG로 변환해 주세요.');
    if (file.size > 15 * 1024 * 1024)
        throw new Error('15MB 이하의 사진을 선택해 주세요.');
    const url = URL.createObjectURL(file);
    try {
        const im = new Image();
        await new Promise((resolve, reject) => { im.onload = () => resolve(); im.onerror = () => reject(new Error('사진을 열 수 없어요. 다른 사진을 선택해 주세요.')); im.src = url; });
        const ratio = Math.min(1, 1600 / Math.max(im.width, im.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(im.width * ratio);
        canvas.height = Math.round(im.height * ratio);
        const ctx = canvas.getContext('2d');
        if (!ctx)
            throw new Error('이 브라우저에서는 사진을 처리할 수 없어요.');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(im, 0, 0, canvas.width, canvas.height);
        return await new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('사진 변환에 실패했어요.')), 'image/jpeg', .86));
    }
    finally {
        URL.revokeObjectURL(url);
    }
}
export default function ReportForm({ open, onOpenChange, onSaved, initialBin = null, maintenance = false }) {
    const catalog = useCatalog();
    const location = useReportLocation({ open, initialBin });
    const { address, point, binId } = location.state;
    const [maintenanceConfirmed, setMaintenanceConfirmed] = useState(false);
    const [privacy, setPrivacy] = useState('idle'), [privacyText, setPrivacyText] = useState(''), [privacyProgress, setPrivacyProgress] = useState(0), [reviewed, setReviewed] = useState(false), [counts, setCounts] = useState({ faces: 0, texts: 0 });
    const maskJob = useRef(null), rawPhoto = useRef(null);
    const [automatic, setAutomatic] = useState(true), [intakeTitle, setIntakeTitle] = useState(''), [intakeBody, setIntakeBody] = useState(''), [savedReport, setSavedReport] = useState(null), [receipt, setReceipt] = useState(null), [phase, setPhase] = useState('report');
    const [issues, setIssues] = useState({}), [mask, setMask] = useState(false);
    const [step, setStep] = useState(0), [photo, setPhoto] = useState(null), [url, setUrl] = useState(''), [processing, setProcessing] = useState(false);
    const [category, setCategory] = useState('uncertain'), [description, setDescription] = useState(''), [consent, setConsent] = useState(false);
    const [ai, setAi] = useState('idle'), [aiText, setAiText] = useState(''), [progress, setProgress] = useState(0), [suggested, setSuggested] = useState(null);
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    const linkedBin = catalog.byId.get(binId) || null;
    const worker = useRef(null), timer = useRef(null), fileInput = useRef(null), id = useRef(''), generation = useRef(0);
    useEffect(() => {
        if (!open)
            return;
        const block = (e) => e.preventDefault();
        window.addEventListener('keeper-before-signout', block);
        return () => window.removeEventListener('keeper-before-signout', block);
    }, [open, initialBin?.id, maintenance]);
    function stop() {
        worker.current?.terminate();
        worker.current = null;
        if (timer.current)
            clearTimeout(timer.current);
        timer.current = null;
    }
    useEffect(() => {
        if (open) {
            id.current = crypto.randomUUID();
            setAutomatic(!maintenance);
            setMaintenanceConfirmed(false);
            setIntakeTitle('');
            setIntakeBody('');
            setSavedReport(null);
            setReceipt(null);
            setPhase('report');
            setStep(0);
            setPrivacy('idle');
            setPrivacyText('');
            setReviewed(false);
            setCounts({ faces: 0, texts: 0 });
            setProcessing(false);
            setPhoto(null);
            setCategory(maintenance ? 'normal' : 'uncertain');
            setIssues({});
            setMask(false);
            setDescription(maintenance ? '수거함과 주변이 정리된 것을 현장에서 확인했어요.' : '');
            setConsent(false);
            setAi('idle');
            setSuggested(null);
            setError('');
        }
        return () => { generation.current++; stop(); maskJob.current?.cancel(); maskJob.current = null; rawPhoto.current = null; };
    }, [open, initialBin?.id, maintenance]);
    useEffect(() => {
        if (!photo) {
            setUrl('');
            return;
        }
        const u = URL.createObjectURL(photo);
        setUrl(u);
        return () => URL.revokeObjectURL(u);
    }, [photo]);
    async function maskPhoto(p, g) {
        setPrivacy('running');
        setPrivacyText('사진 속 개인정보를 살펴보고 있어요');
        setPrivacyProgress(0);
        setReviewed(false);
        setPhoto(null);
        rawPhoto.current = p;
        try {
            const job = startPhotoMask(p, appAsset('privacy-worker.js'), (text, progress) => {
                if (g === generation.current) {
                    setPrivacyText(text);
                    setPrivacyProgress(progress);
                }
            });
            maskJob.current = job;
            const result = await job.result;
            if (g !== generation.current)
                return;
            setPhoto(result.photo);
            setCounts({ faces: result.faces, texts: result.texts });
            setPrivacy('done');
            setPrivacyProgress(100);
            rawPhoto.current = null;
        }
        catch (e) {
            if (g !== generation.current)
                return;
            setPhoto(p);
            setPrivacy('error');
            setPrivacyText(e.message);
        }
        finally {
            if (g === generation.current) {
                maskJob.current = null;
                setProcessing(false);
            }
        }
    }
    async function select(file) {
        if (!file)
            return;
        const g = ++generation.current;
        const locationTicket = location.beginPhoto();
        maskJob.current?.cancel();
        maskJob.current = null;
        rawPhoto.current = null;
        setProcessing(true);
        setPhoto(null);
        setPrivacy('idle');
        setReviewed(false);
        setMask(false);
        setError('');
        stop();
        try {
            const gps = await photoGPS(file);
            const p = await preparePhoto(file);
            if (g !== generation.current)
                return;
            setAi('idle');
            setSuggested(null);
            setIssues({});
            setCategory(maintenance ? 'normal' : 'uncertain');
            location.photoResult(gps, locationTicket);
            await maskPhoto(p, g);
        }
        catch (e) {
            if (g === generation.current) {
                location.photoFailed(locationTicket);
                setError(e.message);
                setProcessing(false);
            }
        }
    }
    function cancelMask() { const p = rawPhoto.current; ++generation.current; maskJob.current?.cancel(); maskJob.current = null; setProcessing(false); setPhoto(p); setPrivacy('error'); setPrivacyText('자동 가리기를 중단했어요. 다시 시도하거나 직접 가린 뒤 확인해 주세요.'); }
    function retryMask() {
        const p = rawPhoto.current;
        if (!p)
            return;
        const g = ++generation.current;
        setProcessing(true);
        setError('');
        void maskPhoto(p, g);
    }
    function analyze() {
        if (!url)
            return;
        stop();
        setAi('loading');
        setProgress(0);
        setAiText('사진 분류 모델을 준비하고 있어요');
        setSuggested(null);
        const fail = () => { setAi('error'); setAiText('자동 분류를 완료하지 못했어요. 상태를 직접 선택하거나 다시 시도해 주세요.'); stop(); };
        try {
            const w = new Worker(appAsset('analysis-worker.js'), { type: 'module' });
            worker.current = w;
            timer.current = setTimeout(fail, 180000);
            w.onmessage = ({ data }) => {
                if (data.type === 'result') {
                    const top = data.results?.[0], next = data.results?.[1];
                    if (!top || !Object.hasOwn(categories, top.category)) {
                        fail();
                        return;
                    }
                    const c = top.score < .35 || (next && top.score - next.score < .06) ? 'uncertain' : top.category;
                    setCategory(c);
                    setIssues(c in issueWeights ? { [c]: true } : {});
                    setSuggested(c);
                    setAi('done');
                    setAiText(c === 'uncertain' ? '사진만으로 구분이 어려워요. 직접 확인해 주세요.' : `${categories[c].label} 상태와 가장 비슷해요.`);
                    stop();
                }
                else if (data.type === 'error') {
                    fail();
                }
                else {
                    setAi(data.type === 'analyzing' ? 'analyzing' : 'loading');
                    setAiText(data.text);
                    if (data.progress !== undefined)
                        setProgress(Math.round(data.progress));
                }
            };
            w.onerror = fail;
            w.postMessage({ image: url });
        }
        catch {
            fail();
        }
    }
    async function save() {
        if (!photo || busy || !location.canContinue || !canSavePhoto(privacy, reviewed, processing, mask))
            return;
        if (maintenance && (!maintenanceConfirmed || !binId)) {
            setError('정비한 수거함과 현장 확인 체크를 확인해 주세요.');
            return;
        }
        setBusy(true);
        setError('');
        const form = new FormData();
        form.append('id', id.current);
        form.append('kind', maintenance ? 'maintenance' : 'observation');
        form.append('maintenance_confirmed', String(maintenanceConfirmed));
        form.append('photo', photo, 'report.jpg');
        form.append('address', address.trim());
        form.append('description', description.trim());
        form.append('category', maintenance ? 'normal' : category);
        form.append('issues', JSON.stringify(maintenance ? {} : issues));
        form.append('bin_id', binId);
        form.append('consent', String(consent));
        form.append('analysis', ai === 'done' ? 'clip' : 'manual');
        if (point) {
            form.append('latitude', String(point[0]));
            form.append('longitude', String(point[1]));
        }
        try {
            const result = await saveReportAndIntake({ request: apiRequest, form, existing: savedReport, automatic, title: intakeTitle, body: intakeBody, onReport: setSavedReport, onPhase: setPhase });
            if (result.intake) {
                setReceipt(result.intake);
                setStep(3);
            }
            else {
                onSaved(result.report);
                onOpenChange(false);
                toast.success(maintenance ? '같은 수거함에 정비 완료 기록을 추가했어요.' : '제보를 저장했어요.');
            }
        }
        catch (e) {
            setError(e.message || '연결을 확인하고 다시 시도해 주세요.');
        }
        finally {
            setBusy(false);
        }
    }
    function finish() {
        if (busy)
            return;
        if (savedReport)
            onSaved(savedReport, !!receipt);
        onOpenChange(false);
    }
    function next() {
        if (step === 0 && !canSavePhoto(privacy, reviewed, processing, mask))
            return;
        setError('');
        if (step === 1) {
            if (!location.canContinue)
                return;
            const now = Date.now();
            setIntakeTitle(`${address.trim()} 의류수거함 현장 확인 요청`.slice(0, 200));
            setIntakeBody(complaintText({ id: id.current, address: address.trim(), description: description.trim(), category, issues, status: 'reported', latitude: point?.[0] ?? null, longitude: point?.[1] ?? null, analysis: ai === 'done' ? 'CLIP 제안 · 사용자 확인' : '직접 분류', created_at: now, updated_at: now, isMine: true }));
            setConsent(false);
        }
        setStep(step + 1);
    }
    return h(Dialog, { open: open, onOpenChange: v => {
            if (!v)
                finish();
        } },
        h(DialogContent, { className: "report-dialog", onInteractOutside: e => e.preventDefault() },
            h(DialogHeader, null,
                h("div", { className: "eyebrow" }, "A SMALL ACTION, A BETTER STREET"),
                h(DialogTitle, { className: "dialog-title" }, maintenance ? '정비 완료 사진 남기기' : '우리 동네에 제보 남기기'),
                h(DialogDescription, null, maintenance ? '다른 사람의 제보를 바꾸지 않고, 같은 수거함에 새 정비 기록을 추가해요.' : '현장에서 본 그대로 알려 주세요.')),
            h("div", { className: "form-steps" }, (maintenance ? ['정비 후 사진', '수거함 위치', '완료 확인'] : ['사진 선택', '상태와 위치', '내용 확인', '접수 확인']).map((s, i) => h("div", { key: s, className: i === step ? 'current' : i < step ? 'complete' : '' },
                h("span", null, i < step ? h(Check, { size: 14 }) : i + 1),
                s))),
            h("div", { className: "form-scroll" },
                linkedBin && h("div", { className: "linked-bin-banner" },
                    h("b", null, linkedBin.title),
                    h("span", null,
                        originLabel(linkedBin),
                        " \u00B7 \uC774 \uC218\uAC70\uD568\uC5D0 \uAE30\uB85D\uC774 \uB204\uC801\uB3FC\uC694."),
                    h("small", null, linkedBin.address)),
                step === 3 && receipt && h(Fragment, null,
                    h("div", { className: "auto-intake-success" },
                        h("span", { className: "large-camera" },
                            h(Check, null)),
                        h("h3", null, "\uC790\uB3D9 \uC811\uC218 \uACB0\uACFC\uB97C \uD655\uC778\uD588\uC5B4\uC694"),
                        h("p", null, "\uC11C\uBE44\uC2A4 \uC6B4\uC601\uC790 \uC811\uC218\uD568\uC5D0 \uC800\uC7A5\uB41C \uC2E4\uC81C \uAE30\uB85D\uC785\uB2C8\uB2E4.")),
                    h(IntakeReceipt, { item: receipt }),
                    h("p", { className: "field-hint" }, "\uC815\uBD80 \uAE30\uAD00\uC73C\uB85C \uC804\uC1A1\uD55C \uBBFC\uC6D0\uC740 \uC544\uB2C8\uC5D0\uC694. \uC6B4\uC601\uC790 \uAD8C\uD55C\uC774 \uC788\uB294 \uACC4\uC815\uC740 \uC6B4\uC601\uC790 \uC811\uC218\uD568\uC5D0\uC11C \uD655\uC778\uD560 \uC218 \uC788\uC5B4\uC694.")),
                h("fieldset", { disabled: busy || !!savedReport, style: { border: 0, padding: 0, margin: 0, minWidth: 0 } },
                    step === 0 && h(Fragment, null,
                        mask && url ? h(PhotoMask, { url: url, onCancel: () => setMask(false), onApply: b => { setPhoto(b); setPrivacy(p => p === 'error' ? 'manual' : p); setReviewed(false); rawPhoto.current = null; setMask(false); stop(); setAi('idle'); setSuggested(null); setIssues({}); setCategory(maintenance ? 'normal' : 'uncertain'); } }) : null,
                        h("input", { ref: fileInput, type: "file", accept: "image/jpeg,image/png,image/webp", className: "sr-only", "aria-label": "\uC218\uAC70\uD568 \uD604\uC7A5 \uC0AC\uC9C4 \uC120\uD0DD", onChange: e => { select(e.target.files?.[0]); e.target.value = ''; } }),
                        h("button", { type: "button", className: `upload-zone ${photo ? 'has-photo' : ''}`, style: { display: mask ? 'none' : undefined }, disabled: processing, onClick: () => fileInput.current?.click(), onDragOver: e => e.preventDefault(), onDrop: e => { e.preventDefault(); select(e.dataTransfer.files[0]); } }, url ? h(Fragment, null,
                            h("img", { src: url, alt: privacy === 'error' ? '직접 가리기가 필요한 사진 · 아직 저장되지 않음' : '가리기 결과를 확인할 현장 사진' }),
                            h("span", { className: "replace-photo" },
                                h(ImagePlus, { size: 16 }),
                                "\uC0AC\uC9C4 \uBC14\uAFB8\uAE30")) : h(Fragment, null,
                            h("span", { className: "large-camera" }, processing ? h(LoaderCircle, { className: "spin" }) : h(Camera, null)),
                            h("h3", null, processing ? '사진을 안전하게 준비하고 있어요' : '수거함 사진을 올려 주세요'),
                            h("p", null, "\uC0AC\uC9C4\uC744 \uB04C\uC5B4 \uB193\uAC70\uB098 \uB20C\uB7EC\uC11C \uC120\uD0DD\uD574\uC694"),
                            h("span", { className: "file-types" }, "JPG, PNG, WebP \u00B7 \uCD5C\uB300 15MB"))),
                        h("div", { className: `privacy-card ${privacy === 'error' ? 'needs-review' : ''}`, "aria-live": "polite" }, privacy === 'running' ? h(Fragment, null,
                            h("h3", null,
                                h(LoaderCircle, { size: 18, className: "spin" }),
                                "\uC790\uB3D9\uC73C\uB85C \uAC1C\uC778\uC815\uBCF4\uB97C \uAC00\uB9AC\uACE0 \uC788\uC5B4\uC694"),
                            h("p", null, privacyText),
                            h(Progress, { value: privacyProgress, "aria-label": "\uC790\uB3D9 \uAC1C\uC778\uC815\uBCF4 \uAC00\uB9AC\uAE30 \uC9C4\uD589" }),
                            h("button", { className: "text-button", type: "button", onClick: cancelMask }, "\uC911\uB2E8\uD558\uACE0 \uC9C1\uC811 \uAC00\uB9AC\uAE30")) : privacy === 'error' ? h(Fragment, null,
                            h("h3", null, "\uC790\uB3D9 \uAC00\uB9AC\uAE30\uB97C \uB9C8\uCE58\uC9C0 \uBABB\uD588\uC5B4\uC694"),
                            h("p", null, privacyText),
                            h("p", null, "\uC704 \uC0AC\uC9C4\uC740 \uC774 \uAE30\uAE30\uC5D0\uC11C\uB9CC \uBCF4\uC774\uBA70 \uC544\uC9C1 \uC800\uC7A5\uB418\uC9C0 \uC54A\uC558\uC5B4\uC694. \uC9C1\uC811 \uAC00\uB9AC\uAE30\uB97C \uC801\uC6A9\uD574\uC57C \uB2E4\uC74C \uB2E8\uACC4\uB85C \uAC08 \uC218 \uC788\uC5B4\uC694."),
                            h("button", { className: "text-button", type: "button", onClick: retryMask }, "\uC790\uB3D9 \uAC00\uB9AC\uAE30 \uB2E4\uC2DC \uC2DC\uB3C4")) : privacy === 'done' || privacy === 'manual' ? h(Fragment, null,
                            h("h3", null,
                                h(Check, { size: 18 }),
                                privacy === 'done' ? '자동 가리기 결과를 확인해 주세요' : '직접 가린 사진을 확인해 주세요'),
                            privacy === 'done' && h("p", null,
                                "\uC5BC\uAD74 \uD6C4\uBCF4 ",
                                counts.faces,
                                "\uACF3 \u00B7 \uBB38\uC790 \uC601\uC5ED ",
                                counts.texts,
                                "\uACF3\uC744 \uAC00\uB838\uC5B4\uC694.",
                                counts.faces + counts.texts === 0 ? ' 탐지 결과가 없더라도 개인정보가 없다는 뜻은 아니에요.' : ''),
                            h("p", null, "\uC791\uAC70\uB098 \uD750\uB9BF\uD55C \uC5BC\uAD74\u00B7\uBC88\uD638\uD310\u00B7\uBB38\uD328\uB294 \uB193\uCE60 \uC218 \uC788\uC5B4\uC694. \uC544\uB798 \uBC84\uD2BC\uC73C\uB85C \uD06C\uAC8C \uD655\uC778\uD558\uACE0, \uB0A8\uC740 \uBD80\uBD84\uC740 \uCD94\uAC00\uB85C \uAC00\uB824 \uC8FC\uC138\uC694."),
                            !mask && h("label", { className: "consent" },
                                h(Checkbox, { checked: reviewed, onCheckedChange: v => setReviewed(v === true) }),
                                h("span", null, "\uC0AC\uC9C4 \uC804\uCCB4\uB97C \uD655\uC778\uD588\uACE0, \uC5BC\uAD74\u00B7\uBC88\uD638\uD310\u00B7\uBB38\uD328 \uB4F1 \uAC00\uB824\uC57C \uD560 \uC815\uBCF4\uAC00 \uB0A8\uC544 \uC788\uC9C0 \uC54A\uC544\uC694."))) : h(Fragment, null,
                            h("h3", null,
                                h(ScanLine, { size: 18 }),
                                "\uC0AC\uC9C4\uC744 \uACE0\uB974\uBA74 \uC790\uB3D9 \uAC00\uB9AC\uAE30\uAC00 \uC2DC\uC791\uB3FC\uC694"),
                            h("p", null, "\uC5BC\uAD74\uACFC \uD55C\uAE00\u00B7\uC601\uBB38 \uBB38\uC790 \uC601\uC5ED\uC744 \uCC3E\uC544 \uAC00\uB824\uC694. \uBC88\uD638\uD310\u00B7\uBB38\uD328\uBFD0 \uC544\uB2C8\uB77C \uC218\uAC70\uD568 \uC548\uB0B4 \uBB38\uAD6C\uB3C4 \uAC00\uB824\uC9C8 \uC218 \uC788\uC5B4\uC694."))),
                        h("div", { className: "row wrap" }, photo && !processing && !mask && h("button", { className: "btn", type: "button", onClick: () => { setReviewed(false); setMask(true); } }, privacy === 'error' ? '직접 가리기' : '크게 확인 · 추가로 가리기')),
                        h(PhotoLocationHint, { location: location }),
                        h("div", { className: "photo-tips" },
                            h("h3", null, "\uC774\uB807\uAC8C \uCC0D\uC73C\uBA74 \uC88B\uC544\uC694"),
                            h("p", null, "\uC218\uAC70\uD568 \uC804\uCCB4\uC640 \uC8FC\uBCC0 \uBC14\uB2E5\uC774 \uD568\uAED8 \uBCF4\uC774\uAC8C \uCC0D\uC5B4 \uC8FC\uC138\uC694. \uAC1C\uC778\uC815\uBCF4\uAC00 \uCD5C\uB300\uD55C \uB2F4\uAE30\uC9C0 \uC54A\uAC8C \uCC0D\uC73C\uBA74 \uC790\uB3D9 \uAC00\uB9AC\uAE30 \uB204\uB77D\uC744 \uC904\uC77C \uC218 \uC788\uC5B4\uC694.")),
                        h("div", { className: "soft-notice" },
                            h(ScanLine, { size: 20 }),
                            h("span", null, "\uC790\uB3D9 \uAC00\uB9AC\uAE30\uC640 \uC0C1\uD0DC \uBD84\uB958\uB294 \uAE30\uAE30\uC5D0\uC11C \uC2E4\uD589\uB3FC\uC694. \uCC98\uC74C\uC5D0\uB294 \uBAA8\uB378 \uB2E4\uC6B4\uB85C\uB4DC\uB85C \uC2DC\uAC04\uC774 \uAC78\uB9B4 \uC218 \uC788\uC5B4\uC694. \uAC00\uB9AC\uAE30\uC640 \uD655\uC778\uC774 \uB05D\uB09C \uC0AC\uC9C4\uB9CC \uC800\uC7A5\uD558\uBA70, \uC6D0\uBCF8\uC740 \uC11C\uBC84\uB85C \uBCF4\uB0B4\uC9C0 \uC54A\uC544\uC694."))),
                    step === 1 && h(Fragment, null,
                        maintenance ? h("div", { className: "maintenance-confirm-info" },
                            h(Check, { size: 22 }),
                            h("div", null,
                                h("b", null, "\uC815\uBE44 \uD6C4 \uC591\uD638 \uC0C1\uD0DC\uB85C \uAE30\uB85D\uD574\uC694"),
                                h("p", null, "\uC0C8 \uC0AC\uC9C4\uACFC \uD568\uAED8 0\uC810 \u00B7 \uAD00\uCC30 \uC0C1\uD0DC\uB97C \uB0A8\uAE41\uB2C8\uB2E4. \uBB38\uC81C\uAC00 \uB0A8\uC544 \uC788\uC73C\uBA74 \uC815\uBE44 \uC644\uB8CC \uB300\uC2E0 \uC77C\uBC18 \uC81C\uBCF4\uB97C \uC774\uC6A9\uD574 \uC8FC\uC138\uC694."))) : h(Fragment, null,
                            h("div", { className: "analysis-card" },
                                h("img", { src: url, alt: "\uC0C1\uD0DC\uB97C \uD655\uC778\uD560 \uD604\uC7A5 \uC0AC\uC9C4" }),
                                h("div", null,
                                    h("span", { className: "mini-label" }, "\uC0AC\uC9C4 \uC0C1\uD0DC \uD655\uC778"),
                                    h("h3", null, ai === 'idle' ? '자동 분류를 시작해 보세요' : ai === 'done' ? aiText : ai === 'error' ? '직접 확인이 필요해요' : '사진을 살펴보고 있어요'),
                                    h("p", null, ai === 'done' ? '실험적 분류 결과예요. 실제 상태와 다르면 아래에서 수정해 주세요.' : ai === 'error' ? aiText : '사진 분석은 선택 사항이에요. 직접 상태를 고를 수도 있어요.'),
                                    (ai === 'idle' || ai === 'error') && h("button", { type: "button", className: "text-button", onClick: analyze },
                                        h(ScanLine, { size: 16 }),
                                        ai === 'error' ? '분류 다시 시도' : '자동 분류 시작'),
                                    (ai === 'loading' || ai === 'analyzing') && h("div", { "aria-live": "polite" },
                                        h("p", { className: "model-status" },
                                            h(LoaderCircle, { size: 14, className: "spin" }),
                                            aiText),
                                        ai === 'loading' && h(Progress, { value: progress, "aria-label": "\uD604\uC7AC \uBAA8\uB378 \uD30C\uC77C \uB2E4\uC6B4\uB85C\uB4DC" }),
                                        h("button", { className: "text-button", onClick: () => { stop(); setAi('idle'); } }, "\uCDE8\uC18C\uD558\uACE0 \uC9C1\uC811 \uC120\uD0DD")))),
                            h("label", { className: "field-label", htmlFor: "category" },
                                "\uC218\uAC70\uD568 \uC0C1\uD0DC ",
                                h("span", null, "\uD544\uC218")),
                            h(Select, { value: category, onValueChange: v => { setCategory(v); setIssues(v in issueWeights ? { [v]: true } : {}); } },
                                h(SelectTrigger, { id: "category", className: "form-select" },
                                    h(SelectValue, null)),
                                h(SelectContent, null, Object.entries(categories).map(([v, c]) => h(SelectItem, { key: v, value: v }, c.label)))),
                            h("p", { className: "field-hint" },
                                categories[category].description,
                                suggested && suggested !== category ? ' · 분류 결과를 직접 수정했어요.' : ''),
                            h("div", { className: "issue-options" },
                                h("p", { className: "field-label" },
                                    "\uD568\uAED8 \uBCF4\uC774\uB294 \uC0C1\uD0DC ",
                                    h("span", { className: "optional" }, "\uC5EC\uB7EC \uAC1C \uC120\uD0DD \uAC00\uB2A5")),
                                Object.entries(issueLabels).map(([k, label]) => h("label", { className: "issue-chip", key: k },
                                    h("input", { type: "checkbox", checked: issues[k] === true, onChange: e => { const next = { ...issues, [k]: e.target.checked }; setIssues(next); const first = Object.keys(next).find(key => next[key]); setCategory((first || 'uncertain')); } }),
                                    label,
                                    h("small", null,
                                        "+",
                                        issueWeights[k]))),
                                h("p", { className: "field-hint" },
                                    riskLabel(riskScore({ category, issues })),
                                    " \u00B7 ",
                                    riskScore({ category, issues }) ?? '—',
                                    " / 100\uC810 \u00B7 \uACE0\uC815 \uAC00\uC911\uCE58 \uCC38\uACE0 \uC810\uC218"))),
                        " ",
                        h(ReportLocation, { location: location, catalog: catalog }),
                        h("label", { className: "field-label", htmlFor: "description" },
                            "\uD604\uC7A5 \uBA54\uBAA8 ",
                            h("span", { className: "optional" }, "\uC120\uD0DD")),
                        h("textarea", { id: "description", className: "text-input", rows: 3, maxLength: 1200, value: description, onChange: e => setDescription(e.target.value), placeholder: "\uC8FC\uBCC0 \uC0C1\uD669\uC774\uB098 \uCC3E\uAE30 \uC26C\uC6B4 \uAC74\uBB3C \uC774\uB984\uC744 \uC54C\uB824 \uC8FC\uC138\uC694." }),
                        h("div", { className: "char-count" },
                            description.length,
                            " / 1,200")),
                    step === 2 && h(Fragment, null,
                        h("div", { className: "confirmation-photo" },
                            h("img", { src: url, alt: "\uC800\uC7A5\uD560 \uD604\uC7A5 \uC0AC\uC9C4" }),
                            h("span", { className: `category-badge ${category}` }, categories[category].label)),
                        h("h3", { className: "confirmation-address" },
                            h(MapPin, { size: 18 }),
                            address),
                        h("p", { className: "confirmation-note" }, description || categories[category].description),
                        h("p", { className: "field-hint" },
                            point ? `지도 좌표 ${point[0].toFixed(6)}, ${point[1].toFixed(6)}` : '지역만 등록 · 지도 좌표 없음',
                            linkedBin ? ` · ${linkedBin.title} 이력에 연결` : ' · 새 수거함으로 기록'),
                        !maintenance && h("div", { className: "auto-intake-option" },
                            h("label", { className: "consent" },
                                h(Checkbox, { checked: automatic, onCheckedChange: v => { setAutomatic(v === true); setConsent(false); } }),
                                h("span", null,
                                    h("b", null, "\uC800\uC7A5\uACFC \uB3D9\uC2DC\uC5D0 \uBBFC\uC6D0 \uC790\uB3D9 \uC811\uC218"),
                                    h("small", null, "\uC11C\uBE44\uC2A4 \uB0B4\uBD80 \uC811\uC218 \u00B7 \uAE30\uAD00 \uC5F0\uB3D9 \uC804 \uC2DC\uC5F0\uC6A9"))),
                            h("p", null, "\uC0AC\uC9C4\u00B7\uC704\uCE58\uC640 \uD655\uC778\uD55C \uBBFC\uC6D0 \uB0B4\uC6A9\uC744 \uC11C\uBE44\uC2A4 \uC6B4\uC601\uC790 \uC811\uC218\uD568\uC5D0 \uC790\uB3D9 \uB4F1\uB85D\uD574\uC694. \uC774 \uB2E8\uACC4\uC5D0\uC11C\uB294 \uC815\uBD80 \uAE30\uAD00\uC5D0 \uC804\uC1A1\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.")),
                        automatic && h(Fragment, null,
                            h("label", { className: "field-label", htmlFor: "automatic-title" }, "\uC790\uB3D9 \uC791\uC131\uB41C \uBBFC\uC6D0 \uC81C\uBAA9"),
                            h("input", { id: "automatic-title", className: "text-input", maxLength: 200, value: intakeTitle, onChange: e => { setIntakeTitle(e.target.value); setConsent(false); } }),
                            h("label", { className: "field-label", htmlFor: "automatic-body" }, "\uBBFC\uC6D0 \uB0B4\uC6A9 \uD655\uC778 \u00B7 \uC218\uC815 \uAC00\uB2A5"),
                            h("textarea", { id: "automatic-body", className: "text-input", rows: 7, maxLength: 12000, value: intakeBody, onChange: e => { setIntakeBody(e.target.value); setConsent(false); } })),
                        maintenance && h("label", { className: "consent maintenance-consent" },
                            h(Checkbox, { checked: maintenanceConfirmed, onCheckedChange: v => setMaintenanceConfirmed(v === true) }),
                            h("span", null, "\uC774 \uC218\uAC70\uD568\uC744 \uD604\uC7A5\uC5D0\uC11C \uD655\uC778\uD588\uACE0, \uC9C0\uAE08 \uC62C\uB9AC\uB294 \uC0AC\uC9C4\uC774 \uC815\uBE44 \uD6C4 \uBAA8\uC2B5\uC774\uBA70 \uC218\uAC70\uD568\uACFC \uC8FC\uBCC0\uC774 \uC591\uD638\uD574\uC694. \uAE30\uAD00\uC758 \uACF5\uC2DD \uD655\uC778\uC774 \uC544\uB2CC \uC2DC\uBBFC \uD655\uC778 \uAE30\uB85D\uC784\uC744 \uC774\uD574\uD588\uC5B4\uC694.")),
                        h("label", { className: "consent" },
                            h(Checkbox, { checked: consent, onCheckedChange: v => setConsent(v === true) }),
                            h("span", null,
                                "\uC0AC\uC9C4\uACFC \uC704\uCE58, \uBA54\uBAA8\uAC00 \uC0AC\uC774\uD2B8 \uC774\uC6A9\uC790\uC5D0\uAC8C \uBCF4\uC774\uB294 \uAC83\uC744 \uD655\uC778\uD588\uC5B4\uC694.",
                                automatic && ' 또한 민원 내용을 확인했으며 서비스 운영자에게 제공하고 내부 접수하는 데 동의합니다.')))),
                busy && h("p", { className: "field-hint", role: "status" },
                    h(LoaderCircle, { size: 15, className: "spin" }),
                    !automatic ? '사진과 제보를 저장하고 있어요' : phase === 'report' ? '1 / 2 · 사진과 제보를 저장하고 있어요' : '2 / 2 · 운영자 접수함에 민원을 등록하고 있어요'),
                error && h("div", { className: "error-box", role: "alert" },
                    savedReport && h("b", null, "\uC81C\uBCF4\uB294 \uC800\uC7A5\uB418\uC5C8\uC9C0\uB9CC \uC790\uB3D9 \uC811\uC218\uB294 \uC544\uC9C1 \uD655\uC778\uB418\uC9C0 \uC54A\uC558\uC5B4\uC694. "),
                    error,
                    savedReport && h("p", null, "\uC544\uB798\uC5D0\uC11C \uAC19\uC740 \uC694\uCCAD\uC73C\uB85C \uB2E4\uC2DC \uC2DC\uB3C4\uD558\uAC70\uB098, \uB2EB\uC740 \uB4A4 \uB0B4 \uC81C\uBCF4 \uC0C1\uC138\uC5D0\uC11C \uC811\uC218\uD560 \uC218 \uC788\uC5B4\uC694."))),
            h("div", { className: "form-footer" }, step === 3 ? h(Fragment, null,
                h("span", { className: "footer-hint" }, "\uC11C\uBE44\uC2A4 \uB0B4\uBD80 \uC811\uC218 \uAE30\uB85D"),
                h("button", { className: "btn primary", onClick: finish },
                    "\uC811\uC218 \uB0B4\uC5ED \uBCF4\uAE30",
                    h(ArrowRight, { size: 17 }))) : h(Fragment, null,
                step > 0 ? h("button", { type: "button", className: "btn", disabled: busy || !!savedReport, onClick: () => {
                        stop();
                        if (ai === 'loading' || ai === 'analyzing')
                            setAi('idle');
                        setStep(step - 1);
                        setError('');
                    } },
                    h(ArrowLeft, { size: 17 }),
                    "\uC774\uC804") : h("span", { className: "footer-hint" }, "\uC791\uC740 \uAD00\uC2EC\uC774 \uB3D9\uB124\uB97C \uBC14\uAFD4\uC694"),
                step < 2 ? h("button", { type: "button", className: "btn primary", disabled: step === 0 ? (!photo || !canSavePhoto(privacy, reviewed, processing, mask)) : !location.canContinue || ai === 'loading' || ai === 'analyzing', onClick: next },
                    step === 0 ? '상태와 위치 확인' : '제보·민원 내용 확인',
                    h(ArrowRight, { size: 17 })) : h("button", { type: "button", className: "btn primary", disabled: !consent || busy || !location.canContinue || (maintenance && (!maintenanceConfirmed || !binId)) || !canSavePhoto(privacy, reviewed, processing, mask) || (automatic && (intakeTitle.trim().length < 3 || intakeBody.trim().length < 20)), onClick: save },
                    busy ? h(LoaderCircle, { size: 17, className: "spin" }) : h(Check, { size: 17 }),
                    " ",
                    busy ? '저장하는 중' : savedReport ? '자동 접수 다시 확인' : maintenance ? '정비 완료 기록 저장' : automatic ? '제보 저장하고 자동 접수' : '제보만 저장하기')))));
}
