import { migrateLegacy } from "./js/infrastructure/migration.js";
import { completeLap, evaluateLap, evaluateStudyBlock, readSnapshot, createStudyBlock, updateStudyBlock, closeStudyBlock, startStudySegment, finishStudySegment, recoverActiveSegments } from "./js/infrastructure/repositories/studyRepository.js";
import { subscribeChanges } from "./js/infrastructure/crossTabSync.js";
import { enqueueCalendarBlock, getCalendarSettings, saveCalendarSettings, listCalendarQueue, syncCalendarQueue } from "./js/infrastructure/calendarSyncService.js";
import { GoogleCalendarAdapter } from "./js/infrastructure/googleCalendarAdapter.js";
import { buildStudyAnalytics } from "./js/ui/analyticsModel.js";
import { renderAnalytics, renderStudyCalendar } from "./js/ui/analyticsView.js";
import { GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CONFIG_ERROR, GOOGLE_CALENDAR_SCOPE } from "./js/infrastructure/googleConfig.js";

let calendarSettings = null;
const calendarAdapter = new GoogleCalendarAdapter({ clientId: GOOGLE_OAUTH_CLIENT_ID });
const TAB_ID = (() => { try { const key = 'study-grand-prix-tab-id'; const existing = sessionStorage.getItem(key); if (existing) return existing; const id = globalThis.crypto?.randomUUID?.() || `tab-${Date.now()}-${Math.random()}`; sessionStorage.setItem(key, id); return id; } catch { return `tab-${Date.now()}-${Math.random()}`; } })();
let activeSegment = null;

let synchronizing = false;
function showPersistenceError(error) {
    let notice = document.getElementById("persistenceNotice");
    if (!notice) {
        notice = document.createElement("p");
        notice.id = "persistenceNotice";
        notice.setAttribute("role", "alert");
        document.body.prepend(notice);
    }
    notice.textContent = `Não foi possível confirmar a gravação. ${error?.message || "Verifique o armazenamento do navegador."} Os dados já salvos foram preservados.`;
}
window.addEventListener("persistenceError", event => showPersistenceError(event.detail));
function setDataBusy(value) {
    state.dataBusy = value;
    for (const element of document.querySelectorAll('#startBtn, #resetBtn, #ratingSubmit, .modeswitch button')) element.disabled = value;
}
async function refreshPersistedData({ recover = false } = {}) {
    const snapshot = await readSnapshot();
    state.store = snapshot.store;
    state.savedPending = snapshot.pending;
    state.savedPendingBlocks = snapshot.pendingBlocks || [];
    if (recover && !state.currentBlock) {
        const ownSegment = snapshot.store.studySegments?.find(segment => segment.ownerId === TAB_ID && (segment.status === "ACTIVE" || segment.recoveredAt));
        state.currentBlock = ownSegment ? snapshot.store.studyBlocks?.find(block => block.id === ownSegment.blockId && block.status === "OPEN") || null : null;
    }
    if (recover && state.currentBlock) {
        activeSegment = snapshot.store.studySegments?.find(segment => segment.blockId === state.currentBlock.id && segment.ownerId === TAB_ID && segment.status === "ACTIVE") || null;
    }
    if (snapshot.migrationWarning) {
        let warning = document.getElementById("migrationWarning");
        if (!warning) { warning = document.createElement("p"); warning.id = "migrationWarning"; warning.setAttribute("role", "status"); document.body.prepend(warning); }
        warning.textContent = snapshot.migrationWarning;
    }
    if (state.pendingLap && !snapshot.pending.some(lap => lap.id === state.pendingLap.id)) {
        state.pendingLap = null;
        state.awaitingNextLap = false;
        document.getElementById("ratingPanel").hidden = true;
    }
    if (state.pendingBlock && !snapshot.pendingBlocks.some(block => block.id === state.pendingBlock.id)) {
        state.pendingBlock = null;
        document.getElementById("ratingPanel").hidden = true;
    }
    if (recover && !state.pendingLap && !state.pendingBlock && snapshot.pendingBlocks?.length) {
        state.pendingBlock = snapshot.pendingBlocks[0];
        openPendingRating();
        setEngineer("Há um stint salvo aguardando avaliação. Você pode confirmar agora ou continuar o descanso.");
    } else if (recover && !state.pendingLap && !state.pendingBlock && snapshot.pending.length) {
        state.pendingLap = snapshot.pending[0];
        openPendingRating();
        setEngineer("Há uma volta salva aguardando avaliação. Confirme para atualizar sua telemetria.");
    }
    renderSummary(); renderCarStatus(); renderTelemetry(); renderAnalytics(buildStudyAnalytics(snapshot.store)); renderFocusChart(); renderCircuitList(); updateDisplay();
    renderStudyCalendar(snapshot.store, { view: state.calendarView });
}
async function reconcileExternalChanges() {
    if (synchronizing || state.dataBusy || state.unsavedLap) return;
    synchronizing = true;
    try { await refreshPersistedData(); }
    catch (error) { showPersistenceError(error); }
    finally { synchronizing = false; }
}

import { renderChampionship } from "./js/championship.js";
import { initializeSubjects, getSelectedSubject } from "./js/subjects.js";

// ============================================================
// SILVER ARROW
// MAIN APPLICATION
// ============================================================

import { initializeTeamSelection } from "./js/teamSelection.js";

// ============================================================
// DATA
// ============================================================

import { RACES } from "./data/races.js";
import { MODES } from "./data/modes.js";

// ============================================================
// TEAM
// ============================================================

import {
    initializeTeam
} from "./js/teamManager.js";

// ============================================================
// SESSION
// ============================================================

import {
    initializeSessionManager,
    configureSession,
    setMode,
    startTimer,
    pauseTimer,
    resetTimer,
    retryCompletedLap
} from "./js/sessionManager.js";

// ============================================================
// TRACK
// ============================================================

import {
    initializeTrackRendering,
    renderTrack,
    renderCircuitList,
    selectCircuit,
    updateTrackProgress
} from "./js/track/trackRendering.js";

// ============================================================
// STORAGE
// ============================================================

import {
    loadData,
    saveData,
    todayKey,
    ensureToday,
    getTodayStats,
    registerTodayLap,
    getCircuitData,
    getTodaySleep as getStoredTodaySleep,
    setTodaySleep as setStoredTodaySleep,
    getTodayRest as getStoredTodayRest,
    setTodayRest as setStoredTodayRest
} from "./js/storage.js";


// ============================================================
// STATE
// ============================================================

const state = {

    store: loadData(),

    currentRaceId: null,

    mode: "practice",

    secondsLeft:
        MODES.practice.minutes * 60,

    totalSeconds:
        MODES.practice.minutes * 60,

    running: false,
    starting: false,

    timerId: null,

    currentLap: 1,

    completedLaps: 0,

    sessionLapLimit: null,
    awaitingNextLap: false,

    rest: 0,

    pendingLap: null,
    pendingBlock: null,
    savedPendingBlocks: [],
    currentBlock: null,
    calendarView: "day",

    currentDateKey: todayKey()

};


// ============================================================
// GENERIC HELPERS
// ============================================================

function pick(array) {

    if (!Array.isArray(array) || !array.length) {
        return "";
    }

    return array[
        Math.floor(
            Math.random() * array.length
        )
    ];

}


