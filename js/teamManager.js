// ============================================================
// SILVER ARROW
// TEAM MANAGER
// ============================================================

import { TEAMS } from "../data/teams.js";


// ============================================================
// CONFIGURATION
// ============================================================

const TEAM_STORAGE_KEY = "silverArrowTeam";
const DEFAULT_TEAM_ID = "mercedes";


// ============================================================
// TEAM QUERIES
// ============================================================

/**
 * Retorna todas as equipes disponíveis.
 *
 * @returns {object[]}
 */
export function getTeams() {
    return Object.values(TEAMS);
}


/**
 * Retorna uma equipe pelo ID.
 *
 * @param {string} teamId
 * @returns {object|null}
 */
export function getTeam(teamId) {
    if (!teamId) {
        return null;
    }

    return TEAMS[teamId] || null;
}


/**
 * Verifica se uma equipe existe.
 *
 * @param {string} teamId
 * @returns {boolean}
 */
export function teamExists(teamId) {
    return Boolean(TEAMS[teamId]);
}


// ============================================================
// CURRENT TEAM
// ============================================================

/**
 * Retorna o ID da equipe salva no localStorage.
 *
 * @returns {string|null}
 */
export function getSavedTeamId() {
    const savedTeamId = localStorage.getItem(
        TEAM_STORAGE_KEY
    );

    if (
        savedTeamId &&
        teamExists(savedTeamId)
    ) {
        return savedTeamId;
    }

    return null;
}


/**
 * Verifica se o usuário já escolheu uma equipe.
 *
 * @returns {boolean}
 */
export function hasSelectedTeam() {
    return Boolean(getSavedTeamId());
}


/**
 * Retorna a equipe atualmente selecionada.
 *
 * Se não houver equipe salva,
 * retorna a equipe padrão.
 *
 * @returns {object}
 */
export function getCurrentTeam() {
    const savedTeamId = getSavedTeamId();

    if (savedTeamId) {
        return TEAMS[savedTeamId];
    }

    return TEAMS[DEFAULT_TEAM_ID];
}


// ============================================================
// TEAM SELECTION
// ============================================================

/**
 * Define a equipe atual.
 *
 * @param {string} teamId
 * @returns {object|null}
 */
export function setCurrentTeam(teamId) {
    const team = getTeam(teamId);

    if (!team) {
        console.warn(
            `SILVER ARROW: equipe "${teamId}" não encontrada.`
        );

        return null;
    }

    // --------------------------------------------------------
    // Persistência
    // --------------------------------------------------------

    localStorage.setItem(
        TEAM_STORAGE_KEY,
        team.id
    );

    // --------------------------------------------------------
    // Aplicar identidade
    // --------------------------------------------------------

    applyTeamTheme(team);

    // --------------------------------------------------------
    // Notificar aplicação
    // --------------------------------------------------------

    dispatchTeamChange(team);

    return team;
}


// ============================================================
// TEAM RESET
// ============================================================

/**
 * Remove a equipe salva.
 *
 * A aplicação volta para a equipe padrão.
 *
 * @returns {object}
 */
export function resetTeam() {
    localStorage.removeItem(
        TEAM_STORAGE_KEY
    );

    const team = TEAMS[DEFAULT_TEAM_ID];

    applyTeamTheme(team);
    dispatchTeamChange(team);

    return team;
}


// ============================================================
// TEAM CSS
// ============================================================

/**
 * Carrega o CSS específico da equipe.
 *
 * Exemplo:
 *
 * mercedes → ./css/mercedes.css
 * ferrari  → ./css/ferrari.css
 * redbull  → ./css/redbull.css
 *
 * @param {object} team
 */
function loadTeamStylesheet(team) {
    if (!team) {
        return;
    }

    const stylesheet =
        document.getElementById(
            "teamStylesheet"
        );

    if (!stylesheet) {
        console.warn(
            "SILVER ARROW: #teamStylesheet não encontrado."
        );

        return;
    }

    stylesheet.href =
        `./css/${team.id}.css`;
}


