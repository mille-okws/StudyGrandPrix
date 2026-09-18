// ============================================================
// SILVER ARROW
// SESSION MANAGER
// ============================================================

import { MODES } from "../data/modes.js";

import {
    ENGINEER_START,
    ENGINEER_TICK,
    ENGINEER_DONE_FOCUS
} from "../data/engineerStatus.js";


// ============================================================
// MODULE CONTEXT
// ============================================================

let context = null;


/*
 * O Session Manager não conhece o DOM diretamente.
 *
 * O index.js fornece:
 *
 * getState()
 * getCurrentRaceLaps()
 * updateDisplay()
 * updateTrackProgress()
 * setEngineer()
 * pick()
 * registerCompletedLap()
 * openPendingRating()
 * renderSummary()
 * renderCircuitList()
 * recoverRest()
 * consumeRest()
 */

export function initializeSessionManager(options = {}) {

    context = {

        getState:
            options.getState,

        getCurrentRaceLaps:
            options.getCurrentRaceLaps,

        updateDisplay:
            options.updateDisplay,

        updateTrackProgress:
            options.updateTrackProgress,

        setEngineer:
            options.setEngineer,

        pick:
            options.pick,

        registerCompletedLap:
            options.registerCompletedLap,

        openPendingRating:
            options.openPendingRating,

        renderSummary:
            options.renderSummary,

        renderCircuitList:
            options.renderCircuitList,

        recoverRest:
            options.recoverRest,

        consumeRest:
            options.consumeRest

    };

}


// ============================================================
// CONTEXT HELPERS
// ============================================================

function getState() {

    if (!context?.getState) {

        throw new Error(
            "SessionManager: context not initialized."
        );

    }

    return context.getState();

}


function getCurrentRaceLaps() {

    if (!context?.getCurrentRaceLaps) {

        return 0;

    }

    const laps =
        Number(
            context.getCurrentRaceLaps()
        );

    return Number.isFinite(laps)
        ? Math.max(0, Math.floor(laps))
        : 0;

}


function updateDisplay() {

    context?.updateDisplay?.();

}


function updateTrackProgress(fraction) {

    context?.updateTrackProgress?.(
        Math.max(
            0,
            Math.min(
                1,
                fraction
            )
        )
    );

}


function setEngineer(message) {

    context?.setEngineer?.(
        message
    );

}


function pick(array) {

    return context?.pick
        ? context.pick(array)
        : "";

}


function registerCompletedLap() {

    context?.registerCompletedLap?.();

}


function openPendingRating() {

    context?.openPendingRating?.();

}


function renderSummary() {

    context?.renderSummary?.();

}


function renderCircuitList() {

    context?.renderCircuitList?.();

}


function recoverRest(amount) {

    context?.recoverRest?.(
        amount
    );

}


function consumeRest() {

    context?.consumeRest?.();

}


// ============================================================
// SESSION CONFIGURATION
// ============================================================

export function configureSession(modeKey) {

    const state =
        getState();

    const mode =
        MODES[modeKey];


    if (!mode) {

        console.warn(
            `SessionManager: mode "${modeKey}" not found.`
        );

        return false;

    }


    state.mode =
        modeKey;

    state.currentLap =
        1;

    state.completedLaps =
        0;

    state.pendingLap =
        null;


    // --------------------------------------------------------
    // PRACTICE
    // --------------------------------------------------------

    if (
        mode.type === "practice"
    ) {

        state.sessionLapLimit =
            null;

        state.totalSeconds =
            mode.minutes * 60;

        state.secondsLeft =
            state.totalSeconds;

    }


    // --------------------------------------------------------
    // QUALIFYING
    //
    // Qualy = metade da Race
    // --------------------------------------------------------

    else if (
        mode.type === "qualy"
    ) {

        const raceLaps =
            getCurrentRaceLaps();


        const qualyLaps =
            Math.max(
                1,
                Math.floor(
                    raceLaps / 2
                )
            );


        state.sessionLapLimit =
            qualyLaps;

        state.totalSeconds =
            mode.minutesPerLap * 60;

        state.secondsLeft =
            state.totalSeconds;

    }


    // --------------------------------------------------------
    // RACE
    // --------------------------------------------------------

    else if (
        mode.type === "race"
    ) {

        const raceLaps =
            getCurrentRaceLaps();


        state.sessionLapLimit =
            raceLaps;

        state.totalSeconds =
            mode.minutesPerLap * 60;

        state.secondsLeft =
            state.totalSeconds;

    }


    // --------------------------------------------------------
    // BREAK
    // --------------------------------------------------------

    else if (
        mode.type === "break"
    ) {

        state.sessionLapLimit =
            null;

        state.totalSeconds =
            mode.minutes * 60;

        state.secondsLeft =
            state.totalSeconds;

    }


    return true;

}


