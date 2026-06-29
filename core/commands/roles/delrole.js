const {
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const permissions = require("../../utils/permissions");

module.exports = {
  name: "delrole",
  aliases: ["deleterole"],
  description: "Supprime un rôle du serveur.",
  category: "roles",
  usage: "+delrole <role>",
  userPerms: [PermissionsBitField.Flags.ManageRoles],
  botPerms: [PermissionsBitField.Flags.ManageRoles],
  async execute(client, message, args) {
    const role =
      message.mentions.roles.first() || message.guild.roles.cache.get(args[0]);
    if (!role)
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.delrole.role_not_found"))],
        })
        .catch(() => {});

    const ownerBypass = permissions.isPrimaryOwner(message.author.id);

    if (
      !ownerBypass &&
      message.member.roles.highest.position <= role.position &&
      message.author.id !== message.guild.ownerId
    ) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.delrole.role_higher_than_you")),
          ],
        })
        .catch(() => {});
    }

    if (message.guild.members.me.roles.highest.position <= role.position) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.delrole.role_higher_than_bot"),
            ),
          ],
        })
        .catch(() => {});
    }

    const affected = role.members.size;
    const confirmEmbed = client.embedBuilder
      .warning(client, message.t("commands.delrole.confirm_prompt"))
      .addFields(
        { name: message.t("commands.delrole.field_name"), value: `${role}`, inline: true },
        { name: message.t("commands.delrole.field_members"), value: `${affected}`, inline: true },
        { name: message.t("commands.delrole.field_id"), value: `\`${role.id}\``, inline: true },
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("delrole_confirm")
        .setLabel(message.t("commands.delrole.btn_delete"))
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("delrole_cancel")
        .setLabel(message.t("commands.delrole.btn_cancel"))
        .setStyle(ButtonStyle.Secondary),
    );

    const prompt = await message
      .reply({ embeds: [confirmEmbed], components: [row] })
      .catch(() => null);
    if (!prompt) return;

    const filter = (i) =>
      i.user.id === message.author.id &&
      ["delrole_confirm", "delrole_cancel"].includes(i.customId);
    const collector = prompt.createMessageComponentCollector({
      filter,
      time: 30_000,
      max: 1,
    });

    collector.on("collect", async (interaction) => {
      if (interaction.customId === "delrole_cancel") {
        await interaction
          .update({
            embeds: [client.embedBuilder.info(client, message.t("commands.delrole.cancelled"))],
            components: [],
          })
          .catch(() => {});
        return;
      }

      const roleName = role.name;
      const roleId = role.id;
      try {
        await role.delete(message.t("commands.delrole.audit_reason", { tag: message.author.tag }));
        const embed = client.embedBuilder
          .success(client, message.t("commands.delrole.deleted"))
          .addFields(
            { name: message.t("commands.delrole.field_name"), value: `\`${roleName}\``, inline: true },
            { name: message.t("commands.delrole.field_affected_members"), value: `${affected}`, inline: true },
            { name: message.t("commands.delrole.field_moderator"), value: `${message.author}`, inline: true },
            { name: message.t("commands.delrole.field_id"), value: `\`${roleId}\``, inline: true },
          );
        await interaction
          .update({ embeds: [embed], components: [] })
          .catch(() => {});
      } catch (err) {
        await interaction
          .update({
            embeds: [client.embedBuilder.error(client, message.t("commands.delrole.not_manageable"))],
            components: [],
          })
          .catch(() => {});
      }
    });

    collector.on("end", async (collected) => {
      if (collected.size === 0) {
        await prompt
          .edit({
            embeds: [client.embedBuilder.info(client, message.t("commands.delrole.timeout"))],
            components: [],
          })
          .catch(() => {});
      }
    });
  },
};
