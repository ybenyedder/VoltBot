const { PermissionsBitField } = require("discord.js");
const replyUtils = require("../../utils/replyUtils");
const giveawayUtils = require("../../utils/giveaways");

module.exports = {
  name: "g-end",
  description: "Termine un giveaway prématurément.",
  category: "utility",
  usage: "+g-end [messageId]",
  userPerms: [PermissionsBitField.Flags.ManageMessages],
  async execute(client, message, args) {
    if (!message.member.permissions.has("ManageMessages"))
      return replyUtils.sendEphemeralReply(message, {
        embeds: [
          client.embedBuilder.error(client, message.t("commands.g-end.no_perm")),
        ],
      });

    const msgId = args[0];
    if (!msgId)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.g-end.provide_id"),
            ),
          ],
        })
        .catch(() => {});

    const gw = client.db.db
      .prepare("SELECT * FROM giveaways WHERE messageId = ? AND guildId = ?")
      .get(msgId, message.guild.id);
    if (!gw)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.g-end.not_found"),
            ),
          ],
        })
        .catch(() => {});
    if (gw.ended)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.g-end.already_ended")),
          ],
        })
        .catch(() => {});

    const result = await giveawayUtils.endGiveaway(client, msgId, {
      guildId: message.guild.id,
    });
    if (!result.ok) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.g-end.cannot_end"),
            ),
          ],
        })
        .catch(() => {});
    }

    const winnersList = result.winners.length
      ? result.winners.map((id) => `<@${id}>`).join(", ")
      : message.t("commands.g-end.none");
    message
      .reply({
        embeds: [
          client.embedBuilder.success(
            client,
            message.t("commands.g-end.ended_success", { winners: winnersList }),
          ),
        ],
      })
      .catch(() => {});
  },
};
