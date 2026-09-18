// ============================================================
// SILVER ARROW
// ENGINEER MESSAGES
// ============================================================

import { getCurrentTeam } from "../js/teamManager.js";


// ============================================================
// CURRENT TEAM
// ============================================================

const team = getCurrentTeam();


// ============================================================
// ENGINEER START
// ============================================================

export const ENGINEER_START =

    team.id === "mercedes"

        ? [
            "Tudo verificado. Vamos fazer isso direito.",
            "Sistemas prontos. Foco, consistência e vamos.",
            "Tudo certo. Vamos começar."
        ]

    : team.id === "ferrari"

        ? [
            "Tudo pronto. Vamos lá, vamos fazer essa volta valer.",
            "Carro preparado. Agora é foco.",
            "Pista livre. Vamos dar tudo nessa sessão."
        ]

    : team.id === "redbull"

        ? [
            "Tudo pronto. Vamos.",
            "Pista livre.",
            "Carro está pronto. Vamos fazer o trabalho."
        ]

    : team.id === "mclaren"

        ? [
            "Tudo pronto. Vamos ver o que conseguimos tirar dessa volta.",
            "Sistemas ok. Bora fazer uma sessão boa.",
            "Pista livre. Vamos nessa."
        ]

    : team.id === "astonmartin"

        ? [
            "Tudo preparado. Vamos começar com calma e precisão.",
            "Sistemas estáveis. Temos uma boa janela.",
            "Tudo pronto. Uma volta de cada vez."
        ]

    : team.id === "alpine"

        ? [
            "Sistemas online. Tudo pronto para sair.",
            "Telemetria estável. Vamos buscar uma boa volta.",
            "Tudo preparado. Foco na execução."
        ]

    : [
        "Tudo pronto. Podemos começar."
    ];


// ============================================================
// ENGINEER TICK
// ============================================================

export const ENGINEER_TICK =

    team.id === "mercedes"

        ? [
            "Muito bom. Mantém exatamente esse ritmo.",
            "Boa consistência. Agora é continuar executando.",
            "Os dados estão bons. Não complica, só continua."
        ]

    : team.id === "ferrari"

        ? [
            "Boa volta. Continua assim.",
            "Isso. Mantém, não deixa o ritmo cair.",
            "Estamos indo bem. Continua acreditando."
        ]

    : team.id === "redbull"

        ? [
            "Está bom. Continua.",
            "Ritmo forte. Não tira o pé agora.",
            "Mantém assim."
        ]

    : team.id === "mclaren"

        ? [
            "Boa! Continua assim.",
            "Isso aí. Ritmo bom, não inventa moda agora.",
            "Está indo bem. Só mantém a consistência."
        ]

    : team.id === "astonmartin"

        ? [
            "Muito consistente. É exatamente isso que precisamos.",
            "Boa execução. Mantém o controle da sessão.",
            "Tudo dentro da janela. Continua sem pressa."
        ]

    : team.id === "alpine"

        ? [
            "Os dados estão bons. Continua nessa linha.",
            "Ritmo consistente. Podemos ganhar mais um pouco aqui.",
            "Telemetria está limpa. Mantém o foco."
        ]

    : [
        "Mantém o ritmo."
    ];


// ============================================================
// ENGINEER DONE — FOCUS
// ============================================================

export const ENGINEER_DONE_FOCUS =

    team.id === "mercedes"

        ? [
            "Muito boa volta. Trabalho limpo e consistente.",
            "Sessão concluída. Dados muito bons.",
            "Bom trabalho. Agora box e recuperação."
        ]

    : team.id === "ferrari"

        ? [
            "Que volta. Muito bom trabalho.",
            "Sessão concluída.",
            "Excelente. Agora box, respira e recupera."
        ]

    : team.id === "redbull"

        ? [
            "Boa volta. Trabalho feito.",
            "Sessão concluída.",
            "Bom stint. Box agora e prepara o próximo."
        ]

    : team.id === "mclaren"

        ? [
            "Boa!!!.",
            "Sessão concluída. Mandou bem.",
            "Isso foi bom. Agora box e dá uma respirada."
        ]

    : team.id === "astonmartin"

        ? [
            "Muito boa sessão. Consistência do início ao fim.",
            "Trabalho limpo. Exatamente como planejado.",
            "Excelente stint. Agora vamos recuperar."
        ]

    : team.id === "alpine"

        ? [
            "Volta limpa. Dados registrados.",
            "Boa sessão. A telemetria mostra uma execução consistente.",
            "Stint concluído. Podemos entrar no box."
        ]

    : [
        "Sessão concluída. Bom trabalho."
    ];


// ============================================================
// ENGINEER DONE — BREAK
// ============================================================

export const ENGINEER_DONE_BREAK =

    team.id === "mercedes"

        ? [
            "Pit stop concluído. Recupera e voltamos quando estiver pronto.",
            "Pausa feita. Quando voltar, retomamos exatamente daqui.",
            "Tudo pronto para a próxima. Sem pressa."
        ]

    : team.id === "ferrari"

        ? [
            "Pit stop feito. Recupera bem, depois voltamos.",
            "Pneus trocados. Aproveita a pausa, vamos precisar de você.",
            "Tudo pronto. Quando estiver pronto, voltamos para a pista."
        ]

    : team.id === "redbull"

        ? [
            "Pit stop feito. Recupera.",
            "Tudo pronto. Quando quiser, fazemos o próximo stint.",
            "Pausa concluída. Próxima volta quando estiver pronto."
        ]

    : team.id === "mclaren"

        ? [
            "Pit stop feito. Vai lá, recupera um pouco.",
            "Tudo pronto para a próxima. Sem pressa.",
            "Pausa feita. Quando estiver pronto, voltamos."
        ]

    : team.id === "astonmartin"

        ? [
            "Pit stop concluído. Aproveita para recuperar.",
            "Tudo preparado para o próximo stint. Volte quando estiver pronto.",
            "Pausa concluída. Mantemos o plano para a próxima sessão."
        ]

    : team.id === "alpine"

        ? [
            "Pit stop concluído. Sistemas em espera.",
            "Telemetria estável. Aproveita a pausa.",
            "Tudo preparado para a próxima saída."
        ]

    : [
        "Pit stop concluído. Pronto para a próxima."
    ];