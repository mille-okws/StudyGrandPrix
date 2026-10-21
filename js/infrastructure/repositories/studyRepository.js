import { transaction } from '../database.js';
import { publishChange } from '../crossTabSync.js';
const finite = value => typeof value === 'number' && Number.isFinite(value);
const nonEmpty = value => typeof value === 'string' && value.trim().length > 0;

function validateBlock(block) {
    if (!block || !nonEmpty(block.id) || !nonEmpty(block.subject) || !nonEmpty(block.circuitId) ||
        !nonEmpty(block.mode) || !nonEmpty(block.startedAt) || !finite(block.effectiveStudySeconds) ||
        block.effectiveStudySeconds < 0 || !Array.isArray(block.completedLaps)) {
        throw new Error('Stint inválido. Nenhum bloco foi salvo.');
    }
}
function validateSegment(segment) {
    if (!segment || !nonEmpty(segment.id) || !nonEmpty(segment.blockId) || !nonEmpty(segment.sessionId) ||
        !nonEmpty(segment.subjectId) || !nonEmpty(segment.startedAt) || !finite(segment.effectiveSeconds) || segment.effectiveSeconds < 0) {
        throw new Error('Segmento de estudo inválido. Nenhum intervalo foi salvo.');
    }
    const start = Date.parse(segment.startedAt);
    const end = segment.endedAt == null ? null : Date.parse(segment.endedAt);
    if (!Number.isFinite(start) || (end !== null && (!Number.isFinite(end) || end < start))) throw new Error('Intervalo de estudo inválido.');
}
function effectiveSecondsFromSegments(segments) {
    const valid = (segments || []).filter(segment => segment?.startedAt && segment?.endedAt)
        .map(segment => ({ ...segment, start: Date.parse(segment.startedAt), end: Date.parse(segment.endedAt) }))
        .filter(segment => Number.isFinite(segment.start) && Number.isFinite(segment.end) && segment.end > segment.start)
        .sort((a, b) => a.start - b.start || a.end - b.end);
    let coveredUntil = -Infinity;
    let total = 0;
    for (const segment of valid) {
        const start = Math.max(segment.start, coveredUntil);
        if (start >= segment.end) continue;
        const duration = Math.min(Math.max(0, Number(segment.effectiveSeconds) || 0), (segment.end - start) / 1000);
        total += duration;
        coveredUntil = Math.max(coveredUntil, segment.end);
    }
    return Math.round(total);
}
function validateLap(lap) {
    const date = typeof lap?.dateKey === 'string' ? new Date(`${lap.dateKey}T12:00:00`) : new Date(NaN);
    const validDate = !Number.isNaN(date.getTime()) && [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-') === lap.dateKey;
    if (!validDate || !Number.isInteger(lap?.lap) || lap.lap < 1 || !lap || typeof lap.id !== 'string' || !lap.id || !finite(lap.duration) || lap.duration <= 0 ||
        typeof lap.subject !== 'string' || !lap.subject || typeof lap.circuitId !== 'string' || !lap.circuitId ||
        !/^\d{4}-\d{2}-\d{2}$/.test(lap.dateKey) || !['practice','qualy','race'].includes(lap.mode)) {
        throw new Error('Volta inválida. Nenhum registro foi salvo.');
    }
}
export async function completeLap(lap) {
    validateLap(lap);
    await transaction(['laps'], 'readwrite', tx => {
        const laps = tx.objectStore('laps');
        const existing = laps.get(lap.id);
        existing.onsuccess = () => {
            if (existing.result && ['duration','subject','circuitId','dateKey','mode','lap','blockId'].some(field => existing.result[field] !== lap[field])) { tx.abort(); return; }
            if (!existing.result) laps.add({ ...lap, legacy: false, state: 'RECORDED', completedAt: new Date().toISOString() });
        };
    });
    publishChange();
}

export async function createStudyBlock(block) {
    validateBlock(block);
    await transaction(['blocks'], 'readwrite', tx => {
        const blocks = tx.objectStore('blocks');
        const request = blocks.get(block.id);
        request.onsuccess = () => {
            if (request.result) return;
            blocks.add({ ...block, status: block.status || 'OPEN', createdAt: block.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() });
        };
    });
    publishChange();
    return block;
}

export async function startStudySegment(segment) {
    validateSegment(segment);
    await transaction(['segments'], 'readwrite', tx => {
        const store = tx.objectStore('segments');
        const request = store.get(segment.id);
        request.onsuccess = () => {
            if (!request.result) store.add({ ...segment, status: 'ACTIVE', effectiveSeconds: 0, createdAt: segment.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() });
        };
    });
    publishChange();
    return segment;
}

export async function finishStudySegment(id, { endedAt = new Date().toISOString(), effectiveSeconds } = {}) {
    if (!nonEmpty(id)) throw new Error('Segmento de estudo ausente.');
    await transaction(['segments'], 'readwrite', tx => {
        const store = tx.objectStore('segments');
        const request = store.get(id);
        request.onsuccess = () => {
            const segment = request.result;
            if (!segment || segment.status === 'CLOSED') return;
            const start = Date.parse(segment.startedAt);
            const end = Date.parse(endedAt);
            if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) { tx.abort(); return; }
            const seconds = Math.max(0, Math.min(Number.isFinite(effectiveSeconds) ? effectiveSeconds : (end - start) / 1000, (end - start) / 1000));
            store.put({ ...segment, endedAt: new Date(end).toISOString(), effectiveSeconds: Math.round(seconds), status: 'CLOSED', updatedAt: new Date().toISOString() });
        };
    });
    publishChange();
}

