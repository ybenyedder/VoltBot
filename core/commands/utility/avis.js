const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");

module.exports = {
  name: "avis",
  description: "Laisse un avis sur le serveur ou le bot.",
  category: "utility",
  usage: "+avis",
  async execute(client, message, args) {
    const guildSettings = client.db.getGuild(message.guild.id);
    const avisChannelId = guildSettings.avisChannel;

    if (!avisChannelId) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.avis.no_channel"),
            ),
          ],
        })
        .catch(() => {});
    }

    const startEmbed = client.embedBuilder
      .base(client, message.t("commands.avis.embed_title"))
      .setDescription(message.t("commands.avis.embed_desc"));

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("start_avis")
        .setLabel(message.t("commands.avis.btn_start"))
        .setStyle(ButtonStyle.Primary),
    );

    const activeAvisSessions = client.activeAvisSessions || new Set();
    if (activeAvisSessions.has(message.author.id)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.avis.session_active"),
            ),
          ],
        })
        .catch(() => {});
    }

    const initialMsg = await message
      .reply({ embeds: [startEmbed], components: [row] })
      .catch(() => null);
    if (!initialMsg) return;

    activeAvisSessions.add(message.author.id);
    client.activeAvisSessions = activeAvisSessions;

    const collector = initialMsg.createMessageComponentCollector({
      filter: (i) => i.user.id === message.author.id,
      time: 60000,
      max: 1,
    });

    collector.on("end", () => {
      activeAvisSessions.delete(message.author.id);
    });

    collector.on("collect", async (interaction) => {
      await interaction
        .reply({
          content: message.t("commands.avis.step1"),
          flags: [MessageFlags.Ephemeral],
        })
        .catch(() => {});

      initialMsg.delete().catch(() => {});
      message.delete().catch(() => {});

      const filter = (m) => m.author.id === interaction.user.id;
      const starsCollector = message.channel.createMessageCollector({
        filter,
        time: 30000,
        max: 1,
      });

      starsCollector.on("collect", async (m) => {
        const starsNum = parseInt(m.content);
        m.delete().catch(() => {});

        if (isNaN(starsNum) || starsNum < 1 || starsNum > 5) {
          return interaction
            .followUp({
              content: message.t("commands.avis.invalid_rating"),
              flags: [MessageFlags.Ephemeral],
            })
            .catch(() => {});
        }

        await interaction
          .followUp({
            content: message.t("commands.avis.step2", { stars: starsNum }),
            flags: [MessageFlags.Ephemeral],
          })
          .catch(() => {});

        const commCollector = message.channel.createMessageCollector({
          filter,
          time: 60000,
          max: 1,
        });

        commCollector.on("collect", async (cm) => {
          const input = cm.content.toLowerCase();
          const reviewMessage =
            input === "na" ? message.t("commands.avis.no_comment") : cm.content;
          cm.delete().catch(() => {});

          const avisChannel = message.guild.channels.cache.get(avisChannelId);
          if (avisChannel) {
            const reviewEmbed = new EmbedBuilder()
              .setColor(client.embedBuilder.getTheme(client))
              .setAuthor({
                name: message.t("commands.avis.review_author", { tag: interaction.user.tag }),
                iconURL: interaction.user.displayAvatarURL({ size: 256 }),
              })
              .addFields(
                {
                  name: message.t("commands.avis.field_rating"),
                  value: `\`${starsNum}/5\``,
                  inline: true,
                },
                {
                  name: message.t("commands.avis.field_author"),
                  value: `<@${interaction.user.id}>`,
                  inline: true,
                },
                {
                  name: message.t("commands.avis.field_date"),
                  value: `<t:${Math.floor(Date.now() / 1000)}:f>`,
                  inline: true,
                },
                {
                  name: message.t("commands.avis.field_comment"),
                  value: reviewMessage.slice(0, 1024),
                  inline: false,
                },
              )
              .setTimestamp()
              .setFooter({ text: message.t("commands.avis.review_footer", { id: interaction.user.id }) });

            await avisChannel.send({ embeds: [reviewEmbed] }).catch(() => {});
          }

          await interaction
            .followUp({
              content: message.t("commands.avis.sent", { channel: `<#${avisChannelId}>` }),
              flags: [MessageFlags.Ephemeral],
            })
            .catch(() => {});
        });

        commCollector.on("end", (collected, reason) => {
          if (reason === "time") {
            interaction
              .followUp({
                content: message.t("commands.avis.timeout"),
                flags: [MessageFlags.Ephemeral],
              })
              .catch(() => {});
          }
          activeAvisSessions.delete(message.author.id);
        });
      });

      starsCollector.on("end", (collected, reason) => {
        if (reason === "time") {
          interaction
            .followUp({
              content: message.t("commands.avis.timeout"),
              flags: [MessageFlags.Ephemeral],
            })
            .catch(() => {});
        }
        if (!collected.size) {
          activeAvisSessions.delete(message.author.id);
        }
      });
    });
  },
};