function avg(array) {

    if (!Array.isArray(array) || !array.length) {
        return 0;
    }

    return (
        array.reduce(
            (sum, value) =>
                sum + Number(value || 0),
            0
        ) / array.length
    );

}


function fmtTime(seconds) {

    const safeSeconds = Math.max(
        0,
        Number(seconds) || 0
    );

    const minutes = Math.floor(
        safeSeconds / 60
    );

    const secs = Math.floor(
        safeSeconds % 60
    );

    return (
        String(minutes).padStart(2, "0") +
        ":" +
        String(secs).padStart(2, "0")
    );

}


function fmtHM(totalSeconds) {

    const safeSeconds = Math.max(
        0,
        Number(totalSeconds) || 0
    );

    const hours = Math.floor(
        safeSeconds / 3600
    );

    const minutes = Math.floor(
        (safeSeconds % 3600) / 60
    );

    return (
        hours +
        "h " +
        String(minutes).padStart(2, "0") +
        "m"
    );

}


function makeDateKey(date = new Date()) {

    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
    ].join("-");

}


// ============================================================
// DAILY STORAGE
// ============================================================
//
// Estrutura nova:
//
// byDate: {
//     "2026-09-18": {
//         laps: 4,
//         totalSeconds: 7200
//     }
// }
//
// Compatibilidade:
//
// "2026-09-17": 6
//
// Valores antigos continuam sendo aceitos e convertidos.
//

function normalizeDailyStore() {

    if (!state.store.byDate) {
        state.store.byDate = {};
    }

    Object.entries(
        state.store.byDate
    ).forEach(
        ([dateKey, value]) => {

            // ------------------------------------------------
            // OLD FORMAT
            // ------------------------------------------------

            if (
                typeof value === "number" ||
                typeof value === "string"
            ) {

                state.store.byDate[dateKey] = {

                    laps:
                        Number(value) || 0,

                    totalSeconds:
                        0

                };

                return;
            }

            // ------------------------------------------------
            // INVALID FORMAT
            // ------------------------------------------------

            if (
                !value ||
                typeof value !== "object"
            ) {

                state.store.byDate[dateKey] = {

                    laps: 0,
                    totalSeconds: 0

                };

                return;
            }

            // ------------------------------------------------
            // NORMALIZE OBJECT
            // ------------------------------------------------

            state.store.byDate[dateKey] = {

                laps:
                    Number(value.laps) || 0,

                totalSeconds:
                    Number(value.totalSeconds) || 0

            };

        }
    );

}


function ensureTodayData() {

    normalizeDailyStore();

    const key = todayKey();

    if (!state.store.byDate[key]) {

        state.store.byDate[key] = {

            laps: 0,

            totalSeconds: 0

        };

    }

    state.currentDateKey = key;

    return state.store.byDate[key];

}


function getTodayData() {

    return ensureTodayData();

}


function saveStore() {

    ensureTodayData();

    saveData(
        state.store
    );

}


// ============================================================
// DATE ROLLOVER
// ============================================================
//
// Se o usuário deixar a aplicação aberta durante a virada
// do dia, o painel passa automaticamente a consultar o novo dia.
//

function checkDateRollover() {

    const currentKey = todayKey();

    if (
        currentKey ===
        state.currentDateKey
    ) {
        return false;
    }

    state.currentDateKey =
        currentKey;

    ensureTodayData();

    initializeRestForToday();

    renderSummary();
    renderTelemetry();
    renderFocusChart();
    renderCarStatus();
    updateRestDisplay();

    saveData(
        state.store
    );

    return true;

}


// ============================================================
// CURRENT RACE
// ============================================================

function getCurrentRace() {

    return (
        RACES.find(
            race =>
                race.id ===
                state.currentRaceId
        ) || null
    );

}


function getCurrentRaceLaps() {

    const race =
        getCurrentRace();

    return race?.laps || 0;

}


// ============================================================
// REST / SLEEP
// ============================================================

function calculateRestFromSleep(
    sleepHours
) {

    const idealSleep = 8;

    const hours =
        Number(sleepHours);

    if (
        sleepHours === null ||
        sleepHours === undefined ||
        Number.isNaN(hours)
    ) {
        return 0;
    }

    const rest =
        (hours / idealSleep) * 100;

    return Math.round(
        Math.max(
            0,
            Math.min(
                100,
                rest
            )
        )
    );

}


function getTodaySleep() {

    return getStoredTodaySleep(
        state.store
    );

}


function initializeRestForToday() {

    const sleep =
        getTodaySleep();

    if (sleep === null) {

        state.rest = 0;

        return;

    }

    const savedRest =
        getStoredTodayRest(
            state.store
        );

    // --------------------------------------------------------
    // REST ALREADY EXISTS
    // --------------------------------------------------------

    if (savedRest !== null) {

        state.rest =
            savedRest;

        return;

    }

    // --------------------------------------------------------
    // FIRST INITIALIZATION OF THE DAY
    // --------------------------------------------------------

    state.rest =
        calculateRestFromSleep(
            sleep
        );

    setStoredTodayRest(
        state.store,
        state.rest
    );

    saveData(
        state.store
    );

}


function saveRest() {

    setStoredTodayRest(
        state.store,
        state.rest
    );

    saveData(
        state.store
    );

}


function consumeRest() {

    const mode =
        MODES[state.mode];

    // Box sessions do not consume rest.

    if (
        mode?.type === "break"
    ) {
        return;
    }

    state.rest =
        Math.max(
            0,
            state.rest - 1
        );

    saveRest();

    updateRestDisplay();

}


function recoverRest(amount) {

    state.rest =
        Math.min(
            100,
            state.rest + amount
        );

    saveRest();

    updateRestDisplay();

}


function getRestStatus(rest) {

    if (rest >= 80) {
        return "ÓTIMA";
    }

    if (rest >= 60) {
        return "BOA";
    }

    if (rest >= 40) {
        return "REDUZIDA";
    }

    if (rest >= 20) {
        return "CRÍTICA";
    }

    return "PAUSA NECESSÁRIA";

}


function updateRestDisplay() {
    const condition = document.querySelector(".driver-condition");
    condition?.classList.toggle("warning", state.rest >= 20 && state.rest < 60);
    condition?.classList.toggle("danger", state.rest < 20);

    const value =
        document.getElementById(
            "restValue"
        );

    const bar =
        document.getElementById(
            "restBar"
        );

    const status =
        document.getElementById(
            "restStatus"
        );

    const sleepValue =
        document.getElementById(
            "sleepDisplay"
        );

    if (value) {

        value.textContent =
            `${Math.round(state.rest)}%`;

    }

    if (bar) {

        bar.style.width =
            `${Math.max(
                0,
                Math.min(
                    100,
                    state.rest
                )
            )}%`;

    }

    if (status) {

        status.textContent =
            getRestStatus(
                state.rest
            );

    }

    if (sleepValue) {

        const sleep =
            getTodaySleep();

        sleepValue.textContent =
            sleep === null
                ? "--"
                : `${sleep.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}H`;

    }

}


// ============================================================
// DISPLAY
// ============================================================