// ============================================================
// MODE
// ============================================================

export function setMode(modeKey) {

    pauseTimer();


    const configured =
        configureSession(
            modeKey
        );


    if (!configured) {

        return;

    }


    const mode =
        MODES[modeKey];


    // --------------------------------------------------------
    // MODE BUTTONS
    // --------------------------------------------------------

    document
        .querySelectorAll(
            ".modeswitch button"
        )
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.mode === modeKey
            );

        });


    // --------------------------------------------------------
    // SESSION LABELS
    // --------------------------------------------------------

    const sessionType =
        document.getElementById(
            "sessionTypeLabel"
        );


    const topSession =
        document.getElementById(
            "topSession"
        );


    if (sessionType) {

        sessionType.textContent =
            mode.sessionName;

    }


    if (topSession) {

        topSession.textContent =
            mode.sessionName;

    }


    updateDisplay();

    updateTrackProgress(
        0
    );


    setEngineer(
        `Sessão trocada para ${mode.sessionName}. Aperte PUSH quando estiver pronto.`
    );

}


// ============================================================
// START / RESUME TIMER
// ============================================================

export function startTimer() {

    const state =
        getState();


    // --------------------------------------------------------
    // ALREADY RUNNING
    // --------------------------------------------------------

    if (
        state.running
    ) {

        return;

    }


    const mode =
        MODES[state.mode];


    if (!mode) {

        console.warn(
            "SessionManager: current mode not found."
        );

        return;

    }


    // --------------------------------------------------------
    // CIRCUIT CHECK
    // --------------------------------------------------------

    if (
        !state.currentRaceId &&
        mode.type !== "break"
    ) {

        setEngineer(
            "Selecione um circuito na lista antes de sair para a pista."
        );

        return;

    }


    // --------------------------------------------------------
    // RACE LAP CHECK
    // --------------------------------------------------------

    if (
        (
            mode.type === "race" ||
            mode.type === "qualy"
        ) &&
        (
            !state.sessionLapLimit ||
            state.sessionLapLimit <= 0
        )
    ) {

        setEngineer(
            "Número de voltas inválido. Selecione um circuito novamente."
        );

        return;

    }


    // --------------------------------------------------------
    // REST CHECK
    // --------------------------------------------------------

    if (
        mode.type !== "break" &&
        state.rest <= 0
    ) {

        setEngineer(
            "REST DEPLETED. BOX REQUIRED. Registre seu sono e recupere energia."
        );

        return;

    }


    // --------------------------------------------------------
    // START / RESUME
    // --------------------------------------------------------

    state.running =
        true;


    const startButton =
        document.getElementById(
            "startBtn"
        );


    if (startButton) {

        startButton.textContent =
            "[ PAUSAR ]";

    }


    // --------------------------------------------------------
    // ENGINEER MESSAGE
    // --------------------------------------------------------

    if (
        state.completedLaps > 0 ||
        state.currentLap > 1
    ) {

        setEngineer(
            mode.type === "qualy"
                ? `RESUMING Q${state.currentLap}. PUSH.`
                : `RESUMING LAP ${state.currentLap}. PUSH.`
        );

    }

    else {

        setEngineer(
            pick(
                ENGINEER_START
            )
        );

    }


    // --------------------------------------------------------
    // TIMER
    // --------------------------------------------------------
    //
    // Segurança contra múltiplos intervals.
    //

    clearInterval(
        state.timerId
    );


    state.timerId =
        setInterval(
            tick,
            1000
        );


    updateDisplay();

}


