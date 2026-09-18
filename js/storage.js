
// ============================================================
// SILVER ARROW
// STORAGE
// ============================================================

const STORE_KEY = "silverArrowPomodoro2026";


// ============================================================
// DEFAULT STORE
// ============================================================

function createDefaultStore() {

    return {

        // ----------------------------------------------------
        // HISTÓRICO TOTAL
        // ----------------------------------------------------

        laps: 0,
        totalSeconds: 0,


        // ----------------------------------------------------
        // HISTÓRICO POR DIA
        // ----------------------------------------------------

        byDate: {},


        // ----------------------------------------------------
        // HISTÓRICO POR CIRCUITO
        // ----------------------------------------------------

        byCircuit: {},


        // ----------------------------------------------------
        // ÚLTIMO CIRCUITO
        // ----------------------------------------------------

        lastCircuit: null,


        // ----------------------------------------------------
        // SESSÕES / AVALIAÇÕES
        // ----------------------------------------------------

        sessions: [],


        // ----------------------------------------------------
        // SONO
        // ----------------------------------------------------

        sleepByDate: {},


        // ----------------------------------------------------
        // REST
        // ----------------------------------------------------

        restByDate: {}
    };
}


// ============================================================
// SAFE NUMBER
// ============================================================

function safeNumber(
    value,
    fallback = 0
) {

    const number =
        Number(value);

    return Number.isFinite(number)
        ? number
        : fallback;
}


// ============================================================
// SAFE NON-NEGATIVE NUMBER
// ============================================================

function safePositiveNumber(
    value,
    fallback = 0
) {

    return Math.max(
        0,
        safeNumber(
            value,
            fallback
        )
    );
}


// ============================================================
// SAFE INTEGER
// ============================================================

function safeInteger(
    value,
    fallback = 0
) {

    return Math.floor(
        safePositiveNumber(
            value,
            fallback
        )
    );
}


// ============================================================
// DATE
// ============================================================

export function todayKey() {

    const date =
        new Date();

    return [

        date.getFullYear(),

        String(
            date.getMonth() + 1
        ).padStart(2, "0"),

        String(
            date.getDate()
        ).padStart(2, "0")

    ].join("-");
}


// ============================================================
// NORMALIZE DAILY ENTRY
// ============================================================
//
// Formato novo:
//
// {
//     laps: 4,
//     totalSeconds: 3600
// }
//
// Formato antigo:
//
// 4
//
// Ambos são convertidos para o formato novo.
// ============================================================

function normalizeDailyEntry(
    entry
) {

    // --------------------------------------------------------
    // OLD FORMAT
    // --------------------------------------------------------

    if (
        typeof entry === "number" ||
        typeof entry === "string"
    ) {

        return {

            laps:
                safeInteger(
                    entry
                ),

            totalSeconds: 0
        };
    }


    // --------------------------------------------------------
    // INVALID FORMAT
    // --------------------------------------------------------

    if (
        !entry ||
        typeof entry !== "object" ||
        Array.isArray(entry)
    ) {

        return {

            laps: 0,
            totalSeconds: 0
        };
    }


    // --------------------------------------------------------
    // NEW FORMAT
    // --------------------------------------------------------

    return {

        laps:
            safeInteger(
                entry.laps
            ),

        totalSeconds:
            safePositiveNumber(
                entry.totalSeconds
            )
    };
}


// ============================================================
// NORMALIZE BY DATE
// ============================================================
//
// Migra TODOS os registros antigos.
//
// Depois dessa função, todos os dias possuem:
//
// {
//     laps: Number,
//     totalSeconds: Number
// }
// ============================================================

function normalizeByDate(
    byDate
) {

    if (
        !byDate ||
        typeof byDate !== "object" ||
        Array.isArray(byDate)
    ) {

        return {};
    }

    const normalized = {};

    Object.entries(
        byDate
    ).forEach(
        ([dateKey, entry]) => {

            normalized[dateKey] =
                normalizeDailyEntry(
                    entry
                );
        }
    );

    return normalized;
}


// ============================================================
// NORMALIZE CIRCUITS
// ============================================================

function normalizeByCircuit(
    byCircuit
) {

    if (
        !byCircuit ||
        typeof byCircuit !== "object" ||
        Array.isArray(byCircuit)
    ) {

        return {};
    }

    const normalized = {};

    Object.entries(
        byCircuit
    ).forEach(
        ([circuitId, data]) => {

            normalized[circuitId] = {

                laps:
                    safeInteger(
                        data?.laps
                    )
            };
        }
    );

    return normalized;
}


// ============================================================
// NORMALIZE SESSIONS
// ============================================================

function normalizeSessions(
    sessions
) {

    if (
        !Array.isArray(
            sessions
        )
    ) {

        return [];
    }

    return sessions
        .filter(
            session =>
                session &&
                typeof session === "object" &&
                !Array.isArray(session)
        )
        .slice(-500);
}


// ============================================================
// NORMALIZE DATE MAP
// ============================================================
//
// Usado para:
//
// sleepByDate
// restByDate
//
// Mantém apenas números válidos.
// ============================================================