function updateDisplay() {
    let queue = document.getElementById("pendingQueueNotice");
    if (!queue) {
        queue = document.createElement("p"); queue.id = "pendingQueueNotice";
        const button = document.createElement("button"); button.type = "button";
        button.addEventListener("click", () => {
            if (state.running && MODES[state.mode]?.type !== "break") return;
            if (state.dataBusy || state.unsavedLap || state.pendingLap || state.pendingBlock) return;
            state.pendingBlock = state.savedPendingBlocks?.[0] || null;
            state.pendingLap = state.pendingBlock ? null : state.savedPending?.[0] || null;
            if (state.pendingBlock || state.pendingLap) openPendingRating();
            updateDisplay();
        });
        queue.append(button);
        document.querySelector(".wrap")?.prepend(queue);
    }
    const count = (state.savedPendingBlocks?.length || 0) + (state.savedPending?.length || 0);
    queue.hidden = !count || Boolean(state.pendingLap || state.pendingBlock);
    queue.firstElementChild.textContent = `Avaliar ${count} ${count === 1 ? "stint salvo" : "registros salvos"}${state.running && MODES[state.mode]?.type !== "break" ? " · pause a sessão para avaliar" : ""}`;
    queue.firstElementChild.disabled = Boolean((state.running && MODES[state.mode]?.type !== "break") || state.dataBusy || state.unsavedLap);

    checkDateRollover();

    const timer =
        document.getElementById(
            "timerDisplay"
        );

    const timerSub =
        document.getElementById(
            "timerSub"
        );

    // --------------------------------------------------------
    // TIMER
    // --------------------------------------------------------

    if (timer) {

        timer.textContent =
            fmtTime(
                state.secondsLeft
            );

    }

    // --------------------------------------------------------
    // SESSION STATUS
    // --------------------------------------------------------

    const sessionText =
        state.running
            ? "EM PISTA"
            : "SESSÃO PARADA";

    const startButton = document.getElementById("startBtn");
    if (startButton) startButton.textContent = state.pendingLap ? "[ CONFIRMAR ]" : state.running ? "[ PAUSAR ]" : "[ INICIAR ]";
    const modeHelp = document.getElementById("modeHelp");
    if (modeHelp) {
        const mode = MODES[state.mode];
        modeHelp.textContent = mode.type === "break" ? `${mode.minutes} minutos de descanso. Recupera energia e não conta como estudo.`
            : mode.type === "practice" ? "25 minutos de estudo · um stint · avaliação no pit stop."
            : `${state.sessionLapLimit || 0} ${mode.type === "qualy" ? "etapas" : "voltas"} de 5 minutos · avaliação no pit stop. ${mode.type === "race" && !state.currentRaceId ? "Selecione um circuito." : ""}`;
    }

    if (timerSub) {

        // ----------------------------------------------------
        // RACE
        // ----------------------------------------------------

        if (state.mode === "race") {

            const total =
                getCurrentRaceLaps();

            timerSub.innerHTML =
                `${sessionText} · VOLTA ${state.currentLap}/${total}`;

        }

        // ----------------------------------------------------
        // QUALIFYING
        // ----------------------------------------------------

        else if (
            state.mode === "qualy"
        ) {

            timerSub.innerHTML =
                `${sessionText} · CLASSIFICAÇÃO ${state.currentLap}/${state.sessionLapLimit || MODES.qualy.laps}`;

        }

        // ----------------------------------------------------
        // PRACTICE / BREAK
        // ----------------------------------------------------

        else {

            timerSub.innerHTML =
                `${sessionText} · VOLTA ${state.currentLap}`;

        }

    }

    // --------------------------------------------------------
    // TRACK PROGRESS
    // --------------------------------------------------------

    if (state.currentRaceId) {

        const elapsedFraction =
            state.totalSeconds > 0
                ? 1 -
                    (
                        state.secondsLeft /
                        state.totalSeconds
                    )
                : 0;

        updateTrackProgress(
            elapsedFraction
        );

    }

    // --------------------------------------------------------
    // REST
    // --------------------------------------------------------

    updateRestDisplay();

}


// ============================================================
// ENGINEER
// ============================================================

function setEngineer(message) {

    const element =
        document.getElementById(
            "engineerMsg"
        );

    if (element) {

        element.textContent =
            message;

    }

}


// ============================================================
// REGISTER COMPLETED LAP
// ============================================================
//
// ESTA É A ÚNICA FUNÇÃO RESPONSÁVEL POR REGISTRAR UMA VOLTA.
//
// Uma volta concluída gera:
//
// 1. total histórico
// 2. total diário
// 3. total do circuito
// 4. contador da sessão
//
// Não abre rating aqui.
// O sessionManager decide quando a avaliação deve aparecer.
//

async function registerCompletedLap() {
    if (state.dataBusy) return false;
    checkDateRollover();
    const subject = state.sessionSubject || getSelectedSubject();
    const lap = state.unsavedLap || {
        id: crypto.randomUUID(), circuitId: state.currentRaceId,
        subject: subject.id, subjectName: subject.name,
        duration: Number(state.totalSeconds), dateKey: todayKey(),
        mode: state.mode, lap: state.currentLap
    };
    state.unsavedLap = lap;
    setDataBusy(true);
    try {
        await completeLap(lap);
        state.unsavedLap = null;
        state.completedLaps++;
        if (state.currentBlock) {
            state.currentBlock.completedLaps = [...new Set([...(state.currentBlock.completedLaps || []), lap.id])];
            state.currentBlock.effectiveStudySeconds = Number(state.currentBlock.effectiveStudySeconds || 0);
            await updateStudyBlock(state.currentBlock);
        }
        document.getElementById("persistenceNotice")?.remove();
        try { await refreshPersistedData(); }
        catch (error) { showPersistenceError(new Error(`A volta foi salva, mas a atualização do painel falhou: ${error.message}`)); }
        return true;
    } catch (error) {
        showPersistenceError(error);
        setEngineer("Volta ainda não salva. Libere espaço e pressione INICIAR para tentar novamente. Não feche esta aba.");
        return false;
    } finally { setDataBusy(false); }
}


// ============================================================
// RATING
// ============================================================

async function ensureStudyBlock() {
    if (state.currentBlock) {
        if (!activeSegment) await beginStudySegment();
        return state.currentBlock;
    }
    const subject = state.sessionSubject || getSelectedSubject();
    const now = new Date().toISOString();
    const block = {
        id: crypto.randomUUID(), sessionId: crypto.randomUUID(), subject: subject.id,
        subjectName: subject.name, circuitId: state.currentRaceId || "free-practice",
        mode: state.mode, startedAt: now, completedLaps: [], effectiveStudySeconds: 0,
        status: "OPEN", createdAt: now, updatedAt: now
    };
    await createStudyBlock(block);
    state.currentBlock = block;
    await beginStudySegment();
    return block;
}

async function beginStudySegment() {
    if (!state.currentBlock || activeSegment) return activeSegment;
    const now = new Date().toISOString();
    activeSegment = { id: crypto.randomUUID(), ownerId: TAB_ID, blockId: state.currentBlock.id, sessionId: state.currentBlock.sessionId, subjectId: state.currentBlock.subject, startedAt: now, effectiveSeconds: 0, status: "ACTIVE", createdAt: now, updatedAt: now };
    await startStudySegment(activeSegment);
    return activeSegment;
}

