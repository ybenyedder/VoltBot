const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");
const Logger = require("../../utils/logger");

const safeRespond = async (interaction, payload) => {
  try {
    if (interaction.replied || interaction.deferred) {
      return await interaction.followUp(payload);
    }
    return await interaction.reply(payload);
  } catch (_) {
    /* swallow */
  }
};

const replaceVars = (str, user, currency, data = {}) => {
  if (!str) return "";
  return str
    .replace(/{user}/g, user.username)
    .replace(/{coins}/g, data.coins || 0)
    .replace(/{currency}/g, currency)
    .replace(/{role}/g, data.role || "rôle")
    .replace(/{item}/g, data.item || "objet");
};

const getCasinoSettings = (client, guildId) => {
  const config = client.db.getGuild(guildId);
  const rawConfig = config.casinoConfig || '{"rewards":[],"settings":{}}';
  let casinoConfig;
  try {
    casinoConfig = JSON.parse(rawConfig);
  } catch (e) {
    Logger.error(
      `[CASINO] config JSON parse failed guild=${guildId}:`,
      e,
    );
    casinoConfig = { rewards: [], settings: {} };
  }
  if (Array.isArray(casinoConfig)) {
    casinoConfig = { rewards: casinoConfig, settings: {} };
  }
  return { casinoConfig, currency: config.currencyEmoji || "" };
};

const getMainEmbed = (guild, s, tr) => {
  const defaultTitle = `${guild.name} Casino`;
  const defaultDesc = tr
    ? tr("interactions.casino.default_desc", { guild: guild.name })
    : `Bienvenue au **${guild.name} Casino** ! Tentez votre chance pour gagner des rôles, des couleurs et des badges exclusifs.\n\nCliquez sur les boutons ci-dessous pour naviguer.`;

  const embed = new EmbedBuilder()
    .setColor(s.embedColor || "#2b2d31")
    .setTitle(s.embedTitle || defaultTitle)
    .setDescription(s.embedDescription || defaultDesc)
    .setThumbnail(guild.iconURL({ dynamic: true }));

  const image =
    s.embedImage ||
    "https://media.discordapp.net/attachments/1113554445558485052/1113554445558485052/shibuya_banner.png";
  if (image.startsWith("http")) embed.setImage(image);

  return embed;
};

const getRow = (s, tr) => {
  const showEmoji = s.showEmojis === true;
  const bProfile = new ButtonBuilder()
    .setCustomId("shibuya_profile")
    .setLabel(s.labelProfile || "Profil")
    .setStyle(ButtonStyle.Secondary);
  const bDraw = new ButtonBuilder()
    .setCustomId("shibuya_draw")
    .setLabel(s.labelDraw || "Tirage")
    .setStyle(ButtonStyle.Primary);
  const bShop = new ButtonBuilder()
    .setCustomId("shibuya_shop")
    .setLabel(s.labelShop || "Shop")
    .setStyle(ButtonStyle.Secondary);
  const bInv = new ButtonBuilder()
    .setCustomId("shibuya_inv")
    .setLabel(s.labelInv || "Inventaire")
    .setStyle(ButtonStyle.Secondary);
  const bSuccess = new ButtonBuilder()
    .setCustomId("shibuya_success")
    .setLabel(
      s.labelSuccess ||
        (tr ? tr("interactions.casino.label_success") : "Succès"),
    )
    .setStyle(ButtonStyle.Secondary);

  if (showEmoji) {
    bProfile;
    bDraw;
    bShop;
    bInv;
    bSuccess;
  }

  return new ActionRowBuilder().addComponents(
    bProfile,
    bDraw,
    bShop,
    bInv,
    bSuccess,
  );
};

