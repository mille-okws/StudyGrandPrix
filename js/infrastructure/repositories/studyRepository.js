import { transaction } from '../database.js';
import { publishChange } from '../crossTabSync.js';
const finite = value => typeof value === 'number' && Number.isFinite(value);
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
            if (existing.result && ['duration','subject','circuitId','dateKey','mode','lap'].some(field => existing.result[field] !== lap[field])) { tx.abort(); return; }
            if (!existing.result) laps.add({ ...lap, legacy: false, state: 'PENDING_EVALUATION', completedAt: new Date().toISOString() });
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
            evaluations.add({ id, lapId: id, focus: values.focus, completion: values.completion, errors: values.errors, evaluatedAt: new Date().toISOString() });
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
    return transaction(['metadata','laps','evaluations'], 'readonly', tx => {
        const meta = tx.objectStore('metadata');
        // Exclude the potentially large archival source from live projections.
        const m = meta.getAll(IDBKeyRange.upperBound('legacy-source-v1', true));
        const auxiliary = meta.getAll(IDBKeyRange.lowerBound('restByDate:'));
        const warning = meta.get('migration-warning-v1');
        const l = tx.objectStore('laps').getAll();
        const e = tx.objectStore('evaluations').getAll();
        return () => {
            const metadata = new Map([...m.result, ...auxiliary.result].map(item => [item.id, item]));
            const baseline = metadata.get('legacy-baseline-v1')?.value || {};
            const store = structuredClone({ laps: 0, totalSeconds: 0, byDate: {}, byCircuit: {}, sleepByDate: {}, restByDate: {}, ...baseline });
            store.sessions = [];
            const evaluations = new Map(e.result.map(item => [item.lapId, item]));
            const pending = [];
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
                if (evaluation) store.sessions.push({ ...lap, ...evaluation });
                else if (lap.state === 'PENDING_EVALUATION') pending.push(lap);
            }
            for (const item of auxiliary.result) {
                if (item.field) store[item.field][item.date] = item.value;
            }
            if (metadata.has('lastCircuit')) store.lastCircuit = metadata.get('lastCircuit').value;
            return { store, pending, migrationWarning: warning.result?.message };
        };
    });
}