async function endStudySegment() {
    if (!activeSegment) return;
    const segment = activeSegment;
    const endedAt = new Date().toISOString();
    const effectiveSeconds = Math.max(0, (Date.parse(endedAt) - Date.parse(segment.startedAt)) / 1000);
    await finishStudySegment(segment.id, { endedAt, effectiveSeconds });
    activeSegment = null;
}

async function closeCurrentStudyBlock({ reason = "pit-stop" } = {}) {
    const block = state.currentBlock;
    if (!block) return null;
    const mode = MODES[state.mode];
    await endStudySegment();
    if (mode?.type !== "break" && state.secondsLeft > 0 && state.secondsLeft < state.totalSeconds) {
        const partial = Math.max(0, state.totalSeconds - state.secondsLeft);
        const already = Number(block.partialStudySeconds || 0);
        block.partialStudySeconds = Math.max(already, partial);
        block.effectiveStudySeconds += Math.max(0, block.partialStudySeconds - already);
    }
    block.endedAt = new Date().toISOString();
    block.closeReason = reason;
    await closeStudyBlock(block, { createEvaluation: true });
    const persistedBlock = (await readSnapshot()).store.studyBlocks?.find(item => item.id === block.id) || block;
    block.effectiveStudySeconds = persistedBlock.effectiveStudySeconds;
    try {
        await enqueueCalendarBlock(block.id, { reason: "block-closed" });
        if (calendarSettings?.autoSync && calendarAdapter.connected) await syncCalendarQueue(calendarAdapter, { calendarId: calendarSettings.calendarId });
    } catch (error) { showPersistenceError(new Error(`O stint foi salvo, mas entrou na fila do calendário com aviso: ${error.message}`)); }
    state.currentBlock = null;
    if (block.effectiveStudySeconds >= 1) {
        state.pendingBlock = block;
        await refreshPersistedData();
        openPendingRating();
        return block;
    }
    await refreshPersistedData();
    return null;
}

async function enterPitStop() {
    pauseTimer();
    await closeCurrentStudyBlock({ reason: "pit-stop" });
    setEngineer(state.pendingBlock ? "Pit stop iniciado. Avalie o stint quando quiser; o descanso já pode começar." : "Pit stop iniciado. Sem tempo efetivo suficiente para avaliação.");
}

function openPendingRating() {

    const focus =
        document.getElementById(
            "focusRange"
        );

    const completion =
        document.getElementById(
            "completionRange"
        );

    const errors =
        document.getElementById(
            "errorsRange"
        );

    if (focus) {
        focus.value = 7;
    }

    if (completion) {
        completion.value = 80;
    }

    if (errors) {
        errors.value = 10;
    }

    const focusValue =
        document.getElementById(
            "focusVal"
        );

    const completionValue =
        document.getElementById(
            "completionVal"
        );

    const errorsValue =
        document.getElementById(
            "errorsVal"
        );

    if (focusValue) {
        focusValue.textContent = "7";
    }

    if (completionValue) {
        completionValue.textContent = "80%";
    }

    if (errorsValue) {
        errorsValue.textContent = "10%";
    }

    const panel =
        document.getElementById(
            "ratingPanel"
        );

    if (panel) {
        let context = document.getElementById("pendingLapContext");
        if (!context) { context = document.createElement("p"); context.id = "pendingLapContext"; panel.prepend(context); }
        const block = state.pendingBlock;
        const lap = state.pendingLap;
        if (block) {
            const race = RACES.find(race => race.id === block.circuitId);
            const minutes = Math.round(Number(block.effectiveStudySeconds || 0) / 60);
            context.textContent = `AVALIAÇÃO DO STINT · ${block.subjectName || block.subject} · ${minutes} min efetivos · ${(block.completedLaps || []).length} voltas · ${race?.gp || block.circuitId}. Você pode confirmar durante o descanso.`;
        } else if (lap) context.textContent = `${lap.subjectName || lap.subject} · ${RACES.find(race => race.id === lap.circuitId)?.gp || lap.circuitId} · ${MODES[lap.mode]?.sessionName || lap.mode} · volta ${lap.lap} · ${lap.dateKey}. Avaliação antiga pendente.`;

        panel.hidden = false;
        panel.style.removeProperty("display");

    }

}


async function submitPendingRating({ resume = true } = {}) {

    if (state.dataBusy) return false;
    if (!state.pendingLap && !state.pendingBlock) {
        return true;
    }

    const focus =
        parseInt(
            document.getElementById(
                "focusRange"
            )?.value || 0,
            10
        );

    const completion =
        parseInt(
            document.getElementById(
                "completionRange"
            )?.value || 0,
            10
        );

    const errors =
        parseInt(
            document.getElementById(
                "errorsRange"
            )?.value || 0,
            10
        );

    setDataBusy(true);
    try {
        if (state.pendingBlock) await evaluateStudyBlock(state.pendingBlock.id, { focus, completion, errors });
        else await evaluateLap(state.pendingLap.id, { focus, completion, errors });
    } catch (error) {
        showPersistenceError(error);
        return false;
    } finally { setDataBusy(false); }
    if (state.pendingBlock) {
        try {
            await enqueueCalendarBlock(state.pendingBlock.id, { reason: "evaluation-updated" });
            if (calendarSettings?.autoSync && calendarAdapter.connected) await syncCalendarQueue(calendarAdapter, { calendarId: calendarSettings.calendarId });
        } catch (error) { setCalendarStatus(`Avaliação salva; calendário pendente: ${error.message}`); }
    }
    state.pendingLap = null;
    state.pendingBlock = null;
    document.getElementById("persistenceNotice")?.remove();
    try { await refreshPersistedData(); }
    catch (error) { showPersistenceError(new Error(`A avaliação foi salva, mas a atualização do painel falhou: ${error.message}`)); }

    // --------------------------------------------------------
    // CLOSE PANEL
    // --------------------------------------------------------

    const panel =
        document.getElementById(
            "ratingPanel"
        );

    if (panel) {

        panel.hidden = true;
        panel.style.removeProperty("display");

    }

    // --------------------------------------------------------
    // REFRESH
    // --------------------------------------------------------

    renderCarStatus();
    renderTelemetry();
    renderFocusChart();
    updateDisplay();
    const continueSession = state.awaitingNextLap;
    state.awaitingNextLap = false;
    if (resume && continueSession) await startTimer();
    else if (resume) {
        try { await refreshPersistedData({ recover: true }); } catch (error) { showPersistenceError(error); }
    }
    return true;

}


// ============================================================
// CAR STATUS
// ============================================================

function consistencyScore() {

    const days = [];

    for (
        let i = 6;
        i >= 0;
        i--
    ) {

        const date =
            new Date();

        date.setDate(
            date.getDate() - i
        );

        const key =
            makeDateKey(
                date
            );

        const raw =
            state.store.byDate?.[key];

        // ----------------------------------------------------
        // SUPPORT OLD + NEW FORMAT
        // ----------------------------------------------------

        const laps =
            typeof raw === "object"
                ? Number(
                    raw?.laps || 0
                )
                : Number(
                    raw || 0
                );

        days.push(
            laps
        );

    }

    const mean =
        avg(days);

    if (mean === 0) {
        return 50;
    }

    const variance =
        avg(
            days.map(
                value =>
                    (value - mean) ** 2
            )
        );

    const stdev =
        Math.sqrt(
            variance
        );

    return Math.max(
        0,
        Math.min(
            100,
            Math.round(
                100 -
                (stdev / mean) * 60
            )
        )
    );

}


