// Reuse the application's existing React/Firebase runtime. No second SDK instance.
let runtime;
export function configureRuntime(value) { if (!value?.React || !value?.OriginalAPI)
    throw new Error('앱 연결 모듈을 확인해 주세요.'); runtime = value; }
export function getRuntime() { if (!runtime)
    throw new Error('앱이 아직 준비되지 않았어요.'); return runtime; }
export const h = (...args) => getRuntime().React.createElement(...args);
export const Fragment = Symbol.for('react.fragment');
export const useState = (...a) => getRuntime().React.useState(...a);
export const useEffect = (...a) => getRuntime().React.useEffect(...a);
export const useMemo = (...a) => getRuntime().React.useMemo(...a);
export const useRef = (...a) => getRuntime().React.useRef(...a);
export const useCallback = (...a) => getRuntime().React.useCallback(...a);
export const useContext = (...a) => getRuntime().React.useContext(...a);
export const appAsset = p => new URL(p, document.baseURI).href;
export const appHome = () => new URL('./', document.baseURI).href;
export const toast = { success: (...a) => getRuntime().toast.success(...a), error: (...a) => getRuntime().toast.error(...a) };
export const watchReports = (...a) => getRuntime().watchReports(...a);
export function icon(name) { return props => h(getRuntime().icons[name] || getRuntime().icons.MapPin, props); }
export function component(name) { return props => h(getRuntime()[name], props); }
export const Shirt = icon('Shirt'), Plus = icon('Plus'), ArrowUpRight = icon('ArrowUpRight'), Camera = icon('Camera'), MapPin = icon('MapPin'), LocateFixed = icon('LocateFixed'), ArrowRight = icon('ArrowRight'), ArrowLeft = icon('ArrowLeft'), Search = icon('Search'), RotateCw = icon('RotateCw'), Check = icon('Check'), Box = icon('Box'), Leaf = icon('Leaf'), ClipboardList = icon('ClipboardList'), ScanLine = icon('ScanLine'), ChevronRight = icon('ChevronRight'), BookOpen = icon('BookOpen'), Inbox = icon('Inbox'), ImageOff = icon('ImageOff'), LoaderCircle = icon('LoaderCircle'), Upload = icon('Upload'), Download = icon('Download'), ImagePlus = icon('ImagePlus'), X = icon('X'), Trash2 = icon('Trash2');
export const Toaster = component('Toaster'), Tabs = component('Tabs'), TabsList = component('TabsList'), TabsTrigger = component('TabsTrigger'), TabsContent = component('TabsContent'), Select = component('Select'), SelectTrigger = component('SelectTrigger'), SelectValue = component('SelectValue'), SelectContent = component('SelectContent'), SelectItem = component('SelectItem'), Empty = component('Empty'), EmptyHeader = component('EmptyHeader'), EmptyTitle = component('EmptyTitle'), EmptyDescription = component('EmptyDescription'), Skeleton = component('Skeleton'), Dialog = component('Dialog'), DialogContent = component('DialogContent'), DialogHeader = component('DialogHeader'), DialogTitle = component('DialogTitle'), DialogDescription = component('DialogDescription'), Checkbox = component('Checkbox'), Progress = component('Progress'), PhotoMask = component('PhotoMask'), IntakeReceipt = component('IntakeReceipt'), IntakeHistory = component('IntakeHistory'), OperatorGate = component('OperatorGate'), ReportDetail = component('ReportDetail');
