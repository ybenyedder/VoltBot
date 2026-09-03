const { PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const {
  cleanCode,
  isValidCode,
  checkAvailability,
  startSniper,
  stopSniper,
  activeSnipers,
} = require("../../utils/vanitySniper");

module.exports = {
  name: "snipeurl",
  aliases: ["vanitysniper", "snipevanity", "vanity"],
  description: "Surveille et réclame automatiquement une URL personnalisée (vanity) Discord dès qu'elle devient disponible.",
  category: "utility",
  usage: "+snipeurl <code | url> | +snipeurl stop | +snipeurl status | +snipeurl check <code | url>",
  userPerms: [PermissionFlagsBits.Administrator],
  botPerms: [PermissionFlagsBits.ManageGuild],
  async execute(client, message, args) {
    const prefix = client.config.prefix || "+";

    if (!args[0]) {
      // Sans argument -> Affiche le statut actuel ou l'aide
      const sniperData = client.db.getVanitySniper(message.guild.id);
      const isMemoryActive = activeSnipers.has(message.guild.id);

      const embed = client.embedBuilder
        .base(client, "🎯 Sniper d'URL Personnalisée (Vanity)")
        .setDescription(null)
        .addFields(
          {
            name: "Statut actuel",
            value:
              sniperData && sniperData.status === "active" && isMemoryActive
                ? `🟢 **Actif** sur \`discord.gg/${sniperData.vanityCode}\``
                : sniperData && sniperData.status === "claimed"
                  ? `🎯 **Réclamé avec succès** (\`discord.gg/${sniperData.vanityCode}\`)`
                  : "🔴 **Inactif** (aucun sniper en cours)",
            inline: false,
          },
          {
            name: "Commandes disponibles",
            value: [
              `• \`${prefix}snipeurl <url/code>\` : Lance la surveillance d'une URL`,
              `• \`${prefix}snipeurl stop\` : Arrête le sniper actif`,
              `• \`${prefix}snipeurl status\` : Affiche les détails du sniper`,
              `• \`${prefix}snipeurl check <code/url>\` : Vérifie si une URL est libre`,
              `• \`${prefix}snipeurl token <user_token>\` : Configure un user token pour l'auto-claim`,
            ].join("\n"),
            inline: false,
          },
        );

      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    const sub = args[0].toLowerCase();

    // Commande TOKEN (configuration d'un compte utilisateur pour bypass la restriction bot de Discord)
    if (sub === "token") {
      if (!args[1] || args[1] === "remove" || args[1] === "delete") {
        client.db.updateVanitySniper(message.guild.id, { userToken: null });
        return message
          .reply({
            embeds: [
              client.embedBuilder.success(
                client,
                "Le token utilisateur pour le sniper a été supprimé.",
              ),
            ],
          })
          .catch(() => {});
      }

      const inputToken = args[1].trim().replace(/^Bot\s+/i, "");
      client.db.updateVanitySniper(message.guild.id, { userToken: inputToken });
      await message.delete().catch(() => {}); // Supprime le message contenant le token pour sécurité

      return message.channel
        .send({
          embeds: [
            client.embedBuilder.success(
              client,
              "🔒 **Token utilisateur configuré !** Votre message a été supprimé par sécurité.\nLe bot pourra désormais réclamer automatiquement l'URL dès qu'elle devient disponible.",
            ),
          ],
        })
        .catch(() => {});
    }

    // 1. Commande STOP
    if (sub === "stop" || sub === "off") {
      const current = client.db.getVanitySniper(message.guild.id);
      if (!current || (current.status !== "active" && !activeSnipers.has(message.guild.id))) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                "Aucun sniper d'URL n'est actuellement actif sur ce serveur.",
              ),
            ],
          })
          .catch(() => {});
      }

      stopSniper(client, message.guild.id, true);
      return message
        .reply({
          embeds: [
            client.embedBuilder.success(
              client,
              `🛑 Le sniper d'URL pour **discord.gg/${current.vanityCode}** a été arrêté avec succès.`,
            ),
          ],
        })
        .catch(() => {});
    }

    // 2. Commande STATUS
    if (sub === "status" || sub === "info") {
      const sniperData = client.db.getVanitySniper(message.guild.id);
      const isMemoryActive = activeSnipers.has(message.guild.id);

      if (!sniperData) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.info(
                client,
                `Aucun sniper n'a été configuré. Utilisez \`${prefix}snipeurl <code/url>\` pour commencer.`,
              ),
            ],
          })
          .catch(() => {});
      }

      const checks = isMemoryActive
        ? activeSnipers.get(message.guild.id).getChecks()
        : sniperData.checksCount || 0;

      const embed = client.embedBuilder
        .base(client, "🎯 Statut du Sniper d'URL")
        .setDescription(null)
        .addFields(
          {
            name: "URL Ciblée",
            value: `[\`discord.gg/${sniperData.vanityCode}\`](https://discord.gg/${sniperData.vanityCode})`,
            inline: true,
          },
          {
            name: "État",
            value:
              sniperData.status === "active" && isMemoryActive
                ? "🟢 En cours de surveillance (~5s)"
                : sniperData.status === "claimed"
                  ? "🎯 Réclamé"
                  : "🔴 Arrêté",
            inline: true,
          },
          {
            name: "Vérifications",
            value: `\`${checks}\``,
            inline: true,
          },
          {
            name: "Salon d'alerte",
            value: sniperData.channelId ? `<#${sniperData.channelId}>` : "Non défini",
            inline: true,
          },
          {
            name: "Configuré par",
            value: sniperData.userId ? `<@${sniperData.userId}>` : "Inconnu",
            inline: true,
          },
          {
            name: "Dernière vérification",
            value: sniperData.lastCheck ? `<t:${Math.floor(sniperData.lastCheck / 1000)}:R>` : "Jamais",
            inline: true,
          },
        );

      if (sniperData.lastError) {
        embed.addFields({
          name: "Dernière anomalie",
          value: `\`${sniperData.lastError.slice(0, 500)}\``,
          inline: false,
        });
      }

      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    // 3. Commande CHECK
    if (sub === "check") {
      if (!args[1]) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                `Veuillez spécifier le code ou l'URL à vérifier. Exemple : \`${prefix}snipeurl check mon-url\``,
              ),
            ],
          })
          .catch(() => {});
      }

      const target = cleanCode(args[1]);
      if (!isValidCode(target)) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                "Format de code invalide (2 à 32 caractères alphanumériques ou tirets).",
              ),
            ],
          })
          .catch(() => {});
      }

      const res = await checkAvailability(target);
      if (res.available) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.success(
                client,
                `🟢 L'URL **discord.gg/${target}** est **disponible** et libre d'être réclamée !`,
              ),
            ],
          })
          .catch(() => {});
      } else if (res.guild) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                `🔴 L'URL **discord.gg/${target}** est actuellement occupée par le serveur **${res.guild.name}** (ID: \`${res.guild.id}\`).`,
              ),
            ],
          })
          .catch(() => {});
      } else {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                `Impossible de vérifier l'URL : ${res.error || "Réponse inattendue"}`,
              ),
            ],
          })
          .catch(() => {});
      }
    }

    // 4. Lancement du SNIPER
    const targetCode = cleanCode(args[0]);
    if (!isValidCode(targetCode)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              "Format de code d'URL invalide. Entrez un code ou un lien Discord (ex: `+snipeurl mon-serveur` ou `+snipeurl https://discord.gg/mon-serveur`).",
            ),
          ],
        })
        .catch(() => {});
    }

    // Vérifier si le serveur a déjà cette URL
    if (message.guild.vanityURLCode && message.guild.vanityURLCode.toLowerCase() === targetCode) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.info(
              client,
              `Ce serveur possède déjà l'URL personnalisée **discord.gg/${targetCode}** !`,
            ),
          ],
        })
        .catch(() => {});
    }

    // Avertissement Boosts si le serveur n'a pas la feature VANITY_URL
    const hasVanityFeature = message.guild.features.includes("VANITY_URL");
    const warningBoost = !hasVanityFeature
      ? "\n\n⚠️ **Note :** Ce serveur n'a pas encore le niveau 3 de Boost Discord (`VANITY_URL`). La surveillance est active, mais Discord refusera l'attribution automatique tant que le niveau 3 de Boost n'est pas atteint."
      : "";

    try {
      startSniper(client, message.guild.id, {
        vanityCode: targetCode,
        channelId: message.channel.id,
        userId: message.author.id,
      });

      const embed = client.embedBuilder
        .success(
          client,
          `🎯 **Sniper d'URL activé !**\n\nLe bot surveille en continu **discord.gg/${targetCode}** (intervalle ~5s).\nDès que l'URL se libère, elle sera automatiquement revendiquée pour ce serveur.${warningBoost}`,
        )
        .addFields(
          { name: "URL ciblée", value: `\`discord.gg/${targetCode}\``, inline: true },
          { name: "Salon d'alerte", value: `<#${message.channel.id}>`, inline: true },
          { name: "Arrêter", value: `\`${prefix}snipeurl stop\``, inline: true },
        );

      return message.reply({ embeds: [embed] }).catch(() => {});
    } catch (err) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              `Erreur lors du démarrage du sniper : ${err.message}`,
            ),
          ],
        })
        .catch(() => {});
    }
  },
};