function mostRecentSleepHours() {

    const entries =
        Object.entries(
            state.store.sleepByDate || {}
        );

    if (!entries.length) {
        return null;
    }

    entries.sort(
        (a, b) =>
            new Date(a[0]) -
            new Date(b[0])
    );

    return Number(
        entries[
            entries.length - 1
        ][1]
    );

}


function powerUnitFromSleep() {

    const hours =
        mostRecentSleepHours();

    if (hours === null) {
        return 50;
    }

    return Math.max(
        0,
        Math.min(
            100,
            Math.round(
                (hours / 8) * 100
            )
        )
    );

}


function carStats() {

    const totalLaps =
        Number(
            state.store.laps || 0
        );

    const sessions =
        state.store.sessions || [];

    // --------------------------------------------------------
    // CHASSIS
    // --------------------------------------------------------

    const chassis =
        Math.min(
            100,
            Math.round(
                totalLaps * 1.5
            )
        );

    // --------------------------------------------------------
    // AERO
    // --------------------------------------------------------

    const aero = sessions.length
        ? Math.round(avg(sessions.map(session => session.completion)))
        : 0;

    // --------------------------------------------------------
    // POWER UNIT
    // --------------------------------------------------------

    const powerUnit =
        powerUnitFromSleep();

    // --------------------------------------------------------
    // TYRES
    // --------------------------------------------------------

    const tyres =
        consistencyScore();

    // --------------------------------------------------------
    // DRIVER
    // --------------------------------------------------------

    const last10 =
        sessions.slice(-10);

    const driver =
        last10.length
            ? Math.round(
                avg(
                    last10.map(
                        session =>
                            (
                                session.focus * 10 +
                                session.completion
                            ) / 2
                    )
                )
            )
            : 50;

    return {

        chassis,

        aero,

        powerUnit,

        tyres,

        driver

    };

}


function renderCarStatus() {

    const car =
        carStats();

    const attributes = [

        {
            name: "CHASSI",
            sub: "base de conhecimento",
            value: car.chassis
        },

        {
            name: "AERODINÂMICA",
            sub: "conclusão das tarefas",
            value: car.aero
        },

        {
            name: "MOTOR",
            sub: "horas de sono",
            value: car.powerUnit
        },

        {
            name: "PNEUS",
            sub: "consistência",
            value: car.tyres
        },

        {
            name: "PILOTO",
            sub: "desempenho",
            value: car.driver
        }

    ];

    const container =
        document.getElementById(
            "carStatusBody"
        );

    if (!container) {
        return;
    }

    container.innerHTML =
        attributes
            .map(
                attribute => `

                    <div class="car-attr">

                        <div class="car-attr-row">

                            <span class="attr-name">

                                ${attribute.name}

                                <small>
                                    ${attribute.sub}
                                </small>

                            </span>

                            <span class="attr-val">
                                ${attribute.value}%
                            </span>

                        </div>

                        <div class="bar-track">

                            <div
                                class="bar-fill"
                                style="width:${attribute.value}%"
                            ></div>

                        </div>

                    </div>

                `
            )
            .join("");

}


// ============================================================
// TELEMETRY
// ============================================================

function renderTelemetry() {

    const sessions =
        state.store.sessions || [];

    const last10 =
        sessions.slice(-10);

    // --------------------------------------------------------
    // FOCUS
    // --------------------------------------------------------

    const focusPct =
        last10.length
            ? Math.round(
                avg(
                    last10.map(
                        session =>
                            session.focus
                    )
                ) * 10
            )
            : 0;

    // --------------------------------------------------------
    // COMPLETION
    // --------------------------------------------------------

    const completionPct =
        last10.length
            ? Math.round(
                avg(
                    last10.map(
                        session =>
                            session.completion
                    )
                )
            )
            : 0;

    // --------------------------------------------------------
    // ERRORS
    // --------------------------------------------------------

    const errorPct =
        last10.length
            ? Math.round(
                avg(
                    last10.map(
                        session =>
                            session.errors
                    )
                )
            )
            : 0;

    // --------------------------------------------------------
    // PACE
    // --------------------------------------------------------

    const dateKey =
        todayKey();

    const todaySessions =
        sessions.filter(
            session =>
                session.dateKey === dateKey
        );

    let paceStr = "--";

    if (
        todaySessions.length &&
        sessions.length
    ) {

        const todayAvg =
            avg(
                todaySessions.map(
                    session =>
                        session.focus
                )
            ) * 10;

        const allAvg =
            avg(
                sessions.map(
                    session =>
                        session.focus
                )
            ) * 10;

        const diff =
            (todayAvg - allAvg) / 10;

        paceStr =
            (diff >= 0 ? "+" : "") +
            diff.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    }

    // --------------------------------------------------------
    // CONSISTENCY
    // --------------------------------------------------------

    const consistency =
        consistencyScore();

    // --------------------------------------------------------
    // LAST SESSION
    // --------------------------------------------------------

    const lastSession =
        sessions[
            sessions.length - 1
        ];

    const sessionTime =
        lastSession
            ? fmtHM(
                lastSession.duration
            )
            : "--";

    // --------------------------------------------------------
    // CELLS
    // --------------------------------------------------------

    const cells = [

        {
            label: "ÚLTIMA SESSÃO",
            value: sessionTime,
            cls: ""
        },

        {
            label: "FOCO MÉDIO",
            value: `${focusPct}%`,
            cls:
                focusPct >= 70
                    ? "teal"
                    : focusPct >= 40
                        ? "amber"
                        : "red"
        },

        {
            label: "CONCLUSÃO DE TAREFAS",
            value: `${completionPct}%`,
            cls:
                completionPct >= 70
                    ? "teal"
                    : "amber"
        },

        {
            label: "TAXA DE ERRO",
            value: `${errorPct}%`,
            cls:
                errorPct <= 15
                    ? "teal"
                    : errorPct <= 30
                        ? "amber"
                        : "red"
        },

        {
            label: "RITMO",
            value: paceStr,
            cls: "teal"
        },

        {
            label: "CONSISTÊNCIA",
            value: `${consistency}%`,
            cls: "teal"
        }

    ];

    const container =
        document.getElementById(
            "telemetryGrid"
        );

    if (!container) {
        return;
    }

    container.innerHTML =
        cells
            .map(
                cell => `

                    <div class="telemetry-cell">

                        <div class="tlabel">
                            ${cell.label}
                        </div>

                        <div class="tval ${cell.cls}">
                            ${cell.value}
                        </div>

                    </div>

                `
            )
            .join("");

    const count =
        document.getElementById(
            "telemetrySessionCount"
        );

    if (count) {

        count.textContent =
            `${sessions.length} voltas registradas`;

    }

}


// ============================================================
// FOCUS CHART
// ============================================================

