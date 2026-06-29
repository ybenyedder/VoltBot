const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const LIMIT = 10;
const fmtNum = (n) => new Intl.NumberFormat("fr-FR").format(n || 0);

const ordinal = (n) => (n === 1 ? "1er" : `${n}e`);

const buildEmbed = (client, message, allInvites, page) => {
  const totalPages = Math.max(1, Math.ceil(allInvites.length / LIMIT));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = (safePage - 1) * LIMIT;
  const paginated = allInvites.slice(startIndex, startIndex + LIMIT);

  let description;
  if (paginated.length === 0) {
    description = message.t("commands.topinvites.none");
  } else {
    description = paginated
      .map((u, index) => {
        const rank = startIndex + index + 1;
        return message.t("commands.topinvites.line", {
          rank: ordinal(rank),
          user: `<@${u.userId}>`,
          total: fmtNum(u.total || 0),
        });
      })
      .join("\n");
  }

  const embed = client.embedBuilder.base(
    client,
    message.t("commands.topinvites.title"),
    description,
  );

  return { embed, totalPages, safePage };
};

const buildRow = (message, page, totalPages) => {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("topinvites_prev")
      .setLabel(message.t("commands.topinvites.btn_prev"))
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page <= 1),
    new ButtonBuilder()
      .setCustomId("topinvites_page")
      .setLabel(message.t("commands.topinvites.btn_page", { page, totalPages }))
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId("topinvites_next")
      .setLabel(message.t("commands.topinvites.btn_next"))
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page >= totalPages),
  );
  return row;
};

module.exports = {
  name: "topinvites",
  description: "Affiche le classement des invitations",
  category: "invitations",
  usage: "topinvites",
  async execute(client, message, args) {
    let page = parseInt(args[0]) || 1;

    const allInvites = client.db.getAllInviteData(message.guild.id);

    try {
      const guildInvites = await message.guild.invites
        .fetch()
        .catch(() => new Map());
      const inviteCounts = new Map();
      guildInvites.forEach((invite) => {
        if (invite.inviter) {
          inviteCounts.set(
            invite.inviter.id,
            (inviteCounts.get(invite.inviter.id) || 0) + invite.uses,
          );
        }
      });

      inviteCounts.forEach((uses, userId) => {
        let dbUser = allInvites.find((u) => u.userId === userId);
        if (!dbUser) {
          dbUser = {
            userId,
            regular: uses,
            bonus: 0,
            leaves: 0,
            total: uses,
            tag: client.users.cache.get(userId)?.tag || "Utilisateur",
          };
          allInvites.push(dbUser);
        } else {
          dbUser.regular = uses;
          dbUser.total = uses + (dbUser.bonus || 0) - (dbUser.leaves || 0);
          if (!dbUser.tag || dbUser.tag === "User") {
            dbUser.tag = client.users.cache.get(userId)?.tag || "Utilisateur";
          }
        }

        let invitesData = client.db.getUser(
          userId,
          message.guild.id,
          "invites",
        ) || { regular: 0, bonus: 0, leaves: 0, total: 0 };
        if (typeof invitesData === "string") {
          try {
            invitesData = JSON.parse(invitesData);
          } catch (e) {
            invitesData = { regular: 0, bonus: 0, leaves: 0, total: 0 };
          }
        }
        invitesData.regular = uses;
        invitesData.total = dbUser.total;
        client.db.updateUser(userId, message.guild.id, "invites", invitesData);
      });
    } catch (e) {
      // ignored
    }

    allInvites.sort((a, b) => (b.total || 0) - (a.total || 0));

    if (allInvites.length === 0) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.info(
              client,
              message.t("commands.topinvites.none"),
            ),
          ],
        })
        .catch(() => {});
    }

    const { embed, totalPages, safePage } = buildEmbed(
      client,
      message,
      allInvites,
      page,
    );
    page = safePage;

    const components = totalPages > 1 ? [buildRow(message, page, totalPages)] : [];
    const reply = await message
      .reply({ embeds: [embed], components })
      .catch(() => null);
    if (!reply || totalPages <= 1) return;

    const filter = (i) =>
      i.user.id === message.author.id && i.customId.startsWith("topinvites_");
    const collector = reply.createMessageComponentCollector({
      filter,
      time: 120_000,
    });

    collector.on("collect", async (interaction) => {
      switch (interaction.customId) {
        case "topinvites_prev":
          page = Math.max(1, page - 1);
          break;
        case "topinvites_next":
          page = Math.min(totalPages, page + 1);
          break;
        default:
          return interaction.deferUpdate().catch(() => {});
      }

      const rebuilt = buildEmbed(client, message, allInvites, page);
      page = rebuilt.safePage;
      await interaction
        .update({
          embeds: [rebuilt.embed],
          components: [buildRow(message, page, totalPages)],
        })
        .catch(() => {});
    });

    collector.on("end", () => {
      reply.edit({ components: [] }).catch(() => {});
    });
  },
};
