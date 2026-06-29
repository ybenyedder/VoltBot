const { PermissionsBitField } = require("discord.js");
const replyUtils = require("../../utils/replyUtils");
const giveawayUtils = require("../../utils/giveaways");

module.exports = {
  name: "g-reroll",
  description: "Relance un giveaway terminé pour choisir de nouveaux gagnants.",
  category: "utility",
  usage: "+g-reroll [messageId]",
  userPerms: [PermissionsBitField.Flags.ManageMessages],
  async execute(client, message, args) {
    if (!message.member.permissions.has("ManageMessages"))
      return replyUtils.sendEphemeralReply(message, {
        embeds: [
          client.embedBuilder.error(client, message.t("commands.g-reroll.no_perm")),
        ],
      });

    const msgId = args[0];
    if (!msgId)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.g-reroll.provide_id"),
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
              message.t("commands.g-reroll.not_found"),
            ),
          ],
        })
        .catch(() => {});
    if (!gw.ended)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.g-reroll.not_ended"),
            ),
          ],
        })
        .catch(() => {});

    const result = await giveawayUtils.rerollGiveaway(
      client,
      msgId,
      message.guild.id,
    );
    if (!result.ok) {
      const reasonMsg = {
        no_participants: message.t("commands.g-reroll.no_participants"),
        pool_exhausted: message.t("commands.g-reroll.pool_exhausted"),
        not_ended: message.t("commands.g-reroll.not_ended"),
        not_found: message.t("commands.g-reroll.not_found"),
        message_missing: message.t("commands.g-reroll.message_missing"),
      };
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              reasonMsg[result.reason] || message.t("commands.g-reroll.cannot_reroll"),
            ),
          ],
        })
        .catch(() => {});
    }

    const winnersList = result.winners.length
      ? result.winners.map((id) => `<@${id}>`).join(", ")
      : message.t("commands.g-reroll.none");
    message
      .reply({
        embeds: [
          client.embedBuilder.success(
            client,
            message.t("commands.g-reroll.reroll_success", { winners: winnersList }),
          ),
        ],
      })
      .catch(() => {});
  },
};
