const replyUtils = require("../../utils/replyUtils");

const truncate = (str, max = 100) => {
  const s = String(str ?? "");
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

module.exports = {
  name: "addcmd",
  aliases: ["createcmd", "customcommand"],
  description: "Crée une commande personnalisée texte.",
  category: "custom",
  usage: "+addcmd [nom] [texte réponse]",
  async execute(client, message, args) {
    const isOwner =
      process.env.OWNER_ID &&
      process.env.OWNER_ID.split(",")
        .map((id) => id.trim())
        .includes(message.author.id);
    if (!message.member.permissions.has("Administrator") && !isOwner) {
      return replyUtils.sendEphemeralReply(message, {
        embeds: [
          client.embedBuilder.error(
            client,
            message.t("commands.addcmd.permission_denied"),
          ),
        ],
      });
    }

    const cmdName = args[0]?.toLowerCase();
    const response = args.slice(1).join("");

    if (!cmdName || !response) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.addcmd.missing_args"),
            ),
          ],
        })
        .catch(() => {});
    }

    if (client.commands.has(cmdName) || client.aliases.has(cmdName)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.addcmd.reserved_name", { cmd: cmdName }),
            ),
          ],
        })
        .catch(() => {});
    }

    const exists = client.db.getCustomCommand(message.guild.id, cmdName);
    client.db.addCustomCommand(message.guild.id, cmdName, response);

    const embed = client.embedBuilder
      .success(client, exists ? message.t("commands.addcmd.updated") : message.t("commands.addcmd.created"))
      .addFields(
        {
          name: message.t("commands.addcmd.field_trigger"),
          value: `\`+${cmdName}\``,
          inline: true,
        },
        {
          name: message.t("commands.addcmd.field_response"),
          value: `\`${truncate(response, 100)}\``,
          inline: true,
        },
      );

    return message.reply({ embeds: [embed] }).catch(() => {});
  },
};
