const { EmbedBuilder } = require("discord.js");
const Logger = require("./logger");

const STATUS_COLOR = {
  error: "#ED4245",
  success: "#57F287",
  warning: "#FEE75C",
  info: "#5865F2",
};

const scheduleDelete = (m, timeout) => {
  if (!m) return null;
  setTimeout(() => m.delete().catch(() => {}), timeout);
  return m;
};

/**
 * Enhanced message utilities — polymorphic dispatcher kept for backwards compatibility.
 */
module.exports = {
  sendEphemeralReply: async (
    message,
    clientOrOptions,
    textOrTimeout,
    typeOrTimeout,
    timeout = 5000,
  ) => {
    try {
      // Case 1: (message, { embeds: [...] } | { content }, timeout)
      if (
        clientOrOptions &&
        (clientOrOptions.embeds || clientOrOptions.content)
      ) {
        const actualTimeout =
          typeof textOrTimeout === "number" ? textOrTimeout : 5000;
        const m = await message.reply(clientOrOptions).catch(() => null);
        return scheduleDelete(m, actualTimeout);
      }

      // Case 2: (message, client, embed, timeout)
      if (
        textOrTimeout &&
        (textOrTimeout instanceof EmbedBuilder || textOrTimeout.data)
      ) {
        const actualTimeout =
          typeof typeOrTimeout === "number" ? typeOrTimeout : 5000;
        const m = await message
          .reply({ embeds: [textOrTimeout] })
          .catch(() => null);
        return scheduleDelete(m, actualTimeout);
      }

      // Case 3: (message, client, "text", "error|success|warning|info", timeout)
      if (typeof textOrTimeout === "string") {
        const client = clientOrOptions;
        const text = textOrTimeout;
        const type = typeOrTimeout || "info";
        const actualTimeout = timeout || 5000;

        let embed;
        if (
          client &&
          client.embedBuilder &&
          typeof client.embedBuilder[type] === "function"
        ) {
          embed = client.embedBuilder[type](client, text);
        } else {
          embed = new EmbedBuilder()
            .setDescription(`${text}`)
            .setColor(STATUS_COLOR[type] || STATUS_COLOR.info);
        }

        const m = await message.reply({ embeds: [embed] }).catch(() => null);
        return scheduleDelete(m, actualTimeout);
      }

      // Default: treat clientOrOptions as message content string or options object.
      const options =
        typeof clientOrOptions === "string"
          ? { content: `${clientOrOptions}` }
          : clientOrOptions;
      const m = await message.reply(options).catch(() => null);
      return scheduleDelete(m, 5000);
    } catch (error) {
      Logger.error(
        `[messageUtils] sendEphemeralReply failed guild=${message?.guild?.id || "DM"} user=${message?.author?.id || "?"}:`,
        error,
      );
      if (typeof textOrTimeout === "string") {
        message.channel.send(`${textOrTimeout}`).catch(() => {});
      }
      return null;
    }
  },
};
