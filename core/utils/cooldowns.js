const { Collection, PermissionsBitField } = require("discord.js");
const permissions = require("./permissions");
const Logger = require("./logger");

module.exports = {
  check: (client, command, message) => {
    if (!command.cooldown) return false;

    // Bypass cooldowns for bot owners and server administrators
    const isBotOwner = permissions.isBotOwner(client, message.author.id);
    const isAdmin = !!message.member?.permissions?.has(
      PermissionsBitField.Flags.Administrator,
    );
    if (isBotOwner || isAdmin) {
      Logger.debug(
        `Cooldown bypass: ${message.author.tag} (${message.author.id}) on '${command.name}' [owner=${isBotOwner}, admin=${isAdmin}]`,
      );
      return false;
    }

    if (!client.cooldowns.has(command.name)) {
      client.cooldowns.set(command.name, new Collection());
    }

    const now = Date.now();
    const timestamps = client.cooldowns.get(command.name);
    const cooldownAmount = (command.cooldown || 3) * 1000;

    if (timestamps.has(message.author.id)) {
      const expirationTime = timestamps.get(message.author.id) + cooldownAmount;

      if (now < expirationTime) {
        const timeLeft = (expirationTime - now) / 1000;
        return timeLeft;
      }
    }

    timestamps.set(message.author.id, now);
    setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);

    return false;
  },
};