export async function recoverActiveSegments(at = new Date().toISOString(), ownerId = null) {
    await transaction(['segments'], 'readwrite', tx => {
        const store = tx.objectStore('segments');
        const request = store.getAll();
        request.onsuccess = () => {
            for (const segment of request.result.filter(item => item.status === 'ACTIVE' && (!ownerId || item.ownerId === ownerId))) {
                const endedAt = segment.updatedAt || segment.startedAt;
                store.put({ ...segment, status: 'CLOSED', endedAt, effectiveSeconds: 0, recoveredAt: at, updatedAt: at });
            }
        };
    });
}

export async function updateStudyBlock(block) {
    validateBlock(block);
    await transaction(['blocks'], 'readwrite', tx => {
        const blocks = tx.objectStore('blocks');
        const request = blocks.get(block.id);
        request.onsuccess = () => {
            if (!request.result) { tx.abort(); return; }
            blocks.put({ ...request.result, ...block, updatedAt: new Date().toISOString() });
        };
    });
    publishChange();
    return block;
}

export async function closeStudyBlock(block, { createEvaluation = true } = {}) {
    validateBlock(block);
    await transaction(['blocks', 'evaluations', 'segments'], 'readwrite', tx => {
        const blocks = tx.objectStore('blocks');
        const evaluations = tx.objectStore('evaluations');
        const segments = tx.objectStore('segments');
        const request = blocks.get(block.id);
        const segmentRequest = segments.getAll();
        let existing; let segmentRows;
        const finalize = () => {
            if (existing === undefined || segmentRows === undefined) return;
            if (existing?.status === 'EVALUATED' || existing?.status === 'PENDING_EVALUATION' || existing?.status === 'COMPLETED') return;
            const ownSegments = segmentRows.filter(segment => segment.blockId === block.id);
            const effectiveStudySeconds = ownSegments.length ? effectiveSecondsFromSegments(ownSegments) : Number(block.effectiveStudySeconds || 0);
            const closed = { ...(existing || {}), ...block, effectiveStudySeconds, status: effectiveStudySeconds >= 1 && createEvaluation ? 'PENDING_EVALUATION' : 'COMPLETED', endedAt: block.endedAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
            blocks.put(closed);
            if (effectiveStudySeconds >= 1 && createEvaluation) {
                const evaluation = evaluations.get(block.id);
                evaluation.onsuccess = () => {
                    if (!evaluation.result) evaluations.add({ id: block.id, blockId: block.id, targetType: 'STUDY_BLOCK', state: 'PENDING', createdAt: new Date().toISOString() });
                };
            }
        };
        request.onsuccess = () => { existing = request.result; finalize(); };
        segmentRequest.onsuccess = () => { segmentRows = segmentRequest.result || []; finalize(); };
    });
    publishChange();
    return block;
}

export async function evaluateStudyBlock(id, values) {
    if (!nonEmpty(id) || !values || !finite(values.focus) || values.focus < 0 || values.focus > 10 ||
        !finite(values.completion) || values.completion < 0 || values.completion > 100 ||
        !finite(values.errors) || values.errors < 0 || values.errors > 100) throw new Error('Avaliação de stint inválida.');
    await transaction(['blocks', 'evaluations'], 'readwrite', tx => {
        const blocks = tx.objectStore('blocks');
        const evaluations = tx.objectStore('evaluations');
        const blockRequest = blocks.get(id);
        blockRequest.onsuccess = () => {
            if (!blockRequest.result) { tx.abort(); return; }
            const existing = evaluations.get(id);
            existing.onsuccess = () => {
                if (existing.result?.state === 'EVALUATED') return;
                evaluations.put({ ...(existing.result || {}), id, blockId: id, targetType: 'STUDY_BLOCK', state: 'EVALUATED', focus: values.focus, completion: values.completion, errors: values.errors, evaluatedAt: new Date().toISOString() });
                blocks.put({ ...blockRequest.result, status: 'EVALUATED', updatedAt: new Date().toISOString() });
            };
        };
    });
    publishChange();
}
export async function evaluateLap(id, values) {
    if (!values || !finite(values.focus) || values.focus < 0 || values.focus > 10 ||
        !finite(values.completion) || values.completion < 0 || values.completion > 100 ||
        !finite(values.errors) || values.errors < 0 || values.errors > 100) throw new Error('Avaliação inválida.');
    await transaction(['laps', 'evaluations'], 'readwrite', tx => {
        const laps = tx.objectStore('laps');
        const evaluations = tx.objectStore('evaluations');
        const request = laps.get(id);
        request.onsuccess = () => {
            const lap = request.result;
            if (!lap) { tx.abort(); return; }
            // First confirmation wins, even if two tabs confirm concurrently.
            if (lap.state === 'EVALUATED') return;
            evaluations.add({ id, lapId: id, targetType: 'LAP', focus: values.focus, completion: values.completion, errors: values.errors, evaluatedAt: new Date().toISOString() });
            laps.put({ ...lap, state: 'EVALUATED' });
        };
    });
    publishChange();
}
export async function saveAuxiliary(store) {
    // Release 1 deliberately writes no totals or history from a tab snapshot.
    await transaction(['metadata'], 'readwrite', tx => {
        const meta = tx.objectStore('metadata');
        for (const field of ['sleepByDate', 'restByDate']) {
            for (const [date, value] of Object.entries(store[field] || {})) meta.put({ id: `${field}:${date}`, field, date, value });
        }
        meta.put({ id: 'lastCircuit', value: store.lastCircuit });
    });
}
export async function readSnapshot() {
    return transaction(['metadata','laps','evaluations','blocks','segments'], 'readonly', tx => {
        const meta = tx.objectStore('metadata');
        // Exclude the potentially large archival source from live projections.
        const m = meta.getAll(IDBKeyRange.upperBound('legacy-source-v1', true));
        const auxiliary = meta.getAll(IDBKeyRange.lowerBound('restByDate:'));
        const warning = meta.get('migration-warning-v1');
        const l = tx.objectStore('laps').getAll();
        const e = tx.objectStore('evaluations').getAll();
        const b = tx.objectStore('blocks').getAll();
        const sg = tx.objectStore('segments').getAll();
        return () => {
            const metadata = new Map([...m.result, ...auxiliary.result].map(item => [item.id, item]));
            const baseline = metadata.get('legacy-baseline-v1')?.value || {};
            const store = structuredClone({ laps: 0, totalSeconds: 0, byDate: {}, byCircuit: {}, sleepByDate: {}, restByDate: {}, ...baseline });
            store.sessions = [];
            const evaluations = new Map(e.result.map(item => [item.blockId || item.lapId || item.id, item]));
            const pending = [];
            const pendingBlocks = [];
            const laps = l.result.sort((a,b) => (a.completedAt || '').localeCompare(b.completedAt || '') || a.id.localeCompare(b.id, undefined, { numeric: true }));
            for (const lap of laps) {
                if (!lap.legacy) {
                    store.laps++;
                    store.totalSeconds += lap.duration;
                    const day = store.byDate[lap.dateKey] ||= { laps: 0, totalSeconds: 0 };
                    day.laps++; day.totalSeconds += lap.duration;
                    const circuit = store.byCircuit[lap.circuitId] ||= { laps: 0 };
                    circuit.laps++;
                }
                const evaluation = evaluations.get(lap.id);
                if (evaluation && evaluation.targetType !== 'STUDY_BLOCK') store.sessions.push({ ...lap, ...evaluation });
                else if (lap.state === 'PENDING_EVALUATION') pending.push(lap);
            }
            const blocks = b.result.sort((a, z) => (a.startedAt || '').localeCompare(z.startedAt || '') || a.id.localeCompare(z.id));
            const segments = sg.result || [];
            const blockEvaluations = [];
            for (const block of blocks) {
                const evaluation = evaluations.get(block.id);
                if (evaluation?.targetType === 'STUDY_BLOCK' && evaluation.state === 'EVALUATED') blockEvaluations.push({ ...block, ...evaluation });
                else if (block.status === 'PENDING_EVALUATION') pendingBlocks.push({ ...block, evaluation });
            }
            for (const item of auxiliary.result) {
                if (item.field) store[item.field][item.date] = item.value;
            }
            if (metadata.has('lastCircuit')) store.lastCircuit = metadata.get('lastCircuit').value;
            store.studySegments = segments;
            store.studyBlocks = blocks.map(block => { const ownSegments = segments.filter(segment => segment.blockId === block.id); return { ...block, segments: ownSegments, effectiveStudySeconds: ownSegments.length ? effectiveSecondsFromSegments(ownSegments) : Number(block.effectiveStudySeconds || 0) }; });
            store.blockEvaluations = blockEvaluations;
            store.sessions.push(...blockEvaluations);
            return { store, pending, pendingBlocks, migrationWarning: warning.result?.message };
        };
    });
}
