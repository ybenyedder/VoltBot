const express = require("express");
const Logger = require("../../utils/logger.js");
const { t } = require("../../utils/i18n");
const {
  invalidateGuildCache,
} = require("../../events/handlers/automodHandler");

module.exports = function (client, middlewares, helpers) {
  const router = express.Router();
  const { requireAuth, requireGuildAdmin } = middlewares;
  const { logDashboardAction } = helpers;

  router.get(
    "/:guildId/economy",
    requireAuth,
    requireGuildAdmin,
    async (req, res) => {
      try {
        const users = client.db.db
          .prepare(
            "SELECT userId, coins, bank FROM users WHERE guildId = ? AND (coins > 0 OR bank > 0) ORDER BY (coins + bank) DESC",
          )
          .all(req.params.guildId);
        const guild = client.guilds.cache.get(req.params.guildId);
        if (!guild)
          return res
            .status(404)
            .json({ error: t(req.lang, "dashboard.economy.guild_not_found") });

        const economyData = [];
        for (const u of users) {
          try {
            const member = await guild.members
              .fetch(u.userId)
              .catch(() => null);
            if (member) {
              economyData.push({
                id: u.userId,
                username: member.user.username,
                avatar: member.user.displayAvatarURL({ dynamic: true }),
                coins: u.coins,
                bank: u.bank,
              });
            }
          } catch (e) {}
        }

        res.json(economyData);
      } catch (error) {
        Logger.error(`[DASHBOARD ECONOMY ERROR] reqId=${req.reqId}`, error);
        res
          .status(500)
          .json({
            error: t(req.lang, "dashboard.economy.fetch_error"),
            reqId: req.reqId,
          });
      }
    },
  );

  router.get(
    "/:guildId/economy/settings",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      try {
        const settings = client.db.getGuild(req.params.guildId);
        res.json({
          currencyName: settings.currencyName || "Coins",
          currencyEmoji: settings.currencyEmoji || "",
          minWork: settings.minWork || 50,
          maxWork: settings.maxWork || 200,
          minDaily: settings.minDaily || 200,
          maxDaily: settings.maxDaily || 1000,
          dropChannels: JSON.parse(settings.dropChannels || "[]"),
        });
      } catch (error) {
        Logger.error(
          `[DASHBOARD ECONOMY SETTINGS GET ERROR] reqId=${req.reqId}`,
          error,
        );
        res
          .status(500)
          .json({
            error: t(req.lang, "dashboard.economy.settings_error"),
            reqId: req.reqId,
          });
      }
    },
  );

  router.patch(
    "/:guildId/economy/settings",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      const updates = req.body;
      const allowed = [
        "currencyName",
        "currencyEmoji",
        "minWork",
        "maxWork",
        "minDaily",
        "maxDaily",
        "dropChannels",
      ];
      const cleanUpdates = {};

      allowed.forEach((key) => {
        if (updates[key] !== undefined) {
          if (["minWork", "maxWork", "minDaily", "maxDaily"].includes(key)) {
            cleanUpdates[key] = parseInt(updates[key], 10);
          } else if (key === "dropChannels") {
            cleanUpdates[key] = JSON.stringify(updates[key]);
          } else {
            cleanUpdates[key] = updates[key].toString();
          }
        }
      });

      try {
        client.db.updateGuild(req.params.guildId, cleanUpdates);
        client.guildSettingsCache.delete(req.params.guildId);
        invalidateGuildCache(req.params.guildId);
        logDashboardAction(
          req.params.guildId,
          req.user.id,
          req.user.username,
          "UPDATE_ECONOMY_SETTINGS",
          cleanUpdates,
        );
        res.json({ success: true });
      } catch (error) {
        Logger.error(
          `[DASHBOARD ECONOMY SETTINGS PATCH ERROR] reqId=${req.reqId}`,
          error,
        );
        res.status(500).json({
          error: t(req.lang, "dashboard.economy.settings_update_error"),
          reqId: req.reqId,
        });
      }
    },
  );

  router.get(
    "/:guildId/economy/shop",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      try {
        const items = client.db.getEconomyShop(req.params.guildId);
        res.json(items);
      } catch (error) {
        Logger.error(
          `[DASHBOARD ECONOMY SHOP GET ERROR] reqId=${req.reqId}`,
          error,
        );
        res.status(500).json({ error: "Erreur boutique", reqId: req.reqId });
      }
    },
  );

  router.post(
    "/:guildId/economy/shop",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      const { name, description, price, roleId, itemType } = req.body;

      const priceNum = parseInt(price, 10);
      if (
        typeof name !== "string" ||
        !name.trim() ||
        !price ||
        isNaN(priceNum) ||
        priceNum <= 0
      ) {
        return res
          .status(400)
          .json({ error: "Nom et prix valide (nombre positif) requis" });
      }
      if (description !== undefined && typeof description !== "string") {
        return res.status(400).json({ error: "Description invalide" });
      }

      const itemTypeValue = itemType || "role";
      if (!["role", "item"].includes(itemTypeValue)) {
        return res.status(400).json({ error: "Type d'article invalide" });
      }
      if (
        itemTypeValue === "role" &&
        (typeof roleId !== "string" || !/^\d{17,20}$/.test(roleId.trim()))
      ) {
        return res.status(400).json({
          error: t(req.lang, "dashboard.economy.role_id_required"),
        });
      }

      // Length caps to bound stored payload size and prevent log spam.
      const safeName = name.trim().substring(0, 100);
      const safeDesc =
        typeof description === "string"
          ? description.trim().substring(0, 400)
          : null;
      const safeRoleId =
        typeof roleId === "string" && /^\d{17,20}$/.test(roleId.trim())
          ? roleId.trim()
          : null;

      try {
        client.db.addShopItem(req.params.guildId, {
          name: safeName,
          description: safeDesc,
          price: priceNum,
          roleId: safeRoleId,
          itemType: itemTypeValue,
        });
        logDashboardAction(
          req.params.guildId,
          req.user.id,
          req.user.username,
          "SHOP_ITEM_ADD",
          {
            name: safeName,
            price: priceNum,
            roleId: safeRoleId,
            itemType: itemTypeValue,
          },
        );
        res.json({ success: true });
      } catch (error) {
        Logger.error(`[DASHBOARD SHOP ADD ERROR] reqId=${req.reqId}`, error);
        res.status(500).json({
          error: t(req.lang, "dashboard.economy.shop_add_error"),
          reqId: req.reqId,
        });
      }
    },
  );

  router.delete(
    "/:guildId/economy/shop/:id",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      const shopId = parseInt(req.params.id, 10);
      if (isNaN(shopId)) {
        return res.status(400).json({ error: "Identifiant invalide" });
      }
      try {
        client.db.deleteShopItem(req.params.guildId, shopId);
        logDashboardAction(
          req.params.guildId,
          req.user.id,
          req.user.username,
          "SHOP_ITEM_DELETE",
          { id: shopId },
        );
        res.json({ success: true });
      } catch (error) {
        Logger.error(
          `[DASHBOARD SHOP DELETE ERROR] reqId=${req.reqId}`,
          error,
        );
        res
          .status(500)
          .json({ error: "Erreur suppression boutique", reqId: req.reqId });
      }
    },
  );

  router.post(
    "/:guildId/economy/shop/deploy",
    requireAuth,
    requireGuildAdmin,
    async (req, res) => {
      const { channelId } = req.body;
      const guild = req.guild;
      const channel = guild.channels.cache.get(channelId);

      if (!channel) return res.status(404).json({ error: "Salon introuvable" });

      try {
        const settings = client.db.getGuild(guild.id);
        const items = client.db.getEconomyShop(guild.id);

        if (items.length === 0)
          return res.status(400).json({ error: "La boutique est vide" });

        const currencyEmoji = settings.currencyEmoji || "";
        const embed = client.embedBuilder
          .base(
            client,
            t(req.lang, "dashboard.economy.shop_title"),
            t(req.lang, "dashboard.economy.shop_intro", {
              currencyName: settings.currencyName || "Coins",
              currencyEmoji,
            }),
          )
          .setThumbnail(guild.iconURL({ dynamic: true }));

        const {
          ActionRowBuilder,
          StringSelectMenuBuilder,
        } = require("discord.js");

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId("shop_buy_select")
          .setPlaceholder(t(req.lang, "dashboard.economy.shop_select_placeholder"))
          .addOptions(
            items.slice(0, 25).map((item) => ({
              label: item.name,
              description: `${item.price} - ${item.description || "Pas de description"}`,
              emoji: currencyEmoji,
              value: `shop_item_${item.id}`,
            })),
          );

        await channel.send({
          embeds: [embed],
          components: [new ActionRowBuilder().addComponents(selectMenu)],
        });
        logDashboardAction(
          guild.id,
          req.user.id,
          req.user.username,
          "SHOP_DEPLOY",
          { channelId },
        );
        res.json({ success: true });
      } catch (error) {
        Logger.error(`[DASHBOARD SHOP DEPLOY ERROR] reqId=${req.reqId}`, error);
        res.status(500).json({
          error: t(req.lang, "dashboard.economy.shop_deploy_error"),
          reqId: req.reqId,
        });
      }
    },
  );

  router.patch(
    "/:guildId/economy/:userId",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      if (!/^\d{17,20}$/.test(req.params.userId)) {
        return res.status(400).json({ error: "ID utilisateur invalide" });
      }
      const { coins, bank } = req.body;
      const parsedCoins = parseInt(coins, 10);
      const parsedBank = parseInt(bank, 10);

      if (
        isNaN(parsedCoins) ||
        isNaN(parsedBank) ||
        parsedCoins < 0 ||
        parsedBank < 0
      ) {
        return res
          .status(400)
          .json({
            error: t(req.lang, "dashboard.economy.amounts_must_be_positive"),
          });
      }

      try {
        client.db.getUser(req.params.userId, req.params.guildId);
        client.db.db
          .prepare(
            "UPDATE users SET coins = ?, bank = ? WHERE userId = ? AND guildId = ?",
          )
          .run(parsedCoins, parsedBank, req.params.userId, req.params.guildId);

        logDashboardAction(
          req.params.guildId,
          req.user.id,
          req.user.username,
          "UPDATE_USER_ECONOMY",
          {
            userId: req.params.userId,
            coins: parsedCoins,
            bank: parsedBank,
          },
        );
        res.json({ success: true, coins: parsedCoins, bank: parsedBank });
      } catch (error) {
        Logger.error(
          `[DASHBOARD ECONOMY UPDATE ERROR] reqId=${req.reqId}`,
          error,
        );
        res.status(500).json({
          error: "Erreur lors de la modification",
          reqId: req.reqId,
        });
      }
    },
  );

  router.post(
    "/:guildId/economy/:userId",
    requireAuth,
    requireGuildAdmin,
    (req, res) => {
      const { action, amount, walletType } = req.body;
      const { guildId, userId } = req.params;

      if (!/^\d{17,20}$/.test(userId)) {
        return res.status(400).json({ error: "ID utilisateur invalide" });
      }

      if (!["add", "remove", "set", "reset"].includes(action)) {
        return res.status(400).json({
          error: "Action invalide. Utilisez add, remove, set ou reset.",
        });
      }

      if (!["coins", "bank"].includes(walletType) && action !== "reset") {
        return res.status(400).json({
          error: "Type de portefeuille invalide. Utilisez coins ou bank.",
        });
      }

      const amountNum = action === "reset" ? 0 : parseInt(amount, 10);
      if (action !== "reset" && (isNaN(amountNum) || amountNum < 0)) {
        return res
          .status(400)
          .json({
            error: t(req.lang, "dashboard.economy.invalid_amount_positive"),
          });
      }

      try {
        let user;
        if (action === "reset") {
          user = client.db.resetEconomy(userId, guildId);
        } else if (action === "add") {
          if (walletType === "coins")
            user = client.db.addCoins(userId, guildId, amountNum);
          else
            user = client.db.updateUser(userId, guildId, {
              bank: (client.db.getUser(userId, guildId).bank || 0) + amountNum,
            });
        } else if (action === "remove") {
          if (walletType === "coins")
            user = client.db.removeCoins(userId, guildId, amountNum);
          else
            user = client.db.updateUser(userId, guildId, {
              bank: Math.max(
                0,
                (client.db.getUser(userId, guildId).bank || 0) - amountNum,
              ),
            });
        } else if (action === "set") {
          if (walletType === "coins")
            user = client.db.setCoins(userId, guildId, amountNum);
          else user = client.db.setBank(userId, guildId, amountNum);
        }

        logDashboardAction(
          guildId,
          req.user.id,
          req.user.username,
          "ECONOMY_ACTION",
          { userId, action, walletType, amount: amountNum },
        );
        res.json({ success: true, newValue: user[walletType], user });
      } catch (error) {
        Logger.error(
          `[DASHBOARD ECONOMY ACTION ERROR] reqId=${req.reqId}`,
          error,
        );
        res.status(500).json({
          error: t(req.lang, "dashboard.economy.action_error"),
          reqId: req.reqId,
        });
      }
    },
  );

  return router;
};
