// ============================================================
// MODES
// ============================================================

export const MODES = {

  practice: {
    label: "FREE PRACTICE 25",
    type: "practice",
    minutes: 25,
    sessionName: "FREE PRACTICE"
  },

  qualy: {
    label: "QUALIFYING",
    type: "qualy",
    minutesPerLap: 5,
    laps: 3,
    sessionName: "QUALIFYING"
  },

  race: {
    label: "RACE",
    type: "race",
    minutesPerLap: 5,
    sessionName: "RACE"
  },

  short: {
    label: "PIT STOP 5",
    type: "break",
    minutes: 5,
    sessionName: "PIT STOP"
  },

  long: {
    label: "BOX LONGO 15",
    type: "break",
    minutes: 15,
    sessionName: "BOX LONGO"
  }

};