function renderFocusChart() {

    const svg =
        document.getElementById(
            "focusChart"
        );

    if (!svg) {
        return;
    }

    const sessions =
        state.store.sessions || [];

    const dayLabels = [

        "DOM",
        "SEG",
        "TER",
        "QUA",
        "QUI",
        "SEX",
        "SÁB"

    ];

    const points = [];

    // --------------------------------------------------------
    // LAST 7 DAYS
    // --------------------------------------------------------

    for (
        let i = 6;
        i >= 0;
        i--
    ) {

        const date =
            new Date();

        date.setDate(
            date.getDate() - i
        );

        const key =
            makeDateKey(
                date
            );

        const daySessions =
            sessions.filter(
                session =>
                    session.dateKey === key
            );

        const value =
            daySessions.length
                ? Math.round(
                    avg(
                        daySessions.map(
                            session =>
                                session.focus
                        )
                    ) * 10
                )
                : 0;

        points.push({

            label:
                dayLabels[
                    date.getDay()
                ],

            value,

            hasData:
                daySessions.length > 0

        });

    }

    // --------------------------------------------------------
    // CHART DIMENSIONS
    // --------------------------------------------------------

    const width = 280;
    const height = 140;

    const marginLeft = 14;
    const marginRight = 10;
    const marginTop = 14;
    const marginBottom = 20;

    const plotWidth =
        width -
        marginLeft -
        marginRight;

    const plotHeight =
        height -
        marginTop -
        marginBottom;

    const stepX =
        plotWidth /
        (points.length - 1);

    // --------------------------------------------------------
    // COORDINATES
    // --------------------------------------------------------

    const coordinates =
        points.map(
            (point, index) => {

                const x =
                    marginLeft +
                    index * stepX;

                const y =
                    marginTop +
                    plotHeight -
                    (point.value / 100) *
                    plotHeight;

                return {

                    x,
                    y,
                    ...point

                };

            }
        );

    // --------------------------------------------------------
    // LINE
    // --------------------------------------------------------

    const dataPoints =
        coordinates.filter(
            point =>
                point.hasData
        );

    let pathD = "";

    if (
        dataPoints.length > 1
    ) {

        pathD =
            "M " +
            dataPoints
                .map(
                    point =>
                        `${point.x.toFixed(1)} ${point.y.toFixed(1)}`
                )
                .join(" L ");

    }

    // --------------------------------------------------------
    // SVG CONTENT
    // --------------------------------------------------------

    let content = `

        <line
            class="chart-axis-line"
            x1="${marginLeft}"
            y1="${marginTop + plotHeight}"
            x2="${width - marginRight}"
            y2="${marginTop + plotHeight}"
        />

    `;

    if (pathD) {

        content += `

            <path
                class="chart-line"
                d="${pathD}"
            />

        `;

    }

    // --------------------------------------------------------
    // POINTS + LABELS
    // --------------------------------------------------------

    coordinates.forEach(
        point => {

            content += `

                <circle
                    class="chart-dot"
                    cx="${point.x.toFixed(1)}"
                    cy="${
                        point.hasData
                            ? point.y.toFixed(1)
                            : marginTop + plotHeight
                    }"
                    r="${
                        point.hasData
                            ? 3
                            : 1.5
                    }"
                    opacity="${
                        point.hasData
                            ? 1
                            : 0.35
                    }"
                />

                <text
                    class="chart-label"
                    x="${point.x.toFixed(1)}"
                    y="${height - 4}"
                    text-anchor="middle"
                >
                    ${point.label}
                </text>

            `;

        }
    );

    svg.innerHTML =
        content;

}


// ============================================================
// SUMMARY
// ============================================================

function renderSummary() {
    renderChampionship(state.store);

    checkDateRollover();

    const today =
        getTodayData();

    const totalLaps =
        Number(
            state.store.laps || 0
        );

    const totalSeconds =
        Number(
            state.store.totalSeconds || 0
        );

    const todayLaps =
        Number(
            today.laps || 0
        );

    const todaySeconds =
        Number(
            today.totalSeconds || 0
        );

    // --------------------------------------------------------
    // BEST CIRCUIT
    // --------------------------------------------------------

    let bestCircuit = null;

    let bestLaps = 0;

    Object.entries(
        state.store.byCircuit || {}
    ).forEach(
        ([id, data]) => {

            const laps =
                Number(
                    data?.laps || 0
                );

            if (
                laps > bestLaps
            ) {

                bestLaps =
                    laps;

                bestCircuit =
                    id;

            }

        }
    );

    const bestRace =
        bestCircuit
            ? RACES.find(
                race =>
                    race.id ===
                    bestCircuit
            )
            : null;

    const bestRaceName =
        bestRace
            ? (
                bestRace.flag +
                " " +
                bestRace.gp
                    .replace(
                        "GP DA ",
                        ""
                    )
                    .replace(
                        "GP DO ",
                        ""
                    )
                    .replace(
                        "GP DE ",
                        ""
                    )
                    .replace(
                        "GP DOS ",
                        ""
                    )
            )
            : "--";

    // --------------------------------------------------------
    // SUMMARY CELLS
    // --------------------------------------------------------

    const cells = [

        {
            label: "VOLTAS TOTAIS",
            value: totalLaps,
            cls: "teal"
        },

        {
            label: "TEMPO DE ESTUDO",
            value: fmtHM(totalSeconds),
            cls: ""
        },

        {
            label: "VOLTAS HOJE",
            value: todayLaps,
            cls: "amber"
        },

        {
            label: "TEMPO HOJE",
            value: fmtHM(todaySeconds),
            cls: "teal"
        },

        {
            label: "CIRCUITO FAVORITO",
            value: bestRaceName,
            cls: "teal"
        }

    ];

    // --------------------------------------------------------
    // SUMMARY BAR
    // --------------------------------------------------------

    const summary =
        document.getElementById(
            "summaryBar"
        );

    if (summary) {

        summary.innerHTML =
            cells
                .map(
                    cell => `

                        <div class="cell">

                            <div class="label">
                                ${cell.label}
                            </div>

                            <div class="value ${cell.cls}">
                                ${cell.value}
                            </div>

                        </div>

                    `
                )
                .join("");

    }

    // --------------------------------------------------------
    // TOP BAR STATS
    // --------------------------------------------------------

    const topLaps =
        document.getElementById(
            "topLapsToday"
        );

    if (topLaps) {

        topLaps.textContent =
            todayLaps;

    }

    const topTotal =
        document.getElementById(
            "topTotalTime"
        );

    if (topTotal) {

        topTotal.textContent =
            fmtHM(
                totalSeconds
            );

    }

}


// ============================================================
// EVENT LISTENERS
// ============================================================

