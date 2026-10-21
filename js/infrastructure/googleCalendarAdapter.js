import { GOOGLE_CALENDAR_SCOPE } from './googleConfig.js';

// calendar.app.created is the least-privilege scope for the secondary
// calendar created by Study Grand Prix. Existing calendars require an
// incremental calendar.events grant, which callers may request explicitly.
const CALENDAR_SCOPE = GOOGLE_CALENDAR_SCOPE;
const CALENDAR_MANAGE_SCOPE = 'https://www.googleapis.com/auth/calendar';

function encode(value) {
    return encodeURIComponent(String(value));
}

function base32hex(value) {
    return Array.from(new TextEncoder().encode(String(value)), byte => byte.toString(16).padStart(2, '0')).join('');
}

function fnv64(value, offset) {
    let hash = BigInt(offset);
    for (const byte of new TextEncoder().encode(String(value))) {
        hash ^= BigInt(byte);
        hash = BigInt.asUintN(64, hash * 1099511628211n);
    }
    return hash.toString(16).padStart(16, '0');
}

function eventIdFor(blockId, segmentId = blockId) {
    // Calendar event IDs must use RFC 2938 base32hex (a-v, 0-9). Encoding
    // local identities keeps the key stable without leaking unsupported chars.
    const raw = `${blockId}:${segmentId}`;
    const encoded = base32hex(raw);
    // Keep ordinary IDs transparent. For unusually large local identities,
    // hash the complete value instead of truncating and risking collisions.
    return encoded.length <= 1000 ? `sgp${encoded}` : `sgp${fnv64(raw, 14695981039346656037n)}${fnv64(raw, 1099511628211n)}`;
}

export class GoogleCalendarAdapter {
    constructor({ clientId = '', fetchImpl = globalThis.fetch, windowObj = globalThis } = {}) {
        this.clientId = clientId;
        this.fetch = fetchImpl;
        this.window = windowObj;
        this.accessToken = null;
        this.tokenExpiresAt = 0;
        this.tokenClient = null;
    }

    get connected() { return Boolean(this.accessToken); }

    async connect({ scope = CALENDAR_SCOPE } = {}) {
        const gis = this.window?.google?.accounts?.oauth2;
        if (!this.clientId) throw new Error('O Google Agenda ainda não está configurado para este site. Defina o Client ID público da aplicação.');
        if (!gis?.initTokenClient) throw new Error('O Google Identity Services ainda não foi carregado.');
        return new Promise((resolve, reject) => {
            this.tokenClient = gis.initTokenClient({
                client_id: this.clientId,
                scope,
                callback: response => {
                    if (!response?.access_token) { reject(new Error(response?.error_description || 'Autorização do Google não concluída.')); return; }
                    this.accessToken = response.access_token;
                    this.tokenExpiresAt = response.expires_in ? Date.now() + Number(response.expires_in) * 1000 : 0;
                    resolve({ expiresIn: response.expires_in });
                }
            });
            try { this.tokenClient.requestAccessToken({ prompt: 'consent' }); }
            catch (error) { reject(error); }
        });
    }

    disconnect() { this.accessToken = null; this.tokenExpiresAt = 0; this.tokenClient = null; }

    async revokeAccess() {
        const token = this.accessToken;
        if (!token) return;
        const revoke = this.window?.google?.accounts?.oauth2?.revoke;
        if (typeof revoke === 'function') {
            await new Promise((resolve, reject) => revoke(token, response => response?.error ? reject(new Error(response.error)) : resolve()));
        }
        this.disconnect();
    }

