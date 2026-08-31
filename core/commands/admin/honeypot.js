const { PermissionsBitField, ChannelType, EmbedBuilder } = require("discord.js");

const HONEY_IMG = "https://twemoji.maxcdn.com/v/latest/72x72/1fad8.png";

async function buildEmbed(count) {
  return new EmbedBuilder()
    .setColor(0x000000)           // noir = pas de barre visible sur thème sombre
    .setTitle("DO NOT SEND MESSAGES IN THIS CHANNEL")
    .setDescription(
      "This channel is used to detect spam bots. Any message sent here will result in your **last 5 messages** being deleted."
    )
    .setThumbnail(HONEY_IMG)
    .addFields({
      name: "\u200b",
      value: `🍯 Detections: **${count}**`,
      inline: true
    });
}

async function postHoneypotEmbed(client, channel, guildId, count) {
  const embed = await buildEmbed(count);
  const sent = await channel.send({ embeds: [embed] }).catch(() => null);
  if (sent) {
    client.db.db.prepare("UPDATE guilds SET honeypotMessageId = ? WHERE guildId = ?").run(sent.id, guildId);
    client.guildSettingsCache.delete(guildId);
  }
  return sent;
}

module.exports = {
  name: "honeypot",
  aliases: ["hp"],
  description: "Creates a honeypot channel.",
  category: "admin",
  usage: "+honeypot [create | set #channel | off]",
  userPerms: [PermissionsBitField.Flags.Administrator],
  botPerms: [PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.ManageMessages],
  async execute(client, message, args) {
    const sub = (args[0] || "").toLowerCase();
    const gs = client.db.getGuild(message.guild.id) || {};

    if (!sub) {
      const cur = gs.honeypotChannel ? `<#${gs.honeypotChannel}>` : "None";
      return message.reply({
        embeds: [client.embedBuilder.info(client,
          `**Honeypot:** ${cur}\n\`+honeypot create\` — create\n\`+honeypot set #channel\` — use existing\n\`+honeypot off\` — disable`
        )]
      }).catch(() => {});
    }

    if (sub === "off") {
      client.db.db.prepare("UPDATE guilds SET honeypotChannel = NULL, honeypotCount = 0, honeypotMessageId = NULL WHERE guildId = ?").run(message.guild.id);
      client.guildSettingsCache.delete(message.guild.id);
      return message.reply({ embeds: [client.embedBuilder.success(client, "Honeypot disabled.")] }).catch(() => {});
    }

    if (sub === "set") {
      const ch = message.mentions.channels.first();
      if (!ch || ch.type !== ChannelType.GuildText)
        return message.reply({ embeds: [client.embedBuilder.error(client, "Mention a valid text channel.")] }).catch(() => {});
      client.db.db.prepare("UPDATE guilds SET honeypotChannel = ?, honeypotCount = 0, honeypotMessageId = NULL WHERE guildId = ?").run(ch.id, message.guild.id);
      client.guildSettingsCache.delete(message.guild.id);
      await postHoneypotEmbed(client, ch, message.guild.id, 0);
      return message.reply({ embeds: [client.embedBuilder.success(client, `Honeypot set to ${ch}.`)] }).catch(() => {});
    }

    if (sub === "create") {
      const loading = await message.reply({ embeds: [client.embedBuilder.info(client, "Creating...")] }).catch(() => null);
      try {
        const hpChannel = await message.guild.channels.create({
          name: "honeypot",
          type: ChannelType.GuildText,
          permissionOverwrites: [
            { id: message.guild.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
            { id: client.user.id, allow: [PermissionsBitField.Flags.ManageMessages, PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
          ]
        });
        client.db.db.prepare("UPDATE guilds SET honeypotChannel = ?, honeypotCount = 0, honeypotMessageId = NULL WHERE guildId = ?").run(hpChannel.id, message.guild.id);
        client.guildSettingsCache.delete(message.guild.id);
        await postHoneypotEmbed(client, hpChannel, message.guild.id, 0);
        const ok = new EmbedBuilder().setColor("#57F287").setTitle("Honeypot created").addFields({ name: "Channel", value: `${hpChannel}`, inline: true });
        if (loading) loading.edit({ embeds: [ok] }).catch(() => {});
      } catch(e) {
        if (loading) loading.edit({ embeds: [client.embedBuilder.error(client, e.message)] }).catch(() => {});
      }
    }
  },
  buildEmbed,
  postHoneypotEmbed,
};
