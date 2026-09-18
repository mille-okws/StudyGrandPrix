import { RACES } from "../../data/races.js";
import { TRACK_PATHS } from "../../data/tracks.js";

// ============================================================
// TRACK RENDERING
// ============================================================

let pathTotalLength = 0;

// Dependências fornecidas pelo index.js
let context = null;


// ============================================================
// INITIALIZATION
// ============================================================

export function initializeTrackRendering(options = {}) {
    context = options;
}


// ============================================================
// CONTEXT HELPERS
// ============================================================

function getState() {
    if (!context || typeof context.getState !== "function") {
        throw new Error(
            "trackRendering: initializeTrackRendering() não foi chamado."
        );
    }

    return context.getState();
}


function saveData() {
    if (context && typeof context.saveData === "function") {
        context.saveData();
    }
}


function configureSession(mode) {
    if (
        context &&
        typeof context.configureSession === "function"
    ) {
        context.configureSession(mode);
    }
}


// ============================================================
// TRACK
// ============================================================

export function renderTrack() {

    const state = getState();

    const svg =
        document.getElementById("trackSvg");

    const circuitTitle =
        document.getElementById("circuitTitle");

    const circuitLocation =
        document.getElementById("circuitLocation");

    const trackRd =
        document.getElementById("trackRd");


    // --------------------------------------------------------
    // DOM protection
    // --------------------------------------------------------

    if (!svg) {
        console.warn(
            "trackRendering: #trackSvg não encontrado."
        );

        return;
    }


    // --------------------------------------------------------
    // Find current race
    // --------------------------------------------------------

    const race =
        RACES.find(
            race =>
                race.id === state.currentRaceId
        );


    // --------------------------------------------------------
    // No circuit selected
    // --------------------------------------------------------

    if (!race) {

        svg.innerHTML = "";

        if (circuitTitle) {
            circuitTitle.textContent =
                "SELECIONE UM CIRCUITO →";
        }

        if (circuitLocation) {
            circuitLocation.textContent =
                "-";
        }

        if (trackRd) {
            trackRd.textContent =
                "RD --";
        }

        pathTotalLength = 0;

        return;
    }


    // --------------------------------------------------------
    // Circuit information
    // --------------------------------------------------------

    const raceIndex =
        RACES.indexOf(race);


    if (circuitTitle) {
        circuitTitle.textContent =
            `${race.flag} ${race.gp}`;
    }


    if (circuitLocation) {
        circuitLocation.textContent =
            race.circuit;
    }


    if (trackRd) {
        trackRd.textContent =
            `RD ${String(raceIndex + 1).padStart(2, "0")}`;
    }


    // --------------------------------------------------------
    // Track path
    // --------------------------------------------------------

    const path =
        TRACK_PATHS[race.code];


    if (!path) {

        console.warn(
            `Track path not found for circuit: ${race.code}`
        );

        svg.innerHTML = "";

        pathTotalLength = 0;

        return;
    }


    // --------------------------------------------------------
    // Render SVG
    // --------------------------------------------------------

    svg.innerHTML = `
        <path
            class="track-line"
            d="${path}"
            id="baseTrack"
        />

        <path
            class="track-progress"
            d="${path}"
            id="progressTrack"
            pathLength="1"
            stroke-dasharray="1"
            stroke-dashoffset="1"
        />

        <circle
            class="track-dot"
            r="4"
            id="trackDot"
        />
    `;


    // --------------------------------------------------------
    // Calculate path length
    // --------------------------------------------------------

    const basePath =
        document.getElementById("baseTrack");


    if (!basePath) {
        console.warn(
            "trackRendering: #baseTrack não foi criado."
        );

        pathTotalLength = 0;

        return;
    }


    pathTotalLength =
        basePath.getTotalLength();


    // --------------------------------------------------------
    // Reset progress
    // --------------------------------------------------------

    updateTrackProgress(0);
}


// ============================================================
// TRACK PROGRESS
// ============================================================