// ============================================================
// TIMER TICK
// ============================================================

function tick() {

    const state =
        getState();


    // --------------------------------------------------------
    // SAFETY
    // --------------------------------------------------------

    if (
        !state.running
    ) {

        return;

    }


    // --------------------------------------------------------
    // COUNTDOWN
    // --------------------------------------------------------

    state.secondsLeft =
        Math.max(
            0,
            state.secondsLeft - 1
        );


    const mode =
        MODES[state.mode];


    if (!mode) {

        pauseTimer();

        return;

    }


    // --------------------------------------------------------
    // REST CONSUMPTION
    // --------------------------------------------------------

    if (
        mode.type !== "break" &&
        state.secondsLeft > 0 &&
        state.secondsLeft % 60 === 0
    ) {

        consumeRest();

    }


    // --------------------------------------------------------
    // CRITICAL REST
    // --------------------------------------------------------

    if (
        mode.type !== "break" &&
        state.rest <= 20 &&
        state.rest > 0 &&
        state.secondsLeft > 0 &&
        state.secondsLeft % 60 === 0
    ) {

        setEngineer(
            "ENGINEER: REST LEVEL CRITICAL. BOX RECOMMENDED."
        );

    }


    // --------------------------------------------------------
    // LAP / SESSION END
    // --------------------------------------------------------

    if (
        state.secondsLeft <= 0
    ) {

        finishLap();

        return;

    }


    // --------------------------------------------------------
    // RANDOM ENGINEER
    // --------------------------------------------------------

    if (
        state.secondsLeft % 47 === 0
    ) {

        setEngineer(
            pick(
                ENGINEER_TICK
            )
        );

    }


    updateDisplay();

}


// ============================================================
// PAUSE
// ============================================================
//
// IMPORTANTE:
//
// Pause NÃO altera:
//
// currentLap
// completedLaps
// secondsLeft
// sessionLapLimit
//
// Portanto, voltar ao PUSH continua exatamente de onde parou.
//

export function pauseTimer() {

    const state =
        getState();


    state.running =
        false;


    clearInterval(
        state.timerId
    );


    state.timerId =
        null;


    const startButton =
        document.getElementById(
            "startBtn"
        );


    if (startButton) {

        startButton.textContent =
            "[ PUSH ]";

    }


    updateDisplay();

}


// ============================================================
// RESET
// ============================================================
//
// Diferente do PAUSE.
//
// Reset realmente abandona a sessão atual e volta para LAP 1.
//

export function resetTimer() {

    const state =
        getState();


    pauseTimer();


    configureSession(
        state.mode
    );


    updateDisplay();

    updateTrackProgress(
        0
    );


    setEngineer(
        "Sessão reiniciada no boxe."
    );

}


// ============================================================
// FINISH LAP
// ============================================================
//
// Para Race e Qualy:
//
// terminar uma volta NÃO significa terminar a sessão.
//
// A próxima volta começa automaticamente usando o MESMO
// setInterval.
//
// Somente a última volta chama finishSession().
//

function finishLap() {

    const state =
        getState();

    const mode =
        MODES[state.mode];


    if (!mode) {

        pauseTimer();

        return;

    }


    // --------------------------------------------------------
    // BREAK
    // --------------------------------------------------------

    if (
        mode.type === "break"
    ) {

        finishSession();

        return;

    }


    // --------------------------------------------------------
    // PRACTICE
    // --------------------------------------------------------

    if (
        mode.type === "practice"
    ) {

        finishSession();

        return;

    }


    // --------------------------------------------------------
    // QUALIFYING
    // --------------------------------------------------------

    if (
        mode.type === "qualy"
    ) {

        finishQualyLap();

        return;

    }


    // --------------------------------------------------------
    // RACE
    // --------------------------------------------------------

    if (
        mode.type === "race"
    ) {

        finishRaceLap();

        return;

    }

}


// ============================================================
// QUALIFYING LAP
// ============================================================

