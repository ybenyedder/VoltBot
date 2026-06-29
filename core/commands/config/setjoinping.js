const { PermissionsBitField, ChannelType } = require("discord.js");
const permissions = require("../../utils/permissions");

module.exports = {
  name: "setjoinping",
  aliases: ["joinping"],
  description: "Configure le ping d'arrivée des nouveaux membres.",
  category: "config",
  usage: "+setjoinping [#salon] [ghost|permanent] | +setjoinping off",
  userPerms: [PermissionsBitField.Flags.Administrator],
  async execute(client, message, args) {
    if (!permissions.isAdmin(message)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.setjoinping.perm_denied"),
            ),
          ],
        })
        .catch(() => {});
    }

    const gs = client.db.getGuild(message.guild.id) || {};
    const oldChannelId = gs.joinPingChannel || null;
    const oldChannelDisplay = oldChannelId ? `<#${oldChannelId}>` : message.t("commands.setjoinping.none");
    const oldMode = gs.joinPingMode || "ghost";

    if (!args[0]) {
      const pingChannels = [];
      if (gs.joinPingChannel) pingChannels.push(gs.joinPingChannel);
      if (gs.joinPingChannels) {
        try {
          const list =
            typeof gs.joinPingChannels === "string"
              ? JSON.parse(gs.joinPingChannels)
              : gs.joinPingChannels;
          if (Array.isArray(list)) {
            list.forEach((id) => {
              if (!pingChannels.includes(id)) pingChannels.push(id);
            });
          }
        } catch (e) {}
      }
      const channelDisplay =
        pingChannels.length > 0
          ? pingChannels.map((id) => `<#${id}>`).join(", ")
          : message.t("commands.setjoinping.none");
      const embed = client.embedBuilder
        .info(client, message.t("commands.setjoinping.no_arg"))
        .setAuthor({
          name: message.t("commands.setjoinping.title"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription(null)
        .addFields(
          { name: message.t("commands.setjoinping.channels"), value: channelDisplay, inline: true },
          { name: message.t("commands.setjoinping.mode"), value: `\`${oldMode}\``, inline: true },
          {
            name: message.t("commands.setjoinping.usage"),
            value:
              "`+setjoinping #salon [ghost|permanent]`\n`+setjoinping off`",
            inline: false,
          },
        );
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    if (args[0].toLowerCase() === "off") {
      if (!oldChannelId) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.setjoinping.same_value"),
              ),
            ],
          })
          .catch(() => {});
      }
      client.db.updateGuild(message.guild.id, {
        joinPingChannel: null,
        joinPingChannels: "[]",
      });
      const embed = client.embedBuilder
        .success(client, null)
        .setAuthor({
          name: message.t("commands.setjoinping.title"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription("```diff\n- #" + oldChannelId + "\n+ " + message.t("commands.setjoinping.none") + "\n```");
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    const channel =
      message.mentions.channels.first() ||
      message.guild.channels.cache.get(args[0]);
    if (!channel || channel.type !== ChannelType.GuildText) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.setjoinping.invalid_channel"),
            ),
          ],
        })
        .catch(() => {});
    }

    const modeArg = (args[1] || "").toLowerCase();
    const pingMode = modeArg === "permanent" ? "permanent" : "ghost";

    if (oldChannelId === channel.id && oldMode === pingMode) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.setjoinping.same_value"),
            ),
          ],
        })
        .catch(() => {});
    }

    // Mirror scalar into the JSON array column so the dashboard (which reads
    // `joinPingChannels`) stays in sync with the bot command (which historically
    // wrote only `joinPingChannel`). The event handler unions both, so this
    // keeps every reader consistent without a schema change.
    const mergedList = [channel.id];
    if (gs.joinPingChannels) {
      try {
        const list =
          typeof gs.joinPingChannels === "string"
            ? JSON.parse(gs.joinPingChannels)
            : gs.joinPingChannels;
        if (Array.isArray(list)) {
          list.forEach((id) => {
            if (id && !mergedList.includes(id)) mergedList.push(id);
          });
        }
      } catch (e) {}
    }
    client.db.updateGuild(message.guild.id, {
      joinPingChannel: channel.id,
      joinPingChannels: JSON.stringify(mergedList),
      joinPingMode: pingMode,
    });
    const embed = client.embedBuilder
      .success(client, null)
      .setAuthor({
        name: message.t("commands.setjoinping.title"),
        iconURL: client.user.displayAvatarURL(),
      })
      .setDescription(null)
      .addFields(
        {
          name: message.t("commands.setjoinping.before"),
          value: `${oldChannelDisplay} \`${oldMode}\``,
          inline: true,
        },
        {
          name: message.t("commands.setjoinping.after"),
          value: `<#${channel.id}> \`${pingMode}\``,
          inline: true,
        },
      );
    return message.reply({ embeds: [embed] }).catch(() => {});
  },
};
