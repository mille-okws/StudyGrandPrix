import { transaction } from './database.js';
import { readSnapshot } from './repositories/studyRepository.js';

const SETTINGS_ID = 'calendar-settings-v1';
const lockName = 'study-grand-prix-calendar-sync';
const LEASE_MS = 60_000;
const MAX_ATTEMPTS = 8;
let localSync = false;
const nowIso = () => new Date().toISOString();
const token = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export async function getCalendarSettings() {
    return transaction(['metadata'], 'readonly', tx => {
        const request = tx.objectStore('metadata').get(SETTINGS_ID);
        return () => request.result?.value || { connected: false, autoSync: false, calendarId: '', clientId: '', subjectColors: {}, lastSyncAt: null };
    });
}

export async function saveCalendarSettings(settings) {
    await transaction(['metadata'], 'readwrite', tx => tx.objectStore('metadata').put({ id: SETTINGS_ID, value: { ...settings, connected: Boolean(settings?.connected), lastUpdatedAt: nowIso() } }));
}

export async function enqueueCalendarBlock(blockId, { reason = 'block-closed' } = {}) {
    if (!blockId) return;
    const snapshot = await readSnapshot();
    const segments = (snapshot.store.studySegments || []).filter(segment => segment.blockId === blockId && segment.status === 'CLOSED' && segment.endedAt);
    await transaction(['syncQueue'], 'readwrite', tx => {
        const queue = tx.objectStore('syncQueue');
        const records = segments.length ? segments.map(segment => ({ id: `segment:${segment.id}`, entityType: 'STUDY_SEGMENT', entityId: segment.id, blockId })) : [{ id: `block:${blockId}`, entityType: 'STUDY_BLOCK', entityId: blockId, blockId }];
        for (const record of records) {
            const request = queue.get(record.id);
            request.onsuccess = () => {
                const existing = request.result || {};
                queue.put({ ...existing, ...record, operation: 'UPSERT_EVENT', reason, state: existing.state === 'SYNCED' && reason !== 'evaluation-updated' ? 'SYNCED' : 'PENDING', attempts: Number(existing.attempts || 0), nextAttemptAt: 0, retryable: true, leaseToken: null, leaseExpiresAt: null, updatedAt: nowIso() });
            };
        }
    });
}

export async function recoverExpiredSyncOperations(now = Date.now()) {
    await transaction(['syncQueue'], 'readwrite', tx => {
        const store = tx.objectStore('syncQueue');
        const request = store.getAll();
        request.onsuccess = () => {
            for (const item of request.result || []) {
                if (item.state === 'SYNCING' && (!item.leaseExpiresAt || item.leaseExpiresAt <= now)) store.put({ ...item, state: 'PENDING', leaseToken: null, leaseExpiresAt: null, nextAttemptAt: now, updatedAt: nowIso() });
            }
        };
    });
}

export async function listCalendarQueue() {
    return transaction(['syncQueue'], 'readonly', tx => {
        const request = tx.objectStore('syncQueue').getAll();
        return () => (request.result || []).sort((a, b) => (a.updatedAt || '').localeCompare(b.updatedAt || ''));
    });
}

async function withLock(work) {
    if (globalThis.navigator?.locks?.request) return navigator.locks.request(lockName, { mode: 'exclusive' }, work);
    if (localSync) return { skipped: true };
    localSync = true;
    try { return await work(); } finally { localSync = false; }
}

async function acquire(item, at) {
    const leaseToken = token();
    return transaction(['syncQueue'], 'readwrite', tx => {
        const store = tx.objectStore('syncQueue');
        const request = store.get(item.id);
        let didAcquire = false;
        request.onsuccess = () => {
            const current = request.result;
            const leaseValid = current?.state === 'SYNCING' && Number(current.leaseExpiresAt || 0) > at;
            const permanentlyFailed = current?.state === 'ERROR' && current.retryable === false;
            const waiting = current?.nextAttemptAt && current.nextAttemptAt > at;
            if (!current || leaseValid || permanentlyFailed || waiting || (current.state === 'SYNCED' && current.reason !== 'evaluation-updated')) return;
            didAcquire = true;
            store.put({ ...current, state: 'SYNCING', leaseToken, startedAt: nowIso(), leaseExpiresAt: at + LEASE_MS, updatedAt: nowIso() });
        };
        return () => didAcquire ? leaseToken : null;
    });
}

