import { transaction } from './database.js';
const SOURCE_KEYS = ['silverArrowPomodoro2026', 'silverArrowTeam', 'studyGrandPrixSubjects', 'studyGrandPrixChampionship'];
export async function migrateLegacy(store) {
    const migrated = await transaction(["metadata"], "readonly", tx => {
        const request = tx.objectStore("metadata").get("migration-v1");
        return () => Boolean(request.result);
    });
    if (migrated) return;
    const source = {};
    // Read without rewriting or deleting the source. A read/parse failure must
    // leave the migration uncommitted so a later attempt can recover it.
    for (const key of SOURCE_KEYS) source[key] = localStorage.getItem(key);
    let parsed;
    if (source.silverArrowPomodoro2026) {
        parsed = JSON.parse(source.silverArrowPomodoro2026);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Histórico antigo inválido. A origem foi preservada.');
    }
    const validSessions = store.sessions.filter(session => {
        if (typeof session.subject !== 'string' || !session.subject) return false;
        for (const [field, max] of [['focus',10], ['completion',100], ['errors',100], ['duration',Infinity]]) {
            const value = session[field];
            if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max)) return false;
        }
        return true;
    });
    const rejected = (Array.isArray(parsed?.sessions) ? parsed.sessions.length : 0) - validSessions.length;
    return transaction(['metadata', 'laps', 'evaluations'], 'readwrite', tx => {
        const meta = tx.objectStore('metadata');
        const marker = meta.get('migration-v1');
        marker.onsuccess = () => {
            if (marker.result) return;
            // Preserve the complete source (including records rejected by the
            // legacy normalizer) and the original aggregate baseline. Old data
            // may predate detailed sessions or have been truncated to 500.
            meta.add({ id: 'legacy-source-v1', source });
            meta.add({ id: 'legacy-baseline-v1', value: { ...store, sessions: [] } });
            if (rejected > 0) meta.add({ id: 'migration-warning-v1', rejected, message: `${rejected} avaliações antigas inválidas foram separadas das métricas. A cópia original foi preservada no banco e no localStorage.` });
            for (const [index, session] of validSessions.entries()) {
                const id = `legacy-v1:${index}`;
                tx.objectStore('laps').add({ ...session, id, legacy: true, state: 'EVALUATED', completedAt: typeof session.completedAt === 'string' ? session.completedAt : '' });
                tx.objectStore('evaluations').add({ ...session, id, lapId: id });
            }
            meta.add({ id: 'migration-v1', schemaVersion: 1, migratedAt: new Date().toISOString() });
        };
    });
}