function bindEvents() {

    initializeCalendarControls();

    // --------------------------------------------------------
    // START / PAUSE
    // --------------------------------------------------------

    document
        .getElementById("startBtn")
        ?.addEventListener(
            "click",
            async () => {

                if (state.dataBusy) return;
                if (state.unsavedLap) { await retryCompletedLap(); return; }
                if (state.pendingLap) {

                    await submitPendingRating();
                    return;

                }

                if (state.running) {

                    await pauseTimer({ technical: true });

                } else {

                    await startTimer();

                }

            }
        );


    // --------------------------------------------------------
    // RESET
    // --------------------------------------------------------

    document
        .getElementById("resetBtn")
        ?.addEventListener(
            "click",
            async () => {

                if (state.dataBusy) return;
                if (state.unsavedLap) return;
                if (state.pendingLap) {

                    if (!await submitPendingRating({ resume: false })) return;

                }

                resetTimer();

            }
        );


    // --------------------------------------------------------
    // MODES
    // --------------------------------------------------------

    document
        .querySelectorAll(
            ".modeswitch button"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    async () => {

                        if (state.dataBusy || state.unsavedLap) return;
                        setMode(
                            button.dataset.mode
                        );

                    }
                );

            }
        );


    // --------------------------------------------------------
    // RATING — FOCUS
    // --------------------------------------------------------

    document
        .getElementById("focusRange")
        ?.addEventListener(
            "input",
            event => {

                const value =
                    document.getElementById(
                        "focusVal"
                    );

                if (value) {

                    value.textContent =
                        event.target.value;

                }

            }
        );


    // --------------------------------------------------------
    // RATING — COMPLETION
    // --------------------------------------------------------

    document
        .getElementById("completionRange")
        ?.addEventListener(
            "input",
            event => {

                const value =
                    document.getElementById(
                        "completionVal"
                    );

                if (value) {

                    value.textContent =
                        `${event.target.value}%`;

                }

            }
        );


    // --------------------------------------------------------
    // RATING — ERRORS
    // --------------------------------------------------------

    document
        .getElementById("errorsRange")
        ?.addEventListener(
            "input",
            event => {

                const value =
                    document.getElementById(
                        "errorsVal"
                    );

                if (value) {

                    value.textContent =
                        `${event.target.value}%`;

                }

            }
        );


    // --------------------------------------------------------
    // RATING SUBMIT
    // --------------------------------------------------------

    document
        .getElementById("ratingSubmit")
        ?.addEventListener(
            "click",
            submitPendingRating
        );


    // --------------------------------------------------------
    // SLEEP
    // --------------------------------------------------------

    document
        .getElementById("sleepInput")
        ?.addEventListener(
            "change",
            event => {

                const hours =
                    parseFloat(
                        event.target.value
                    );

                if (
                    Number.isNaN(hours) ||
                    hours < 0 || hours > 14
                ) {

                    return;

                }

                // ------------------------------------------------
                // SAVE SLEEP
                // ------------------------------------------------

                setStoredTodaySleep(
                    state.store,
                    hours
                );

                // ------------------------------------------------
                // INITIALIZE REST ONLY ONCE
                // ------------------------------------------------

                if (
                    getStoredTodayRest(
                        state.store
                    ) === null
                ) {

                    state.rest =
                        calculateRestFromSleep(
                            hours
                        );

                    setStoredTodayRest(
                        state.store,
                        state.rest
                    );

                }

                // ------------------------------------------------
                // SAVE
                // ------------------------------------------------

                saveData(
                    state.store
                );

                // ------------------------------------------------
                // UPDATE UI
                // ------------------------------------------------

                updateRestDisplay();

                renderCarStatus();

            }
        );

}

async function updateCalendarQueueStatus() {
    const queue = await listCalendarQueue();
    const pending = queue.filter(item => item.state !== 'SYNCED').length;
    const element = document.getElementById('calendarQueueStatus');
    if (element) element.textContent = pending ? `${pending} registro(s) aguardando sincronização.` : 'Nenhum registro pendente.';
}

function setCalendarStatus(message) {
    const element = document.getElementById('calendarStatus');
    if (element) element.textContent = message;
}

