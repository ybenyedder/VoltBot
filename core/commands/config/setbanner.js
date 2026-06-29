const { PermissionsBitField } = require("discord.js");
const permissions = require("../../utils/permissions");

module.exports = {
  name: "setbanner",
  description: "Définit la bannière du serveur.",
  category: "config",
  usage: "+setbanner [lien ou image jointe]",
  userPerms: [PermissionsBitField.Flags.ManageGuild],
  botPerms: [PermissionsBitField.Flags.ManageGuild],
  async execute(client, message, args) {
    if (
      !permissions.isAdmin(message) &&
      !message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)
    ) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.setbanner.perm_denied"),
            ),
          ],
        })
        .catch(() => {});
    }

    if (!message.guild.features.includes("BANNER")) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.setbanner.banner_unavailable"),
            ),
          ],
        })
        .catch(() => {});
    }

    const banner = message.attachments.first()?.url || args[0];

    if (!banner) {
      const hadBanner = Boolean(message.guild.bannerURL());
      const embed = client.embedBuilder
        .info(client, message.t("commands.setbanner.no_arg"))
        .setAuthor({
          name: message.t("commands.setbanner.title"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription(null)
        .addFields(
          {
            name: message.t("commands.setbanner.current"),
            value: hadBanner ? message.t("commands.setbanner.set") : message.t("commands.setbanner.none"),
            inline: true,
          },
          {
            name: message.t("commands.setbanner.usage"),
            value: message.t("commands.setbanner.usage_value"),
            inline: true,
          },
        );
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    try {
      const oldUrl = message.guild.bannerURL({ size: 1024 });
      await message.guild.setBanner(banner);
      const embed = client.embedBuilder
        .success(client, null)
        .setAuthor({
          name: message.t("commands.setbanner.title"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription(
          "```diff\n- " +
            (oldUrl ? message.t("commands.setbanner.previous") : message.t("commands.setbanner.none")) +
            "\n+ " + message.t("commands.setbanner.new") + "\n```",
        )
        .setImage(banner);
      return message.reply({ embeds: [embed] }).catch(() => {});
    } catch (error) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.setbanner.update_failed"),
            ),
          ],
        })
        .catch(() => {});
    }
  },
};
