import { getSelectedSubject } from "./subjects.js";
// ============================================================
// SILVER ARROW
// SESSION MANAGER
// ============================================================

import { MODES } from "../data/modes.js";

import {
    getEngineerStart,
    getEngineerTick,
    getEngineerDoneFocus
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

        submitPendingRating: options.submitPendingRating,

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


    if (state.pendingLap) context?.submitPendingRating?.({ resume: false });
    state.awaitingNextLap = false;

    // Reconfiguring a circuit or mode must stop the previous countdown.
    pauseTimer();

    state.sessionSubject = null;

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
    // Classificação: três etapas de cinco minutos.
    // --------------------------------------------------------

    else if (
        mode.type === "qualy"
    ) {

        const qualyLaps = MODES.qualy.laps;

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


    updateDisplay();

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
        `Sessão trocada para ${mode.sessionName}. Aperte INICIAR quando estiver pronto.`
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


    if (state.secondsLeft <= 0) configureSession(state.mode);

    // --------------------------------------------------------
    // START / RESUME
    // --------------------------------------------------------

    state.sessionSubject ??= getSelectedSubject();

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
                ? `Retomando a classificação ${state.currentLap}. Vamos lá.`
                : `Retomando a volta ${state.currentLap}. Vamos lá.`
        );

    }

    else {

        setEngineer(
            pick(
                getEngineerStart()
            )
        );

    }


    if (mode.type !== "break" && state.rest <= 0) {
        setEngineer("Energia esgotada. Recomendamos uma pausa; você pode continuar a sessão quando desejar.");
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


    state.lastTickAt = Date.now();

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

    // Use elapsed wall time so background-tab throttling cannot extend a lap.
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - state.lastTickAt) / 1000));
    if (!elapsedSeconds) return;
    state.lastTickAt += elapsedSeconds * 1000;
    const previousSeconds = state.secondsLeft;
    state.secondsLeft = Math.max(0, previousSeconds - elapsedSeconds);


    const mode =
        MODES[state.mode];


    if (!mode) {

        pauseTimer();

        return;

    }


    // --------------------------------------------------------
    // REST CONSUMPTION
    // --------------------------------------------------------

    const crossedMinutes = Math.max(0,
        Math.floor((previousSeconds - 1) / 60) - Math.floor(Math.max(0, state.secondsLeft - 1) / 60));
    if (mode.type !== "break") {
        for (let minute = 0; minute < crossedMinutes; minute++) consumeRest();
    }


    // --------------------------------------------------------
    // CRITICAL REST
    // --------------------------------------------------------

    if (
        mode.type !== "break" &&
        state.rest <= 20 &&
        state.rest > 0 &&
        state.secondsLeft > 0 &&
        crossedMinutes > 0
    ) {

        setEngineer(
            "Nível de energia crítico. Recomendamos uma pausa."
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
                getEngineerTick()
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
            "[ INICIAR ]";

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
        `Classificação ${state.currentLap - 1} concluída. Vamos para a classificação ${state.currentLap}.`
    );


    updateTrackProgress(
        0
    );

    state.awaitingNextLap = true;
    pauseTimer();
    openPendingRating();
    setEngineer("Volta concluída. Confirme a avaliação para iniciar a próxima volta.");

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
        `Volta ${state.currentLap - 1} concluída. Vamos para a volta ${state.currentLap}.`
    );


    updateTrackProgress(
        0
    );

    state.awaitingNextLap = true;
    pauseTimer();
    openPendingRating();
    setEngineer("Volta concluída. Confirme a avaliação para iniciar a próxima volta.");

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
            "Bandeira quadriculada. Classificação concluída."
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
            "Bandeira quadriculada. Corrida concluída. Primeiro lugar nos estudos!"
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
            getEngineerDoneFocus()
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
        `Pausa concluída. Energia recuperada: +${recovery}%.`
    );


    renderSummary();

}