const performDraw = (client, guildId, userId, casinoConfig) => {
  const rand = Math.random() * 100;
  const rewards = casinoConfig.rewards || [];

  if (rand < 60) return { type: "nothing", name: "Rien" };
  if (rand < 85) {
    const bonus = Math.floor(Math.random() * 400) + 100;
    client.db.addCoins(userId, guildId, bonus);
    return { type: "coins", name: `${bonus} Coins`, amount: bonus };
  }

  let tier = "common";
  if (rand >= 98) tier = "legendary";
  else if (rand >= 93) tier = "epic";
  else if (rand >= 85) tier = "rare";

  let reward = rewards.find((r) => r.tier === tier);

  // Si le tier spécifique n'a pas de rôle configuré, essayons de prendre n'importe quel rôle configuré
  if (!reward || !(reward.roleIds?.length > 0 || reward.roleId)) {
    const backupRewards = rewards.filter(
      (r) => r.roleIds?.length > 0 || r.roleId,
    );
    if (backupRewards.length > 0) {
      reward = backupRewards[Math.floor(Math.random() * backupRewards.length)];
    }
  }

  const roleIds = reward?.roleIds || (reward?.roleId ? [reward.roleId] : []);

  if (roleIds.length > 0) {
    const roleId = roleIds[Math.floor(Math.random() * roleIds.length)];
    const role = client.guilds.cache.get(guildId)?.roles.cache.get(roleId);
    const roleName = role ? role.name : tier;
    const bonusCoins = Math.floor(Math.random() * 500) + 200;
    // Atomic inventory grant + coin bonus so the draw can't half-apply.
    client.db.addItemAndCoins(userId, guildId, roleName, 1, bonusCoins);
    return { type: "role", name: roleName, bonusCoins, roleId, success: true };
  }

  // Fallback si vraiment aucun rôle paramétré sur le dashboard
  const fallbackCoins = Math.floor(Math.random() * 800) + 500;
  client.db.addCoins(userId, guildId, fallbackCoins);
  return {
    type: "coins",
    name: `${fallbackCoins} Coins de Compensation`,
    amount: fallbackCoins,
  };
};

