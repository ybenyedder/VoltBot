const { PermissionsBitField } = require("discord.js");
const sanctionUtils = require("../../utils/sanctionUtils");

module.exports = {
  name: "undog",
  description: "Libère un utilisateur du suivi vocal.",
  category: "moderation",
  usage: "+undog @user",
  userPerms: [PermissionsBitField.Flags.MoveMembers],
  botPerms: [PermissionsBitField.Flags.MoveMembers],
  async execute(client, message, args) {
    const target = message.mentions.members.first();
    if (!target)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.undog.mention_user"),
            ),
          ],
        })
        .catch(() => {});

    if (!client.dogMap || !client.dogMap.has(target.id)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.undog.not_tracked", { user: target.user.username }),
            ),
          ],
        })
        .catch(() => {});
    }

    const dogState = client.dogMap.get(target.id);
    if (dogState.masterId !== message.author.id) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.undog.not_master", { user: target.user.username }),
            ),
          ],
        })
        .catch(() => {});
    }

    client.dogMap.delete(target.id);
    await client.db.removeDogState(target.id, message.guild.id);
    await sanctionUtils.sendSanctionLiftDm(
      client,
      target,
      message.guild,
      "suivi vocal",
      message.t("commands.undog.lift_reason"),
    );

    message
      .reply({
        embeds: [
          client.embedBuilder.success(
            client,
            message.t("commands.undog.freed", { user: target.user.username }),
          ),
        ],
      })
      .catch(() => {});
  },
};
