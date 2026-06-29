module.exports = {
  // Prefix
  prefix: "+",

  // Branding & Colors
  colors: {
    theme: "#2B2D31", // Invisible Dark (Matches Discord's modern dark theme)
    success: "#57F287", // Premium Green
    error: "#ED4245", // Premium Red
    warning: "#FEE75C", // Premium Yellow
    info: "#5865F2", // Blurple
    invisible: "#2B2D31", // Fallback invisible
  },

  // Emojis (You can replace these with custom Discord bot emojis for an even more premium look)
  emojis: {
    success: "", // More elegant than standard checkmark
    error: "", // More elegant than standard X
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

  // Default Guild Settings
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