const handleCasinoInteractions = async (interaction, client) => {
  if (!interaction.isButton()) return false;

  try {
    const { casinoConfig, currency } = getCasinoSettings(
      client,
      interaction.guild.id,
    );
    const s = casinoConfig.settings || {};
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;

    if (interaction.customId === "shibuya_profile") {
      const user = client.db.getUser(userId, guildId);
      const embed = new EmbedBuilder()
        .setColor(s.embedColor || "#2b2d31")
        .setTitle(
          interaction.t("interactions.casino.profile_title", {
            user: interaction.user.username,
          }),
        )
        .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
        .addFields(
          {
            name: interaction.t("interactions.casino.balance"),
            value: `**${user.coins}** ${currency}`,
            inline: true,
          },
          {
            name: interaction.t("interactions.casino.draws"),
            value: `**${user.casinoDraws || 0}**`,
            inline: true,
          },
          {
            name: interaction.t("interactions.casino.equipment"),
            value: interaction.t("interactions.casino.equipment_value", {
              color: user.equippedColor || "—",
              badge: user.equippedBadge || "—",
              role: user.equippedRole || "—",
            }),
            inline: false,
          },
        );
      await interaction.reply({
        embeds: [embed],
        flags: [MessageFlags.Ephemeral],
      });
      return true;
    }

    if (interaction.customId === "shibuya_draw") {
      const user = client.db.getUser(userId, guildId);
      const minLevel = parseInt(s.minLevel) || 0;
      if (user.level < minLevel) {
        await interaction.reply({
          embeds: [
            client.embedBuilder.error(
              client,
              interaction.t("interactions.casino.level_required", {
                minLevel,
                level: user.level,
              }),
            ),
          ],
          flags: [MessageFlags.Ephemeral],
        });
        return true;
      }

      const drawRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("draw_1")
          .setLabel("x1")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("draw_5")
          .setLabel("x5")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("draw_10")
          .setLabel("x10")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("draw_quit")
          .setLabel(interaction.t("interactions.casino.quit"))
          .setStyle(ButtonStyle.Secondary),
      );

      const embed = new EmbedBuilder()
        .setColor(s.embedColor || "#2b2d31")
        .setTitle(interaction.t("interactions.casino.draw_title"))
        .addFields(
          {
            name: interaction.t("interactions.casino.cost"),
            value: interaction.t("interactions.casino.cost_per_draw"),
            inline: true,
          },
          {
            name: interaction.t("interactions.casino.balance"),
            value: `**${user.coins}** ${currency}`,
            inline: true,
          },
        )
        .setThumbnail(interaction.guild.iconURL({ dynamic: true }));

      await interaction.reply({
        embeds: [embed],
        components: [drawRow],
        flags: [MessageFlags.Ephemeral],
      });
      return true;
    }

    if (interaction.customId === "draw_quit") {
      const embed = new EmbedBuilder()
        .setColor(s.embedColor || "#2b2d31")
        .setTitle(interaction.t("interactions.casino.session_closed_title"))
        .setDescription(
          interaction.t("interactions.casino.session_closed_desc"),
        );
      await interaction
        .update({ embeds: [embed], components: [] })
        .catch(() => {});
      return true;
    }

    if (interaction.customId.startsWith("draw_")) {
      const count = parseInt(interaction.customId.split("_")[1]);
      const cost = count * 1000;

      // Attempt to remove coins safely in one SQL transaction
      const success = client.db.tryRemoveCoins(userId, guildId, cost);

      if (!success) {
        await interaction.reply({
          embeds: [
            client.embedBuilder.error(
              client,
              interaction.t("interactions.casino.insufficient_balance", {
                cost,
                currency,
              }),
            ),
          ],
          flags: [MessageFlags.Ephemeral],
        });
        return true;
      }

      client.db.incrementDraws(userId, guildId, count);

      const results = [];
      for (let j = 0; j < count; j++) {
        const res = performDraw(client, guildId, userId, casinoConfig);
        results.push(res);

        // Ajout effectif du rôle sur le membre Discord
        if (res.roleId) {
          try {
            if (
              interaction.member &&
              typeof interaction.member.roles.add === "function"
            ) {
              await interaction.member.roles.add(res.roleId);
            }
          } catch (error) {
            Logger.warn(
              `[CASINO] role add failed guild=${interaction.guild?.id} user=${interaction.user?.id} role=${res.roleId}: ${error?.message}`,
            );
          }
        }
      }

      // Compute gain net
      let gainCoins = 0;
      const resultLabels = [];
      for (const r of results) {
        if (r.type === "coins") {
          gainCoins += r.amount || 0;
          resultLabels.push(r.name);
        } else if (r.type === "role") {
          gainCoins += r.bonusCoins || 0;
          const mention = r.roleId ? `<@&${r.roleId}>` : r.name;
          resultLabels.push(
            interaction.t("interactions.casino.result_role", { mention }),
          );
        } else {
          resultLabels.push(interaction.t("interactions.casino.result_nothing"));
        }
      }
      const net = gainCoins - cost;
      const finalUser = client.db.getUser(userId, guildId);

      const won = results.some((r) => r.type !== "nothing");
      const resultValue =
        count === 1
          ? resultLabels[0]
          : resultLabels
              .map((l) => `- ${l}`)
              .join("\n")
              .slice(0, 1024);

      const embed = new EmbedBuilder()
        .setColor(won ? "#57f287" : "#ed4245")
        .setTitle(interaction.t("interactions.casino.draw_title"))
        .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
        .addFields(
          {
            name: interaction.t("interactions.casino.bet"),
            value: `**${cost}** ${currency}`,
            inline: true,
          },
          {
            name: interaction.t("interactions.casino.result"),
            value: resultValue || "—",
            inline: true,
          },
          {
            name: interaction.t("interactions.casino.net_gain"),
            value: `${net >= 0 ? "+" : ""}${net} ${currency}`,
            inline: true,
          },
          {
            name: interaction.t("interactions.casino.balance"),
            value: `**${finalUser.coins}** ${currency}`,
            inline: true,
          },
        );

      const replayRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`draw_${count}`)
          .setLabel(interaction.t("interactions.casino.replay"))
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("draw_quit")
          .setLabel(interaction.t("interactions.casino.quit"))
          .setStyle(ButtonStyle.Secondary),
      );

      await interaction.update({ embeds: [embed], components: [replayRow] });
      return true;
    }

    if (interaction.customId === "shibuya_back") {
      return true;
    }

    if (interaction.customId === "shibuya_inv") {
      const inv = client.db.getInventory(userId, guildId);
      if (inv.length === 0) {
        await interaction.reply({
          embeds: [
            client.embedBuilder.info(
              client,
              interaction.t("interactions.casino.inventory_empty"),
            ),
          ],
          flags: [MessageFlags.Ephemeral],
        });
        return true;
      }

      const desc = inv
        .map((item) => `- **${item.item}** ×${item.amount}`)
        .join("\n");

      const embed = new EmbedBuilder()
        .setColor(s.embedColor || "#2b2d31")
        .setTitle(interaction.t("interactions.casino.inventory_title"))
        .setDescription(desc);

      await interaction.reply({
        embeds: [embed],
        flags: [MessageFlags.Ephemeral],
      });
      return true;
    }

    if (interaction.customId === "shibuya_shop") {
      await interaction.reply({
        embeds: [
          client.embedBuilder.info(
            client,
            interaction.t("interactions.casino.shop_unavailable"),
          ),
        ],
        flags: [MessageFlags.Ephemeral],
      });
      return true;
    }

    if (interaction.customId === "shibuya_success") {
      await interaction.reply({
        embeds: [
          client.embedBuilder.info(
            client,
            interaction.t("interactions.casino.success_unavailable"),
          ),
        ],
        flags: [MessageFlags.Ephemeral],
      });
      return true;
    }

    return false;
  } catch (e) {
    await safeRespond(interaction, {
      embeds: [
        client.embedBuilder.error(
          client,
          interaction.t("interactions.casino.error"),
        ),
      ],
      flags: [MessageFlags.Ephemeral],
    });
    return true;
  }
};

module.exports = {
  handleCasinoInteractions,
  getMainEmbed,
  getRow,
  getCasinoSettings,
};
