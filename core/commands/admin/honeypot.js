const { PermissionsBitField, ChannelType, EmbedBuilder } = require("discord.js");

module.exports = {
  name: "honeypot",
  aliases: ["hp"],
  description: "Creates a honeypot channel. Anyone who sends a message gets their last 5 messages deleted.",
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
        embeds: [client.embedBuilder.info(client, `**Honeypot:** ${cur}\n\`+honeypot create\` — create\n\`+honeypot set #channel\` — use existing\n\`+honeypot off\` — disable`)]
      }).catch(() => {});
    }

    if (sub === "off") {
      client.db.db.prepare("UPDATE guilds SET honeypotChannel = NULL, honeypotCount = 0, honeypotMessageId = NULL WHERE guildId = ?").run(message.guild.id);
      client.guildSettingsCache.delete(message.guild.id);
      return message.reply({ embeds: [client.embedBuilder.success(client, "Honeypot disabled.")] }).catch(() => {});
    }

    if (sub === "set") {
      const ch = message.mentions.channels.first();
      if (!ch || ch.type !== ChannelType.GuildText) {
        return message.reply({ embeds: [client.embedBuilder.error(client, "Mention a valid text channel.")] }).catch(() => {});
      }
      client.db.db.prepare("UPDATE guilds SET honeypotChannel = ?, honeypotCount = 0, honeypotMessageId = NULL WHERE guildId = ?").run(ch.id, message.guild.id);
      client.guildSettingsCache.delete(message.guild.id);
      // Poster l'embed dans le salon
      await postHoneypotEmbed(client, ch, message.guild.id, 0);
      return message.reply({ embeds: [client.embedBuilder.success(client, `Honeypot set to ${ch}.`)] }).catch(() => {});
    }

    if (sub === "create") {
      const loading = await message.reply({ embeds: [client.embedBuilder.info(client, "Creating honeypot channel...")] }).catch(() => null);
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

        const embed = new EmbedBuilder()
          .setColor("#57F287")
          .setTitle("Honeypot created")
          .addFields(
            { name: "Channel", value: `${hpChannel}`, inline: true },
            { name: "Action", value: "Delete last 5 messages across all channels", inline: true },
          );
        if (loading) return loading.edit({ embeds: [embed] }).catch(() => {});
      } catch(e) {
        if (loading) return loading.edit({ embeds: [client.embedBuilder.error(client, `Error: ${e.message}`)] }).catch(() => {});
      }
    }
  }
};

async function postHoneypotEmbed(client, channel, guildId, count) {
  const embed = new EmbedBuilder()
    .setColor("#2B2D31")
    .setTitle("NE PAS ENVOYER DE MESSAGES DANS CE SALON")
    .setDescription(`Ce salon est utilisé pour détecter les bots de spam. Tout message envoyé ici entraînera la suppression de vos **5 derniers messages**.`)
    .setThumbnail("https://em-content.zobj.net/source/microsoft/319/honey-pot_1fad8.png")
    .addFields({ name: "🍯 Détections", value: `${count}`, inline: true });

  const sent = await channel.send({ embeds: [embed] }).catch(() => null);
  if (sent) {
    client.db.db.prepare("UPDATE guilds SET honeypotMessageId = ? WHERE guildId = ?").run(sent.id, guildId);
    client.guildSettingsCache.delete(guildId);
  }
  return sent;
}

module.exports.postHoneypotEmbed = postHoneypotEmbed;