async function initializeCalendarControls() {
    let calendarConnectionInFlight = false;
    try {
        calendarSettings = await getCalendarSettings();
        calendarAdapter.clientId = GOOGLE_OAUTH_CLIENT_ID || calendarSettings.clientId || '';
        const client = document.getElementById('calendarClientId');
        const auto = document.getElementById('calendarAutoSync');
        const colors = document.getElementById('calendarSubjectColors');
        if (client) client.value = calendarSettings.clientId || GOOGLE_OAUTH_CLIENT_ID || '';
        if (auto) auto.checked = Boolean(calendarSettings.autoSync);
        if (colors) colors.value = JSON.stringify(calendarSettings.subjectColors || {});
        setCalendarStatus(calendarSettings.connected ? 'Conta configurada. Reconecte nesta aba para sincronizar.' : (GOOGLE_OAUTH_CONFIG_ERROR || (GOOGLE_OAUTH_CLIENT_ID ? 'Opcional. Seus stints ficam salvos localmente mesmo sem conexão.' : 'Google Agenda opcional. O site precisa configurar um Client ID público para habilitar a conexão.')));
        await updateCalendarQueueStatus();
    } catch (error) { setCalendarStatus(`Calendário local indisponível: ${error.message}`); }

    document.querySelectorAll('[data-calendar-period]').forEach(button => button.addEventListener('click', () => {
        document.querySelectorAll('[data-calendar-period]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
        state.calendarView = button.dataset.calendarPeriod;
        renderStudyCalendar(state.store, { view: state.calendarView });
    }));

    document.getElementById('calendarConnectBtn')?.addEventListener('click', async () => {
        if (calendarConnectionInFlight) return;
        const clientId = GOOGLE_OAUTH_CLIENT_ID || document.getElementById('calendarClientId')?.value.trim() || '';
        if (!GOOGLE_OAUTH_CLIENT_ID && document.getElementById('calendarClientId')?.value && !/^\S+\.apps\.googleusercontent\.com$/.test(clientId)) {
            setCalendarStatus('Informe um Client ID Google válido, terminado em .apps.googleusercontent.com.');
            return;
        }
        calendarAdapter.clientId = clientId;
        const connectButton = document.getElementById('calendarConnectBtn');
        calendarConnectionInFlight = true;
        if (connectButton) connectButton.disabled = true;
        setCalendarStatus('Conectando ao Google Agenda…');
        try {
            await calendarAdapter.connect({ scope: GOOGLE_CALENDAR_SCOPE });
            const select = document.getElementById('calendarSelect');
            let targetCalendar = calendarSettings?.calendarId && calendarSettings.calendarId !== 'primary' ? { id: calendarSettings.calendarId, summary: 'Study Grand Prix 🏁' } : null;
            if (!targetCalendar) targetCalendar = await calendarAdapter.createStudyCalendar();
            if (select) {
                select.innerHTML = '';
                const option = document.createElement('option'); option.value = targetCalendar.id; option.textContent = targetCalendar.summary || targetCalendar.id; option.selected = true; select.append(option);
            }
            calendarSettings = { ...(calendarSettings || {}), clientId, connected: true, calendarId: targetCalendar.id };
            await saveCalendarSettings(calendarSettings);
            setCalendarStatus('Conta Google conectada.');
            await syncCalendarQueue(calendarAdapter, { calendarId: calendarSettings.calendarId });
            await updateCalendarQueueStatus();
        } catch (error) { setCalendarStatus(`Não foi possível conectar: ${error.message}`); }
        finally { calendarConnectionInFlight = false; if (connectButton) connectButton.disabled = false; }
    });
    document.getElementById('calendarDisconnectBtn')?.addEventListener('click', async () => {
        try { await calendarAdapter.revokeAccess(); } catch { calendarAdapter.disconnect(); }
        calendarSettings = { ...(calendarSettings || {}), connected: false };
        await saveCalendarSettings(calendarSettings);
        setCalendarStatus('Conta Google desconectada. Os registros locais foram preservados.');
    });
    document.getElementById('calendarCreateBtn')?.addEventListener('click', async () => {
        try {
            await calendarAdapter.connect({ scope: GOOGLE_CALENDAR_SCOPE });
            const existingCalendar = Boolean(calendarSettings?.calendarId && calendarSettings.calendarId !== 'primary');
            const created = existingCalendar
                ? { id: calendarSettings.calendarId, summary: 'Study Grand Prix 🏁' }
                : await calendarAdapter.createStudyCalendar();
            calendarSettings = { ...(calendarSettings || {}), calendarId: created.id, connected: true };
            await saveCalendarSettings(calendarSettings);
            const select = document.getElementById('calendarSelect');
            if (select) { const option = document.createElement('option'); option.value = created.id; option.textContent = created.summary || 'Study Grand Prix 🏁'; option.selected = true; select.append(option); }
            setCalendarStatus(existingCalendar ? 'Agenda Study Grand Prix já configurada.' : 'Agenda Study Grand Prix criada e selecionada.');
        } catch (error) { setCalendarStatus(`Não foi possível criar a agenda: ${error.message}`); }
    });
    document.getElementById('calendarSelect')?.addEventListener('change', async event => {
        calendarSettings = { ...(calendarSettings || {}), calendarId: event.target.value };
        await saveCalendarSettings(calendarSettings);
    });
    document.getElementById('calendarAutoSync')?.addEventListener('change', async event => {
        calendarSettings = { ...(calendarSettings || {}), autoSync: event.target.checked };
        await saveCalendarSettings(calendarSettings);
    });
    document.getElementById('calendarSubjectColors')?.addEventListener('change', async event => {
        try {
            const subjectColors = JSON.parse(event.target.value || '{}');
            if (!subjectColors || Array.isArray(subjectColors) || typeof subjectColors !== 'object') throw new Error('use um objeto JSON');
            calendarSettings = { ...(calendarSettings || {}), subjectColors };
            await saveCalendarSettings(calendarSettings);
            setCalendarStatus('Cores das matérias salvas localmente.');
        } catch (error) { setCalendarStatus(`Cores inválidas: ${error.message}`); }
    });
    document.getElementById('calendarSyncBtn')?.addEventListener('click', async () => {
        try { const result = await syncCalendarQueue(calendarAdapter, { calendarId: calendarSettings?.calendarId }); setCalendarStatus(result.skipped ? 'Conecte uma conta para sincronizar.' : `${result.synced} registro(s) sincronizado(s).`); await updateCalendarQueueStatus(); }
        catch (error) { setCalendarStatus(`Sincronização pendente: ${error.message}`); }
    });
    document.getElementById('calendarHistoryBtn')?.addEventListener('click', async () => {
        try {
            const snapshot = await readSnapshot();
            for (const block of snapshot.store.studyBlocks || []) if (block.status !== 'OPEN') await enqueueCalendarBlock(block.id, { reason: 'history-import' });
            // Older evaluated laps are preserved with their original semantics.
            // They can still be imported as calendar records when a real end time exists.
            for (const session of snapshot.store.sessions || []) {
                if (session.targetType === 'STUDY_BLOCK' || !session.completedAt || !session.id) continue;
                const end = new Date(session.completedAt);
                const start = new Date(end.getTime() - Math.max(1, Number(session.duration || 0)) * 1000);
                const id = `legacy-calendar:${session.id}`;
                await createStudyBlock({ id, sessionId: id, subject: session.subject, subjectName: session.subjectName || session.subject, circuitId: session.circuitId || 'legacy', mode: session.mode || 'practice', startedAt: start.toISOString(), endedAt: end.toISOString(), completedLaps: [], effectiveStudySeconds: Math.max(1, Number(session.duration || 0)), status: 'COMPLETED' });
                await enqueueCalendarBlock(id, { reason: 'history-import' });
            }
            await updateCalendarQueueStatus();
            setCalendarStatus('Histórico local enfileirado.');
        } catch (error) { setCalendarStatus(`Não foi possível enfileirar o histórico: ${error.message}`); }
    });
}


// ============================================================
// INITIALIZATION
// ============================================================

async function initializeApp() {
    try {
        await migrateLegacy(state.store);
        await recoverActiveSegments(new Date().toISOString(), TAB_ID);
        state.store = (await readSnapshot()).store;
    } catch (error) {
        showPersistenceError(error);
        return;
    }

    console.log(
        "SILVER ARROW // INICIALIZAÇÃO"
    );

    // ========================================================
    // NORMALIZE STORAGE
    // ========================================================

    console.log(
        "DADOS // normalizando"
    );

    normalizeDailyStore();

    ensureTodayData();

    saveData(
        state.store
    );

    // ========================================================
    // TEAM
    // ========================================================

    console.log(
        "EQUIPE // inicializando"
    );

    initializeTeam();

    initializeTeamSelection();
    initializeSubjects(state.store.sessions);
    // Also close a week when the app remains open without a running timer.
    setInterval(() => { checkDateRollover(); renderChampionship(state.store); }, 60000);


    // ========================================================
    // SESSION MANAGER
    // ========================================================

    console.log(
        "SESSÃO // inicializando"
    );

    initializeSessionManager({

        getState:
            () => state,

        getCurrentRaceLaps,

        updateDisplay,

        updateTrackProgress,

        setEngineer,

        pick,

        registerCompletedLap,

        openPendingRating,
        submitPendingRating,

        renderSummary,

        renderCircuitList,

        recoverRest,

        consumeRest,

        ensureStudyBlock,
        beginStudySegment,
        endStudySegment,
        closeStudyBlock: closeCurrentStudyBlock,
        enterPitStop

    });


    // ========================================================
    // TRACK RENDERING
    // ========================================================

    console.log(
        "PISTA // inicializando"
    );

    initializeTrackRendering({

        submitPendingRating,

        getState:
            () => state,

        saveData:
            () =>
                saveData(
                    state.store
                ),

        configureSession

    });


    // ========================================================
    // REST
    // ========================================================

    initializeRestForToday();


    // ========================================================
    // EVENTS
    // ========================================================

    bindEvents();


    // ========================================================
    // INITIAL RENDER
    // ========================================================

    renderCircuitList();

    renderSummary();

    renderCarStatus();

    renderTelemetry();

    renderFocusChart();


    // ========================================================
    // RESTORE TODAY'S SLEEP
    // ========================================================

    const todaySleep =
        getTodaySleep();

    if (todaySleep !== null) {

        const sleepInput =
            document.getElementById(
                "sleepInput"
            );

        if (sleepInput) {

            sleepInput.value =
                todaySleep;

        }

    }


    // ========================================================
    // RESTORE LAST CIRCUIT
    // ========================================================

    const lastCircuit =
        state.store.lastCircuit;

    if (
        lastCircuit &&
        RACES.some(
            race =>
                race.id ===
                lastCircuit
        )
    ) {

        await selectCircuit(
            lastCircuit
        );

    } else {

        renderTrack();

    }


    // ========================================================
    // INITIAL DISPLAY
    // ========================================================

    updateRestDisplay();

    updateDisplay();
    await refreshPersistedData({ recover: true });
    subscribeChanges(reconcileExternalChanges);
    document.documentElement.dataset.appReady = "true";


    // ========================================================
    // BOOT COMPLETE
    // ========================================================

    console.log(
        "SILVER ARROW // SISTEMA PRONTO"
    );

}


// ============================================================
// BOOT
// ============================================================

if (
    document.readyState === "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        () => initializeApp().catch(showPersistenceError),
        {
            once: true
        }
    );

} else {

    initializeApp().catch(showPersistenceError);

}
