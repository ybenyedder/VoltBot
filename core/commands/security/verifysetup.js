const {
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

module.exports = {
  name: "verifysetup",
  aliases: ["captchasetup"],
  description:
    "Met en place le panneau de vérification Captcha pour les nouveaux membres.",
  category: "security",
  usage: "+verifysetup [#salon] [@RoleMembre]",
  userPerms: [PermissionsBitField.Flags.Administrator],
  async execute(client, message, args) {
    const channel = message.mentions.channels.first();
    const role = message.mentions.roles.first();

    if (!channel || !role) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.verifysetup.invalid_format"),
            ),
          ],
        })
        .catch(() => {});
    }

    const me = message.guild.members.me;
    const perms = channel.permissionsFor(me);
    if (
      !me ||
      !perms?.has(PermissionsBitField.Flags.ViewChannel) ||
      !perms?.has(PermissionsBitField.Flags.SendMessages)
    ) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.verifysetup.insufficient_perms"),
            ),
          ],
        })
        .catch(() => {});
    }

    if (role.position >= (me?.roles?.highest?.position ?? 0)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.verifysetup.role_higher_than_bot")),
          ],
        })
        .catch(() => {});
    }

    try {
      client.db.db
        .prepare(
          "INSERT OR REPLACE INTO verify_config (guildId, roleId, channelId) VALUES (?, ?, ?)",
        )
        .run(message.guild.id, role.id, channel.id);
    } catch (e) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.verifysetup.config_failed"),
            ),
          ],
        })
        .catch(() => {});
    }

    const panel = client.embedBuilder.premium(
      client,
      message.t("commands.verifysetup.panel_title"),
      message.t("commands.verifysetup.panel_description"),
      message.guild.iconURL({ dynamic: true }),
    );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("verify_captcha_start")
        .setLabel(message.t("commands.verifysetup.btn_verify"))
        .setStyle(ButtonStyle.Success),
    );

    const sent = await channel
      .send({ embeds: [panel], components: [row] })
      .catch(() => null);

    if (!sent) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.verifysetup.config_failed"),
            ),
          ],
        })
        .catch(() => {});
    }

    const confirm = client.embedBuilder
      .success(client, " ")
      .setAuthor({
        name: message.t("commands.verifysetup.confirm_author"),
        iconURL: client?.user?.displayAvatarURL?.({ size: 64 }),
      })
      .setDescription(null)
      .addFields(
        { name: message.t("commands.verifysetup.field_channel"), value: `${channel}`, inline: true },
        { name: message.t("commands.verifysetup.field_role"), value: `${role}`, inline: true },
        { name: message.t("commands.verifysetup.field_moderator"), value: `${message.author}`, inline: true },
      );

    if (message.guild && message.deletable)
      await message.delete().catch(() => {});
    await message.channel
      .send({ embeds: [confirm] })
      .then((m) => setTimeout(() => m.delete().catch(() => {}), 8000))
      .catch(() => {});
  },
};
