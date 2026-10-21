export const DATABASE_NAME = 'study-grand-prix';
export const DATABASE_VERSION = 3;
export const STORES = ['metadata', 'laps', 'evaluations', 'blocks', 'segments', 'syncQueue'];
let connection;
export function openDatabase() {
    if (connection) return Promise.resolve(connection);
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
        request.onupgradeneeded = () => {
            for (const name of STORES) {
                if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath: 'id' });
            }
        };
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('Feche as outras abas para atualizar o banco de dados.'));
        request.onsuccess = () => {
            connection = request.result;
            connection.onversionchange = () => { connection.close(); connection = null; };
            resolve(connection);
        };
    });
}
// Work only schedules IDB requests synchronously or in request callbacks.
// Resolve on transaction completion, never on an individual request's success.
export async function transaction(names, mode, work) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(names, mode, mode === 'readwrite' ? { durability: 'strict' } : undefined);
        let result;
        tx.oncomplete = () => {
            try { resolve(typeof result === 'function' ? result() : result); }
            catch (error) { reject(error); }
        };
        tx.onabort = () => reject(tx.error || new Error('Transação cancelada. Nenhuma alteração foi confirmada.'));
        tx.onerror = () => {}; // Abort is the single rejection path.
        try { result = work(tx); } catch (error) { tx.abort(); reject(error); }
    });
}
