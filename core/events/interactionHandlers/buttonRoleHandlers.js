const { MessageFlags } = require("discord.js");

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

/**
 * Handler pour l'attribution de rôles via boutons.
 * Pattern: customId commence par "br:".
 */
const handleButtonRoleInteractions = async (interaction, client) => {
  try {
    if (!interaction.isButton()) return false;
    if (!interaction.customId || !interaction.customId.startsWith("br:")) {
      return false;
    }
    if (!interaction.guild) return false;

    const row = client.db.getButtonRoleByCustomId(interaction.customId);
    if (!row) {
      await safeRespond(interaction, {
        embeds: [
          client.embedBuilder.error(
            client,
            interaction.t("interactions.buttonrole.button_expired"),
          ),
        ],
        flags: [MessageFlags.Ephemeral],
      });
      return true;
    }
    // Defense-in-depth: customIds are globally unique by construction, but a
    // stored row should never be applied in a different guild. roles.cache
    // lookup below would already fail, but reject early for clarity.
    if (row.guildId && row.guildId !== interaction.guild.id) {
      await safeRespond(interaction, {
        embeds: [
          client.embedBuilder.error(
            client,
            interaction.t("interactions.buttonrole.button_wrong_guild"),
          ),
        ],
        flags: [MessageFlags.Ephemeral],
      });
      return true;
    }

    const role = interaction.guild.roles.cache.get(row.roleId);
    if (!role) {
      await safeRespond(interaction, {
        embeds: [
          client.embedBuilder.error(
            client,
            interaction.t("interactions.buttonrole.role_not_found"),
          ),
        ],
        flags: [MessageFlags.Ephemeral],
      });
      return true;
    }

    const me = interaction.guild.members.me;
    if (me.roles.highest.position <= role.position) {
      await safeRespond(interaction, {
        embeds: [
          client.embedBuilder.error(
            client,
            interaction.t("interactions.buttonrole.role_too_high"),
          ),
        ],
        flags: [MessageFlags.Ephemeral],
      });
      return true;
    }

    const member = await interaction.guild.members
      .fetch(interaction.user.id)
      .catch(() => null);
    if (!member) {
      await safeRespond(interaction, {
        embeds: [
          client.embedBuilder.error(
            client,
            interaction.t("interactions.buttonrole.member_not_found"),
          ),
        ],
        flags: [MessageFlags.Ephemeral],
      });
      return true;
    }

    const has = member.roles.cache.has(role.id);
    try {
      if (has) {
        await member.roles.remove(role, "Button role toggle");
        await safeRespond(interaction, {
          embeds: [
            client.embedBuilder.success(
              client,
              interaction.t("interactions.buttonrole.role_removed", {
                role,
              }),
            ),
          ],
          flags: [MessageFlags.Ephemeral],
        });
      } else {
        await member.roles.add(role, "Button role toggle");
        await safeRespond(interaction, {
          embeds: [
            client.embedBuilder.success(
              client,
              interaction.t("interactions.buttonrole.role_added", {
                role,
              }),
            ),
          ],
          flags: [MessageFlags.Ephemeral],
        });
      }
    } catch (err) {
      client.logger?.error?.(
        `[BUTTON_ROLES] Toggle failed for ${interaction.user.id} on role ${role.id}: ${err.message}`,
      );
      await safeRespond(interaction, {
        embeds: [
          client.embedBuilder.error(
            client,
            interaction.t("interactions.buttonrole.toggle_failed"),
          ),
        ],
        flags: [MessageFlags.Ephemeral],
      });
    }

    return true;
  } catch (err) {
    client.logger?.error?.(
      `[BUTTON_ROLES] Handler error: ${err.message}`,
    );
    return false;
  }
};

module.exports = { handleButtonRoleInteractions };