function normalizeDateMap(
    map
) {

    if (
        !map ||
        typeof map !== "object" ||
        Array.isArray(map)
    ) {

        return {};
    }

    const normalized = {};

    Object.entries(
        map
    ).forEach(
        ([dateKey, value]) => {

            const number =
                safeNumber(
                    value,
                    NaN
                );

            if (
                Number.isFinite(
                    number
                )
            ) {

                normalized[dateKey] =
                    Math.max(
                        0,
                        number
                    );
            }
        }
    );

    return normalized;
}


// ============================================================
// NORMALIZE STORE
// ============================================================

function normalizeStore(
    parsed
) {

    const defaults =
        createDefaultStore();

    const source =
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed)
            ? parsed
            : {};

    const store = {

        ...defaults,
        ...source
    };


    // --------------------------------------------------------
    // TOTALS
    // --------------------------------------------------------

    store.laps =
        safeInteger(
            store.laps
        );

    store.totalSeconds =
        safePositiveNumber(
            store.totalSeconds
        );


    // --------------------------------------------------------
    // BY DATE
    // --------------------------------------------------------

    store.byDate =
        normalizeByDate(
            store.byDate
        );


    // --------------------------------------------------------
    // BY CIRCUIT
    // --------------------------------------------------------

    store.byCircuit =
        normalizeByCircuit(
            store.byCircuit
        );


    // --------------------------------------------------------
    // SESSIONS
    // --------------------------------------------------------

    store.sessions =
        normalizeSessions(
            store.sessions
        );


    // --------------------------------------------------------
    // SLEEP
    // --------------------------------------------------------

    store.sleepByDate =
        normalizeDateMap(
            store.sleepByDate
        );


    // --------------------------------------------------------
    // REST
    // --------------------------------------------------------

    store.restByDate =
        normalizeDateMap(
            store.restByDate
        );


    // --------------------------------------------------------
    // LAST CIRCUIT
    // --------------------------------------------------------

    if (
        typeof store.lastCircuit !== "string" ||
        !store.lastCircuit.trim()
    ) {

        store.lastCircuit =
            null;
    }


    return store;
}


// ============================================================
// LOAD
// ============================================================

export function loadData() {

    try {

        const raw =
            localStorage.getItem(
                STORE_KEY
            );


        // ----------------------------------------------------
        // NOTHING SAVED
        // ----------------------------------------------------

        if (!raw) {

            return createDefaultStore();
        }


        // ----------------------------------------------------
        // PARSE
        // ----------------------------------------------------

        const parsed =
            JSON.parse(
                raw
            );


        // ----------------------------------------------------
        // NORMALIZE + MIGRATE
        // ----------------------------------------------------

        return normalizeStore(
            parsed
        );

    }
    catch (error) {

        console.warn(
            "SILVER ARROW: falha ao carregar storage.",
            error
        );

        return createDefaultStore();
    }
}


// ============================================================
// SAVE
// ============================================================

export function saveData(
    store
) {

    try {

        // ----------------------------------------------------
        // VALIDATE ROOT
        // ----------------------------------------------------

        if (
            !store ||
            typeof store !== "object" ||
            Array.isArray(store)
        ) {

            console.warn(
                "SILVER ARROW: store inválido."
            );

            return false;
        }


        // ----------------------------------------------------
        // NORMALIZE
        // ----------------------------------------------------

        const normalized =
            normalizeStore(
                store
            );


        // ----------------------------------------------------
        // KEEP ORIGINAL OBJECT IN SYNC
        // ----------------------------------------------------

        Object.keys(
            store
        ).forEach(
            key => {

                delete store[key];
            }
        );

        Object.assign(
            store,
            normalized
        );


        // ----------------------------------------------------
        // PERSIST
        // ----------------------------------------------------

        localStorage.setItem(
            STORE_KEY,
            JSON.stringify(
                store
            )
        );

        return true;

    }
    catch (error) {

        console.warn(
            "SILVER ARROW: falha ao salvar storage.",
            error
        );

        return false;
    }
}


// ============================================================
// ENSURE TODAY
// ============================================================
//
// Garante que:
//
// store.byDate[todayKey()]
//
// sempre exista.
//
// IMPORTANTE:
// isso NÃO zera os dados de ontem.
// Cada data possui seu próprio registro.
// ============================================================

export function ensureToday(
    store
) {

    if (
        !store ||
        typeof store !== "object"
    ) {

        return {
            laps: 0,
            totalSeconds: 0
        };
    }


    if (
        !store.byDate ||
        typeof store.byDate !== "object" ||
        Array.isArray(store.byDate)
    ) {

        store.byDate = {};
    }


    const key =
        todayKey();


    store.byDate[key] =
        normalizeDailyEntry(
            store.byDate[key]
        );


    return store.byDate[key];
}


// ============================================================
// TODAY DATA
// ============================================================

export function getTodayData(
    store
) {

    return ensureToday(
        store
    );
}