async function updateIfOwned(id, leaseToken, update) {
    return transaction(['syncQueue'], 'readwrite', tx => {
        const store = tx.objectStore('syncQueue');
        const request = store.get(id);
        request.onsuccess = () => {
            const current = request.result;
            if (current?.leaseToken === leaseToken) store.put({ ...current, ...update, updatedAt: nowIso() });
        };
    });
}

export async function syncCalendarQueue(adapter, { calendarId, onProgress } = {}) {
    await recoverExpiredSyncOperations();
    const queueBefore = await listCalendarQueue();
    if (!adapter?.connected) return { synced: 0, pending: queueBefore.filter(item => item.state !== 'SYNCED').length, skipped: true };
    return withLock(async () => {
        const settings = await getCalendarSettings();
        const targetCalendar = calendarId || settings.calendarId || 'primary';
        const snapshot = await readSnapshot();
        const evaluationByBlock = new Map((snapshot.store.blockEvaluations || []).map(item => [item.id, item]));
        const segmentsById = new Map((snapshot.store.studySegments || []).map(item => [item.id, item]));
        let synced = 0;
        for (const item of await listCalendarQueue()) {
            const at = Date.now();
            if (item.state === 'SYNCED' && item.reason !== 'evaluation-updated') continue;
            if (item.nextAttemptAt && item.nextAttemptAt > at) continue;
            const blockId = item.blockId || item.entityId;
            const block = snapshot.store.studyBlocks?.find(value => value.id === blockId);
            const segment = item.entityType === 'STUDY_SEGMENT' ? segmentsById.get(item.entityId) : (snapshot.store.studySegments || []).find(value => value.blockId === blockId && value.endedAt) || (block?.endedAt ? { id: `legacy-${block.id}`, blockId, startedAt: block.startedAt, endedAt: block.endedAt, effectiveSeconds: block.effectiveStudySeconds || 0, status: 'CLOSED' } : null);
            if (!block || !segment?.endedAt) continue;
            const leaseToken = await acquire(item, at);
            if (!leaseToken) continue;
            try {
                const remote = await adapter.upsertEvent({ calendarId: targetCalendar, block, segment, evaluation: evaluationByBlock.get(block.id), colorId: settings.subjectColors?.[block.subject] });
                await updateIfOwned(item.id, leaseToken, { state: 'SYNCED', reason: null, remoteEventId: remote?.id || item.remoteEventId || null, calendarId: targetCalendar, lastError: null, errorCode: null, retryable: false, nextAttemptAt: 0, leaseToken: null, leaseExpiresAt: null, syncedAt: nowIso() });
                synced++;
                onProgress?.({ item, state: 'SYNCED' });
            } catch (error) {
                const attempts = Number(item.attempts || 0) + 1;
                const transient = error.retryable !== false;
                const retryable = transient && attempts < MAX_ATTEMPTS;
                const delay = Number(error.retryAfterMs || 0) || Math.min(60 * 60 * 1000, 1000 * 2 ** Math.min(attempts, 10));
                await updateIfOwned(item.id, leaseToken, { state: 'ERROR', attempts, lastError: error.message, errorCode: error.code || 'UNKNOWN', retryable, nextAttemptAt: retryable ? Date.now() + delay : 0, leaseToken: null, leaseExpiresAt: null });
                onProgress?.({ item, state: 'ERROR', error });
            }
        }
        return { synced, pending: (await listCalendarQueue()).filter(item => item.state !== 'SYNCED').length };
    });
}

export { LEASE_MS, MAX_ATTEMPTS };
