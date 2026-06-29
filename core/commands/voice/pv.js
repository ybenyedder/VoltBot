const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

module.exports = {
  name: "pv",
  aliases: ["privatevoice", "vocal-prive"],
  description:
    "Rend votre salon vocal privé et affiche le panneau de contrôle.",
  category: "voice",
  usage: "+pv",
  async execute(client, message, args) {
    const vc = message.member.voice.channel;
    if (!vc)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.pv.join_vc_first"),
            ),
          ],
        })
        .catch(() => {});

    if (client.pvMap.has(vc.id)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder
              .warning(client, message.t("commands.pv.already_private"))
              .addFields({ name: message.t("commands.pv.field_channel"), value: `${vc}`, inline: true }),
          ],
        })
        .catch(() => {});
    }

    const owners = process.env.OWNER_ID
      ? process.env.OWNER_ID.split(",").map((id) => id.trim())
      : [];
    const pvData = {
      ownerId: message.author.id,
      guildId: message.guild.id,
      whitelist: [message.author.id, ...owners],
      blacklist: [],
      locked: true,
      attempts: {},
      name: vc.name,
      bitrate: vc.bitrate || 64000,
      userLimit: vc.userLimit || 0,
      ghost: false,
    };

    client.pvMap.set(vc.id, pvData);
    await client.db.setPrivateVoice(
      vc.id,
      pvData.guildId,
      pvData.ownerId,
      pvData,
    );

    const embed = client.embedBuilder
      .premium(
        client,
        message.t("commands.pv.panel_title"),
        message.t("commands.pv.panel_desc", { channel: vc }),
        message.member.displayAvatarURL({ size: 256 }),
      )
      .addFields(
        { name: message.t("commands.pv.field_channel"), value: `${vc}`, inline: true },
        { name: message.t("commands.pv.field_owner"), value: `${message.author}`, inline: true },
      );

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("pv_lock")
        .setLabel(message.t("commands.pv.btn_lock"))
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("pv_unlock")
        .setLabel(message.t("commands.pv.btn_unlock"))
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("pv_ghost")
        .setLabel(message.t("commands.pv.btn_hide"))
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("pv_unghost")
        .setLabel(message.t("commands.pv.btn_show"))
        .setStyle(ButtonStyle.Secondary),
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("pv_rename")
        .setLabel(message.t("commands.pv.btn_rename"))
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("pv_limit")
        .setLabel(message.t("commands.pv.btn_limit"))
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("pv_bitrate")
        .setLabel(message.t("commands.pv.btn_bitrate"))
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("pv_close")
        .setLabel(message.t("commands.pv.btn_close"))
        .setStyle(ButtonStyle.Danger),
    );

    await message
      .reply({ embeds: [embed], components: [row1, row2] })
      .catch(() => {});
  },
};
