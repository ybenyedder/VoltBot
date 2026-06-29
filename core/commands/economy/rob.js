module.exports = {
  name: "rob",
  aliases: ["steal", "voler", "braquer"],
  description: "Tente de voler un utilisateur.",
  category: "economy",
  usage: "+rob @user",
  cooldown: 3600,
  async execute(client, message, args) {
    const target =
      message.mentions.members.first() ||
      message.guild.members.cache.get(args[0]);
    if (!target)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.rob.target_not_found"),
            ),
          ],
        })
        .catch(() => {});
    if (target.user.bot || target.id === message.author.id)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.rob.invalid_target"),
            ),
          ],
        })
        .catch(() => {});

    const fmt = new Intl.NumberFormat("fr-FR");

    const targetData = client.db.getUser(target.id, message.guild.id);
    const userData = client.db.getUser(message.author.id, message.guild.id);

    if (targetData.coins < 100)
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.rob.target_too_poor"),
            ),
          ],
        })
        .catch(() => {});
    if (userData.coins < 100)
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.rob.need_pocket_for_fine"),
            ),
          ],
        })
        .catch(() => {});

    const victimPadlock = client.db.db
      .prepare(
        "SELECT * FROM inventory WHERE userId = ? AND guildId = ? AND item = ?",
      )
      .get(target.id, message.guild.id, "padlock");

    let successRate = 45;
    let hadPadlock = false;

    if (victimPadlock && victimPadlock.amount > 0) {
      successRate = 15;
      hadPadlock = true;
    }

    const isSuccess = Math.floor(Math.random() * 100) < successRate;
    const outcome = (ok) =>
      ok
        ? client.embedBuilder.success(client, "")
        : client.embedBuilder.error(client, "");

    if (isSuccess) {
      const currentTargetCoins = client.db.getUser(
        target.id,
        message.guild.id,
      ).coins;
      const earnings = Math.floor(
        (currentTargetCoins * (Math.floor(Math.random() * 20) + 10)) / 100,
      );

      if (earnings <= 0)
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.rob.theft_cancelled_empty"),
              ),
            ],
          })
          .catch(() => {});

      // Atomic transfer victim -> thief. forceTransferCoins floors victim at
      // 0 since we deliberately ignore "insufficient" here (race-narrowing).
      client.db.forceTransferCoins(
        target.id,
        message.author.id,
        message.guild.id,
        earnings,
      );

      const embed = outcome(true)
        .setDescription(null)
        .addFields(
          {
            name: message.t("commands.rob.field_thief"),
            value: `${message.author}`,
            inline: true,
          },
          {
            name: message.t("commands.rob.field_target"),
            value: `${target}`,
            inline: true,
          },
          {
            name: message.t("commands.rob.field_loot"),
            value: `\`\`\`prolog\n${fmt.format(earnings)}\n\`\`\``,
            inline: true,
          },
        );
      if (hadPadlock)
        embed.setFooter({ text: message.t("commands.rob.padlock_bypassed") });
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    const fine = Math.floor((userData.coins * 15) / 100) || 50;
    // Atomic transfer thief -> victim for the fine.
    client.db.forceTransferCoins(
      message.author.id,
      target.id,
      message.guild.id,
      fine,
    );

    let footer = null;
    if (hadPadlock) {
      // Atomic decrement + auto-delete; safe against concurrent rob attempts
      // racing on the same padlock row.
      client.db.decrementItem(target.id, message.guild.id, "padlock", 1);
      footer = message.t("commands.rob.padlock_broken");
    }

    const embed = outcome(false)
      .setDescription(null)
      .addFields(
        {
          name: message.t("commands.rob.field_thief"),
          value: `${message.author}`,
          inline: true,
        },
        {
          name: message.t("commands.rob.field_target"),
          value: `${target}`,
          inline: true,
        },
        {
          name: message.t("commands.rob.field_fine"),
          value: `\`\`\`prolog\n${fmt.format(fine)}\n\`\`\``,
          inline: true,
        },
      );
    if (footer) embed.setFooter({ text: footer });
    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
