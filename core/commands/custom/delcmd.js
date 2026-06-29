const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");
const replyUtils = require("../../utils/replyUtils");

module.exports = {
  name: "delcmd",
  aliases: ["removecmd"],
  description: "Supprime une commande personnalisée texte.",
  category: "custom",
  usage: "+delcmd [nom]",
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
            message.t("commands.delcmd.permission_denied"),
          ),
        ],
      });
    }

    const cmdName = args[0]?.toLowerCase();
    if (!cmdName) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.delcmd.missing_arg"),
            ),
          ],
        })
        .catch(() => {});
    }

    const existing = client.db.getCustomCommand(message.guild.id, cmdName);
    if (!existing) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.delcmd.unknown_command", { cmd: cmdName }),
            ),
          ],
        })
        .catch(() => {});
    }

    const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("delcmd_confirm")
        .setStyle(ButtonStyle.Danger)
        .setLabel(message.t("commands.delcmd.btn_delete")),
      new ButtonBuilder()
        .setCustomId("delcmd_cancel")
        .setStyle(ButtonStyle.Secondary)
        .setLabel(message.t("commands.delcmd.btn_cancel")),
    );

    const prompt = await message
      .reply({
        embeds: [
          client.embedBuilder
            .warning(client, message.t("commands.delcmd.confirm_prompt"))
            .addFields({
              name: message.t("commands.delcmd.field_command"),
              value: `\`+${cmdName}\``,
              inline: true,
            }),
        ],
        components: [confirmRow],
      })
      .catch(() => null);
    if (!prompt) return;

    const collector = prompt.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 30000,
      filter: (i) => i.user.id === message.author.id,
    });

    let resolved = false;
    collector.on("collect", async (interaction) => {
      resolved = true;
      if (interaction.customId === "delcmd_confirm") {
        const info = client.db.deleteCustomCommand(message.guild.id, cmdName);
        if (info && info.changes > 0) {
          const embed = client.embedBuilder
            .success(client, message.t("commands.delcmd.deleted"))
            .addFields(
              {
                name: message.t("commands.delcmd.field_deleted_command"),
                value: `\`+${cmdName}\``,
                inline: true,
              },
              {
                name: message.t("commands.delcmd.field_author"),
                value: `<@${message.author.id}>`,
                inline: true,
              },
            );
          await interaction
            .update({ embeds: [embed], components: [] })
            .catch(() => {});
        } else {
          await interaction
            .update({
              embeds: [
                client.embedBuilder.error(
                  client,
                  message.t("commands.delcmd.delete_failed"),
                ),
              ],
              components: [],
            })
            .catch(() => {});
        }
      } else {
        await interaction
          .update({
            embeds: [client.embedBuilder.info(client, message.t("commands.delcmd.cancelled"))],
            components: [],
          })
          .catch(() => {});
      }
      collector.stop();
    });

    collector.on("end", () => {
      if (!resolved) {
        prompt
          .edit({
            embeds: [
              client.embedBuilder.info(client, message.t("commands.delcmd.timeout")),
            ],
            components: [],
          })
          .catch(() => {});
      }
    });
  },
};