// ============================================================
// REGISTER TODAY LAP
// ============================================================
//
// UMA volta concluída.
//
// Atualiza:
//
// - today.laps
// - today.totalSeconds
// - store.laps
// - store.totalSeconds
//
// NÃO atualiza:
//
// - circuito
// - sessions
// - rating
//
// Essas responsabilidades ficam fora do storage.
// ============================================================

export function registerTodayLap(
    store,
    seconds = 0
) {

    const today =
        ensureToday(
            store
        );


    const duration =
        safePositiveNumber(
            seconds
        );


    // --------------------------------------------------------
    // TODAY
    // --------------------------------------------------------

    today.laps =
        safeInteger(
            today.laps
        ) + 1;

    today.totalSeconds =
        safePositiveNumber(
            today.totalSeconds
        ) + duration;


    // --------------------------------------------------------
    // GLOBAL
    // --------------------------------------------------------

    store.laps =
        safeInteger(
            store.laps
        ) + 1;

    store.totalSeconds =
        safePositiveNumber(
            store.totalSeconds
        ) + duration;


    return today;
}


// ============================================================
// ADD TODAY TIME
// ============================================================
//
// Adiciona tempo sem registrar uma volta.
// ============================================================

export function addTodayTime(
    store,
    seconds = 0
) {

    const today =
        ensureToday(
            store
        );


    const duration =
        safePositiveNumber(
            seconds
        );


    today.totalSeconds =
        safePositiveNumber(
            today.totalSeconds
        ) + duration;


    store.totalSeconds =
        safePositiveNumber(
            store.totalSeconds
        ) + duration;


    return today;
}


// ============================================================
// TODAY STATS
// ============================================================

export function getTodayStats(
    store
) {

    const today =
        ensureToday(
            store
        );


    return {

        laps:
            safeInteger(
                today.laps
            ),

        totalSeconds:
            safePositiveNumber(
                today.totalSeconds
            )
    };
}


// ============================================================
// CIRCUIT DATA
// ============================================================

export function getCircuitData(
    store,
    circuitId
) {

    if (
        !store ||
        !circuitId
    ) {

        return null;
    }


    if (
        !store.byCircuit ||
        typeof store.byCircuit !== "object" ||
        Array.isArray(store.byCircuit)
    ) {

        store.byCircuit = {};
    }


    if (
        !store.byCircuit[circuitId] ||
        typeof store.byCircuit[circuitId] !== "object"
    ) {

        store.byCircuit[circuitId] = {
            laps: 0
        };
    }


    store.byCircuit[circuitId].laps =
        safeInteger(
            store.byCircuit[circuitId].laps
        );


    return store.byCircuit[circuitId];
}


// ============================================================
// SLEEP
// ============================================================

export function getTodaySleep(
    store
) {

    if (
        !store ||
        !store.sleepByDate
    ) {

        return null;
    }


    const value =
        store.sleepByDate[
            todayKey()
        ];


    if (
        value === undefined ||
        value === null
    ) {

        return null;
    }


    const number =
        safeNumber(
            value,
            NaN
        );


    if (
        !Number.isFinite(
            number
        )
    ) {

        return null;
    }


    return number;
}


export function setTodaySleep(
    store,
    hours
) {

    if (
        !store ||
        typeof store !== "object"
    ) {

        return;
    }


    if (
        !store.sleepByDate ||
        typeof store.sleepByDate !== "object" ||
        Array.isArray(store.sleepByDate)
    ) {

        store.sleepByDate = {};
    }


    store.sleepByDate[
        todayKey()
    ] =
        safePositiveNumber(
            hours
        );
}


// ============================================================
// REST
// ============================================================

export function getTodayRest(
    store
) {

    if (
        !store ||
        !store.restByDate
    ) {

        return null;
    }


    const value =
        store.restByDate[
            todayKey()
        ];


    if (
        value === undefined ||
        value === null
    ) {

        return null;
    }


    const number =
        safeNumber(
            value,
            NaN
        );


    if (
        !Number.isFinite(
            number
        )
    ) {

        return null;
    }


    return Math.max(
        0,
        Math.min(
            100,
            number
        )
    );
}


export function setTodayRest(
    store,
    rest
) {

    if (
        !store ||
        typeof store !== "object"
    ) {

        return;
    }


    if (
        !store.restByDate ||
        typeof store.restByDate !== "object" ||
        Array.isArray(store.restByDate)
    ) {

        store.restByDate = {};
    }


    const value =
        Math.max(
            0,
            Math.min(
                100,
                Math.round(
                    safeNumber(
                        rest
                    )
                )
            )
        );


    store.restByDate[
        todayKey()
    ] = value;
}


// ============================================================
// SAVE TODAY
// ============================================================
//
// Garante o registro de hoje e salva.
// ============================================================

export function saveToday(
    store
) {

    ensureToday(
        store
    );

    return saveData(
        store
    );
}


// ============================================================
// STORAGE KEY
// ============================================================

export function getStorageKey() {

    return STORE_KEY;
}
