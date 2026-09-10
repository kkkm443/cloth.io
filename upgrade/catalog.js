import { h, Fragment, useState, useEffect, useMemo, useRef, useCallback, useContext, getRuntime, appAsset, watchReports } from './runtime.js';
import { buildCatalog } from './bin-model.js';
let Context, datasetPromise;
export function loadPublicData() { if (!datasetPromise)
    datasetPromise = fetch(appAsset('data/public-bins.json')).then(async (r) => { if (!r.ok)
        throw new Error(`공공자료 파일을 불러오지 못했어요 (${r.status}). data 폴더를 함께 업로드해 주세요.`); const d = await r.json(); if (d.meta?.schemaVersion !== 1 || !Array.isArray(d.bins) || d.bins.length !== d.meta.total)
        throw new Error('공공자료 파일 형식을 확인해 주세요.'); return d; }).catch(e => { datasetPromise = null; throw e; }); return datasetPromise; }
export function CatalogProvider({ children }) {
    if (!Context)
        Context = getRuntime().React.createContext(null);
    const [dataset, setDataset] = useState(null), [reports, setReports] = useState([]), [registry, setRegistry] = useState({}), [citizens, setCitizens] = useState({}), [dataError, setDataError] = useState(''), [syncError, setSyncError] = useState(''), [loading, setLoading] = useState(true), [syncing, setSyncing] = useState(false), [synced, setSynced] = useState(null);
    const serial = useRef(0), alive = useRef(true), syncTimer = useRef(null);
    const reloadData = useCallback(async () => { setLoading(true); setDataError(''); try {
        const d = await loadPublicData();
        if (alive.current)
            setDataset(d);
    }
    catch (e) {
        if (alive.current)
            setDataError(e.message);
    }
    finally {
        if (alive.current)
            setLoading(false);
    } }, []);
    const refresh = useCallback(async () => {
        const n = ++serial.current;
        setSyncing(true);
        const B = getRuntime();
        const results = await Promise.allSettled([B.OriginalAPI('/api/features/bins').then(async (r) => { const d = await r.json(); if (!r.ok)
                throw new Error(d.error); return d.reports; }), B.OriginalAPI('/api/features/registry').then(async (r) => { const d = await r.json(); if (!r.ok)
                throw new Error(d.error); return d.registry; }), B.fb.get(B.fb.ref(B.db, `${B.ROOT}/citizenBins`)).then(s => s.val() || {})]);
        if (!alive.current || n !== serial.current)
            return;
        const errors = [];
        if (results[0].status === 'fulfilled') {
            setReports(results[0].value);
            setSynced(Date.now());
        }
        else
            errors.push('시민 제보를 불러오지 못했어요.');
        if (results[1].status === 'fulfilled')
            setRegistry(results[1].value);
        else
            errors.push('운영자 공공자료를 불러오지 못했어요.');
        if (results[2].status === 'fulfilled')
            setCitizens(results[2].value);
        else
            errors.push('새 Firebase 규칙을 적용해야 시민 수거함·커뮤니티를 이용할 수 있어요.');
        setSyncError(errors.join(' '));
        setSyncing(false);
    }, []);
    useEffect(() => { alive.current = true; reloadData(); refresh(); const off = watchReports(() => { clearTimeout(syncTimer.current); syncTimer.current = setTimeout(refresh, 200); }); return () => { alive.current = false; serial.current++; clearTimeout(syncTimer.current); off(); }; }, [refresh, reloadData]);
    const bins = useMemo(() => buildCatalog(dataset?.bins || [], reports, registry, citizens), [dataset, reports, registry, citizens]);
    const byId = useMemo(() => new Map(bins.map(b => [b.id, b])), [bins]);
    const value = { bins, byId, reports, registry, meta: dataset?.meta, loading, syncing, synced, error: [dataError, syncError].filter(Boolean).join(' '), refresh, reloadData };
    return h(Context.Provider, { value: value }, children);
}
export function useCatalog() { return useContext(Context); }