function finishQualyLap() {

    const state =
        getState();

    const mode =
        MODES.qualy;


    // --------------------------------------------------------
    // REGISTER LAP
    // --------------------------------------------------------

    registerCompletedLap();


    const total =
        state.sessionLapLimit;


    // --------------------------------------------------------
    // FINAL LAP
    // --------------------------------------------------------

    if (
        state.completedLaps >= total
    ) {

        finishSession();

        return;

    }


    // --------------------------------------------------------
    // NEXT LAP
    // --------------------------------------------------------

    state.currentLap++;


    state.totalSeconds =
        mode.minutesPerLap * 60;

    state.secondsLeft =
        state.totalSeconds;


    setEngineer(
        `Q${state.currentLap - 1} COMPLETE. PUSH FOR Q${state.currentLap}.`
    );


    updateTrackProgress(
        0
    );

    updateDisplay();

}


// ============================================================
// RACE LAP
// ============================================================

function finishRaceLap() {

    const state =
        getState();

    const mode =
        MODES.race;


    // --------------------------------------------------------
    // REGISTER LAP
    // --------------------------------------------------------

    registerCompletedLap();


    const total =
        state.sessionLapLimit;


    // --------------------------------------------------------
    // FINAL LAP
    // --------------------------------------------------------

    if (
        state.completedLaps >= total
    ) {

        finishSession();

        return;

    }


    // --------------------------------------------------------
    // NEXT LAP
    // --------------------------------------------------------

    state.currentLap++;


    state.totalSeconds =
        mode.minutesPerLap * 60;

    state.secondsLeft =
        state.totalSeconds;


    setEngineer(
        `LAP ${state.currentLap - 1} COMPLETE. PUSH FOR LAP ${state.currentLap}.`
    );


    updateTrackProgress(
        0
    );

    updateDisplay();

}


// ============================================================
// SESSION FINISH
// ============================================================
//
// Só chega aqui quando a sessão REALMENTE acabou.
//
// Race:
// última volta completada.
//
// Qualy:
// última volta de qualy completada.
//
// Practice:
// tempo total acabou.
//
// Break:
// pit stop acabou.
//

export function finishSession() {

    const state =
        getState();


    // --------------------------------------------------------
    // STOP TIMER
    // --------------------------------------------------------

    pauseTimer();


    state.secondsLeft =
        0;


    updateDisplay();

    updateTrackProgress(
        1
    );


    const mode =
        MODES[state.mode];


    if (!mode) {

        return;

    }


    // --------------------------------------------------------
    // BREAK
    // --------------------------------------------------------

    if (
        mode.type === "break"
    ) {

        finishBreak();

        return;

    }


    // --------------------------------------------------------
    // PRACTICE
    // --------------------------------------------------------

    if (
        mode.type === "practice"
    ) {

        finishPractice();

        return;

    }


    // --------------------------------------------------------
    // QUALIFYING
    // --------------------------------------------------------

    if (
        mode.type === "qualy"
    ) {

        setEngineer(
            "CHEQUERED FLAG. QUALIFYING COMPLETE."
        );


        openPendingRating();

        renderSummary();

        renderCircuitList();

        return;

    }


    // --------------------------------------------------------
    // RACE
    // --------------------------------------------------------

    if (
        mode.type === "race"
    ) {

        setEngineer(
            "CHEQUERED FLAG. RACE COMPLETE. P1: STUDY SESSION."
        );


        openPendingRating();

        renderSummary();

        renderCircuitList();

        return;

    }

}


// ============================================================
// PRACTICE FINISH
// ============================================================

function finishPractice() {

    registerCompletedLap();


    setEngineer(
        pick(
            ENGINEER_DONE_FOCUS
        )
    );


    openPendingRating();

    renderSummary();

    renderCircuitList();

}


// ============================================================
// BREAK / PIT STOP
// ============================================================

function finishBreak() {

    const state =
        getState();


    let recovery = 0;


    /*
     * O modo deve continuar sendo "short" ou "long"
     * se esses forem os mode keys definidos em modes.js.
     */

    if (
        state.mode === "short"
    ) {

        recovery = 10;

    }

    else if (
        state.mode === "long"
    ) {

        recovery = 25;

    }


    if (
        recovery > 0
    ) {

        recoverRest(
            recovery
        );

    }


    setEngineer(
        `BOX COMPLETE. REST RECOVERED +${recovery}%.`
    );


    renderSummary();

}