    async request(path, options = {}) {
        if (!this.accessToken) throw new Error('Conecte uma conta Google antes de sincronizar.');
        if (this.tokenExpiresAt && Date.now() >= this.tokenExpiresAt - 5000) {
            this.disconnect();
            const error = new Error('A autorização do Google expirou. Conecte a conta novamente.');
            error.code = 'AUTH_EXPIRED'; error.retryable = false; throw error;
        }
        let response;
        try {
            response = await this.fetch(`https://www.googleapis.com/calendar/v3${path}`, {
                ...options,
                headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json', ...(options.headers || {}) }
            });
        } catch (cause) {
            const error = new Error('Não foi possível conectar ao Google Agenda.');
            error.code = 'NETWORK_ERROR'; error.retryable = true; error.cause = cause; throw error;
        }
        if (response.status === 401) { this.accessToken = null; const error = new Error('A autorização do Google expirou. Conecte a conta novamente.'); error.code = 'AUTH_EXPIRED'; error.retryable = false; throw error; }
        if (!response.ok) {
            let detail = '';
            try { detail = (await response.json())?.error?.message || ''; } catch { /* response may be empty */ }
            const error = new Error(`Google Agenda recusou a operação (${response.status})${detail ? `: ${detail}` : '.'}`);
            error.code = response.status === 429 ? 'RATE_LIMIT' : response.status >= 500 ? 'TRANSIENT_API' : response.status === 404 ? 'CALENDAR_NOT_FOUND' : response.status === 403 ? 'PERMISSION_DENIED' : 'API_ERROR';
            error.retryable = response.status === 429 || response.status >= 500;
            error.permanent = !error.retryable;
            error.retryAfterMs = Number(response.headers?.get?.('Retry-After') || 0) * 1000 || 0;
            throw error;
        }
        return response.status === 204 ? null : response.json();
    }

    async listCalendars() { return (await this.request('/users/me/calendarList')).items || []; }

    async createStudyCalendar() {
        return this.request('/calendars', { method: 'POST', body: JSON.stringify({ summary: 'Study Grand Prix 🏁', description: 'Blocos efetivos de estudo do Study Grand Prix.' }) });
    }

    async upsertEvent({ calendarId = 'primary', block, segment = null, evaluation = null, colorId = null }) {
        segment ||= block?.startedAt && block?.endedAt ? { id: `legacy-${block.id}`, startedAt: block.startedAt, endedAt: block.endedAt, effectiveSeconds: block.effectiveStudySeconds || 0 } : null;
        if (!block?.id || !segment?.id || !segment.startedAt || !segment.endedAt) throw new Error('Segmento sem intervalo de tempo para sincronizar.');
        const startedAt = Date.parse(segment.startedAt);
        const endedAt = Date.parse(segment.endedAt);
        if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt) || endedAt <= startedAt) throw new Error('Segmento com intervalo de tempo inválido.');
        const elapsedSeconds = Math.floor((endedAt - startedAt) / 1000);
        const effectiveSeconds = Math.max(0, Math.min(Number.isFinite(Number(segment.effectiveSeconds)) ? Number(segment.effectiveSeconds) : elapsedSeconds, elapsedSeconds));
        const minutes = Math.round(effectiveSeconds / 60);
        const event = {
            id: eventIdFor(block.id, segment.id),
            summary: `🏎️ ${block.subjectName || block.subject} — Study Grand Prix`,
            description: [
                `Matéria: ${block.subjectName || block.subject}`,
                `Tempo efetivo: ${minutes} minutos`,
            `Voltas concluídas no stint: ${(block.completedLaps || []).length}`,
                `Circuito: ${block.circuitId}`,
                `Avaliação do stint: ${evaluation ? `${evaluation.focus}/10` : 'pendente'}`,
                `Modalidade: ${block.mode}`,
                `Identificador local: ${block.id}`
            ].join('\n'),
            start: { dateTime: new Date(startedAt).toISOString() },
            end: { dateTime: new Date(endedAt).toISOString() },
            extendedProperties: { private: { studyGrandPrixBlockId: block.id, studyGrandPrixSegmentId: segment.id, studyGrandPrixVersion: String(segment.updatedAt || segment.createdAt || '') } }
        };
        if (colorId) event.colorId = String(colorId);
        return this.request(`/calendars/${encode(calendarId)}/events/${encode(event.id)}`, { method: 'PUT', body: JSON.stringify(event) });
    }
}

export { CALENDAR_SCOPE, CALENDAR_MANAGE_SCOPE, eventIdFor };
