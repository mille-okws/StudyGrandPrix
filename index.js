
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
    resetTimer
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

    timerId: null,

    currentLap: 1,

    completedLaps: 0,

    sessionLapLimit: null,

    rest: 0,

    pendingLap: null,

    currentDateKey: todayKey()

};


// ============================================================
// ENGINEERING SUBJECTS
// ============================================================

const ENG_SUBJECTS = {

    calculo: true,
    estruturas: true,
    termo: true,
    eletrica: true,
    programacao: true,
    outra: false

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
        return "OPTIMAL";
    }

    if (rest >= 60) {
        return "GOOD";
    }

    if (rest >= 40) {
        return "DEGRADED";
    }

    if (rest >= 20) {
        return "CRITICAL";
    }

    return "BOX REQUIRED";

}


function updateRestDisplay() {

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
                : `${sleep.toFixed(1)}H`;

    }

}


// ============================================================
// DISPLAY
// ============================================================

function updateDisplay() {

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

    if (timerSub) {

        // ----------------------------------------------------
        // RACE
        // ----------------------------------------------------

        if (state.mode === "race") {

            const total =
                getCurrentRaceLaps();

            timerSub.innerHTML =
                `${sessionText} · LAP ${state.currentLap}/${total}`;

        }

        // ----------------------------------------------------
        // QUALIFYING
        // ----------------------------------------------------

        else if (
            state.mode === "qualy"
        ) {

            timerSub.innerHTML =
                `${sessionText} · Q${state.currentLap}/${MODES.qualy.laps}`;

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

function registerCompletedLap() {

    checkDateRollover();

    const today =
        getTodayData();

    const duration =
        Number(
            state.totalSeconds
        ) || 0;

    // --------------------------------------------------------
    // GLOBAL TOTAL
    // --------------------------------------------------------

    state.store.laps =
        Number(
            state.store.laps
        ) + 1;

    state.store.totalSeconds =
        Number(
            state.store.totalSeconds
        ) +
        duration;

    // --------------------------------------------------------
    // TODAY
    // --------------------------------------------------------

    today.laps =
        Number(
            today.laps
        ) + 1;

    today.totalSeconds =
        Number(
            today.totalSeconds
        ) + duration;

    // --------------------------------------------------------
    // CIRCUIT
    // --------------------------------------------------------

    const circuitData =
        getCircuitData(
            state.store,
            state.currentRaceId
        );

    if (circuitData) {

        circuitData.laps =
            Number(
                circuitData.laps
            ) + 1;

    }

    // --------------------------------------------------------
    // SESSION
    // --------------------------------------------------------

    state.completedLaps++;

    // --------------------------------------------------------
    // PENDING RATING
    // --------------------------------------------------------

    const subject =
        document.getElementById(
            "subjectSelect"
        )?.value || "outra";

    state.pendingLap = {

        circuitId:
            state.currentRaceId,

        subject,

        isEng:
            Boolean(
                ENG_SUBJECTS[subject]
            ),

        duration,

        dateKey:
            todayKey(),

        mode:
            state.mode,

        lap:
            state.currentLap

    };

    // --------------------------------------------------------
    // SAVE EVERYTHING
    // --------------------------------------------------------

    saveData(
        state.store
    );

    // --------------------------------------------------------
    // REFRESH UI
    // --------------------------------------------------------

    renderSummary();
    renderCarStatus();
    renderTelemetry();

}


// ============================================================
// RATING
// ============================================================

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

        panel.style.display =
            "block";

    }

}


function submitPendingRating() {

    if (!state.pendingLap) {
        return;
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

    state.store.sessions.push({

        ...state.pendingLap,

        focus,

        completion,

        errors

    });

    // --------------------------------------------------------
    // KEEP STORAGE BOUNDED
    // --------------------------------------------------------

    if (
        state.store.sessions.length > 500
    ) {

        state.store.sessions.shift();

    }

    state.pendingLap = null;

    saveData(
        state.store
    );

    // --------------------------------------------------------
    // CLOSE PANEL
    // --------------------------------------------------------

    const panel =
        document.getElementById(
            "ratingPanel"
        );

    if (panel) {

        panel.style.display =
            "none";

    }

    // --------------------------------------------------------
    // REFRESH
    // --------------------------------------------------------

    renderCarStatus();
    renderTelemetry();
    renderFocusChart();

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

    const engineeringSessions =
        sessions.filter(
            session =>
                session.isEng
        );

    const aero =
        engineeringSessions.length
            ? Math.round(
                avg(
                    engineeringSessions.map(
                        session =>
                            session.completion
                    )
                )
            )
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
            name: "CHASSIS",
            sub: "base de conhecimento",
            value: car.chassis
        },

        {
            name: "AERO",
            sub: "matérias de engenharia",
            value: car.aero
        },

        {
            name: "POWER UNIT",
            sub: "horas de sono",
            value: car.powerUnit
        },

        {
            name: "TYRES",
            sub: "consistência",
            value: car.tyres
        },

        {
            name: "DRIVER",
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
            diff.toFixed(2);

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
            label: "PACE",
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

    // --------------------------------------------------------
    // START / PAUSE
    // --------------------------------------------------------

    document
        .getElementById("startBtn")
        ?.addEventListener(
            "click",
            () => {

                if (state.pendingLap) {

                    submitPendingRating();

                }

                if (state.running) {

                    pauseTimer();

                } else {

                    startTimer();

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
            () => {

                if (state.pendingLap) {

                    submitPendingRating();

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
                    () => {

                        if (
                            state.pendingLap
                        ) {

                            submitPendingRating();

                        }

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
                    hours < 0
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


// ============================================================
// INITIALIZATION
// ============================================================

function initializeApp() {

    console.log(
        "SILVER ARROW // BOOT"
    );

    // ========================================================
    // NORMALIZE STORAGE
    // ========================================================

    console.log(
        "STORAGE // normalizing"
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
        "TEAM // initializing"
    );

    initializeTeam();

    initializeTeamSelection();


    // ========================================================
    // SESSION MANAGER
    // ========================================================

    console.log(
        "SESSION // initializing"
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

        renderSummary,

        renderCircuitList,

        recoverRest,

        consumeRest

    });


    // ========================================================
    // TRACK RENDERING
    // ========================================================

    console.log(
        "TRACK // initializing"
    );

    initializeTrackRendering({

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

        selectCircuit(
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


    // ========================================================
    // BOOT COMPLETE
    // ========================================================

    console.log(
        "SILVER ARROW // SYSTEM READY"
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
        initializeApp,
        {
            once: true
        }
    );

} else {

    initializeApp();

}