export function updateTrackProgress(fraction) {

    const progress =
        Math.max(
            0,
            Math.min(
                1,
                Number(fraction) || 0
            )
        );


    const progressPath =
        document.getElementById("progressTrack");

    const basePath =
        document.getElementById("baseTrack");

    const dot =
        document.getElementById("trackDot");

    const trackPercentage =
        document.getElementById("trackPct");


    // --------------------------------------------------------
    // Protection
    // --------------------------------------------------------

    if (
        !progressPath ||
        !basePath ||
        !dot ||
        !pathTotalLength
    ) {
        return;
    }


    // --------------------------------------------------------
    // Progress line
    // --------------------------------------------------------

    progressPath.setAttribute(
        "stroke-dashoffset",
        String(1 - progress)
    );


    // --------------------------------------------------------
    // Car position
    // --------------------------------------------------------

    const point =
        basePath.getPointAtLength(
            progress * pathTotalLength
        );


    dot.setAttribute(
        "cx",
        point.x
    );


    dot.setAttribute(
        "cy",
        point.y
    );


    // --------------------------------------------------------
    // Percentage
    // --------------------------------------------------------

    if (trackPercentage) {

        trackPercentage.textContent =
            `${Math.round(progress * 100)}%`;
    }
}


// ============================================================
// CIRCUIT LIST
// ============================================================

export function renderCircuitList() {

    const state = getState();

    const list =
        document.getElementById("circuitList");


    // --------------------------------------------------------
    // DOM protection
    // --------------------------------------------------------

    if (!list) {
        console.warn(
            "trackRendering: #circuitList não encontrado."
        );

        return;
    }


    list.innerHTML = "";


    // --------------------------------------------------------
    // Render every race
    // --------------------------------------------------------

    RACES.forEach(
        (race, index) => {

            // ------------------------------------------------
            // Stored laps
            // ------------------------------------------------

            const circuitData =
                state.store?.byCircuit?.[race.id];


            const completedLaps =
                circuitData?.laps || 0;


            // ------------------------------------------------
            // Row
            // ------------------------------------------------

            const row =
                document.createElement("div");


            row.className =
                "circuit-row";


            if (
                race.id === state.currentRaceId
            ) {
                row.classList.add("active");
            }


            // ------------------------------------------------
            // Status
            // ------------------------------------------------

            let statusHTML = "";


            if (
                race.status === "cancel"
            ) {

                statusHTML = `
                    <span class="status-tag cancel">
                        CANC.
                    </span>
                `;

            } else if (
                race.status === "next"
            ) {

                statusHTML = `
                    <span class="status-tag next">
                        PRÓX.
                    </span>
                `;
            }


            // ------------------------------------------------
            // Track path
            // ------------------------------------------------

            const miniTrackPath =
                TRACK_PATHS[race.code] || "";


            // ------------------------------------------------
            // HTML
            // ------------------------------------------------

            row.innerHTML = `
                <span class="rd">
                    ${String(index + 1).padStart(2, "0")}
                </span>

                <span class="mini-track">
                    <svg viewBox="0 0 300 200">
                        <path
                            class="track-line"
                            d="${miniTrackPath}"
                        />
                    </svg>
                </span>

                <div class="rinfo">
                    <div class="rname">
                        ${race.flag} ${race.gp}
                    </div>

                    <div class="rmeta">
                        ${race.circuit} · ${race.date}
                    </div>
                </div>

                ${statusHTML}

                <div class="rlaps">
                    ${completedLaps}
                    <small>VOLTAS</small>
                </div>
            `;


            // ------------------------------------------------
            // Selection
            // ------------------------------------------------

            row.addEventListener(
                "click",
                () => {
                    selectCircuit(race.id);
                }
            );


            list.appendChild(row);
        }
    );
}


// ============================================================
// SELECT CIRCUIT
// ============================================================

export function selectCircuit(id) {

    const state = getState();


    // --------------------------------------------------------
    // Find race
    // --------------------------------------------------------

    const race =
        RACES.find(
            race =>
                race.id === id
        );


    if (!race) {

        console.warn(
            `Circuit "${id}" not found.`
        );

        return;
    }


    // --------------------------------------------------------
    // Update state
    // --------------------------------------------------------

    state.currentRaceId =
        race.id;


    state.store.lastCircuit =
        race.id;


    // --------------------------------------------------------
    // Persist
    // --------------------------------------------------------

    saveData();


    // --------------------------------------------------------
    // Update UI
    // --------------------------------------------------------

    renderTrack();

    renderCircuitList();


    // --------------------------------------------------------
    // Configure session
    // --------------------------------------------------------

    configureSession(
        state.mode
    );
}