const { Events, ChannelType, PermissionsBitField } = require("discord.js");
const logger = require("../utils/logger");
const { t } = require("../utils/i18n");

module.exports = {
  name: Events.GuildCreate,
  async execute(guild, client) {
    logger.event(
      `Le bot a rejoint un nouveau serveur : ${guild.name} (${guild.id}) | ${guild.memberCount} membres`,
    );

    let lang = "fr";
    // 1) Initialiser la configuration par défaut en base
    try {
      const gs = client.db.getGuild(guild.id);
      lang = (gs && gs.language) || "fr";
      logger.success(`Paramètres initialisés pour le serveur ${guild.name}`);
    } catch (error) {
      logger.error(
        `Erreur lors de l'initialisation du serveur ${guild.name}:`,
        error,
      );
    }

    const prefix = client.config.prefix || "+";
    const dashUrl = client.config.dashboard_url || "http://localhost:3000";
    const docsUrl = client.config.documentation_url || dashUrl;
    const supportUrl = client.config.support_url || dashUrl;
    const botName = client.user.username;

    // 2) Construire l'embed d'onboarding (réutilisé pour DM et salon système)
    const buildWelcomeEmbed = () =>
      client.embedBuilder
        .premium(
          client,
          t(lang, "events.guildCreate.welcome_title", {
            botName,
            guild: guild.name,
          }),
          t(lang, "events.guildCreate.welcome_description", { botName }),
          client.user.displayAvatarURL({ size: 256 }),
        )
        .addFields(
          {
            name: t(lang, "events.guildCreate.field_first_steps"),
            value: t(lang, "events.guildCreate.field_first_steps_value", {
              dashUrl,
              prefix,
            }),
            inline: false,
          },
          {
            name: t(lang, "events.guildCreate.field_prefix"),
            value: `\`${prefix}\``,
            inline: true,
          },
          {
            name: t(lang, "events.guildCreate.field_documentation"),
            value: t(lang, "events.guildCreate.field_documentation_value", {
              docsUrl,
            }),
            inline: true,
          },
          {
            name: t(lang, "events.guildCreate.field_support"),
            value: t(lang, "events.guildCreate.field_support_value", {
              supportUrl,
            }),
            inline: true,
          },
          {
            name: t(lang, "events.guildCreate.field_recommended_config"),
            value: t(lang, "events.guildCreate.field_recommended_config_value", {
              prefix,
            }),
            inline: false,
          },
        );

    // 3) DM au propriétaire du serveur
    const owner = await guild.fetchOwner().catch(() => null);
    let ownerNotified = false;
    if (owner) {
      const sent = await owner
        .send({ embeds: [buildWelcomeEmbed()] })
        .catch(() => null);
      if (sent) {
        ownerNotified = true;
      } else {
        logger.warn(
          `Impossible d'envoyer le DM de bienvenue au propriétaire de ${guild.name}`,
        );
      }
    }

    // 4) Intro dans le salon système (ou premier salon textuel accessible)
    const me = guild.members.me;
    let introChannel = null;
    if (
      guild.systemChannel &&
      guild.systemChannel
        .permissionsFor(me)
        ?.has([
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.EmbedLinks,
        ])
    ) {
      introChannel = guild.systemChannel;
    } else {
      introChannel =
        guild.channels.cache
          .filter(
            (c) =>
              c.type === ChannelType.GuildText &&
              c
                .permissionsFor(me)
                ?.has([
                  PermissionsBitField.Flags.ViewChannel,
                  PermissionsBitField.Flags.SendMessages,
                  PermissionsBitField.Flags.EmbedLinks,
                ]),
          )
          .sort((a, b) => a.position - b.position)
          .first() || null;
    }

    if (introChannel) {
      await introChannel
        .send({ embeds: [buildWelcomeEmbed()] })
        .catch(() =>
          logger.warn(
            `Impossible d'envoyer l'intro dans #${introChannel.name} (${guild.name})`,
          ),
        );
    } else {
      logger.warn(
        `Aucun salon textuel accessible pour l'intro sur ${guild.name}`,
      );
    }

    // 5) Notifier le(s) propriétaire(s) du bot par DM
    const ownerIds = (process.env.OWNER_ID || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    for (const id of ownerIds) {
      try {
        const botOwner = await client.users.fetch(id).catch(() => null);
        if (!botOwner) continue;
        const summary = client.embedBuilder.base(
          client,
          t(lang, "events.guildCreate.owner_summary_title"),
          t(lang, "events.guildCreate.owner_summary_description", {
            guild: guild.name,
            guildId: guild.id,
            members: guild.memberCount,
            owner: owner
              ? `${owner.user.tag} (\`${owner.id}\`)`
              : t(lang, "events.guildCreate.owner_unknown"),
            dmStatus: ownerNotified
              ? t(lang, "events.guildCreate.dm_sent")
              : t(lang, "events.guildCreate.dm_not_sent"),
            total: client.guilds.cache.size,
          }),
        );
        await botOwner.send({ embeds: [summary] }).catch(() => null);
      } catch (e) {
        logger.warn(`Notification owner ${id} échouée: ${e.message}`);
      }
    }
  },
};
