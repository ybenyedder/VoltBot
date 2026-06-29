module.exports = {
  name: "search",
  description: "Recherche des informations sur Discord",
  category: "utility",
  usage: "search",
  async execute(client, message, args) {
    if (!args[0]) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.search.term_required"),
            ),
          ],
        })
        .catch(() => {});
    }

    const query = args.join(" ");
    const lower = query.toLowerCase();

    const matchedMembers = message.guild.members.cache.filter(
      (m) =>
        m.user.username.toLowerCase().includes(lower) ||
        m.displayName.toLowerCase().includes(lower),
    );
    const matchedRoles = message.guild.roles.cache.filter((r) =>
      r.name.toLowerCase().includes(lower),
    );
    const matchedChannels = message.guild.channels.cache.filter((c) =>
      c.name.toLowerCase().includes(lower),
    );

    const embed = client.embedBuilder
      .base(client, message.t("commands.search.title", { query }))
      .addFields(
        {
          name: message.t("commands.search.field_members"),
          value: `\`${matchedMembers.size}\``,
          inline: true,
        },
        {
          name: message.t("commands.search.field_roles"),
          value: `\`${matchedRoles.size}\``,
          inline: true,
        },
        {
          name: message.t("commands.search.field_channels"),
          value: `\`${matchedChannels.size}\``,
          inline: true,
        },
      );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
