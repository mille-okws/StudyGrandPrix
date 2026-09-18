// ============================================================
// TEAM SELECTION
// ============================================================

import {
    getTeams,
    getCurrentTeam,
    setCurrentTeam,
    hasSelectedTeam
} from "./teamManager.js";


// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Inicializa o sistema de seleção de equipes.
 *
 * @param {object} options
 * @param {Function} options.onReady
 * @param {Function} options.onSelected
 */
export function initializeTeamSelection(options = {}) {

    const overlay = document.getElementById("teamSelectOverlay");
    const grid = document.getElementById("teamSelectGrid");

    if (!overlay || !grid) {
        console.warn(
            "Team Selection: elementos da interface não encontrados."
        );
        return;
    }

    // --------------------------------------------------------
    // RENDER
    // --------------------------------------------------------

    renderTeamSelection(grid, options);

    // --------------------------------------------------------
    // CURRENT TEAM
    // --------------------------------------------------------

    const currentTeam = getCurrentTeam();

    updateSelectionState(currentTeam);
    updateTeamButton(currentTeam);

    // --------------------------------------------------------
    // CHANGE TEAM BUTTON
    // --------------------------------------------------------

    const changeButton = document.getElementById("changeTeamBtn");

    if (changeButton) {
        changeButton.addEventListener(
            "click",
            openTeamSelection
        );
    }

    // --------------------------------------------------------
    // CLOSE BUTTON
    // --------------------------------------------------------

    const closeButton = document.getElementById("closeTeamSelectBtn");

    if (closeButton) {
        closeButton.addEventListener(
            "click",
            closeTeamSelection
        );
    }

    // --------------------------------------------------------
    // FIRST BOOT
    // --------------------------------------------------------

    if (!hasSelectedTeam()) {
        openTeamSelection();
    }

    // --------------------------------------------------------
    // READY CALLBACK
    // --------------------------------------------------------

    if (typeof options.onReady === "function") {
        options.onReady(currentTeam);
    }
}


// ============================================================
// RENDER
// ============================================================

/**
 * Renderiza os cards das equipes.
 *
 * @param {HTMLElement} container
 * @param {object} options
 */
function renderTeamSelection(container, options = {}) {

    const teams = getTeams();
    const currentTeam = getCurrentTeam();

    container.innerHTML = "";

    teams.forEach(team => {

        const card = document.createElement("button");

        card.type = "button";
        card.className = "team-select-card";
        card.dataset.team = team.id;

        // Cor específica da equipe
        card.style.setProperty(
            "--team-accent",
            team.accent
        );

        // ----------------------------------------------------
        // SELECTED STATE
        // ----------------------------------------------------

        if (team.id === currentTeam.id) {
            card.classList.add("selected");
        }

        // ----------------------------------------------------
        // CARD CONTENT
        // ----------------------------------------------------

        card.innerHTML = `
            <span class="team-select-card__status">
                ${team.id === currentTeam.id
                    ? "SELECTED"
                    : "AVAILABLE"
                }
            </span>

            <span class="team-select-card__team">
                ${team.name}
            </span>

            <span class="team-select-card__project">
                ${team.projectName}
            </span>

            <span class="team-select-card__style">
                ${team.style?.toUpperCase() || ""}
            </span>
        `;

        // ----------------------------------------------------
        // SELECT TEAM
        // ----------------------------------------------------

        card.addEventListener("click", () => {

            const selectedTeam = setCurrentTeam(team.id);

            if (!selectedTeam) {
                return;
            }

            // Atualiza interface
            updateSelectionState(selectedTeam);

            // Fecha overlay
            closeTeamSelection();

            // Callback opcional
            if (typeof options.onSelected === "function") {
                options.onSelected(selectedTeam);
            }
        });

        container.appendChild(card);
    });
}


// ============================================================
// SELECTION STATE
// ============================================================

/**
 * Atualiza visualmente os cards.
 *
 * @param {object} team
 */
function updateSelectionState(team) {

    if (!team) {
        return;
    }

    const cards = document.querySelectorAll(
        ".team-select-card"
    );

    cards.forEach(card => {

        const selected =
            card.dataset.team === team.id;

        card.classList.toggle(
            "selected",
            selected
        );

        const status = card.querySelector(
            ".team-select-card__status"
        );

        if (status) {
            status.textContent = selected
                ? "SELECTED"
                : "AVAILABLE";
        }
    });

    updateTeamButton(team);
}


// ============================================================
// TEAM BUTTON
// ============================================================

/**
 * Atualiza o botão que mostra
 * a equipe atual.
 *
 * @param {object} team
 */
function updateTeamButton(team) {

    if (!team) {
        return;
    }

    const button = document.getElementById(
        "changeTeamBtn"
    );

    if (!button) {
        return;
    }

    button.textContent =
        `TEAM // ${team.shortName}`;
}


// ============================================================
// OPEN
// ============================================================

/**
 * Abre a tela de seleção.
 */
export function openTeamSelection() {

    const overlay = document.getElementById(
        "teamSelectOverlay"
    );

    if (!overlay) {
        console.warn(
            "Team Selection: overlay não encontrado."
        );
        return;
    }

    overlay.classList.add("is-open");

    document.body.classList.add(
        "team-selection-open"
    );
}


// ============================================================
// CLOSE
// ============================================================

/**
 * Fecha a tela de seleção.
 *
 * Durante o primeiro boot, não permite
 * fechar sem uma equipe selecionada.
 */
export function closeTeamSelection() {

    const overlay = document.getElementById(
        "teamSelectOverlay"
    );

    if (!overlay) {
        return;
    }

    // Primeiro boot:
    // precisa escolher uma equipe.
    if (!hasSelectedTeam()) {
        return;
    }

    overlay.classList.remove(
        "is-open"
    );

    document.body.classList.remove(
        "team-selection-open"
    );
}


// ============================================================
// TEAM CHANGE EVENT
// ============================================================

/**
 * Atualiza a interface caso outra parte
 * do sistema altere a equipe.
 */
window.addEventListener(
    "teamChanged",
    event => {

        if (!event.detail) {
            return;
        }

        updateSelectionState(
            event.detail
        );
    }
);