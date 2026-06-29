const { PermissionsBitField } = require("discord.js");
const logger = require("../../utils/logger");

module.exports = {
  name: "renew",
  aliases: ["nuke"],
  description:
    "Clone un salon et supprime l'ancien instanément pour l'effacer.",
  category: "moderation",
  usage: "+renew",
  userPerms: [PermissionsBitField.Flags.ManageChannels],
  botPerms: [PermissionsBitField.Flags.ManageChannels],
  async execute(client, message, args) {
    if (!message.member.permissions.has("ManageChannels")) {
      const reply = await message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.renew.permission_denied"),
            ),
          ],
        })
        .catch(() => null);
      if (reply) setTimeout(() => reply.delete().catch(() => {}), 5000);
      return;
    }

    try {
      const parent = message.channel.parentId;
      const position = message.channel.position;
      const rateLimitDate = message.channel.rateLimitPerUser;

      const newChannel = await message.channel.clone();

      if (parent)
        await newChannel.setParent(parent, { lockPermissions: false });
      await newChannel.setPosition(position);
      if (rateLimitDate) await newChannel.setRateLimitPerUser(rateLimitDate);

      // Simple clean confirmation instead of the long GIF

      logger.log(
        `Le salon ${message.channel.name} a été renew (nuked) par ${message.author.tag}.`,
        "mod",
      );
      await message.channel.delete();
    } catch (err) {
      logger.error(
        `[RENEW] Erreur lors du renew du salon ${message.channel.name}:`,
        err,
      );
      message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.renew.failed"),
            ),
          ],
        })
        .catch(() => {});
    }
  },
};
