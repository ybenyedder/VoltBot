const { PermissionsBitField, ChannelType } = require("discord.js");

module.exports = {
  name: "honeypot",
  aliases: ["hp"],
  description: "Creates a honeypot channel. Anyone who sends a message there gets their last 5 messages deleted across all channels.",
  category: "admin",
  usage: "+honeypot [create | set #channel | off]",
  userPerms: [PermissionsBitField.Flags.Administrator],
  botPerms: [PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.ManageMessages],
  async execute(client, message, args) {
    const sub = (args[0] || "create").toLowerCase();
    const gs = client.db.getGuild(message.guild.id) || {};

    // --- STATUS ---
    if (!args[0]) {
      const cur = gs.honeypotChannel ? `<#${gs.honeypotChannel}>` : "None";
      return message.reply({
        embeds: [
          client.embedBuilder.info(client, `**Honeypot channel:** ${cur}\n\n\`+honeypot create\` — create a new honeypot channel\n\`+honeypot set #channel\` — use an existing channel\n\`+honeypot off\` — disable honeypot`)
        ]
      }).catch(() => {});
    }

    // --- OFF ---
    if (sub === "off") {
      client.db.db.prepare("UPDATE guilds SET honeypotChannel = NULL WHERE guildId = ?").run(message.guild.id);
      client.guildSettingsCache.delete(message.guild.id);
      return message.reply({
        embeds: [client.embedBuilder.success(client, "Honeypot disabled.")]
      }).catch(() => {});
    }

    // --- SET ---
    if (sub === "set") {
      const ch = message.mentions.channels.first();
      if (!ch || ch.type !== ChannelType.GuildText) {
        return message.reply({
          embeds: [client.embedBuilder.error(client, "Mention a valid text channel.")]
        }).catch(() => {});
      }
      client.db.db.prepare("UPDATE guilds SET honeypotChannel = ? WHERE guildId = ?").run(ch.id, message.guild.id);
      client.guildSettingsCache.delete(message.guild.id);
      return message.reply({
        embeds: [client.embedBuilder.success(client, `Honeypot set to ${ch}.`)]
      }).catch(() => {});
    }

    // --- CREATE ---
    if (sub === "create") {
      const loading = await message.reply({
        embeds: [client.embedBuilder.info(client, "Creating honeypot channel...")]
      }).catch(() => null);

      try {
        // Créer la catégorie si besoin
        let category = message.guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes("honeypot"));
        
        const hpChannel = await message.guild.channels.create({
          name: "free-nitro",
          type: ChannelType.GuildText,
          parent: category?.id || null,
          topic: "Free Nitro | Click the link below to claim your free Discord Nitro!",
          permissionOverwrites: [
            // Tout le monde peut voir et écrire (le piège)
            { id: message.guild.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
            // Le bot peut tout faire
            { id: client.user.id, allow: [PermissionsBitField.Flags.ManageMessages, PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
          ]
        });

        // Envoyer un faux message d'appât
        await hpChannel.send({
          embeds: [
            client.embedBuilder.info(client, "** FREE DISCORD NITRO **\n\nClick the link below to claim your free Discord Nitro!\nhttps://discord.com/billing/premium\n\n*This offer expires in 24h. Claim now!*")
              .setColor("#5865F2")
              .setTitle("🎁 Free Discord Nitro")
          ]
        }).catch(() => {});

        client.db.db.prepare("UPDATE guilds SET honeypotChannel = ? WHERE guildId = ?").run(hpChannel.id, message.guild.id);
        client.guildSettingsCache.delete(message.guild.id);

        const embed = client.embedBuilder.success(client, null)
          .setTitle("Honeypot created")
          .addFields(
            { name: "Channel", value: `${hpChannel}`, inline: true },
            { name: "Action", value: "Delete last 5 messages across all channels", inline: true },
            { name: "How it works", value: "Any member who sends a message in this channel will have their last 5 messages deleted from all channels silently.", inline: false }
          );

        if (loading) return loading.edit({ embeds: [embed] }).catch(() => {});
      } catch(e) {
        if (loading) return loading.edit({ embeds: [client.embedBuilder.error(client, `Error: ${e.message}`)] }).catch(() => {});
      }
    }
  }
};
