// ============================================================
// MODES
// ============================================================

export const MODES = {

  practice: {
    label: "TREINO LIVRE 25",
    type: "practice",
    minutes: 25,
    sessionName: "TREINO LIVRE"
  },

  qualy: {
    label: "CLASSIFICAÇÃO",
    type: "qualy",
    minutesPerLap: 5,
    laps: 3,
    sessionName: "CLASSIFICAÇÃO"
  },

  race: {
    label: "CORRIDA",
    type: "race",
    minutesPerLap: 5,
    sessionName: "CORRIDA"
  },

  short: {
    label: "PAUSA CURTA 5",
    type: "break",
    minutes: 5,
    sessionName: "PAUSA CURTA"
  },

  long: {
    label: "PAUSA LONGA 15",
    type: "break",
    minutes: 15,
    sessionName: "PAUSA LONGA"
  }

};

