module.exports = {
  dashboard_url: "http://localhost:3000",

  prefix: "+",

  colors: {
    theme: "#2B2D31",
    success: "#57F287",
    error: "#ED4245",
    warning: "#FEE75C",
    info: "#5865F2",
    invisible: "#2B2D31",
  },

  emojis: {
    success: "",
    error: "",
    loading: "",
    coin: "",
    level: "",
    mod: "",
    fun: "",
    util: "",
    dev: "",
    premium: "",
    arrow: "»",
    dot: "•",
  },

  defaultGuildSettings: {
    prefix: "+",
    modLogsChannel: null,
    welcomeChannel: null,
    goodbyeChannel: null,
    levelChannel: null,
    modRole: null,
    // null => les events utilisent le défaut localisé t(lang, "events.welcome_default"/"goodbye_default").
    welcomeMessage: null,
    goodbyeMessage: null,
    antiSpam: 0,
    antiLink: 0,
    antiBadWords: 0,
  },
};
