const { PermissionFlagsBits, ChannelType } = require("discord.js");

module.exports = {
  name: "rename",
  aliases: ["renamechannel", "renamesalon"],
  description: "Renomme un salon. Le salon courant par défaut.",
  category: "utility",
  usage: "+rename [#salon] <nouveau-nom>",
  userPerms: [PermissionFlagsBits.ManageChannels],
  botPerms: [PermissionFlagsBits.ManageChannels],
  async execute(client, message, args) {
    if (args.length === 0) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.rename.usage"),
            ),
          ],
        })
        .catch(() => {});
    }

    let channel = null;
    let nameStart = 0;

    const mention = message.mentions.channels.first();
    if (mention) {
      channel = mention;
      nameStart = args.findIndex((a) => a.includes(mention.id)) + 1;
      if (nameStart === 0) nameStart = 1;
    } else if (/^\d{17,20}$/.test(args[0])) {
      const byId = message.guild.channels.cache.get(args[0]);
      if (byId) {
        channel = byId;
        nameStart = 1;
      }
    }

    if (!channel) channel = message.channel;

    const newName = args.slice(nameStart).join(" ").trim();
    if (!newName) {
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.rename.name_missing"))],
        })
        .catch(() => {});
    }
    if (newName.length > 100) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.rename.name_too_long")),
          ],
        })
        .catch(() => {});
    }

    const allowed = [
      ChannelType.GuildText,
      ChannelType.GuildVoice,
      ChannelType.GuildAnnouncement,
      ChannelType.GuildStageVoice,
      ChannelType.GuildForum,
      ChannelType.GuildCategory,
      ChannelType.PublicThread,
      ChannelType.PrivateThread,
      ChannelType.AnnouncementThread,
    ];
    if (!allowed.includes(channel.type)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.rename.unsupported_type")),
          ],
        })
        .catch(() => {});
    }

    const oldName = channel.name;
    try {
      await channel.setName(
        newName,
        message.t("commands.rename.audit_renamed_by", {
          tag: message.author.tag,
        }),
      );
      const embed = client.embedBuilder
        .success(client, message.t("commands.rename.success"))
        .addFields(
          { name: message.t("commands.rename.field_channel"), value: `${channel}`, inline: true },
          { name: message.t("commands.rename.field_old"), value: `\`${oldName}\``, inline: true },
          { name: message.t("commands.rename.field_new"), value: `\`${newName}\``, inline: true },
          { name: message.t("commands.rename.field_moderator"), value: `${message.author}`, inline: true },
        );
      return message.reply({ embeds: [embed] }).catch(() => {});
    } catch (err) {
      if (err.code === 50013) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(client, message.t("commands.rename.bot_perm_missing")),
            ],
          })
          .catch(() => {});
      }
      if (err.code === 429) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.rename.rate_limit"),
              ),
            ],
          })
          .catch(() => {});
      }
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.rename.rename_failed"))],
        })
        .catch(() => {});
    }
  },
};