// ============================================================
// THEME / IDENTITY
// ============================================================

/**
 * Aplica a identidade visual da equipe.
 *
 * O CSS principal da equipe é carregado aqui.
 *
 * @param {object} team
 */
export function applyTeamTheme(team) {
    if (!team) {
        return;
    }

    const root =
        document.documentElement;

    // --------------------------------------------------------
    // Team ID
    // --------------------------------------------------------

    root.dataset.team =
        team.id;

    // --------------------------------------------------------
    // CSS da equipe
    // --------------------------------------------------------

    loadTeamStylesheet(team);

    // --------------------------------------------------------
    // Página
    // --------------------------------------------------------

    updateDocumentTitle(team);

    // --------------------------------------------------------
    // Branding
    // --------------------------------------------------------

    updateBrand(team);
}


// ============================================================
// DOCUMENT TITLE
// ============================================================

/**
 * Atualiza o título da página.
 *
 * @param {object} team
 */
function updateDocumentTitle(team) {
    document.title =
        `${team.projectName} — ${team.subtitle}`;
}


// ============================================================
// BRAND
// ============================================================

/**
 * Atualiza a identidade textual da interface.
 *
 * @param {object} team
 */
function updateBrand(team) {
    const title =
        document.querySelector(
            ".brand-text .t1"
        );

    const subtitle =
        document.querySelector(
            ".brand-text .t2"
        );

    const teamName =
        document.querySelector(
            ".brand-team"
        );

    const logo =
        document.querySelector(
            ".brand-logo"
        );

    // --------------------------------------------------------
    // Nome do projeto
    // --------------------------------------------------------

    if (title) {
        title.textContent =
            team.projectName;
    }

    // --------------------------------------------------------
    // Subtítulo
    // --------------------------------------------------------

    if (subtitle) {
        subtitle.textContent =
            team.subtitle;
    }

    // --------------------------------------------------------
    // Nome da equipe
    // --------------------------------------------------------

    if (teamName) {
        teamName.textContent =
            team.name;
    }

    // --------------------------------------------------------
    // Logo
    // --------------------------------------------------------

    if (
        logo &&
        team.assets?.logo
    ) {
        logo.src =
            team.assets.logo;

        logo.alt =
            team.name;
    }
}


// ============================================================
// TERMINOLOGY
// ============================================================

/**
 * Retorna a terminologia da equipe atual.
 *
 * @returns {object}
 */
export function getTerminology() {
    const team =
        getCurrentTeam();

    return team.terminology || {};
}


/**
 * Retorna um termo específico.
 *
 * Exemplo:
 *
 * getTerm("lap")
 * → "LAP"
 *
 * @param {string} key
 * @returns {string}
 */
export function getTerm(key) {
    const terminology =
        getTerminology();

    return terminology[key] || key;
}


// ============================================================
// ASSETS
// ============================================================

/**
 * Retorna os assets da equipe atual.
 *
 * @returns {object}
 */
export function getTeamAssets() {
    const team =
        getCurrentTeam();

    return team.assets || {};
}


// ============================================================
// TEAM STYLE
// ============================================================

/**
 * Retorna o estilo visual/comportamental
 * da equipe atual.
 *
 * @returns {string|null}
 */
export function getTeamStyle() {
    const team =
        getCurrentTeam();

    return team.style || null;
}


// ============================================================
// EVENT SYSTEM
// ============================================================

/**
 * Dispara um evento global quando
 * a equipe muda.
 *
 * @param {object} team
 */
function dispatchTeamChange(team) {
    window.dispatchEvent(
        new CustomEvent(
            "teamChanged",
            {
                detail: team
            }
        )
    );
}


// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Inicializa o sistema de equipes.
 *
 * Deve ser chamado uma vez pelo index.js.
 *
 * @returns {object}
 */
export function initializeTeam() {
    const team =
        getCurrentTeam();

    applyTeamTheme(team);

    return team;
}