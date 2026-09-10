import { getRuntime } from './runtime.js';
import { isReactionTarget, reactionSummary } from './community-model.js';
export function subscribeActivityMessages(onData, onError) {
    const B = getRuntime();
    return B.fb.onValue(B.fb.ref(B.db, `${B.ROOT}/community`), s => onData(s.val() || {}), e => onError(B.firebaseMessage(e)));
}
export function subscribeEmpathy(binId, type, id, onData, onError) {
    if (!isReactionTarget(type, id, binId))
        throw new Error('공감할 기록을 확인해 주세요.');
    const B = getRuntime();
    return B.fb.onValue(B.fb.ref(B.db, `${B.ROOT}/communityReactions/${binId}/${type}/${id}`), s => onData(reactionSummary(s.val(), B.auth.currentUser?.uid)), e => onError(B.firebaseMessage(e)));
}
// Store the intended state, not read-modify-write of a shared total.
// Each account owns one key. Retrying "on" cannot add a second vote.
export async function setEmpathy({ binId, type, id, active }) {
    if (!isReactionTarget(type, id, binId) || typeof active !== 'boolean')
        throw new Error('공감할 기록을 확인해 주세요.');
    const B = getRuntime();
    await B.authReady;
    const uid = B.auth.currentUser?.uid;
    if (!uid)
        throw new Error('로그인 후 공감할 수 있어요.');
    if (!navigator.onLine)
        throw new Error('인터넷 연결을 확인해 주세요. 공감은 아직 저장되지 않았어요.');
    const path = `${B.ROOT}/communityReactions/${binId}/${type}/${id}/${uid}`;
    try {
        await B.fb.set(B.fb.ref(B.db, path), active ? true : null);
    }
    catch (e) {
        throw new Error(B.firebaseMessage(e));
    }
}
